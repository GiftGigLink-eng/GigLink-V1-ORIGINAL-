/**
 * GigLink Server-Authoritative Milestone Lifecycle Service (Phase C-2B-1)
 *
 * Implements authoritative server endpoints and atomic mutations for:
 * 1. START MILESTONE (POST /api/contracts/milestones/start)
 * 2. SUBMIT MILESTONE (POST /api/contracts/milestones/submit)
 * 3. REVIEW MILESTONE (POST /api/contracts/milestones/review)
 *
 * Strict Architectural Invariants:
 * - Caller identity derived exclusively from verified Firebase auth token (callerUid)
 * - All mutations execute atomically in Firestore transactions with mutex serialization
 * - Idempotency key prevents duplicate actions on network retries
 * - Milestone work state is strictly decoupled from payment/escrow state
 * - Deliverable approval does NOT release payment or modify paymentState
 * - Next milestone only unlocks to ready_to_start if funded (paymentState === 'held')
 */

import {
  GigLinkContract,
  ContractMilestone,
  ContractMilestoneWorkState,
  ContractMilestoneSubmissionVersion,
  ContractMilestoneReviewRecord,
  ContractMilestoneDelivery,
  ContractMilestoneReview,
} from '../../types';
import { assertValidWorkStateTransition } from './milestoneWorkStateMachine';
import {
  getContract,
  persistContract,
  isCustomContractWriterInstalled,
  contractsStore,
} from '../../lib/contractService';
import { getAdminFirestore } from '../firebaseAdmin';

export class MilestoneLifecycleError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'MilestoneLifecycleError';
  }
}

/**
 * Strict HTTPS URL validation helper for C-2B-2 submission hardening.
 * Rejects javascript:, data:, blob:, file:, http:, relative paths, empty/whitespace, and malformed URLs.
 * Maximum allowed URL length: 1,000 characters.
 */
export function validateHttpsUrl(rawUrl: unknown, fieldName: string): string {
  if (typeof rawUrl !== 'string') {
    throw new MilestoneLifecycleError(400, `Invalid ${fieldName}: URL must be a string.`);
  }
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    throw new MilestoneLifecycleError(400, `Invalid ${fieldName}: URL cannot be empty or whitespace only.`);
  }
  if (trimmed.length > 1000) {
    throw new MilestoneLifecycleError(
      400,
      `Invalid ${fieldName}: URL exceeds maximum allowed length of 1,000 characters (length: ${trimmed.length}).`
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new MilestoneLifecycleError(400, `Invalid ${fieldName}: Malformed URL.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new MilestoneLifecycleError(
      400,
      `Invalid ${fieldName}: Only secure HTTPS URLs are permitted (received protocol: '${parsed.protocol}').`
    );
  }
  return trimmed;
}

/**
 * Normalizes a milestone to ensure canonical C-2B-1 workState, submissions, and counters are populated.
 */
export function normalizeMilestoneData(milestone: ContractMilestone, isFirst: boolean): ContractMilestone {
  const normalized = { ...milestone };

  // 1. Canonical workState fallback from legacy fields
  if (!normalized.workState) {
    if (normalized.reviewState === 'approved' || normalized.status === 'completed') {
      normalized.workState = 'approved';
    } else if (normalized.reviewState === 'revision_requested') {
      normalized.workState = 'revision_requested';
    } else if (normalized.reviewState === 'submitted' || normalized.reviewState === 'in_review') {
      normalized.workState = 'submitted';
    } else if (normalized.status === 'in_progress') {
      normalized.workState = 'in_progress';
    } else if (isFirst && normalized.paymentState === 'held') {
      normalized.workState = 'ready_to_start';
    }
  }

  // 2. Canonical submissions[] fallback from legacy single submission
  if (!Array.isArray(normalized.submissions)) {
    if (normalized.submission && normalized.submission.deliveryNote) {
      normalized.submissions = [
        {
          versionNumber: 1,
          submittedBy: normalized.submission.submittedBy || 'talent',
          submittedByName: 'Partner',
          submittedAt: normalized.submission.submittedAt || normalized.submittedAt || normalized.createdAt || new Date().toISOString(),
          reviewDeadlineAt: new Date(Date.now() + 14 * 86400000).toISOString(),
          deliveryNote: normalized.submission.deliveryNote,
          demoUrl: normalized.submission.demoUrl,
          repoUrl: normalized.submission.repoUrl,
          figmaUrl: normalized.submission.figmaUrl,
          additionalLinks: normalized.submission.links || [],
          evidenceFiles: normalized.submission.evidenceFiles || [],
        },
      ];
    } else {
      normalized.submissions = [];
    }
  }

  // 3. Counters and review records
  if (normalized.revisionAllowance === undefined || normalized.revisionAllowance === null) {
    normalized.revisionAllowance = 2;
  }
  if (normalized.revisionCount === undefined || normalized.revisionCount === null) {
    normalized.revisionCount = 0;
  }
  if (!Array.isArray(normalized.reviewRecords)) {
    normalized.reviewRecords = [];
  }
  if (!Array.isArray(normalized.reviewHistory)) {
    normalized.reviewHistory = [];
  }

  return normalized;
}

/**
 * Normalizes all milestones across a contract.
 */
export function normalizeContractMilestones(contract: GigLinkContract): GigLinkContract {
  if (!contract || !Array.isArray(contract.milestones)) return contract;
  let allPreviousApproved = true;
  return {
    ...contract,
    milestones: contract.milestones.map((m, idx) => {
      const normalized = normalizeMilestoneData(m, idx === 0);
      if (!normalized.workState) {
        if (
          allPreviousApproved &&
          normalized.paymentState === 'held' &&
          contract.status === 'active' &&
          contract.disputeStatus !== 'open' &&
          contract.disputeStatus !== 'under_admin_review' &&
          normalized.disputeStatus !== 'disputed'
        ) {
          normalized.workState = 'ready_to_start';
        }
      }
      const isApproved =
        normalized.workState === 'approved' ||
        normalized.reviewState === 'approved' ||
        normalized.status === 'completed';
      if (!isApproved) {
        allPreviousApproved = false;
      }
      return normalized;
    }),
  };
}

/**
 * Validates request idempotency against contract.idempotencyLog.
 * Returns cached result if same key + same operation + same parameters.
 * Throws 409/422 if same key + materially different parameters.
 */
function checkIdempotency(
  contract: GigLinkContract,
  idempotencyKey: string | undefined,
  operation: string,
  paramsPayload: Record<string, any>
): { isReplay: boolean; cachedResult?: any } {
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    return { isReplay: false };
  }

  const log = contract.idempotencyLog || {};
  const existing = log[idempotencyKey];
  if (!existing) {
    return { isReplay: false };
  }

  const currentParamsHash = JSON.stringify(paramsPayload);
  if (existing.operation === operation && existing.paramsHash === currentParamsHash) {
    return { isReplay: true, cachedResult: existing.result };
  }

  throw new MilestoneLifecycleError(
    409,
    `Idempotency conflict: key "${idempotencyKey}" has already been used with different request parameters.`
  );
}

function recordIdempotency(
  contract: GigLinkContract,
  idempotencyKey: string | undefined,
  operation: string,
  paramsPayload: Record<string, any>,
  result: any
): void {
  if (!idempotencyKey) return;
  contract.idempotencyLog = contract.idempotencyLog || {};
  contract.idempotencyLog[idempotencyKey] = {
    operation,
    paramsHash: JSON.stringify(paramsPayload),
    result,
    timestamp: new Date().toISOString(),
  };
}

// Global execution lock per contract ID to ensure atomic serialized transitions in local runtime
const contractLocks = new Map<string, Promise<any>>();

async function runSerialized<T>(contractId: string, fn: () => Promise<T>): Promise<T> {
  const current = contractLocks.get(contractId) || Promise.resolve();
  let release: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  contractLocks.set(contractId, current.then(() => next));

  try {
    await current;
    return await fn();
  } finally {
    release!();
    if (contractLocks.get(contractId) === next) {
      contractLocks.delete(contractId);
    }
  }
}

export type LifecycleTransactionHandler<T> = (
  contract: GigLinkContract
) => Promise<{ updatedContract: GigLinkContract; result: T }>;

let customTransactionRunner: (<T>(
  contractId: string,
  handler: LifecycleTransactionHandler<T>
) => Promise<T>) | null = null;

const isTestRuntime = (): boolean => {
  // Browser runtime is production client environment — mocks strictly prohibited
  if (typeof window !== 'undefined') return false;
  if (typeof process === 'undefined') return false;
  if (process.env?.NODE_ENV === 'production') return false;
  return true;
};

export function setTransactionRunnerForTesting(
  runner: (<T>(contractId: string, handler: LifecycleTransactionHandler<T>) => Promise<T>) | null
): void {
  if (runner && !isTestRuntime()) {
    throw new Error('setTransactionRunnerForTesting is strictly forbidden outside test environments.');
  }
  customTransactionRunner = runner;
}

/**
 * Authoritative Firestore Transaction Executor.
 * Provides multi-instance distributed atomic read-validate-mutate-write guarantees across Cloud Run instances.
 * In-process promise chaining (runSerialized) acts as a local queue optimization,
 * while Firebase Admin Firestore transaction provides true distributed atomicity.
 */
async function runLifecycleTransaction<T>(
  contractId: string,
  handler: LifecycleTransactionHandler<T>
): Promise<T> {
  if (customTransactionRunner) {
    if (!isTestRuntime()) {
      throw new Error('Custom transaction runner is strictly prohibited in production runtime.');
    }
    return await customTransactionRunner(contractId, handler);
  }

  // When unit test writer is active (offline test isolation):
  if (isCustomContractWriterInstalled()) {
    return runSerialized(contractId, async () => {
      const rawContract = await getContract(contractId);
      if (!rawContract) {
        throw new MilestoneLifecycleError(404, `Contract ${contractId} not found.`);
      }
      const contract = normalizeContractMilestones(rawContract);
      const { updatedContract, result } = await handler(contract);
      await persistContract(updatedContract);
      return result;
    });
  }

  // PRODUCTION: Distributed Firestore Transaction via Firebase Admin SDK
  return runSerialized(contractId, async () => {
    const adminDb = getAdminFirestore();
    const contractRef = adminDb.collection('contracts').doc(contractId);

    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(contractRef);
      if (!snap.exists) {
        throw new MilestoneLifecycleError(404, `Contract ${contractId} not found.`);
      }

      const rawContract = snap.data() as GigLinkContract;
      const contract = normalizeContractMilestones(rawContract);

      const { updatedContract, result } = await handler(contract);

      transaction.set(contractRef, updatedContract);
      return { updatedContract, result };
    });

    // Authoritative in-memory cache update strictly AFTER transaction successfully commits
    contractsStore.set(transactionResult.updatedContract.id, transactionResult.updatedContract);
    return transactionResult.result;
  });
}

/**
 * 1. START MILESTONE
 * Authoritative endpoint logic for Partner initiating work on a funded milestone.
 */
export async function startMilestoneWork(params: {
  contractId: string;
  milestoneId: string;
  callerUid: string;
  idempotencyKey?: string;
}): Promise<{ contract: GigLinkContract; milestone: ContractMilestone }> {
  const { contractId, milestoneId, callerUid, idempotencyKey } = params;

  return runLifecycleTransaction(contractId, async (contract) => {
    // Check Idempotency against transaction snapshot
    const idempotency = checkIdempotency(contract, idempotencyKey, 'start_milestone', {
      contractId,
      milestoneId,
    });
    if (idempotency.isReplay) {
      return { updatedContract: contract, result: idempotency.cachedResult };
    }

    // Role check: ONLY assigned partner can start work
    if (callerUid !== contract.talentId) {
      throw new MilestoneLifecycleError(
        403,
        'Forbidden: Only the assigned Partner can start work on this milestone.'
      );
    }

    // Contract state check
    if (contract.status !== 'active') {
      throw new MilestoneLifecycleError(
        400,
        `Cannot start milestone on contract with status '${contract.status}'. Contract must be active.`
      );
    }

    // Dispute check
    if (contract.disputeStatus === 'open' || contract.disputeStatus === 'under_admin_review') {
      throw new MilestoneLifecycleError(
        400,
        'Cannot start milestone while contract is under active dispute.'
      );
    }

    const milestoneIndex = contract.milestones.findIndex((m) => m.id === milestoneId);
    if (milestoneIndex === -1) {
      throw new MilestoneLifecycleError(404, `Milestone ${milestoneId} not found on contract.`);
    }

    const milestone = contract.milestones[milestoneIndex];

    if (milestone.disputeStatus === 'disputed') {
      throw new MilestoneLifecycleError(400, 'Cannot start work on a disputed milestone.');
    }

    // Funding check: Escrow funds MUST be held
    if (milestone.paymentState !== 'held') {
      throw new MilestoneLifecycleError(
        400,
        `Cannot start work on an unfunded milestone (current paymentState: '${milestone.paymentState}'). Client must fund escrow first.`
      );
    }

    // Sequential progression check: All preceding milestones must be approved
    for (let i = 0; i < milestoneIndex; i++) {
      const prev = contract.milestones[i];
      if (prev.workState !== 'approved') {
        throw new MilestoneLifecycleError(
          400,
          `Sequential progression required: Preceding milestone "${prev.title}" must be approved before starting this milestone.`
        );
      }
    }

    // If already in_progress, treat as idempotent repeat start
    if (milestone.workState === 'in_progress' && milestone.startedAt) {
      const result = { contract, milestone };
      recordIdempotency(contract, idempotencyKey, 'start_milestone', { contractId, milestoneId }, result);
      return { updatedContract: contract, result };
    }

    // Validate transition through canonical state machine
    assertValidWorkStateTransition(milestone.workState || 'ready_to_start', 'in_progress');

    const now = new Date().toISOString();
    const updatedMilestone: ContractMilestone = {
      ...milestone,
      workState: 'in_progress',
      status: 'in_progress',
      reviewState: 'pending_submission',
      startedAt: milestone.startedAt || now,
      updatedAt: now,
    };

    const updatedMilestones = [...contract.milestones];
    updatedMilestones[milestoneIndex] = updatedMilestone;

    const updatedContract: GigLinkContract = {
      ...contract,
      milestones: updatedMilestones,
      updatedAt: now,
    };

    const result = { contract: updatedContract, milestone: updatedMilestone };
    recordIdempotency(updatedContract, idempotencyKey, 'start_milestone', { contractId, milestoneId }, result);

    return { updatedContract, result };
  });
}

/**
 * 2. SUBMIT MILESTONE DELIVERABLE
 * Authoritative endpoint logic for Partner delivering work version (V1, V2, V3...).
 */
export async function submitMilestoneDeliverable(params: {
  contractId: string;
  milestoneId: string;
  callerUid: string;
  deliveryNote: string;
  demoUrl?: string;
  repoUrl?: string;
  figmaUrl?: string;
  additionalLinks?: string[];
  evidenceFiles?: string[];
  idempotencyKey?: string;
}): Promise<{ contract: GigLinkContract; milestone: ContractMilestone; submissionVersion: number }> {
  const {
    contractId,
    milestoneId,
    callerUid,
    deliveryNote,
    demoUrl,
    repoUrl,
    figmaUrl,
    additionalLinks,
    evidenceFiles,
    idempotencyKey,
  } = params;

  return runLifecycleTransaction(contractId, async (contract) => {
    // 1. Delivery Note validation (required, 15 to 5,000 characters)
    if (!deliveryNote || typeof deliveryNote !== 'string' || deliveryNote.trim().length < 15) {
      throw new MilestoneLifecycleError(
        400,
        'A comprehensive delivery note describing completed deliverables (at least 15 characters) is required.'
      );
    }
    const cleanDeliveryNote = deliveryNote.trim();
    if (cleanDeliveryNote.length > 5000) {
      throw new MilestoneLifecycleError(
        400,
        `Delivery note exceeds maximum allowed length of 5,000 characters (length: ${cleanDeliveryNote.length}).`
      );
    }

    // 2. Individual URL validation (HTTPS only, max 1,000 characters)
    let cleanDemoUrl: string | undefined = undefined;
    if (demoUrl !== undefined && demoUrl !== null) {
      cleanDemoUrl = validateHttpsUrl(demoUrl, 'demoUrl');
    }

    let cleanRepoUrl: string | undefined = undefined;
    if (repoUrl !== undefined && repoUrl !== null) {
      cleanRepoUrl = validateHttpsUrl(repoUrl, 'repoUrl');
    }

    let cleanFigmaUrl: string | undefined = undefined;
    if (figmaUrl !== undefined && figmaUrl !== null) {
      cleanFigmaUrl = validateHttpsUrl(figmaUrl, 'figmaUrl');
    }

    // 3. additionalLinks validation (max 10 entries, HTTPS only, max 1,000 chars each)
    let cleanAdditionalLinks: string[] = [];
    if (additionalLinks !== undefined && additionalLinks !== null) {
      if (!Array.isArray(additionalLinks)) {
        throw new MilestoneLifecycleError(400, 'additionalLinks must be an array of HTTPS URLs.');
      }
      if (additionalLinks.length > 10) {
        throw new MilestoneLifecycleError(
          400,
          `additionalLinks exceeds maximum allowed limit of 10 entries (received: ${additionalLinks.length}).`
        );
      }
      cleanAdditionalLinks = additionalLinks.map((link, idx) =>
        validateHttpsUrl(link, `additionalLinks[${idx}]`)
      );
    }
    const uniqueLinks = Array.from(new Set(cleanAdditionalLinks));

    // 4. evidenceFiles validation (max 10 entries, HTTPS only, max 1,000 chars each)
    let cleanEvidenceFiles: string[] = [];
    if (evidenceFiles !== undefined && evidenceFiles !== null) {
      if (!Array.isArray(evidenceFiles)) {
        throw new MilestoneLifecycleError(400, 'evidenceFiles must be an array of HTTPS file references.');
      }
      if (evidenceFiles.length > 10) {
        throw new MilestoneLifecycleError(
          400,
          `evidenceFiles exceeds maximum allowed limit of 10 entries (received: ${evidenceFiles.length}).`
        );
      }
      cleanEvidenceFiles = evidenceFiles.map((file, idx) =>
        validateHttpsUrl(file, `evidenceFiles[${idx}]`)
      );
    }
    const uniqueEvidence = Array.from(new Set(cleanEvidenceFiles));

    // 5. Complete idempotency payload containing every client-controlled submission field
    const idempotencyPayload = {
      contractId,
      milestoneId,
      deliveryNote: cleanDeliveryNote,
      demoUrl: cleanDemoUrl,
      repoUrl: cleanRepoUrl,
      figmaUrl: cleanFigmaUrl,
      additionalLinks: uniqueLinks,
      evidenceFiles: uniqueEvidence,
    };
    const idempotency = checkIdempotency(contract, idempotencyKey, 'submit_milestone', idempotencyPayload);
    if (idempotency.isReplay) {
      return { updatedContract: contract, result: idempotency.cachedResult };
    }

    // Role check: Only assigned Partner can submit
    if (callerUid !== contract.talentId) {
      throw new MilestoneLifecycleError(
        403,
        'Forbidden: Only the assigned Partner can submit deliverables for this milestone.'
      );
    }

    if (contract.status !== 'active') {
      throw new MilestoneLifecycleError(
        400,
        `Cannot submit milestone on contract with status '${contract.status}'. Contract must be active.`
      );
    }

    if (contract.disputeStatus === 'open' || contract.disputeStatus === 'under_admin_review') {
      throw new MilestoneLifecycleError(
        400,
        'Cannot submit milestone while contract is under active dispute.'
      );
    }

    const milestoneIndex = contract.milestones.findIndex((m) => m.id === milestoneId);
    if (milestoneIndex === -1) {
      throw new MilestoneLifecycleError(404, `Milestone ${milestoneId} not found on contract.`);
    }

    const milestone = contract.milestones[milestoneIndex];

    if (milestone.disputeStatus === 'disputed') {
      throw new MilestoneLifecycleError(400, 'Cannot submit deliverables for a disputed milestone.');
    }

    // Funding check: Escrow funds MUST remain held
    if (milestone.paymentState !== 'held') {
      throw new MilestoneLifecycleError(
        400,
        `Cannot submit deliverables for an unfunded milestone (current paymentState: '${milestone.paymentState}').`
      );
    }

    // State machine check: Must be in_progress or revision_requested
    const currentWorkState = milestone.workState || 'ready_to_start';
    if (currentWorkState === 'ready_to_start') {
      throw new MilestoneLifecycleError(
        400,
        'Cannot submit deliverables directly from ready_to_start. Partner must explicitly start work first.'
      );
    }
    if (currentWorkState === 'submitted') {
      throw new MilestoneLifecycleError(
        400,
        'Deliverables are already submitted and currently under client review.'
      );
    }
    if (currentWorkState === 'approved') {
      throw new MilestoneLifecycleError(
        400,
        'Milestone is already approved. Approved is a terminal work state and cannot accept further submissions.'
      );
    }

    // If revision_requested, transition through in_progress to submitted
    if (currentWorkState === 'revision_requested') {
      assertValidWorkStateTransition('revision_requested', 'in_progress');
      assertValidWorkStateTransition('in_progress', 'submitted');
    } else {
      assertValidWorkStateTransition('in_progress', 'submitted');
    }

    const now = new Date().toISOString();
    const versionNumber = (milestone.submissions?.length || 0) + 1;
    const reviewDeadlineAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const newVersion: ContractMilestoneSubmissionVersion = {
      versionNumber,
      submittedBy: callerUid,
      submittedByName: contract.talentName || 'Partner',
      submittedAt: now,
      reviewDeadlineAt,
      deliveryNote: cleanDeliveryNote,
      demoUrl: cleanDemoUrl,
      repoUrl: cleanRepoUrl,
      figmaUrl: cleanFigmaUrl,
      additionalLinks: uniqueLinks,
      evidenceFiles: uniqueEvidence,
      idempotencyKey,
    };

    // Legacy single delivery payload mirror
    const legacyDeliveryPayload: ContractMilestoneDelivery = {
      submittedBy: callerUid,
      submittedAt: now,
      deliveryNote: cleanDeliveryNote,
      demoUrl: cleanDemoUrl,
      repoUrl: cleanRepoUrl,
      figmaUrl: cleanFigmaUrl,
      links: uniqueLinks,
      evidenceFiles: uniqueEvidence,
    };

    const updatedSubmissions = [...(milestone.submissions || []), newVersion];

    const updatedMilestone: ContractMilestone = {
      ...milestone,
      workState: 'submitted',
      status: 'in_progress',
      reviewState: 'submitted',
      submittedAt: now,
      reviewDeadlineAt,
      submissions: updatedSubmissions,
      submission: legacyDeliveryPayload,
      updatedAt: now,
    };

    const updatedMilestones = [...contract.milestones];
    updatedMilestones[milestoneIndex] = updatedMilestone;

    const updatedContract: GigLinkContract = {
      ...contract,
      milestones: updatedMilestones,
      updatedAt: now,
    };

    const result = {
      contract: updatedContract,
      milestone: updatedMilestone,
      submissionVersion: versionNumber,
    };

    recordIdempotency(updatedContract, idempotencyKey, 'submit_milestone', idempotencyPayload, result);
    return { updatedContract, result };
  });
}

/**
 * 3. REVIEW MILESTONE DELIVERABLE
 * Authoritative endpoint logic for Client approving work, requesting revisions, or disputing.
 * Invariant: Approving work authorizes payment release; it does NOT release funds or modify paymentState.
 */
export async function reviewMilestoneDeliverable(params: {
  contractId: string;
  milestoneId: string;
  callerUid: string;
  decision: 'approved' | 'revision_requested' | 'disputed';
  feedback?: string;
  userIsOrgAdmin?: boolean;
  idempotencyKey?: string;
}): Promise<{ contract: GigLinkContract; milestone: ContractMilestone; decision: string }> {
  const { contractId, milestoneId, callerUid, decision, feedback, userIsOrgAdmin, idempotencyKey } = params;

  return runLifecycleTransaction(contractId, async (contract) => {
    // Idempotency check against transaction snapshot
    const idempotencyPayload = {
      contractId,
      milestoneId,
      decision,
      feedback: feedback?.trim(),
    };
    const idempotency = checkIdempotency(contract, idempotencyKey, 'review_milestone', idempotencyPayload);
    if (idempotency.isReplay) {
      return { updatedContract: contract, result: idempotency.cachedResult };
    }

    // Role check: Partner CANNOT review own milestone
    if (callerUid === contract.talentId && callerUid !== contract.creatorId) {
      throw new MilestoneLifecycleError(
        403,
        'Forbidden: Partner cannot review or approve their own milestone deliverables.'
      );
    }

    // Role check: Must be Client/Creator or authorized Org Admin
    const isClientOrOrgAdmin =
      callerUid === contract.creatorId || Boolean(userIsOrgAdmin && contract.organizationId);
    if (!isClientOrOrgAdmin) {
      throw new MilestoneLifecycleError(
        403,
        'Forbidden: Only the contract Client or authorized Organization Admin can review deliverables.'
      );
    }

    if (contract.status !== 'active') {
      throw new MilestoneLifecycleError(
        400,
        `Cannot review milestone on contract with status '${contract.status}'. Contract must be active.`
      );
    }

    if (contract.disputeStatus === 'open' || contract.disputeStatus === 'under_admin_review') {
      throw new MilestoneLifecycleError(
        400,
        'Cannot review milestone while contract is under active dispute.'
      );
    }

    const milestoneIndex = contract.milestones.findIndex((m) => m.id === milestoneId);
    if (milestoneIndex === -1) {
      throw new MilestoneLifecycleError(404, `Milestone ${milestoneId} not found on contract.`);
    }

    const milestone = contract.milestones[milestoneIndex];

    if (milestone.disputeStatus === 'disputed') {
      throw new MilestoneLifecycleError(400, 'Cannot review a disputed milestone.');
    }

    // Current work state must be 'submitted'
    if (milestone.workState !== 'submitted') {
      throw new MilestoneLifecycleError(
        400,
        `Cannot review milestone in '${milestone.workState}' state. Deliverables must be submitted before review.`
      );
    }

    if (!milestone.submissions || milestone.submissions.length === 0) {
      throw new MilestoneLifecycleError(
        400,
        'Cannot review milestone with no recorded submission versions.'
      );
    }

    const latestSubmission = milestone.submissions[milestone.submissions.length - 1];
    const versionEvaluated = latestSubmission.versionNumber;
    const now = new Date().toISOString();

    let updatedMilestone: ContractMilestone;
    const updatedMilestones = [...contract.milestones];

    if (decision === 'approved') {
      assertValidWorkStateTransition('submitted', 'approved');

      const reviewRecord: ContractMilestoneReviewRecord = {
        id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        versionEvaluated,
        reviewerUserId: callerUid,
        reviewerName: contract.creatorName || 'Client',
        decision: 'approved',
        feedback: feedback?.trim() || 'Deliverables reviewed and approved.',
        reviewedAt: now,
        idempotencyKey,
      };

      const legacyReview: ContractMilestoneReview = {
        id: reviewRecord.id,
        revisionNumber: milestone.revisionCount || 0,
        reviewedBy: callerUid,
        reviewerName: reviewRecord.reviewerName,
        reviewedAt: now,
        decision: 'approved',
        feedback: reviewRecord.feedback,
        previousSubmissionNote: latestSubmission.deliveryNote,
      };

      updatedMilestone = {
        ...milestone,
        workState: 'approved',
        status: 'completed',
        reviewState: 'approved',
        approvedAt: now,
        reviewedAt: now,
        approvedVersion: versionEvaluated,
        reviewRecords: [...(milestone.reviewRecords || []), reviewRecord],
        reviewHistory: [...(milestone.reviewHistory || []), legacyReview],
        updatedAt: now,
        // INVARIANT: paymentState remains untouched! Escrow release is separate.
      };

      updatedMilestones[milestoneIndex] = updatedMilestone;

      // Milestone N+1 Progression Invariant:
      // If Milestone N+1 exists AND its paymentState === 'held' AND not disputed, it becomes 'ready_to_start'.
      // If Milestone N+1 is unfunded, it MUST NOT become ready_to_start!
      if (milestoneIndex + 1 < updatedMilestones.length) {
        const nextMilestone = updatedMilestones[milestoneIndex + 1];
        if (nextMilestone.paymentState === 'held' && nextMilestone.disputeStatus !== 'disputed') {
          updatedMilestones[milestoneIndex + 1] = {
            ...nextMilestone,
            workState: 'ready_to_start',
            status: 'in_progress',
            reviewState: 'pending_submission',
            updatedAt: now,
          };
        }
      }
    } else if (decision === 'revision_requested') {
      const allowance = milestone.revisionAllowance ?? contract.scopeLock?.revisionAllowance ?? 2;
      const currentCount = milestone.revisionCount || 0;

      if (currentCount >= allowance) {
        throw new MilestoneLifecycleError(
          400,
          `Revision allowance exceeded. Contract permits a maximum of ${allowance} revision round(s) (current rounds: ${currentCount}). Scope amendment or dispute resolution is required.`
        );
      }

      if (!feedback || feedback.trim().length < 15) {
        throw new MilestoneLifecycleError(
          400,
          'Actionable revision feedback of at least 15 characters explaining requested adjustments is required.'
        );
      }

      assertValidWorkStateTransition('submitted', 'revision_requested');

      const newRevisionCount = currentCount + 1;
      const reviewRecord: ContractMilestoneReviewRecord = {
        id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        versionEvaluated,
        reviewerUserId: callerUid,
        reviewerName: contract.creatorName || 'Client',
        decision: 'revision_requested',
        feedback: feedback.trim(),
        reviewedAt: now,
        idempotencyKey,
      };

      const legacyReview: ContractMilestoneReview = {
        id: reviewRecord.id,
        revisionNumber: newRevisionCount,
        reviewedBy: callerUid,
        reviewerName: reviewRecord.reviewerName,
        reviewedAt: now,
        decision: 'revision_requested',
        feedback: reviewRecord.feedback,
        previousSubmissionNote: latestSubmission.deliveryNote,
      };

      updatedMilestone = {
        ...milestone,
        workState: 'revision_requested',
        status: 'in_progress',
        reviewState: 'revision_requested',
        revisionCount: newRevisionCount,
        reviewedAt: now,
        reviewRecords: [...(milestone.reviewRecords || []), reviewRecord],
        reviewHistory: [...(milestone.reviewHistory || []), legacyReview],
        updatedAt: now,
      };

      updatedMilestones[milestoneIndex] = updatedMilestone;
    } else if (decision === 'disputed') {
      const disputeReason = feedback?.trim() || 'Client raised dispute during milestone review.';

      updatedMilestone = {
        ...milestone,
        disputeStatus: 'disputed',
        disputeReason,
        disputedAt: now,
        updatedAt: now,
      };

      updatedMilestones[milestoneIndex] = updatedMilestone;
      contract.disputeStatus = 'open';
    } else {
      throw new MilestoneLifecycleError(
        400,
        `Invalid review decision '${decision}'. Allowed decisions: approved, revision_requested, disputed.`
      );
    }

    const updatedContract: GigLinkContract = {
      ...contract,
      milestones: updatedMilestones,
      updatedAt: now,
    };

    const result = {
      contract: updatedContract,
      milestone: updatedMilestone,
      decision,
    };

    recordIdempotency(updatedContract, idempotencyKey, 'review_milestone', idempotencyPayload, result);
    return { updatedContract, result };
  });
}
