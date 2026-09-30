/**
 * Server-Authoritative Trust Score & Public Projection Verification Suite
 *
 * Validates:
 * 1. Server trust score calculation preserves canonical point distribution (Identity 40, Work 30, Skills 20, Hygiene 10).
 * 2. Server projection synchronizer strictly strips sensitive private drafts, unverified flags, and private data.
 * 3. Client tampering attempts (trying to self-assign arbitrary scores) are blocked by server logic and rules.
 * 4. Private passports trigger removal of public projections.
 */

import { calculateTrustScore, calculateProfileCompleteness } from '../lib/trustScore';
import {
  sanitizePublicPassportProjection,
  buildPassportUpdatePayload,
} from '../lib/profileService';
import { validateAuthoritativePassportInputs } from '../server/serverTrustScoreService';
import { TrustPassport, UserProfile } from '../types';

export function runServerTrustScoreTestSuite() {
  console.log('--- SERVER-AUTHORITATIVE TRUST SCORE & PROJECTION SUITE ---');
  let total = 0;
  let passed = 0;
  let failed = 0;

  const assert = (name: string, condition: boolean) => {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ [SERVER-TRUST] ${name}`);
    } else {
      failed++;
      console.error(`  ✗ [SERVER-TRUST FAIL] ${name}`);
    }
  };

  // 1. Point distribution calculation
  const mockPassport: TrustPassport = {
    id: 'user_trust_test',
    userId: 'user_trust_test',
    headline: 'Senior Full Stack Engineer',
    bio: 'Building verifiable web3 infrastructure',
    location: 'Berlin, Germany',
    skills: [
      { id: 's1', name: 'TypeScript', category: 'Engineering', proficiency: 'expert', verifiedCount: 2 },
      { id: 's2', name: 'React', category: 'Engineering', proficiency: 'expert', verifiedCount: 1 },
      { id: 's3', name: 'Node.js', category: 'Engineering', proficiency: 'expert', verifiedCount: 3 },
      { id: 's4', name: 'Solidity', category: 'Engineering', proficiency: 'expert', verifiedCount: 1 },
    ],
    projects: [
      {
        id: 'p1',
        title: 'Verifiable Ledger',
        description: 'Audited escrow contract',
        role: 'Lead Architect',
        verificationStatus: 'verified',
        skillsUsed: ['Solidity', 'TypeScript'],
        status: 'published',
        completedAt: '2026-05-01',
      },
      {
        id: 'p2',
        title: 'Decentralized Identity Bridge',
        description: 'DID resolver service',
        role: 'Contributor',
        verificationStatus: 'verified',
        skillsUsed: ['TypeScript'],
        status: 'published',
        completedAt: '2026-06-01',
      },
    ],
    experience: [],
    workHistory: [],
    education: [],
    certifications: [],
    certificates: [],
    reviews: [],
    socialLinks: { github: 'https://github.com/verifiable' },
    isPublic: true,
    identityVerified: true,
    metrics: {
      verificationScore: 90,
      completedProjectsCount: 2,
      verifiedSkillsCount: 4,
      endorsementsCount: 0,
      activeStreakDays: 5,
    },
    createdAt: '2026-01-01',
    updatedAt: '2026-09-01',
  };

  const mockProfile: UserProfile = {
    uid: 'user_trust_test',
    email: 'engineer@giglink.test',
    displayName: 'Alex Rivers',
    headline: 'Senior Full Stack Engineer',
    bio: 'Building verifiable web3 infrastructure',
    activePersona: 'talent',
    availablePersonas: ['talent'],
    createdAt: '2026-01-01',
    updatedAt: '2026-09-01',
  };

  // Expected points:
  // Identity: 40 (identityVerified is true)
  // Work: 20 (2 verified projects * 10 pts)
  // Skills: 20 (4 verified skills * 5 pts)
  // Hygiene: 10 (100% profile completeness + verified email)
  // Total: 90 pts -> 'Elite'
  const calc = calculateTrustScore(mockPassport, mockProfile, true);
  assert('Identity points calculate 40 for verified identity', calc.identityPoints === 40);
  assert('Proof of work points calculate 20 for 2 verified projects', calc.proofOfWorkPoints === 20);
  assert('Verified skills points calculate 20 for 4 verified skills', calc.skillsPoints === 20);
  assert('Profile hygiene points award 10 when completeness is 100% and email is verified', calc.profileHygienePoints === 10);
  assert('Total trust score computes to 90', calc.totalScore === 90);
  assert('Trust tier maps to Elite for score >= 90', calc.tier === 'Elite');

  // 2. Anti-tampering invariant: If identity is not verified, 40 points cannot be claimed
  const unverifiedPassport: TrustPassport = {
    ...mockPassport,
    identityVerified: false,
  };
  const unverifiedCalc = calculateTrustScore(unverifiedPassport, mockProfile, true);
  assert('Unverified identity awards 0 identity points', unverifiedCalc.identityPoints === 0);
  assert('Total score drops to 50 without identity verification', unverifiedCalc.totalScore === 50);
  assert('Tier drops to Emerging for score 50', unverifiedCalc.tier === 'Emerging');

  // 3. Sanitized Projection Isolation
  const projection = sanitizePublicPassportProjection(mockPassport, mockProfile, true);
  assert('Public projection contains calculated trust score', projection.trustScore === 90);
  assert('Public projection contains calculated trust tier', projection.trustTier === 'Elite');
  assert('Public projection reflects identityVerified status', projection.identityVerified === true);
  assert('Public projection omits any unverified internal evidence', !('documentNumberMasked' in (projection as any)));

  // 4. Privacy Invariant: Private passport produces empty or deleted public state
  const privatePassport: TrustPassport = {
    ...mockPassport,
    isPublic: false,
  };
  const privateProjection = sanitizePublicPassportProjection(privatePassport, mockProfile, true);
  assert('Private passport projection indicates isPublic is false', privateProjection.isPublic === false);

  // 5. Hardened Input Poisoning Defenses (serverTrustScoreService)
  const poisonedClientPassport: TrustPassport = {
    id: 'attacker_uid',
    userId: 'attacker_uid',
    headline: 'Attacker Profile',
    bio: 'Attempting to spoof trust score',
    location: 'Unknown',
    skills: [
      { id: 's_fake', name: 'Solidity', category: 'Engineering', proficiency: 'expert', verifiedCount: 99 },
      { id: 's_fake2', name: 'Rust', category: 'Engineering', proficiency: 'expert', verifiedCount: 50 },
    ],
    projects: [
      {
        id: 'p_fake',
        title: 'Unverified Self-Reported App',
        description: 'No proof backing this',
        role: 'Founder',
        verificationStatus: 'verified', // Poisoned input!
        skillsUsed: ['Solidity'],
        status: 'published',
        completedAt: '2026-08-01',
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
    identityVerified: false,
    metrics: {
      verificationScore: 100,
      completedProjectsCount: 1,
      verifiedSkillsCount: 2,
      endorsementsCount: 0,
      activeStreakDays: 1,
    },
    createdAt: '2026-08-01',
    updatedAt: '2026-08-01',
  };

  const validatedPoison = validateAuthoritativePassportInputs(poisonedClientPassport, {
    verifiedKyc: false,
    verifiedProjectIds: [],
    verifiedSkillNames: [],
  });

  assert(
    'Input Poisoning: Self-reported verified project is demoted to unverified',
    validatedPoison.projects[0].verificationStatus === 'unverified'
  );
  assert(
    'Input Poisoning: Self-awarded verified skill count is neutralized to 0',
    validatedPoison.skills[0].verifiedCount === 0 && validatedPoison.skills[0].verified === false
  );
  assert(
    'Input Poisoning: Attacker completedProjectsCount metric is neutralized to 0',
    validatedPoison.metrics.completedProjectsCount === 0
  );
  assert(
    'Input Poisoning: Attacker verifiedSkillsCount metric is neutralized to 0',
    validatedPoison.metrics.verifiedSkillsCount === 0
  );

  const sanitizedAttackerScore = calculateTrustScore(validatedPoison, null, false);
  assert(
    'Input Poisoning: Authoritative score awarded for unverified attacker is 0',
    sanitizedAttackerScore.totalScore === 0 && sanitizedAttackerScore.tier === 'Unverified'
  );

  // 6. Upstream Payload Sanitization Defense (buildPassportUpdatePayload)
  const existingUnverifiedPassport: TrustPassport = {
    ...poisonedClientPassport,
    projects: [
      {
        ...poisonedClientPassport.projects[0],
        verificationStatus: 'unverified',
      },
    ],
    skills: [
      {
        ...poisonedClientPassport.skills[0],
        verifiedCount: 0,
      },
    ],
  };

  const maliciousPayloadAttempt = buildPassportUpdatePayload(existingUnverifiedPassport, {
    projects: [
      {
        ...poisonedClientPassport.projects[0],
        verificationStatus: 'verified' as any, // Client trying to upgrade to verified
      },
    ],
    skills: [
      {
        ...poisonedClientPassport.skills[0],
        verifiedCount: 100, // Client trying to upgrade verifiedCount
      },
    ],
  });

  assert(
    'Upstream Defense: buildPassportUpdatePayload rejects client elevating project verificationStatus',
    maliciousPayloadAttempt.projects[0].verificationStatus === 'unverified'
  );
  assert(
    'Upstream Defense: buildPassportUpdatePayload locks verifiedCount to existing authenticated count',
    maliciousPayloadAttempt.skills[0].verifiedCount === 0
  );

  console.log(`Server Trust Score Suite: ${passed}/${total} tests passed successfully.\n`);
  return { total, passed, failed };
}
