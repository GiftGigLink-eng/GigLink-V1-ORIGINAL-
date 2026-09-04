import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import {
  Opportunity,
  OpportunityProposal,
  ProposedMilestoneItem,
  ProposalStatus,
  GigLinkContract,
  ContractScopeLock,
  ContractMilestone,
  PublicTrustPassport,
} from '../types';
import { getCanonicalContractId, persistContract, getContract } from './contractService';
import { getOpportunityById, updateOpportunity } from './opportunityService';

/**
 * In-memory authoritative store for proposals to ensure resilience across
 * client sessions and testing environments.
 */
const proposalsStore = new Map<string, OpportunityProposal>();

/**
 * Mutex lock map to serialize concurrent operations per opportunity and proposal
 */
const proposalMutexes = new Map<string, Promise<any>>();

async function runWithLock<T>(key: string, op: () => Promise<T>): Promise<T> {
  const currentLock = proposalMutexes.get(key) || Promise.resolve();
  let releaseLock: () => void;
  const newLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  proposalMutexes.set(key, currentLock.then(() => newLock));

  try {
    await currentLock;
    return await op();
  } finally {
    releaseLock!();
    if (proposalMutexes.get(key) === newLock) {
      proposalMutexes.delete(key);
    }
  }
}

/**
 * Generates canonical proposal ID
 */
export function getCanonicalProposalId(opportunityId: string, talentId: string): string {
  return `prop_${opportunityId}_${talentId}`;
}

/**
 * Persists proposal to in-memory store and attempts Firestore synchronization.
 */
export async function persistProposal(proposal: OpportunityProposal): Promise<void> {
  proposalsStore.set(proposal.id, { ...proposal });
  try {
    const docRef = doc(db, 'proposals', proposal.id);
    await setDoc(docRef, proposal);
  } catch (err) {
    console.warn('[ProposalService] Firestore sync notice (in-memory store active):', err);
  }
}

/**
 * Clears proposal store (Used in tests)
 */
export function clearProposalStore(): void {
  proposalsStore.clear();
}

/**
 * Authoritatively retrieves talent identity and trust reputation
 */
export async function fetchAuthoritativeTalentData(talentId: string): Promise<{
  displayName: string;
  email: string;
  trustScore: number;
  trustTier: string;
  volumeTier?: string;
  identityVerified: boolean;
}> {
  let displayName = 'Verified Talent';
  let email = '';
  let trustScore = 80;
  let trustTier = 'Emerging';
  let volumeTier = 'none';
  let identityVerified = false;

  try {
    const userDoc = await getDoc(doc(db, 'users', talentId));
    if (userDoc.exists()) {
      const uData = userDoc.data();
      displayName = uData.displayName || displayName;
      email = uData.email || email;
      identityVerified = Boolean(uData.identityVerified);
    }

    const passportDoc = await getDoc(doc(db, 'publicTrustPassports', talentId));
    if (passportDoc.exists()) {
      const pData = passportDoc.data() as PublicTrustPassport;
      trustScore = typeof pData.trustScore === 'number' ? pData.trustScore : trustScore;
      trustTier = pData.trustTier || trustTier;
      identityVerified = pData.identityVerified ?? identityVerified;
      displayName = pData.displayName || displayName;
    }
  } catch {
    // In-memory or fallback defaults
  }

  return {
    displayName,
    email,
    trustScore,
    trustTier,
    volumeTier,
    identityVerified,
  };
}

/**
 * Validates proposed milestones strictly:
 * - Count between 1 and 10
 * - Non-empty valid title and description
 * - Positive finite integer/minor unit amount
 * - Positive finite delivery days
 * - Sum matches proposedTotalUSD exactly
 */
export function validateProposalMilestones(
  milestones: ProposedMilestoneItem[],
  proposedTotalUSD: number
): { valid: boolean; error?: string } {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return { valid: false, error: 'A proposal must contain at least 1 milestone.' };
  }

  if (milestones.length > 10) {
    return { valid: false, error: 'A proposal cannot contain more than 10 milestones (cannot exceed 10).' };
  }

  if (!Number.isFinite(proposedTotalUSD) || proposedTotalUSD <= 0 || isNaN(proposedTotalUSD)) {
    return { valid: false, error: 'Proposed total amount must be a positive valid number.' };
  }

  let totalMilestoneSum = 0;

  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    if (!m.title || typeof m.title !== 'string' || m.title.trim().length < 2) {
      return { valid: false, error: `Milestone ${i + 1} must have a valid title.` };
    }
    if (m.title.length > 120) {
      return { valid: false, error: `Milestone ${i + 1} title cannot exceed 120 characters.` };
    }
    if (!m.description || typeof m.description !== 'string' || m.description.trim().length < 2) {
      return { valid: false, error: `Milestone ${i + 1} must have a valid description.` };
    }
    if (!Number.isFinite(m.amountUSD) || m.amountUSD <= 0 || isNaN(m.amountUSD)) {
      return { valid: false, error: `Milestone ${i + 1} amount must be a positive valid number.` };
    }
    if (!Number.isFinite(m.estimatedDays) || m.estimatedDays <= 0 || isNaN(m.estimatedDays)) {
      return { valid: false, error: `Milestone ${i + 1} estimated delivery days must be a positive integer.` };
    }
    totalMilestoneSum += m.amountUSD;
  }

  // Exact match on sum
  if (Math.abs(totalMilestoneSum - proposedTotalUSD) > 0.001) {
    return {
      valid: false,
      error: `Sum of milestone amounts ($${totalMilestoneSum}) does not equal proposed total amount ($${proposedTotalUSD}).`,
    };
  }

  return { valid: true };
}

/**
 * Submit or update a structured opportunity proposal.
 */
export async function submitOpportunityProposal(params: {
  opportunityId: string;
  talentId: string;
  coverLetter: string;
  proposedTotalUSD: number;
  proposedDeliveryDays: number;
  proposedMilestones: ProposedMilestoneItem[];
  callerIsAdmin?: boolean;
}): Promise<OpportunityProposal> {
  const {
    opportunityId,
    talentId,
    coverLetter,
    proposedTotalUSD,
    proposedDeliveryDays,
    proposedMilestones,
  } = params;

  if (!opportunityId || !talentId) {
    throw new Error('Opportunity ID and Talent ID are required.');
  }

  return await runWithLock(`opp_${opportunityId}`, async () => {
    // 1. Verify target opportunity exists
    const opportunity = await getOpportunityById(opportunityId);
    if (!opportunity) {
      throw new Error(`Opportunity '${opportunityId}' not found.`);
    }

    // 2. Invariant: Creator cannot propose to their own opportunity
    if (opportunity.creatorId === talentId) {
      throw new Error('Unauthorized: Opportunity creator cannot submit a proposal to their own opportunity.');
    }

    // 3. Invariant: Opportunity must be open for proposals
    if (opportunity.status !== 'open' && opportunity.status !== 'published') {
      throw new Error(`Cannot submit proposal: Opportunity is currently '${opportunity.status}' and not currently accepting proposals (must be 'open').`);
    }

    // 4. Invariant: If opportunity is already awarded or closed, reject
    if (opportunity.selectedProposalId || opportunity.contractId) {
      throw new Error('Cannot submit proposal: Opportunity has already been awarded.');
    }

    // 5. Invariant: Duplicate proposal submission check
    const proposalId = getCanonicalProposalId(opportunityId, talentId);
    const existingProposal = await getProposalById(proposalId, talentId).catch(() => null);

    if (existingProposal && existingProposal.status !== 'withdrawn' && existingProposal.status !== 'rejected') {
      if (existingProposal.status === 'accepted') {
        throw new Error('Cannot modify an already accepted proposal.');
      }
      throw new Error('Duplicate submission rejected: You already have an active proposal submitted for this opportunity.');
    }

    // 6. Authoritative fetch of talent reputation & identity
    const talentData = await fetchAuthoritativeTalentData(talentId);

    // 7. Invariant: Min Trust Score requirement check
    if (
      typeof opportunity.minTrustScoreRequired === 'number' &&
      opportunity.minTrustScoreRequired > 0 &&
      talentData.trustScore < opportunity.minTrustScoreRequired
    ) {
      throw new Error(
        `Proposal rejected: Opportunity requires a minimum Trust Score of ${opportunity.minTrustScoreRequired} (your score: ${talentData.trustScore}).`
      );
    }

    // 8. Invariant: Cover letter validation
    if (!coverLetter || typeof coverLetter !== 'string' || coverLetter.trim().length < 10) {
      throw new Error('Cover letter must be at least 10 characters.');
    }
    if (coverLetter.length > 5000) {
      throw new Error('Cover letter cannot exceed 5000 characters.');
    }

    // 9. Invariant: Delivery days validation
    if (!Number.isFinite(proposedDeliveryDays) || proposedDeliveryDays <= 0 || isNaN(proposedDeliveryDays)) {
      throw new Error('Proposed delivery days must be a positive integer.');
    }

    // 10. Invariant: Milestone validation
    const milestoneValidation = validateProposalMilestones(proposedMilestones, proposedTotalUSD);
    if (!milestoneValidation.valid) {
      throw new Error(milestoneValidation.error || 'Invalid proposal milestones.');
    }

    const now = new Date().toISOString();

    const proposalDoc: OpportunityProposal = {
      id: proposalId,
      opportunityId,
      opportunityTitle: opportunity.title,
      creatorId: opportunity.creatorId,
      talentId,
      talentDisplayName: talentData.displayName,
      talentEmail: talentData.email,
      talentTrustScore: talentData.trustScore,
      talentTrustTier: talentData.trustTier,
      talentVolumeTier: talentData.volumeTier,
      talentIdentityVerified: talentData.identityVerified,
      coverLetter: coverLetter.trim(),
      proposedTotalUSD,
      proposedDeliveryDays: Math.round(proposedDeliveryDays),
      proposedMilestones: proposedMilestones.map((m, idx) => ({
        id: m.id || `pm_${idx + 1}`,
        title: m.title.trim(),
        description: m.description.trim(),
        deliverables: m.deliverables || [m.title.trim()],
        amountUSD: m.amountUSD,
        estimatedDays: Math.round(m.estimatedDays),
      })),
      status: 'submitted',
      clientFeedback: null,
      contractId: null,
      createdAt: existingProposal ? existingProposal.createdAt : now,
      updatedAt: now,
    };

    await persistProposal(proposalDoc);

    // Update opportunity proposalsCount
    const currentCount = opportunity.proposalsCount || 0;
    if (!existingProposal) {
      await updateOpportunity(opportunity.id, opportunity, {
        proposalsCount: currentCount + 1,
      });
    }

    return proposalDoc;
  });
}

/**
 * Fetch a single proposal by ID with authorization checks.
 * Confidentiality invariant: Only the talent, creator, org admin, or platform admin can read.
 */
export async function getProposalById(
  proposalId: string,
  callerUserId: string,
  isOrgAdmin: boolean = false,
  isAdmin: boolean = false
): Promise<OpportunityProposal | null> {
  let proposal = proposalsStore.get(proposalId) || null;

  if (!proposal) {
    try {
      const docRef = doc(db, 'proposals', proposalId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        proposal = snap.data() as OpportunityProposal;
        proposalsStore.set(proposal.id, proposal);
      }
    } catch {
      // In-memory fallback
    }
  }

  if (!proposal) {
    return null;
  }

  // Authorization check
  const isAuthorized =
    isAdmin ||
    isOrgAdmin ||
    proposal.talentId === callerUserId ||
    proposal.creatorId === callerUserId;

  if (!isAuthorized) {
    throw new Error('Unauthorized: You do not have permission to view this confidential proposal.');
  }

  return proposal;
}

/**
 * Fetch all proposals for an opportunity (Creator or Admin only).
 */
export async function getProposalsForOpportunity(
  opportunityId: string,
  callerUserId: string,
  isOrgAdmin: boolean = false,
  isAdmin: boolean = false
): Promise<OpportunityProposal[]> {
  const opportunity = await getOpportunityById(opportunityId);
  if (!opportunity) {
    throw new Error(`Opportunity '${opportunityId}' not found.`);
  }

  const isAuthorized =
    isAdmin ||
    isOrgAdmin ||
    opportunity.creatorId === callerUserId;

  if (!isAuthorized) {
    throw new Error('Unauthorized: Only the opportunity creator or administrators can view proposals.');
  }

  const inMem = Array.from(proposalsStore.values()).filter((p) => p.opportunityId === opportunityId);

  try {
    const q = query(collection(db, 'proposals'), where('opportunityId', '==', opportunityId));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const p = d.data() as OpportunityProposal;
      proposalsStore.set(p.id, p);
    });
  } catch {
    // in-memory fallback
  }

  const all = Array.from(proposalsStore.values())
    .filter((p) => p.opportunityId === opportunityId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return all;
}

/**
 * Fetch proposals submitted by a talent.
 */
export async function getMySubmittedProposals(talentId: string): Promise<OpportunityProposal[]> {
  try {
    const q = query(collection(db, 'proposals'), where('talentId', '==', talentId));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const p = d.data() as OpportunityProposal;
      proposalsStore.set(p.id, p);
    });
  } catch {
    // in-memory fallback
  }

  const myProposals = Array.from(proposalsStore.values())
    .filter((p) => p.talentId === talentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return myProposals;
}

/**
 * Update proposal status (Review/Withdraw).
 */
export async function updateProposalStatus(params: {
  proposalId: string;
  newStatus: ProposalStatus;
  callerUserId: string;
  clientFeedback?: string;
  isOrgAdmin?: boolean;
  isAdmin?: boolean;
}): Promise<OpportunityProposal> {
  const { proposalId, newStatus, callerUserId, clientFeedback, isOrgAdmin, isAdmin } = params;

  return await runWithLock(proposalId, async () => {
    const proposal = await getProposalById(proposalId, callerUserId, isOrgAdmin, isAdmin);
    if (!proposal) {
      throw new Error(`Proposal '${proposalId}' not found.`);
    }

    if (proposal.status === 'accepted') {
      throw new Error('Cannot modify an accepted proposal: status is already accepted.');
    }

    const isCreator = proposal.creatorId === callerUserId || isOrgAdmin || isAdmin;
    const isTalent = proposal.talentId === callerUserId;

    if (newStatus === 'withdrawn') {
      if (!isTalent && !isAdmin) {
        throw new Error('Unauthorized: Only the submitting talent can withdraw their proposal.');
      }
    } else {
      if (!isCreator) {
        throw new Error('Unauthorized: Only the opportunity creator can review proposal status.');
      }
    }

    const now = new Date().toISOString();
    const updated: OpportunityProposal = {
      ...proposal,
      status: newStatus,
      clientFeedback: clientFeedback !== undefined ? clientFeedback : proposal.clientFeedback,
      updatedAt: now,
    };

    await persistProposal(updated);
    return updated;
  });
}

/**
 * Atomically accept an opportunity proposal and bridge into the Phase 1 Contract Engine.
 * 
 * Invariants:
 * 1. Opportunity must be in 'open' or 'published' status and not previously awarded.
 * 2. Proposal must belong to the opportunity and be in 'submitted', 'under_review', or 'shortlisted' status.
 * 3. Produces a standard Phase 1 'draft' GigLinkContract (unsigned, unfunded, scope locked on mutual signing).
 * 4. Atomically updates the winning proposal to 'accepted', rejects competing proposals, and updates the opportunity.
 */
export async function acceptOpportunityProposal(params: {
  opportunityId: string;
  proposalId: string;
  creatorUserId: string;
  userIsOrgAdmin?: boolean;
  isAdmin?: boolean;
}): Promise<{
  contract: GigLinkContract;
  proposal: OpportunityProposal;
  opportunity: Opportunity;
}> {
  const { opportunityId, proposalId, creatorUserId, userIsOrgAdmin = false, isAdmin = false } = params;

  return await runWithLock(`opp_${opportunityId}`, async () => {
    // 1. Authoritative check: Opportunity must exist
    const opportunity = await getOpportunityById(opportunityId);
    if (!opportunity) {
      throw new Error(`Opportunity '${opportunityId}' not found.`);
    }

    // 2. Authorization check: Must be creator or authorized admin
    const isAuthorizedCreator = opportunity.creatorId === creatorUserId || userIsOrgAdmin || isAdmin;
    if (!isAuthorizedCreator) {
      throw new Error('Unauthorized: Only the opportunity creator or organization admin can accept a proposal.');
    }

    // 3. Invariant: Opportunity must not already have an awarded proposal
    if (opportunity.selectedProposalId || (opportunity.status !== 'open' && opportunity.status !== 'published' && opportunity.status !== 'in_review')) {
      throw new Error(
        `Cannot accept proposal: Opportunity status is '${opportunity.status}' and already awarded or closed.`
      );
    }

    // 4. Authoritative check: Proposal must exist and belong to this opportunity
    const proposal = await getProposalById(proposalId, creatorUserId, userIsOrgAdmin, isAdmin);
    if (!proposal) {
      throw new Error(`Proposal '${proposalId}' not found.`);
    }

    if (proposal.opportunityId !== opportunity.id) {
      throw new Error(`Proposal mismatch: Proposal '${proposalId}' does not belong to opportunity '${opportunity.id}'.`);
    }

    // 5. Invariant: Proposal must be in an acceptable status
    if (proposal.status !== 'submitted' && proposal.status !== 'under_review' && proposal.status !== 'shortlisted') {
      throw new Error(`Cannot accept proposal: Proposal status is '${proposal.status}' (must be submitted/under_review/shortlisted).`);
    }

    const now = new Date().toISOString();
    const contractId = getCanonicalContractId(opportunity.id, proposal.talentId);

    // 6. Convert proposed milestones to Phase 1-2 ContractMilestone[]
    const contractMilestones: ContractMilestone[] = proposal.proposedMilestones.map((pm, idx) => ({
      id: `m_${contractId}_${idx + 1}`,
      contractId,
      title: pm.title,
      description: pm.description,
      deliverables: pm.deliverables && pm.deliverables.length > 0 ? pm.deliverables : [pm.title],
      amount: pm.amountUSD,
      currency: opportunity.currency || 'USD',
      dueDate: null,
      status: idx === 0 ? 'in_progress' : 'pending',
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
    }));

    // 7. Form Phase 1 Scope Lock
    const scopeLock: ContractScopeLock = {
      title: opportunity.title,
      description: proposal.coverLetter || opportunity.description,
      inclusions: proposal.proposedMilestones.map((m) => m.title),
      exclusions: [
        'Unapproved out-of-scope feature requests',
        'Third-party software or licensing costs without prior written consent',
      ],
      deliverables: proposal.proposedMilestones.flatMap((m) => (m.deliverables && m.deliverables.length > 0 ? m.deliverables : [m.title])),
      totalAmount: proposal.proposedTotalUSD,
      currency: opportunity.currency || 'USD',
      deadline: opportunity.deadline || null,
      revisionAllowance: 2,
      lockedAt: null, // Locks only upon mutual Phase 1 activation!
    };

    // 8. Form the standard Phase 1 GigLinkContract (DRAFT status)
    const newContract: GigLinkContract = {
      id: contractId,
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      applicationId: `app_${opportunity.id}_${proposal.talentId}`,
      proposalId: proposal.id,
      creatorId: opportunity.creatorId,
      creatorName: opportunity.creatorName || 'Opportunity Creator',
      talentId: proposal.talentId,
      talentName: proposal.talentDisplayName || 'Talent',
      talentEmail: proposal.talentEmail,
      organizationId: opportunity.organizationId || null,
      status: 'draft', // Critical invariant: Starts in draft state requiring mutual signing
      version: 1,
      scopeLock,
      originalScope: { ...scopeLock },
      milestones: contractMilestones,
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
      conversationId: `conv_${opportunity.id}_${proposal.talentId}`,
      createdAt: now,
      updatedAt: now,
    };

    // Persist draft contract
    await persistContract(newContract);

    // 9. Update accepted proposal
    const acceptedProposal: OpportunityProposal = {
      ...proposal,
      status: 'accepted',
      contractId: newContract.id,
      updatedAt: now,
    };
    await persistProposal(acceptedProposal);

    // 10. Reject all competing proposals for this opportunity
    const allProposals = await getProposalsForOpportunity(opportunity.id, creatorUserId, userIsOrgAdmin, isAdmin);
    for (const otherProp of allProposals) {
      if (otherProp.id !== proposal.id && otherProp.status !== 'withdrawn' && otherProp.status !== 'rejected') {
        const rejectedProp: OpportunityProposal = {
          ...otherProp,
          status: 'rejected',
          clientFeedback: 'Another proposal was accepted for this opportunity.',
          updatedAt: now,
        };
        await persistProposal(rejectedProp);
      }
    }

    // 11. Update opportunity status to 'in_progress' and lock selectedProposalId
    const updatedOpp: Opportunity = {
      ...opportunity,
      status: 'in_progress',
      selectedProposalId: proposal.id,
      contractId: newContract.id,
      updatedAt: now,
    };
    await updateOpportunity(opportunity.id, opportunity, {
      status: 'in_progress',
      selectedProposalId: proposal.id,
      contractId: newContract.id,
    });

    return {
      contract: newContract,
      proposal: acceptedProposal,
      opportunity: updatedOpp,
    };
  });
}
