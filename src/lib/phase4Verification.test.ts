/**
 * Phase 4 Financial, Escrow & Settlement Verification Test Suite
 * Validates deterministic platform fee logic, escrow state transitions,
 * unauthorized modification rejection, financial summary derivation,
 * duplicate settlement prevention, dispute locking, and amendment escrow guards.
 */

import { calculatePlatformFee, deriveContractFinancialSummary } from './financialService';
import {
  canFundMilestone,
  canReleaseMilestonePayment,
  recordMilestoneFunded,
  recordMilestonePaymentReleased,
  recordMilestoneRefund,
} from './financialLedgerService';
import { canSubmitMilestone } from './contractService';
import { GigLinkContract, ContractMilestone, FinancialLedgerRecord } from '../types';

export function runPhase4Tests(): { passed: boolean; testResults: Array<{ name: string; success: boolean; details?: string }> } {
  const results: Array<{ name: string; success: boolean; details?: string }> = [];

  const assert = (name: string, condition: boolean, details?: string) => {
    results.push({ name, success: condition, details: condition ? undefined : details });
  };

  // ==========================================
  // Test 1: Deterministic Platform Fee Math (5%) & Zero Rounding Loss
  // ==========================================
  try {
    const testCases = [
      { gross: 100, expectedFee: 5.0, expectedNet: 95.0 },
      { gross: 1000, expectedFee: 50.0, expectedNet: 950.0 },
      { gross: 1999.99, expectedFee: 100.0, expectedNet: 1899.99 },
      { gross: 0.01, expectedFee: 0.0, expectedNet: 0.01 },
      { gross: 123.45, expectedFee: 6.17, expectedNet: 117.28 },
      { gross: 10000000, expectedFee: 500000.0, expectedNet: 9500000.0 },
    ];

    testCases.forEach((tc) => {
      const calc = calculatePlatformFee(tc.gross, 0.05);
      const sum = Math.round((calc.platformFeeAmount + calc.netTalentAmount) * 100) / 100;
      assert(
        `Platform Fee on $${tc.gross}`,
        calc.platformFeeAmount === tc.expectedFee && calc.netTalentAmount === tc.expectedNet,
        `Expected fee $${tc.expectedFee} and net $${tc.expectedNet}, got fee $${calc.platformFeeAmount} and net $${calc.netTalentAmount}`
      );
      assert(
        `Zero Rounding Loss on $${tc.gross} (Gross = Fee + Net)`,
        sum === tc.gross,
        `Expected sum $${tc.gross}, got $${sum}`
      );
    });
  } catch (err: any) {
    assert('Platform Fee Calculations', false, err.message);
  }

  // ==========================================
  // Test 2: Unfunded Milestone Blocks Work Submission
  // ==========================================
  try {
    const mockContract: GigLinkContract = {
      id: 'test_contract_1',
      opportunityId: 'opp_1',
      opportunityTitle: 'Test Project',
      applicationId: 'app_1',
      creatorId: 'client_123',
      creatorName: 'Alice Client',
      talentId: 'talent_456',
      talentName: 'Bob Talent',
      status: 'active',
      version: 1,
      conversationId: 'conv_1',
      scopeLock: {
        title: 'Test Project',
        description: 'Scope',
        inclusions: [],
        exclusions: [],
        deliverables: [],
        totalAmount: 2000,
        currency: 'USD',
        revisionAllowance: 2,
        lockedAt: new Date().toISOString(),
      },
      milestones: [
        {
          id: 'm1',
          contractId: 'test_contract_1',
          title: 'Milestone 1',
          description: 'Design phase',
          deliverables: ['Wireframes'],
          amount: 1000,
          currency: 'USD',
          status: 'in_progress',
          reviewState: 'pending_submission',
          paymentState: 'unfunded', // Not funded yet!
          revisionAllowance: 2,
          revisionCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'm2',
          contractId: 'test_contract_1',
          title: 'Milestone 2',
          description: 'Development phase',
          deliverables: ['Code'],
          amount: 1000,
          currency: 'USD',
          status: 'pending',
          reviewState: 'pending_submission',
          paymentState: 'unfunded',
          revisionAllowance: 2,
          revisionCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      creatorAcceptance: { accepted: true, acceptedAt: new Date().toISOString() },
      talentAcceptance: { accepted: true, acceptedAt: new Date().toISOString() },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const submitCheckUnfunded = canSubmitMilestone(mockContract, 'm1', 'talent_456');
    assert(
      'Talent blocked from submitting unfunded milestone',
      !submitCheckUnfunded.allowed && !!submitCheckUnfunded.reason?.toLowerCase().includes('escrow funding required'),
      `Reason: ${submitCheckUnfunded.reason}`
    );

    // Now test with milestone held in escrow
    mockContract.milestones[0].paymentState = 'held';
    mockContract.milestones[0].fundedAt = new Date().toISOString();
    const submitCheckHeld = canSubmitMilestone(mockContract, 'm1', 'talent_456');
    assert(
      'Talent allowed to submit once escrow is held',
      submitCheckHeld.allowed === true,
      `Reason: ${submitCheckHeld.reason}`
    );
  } catch (err: any) {
    assert('Escrow Submission Guard', false, err.message);
  }

  // ==========================================
  // Test 3: Contract Financial Summary Derivation
  // ==========================================
  try {
    const mockContract2: GigLinkContract = {
      id: 'test_contract_2',
      opportunityId: 'opp_2',
      opportunityTitle: 'Financial Summary Project',
      applicationId: 'app_2',
      creatorId: 'client_123',
      talentId: 'talent_456',
      status: 'active',
      version: 1,
      conversationId: 'conv_2',
      scopeLock: {
        title: 'Project',
        description: 'Desc',
        inclusions: [],
        exclusions: [],
        deliverables: [],
        totalAmount: 3000,
        currency: 'USD',
        revisionAllowance: 2,
        lockedAt: new Date().toISOString(),
      },
      milestones: [
        {
          id: 'm1',
          contractId: 'test_contract_2',
          title: 'Milestone 1',
          description: 'Desc',
          deliverables: [],
          amount: 1000,
          currency: 'USD',
          status: 'completed',
          reviewState: 'approved',
          paymentState: 'released',
          fundedAt: new Date().toISOString(),
          releasedAt: new Date().toISOString(),
          revisionAllowance: 2,
          revisionCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'm2',
          contractId: 'test_contract_2',
          title: 'Milestone 2',
          description: 'Desc',
          deliverables: [],
          amount: 1000,
          currency: 'USD',
          status: 'in_progress',
          reviewState: 'pending_submission',
          paymentState: 'held',
          fundedAt: new Date().toISOString(),
          revisionAllowance: 2,
          revisionCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'm3',
          contractId: 'test_contract_2',
          title: 'Milestone 3',
          description: 'Desc',
          deliverables: [],
          amount: 1000,
          currency: 'USD',
          status: 'pending',
          reviewState: 'pending_submission',
          paymentState: 'unfunded',
          revisionAllowance: 2,
          revisionCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      creatorAcceptance: { accepted: true },
      talentAcceptance: { accepted: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const summary = deriveContractFinancialSummary(mockContract2, []);
    assert('Financial Summary Total Value is $3000', summary.totalContractValue === 3000);
    assert('Financial Summary Held Escrow is $1000', summary.totalHeldInEscrow === 1000);
    assert('Financial Summary Released is $1000', summary.totalReleased === 1000);
    assert('Financial Summary Unfunded is $1000', summary.totalUnfunded === 1000);
    assert('Financial Summary Platform Fee is $50', summary.totalPlatformFees === 50);
    assert('Financial Summary Net Talent Earned is $950', summary.netTalentEarned === 950);
  } catch (err: any) {
    assert('Financial Summary Derivation', false, err.message);
  }

  // ==========================================
  // Test 4: Strict Escrow State Machine & Role Authorization
  // ==========================================
  try {
    const contractState: GigLinkContract = {
      id: 'test_contract_sm',
      opportunityId: 'opp_sm',
      opportunityTitle: 'State Machine Test',
      applicationId: 'app_sm',
      creatorId: 'client_alice',
      creatorName: 'Alice',
      talentId: 'talent_bob',
      talentName: 'Bob',
      status: 'active',
      version: 1,
      conversationId: 'conv_sm',
      scopeLock: {
        title: 'State Machine',
        description: 'Testing legal transitions',
        inclusions: [],
        exclusions: [],
        deliverables: [],
        totalAmount: 1000,
        currency: 'USD',
        revisionAllowance: 2,
      },
      milestones: [
        {
          id: 'ms_1',
          contractId: 'test_contract_sm',
          title: 'Milestone Alpha',
          description: 'Deliver Alpha',
          deliverables: [],
          amount: 1000,
          currency: 'USD',
          status: 'in_progress',
          reviewState: 'submitted',
          paymentState: 'unfunded',
          revisionAllowance: 2,
          revisionCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      creatorAcceptance: { accepted: true },
      talentAcceptance: { accepted: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Talent cannot fund milestone
    const talentFundCheck = canFundMilestone(contractState, 'ms_1', 'talent_bob');
    assert(
      'Talent cannot fund milestone escrow',
      !talentFundCheck.allowed && !!talentFundCheck.reason?.includes('Unauthorized'),
      `Reason: ${talentFundCheck.reason}`
    );

    // 2. Client CAN fund milestone
    const clientFundCheck = canFundMilestone(contractState, 'ms_1', 'client_alice');
    assert('Client allowed to fund milestone escrow', clientFundCheck.allowed === true);

    // 3. Unapproved milestone CANNOT be released
    contractState.milestones[0].paymentState = 'held';
    const unapprovedReleaseCheck = canReleaseMilestonePayment(contractState, 'ms_1', 'client_alice');
    assert(
      'Unapproved milestone cannot be released',
      !unapprovedReleaseCheck.allowed && !!unapprovedReleaseCheck.reason?.includes('approved'),
      `Reason: ${unapprovedReleaseCheck.reason}`
    );

    // 4. Talent cannot release escrow to themselves even if approved
    contractState.milestones[0].reviewState = 'approved';
    const talentSelfReleaseCheck = canReleaseMilestonePayment(contractState, 'ms_1', 'talent_bob');
    assert(
      'Talent cannot release escrow to themselves',
      !talentSelfReleaseCheck.allowed && !!talentSelfReleaseCheck.reason?.includes('Unauthorized'),
      `Reason: ${talentSelfReleaseCheck.reason}`
    );

    // 5. Client CAN release escrow once approved
    const clientReleaseCheck = canReleaseMilestonePayment(contractState, 'ms_1', 'client_alice');
    assert('Client can release escrow for approved deliverable', clientReleaseCheck.allowed === true);

    // 6. Already released milestone cannot be released again
    contractState.milestones[0].paymentState = 'released';
    const doubleReleaseCheck = canReleaseMilestonePayment(contractState, 'ms_1', 'client_alice');
    assert(
      'Already released milestone cannot be released again',
      !doubleReleaseCheck.allowed && !!doubleReleaseCheck.reason?.includes('already been released'),
      `Reason: ${doubleReleaseCheck.reason}`
    );

    // 7. Disputed milestone locks escrow release
    contractState.milestones[0].paymentState = 'held';
    contractState.milestones[0].disputeStatus = 'disputed';
    const disputedReleaseCheck = canReleaseMilestonePayment(contractState, 'ms_1', 'client_alice');
    assert(
      'Disputed milestone locks escrow release',
      !disputedReleaseCheck.allowed && !!disputedReleaseCheck.reason?.includes('dispute'),
      `Reason: ${disputedReleaseCheck.reason}`
    );
  } catch (err: any) {
    assert('Escrow State Machine', false, err.message);
  }

  // ==========================================
  // Test 5: Contract Amendment Escrow Invariants
  // ==========================================
  try {
    const amendedContract: GigLinkContract = {
      id: 'test_contract_amend',
      opportunityId: 'opp_amend',
      opportunityTitle: 'Amendment Escrow Test',
      applicationId: 'app_amend',
      creatorId: 'client_alice',
      talentId: 'talent_bob',
      status: 'active',
      version: 2,
      conversationId: 'conv_amend',
      scopeLock: {
        title: 'Amended Scope',
        description: 'Budget expanded',
        inclusions: [],
        exclusions: [],
        deliverables: [],
        totalAmount: 1500,
        currency: 'USD',
        revisionAllowance: 2,
      },
      milestones: [
        {
          id: 'm_amended',
          contractId: 'test_contract_amend',
          title: 'Expanded Milestone',
          description: 'Scope increased from $1000 to $1500',
          deliverables: [],
          amount: 1500,
          currency: 'USD',
          status: 'in_progress',
          reviewState: 'pending_submission',
          paymentState: 'held',
          fundedAmount: 1000, // Only $1000 previously funded
          requiredFundingAmount: 1500, // $1500 required after amendment
          revisionAllowance: 2,
          revisionCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      creatorAcceptance: { accepted: true },
      talentAcceptance: { accepted: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Talent cannot submit if additional budget is unfunded
    const submitAmendedCheck = canSubmitMilestone(amendedContract, 'm_amended', 'talent_bob');
    assert(
      'Amended budget increase blocks submission until extra funding is held',
      !submitAmendedCheck.allowed && !!submitAmendedCheck.reason?.includes('Additional escrow funding required'),
      `Reason: ${submitAmendedCheck.reason}`
    );

    // Client can fund the delta
    const canFundDeltaCheck = canFundMilestone(amendedContract, 'm_amended', 'client_alice');
    assert('Client allowed to fund the amendment budget increase', canFundDeltaCheck.allowed === true);

    // Once delta is funded, submission is unblocked
    amendedContract.milestones[0].fundedAmount = 1500;
    const submitAfterDeltaCheck = canSubmitMilestone(amendedContract, 'm_amended', 'talent_bob');
    assert(
      'Submission unblocked once full amended funding is held',
      submitAfterDeltaCheck.allowed === true
    );
  } catch (err: any) {
    assert('Amendment Escrow Invariants', false, err.message);
  }

  const allPassed = results.every((r) => r.success);
  return { passed: allPassed, testResults: results };
}
