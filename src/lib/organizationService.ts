import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { OrganizationProfile, Opportunity } from '../types';
import { handleFirestoreError, OperationType } from './firebaseErrors';

/**
 * Checks whether a given user has administrative rights to manage the organization profile.
 */
export function canUserManageOrganization(
  org: OrganizationProfile | null | undefined,
  userId: string | null | undefined
): boolean {
  if (!org || !userId) return false;
  
  // Check adminUserIds (standard schema)
  if (Array.isArray(org.adminUserIds) && org.adminUserIds.includes(userId)) {
    return true;
  }
  
  // Check fallback aliases for robustness
  const anyOrg = org as any;
  if (Array.isArray(anyOrg.adminUids) && anyOrg.adminUids.includes(userId)) {
    return true;
  }
  if (anyOrg.ownerUid === userId) {
    return true;
  }
  
  return false;
}

/**
 * Fetch an organization profile by ID
 */
export async function getOrganization(orgId: string): Promise<OrganizationProfile | null> {
  if (!orgId) return null;
  try {
    const orgRef = doc(db, 'organizations', orgId);
    const snap = await getDoc(orgRef);
    if (!snap.exists()) return null;
    return snap.data() as OrganizationProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `organizations/${orgId}`);
    return null;
  }
}

/**
 * Update an organization profile (Admin only)
 */
export async function updateOrganization(
  orgId: string,
  updates: Partial<Omit<OrganizationProfile, 'id' | 'createdAt' | 'adminUserIds'>>
): Promise<void> {
  if (!orgId) throw new Error('Organization ID is required.');
  try {
    const orgRef = doc(db, 'organizations', orgId);
    await updateDoc(orgRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `organizations/${orgId}`);
    throw err;
  }
}

/**
 * Fetch open opportunities posted by an organization
 */
export async function getOrganizationOpportunities(orgId: string): Promise<Opportunity[]> {
  if (!orgId) return [];
  try {
    const oppsRef = collection(db, 'opportunities');
    const q = query(
      oppsRef,
      where('organizationId', '==', orgId),
      where('status', '==', 'open')
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Opportunity[];
  } catch (err) {
    // Non-blocking fallback for opportunities query
    console.warn(`Could not load opportunities for organization ${orgId}:`, err);
    return [];
  }
}

/**
 * Fetch public profile previews for member user IDs
 */
export async function getOrganizationMembers(
  memberUserIds: string[]
): Promise<Array<{ uid: string; displayName: string; photoURL?: string; headline?: string }>> {
  if (!memberUserIds || memberUserIds.length === 0) return [];
  
  const members: Array<{ uid: string; displayName: string; photoURL?: string; headline?: string }> = [];
  
  // Fetch up to 10 member public records
  const targetIds = memberUserIds.slice(0, 10);
  for (const uid of targetIds) {
    try {
      const pubRef = doc(db, 'publicTrustPassports', uid);
      const snap = await getDoc(pubRef);
      if (snap.exists()) {
        const data = snap.data();
        members.push({
          uid,
          displayName: data.displayName || 'Member',
          photoURL: data.photoURL,
          headline: data.headline,
        });
      }
    } catch {
      // Ignore private or inaccessible member profiles
    }
  }
  
  return members;
}
