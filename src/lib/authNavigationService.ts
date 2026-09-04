/**
 * GigLink V1 Authentication & Workspace Navigation Engine
 * 
 * Deterministic routing logic ensuring:
 * 1. Email verification is an unskippable prerequisite for workspace access.
 * 2. Authenticated users are directed to their active role Dashboard (or Onboarding if incomplete),
 *    never stranded on the public landing page.
 * 3. Protected routes prevent direct navigation bypasses for unverified accounts.
 * 4. Redirect loops are mathematically impossible.
 */

import { GigLinkRole, UserProfile, ROLE_DEFINITIONS } from '../types';

export interface RouteUserSnapshot {
  uid?: string;
  email?: string | null;
  emailVerified?: boolean;
}

/**
 * Computes destination after successful sign-in or guest route evaluation.
 */
export function getPostSignInRedirect(
  user: RouteUserSnapshot | null,
  profile: UserProfile | null,
  activeRole: GigLinkRole = 'talent',
  fromPath?: string | null
): string {
  if (!user) {
    return '/auth/login';
  }

  // 1. Mandatory Email Verification Gate
  if (!user.emailVerified) {
    return '/auth/verify-email';
  }

  // 2. Mandatory Onboarding Gate
  if (profile && profile.onboardingCompleted === false) {
    return '/onboarding';
  }

  // 3. Deep-link preservation (if coming from a valid protected route, not root or auth)
  if (
    fromPath &&
    fromPath !== '/' &&
    !fromPath.startsWith('/auth') &&
    !fromPath.startsWith('/onboarding')
  ) {
    return fromPath;
  }

  // 4. Default Authenticated Destination -> Active Role Workspace Dashboard
  return ROLE_DEFINITIONS[activeRole]?.homeRoute || '/talent/dashboard';
}

/**
 * Computes destination for an authenticated user accessing the root landing page ('/').
 * Returns null if the user is unauthenticated (guest view allowed).
 */
export function getLandingPageRedirect(
  user: RouteUserSnapshot | null,
  profile: UserProfile | null,
  activeRole: GigLinkRole = 'talent'
): string | null {
  if (!user) {
    return null; // Render Public Ecosystem Portal
  }

  // Unverified user on root landing page must be directed to verification
  if (!user.emailVerified) {
    return '/auth/verify-email';
  }

  // Incomplete onboarding user must be directed to onboarding
  if (profile && profile.onboardingCompleted === false) {
    return '/onboarding';
  }

  // Fully authenticated & verified user visiting root landing page -> Dashboard
  return ROLE_DEFINITIONS[activeRole]?.homeRoute || '/talent/dashboard';
}

/**
 * Evaluates access to standard AuthenticatedRoute (/profile, /opportunities/create, /passport, etc.).
 * Returns redirect path if access is denied/gated, or null if access is granted.
 */
export function getAuthenticatedGuardRedirect(
  user: RouteUserSnapshot | null,
  profile: UserProfile | null,
  currentPath: string
): string | null {
  if (!user) {
    return '/auth/login';
  }

  // Direct bypass attempt on unverified email
  if (!user.emailVerified) {
    if (
      !currentPath.startsWith('/auth/verify-email') &&
      !currentPath.startsWith('/auth/recovery')
    ) {
      return '/auth/verify-email';
    }
    return null;
  }

  // Incomplete onboarding gate
  if (
    profile &&
    profile.onboardingCompleted === false &&
    !currentPath.startsWith('/onboarding') &&
    !currentPath.startsWith('/auth/verify-email') &&
    !currentPath.startsWith('/auth/recovery')
  ) {
    return '/onboarding';
  }

  return null; // Access granted
}

/**
 * Evaluates access to RoleGuardedRoute (/talent/dashboard, /creator/dashboard, /enterprise/dashboard, /admin/dashboard).
 * Returns redirect path if access is denied/gated, or null if access is granted.
 */
export function getRoleGuardedRedirect(
  user: RouteUserSnapshot | null,
  profile: UserProfile | null,
  userAllowedRoles: GigLinkRole[] = ['talent'],
  activeRole: GigLinkRole = 'talent',
  allowedRoles?: GigLinkRole[],
  currentPath?: string
): string | null {
  if (!user) {
    return '/auth/login';
  }

  // Direct bypass attempt on unverified email
  if (!user.emailVerified) {
    return '/auth/verify-email';
  }

  // Incomplete onboarding gate
  if (
    profile &&
    profile.onboardingCompleted === false &&
    currentPath &&
    !currentPath.startsWith('/onboarding')
  ) {
    return '/onboarding';
  }

  // Role authorization check
  if (allowedRoles && allowedRoles.length > 0) {
    const isAuthorized = allowedRoles.some((role) => {
      if (userAllowedRoles.includes(role)) return true;
      if (
        role === 'creator' &&
        (userAllowedRoles.includes('creator') ||
          (profile?.activePersona as string) === 'client' ||
          (profile?.availablePersonas as string[])?.includes('client'))
      ) {
        return true;
      }
      return false;
    });
    if (!isAuthorized) {
      return ROLE_DEFINITIONS[activeRole]?.homeRoute || '/talent/dashboard';
    }
  }

  return null; // Access granted
}
