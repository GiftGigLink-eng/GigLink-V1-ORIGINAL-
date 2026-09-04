/**
 * Phase 2 Contract Execution & Project Delivery Test Suite
 * Tests milestone submissions, client review decisions, revision history tracking,
 * sequential milestone unlocking, final handover submissions, project completion,
 * and role-based access validation.
 */

import {
  canSubmitMilestone,
  canReviewMilestone,
  canSubmitFinalHandover,
  canAcceptFinalHandover,
  getContractProgress,
} from '../lib/contractService';
import { deriveContractNotifications } from '../lib/notificationService';
import { GigLinkContract, ContractMilestone } from '../types';

function createMockContract(): GigLinkContract {
  const milestone1: ContractMilestone = {
    id: 'm1',
    contractId: 'contract_test_1',
    title: 'Milestone 1: Wireframes & Architecture',
    description: 'Provide system architecture and Figma mockups',
    deliverables: ['System diagram', 'Figma links'],
    amount: 500,
    currency: 'USD',
    status: 'in_progress',
    reviewState: 'pending_submission',
    revisionAllowance: 2,
    revisionCount: 0,
    paymentState: 'held',
    submission: null,
    reviewHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const milestone2: ContractMilestone = {
    id: 'm2',
    contractId: 'contract_test_1',
    title: 'Milestone 2: Frontend & API Implementation',
    description: 'Implement full-stack functional application',
    deliverables: ['Frontend app', 'API server'],
    amount: 1000,
    currency: 'USD',
    status: 'pending',
    reviewState: 'pending_submission',
    revisionAllowance: 2,
    revisionCount: 0,
    paymentState: 'held',
    submission: null,
    reviewHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    id: 'contract_test_1',
    opportunityId: 'opp_123',
    opportunityTitle: 'Full-Stack Developer Contract',
    applicationId: 'app_123',
    creatorId: 'client_uid',
    creatorName: 'Alice Client',
    talentId: 'talent_uid',
    talentName: 'Bob Talent',
    talentEmail: 'bob@example.com',
    status: 'active',
    version: 1,
    scopeLock: {
      title: 'Full-Stack Developer Contract',
      description: 'Scope-locked agreement for project delivery',
      inclusions: ['Frontend', 'Backend', 'Deployment'],
      exclusions: ['Native mobile app'],
      deliverables: ['Web app', 'Documentation'],
      totalAmount: 1500,
      currency: 'USD',
      revisionAllowance: 2,
      lockedAt: new Date().toISOString(),
    },
    originalScope: {
      title: 'Full-Stack Developer Contract',
      description: 'Scope-locked agreement for project delivery',
      inclusions: ['Frontend', 'Backend', 'Deployment'],
      exclusions: ['Native mobile app'],
      deliverables: ['Web app', 'Documentation'],
      totalAmount: 1500,
      currency: 'USD',
      revisionAllowance: 2,
      lockedAt: new Date().toISOString(),
    },
    milestones: [milestone1, milestone2],
    changeRequests: [],
    amendmentHistory: [],
    creatorAcceptance: {
      accepted: true,
      acceptedAt: new Date().toISOString(),
      acceptedByUserId: 'client_uid',
      signedName: 'Alice Client',
    },
    talentAcceptance: {
      accepted: true,
      acceptedAt: new Date().toISOString(),
      acceptedByUserId: 'talent_uid',
      signedName: 'Bob Talent',
    },
    conversationId: 'chat_opp_123',
    finalHandover: null,
    activatedAt: new Date().toISOString(),
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runTestSuite() {
  console.log('\n--- Running Phase 2 Contract Execution & Project Delivery Test Suite ---\n');

  // TEST 1: Milestone Submission Permissions
  console.log('1. Testing Milestone Submission Permissions:');
  const contract = createMockContract();

  // Talent can submit Milestone 1
  const submitCheck1 = canSubmitMilestone(contract, 'm1', 'talent_uid');
  assert(submitCheck1.allowed, 'Talent is allowed to submit milestone 1 when pending_submission');

  // Client cannot submit Milestone 1 (only talent can deliver)
  const submitCheckClient = canSubmitMilestone(contract, 'm1', 'client_uid');
  assert(!submitCheckClient.allowed, 'Client is blocked from submitting milestone deliverables');

  // Random user cannot submit
  const submitCheckRandom = canSubmitMilestone(contract, 'm1', 'stranger_uid');
  assert(!submitCheckRandom.allowed, 'Unauthorized third-party is blocked from submitting');

  // Sequential Locking: Talent CANNOT submit Milestone 2 while Milestone 1 is incomplete
  const submitCheck2Locked = canSubmitMilestone(contract, 'm2', 'talent_uid');
  assert(!submitCheck2Locked.allowed, 'Milestone 2 is locked until Milestone 1 is approved');
  assert(submitCheck2Locked.reason?.includes('Previous milestone') || false, 'Lock reason accurately explains sequential dependency');

  // TEST 2: Milestone Review Permissions
  console.log('\n2. Testing Milestone Review Permissions:');
  // Simulate talent submitting m1
  contract.milestones[0].reviewState = 'submitted';
  contract.milestones[0].submission = {
    submittedBy: 'talent_uid',
    submittedAt: new Date().toISOString(),
    deliveryNote: 'First draft completed and ready for review.',
    demoUrl: 'https://demo.example.com',
  };

  // Talent CANNOT review / approve own milestone
  const talentReviewSelf = canReviewMilestone(contract, 'm1', 'talent_uid');
  assert(!talentReviewSelf.allowed, 'Talent CANNOT approve or review their own milestone submission');

  // Client CAN review submitted milestone
  const clientReview = canReviewMilestone(contract, 'm1', 'client_uid');
  assert(clientReview.allowed, 'Client is authorized to review submitted milestone deliverable');

  // Cannot review milestone 2 which has not yet been submitted
  const clientReviewM2 = canReviewMilestone(contract, 'm2', 'client_uid');
  assert(!clientReviewM2.allowed, 'Cannot review milestone 2 before deliverable is submitted');

  // TEST 3: Revision Cycle and Sequential Milestone Progression
  console.log('\n3. Testing Revision Cycle & Sequential Progression:');
  // Client requests revision on m1
  contract.milestones[0].reviewState = 'revision_requested';
  contract.milestones[0].revisionCount = 1;
  contract.milestones[0].reviewHistory = [
    {
      id: 'rev_1',
      revisionNumber: 1,
      reviewedBy: 'client_uid',
      reviewerName: 'Alice Client',
      reviewedAt: new Date().toISOString(),
      decision: 'revision_requested',
      feedback: 'Please update the color palette to match brand specs.',
    },
  ];

  // Talent can now submit revision
  const submitRevisionCheck = canSubmitMilestone(contract, 'm1', 'talent_uid');
  assert(submitRevisionCheck.allowed, 'Talent can submit a revision when revision_requested');

  // Now simulate approval of Milestone 1
  contract.milestones[0].status = 'completed';
  contract.milestones[0].reviewState = 'approved';
  contract.milestones[0].approvedAt = new Date().toISOString();
  // Next milestone unlocked
  contract.milestones[1].status = 'in_progress';

  // Now Milestone 2 can be submitted by talent!
  const submitCheck2Unlocked = canSubmitMilestone(contract, 'm2', 'talent_uid');
  assert(submitCheck2Unlocked.allowed, 'Milestone 2 unlocked for submission after Milestone 1 approval');

  // TEST 4: Final Handover Validation Rules
  console.log('\n4. Testing Final Handover Pre-flight Conditions:');
  // While Milestone 2 is not approved, final handover CANNOT be submitted
  const handoverBlockedCheck = canSubmitFinalHandover(contract, 'talent_uid');
  assert(!handoverBlockedCheck.allowed, 'Final handover blocked while milestone 2 is unapproved');

  // Approve Milestone 2
  contract.milestones[1].status = 'completed';
  contract.milestones[1].reviewState = 'approved';
  contract.milestones[1].approvedAt = new Date().toISOString();

  // Progress helper calculation
  const progress = getContractProgress(contract);
  assert(progress.allApproved === true, 'All milestones marked as approved in contract progress');
  assert(progress.percentage === 100, 'Contract progress is 100%');

  // Now talent can submit final handover
  const handoverAllowedCheck = canSubmitFinalHandover(contract, 'talent_uid');
  assert(handoverAllowedCheck.allowed, 'Talent can submit final handover once all milestones are approved');

  // Client cannot submit final handover (talent delivers it)
  const clientHandoverCheck = canSubmitFinalHandover(contract, 'client_uid');
  assert(!clientHandoverCheck.allowed, 'Client cannot submit final handover on behalf of talent');

  // TEST 5: Final Handover Acceptance & Project Completion
  console.log('\n5. Testing Final Handover Acceptance & Project Completion:');
  // Before talent submits, client cannot accept handover
  const clientAcceptBeforeSubmission = canAcceptFinalHandover(contract, 'client_uid');
  assert(!clientAcceptBeforeSubmission.allowed, 'Client cannot accept handover before talent submits package');

  // Talent submits handover package
  contract.finalHandover = {
    finalProjectUrl: 'https://app.production.com',
    repoUrl: 'https://github.com/org/repo',
    documentationUrl: 'https://docs.org/project',
    credentialsHandoverConfirmed: true,
    finalNotes: 'All master branches merged and production credentials securely transferred.',
    status: 'submitted',
    submittedBy: 'talent_uid',
    submittedAt: new Date().toISOString(),
  };

  // Talent CANNOT accept their own final handover
  const talentAcceptCheck = canAcceptFinalHandover(contract, 'talent_uid');
  assert(!talentAcceptCheck.allowed, 'Talent cannot self-accept final handover');

  // Client CAN accept final handover
  const clientAcceptCheck = canAcceptFinalHandover(contract, 'client_uid');
  assert(clientAcceptCheck.allowed, 'Client is authorized to accept final handover and conclude project');

  // Simulate accepted handover
  contract.finalHandover.status = 'accepted';
  contract.finalHandover.acceptedBy = 'client_uid';
  contract.finalHandover.acceptedAt = new Date().toISOString();
  contract.status = 'completed';
  contract.completedAt = new Date().toISOString();

  const finalProgress = getContractProgress(contract);
  assert(finalProgress.isCompleted === true, 'Contract is marked completed');
  assert(finalProgress.hasFinalHandoverAccepted === true, 'Final handover is recorded as accepted');

  // TEST 6: Derived Notifications
  console.log('\n6. Testing Derived Notification Generation:');
  const clientNotifications = deriveContractNotifications(contract, 'client_uid');
  const talentNotifications = deriveContractNotifications(contract, 'talent_uid');

  assert(clientNotifications.length > 0, 'Client receives derived completion notifications');
  assert(talentNotifications.length > 0, 'Talent receives derived completion notifications');
  assert(clientNotifications.some((n) => n.type === 'project_completed'), 'Client received project completion notification');
  assert(talentNotifications.some((n) => n.type === 'project_completed'), 'Talent received project completion notification');

  console.log(`\n========================================`);
  console.log(`All ${passedTests}/${totalTests} tests passed successfully!`);
  console.log(`========================================\n`);
}

runTestSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
