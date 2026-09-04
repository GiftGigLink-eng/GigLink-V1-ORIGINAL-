/**
 * Phase 8 Pre-requisite Test Suite:
 * Authentication Gating, Email Verification Enforcement & Post-Sign-In Navigation
 */

import {
  getPostSignInRedirect,
  getLandingPageRedirect,
  getAuthenticatedGuardRedirect,
  getRoleGuardedRedirect,
} from '../lib/authNavigationService';
import { UserProfile, GigLinkRole } from '../types';

export interface TestResult {
  total: number;
  passed: number;
  failed: number;
  details: string[];
}

export async function runAuthNavigationSecurityTests(): Promise<TestResult> {
  console.log('--- AUTHENTICATION GATING & NAVIGATION REGRESSION AUDIT ---');

  let total = 0;
  let passed = 0;
  let failed = 0;
  const details: string[] = [];

  const assert = (name: string, condition: boolean, extraInfo?: string) => {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ [AUTH_NAV] ${name}`);
    } else {
      failed++;
      const err = `  ✗ [AUTH_NAV FAIL] ${name}${extraInfo ? ` — ${extraInfo}` : ''}`;
      console.error(err);
      details.push(err);
    }
  };

  // Mock Data
  const unverifiedUser = { uid: 'user_unverified_1', email: 'alice@example.com', emailVerified: false };
  const verifiedUser = { uid: 'user_verified_1', email: 'bob@example.com', emailVerified: true };

  const incompleteProfile: UserProfile = {
    uid: 'user_verified_1',
    email: 'bob@example.com',
    displayName: 'Bob Incomplete',
    activePersona: 'learner',
    availablePersonas: ['learner'],
    allowedRoles: ['talent'],
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const completedTalentProfile: UserProfile = {
    uid: 'user_verified_1',
    email: 'bob@example.com',
    displayName: 'Bob Talent',
    activePersona: 'learner',
    availablePersonas: ['learner'],
    allowedRoles: ['talent'],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const completedCreatorProfile: UserProfile = {
    uid: 'user_verified_2',
    email: 'carol@example.com',
    displayName: 'Carol Creator',
    activePersona: 'client',
    availablePersonas: ['client'],
    allowedRoles: ['creator'],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const completedEnterpriseProfile: UserProfile = {
    uid: 'user_verified_3',
    email: 'dave@example.com',
    displayName: 'Dave Enterprise',
    activePersona: 'organization_admin',
    availablePersonas: ['organization_admin'],
    allowedRoles: ['enterprise'],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const completedAdminProfile: UserProfile = {
    uid: 'user_verified_4',
    email: 'eve@example.com',
    displayName: 'Eve Admin',
    activePersona: 'organization_admin',
    availablePersonas: ['organization_admin'],
    allowedRoles: ['admin'],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // -----------------------------------------------------------------
  // 1. UNVERIFIED EMAIL GATE AUDIT (Zero Bypass)
  // -----------------------------------------------------------------

  // 1.1 Unverified user visiting landing page ('/')
  const landingUnverified = getLandingPageRedirect(unverifiedUser, null, 'talent');
  assert(
    'NAV-01: Unverified user on landing page redirected to /auth/verify-email',
    landingUnverified === '/auth/verify-email',
    `Expected /auth/verify-email, got ${landingUnverified}`
  );

  // 1.2 Unverified user post-login redirect
  const postSignInUnverified = getPostSignInRedirect(unverifiedUser, null, 'talent');
  assert(
    'NAV-02: Unverified user post-login redirected to /auth/verify-email',
    postSignInUnverified === '/auth/verify-email',
    `Expected /auth/verify-email, got ${postSignInUnverified}`
  );

  // 1.3 Unverified user attempting direct access to protected routes
  const protectedRoutes = [
    '/profile',
    '/opportunities/create',
    '/passport',
    '/talent/dashboard',
    '/creator/dashboard',
    '/enterprise/dashboard',
    '/admin/dashboard',
    '/my-applications',
    '/onboarding',
  ];

  protectedRoutes.forEach((route) => {
    const guardAuth = getAuthenticatedGuardRedirect(unverifiedUser, null, route);
    assert(
      `NAV-03 [Bypass Defense]: Unverified user accessing ${route} blocked and redirected to /auth/verify-email`,
      guardAuth === '/auth/verify-email',
      `Route ${route} returned ${guardAuth}`
    );
  });

  // 1.4 Unverified user attempting direct role-guarded access
  const roleRoutes: { path: string; role: GigLinkRole }[] = [
    { path: '/talent/dashboard', role: 'talent' },
    { path: '/creator/dashboard', role: 'creator' },
    { path: '/enterprise/dashboard', role: 'enterprise' },
    { path: '/admin/dashboard', role: 'admin' },
  ];

  roleRoutes.forEach(({ path, role }) => {
    const roleGuard = getRoleGuardedRedirect(unverifiedUser, null, [role], role, [role], path);
    assert(
      `NAV-04 [Role Guard Defense]: Unverified user accessing ${path} redirected to /auth/verify-email`,
      roleGuard === '/auth/verify-email',
      `Path ${path} returned ${roleGuard}`
    );
  });

  // 1.5 Unverified user on /auth/verify-email is allowed without loop
  const verifyPageAccess = getAuthenticatedGuardRedirect(unverifiedUser, null, '/auth/verify-email');
  assert(
    'NAV-05: Unverified user on /auth/verify-email allowed without loop (returns null)',
    verifyPageAccess === null,
    `Expected null, got ${verifyPageAccess}`
  );

  // -----------------------------------------------------------------
  // 2. ONBOARDING GATE AUDIT
  // -----------------------------------------------------------------

  // 2.1 Incomplete onboarding on landing page
  const landingIncomplete = getLandingPageRedirect(verifiedUser, incompleteProfile, 'talent');
  assert(
    'NAV-06: Verified user with incomplete onboarding redirected to /onboarding',
    landingIncomplete === '/onboarding',
    `Expected /onboarding, got ${landingIncomplete}`
  );

  // 2.2 Incomplete onboarding post-sign-in
  const postSignInIncomplete = getPostSignInRedirect(verifiedUser, incompleteProfile, 'talent');
  assert(
    'NAV-07: Verified user with incomplete onboarding post-login redirected to /onboarding',
    postSignInIncomplete === '/onboarding',
    `Expected /onboarding, got ${postSignInIncomplete}`
  );

  // 2.3 Incomplete onboarding on /onboarding is allowed without loop
  const onboardingPageAccess = getAuthenticatedGuardRedirect(verifiedUser, incompleteProfile, '/onboarding');
  assert(
    'NAV-08: Verified user on /onboarding allowed without loop (returns null)',
    onboardingPageAccess === null,
    `Expected null, got ${onboardingPageAccess}`
  );

  // -----------------------------------------------------------------
  // 3. POST-SIGN-IN & LANDING PAGE TO DASHBOARD REDIRECTION AUDIT
  // -----------------------------------------------------------------

  // 3.1 Talent user post-sign-in -> /talent/dashboard
  const postSignInTalent = getPostSignInRedirect(verifiedUser, completedTalentProfile, 'talent');
  assert(
    'NAV-09: Verified Talent user post-sign-in routes directly to /talent/dashboard',
    postSignInTalent === '/talent/dashboard',
    `Expected /talent/dashboard, got ${postSignInTalent}`
  );

  // 3.2 Creator user post-sign-in -> /creator/dashboard
  const postSignInCreator = getPostSignInRedirect(verifiedUser, completedCreatorProfile, 'creator');
  assert(
    'NAV-10: Verified Creator user post-sign-in routes directly to /creator/dashboard',
    postSignInCreator === '/creator/dashboard',
    `Expected /creator/dashboard, got ${postSignInCreator}`
  );

  // 3.3 Enterprise user post-sign-in -> /enterprise/dashboard
  const postSignInEnterprise = getPostSignInRedirect(verifiedUser, completedEnterpriseProfile, 'enterprise');
  assert(
    'NAV-11: Verified Enterprise user post-sign-in routes directly to /enterprise/dashboard',
    postSignInEnterprise === '/enterprise/dashboard',
    `Expected /enterprise/dashboard, got ${postSignInEnterprise}`
  );

  // 3.4 Admin user post-sign-in -> /admin/dashboard
  const postSignInAdmin = getPostSignInRedirect(verifiedUser, completedAdminProfile, 'admin');
  assert(
    'NAV-12: Verified Admin user post-sign-in routes directly to /admin/dashboard',
    postSignInAdmin === '/admin/dashboard',
    `Expected /admin/dashboard, got ${postSignInAdmin}`
  );

  // 3.5 Authenticated Talent user visiting landing page ('/') -> /talent/dashboard
  const landingTalent = getLandingPageRedirect(verifiedUser, completedTalentProfile, 'talent');
  assert(
    'NAV-13: Authenticated Talent user on landing page redirected to /talent/dashboard',
    landingTalent === '/talent/dashboard',
    `Expected /talent/dashboard, got ${landingTalent}`
  );

  // 3.6 Authenticated Creator user visiting landing page ('/') -> /creator/dashboard
  const landingCreator = getLandingPageRedirect(verifiedUser, completedCreatorProfile, 'creator');
  assert(
    'NAV-14: Authenticated Creator user on landing page redirected to /creator/dashboard',
    landingCreator === '/creator/dashboard',
    `Expected /creator/dashboard, got ${landingCreator}`
  );

  // 3.7 Guest visiting landing page ('/') -> null (renders public page)
  const landingGuest = getLandingPageRedirect(null, null, 'talent');
  assert(
    'NAV-15: Guest visitor on landing page sees public ecosystem portal (returns null)',
    landingGuest === null,
    `Expected null, got ${landingGuest}`
  );

  // 3.8 Prevent sending authenticated users back to '/' when logging in from '/'
  const postSignInFromRoot = getPostSignInRedirect(verifiedUser, completedTalentProfile, 'talent', '/');
  assert(
    'NAV-16: Post-sign-in with from="/" routes to /talent/dashboard (not back to root)',
    postSignInFromRoot === '/talent/dashboard',
    `Expected /talent/dashboard, got ${postSignInFromRoot}`
  );

  // 3.9 Preserving valid deep links (e.g. /opportunities/opp_999)
  const postSignInDeepLink = getPostSignInRedirect(
    verifiedUser,
    completedTalentProfile,
    'talent',
    '/opportunities/opp_999'
  );
  assert(
    'NAV-17: Post-sign-in with valid deep-link preserves target route',
    postSignInDeepLink === '/opportunities/opp_999',
    `Expected /opportunities/opp_999, got ${postSignInDeepLink}`
  );

  // -----------------------------------------------------------------
  // 4. ROLE GUARDS & REDIRECT LOOP PREVENTIONS
  // -----------------------------------------------------------------

  // 4.1 Talent trying to access /creator/dashboard is redirected to /talent/dashboard
  const crossRoleAccess = getRoleGuardedRedirect(
    verifiedUser,
    completedTalentProfile,
    ['talent'],
    'talent',
    ['creator'],
    '/creator/dashboard'
  );
  assert(
    'NAV-18: Unauthorized role route access safely redirects to user active dashboard',
    crossRoleAccess === '/talent/dashboard',
    `Expected /talent/dashboard, got ${crossRoleAccess}`
  );

  // 4.2 Authorized role access is granted
  const authorizedRoleAccess = getRoleGuardedRedirect(
    verifiedUser,
    completedTalentProfile,
    ['talent'],
    'talent',
    ['talent'],
    '/talent/dashboard'
  );
  assert(
    'NAV-19: Authorized role route access granted (returns null)',
    authorizedRoleAccess === null,
    `Expected null, got ${authorizedRoleAccess}`
  );

  console.log(`Auth Navigation Suite: ${passed}/${total} assertions passed.\n`);

  return { total, passed, failed, details };
}
