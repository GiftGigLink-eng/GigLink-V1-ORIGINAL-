/**
 * Server-Authoritative Trust Score & Projection Synchronization Service
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Strictly server-side execution (Node.js runtime).
 * 2. Uses Firebase Admin SDK (`adminDb`) with Application Default Credentials (ADC)
 *    to read authoritative documents and write to `publicTrustPassports/{uid}`.
 * 3. Prevents client-side forging or tampering of `trustScore`, `trustTier`,
 *    `identityVerified`, or project verification stamps.
 * 4. Implements the canonical trust score calculation from `src/lib/trustScore.ts`
 *    and sanitization from `src/lib/profileService.ts`.
 */

import { getAdminFirestore } from './firebaseAdmin';
import { calculateTrustScore } from '../lib/trustScore';
import { sanitizePublicPassportProjection } from '../lib/profileService';
import { TrustPassport, UserProfile, PublicTrustPassport, SkillItem, ProjectProof } from '../types';

export interface ServerTrustSyncResult {
  success: boolean;
  isPublic: boolean;
  trustScore: number;
  trustTier: string;
  projection?: PublicTrustPassport;
  message: string;
}

export interface TrustedVerificationContext {
  verifiedKyc?: boolean;
  verifiedProjectIds?: string[];
  verifiedSkillNames?: string[];
}

/**
 * Validates and sanitizes raw passport inputs before calculating authoritative trust score.
 * Neutralizes any client-poisoned verification claims that lack backing proof records.
 */
export function validateAuthoritativePassportInputs(
  passport: TrustPassport,
  context: TrustedVerificationContext = {}
): TrustPassport {
  const verifiedProjSet = new Set(
    (context.verifiedProjectIds || []).map((id) => id.trim().toLowerCase())
  );
  const verifiedSkillSet = new Set(
    (context.verifiedSkillNames || []).map((s) => s.trim().toLowerCase())
  );

  // 1. Identity Verified: Requires approved KYC document evidence in trusted context
  const isKycVerified = context.verifiedKyc === true;

  // 2. Project Proofs: Only award verified status if backed by trusted proofs, credentials, or review records
  const sanitizedProjects: ProjectProof[] = (passport.projects || []).map((p) => {
    const isExplicitlyVerified =
      verifiedProjSet.has(p.id.toLowerCase()) ||
      verifiedProjSet.has(`proof_${p.id.toLowerCase()}`) ||
      (p.title && verifiedProjSet.has(p.title.trim().toLowerCase())) ||
      (p.verificationHash && verifiedProjSet.has(p.verificationHash.toLowerCase()));

    if (isExplicitlyVerified) {
      return {
        ...p,
        verificationStatus: 'verified' as const,
        verifierUid: p.verifierUid || 'platform_verifier',
      };
    }

    // Demote unbacked/self-claimed project verification
    return {
      ...p,
      verificationStatus: (p.verificationStatus === 'pending' ? 'pending' : 'unverified') as any,
      verifierUid: undefined,
      verifierName: undefined,
      verifiedAt: undefined,
    };
  });

  // 3. Skills: Only award verifiedCount > 0 if backed by claimed credentials, proofs, or verifications
  const sanitizedSkills: SkillItem[] = (passport.skills || []).map((s) => {
    const isBackedTested = verifiedSkillSet.has(s.name.trim().toLowerCase());
    if (isBackedTested) {
      return {
        ...s,
        verifiedCount: Math.max(1, s.verifiedCount || 1),
        verified: true,
      };
    }

    // Strip unearned verification metrics
    return {
      ...s,
      verifiedCount: 0,
      verified: false,
    };
  });

  // 4. Metrics: Always recalculate based strictly on sanitized/verified items
  const completedProjectsCount = sanitizedProjects.filter(
    (p) => p.verificationStatus === 'verified'
  ).length;
  const verifiedSkillsCount = sanitizedSkills.filter(
    (s) => (s.verifiedCount && s.verifiedCount > 0) || s.verified === true
  ).length;

  return {
    ...passport,
    identityVerified: isKycVerified,
    projects: sanitizedProjects,
    skills: sanitizedSkills,
    metrics: {
      ...(passport.metrics || {
        verificationScore: 0,
        completedProjectsCount: 0,
        verifiedSkillsCount: 0,
        endorsementsCount: 0,
        activeStreakDays: 1,
      }),
      completedProjectsCount,
      verifiedSkillsCount,
    },
  };
}

/**
 * Recomputes and authoritatively synchronizes a user's Public Trust Passport projection.
 *
 * @param uid - The target user's Firebase UID.
 * @param callerUid - The authenticated UID invoking the recalculation (must be the owner, admin, or system).
 * @param isEmailVerifiedOverride - Optional boolean if email verified status is already verified via token.
 */
export async function recomputeAndSyncPublicTrustPassport(
  uid: string,
  callerUid: string,
  isEmailVerifiedOverride?: boolean
): Promise<ServerTrustSyncResult> {
  if (!uid) {
    throw new Error('User ID is required for trust calculation.');
  }

  // Caller authorization: only the subject user or authorized server admin can invoke sync
  if (callerUid && callerUid !== uid) {
    // In future, org admins or platform super-admins can recalculate for members
    const configuredCeoUid = (process.env.CEO_UID || '').replace(/^["']|["']$/g, '').trim();
    const isCeo = Boolean(configuredCeoUid && callerUid === configuredCeoUid);
    if (!isCeo) {
      throw new Error('Unauthorized: You can only recompute your own trust passport.');
    }
  }

  const adminDb = getAdminFirestore();

  // 1. Fetch authoritative TrustPassport
  const passportDocRef = adminDb.collection('trustPassports').doc(uid);
  const passportSnap = await passportDocRef.get();

  // 2. Fetch authoritative UserProfile
  const userDocRef = adminDb.collection('users').doc(uid);
  const userSnap = await userDocRef.get();

  const passportData = (passportSnap.exists ? passportSnap.data() : null) as TrustPassport | null;
  const userData = (userSnap.exists ? userSnap.data() : null) as UserProfile | null;

  const emailVerified =
    typeof isEmailVerifiedOverride === 'boolean'
      ? isEmailVerifiedOverride
      : Boolean((userData as any)?.emailVerified);

  // Fallback passport if one has not yet been initialized
  const rawPassport: TrustPassport = passportData || {
    id: uid,
    userId: uid,
    headline: userData?.headline || 'Professional on GigLink',
    bio: userData?.bio || '',
    location: userData?.location || '',
    skills: [],
    projects: [],
    experience: [],
    workHistory: [],
    education: [],
    certifications: [],
    certificates: [],
    socialLinks: {},
    isPublic: false,
    identityVerified: false,
    reviews: [],
    metrics: {
      verificationScore: 0,
      completedProjectsCount: 0,
      verifiedSkillsCount: 0,
      endorsementsCount: 0,
      activeStreakDays: 1,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 3. Query authoritative verification evidence from system collections
  let verifiedKyc = false;
  const verifiedProjectIds = new Set<string>();
  const verifiedSkillNames = new Set<string>();

  // A. Approved Identity & Item Verifications
  try {
    const verifSnap = await adminDb
      .collection('verifications')
      .where('userId', '==', uid)
      .where('status', '==', 'verified')
      .get();

    for (const doc of verifSnap.docs) {
      const vData = doc.data();
      const docType = String(vData.documentType || '').toLowerCase();
      if (
        docType === 'national_id' ||
        docType === 'passport' ||
        docType === 'drivers_license'
      ) {
        verifiedKyc = true;
      } else if (docType === 'item_project' || docType === 'project') {
        if (vData.itemId) verifiedProjectIds.add(String(vData.itemId));
        if (vData.projectTitle) verifiedProjectIds.add(String(vData.projectTitle));
      } else if (docType === 'item_skill' || docType === 'skill') {
        if (vData.skillName) verifiedSkillNames.add(String(vData.skillName));
      }
    }
  } catch (err) {
    console.warn('[ServerTrustScore] Verifications query notice:', err);
  }

  // B. Official Claimed Verifiable Credentials
  try {
    const credSnap = await adminDb
      .collection('credentials')
      .where('recipient.recipientUid', '==', uid)
      .where('claimStatus', '==', 'claimed')
      .get();

    for (const doc of credSnap.docs) {
      const cData = doc.data();
      if (Array.isArray(cData.skills)) {
        for (const s of cData.skills) {
          if (typeof s === 'string') verifiedSkillNames.add(s);
        }
      }
      if (cData.title) {
        verifiedProjectIds.add(String(cData.title));
      }
    }
  } catch (err) {
    console.warn('[ServerTrustScore] Credentials query notice:', err);
  }

  // C. Immutable Platform Project Proofs
  try {
    const proofsSnap = await adminDb.collection('projectProofs').get();
    for (const doc of proofsSnap.docs) {
      const pData = doc.data();
      const talentHandle = String(pData.talentPublicHandle || '').toLowerCase();
      const creatorHandle = String(pData.creatorPublicHandle || '').toLowerCase();
      const userHandle = String(userData?.displayName || '')
        .toLowerCase()
        .replace(/\s+/g, '_');
      const isUserProof =
        talentHandle === uid.toLowerCase() ||
        creatorHandle === uid.toLowerCase() ||
        (userHandle && (talentHandle === userHandle || creatorHandle === userHandle));

      if (isUserProof) {
        verifiedProjectIds.add(doc.id);
        if (pData.projectTitle) verifiedProjectIds.add(String(pData.projectTitle));
        if (Array.isArray(pData.skillsDemonstrated)) {
          for (const s of pData.skillsDemonstrated) {
            if (typeof s === 'string') verifiedSkillNames.add(s);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ServerTrustScore] ProjectProofs query notice:', err);
  }

  // 4. Validate and sanitize inputs against authoritative evidence
  const effectivePassport = validateAuthoritativePassportInputs(rawPassport, {
    verifiedKyc,
    verifiedProjectIds: Array.from(verifiedProjectIds),
    verifiedSkillNames: Array.from(verifiedSkillNames),
  });

  // 5. Authoritative calculation
  const scoreResult = calculateTrustScore(effectivePassport, userData, emailVerified);

  const publicDocRef = adminDb.collection('publicTrustPassports').doc(uid);

  // 6. If passport is public, sanitize and persist authoritative projection
  if (effectivePassport.isPublic === true) {
    const projection = sanitizePublicPassportProjection(
      effectivePassport,
      userData,
      emailVerified
    );

    // Overwrite with server-verified trust score and tier
    projection.trustScore = scoreResult.totalScore;
    projection.trustTier = scoreResult.tier;

    await publicDocRef.set(projection, { merge: false });

    return {
      success: true,
      isPublic: true,
      trustScore: scoreResult.totalScore,
      trustTier: scoreResult.tier,
      projection,
      message: 'Public Trust Passport synchronized with authoritative server score.',
    };
  } else {
    // If passport is private, delete any existing public projection
    try {
      await publicDocRef.delete();
    } catch {
      // Graceful no-op if document did not exist
    }

    return {
      success: true,
      isPublic: false,
      trustScore: scoreResult.totalScore,
      trustTier: scoreResult.tier,
      message: 'Passport is private. Public projection removed.',
    };
  }
}
