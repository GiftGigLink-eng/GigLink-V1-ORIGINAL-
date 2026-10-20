/**
 * GigLink Payment Sandbox Guard
 *
 * Enforces server-side fail-closed isolation when running in explicit sandbox mode with a test key.
 *
 * Security Invariants:
 * 1. AI Studio indicators alone NEVER authorize bypassing production payment safeguards.
 * 2. If explicit sandbox mode (GIGLINK_ALLOW_SANDBOX_TEST_KEYS=true) is enabled with an 'sk_test_' key,
 *    all payment operations, funding initiations, confirmations, payouts, refunds, payout accounts,
 *    webhooks, and financial ledger mutations are strictly blocked fail-closed (HTTP 403 / thrown errors).
 * 3. Test keys can NEVER mutate canonical contract escrow or financial ledger records.
 */

import { Request, Response, NextFunction } from 'express';

let sandboxDisabledOverrideForTesting: boolean | null = null;

/**
 * Checks whether the payment subsystem is in the sandbox-disabled state.
 *
 * Evaluates to true if explicit sandbox mode is enabled (GIGLINK_ALLOW_SANDBOX_TEST_KEYS === 'true')
 * and the configured Paystack secret key starts with 'sk_test_'.
 */
export function isPaymentSandboxDisabled(env: Record<string, string | undefined> = process.env): boolean {
  if (sandboxDisabledOverrideForTesting !== null) {
    return sandboxDisabledOverrideForTesting;
  }
  const key = (env.PAYSTACK_SECRET_KEY || '').trim();
  const isExplicitSandbox = env.GIGLINK_ALLOW_SANDBOX_TEST_KEYS === 'true';
  return isExplicitSandbox && key.startsWith('sk_test_');
}

/**
 * Sets explicit override for isolated unit test execution.
 */
export function setPaymentSandboxDisabledForTesting(disabled: boolean | null): void {
  sandboxDisabledOverrideForTesting = disabled;
}

/**
 * Throws a fail-closed error if the payment subsystem is in sandbox-disabled state.
 */
export function assertPaymentsActive(operationName: string): void {
  if (isPaymentSandboxDisabled()) {
    throw new Error(
      `[Payment Sandbox Guard] Operation rejected: '${operationName}' is disabled in sandbox preview mode. Test keys cannot mutate canonical financial state or execute payment transactions.`
    );
  }
}

/**
 * Express middleware that rejects all payment operations with HTTP 403 when in sandbox-disabled state.
 */
export function requireActivePaymentMode(req: Request, res: Response, next: NextFunction): void {
  if (isPaymentSandboxDisabled()) {
    res.status(403).json({
      error: 'Payments are disabled in sandbox preview mode. Test keys cannot fund milestone escrow, execute payouts, process refunds, or mutate financial ledger records.',
      code: 'PAYMENTS_SANDBOX_DISABLED',
    });
    return;
  }
  next();
}
