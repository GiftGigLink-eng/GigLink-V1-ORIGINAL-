/**
 * Server-Authoritative Payment Authentication & Authorization Middleware (Phase C-1 Remediation)
 *
 * Implements hardened, cryptographic security boundaries for GigLink payment endpoints:
 * 1. Uses Firebase Admin SDK (getAdminAuth().verifyIdToken) for cryptographic ID-token verification.
 * 2. Explicitly validates:
 *    - JWT RS256 signature against Google public certs
 *    - Expiration (exp)
 *    - Issuer (iss: https://securetoken.google.com/giglink-bf27b)
 *    - Audience & Firebase Project (aud: giglink-bf27b)
 * 3. Derives authoritative caller UID directly from verified token claims (decoded.uid / sub).
 * 4. Strictly ignores caller-supplied identities from request body, query parameters, or URL
 *    (e.g., clientId, authorizedByUserId, userId, partnerId).
 * 5. Fails closed (HTTP 401) on missing, malformed, expired, tampered, or mismatched tokens.
 * 6. Enforces role-based contract authorization matrix against authoritative contract data.
 */

import { Request, Response, NextFunction } from 'express';
import { getAdminAuth, getTargetProjectId } from '../firebaseAdmin';
import { recordRuntimeAuthFailure } from '../ceoMetricsService';
import { GigLinkContract } from '../../types';
import { isTestRuntime } from '../../lib/contractService';
import { isTestIsolationActive } from '../../lib/financialLedgerService';

export interface VerifiedPaymentUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  claims: Record<string, any>;
  isCeo: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: VerifiedPaymentUser;
    }
  }
}

/**
 * Test mock hook for unit test isolation (prevents network requests during automated suites).
 */
export type PaymentTokenVerifier = (idToken: string) => Promise<{
  uid: string;
  email?: string;
  email_verified?: boolean;
  aud?: string;
  iss?: string;
  [key: string]: any;
} | null>;

let customTokenVerifier: PaymentTokenVerifier | null = null;

export function setTokenVerifierForTesting(verifier: PaymentTokenVerifier | null): void {
  if (verifier && (process.env?.NODE_ENV === 'production' || !isTestRuntime())) {
    throw new Error('setTokenVerifierForTesting is strictly forbidden in production.');
  }
  customTokenVerifier = verifier;
}

/**
 * Evaluates whether test-token authentication bypass is permitted.
 * STRICT SECURITY BOUNDARIES:
 * 1. Must never run in browser runtime (typeof window === 'undefined').
 * 2. Must never run if NODE_ENV === 'production'.
 * 3. A missing, empty, or ambiguous environment variable (e.g. undefined, development, staging)
 *    CANNOT enable the bypass unless explicit isolated test writers/verifiers are installed.
 * 4. Permitted ONLY when NODE_ENV === 'test' OR active test writer/verifier isolation is installed.
 */
export function isPermittedTestAuthRuntime(): boolean {
  if (typeof window !== 'undefined') return false;
  if (typeof process === 'undefined' || !process.env) return false;

  // Strict fail-closed production check
  if (process.env.NODE_ENV === 'production') return false;

  // Explicit test environment or isolated test writer/verifier active in Node
  const isExplicitTestEnv = process.env.NODE_ENV === 'test';
  const hasIsolatedTestRunner = isTestIsolationActive() || customTokenVerifier !== null;

  return isExplicitTestEnv || hasIsolatedTestRunner;
}

/**
 * Cryptographically verifies Firebase ID token server-side using Firebase Admin SDK.
 * Validates signature, expiration, issuer, audience, and project identity.
 */
export async function verifyPaymentToken(idToken: string): Promise<VerifiedPaymentUser | null> {
  if (!idToken || typeof idToken !== 'string') return null;
  const token = idToken.trim();
  if (!token) return null;

  const targetProjectId = getTargetProjectId(); // Canonical 'giglink-bf27b'
  const expectedIssuer = `https://securetoken.google.com/${targetProjectId}`;

  // 1. If a test verifier is installed (for mock unit tests), evaluate it ONLY in permitted test runtime
  if (customTokenVerifier) {
    if (!isPermittedTestAuthRuntime()) {
      console.warn('[verifyPaymentToken] Security violation: customTokenVerifier rejected in production/unauthorized runtime.');
      return null;
    }
    try {
      const decoded = await customTokenVerifier(token);
      if (!decoded || !decoded.uid) {
        return null;
      }
      // Assert audience and issuer matching target project
      if (decoded.aud && decoded.aud !== targetProjectId) {
        console.warn(`[verifyPaymentToken] Test token audience mismatch: ${decoded.aud} !== ${targetProjectId}`);
        return null;
      }
      if (decoded.iss && decoded.iss !== expectedIssuer) {
        console.warn(`[verifyPaymentToken] Test token issuer mismatch: ${decoded.iss} !== ${expectedIssuer}`);
        return null;
      }

      const uid = String(decoded.uid).trim();
      const email = String(decoded.email || `${uid}@giglink.local`).trim().toLowerCase();
      const emailVerified = Boolean(decoded.email_verified ?? true);
      const configuredCeoUid = (process.env.CEO_UID || '').replace(/^["']|["']$/g, '').trim();
      const isCeo = Boolean(configuredCeoUid && uid && uid === configuredCeoUid);

      return {
        uid,
        email,
        emailVerified,
        claims: decoded,
        isCeo,
      };
    } catch {
      return null;
    }
  }

  // 2. Deterministic test tokens for test suites (offline / unit-test execution)
  if (token === 'invalid_token' || token === 'expired_token' || token === 'tampered_token' || token === 'wrong_project_token') {
    return null;
  }
  if (token.startsWith('test_token_')) {
    // In production or unauthorized runtime, immediately reject every test_token_* token before it can authenticate
    if (!isPermittedTestAuthRuntime()) {
      console.warn('[verifyPaymentToken] Security violation: test_token_* rejected in unauthorized/production runtime.');
      return null;
    }

    const uid = token.replace('test_token_', '').trim();
    if (!uid) return null;
    const configuredCeoUid = (process.env.CEO_UID || '').replace(/^["']|["']$/g, '').trim();
    return {
      uid,
      email: `${uid}@giglink.local`,
      emailVerified: true,
      claims: {
        aud: targetProjectId,
        iss: expectedIssuer,
        sub: uid,
      },
      isCeo: Boolean(configuredCeoUid && uid && uid === configuredCeoUid),
    };
  }

  // 3. Cryptographic Firebase Admin SDK Token Verification
  try {
    const adminAuth = getAdminAuth();
    // verifyIdToken cryptographically verifies RS256 signature against Google public keys,
    // verifies expiration (exp), issuer (iss), and audience (aud: targetProjectId)
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken) {
      return null;
    }

    // Defense-in-depth: Explicit project/audience verification
    if (decodedToken.aud !== targetProjectId) {
      console.error(
        `[verifyPaymentToken] Security violation: Token audience '${decodedToken.aud}' does not match project '${targetProjectId}'.`
      );
      return null;
    }

    if (decodedToken.iss !== expectedIssuer) {
      console.error(
        `[verifyPaymentToken] Security violation: Token issuer '${decodedToken.iss}' does not match expected '${expectedIssuer}'.`
      );
      return null;
    }

    const uid = (decodedToken.uid || decodedToken.sub || '').trim();
    if (!uid) {
      console.error('[verifyPaymentToken] Security violation: Decoded token missing UID/sub claim.');
      return null;
    }

    const email = (decodedToken.email || '').trim().toLowerCase();
    const emailVerified = Boolean(decodedToken.email_verified);
    const configuredCeoUid = (process.env.CEO_UID || '').replace(/^["']|["']$/g, '').trim();
    const isCeo = Boolean(configuredCeoUid && uid && uid === configuredCeoUid);

    return {
      uid,
      email,
      emailVerified,
      claims: decodedToken,
      isCeo,
    };
  } catch (err: any) {
    // Fails closed on any verification error (expired, invalid signature, malformed, wrong project)
    console.error(`[verifyPaymentToken] Cryptographic verification failed: ${err.code || err.message}`);
    return null;
  }
}

/**
 * Express middleware requiring a cryptographically verified Firebase ID token on payment endpoints.
 */
export async function requirePaymentAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      recordRuntimeAuthFailure();
      return res.status(401).json({
        error: 'Unauthorized: Missing or malformed authorization header. A valid Bearer token is required.',
      });
    }

    const idToken = authHeader.substring(7).trim();
    if (!idToken) {
      recordRuntimeAuthFailure();
      return res.status(401).json({
        error: 'Unauthorized: Empty token provided in authorization header.',
      });
    }

    const authUser = await verifyPaymentToken(idToken);
    if (!authUser || !authUser.uid) {
      recordRuntimeAuthFailure();
      return res.status(401).json({
        error: 'Unauthorized: Invalid or expired authentication token.',
      });
    }

    // Bind authoritative verified user to request
    req.authenticatedUser = authUser;
    return next();
  } catch (err: any) {
    recordRuntimeAuthFailure();
    console.error('[requirePaymentAuth] Middleware failure:', err);
    return res.status(500).json({ error: 'Internal server error during authentication verification.' });
  }
}

/**
 * Server-authoritative contract party authorization checker.
 * Evaluates verified caller UID against authoritative contract roles.
 */
export function checkContractPartyAuthorization(
  contract: GigLinkContract,
  callerUid: string,
  options?: {
    allowCreator?: boolean;
    allowTalent?: boolean;
    isOrgAdmin?: boolean;
    isCeo?: boolean;
  }
): {
  authorized: boolean;
  role: 'creator' | 'talent' | 'org_admin' | 'admin' | 'unauthorized';
  reason?: string;
} {
  const { allowCreator = true, allowTalent = false, isOrgAdmin = false, isCeo = false } = options || {};

  if (!contract) {
    return { authorized: false, role: 'unauthorized', reason: 'Contract does not exist.' };
  }

  // Admin override (CEO or verified admin)
  if (isCeo) {
    return { authorized: true, role: 'admin' };
  }

  // Contract Creator (Client)
  if (contract.creatorId === callerUid) {
    if (allowCreator) {
      return { authorized: true, role: 'creator' };
    }
    return { authorized: false, role: 'creator', reason: 'Action not permitted for contract client.' };
  }

  // Organization Admin for the contract's organization
  if (isOrgAdmin && contract.organizationId) {
    if (allowCreator) {
      return { authorized: true, role: 'org_admin' };
    }
  }

  // Contract Talent
  if (contract.talentId === callerUid) {
    if (allowTalent) {
      return { authorized: true, role: 'talent' };
    }
    return {
      authorized: false,
      role: 'talent',
      reason: 'Unauthorized: Talent cannot fund, release, or refund their own contract escrow funds.',
    };
  }

  return {
    authorized: false,
    role: 'unauthorized',
    reason: 'Unauthorized: Caller is not an authorized party or administrator for this contract.',
  };
}
