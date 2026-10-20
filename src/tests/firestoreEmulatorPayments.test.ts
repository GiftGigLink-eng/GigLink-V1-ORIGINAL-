/**
 * GigLink Firestore Emulator Payment & Financial Ledger Test Suite
 *
 * Runs against an isolated Firestore Emulator instance (127.0.0.1:8888).
 * Guarantees zero connection to production Firestore ('giglink-bf27b').
 *
 * All critical payment paths (funding, release, refund, payout results, webhooks)
 * invoke genuine server-authoritative service functions (serverRecordMilestoneFunded,
 * serverRecordMilestonePaymentReleased, serverRecordMilestoneRefund, etc.) using
 * the Admin SDK against the live emulator WITHOUT using withSecurityRulesDisabled.
 */

import { initializeTestEnvironment, RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import {
  serverRecordMilestoneFunded,
  serverReserveMilestonePayout,
  serverRecordMilestonePaymentReleased,
  serverRecordMilestoneRefund,
  serverRecordMilestonePayoutSuccess,
  serverRecordMilestonePayoutFailure,
  serverReconcileMilestonePayout,
  serverCheckAndRecordWebhookEvent,
  serverGetWebhookEventRecord,
  serverGetContractLedgerRecords,
  serverGetContract,
  serverSetTalentPayoutAccount,
} from '../server/payments/serverFinancialLedgerService';
import {
  getDeterministicFundingLedgerId,
  setLedgerWriterForTesting,
  setSimulatedFundingTxFailureForTesting,
} from '../lib/financialLedgerService';
import { setPaymentSandboxDisabledForTesting } from '../server/payments/paymentSandboxGuard';
import { setContractWriterForTesting } from '../lib/contractService';
import { validatePaystackKeyFormat, PaystackAdapter } from '../server/payments/PaystackAdapter';
import { defaultPaymentOrchestrator } from '../server/payments/PaymentOrchestrator';
import { GigLinkContract } from '../types';

const EMULATOR_PROJECT_ID = 'giglink-emulator-payments-test';
process.env.GCLOUD_PROJECT = EMULATOR_PROJECT_ID;
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8888;

let testEnv: RulesTestEnvironment;

function createBaseContractFixture(id: string): GigLinkContract {
  return {
    id,
    opportunityId: `opp_${id}`,
    applicationId: `app_${id}`,
    creatorId: 'client_creator_100',
    talentId: 'talent_freelancer_200',
    opportunityTitle: 'Smart Contract Audit & Integration',
    creatorName: 'Client Creator',
    talentName: 'Talent Freelancer',
    version: 1,
    conversationId: `conv_${id}`,
    status: 'active',
    scopeLock: {
      title: 'Smart Contract Audit & Integration',
      description: 'Scope test description',
      deliverables: ['Architecture doc', 'Test suite'],
      inclusions: ['Backend audit'],
      exclusions: ['Frontend'],
      totalAmount: 10000,
      currency: 'NGN',
      revisionAllowance: 2,
      lockedAt: new Date().toISOString(),
    },
    creatorAcceptance: { accepted: true, acceptedAt: new Date().toISOString(), signedName: 'Client' },
    talentAcceptance: { accepted: true, acceptedAt: new Date().toISOString(), signedName: 'Talent' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    milestones: [
      {
        id: 'm_phase1',
        contractId: id,
        title: 'Milestone 1: Architecture Review',
        description: 'Complete architecture review and spec',
        deliverables: ['Architecture doc'],
        amount: 5000,
        currency: 'NGN',
        status: 'pending',
        reviewState: 'pending_submission',
        revisionAllowance: 2,
        revisionCount: 0,
        paymentState: 'funding_pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'm_phase2',
        contractId: id,
        title: 'Milestone 2: Test Implementation',
        description: 'Complete test suite implementation',
        deliverables: ['Test suite'],
        amount: 5000,
        currency: 'NGN',
        status: 'pending',
        reviewState: 'pending_submission',
        revisionAllowance: 2,
        revisionCount: 0,
        paymentState: 'funding_pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}

export async function runFirestoreEmulatorPaymentsSuite(): Promise<{
  total: number;
  passed: number;
  failed: number;
}> {
  console.log('================================================================');
  console.log('STARTING GIGLINK FIRESTORE EMULATOR PAYMENT INTEGRATION SUITE');
  console.log(`Target: Isolated Firestore Emulator (${EMULATOR_HOST}:${EMULATOR_PORT})`);
  console.log(`Project: ${EMULATOR_PROJECT_ID} (Zero Production Connection)`);
  console.log('================================================================\n');

  const rulesContent = readFileSync('firestore.rules', 'utf8');

  testEnv = await initializeTestEnvironment({
    projectId: EMULATOR_PROJECT_ID,
    firestore: {
      rules: rulesContent,
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
    },
  });

  // Ensure NO mock writer stubs are active: all calls must hit real Firestore
  setContractWriterForTesting(null as any);
  setLedgerWriterForTesting(null as any);
  setPaymentSandboxDisabledForTesting(false);

  let total = 0;
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ [EMULATOR PASS] ${testName}`);
    } else {
      failed++;
      console.error(`  ✗ [EMULATOR FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
    }
  }

  const contract1Id = 'cnt_emu_test_001';
  const contract1Fixture = createBaseContractFixture(contract1Id);
  const contract2Id = 'cnt_emu_test_002';
  const contract2Fixture = createBaseContractFixture(contract2Id);
  const contract3Id = 'cnt_emu_test_003';
  const contract3Fixture = createBaseContractFixture(contract3Id);

  // -------------------------------------------------------------------------
  // 1. ISOLATION & FIXTURE SETUP (Privileged Seeding)
  // -------------------------------------------------------------------------
  console.log('--- 1. Emulator Isolation & Baseline Fixture Setup ---');
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'contracts', contract1Id), contract1Fixture);
    await setDoc(doc(adminDb, 'contracts', contract2Id), contract2Fixture);
    await setDoc(doc(adminDb, 'contracts', contract3Id), contract3Fixture);
  });

  const adminCtx = testEnv.authenticatedContext('admin_user_000', { role: 'admin' });
  const creatorCtx = testEnv.authenticatedContext('client_creator_100');
  const talentCtx = testEnv.authenticatedContext('talent_freelancer_200');
  const attackerCtx = testEnv.authenticatedContext('attacker_eve_999');

  const seededSnap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract1Id));
  assert(seededSnap.exists(), '1.1 Contract seeded successfully in isolated emulator');
  assert(
    seededSnap.data()?.creatorId === 'client_creator_100',
    '1.2 Authoritative creatorId matches baseline fixture'
  );
  const seeded2Snap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract2Id));
  assert(seeded2Snap.exists(), '1.3 Contract 2 seeded successfully for concurrent and retry tests');

  // -------------------------------------------------------------------------
  // 2. SERVER-AUTHORITATIVE MILESTONE FUNDING & DETERMINISTIC LEDGER COMMIT
  //    (Executes genuine serverRecordMilestoneFunded with Admin SDK on emulator)
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Server-Authoritative Milestone Funding & Ledger Commit ---');
  const fundRef1 = `pstk_ref_${contract1Id}_m_phase1_${Date.now()}`;
  const deterministicLedgerId1 = getDeterministicFundingLedgerId(fundRef1);

  // Invoke the actual server-authoritative service function (bypasses no rules, uses Admin SDK transaction)
  const fundResult = await serverRecordMilestoneFunded({
    contractId: contract1Id,
    milestoneId: 'm_phase1',
    payerId: 'client_creator_100',
    payerName: 'Client Creator',
    amount: 5000,
    currency: 'NGN',
    paymentProvider: 'paystack',
    providerPaymentReference: fundRef1,
  });

  assert(fundResult.isReplay === false, '2.1 Initial funding is not marked as replay');
  assert(fundResult.milestone.paymentState === 'held', '2.2 Milestone returned with paymentState: "held"');
  assert(fundResult.milestone.fundedAmount === 5000, '2.3 Milestone returned with fundedAmount: 5000');
  assert(fundResult.ledgerRecord.id === deterministicLedgerId1, '2.4 Deterministic ledger ID generated');

  // Verify directly from the emulator via client read context
  const updatedContractSnap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract1Id));
  const m1 = (updatedContractSnap.data() as GigLinkContract).milestones.find((m) => m.id === 'm_phase1');
  assert(m1?.paymentState === 'held', '2.5 Contract milestone paymentState updated to "held" in emulator DB');
  assert(m1?.fundedAmount === 5000, '2.6 Contract milestone fundedAmount is 5000 NGN in emulator DB');
  assert(
    m1?.providerPaymentReference === fundRef1,
    '2.7 Provider payment reference persisted on milestone in emulator DB'
  );

  const ledgerDocSnap = await getDoc(doc(creatorCtx.firestore(), 'financialLedger', deterministicLedgerId1));
  assert(ledgerDocSnap.exists(), '2.8 Deterministic financial ledger record created in emulator DB');
  const ledgerData = ledgerDocSnap.data();
  assert(ledgerData?.amount === 5000, '2.9 Ledger gross amount is 5000 NGN');
  assert(
    ledgerData?.platformFee === 250 || ledgerData?.platformFeeAmount === 250,
    '2.10 Canonical 5% fee (250 NGN) recorded on ledger'
  );
  assert(ledgerData?.netTalentAmount === 4750, '2.11 Net talent amount (4750 NGN) recorded on ledger');
  assert(ledgerData?.payerId === 'client_creator_100', '2.12 Authoritative payerId recorded on ledger');

  // -------------------------------------------------------------------------
  // 3. IDEMPOTENCY, CONFLICTING REFERENCES & IMMUTABILITY
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Idempotency, Conflicting References & Immutability ---');

  // Replay: Re-invoking serverRecordMilestoneFunded with the exact same reference
  const replayResult = await serverRecordMilestoneFunded({
    contractId: contract1Id,
    milestoneId: 'm_phase1',
    payerId: 'client_creator_100',
    amount: 5000,
    currency: 'NGN',
    paymentProvider: 'paystack',
    providerPaymentReference: fundRef1,
  });
  assert(replayResult.isReplay === true, '3.1 Replayed funding reference recognized as isReplay: true');
  assert(replayResult.milestone.paymentState === 'held', '3.2 Milestone remains held on replay');

  // Conflict 1: Cross-milestone reference reuse attempt
  let crossMilestoneConflictThrew = false;
  try {
    await serverRecordMilestoneFunded({
      contractId: contract1Id,
      milestoneId: 'm_phase2',
      payerId: 'client_creator_100',
      amount: 5000,
      currency: 'NGN',
      paymentProvider: 'paystack',
      providerPaymentReference: fundRef1, // Reusing reference from m_phase1
    });
  } catch (err: any) {
    crossMilestoneConflictThrew = err.message.includes('Cross-milestone reuse is strictly prohibited');
  }
  assert(crossMilestoneConflictThrew, '3.3 Cross-milestone reference reuse rejected with conflict error');

  // Conflict 2: Conflicting amount with same reference
  let conflictingAmountThrew = false;
  try {
    await serverRecordMilestoneFunded({
      contractId: contract1Id,
      milestoneId: 'm_phase1',
      payerId: 'client_creator_100',
      amount: 9999, // Conflicting amount
      currency: 'NGN',
      paymentProvider: 'paystack',
      providerPaymentReference: fundRef1,
    });
  } catch (err: any) {
    conflictingAmountThrew = err.message.includes('conflicting amount/currency');
  }
  assert(conflictingAmountThrew, '3.4 Conflicting amount on same reference rejected with conflict error');

  // Firestore Rules Immutability: Client cannot mutate or delete ledger records
  await assertFails(
    updateDoc(doc(creatorCtx.firestore(), 'financialLedger', deterministicLedgerId1), {
      amount: 10000,
    })
  );
  assert(true, '3.5 Updating financial ledger record strictly REJECTED by Firestore rules');

  await assertFails(
    deleteDoc(doc(creatorCtx.firestore(), 'financialLedger', deterministicLedgerId1))
  );
  assert(true, '3.6 Deleting financial ledger record strictly REJECTED by Firestore rules');

  // Test 3.7: Concurrent funding attempt on Contract 2 Milestone 1
  const concFundRef = `pstk_conc_fund_${Date.now()}`;
  const [concRes1, concRes2] = await Promise.all([
    serverRecordMilestoneFunded({
      contractId: contract2Id,
      milestoneId: 'm_phase1',
      payerId: 'client_creator_100',
      payerName: 'Client Creator',
      amount: 5000,
      currency: 'NGN',
      paymentProvider: 'paystack',
      providerPaymentReference: concFundRef,
    }),
    serverRecordMilestoneFunded({
      contractId: contract2Id,
      milestoneId: 'm_phase1',
      payerId: 'client_creator_100',
      payerName: 'Client Creator',
      amount: 5000,
      currency: 'NGN',
      paymentProvider: 'paystack',
      providerPaymentReference: concFundRef,
    }),
  ]);
  const exactlyOneInitial =
    (concRes1.isReplay === false && concRes2.isReplay === true) ||
    (concRes1.isReplay === true && concRes2.isReplay === false);
  assert(
    exactlyOneInitial,
    '3.7 Concurrent funding deliveries safely serialized with exactly one initial commit and one replay'
  );

  // Test 3.8 - 3.11: Transaction Failure and Retry Behavior
  setSimulatedFundingTxFailureForTesting(new Error('Simulated transient database write conflict'));
  let txFailureCaught = false;
  try {
    await serverRecordMilestoneFunded({
      contractId: contract2Id,
      milestoneId: 'm_phase2',
      payerId: 'client_creator_100',
      payerName: 'Client Creator',
      amount: 5000,
      currency: 'NGN',
      paymentProvider: 'paystack',
      providerPaymentReference: `pstk_fail_attempt_${Date.now()}`,
    });
  } catch (err: any) {
    txFailureCaught = err.message.includes('Simulated transient database write conflict');
  }
  assert(txFailureCaught, '3.8 Transaction failure properly propagates without swallowing errors');

  // Verify DB state was NOT mutated during failed transaction
  const c2AfterFailSnap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract2Id));
  const m2AfterFail = (c2AfterFailSnap.data() as GigLinkContract).milestones.find((m) => m.id === 'm_phase2');
  assert(m2AfterFail?.paymentState === 'funding_pending', '3.9 Milestone remains in funding_pending after failed transaction');

  // Clear simulated failure and verify retry succeeds
  setSimulatedFundingTxFailureForTesting(null);
  const retryRef = `pstk_retry_ref_${Date.now()}`;
  const retryResult = await serverRecordMilestoneFunded({
    contractId: contract2Id,
    milestoneId: 'm_phase2',
    payerId: 'client_creator_100',
    payerName: 'Client Creator',
    amount: 5000,
    currency: 'NGN',
    paymentProvider: 'paystack',
    providerPaymentReference: retryRef,
  });
  assert(retryResult.milestone.paymentState === 'held', '3.10 Retrying milestone funding transaction succeeds after transient failure');
  const c2AfterRetrySnap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract2Id));
  const m2AfterRetry = (c2AfterRetrySnap.data() as GigLinkContract).milestones.find((m) => m.id === 'm_phase2');
  assert(m2AfterRetry?.paymentState === 'held', '3.11 Retried funding updates milestone in emulator DB');

  // -------------------------------------------------------------------------
  // 4. SERVER-AUTHORITATIVE WEBHOOK IDEMPOTENCY & REPLAY
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Server-Authoritative Webhook Idempotency & Replay ---');
  const webhookEventId = `evt_pstk_${Date.now()}_test`;

  // First webhook delivery via server service
  const webhookRes1 = await serverCheckAndRecordWebhookEvent({
    id: webhookEventId,
    type: 'charge.success',
    created: Math.floor(Date.now() / 1000),
    provider: 'paystack',
  });
  assert(webhookRes1.isDuplicate === false, '4.1 Initial webhook delivery recorded (isDuplicate: false)');

  // Verify in emulator DB
  const webhookSnap1 = await getDoc(doc(adminCtx.firestore(), 'webhookEvents', webhookEventId));
  assert(webhookSnap1.exists(), '4.2 Webhook event document persisted in emulator webhookEvents');

  // Second delivery of identical webhook
  const webhookRes2 = await serverCheckAndRecordWebhookEvent({
    id: webhookEventId,
    type: 'charge.success',
    created: Math.floor(Date.now() / 1000),
    provider: 'paystack',
  });
  assert(webhookRes2.isDuplicate === true, '4.3 Replayed webhook recognized as isDuplicate: true');

  // Client cannot mutate webhook record
  await assertFails(
    updateDoc(doc(creatorCtx.firestore(), 'webhookEvents', webhookEventId), {
      status: 'failed',
    })
  );
  assert(true, '4.4 Client mutating webhook event record strictly REJECTED by Firestore rules');

  // Test 4.5: Concurrent webhook delivery handling
  const concWebhookEventId = `evt_pstk_conc_${Date.now()}`;
  const [whConc1, whConc2] = await Promise.all([
    serverCheckAndRecordWebhookEvent({
      id: concWebhookEventId,
      type: 'charge.success',
      created: Math.floor(Date.now() / 1000),
      provider: 'paystack',
    }),
    serverCheckAndRecordWebhookEvent({
      id: concWebhookEventId,
      type: 'charge.success',
      created: Math.floor(Date.now() / 1000),
      provider: 'paystack',
    }),
  ]);
  const exactlyOneInitialWh =
    (whConc1.isDuplicate === false && whConc2.isDuplicate === true) ||
    (whConc1.isDuplicate === true && whConc2.isDuplicate === false);
  assert(
    exactlyOneInitialWh,
    '4.5 Concurrent webhook deliveries safely handled with deduplication'
  );

  // -------------------------------------------------------------------------
  // 5. SERVER-AUTHORITATIVE MILESTONE PAYMENT RELEASE
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Server-Authoritative Milestone Payment Release ---');
  // Privileged Fixture State Update: Set milestone reviewState to approved
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const cRef = doc(db, 'contracts', contract1Id);
    const snap = await getDoc(cRef);
    const current = snap.data() as GigLinkContract;
    const idx = current.milestones.findIndex((m) => m.id === 'm_phase1');
    current.milestones[idx].reviewState = 'approved';
    await updateDoc(cRef, { milestones: current.milestones });
  });

  // Unauthorized release attempt: Talent cannot release their own escrow funds
  let talentReleaseBlocked = false;
  try {
    await serverRecordMilestonePaymentReleased({
      contractId: contract1Id,
      milestoneId: 'm_phase1',
      authorizedByUserId: 'talent_freelancer_200', // Talent attempting self-release
      providerPayoutReference: 'TRF_unauth_talent',
      paymentProvider: 'paystack',
    });
  } catch (err: any) {
    talentReleaseBlocked = err.message.includes('Talent cannot release their own escrow funds');
  }
  assert(talentReleaseBlocked, '5.1 Talent self-release attempt strictly REJECTED');

  // Authorized release execution via server-authoritative service
  const releaseResult = await serverRecordMilestonePaymentReleased({
    contractId: contract1Id,
    milestoneId: 'm_phase1',
    authorizedByUserId: 'client_creator_100', // Authorized client
    providerPayoutReference: 'TRF_rel_phase1',
    paymentProvider: 'paystack',
  });
  assert(releaseResult.milestone.paymentState === 'released', '5.2 Milestone transitioned to "released"');
  assert(releaseResult.ledgerRecord.type === 'escrow_release', '5.3 Escrow release ledger record emitted');

  // Verify in emulator DB
  const releasedContractSnap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract1Id));
  const releasedM1 = (releasedContractSnap.data() as GigLinkContract).milestones.find((m) => m.id === 'm_phase1');
  assert(releasedM1?.paymentState === 'released', '5.4 Milestone paymentState is "released" in emulator DB');

  const releaseLedgerDocSnap = await getDoc(doc(talentCtx.firestore(), 'financialLedger', releaseResult.ledgerRecord.id));
  assert(releaseLedgerDocSnap.exists(), '5.5 Release ledger document persisted in emulator DB');
  assert(releaseLedgerDocSnap.data()?.netTalentAmount === 4750, '5.6 Release ledger records net 4750 NGN');

  // -------------------------------------------------------------------------
  // 6. SERVER-AUTHORITATIVE MILESTONE REFUND
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Server-Authoritative Milestone Refund ---');
  // Fund Milestone 2 first using production service
  const fundRef2 = `pstk_ref_${contract1Id}_m_phase2_${Date.now()}`;
  await serverRecordMilestoneFunded({
    contractId: contract1Id,
    milestoneId: 'm_phase2',
    payerId: 'client_creator_100',
    payerName: 'Client Creator',
    amount: 5000,
    currency: 'NGN',
    paymentProvider: 'paystack',
    providerPaymentReference: fundRef2,
  });

  // Unauthorized refund attempt: Third-party cannot refund
  let unauthorizedRefundBlocked = false;
  try {
    await serverRecordMilestoneRefund({
      contractId: contract1Id,
      milestoneId: 'm_phase2',
      authorizedByUserId: 'attacker_eve_999',
      reason: 'Unauthorized refund attack',
    });
  } catch (err: any) {
    unauthorizedRefundBlocked = err.message.includes('Only Client/Creator can refund escrow funds');
  }
  assert(unauthorizedRefundBlocked, '6.1 Unauthorized refund attempt strictly REJECTED');

  // Authorized refund execution via server-authoritative service
  const refundResult = await serverRecordMilestoneRefund({
    contractId: contract1Id,
    milestoneId: 'm_phase2',
    authorizedByUserId: 'client_creator_100',
    reason: 'Client requested cancellation and refund',
    providerRefundReference: 'pstk_refund_m2',
    paymentProvider: 'paystack',
  });
  assert(refundResult.milestone.paymentState === 'refunded', '6.2 Milestone 2 transitioned to "refunded"');
  assert(refundResult.ledgerRecord.type === 'escrow_refund', '6.3 Escrow refund ledger record emitted');

  // Verify in emulator DB
  const refundedContractSnap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract1Id));
  const refundedM2 = (refundedContractSnap.data() as GigLinkContract).milestones.find((m) => m.id === 'm_phase2');
  assert(refundedM2?.paymentState === 'refunded', '6.4 Milestone 2 paymentState is "refunded" in emulator DB');

  const refundLedgerDocSnap = await getDoc(doc(creatorCtx.firestore(), 'financialLedger', refundResult.ledgerRecord.id));
  assert(refundLedgerDocSnap.exists(), '6.5 Refund ledger document persisted in emulator DB');

  // -------------------------------------------------------------------------
  // 7. SERVER-AUTHORITATIVE PAYOUT SUCCESS & FAILURE
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Server-Authoritative Payout Success & Failure ---');
  const succRec = await serverRecordMilestonePayoutSuccess({
    contractId: contract1Id,
    milestoneId: 'm_phase1',
    payoutReference: 'TRF_succ_phase1',
    provider: 'paystack',
    eventId: 'evt_payout_succ',
  });
  assert(succRec.status === 'succeeded', '7.1 Payout success record status is "succeeded"');

  const failRec = await serverRecordMilestonePayoutFailure({
    contractId: contract1Id,
    milestoneId: 'm_phase1',
    payoutReference: 'TRF_fail_phase1',
    reason: 'Insufficient balance in provider account',
    provider: 'paystack',
    eventId: 'evt_payout_fail',
  });
  assert(failRec.status === 'failed', '7.2 Payout failure record status is "failed"');
  assert(
    failRec.failureReason === 'Insufficient balance in provider account',
    '7.3 Payout failure captures failure reason authoritatively'
  );

  // Verify records exist in emulator DB
  const succSnap = await getDoc(doc(talentCtx.firestore(), 'financialLedger', succRec.id));
  assert(succSnap.exists(), '7.4 Payout success persisted in emulator DB');

  // Verify milestone 1 remains in terminal paid_out state and was not corrupted by spurious failure
  const m1TerminalSnap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract1Id));
  const m1Terminal = (m1TerminalSnap.data() as GigLinkContract).milestones.find((m) => m.id === 'm_phase1');
  assert(m1Terminal?.paymentState === 'paid_out', '7.5 Terminal paid_out state preserved against spurious failure');

  // -------------------------------------------------------------------------
  // 8. FINANCIAL LEDGER CONSISTENCY & QUERY SECURITY
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Financial Ledger Consistency & Query Security ---');
  const contractLedger = await serverGetContractLedgerRecords(contract1Id);
  assert(
    contractLedger.length >= 5,
    `8.1 All contract ledger records queryable by server (found ${contractLedger.length} records)`
  );

  // Attacker cannot list or query ledger records
  await assertFails(
    getDocs(
      query(
        collection(attackerCtx.firestore(), 'financialLedger'),
        where('contractId', '==', contract1Id)
      )
    )
  );
  assert(true, '8.2 Third-party attacker cannot list financial ledger records');

  // Attacker cannot inject forged ledger record
  await assertFails(
    setDoc(doc(attackerCtx.firestore(), 'financialLedger', 'tx_forged_999'), {
      id: 'tx_forged_999',
      contractId: contract1Id,
      milestoneId: 'm_phase1',
      type: 'escrow_funding',
      amount: 999999,
      currency: 'NGN',
      payerId: 'attacker_eve_999',
      recipientId: 'attacker_eve_999',
      status: 'released',
      createdAt: new Date().toISOString(),
    })
  );
  assert(true, '8.3 Attacker direct write to financialLedger strictly REJECTED');

  // 8.4 Ordinary client cannot directly mutate milestone paymentState on an active contract
  const c1Data = (await getDoc(doc(creatorCtx.firestore(), 'contracts', contract1Id))).data() as GigLinkContract;
  const tamperedMilestones = c1Data.milestones.map((m) => ({ ...m, paymentState: 'held' }));
  await assertFails(
    updateDoc(doc(creatorCtx.firestore(), 'contracts', contract1Id), {
      milestones: tamperedMilestones,
    })
  );
  assert(true, '8.4 Non-admin client cannot directly mutate milestone paymentState on active contract');

  // 8.5 Ordinary client cannot directly write to talentPayoutAccounts
  await assertFails(
    setDoc(doc(creatorCtx.firestore(), 'talentPayoutAccounts', 'user_hacker_123'), {
      userId: 'user_hacker_123',
      provider: 'paystack',
      accountNumber: '0123456789',
    })
  );
  assert(true, '8.5 Direct client writes to talentPayoutAccounts strictly REJECTED by Firestore rules');

  // -------------------------------------------------------------------------
  // 9. SANDBOX-DISABLED PAYMENT ISOLATION (ZERO CANONICAL MUTATIONS)
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Sandbox Mode Test Payment Isolation (Fail-Closed) ---');
  setPaymentSandboxDisabledForTesting(true);

  const contractBeforeSnap = await getDoc(doc(adminCtx.firestore(), 'contracts', contract1Id));
  const contractBeforeData = JSON.stringify(contractBeforeSnap.data());

  let fundingThrewSandboxGuard = false;
  try {
    await serverRecordMilestoneFunded({
      contractId: contract1Id,
      milestoneId: 'm_phase1',
      payerId: 'client_creator_100',
      amount: 5000,
      currency: 'NGN',
      providerPaymentReference: 'pstk_sandbox_attempt_ref',
    });
  } catch (err: any) {
    fundingThrewSandboxGuard = err.message.includes('[Payment Sandbox Guard]');
  }
  assert(fundingThrewSandboxGuard, '9.1 serverRecordMilestoneFunded throws [Payment Sandbox Guard] in sandbox mode');

  let releaseThrewSandboxGuard = false;
  try {
    await serverRecordMilestonePaymentReleased({
      contractId: contract1Id,
      milestoneId: 'm_phase1',
      authorizedByUserId: 'client_creator_100',
    });
  } catch (err: any) {
    releaseThrewSandboxGuard = err.message.includes('[Payment Sandbox Guard]');
  }
  assert(releaseThrewSandboxGuard, '9.2 serverRecordMilestonePaymentReleased throws [Payment Sandbox Guard]');

  let refundThrewSandboxGuard = false;
  try {
    await serverRecordMilestoneRefund({
      contractId: contract1Id,
      milestoneId: 'm_phase1',
      authorizedByUserId: 'client_creator_100',
      refundAmount: 5000,
    });
  } catch (err: any) {
    refundThrewSandboxGuard = err.message.includes('[Payment Sandbox Guard]');
  }
  assert(refundThrewSandboxGuard, '9.3 serverRecordMilestoneRefund throws [Payment Sandbox Guard]');

  let webhookThrewSandboxGuard = false;
  try {
    await serverCheckAndRecordWebhookEvent({
      id: 'evt_sandbox_attempt',
      type: 'charge.success',
      created: Date.now(),
      provider: 'paystack',
    });
  } catch (err: any) {
    webhookThrewSandboxGuard = err.message.includes('[Payment Sandbox Guard]');
  }
  assert(webhookThrewSandboxGuard, '9.4 serverCheckAndRecordWebhookEvent throws [Payment Sandbox Guard]');

  // Verify that the contract in Firestore was completely untouched
  const contractAfterSnap = await getDoc(doc(adminCtx.firestore(), 'contracts', contract1Id));
  const contractAfterData = JSON.stringify(contractAfterSnap.data());
  assert(
    contractBeforeData === contractAfterData,
    '9.5 Contract document in Firestore remains 100% UNCHANGED after blocked sandbox attempts'
  );

  setPaymentSandboxDisabledForTesting(false);

  // -------------------------------------------------------------------------
  // 10. LOCAL PAYSTACK KEY FORMAT VALIDATION
  // -------------------------------------------------------------------------
  console.log('\n--- 10. Local Paystack Key Format Validation ---');
  let missingKeyFailed = false;
  try {
    validatePaystackKeyFormat(undefined);
  } catch (err: any) {
    missingKeyFailed = err.message.includes('PAYSTACK_SECRET_KEY is not defined');
  }
  assert(missingKeyFailed, '10.1 Undefined key fails locally with configuration error');

  let emptyKeyFailed = false;
  try {
    validatePaystackKeyFormat('');
  } catch (err: any) {
    emptyKeyFailed = err.message.includes('PAYSTACK_SECRET_KEY is not defined');
  }
  assert(emptyKeyFailed, '10.2 Empty key fails locally with configuration error');

  let whitespaceKeyFailed = false;
  try {
    validatePaystackKeyFormat('    ');
  } catch (err: any) {
    whitespaceKeyFailed = err.message.includes('PAYSTACK_SECRET_KEY is not defined');
  }
  assert(whitespaceKeyFailed, '10.3 Whitespace-only key fails locally with configuration error');

  let invalidPrefixFailed = false;
  try {
    validatePaystackKeyFormat('sk_fake_secret_12345');
  } catch (err: any) {
    invalidPrefixFailed = err.message.includes('invalid key prefix');
  }
  assert(invalidPrefixFailed, '10.4 Invalid prefix fails locally before external request');

  let bareTestPrefixFailed = false;
  try {
    validatePaystackKeyFormat('sk_test_');
  } catch (err: any) {
    bareTestPrefixFailed = err.message.includes('incomplete') && err.message.includes('non-empty credential suffix');
  }
  assert(bareTestPrefixFailed, '10.5 Bare "sk_test_" prefix fails locally before external request');

  let bareLivePrefixFailed = false;
  try {
    validatePaystackKeyFormat('sk_live_');
  } catch (err: any) {
    bareLivePrefixFailed = err.message.includes('incomplete') && err.message.includes('non-empty credential suffix');
  }
  assert(bareLivePrefixFailed, '10.6 Bare "sk_live_" prefix fails locally before external request');

  let validTestKeyPassed = false;
  try {
    const res = validatePaystackKeyFormat('sk_test_synthetic_token_12345');
    validTestKeyPassed = res === 'sk_test_synthetic_token_12345';
  } catch {
    validTestKeyPassed = false;
  }
  assert(validTestKeyPassed, '10.7 Valid synthetic test key format accepted locally');

  let validLiveKeyPassed = false;
  try {
    const res = validatePaystackKeyFormat('sk_live_synthetic_token_67890');
    validLiveKeyPassed = res === 'sk_live_synthetic_token_67890';
  } catch {
    validLiveKeyPassed = false;
  }
  assert(validLiveKeyPassed, '10.8 Valid synthetic live key format accepted locally');

  // -------------------------------------------------------------------------
  // 11. PAYOUT IDEMPOTENCY, PRE-PAYOUT RESERVATION & RECONCILIATIONS
  // -------------------------------------------------------------------------
  console.log('\n--- 11. Payout Idempotency, Pre-Payout Reservation & Reconciliations ---');

  // 11.1 Unauthorized release: Talent cannot reserve milestone for payout
  let talentReserveBlocked = false;
  try {
    await serverReserveMilestonePayout({
      contractId: contract3Id,
      milestoneId: 'm_phase1',
      authorizedByUserId: 'talent_freelancer_200',
    });
  } catch (err: any) {
    talentReserveBlocked = err.message.includes('Talent cannot release their own escrow funds');
  }
  assert(talentReserveBlocked, '11.1 Talent self-reservation strictly REJECTED');

  // 11.2 Unauthorized release: Third party cannot reserve milestone
  let attackerReserveBlocked = false;
  try {
    await serverReserveMilestonePayout({
      contractId: contract3Id,
      milestoneId: 'm_phase1',
      authorizedByUserId: 'attacker_eve_999',
    });
  } catch (err: any) {
    attackerReserveBlocked = err.message.includes('Only Client/Creator can release escrow funds');
  }
  assert(attackerReserveBlocked, '11.2 Attacker reservation strictly REJECTED');

  // 11.3 Deliverables review check: Cannot reserve milestone with unapproved deliverables
  let unapprovedReserveBlocked = false;
  try {
    await serverReserveMilestonePayout({
      contractId: contract3Id,
      milestoneId: 'm_phase1',
      authorizedByUserId: 'client_creator_100',
    });
  } catch (err: any) {
    unapprovedReserveBlocked = err.message.includes('deliverables must be reviewed and approved');
  }
  assert(unapprovedReserveBlocked, '11.3 Unapproved deliverables reservation strictly REJECTED');

  // Privileged update: set reviewState to 'approved'
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const cRef = doc(db, 'contracts', contract3Id);
    const snap = await getDoc(cRef);
    const current = snap.data() as GigLinkContract;
    current.milestones[0].reviewState = 'approved';
    current.milestones[1].reviewState = 'approved';
    await updateDoc(cRef, { milestones: current.milestones });
  });

  // 11.4 Payment state check: Cannot reserve unfunded milestone
  let unfundedReserveBlocked = false;
  try {
    await serverReserveMilestonePayout({
      contractId: contract3Id,
      milestoneId: 'm_phase1',
      authorizedByUserId: 'client_creator_100',
    });
  } catch (err: any) {
    unfundedReserveBlocked =
      err.message.includes('Funds must be held in escrow prior to release') ||
      err.message.includes('Cannot release milestone in');
  }
  assert(unfundedReserveBlocked, '11.4 Unfunded milestone reservation strictly REJECTED');

  // Fund Contract 3 Milestone 1 via server-authoritative service
  const fundC3M1Ref = `pstk_ref_${contract3Id}_m_phase1_${Date.now()}`;
  const c3m1FundResult = await serverRecordMilestoneFunded({
    contractId: contract3Id,
    milestoneId: 'm_phase1',
    payerId: 'client_creator_100',
    payerName: 'Client Creator',
    amount: 5000,
    currency: 'NGN',
    paymentProvider: 'paystack',
    providerPaymentReference: fundC3M1Ref,
  });
  assert(c3m1FundResult.milestone.paymentState === 'held', '11.5 Contract 3 Milestone 1 funded into escrow ("held")');

  // 11.6 Two concurrent release requests
  const [resConcurrentA, resConcurrentB] = await Promise.all([
    serverReserveMilestonePayout({
      contractId: contract3Id,
      milestoneId: 'm_phase1',
      authorizedByUserId: 'client_creator_100',
    }),
    serverReserveMilestonePayout({
      contractId: contract3Id,
      milestoneId: 'm_phase1',
      authorizedByUserId: 'client_creator_100',
    }),
  ]);
  const exactlyOneReserved =
    (resConcurrentA.status === 'reserved' && resConcurrentB.status === 'already_reserved') ||
    (resConcurrentA.status === 'already_reserved' && resConcurrentB.status === 'reserved');
  assert(exactlyOneReserved, '11.6 Two concurrent release requests: exactly one reserves and one detects already_reserved');
  assert(
    resConcurrentA.payoutReference === resConcurrentB.payoutReference,
    '11.7 Concurrent requests share the exact same stable payout reference'
  );

  const reservedRef = resConcurrentA.payoutReference;
  const c3m1ReservedSnap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract3Id));
  const c3m1ReservedData = (c3m1ReservedSnap.data() as GigLinkContract).milestones.find((m) => m.id === 'm_phase1');
  assert(
    c3m1ReservedData?.paymentState === 'release_pending',
    '11.8 Contract 3 Milestone 1 transitioned to "release_pending" in emulator DB'
  );

  // 11.9 No second disbursement or conflicting refund while unresolved
  let conflictingRefundBlocked = false;
  try {
    await serverRecordMilestoneRefund({
      contractId: contract3Id,
      milestoneId: 'm_phase1',
      authorizedByUserId: 'client_creator_100',
      reason: 'Attempted refund during release_pending',
    });
  } catch (err: any) {
    conflictingRefundBlocked = err.message.includes('Only held escrow funds can be refunded');
  }
  assert(conflictingRefundBlocked, '11.9 Conflicting refund blocked while milestone is in release_pending');

  // Re-calling serverReserveMilestonePayout reuses existing reservation
  const retryReservation = await serverReserveMilestonePayout({
    contractId: contract3Id,
    milestoneId: 'm_phase1',
    authorizedByUserId: 'client_creator_100',
  });
  assert(retryReservation.status === 'already_reserved', '11.10 Repeat reservation call returns already_reserved');
  assert(retryReservation.payoutReference === reservedRef, '11.11 Repeat reservation reuses the exact same reference');

  // Setup talent payout account for contract3 talent
  await serverSetTalentPayoutAccount({
    userId: 'talent_freelancer_200',
    provider: 'paystack',
    providerAccountReference: 'RCP_test_talent_200',
    country: 'NG',
    currency: 'NGN',
    status: 'ready',
    payoutsEnabled: true,
    chargesEnabled: true,
    detailsSubmitted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const paystackAdapter = defaultPaymentOrchestrator.getAdapter('paystack') as PaystackAdapter;

  // 11.12 Provider timeout after possible submission
  paystackAdapter.setHttpTransportForTesting(async (opts) => {
    if (opts.path === '/transfer' && opts.method === 'POST') {
      throw new Error('ETIMEDOUT: Connection timed out after sending transfer request to Paystack');
    }
    return { status: 500, data: { status: false, message: 'Unexpected call' } };
  });

  const c3CurrentContract = (await serverGetContract(contract3Id))!;
  const c3m1Current = c3CurrentContract.milestones.find((m) => m.id === 'm_phase1')!;
  const talentAccount = {
    userId: 'talent_freelancer_200',
    provider: 'paystack',
    providerAccountReference: 'RCP_test_talent_200',
  } as any;

  const timeoutPayoutResult = await defaultPaymentOrchestrator.executeMilestonePayout(
    c3CurrentContract,
    c3m1Current,
    talentAccount,
    { payoutReference: reservedRef, preferredProvider: 'paystack' }
  );
  assert(timeoutPayoutResult.status === 'pending', '11.12 Provider timeout returns status: pending');
  assert(timeoutPayoutResult.isTimeout === true, '11.13 Provider timeout flagged as isTimeout: true');
  assert(timeoutPayoutResult.payoutId === reservedRef, '11.14 Payout reference preserved on timeout');

  // Verify milestone in DB remains release_pending (NOT paid_out, NOT reverted to held)
  const c3m1AfterTimeoutSnap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract3Id));
  const c3m1AfterTimeout = (c3m1AfterTimeoutSnap.data() as GigLinkContract).milestones.find((m) => m.id === 'm_phase1');
  assert(
    c3m1AfterTimeout?.paymentState === 'release_pending',
    '11.15 Milestone remains in release_pending after provider timeout'
  );

  // 11.16 Retry after timeout reusing the same persisted reference
  let verifyCalledWithReference: string | null = null;
  paystackAdapter.setHttpTransportForTesting(async (opts) => {
    if (opts.path === '/transfer' && opts.method === 'POST') {
      return {
        status: 400,
        data: {
          status: false,
          message: `Duplicate Reference: Transfer with reference '${opts.body?.reference}' already exists`,
        },
      };
    }
    if (opts.path.startsWith('/transfer/verify/')) {
      verifyCalledWithReference = opts.path.replace('/transfer/verify/', '');
      return {
        status: 200,
        data: {
          status: true,
          data: {
            status: 'pending',
            transfer_code: 'TRF_pnd_recon',
          },
        },
      };
    }
    return { status: 500, data: { status: false } };
  });

  const retryPayoutResult = await defaultPaymentOrchestrator.executeMilestonePayout(
    c3CurrentContract,
    c3m1AfterTimeout!,
    talentAccount,
    { payoutReference: reservedRef, preferredProvider: 'paystack' }
  );
  assert(
    verifyCalledWithReference === reservedRef,
    '11.16 Retry verifies transfer using the exact persisted payout reference'
  );
  assert(retryPayoutResult.status === 'pending', '11.17 Duplicate transfer response safely kept as pending');

  // 11.18 Reconciliation of unknown transfer outcome (transition to paid_out)
  paystackAdapter.setHttpTransportForTesting(async (opts) => {
    if (opts.path.startsWith('/transfer/verify/')) {
      return {
        status: 200,
        data: {
          status: true,
          data: {
            status: 'success',
            transfer_code: 'TRF_pnd_recon',
          },
        },
      };
    }
    return { status: 500, data: { status: false } };
  });

  const reconResult = await serverReconcileMilestonePayout({
    contractId: contract3Id,
    milestoneId: 'm_phase1',
    provider: 'paystack',
  });
  assert(reconResult.status === 'succeeded', '11.18 Payout reconciliation verified provider transfer success');
  assert(reconResult.milestone.paymentState === 'paid_out', '11.19 Milestone settled to paid_out on reconciliation');

  const c3m1ReconciledSnap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract3Id));
  const c3m1Reconciled = (c3m1ReconciledSnap.data() as GigLinkContract).milestones.find((m) => m.id === 'm_phase1');
  assert(c3m1Reconciled?.paymentState === 'paid_out', '11.20 Contract 3 Milestone 1 is paid_out in emulator DB');

  // 11.21 Server-side persistence replay idempotency
  const replayRelease = await serverRecordMilestonePaymentReleased({
    contractId: contract3Id,
    milestoneId: 'm_phase1',
    authorizedByUserId: 'client_creator_100',
    providerPayoutReference: reservedRef,
    paymentProvider: 'paystack',
  });
  assert(replayRelease.isReplay === true, '11.21 Replayed release on finalized milestone returns isReplay: true');

  const replaySuccess = await serverRecordMilestonePayoutSuccess({
    contractId: contract3Id,
    milestoneId: 'm_phase1',
    payoutReference: reservedRef,
    provider: 'paystack',
  });
  assert(replaySuccess.status === 'succeeded', '11.22 Replayed payout success returns existing settled ledger record');

  // 11.23 Duplicate success webhook
  const whEventId = `evt_trf_succ_${contract3Id}_m1`;
  const [wh1, wh2] = [
    await serverCheckAndRecordWebhookEvent({
      id: whEventId,
      type: 'transfer.success',
      created: Math.floor(Date.now() / 1000),
      provider: 'paystack',
    }),
    await serverCheckAndRecordWebhookEvent({
      id: whEventId,
      type: 'transfer.success',
      created: Math.floor(Date.now() / 1000),
      provider: 'paystack',
    }),
  ];
  assert(wh1.isDuplicate === false, '11.23 First transfer webhook processed (isDuplicate: false)');
  assert(wh2.isDuplicate === true, '11.24 Second transfer webhook deduplicated (isDuplicate: true)');

  // 11.25 Failure webhook followed by success (on Milestone 2)
  const fundC3M2Ref = `pstk_ref_${contract3Id}_m_phase2_${Date.now()}`;
  await serverRecordMilestoneFunded({
    contractId: contract3Id,
    milestoneId: 'm_phase2',
    payerId: 'client_creator_100',
    payerName: 'Client Creator',
    amount: 5000,
    currency: 'NGN',
    paymentProvider: 'paystack',
    providerPaymentReference: fundC3M2Ref,
  });

  const resM2 = await serverReserveMilestonePayout({
    contractId: contract3Id,
    milestoneId: 'm_phase2',
    authorizedByUserId: 'client_creator_100',
  });
  assert(resM2.status === 'reserved', '11.25 Milestone 2 reserved for payout');

  // Provider reports transfer failure
  const failM2Rec = await serverRecordMilestonePayoutFailure({
    contractId: contract3Id,
    milestoneId: 'm_phase2',
    payoutReference: resM2.payoutReference,
    reason: 'Bank network down',
    provider: 'paystack',
    eventId: `evt_trf_fail_${contract3Id}_m2`,
  });
  assert(failM2Rec.status === 'failed', '11.26 Milestone 2 failure recorded');

  const c3m2FailSnap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract3Id));
  const c3m2Fail = (c3m2FailSnap.data() as GigLinkContract).milestones.find((m) => m.id === 'm_phase2');
  assert(c3m2Fail?.paymentState === 'payout_failed', '11.27 Milestone 2 paymentState transitioned to payout_failed');

  const failM2DocSnap = await getDoc(doc(talentCtx.firestore(), 'financialLedger', failM2Rec.id));
  assert(failM2DocSnap.exists(), '11.28 Milestone 2 payout failure ledger record persisted in emulator DB');

  // Now subsequent verified success webhook arrives for Milestone 2 (e.g. transfer.success)
  const succM2Rec = await serverRecordMilestonePayoutSuccess({
    contractId: contract3Id,
    milestoneId: 'm_phase2',
    payoutReference: resM2.payoutReference,
    provider: 'paystack',
    eventId: `evt_trf_succ_${contract3Id}_m2`,
  });
  assert(succM2Rec.status === 'succeeded', '11.29 Subsequent success settles failed payout to paid_out');

  const c3m2SuccSnap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract3Id));
  const c3m2Succ = (c3m2SuccSnap.data() as GigLinkContract).milestones.find((m) => m.id === 'm_phase2');
  assert(c3m2Succ?.paymentState === 'paid_out', '11.30 Milestone 2 finalized as paid_out in emulator DB');

  // 11.31 Success followed by failure: delayed spurious failure ignored
  await serverRecordMilestonePayoutFailure({
    contractId: contract3Id,
    milestoneId: 'm_phase2',
    payoutReference: resM2.payoutReference,
    reason: 'Delayed out-of-order bank failure notice',
    provider: 'paystack',
    eventId: `evt_trf_fail_delayed_${contract3Id}_m2`,
  });
  const c3m2StillPaidSnap = await getDoc(doc(creatorCtx.firestore(), 'contracts', contract3Id));
  const c3m2StillPaid = (c3m2StillPaidSnap.data() as GigLinkContract).milestones.find((m) => m.id === 'm_phase2');
  assert(
    c3m2StillPaid?.paymentState === 'paid_out',
    '11.31 Milestone 2 remains in terminal paid_out state; spurious failure rejected'
  );

  paystackAdapter.setHttpTransportForTesting(null);

  await testEnv.cleanup();

  console.log('\n================================================================');
  console.log(`EMULATOR TEST RESULTS: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }

  return { total, passed, failed };
}

// Auto-run if executed directly via tsx
if (process.argv[1]?.includes('firestoreEmulatorPayments.test')) {
  runFirestoreEmulatorPaymentsSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal test error:', err);
      process.exit(1);
    });
}
