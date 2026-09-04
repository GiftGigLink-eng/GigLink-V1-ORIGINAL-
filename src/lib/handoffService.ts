import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Opportunity,
  OpportunityApplication,
  OpportunityMilestone,
  MilestoneStatus,
  MilestoneResponsibleParty,
  ApplicationHandoffData,
  GigLinkContract,
  ContractMilestone,
} from '../types';
import {
  createContractFromApplication,
  getContractByApplicationId,
  getCanonicalContractId,
  getContract,
  updateContractMilestone,
  addContractMilestone,
  deleteContractMilestone,
} from './contractService';

/**
 * Fetch an application by its document ID.
 */
export async function getApplicationById(applicationId: string): Promise<OpportunityApplication | null> {
  if (!applicationId) return null;
  try {
    const docRef = doc(db, 'applications', applicationId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    return snap.data() as OpportunityApplication;
  } catch (error) {
    console.error(`Error fetching application ${applicationId}:`, error);
    throw error;
  }
}

/**
 * Returns a standard initial set of milestone coordinates for kickstarting an accepted project.
 */
export function getDefaultKickoffMilestones(opportunityTitle?: string): OpportunityMilestone[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'm_kickoff_1',
      title: 'Project Kickoff & Requirements Alignment',
      description: `Initial sync between applicant and creator on objectives, tooling, and communication channels for ${
        opportunityTitle || 'the project'
      }.`,
      responsibleParty: 'collaborative',
      status: 'in_progress',
      createdAt: now,
      completedAt: null,
    },
    {
      id: 'm_deliverable_2',
      title: 'Core Deliverables Implementation',
      description: 'Execution of primary deliverables according to agreed scope and technical guidelines.',
      responsibleParty: 'applicant',
      status: 'pending',
      createdAt: now,
      completedAt: null,
    },
    {
      id: 'm_review_3',
      title: 'Review, QA & Acceptance Sign-off',
      description: 'Comprehensive review of work submitted, final feedback adjustments, and collaborative acceptance.',
      responsibleParty: 'creator',
      status: 'pending',
      createdAt: now,
      completedAt: null,
    },
  ];
}

export interface HandoffWorkspaceResult {
  success: boolean;
  handoffData?: ApplicationHandoffData;
  opportunity?: Opportunity;
  application?: OpportunityApplication;
  contract?: GigLinkContract;
  isApplicant?: boolean;
  isCreator?: boolean;
  error?: string;
  errorCode?: 'NOT_FOUND' | 'NOT_ACCEPTED' | 'UNAUTHORIZED' | 'UNKNOWN';
}

/**
 * Authoritative loader for Accepted Application Handoff Workspace & Contract Foundation.
 * Enforces:
 * 1. Application exists
 * 2. Application status === 'accepted'
 * 3. User is either applicant or creator/manager
 * 4. Contract initialization & authoritative milestone retrieval
 * 5. Contact privacy sanitization
 */
export async function getHandoffWorkspace(
  applicationId: string,
  currentUserId: string,
  userIsOrgAdmin = false
): Promise<HandoffWorkspaceResult> {
  if (!applicationId || !currentUserId) {
    return {
      success: false,
      error: 'Missing required parameters.',
      errorCode: 'UNAUTHORIZED',
    };
  }

  try {
    const application = await getApplicationById(applicationId);
    if (!application) {
      return {
        success: false,
        error: 'Application not found.',
        errorCode: 'NOT_FOUND',
      };
    }

    // 1. Authoritative status check: ONLY 'accepted' status allows handoff
    if (application.status !== 'accepted') {
      return {
        success: false,
        application,
        error: `Collaboration Handoff is only available for accepted applications. Current status is '${application.status}'.`,
        errorCode: 'NOT_ACCEPTED',
      };
    }

    // 2. Authorization check: Must be applicant or creator or authorized org admin
    const isApplicant = currentUserId === application.applicantId;
    const isCreator = currentUserId === application.opportunityCreatorId || userIsOrgAdmin;

    if (!isApplicant && !isCreator) {
      return {
        success: false,
        error: 'You are not authorized to view this collaboration handoff workspace.',
        errorCode: 'UNAUTHORIZED',
      };
    }

    // 3. Fetch opportunity details
    let opportunity: Opportunity | null = null;
    try {
      const oppRef = doc(db, 'opportunities', application.opportunityId);
      const oppSnap = await getDoc(oppRef);
      if (oppSnap.exists()) {
        opportunity = {
          id: oppSnap.id,
          ...(oppSnap.data() as Omit<Opportunity, 'id'>),
        };
      }
    } catch (err) {
      console.warn(`[HandoffService] Could not fetch opportunity ${application.opportunityId}:`, err);
    }

    // 4. Resolve or create authoritative first-class Contract
    let contract: GigLinkContract | null = null;
    try {
      contract = await getContractByApplicationId(application.id);
      if (!contract) {
        const canonicalId = getCanonicalContractId(application.opportunityId, application.applicantId);
        contract = await getContract(canonicalId);
      }

      // If no contract found, create one from the accepted application
      if (!contract && opportunity) {
        contract = await createContractFromApplication({
          application,
          opportunity,
          initiatorUserId: currentUserId,
          userIsOrgAdmin,
        });
      }
    } catch (contractErr) {
      console.warn('[HandoffService] Contract resolution notice:', contractErr);
    }

    // Map contract milestones into OpportunityMilestones for backward-compatible views
    let milestones: OpportunityMilestone[] = [];
    if (contract && contract.milestones && contract.milestones.length > 0) {
      milestones = contract.milestones.map((cm: ContractMilestone) => ({
        id: cm.id,
        title: cm.title,
        description: cm.description,
        responsibleParty: 'collaborative',
        status: cm.status,
        targetDate: cm.dueDate || null,
        createdAt: cm.createdAt,
        completedAt: cm.approvedAt || (cm.status === 'completed' ? cm.updatedAt : null),
      }));
    } else {
      milestones = getDefaultKickoffMilestones(opportunity?.title || application.opportunityTitle);
    }

    // 5. Construct privacy-sanitized handoff data
    const handoffData: ApplicationHandoffData = {
      applicationId: application.id,
      opportunityId: application.opportunityId,
      opportunityTitle: opportunity?.title || application.opportunityTitle,
      opportunityCreatorId: application.opportunityCreatorId,
      organizationId: application.organizationId || opportunity?.organizationId || null,
      applicantId: application.applicantId,
      applicantDisplayName: application.applicantDisplayName || 'Candidate',
      applicantEmail: application.applicantEmail,
      applicantTrustTier: application.applicantTrustTier,
      applicantTrustScore: application.applicantTrustScore,
      applicantIdentityVerified: application.applicantIdentityVerified,
      creatorName: opportunity?.creatorName || 'Opportunity Creator',
      status: 'accepted',
      acceptedAt: application.reviewedAt || application.updatedAt || new Date().toISOString(),
      proposedRate: application.proposedRate,
      proposedRateType: application.proposedRateType,
      availabilityDate: application.availabilityDate,
      coverNote: application.coverNote,
      creatorFeedback: application.creatorFeedback,
      kickoffNotes: opportunity?.kickoffNotes || undefined,
      contactChannels: {
        preferredMethod: 'Direct Message & Email',
        email: isApplicant ? undefined : application.applicantEmail,
      },
      milestones,
    };

    return {
      success: true,
      handoffData,
      opportunity: opportunity || undefined,
      application,
      contract: contract || undefined,
      isApplicant,
      isCreator,
    };
  } catch (error: any) {
    console.error('[HandoffService] Error loading handoff workspace:', error);
    return {
      success: false,
      error: error?.message || 'Failed to load handoff workspace.',
      errorCode: 'UNKNOWN',
    };
  }
}

/**
 * Updates the status of a milestone on the authoritative contract
 */
export async function setMilestoneStatus(
  opportunityId: string,
  milestoneId: string,
  newStatus: MilestoneStatus,
  currentMilestones: OpportunityMilestone[],
  existingOpp?: Opportunity,
  currentUserId?: string
): Promise<OpportunityMilestone[]> {
  const now = new Date().toISOString();
  
  // Update local representation
  const updated = currentMilestones.map((m) => {
    if (m.id === milestoneId) {
      return {
        ...m,
        status: newStatus,
        completedAt: newStatus === 'completed' ? now : null,
      };
    }
    return m;
  });

  // Try updating contract milestone if user context is available
  if (currentUserId) {
    try {
      const contract = await getContract(getCanonicalContractId(opportunityId, currentUserId));
      if (contract) {
        await updateContractMilestone(
          contract.id,
          milestoneId,
          currentUserId,
          {
            status: newStatus,
            reviewState: newStatus === 'completed' ? 'approved' : 'pending_submission',
          }
        );
      }
    } catch (err) {
      console.warn('[HandoffService] Contract milestone update notice:', err);
    }
  }

  return updated;
}

/**
 * Adds a new milestone to the authoritative contract
 */
export async function addMilestone(
  opportunityId: string,
  milestone: {
    title: string;
    description: string;
    responsibleParty: MilestoneResponsibleParty;
    targetDate?: string | null;
  },
  currentMilestones: OpportunityMilestone[],
  existingOpp?: Opportunity,
  currentUserId?: string
): Promise<OpportunityMilestone[]> {
  const now = new Date().toISOString();
  const newMilestone: OpportunityMilestone = {
    id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: milestone.title.trim(),
    description: milestone.description.trim(),
    responsibleParty: milestone.responsibleParty,
    status: 'pending',
    targetDate: milestone.targetDate || null,
    createdAt: now,
    completedAt: null,
  };

  if (currentUserId) {
    try {
      const contract = await getContract(getCanonicalContractId(opportunityId, currentUserId));
      if (contract) {
        await addContractMilestone(contract.id, currentUserId, {
          title: milestone.title,
          description: milestone.description,
          dueDate: milestone.targetDate || null,
        });
      }
    } catch (err) {
      console.warn('[HandoffService] Contract milestone addition notice:', err);
    }
  }

  return [...currentMilestones, newMilestone];
}

/**
 * Deletes a milestone by ID from the contract
 */
export async function deleteMilestone(
  opportunityId: string,
  milestoneId: string,
  currentMilestones: OpportunityMilestone[],
  existingOpp?: Opportunity,
  currentUserId?: string
): Promise<OpportunityMilestone[]> {
  const updated = currentMilestones.filter((m) => m.id !== milestoneId);

  if (currentUserId) {
    try {
      const contract = await getContract(getCanonicalContractId(opportunityId, currentUserId));
      if (contract) {
        await deleteContractMilestone(contract.id, milestoneId, currentUserId);
      }
    } catch (err) {
      console.warn('[HandoffService] Contract milestone deletion notice:', err);
    }
  }

  return updated;
}

const localCacheMap = new Map<string, OpportunityMilestone[]>();

// Local Storage cache helpers preserved for backwards-compatible test runner signatures
export function getLocalMilestones(opportunityId: string): OpportunityMilestone[] | null {
  if (!opportunityId) return null;
  if (localCacheMap.has(opportunityId)) {
    return localCacheMap.get(opportunityId)!;
  }
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : (typeof globalThis !== 'undefined' ? (globalThis as any).localStorage : null);
    if (!storage) return null;
    const raw = storage.getItem(`giglink_milestones_${opportunityId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    return null;
  }
}

export function saveLocalMilestones(opportunityId: string, milestones: OpportunityMilestone[]): void {
  if (!opportunityId) return;
  localCacheMap.set(opportunityId, milestones);
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : (typeof globalThis !== 'undefined' ? (globalThis as any).localStorage : null);
    if (!storage) return;
    storage.setItem(`giglink_milestones_${opportunityId}`, JSON.stringify(milestones));
  } catch (err) {
    // Silent fail
  }
}
