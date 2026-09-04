import {
  calculateDeterministicTrustScore,
  computeCanonicalProofHash,
  computeVolumeTier,
  generateProjectProofArtifact,
  verifyProofIntegrity,
} from '../lib/passportService';
import { submitContractFeedback, getReceivedFeedbackForUser } from '../lib/feedbackService';
import { GigLinkContract, ContractMilestone } from '../types';
import { FinancialLedgerRecord } from '../types/financial';
import { CanonicalProofData, ContractFeedback } from '../types/passport';

export async function runPhase7FunctionalTests(): Promise<{ passed: number; total: number; errors: string[] }> {
  let passed = 0;
  let total = 0;
  const errors: string[] = [];

  function assert(condition: boolean, testName: string, errorMsg?: string) {
    total++;
    if (condition) {
      console.log(`  ✓ [P7] ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ [P7 FAILED] ${testName}: ${errorMsg || 'Assertion failed'}`);
      errors.push(`${testName}: ${errorMsg || 'Assertion failed'}`);
    }
  }

  console.log('\n--- PHASE 7 FUNCTIONAL TESTS: TRUST PASSPORT & REPUTATION ENGINE ---');

  // Test 1: Deterministic Cold Start Trust Score
  try {
    const coldStartMetrics = calculateDeterministicTrustScore('user_newbie', {
      contracts: [],
      ledgerRecords: [],
      receivedFeedback: [],
      openDisputeCount: 0,
      adverseDisputeCount: 0,
    });
    // Expected: 0.3*80 + 0.25*100 + 0.25*80 + 0.1*0 + 0.1*0 = 24 + 25 + 20 + 0 + 0 = 69
    assert(
      coldStartMetrics.overallScore === 69,
      'Cold-Start Invariant: New participant receives deterministic baseline score of 69',
      `Expected 69, got ${coldStartMetrics.overallScore}`
    );
    assert(
      coldStartMetrics.volumeTier === 'none',
      'Cold-Start Invariant: Volume tier is none',
      `Expected none, got ${coldStartMetrics.volumeTier}`
    );
  } catch (err: any) {
    assert(false, 'Cold-Start Invariant', err.message);
  }

  // Test 2: Full Deterministic Trust Score with Approved Milestones & Feedback
  try {
    const mockContract1: GigLinkContract = {
      id: 'contract_701',
      opportunityId: 'opp_701',
      opportunityTitle: 'Full-Stack React Application',
      applicationId: 'app_701',
      creatorId: 'client_701',
      creatorName: 'Client 701',
      talentId: 'talent_701',
      talentName: 'Talent 701',
      version: 1,
      status: 'completed',
      conversationId: 'conv_701',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      creatorAcceptance: { accepted: true },
      talentAcceptance: { accepted: true },
      milestones: [
        {
          id: 'm1',
          contractId: 'contract_701',
          title: 'Design Spec & Setup',
          description: 'Design spec',
          deliverables: ['Design spec document'],
          amount: 1000,
          currency: 'USD',
          status: 'completed',
          revisionAllowance: 2,
          revisionCount: 0,
          paymentState: 'released',
          reviewState: 'approved',
          dueDate: '2026-08-05T00:00:00.000Z',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-05T00:00:00.000Z',
          submission: {
            submittedBy: 'talent_701',
            submittedAt: '2026-08-04T12:00:00.000Z', // On-time
            deliveryNote: 'Completed design tokens',
          },
        },
        {
          id: 'm2',
          contractId: 'contract_701',
          title: 'Core Engine & API',
          description: 'Core engine',
          deliverables: ['Engine endpoints'],
          amount: 1000,
          currency: 'USD',
          status: 'completed',
          revisionAllowance: 2,
          revisionCount: 0,
          paymentState: 'released',
          reviewState: 'approved',
          dueDate: '2026-08-09T00:00:00.000Z',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-09T00:00:00.000Z',
          submission: {
            submittedBy: 'talent_701',
            submittedAt: '2026-08-08T15:00:00.000Z', // On-time
            deliveryNote: 'API endpoints implemented',
          },
        },
      ],
      scopeLock: {
        title: 'Full-Stack React Application',
        description: 'Complete build',
        inclusions: ['Frontend', 'Backend'],
        exclusions: [],
        deliverables: ['React', 'TypeScript', 'Node.js'],
        totalAmount: 2000,
        currency: 'USD',
        revisionAllowance: 2,
        lockedAt: '2026-08-01T00:00:00.000Z',
      },
    };

    const mockLedger: FinancialLedgerRecord[] = [
      {
        id: 'led_701',
        contractId: 'contract_701',
        milestoneId: 'm1',
        type: 'milestone_released',
        payerId: 'client_701',
        payerName: 'Client 701',
        recipientId: 'talent_701',
        recipientName: 'Talent 701',
        amount: 1000,
        currency: 'USD',
        platformFeeRate: 0.1,
        platformFeeAmount: 100,
        netTalentAmount: 900,
        provider: 'stripe',
        status: 'succeeded',
        description: 'Milestone 1 release',
        createdAt: '2026-08-05T00:00:00.000Z',
        completedAt: '2026-08-05T00:00:00.000Z',
      },
      {
        id: 'led_702',
        contractId: 'contract_701',
        milestoneId: 'm2',
        type: 'milestone_released',
        payerId: 'client_701',
        payerName: 'Client 701',
        recipientId: 'talent_701',
        recipientName: 'Talent 701',
        amount: 1000,
        currency: 'USD',
        platformFeeRate: 0.1,
        platformFeeAmount: 100,
        netTalentAmount: 900,
        provider: 'stripe',
        status: 'succeeded',
        description: 'Milestone 2 release',
        createdAt: '2026-08-09T00:00:00.000Z',
        completedAt: '2026-08-09T00:00:00.000Z',
      },
    ];

    const mockFeedback: ContractFeedback[] = [
      {
        id: 'feedback_contract_701_client_701',
        contractId: 'contract_701',
        authorId: 'client_701',
        authorRole: 'creator',
        targetUserId: 'talent_701',
        ratingOverall: 5,
        ratingCommunication: 5,
        ratingQuality: 5,
        ratingTimeliness: 5,
        comment: 'Outstanding deliverable quality and timely communication.',
        isPublic: true,
        createdAt: '2026-08-10T01:00:00.000Z',
      },
    ];

    const talentMetrics = calculateDeterministicTrustScore('talent_701', {
      contracts: [mockContract1],
      ledgerRecords: mockLedger,
      receivedFeedback: mockFeedback,
      openDisputeCount: 0,
      adverseDisputeCount: 0,
    });

    // MilestoneScore: 2/2 = 100 (30% -> 30)
    // TimelinessScore: 2/2 = 100 (25% -> 25)
    // FeedbackScore: 5.0 -> ((5-1)/4)*100 = 100 (25% -> 25)
    // RepeatScore: single contract -> 0 (10% -> 0)
    // VolumeScore: $2,000 USD -> log10(1 + 2000/100)*50 = log10(21)*50 = 1.3222 * 50 = 66.1 (10% -> 6.61)
    // BaseScore = 30 + 25 + 25 + 0 + 6.61 = 86.61 -> round to 87
    assert(
      talentMetrics.overallScore === 87,
      'Trust Score Calculation: Accurate mathematical computation for talent with perfect milestone & feedback record',
      `Expected 87, got ${talentMetrics.overallScore}`
    );
    assert(
      talentMetrics.volumeTier === 'tier_established',
      'Volume Tier Invariant: $2,000 settled volume achieves tier_established',
      `Expected tier_established, got ${talentMetrics.volumeTier}`
    );
    assert(
      talentMetrics.onTimeDeliveryRate === 100,
      'On-Time Delivery Invariant: 100% on-time delivery rate recorded',
      `Expected 100, got ${talentMetrics.onTimeDeliveryRate}`
    );
  } catch (err: any) {
    assert(false, 'Trust Score Calculation', err.message);
  }

  // Test 3: Dispute Penalty Deductions
  try {
    const penalizedMetrics = calculateDeterministicTrustScore('talent_penalized', {
      contracts: [],
      ledgerRecords: [],
      receivedFeedback: [],
      openDisputeCount: 1, // -5 pts
      adverseDisputeCount: 1, // -15 pts
    });
    // Base 69 - 20 = 49
    assert(
      penalizedMetrics.overallScore === 49,
      'Dispute Penalty Invariant: Exact point deductions applied for open dispute and adverse arbitration',
      `Expected 49, got ${penalizedMetrics.overallScore}`
    );
    assert(
      penalizedMetrics.disputePenaltyPoints === 20,
      'Dispute Penalty Audit Trail: 20 penalty points recorded',
      `Expected 20, got ${penalizedMetrics.disputePenaltyPoints}`
    );
  } catch (err: any) {
    assert(false, 'Dispute Penalty Invariant', err.message);
  }

  // Test 4: Cryptographic Canonical SHA-256 Hash Invariance & Reproducibility
  try {
    const payloadA: CanonicalProofData = {
      category: 'Mobile Development',
      completedAt: '2026-08-20T10:00:00.000Z',
      creatorPublicHandle: 'alice_studios',
      deliverablesSummary: ['Authentication Module', 'Payment Integration'],
      skillsDemonstrated: ['react-native', 'typescript'],
      talentPublicHandle: 'bob_dev',
      volumeTier: 'tier_established',
    };

    // Reordered properties / arrays in payloadB to test canonical normalization
    const payloadB: CanonicalProofData = {
      skillsDemonstrated: ['typescript', 'react-native'],
      deliverablesSummary: ['Payment Integration', 'Authentication Module'],
      creatorPublicHandle: 'alice_studios',
      volumeTier: 'tier_established',
      talentPublicHandle: 'bob_dev',
      completedAt: '2026-08-20T10:00:00.000Z',
      category: 'Mobile Development',
    };

    const hashA = await computeCanonicalProofHash(payloadA);
    const hashB = await computeCanonicalProofHash(payloadB);

    assert(
      hashA.length === 64 && /^[0-9a-f]{64}$/.test(hashA),
      'SHA-256 Digest: Produces valid 64-character lowercase hex string',
      `Got hash length ${hashA.length}`
    );
    assert(
      hashA === hashB,
      'Canonical Invariant: Deterministic payload normalization produces identical hash regardless of input order',
      `Hashes differed: ${hashA} vs ${hashB}`
    );
  } catch (err: any) {
    assert(false, 'Cryptographic Canonical SHA-256 Hash', err.message);
  }

  // Test 5: Server-Authoritative Project Proof Generation on Completed Contract
  try {
    const mockCompletedContract: GigLinkContract = {
      id: 'contract_705',
      opportunityId: 'opp_705',
      opportunityTitle: 'Decentralized Smart Wallet UI',
      applicationId: 'app_705',
      creatorId: 'creator_705',
      creatorName: 'Creator 705',
      talentId: 'talent_705',
      talentName: 'Talent 705',
      version: 1,
      status: 'completed',
      conversationId: 'conv_705',
      createdAt: '2026-08-15T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
      completedAt: '2026-08-25T00:00:00.000Z',
      creatorAcceptance: { accepted: true },
      talentAcceptance: { accepted: true },
      milestones: [
        {
          id: 'm1',
          contractId: 'contract_705',
          title: 'Wallet Connect & Key Mgmt',
          description: 'Wallet integration',
          deliverables: ['Wallet connector'],
          amount: 3000,
          currency: 'USD',
          status: 'completed',
          revisionAllowance: 2,
          revisionCount: 0,
          paymentState: 'released',
          reviewState: 'approved',
          createdAt: '2026-08-15T00:00:00.000Z',
          updatedAt: '2026-08-20T00:00:00.000Z',
        },
        {
          id: 'm2',
          contractId: 'contract_705',
          title: 'Transaction Feed & Signer',
          description: 'Tx feed',
          deliverables: ['Feed signer'],
          amount: 3000,
          currency: 'USD',
          status: 'completed',
          revisionAllowance: 2,
          revisionCount: 0,
          paymentState: 'released',
          reviewState: 'approved',
          createdAt: '2026-08-15T00:00:00.000Z',
          updatedAt: '2026-08-25T00:00:00.000Z',
        },
      ],
      scopeLock: {
        title: 'Decentralized Smart Wallet UI',
        description: 'Web3 & Frontend wallet UI',
        inclusions: [],
        exclusions: [],
        deliverables: ['Ethers.js', 'React', 'TailwindCSS'],
        totalAmount: 6000,
        currency: 'USD',
        revisionAllowance: 2,
        lockedAt: '2026-08-15T00:00:00.000Z',
      },
    };

    const mockLedgerRecords: FinancialLedgerRecord[] = [
      {
        id: 'led_705_1',
        contractId: 'contract_705',
        milestoneId: 'm1',
        type: 'milestone_released',
        payerId: 'creator_705',
        payerName: 'Creator 705',
        recipientId: 'talent_705',
        recipientName: 'Talent 705',
        amount: 3000,
        currency: 'USD',
        platformFeeRate: 0.1,
        platformFeeAmount: 300,
        netTalentAmount: 2700,
        provider: 'stripe',
        status: 'succeeded',
        description: 'M1 payout',
        createdAt: '2026-08-20T00:00:00.000Z',
      },
      {
        id: 'led_705_2',
        contractId: 'contract_705',
        milestoneId: 'm2',
        type: 'milestone_released',
        payerId: 'creator_705',
        payerName: 'Creator 705',
        recipientId: 'talent_705',
        recipientName: 'Talent 705',
        amount: 3000,
        currency: 'USD',
        platformFeeRate: 0.1,
        platformFeeAmount: 300,
        netTalentAmount: 2700,
        provider: 'stripe',
        status: 'succeeded',
        description: 'M2 payout',
        createdAt: '2026-08-25T00:00:00.000Z',
      },
    ];

    const proof = await generateProjectProofArtifact(
      mockCompletedContract,
      mockLedgerRecords,
      'creator_org',
      'alex_dev'
    );

    assert(
      proof.id === 'proof_contract_705',
      'Proof Artifact ID: Deterministically keyed to proof_{contractId}',
      `Expected proof_contract_705, got ${proof.id}`
    );
    assert(
      proof.volumeTier === 'tier_high_value',
      'Proof Volume Tier: $6,000 settled escrow classified as tier_high_value',
      `Expected tier_high_value, got ${proof.volumeTier}`
    );
    assert(
      proof.verifiedByPlatform === true,
      'Proof Verified Flag: verifiedByPlatform is true',
      `Expected true, got ${proof.verifiedByPlatform}`
    );

    // Verify independent proof integrity
    const isIntegral = await verifyProofIntegrity(proof);
    assert(
      isIntegral === true,
      'Proof Verification: Independent verifier confirms cryptographic hash integrity against proof metadata',
      `Expected true, got ${isIntegral}`
    );
  } catch (err: any) {
    assert(false, 'Server-Authoritative Project Proof Generation', err.message);
  }

  // Test 6: Mutual Peer Feedback Submission on Completed Contract
  try {
    const completedContract: GigLinkContract = {
      id: 'contract_706',
      opportunityId: 'opp_706',
      opportunityTitle: 'Security Audit & Penetration Testing',
      applicationId: 'app_706',
      creatorId: 'creator_706',
      creatorName: 'Creator 706',
      talentId: 'talent_706',
      talentName: 'Talent 706',
      version: 1,
      status: 'completed',
      conversationId: 'conv_706',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-20T00:00:00.000Z',
      completedAt: '2026-08-20T00:00:00.000Z',
      creatorAcceptance: { accepted: true },
      talentAcceptance: { accepted: true },
      scopeLock: {
        title: 'Security Audit',
        description: 'Complete audit',
        inclusions: [],
        exclusions: [],
        deliverables: ['Audit report'],
        totalAmount: 5000,
        currency: 'USD',
        revisionAllowance: 2,
        lockedAt: '2026-08-01T00:00:00.000Z',
      },
      milestones: [
        {
          id: 'm1',
          contractId: 'contract_706',
          title: 'Vulnerability Scan & Fixes',
          description: 'Scan & fixes',
          deliverables: ['Scan report'],
          amount: 5000,
          currency: 'USD',
          status: 'completed',
          revisionAllowance: 2,
          revisionCount: 0,
          paymentState: 'released',
          reviewState: 'approved',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-20T00:00:00.000Z',
        },
      ],
    };

    // Creator reviews talent
    const creatorFeedback = await submitContractFeedback({
      contract: completedContract,
      authorId: 'creator_706',
      ratingOverall: 5,
      ratingCommunication: 5,
      ratingQuality: 5,
      ratingTimeliness: 4,
      comment: 'Exceptional security analysis and remediation guidelines.',
      isPublic: true,
    });

    assert(
      creatorFeedback.id === 'feedback_contract_706_creator_706',
      'Feedback Document ID: Deterministically formatted as feedback_{contractId}_{authorId}',
      `Got ${creatorFeedback.id}`
    );
    assert(
      creatorFeedback.authorRole === 'creator' && creatorFeedback.targetUserId === 'talent_706',
      'Feedback Role Invariant: Authoritative role and targetUserId derived from contract relationship',
      `Got role ${creatorFeedback.authorRole}, target ${creatorFeedback.targetUserId}`
    );

    // Talent reviews creator
    const talentFeedback = await submitContractFeedback({
      contract: completedContract,
      authorId: 'talent_706',
      ratingOverall: 5,
      ratingCommunication: 5,
      ratingQuality: 5,
      ratingTimeliness: 5,
      comment: 'Clear specifications, fast milestone approvals, and smooth payment.',
      isPublic: true,
    });

    assert(
      talentFeedback.authorRole === 'talent' && talentFeedback.targetUserId === 'creator_706',
      'Mutual Feedback: Counterparty submits reverse review with derived talent role',
      `Got role ${talentFeedback.authorRole}, target ${talentFeedback.targetUserId}`
    );

    const receivedByTalent = await getReceivedFeedbackForUser('talent_706');
    assert(
      receivedByTalent.some((f) => f.id === creatorFeedback.id),
      'Feedback Retrieval: Target user correctly receives public peer endorsement',
      'Feedback not found in received list'
    );
  } catch (err: any) {
    assert(false, 'Mutual Peer Feedback Submission', err.message);
  }

  console.log(`Phase 7 Functional Result: ${passed}/${total} passed.`);
  return { passed, total, errors };
}
