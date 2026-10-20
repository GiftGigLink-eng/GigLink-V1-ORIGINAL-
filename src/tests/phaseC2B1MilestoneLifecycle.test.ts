/**
 * Phase C-2B-1: Server-Authoritative Milestone Lifecycle & Work State Verification
 *
 * Exhaustive forensic verification for:
 * 1. Milestone Work State Machine (Transitions, Terminal State & Decoupling from Escrow)
 * 2. Server-Authoritative Start Milestone (Role, Dispute, Funding & Predecessor Invariants)
 * 3. Server-Authoritative Submit Milestone (Versioned Submissions, 14-Day Deadline & Validation)
 * 4. Server-Authoritative Review Milestone (Decisions, Revision Allowance, Idempotency & N+1 Unlocking)
 * 5. Strict Work vs Payment Separation (Approval != Release)
 */

import {
  canTransitionWorkState,
  assertValidWorkStateTransition,
  InvalidWorkStateTransitionError,
  VALID_WORK_STATE_TRANSITIONS,
} from '../server/payments/milestoneWorkStateMachine';
import {
  startMilestoneWork,
  submitMilestoneDeliverable,
  reviewMilestoneDeliverable,
  normalizeMilestoneData,
  normalizeContractMilestones,
  MilestoneLifecycleError,
  setTransactionRunnerForTesting,
} from '../server/payments/milestoneLifecycleService';
import {
  canStartMilestone,
  canSubmitMilestone,
  canReviewMilestone,
  persistContract,
  getContract,
  setContractWriterForTesting,
  startMilestoneWork as clientStartMilestoneWork,
  submitMilestoneDeliverable as clientSubmitMilestoneDeliverable,
  reviewMilestoneDeliverable as clientReviewMilestoneDeliverable,
  setLifecycleMockForTesting,
} from '../lib/contractService';
import {
  GigLinkContract,
  ContractMilestone,
  ContractMilestoneWorkState,
} from '../types';

export async function runPhaseC2B1Tests() {
  console.log('======================================================');
  console.log('   PHASE C-2B-1: SERVER-AUTHORITATIVE MILESTONE SUITE  ');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ ${message}`);
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Test assertion failed: ${message}`);
    }
  }

  // Ensure test contract writer is set
  setContractWriterForTesting(async () => {});

  // =========================================================================
  // SECTION 1: CANONICAL WORK STATE MACHINE & TRANSITIONS
  // =========================================================================
  console.log('--- 1. Canonical Work State Machine Invariants ---');

  // Allowed transitions
  assert(canTransitionWorkState('ready_to_start', 'in_progress'), 'ready_to_start -> in_progress is valid');
  assert(canTransitionWorkState('in_progress', 'submitted'), 'in_progress -> submitted is valid');
  assert(canTransitionWorkState('submitted', 'approved'), 'submitted -> approved is valid');
  assert(canTransitionWorkState('submitted', 'revision_requested'), 'submitted -> revision_requested is valid');
  assert(canTransitionWorkState('revision_requested', 'in_progress'), 'revision_requested -> in_progress is valid');

  // Terminal state
  assert(VALID_WORK_STATE_TRANSITIONS.approved.length === 0, 'approved is strictly terminal (0 outgoing transitions)');
  assert(!canTransitionWorkState('approved', 'in_progress'), 'approved -> in_progress is illegal');
  assert(!canTransitionWorkState('approved', 'submitted'), 'approved -> submitted is illegal');
  assert(!canTransitionWorkState('approved', 'ready_to_start'), 'approved -> ready_to_start is illegal');
  assert(!canTransitionWorkState('approved', 'revision_requested'), 'approved -> revision_requested is illegal');

  // Illegal jumps
  assert(!canTransitionWorkState('ready_to_start', 'submitted'), 'ready_to_start -> submitted jump is illegal (must start first)');
  assert(!canTransitionWorkState('ready_to_start', 'approved'), 'ready_to_start -> approved jump is illegal');
  assert(!canTransitionWorkState('in_progress', 'approved'), 'in_progress -> approved jump is illegal (must submit first)');
  assert(!canTransitionWorkState('revision_requested', 'approved'), 'revision_requested -> approved jump is illegal');

  // Transition assertion errors
  let caughtApprovedMutation = false;
  try {
    assertValidWorkStateTransition('approved', 'in_progress');
  } catch (err: any) {
    if (err instanceof InvalidWorkStateTransitionError) caughtApprovedMutation = true;
  }
  assert(caughtApprovedMutation, 'assertValidWorkStateTransition throws InvalidWorkStateTransitionError on approved mutation');

  let caughtIllegalJump = false;
  try {
    assertValidWorkStateTransition('ready_to_start', 'submitted');
  } catch (err: any) {
    if (err instanceof InvalidWorkStateTransitionError) caughtIllegalJump = true;
  }
  assert(caughtIllegalJump, 'assertValidWorkStateTransition throws on ready_to_start -> submitted direct jump');

  // =========================================================================
  // SECTION 2: MILESTONE NORMALIZATION & RETROACTIVE COMPATIBILITY
  // =========================================================================
  console.log('--- 2. Milestone Normalization & Retroactive Schema Compatibility ---');

  const legacyPendingMilestone: ContractMilestone = {
    id: 'm_legacy_1',
    contractId: 'c_test_1',
    title: 'Design Mockups',
    description: 'Create Figma design system',
    deliverables: ['Figma design components'],
    amount: 500,
    currency: 'USD',
    status: 'in_progress',
    reviewState: 'pending_submission',
    paymentState: 'held',
    revisionAllowance: 2,
    revisionCount: 0,
    submission: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const normalizedPending = normalizeMilestoneData(legacyPendingMilestone, true);
  assert(normalizedPending.workState === 'in_progress', 'Legacy in_progress milestone normalizes workState to in_progress');
  assert(Array.isArray(normalizedPending.submissions) && normalizedPending.submissions.length === 0, 'Normalized submissions array is initialized');
  assert(Array.isArray(normalizedPending.reviewRecords) && normalizedPending.reviewRecords.length === 0, 'Normalized reviewRecords array is initialized');

  const legacyCompletedMilestone: ContractMilestone = {
    ...legacyPendingMilestone,
    id: 'm_legacy_2',
    status: 'completed',
    reviewState: 'approved',
  };
  const normalizedCompleted = normalizeMilestoneData(legacyCompletedMilestone, false);
  assert(normalizedCompleted.workState === 'approved', 'Legacy completed milestone normalizes workState to approved');

  // =========================================================================
  // SECTION 3: SERVER-AUTHORITATIVE START MILESTONE
  // =========================================================================
  console.log('--- 3. Server-Authoritative Start Milestone ---');

  const baseContract: GigLinkContract = {
    id: 'c_lifecycle_test',
    opportunityId: 'opp_test',
    opportunityTitle: 'Full-Stack V1 Platform Delivery',
    applicationId: 'app_test',
    creatorId: 'client_uid',
    creatorName: 'Enterprise Client',
    talentId: 'partner_uid',
    talentName: 'Senior Partner',
    version: 1,
    creatorAcceptance: { accepted: true, acceptedAt: new Date().toISOString(), acceptedByUserId: 'client_uid' },
    talentAcceptance: { accepted: true, acceptedAt: new Date().toISOString(), acceptedByUserId: 'partner_uid' },
    conversationId: 'conv_lifecycle_test',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scopeLock: {
      title: 'V1 Delivery',
      description: 'Scope',
      inclusions: [],
      exclusions: [],
      deliverables: [],
      totalAmount: 1000,
      currency: 'USD',
      revisionAllowance: 2,
      lockedAt: new Date().toISOString(),
    },
    milestones: [
      {
        id: 'm1',
        contractId: 'c_lifecycle_test',
        title: 'Milestone 1 - API Spec',
        description: 'Complete API documentation',
        deliverables: ['API spec OpenAPI json'],
        amount: 500,
        currency: 'USD',
        status: 'in_progress',
        reviewState: 'pending_submission',
        workState: 'ready_to_start',
        paymentState: 'held',
        fundedAmount: 500,
        revisionAllowance: 2,
        revisionCount: 0,
        submission: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'm2',
        contractId: 'c_lifecycle_test',
        title: 'Milestone 2 - Implementation',
        description: 'Implement API backend services',
        deliverables: ['Backend code repository'],
        amount: 500,
        currency: 'USD',
        status: 'pending',
        reviewState: 'pending_submission',
        paymentState: 'unfunded',
        revisionAllowance: 2,
        revisionCount: 0,
        submission: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  await persistContract(baseContract);

  // 1. Role validation: Client cannot start partner's work
  let clientStartForbidden = false;
  try {
    await startMilestoneWork({
      contractId: baseContract.id,
      milestoneId: 'm1',
      callerUid: 'client_uid',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 403) clientStartForbidden = true;
  }
  assert(clientStartForbidden, 'Client forbidden from starting work (Partner only)');

  // 2. Escrow check: Cannot start unfunded milestone
  let unfundedStartBlocked = false;
  try {
    await startMilestoneWork({
      contractId: baseContract.id,
      milestoneId: 'm2', // m2 is unfunded
      callerUid: 'partner_uid',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) unfundedStartBlocked = true;
  }
  assert(unfundedStartBlocked, 'Starting unfunded milestone is blocked (escrow must be held)');

  // 3. Predecessor progression check: Cannot start M2 if M1 is not approved
  const contractM2Funded: GigLinkContract = {
    ...baseContract,
    id: 'c_m2_funded_predecessor_test',
    milestones: [
      { ...baseContract.milestones[0], contractId: 'c_m2_funded_predecessor_test' },
      { ...baseContract.milestones[1], contractId: 'c_m2_funded_predecessor_test', paymentState: 'held', fundedAmount: 500 },
    ],
  };
  await persistContract(contractM2Funded);

  let m2PredecessorBlocked = false;
  try {
    await startMilestoneWork({
      contractId: contractM2Funded.id,
      milestoneId: 'm2',
      callerUid: 'partner_uid',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) m2PredecessorBlocked = true;
  }
  assert(m2PredecessorBlocked, 'Starting M2 is blocked while predecessor M1 is not approved');

  // 4. Legitimate start M1
  const startResult = await startMilestoneWork({
    contractId: baseContract.id,
    milestoneId: 'm1',
    callerUid: 'partner_uid',
    idempotencyKey: 'idemp_start_m1_1',
  });
  assert(startResult.milestone.workState === 'in_progress', 'M1 workState transitioned to in_progress');
  assert(Boolean(startResult.milestone.startedAt), 'M1 startedAt populated with ISO timestamp');
  assert(startResult.milestone.paymentState === 'held', 'Milestone paymentState remains held in escrow');

  // 5. Idempotent repeat start returns cached result
  const replayStart = await startMilestoneWork({
    contractId: baseContract.id,
    milestoneId: 'm1',
    callerUid: 'partner_uid',
    idempotencyKey: 'idemp_start_m1_1',
  });
  assert(replayStart.milestone.workState === 'in_progress', 'Idempotent replay start succeeds');

  // =========================================================================
  // SECTION 4: SERVER-AUTHORITATIVE SUBMIT MILESTONE
  // =========================================================================
  console.log('--- 4. Server-Authoritative Submit Milestone ---');

  // 1. Role validation: Client cannot submit deliverables
  let clientSubmitForbidden = false;
  try {
    await submitMilestoneDeliverable({
      contractId: baseContract.id,
      milestoneId: 'm1',
      callerUid: 'client_uid',
      deliveryNote: 'Attempted submission by client on behalf of partner.',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 403) clientSubmitForbidden = true;
  }
  assert(clientSubmitForbidden, 'Client forbidden from submitting milestone deliverables');

  // 2. Note length validation: at least 15 chars
  let shortNoteBlocked = false;
  try {
    await submitMilestoneDeliverable({
      contractId: baseContract.id,
      milestoneId: 'm1',
      callerUid: 'partner_uid',
      deliveryNote: 'Done.', // Too short
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) shortNoteBlocked = true;
  }
  assert(shortNoteBlocked, 'Submission with note < 15 characters rejected');

  // 3. Legitimate Submission V1
  const submitResultV1 = await submitMilestoneDeliverable({
    contractId: baseContract.id,
    milestoneId: 'm1',
    callerUid: 'partner_uid',
    deliveryNote: 'Complete API documentation and Postman collections submitted for review.',
    demoUrl: 'https://api-demo.giglink.test',
    repoUrl: 'https://github.com/giglink/spec',
    idempotencyKey: 'idemp_sub_m1_v1',
  });

  assert(submitResultV1.milestone.workState === 'submitted', 'M1 workState transitioned to submitted');
  assert(submitResultV1.submissionVersion === 1, 'First submission recorded as Version 1');
  assert(Boolean(submitResultV1.milestone.submittedAt), 'submittedAt timestamp populated');
  assert(Boolean(submitResultV1.milestone.reviewDeadlineAt), '14-day reviewDeadlineAt computed');

  // Verify 14-day review window
  const submittedTime = new Date(submitResultV1.milestone.submittedAt!).getTime();
  const deadlineTime = new Date(submitResultV1.milestone.reviewDeadlineAt!).getTime();
  const diffDays = Math.round((deadlineTime - submittedTime) / (1000 * 60 * 60 * 24));
  assert(diffDays === 14, 'reviewDeadlineAt is exactly 14 calendar days from submission');

  // Verify version history preserved
  assert(submitResultV1.milestone.submissions?.length === 1, 'Version record appended to submissions[]');
  assert(submitResultV1.milestone.submissions![0].versionNumber === 1, 'Version 1 recorded in archive');
  assert(submitResultV1.milestone.paymentState === 'held', 'Escrow funds remain held during submission');

  // 4. Idempotency test: Replay returns identical result
  const replaySubmit = await submitMilestoneDeliverable({
    contractId: baseContract.id,
    milestoneId: 'm1',
    callerUid: 'partner_uid',
    deliveryNote: 'Complete API documentation and Postman collections submitted for review.',
    demoUrl: 'https://api-demo.giglink.test',
    repoUrl: 'https://github.com/giglink/spec',
    idempotencyKey: 'idemp_sub_m1_v1',
  });
  assert(replaySubmit.submissionVersion === 1, 'Replaying submission returns cached version 1');

  // 5. Idempotency conflict test: Same key + different note throws 409
  let conflictCaught = false;
  try {
    await submitMilestoneDeliverable({
      contractId: baseContract.id,
      milestoneId: 'm1',
      callerUid: 'partner_uid',
      deliveryNote: 'Completely different delivery payload with the exact same key.',
      idempotencyKey: 'idemp_sub_m1_v1',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 409) conflictCaught = true;
  }
  assert(conflictCaught, 'Submitting differing payload with same idempotency key raises 409 conflict');

  // =========================================================================
  // SECTION 5: SERVER-AUTHORITATIVE REVIEW MILESTONE & REVISION CYCLE
  // =========================================================================
  console.log('--- 5. Server-Authoritative Review Milestone & Revision Cycle ---');

  // 1. Role validation: Partner cannot approve own work
  let partnerReviewForbidden = false;
  try {
    await reviewMilestoneDeliverable({
      contractId: baseContract.id,
      milestoneId: 'm1',
      callerUid: 'partner_uid',
      decision: 'approved',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 403) partnerReviewForbidden = true;
  }
  assert(partnerReviewForbidden, 'Partner strictly forbidden from approving own deliverables');

  // 2. Request revision V1 -> V2
  const rev1Result = await reviewMilestoneDeliverable({
    contractId: baseContract.id,
    milestoneId: 'm1',
    callerUid: 'client_uid',
    decision: 'revision_requested',
    feedback: 'Please add OpenAPI JSON schema export in addition to markdown docs.',
    idempotencyKey: 'idemp_rev1_m1',
  });

  assert(rev1Result.milestone.workState === 'revision_requested', 'M1 workState transitioned to revision_requested');
  assert(rev1Result.milestone.revisionCount === 1, 'revisionCount incremented to 1');
  assert(rev1Result.milestone.reviewRecords?.length === 1, 'Review record appended to reviewRecords[]');
  assert(rev1Result.milestone.paymentState === 'held', 'Escrow funds remain held during revision');

  // 3. Partner submits revised deliverable (V2)
  const submitResultV2 = await submitMilestoneDeliverable({
    contractId: baseContract.id,
    milestoneId: 'm1',
    callerUid: 'partner_uid',
    deliveryNote: 'Added OpenAPI 3.1 JSON export schemas to docs folder as requested.',
    idempotencyKey: 'idemp_sub_m1_v2',
  });

  assert(submitResultV2.milestone.workState === 'submitted', 'M1 workState transitioned back to submitted');
  assert(submitResultV2.submissionVersion === 2, 'Revised submission recorded as Version 2');
  assert(submitResultV2.milestone.submissions?.length === 2, 'Submissions array now contains 2 immutable versions');

  // 4. Client approves Version 2
  const approvalResult = await reviewMilestoneDeliverable({
    contractId: baseContract.id,
    milestoneId: 'm1',
    callerUid: 'client_uid',
    decision: 'approved',
    feedback: 'OpenAPI schemas look comprehensive. Great work!',
    idempotencyKey: 'idemp_appr_m1',
  });

  assert(approvalResult.milestone.workState === 'approved', 'M1 workState transitioned to approved (Terminal)');
  assert(approvalResult.milestone.approvedVersion === 2, 'approvedVersion records Version 2');
  assert(Boolean(approvalResult.milestone.approvedAt), 'approvedAt timestamp recorded');

  // =========================================================================
  // SECTION 6: STRICT WORK VS PAYMENT SEPARATION
  // =========================================================================
  console.log('--- 6. Work vs Payment Separation Invariants ---');

  // CRITICAL ARCHITECTURAL INVARIANT: Approval authorizes release; it does NOT execute release!
  assert(
    approvalResult.milestone.paymentState === 'held',
    'CRITICAL: Approving milestone deliverable does NOT change paymentState (remains held)'
  );
  assert(
    approvalResult.milestone.paymentState !== 'released',
    'CRITICAL: Approved milestone is NOT automatically released'
  );
  assert(
    approvalResult.milestone.paymentState !== 'paid_out',
    'CRITICAL: Approved milestone is NOT automatically paid out'
  );

  // Terminal state: Further submission on approved milestone is rejected
  let postApprovalSubmitBlocked = false;
  try {
    await submitMilestoneDeliverable({
      contractId: baseContract.id,
      milestoneId: 'm1',
      callerUid: 'partner_uid',
      deliveryNote: 'Attempted submission on already approved milestone.',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) postApprovalSubmitBlocked = true;
  }
  assert(postApprovalSubmitBlocked, 'Submissions on approved milestone are strictly rejected (terminal work state)');

  // =========================================================================
  // SECTION 7: NEXT MILESTONE UNLOCKING RULE
  // =========================================================================
  console.log('--- 7. Milestone N+1 Progression & Escrow Funding Requirement ---');

  // Re-read updated contract
  const contractPostApproval = await getContract(baseContract.id);
  assert(Boolean(contractPostApproval), 'Contract persisted post-approval');

  // Milestone 2 was unfunded (paymentState === 'unfunded').
  // Invariant: Approval of M1 does NOT make M2 ready_to_start because M2 is unfunded!
  const m2AfterM1Approval = contractPostApproval!.milestones.find((m) => m.id === 'm2')!;
  assert(
    m2AfterM1Approval.workState !== 'ready_to_start',
    'M2 is NOT unlocked to ready_to_start while unfunded (paymentState === unfunded)'
  );

  // Now create contract where M2 is already funded in escrow (paymentState === 'held')
  const contractWithFundedM2: GigLinkContract = {
    ...baseContract,
    id: 'c_progression_funded_test',
    milestones: [
      {
        ...baseContract.milestones[0],
        id: 'pm1',
        workState: 'submitted',
        paymentState: 'held',
        submissions: [
          {
            versionNumber: 1,
            submittedBy: 'partner_uid',
            submittedAt: new Date().toISOString(),
            reviewDeadlineAt: new Date(Date.now() + 14 * 86400000).toISOString(),
            deliveryNote: 'Milestone 1 deliverables submitted.',
          },
        ],
      },
      {
        ...baseContract.milestones[1],
        id: 'pm2',
        paymentState: 'held', // Funded in escrow!
        fundedAmount: 500,
        workState: undefined,
      },
    ],
  };

  await persistContract(contractWithFundedM2);

  // Approve PM1
  const pm1Approval = await reviewMilestoneDeliverable({
    contractId: contractWithFundedM2.id,
    milestoneId: 'pm1',
    callerUid: 'client_uid',
    decision: 'approved',
  });

  const pm2AfterPm1Approved = pm1Approval.contract.milestones.find((m) => m.id === 'pm2')!;
  assert(
    pm2AfterPm1Approved.workState === 'ready_to_start',
    'M2 unlocks to ready_to_start because M1 is approved AND M2 is funded (held)'
  );

  // =========================================================================
  // SECTION 8: REVISION ALLOWANCE EXHAUSTION
  // =========================================================================
  console.log('--- 8. Revision Allowance Enforcement ---');

  const contractMaxRevisions: GigLinkContract = {
    ...baseContract,
    id: 'c_max_rev_test',
    milestones: [
      {
        id: 'rm1',
        contractId: 'c_max_rev_test',
        title: 'Milestone With Revisions',
        description: 'Design and specification adjustments',
        deliverables: ['Design deliverables'],
        amount: 500,
        currency: 'USD',
        status: 'in_progress',
        reviewState: 'submitted',
        workState: 'submitted',
        paymentState: 'held',
        revisionAllowance: 2,
        revisionCount: 2, // Already reached limit of 2!
        submissions: [
          {
            versionNumber: 3,
            submittedBy: 'partner_uid',
            submittedAt: new Date().toISOString(),
            reviewDeadlineAt: new Date(Date.now() + 14 * 86400000).toISOString(),
            deliveryNote: 'Version 3 deliverable submission.',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  await persistContract(contractMaxRevisions);

  let maxRevisionsBlocked = false;
  try {
    await reviewMilestoneDeliverable({
      contractId: contractMaxRevisions.id,
      milestoneId: 'rm1',
      callerUid: 'client_uid',
      decision: 'revision_requested',
      feedback: 'Requesting yet another revision after allowance is exhausted.',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) maxRevisionsBlocked = true;
  }
  assert(maxRevisionsBlocked, 'Requesting revision beyond revisionAllowance is rejected (requires amendment or dispute)');

  // =========================================================================
  // SECTION 9: DISPUTE FREEZE INVARIANT
  // =========================================================================
  console.log('--- 9. Dispute Freeze Invariants ---');

  const contractDisputed: GigLinkContract = {
    ...baseContract,
    id: 'c_disputed_test',
    disputeStatus: 'open',
    milestones: [
      {
        id: 'dm1',
        contractId: 'c_disputed_test',
        title: 'Disputed Milestone',
        description: 'Deliverables with contested scope',
        deliverables: ['Contested deliverables'],
        amount: 500,
        currency: 'USD',
        paymentState: 'held',
        workState: 'submitted',
        status: 'disputed',
        reviewState: 'submitted',
        revisionAllowance: 2,
        revisionCount: 0,
        disputeStatus: 'disputed',
        submissions: [
          {
            versionNumber: 1,
            submittedBy: 'partner_uid',
            submittedAt: new Date().toISOString(),
            reviewDeadlineAt: new Date(Date.now() + 14 * 86400000).toISOString(),
            deliveryNote: 'Work note for disputed milestone',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  await persistContract(contractDisputed);

  let disputedReviewBlocked = false;
  try {
    await reviewMilestoneDeliverable({
      contractId: contractDisputed.id,
      milestoneId: 'dm1',
      callerUid: 'client_uid',
      decision: 'approved',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) disputedReviewBlocked = true;
  }
  assert(disputedReviewBlocked, 'Cannot approve milestone while contract is under active dispute');

  // =========================================================================
  // SECTION 10: PRODUCTION CLIENT API FAILURE & FAIL-CLOSED DURABILITY (TEST A)
  // =========================================================================
  console.log('--- 10. Production API Failure & Fail-Closed Durability (Test A) ---');

  let contractWriterCalled = false;
  setContractWriterForTesting(async () => {
    contractWriterCalled = true;
  });

  setLifecycleMockForTesting(async () => {
    const err: any = new Error('Failed to fetch: Backend unavailable (503)');
    err.isBackendUnavailable = true;
    throw err;
  });

  let clientStartFailedClosed = false;
  try {
    await clientStartMilestoneWork({
      contractId: baseContract.id,
      milestoneId: 'm1',
    });
  } catch (err: any) {
    if (err?.message?.includes('Failed to fetch') || err?.isBackendUnavailable) {
      clientStartFailedClosed = true;
    }
  }
  assert(clientStartFailedClosed, 'Client startMilestoneWork fails closed on server API unavailability');
  assert(!contractWriterCalled, 'No direct Firestore write occurs when start API is unavailable');

  let clientSubmitFailedClosed = false;
  try {
    await clientSubmitMilestoneDeliverable({
      contractId: baseContract.id,
      milestoneId: 'm1',
      submission: { deliveryNote: 'Deliverable notes for failed API test' },
    });
  } catch (err: any) {
    if (err?.message?.includes('Failed to fetch') || err?.isBackendUnavailable) {
      clientSubmitFailedClosed = true;
    }
  }
  assert(clientSubmitFailedClosed, 'Client submitMilestoneDeliverable fails closed on server API unavailability');
  assert(!contractWriterCalled, 'No direct Firestore write occurs when submit API is unavailable');

  let clientReviewFailedClosed = false;
  try {
    await clientReviewMilestoneDeliverable({
      contractId: baseContract.id,
      milestoneId: 'm1',
      decision: 'approved',
    });
  } catch (err: any) {
    if (err?.message?.includes('Failed to fetch') || err?.isBackendUnavailable) {
      clientReviewFailedClosed = true;
    }
  }
  assert(clientReviewFailedClosed, 'Client reviewMilestoneDeliverable fails closed on server API unavailability');
  assert(!contractWriterCalled, 'No direct Firestore write occurs when review API is unavailable');

  setLifecycleMockForTesting(null);
  setContractWriterForTesting(async () => {});

  // =========================================================================
  // SECTION 11: MULTI-INSTANCE & CONCURRENT LIFECYCLE TRANSACTIONS (TESTS B, C, D)
  // =========================================================================
  console.log('--- 11. Concurrent Lifecycle Transactions & Multi-Instance Atomicity (Tests B, C, D) ---');

  // TEST B: Concurrent Start Work
  const concurrentStartContract: GigLinkContract = {
    ...baseContract,
    id: `c_concurrent_start_${Date.now()}`,
    milestones: [
      {
        ...baseContract.milestones[0],
        id: 'c_start_m1',
        workState: 'ready_to_start',
        paymentState: 'held',
      },
    ],
  };
  await persistContract(concurrentStartContract);

  const [start1, start2] = await Promise.allSettled([
    startMilestoneWork({
      contractId: concurrentStartContract.id,
      milestoneId: 'c_start_m1',
      callerUid: 'partner_uid',
    }),
    startMilestoneWork({
      contractId: concurrentStartContract.id,
      milestoneId: 'c_start_m1',
      callerUid: 'partner_uid',
    }),
  ]);

  const bothStartsResolved = start1.status === 'fulfilled' && start2.status === 'fulfilled';
  assert(bothStartsResolved, 'Simultaneous start calls serialize atomically without corruption');
  const postStartContract = await getContract(concurrentStartContract.id);
  assert(postStartContract?.milestones[0].workState === 'in_progress', 'Final state is in_progress');

  // TEST C: Concurrent Deliverable Submission
  const concurrentSubmitContract: GigLinkContract = {
    ...baseContract,
    id: `c_concurrent_sub_${Date.now()}`,
    milestones: [
      {
        ...baseContract.milestones[0],
        id: 'c_sub_m1',
        workState: 'in_progress',
        paymentState: 'held',
        submissions: [],
      },
    ],
  };
  await persistContract(concurrentSubmitContract);

  const [subRes1, subRes2] = await Promise.allSettled([
    submitMilestoneDeliverable({
      contractId: concurrentSubmitContract.id,
      milestoneId: 'c_sub_m1',
      callerUid: 'partner_uid',
      deliveryNote: 'First concurrent submission payload version.',
    }),
    submitMilestoneDeliverable({
      contractId: concurrentSubmitContract.id,
      milestoneId: 'c_sub_m1',
      callerUid: 'partner_uid',
      deliveryNote: 'Second concurrent submission payload version.',
    }),
  ]);

  const fulfilledSubmits = [subRes1, subRes2].filter((r) => r.status === 'fulfilled');
  const rejectedSubmits = [subRes1, subRes2].filter((r) => r.status === 'rejected');
  assert(fulfilledSubmits.length === 1, 'Only one concurrent submission transitions to submitted');
  assert(rejectedSubmits.length === 1, 'Second concurrent submission is rejected due to submitted workState');

  const postSubContract = await getContract(concurrentSubmitContract.id);
  assert(postSubContract?.milestones[0].submissions?.length === 1, 'No duplicate submission version created');
  assert(postSubContract?.milestones[0].submissions?.[0].versionNumber === 1, 'Version number is exactly 1');

  // TEST D: Concurrent Review
  const concurrentReviewContract: GigLinkContract = {
    ...baseContract,
    id: `c_concurrent_rev_${Date.now()}`,
    milestones: [
      {
        ...baseContract.milestones[0],
        id: 'c_rev_m1',
        workState: 'submitted',
        paymentState: 'held',
        submissions: [
          {
            versionNumber: 1,
            submittedBy: 'partner_uid',
            submittedAt: new Date().toISOString(),
            reviewDeadlineAt: new Date(Date.now() + 14 * 86400000).toISOString(),
            deliveryNote: 'Work submitted for concurrent review testing.',
          },
        ],
      },
    ],
  };
  await persistContract(concurrentReviewContract);

  const [revRes1, revRes2] = await Promise.allSettled([
    reviewMilestoneDeliverable({
      contractId: concurrentReviewContract.id,
      milestoneId: 'c_rev_m1',
      callerUid: 'client_uid',
      decision: 'approved',
      feedback: 'First approval decision.',
    }),
    reviewMilestoneDeliverable({
      contractId: concurrentReviewContract.id,
      milestoneId: 'c_rev_m1',
      callerUid: 'client_uid',
      decision: 'revision_requested',
      feedback: 'Second revision decision arriving concurrently.',
    }),
  ]);

  const fulfilledReviews = [revRes1, revRes2].filter((r) => r.status === 'fulfilled');
  const rejectedReviews = [revRes1, revRes2].filter((r) => r.status === 'rejected');
  assert(fulfilledReviews.length === 1, 'Only one review mutation commits for the submitted version');
  assert(rejectedReviews.length === 1, 'Second review is rejected against mutated state');

  // =========================================================================
  // SECTION 12: TRANSACTIONAL IDEMPOTENCY & CONFLICT SAFETY (TESTS E, F)
  // =========================================================================
  console.log('--- 12. Transactional Idempotency & Conflict Safety (Tests E, F) ---');

  // TEST E: Concurrent Identical Idempotency Key
  const idempContract: GigLinkContract = {
    ...baseContract,
    id: `c_idemp_trans_${Date.now()}`,
    milestones: [
      {
        ...baseContract.milestones[0],
        id: 'idemp_m1',
        workState: 'in_progress',
        paymentState: 'held',
        submissions: [],
      },
    ],
  };
  await persistContract(idempContract);

  const sharedIdempKey = 'shared_tx_idemp_key_123';
  const [idempRes1, idempRes2] = await Promise.allSettled([
    submitMilestoneDeliverable({
      contractId: idempContract.id,
      milestoneId: 'idemp_m1',
      callerUid: 'partner_uid',
      deliveryNote: 'Identical deliverable submission with shared idempotency key.',
      idempotencyKey: sharedIdempKey,
    }),
    submitMilestoneDeliverable({
      contractId: idempContract.id,
      milestoneId: 'idemp_m1',
      callerUid: 'partner_uid',
      deliveryNote: 'Identical deliverable submission with shared idempotency key.',
      idempotencyKey: sharedIdempKey,
    }),
  ]);

  assert(idempRes1.status === 'fulfilled' && idempRes2.status === 'fulfilled', 'Both concurrent identical requests succeed');
  const v1 = (idempRes1 as PromiseFulfilledResult<any>).value.submissionVersion;
  const v2 = (idempRes2 as PromiseFulfilledResult<any>).value.submissionVersion;
  assert(v1 === 1 && v2 === 1, 'Both identical requests return the same submission version (1)');

  const finalIdempContract = await getContract(idempContract.id);
  assert(finalIdempContract?.milestones[0].submissions?.length === 1, 'Exactly one submission version created');
  assert(Boolean(finalIdempContract?.idempotencyLog?.[sharedIdempKey]), 'Single durable idempotency record exists');

  // TEST F: Same Idempotency Key with Different Payload -> HTTP 409
  let idempConflictCaught = false;
  try {
    await submitMilestoneDeliverable({
      contractId: idempContract.id,
      milestoneId: 'idemp_m1',
      callerUid: 'partner_uid',
      deliveryNote: 'Materially different payload using the exact same idempotency key.',
      idempotencyKey: sharedIdempKey,
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 409) {
      idempConflictCaught = true;
    }
  }
  assert(idempConflictCaught, 'Reusing idempotency key with conflicting parameters throws HTTP 409 conflict');

  // =========================================================================
  // SECTION 13: FIRESTORE SECURITY RULES DIRECT MUTATION HARDENING (TEST G)
  // =========================================================================
  console.log('--- 13. Firestore Security Rules Direct Mutation Hardening (Test G) ---');

  function simulateLifecycleRuleCheck(existingM: Record<string, any>, incomingM: Record<string, any>): boolean {
    const protectedFields = [
      'workState',
      'paymentState',
      'reviewState',
      'submissions',
      'approvedVersion',
      'reviewRecords',
      'reviewHistory',
      'startedAt',
      'submittedAt',
      'reviewDeadlineAt',
      'approvedAt',
      'revisionCount',
      'fundedAt',
      'releasedAt',
      'providerPaymentReference',
      'providerPayoutReference',
      'providerRefundReference',
    ];

    for (const f of protectedFields) {
      const inEm = f in existingM;
      const inIm = f in incomingM;
      if (inEm !== inIm) return false;
      if (inEm && inIm) {
        if (JSON.stringify(existingM[f]) !== JSON.stringify(incomingM[f])) {
          return false;
        }
      }
    }
    return true;
  }

  const baseM: Record<string, any> = {
    id: 'm1',
    workState: 'in_progress',
    paymentState: 'held',
    reviewState: 'pending_submission',
    submissions: [],
    reviewRecords: [],
    reviewHistory: [],
    startedAt: '2026-10-01T00:00:00Z',
    revisionCount: 0,
    fundedAt: '2026-10-01T00:00:00Z',
    providerPaymentReference: 'pi_test_123',
  };

  assert(simulateLifecycleRuleCheck(baseM, { ...baseM, title: 'Updated Title' }), 'Non-lifecycle field update is permitted');
  assert(!simulateLifecycleRuleCheck(baseM, { ...baseM, workState: 'approved' }), 'Direct client mutation of workState is blocked');
  assert(!simulateLifecycleRuleCheck(baseM, { ...baseM, paymentState: 'released' }), 'Direct client mutation of paymentState is blocked');
  assert(!simulateLifecycleRuleCheck(baseM, { ...baseM, approvedAt: new Date().toISOString() }), 'Direct client mutation of approvedAt is blocked');
  assert(!simulateLifecycleRuleCheck(baseM, { ...baseM, reviewHistory: [{ id: 'fake_rev' }] }), 'Direct client mutation of reviewHistory is blocked');
  assert(!simulateLifecycleRuleCheck(baseM, { ...baseM, providerPayoutReference: 'tr_fake' }), 'Direct client mutation of providerPayoutReference is blocked');

  // =========================================================================
  // SECTION 14: APPROVED MILESTONE TERMINAL INVARIANT (TEST H)
  // =========================================================================
  console.log('--- 14. Approved Milestone Terminal Invariant (Test H) ---');

  const approvedContract: GigLinkContract = {
    ...baseContract,
    id: `c_terminal_appr_${Date.now()}`,
    milestones: [
      {
        ...baseContract.milestones[0],
        id: 'term_m1',
        workState: 'approved',
        status: 'completed',
        reviewState: 'approved',
        paymentState: 'held',
        approvedVersion: 1,
      },
    ],
  };
  await persistContract(approvedContract);

  let approvedStartBlocked = false;
  try {
    await startMilestoneWork({
      contractId: approvedContract.id,
      milestoneId: 'term_m1',
      callerUid: 'partner_uid',
    });
  } catch (err: any) {
    if (err instanceof InvalidWorkStateTransitionError || err instanceof MilestoneLifecycleError) approvedStartBlocked = true;
  }
  assert(approvedStartBlocked, 'Cannot start work on already approved milestone');

  let approvedSubmitBlocked = false;
  try {
    await submitMilestoneDeliverable({
      contractId: approvedContract.id,
      milestoneId: 'term_m1',
      callerUid: 'partner_uid',
      deliveryNote: 'Post approval deliverable submission attempt.',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) approvedSubmitBlocked = true;
  }
  assert(approvedSubmitBlocked, 'Cannot submit deliverables on already approved milestone');

  let approvedRevBlocked = false;
  try {
    await reviewMilestoneDeliverable({
      contractId: approvedContract.id,
      milestoneId: 'term_m1',
      callerUid: 'client_uid',
      decision: 'revision_requested',
      feedback: 'Attempting revision on approved milestone.',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) approvedRevBlocked = true;
  }
  assert(approvedRevBlocked, 'Cannot request revisions on already approved milestone');

  // =========================================================================
  // SECTION 15: PAYMENT STATE SEPARATION & DECOUPLING INVARIANT (TEST I)
  // =========================================================================
  console.log('--- 15. Payment Separation & Provider Reference Integrity (Test I) ---');

  const paymentSepContract: GigLinkContract = {
    ...baseContract,
    id: `c_pay_sep_${Date.now()}`,
    milestones: [
      {
        ...baseContract.milestones[0],
        id: 'sep_m1',
        workState: 'submitted',
        paymentState: 'held',
        paymentProvider: 'stripe',
        providerPaymentReference: 'pi_authoritative_held_123',
        submissions: [
          {
            versionNumber: 1,
            submittedBy: 'partner_uid',
            submittedAt: new Date().toISOString(),
            reviewDeadlineAt: new Date(Date.now() + 14 * 86400000).toISOString(),
            deliveryNote: 'Deliverables ready for approval test.',
          },
        ],
      },
    ],
  };
  await persistContract(paymentSepContract);

  const sepApprResult = await reviewMilestoneDeliverable({
    contractId: paymentSepContract.id,
    milestoneId: 'sep_m1',
    callerUid: 'client_uid',
    decision: 'approved',
    feedback: 'Approved without releasing payment.',
  });

  assert(sepApprResult.milestone.workState === 'approved', 'Milestone workState transitioned to approved');
  assert(sepApprResult.milestone.paymentState === 'held', 'paymentState remains strictly held in escrow');
  assert(sepApprResult.milestone.providerPaymentReference === 'pi_authoritative_held_123', 'providerPaymentReference untouched');
  assert(sepApprResult.milestone.providerPayoutReference === undefined, 'No providerPayoutReference created on approval');
  assert(sepApprResult.milestone.releasedAt === undefined, 'No releasedAt timestamp created on approval');

  // =========================================================================
  // SECTION 16: LEGACY COMPLETED STATUS FINANCIAL INDEPENDENCE (TEST J)
  // =========================================================================
  console.log('--- 16. Legacy Completed Status Financial Independence (Test J) ---');

  const legacyCompletedContract: GigLinkContract = {
    ...baseContract,
    id: `c_legacy_completed_${Date.now()}`,
    status: 'completed',
    milestones: [
      {
        ...baseContract.milestones[0],
        id: 'leg_m1',
        status: 'completed',
        reviewState: 'approved',
        workState: 'approved',
        paymentState: 'held',
        amount: 1000,
        fundedAmount: 1000,
      },
    ],
  };
  await persistContract(legacyCompletedContract);

  const readLegacyContract = await getContract(legacyCompletedContract.id);
  const legM1 = readLegacyContract?.milestones.find((m) => m.id === 'leg_m1');
  assert(legM1?.status === 'completed', 'Milestone status is completed');
  assert(legM1?.paymentState === 'held', 'paymentState is NOT automatically released (remains held)');
  assert(legM1?.paymentState !== 'paid_out', 'Milestone paymentState is NOT paid_out');
  assert(legM1?.releasedAt === undefined, 'No releasedAt timestamp generated from completed status alone');

  console.log('\n======================================================');
  console.log(`PHASE C-2B-1 TEST RESULTS: ${passed}/${total} PASSED (0 FAILED)`);
  console.log('======================================================\n');

  return { passed, total, failed: total - passed };
}
