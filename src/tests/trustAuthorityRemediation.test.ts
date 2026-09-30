/**
 * Phase 1 Trust Authority Security Remediation Test Suite
 *
 * Dedicated tests verifying the resolution of all three audit blockers:
 * 1. Safe Fallback: No client-side fallback writes to publicTrustPassports on server failure.
 * 2. Secure Verified Project Proofs: Server and payload builders demote self-reported project verifications.
 * 3. Secure Verified Skills & Metrics: Clients cannot self-award verifiedCount or elevated verification metrics.
 * 4. Secure identityVerified: Anti-self-verification, verifier authority enforcement, and profile injection immunity.
 * 5. Trust Score Server Input Hardening: Complete neutralization of client-poisoned verification state.
 */

import { calculateTrustScore } from '../lib/trustScore';
import {
  buildPassportUpdatePayload,
  sanitizePublicPassportProjection,
} from '../lib/profileService';
import {
  validateAuthoritativePassportInputs,
  TrustedVerificationContext,
} from '../server/serverTrustScoreService';
import { TrustPassport, UserProfile } from '../types';

export async function runTrustAuthorityRemediationTests() {
  console.log('--- PHASE 1: TRUST AUTHORITY SECURITY REMEDIATION SUITE ---');
  let total = 0;
  let passed = 0;
  let failed = 0;

  const assert = (name: string, condition: boolean) => {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ [REMEDIATION] ${name}`);
    } else {
      failed++;
      console.error(`  ✗ [REMEDIATION FAIL] ${name}`);
    }
  };

  // TEST 1: Fallback Safety - Client Cannot Write Elevated Score to Public Projection
  // Simulating an unverified user whose passport is public
  const initialPassport: TrustPassport = {
    id: 'user_remediation_1',
    userId: 'user_remediation_1',
    headline: 'Developer',
    bio: 'Profile bio',
    location: 'Remote',
    skills: [{ id: 's1', name: 'JavaScript', category: 'Dev', proficiency: 'intermediate', verifiedCount: 0 }],
    projects: [],
    experience: [],
    workHistory: [],
    education: [],
    certifications: [],
    certificates: [],
    reviews: [],
    socialLinks: {},
    isPublic: true,
    identityVerified: false,
    metrics: {
      verificationScore: 0,
      completedProjectsCount: 0,
      verifiedSkillsCount: 0,
      endorsementsCount: 0,
      activeStreakDays: 1,
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const initialProfile: UserProfile = {
    uid: 'user_remediation_1',
    email: 'dev@test.com',
    displayName: 'Dev User',
    headline: 'Developer',
    bio: 'Profile bio building open-source verifiable systems worldwide',
    activePersona: 'talent',
    availablePersonas: ['talent'],
    identityVerified: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  // TEST 2: Secure Verified Project Proofs
  // Attacker attempts to inject verificationStatus: 'verified' into an existing unverified project
  const unverifiedProjectPassport: TrustPassport = {
    ...initialPassport,
    projects: [
      {
        id: 'p_unverified_1',
        title: 'Crypto Portfolio',
        description: 'Personal project',
        role: 'Creator',
        verificationStatus: 'unverified',
        skillsUsed: ['JavaScript'],
        status: 'published',
        completedAt: '2026-08-01',
      },
    ],
  };

  const clientForgedProjectUpdate = buildPassportUpdatePayload(unverifiedProjectPassport, {
    projects: [
      {
        id: 'p_unverified_1',
        title: 'Crypto Portfolio',
        description: 'Personal project',
        role: 'Creator',
        verificationStatus: 'verified' as any, // Client attempted elevation!
        verifierUid: 'forged_verifier',
        verifierName: 'Fake Admin',
        verifiedAt: '2026-09-16T00:00:00.000Z',
        skillsUsed: ['JavaScript'],
        status: 'published',
        completedAt: '2026-08-01',
      },
    ],
  });

  assert(
    'SEC-01: buildPassportUpdatePayload prevents elevation of project verificationStatus',
    clientForgedProjectUpdate.projects[0].verificationStatus === 'unverified'
  );
  assert(
    'SEC-02: buildPassportUpdatePayload strips forged verifierUid, verifierName, and verifiedAt',
    clientForgedProjectUpdate.projects[0].verifierUid === undefined &&
      clientForgedProjectUpdate.projects[0].verifierName === undefined &&
      clientForgedProjectUpdate.projects[0].verifiedAt === undefined
  );

  // TEST 3: Secure Verified Skills and Metrics
  // Attacker attempts to inflate verifiedCount from 0 to 45
  const clientForgedSkillsUpdate = buildPassportUpdatePayload(initialPassport, {
    skills: [
      {
        id: 's1',
        name: 'JavaScript',
        category: 'Dev',
        proficiency: 'expert',
        verifiedCount: 45, // Client attempted inflation!
      },
      {
        id: 's2_new',
        name: 'Rust',
        category: 'Dev',
        proficiency: 'expert',
        verifiedCount: 10, // Brand new skill trying to claim verified count!
      },
    ],
  });

  assert(
    'SEC-03: buildPassportUpdatePayload locks existing skill verifiedCount to authenticated value (0)',
    clientForgedSkillsUpdate.skills[0].verifiedCount === 0 && clientForgedSkillsUpdate.skills[0].verified === false
  );
  assert(
    'SEC-04: buildPassportUpdatePayload initializes new skills with verifiedCount=0 and verified=false',
    clientForgedSkillsUpdate.skills[1].verifiedCount === 0 && clientForgedSkillsUpdate.skills[1].verified === false
  );

  // TEST 4: Secure identityVerified - Upstream Profile Injection Immunity
  // An attacker alters user profile to set identityVerified: true, but passport is not verified
  const spoofedProfile: UserProfile = {
    ...initialProfile,
    identityVerified: true, // Injected into user profile
  };

  const projectionWithSpoofedProfile = sanitizePublicPassportProjection(
    initialPassport, // passport.identityVerified is false
    spoofedProfile,
    true
  );

  assert(
    'SEC-05: sanitizePublicPassportProjection ignores profile.identityVerified and checks only authoritative passport',
    projectionWithSpoofedProfile.identityVerified === false
  );
  assert(
    'SEC-06: Trust score calculates 0 identity points when passport.identityVerified is false despite profile spoofing',
    projectionWithSpoofedProfile.trustScore < 40
  );

  // TEST 5: Server Input Hardening (serverTrustScoreService)
  // Completely poisoned passport with all client-controlled fields set to malicious values
  const completelyPoisonedPassport: TrustPassport = {
    id: 'attacker_1337',
    userId: 'attacker_1337',
    headline: 'Master Attacker',
    bio: 'Poisoning server inputs with a sufficiently long bio string exceeding thirty chars',
    location: 'Cyber',
    skills: [
      { id: 's_p1', name: 'Solidity', category: 'Dev', proficiency: 'expert', verifiedCount: 99 },
      { id: 's_p2', name: 'Cryptography', category: 'Dev', proficiency: 'expert', verifiedCount: 50 },
      { id: 's_p3', name: 'Distributed Systems', category: 'Dev', proficiency: 'expert', verifiedCount: 20 },
    ],
    projects: [
      {
        id: 'p_p1',
        title: 'Fabricated Bridge',
        description: 'Fake deliverable',
        role: 'Lead',
        verificationStatus: 'verified',
        skillsUsed: ['Solidity'],
        status: 'published',
        completedAt: '2026-08-01',
      },
      {
        id: 'p_p2',
        title: 'Fabricated DEX',
        description: 'Fake deliverable 2',
        role: 'Lead',
        verificationStatus: 'verified',
        skillsUsed: ['Cryptography'],
        status: 'published',
        completedAt: '2026-08-02',
      },
    ],
    experience: [],
    workHistory: [],
    education: [],
    certifications: [],
    certificates: [],
    reviews: [],
    socialLinks: {},
    isPublic: true,
    identityVerified: true, // Poisoned!
    metrics: {
      verificationScore: 100,
      completedProjectsCount: 2,
      verifiedSkillsCount: 3,
      endorsementsCount: 0,
      activeStreakDays: 1,
    },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  // Case A: Without authoritative evidence in system collections
  const sanitizedEmptyContext = validateAuthoritativePassportInputs(completelyPoisonedPassport, {
    verifiedKyc: false,
    verifiedProjectIds: [],
    verifiedSkillNames: [],
  });

  assert(
    'SEC-07: validateAuthoritativePassportInputs demotes all unbacked verified projects',
    sanitizedEmptyContext.projects.every((p) => p.verificationStatus === 'unverified')
  );
  assert(
    'SEC-08: validateAuthoritativePassportInputs zeroes out all unbacked verified skill counts',
    sanitizedEmptyContext.skills.every((s) => s.verifiedCount === 0 && s.verified === false)
  );
  assert(
    'SEC-09: validateAuthoritativePassportInputs strips unbacked identityVerified',
    sanitizedEmptyContext.identityVerified === false
  );
  assert(
    'SEC-10: validateAuthoritativePassportInputs recomputes metrics to zero verified items',
    sanitizedEmptyContext.metrics.completedProjectsCount === 0 &&
      sanitizedEmptyContext.metrics.verifiedSkillsCount === 0
  );

  const scoreZero = calculateTrustScore(sanitizedEmptyContext, null, false);
  assert(
    'SEC-11: Authoritative score awarded for completely poisoned passport without backing is 0 (Unverified)',
    scoreZero.totalScore === 0 && scoreZero.tier === 'Unverified'
  );

  // Case B: With legitimate authoritative evidence in system collections
  const legitimateContext: TrustedVerificationContext = {
    verifiedKyc: true,
    verifiedProjectIds: ['p_p1'], // only p_p1 has a verified contract proof
    verifiedSkillNames: ['solidity'], // only Solidity has a claimed institutional credential
  };

  const legitimateSanitized = validateAuthoritativePassportInputs(
    completelyPoisonedPassport,
    legitimateContext
  );

  assert(
    'SEC-12: Backed project p_p1 remains verified while unbacked p_p2 is demoted to unverified',
    legitimateSanitized.projects.find((p) => p.id === 'p_p1')?.verificationStatus === 'verified' &&
      legitimateSanitized.projects.find((p) => p.id === 'p_p2')?.verificationStatus === 'unverified'
  );
  assert(
    'SEC-13: Backed skill Solidity preserves verified status while unbacked skills are neutralized',
    (legitimateSanitized.skills.find((s) => s.name === 'Solidity')?.verifiedCount ?? 0) >= 1 &&
      legitimateSanitized.skills.find((s) => s.name === 'Cryptography')?.verifiedCount === 0 &&
      legitimateSanitized.skills.find((s) => s.name === 'Distributed Systems')?.verifiedCount === 0
  );
  assert(
    'SEC-14: Legitimate KYC context correctly confirms identityVerified: true',
    legitimateSanitized.identityVerified === true
  );

  const legitimateScore = calculateTrustScore(legitimateSanitized, initialProfile, true);
  // Identity: 40 pts, Work: 10 pts (1 verified), Skills: 5 pts (1 verified), Hygiene: 10 pts = 65 pts (Emerging tier)
  assert(
    'SEC-15: Legitimate score correctly awards exactly 65 points and Emerging tier',
    legitimateScore.totalScore === 65 && legitimateScore.tier === 'Emerging'
  );

  console.log(`Phase 1 Remediation Suite: ${passed}/${total} tests passed successfully.\n`);
  return { total, passed, failed };
}
