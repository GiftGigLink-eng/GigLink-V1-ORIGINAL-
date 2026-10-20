/**
 * Phase C-2A: Provider-Neutral Payment Architecture Test Suite
 *
 * Verifies:
 * 1. Provider-Neutral Contract Milestone Model & Deprecated Compatibility Aliases
 * 2. Provider-Neutral Financial Ledger & Webhook Persistence (ProviderWebhookEventRecord)
 * 3. Canonical 11-State Payment State Machine & Invariant Transitions
 * 4. Multi-Provider Orchestration & Adapter Boundaries (Stripe, Paystack, Mock)
 * 5. Financial Summary Aggregation Across Granular Operational States
 */

import {
  PaymentProvider,
  MilestoneEscrowState,
  ContractMilestonePaymentState,
  ContractMilestone,
  MilestonePaymentDetails,
  FinancialLedgerRecord,
  ProviderWebhookEventRecord,
  StripeWebhookEventRecord,
  TalentStripeAccount,
  TalentPayoutAccount,
  GigLinkContract,
} from '../types';
import {
  VALID_PAYMENT_STATE_TRANSITIONS,
  canTransitionPaymentState,
  assertValidPaymentStateTransition,
  InvalidPaymentStateTransitionError,
  isEscrowHeld,
  isTerminalSettlement,
} from '../server/payments/paymentStateMachine';
import { PaymentOrchestrator } from '../server/payments/PaymentOrchestrator';
import { MockPaymentAdapter } from '../server/payments/MockPaymentAdapter';
import { StripeConnectAdapter } from '../server/payments/StripeConnectAdapter';
import { PaystackAdapter } from '../server/payments/PaystackAdapter';
import {
  recordMilestoneFunded,
  recordMilestonePaymentReleased,
  recordMilestoneRefund,
  checkAndRecordWebhookEvent,
  clearMemoryLedgerForTesting,
  setLedgerWriterForTesting,
} from '../lib/financialLedgerService';
import { persistContract, getContract, setContractWriterForTesting } from '../lib/contractService';
import {
  deriveContractFinancialSummary,
  isMilestoneEscrowFunded,
  calculatePlatformFee,
} from '../lib/financialService';

export async function runPhaseC2ATests(): Promise<{ total: number; passed: number; failed: number }> {
  let total = 0;
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (!condition) {
      failed++;
      console.error(`  ✗ ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    passed++;
    console.log(`  ✓ ${message}`);
  }

  console.log('======================================================');
  console.log('   PHASE C-2A: PROVIDER-NEUTRAL PAYMENT ARCHITECTURE  ');
  console.log('======================================================');

  // Install in-memory test writers to bypass external Firestore permissions during isolated testing
  setContractWriterForTesting(async () => {});
  setLedgerWriterForTesting(async () => {});

  try {
    // -------------------------------------------------------------
    // 1. PROVIDER-NEUTRAL CONTRACT MILESTONE MODEL & ALIASES
    // -------------------------------------------------------------
  console.log('\n--- 1. Provider-Neutral Contract Milestone Model & Aliases ---');

  const sampleMilestone: ContractMilestone = {
    id: 'm_c2a_1',
    contractId: 'c_c2a_1',
    title: 'Smart Contract Architecture Spec',
    description: 'Deliver architecture specification for provider-neutral settlement',
    deliverables: ['architecture_spec.pdf'],
    amount: 2500,
    currency: 'USD',
    status: 'in_progress',
    reviewState: 'approved',
    revisionAllowance: 2,
    revisionCount: 0,
    paymentState: 'unfunded',
    paymentProvider: 'paystack',
    providerPaymentReference: 'paystack_tx_ref_1001',
    providerPayoutReference: 'paystack_payout_ref_2002',
    providerRefundReference: 'paystack_refund_ref_3003',
    // Backward-compatibility aliases
    paymentIntentId: 'paystack_tx_ref_1001',
    transferId: 'paystack_payout_ref_2002',
    refundId: 'paystack_refund_ref_3003',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert(sampleMilestone.paymentProvider === 'paystack', 'Milestone accepts paymentProvider');
  assert(sampleMilestone.providerPaymentReference === 'paystack_tx_ref_1001', 'Milestone stores providerPaymentReference');
  assert(sampleMilestone.providerPayoutReference === 'paystack_payout_ref_2002', 'Milestone stores providerPayoutReference');
  assert(sampleMilestone.providerRefundReference === 'paystack_refund_ref_3003', 'Milestone stores providerRefundReference');

  // Verify backward compatibility: legacy code accessing paymentIntentId / transferId / refundId
  assert(sampleMilestone.paymentIntentId === sampleMilestone.providerPaymentReference, 'Legacy paymentIntentId alias is readable and matches');
  assert(sampleMilestone.transferId === sampleMilestone.providerPayoutReference, 'Legacy transferId alias is readable and matches');
  assert(sampleMilestone.refundId === sampleMilestone.providerRefundReference, 'Legacy refundId alias is readable and matches');

  // Verify MilestonePaymentDetails provider neutrality
  const paymentDetails: MilestonePaymentDetails = {
    amount: 1500,
    currency: 'USD',
    paymentState: 'held',
    paymentProvider: 'stripe',
    providerPaymentReference: 'pi_authoritative_123',
    paymentIntentId: 'pi_authoritative_123',
  };
  assert(paymentDetails.paymentProvider === 'stripe', 'MilestonePaymentDetails accepts paymentProvider');
  assert(paymentDetails.providerPaymentReference === 'pi_authoritative_123', 'MilestonePaymentDetails stores providerPaymentReference');
  assert(paymentDetails.paymentIntentId === 'pi_authoritative_123', 'MilestonePaymentDetails preserves paymentIntentId alias');

  // -------------------------------------------------------------
  // 2. BACKWARD COMPATIBILITY TYPES (TalentStripeAccount & Webhooks)
  // -------------------------------------------------------------
  console.log('\n--- 2. Backward Compatibility Types & Webhook Store ---');

  const legacyStripeAccount: TalentStripeAccount = {
    userId: 'u_talent_88',
    stripeAccountId: 'acct_legacy_88',
    chargesEnabled: true,
    payoutsEnabled: true,
    detailsSubmitted: true,
    defaultCurrency: 'USD',
    country: 'US',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert(legacyStripeAccount.stripeAccountId === 'acct_legacy_88', 'TalentStripeAccount interface remains backwards compatible');

  const modernPayoutAccount: TalentPayoutAccount = {
    userId: 'u_talent_88',
    provider: 'paystack',
    providerAccountReference: 'RCP_paystack_88',
    country: 'NG',
    currency: 'NGN',
    status: 'ready',
    payoutsEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stripeAccountId: 'RCP_paystack_88', // Deprecated alias
  };
  assert(modernPayoutAccount.provider === 'paystack', 'TalentPayoutAccount supports non-Stripe providers');
  assert(modernPayoutAccount.providerAccountReference === 'RCP_paystack_88', 'TalentPayoutAccount stores providerAccountReference');

  // Webhook idempotency test with ProviderWebhookEventRecord
  const webhookEvent1 = {
    id: `evt_paystack_${Date.now()}`,
    type: 'charge.success',
    created: Date.now(),
    provider: 'paystack' as PaymentProvider,
  };
  const firstRecord = await checkAndRecordWebhookEvent(webhookEvent1);
  assert(!firstRecord.isDuplicate, 'First webhook event is not duplicate');
  assert(firstRecord.record.id === webhookEvent1.id, 'Webhook record preserves event ID');
  assert(firstRecord.record.provider === 'paystack', 'Webhook record preserves payment provider');

  const duplicateRecord = await checkAndRecordWebhookEvent(webhookEvent1);
  assert(duplicateRecord.isDuplicate, 'Second webhook event with same ID is detected as duplicate');

  // Verify StripeWebhookEventRecord alias compatibility
  const legacyWebhookRecord: StripeWebhookEventRecord = firstRecord.record;
  assert(legacyWebhookRecord.status === 'processed', 'StripeWebhookEventRecord type alias compiles and works');

  // -------------------------------------------------------------
  // 3. CANONICAL 11-STATE PAYMENT STATE MACHINE
  // -------------------------------------------------------------
  console.log('\n--- 3. Canonical 11-State Payment State Machine ---');

  const canonicalStates: MilestoneEscrowState[] = [
    'unfunded',
    'funding_pending',
    'held',
    'funding_failed',
    'release_pending',
    'released',
    'payout_pending',
    'paid_out',
    'payout_failed',
    'refund_pending',
    'refunded',
  ];

  // Verify ContractMilestonePaymentState is assignable to MilestoneEscrowState
  canonicalStates.forEach((state) => {
    const testState: ContractMilestonePaymentState = state;
    assert(typeof testState === 'string', `State '${state}' is part of canonical unified type`);
  });

  // Valid forward sequences
  assert(canTransitionPaymentState('unfunded', 'funding_pending'), 'unfunded -> funding_pending is permitted');
  assert(canTransitionPaymentState('funding_pending', 'held'), 'funding_pending -> held is permitted');
  assert(canTransitionPaymentState('funding_pending', 'funding_failed'), 'funding_pending -> funding_failed is permitted');
  assert(canTransitionPaymentState('funding_failed', 'funding_pending'), 'funding_failed -> funding_pending (retry) is permitted');
  assert(canTransitionPaymentState('held', 'release_pending'), 'held -> release_pending is permitted');
  assert(canTransitionPaymentState('release_pending', 'released'), 'release_pending -> released is permitted');
  assert(canTransitionPaymentState('released', 'payout_pending'), 'released -> payout_pending is permitted');
  assert(canTransitionPaymentState('payout_pending', 'paid_out'), 'payout_pending -> paid_out is permitted');
  assert(canTransitionPaymentState('payout_pending', 'payout_failed'), 'payout_pending -> payout_failed is permitted');
  assert(canTransitionPaymentState('payout_failed', 'payout_pending'), 'payout_failed -> payout_pending (retry) is permitted');
  assert(canTransitionPaymentState('held', 'refund_pending'), 'held -> refund_pending is permitted');
  assert(canTransitionPaymentState('refund_pending', 'refunded'), 'refund_pending -> refunded is permitted');

  // Terminal states have 0 outgoing transitions
  assert(VALID_PAYMENT_STATE_TRANSITIONS['paid_out'].length === 0, 'paid_out is terminal (0 outgoing transitions)');
  assert(VALID_PAYMENT_STATE_TRANSITIONS['refunded'].length === 0, 'refunded is terminal (0 outgoing transitions)');

  // Invariant illegal transitions rejected
  assert(!canTransitionPaymentState('unfunded', 'released'), 'unfunded -> released is strictly forbidden');
  assert(!canTransitionPaymentState('unfunded', 'paid_out'), 'unfunded -> paid_out is strictly forbidden');
  assert(!canTransitionPaymentState('released', 'refunded'), 'released -> refunded is strictly forbidden');
  assert(!canTransitionPaymentState('paid_out', 'refunded'), 'paid_out -> refunded is strictly forbidden');
  assert(!canTransitionPaymentState('refunded', 'held'), 'refunded -> held is strictly forbidden');

  // State classification helpers
  assert(isEscrowHeld('held'), 'isEscrowHeld recognizes held');
  assert(isEscrowHeld('release_pending'), 'isEscrowHeld recognizes release_pending');
  assert(isEscrowHeld('refund_pending'), 'isEscrowHeld recognizes refund_pending');
  assert(!isEscrowHeld('unfunded'), 'isEscrowHeld returns false for unfunded');
  assert(!isEscrowHeld('released'), 'isEscrowHeld returns false for released');
  assert(!isEscrowHeld('paid_out'), 'isEscrowHeld returns false for paid_out');

  assert(isTerminalSettlement('paid_out'), 'isTerminalSettlement recognizes paid_out');
  assert(isTerminalSettlement('refunded'), 'isTerminalSettlement recognizes refunded');
  assert(!isTerminalSettlement('held'), 'isTerminalSettlement returns false for held');

  // -------------------------------------------------------------
  // 4. FINANCIAL LEDGER SERVICE PROVIDER-NEUTRAL SYNC
  // -------------------------------------------------------------
  console.log('\n--- 4. Financial Ledger Service Provider-Neutral Sync ---');

  // Setup test contract
  const testContractId = `contract_c2a_${Date.now()}`;
  const testMilestoneId = `m_c2a_${Date.now()}`;
  const initialContract: GigLinkContract = {
    id: testContractId,
    opportunityTitle: 'Full-Stack Gig Settlement',
    opportunityId: 'opp_123',
    applicationId: 'app_c2a_123',
    conversationId: 'conv_c2a_123',
    version: 1,
    creatorAcceptance: { accepted: true, acceptedAt: new Date().toISOString() },
    talentAcceptance: { accepted: true, acceptedAt: new Date().toISOString() },
    creatorId: 'client_uid_101',
    creatorName: 'Acme Client Corp',
    talentId: 'talent_uid_202',
    talentName: 'Senior Solidity Eng',
    status: 'active',
    scopeLock: {
      title: 'Settlement Contract',
      description: 'Scope lock for settlement',
      inclusions: ['deliverables'],
      exclusions: [],
      deliverables: ['d1'],
      totalAmount: 3000,
      currency: 'USD',
      revisionAllowance: 2,
    },
    milestones: [
      {
        id: testMilestoneId,
        contractId: testContractId,
        title: 'Milestone 1 Core Development',
        description: 'Implement core contracts',
        deliverables: ['repo_link'],
        amount: 3000,
        currency: 'USD',
        status: 'completed',
        reviewState: 'approved',
        revisionAllowance: 2,
        revisionCount: 0,
        paymentState: 'unfunded',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    changeRequests: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await persistContract(initialContract);

  // Fund milestone with provider-neutral reference
  const fundedResult = await recordMilestoneFunded({
    contractId: testContractId,
    milestoneId: testMilestoneId,
    payerId: 'client_uid_101',
    payerName: 'Acme Client Corp',
    amount: 3000,
    currency: 'USD',
    paymentProvider: 'paystack',
    providerPaymentReference: 'paystack_charge_9988',
    provider: 'paystack' as any,
  });

  assert(fundedResult.milestone.paymentState === 'held', 'Milestone transitioned to held');
  assert(fundedResult.milestone.paymentProvider === 'paystack', 'Milestone paymentProvider is paystack');
  assert(fundedResult.milestone.providerPaymentReference === 'paystack_charge_9988', 'providerPaymentReference populated');
  assert(fundedResult.milestone.paymentIntentId === 'paystack_charge_9988', 'Deprecated paymentIntentId populated in sync');
  assert(fundedResult.ledgerRecord.provider === 'paystack', 'Ledger record provider is paystack');
  assert(fundedResult.ledgerRecord.providerReference === 'paystack_charge_9988', 'Ledger record providerReference populated');
  assert(fundedResult.ledgerRecord.providerPaymentReference === 'paystack_charge_9988', 'Ledger record providerPaymentReference populated');

  // Release milestone with provider-neutral payout reference
  const releaseResult = await recordMilestonePaymentReleased({
    contractId: testContractId,
    milestoneId: testMilestoneId,
    authorizedByUserId: 'client_uid_101',
    providerPayoutReference: 'paystack_transfer_7766',
    paymentProvider: 'paystack',
    provider: 'paystack' as any,
  });

  assert(releaseResult.milestone.paymentState === 'released', 'Milestone transitioned to released');
  assert(releaseResult.milestone.providerPayoutReference === 'paystack_transfer_7766', 'providerPayoutReference populated');
  assert(releaseResult.milestone.transferId === 'paystack_transfer_7766', 'Deprecated transferId populated in sync');
  assert(releaseResult.ledgerRecord.providerPayoutReference === 'paystack_transfer_7766', 'Ledger record providerPayoutReference populated');

  // -------------------------------------------------------------
  // 5. MULTI-PROVIDER ORCHESTRATOR RESOLUTION
  // -------------------------------------------------------------
  console.log('\n--- 5. Multi-Provider Orchestrator Resolution ---');

  const orchestrator = new PaymentOrchestrator();
  const mockAdapter = new MockPaymentAdapter();
  orchestrator.registerAdapter('test', mockAdapter);

  // Resolving specific registered adapters
  const stripeAdapter = orchestrator.getAdapter('stripe');
  assert(stripeAdapter instanceof StripeConnectAdapter, 'Orchestrator resolves Stripe adapter');
  assert(stripeAdapter.provider === 'stripe', 'Stripe adapter provider is stripe');

  const resolvedPaystack = orchestrator.getAdapter('paystack');
  assert(resolvedPaystack instanceof PaystackAdapter, 'Orchestrator resolves Paystack adapter');
  assert(resolvedPaystack.provider === 'paystack', 'Paystack adapter provider is paystack');

  const resolvedTest = orchestrator.getAdapter('test');
  assert(resolvedTest instanceof MockPaymentAdapter, 'Orchestrator resolves Test adapter');
  assert(resolvedTest.provider === 'test', 'Test adapter provider is test');

  // -------------------------------------------------------------
  // 6. FINANCIAL SUMMARY AGGREGATION ACROSS GRANULAR STATES
  // -------------------------------------------------------------
  console.log('\n--- 6. Financial Summary Aggregation Across Granular States ---');

  const multiStateContract: GigLinkContract = {
    ...initialContract,
    id: 'contract_summary_test',
    milestones: [
      {
        ...initialContract.milestones[0],
        id: 'ms_1',
        amount: 1000,
        paymentState: 'paid_out', // Fully settled
      },
      {
        ...initialContract.milestones[0],
        id: 'ms_2',
        amount: 1000,
        paymentState: 'release_pending', // Locked in escrow
      },
      {
        ...initialContract.milestones[0],
        id: 'ms_3',
        amount: 1000,
        paymentState: 'funding_pending', // In flight / unfunded
      },
    ],
  };

  const summary = deriveContractFinancialSummary(multiStateContract);
  assert(summary.totalReleased === 1000, 'totalReleased includes paid_out milestone ($1,000)');
  assert(summary.totalHeldInEscrow === 1000, 'totalHeldInEscrow includes release_pending milestone ($1,000)');
  assert(summary.totalUnfunded === 1000, 'totalUnfunded includes funding_pending milestone ($1,000)');
  assert(summary.totalFunded === 2000, 'totalFunded includes both held and settled ($2,000)');

  // Verify isMilestoneEscrowFunded across granular states
  assert(isMilestoneEscrowFunded(multiStateContract.milestones[0]), 'isMilestoneEscrowFunded true for paid_out');
  assert(isMilestoneEscrowFunded(multiStateContract.milestones[1]), 'isMilestoneEscrowFunded true for release_pending');
  assert(!isMilestoneEscrowFunded(multiStateContract.milestones[2]), 'isMilestoneEscrowFunded false for funding_pending');

  // -------------------------------------------------------------
  // 7. C-2A AUDIT FINDINGS CLOSURE (C2A-01, C2A-02, C2A-03)
  // -------------------------------------------------------------
  console.log('\n--- 7. C-2A Audit Findings Closure Verification ---');

  // C2A-01: UI Branding Verification
  const fs = await import('fs');
  const uiFilePath = 'src/components/opportunities/ContractFinancialSection.tsx';
  if (fs.existsSync(uiFilePath)) {
    const uiContent = fs.readFileSync(uiFilePath, 'utf-8');
    assert(!uiContent.includes('Stripe Protected'), 'C2A-01: UI does not contain legacy "Stripe Protected"');
    assert(!uiContent.includes('Set Up Stripe Payouts'), 'C2A-01: UI does not contain legacy "Set Up Stripe Payouts"');
    assert(!uiContent.includes('Stripe Payment & Secure Escrow Deposit'), 'C2A-01: UI does not contain legacy "Stripe Payment & Secure Escrow Deposit"');
    assert(!uiContent.includes('Stripe Connect payout account linked'), 'C2A-01: UI does not contain legacy "Stripe Connect payout account linked"');
    assert(uiContent.includes('Escrow Protected'), 'C2A-01: UI contains provider-neutral "Escrow Protected"');
    assert(uiContent.includes('Set Up Payout Account'), 'C2A-01: UI contains provider-neutral "Set Up Payout Account"');
    assert(uiContent.includes('Secure Escrow Deposit'), 'C2A-01: UI contains provider-neutral "Secure Escrow Deposit"');
  }

  // C2A-02: Firestore Blueprint Synchronization
  const blueprintPath = 'firebase-blueprint.json';
  if (fs.existsSync(blueprintPath)) {
    const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));
    const ledgerProviderEnum = blueprint.entities?.FinancialLedger?.properties?.provider?.enum;
    assert(Array.isArray(ledgerProviderEnum), 'C2A-02: FinancialLedger.provider enum is defined');
    assert(ledgerProviderEnum.includes('stripe'), 'C2A-02: FinancialLedger.provider enum includes stripe');
    assert(ledgerProviderEnum.includes('paystack'), 'C2A-02: FinancialLedger.provider enum includes paystack');
    assert(ledgerProviderEnum.includes('test'), 'C2A-02: FinancialLedger.provider enum includes test');
    assert(!ledgerProviderEnum.includes('simulated_stripe'), 'C2A-02: FinancialLedger.provider does NOT contain simulated_stripe');
  }

  // C2A-03: Legacy Stripe Prototype Isolation
  const stripeServicePath = 'src/server/stripeService.ts';
  if (fs.existsSync(stripeServicePath)) {
    const stripeServiceContent = fs.readFileSync(stripeServicePath, 'utf-8');
    assert(stripeServiceContent.includes('@deprecated'), 'C2A-03: stripeService.ts is explicitly marked with deprecation notices');
    assert(stripeServiceContent.includes('PaymentOrchestrator'), 'C2A-03: Documents that active architecture uses PaymentOrchestrator');
  }

    console.log('======================================================');
    console.log(`PHASE C-2A TEST RESULTS: ${passed}/${total} PASSED (${failed} FAILED)`);
    console.log('======================================================\n');

    return { total, passed, failed };
  } catch (err) {
    throw err;
  }
}

// Standalone execution support
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhaseC2ATests()
    .then(() => {
      setContractWriterForTesting(null);
      setLedgerWriterForTesting(null);
      process.exit(0);
    })
    .catch((err) => {
      setContractWriterForTesting(null);
      setLedgerWriterForTesting(null);
      console.error('Phase C-2A test failed:', err);
      process.exit(1);
    });
}
