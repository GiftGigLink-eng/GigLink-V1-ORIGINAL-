/**
 * GigLink Payment & Escrow State Machine (Phase C-1)
 *
 * Enforces production invariants:
 * 1. FUNDED !== RELEASED !== PAID_OUT
 *    (A milestone is not paid out merely because it is released).
 * 2. Unfunded milestones cannot bypass escrow funding to reach release or payout.
 * 3. Already released or paid out milestones cannot be refunded.
 * 4. Funding cannot be duplicated once held.
 */

import { MilestoneEscrowState } from '../../types/payment';

export const VALID_PAYMENT_STATE_TRANSITIONS: Record<MilestoneEscrowState, MilestoneEscrowState[]> = {
  unfunded: ['funding_pending', 'held'],
  funding_pending: ['held', 'funding_failed', 'unfunded'],
  funding_failed: ['funding_pending', 'unfunded'],
  held: ['release_pending', 'released', 'refund_pending', 'refunded'],
  release_pending: ['released', 'payout_pending', 'paid_out', 'payout_failed', 'held'],
  released: ['payout_pending', 'paid_out', 'payout_failed'],
  payout_pending: ['paid_out', 'payout_failed'],
  payout_failed: ['payout_pending', 'paid_out'],
  paid_out: [], // Terminal settled state
  refund_pending: ['refunded', 'held'],
  refunded: [], // Terminal refunded state
};

export class InvalidPaymentStateTransitionError extends Error {
  public readonly fromState: MilestoneEscrowState;
  public readonly toState: MilestoneEscrowState;

  constructor(fromState: MilestoneEscrowState, toState: MilestoneEscrowState, reason?: string) {
    super(
      `Invalid payment state transition from '${fromState}' to '${toState}'.${
        reason ? ` Reason: ${reason}` : ''
      }`
    );
    this.name = 'InvalidPaymentStateTransitionError';
  }
}

/**
 * Checks whether transitioning from `fromState` to `toState` is permitted.
 */
export function canTransitionPaymentState(
  fromState: MilestoneEscrowState,
  toState: MilestoneEscrowState
): boolean {
  if (fromState === toState) {
    return true; // Idempotent same-state check
  }
  const allowed = VALID_PAYMENT_STATE_TRANSITIONS[fromState];
  return Array.isArray(allowed) && allowed.includes(toState);
}

/**
 * Asserts valid transition, throwing `InvalidPaymentStateTransitionError` if prohibited.
 */
export function assertValidPaymentStateTransition(
  fromState: MilestoneEscrowState,
  toState: MilestoneEscrowState,
  context?: { contractId?: string; milestoneId?: string }
): void {
  if (!canTransitionPaymentState(fromState, toState)) {
    const ctxMsg = context
      ? ` [Contract: ${context.contractId || 'unknown'}, Milestone: ${context.milestoneId || 'unknown'}]`
      : '';
    throw new InvalidPaymentStateTransitionError(
      fromState,
      toState,
      `Transition disallowed by Payment State Machine rules.${ctxMsg}`
    );
  }
}

/**
 * Helper to test if funds are currently locked in escrow.
 */
export function isEscrowHeld(state: MilestoneEscrowState): boolean {
  return state === 'held' || state === 'release_pending' || state === 'refund_pending';
}

/**
 * Helper to test if milestone has reached terminal state.
 */
export function isTerminalSettlement(state: MilestoneEscrowState): boolean {
  return state === 'paid_out' || state === 'refunded';
}
