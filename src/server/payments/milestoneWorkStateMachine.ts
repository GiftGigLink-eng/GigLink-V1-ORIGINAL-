/**
 * GigLink Milestone Work State Machine (Phase C-2B-1)
 *
 * Implements strict, server-authoritative state transitions for deliverable work.
 * Work state is completely decoupled from payment / escrow state.
 *
 * Canonical Work Lifecycle:
 * ready_to_start -> in_progress -> submitted -> approved
 *
 * Revision Branch:
 * submitted -> revision_requested -> in_progress -> submitted
 *
 * Terminal State:
 * approved (0 outgoing transitions)
 */

import { ContractMilestoneWorkState } from '../../types';

export class InvalidWorkStateTransitionError extends Error {
  constructor(
    public readonly fromState: ContractMilestoneWorkState | string,
    public readonly toState: ContractMilestoneWorkState | string,
    public readonly reason?: string
  ) {
    super(
      `Illegal milestone work state transition from '${fromState}' to '${toState}'.${
        reason ? ` Reason: ${reason}` : ''
      }`
    );
    this.name = 'InvalidWorkStateTransitionError';
  }
}

/**
 * Authoritative map of valid outgoing work state transitions.
 * 'approved' is strictly terminal with 0 valid outgoing transitions.
 */
export const VALID_WORK_STATE_TRANSITIONS: Record<
  ContractMilestoneWorkState,
  readonly ContractMilestoneWorkState[]
> = {
  ready_to_start: ['in_progress'],
  in_progress: ['submitted'],
  submitted: ['approved', 'revision_requested'],
  revision_requested: ['in_progress'],
  approved: [], // Terminal work state
};

/**
 * Checks whether a proposed work state transition is permitted.
 */
export function canTransitionWorkState(
  from: ContractMilestoneWorkState,
  to: ContractMilestoneWorkState
): boolean {
  const allowed = VALID_WORK_STATE_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Asserts that a proposed transition is valid; throws InvalidWorkStateTransitionError if illegal.
 */
export function assertValidWorkStateTransition(
  from: ContractMilestoneWorkState,
  to: ContractMilestoneWorkState
): void {
  if (from === to) {
    return; // No-op idempotent transition
  }

  if (from === 'approved') {
    throw new InvalidWorkStateTransitionError(
      from,
      to,
      'Milestone is already approved. Approved is a terminal work state and cannot be modified.'
    );
  }

  if (from === 'ready_to_start' && to === 'submitted') {
    throw new InvalidWorkStateTransitionError(
      from,
      to,
      'Cannot submit deliverables directly from ready_to_start. Partner must explicitly start work first.'
    );
  }

  if (from === 'ready_to_start' && to === 'approved') {
    throw new InvalidWorkStateTransitionError(
      from,
      to,
      'Cannot approve an unstarted, unsubmitted milestone.'
    );
  }

  if (from === 'in_progress' && to === 'approved') {
    throw new InvalidWorkStateTransitionError(
      from,
      to,
      'Cannot approve a milestone in progress without deliverables being submitted first.'
    );
  }

  if (from === 'submitted' && to === 'in_progress') {
    throw new InvalidWorkStateTransitionError(
      from,
      to,
      'Cannot return to in_progress from submitted without a revision request from the client.'
    );
  }

  if (from === 'revision_requested' && to === 'approved') {
    throw new InvalidWorkStateTransitionError(
      from,
      to,
      'Cannot approve a milestone with pending revisions before revised work is submitted.'
    );
  }

  if (from === 'revision_requested' && to === 'submitted') {
    throw new InvalidWorkStateTransitionError(
      from,
      to,
      'Cannot submit directly from revision_requested without returning through in_progress to resume work.'
    );
  }

  if (!canTransitionWorkState(from, to)) {
    throw new InvalidWorkStateTransitionError(from, to, 'Transition is not in the canonical work lifecycle.');
  }
}
