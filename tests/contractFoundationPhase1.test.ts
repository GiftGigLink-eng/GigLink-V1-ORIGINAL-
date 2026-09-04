import {
  createContractFromApplication,
  proposeContractTerms,
  acceptContract,
  updateContractMilestone,
  addContractMilestone,
  getContractsForUser,
  getContractByApplicationId,
} from '../src/lib/contractService';
import {
  Opportunity,
  OpportunityApplication,
  GigLinkContract,
  ContractMilestone,
} from '../src/types';

export async function runContractFoundationTests() {
  console.log('========================================================================');
  console.log('STARTING PHASE 1 CONTRACT FOUNDATION LAYER TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PHASE 1 TEST ${total.toString().padStart(2, '0')}] PASS: ${title}`);
    } else {
      console.error(`❌ [PHASE 1 TEST ${total.toString().padStart(2, '0')}] FAIL: ${title} ${details || ''}`);
    }
  }

  const applicantUid = 'usr_talent_alice_101';
  const creatorUid = 'usr_client_bob_202';
  const strangerUid = 'usr_stranger_eve_404';
  const oppId = 'opp_contracts_react_505';
  const appId = `${oppId}_${applicantUid}`;

  const mockOpportunity: Opportunity = {
    id: oppId,
    title: 'Full-Stack Contract Architecture Implementation',
    creatorId: creatorUid,
    creatorName: 'Bob Builder Inc',
    organizationId: 'org_builder_corp',
    type: 'contract',
    category: 'Engineering',
    description: 'Implement first-class canonical contract layer with dual-signature acceptance.',
    requiredSkills: ['TypeScript', 'React', 'Firestore'],
    experienceLevel: 'expert',
    locationType: 'remote',
    compensationType: 'fixed',
    compensationMin: 8000,
    compensationMax: 10000,
    currency: 'USD',
    status: 'in_progress',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
  };

  const mockAcceptedApplication: OpportunityApplication = {
    id: appId,
    opportunityId: oppId,
    opportunityTitle: 'Full-Stack Contract Architecture Implementation',
    opportunityCreatorId: creatorUid,
    organizationId: 'org_builder_corp',
    applicantId: applicantUid,
    applicantDisplayName: 'Alice Developer',
    applicantEmail: 'alice.dev@example.com',
    applicantTrustTier: 'Verified Pro',
    applicantTrustScore: 92,
    applicantIdentityVerified: true,
    coverNote: 'Ready to build the robust contract foundation.',
    proposedRate: 9500,
    proposedRateType: 'fixed',
    availabilityDate: '2026-08-25',
    status: 'accepted',
    submittedAt: '2026-08-05T10:00:00.000Z',
    updatedAt: '2026-08-10T14:00:00.000Z',
    reviewedAt: '2026-08-10T14:00:00.000Z',
    creatorFeedback: 'Outstanding profile and proven track record. Accepted!',
  };

  // Test 1: Canonical Contract Creation from Accepted Application
  console.log('--- 1. Canonical Contract Creation ---');
  let contract: GigLinkContract | null = null;
  try {
    contract = await createContractFromApplication({
      application: mockAcceptedApplication,
      opportunity: mockOpportunity,
      initiatorUserId: creatorUid,
    });
  } catch (err: any) {
    console.error('Error creating contract:', err);
  }

  assert(
    'Contract is created with canonical ID matching contract_opportunityId_talentId',
    contract !== null && contract.id === `contract_${oppId}_${applicantUid}`
  );

  assert(
    'Contract initial status is draft and scopeLock totalAmount matches accepted proposedRate',
    contract?.status === 'draft' && contract?.scopeLock.totalAmount === 9500
  );

  assert(
    'Contract default milestones are seeded with 3 milestone coordinates',
    Array.isArray(contract?.milestones) && contract?.milestones.length === 3
  );

  assert(
    'Contract establishes deterministic messaging conversationId',
    contract?.conversationId === `conv_contract_${oppId}_${applicantUid}`
  );

  // Test 2: Unauthorized user cannot propose contract terms
  console.log('\n--- 2. Role Boundaries & Authorization ---');
  let unauthorizedError = false;
  try {
    if (contract) {
      await proposeContractTerms(contract.id, strangerUid, 'Eve Hacker');
    }
  } catch (err: any) {
    unauthorizedError = true;
  }
  assert('Stranger cannot propose contract terms or modify draft', unauthorizedError);

  // Test 3: Creator proposes contract terms
  console.log('\n--- 3. State Transitions & Mutual Acceptance ---');
  let proposedContract: GigLinkContract | null = null;
  try {
    if (contract) {
      proposedContract = await proposeContractTerms(contract.id, creatorUid, 'Bob Builder');
    }
  } catch (err: any) {
    console.error('Error proposing terms:', err);
  }

  assert(
    'Proposing terms marks contract as pending_acceptance and records creatorAcceptance',
    proposedContract?.status === 'pending_acceptance' &&
      proposedContract?.creatorAcceptance.accepted === true &&
      proposedContract?.creatorAcceptance.signedName === 'Bob Builder'
  );

  assert(
    'Talent acceptance remains false until talent explicitly accepts',
    proposedContract?.talentAcceptance.accepted === false
  );

  // Test 4: Talent accepts contract -> status transitions to 'active' & locks scope
  let activeContract: GigLinkContract | null = null;
  try {
    if (proposedContract) {
      activeContract = await acceptContract(proposedContract.id, applicantUid, 'Alice Developer');
    }
  } catch (err: any) {
    console.error('Error accepting contract:', err);
  }

  assert(
    'Dual acceptance transitions contract status to active',
    activeContract?.status === 'active' && activeContract?.talentAcceptance.accepted === true
  );

  assert(
    'Scope lock timestamp is set when contract becomes active',
    typeof activeContract?.scopeLock.lockedAt === 'string' && (activeContract.scopeLock.lockedAt?.length || 0) > 0
  );

  // Test 5: Milestone Submission and Review Workflow
  console.log('\n--- 4. Milestone Execution & Review Enforcement ---');
  let milestoneSubmitted: ContractMilestone | null = null;
  if (activeContract) {
    const firstMilestoneId = activeContract.milestones[0].id;
    // Talent submits deliverable
    milestoneSubmitted = await updateContractMilestone(activeContract.id, firstMilestoneId, applicantUid, {
      submission: {
        submittedBy: applicantUid,
        submittedAt: new Date().toISOString(),
        deliveryNote: 'Completed kickoff alignment doc and architecture blueprint.',
        links: ['https://github.com/giglink/architecture-spec'],
      },
      reviewState: 'submitted',
    });
  }

  assert(
    'Talent submission sets milestone reviewState to submitted',
    milestoneSubmitted?.reviewState === 'submitted' &&
      milestoneSubmitted?.submission?.deliveryNote === 'Completed kickoff alignment doc and architecture blueprint.'
  );

  // Test 6: Talent CANNOT approve their own submission
  let selfApprovalBlocked = false;
  try {
    if (activeContract) {
      const firstMilestoneId = activeContract.milestones[0].id;
      await updateContractMilestone(activeContract.id, firstMilestoneId, applicantUid, {
        reviewState: 'approved',
      });
    }
  } catch (err: any) {
    selfApprovalBlocked = true;
  }
  assert('Talent is forbidden from approving their own milestone deliverables', selfApprovalBlocked);

  // Test 7: Client approves milestone submission
  let milestoneApproved: ContractMilestone | null = null;
  if (activeContract) {
    const firstMilestoneId = activeContract.milestones[0].id;
    milestoneApproved = await updateContractMilestone(activeContract.id, firstMilestoneId, creatorUid, {
      status: 'completed',
      reviewState: 'approved',
    });
  }

  assert(
    'Client can approve deliverable, marking milestone completed with approvedAt timestamp',
    milestoneApproved?.status === 'completed' &&
      milestoneApproved?.reviewState === 'approved' &&
      typeof milestoneApproved?.approvedAt === 'string'
  );

  // Test 8: Adding/Deleting milestone in active scope is protected
  console.log('\n--- 5. Scope Modification Protection ---');
  let addInActiveBlocked = false;
  try {
    if (activeContract) {
      await addContractMilestone(activeContract.id, creatorUid, {
        title: 'Unsolicited Extra Milestone',
        description: 'New requirement added after lock',
      });
    }
  } catch (err: any) {
    addInActiveBlocked = true;
  }
  assert('Adding milestone after scope lock is blocked without draft renegotiation', addInActiveBlocked);

  // Test 9: Authoritative User Contract Queries
  console.log('\n--- 6. Authoritative Queries & Indexing ---');
  const aliceContracts = await getContractsForUser(applicantUid);
  const bobContracts = await getContractsForUser(creatorUid);
  const contractByApp = await getContractByApplicationId(appId);

  assert('Talent can query their own contracts', aliceContracts.some((c) => c.id === activeContract?.id));
  assert('Client can query their own contracts', bobContracts.some((c) => c.id === activeContract?.id));
  assert('Contract can be queried by canonical applicationId', contractByApp?.id === activeContract?.id);

  // Test 10: Trust Score and Identity Immutability
  console.log('\n--- 7. Invariant Verification ---');
  assert(
    'Contract lifecycle preserves applicant Trust Score and KYC identity verification records without alteration',
    mockAcceptedApplication.applicantTrustScore === 92 &&
      mockAcceptedApplication.applicantIdentityVerified === true &&
      mockAcceptedApplication.applicantTrustTier === 'Verified Pro'
  );

  console.log('\n========================================================================');
  console.log(`PHASE 1 CONTRACT FOUNDATION SUITE FINISHED: ${passed} / ${total} TESTS PASSED`);
  console.log('========================================================================\n');

  if (passed !== total) {
    throw new Error(`Phase 1 Test Suite failed with ${total - passed} failures.`);
  }

  return { passed, total, success: passed === total };
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('contractFoundationPhase1.test.ts')) {
  runContractFoundationTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
