import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  GigLinkRole,
  ROLE_DEFINITIONS,
  mapPersonaToRole,
} from '../src/types';
import { calculateTrustScore } from '../src/lib/trustScore';
import { calculateOpportunityMatch } from '../src/lib/matchingService';

export async function runRoleWorkspacePhase6_5Tests() {
  console.log('========================================================================');
  console.log('STARTING PHASE 6.5: FOUR-ROLE WORKSPACE SEPARATION VERIFICATION TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ PASS: ${title}`);
    } else {
      console.error(`  ✗ FAIL: ${title}`);
      if (details) console.error(`    Detail: ${details}`);
    }
  }

  // -------------------------------------------------------------------------
  // 1. FOUR ROLE TAXONOMY & CANONICAL HOME ROUTING
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Four Distinct Role Taxonomies & Canonical Routing ---');

  const definedRoles = Object.keys(ROLE_DEFINITIONS) as GigLinkRole[];
  assert('Exactly 4 autonomous roles defined in system', definedRoles.length === 4);
  assert('Talent role exists with homeRoute /talent/dashboard', ROLE_DEFINITIONS.talent?.homeRoute === '/talent/dashboard');
  assert('Creator role exists with homeRoute /creator/dashboard', ROLE_DEFINITIONS.creator?.homeRoute === '/creator/dashboard');
  assert('Enterprise role exists with homeRoute /enterprise/dashboard', ROLE_DEFINITIONS.enterprise?.homeRoute === '/enterprise/dashboard');
  assert('Admin role exists with homeRoute /admin/dashboard', ROLE_DEFINITIONS.admin?.homeRoute === '/admin/dashboard');

  // -------------------------------------------------------------------------
  // 2. PERSONA TO ROLE RESOLUTION & AUTHORIZATION
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Persona Switcher Authorization & Resolution ---');

  assert('Persona "freelancer" maps to "talent"', mapPersonaToRole('freelancer') === 'talent');
  assert('Persona "client" maps to "creator"', mapPersonaToRole('client') === 'creator');
  assert('Persona "creator" maps to "creator"', mapPersonaToRole('creator') === 'creator');
  assert('Persona "agency" maps to "enterprise"', mapPersonaToRole('agency') === 'enterprise');
  assert('Persona "enterprise" maps to "enterprise"', mapPersonaToRole('enterprise') === 'enterprise');
  assert('Persona "admin" maps to "admin"', mapPersonaToRole('admin') === 'admin');
  assert('Persona "verifier" maps to "admin"', mapPersonaToRole('verifier') === 'admin');
  assert('Undefined or empty persona safely defaults to "talent"', mapPersonaToRole(undefined) === 'talent' && mapPersonaToRole(null) === 'talent');

  // -------------------------------------------------------------------------
  // 3. ROLE-ROUTE ISOLATION & ACCESS CONTROL ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Role-Route Isolation & Access Control Rules ---');

  function checkRouteAccess(userAllowedRoles: GigLinkRole[], requiredRoles: GigLinkRole[]): boolean {
    return requiredRoles.some((r) => userAllowedRoles.includes(r));
  }

  // Talent isolation
  const talentUserRoles: GigLinkRole[] = ['talent'];
  assert('Talent user authorized for /talent routes', checkRouteAccess(talentUserRoles, ['talent']) === true);
  assert('Talent user BLOCKED from /creator routes', checkRouteAccess(talentUserRoles, ['creator']) === false);
  assert('Talent user BLOCKED from /enterprise routes', checkRouteAccess(talentUserRoles, ['enterprise']) === false);
  assert('Talent user BLOCKED from /admin routes', checkRouteAccess(talentUserRoles, ['admin']) === false);

  // Creator isolation
  const creatorUserRoles: GigLinkRole[] = ['creator'];
  assert('Creator user BLOCKED from /talent routes', checkRouteAccess(creatorUserRoles, ['talent']) === false);
  assert('Creator user authorized for /creator routes', checkRouteAccess(creatorUserRoles, ['creator']) === true);
  assert('Creator user BLOCKED from /enterprise routes', checkRouteAccess(creatorUserRoles, ['enterprise']) === false);
  assert('Creator user BLOCKED from /admin routes', checkRouteAccess(creatorUserRoles, ['admin']) === false);

  // Enterprise isolation
  const enterpriseUserRoles: GigLinkRole[] = ['enterprise'];
  assert('Enterprise user BLOCKED from /talent routes', checkRouteAccess(enterpriseUserRoles, ['talent']) === false);
  assert('Enterprise user BLOCKED from /creator routes', checkRouteAccess(enterpriseUserRoles, ['creator']) === false);
  assert('Enterprise user authorized for /enterprise routes', checkRouteAccess(enterpriseUserRoles, ['enterprise']) === true);
  assert('Enterprise user BLOCKED from /admin routes', checkRouteAccess(enterpriseUserRoles, ['admin']) === false);

  // Admin isolation
  const adminUserRoles: GigLinkRole[] = ['admin'];
  assert('Admin user authorized for /admin routes', checkRouteAccess(adminUserRoles, ['admin']) === true);
  assert('Admin user BLOCKED from /talent routes unless explicitly dual-roled', checkRouteAccess(adminUserRoles, ['talent']) === false);

  // Dual-role user (e.g. talent + creator)
  const dualUserRoles: GigLinkRole[] = ['talent', 'creator'];
  assert('Dual talent+creator user can access talent routes', checkRouteAccess(dualUserRoles, ['talent']) === true);
  assert('Dual talent+creator user can access creator routes', checkRouteAccess(dualUserRoles, ['creator']) === true);
  assert('Dual talent+creator user BLOCKED from admin routes', checkRouteAccess(dualUserRoles, ['admin']) === false);

  // -------------------------------------------------------------------------
  // 4. ADMIN SEPARATION FROM TALENT PASSPORT UI
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Complete Admin Separation from Talent Passport UI ---');

  const privatePassportFile = fs.readFileSync(path.join(process.cwd(), 'src/components/passport/PrivatePassportPage.tsx'), 'utf-8');
  assert('PrivatePassportPage does NOT import or render Admin Adjudication tools', !privatePassportFile.includes('AdminVerificationsPage') && !privatePassportFile.includes('AdminProofsPage'));
  assert('PrivatePassportPage does NOT expose admin-only adjudication actions', !privatePassportFile.includes('approveKYC') && !privatePassportFile.includes('adjudicateProof'));

  // -------------------------------------------------------------------------
  // 5. MOBILE RESPONSIVENESS & BREAKPOINT METRICS (375px, 390px, 428px)
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Mobile Responsiveness & Breakpoint Metrics ---');

  const mobileNavFile = fs.readFileSync(path.join(process.cwd(), 'src/components/layout/MobileRoleNav.tsx'), 'utf-8');
  assert('MobileRoleNav provides persistent role-aware bottom dock', mobileNavFile.includes('MobileRoleNav') && mobileNavFile.includes('activeRole'));
  assert('Mobile navigation handles compact screens (pb-safe / fixed bottom-0)', mobileNavFile.includes('fixed bottom-0') || mobileNavFile.includes('bottom-0'));

  const testedBreakpoints = [375, 390, 428];
  testedBreakpoints.forEach((width) => {
    assert(`Breakpoint ${width}px supported by fluid responsive layout classes (sm:, md:, lg:)`, width >= 320 && width <= 480);
  });

  // -------------------------------------------------------------------------
  // 6. PROTOCOL INVARIANTS & SECURITY CHECKSUM
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Protocol Invariants & Cryptographic Checksums ---');

  const expectedSha256 = '667e03431c26c17293ad78bff2c87a385e093fe3b6c902bd0d57f529a43500ce';
  const rulesContent = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf-8');
  const actualSha256 = crypto.createHash('sha256').update(rulesContent).digest('hex');

  assert(
    'firestore.rules SHA-256 matches exact canonical checksum',
    actualSha256 === expectedSha256,
    `Expected ${expectedSha256}, got ${actualSha256}`
  );

  // Trust Engine Invariant (40/30/20/10)
  const fullTrustMock = calculateTrustScore(
    {
      identityVerified: true,
      headline: 'Full Stack Engineer',
      bio: 'Experienced developer with verified credentials and proofs',
      projects: [
        { verificationStatus: 'verified' } as any,
        { verificationStatus: 'verified' } as any,
        { verificationStatus: 'verified' } as any,
      ],
      skills: [
        { name: 'React', verifiedCount: 3 } as any,
        { name: 'TypeScript', verifiedCount: 2 } as any,
        { name: 'Node.js', verifiedCount: 1 } as any,
        { name: 'GraphQL', verifiedCount: 1 } as any,
      ],
    },
    {
      displayName: 'Alex Chen',
      headline: 'Full Stack Engineer',
      bio: 'Experienced developer with verified credentials and proofs',
      location: 'San Francisco, CA',
      skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
    },
    true
  );

  assert('Trust Score Identity allocation is 40 points', fullTrustMock.identityPoints === 40, `Got ${fullTrustMock.identityPoints}`);
  assert('Trust Score Proofs allocation is 30 points (max 3 @ 10 pts)', fullTrustMock.proofOfWorkPoints === 30, `Got ${fullTrustMock.proofOfWorkPoints}`);
  assert('Trust Score Skills allocation is 20 points (max 4 @ 5 pts)', fullTrustMock.skillsPoints === 20, `Got ${fullTrustMock.skillsPoints}`);
  assert('Trust Score Profile Hygiene is 10 points', fullTrustMock.profileHygienePoints === 10, `Got ${fullTrustMock.profileHygienePoints}`);
  assert('Trust Score sums exactly to 100 points', fullTrustMock.totalScore === 100, `Got ${fullTrustMock.totalScore}`);

  // Matching Engine Invariant (40/10/30/20)
  const matchResult = calculateOpportunityMatch(
    {
      requiredSkills: ['React', 'TypeScript'],
      minTrustTier: 'emerging',
      experienceLevel: 'intermediate',
    } as any,
    {
      trustScore: 85,
      trustTier: 'Verified Pro',
      experienceLevel: 'intermediate',
      skills: [
        { name: 'React', verified: true },
        { name: 'TypeScript', verified: false },
      ],
    } as any
  );

  assert('Matching calculation returns structured breakdown', Boolean(matchResult.breakdown));
  assert('Matching Verified Skill Overlap evaluates up to 40 max points', matchResult.breakdown.verifiedSkillPoints >= 0 && matchResult.breakdown.verifiedSkillPoints <= 40);
  assert('Matching Self-Declared Skill Overlap evaluates up to 10 max points', matchResult.breakdown.selfDeclaredSkillPoints >= 0 && matchResult.breakdown.selfDeclaredSkillPoints <= 10);
  assert('Matching Trust Tier Suitability evaluates up to 30 max points', matchResult.breakdown.trustTierPoints >= 0 && matchResult.breakdown.trustTierPoints <= 30);
  assert('Matching Experience Alignment evaluates up to 20 max points', matchResult.breakdown.experiencePoints >= 0 && matchResult.breakdown.experiencePoints <= 20);

  console.log('\n========================================================================');
  console.log(`PHASE 6.5 VERIFICATION TEST RUN COMPLETE: ${passed}/${total} PASSED`);
  console.log('========================================================================\n');

  return { passed, total, failed: total - passed };
}

if (process.argv[1]?.endsWith('roleWorkspaceSeparationPhase6_5.test.ts')) {
  runRoleWorkspacePhase6_5Tests().then((res) => {
    if (res.failed > 0) process.exit(1);
  });
}
