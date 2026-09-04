import {
  createOpportunity,
  getOpportunityById,
  getOpenOpportunities,
  publishOpportunity,
  closeOpportunity,
  cancelOpportunity,
  clearOpportunityStore,
} from '../lib/opportunityService';
import {
  submitOpportunityProposal,
  getProposalById,
  getProposalsForOpportunity,
  getMySubmittedProposals,
  updateProposalStatus,
  acceptOpportunityProposal,
  clearProposalStore,
} from '../lib/proposalService';
import {
  getContract,
  acceptContract,
  clearContractStore,
} from '../lib/contractService';
import { Opportunity, ProposedMilestoneItem } from '../types';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runPhase8OpportunityTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      throw new Error(`Assertion Failed: ${msg}`);
    }
  }

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err?.message || String(err) });
    }
  }

  // Setup test environment
  clearOpportunityStore();
  clearProposalStore();
  clearContractStore();

  const creatorUid = 'creator_p8_user_001';
  const talent1Uid = 'talent_p8_user_001';
  const talent2Uid = 'talent_p8_user_002';
  const strangerUid = 'stranger_p8_user_003';

  let testOppId = '';

  // ----------------------------------------------------
  // TEST SUITE 1: Opportunity Lifecycle & Discovery
  // ----------------------------------------------------
  await test('1.1 Create valid open opportunity listing', async () => {
    const oppId = await createOpportunity({
      creatorId: creatorUid,
      creatorName: 'Enterprise Client Corp',
      title: 'Full Stack Next.js Cloud Application',
      description: 'Design and build a scalable SaaS application with secure authentication and database integration.',
      type: 'contract',
      category: 'Software Development',
      requiredSkills: ['React', 'TypeScript', 'Node.js', 'Firestore'],
      experienceLevel: 'expert',
      locationType: 'remote',
      compensationType: 'fixed',
      compensationMin: 4000,
      compensationMax: 6000,
      currency: 'USD',
      minTrustScoreRequired: 60,
      status: 'open',
      deadline: '2026-12-31',
    });

    assert(Boolean(oppId), 'Opportunity ID must be returned');
    const fetched = await getOpportunityById(oppId);
    assert(fetched !== null, 'Opportunity must exist');
    assert(fetched?.title === 'Full Stack Next.js Cloud Application', 'Title must match');
    assert(fetched?.status === 'open', 'Status must be open');
    assert(fetched?.minTrustScoreRequired === 60, 'Min trust score required must match');
    testOppId = oppId;
  });

  await test('1.2 Filter and discover open opportunities', async () => {
    const openOpps = await getOpenOpportunities({
      category: 'Software Development',
      locationType: 'remote',
      searchQuery: 'Next.js',
    });

    assert(openOpps.length >= 1, 'Should find at least 1 matching opportunity');
    assert(openOpps[0].id === testOppId, 'Should match created test opportunity');
  });

  await test('1.3 Prevent non-creator from closing or cancelling an opportunity', async () => {
    let threw = false;
    try {
      await closeOpportunity(testOppId, strangerUid);
    } catch {
      threw = true;
    }
    assert(threw, 'Stranger cannot close an opportunity');
  });

  // ----------------------------------------------------
  // TEST SUITE 2: Structured Proposal Submission & Validations
  // ----------------------------------------------------
  const validMilestones: ProposedMilestoneItem[] = [
    {
      id: 'pm_1',
      title: 'Architecture Blueprint & Database Setup',
      description: 'Setup initial schemas, auth flows, and wireframes.',
      amountUSD: 1500,
      estimatedDays: 7,
      deliverables: ['Architecture Spec', 'DB Schemas'],
    },
    {
      id: 'pm_2',
      title: 'Core Business Logic & API Endpoints',
      description: 'Implement primary feature endpoints and business services.',
      amountUSD: 2500,
      estimatedDays: 14,
      deliverables: ['Backend API', 'Service Layer'],
    },
    {
      id: 'pm_3',
      title: 'UI Integration, QA Testing & Acceptance',
      description: 'Final frontend integration, automated test suite, and sign-off.',
      amountUSD: 1000,
      estimatedDays: 7,
      deliverables: ['Frontend UI', 'Automated Tests'],
    },
  ];

  await test('2.1 Submit valid structured proposal with 3 milestones ($5,000 total)', async () => {
    const proposal = await submitOpportunityProposal({
      opportunityId: testOppId,
      talentId: talent1Uid,
      coverLetter: 'I have 8+ years building TypeScript full-stack applications and can deliver this project cleanly.',
      proposedTotalUSD: 5000,
      proposedDeliveryDays: 28,
      proposedMilestones: validMilestones,
    });

    assert(proposal.status === 'submitted', 'Status must be submitted');
    assert(proposal.proposedTotalUSD === 5000, 'Total USD must equal 5000');
    assert(proposal.proposedMilestones.length === 3, 'Must have 3 proposed milestones');
    assert(proposal.talentId === talent1Uid, 'Talent ID must match');
    assert(proposal.creatorId === creatorUid, 'Creator ID must match opportunity creator');
    assert(proposal.talentTrustScore > 0, 'Talent trust score must be authoritatively populated');
  });

  await test('2.2 Submit second competing proposal from Talent 2', async () => {
    const proposal2 = await submitOpportunityProposal({
      opportunityId: testOppId,
      talentId: talent2Uid,
      coverLetter: 'Expert cloud engineer ready to start immediately with rigorous milestones.',
      proposedTotalUSD: 4800,
      proposedDeliveryDays: 21,
      proposedMilestones: [
        {
          id: 'pm_2_1',
          title: 'Design & Infrastructure',
          description: 'Cloud environment setup and spec approval.',
          amountUSD: 2000,
          estimatedDays: 7,
        },
        {
          id: 'pm_2_2',
          title: 'Full Implementation & Handoff',
          description: 'Complete codebase implementation and acceptance testing.',
          amountUSD: 2800,
          estimatedDays: 14,
        },
      ],
    });

    assert(proposal2.status === 'submitted', 'Proposal 2 status must be submitted');
    assert(proposal2.proposedTotalUSD === 4800, 'Proposal 2 total must be 4800');
  });

  await test('2.3 Block creator from submitting a proposal to their own opportunity', async () => {
    let threw = false;
    try {
      await submitOpportunityProposal({
        opportunityId: testOppId,
        talentId: creatorUid, // Attempt self-proposal
        coverLetter: 'Attempting to self-propose to my own opportunity listing.',
        proposedTotalUSD: 5000,
        proposedDeliveryDays: 14,
        proposedMilestones: validMilestones,
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('Opportunity creator cannot submit a proposal'), 'Should reject creator self-proposal');
    }
    assert(threw, 'Must throw error when creator tries to self-propose');
  });

  await test('2.4 Rejects proposals with milestone amounts sum mismatch', async () => {
    let threw = false;
    try {
      await submitOpportunityProposal({
        opportunityId: testOppId,
        talentId: 'talent_mismatch_001',
        coverLetter: 'Invalid milestone sum proposal.',
        proposedTotalUSD: 6000, // Stated total 6000, but milestones sum to 5000!
        proposedDeliveryDays: 20,
        proposedMilestones: validMilestones,
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('does not equal proposed total amount'), 'Should reject sum mismatch');
    }
    assert(threw, 'Must reject milestone sum mismatch');
  });

  // ----------------------------------------------------
  // TEST SUITE 3: Proposal Confidentiality & Review Progression
  // ----------------------------------------------------
  await test('3.1 Opportunity creator can view all submitted proposals', async () => {
    const proposals = await getProposalsForOpportunity(testOppId, creatorUid);
    assert(proposals.length === 2, 'Creator should see both competing proposals');
  });

  await test('3.2 Stranger or competing talent cannot view all proposals', async () => {
    let threw = false;
    try {
      await getProposalsForOpportunity(testOppId, talent1Uid); // Talent 1 attempting to view all proposals
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('Unauthorized'), 'Should reject unauthorized proposals listing');
    }
    assert(threw, 'Competing talent must not view all proposals');
  });

  await test('3.3 Talent can view their own submitted proposal', async () => {
    const propId = `prop_${testOppId}_${talent1Uid}`;
    const proposal = await getProposalById(propId, talent1Uid);
    assert(proposal !== null, 'Talent should retrieve their own proposal');
    assert(proposal?.talentId === talent1Uid, 'Talent ID must match');
  });

  await test('3.4 Competing talent cannot view another talent proposal', async () => {
    const propId = `prop_${testOppId}_${talent1Uid}`;
    let threw = false;
    try {
      await getProposalById(propId, talent2Uid); // Talent 2 trying to read Talent 1 proposal
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('Unauthorized'), 'Should reject unauthorized proposal read');
    }
    assert(threw, 'Competing talent must not read another talent proposal');
  });

  await test('3.5 Creator can transition proposal status to shortlisted', async () => {
    const propId = `prop_${testOppId}_${talent1Uid}`;
    const updated = await updateProposalStatus({
      proposalId: propId,
      newStatus: 'shortlisted',
      callerUserId: creatorUid,
      clientFeedback: 'Strong profile, shortlisting for final award.',
    });
    assert(updated.status === 'shortlisted', 'Status must transition to shortlisted');
    assert(updated.clientFeedback === 'Strong profile, shortlisting for final award.', 'Feedback must be saved');
  });

  // ----------------------------------------------------
  // TEST SUITE 4: Atomic Proposal Acceptance & Contract Engine Bridge
  // ----------------------------------------------------
  let generatedContractId = '';

  await test('4.1 Creator accepts proposal, atomically creating Phase 1 draft contract', async () => {
    const propId = `prop_${testOppId}_${talent1Uid}`;
    const outcome = await acceptOpportunityProposal({
      opportunityId: testOppId,
      proposalId: propId,
      creatorUserId: creatorUid,
    });

    assert(outcome.proposal.status === 'accepted', 'Proposal status must be accepted');
    assert(outcome.opportunity.status === 'in_progress', 'Opportunity status must be in_progress');
    assert(outcome.opportunity.selectedProposalId === propId, 'Opportunity must link selected proposal');
    assert(Boolean(outcome.contract.id), 'Draft contract must be generated');

    // Strict Phase 1 Invariant Check: Contract must be in DRAFT state
    assert(outcome.contract.status === 'draft', 'Generated contract must start in draft status');
    assert(outcome.contract.creatorAcceptance.accepted === false, 'Creator signature must initially be false');
    assert(outcome.contract.talentAcceptance.accepted === false, 'Talent signature must initially be false');
    assert(outcome.contract.milestones.length === 3, 'Contract must inherit 3 milestones from proposal');
    assert(outcome.contract.milestones[0].amount === 1500, 'Milestone 1 amount must be 1500');
    assert(outcome.contract.milestones[1].amount === 2500, 'Milestone 2 amount must be 2500');
    assert(outcome.contract.milestones[2].amount === 1000, 'Milestone 3 amount must be 1000');
    assert(outcome.contract.scopeLock.totalAmount === 5000, 'Scope lock total amount must equal proposal total');

    generatedContractId = outcome.contract.id;
  });

  await test('4.2 Competing proposals are automatically marked rejected upon winning award', async () => {
    const prop2Id = `prop_${testOppId}_${talent2Uid}`;
    const prop2 = await getProposalById(prop2Id, creatorUid);
    assert(prop2 !== null, 'Proposal 2 must exist');
    assert(prop2?.status === 'rejected', 'Competing proposal must be marked rejected');
  });

  await test('4.3 Prevent double acceptance on already awarded opportunity', async () => {
    const prop2Id = `prop_${testOppId}_${talent2Uid}`;
    let threw = false;
    try {
      await acceptOpportunityProposal({
        opportunityId: testOppId,
        proposalId: prop2Id,
        creatorUserId: creatorUid,
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('already awarded or closed'), 'Should reject secondary acceptance');
    }
    assert(threw, 'Cannot accept another proposal for already awarded opportunity');
  });

  await test('4.4 Bridge verification: Phase 1 mutual signing & activation succeeds on draft contract', async () => {
    // 1. Creator signs
    const afterCreatorSign = await acceptContract(generatedContractId, creatorUid, 'Enterprise Client Authorized Officer');
    assert(afterCreatorSign.creatorAcceptance.accepted === true, 'Creator must be signed');
    assert(afterCreatorSign.status === 'pending_acceptance', 'Contract must be pending_acceptance until talent signs');

    // 2. Talent signs
    const afterTalentSign = await acceptContract(generatedContractId, talent1Uid, 'Verified Talent Signature');
    assert(afterTalentSign.talentAcceptance.accepted === true, 'Talent must be signed');
    assert(afterTalentSign.status === 'active', 'Contract must activate upon mutual signing');
    assert(afterTalentSign.scopeLock.lockedAt !== null, 'Scope lock must be stamped upon activation');
  });

  return results;
}
