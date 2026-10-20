import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Opportunity,
  OpportunityApplication,
  GigLinkContract,
  ContractScopeLock,
  ContractMilestone,
  ContractMilestoneDelivery,
  ContractMilestoneReview,
  ContractMilestoneWorkState,
  ContractMilestoneSubmissionVersion,
  ContractMilestoneReviewRecord,
  ContractFinalHandover,
  ContractStatus,
  OpportunityMilestone,
  MilestoneStatus,
  ContractChangeRequest,
  ContractProposedChanges,
  ContractAmendmentRecord,
  ContractAmendmentDiffItem,
  ContractMilestoneChange,
  ChangeRequestStatus,
} from '../types';
import { postApi } from './apiClient';

/**
 * In-memory authoritative contract store to provide instant session persistence
 * and resilient fallbacks when running offline or without active Firestore rules.
 */
export const contractsStore = new Map<string, GigLinkContract>();

/**
 * Mutex queue per contract ID to serialize concurrent local and transaction operations
 */
const contractMutexes = new Map<string, Promise<any>>();

async function runWithContractLock<T>(contractId: string, op: () => Promise<T>): Promise<T> {
  const currentLock = contractMutexes.get(contractId) || Promise.resolve();
  let releaseLock: () => void;
  const newLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  contractMutexes.set(contractId, currentLock.then(() => newLock));

  try {
    await currentLock;
    return await op();
  } finally {
    releaseLock!();
    if (contractMutexes.get(contractId) === newLock) {
      contractMutexes.delete(contractId);
    }
  }
}

/**
 * Generate a deterministic contract ID from opportunity and applicant IDs
 */
export function getCanonicalContractId(opportunityId: string, applicantId: string): string {
  return `contract_${opportunityId}_${applicantId}`;
}

/**
 * Normalizes a contract to ensure Phase 3 versioning, originalScope,
 * changeRequests, and amendmentHistory are initialized.
 */
export function normalizeContractData(contract: GigLinkContract): GigLinkContract {
  if (!contract) return contract;
  return {
    ...contract,
    version: contract.version || 1,
    originalScope: contract.originalScope || { ...contract.scopeLock },
    changeRequests: contract.changeRequests || [],
    amendmentHistory: contract.amendmentHistory || [],
    milestones: Array.isArray(contract.milestones)
      ? contract.milestones.map((m, idx) => {
          let workState = m.workState;
          if (!workState) {
            if (m.reviewState === 'approved' || m.status === 'completed') {
              workState = 'approved';
            } else if (m.reviewState === 'revision_requested') {
              workState = 'revision_requested';
            } else if (m.reviewState === 'submitted' || m.reviewState === 'in_review') {
              workState = 'submitted';
            } else if (m.status === 'in_progress') {
              workState = 'in_progress';
            } else if (idx === 0 && m.paymentState === 'held') {
              workState = 'ready_to_start';
            }
          }
          let submissions = m.submissions;
          if (!Array.isArray(submissions)) {
            if (m.submission && m.submission.deliveryNote) {
              submissions = [
                {
                  versionNumber: 1,
                  submittedBy: m.submission.submittedBy || 'talent',
                  submittedByName: 'Partner',
                  submittedAt: m.submission.submittedAt || m.submittedAt || m.createdAt || new Date().toISOString(),
                  reviewDeadlineAt: new Date(Date.now() + 14 * 86400000).toISOString(),
                  deliveryNote: m.submission.deliveryNote,
                  demoUrl: m.submission.demoUrl,
                  repoUrl: m.submission.repoUrl,
                  figmaUrl: m.submission.figmaUrl,
                  additionalLinks: m.submission.links || [],
                  evidenceFiles: m.submission.evidenceFiles || [],
                },
              ];
            } else {
              submissions = [];
            }
          }
          return {
            ...m,
            workState,
            submissions,
            revisionAllowance: m.revisionAllowance ?? 2,
            revisionCount: m.revisionCount ?? 0,
            reviewRecords: m.reviewRecords || [],
            reviewHistory: m.reviewHistory || [],
          };
        })
      : [],
  };
}

/**
 * Clears in-memory contracts store (Used for test isolation)
 */
export function clearContractStore(): void {
  contractsStore.clear();
}

/**
 * Updates contract in memory store (used by atomic transactions)
 */
export function setContractInStore(contract: GigLinkContract): void {
  contractsStore.set(contract.id, normalizeContractData(contract));
}

/**
 * Returns all in-memory contracts for fallback aggregation
 */
export function getAllInMemoryContracts(): GigLinkContract[] {
  return Array.from(contractsStore.values()).map(normalizeContractData);
}

/**
 * Test hook for mocking/controlling the underlying Firestore writer in unit tests.
 * In production/runtime, this is null and setDoc is invoked directly.
 */
export type ContractFirestoreWriter = (contractRef: any, data: GigLinkContract) => Promise<void>;
let customContractWriter: ContractFirestoreWriter | null = null;

export const isTestRuntime = (): boolean => {
  // Browser runtime is production client environment — mocks strictly prohibited
  if (typeof window !== 'undefined') return false;
  if (typeof process === 'undefined') return false;
  if (process.env?.NODE_ENV === 'production') return false;
  return true;
};

export function setContractWriterForTesting(writer: ContractFirestoreWriter | null): void {
  if (writer && !isTestRuntime()) {
    throw new Error('setContractWriterForTesting is strictly forbidden outside test environments.');
  }
  customContractWriter = writer;
}

export function isCustomContractWriterInstalled(): boolean {
  return customContractWriter !== null;
}

export type ContractQueryReader = (userId: string) => Promise<GigLinkContract[]>;
let customContractReader: ContractQueryReader | null = null;

export function setContractReaderForTesting(reader: ContractQueryReader | null): void {
  if (reader && !isTestRuntime()) {
    throw new Error('setContractReaderForTesting is strictly forbidden outside test environments.');
  }
  customContractReader = reader;
}

/**
 * Persists contract changes authoritatively.
 *
 * CRITICAL BUILDER'S PRINCIPLE & E-01 INVARIANT:
 * Fail-closed durability: If the authoritative Firestore write fails,
 * the error is propagated and the in-memory contractsStore is NEVER mutated
 * with the uncommitted state. Option A (Authoritative-first) is enforced.
 */
export async function persistContract(contract: GigLinkContract): Promise<void> {
  const normalized = normalizeContractData(contract);
  const contractRef = doc(db, 'contracts', normalized.id);

  if (customContractWriter) {
    await customContractWriter(contractRef, normalized);
  } else {
    await setDoc(contractRef, normalized);
  }

  // Only reached after authoritative Firestore confirmation
  contractsStore.set(normalized.id, normalized);
}

/**
 * Creates default kickoff milestones for a newly drafted contract
 */
export function createDefaultContractMilestones(
  contractId: string,
  opportunityTitle?: string,
  totalAmount: number = 0,
  currency: string = 'USD'
): ContractMilestone[] {
  const now = new Date().toISOString();
  
  // Allocate amounts across 3 default milestones if total amount is provided
  const m1Amount = totalAmount > 0 ? Math.round(totalAmount * 0.2) : 0;
  const m2Amount = totalAmount > 0 ? Math.round(totalAmount * 0.5) : 0;
  const m3Amount = totalAmount > 0 ? Math.max(0, totalAmount - m1Amount - m2Amount) : 0;

  return [
    {
      id: `m_kickoff_${Date.now()}_1`,
      contractId,
      title: 'Project Kickoff & Requirements Alignment',
      description: `Initial sync on architecture, tooling, and communication channels for ${
        opportunityTitle || 'the project'
      }.`,
      deliverables: ['Signed Kickoff Document', 'Architecture & Requirements Blueprint'],
      amount: m1Amount,
      currency,
      dueDate: null,
      status: 'in_progress',
      reviewState: 'pending_submission',
      revisionAllowance: 2,
      revisionCount: 0,
      paymentState: 'unfunded',
      submission: null,
      reviewHistory: [],
      submittedAt: null,
      reviewedAt: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `m_deliverables_${Date.now()}_2`,
      contractId,
      title: 'Core Deliverables Implementation',
      description: 'Execution of primary deliverables according to agreed scope and technical guidelines.',
      deliverables: ['Production Codebase / Artifacts', 'Integrated Feature Set'],
      amount: m2Amount,
      currency,
      dueDate: null,
      status: 'pending',
      reviewState: 'pending_submission',
      revisionAllowance: 2,
      revisionCount: 0,
      paymentState: 'unfunded',
      submission: null,
      reviewHistory: [],
      submittedAt: null,
      reviewedAt: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `m_qa_acceptance_${Date.now()}_3`,
      contractId,
      title: 'Review, QA & Acceptance Sign-off',
      description: 'Comprehensive review of work submitted, final feedback adjustments, and collaborative acceptance.',
      deliverables: ['QA Sign-off Report', 'Final Handover Documentation'],
      amount: m3Amount,
      currency,
      dueDate: null,
      status: 'pending',
      reviewState: 'pending_submission',
      revisionAllowance: 2,
      revisionCount: 0,
      paymentState: 'unfunded',
      submission: null,
      reviewHistory: [],
      submittedAt: null,
      reviewedAt: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/**
 * Creates a canonical Contract model from an accepted application and opportunity.
 * Enforces:
 * 1. Application MUST be in 'accepted' status
 * 2. Contract initialized with 'draft' or 'pending_acceptance' status
 * 3. Scope lock extracted from opportunity and application rate
 * 4. Links future messaging conversationId
 */
export async function createContractFromApplication(params: {
  application: OpportunityApplication;
  opportunity: Opportunity;
  initiatorUserId: string;
  userIsOrgAdmin?: boolean;
}): Promise<GigLinkContract> {
  const { application, opportunity, initiatorUserId, userIsOrgAdmin = false } = params;

  // 1. Authoritative check: Application MUST be in 'accepted' status
  if (application.status !== 'accepted') {
    throw new Error(
      `Cannot generate contract: Application status is '${application.status}', but must be 'accepted'.`
    );
  }

  // 2. Authorization check: Initiator must be creator, talent, or authorized org admin
  const isCreator = initiatorUserId === opportunity.creatorId || userIsOrgAdmin;
  const isTalent = initiatorUserId === application.applicantId;

  if (!isCreator && !isTalent) {
    throw new Error('Unauthorized: Only opportunity creator or applicant can initiate contract creation.');
  }

  const contractId = getCanonicalContractId(application.opportunityId, application.applicantId);
  const now = new Date().toISOString();

  // Check if contract already exists
  const existingContract = await getContract(contractId);
  if (existingContract) {
    return existingContract;
  }

  const agreedAmount = application.proposedRate || opportunity.compensationMax || opportunity.compensationMin || 0;
  const currency = opportunity.currency || 'USD';

  const scopeLock: ContractScopeLock = {
    title: opportunity.title,
    description: opportunity.description,
    inclusions: opportunity.requiredSkills && opportunity.requiredSkills.length > 0
      ? opportunity.requiredSkills.map((sk) => `Implementation & Delivery of verified ${sk}`)
      : ['Execution of deliverables according to project specifications'],
    exclusions: [
      'Unapproved out-of-scope feature requests',
      'Third-party software or licensing costs without prior written consent',
    ],
    deliverables: [
      'Milestone 1: Project Kickoff & Requirements Alignment',
      'Milestone 2: Core Deliverables Implementation',
      'Milestone 3: Review, QA & Acceptance Sign-off',
    ],
    totalAmount: agreedAmount,
    currency,
    deadline: application.availabilityDate || opportunity.deadline || null,
    revisionAllowance: 2,
    lockedAt: null, // Locks on contract activation
  };

  const initialMilestones = createDefaultContractMilestones(
    contractId,
    opportunity.title,
    agreedAmount,
    currency
  );

  const newContract: GigLinkContract = {
    id: contractId,
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    applicationId: application.id,
    creatorId: opportunity.creatorId,
    creatorName: opportunity.creatorName || 'Opportunity Creator',
    talentId: application.applicantId,
    talentName: application.applicantDisplayName || 'Talent',
    talentEmail: application.applicantEmail,
    organizationId: opportunity.organizationId || application.organizationId || null,
    status: 'draft',
    version: 1,
    scopeLock,
    originalScope: { ...scopeLock },
    milestones: initialMilestones,
    changeRequests: [],
    amendmentHistory: [],
    creatorAcceptance: {
      accepted: false,
      acceptedAt: null,
      acceptedByUserId: null,
      signedName: null,
    },
    talentAcceptance: {
      accepted: false,
      acceptedAt: null,
      acceptedByUserId: null,
      signedName: null,
    },
    conversationId: `conv_${contractId}`,
    activatedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await persistContract(newContract);
  return newContract;
}

/**
 * Fetch a contract by its ID
 */
export async function getContract(contractId: string): Promise<GigLinkContract | null> {
  if (!contractId) return null;

  // 1. Check in-memory store
  if (contractsStore.has(contractId)) {
    return normalizeContractData(contractsStore.get(contractId)!);
  }

  // 2. Query Firestore
  try {
    const contractRef = doc(db, 'contracts', contractId);
    const snap = await getDoc(contractRef);
    if (snap.exists()) {
      const data = normalizeContractData(snap.data() as GigLinkContract);
      contractsStore.set(contractId, data);
      return data;
    }
  } catch (err) {
    // Return null safely if document cannot be fetched
  }

  return null;
}

/**
 * Fetch a contract by associated application ID
 */
export async function getContractByApplicationId(applicationId: string): Promise<GigLinkContract | null> {
  if (!applicationId) return null;

  // 1. Search in-memory store
  for (const contract of contractsStore.values()) {
    if (contract.applicationId === applicationId) {
      return contract;
    }
  }

  // 2. Query Firestore
  try {
    const q = query(collection(db, 'contracts'), where('applicationId', '==', applicationId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const contract = snap.docs[0].data() as GigLinkContract;
      contractsStore.set(contract.id, contract);
      return contract;
    }
  } catch (err) {
    // Return null on failure safely
  }

  return null;
}

/**
 * Get all contracts involving a specific user (either creator or talent)
 */
export async function getContractsForUser(userId: string): Promise<GigLinkContract[]> {
  if (!userId) return [];

  if (customContractReader) {
    return await customContractReader(userId);
  }

  const results = new Map<string, GigLinkContract>();

  // Check in-memory
  for (const contract of contractsStore.values()) {
    if (contract.creatorId === userId || contract.talentId === userId) {
      results.set(contract.id, contract);
    }
  }

  // Check Firestore
  try {
    const qCreator = query(collection(db, 'contracts'), where('creatorId', '==', userId));
    const qTalent = query(collection(db, 'contracts'), where('talentId', '==', userId));

    const [snapCreator, snapTalent] = await Promise.all([getDocs(qCreator), getDocs(qTalent)]);

    snapCreator.forEach((d) => {
      const c = d.data() as GigLinkContract;
      results.set(c.id, c);
      contractsStore.set(c.id, c);
    });

    snapTalent.forEach((d) => {
      const c = d.data() as GigLinkContract;
      results.set(c.id, c);
      contractsStore.set(c.id, c);
    });
  } catch (err) {
    if (results.size === 0) {
      throw err;
    }
  }

  return Array.from(results.values());
}

/**
 * Updates draft scope specifications before contract activation
 */
export async function updateDraftScope(
  contractId: string,
  currentUserId: string,
  scopeUpdates: Partial<ContractScopeLock>,
  updatedMilestones?: ContractMilestone[],
  userIsOrgAdmin = false
): Promise<GigLinkContract> {
  const contract = await getContract(contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found.`);
  }

  const isCreator = currentUserId === contract.creatorId || userIsOrgAdmin;
  if (!isCreator) {
    throw new Error('Unauthorized: Only the opportunity creator can edit contract scope.');
  }

  if (contract.status !== 'draft') {
    throw new Error(`Cannot update scope: Contract is already in '${contract.status}' status and locked.`);
  }

  const now = new Date().toISOString();

  const updatedScope: ContractScopeLock = {
    ...contract.scopeLock,
    ...scopeUpdates,
  };

  const updatedContract: GigLinkContract = {
    ...contract,
    scopeLock: updatedScope,
    milestones: updatedMilestones || contract.milestones,
    // Reset acceptances if draft scope changed
    creatorAcceptance: {
      accepted: false,
      acceptedAt: null,
      acceptedByUserId: null,
      signedName: null,
    },
    talentAcceptance: {
      accepted: false,
      acceptedAt: null,
      acceptedByUserId: null,
      signedName: null,
    },
    status: 'draft',
    updatedAt: now,
  };

  await persistContract(updatedContract);
  return updatedContract;
}

/**
 * Proposes contract terms from Creator to Talent
 */
export async function proposeContractTerms(
  contractId: string,
  currentUserId: string,
  signedName: string,
  userIsOrgAdmin = false
): Promise<GigLinkContract> {
  const contract = await getContract(contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found.`);
  }

  const isCreator = currentUserId === contract.creatorId || userIsOrgAdmin;
  if (!isCreator) {
    throw new Error('Unauthorized: Only the contract creator can propose contract terms.');
  }

  if (contract.status === 'active' || contract.status === 'completed') {
    throw new Error('Contract is already active or completed.');
  }

  const now = new Date().toISOString();

  const updatedContract: GigLinkContract = {
    ...contract,
    status: 'pending_acceptance',
    creatorAcceptance: {
      accepted: true,
      acceptedAt: now,
      acceptedByUserId: currentUserId,
      signedName: signedName.trim() || contract.creatorName || 'Client',
    },
    updatedAt: now,
  };

  await persistContract(updatedContract);
  return updatedContract;
}

/**
 * Mutual acceptance of contract terms by either Creator or Talent.
 * When BOTH parties accept, the contract transitions to 'active' and scope locks.
 */
export async function acceptContract(
  contractId: string,
  currentUserId: string,
  signedName: string,
  userIsOrgAdmin = false
): Promise<GigLinkContract> {
  const contract = await getContract(contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found.`);
  }

  const isCreator = currentUserId === contract.creatorId || userIsOrgAdmin;
  const isTalent = currentUserId === contract.talentId;

  if (!isCreator && !isTalent) {
    throw new Error('Unauthorized: Only designated contract parties (Creator or Talent) can accept terms.');
  }

  if (contract.status === 'completed' || contract.status === 'cancelled') {
    throw new Error(`Cannot accept a contract in '${contract.status}' status.`);
  }

  const now = new Date().toISOString();

  const newCreatorAcceptance = isCreator
    ? {
        accepted: true,
        acceptedAt: now,
        acceptedByUserId: currentUserId,
        signedName: signedName.trim() || contract.creatorName || 'Client',
      }
    : contract.creatorAcceptance;

  const newTalentAcceptance = isTalent
    ? {
        accepted: true,
        acceptedAt: now,
        acceptedByUserId: currentUserId,
        signedName: signedName.trim() || contract.talentName || 'Talent',
      }
    : contract.talentAcceptance;

  // Check if both parties have accepted terms
  const bothAccepted = newCreatorAcceptance.accepted && newTalentAcceptance.accepted;

  const updatedStatus: ContractStatus = bothAccepted ? 'active' : 'pending_acceptance';

  const updatedScopeLock: ContractScopeLock = {
    ...contract.scopeLock,
    lockedAt: bothAccepted ? contract.scopeLock.lockedAt || now : null,
  };

  const updatedContract: GigLinkContract = {
    ...contract,
    status: updatedStatus,
    scopeLock: updatedScopeLock,
    creatorAcceptance: newCreatorAcceptance,
    talentAcceptance: newTalentAcceptance,
    activatedAt: bothAccepted ? contract.activatedAt || now : null,
    updatedAt: now,
  };

  await persistContract(updatedContract);
  return updatedContract;
}

/**
 * Explicit contract activation requiring both parties to have signed
 */
export async function activateContract(
  contractId: string,
  currentUserId: string,
  userIsOrgAdmin = false
): Promise<GigLinkContract> {
  const contract = await getContract(contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found.`);
  }

  const isCreator = currentUserId === contract.creatorId || userIsOrgAdmin;
  const isTalent = currentUserId === contract.talentId;

  if (!isCreator && !isTalent) {
    throw new Error('Unauthorized: Only contract parties can activate the contract.');
  }

  if (!contract.creatorAcceptance.accepted || !contract.talentAcceptance.accepted) {
    throw new Error('Contract cannot become active until both Creator and Talent have accepted terms.');
  }

  const now = new Date().toISOString();

  const updatedContract: GigLinkContract = {
    ...contract,
    status: 'active',
    scopeLock: {
      ...contract.scopeLock,
      lockedAt: contract.scopeLock.lockedAt || now,
    },
    activatedAt: contract.activatedAt || now,
    updatedAt: now,
  };

  await persistContract(updatedContract);
  return updatedContract;
}

/**
 * Retrieve milestones for a specific contract
 */
export async function getContractMilestones(contractId: string): Promise<ContractMilestone[]> {
  const contract = await getContract(contractId);
  if (!contract) return [];
  return contract.milestones || [];
}

/**
 * Update milestone status or details within a contract.
 * Enforces role boundaries:
 * - Work execution only on active contracts
 * - Talent cannot approve their own milestone
 * - Creator cannot submit milestone deliverable as talent
 */
export async function updateContractMilestone(
  contractId: string,
  milestoneId: string,
  currentUserId: string,
  updates: Partial<ContractMilestone>,
  userIsOrgAdmin = false
): Promise<ContractMilestone> {
  const contract = await getContract(contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found.`);
  }

  const isCreator = currentUserId === contract.creatorId || userIsOrgAdmin;
  const isTalent = currentUserId === contract.talentId;

  if (!isCreator && !isTalent) {
    throw new Error('Unauthorized: You are not a party to this contract.');
  }

  // Work execution blocked before contract is active
  if (contract.status !== 'active') {
    throw new Error(`Milestone execution is blocked: Contract status is '${contract.status}', must be 'active'.`);
  }

  const milestoneIndex = contract.milestones.findIndex((m) => m.id === milestoneId);
  if (milestoneIndex === -1) {
    throw new Error(`Milestone ${milestoneId} not found on contract ${contractId}.`);
  }

  const existingMilestone = contract.milestones[milestoneIndex];

  // Role Boundary 1: Talent cannot approve their own submission
  if (updates.reviewState === 'approved' && isTalent && !isCreator) {
    throw new Error('Unauthorized: Talent cannot approve their own milestone deliverables.');
  }

  // Role Boundary 2: Creator cannot submit deliverable as talent
  if (updates.submission && isCreator && !isTalent) {
    throw new Error('Unauthorized: Deliverable submission must be performed by the assigned Talent.');
  }

  const now = new Date().toISOString();

  const updatedMilestone: ContractMilestone = {
    ...existingMilestone,
    ...updates,
    updatedAt: now,
    approvedAt: updates.reviewState === 'approved' ? (updates.approvedAt || now) : existingMilestone.approvedAt,
  };

  const updatedMilestones = [...contract.milestones];
  updatedMilestones[milestoneIndex] = updatedMilestone;

  // Check if all milestones are approved to auto-advance contract completion readiness
  const allApproved = updatedMilestones.every((m) => m.reviewState === 'approved' || m.status === 'completed');

  const updatedContract: GigLinkContract = {
    ...contract,
    milestones: updatedMilestones,
    completedAt: allApproved && contract.status === 'active' ? (contract.completedAt || now) : contract.completedAt,
    updatedAt: now,
  };

  await persistContract(updatedContract);
  return updatedMilestone;
}

/**
 * Adds a new milestone to a draft contract
 */
export async function addContractMilestone(
  contractId: string,
  currentUserId: string,
  milestoneData: {
    title: string;
    description: string;
    deliverables?: string[];
    amount?: number;
    currency?: string;
    dueDate?: string | null;
  },
  userIsOrgAdmin = false
): Promise<ContractMilestone[]> {
  const contract = await getContract(contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found.`);
  }

  const isCreator = currentUserId === contract.creatorId || userIsOrgAdmin;
  if (!isCreator) {
    throw new Error('Unauthorized: Only the creator can add milestones.');
  }

  if (contract.status !== 'draft') {
    throw new Error(`Cannot add milestones to a contract with status '${contract.status}'. Scope is locked.`);
  }

  if (contract.milestones && contract.milestones.length >= 10) {
    throw new Error('Cannot add milestone: Maximum limit of 10 milestones per contract reached.');
  }

  const now = new Date().toISOString();
  const newMilestone: ContractMilestone = {
    id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    contractId,
    title: milestoneData.title.trim(),
    description: milestoneData.description.trim(),
    deliverables: milestoneData.deliverables || ['Agreed Milestone Deliverables'],
    amount: milestoneData.amount || 0,
    currency: milestoneData.currency || contract.scopeLock.currency || 'USD',
    dueDate: milestoneData.dueDate || null,
    status: 'pending',
    reviewState: 'pending_submission',
    revisionAllowance: 2,
    revisionCount: 0,
    paymentState: 'unfunded',
    submission: null,
    reviewHistory: [],
    submittedAt: null,
    reviewedAt: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const updatedMilestones = [...contract.milestones, newMilestone];

  const updatedContract: GigLinkContract = {
    ...contract,
    milestones: updatedMilestones,
    updatedAt: now,
  };

  await persistContract(updatedContract);
  return updatedMilestones;
}

/**
 * Deletes a milestone from a draft contract
 */
export async function deleteContractMilestone(
  contractId: string,
  milestoneId: string,
  currentUserId: string,
  userIsOrgAdmin = false
): Promise<ContractMilestone[]> {
  const contract = await getContract(contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found.`);
  }

  const isCreator = currentUserId === contract.creatorId || userIsOrgAdmin;
  if (!isCreator) {
    throw new Error('Unauthorized: Only the creator can delete milestones.');
  }

  if (contract.status === 'active' || contract.status === 'completed') {
    throw new Error('Scope is locked: Cannot delete milestones on an active contract.');
  }

  const updatedMilestones = contract.milestones.filter((m) => m.id !== milestoneId);

  const updatedContract: GigLinkContract = {
    ...contract,
    milestones: updatedMilestones,
    updatedAt: new Date().toISOString(),
  };

  await persistContract(updatedContract);
  return updatedMilestones;
}

/**
 * Migration helper: Converts legacy OpportunityMilestones into ContractMilestones
 */
export function migrateLegacyMilestones(
  contractId: string,
  legacyMilestones: OpportunityMilestone[]
): ContractMilestone[] {
  const now = new Date().toISOString();
  return legacyMilestones.map((lm, idx) => ({
    id: lm.id || `m_migrated_${idx + 1}`,
    contractId,
    title: lm.title,
    description: lm.description,
    deliverables: ['Deliverable specification'],
    amount: 0,
    currency: 'USD',
    dueDate: lm.targetDate || null,
    status: lm.status,
    reviewState: lm.status === 'completed' ? 'approved' : 'pending_submission',
    revisionAllowance: 2,
    revisionCount: 0,
    paymentState: 'unfunded',
    submission: null,
    reviewHistory: [],
    submittedAt: null,
    reviewedAt: null,
    approvedAt: lm.completedAt || null,
    createdAt: lm.createdAt || now,
    updatedAt: now,
  }));
}

/**
 * Validates whether the specified user is allowed to start work on a milestone.
 * Rules:
 * 1. Contract must be active
 * 2. User must be the assigned partner (talent)
 * 3. Contract & milestone must not be disputed
 * 4. Milestone must not already be approved
 * 5. All previous milestones must already be approved (Sequential Progression)
 * 6. Milestone must be funded in escrow (paymentState === 'held')
 */
export function canStartMilestone(
  contract: GigLinkContract,
  milestoneId: string,
  userId: string
): { allowed: boolean; reason?: string } {
  if (!contract) return { allowed: false, reason: 'Contract does not exist.' };
  if (contract.status !== 'active') {
    return { allowed: false, reason: `Contract is in '${contract.status}' status. Work can only be started on active contracts.` };
  }
  if (contract.disputeStatus === 'open' || contract.disputeStatus === 'under_admin_review') {
    return { allowed: false, reason: 'Milestone start blocked: Contract is currently in active dispute.' };
  }
  if (userId !== contract.talentId) {
    return { allowed: false, reason: 'Unauthorized: Only the assigned Partner can start work on this milestone.' };
  }

  const index = contract.milestones.findIndex((m) => m.id === milestoneId);
  if (index === -1) {
    return { allowed: false, reason: 'Milestone not found on contract.' };
  }

  const milestone = contract.milestones[index];
  if (milestone.disputeStatus === 'disputed') {
    return { allowed: false, reason: 'Cannot start work on a disputed milestone.' };
  }

  if (milestone.workState === 'approved' || milestone.reviewState === 'approved' || milestone.status === 'completed') {
    return { allowed: false, reason: 'This milestone has already been completed and approved.' };
  }

  // Sequential progression check: All preceding milestones must be approved
  for (let i = 0; i < index; i++) {
    const prev = contract.milestones[i];
    if (prev.workState !== 'approved' && prev.reviewState !== 'approved' && prev.status !== 'completed') {
      return {
        allowed: false,
        reason: `Previous milestone "${prev.title}" must be completed and approved before starting this milestone.`,
      };
    }
  }

  // Funding check: Escrow funds MUST be held
  if (milestone.paymentState !== 'held') {
    return {
      allowed: false,
      reason: `Escrow funding required: Client must deposit milestone funds into escrow before work can begin (current state: '${milestone.paymentState}').`,
    };
  }

  return { allowed: true };
}

/**
 * Validates whether the specified user is allowed to submit a deliverable for a milestone.
 * Rules:
 * 1. Contract must be active
 * 2. User must be the assigned talent
 * 3. Milestone must exist and not already be approved
 * 4. All previous milestones must already be approved (Sequential Progression)
 */
export function canSubmitMilestone(
  contract: GigLinkContract,
  milestoneId: string,
  userId: string
): { allowed: boolean; reason?: string } {
  if (!contract) return { allowed: false, reason: 'Contract does not exist.' };
  if (contract.status !== 'active') {
    return { allowed: false, reason: `Contract is in '${contract.status}' status. Submissions are only permitted on active contracts.` };
  }
  if (contract.disputeStatus === 'open' || contract.disputeStatus === 'under_admin_review') {
    return { allowed: false, reason: 'Milestone submission blocked: Contract is currently in active dispute.' };
  }
  if (userId !== contract.talentId) {
    return { allowed: false, reason: 'Unauthorized: Only the assigned Talent can submit milestone deliverables.' };
  }

  const index = contract.milestones.findIndex((m) => m.id === milestoneId);
  if (index === -1) {
    return { allowed: false, reason: 'Milestone not found on contract.' };
  }

  const milestone = contract.milestones[index];
  if (milestone.workState === 'approved' || milestone.reviewState === 'approved' || milestone.status === 'completed') {
    return { allowed: false, reason: 'This milestone has already been reviewed and approved.' };
  }

  // Work state machine check: Deliverables cannot be submitted while already under review
  if (milestone.workState === 'submitted' || milestone.reviewState === 'submitted' || milestone.reviewState === 'in_review') {
    return { allowed: false, reason: 'Deliverables are already submitted and currently under client review.' };
  }

  // Work state machine check: Partner must officially start work before submitting deliverables
  if (milestone.workState === 'ready_to_start') {
    return { allowed: false, reason: 'Work must be officially started before deliverables can be submitted.' };
  }

  // Sequential progression check: All preceding milestones must be approved
  for (let i = 0; i < index; i++) {
    const prev = contract.milestones[i];
    if (prev.workState !== 'approved' && prev.reviewState !== 'approved' && prev.status !== 'completed') {
      return {
        allowed: false,
        reason: `Previous milestone "${prev.title}" must be completed and approved before submitting this milestone.`,
      };
    }
  }

  // Phase 4 Escrow & Funding check: Milestone must be funded before talent can submit deliverables
  if (milestone.paymentState === 'unfunded') {
    return {
      allowed: false,
      reason: 'Escrow funding required: Client must fund this milestone before deliverables can be submitted.',
    };
  }

  // Phase 4 Amendment budget increase check: If required funding exceeds held amount, additional funding is required
  if (milestone.requiredFundingAmount && milestone.fundedAmount && milestone.requiredFundingAmount > milestone.fundedAmount) {
    return {
      allowed: false,
      reason: 'Additional escrow funding required: Client must fund the amended budget increase before work can be submitted.',
    };
  }

  return { allowed: true };
}

/**
 * Validates whether the specified user is allowed to review (approve/request revision for) a milestone.
 * Rules:
 * 1. Contract must be active
 * 2. User must be creator or authorized org admin (Talent CANNOT approve own work)
 * 3. Milestone must be in 'submitted' or 'in_review' state (or 'revision_requested')
 */
export function canReviewMilestone(
  contract: GigLinkContract,
  milestoneId: string,
  userId: string,
  userIsOrgAdmin = false
): { allowed: boolean; reason?: string } {
  if (!contract) return { allowed: false, reason: 'Contract does not exist.' };
  if (contract.status !== 'active') {
    return { allowed: false, reason: `Contract is in '${contract.status}' status. Reviews are only permitted on active contracts.` };
  }
  if (contract.disputeStatus === 'open' || contract.disputeStatus === 'under_admin_review') {
    return { allowed: false, reason: 'Milestone review blocked: Contract is currently in active dispute.' };
  }

  const isCreator = userId === contract.creatorId || userIsOrgAdmin;
  const isTalent = userId === contract.talentId;

  if (isTalent && !isCreator) {
    return { allowed: false, reason: 'Unauthorized: Talent cannot review or approve their own submissions.' };
  }

  if (!isCreator) {
    return { allowed: false, reason: 'Unauthorized: Only the opportunity creator or authorized manager can review deliverables.' };
  }

  const milestone = contract.milestones.find((m) => m.id === milestoneId);
  if (!milestone) {
    return { allowed: false, reason: 'Milestone not found on contract.' };
  }

  if (milestone.reviewState === 'approved') {
    return { allowed: false, reason: 'Milestone is already approved.' };
  }

  if (!milestone.submission && milestone.reviewState === 'pending_submission') {
    return { allowed: false, reason: 'No deliverable has been submitted for this milestone yet.' };
  }

  return { allowed: true };
}

/**
 * Validates whether the talent can submit the final handover.
 * Rules:
 * 1. Contract must be active
 * 2. User must be the talent
 * 3. ALL milestones must be approved
 * 4. Final handover must not already be accepted
 */
export function canSubmitFinalHandover(
  contract: GigLinkContract,
  userId: string
): { allowed: boolean; reason?: string } {
  if (!contract) return { allowed: false, reason: 'Contract does not exist.' };
  if (contract.status !== 'active') {
    return { allowed: false, reason: `Contract is in '${contract.status}' status.` };
  }
  if (userId !== contract.talentId) {
    return { allowed: false, reason: 'Unauthorized: Only the assigned Talent can submit the final project handover.' };
  }

  const allApproved = contract.milestones.length > 0 &&
    contract.milestones.every((m) => m.reviewState === 'approved' || m.status === 'completed');

  if (!allApproved) {
    return { allowed: false, reason: 'All milestone deliverables must be reviewed and approved before final handover can be submitted.' };
  }

  if (contract.finalHandover?.status === 'accepted') {
    return { allowed: false, reason: 'Final handover has already been accepted.' };
  }

  return { allowed: true };
}

/**
 * Validates whether the creator can accept the final handover and mark the project completed.
 * Rules:
 * 1. Contract must be active
 * 2. User must be creator or org admin
 * 3. ALL milestones must be approved
 * 4. Final handover must have been submitted by talent
 */
export function canAcceptFinalHandover(
  contract: GigLinkContract,
  userId: string,
  userIsOrgAdmin = false
): { allowed: boolean; reason?: string } {
  if (!contract) return { allowed: false, reason: 'Contract does not exist.' };
  if (contract.status !== 'active') {
    return { allowed: false, reason: `Contract is in '${contract.status}' status.` };
  }

  const isCreator = userId === contract.creatorId || userIsOrgAdmin;
  if (!isCreator) {
    return { allowed: false, reason: 'Unauthorized: Only the opportunity creator can accept final handover and complete the project.' };
  }

  const allApproved = contract.milestones.length > 0 &&
    contract.milestones.every((m) => m.reviewState === 'approved' || m.status === 'completed');

  if (!allApproved) {
    return { allowed: false, reason: 'All milestones must be approved before accepting handover.' };
  }

  if (!contract.finalHandover || contract.finalHandover.status !== 'submitted') {
    return { allowed: false, reason: 'Talent has not yet submitted the final project handover.' };
  }

  return { allowed: true };
}

/**
 * Computes high-level progress statistics for a contract
 */
export function getContractProgress(contract: GigLinkContract) {
  const total = contract.milestones.length;
  const approved = contract.milestones.filter(
    (m) => m.workState === 'approved' || m.reviewState === 'approved' || m.status === 'completed'
  ).length;
  const percentage = total > 0 ? Math.round((approved / total) * 100) : 0;
  const allApproved = total > 0 && approved === total;
  
  // Find current active milestone
  let currentMilestoneIndex = -1;
  for (let i = 0; i < contract.milestones.length; i++) {
    const m = contract.milestones[i];
    if (m.workState !== 'approved' && m.reviewState !== 'approved' && m.status !== 'completed') {
      currentMilestoneIndex = i;
      break;
    }
  }

  return {
    total,
    approved,
    percentage,
    allApproved,
    currentMilestoneIndex,
    isCompleted: contract.status === 'completed',
    hasFinalHandoverSubmitted: contract.finalHandover?.status === 'submitted',
    hasFinalHandoverAccepted: contract.finalHandover?.status === 'accepted',
  };
}

/**
 * Test hook for mocking client lifecycle API calls in isolated unit tests.
 * In production/runtime, this is null and postApi is invoked directly.
 */
export type LifecycleMockHandler = (
  action: 'start' | 'submit' | 'review',
  params: any
) => Promise<any>;

let customLifecycleMock: LifecycleMockHandler | null = null;

export function setLifecycleMockForTesting(mock: LifecycleMockHandler | null): void {
  if (mock && !isTestRuntime()) {
    throw new Error('setLifecycleMockForTesting is strictly forbidden outside test environments.');
  }
  customLifecycleMock = mock;
}

/**
 * Partner initiates work on a funded milestone.
 * Directs to POST /api/contracts/milestones/start (Strictly Server-Authoritative).
 * Fails closed without modifying Firestore or local store if server API is unavailable.
 */
export async function startMilestoneWork(params: {
  contractId: string;
  milestoneId: string;
  partnerUserId?: string;
  idempotencyKey?: string;
}): Promise<{ contract: GigLinkContract; milestone: ContractMilestone }> {
  if (customLifecycleMock) {
    if (!isTestRuntime()) {
      throw new Error('Lifecycle mock handler is strictly prohibited in production runtime.');
    }
    return await customLifecycleMock('start', params);
  }

  const { contractId, milestoneId, idempotencyKey } = params;

  const data = await postApi<{
    success: boolean;
    contract: GigLinkContract;
    milestone: ContractMilestone;
  }>('/api/contracts/milestones/start', {
    contractId,
    milestoneId,
    idempotencyKey,
  });

  if (!data?.contract) {
    throw new Error('Server API failed to return updated contract state.');
  }

  contractsStore.set(data.contract.id, data.contract);
  return { contract: data.contract, milestone: data.milestone };
}

/**
 * Partner submits deliverable version for a specific milestone.
 * Directs to POST /api/contracts/milestones/submit (Strictly Server-Authoritative).
 * Fails closed without modifying Firestore or local store if server API is unavailable.
 */
export async function submitMilestoneDeliverable(params: {
  contractId: string;
  milestoneId: string;
  talentUserId?: string;
  submission: {
    deliveryNote: string;
    demoUrl?: string;
    repoUrl?: string;
    figmaUrl?: string;
    links?: string[];
    evidenceFiles?: string[];
  };
  idempotencyKey?: string;
}): Promise<{
  contract: GigLinkContract;
  milestone: ContractMilestone;
  submissionVersion?: number;
}> {
  if (customLifecycleMock) {
    if (!isTestRuntime()) {
      throw new Error('Lifecycle mock handler is strictly prohibited in production runtime.');
    }
    return await customLifecycleMock('submit', params);
  }

  const { contractId, milestoneId, submission, idempotencyKey } = params;

  const data = await postApi<{
    success: boolean;
    contract: GigLinkContract;
    milestone: ContractMilestone;
    submissionVersion: number;
  }>('/api/contracts/milestones/submit', {
    contractId,
    milestoneId,
    deliveryNote: submission.deliveryNote,
    demoUrl: submission.demoUrl,
    repoUrl: submission.repoUrl,
    figmaUrl: submission.figmaUrl,
    additionalLinks: submission.links,
    evidenceFiles: submission.evidenceFiles,
    idempotencyKey,
  });

  if (!data?.contract) {
    throw new Error('Server API failed to return updated contract state.');
  }

  contractsStore.set(data.contract.id, data.contract);
  return {
    contract: data.contract,
    milestone: data.milestone,
    submissionVersion: data.submissionVersion,
  };
}

/**
 * Client reviews a milestone deliverable: approves, requests revision, or raises dispute.
 * Directs to POST /api/contracts/milestones/review (Strictly Server-Authoritative).
 * Fails closed without modifying Firestore or local store if server API is unavailable.
 *
 * Invariant: Approving work authorizes payment release; it does NOT release funds or modify paymentState.
 */
export async function reviewMilestoneDeliverable(params: {
  contractId: string;
  milestoneId: string;
  reviewerUserId?: string;
  decision: 'approved' | 'revision_requested' | 'disputed';
  feedback?: string;
  reviewerName?: string;
  userIsOrgAdmin?: boolean;
  idempotencyKey?: string;
}): Promise<{ contract: GigLinkContract; milestone: ContractMilestone; decision: string }> {
  if (customLifecycleMock) {
    if (!isTestRuntime()) {
      throw new Error('Lifecycle mock handler is strictly prohibited in production runtime.');
    }
    return await customLifecycleMock('review', params);
  }

  const {
    contractId,
    milestoneId,
    decision,
    feedback = '',
    userIsOrgAdmin = false,
    idempotencyKey,
  } = params;

  const data = await postApi<{
    success: boolean;
    contract: GigLinkContract;
    milestone: ContractMilestone;
    decision: string;
  }>('/api/contracts/milestones/review', {
    contractId,
    milestoneId,
    decision,
    feedback,
    userIsOrgAdmin,
    idempotencyKey,
  });

  if (!data?.contract) {
    throw new Error('Server API failed to return updated contract state.');
  }

  contractsStore.set(data.contract.id, data.contract);
  return {
    contract: data.contract,
    milestone: data.milestone,
    decision: data.decision,
  };
}

/**
 * Talent submits the final project handover package once all milestones are approved.
 */
export async function submitFinalHandover(params: {
  contractId: string;
  talentUserId: string;
  handover: {
    finalProjectUrl?: string;
    repoUrl?: string;
    documentationUrl?: string;
    credentialsHandoverConfirmed: boolean;
    finalNotes: string;
    assetLinks?: string[];
  };
}): Promise<GigLinkContract> {
  const { contractId, talentUserId, handover } = params;

  const contract = await getContract(contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found.`);
  }

  const check = canSubmitFinalHandover(contract, talentUserId);
  if (!check.allowed) {
    throw new Error(check.reason || 'Unauthorized final handover submission.');
  }

  if (!handover.finalNotes || handover.finalNotes.trim().length === 0) {
    throw new Error('Final handover summary notes are required.');
  }

  const now = new Date().toISOString();

  const finalHandoverData: ContractFinalHandover = {
    finalProjectUrl: handover.finalProjectUrl?.trim() || undefined,
    repoUrl: handover.repoUrl?.trim() || undefined,
    documentationUrl: handover.documentationUrl?.trim() || undefined,
    credentialsHandoverConfirmed: !!handover.credentialsHandoverConfirmed,
    finalNotes: handover.finalNotes.trim(),
    assetLinks: handover.assetLinks || [],
    submittedBy: talentUserId,
    submittedAt: now,
    acceptedBy: null,
    acceptedAt: null,
    status: 'submitted',
  };

  const updatedContract: GigLinkContract = {
    ...contract,
    finalHandover: finalHandoverData,
    updatedAt: now,
  };

  await persistContract(updatedContract);
  return updatedContract;
}

/**
 * Creator accepts final handover, which officially marks the contract and project as completed.
 */
export async function acceptFinalHandover(params: {
  contractId: string;
  reviewerUserId: string;
  userIsOrgAdmin?: boolean;
}): Promise<GigLinkContract> {
  const { contractId, reviewerUserId, userIsOrgAdmin = false } = params;

  const contract = await getContract(contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found.`);
  }

  const check = canAcceptFinalHandover(contract, reviewerUserId, userIsOrgAdmin);
  if (!check.allowed) {
    throw new Error(check.reason || 'Unauthorized final handover acceptance.');
  }

  const now = new Date().toISOString();

  const finalHandover: ContractFinalHandover = {
    ...contract.finalHandover!,
    acceptedBy: reviewerUserId,
    acceptedAt: now,
    status: 'accepted',
  };

  const updatedContract: GigLinkContract = {
    ...contract,
    status: 'completed',
    finalHandover,
    completedAt: now,
    updatedAt: now,
  };

  await persistContract(updatedContract);
  return updatedContract;
}

// =========================================================================
// PHASE 3: CONTRACT AMENDMENTS & CHANGE REQUEST SYSTEM
// =========================================================================

/**
 * Validates whether a user is authorized to create a Change Request.
 * Enforces:
 * - Contract must be 'active' (not completed, draft, pending, or cancelled).
 * - User must be creator, talent, or authorized org admin.
 * - No concurrent pending change requests (one active request at a time ensures strict atomicity).
 */
export function canCreateChangeRequest(
  contract: GigLinkContract,
  userId: string,
  userIsOrgAdmin = false
): { allowed: boolean; reason?: string; role?: 'creator' | 'talent' } {
  if (!contract) {
    return { allowed: false, reason: 'Contract not found.' };
  }

  if (contract.status === 'completed') {
    return {
      allowed: false,
      reason: 'Completed contracts cannot be amended. The project scope is finalized and locked.',
    };
  }

  if (contract.status !== 'active') {
    return {
      allowed: false,
      reason: `Change requests can only be initiated on active contracts (currently '${contract.status}').`,
    };
  }

  if (contract.disputeStatus === 'open' || contract.disputeStatus === 'under_admin_review') {
    return {
      allowed: false,
      reason: 'Change requests cannot be initiated while an active dispute is open on this contract.',
    };
  }

  const isCreator = userId === contract.creatorId || userIsOrgAdmin;
  const isTalent = userId === contract.talentId;

  if (!isCreator && !isTalent) {
    return {
      allowed: false,
      reason: 'Unauthorized: Only designated contract participants (Creator or Talent) can create change requests.',
    };
  }

  // Check if there is already a pending change request
  const hasPending = (contract.changeRequests || []).some((cr) => cr.status === 'pending');
  if (hasPending) {
    return {
      allowed: false,
      reason: 'A change request is already pending review. Please resolve or withdraw it before creating a new one.',
    };
  }

  return { allowed: true, role: isCreator ? 'creator' : 'talent' };
}

/**
 * Validates whether a user can review, approve, or reject a Change Request.
 * Enforces:
 * - Mutual approval: Requester cannot self-approve.
 * - Counterparty only: If talent requested, creator reviews; if creator requested, talent reviews.
 * - Request must be in 'pending' status.
 * - Contract must be active.
 */
export function canRespondToChangeRequest(
  contract: GigLinkContract,
  changeRequestId: string,
  userId: string,
  userIsOrgAdmin = false
): { allowed: boolean; reason?: string } {
  if (!contract) {
    return { allowed: false, reason: 'Contract not found.' };
  }

  if (contract.status === 'completed') {
    return { allowed: false, reason: 'Contract is completed and locked.' };
  }

  if (contract.status !== 'active') {
    return { allowed: false, reason: 'Contract is not active.' };
  }

  if (contract.disputeStatus === 'open' || contract.disputeStatus === 'under_admin_review') {
    return { allowed: false, reason: 'Cannot review or approve change requests while contract is in active dispute.' };
  }

  const changeRequest = (contract.changeRequests || []).find((cr) => cr.id === changeRequestId);
  if (!changeRequest) {
    return { allowed: false, reason: 'Change request not found.' };
  }

  if (changeRequest.status !== 'pending') {
    return { allowed: false, reason: `Change request is already in '${changeRequest.status}' status.` };
  }

  // Self-approval is strictly forbidden!
  if (userId === changeRequest.requestedBy) {
    return {
      allowed: false,
      reason: 'Self-approval is forbidden. The counterparty must review and approve this change request.',
    };
  }

  const isCreator = userId === contract.creatorId || userIsOrgAdmin;
  const isTalent = userId === contract.talentId;

  if (!isCreator && !isTalent) {
    return {
      allowed: false,
      reason: 'Unauthorized: Only contract participants can review change requests.',
    };
  }

  if (changeRequest.requestedByRole === 'talent' && !isCreator) {
    return { allowed: false, reason: 'Only the client can review this change request.' };
  }
  if (changeRequest.requestedByRole === 'creator' && !isTalent) {
    return { allowed: false, reason: 'Only the talent can review this change request.' };
  }

  return { allowed: true };
}

/**
 * Validates whether the author can withdraw a pending Change Request.
 */
export function canWithdrawChangeRequest(
  contract: GigLinkContract,
  changeRequestId: string,
  userId: string
): { allowed: boolean; reason?: string } {
  if (!contract) {
    return { allowed: false, reason: 'Contract not found.' };
  }

  const changeRequest = (contract.changeRequests || []).find((cr) => cr.id === changeRequestId);
  if (!changeRequest) {
    return { allowed: false, reason: 'Change request not found.' };
  }

  if (changeRequest.status !== 'pending') {
    return { allowed: false, reason: `Cannot withdraw a change request that is '${changeRequest.status}'.` };
  }

  if (userId !== changeRequest.requestedBy) {
    return {
      allowed: false,
      reason: 'Only the author who created the change request can withdraw it.',
    };
  }

  return { allowed: true };
}

/**
 * Creates a new Contract Change Request in 'pending' status.
 */
export async function createChangeRequest(params: {
  contractId: string;
  userId: string;
  userIsOrgAdmin?: boolean;
  title: string;
  reason: string;
  description?: string;
  proposedChanges: ContractProposedChanges;
}): Promise<{ contract: GigLinkContract; changeRequest: ContractChangeRequest }> {
  const { contractId, userId, userIsOrgAdmin = false, title, reason, description, proposedChanges } = params;

  return runWithContractLock(contractId, async () => {
    const contract = await getContract(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found.`);
    }

    // Atomic pre-flight check inside lock
    const check = canCreateChangeRequest(contract, userId, userIsOrgAdmin);
    if (!check.allowed) {
      throw new Error(check.reason || 'Cannot create change request.');
    }

    if (!title || title.trim().length === 0) {
      throw new Error('Change request title is required.');
    }
    if (!reason || reason.trim().length === 0) {
      throw new Error('Change request justification / reason is required.');
    }

    // Validate proposed milestone changes if any
    if (proposedChanges.milestoneChanges && proposedChanges.milestoneChanges.length > 0) {
      for (const mc of proposedChanges.milestoneChanges) {
        if (mc.type === 'modify' || mc.type === 'remove') {
          if (!mc.milestoneId) {
            throw new Error('Milestone ID is required when modifying or removing a milestone.');
          }
          const targetM = contract.milestones.find((m) => m.id === mc.milestoneId);
          if (!targetM) {
            throw new Error(`Target milestone ${mc.milestoneId} not found in contract.`);
          }
          if (targetM.reviewState === 'approved' || targetM.status === 'completed') {
            throw new Error(
              `Cannot modify or remove milestone "${targetM.title}" because it has already been approved and finalized.`
            );
          }
        }
        if (mc.type === 'add') {
          if (!mc.title || mc.title.trim().length === 0) {
            throw new Error('Title is required for adding a new milestone.');
          }
          if (mc.amount !== undefined && mc.amount < 0) {
            throw new Error('Milestone amount cannot be negative.');
          }
        }
      }
    }

    const now = new Date().toISOString();
    const requesterRole = check.role || (userId === contract.creatorId ? 'creator' : 'talent');
    const requesterName = requesterRole === 'creator'
      ? contract.creatorName || 'Client'
      : contract.talentName || 'Talent';

    // Calculate new total amount if priceDelta was provided and newTotalAmount not explicitly specified
    let newTotalAmount = proposedChanges.newTotalAmount;
    if (newTotalAmount === undefined && proposedChanges.priceDelta !== undefined) {
      newTotalAmount = Math.max(0, (contract.scopeLock.totalAmount || 0) + proposedChanges.priceDelta);
    }

    // Calculate new revision allowance if revisionAllowanceDelta was provided
    let newRevisionAllowance = proposedChanges.newRevisionAllowance;
    if (newRevisionAllowance === undefined && proposedChanges.revisionAllowanceDelta !== undefined) {
      newRevisionAllowance = Math.max(1, (contract.scopeLock.revisionAllowance || 2) + proposedChanges.revisionAllowanceDelta);
    }

    const normalizedProposedChanges: ContractProposedChanges = {
      ...proposedChanges,
      newTotalAmount,
      newRevisionAllowance,
      currency: proposedChanges.currency || contract.scopeLock.currency || 'USD',
    };

    // Construct new change request
    const changeRequestId = `cr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newChangeRequest: ContractChangeRequest = {
      id: changeRequestId,
      contractId: contract.id,
      contractVersion: contract.version || 1,
      requestedBy: userId,
      requestedByRole: requesterRole,
      requestedByName: requesterName,
      title: title.trim(),
      reason: reason.trim(),
      description: description?.trim() || undefined,
      proposedChanges: normalizedProposedChanges,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      respondedAt: null,
      respondedBy: null,
      respondedByName: null,
      responseNote: null,
      approvedAt: null,
      rejectedAt: null,
      withdrawnAt: null,
    };

    let finalContract: GigLinkContract;

    // Authoritative Cloud Firestore Distributed Transaction for Multi-Instance Atomic Serialization
    try {
      const contractRef = doc(db, 'contracts', contractId);
      finalContract = await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(contractRef);
        let currentContract: GigLinkContract;
        if (sfDoc.exists()) {
          currentContract = normalizeContractData(sfDoc.data() as GigLinkContract);
        } else {
          currentContract = contract;
        }

        // Atomic check: Ensure no other pending change request was committed simultaneously
        const hasPendingInTx = (currentContract.changeRequests || []).some((cr) => cr.status === 'pending');
        if (hasPendingInTx) {
          throw new Error('A change request is already pending review on this contract.');
        }

        const updatedInTx: GigLinkContract = {
          ...currentContract,
          changeRequests: [...(currentContract.changeRequests || []), newChangeRequest],
          updatedAt: now,
        };

        transaction.set(contractRef, updatedInTx);
        return updatedInTx;
      });
    } catch (txErr: any) {
      if (txErr?.message?.includes('already pending')) {
        throw txErr;
      }
      // If Firestore is offline / mocked / rules-restricted in test or dev runtime, apply to memory store
      const memContract = await getContract(contractId);
      const hasPendingMem = (memContract?.changeRequests || []).some((cr) => cr.status === 'pending');
      if (hasPendingMem) {
        throw new Error('A change request is already pending review on this contract.');
      }
      finalContract = {
        ...(memContract || contract),
        changeRequests: [...((memContract || contract).changeRequests || []), newChangeRequest],
        updatedAt: now,
      };
    }

    contractsStore.set(contractId, normalizeContractData(finalContract));
    return { contract: finalContract, changeRequest: newChangeRequest };
  });
}

/**
 * Responds to a pending Change Request (Approve or Reject).
 * Upon approval:
 * - Atomically increments contract version.
 * - Atomically updates contract scopeLock and permitted milestones.
 * - Records an immutable ContractAmendmentRecord in contract.amendmentHistory.
 * - Marks the change request as approved.
 */
export async function respondToChangeRequest(params: {
  contractId: string;
  changeRequestId: string;
  userId: string;
  userIsOrgAdmin?: boolean;
  decision: 'approved' | 'rejected';
  responseNote?: string;
}): Promise<{
  contract: GigLinkContract;
  changeRequest: ContractChangeRequest;
  amendmentRecord?: ContractAmendmentRecord;
}> {
  const { contractId, changeRequestId, userId, userIsOrgAdmin = false, decision, responseNote } = params;

  return runWithContractLock(contractId, async () => {
    const contract = await getContract(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found.`);
    }

    const check = canRespondToChangeRequest(contract, changeRequestId, userId, userIsOrgAdmin);
    if (!check.allowed) {
      throw new Error(check.reason || 'Cannot respond to change request.');
    }

    const crIndex = (contract.changeRequests || []).findIndex((cr) => cr.id === changeRequestId);
    if (crIndex === -1) {
      throw new Error('Change request not found.');
    }

    const changeRequest = contract.changeRequests![crIndex];
    const now = new Date().toISOString();
    const responderRole = userId === contract.creatorId || userIsOrgAdmin ? 'creator' : 'talent';
    const responderName = responderRole === 'creator'
      ? contract.creatorName || 'Client'
      : contract.talentName || 'Talent';

    // Handle REJECTION
    if (decision === 'rejected') {
      const updatedCR: ContractChangeRequest = {
        ...changeRequest,
        status: 'rejected',
        respondedAt: now,
        respondedBy: userId,
        respondedByName: responderName,
        responseNote: responseNote?.trim() || 'Change request rejected by counterparty.',
        rejectedAt: now,
        updatedAt: now,
      };

      const updatedCRs = [...(contract.changeRequests || [])];
      updatedCRs[crIndex] = updatedCR;

      const updatedContract: GigLinkContract = {
        ...contract,
        changeRequests: updatedCRs,
        updatedAt: now,
      };

      await persistContract(updatedContract);
      return { contract: updatedContract, changeRequest: updatedCR };
    }

    // Handle APPROVAL (Atomic Amendment Application)
    const proposed = changeRequest.proposedChanges;
    const versionBefore = contract.version || 1;
    const versionAfter = versionBefore + 1;
    const diff: ContractAmendmentDiffItem[] = [];

    // 1. Check budget / price change
    if (proposed.newTotalAmount !== undefined && proposed.newTotalAmount !== contract.scopeLock.totalAmount) {
      diff.push({
        field: 'totalAmount',
        label: 'Total Budget / Compensation',
        previousValue: `${contract.scopeLock.totalAmount} ${contract.scopeLock.currency}`,
        newValue: `${proposed.newTotalAmount} ${proposed.currency || contract.scopeLock.currency}`,
        changeDescription: proposed.priceDelta
          ? `${proposed.priceDelta > 0 ? '+' : ''}${proposed.priceDelta} ${contract.scopeLock.currency}`
          : `Updated to ${proposed.newTotalAmount} ${contract.scopeLock.currency}`,
      });
    }

    // 2. Check deadline change
    if (proposed.proposedDeadline !== undefined && proposed.proposedDeadline !== contract.scopeLock.deadline) {
      diff.push({
        field: 'deadline',
        label: 'Project Target Deadline',
        previousValue: contract.scopeLock.deadline || 'No target date set',
        newValue: proposed.proposedDeadline || 'No target date set',
        changeDescription: proposed.deadlineDeltaDays
          ? `${proposed.deadlineDeltaDays > 0 ? '+' : ''}${proposed.deadlineDeltaDays} days`
          : 'Adjusted target completion date',
      });
    }

    // 3. Check revision allowance change
    if (
      proposed.newRevisionAllowance !== undefined &&
      proposed.newRevisionAllowance !== contract.scopeLock.revisionAllowance
    ) {
      diff.push({
        field: 'revisionAllowance',
        label: 'Revision Allowance',
        previousValue: `${contract.scopeLock.revisionAllowance} rounds`,
        newValue: `${proposed.newRevisionAllowance} rounds`,
        changeDescription: proposed.revisionAllowanceDelta
          ? `${proposed.revisionAllowanceDelta > 0 ? '+' : ''}${proposed.revisionAllowanceDelta} round(s)`
          : `Set to ${proposed.newRevisionAllowance} rounds`,
      });
    }

    // 4. Check scope title / description
    if (proposed.title && proposed.title !== contract.scopeLock.title) {
      diff.push({
        field: 'title',
        label: 'Scope Title',
        previousValue: contract.scopeLock.title,
        newValue: proposed.title,
        changeDescription: 'Updated scope title',
      });
    }
    if (proposed.description && proposed.description !== contract.scopeLock.description) {
      diff.push({
        field: 'description',
        label: 'Scope Specifications',
        previousValue: contract.scopeLock.description,
        newValue: proposed.description,
        changeDescription: 'Updated project scope description',
      });
    }

    // 5. Inclusions / Exclusions / Deliverables
    let updatedInclusions = [...(contract.scopeLock.inclusions || [])];
    if (proposed.inclusionsToAdd && proposed.inclusionsToAdd.length > 0) {
      updatedInclusions = [...updatedInclusions, ...proposed.inclusionsToAdd];
      diff.push({
        field: 'inclusionsToAdd',
        label: 'Added Scope Inclusions',
        previousValue: [],
        newValue: proposed.inclusionsToAdd,
        changeDescription: `Added ${proposed.inclusionsToAdd.length} inclusion item(s)`,
      });
    }
    if (proposed.inclusionsToRemove && proposed.inclusionsToRemove.length > 0) {
      updatedInclusions = updatedInclusions.filter((inc) => !proposed.inclusionsToRemove!.includes(inc));
      diff.push({
        field: 'inclusionsToRemove',
        label: 'Removed Scope Inclusions',
        previousValue: proposed.inclusionsToRemove,
        newValue: [],
        changeDescription: `Removed ${proposed.inclusionsToRemove.length} inclusion item(s)`,
      });
    }

    let updatedExclusions = [...(contract.scopeLock.exclusions || [])];
    if (proposed.exclusionsToAdd && proposed.exclusionsToAdd.length > 0) {
      updatedExclusions = [...updatedExclusions, ...proposed.exclusionsToAdd];
      diff.push({
        field: 'exclusionsToAdd',
        label: 'Added Scope Exclusions',
        previousValue: [],
        newValue: proposed.exclusionsToAdd,
        changeDescription: `Added ${proposed.exclusionsToAdd.length} exclusion item(s)`,
      });
    }
    if (proposed.exclusionsToRemove && proposed.exclusionsToRemove.length > 0) {
      updatedExclusions = updatedExclusions.filter((exc) => !proposed.exclusionsToRemove!.includes(exc));
      diff.push({
        field: 'exclusionsToRemove',
        label: 'Removed Scope Exclusions',
        previousValue: proposed.exclusionsToRemove,
        newValue: [],
        changeDescription: `Removed ${proposed.exclusionsToRemove.length} exclusion item(s)`,
      });
    }

    let updatedDeliverables = [...(contract.scopeLock.deliverables || [])];
    if (proposed.deliverablesToAdd && proposed.deliverablesToAdd.length > 0) {
      updatedDeliverables = [...updatedDeliverables, ...proposed.deliverablesToAdd];
      diff.push({
        field: 'deliverablesToAdd',
        label: 'Added Scope Deliverables',
        previousValue: [],
        newValue: proposed.deliverablesToAdd,
        changeDescription: `Added ${proposed.deliverablesToAdd.length} deliverable item(s)`,
      });
    }
    if (proposed.deliverablesToRemove && proposed.deliverablesToRemove.length > 0) {
      updatedDeliverables = updatedDeliverables.filter((del) => !proposed.deliverablesToRemove!.includes(del));
      diff.push({
        field: 'deliverablesToRemove',
        label: 'Removed Scope Deliverables',
        previousValue: proposed.deliverablesToRemove,
        newValue: [],
        changeDescription: `Removed ${proposed.deliverablesToRemove.length} deliverable item(s)`,
      });
    }

    // 6. Milestone modifications
    let currentMilestones = [...contract.milestones];
    if (proposed.milestoneChanges && proposed.milestoneChanges.length > 0) {
      for (const mc of proposed.milestoneChanges) {
        if (mc.type === 'add') {
          const newMId = `m_amend_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const newM: ContractMilestone = {
            id: newMId,
            contractId: contract.id,
            title: mc.title!,
            description: mc.description || '',
            deliverables: mc.deliverables && mc.deliverables.length > 0 ? mc.deliverables : ['Milestone Deliverable'],
            amount: mc.amount || 0,
            currency: mc.currency || contract.scopeLock.currency || 'USD',
            dueDate: mc.dueDate || null,
            status: 'in_progress',
            reviewState: 'pending_submission',
            revisionAllowance: mc.revisionAllowance || proposed.newRevisionAllowance || contract.scopeLock.revisionAllowance || 2,
            revisionCount: 0,
            paymentState: 'unfunded',
            submission: null,
            reviewHistory: [],
            submittedAt: null,
            reviewedAt: null,
            approvedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          currentMilestones.push(newM);
          diff.push({
            field: `milestone_add_${newMId}`,
            label: `Added Milestone: ${mc.title}`,
            previousValue: null,
            newValue: `${mc.amount || 0} ${newM.currency} - ${mc.title}`,
            changeDescription: 'New milestone appended to project execution schedule',
          });
        } else if (mc.type === 'modify' && mc.milestoneId) {
          const mIdx = currentMilestones.findIndex((m) => m.id === mc.milestoneId);
          if (mIdx !== -1) {
            const oldM = currentMilestones[mIdx];
            if (oldM.reviewState === 'approved' || oldM.status === 'completed') {
              throw new Error(`Cannot modify approved milestone "${oldM.title}".`);
            }
            const newAmount = mc.amount !== undefined ? mc.amount : oldM.amount;
            const oldFundedAmount = oldM.fundedAmount ?? (oldM.paymentState === 'held' || oldM.paymentState === 'released' ? oldM.amount : 0);
            let newPaymentState = oldM.paymentState;
            let newRequiredFunding = oldM.requiredFundingAmount;

            if (newAmount > oldM.amount) {
              // Budget increased: if previously held or unfunded, additional funding required
              newRequiredFunding = newAmount;
              if (newPaymentState === 'held' && newAmount > oldFundedAmount) {
                // Still held for existing funded portion, but requires more before submission
                newPaymentState = 'held';
              }
            } else if (newAmount < oldM.amount) {
              // Budget decreased: safely adjust required funding without creating negative balances
              newRequiredFunding = newAmount;
            }

            currentMilestones[mIdx] = {
              ...oldM,
              title: mc.title || oldM.title,
              description: mc.description !== undefined ? mc.description : oldM.description,
              amount: newAmount,
              paymentState: newPaymentState,
              requiredFundingAmount: newRequiredFunding,
              deliverables: mc.deliverables || oldM.deliverables,
              dueDate: mc.dueDate !== undefined ? mc.dueDate : oldM.dueDate,
              updatedAt: now,
            };
            diff.push({
              field: `milestone_modify_${mc.milestoneId}`,
              label: `Modified Milestone: ${oldM.title}`,
              previousValue: `${oldM.amount} ${oldM.currency} - ${oldM.title}`,
              newValue: `${mc.amount !== undefined ? mc.amount : oldM.amount} ${oldM.currency} - ${mc.title || oldM.title}`,
              changeDescription: 'Updated milestone terms and specifications',
            });
          }
        } else if (mc.type === 'remove' && mc.milestoneId) {
          const targetM = currentMilestones.find((m) => m.id === mc.milestoneId);
          if (targetM) {
            if (targetM.reviewState === 'approved' || targetM.status === 'completed') {
              throw new Error(`Cannot remove approved milestone "${targetM.title}".`);
            }
            currentMilestones = currentMilestones.filter((m) => m.id !== mc.milestoneId);
            diff.push({
              field: `milestone_remove_${mc.milestoneId}`,
              label: `Removed Milestone: ${targetM.title}`,
              previousValue: `${targetM.amount} ${targetM.currency} - ${targetM.title}`,
              newValue: null,
              changeDescription: 'Removed milestone from active schedule',
            });
          }
        }
      }
    }

    // Construct updated ScopeLock
    const updatedScopeLock: ContractScopeLock = {
      ...contract.scopeLock,
      title: proposed.title || contract.scopeLock.title,
      description: proposed.description || contract.scopeLock.description,
      totalAmount: proposed.newTotalAmount !== undefined ? proposed.newTotalAmount : contract.scopeLock.totalAmount,
      currency: proposed.currency || contract.scopeLock.currency,
      deadline: proposed.proposedDeadline !== undefined ? proposed.proposedDeadline : contract.scopeLock.deadline,
      revisionAllowance: proposed.newRevisionAllowance !== undefined ? proposed.newRevisionAllowance : contract.scopeLock.revisionAllowance,
      inclusions: updatedInclusions,
      exclusions: updatedExclusions,
      deliverables: updatedDeliverables,
    };

    // Construct Amendment Record
    const amendmentRecordId = `amend_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const amendmentRecord: ContractAmendmentRecord = {
      id: amendmentRecordId,
      changeRequestId: changeRequest.id,
      versionBefore,
      versionAfter,
      title: changeRequest.title,
      reason: changeRequest.reason,
      summary: `Contract amended from Version ${versionBefore} to Version ${versionAfter}`,
      diff,
      requestedBy: changeRequest.requestedBy,
      requestedByName: changeRequest.requestedByName,
      approvedBy: userId,
      approvedByName: responderName,
      timestamp: now,
    };

    const updatedCR: ContractChangeRequest = {
      ...changeRequest,
      status: 'approved',
      approvedAt: now,
      respondedAt: now,
      respondedBy: userId,
      respondedByName: responderName,
      responseNote: responseNote?.trim() || 'Change request approved. Contract amended.',
      updatedAt: now,
    };

    const updatedCRs = [...(contract.changeRequests || [])];
    updatedCRs[crIndex] = updatedCR;

    const updatedContract: GigLinkContract = {
      ...contract,
      version: versionAfter,
      scopeLock: updatedScopeLock,
      originalScope: contract.originalScope || { ...contract.scopeLock },
      milestones: currentMilestones,
      changeRequests: updatedCRs,
      amendmentHistory: [...(contract.amendmentHistory || []), amendmentRecord],
      updatedAt: now,
    };

    await persistContract(updatedContract);
    return { contract: updatedContract, changeRequest: updatedCR, amendmentRecord };
  });
}

/**
 * Withdraws a pending Change Request.
 */
export async function withdrawChangeRequest(params: {
  contractId: string;
  changeRequestId: string;
  userId: string;
}): Promise<{ contract: GigLinkContract; changeRequest: ContractChangeRequest }> {
  const { contractId, changeRequestId, userId } = params;

  return runWithContractLock(contractId, async () => {
    const contract = await getContract(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found.`);
    }

    const check = canWithdrawChangeRequest(contract, changeRequestId, userId);
    if (!check.allowed) {
      throw new Error(check.reason || 'Cannot withdraw change request.');
    }

    const crIndex = (contract.changeRequests || []).findIndex((cr) => cr.id === changeRequestId);
    if (crIndex === -1) {
      throw new Error('Change request not found.');
    }

    const now = new Date().toISOString();
    const changeRequest = contract.changeRequests![crIndex];

    const updatedCR: ContractChangeRequest = {
      ...changeRequest,
      status: 'withdrawn',
      withdrawnAt: now,
      updatedAt: now,
    };

    const updatedCRs = [...(contract.changeRequests || [])];
    updatedCRs[crIndex] = updatedCR;

    const updatedContract: GigLinkContract = {
      ...contract,
      changeRequests: updatedCRs,
      updatedAt: now,
    };

    await persistContract(updatedContract);
    return { contract: updatedContract, changeRequest: updatedCR };
  });
}

/**
 * Returns the original immutable Version 1 contract scope
 */
export function getOriginalContractScope(contract: GigLinkContract): ContractScopeLock {
  return contract.originalScope || contract.scopeLock;
}
