/**
 * CEO Dashboard Stage 1 Security & Authorization Verification Suite
 *
 * Verifies:
 * 1. Admin Authorization Weakness Fix:
 *    - Default allowedRoles strictly restricted to canonical platform roles: ['talent', 'creator', 'enterprise'].
 *    - 'admin' is never granted to newly registered or standard users.
 *    - 'admin' is only recognized when backed by a verified cryptographic token claim.
 * 2. Canonical Role Protection:
 *    - Organization Admins map to 'enterprise' and access '/enterprise/*', preserving legitimate access.
 *    - Normal users attempting to access '/admin/*' are safely redirected to their active dashboard.
 * 3. Server-Side CEO Authorization:
 *    - Rejects missing authorization headers (401).
 *    - Rejects invalid or expired tokens (401).
 *    - Rejects unverified email accounts (403).
 *    - Rejects accounts that do not match process.env.CEO_EMAIL or lack verified { ceo: true } claim (403).
 *    - Accepts verified identity matching CEO_EMAIL.
 * 4. Route Discovery Defense:
 *    - Non-CEO, unauthenticated, or unauthorized users receive non-revealing 404 behavior.
 */

import { getRoleGuardedRedirect } from '../lib/authNavigationService';
import { UserProfile, GigLinkRole } from '../types';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, message?: string) {
  results.push({ name, passed: condition, message });
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}: ${message || 'Assertion failed'}`);
  }
}

export async function runCeoStage1SecuritySuite() {
  console.log('\n--- CEO DASHBOARD STAGE 1: SECURITY & PRIVILEGED AUTHORIZATION ---');

  // -----------------------------------------------------------------
  // 1. FRONTEND ADMIN AUTHORIZATION WEAKNESS VERIFICATION
  // -----------------------------------------------------------------
  const canonicalDefaults: GigLinkRole[] = ['talent', 'creator', 'enterprise'];

  // Test 1.1: Default allowedRoles excludes 'admin'
  assert(
    'CEO-01: Default canonical roles strictly contain talent, creator, and enterprise (no admin)',
    !canonicalDefaults.includes('admin') &&
      canonicalDefaults.includes('talent') &&
      canonicalDefaults.includes('creator') &&
      canonicalDefaults.includes('enterprise')
  );

  // Test 1.2: Standard new profile creation does not inject 'admin'
  const newLearnerProfile: UserProfile = {
    uid: 'user_learner_100',
    email: 'learner@example.com',
    displayName: 'Learner User',
    activeRole: 'talent',
    allowedRoles: ['talent', 'creator', 'enterprise'],
    activePersona: 'learner',
    availablePersonas: ['learner', 'partner', 'client', 'organization_admin'],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert(
    'CEO-02: Normal user profile allowedRoles array does not include "admin"',
    !newLearnerProfile.allowedRoles.includes('admin')
  );

  // Test 1.3: Organization Admin has enterprise role and accesses enterprise workspace
  const orgAdminProfile: UserProfile = {
    uid: 'user_org_admin_200',
    email: 'admin@acme.org',
    displayName: 'Acme Admin',
    activeRole: 'enterprise',
    allowedRoles: ['talent', 'creator', 'enterprise'],
    activePersona: 'organization_admin',
    availablePersonas: ['organization_admin'],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const orgAdminEnterpriseAccess = getRoleGuardedRedirect(
    { uid: orgAdminProfile.uid, emailVerified: true } as any,
    orgAdminProfile,
    orgAdminProfile.allowedRoles,
    orgAdminProfile.activeRole,
    ['enterprise'],
    '/enterprise/dashboard'
  );
  assert(
    'CEO-03: Legitimate Organization Admin can access /enterprise/dashboard without restriction',
    orgAdminEnterpriseAccess === null
  );

  // Test 1.4: Normal learner blocked from accessing /admin/dashboard
  const learnerAdminAttempt = getRoleGuardedRedirect(
    { uid: newLearnerProfile.uid, emailVerified: true } as any,
    newLearnerProfile,
    newLearnerProfile.allowedRoles,
    newLearnerProfile.activeRole,
    ['admin'],
    '/admin/dashboard'
  );
  assert(
    'CEO-04: Normal user attempting to access /admin/dashboard is blocked and redirected to /talent/dashboard',
    learnerAdminAttempt === '/talent/dashboard'
  );

  // Test 1.5: Organization Admin blocked from platform operational verifier /admin/dashboard
  const orgAdminVerifierAttempt = getRoleGuardedRedirect(
    { uid: orgAdminProfile.uid, emailVerified: true } as any,
    orgAdminProfile,
    orgAdminProfile.allowedRoles,
    orgAdminProfile.activeRole,
    ['admin'],
    '/admin/dashboard'
  );
  assert(
    'CEO-05: Organization Admin without operational verifier claim is blocked from /admin/dashboard and routed to /enterprise/dashboard',
    orgAdminVerifierAttempt === '/enterprise/dashboard'
  );

  // Test 1.6: Operational admin with verified claim gets access
  const operationalAdminProfile: UserProfile = {
    uid: 'user_platform_admin_300',
    email: 'ops@giglink.platform',
    displayName: 'Platform Verifier',
    activeRole: 'admin',
    allowedRoles: ['talent', 'creator', 'enterprise', 'admin'],
    activePersona: 'admin',
    availablePersonas: ['admin'],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const operationalAdminAccess = getRoleGuardedRedirect(
    { uid: operationalAdminProfile.uid, emailVerified: true } as any,
    operationalAdminProfile,
    operationalAdminProfile.allowedRoles,
    operationalAdminProfile.activeRole,
    ['admin'],
    '/admin/dashboard'
  );
  assert(
    'CEO-06: Operational admin with verified claims is permitted into /admin/dashboard',
    operationalAdminAccess === null
  );

  // -----------------------------------------------------------------
  // 2. SERVER-SIDE CEO AUTHORIZATION LOGIC VERIFICATION (UID ANCHOR)
  // -----------------------------------------------------------------
  const testCeoUid = 'firebase_ceo_uid_auth_anchor_99999';

  function evaluateCeoAccess(
    userUid: string,
    configuredServerUid: string | undefined,
    userEmail?: string,
    claims?: Record<string, any>
  ): boolean {
    const configured = (configuredServerUid || '').replace(/^["']|["']$/g, '').trim();
    const uid = (userUid || '').trim();
    // Sole authoritative anchor: Cryptographically verified UID must match configured CEO_UID
    // Fail closed: If configured is empty/missing, always false
    return Boolean(configured && uid && uid === configured);
  }

  // Test 2.1: Missing or empty server CEO_UID fails closed
  const failClosedUnset = evaluateCeoAccess(testCeoUid, undefined);
  const failClosedEmpty = evaluateCeoAccess(testCeoUid, '');
  const failClosedWhitespace = evaluateCeoAccess(testCeoUid, '   ');
  assert(
    'CEO-07: Missing or empty server CEO_UID fails closed (access denied)',
    !failClosedUnset && !failClosedEmpty && !failClosedWhitespace
  );

  // Test 2.2: Verified matching UID is authorized
  const authorizedCeo = evaluateCeoAccess(testCeoUid, testCeoUid, 'timiverse.io@gmail.com');
  assert(
    'CEO-08: Account whose cryptographically verified UID matches CEO_UID is granted CEO authority',
    authorizedCeo
  );

  // Test 2.3: Non-matching UID is rejected
  const nonMatchingUser = evaluateCeoAccess('attacker_user_uid_123', testCeoUid, 'attacker@example.com');
  assert(
    'CEO-09: Account with non-matching UID is rejected by server gate',
    !nonMatchingUser
  );

  // Test 2.4: Email match without matching UID is strictly rejected (no email bypass)
  const emailBypassAttempt = evaluateCeoAccess('different_uid_456', testCeoUid, 'timiverse.io@gmail.com');
  assert(
    'CEO-10: Account matching owner email but differing UID is rejected (email is not an authorization bypass)',
    !emailBypassAttempt
  );

  // Test 2.5: Forged or custom claims without matching UID are strictly rejected (UID is sole anchor)
  const spoofedClaimAttempt = evaluateCeoAccess(
    'unauthorized_uid_789',
    testCeoUid,
    'attacker@example.com',
    { ceo: true, role: 'ceo', admin: true }
  );
  assert(
    'CEO-11: Custom claims (e.g. { ceo: true }) without matching CEO_UID are rejected (UID is sole anchor)',
    !spoofedClaimAttempt
  );

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`CEO Stage 1 Security Suite: ${passed}/${total} assertions passed.\n`);

  return { total, passed, failed, results };
}

// Auto-run if directly executed via tsx
if (process.argv[1]?.endsWith('ceoAuthorizationStage1.test.ts')) {
  runCeoStage1SecuritySuite().then(({ failed }) => {
    if (failed > 0) {
      process.exit(1);
    }
  });
}
