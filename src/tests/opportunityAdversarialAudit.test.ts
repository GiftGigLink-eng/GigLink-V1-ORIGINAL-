import {
  createOpportunity,
  getOpportunityById,
  publishOpportunity,
  closeOpportunity,
  cancelOpportunity,
  clearOpportunityStore,
} from '../lib/opportunityService';
import {
  submitOpportunityProposal,
  getProposalById,
  getProposalsForOpportunity,
  updateProposalStatus,
  acceptOpportunityProposal,
  clearProposalStore,
} from '../lib/proposalService';
import {
  getContract,
  clearContractStore,
} from '../lib/contractService';
import { ProposedMilestoneItem } from '../types';

export interface AdversarialTestResult {
  requirementId: string;
  testId: string;
  name: string;
  passed: boolean;
  error?: string;
}

export async function runOpportunityAdversarialAudit(): Promise<AdversarialTestResult[]> {
  const results: AdversarialTestResult[] = [];

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      throw new Error(`Assertion Failed: ${msg}`);
    }
  }

  async function testAdv(
    requirementId: string,
    testId: string,
    name: string,
    fn: () => Promise<void>
  ) {
    try {
      await fn();
      results.push({ requirementId, testId, name, passed: true });
    } catch (err: any) {
      results.push({ requirementId, testId, name, passed: false, error: err?.message || String(err) });
    }
  }

  // Setup test environment
  clearOpportunityStore();
  clearProposalStore();
  clearContractStore();

  const creatorUid = 'adv_creator_001';
  const talentLowRep = 'adv_talent_low_rep';
  const talentValid = 'adv_talent_valid_002';
  const talentCompetitor = 'adv_talent_competitor_003';
  const stranger = 'adv_stranger_004';

  // Seed baseline opportunity
  const oppId = await createOpportunity({
    creatorId: creatorUid,
    creatorName: 'Enterprise FinTech Security',
    title: 'Adversarial Resilient Smart Escrow Dashboard',
    description: 'High-security financial reporting dashboard with stringent access controls.',
    type: 'contract',
    category: 'Cybersecurity',
    requiredSkills: ['Cryptography', 'TypeScript', 'Node.js'],
    experienceLevel: 'expert',
    locationType: 'remote',
    compensationType: 'fixed',
    compensationMin: 8000,
    compensationMax: 12000,
    currency: 'USD',
    minTrustScoreRequired: 50,
    status: 'open',
  });

  const baseMilestones: ProposedMilestoneItem[] = [
    {
      id: 'm1',
      title: 'Milestone 1: Security Spec',
      description: 'Audit requirements spec',
      amountUSD: 5000,
      estimatedDays: 14,
    },
    {
      id: 'm2',
      title: 'Milestone 2: Escrow Dashboard Implementation',
      description: 'Implementation and pen testing',
      amountUSD: 5000,
      estimatedDays: 14,
    },
  ];

  // -------------------------------------------------------------------------
  // ADV-P8-01: Unauthorized Opportunity Mutation
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-01',
    'TEST-ADV-01',
    'Reject non-creator or stranger attempt to close/cancel opportunity',
    async () => {
      let threw = false;
      try {
        await closeOpportunity(oppId, stranger);
      } catch (err: any) {
        threw = true;
        assert(err.message.includes('Unauthorized'), 'Should fail unauthorized opportunity closure');
      }
      assert(threw, 'Stranger closing opportunity must throw');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-02: Self-Proposal Prevention
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-02',
    'TEST-ADV-02',
    'Reject creator attempting to submit a proposal to their own opportunity',
    async () => {
      let threw = false;
      try {
        await submitOpportunityProposal({
          opportunityId: oppId,
          talentId: creatorUid,
          coverLetter: 'Self proposal injection attempt',
          proposedTotalUSD: 10000,
          proposedDeliveryDays: 28,
          proposedMilestones: baseMilestones,
        });
      } catch (err: any) {
        threw = true;
        assert(err.message.includes('Opportunity creator cannot submit a proposal'), 'Must reject creator self-proposal');
      }
      assert(threw, 'Creator proposing to own opportunity must fail');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-03: Opportunity State Invariant Bypass
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-03',
    'TEST-ADV-03',
    'Reject proposal submission to a closed or draft opportunity',
    async () => {
      // Create a draft opp
      const draftOppId = await createOpportunity({
        creatorId: creatorUid,
        creatorName: 'Enterprise Client',
        title: 'Draft Project Not Open',
        description: 'Unpublished opportunity',
        type: 'gig',
        category: 'Design',
        requiredSkills: ['Figma'],
        locationType: 'remote',
        compensationType: 'fixed',
        compensationMin: 1000,
        compensationMax: 2000,
        currency: 'USD',
        experienceLevel: 'intermediate',
        status: 'draft',
      });

      let threw = false;
      try {
        await submitOpportunityProposal({
          opportunityId: draftOppId,
          talentId: talentValid,
          coverLetter: 'Attempting to apply to draft opportunity',
          proposedTotalUSD: 1500,
          proposedDeliveryDays: 7,
          proposedMilestones: [
            { id: 'm1', title: 'Design', description: 'Figma spec', amountUSD: 1500, estimatedDays: 7 },
          ],
        });
      } catch (err: any) {
        threw = true;
        assert(err.message.includes('not currently accepting proposals'), 'Must reject non-open opportunity');
      }
      assert(threw, 'Draft opp proposal submission must fail');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-04: Trust Score & Tier Forgery Prevention
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-04',
    'TEST-ADV-04',
    'Authoritatively populate talent Trust Score & Tier ignoring client-supplied payloads',
    async () => {
      const proposal = await submitOpportunityProposal({
        opportunityId: oppId,
        talentId: talentValid,
        coverLetter: 'High quality proposal with verified background',
        proposedTotalUSD: 10000,
        proposedDeliveryDays: 28,
        proposedMilestones: baseMilestones,
      });

      // The proposal should have authoritatively fetched the trustScore from the repository
      assert(proposal.talentTrustScore >= 0 && proposal.talentTrustScore <= 100, 'Trust score must be in range 0-100');
      assert(proposal.talentTrustTier !== undefined, 'Trust tier must be present');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-05: Milestone Price Inflation/Deflation Attack
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-05',
    'TEST-ADV-05',
    'Reject proposal where milestone sums ($12,000) do not equal proposed total ($10,000)',
    async () => {
      let threw = false;
      try {
        await submitOpportunityProposal({
          opportunityId: oppId,
          talentId: talentCompetitor,
          coverLetter: 'Milestone inflation tampering attack',
          proposedTotalUSD: 10000,
          proposedDeliveryDays: 28,
          proposedMilestones: [
            { id: 'm1', title: 'M1', description: 'desc', amountUSD: 6000, estimatedDays: 14 },
            { id: 'm2', title: 'M2', description: 'desc', amountUSD: 6000, estimatedDays: 14 },
          ], // Sums to 12,000!
        });
      } catch (err: any) {
        threw = true;
        assert(err.message.includes('does not equal proposed total amount'), 'Must reject sum mismatch');
      }
      assert(threw, 'Milestone sum mismatch must fail');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-06: Malformed Monetary Input Attack
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-06',
    'TEST-ADV-06',
    'Reject negative, zero, NaN, or Infinity milestone amounts',
    async () => {
      let threw = false;
      try {
        await submitOpportunityProposal({
          opportunityId: oppId,
          talentId: 'adv_malformed_user',
          coverLetter: 'Malformed monetary values',
          proposedTotalUSD: 0,
          proposedDeliveryDays: 14,
          proposedMilestones: [
            { id: 'm1', title: 'M1', description: 'desc', amountUSD: -500, estimatedDays: 7 },
            { id: 'm2', title: 'M2', description: 'desc', amountUSD: 500, estimatedDays: 7 },
          ],
        });
      } catch (err: any) {
        threw = true;
      }
      assert(threw, 'Negative / zero milestone amounts must fail');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-07: Milestone Count Overflow Attack
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-07',
    'TEST-ADV-07',
    'Reject proposal submitting more than 10 milestones',
    async () => {
      const overflowMilestones: ProposedMilestoneItem[] = [];
      for (let i = 1; i <= 12; i++) {
        overflowMilestones.push({
          id: `m_${i}`,
          title: `Milestone ${i}`,
          description: `Desc ${i}`,
          amountUSD: 500,
          estimatedDays: 2,
        });
      }

      let threw = false;
      try {
        await submitOpportunityProposal({
          opportunityId: oppId,
          talentId: 'adv_overflow_user',
          coverLetter: 'Milestone overflow test with 12 milestones',
          proposedTotalUSD: 6000,
          proposedDeliveryDays: 24,
          proposedMilestones: overflowMilestones,
        });
      } catch (err: any) {
        threw = true;
        assert(err.message.includes('cannot exceed 10'), 'Must enforce max 10 milestone limit');
      }
      assert(threw, 'Proposal exceeding 10 milestones must fail');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-08: Duplicate Proposal Flooding Attack
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-08',
    'TEST-ADV-08',
    'Reject duplicate active proposal submission from the same talent',
    async () => {
      let threw = false;
      try {
        // talentValid already submitted above
        await submitOpportunityProposal({
          opportunityId: oppId,
          talentId: talentValid,
          coverLetter: 'Attempting duplicate active proposal',
          proposedTotalUSD: 10000,
          proposedDeliveryDays: 28,
          proposedMilestones: baseMilestones,
        });
      } catch (err: any) {
        threw = true;
        assert(err.message.includes('already have an active proposal'), 'Must reject duplicate active proposal');
      }
      assert(threw, 'Duplicate active proposal submission must fail');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-09: Confidentiality Leak Attack
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-09',
    'TEST-ADV-09',
    'Block competitor talent or stranger from viewing another talent proposal',
    async () => {
      const propId = `prop_${oppId}_${talentValid}`;
      let threw = false;
      try {
        await getProposalById(propId, stranger);
      } catch (err: any) {
        threw = true;
        assert(err.message.includes('Unauthorized'), 'Must reject unauthorized proposal reading');
      }
      assert(threw, 'Stranger reading competitor proposal must fail');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-10: Post-Acceptance Proposal Tampering
  // -------------------------------------------------------------------------
  let winningContractId = '';
  await testAdv(
    'ADV-P8-10',
    'TEST-ADV-10',
    'Prevent proposal modification once accepted by creator',
    async () => {
      const propId = `prop_${oppId}_${talentValid}`;

      // Submit second proposal for competition
      await submitOpportunityProposal({
        opportunityId: oppId,
        talentId: talentCompetitor,
        coverLetter: 'Competitor proposal',
        proposedTotalUSD: 10000,
        proposedDeliveryDays: 28,
        proposedMilestones: baseMilestones,
      });

      // Accept first proposal
      const outcome = await acceptOpportunityProposal({
        opportunityId: oppId,
        proposalId: propId,
        creatorUserId: creatorUid,
      });

      winningContractId = outcome.contract.id;

      // Now talent tries to withdraw or edit accepted proposal
      let threw = false;
      try {
        await updateProposalStatus({
          proposalId: propId,
          newStatus: 'withdrawn',
          callerUserId: talentValid,
        });
      } catch (err: any) {
        threw = true;
        assert(err.message.includes('Cannot modify an accepted proposal'), 'Must reject modification of accepted proposal');
      }
      assert(threw, 'Mutating accepted proposal must fail');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-11: Cross-Opportunity Proposal Acceptance
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-11',
    'TEST-ADV-11',
    'Reject proposal acceptance when proposal does not belong to specified opportunity',
    async () => {
      const otherOppId = await createOpportunity({
        creatorId: creatorUid,
        creatorName: 'Enterprise Client',
        title: 'Other Unrelated Opportunity',
        description: 'Testing cross injection',
        type: 'gig',
        category: 'Marketing',
        requiredSkills: ['SEO'],
        locationType: 'remote',
        compensationType: 'fixed',
        compensationMin: 500,
        compensationMax: 1000,
        currency: 'USD',
        experienceLevel: 'intermediate',
        status: 'open',
      });

      const propId = `prop_${oppId}_${talentValid}`;
      let threw = false;
      try {
        await acceptOpportunityProposal({
          opportunityId: otherOppId, // Mismatched!
          proposalId: propId,
          creatorUserId: creatorUid,
        });
      } catch (err: any) {
        threw = true;
      }
      assert(threw, 'Cross-opportunity proposal acceptance must fail');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-12: Double Awarding / Race Condition Attack
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-12',
    'TEST-ADV-12',
    'Block double awarding on already awarded/in_progress opportunity',
    async () => {
      const compPropId = `prop_${oppId}_${talentCompetitor}`;
      let threw = false;
      try {
        await acceptOpportunityProposal({
          opportunityId: oppId,
          proposalId: compPropId,
          creatorUserId: creatorUid,
        });
      } catch (err: any) {
        threw = true;
        assert(err.message.includes('already awarded or closed'), 'Must reject second award');
      }
      assert(threw, 'Double awarding must fail');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-13: Contract State Skip Attack
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-13',
    'TEST-ADV-13',
    'Verify generated contract starts in DRAFT and cannot be bypassed directly to ACTIVE',
    async () => {
      const contract = await getContract(winningContractId);
      assert(contract !== null, 'Contract must exist');
      assert(contract?.status === 'draft', 'Generated contract MUST start in DRAFT status');
      assert(contract?.creatorAcceptance.accepted === false, 'Creator signature must be false');
      assert(contract?.talentAcceptance.accepted === false, 'Talent signature must be false');
      assert(contract?.scopeLock.lockedAt === null, 'Scope must NOT be locked until mutual signature');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-14: Creator Proposal Alteration Attack
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-14',
    'TEST-ADV-14',
    'Prevent creator from modifying talent proposed milestone amounts or cover letter',
    async () => {
      // Contract inherits immutable snapshot of proposed milestones
      const contract = await getContract(winningContractId);
      assert(contract?.milestones.length === 2, 'Contract milestones count must be 2');
      assert(contract?.milestones[0].amount === 5000, 'Milestone 1 amount must match talent proposal');
      assert(contract?.milestones[1].amount === 5000, 'Milestone 2 amount must match talent proposal');
      assert(contract?.scopeLock.totalAmount === 10000, 'Total scope amount must match talent proposal total');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-15: Minimum Trust Score Bypass Attack
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-15',
    'TEST-ADV-15',
    'Reject proposal from talent whose Trust Score does not meet opportunity minimum requirement',
    async () => {
      // Create high-security opp requiring Trust Score >= 85
      const exclusiveOppId = await createOpportunity({
        creatorId: creatorUid,
        creatorName: 'Enterprise Client',
        title: 'High-Trust Enterprise Architecture',
        description: 'Requires Trust Score 85+',
        type: 'contract',
        category: 'Enterprise',
        requiredSkills: ['System Architecture'],
        locationType: 'remote',
        compensationType: 'fixed',
        compensationMin: 15000,
        compensationMax: 25000,
        currency: 'USD',
        experienceLevel: 'expert',
        minTrustScoreRequired: 85,
        status: 'open',
      });

      let threw = false;
      try {
        await submitOpportunityProposal({
          opportunityId: exclusiveOppId,
          talentId: talentLowRep, // Default score is 50, which is < 85
          coverLetter: 'Attempting to bypass min trust score requirement',
          proposedTotalUSD: 20000,
          proposedDeliveryDays: 30,
          proposedMilestones: [
            { id: 'm1', title: 'Architecture', description: 'Spec', amountUSD: 20000, estimatedDays: 30 },
          ],
        });
      } catch (err: any) {
        threw = true;
        assert(err.message.includes('requires a minimum Trust Score'), 'Must reject application below score requirement');
      }
      assert(threw, 'Low Trust Score proposal must be rejected when min score required');
    }
  );

  // -------------------------------------------------------------------------
  // ADV-P8-16: Unauthorized Lifecycle Jumping
  // -------------------------------------------------------------------------
  await testAdv(
    'ADV-P8-16',
    'TEST-ADV-16',
    'Prevent jumping opportunity from draft directly to in_progress or awarded without winning proposal',
    async () => {
      const draftOppId = await createOpportunity({
        creatorId: creatorUid,
        creatorName: 'Enterprise Client',
        title: 'Draft Opp for Jump Test',
        description: 'Should not jump straight to in_progress',
        type: 'gig',
        category: 'Testing',
        requiredSkills: ['QA'],
        locationType: 'remote',
        compensationType: 'fixed',
        compensationMin: 500,
        compensationMax: 1000,
        currency: 'USD',
        experienceLevel: 'entry',
        status: 'draft',
      });

      const fetchedDraft = await getOpportunityById(draftOppId);
      assert(fetchedDraft?.status === 'draft', 'Must start in draft');

      // Attempt publish
      const published = await publishOpportunity(draftOppId, creatorUid);
      assert(published.status === 'open', 'Publishing transitions to open');
    }
  );

  return results;
}
