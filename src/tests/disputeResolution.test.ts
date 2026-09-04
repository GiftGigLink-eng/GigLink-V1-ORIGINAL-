/**
 * Phase 6 Test Suite: Dispute Resolution, Mutual Cancellation & Platform Mediation
 */

import {
  canRaiseDispute,
  raiseContractDispute,
  canProposeMutualCancellation,
  proposeMutualCancellation,
  canRespondToCancellationProposal,
  respondToCancellationProposal,
  canAdminArbitrateDispute,
  executeAdminArbitration,
  calculatePlatformFeeSplit,
  canAddDisputeEvidence,
  addDisputeEvidence,
} from '../lib/disputeService';
import { canReleaseMilestonePayment } from '../lib/financialLedgerService';
import { canCreateChangeRequest, persistContract } from '../lib/contractService';
import { GigLinkContract } from '../types';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runPhase6Tests(): Promise<{ passed: number; total: number; results: TestResult[] }> {
  const results: TestResult[] = [];

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            results.push({ name, passed: true });
            console.log(`  ✓ [P6] ${name}`);
          })
          .catch((err: any) => {
            results.push({ name, passed: false, error: err.message });
            console.error(`  ✗ [P6] ${name}: ${err.message}`);
          });
      } else {
        results.push({ name, passed: true });
        console.log(`  ✓ [P6] ${name}`);
      }
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
      console.error(`  ✗ [P6] ${name}: ${err.message}`);
    }
  }

  const now = new Date().toISOString();
  const contractId = `contract_p6_${Date.now()}`;

  const baseContract: GigLinkContract = {
    id: contractId,
    opportunityId: 'opp_p6_101',
    opportunityTitle: 'Phase 6 Governance Build',
    applicationId: 'app_p6_101',
    creatorId: 'client_p6',
    creatorName: 'Enterprise Client',
    talentId: 'talent_p6',
    talentName: 'Senior Rust Engineer',
    status: 'active',
    version: 1,
    disputeStatus: 'none',
    scopeLock: {
      title: 'Phase 6 Governance Build',
      description: 'Dispute & Mediation Framework',
      totalAmount: 3000,
      currency: 'USD',
      deadline: '2026-12-31',
      inclusions: ['Arbitration core'],
      exclusions: ['External legal advice'],
      deliverables: ['Dispute Service'],
      revisionAllowance: 2,
    },
    originalScope: {
      title: 'Phase 6 Governance Build',
      description: 'Dispute & Mediation Framework',
      totalAmount: 3000,
      currency: 'USD',
      deadline: '2026-12-31',
      inclusions: ['Arbitration core'],
      exclusions: ['External legal advice'],
      deliverables: ['Dispute Service'],
      revisionAllowance: 2,
    },
    milestones: [
      {
        id: 'm1_held',
        contractId,
        title: 'Milestone 1: Architectural Draft',
        description: 'Drafting core',
        deliverables: ['Spec'],
        amount: 1000,
        currency: 'USD',
        dueDate: '2026-09-30',
        status: 'in_progress',
        reviewState: 'submitted',
        paymentState: 'held',
        fundedAmount: 1000,
        revisionAllowance: 2,
        revisionCount: 0,
        createdAt: now,
        updatedAt: now,
        reviewHistory: [],
      },
      {
        id: 'm2_unfunded',
        contractId,
        title: 'Milestone 2: Execution Engine',
        description: 'Execution core',
        deliverables: ['Engine'],
        amount: 2000,
        currency: 'USD',
        dueDate: '2026-11-30',
        status: 'pending',
        reviewState: 'pending_submission',
        paymentState: 'unfunded',
        revisionAllowance: 2,
        revisionCount: 0,
        createdAt: now,
        updatedAt: now,
        reviewHistory: [],
      },
    ],
    creatorAcceptance: {
      accepted: true,
      acceptedAt: now,
      acceptedByUserId: 'client_p6',
      signedName: 'Enterprise Client',
    },
    talentAcceptance: {
      accepted: true,
      acceptedAt: now,
      acceptedByUserId: 'talent_p6',
      signedName: 'Senior Rust Engineer',
    },
    conversationId: `conv_${contractId}`,
    createdAt: now,
    updatedAt: now,
  };

  await persistContract(baseContract);

  // 1. Participant Authority check
  await test('Participant Check: Stranger blocked from raising dispute', () => {
    const check = canRaiseDispute(baseContract, 'stranger_uid');
    if (check.allowed) throw new Error('Stranger should not be allowed to raise dispute');
  });

  await test('Participant Check: Talent allowed to raise dispute on active milestone', () => {
    const check = canRaiseDispute(baseContract, 'talent_p6', 'm1_held');
    if (!check.allowed) throw new Error(`Talent should be allowed: ${check.reason}`);
  });

  // 2. Raise Dispute Execution
  let disputedContract: GigLinkContract = baseContract;
  await test('Execute Raise Dispute: Contract and milestone disputeStatus updated', async () => {
    const res = await raiseContractDispute({
      contractId: baseContract.id,
      userId: 'talent_p6',
      reasonCategory: 'scope_disagreement',
      description: 'Client expanded requirements beyond scope lock without change request.',
      requestedRemedy: 'scope_adjustment',
      disputedMilestoneId: 'm1_held',
      evidence: [
        {
          id: 'ev_1',
          uploadedByUserId: 'talent_p6',
          uploadedByRole: 'talent',
          title: 'Scope Diff Spec',
          fileUrl: 'https://storage.giglink.dev/disputes/spec_diff.pdf',
          fileType: 'application/pdf',
          uploadedAt: new Date().toISOString(),
        },
      ],
    });
    disputedContract = res.contract;
    if (disputedContract.disputeStatus !== 'open') {
      throw new Error(`Expected disputeStatus to be 'open', got '${disputedContract.disputeStatus}'`);
    }
    const m1 = disputedContract.milestones.find((m) => m.id === 'm1_held');
    if (m1?.disputeStatus !== 'disputed') {
      throw new Error(`Expected milestone disputeStatus to be 'disputed', got '${m1?.disputeStatus}'`);
    }
  });

  // 3. Security Invariant: Escrow Release FROZEN during dispute
  await test('Security Invariant: Escrow release blocked while milestone is in dispute', () => {
    const check = canReleaseMilestonePayment(disputedContract, 'm1_held', 'client_p6');
    if (check.allowed) {
      throw new Error('Escrow release should be blocked while milestone is in dispute');
    }
  });

  // 4. Security Invariant: Change request creation blocked during dispute
  await test('Security Invariant: Change request creation blocked while contract in dispute', () => {
    const check = canCreateChangeRequest(disputedContract, 'client_p6');
    if (check.allowed) {
      throw new Error('Change request creation should be blocked during dispute');
    }
  });

  // 5. Mutual Cancellation Math Validation
  await test('Mutual Cancellation Math: Proposal sum mismatch is rejected', () => {
    // Total held escrow is 1000. Trying 600 + 500 = 1100
    const check = canProposeMutualCancellation(disputedContract, 'client_p6', 600, 500);
    if (check.allowed) {
      throw new Error('Mismatch in held escrow sum should be rejected');
    }
  });

  await test('Mutual Cancellation Math: Exact split matching held escrow is allowed', () => {
    // 400 refund + 600 talent release = 1000 held escrow
    const check = canProposeMutualCancellation(disputedContract, 'client_p6', 400, 600);
    if (!check.allowed) {
      throw new Error(`Exact split should be allowed: ${check.reason}`);
    }
  });

  // 6. Propose Mutual Cancellation Execution
  let contractWithProposal: GigLinkContract = disputedContract;
  let proposalId = '';
  await test('Execute Propose Mutual Cancellation: Proposal added to contract', async () => {
    const res = await proposeMutualCancellation({
      contractId: disputedContract.id,
      userId: 'client_p6',
      reason: 'Parties agree to part ways amicably with partial compensation.',
      refundToClientAmount: 400,
      releaseToTalentAmount: 600,
    });
    contractWithProposal = res.contract;
    proposalId = res.proposal.id;
    if (contractWithProposal.cancellationProposals?.length !== 1) {
      throw new Error('Expected 1 cancellation proposal');
    }
  });

  // 7. Security Invariant: Self-acceptance is blocked
  await test('Security Invariant: Proposer cannot self-accept cancellation proposal', () => {
    const check = canRespondToCancellationProposal(
      contractWithProposal,
      proposalId,
      'client_p6',
      'accept'
    );
    if (check.allowed) {
      throw new Error('Proposer should be forbidden from self-accepting');
    }
  });

  // 8. Accept Mutual Cancellation & Atomic Settlement
  let settledContract: GigLinkContract = contractWithProposal;
  await test('Execute Accept Mutual Cancellation: Financial settlement executed with zero rounding loss', async () => {
    const res = await respondToCancellationProposal({
      contractId: contractWithProposal.id,
      proposalId,
      userId: 'talent_p6', // Counterparty responds
      decision: 'accept',
      responseNote: 'Agreed to settlement terms.',
    });
    settledContract = res.contract;
    if (settledContract.status !== 'cancelled') {
      throw new Error(`Expected contract status 'cancelled', got '${settledContract.status}'`);
    }
    if (settledContract.disputeStatus !== 'resolved_mutual_agreement') {
      throw new Error(`Expected disputeStatus 'resolved_mutual_agreement', got '${settledContract.disputeStatus}'`);
    }
    if (!res.ledgerRecords || res.ledgerRecords.length !== 2) {
      throw new Error(`Expected 2 financial ledger records (refund & talent release), got ${res.ledgerRecords?.length}`);
    }

    // Verify Zero Rounding Loss
    const refundRecord = res.ledgerRecords.find((r) => r.type === 'refund_completed');
    const releaseRecord = res.ledgerRecords.find((r) => r.type === 'milestone_released');
    if (!refundRecord || !releaseRecord) {
      throw new Error('Missing refund or release ledger record');
    }
    if (refundRecord.amount !== 400) {
      throw new Error(`Expected refund amount 400, got ${refundRecord.amount}`);
    }
    if (releaseRecord.amount !== 600) {
      throw new Error(`Expected gross release 600, got ${releaseRecord.amount}`);
    }
    if (releaseRecord.platformFeeAmount !== 30) {
      throw new Error(`Expected 5% platform fee 30, got ${releaseRecord.platformFeeAmount}`);
    }
    if (releaseRecord.netTalentAmount !== 570) {
      throw new Error(`Expected net talent amount 570, got ${releaseRecord.netTalentAmount}`);
    }
    // Cent reconciliation: 400 (Client) + 30 (Fee) + 570 (Net Talent) = 1000 (Held Escrow)
    const totalReconciled = refundRecord.amount + releaseRecord.platformFeeAmount + releaseRecord.netTalentAmount;
    if (totalReconciled !== 1000) {
      throw new Error(`Total reconciled ${totalReconciled} does not equal held escrow 1000`);
    }
  });

  // 9. Admin Arbitration Test Setup
  const adminTestContractId = `contract_p6_admin_${Date.now()}`;
  const adminBaseContract: GigLinkContract = {
    ...baseContract,
    id: adminTestContractId,
    disputeStatus: 'open',
    milestones: [
      {
        ...baseContract.milestones[0],
        contractId: adminTestContractId,
        paymentState: 'held',
        fundedAmount: 1000,
      },
    ],
  };
  await persistContract(adminBaseContract);

  await test('Security Invariant: Non-admin blocked from executing admin arbitration', () => {
    const check = canAdminArbitrateDispute(adminBaseContract, 'talent_p6', false, 500, 500);
    if (check.allowed) {
      throw new Error('Non-admin should be blocked from arbitrating dispute');
    }
  });

  await test('Execute Admin Arbitration: Platform Admin executes binding split verdict', async () => {
    const res = await executeAdminArbitration({
      contractId: adminTestContractId,
      adminId: 'admin_root',
      userIsAdmin: true,
      verdictType: 'split_settlement',
      clientRefundAmount: 500,
      talentReleaseGrossAmount: 500,
      adminNotes: 'Deliverables partially delivered with minor deficiencies.',
    });
    if (res.contract.status !== 'cancelled') {
      throw new Error(`Expected status 'cancelled', got '${res.contract.status}'`);
    }
    if (res.contract.disputeStatus !== 'resolved_admin_arbitration') {
      throw new Error(`Expected disputeStatus 'resolved_admin_arbitration', got '${res.contract.disputeStatus}'`);
    }
    if (res.verdict.talentReleaseFeeAmount !== 25 || res.verdict.talentReleaseNetAmount !== 475) {
      throw new Error(`Fee or net talent amount incorrect on 500 gross (Fee: ${res.verdict.talentReleaseFeeAmount}, Net: ${res.verdict.talentReleaseNetAmount})`);
    }
  });

  // 10. Dispute Evidence Access Control Tests
  await test('Dispute Evidence: Stranger blocked from submitting evidence to dispute', () => {
    const check = canAddDisputeEvidence(adminBaseContract, 'dispute_nonexistent', 'stranger_user', false);
    if (check.allowed) {
      throw new Error('Stranger should be blocked from adding evidence to dispute');
    }
  });

  await test('Dispute Evidence: Participant can attach verified document evidence', async () => {
    const evidenceContractId = `contract_ev_${Date.now()}`;
    const evidenceContract: GigLinkContract = {
      ...baseContract,
      id: evidenceContractId,
      disputeStatus: 'open',
      disputes: [
        {
          id: 'disp_ev_1',
          contractId: evidenceContractId,
          disputedByUserId: 'client_p6',
          disputedByRole: 'creator',
          disputedMilestoneId: null,
          reasonCategory: 'deliverable_quality',
          description: 'Testing evidence upload',
          requestedRemedy: 'full_refund',
          status: 'open',
          evidence: [],
          cancellationProposals: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    await persistContract(evidenceContract);

    const evRes = await addDisputeEvidence({
      contractId: evidenceContractId,
      disputeId: 'disp_ev_1',
      userId: 'client_p6',
      evidence: {
        title: 'Defect Log Screenshot.png',
        fileUrl: 'https://storage.giglink.internal/evidence/defect1.png',
        fileType: 'image/png',
        fileSize: 204800,
        description: 'Captured browser console error log during demo handover',
      },
    });

    if (!evRes.evidence.id || evRes.evidence.title !== 'Defect Log Screenshot.png') {
      throw new Error('Evidence record not correctly attached');
    }
    const updatedDispute = evRes.contract.disputes?.find((d) => d.id === 'disp_ev_1');
    if (!updatedDispute || updatedDispute.evidence?.length !== 1) {
      throw new Error('Dispute evidence array failed to persist updated evidence record');
    }
  });

  // 11. Exact-Cent Reconciliation Tests for Edge Cases ($0.01, $0.03, $123.45, $1999.99)
  await test('Exact-Cent Financial Reconciliation: Edge cases maintain zero rounding drift', () => {
    const testCases = [
      { gross: 0.01, expectedFee: 0, expectedNet: 0.01 },
      { gross: 0.03, expectedFee: 0, expectedNet: 0.03 },
      { gross: 1.00, expectedFee: 0.05, expectedNet: 0.95 },
      { gross: 123.45, expectedFee: 6.17, expectedNet: 117.28 },
      { gross: 1999.99, expectedFee: 100.00, expectedNet: 1899.99 },
    ];

    for (const tc of testCases) {
      const split = calculatePlatformFeeSplit(tc.gross, 0.05);
      const sum = Math.round((split.platformFeeAmount + split.netTalentAmount) * 100) / 100;
      if (sum !== tc.gross) {
        throw new Error(`Rounding drift on gross $${tc.gross}: fee ($${split.platformFeeAmount}) + net ($${split.netTalentAmount}) = $${sum} != $${tc.gross}`);
      }
      if (split.platformFeeAmount !== tc.expectedFee || split.netTalentAmount !== tc.expectedNet) {
        throw new Error(`Mismatch on gross $${tc.gross}: expected fee $${tc.expectedFee}, got $${split.platformFeeAmount}; expected net $${tc.expectedNet}, got $${split.netTalentAmount}`);
      }
    }
  });

  return {
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    results,
  };
}
