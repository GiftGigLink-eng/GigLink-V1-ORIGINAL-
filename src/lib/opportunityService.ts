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
import { Opportunity, OpportunityApplication, PublicTrustPassport } from '../types';

/**
 * In-memory authoritative caches for opportunity and application documents
 */
const opportunitiesStore = new Map<string, Opportunity>();
const applicationsStore = new Map<string, OpportunityApplication>();

export function clearOpportunityStore(): void {
  opportunitiesStore.clear();
  applicationsStore.clear();
}

export interface OpportunityFilterParams {
  category?: string;
  type?: string;
  locationType?: string;
  searchQuery?: string;
  trustTier?: string;
  minTrustScore?: number;
  budgetType?: string;
  maxBudget?: number;
  skills?: string[];
}

/**
 * Fetch all open/published opportunities for discovery.
 */
export async function getOpenOpportunities(filters?: OpportunityFilterParams): Promise<Opportunity[]> {
  try {
    const q = query(
      collection(db, 'opportunities'),
      where('status', 'in', ['open', 'published']),
      limit(100)
    );

    const snapshot = await getDocs(q);
    snapshot.docs.forEach((docSnap) => {
      const opp = { id: docSnap.id, ...(docSnap.data() as Omit<Opportunity, 'id'>) };
      opportunitiesStore.set(opp.id, opp);
    });
  } catch (error) {
    console.warn('[OpportunityService] Firestore getOpenOpportunities notice (using store fallback):', error);
  }

  let results: Opportunity[] = Array.from(opportunitiesStore.values()).filter(
    (opp) => opp.status === 'open' || opp.status === 'published'
  );

  // Sort by createdAt descending
  results.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  if (filters) {
    if (filters.category && filters.category !== 'all') {
      results = results.filter((opp) => opp.category.toLowerCase() === filters.category!.toLowerCase());
    }
    if (filters.type && filters.type !== 'all') {
      results = results.filter((opp) => opp.type === filters.type);
    }
    if (filters.locationType && filters.locationType !== 'all') {
      results = results.filter((opp) => opp.locationType === filters.locationType);
    }
    if (filters.budgetType && filters.budgetType !== 'all') {
      results = results.filter((opp) => opp.budgetType === filters.budgetType || opp.compensationType === filters.budgetType);
    }
    if (typeof filters.maxBudget === 'number' && filters.maxBudget > 0) {
      results = results.filter((opp) => {
        const cost = opp.compensationMax || opp.compensationMin || 0;
        return cost <= filters.maxBudget!;
      });
    }
    if (typeof filters.minTrustScore === 'number') {
      results = results.filter((opp) => (opp.minTrustScoreRequired || 0) <= filters.minTrustScore!);
    }
    if (filters.skills && filters.skills.length > 0) {
      const targetSkills = filters.skills.map((s) => s.toLowerCase().trim());
      results = results.filter((opp) =>
        opp.requiredSkills.some((sk) => targetSkills.includes(sk.toLowerCase().trim()))
      );
    }
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const queryLower = filters.searchQuery.toLowerCase().trim();
      results = results.filter(
        (opp) =>
          opp.title.toLowerCase().includes(queryLower) ||
          opp.description.toLowerCase().includes(queryLower) ||
          opp.requiredSkills.some((skill) => skill.toLowerCase().includes(queryLower)) ||
          (opp.locationString && opp.locationString.toLowerCase().includes(queryLower))
      );
    }
  }

  return results;
}

/**
 * Fetch a single opportunity by document ID.
 */
export async function getOpportunityById(oppId: string): Promise<Opportunity | null> {
  if (opportunitiesStore.has(oppId)) {
    return opportunitiesStore.get(oppId)!;
  }

  try {
    const docRef = doc(db, 'opportunities', oppId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    const opp = {
      id: snap.id,
      ...(snap.data() as Omit<Opportunity, 'id'>),
    };
    opportunitiesStore.set(opp.id, opp);
    return opp;
  } catch (error) {
    console.warn(`[OpportunityService] getOpportunityById notice for ${oppId}:`, error);
    return opportunitiesStore.get(oppId) || null;
  }
}

/**
 * Fetch opportunities created by the current user.
 */
export async function getMyPostedOpportunities(creatorId: string): Promise<Opportunity[]> {
  try {
    const q = query(
      collection(db, 'opportunities'),
      where('creatorId', '==', creatorId)
    );
    const snapshot = await getDocs(q);
    snapshot.docs.forEach((docSnap) => {
      const opp = { id: docSnap.id, ...(docSnap.data() as Omit<Opportunity, 'id'>) };
      opportunitiesStore.set(opp.id, opp);
    });
  } catch (error) {
    console.warn('[OpportunityService] getMyPostedOpportunities notice:', error);
  }

  const results = Array.from(opportunitiesStore.values())
    .filter((opp) => opp.creatorId === creatorId)
    .sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

  return results;
}

/**
 * Create a new opportunity listing with authoritative validations.
 */
export async function createOpportunity(
  data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (!data.title || data.title.trim().length < 3) {
    throw new Error('Opportunity title must be at least 3 characters.');
  }
  if (!data.description || data.description.trim().length < 10) {
    throw new Error('Opportunity description must be at least 10 characters.');
  }
  if (!data.creatorId) {
    throw new Error('Creator ID is required to publish an opportunity.');
  }

  const oppId = `opp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const oppDoc: Opportunity = {
    ...data,
    id: oppId,
    status: data.status || 'open',
    proposalsCount: 0,
    selectedProposalId: null,
    contractId: null,
    createdAt: now,
    updatedAt: now,
  };

  opportunitiesStore.set(oppId, oppDoc);

  try {
    const docRef = doc(db, 'opportunities', oppId);
    await setDoc(docRef, oppDoc);
  } catch (err) {
    console.warn('[OpportunityService] Firestore createOpportunity notice:', err);
  }

  return oppId;
}

/**
 * Update an existing opportunity listing.
 */
export async function updateOpportunity(
  oppId: string,
  existingOpp: Opportunity,
  updates: Partial<Omit<Opportunity, 'id' | 'creatorId' | 'createdAt'>>
): Promise<void> {
  const now = new Date().toISOString();

  const payload: Opportunity = {
    ...existingOpp,
    ...updates,
    updatedAt: now,
  };

  opportunitiesStore.set(oppId, payload);

  try {
    const docRef = doc(db, 'opportunities', oppId);
    await updateDoc(docRef, payload as any);
  } catch (err) {
    console.warn('[OpportunityService] Firestore updateOpportunity notice:', err);
  }
}

/**
 * Transition opportunity status to published.
 */
export async function publishOpportunity(
  oppId: string,
  creatorUserId: string,
  userIsOrgAdmin: boolean = false
): Promise<Opportunity> {
  const opp = await getOpportunityById(oppId);
  if (!opp) {
    throw new Error(`Opportunity '${oppId}' not found.`);
  }

  if (opp.creatorId !== creatorUserId && !userIsOrgAdmin) {
    throw new Error('Unauthorized: Only the creator or org admin can publish this opportunity.');
  }

  if (opp.status === 'in_progress' || opp.status === 'awarded' || opp.status === 'closed') {
    throw new Error(`Cannot publish opportunity: Current status is '${opp.status}'.`);
  }

  await updateOpportunity(oppId, opp, { status: 'open' });
  return (await getOpportunityById(oppId))!;
}

/**
 * Transition opportunity status to closed.
 */
export async function closeOpportunity(
  oppId: string,
  creatorUserId: string,
  userIsOrgAdmin: boolean = false
): Promise<Opportunity> {
  const opp = await getOpportunityById(oppId);
  if (!opp) {
    throw new Error(`Opportunity '${oppId}' not found.`);
  }

  if (opp.creatorId !== creatorUserId && !userIsOrgAdmin) {
    throw new Error('Unauthorized: Only the creator or org admin can close this opportunity.');
  }

  await updateOpportunity(oppId, opp, { status: 'closed' });
  return (await getOpportunityById(oppId))!;
}

/**
 * Transition opportunity status to cancelled.
 */
export async function cancelOpportunity(
  oppId: string,
  creatorUserId: string,
  userIsOrgAdmin: boolean = false
): Promise<Opportunity> {
  const opp = await getOpportunityById(oppId);
  if (!opp) {
    throw new Error(`Opportunity '${oppId}' not found.`);
  }

  if (opp.creatorId !== creatorUserId && !userIsOrgAdmin) {
    throw new Error('Unauthorized: Only the creator or org admin can cancel this opportunity.');
  }

  if (opp.status === 'in_progress' || opp.status === 'awarded') {
    throw new Error('Cannot cancel opportunity: An awarded contract is already in progress.');
  }

  await updateOpportunity(oppId, opp, { status: 'cancelled' });
  return (await getOpportunityById(oppId))!;
}

/**
 * Submit an application to an opportunity using deterministic ID `${opportunityId}_${applicantId}`.
 */
export async function submitOpportunityApplication(params: {
  opportunity: Opportunity;
  applicantId: string;
  applicantDisplayName: string;
  applicantEmail: string;
  publicPassport?: PublicTrustPassport | null;
  coverNote: string;
  proposedRate?: number | null;
  proposedRateType?: string;
  availabilityDate?: string | null;
  portfolioLinks?: string[];
  screeningAnswers?: Record<string, string>;
}): Promise<string> {
  const {
    opportunity,
    applicantId,
    applicantDisplayName,
    applicantEmail,
    publicPassport,
    coverNote,
    proposedRate,
    proposedRateType,
    availabilityDate,
    portfolioLinks,
    screeningAnswers,
  } = params;

  if (opportunity.creatorId === applicantId) {
    throw new Error('Unauthorized: Opportunity creator cannot apply to their own opportunity.');
  }

  const appId = `${opportunity.id}_${applicantId}`;
  const now = new Date().toISOString();

  const applicationDoc: OpportunityApplication = {
    id: appId,
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    opportunityCreatorId: opportunity.creatorId,
    organizationId: opportunity.organizationId || null,
    applicantId,
    applicantDisplayName: applicantDisplayName || 'Applicant',
    applicantEmail: applicantEmail || '',
    applicantTrustTier: publicPassport?.trustTier || 'Unverified',
    applicantTrustScore: publicPassport?.trustScore || 0,
    applicantIdentityVerified: publicPassport?.identityVerified || false,
    coverNote,
    proposedRate: proposedRate || null,
    proposedRateType: proposedRateType || 'fixed',
    availabilityDate: availabilityDate || null,
    portfolioLinks: portfolioLinks || [],
    screeningAnswers: screeningAnswers || {},
    status: 'submitted',
    creatorFeedback: null,
    submittedAt: now,
    reviewedAt: null,
    updatedAt: now,
  };

  applicationsStore.set(appId, applicationDoc);

  try {
    const docRef = doc(db, 'applications', appId);
    await setDoc(docRef, applicationDoc);
  } catch (err) {
    console.warn('[OpportunityService] Firestore submitOpportunityApplication notice:', err);
  }

  return appId;
}

/**
 * Fetch a single application by its document ID.
 */
export async function getApplicationById(applicationId: string): Promise<OpportunityApplication | null> {
  if (applicationsStore.has(applicationId)) {
    return applicationsStore.get(applicationId)!;
  }

  try {
    const docRef = doc(db, 'applications', applicationId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    const app = snap.data() as OpportunityApplication;
    applicationsStore.set(app.id, app);
    return app;
  } catch (error) {
    console.warn(`[OpportunityService] getApplicationById notice for ${applicationId}:`, error);
    return applicationsStore.get(applicationId) || null;
  }
}

/**
 * Check if the user has already submitted an application to a specific opportunity.
 */
export async function getExistingApplication(
  opportunityId: string,
  applicantId: string
): Promise<OpportunityApplication | null> {
  const appId = `${opportunityId}_${applicantId}`;
  if (applicationsStore.has(appId)) {
    return applicationsStore.get(appId)!;
  }

  try {
    const docRef = doc(db, 'applications', appId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    const app = snap.data() as OpportunityApplication;
    applicationsStore.set(app.id, app);
    return app;
  } catch {
    return applicationsStore.get(appId) || null;
  }
}

/**
 * Fetch all applications submitted to a specific opportunity.
 */
export async function getApplicationsForOpportunity(
  opportunityId: string,
  creatorId?: string
): Promise<OpportunityApplication[]> {
  try {
    const currentUid = creatorId || auth.currentUser?.uid;
    let q;
    if (currentUid) {
      q = query(
        collection(db, 'applications'),
        where('opportunityId', '==', opportunityId),
        where('opportunityCreatorId', '==', currentUid)
      );
    } else {
      q = query(
        collection(db, 'applications'),
        where('opportunityId', '==', opportunityId)
      );
    }
    const snapshot = await getDocs(q);
    snapshot.docs.forEach((docSnap) => {
      const app = docSnap.data() as OpportunityApplication;
      applicationsStore.set(app.id, app);
    });
  } catch (error) {
    console.warn(`[OpportunityService] getApplicationsForOpportunity notice:`, error);
  }

  const results = Array.from(applicationsStore.values())
    .filter((a) => a.opportunityId === opportunityId)
    .sort((a, b) => {
      const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return timeB - timeA;
    });

  return results;
}

/**
 * Fetch all applications submitted by the current applicant.
 */
export async function getMyApplications(applicantId: string): Promise<OpportunityApplication[]> {
  try {
    const q = query(
      collection(db, 'applications'),
      where('applicantId', '==', applicantId)
    );
    const snapshot = await getDocs(q);
    snapshot.docs.forEach((docSnap) => {
      const app = docSnap.data() as OpportunityApplication;
      applicationsStore.set(app.id, app);
    });
  } catch (error) {
    console.warn(`[OpportunityService] getMyApplications notice:`, error);
  }

  const results = Array.from(applicationsStore.values())
    .filter((a) => a.applicantId === applicantId)
    .sort((a, b) => {
      const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return timeB - timeA;
    });

  return results;
}

/**
 * Update application review status and feedback.
 */
export async function reviewApplication(
  existingApp: OpportunityApplication,
  newStatus: 'under_review' | 'shortlisted' | 'accepted' | 'declined',
  feedback?: string
): Promise<void> {
  const now = new Date().toISOString();
  const updated: OpportunityApplication = {
    ...existingApp,
    status: newStatus,
    creatorFeedback: feedback || existingApp.creatorFeedback || null,
    reviewedAt: now,
    updatedAt: now,
  };

  applicationsStore.set(existingApp.id, updated);

  try {
    const docRef = doc(db, 'applications', existingApp.id);
    await updateDoc(docRef, {
      status: newStatus,
      creatorFeedback: feedback || existingApp.creatorFeedback || null,
      reviewedAt: now,
      updatedAt: now,
    });
  } catch (err) {
    console.warn('[OpportunityService] reviewApplication notice:', err);
  }
}

/**
 * Withdraw an application.
 */
export async function withdrawApplication(existingApp: OpportunityApplication): Promise<void> {
  const now = new Date().toISOString();
  const updated: OpportunityApplication = {
    ...existingApp,
    status: 'withdrawn',
    updatedAt: now,
  };

  applicationsStore.set(existingApp.id, updated);

  try {
    const docRef = doc(db, 'applications', existingApp.id);
    await updateDoc(docRef, {
      status: 'withdrawn',
      updatedAt: now,
    });
  } catch (err) {
    console.warn('[OpportunityService] withdrawApplication notice:', err);
  }
}
