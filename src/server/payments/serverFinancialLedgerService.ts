/**
 * Server-Authoritative Financial Ledger & Escrow Service
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Strictly server-side (Node.js runtime). NEVER imported into browser bundles.
 * 2. Uses Firebase Admin SDK (getAdminFirestore()) with full server authorization,
 *    allowing authoritative writes to /financialLedger, /webhookEvents, /contracts,
 *    and /talentPayoutAccounts without being blocked by client Firestore security rules.
 * 3. Enforces multi-document atomic transactions: coordinates contract milestone state,
 *    deterministic financial ledger records, and webhook event status in a single commit.
 * 4. Strictly fail-closed in production / emulator runtime: transaction failures are never
 *    swallowed and never fall back to in-memory stores unless explicit test isolation is active.
 * 5. Server-authoritative derivation: payer identity, amount, currency, and fees are derived
 *    strictly from authenticated tokens, trusted database state, and verified provider results.
 */

import { getAdminFirestore } from '../firebaseAdmin';
import {
  GigLinkContract,
  ContractMilestone,
  FinancialLedgerRecord,
  ProviderWebhookEventRecord,
  TalentPayoutAccount,
  PaymentProvider,
} from '../../types';
import { calculatePlatformFee } from '../../lib/financialService';
import {
  getDeterministicFundingLedgerId,
  getDeterministicReleaseLedgerId,
  getDeterministicPayoutLedgerId,
  getDeterministicRefundLedgerId,
  getStablePayoutReference,
  isTestIsolationActive,
  getSimulatedFundingTxFailureForTesting,
  recordMilestoneFunded,
  recordMilestonePaymentReleased,
  recordMilestoneRefund,
  recordMilestonePayoutSuccess,
  recordMilestonePayoutFailure,
  checkAndRecordWebhookEvent,
  getWebhookEventRecord,
  recordWebhookEventPermanentFailure,
  getTalentPayoutAccount,
  setTalentPayoutAccount,
  getContractLedgerRecords,
  setAuthoritativeLedgerWriter,
} from '../../lib/financialLedgerService';
import { assertValidPaymentStateTransition } from './paymentStateMachine';
import { assertPaymentsActive } from './paymentSandboxGuard';
import { normalizeContractData } from '../../lib/contractService';

// Initialize server-authoritative Admin SDK writer hook for /financialLedger
setAuthoritativeLedgerWriter(async (record: FinancialLedgerRecord) => {
  const db = getAdminFirestore();
  await db.collection('financialLedger').doc(record.id).set(record);
});

// In-memory test store references for isolated unit tests (used ONLY when isTestIsolationActive() is true)
const memoryServerLedger: FinancialLedgerRecord[] = [];
const memoryServerWebhookEvents: ProviderWebhookEventRecord[] = [];
const memoryServerTalentAccounts: Map<string, TalentPayoutAccount> = new Map();

/**
 * Server-Authoritative Contract Fetch
 */
export async function serverGetContract(contractId: string): Promise<GigLinkContract | null> {
  const db = getAdminFirestore();
  const snap = await db.collection('contracts').doc(contractId).get();
  if (!snap.exists) return null;
  return normalizeContractData(snap.data() as GigLinkContract);
}

/**
 * Server-Authoritative Contract Persist
 */
export async function serverPersistContract(contract: GigLinkContract): Promise<void> {
  const db = getAdminFirestore();
  await db.collection('contracts').doc(contract.id).set(normalizeContractData(contract));
}

/**
 * Server-Authoritative Milestone Escrow Funding Transaction
 * Atomic: Updates contract milestone paymentState to 'held' and commits deterministic financialLedger record.
 */
export async function serverRecordMilestoneFunded(params: {
  contractId: string;
  milestoneId: string;
  payerId: string;
  payerName?: string;
  amount: number;
  currency: string;
  paymentProvider?: PaymentProvider;
  providerPaymentReference?: string;
  paymentIntentId?: string;
  provider?: PaymentProvider;
  eventId?: string;
  eventType?: string;
}): Promise<{
  contract: GigLinkContract;
  milestone: ContractMilestone;
  ledgerRecord: FinancialLedgerRecord;
  webhookRecord?: ProviderWebhookEventRecord;
  isReplay: boolean;
}> {
  assertPaymentsActive('serverRecordMilestoneFunded');

  if (isTestIsolationActive()) {
    const res = await recordMilestoneFunded(params as any);
    return {
      ...res,
      isReplay: Boolean(res.isReplay),
    };
  }

  const {
    contractId,
    milestoneId,
    payerId,
    payerName,
    amount,
    currency,
    paymentProvider,
    providerPaymentReference,
    paymentIntentId,
    provider = 'paystack',
    eventId,
    eventType = 'charge.success',
  } = params;

  const effectivePaymentRef =
    providerPaymentReference || paymentIntentId || `ref_${contractId}_${milestoneId}`;
  const effectiveProvider: PaymentProvider = paymentProvider || provider || 'paystack';
  const deterministicLedgerId = getDeterministicFundingLedgerId(effectivePaymentRef);

  const simFailure = getSimulatedFundingTxFailureForTesting();
  if (simFailure) {
    throw simFailure;
  }

  const db = getAdminFirestore();
  const contractRef = db.collection('contracts').doc(contractId);
  const ledgerRef = db.collection('financialLedger').doc(deterministicLedgerId);
  const eventRef = eventId ? db.collection('webhookEvents').doc(eventId) : null;

  try {
    return await db.runTransaction(async (txn) => {
      if (getSimulatedFundingTxFailureForTesting()) {
        throw getSimulatedFundingTxFailureForTesting();
      }

      // -------------------------------------------------------------
      // READ PHASE
      // -------------------------------------------------------------
      const contractSnap = await txn.get(contractRef);
      if (!contractSnap.exists) {
        throw new Error(`Contract ${contractId} not found.`);
      }
      const currentContract = normalizeContractData(contractSnap.data() as GigLinkContract);

      const mIdx = currentContract.milestones.findIndex((m) => m.id === milestoneId);
      if (mIdx === -1) {
        throw new Error(`Milestone ${milestoneId} not found on contract.`);
      }
      const milestone = currentContract.milestones[mIdx];
      const safeAmount = Number(amount) || milestone.amount;
      const expectedCurrency = (currency || milestone.currency || currentContract.scopeLock?.currency || 'USD').toUpperCase();

      // Read existing deterministic ledger record for idempotency check
      const ledgerSnap = await txn.get(ledgerRef);
      let existingLedgerRecord: FinancialLedgerRecord | null = null;
      if (ledgerSnap.exists) {
        existingLedgerRecord = ledgerSnap.data() as FinancialLedgerRecord;

        // Conflict check: reference cannot be bound to different contract or milestone
        if (existingLedgerRecord.contractId !== contractId || existingLedgerRecord.milestoneId !== milestoneId) {
          throw new Error(
            `Conflict: Payment reference '${effectivePaymentRef}' was already used for contract '${existingLedgerRecord.contractId}' milestone '${existingLedgerRecord.milestoneId}'. Cross-milestone reuse is strictly prohibited.`
          );
        }

        // Conflict check: amount and currency must match existing record
        if (
          existingLedgerRecord.amount !== safeAmount ||
          existingLedgerRecord.currency.toUpperCase() !== expectedCurrency
        ) {
          throw new Error(
            `Conflict: Payment reference '${effectivePaymentRef}' already recorded with conflicting amount/currency (${existingLedgerRecord.amount} ${existingLedgerRecord.currency} vs ${safeAmount} ${expectedCurrency}).`
          );
        }
      }

      // Check existing webhook event if provided
      let existingEventRecord: ProviderWebhookEventRecord | null = null;
      if (eventRef) {
        const eventSnap = await txn.get(eventRef);
        if (eventSnap.exists) {
          existingEventRecord = eventSnap.data() as ProviderWebhookEventRecord;
        }
      }

      // Idempotent Replay Handling
      if (milestone.paymentState === 'held') {
        if (
          existingLedgerRecord &&
          (existingLedgerRecord.providerPaymentReference === effectivePaymentRef ||
            existingLedgerRecord.providerReference === effectivePaymentRef)
        ) {
          return {
            contract: currentContract,
            milestone,
            ledgerRecord: existingLedgerRecord,
            webhookRecord: existingEventRecord || undefined,
            isReplay: true,
          };
        }
        throw new Error('Milestone is already funded and held in escrow with a different payment reference.');
      }

      if (milestone.paymentState === 'released') {
        throw new Error('Milestone funds have already been released to Talent.');
      }
      if (milestone.paymentState === 'refunded') {
        throw new Error('Milestone has already been refunded.');
      }

      assertValidPaymentStateTransition(milestone.paymentState || 'funding_pending', 'held', {
        contractId: currentContract.id,
        milestoneId: milestone.id,
      });

      // -------------------------------------------------------------
      // WRITE PHASE (Atomic multi-document mutations)
      // -------------------------------------------------------------
      const now = new Date().toISOString();
      const { platformFeeRate, platformFeeAmount, netTalentAmount } = calculatePlatformFee(safeAmount);

      // Server-authoritative payer identity derived strictly from contract.creatorId
      const authoritativePayerId = currentContract.creatorId;
      const authoritativePayerName = currentContract.creatorName || payerName || 'Client';

      const updatedMilestone: ContractMilestone = {
        ...milestone,
        paymentState: 'held',
        paymentProvider: effectiveProvider,
        providerPaymentReference: effectivePaymentRef,
        fundedAt: now,
        payerId: authoritativePayerId,
        payerName: authoritativePayerName,
        recipientId: currentContract.talentId,
        recipientName: currentContract.talentName || 'Talent',
        fundedAmount: safeAmount,
        requiredFundingAmount: milestone.amount,
        updatedAt: now,
      };

      const updatedMilestones = [...currentContract.milestones];
      updatedMilestones[mIdx] = updatedMilestone;

      const updatedContract: GigLinkContract = {
        ...currentContract,
        milestones: updatedMilestones,
        updatedAt: now,
      };

      const ledgerRecord: FinancialLedgerRecord = {
        id: deterministicLedgerId,
        contractId: currentContract.id,
        milestoneId: milestone.id,
        opportunityId: currentContract.opportunityId,
        payerId: authoritativePayerId,
        payerName: authoritativePayerName,
        recipientId: currentContract.talentId,
        recipientName: currentContract.talentName || 'Talent',
        amount: safeAmount,
        currency: expectedCurrency,
        platformFeeRate,
        platformFeeAmount,
        platformFee: platformFeeAmount,
        netTalentAmount,
        type: 'escrow_funding',
        provider: effectiveProvider,
        providerReference: effectivePaymentRef,
        providerPaymentReference: effectivePaymentRef,
        providerEventId: eventId || null,
        status: 'held',
        description: `Escrow funded for "${milestone.title}" (${safeAmount} ${expectedCurrency})`,
        createdAt: now,
        completedAt: now,
      };

      let webhookRecord: ProviderWebhookEventRecord | undefined;
      if (eventRef) {
        webhookRecord = {
          id: eventId!,
          provider: effectiveProvider,
          type: eventType,
          created: Date.now(),
          processedAt: now,
          status: 'processed',
          contractId: currentContract.id,
          milestoneId: milestone.id,
          transactionId: deterministicLedgerId,
        };
      }

      txn.set(contractRef, normalizeContractData(updatedContract));
      txn.set(ledgerRef, ledgerRecord);
      if (eventRef && webhookRecord) {
        txn.set(eventRef, webhookRecord);
      }

      return {
        contract: updatedContract,
        milestone: updatedMilestone,
        ledgerRecord,
        webhookRecord,
        isReplay: false,
      };
    });
  } catch (txErr: any) {
    const isConflict = txErr?.message?.includes('Conflict:');
    const isStateError =
      txErr?.message?.includes('already funded') ||
      txErr?.message?.includes('already been released') ||
      txErr?.message?.includes('already been refunded') ||
      txErr?.message?.includes('State transition') ||
      (txErr?.message?.includes('Contract ') && txErr?.message?.includes('not found')) ||
      (txErr?.message?.includes('Milestone ') && txErr?.message?.includes('not found'));

    if (isConflict || isStateError) {
      throw txErr;
    }

    if (!isTestIsolationActive()) {
      throw txErr;
    }

    // Offline test fallback only when test isolation is active
    memoryServerLedger.push({
      id: deterministicLedgerId,
      contractId,
      milestoneId,
      amount,
      currency,
      payerId,
      recipientId: 'talent',
      type: 'escrow_funding',
      status: 'held',
      createdAt: new Date().toISOString(),
    } as any);

    return {
      contract: { id: contractId } as any,
      milestone: { id: milestoneId, paymentState: 'held' } as any,
      ledgerRecord: memoryServerLedger[memoryServerLedger.length - 1],
      isReplay: false,
    };
  }
}

/**
 * Server-Authoritative Pre-Payout Milestone Reservation Transaction
 * Atomically transitions milestone from 'held' to 'release_pending' and establishes
 * a stable, persistent provider payout reference before external provider calls.
 * Prevents concurrent releases from initiating multiple transfers.
 */
export async function serverReserveMilestonePayout(params: {
  contractId: string;
  milestoneId: string;
  authorizedByUserId: string;
  userIsOrgAdmin?: boolean;
}): Promise<{
  status: 'reserved' | 'already_reserved' | 'already_finalized';
  payoutReference: string;
  contract: GigLinkContract;
  milestone: ContractMilestone;
}> {
  assertPaymentsActive('serverReserveMilestonePayout');

  const { contractId, milestoneId, authorizedByUserId, userIsOrgAdmin = false } = params;

  if (isTestIsolationActive()) {
    const memContract = await getContract(contractId);
    if (!memContract) throw new Error(`Contract ${contractId} not found.`);
    const m = memContract.milestones.find((x) => x.id === milestoneId);
    if (!m) throw new Error(`Milestone ${milestoneId} not found.`);
    const ref = m.providerPayoutReference || getStablePayoutReference(contractId, milestoneId);
    return {
      status: m.paymentState === 'released' || m.paymentState === 'paid_out' ? 'already_finalized' : 'reserved',
      payoutReference: ref,
      contract: memContract,
      milestone: m,
    };
  }

  const db = getAdminFirestore();
  const contractRef = db.collection('contracts').doc(contractId);

  return await db.runTransaction(async (txn) => {
    const contractSnap = await txn.get(contractRef);
    if (!contractSnap.exists) {
      throw new Error(`Contract ${contractId} not found.`);
    }
    const currentContract = normalizeContractData(contractSnap.data() as GigLinkContract);

    // Authority checks
    if (authorizedByUserId === currentContract.talentId && authorizedByUserId !== currentContract.creatorId) {
      throw new Error('Unauthorized: Talent cannot release their own escrow funds.');
    }
    const isCreator = authorizedByUserId === currentContract.creatorId || userIsOrgAdmin;
    if (!isCreator) {
      throw new Error('Unauthorized: Only Client/Creator can release escrow funds.');
    }

    const mIdx = currentContract.milestones.findIndex((m) => m.id === milestoneId);
    if (mIdx === -1) {
      throw new Error(`Milestone ${milestoneId} not found on contract.`);
    }
    const milestone = currentContract.milestones[mIdx];

    // Dispute check
    if (
      currentContract.disputeStatus === 'open' ||
      currentContract.disputeStatus === 'under_admin_review' ||
      milestone.disputeStatus === 'disputed'
    ) {
      throw new Error('Contract or milestone is in active dispute. Escrow release is locked.');
    }

    // Deliverables approval check
    if (milestone.reviewState !== 'approved' && milestone.workState !== 'approved' && milestone.status !== 'completed') {
      throw new Error('Milestone deliverables must be reviewed and approved before releasing payment.');
    }

    // Check payment state
    if (milestone.paymentState === 'released' || milestone.paymentState === 'paid_out') {
      return {
        status: 'already_finalized',
        payoutReference: milestone.providerPayoutReference || getStablePayoutReference(contractId, milestoneId),
        contract: currentContract,
        milestone,
      };
    }

    if (milestone.paymentState === 'release_pending') {
      // Already reserved by a prior attempt or concurrent request!
      const stableRef =
        milestone.providerPayoutReference ||
        getStablePayoutReference(contractId, milestoneId, milestone.payoutAttempts || 1);
      return {
        status: 'already_reserved',
        payoutReference: stableRef,
        contract: currentContract,
        milestone,
      };
    }

    if (milestone.paymentState !== 'held') {
      throw new Error(
        `Cannot release milestone in '${milestone.paymentState}' state. Funds must be held in escrow prior to release.`
      );
    }

    assertValidPaymentStateTransition('held', 'release_pending', {
      contractId: currentContract.id,
      milestoneId: milestone.id,
    });

    const now = new Date().toISOString();
    const attempts = (milestone.payoutAttempts || 0) + 1;
    const stablePayoutRef = getStablePayoutReference(contractId, milestoneId, attempts);

    const updatedMilestone: ContractMilestone = {
      ...milestone,
      paymentState: 'release_pending',
      providerPayoutReference: stablePayoutRef,
      payoutOperationId: stablePayoutRef,
      payoutReservedAt: now,
      payoutAttempts: attempts,
      updatedAt: now,
    };

    const updatedMilestones = [...currentContract.milestones];
    updatedMilestones[mIdx] = updatedMilestone;

    const updatedContract: GigLinkContract = {
      ...currentContract,
      milestones: updatedMilestones,
      updatedAt: now,
    };

    txn.set(contractRef, normalizeContractData(updatedContract));

    return {
      status: 'reserved',
      payoutReference: stablePayoutRef,
      contract: updatedContract,
      milestone: updatedMilestone,
    };
  });
}

/**
 * Server-Authoritative Milestone Payment Release Transaction
 */
export async function serverRecordMilestonePaymentReleased(params: {
  contractId: string;
  milestoneId: string;
  authorizedByUserId: string;
  providerPayoutReference?: string;
  transferId?: string;
  paymentProvider?: PaymentProvider;
  provider?: PaymentProvider;
  userIsOrgAdmin?: boolean;
}): Promise<{
  contract: GigLinkContract;
  milestone: ContractMilestone;
  ledgerRecord: FinancialLedgerRecord;
  isReplay?: boolean;
}> {
  assertPaymentsActive('serverRecordMilestonePaymentReleased');

  if (isTestIsolationActive()) {
    return recordMilestonePaymentReleased(params as any);
  }

  const {
    contractId,
    milestoneId,
    authorizedByUserId,
    providerPayoutReference,
    paymentProvider,
    provider = 'paystack',
    userIsOrgAdmin = false,
  } = params;

  const db = getAdminFirestore();
  const contractRef = db.collection('contracts').doc(contractId);
  const releaseLedgerId = getDeterministicReleaseLedgerId(contractId, milestoneId);
  const ledgerRef = db.collection('financialLedger').doc(releaseLedgerId);

  return await db.runTransaction(async (txn) => {
    const contractSnap = await txn.get(contractRef);
    if (!contractSnap.exists) {
      throw new Error(`Contract ${contractId} not found.`);
    }
    const currentContract = normalizeContractData(contractSnap.data() as GigLinkContract);

    // Authority checks
    if (authorizedByUserId === currentContract.talentId && authorizedByUserId !== currentContract.creatorId) {
      throw new Error('Unauthorized: Talent cannot release their own escrow funds.');
    }
    const isCreator = authorizedByUserId === currentContract.creatorId || userIsOrgAdmin;
    if (!isCreator) {
      throw new Error('Unauthorized: Only Client/Creator can release escrow funds.');
    }

    const mIdx = currentContract.milestones.findIndex((m) => m.id === milestoneId);
    if (mIdx === -1) {
      throw new Error(`Milestone ${milestoneId} not found on contract.`);
    }
    const milestone = currentContract.milestones[mIdx];

    // Read existing release ledger record
    const ledgerSnap = await txn.get(ledgerRef);
    if (ledgerSnap.exists && (milestone.paymentState === 'released' || milestone.paymentState === 'paid_out')) {
      return {
        contract: currentContract,
        milestone,
        ledgerRecord: ledgerSnap.data() as FinancialLedgerRecord,
        isReplay: true,
      };
    }

    if (milestone.paymentState !== 'held' && milestone.paymentState !== 'release_pending') {
      throw new Error(
        `Cannot release milestone in '${milestone.paymentState}' state. Funds must be held in escrow prior to release.`
      );
    }

    if (milestone.reviewState !== 'approved' && milestone.workState !== 'approved' && milestone.status !== 'completed') {
      throw new Error('Milestone deliverables must be reviewed and approved before releasing payment.');
    }

    if (
      currentContract.disputeStatus === 'open' ||
      currentContract.disputeStatus === 'under_admin_review' ||
      milestone.disputeStatus === 'disputed'
    ) {
      throw new Error('Contract or milestone is in active dispute. Escrow release is locked.');
    }

    assertValidPaymentStateTransition(milestone.paymentState, 'released', {
      contractId: currentContract.id,
      milestoneId: milestone.id,
    });

    const now = new Date().toISOString();
    const safeAmount = milestone.fundedAmount || milestone.amount;
    const { platformFeeRate, platformFeeAmount, netTalentAmount } = calculatePlatformFee(safeAmount);

    const effectivePayoutRef =
      providerPayoutReference ||
      milestone.providerPayoutReference ||
      getStablePayoutReference(contractId, milestoneId, milestone.payoutAttempts || 1);

    const updatedMilestone: ContractMilestone = {
      ...milestone,
      paymentState: 'released',
      releasedAt: now,
      providerPayoutReference: effectivePayoutRef,
      updatedAt: now,
    };

    const updatedMilestones = [...currentContract.milestones];
    updatedMilestones[mIdx] = updatedMilestone;

    const updatedContract: GigLinkContract = {
      ...currentContract,
      milestones: updatedMilestones,
      updatedAt: now,
    };

    const ledgerRecord: FinancialLedgerRecord = {
      id: releaseLedgerId,
      contractId: currentContract.id,
      milestoneId: milestone.id,
      opportunityId: currentContract.opportunityId,
      payerId: currentContract.creatorId,
      payerName: currentContract.creatorName || 'Client',
      recipientId: currentContract.talentId,
      recipientName: currentContract.talentName || 'Talent',
      amount: safeAmount,
      currency: milestone.currency,
      platformFeeRate,
      platformFeeAmount,
      platformFee: platformFeeAmount,
      netTalentAmount,
      type: 'escrow_release',
      provider: paymentProvider || provider,
      providerReference: effectivePayoutRef,
      status: 'released',
      description: `Escrow released to talent for "${milestone.title}" (${safeAmount} ${milestone.currency})`,
      createdAt: now,
      completedAt: now,
    };

    txn.set(contractRef, normalizeContractData(updatedContract));
    txn.set(ledgerRef, ledgerRecord);

    return {
      contract: updatedContract,
      milestone: updatedMilestone,
      ledgerRecord,
      isReplay: false,
    };
  });
}

/**
 * Server-Authoritative Milestone Escrow Refund Transaction
 */
export async function serverRecordMilestoneRefund(params: {
  contractId: string;
  milestoneId: string;
  authorizedByUserId: string;
  refundAmount?: number;
  reason?: string;
  providerRefundReference?: string;
  refundId?: string;
  paymentProvider?: PaymentProvider;
  provider?: PaymentProvider;
  userIsOrgAdmin?: boolean;
}): Promise<{
  contract: GigLinkContract;
  milestone: ContractMilestone;
  ledgerRecord: FinancialLedgerRecord;
}> {
  assertPaymentsActive('serverRecordMilestoneRefund');

  if (isTestIsolationActive()) {
    return recordMilestoneRefund(params as any);
  }

  const {
    contractId,
    milestoneId,
    authorizedByUserId,
    refundAmount,
    reason,
    providerRefundReference,
    paymentProvider,
    provider = 'paystack',
    userIsOrgAdmin = false,
  } = params;

  const db = getAdminFirestore();
  const contractRef = db.collection('contracts').doc(contractId);
  const refundLedgerId = getDeterministicRefundLedgerId(
    providerRefundReference || `ref_${contractId}_${milestoneId}`
  );
  const ledgerRef = db.collection('financialLedger').doc(refundLedgerId);

  return await db.runTransaction(async (txn) => {
    const contractSnap = await txn.get(contractRef);
    if (!contractSnap.exists) {
      throw new Error(`Contract ${contractId} not found.`);
    }
    const currentContract = normalizeContractData(contractSnap.data() as GigLinkContract);

    const isCreator = authorizedByUserId === currentContract.creatorId || userIsOrgAdmin;
    if (!isCreator) {
      throw new Error('Unauthorized: Only Client/Creator can refund escrow funds.');
    }

    const mIdx = currentContract.milestones.findIndex((m) => m.id === milestoneId);
    if (mIdx === -1) {
      throw new Error(`Milestone ${milestoneId} not found on contract.`);
    }
    const milestone = currentContract.milestones[mIdx];

    if (milestone.paymentState !== 'held' && milestone.paymentState !== 'refund_pending') {
      throw new Error(
        `Cannot refund milestone in '${milestone.paymentState}' state. Only held escrow funds can be refunded.`
      );
    }

    assertValidPaymentStateTransition(milestone.paymentState, 'refunded', {
      contractId: currentContract.id,
      milestoneId: milestone.id,
    });

    const now = new Date().toISOString();
    const effectiveRefundAmount = refundAmount || milestone.fundedAmount || milestone.amount;

    const updatedMilestone: ContractMilestone = {
      ...milestone,
      paymentState: 'refunded',
      refundedAt: now,
      providerRefundReference: providerRefundReference || milestone.providerRefundReference,
      updatedAt: now,
    };

    const updatedMilestones = [...currentContract.milestones];
    updatedMilestones[mIdx] = updatedMilestone;

    const updatedContract: GigLinkContract = {
      ...currentContract,
      milestones: updatedMilestones,
      updatedAt: now,
    };

    const ledgerRecord: FinancialLedgerRecord = {
      id: refundLedgerId,
      contractId: currentContract.id,
      milestoneId: milestone.id,
      opportunityId: currentContract.opportunityId,
      payerId: currentContract.creatorId,
      payerName: currentContract.creatorName || 'Client',
      recipientId: currentContract.talentId,
      recipientName: currentContract.talentName || 'Talent',
      amount: effectiveRefundAmount,
      currency: milestone.currency,
      platformFeeRate: 0,
      platformFeeAmount: 0,
      netTalentAmount: 0,
      type: 'escrow_refund',
      provider: paymentProvider || provider,
      providerReference: providerRefundReference || null,
      status: 'refunded',
      description: `Escrow refunded for "${milestone.title}" (${effectiveRefundAmount} ${milestone.currency}). Reason: ${reason || 'Client refund'}`,
      createdAt: now,
      completedAt: now,
    };

    txn.set(contractRef, normalizeContractData(updatedContract));
    txn.set(ledgerRef, ledgerRecord);

    return {
      contract: updatedContract,
      milestone: updatedMilestone,
      ledgerRecord,
    };
  });
}

/**
 * Server-Authoritative Payout Success Record Commit (Atomic Multi-Document Transaction)
 * Settles milestone from released/payout_pending to 'paid_out' and writes deterministic ledger record.
 */
export async function serverRecordMilestonePayoutSuccess(params: {
  contractId: string;
  milestoneId: string;
  payoutReference: string;
  provider?: PaymentProvider;
  eventId?: string;
}): Promise<FinancialLedgerRecord> {
  assertPaymentsActive('serverRecordMilestonePayoutSuccess');

  if (isTestIsolationActive()) {
    const res = await recordMilestonePayoutSuccess(params as any);
    return res.ledgerRecord;
  }

  const { contractId, milestoneId, payoutReference, provider = 'paystack', eventId } = params;
  const db = getAdminFirestore();

  const contractRef = db.collection('contracts').doc(contractId);
  const ledgerId = getDeterministicPayoutLedgerId(payoutReference || `${contractId}_${milestoneId}`);
  const ledgerRef = db.collection('financialLedger').doc(ledgerId);
  const eventRef = eventId ? db.collection('webhookEvents').doc(eventId) : null;

  return await db.runTransaction(async (txn) => {
    const contractSnap = await txn.get(contractRef);
    if (!contractSnap.exists) {
      throw new Error(`Contract ${contractId} not found.`);
    }
    const currentContract = normalizeContractData(contractSnap.data() as GigLinkContract);

    const mIdx = currentContract.milestones.findIndex((m) => m.id === milestoneId);
    if (mIdx === -1) {
      throw new Error(`Milestone ${milestoneId} not found on contract.`);
    }
    const milestone = currentContract.milestones[mIdx];

    // Read deterministic payout ledger record for idempotency check
    const ledgerSnap = await txn.get(ledgerRef);
    if (ledgerSnap.exists && milestone.paymentState === 'paid_out') {
      if (eventRef) {
        txn.set(
          eventRef,
          {
            id: eventId!,
            status: 'processed',
            processedAt: new Date().toISOString(),
            contractId,
            milestoneId,
            transactionId: ledgerId,
          },
          { merge: true }
        );
      }
      return ledgerSnap.data() as FinancialLedgerRecord;
    }

    if (milestone.paymentState === 'refunded') {
      throw new Error('Cannot settle payout on refunded milestone.');
    }

    // Assert valid transition to paid_out
    assertValidPaymentStateTransition(milestone.paymentState, 'paid_out', {
      contractId,
      milestoneId,
    });

    const amount = milestone.fundedAmount || milestone.amount || 0;
    const { netTalentAmount } = calculatePlatformFee(amount);
    const now = new Date().toISOString();

    const updatedMilestone: ContractMilestone = {
      ...milestone,
      paymentState: 'paid_out',
      paidOutAt: now,
      providerPayoutReference: payoutReference || milestone.providerPayoutReference,
      updatedAt: now,
    };

    const updatedMilestones = [...currentContract.milestones];
    updatedMilestones[mIdx] = updatedMilestone;

    const updatedContract: GigLinkContract = {
      ...currentContract,
      milestones: updatedMilestones,
      updatedAt: now,
    };

    const ledgerRecord: FinancialLedgerRecord = {
      id: ledgerId,
      contractId,
      milestoneId,
      opportunityId: currentContract.opportunityId || '',
      payerId: currentContract.creatorId || 'client',
      payerName: currentContract.creatorName || 'Client',
      recipientId: currentContract.talentId || 'talent',
      recipientName: currentContract.talentName || 'Talent',
      amount: netTalentAmount,
      currency: milestone.currency || 'NGN',
      platformFeeRate: 0,
      platformFeeAmount: 0,
      netTalentAmount,
      type: 'payout_disbursement',
      provider,
      providerReference: payoutReference,
      status: 'succeeded',
      description: `Payout successfully disbursed (${netTalentAmount} ${milestone.currency || 'NGN'})`,
      createdAt: now,
      completedAt: now,
    };

    txn.set(contractRef, normalizeContractData(updatedContract));
    txn.set(ledgerRef, ledgerRecord);

    if (eventRef) {
      txn.set(
        eventRef,
        {
          id: eventId!,
          status: 'processed',
          processedAt: now,
          contractId,
          milestoneId,
          transactionId: ledgerId,
        },
        { merge: true }
      );
    }

    return ledgerRecord;
  });
}

/**
 * Server-Authoritative Payout Failure Record Commit (Atomic Multi-Document Transaction)
 * Protects settled 'paid_out' milestone from being corrupted by spurious or out-of-order failure events.
 */
export async function serverRecordMilestonePayoutFailure(params: {
  contractId: string;
  milestoneId: string;
  payoutReference: string;
  reason?: string;
  provider?: PaymentProvider;
  eventId?: string;
}): Promise<FinancialLedgerRecord> {
  assertPaymentsActive('serverRecordMilestonePayoutFailure');

  if (isTestIsolationActive()) {
    await recordMilestonePayoutFailure(params as any);
    return {
      id: `tx_payout_fail_${Date.now()}`,
      contractId: params.contractId,
      milestoneId: params.milestoneId,
      amount: 0,
      currency: 'NGN',
      payerId: 'client',
      payerName: 'Client',
      recipientId: 'talent',
      recipientName: 'Talent',
      platformFeeRate: 0,
      platformFeeAmount: 0,
      netTalentAmount: 0,
      type: 'payout_disbursement',
      provider: params.provider || 'paystack',
      status: 'failed',
      failureReason: params.reason,
      description: `Payout failure: ${params.reason}`,
      createdAt: new Date().toISOString(),
    };
  }

  const { contractId, milestoneId, payoutReference, reason, provider = 'paystack', eventId } = params;
  const db = getAdminFirestore();

  const contractRef = db.collection('contracts').doc(contractId);
  const ledgerId = getDeterministicPayoutLedgerId(`${payoutReference}_fail`);
  const ledgerRef = db.collection('financialLedger').doc(ledgerId);
  const eventRef = eventId ? db.collection('webhookEvents').doc(eventId) : null;

  return await db.runTransaction(async (txn) => {
    const contractSnap = await txn.get(contractRef);
    if (!contractSnap.exists) {
      throw new Error(`Contract ${contractId} not found.`);
    }
    const currentContract = normalizeContractData(contractSnap.data() as GigLinkContract);

    const mIdx = currentContract.milestones.findIndex((m) => m.id === milestoneId);
    if (mIdx === -1) {
      throw new Error(`Milestone ${milestoneId} not found on contract.`);
    }
    const milestone = currentContract.milestones[mIdx];
    const existingLedgerSnap = await txn.get(ledgerRef);

    // INVARIANT: Terminal 'paid_out' state cannot be overwritten by out-of-order failure events
    if (milestone.paymentState === 'paid_out') {
      console.warn(
        `[Payout Guard] Spurious failure event ignored for settled milestone ${milestoneId} on contract ${contractId} (already paid_out).`
      );
      if (eventRef) {
        txn.set(
          eventRef,
          {
            id: eventId!,
            status: 'failed',
            failureReason: `Ignored: Milestone is already in terminal paid_out state. Original failure reason: ${reason}`,
            processedAt: new Date().toISOString(),
            contractId,
            milestoneId,
          },
          { merge: true }
        );
      }
      if (existingLedgerSnap.exists) return existingLedgerSnap.data() as FinancialLedgerRecord;
      return {
        id: ledgerId,
        contractId,
        milestoneId,
        amount: 0,
        currency: milestone.currency || 'NGN',
        payerId: currentContract.creatorId,
        payerName: currentContract.creatorName || 'Client',
        recipientId: currentContract.talentId,
        recipientName: currentContract.talentName || 'Talent',
        platformFeeRate: 0,
        platformFeeAmount: 0,
        netTalentAmount: 0,
        type: 'payout_disbursement',
        provider,
        status: 'failed',
        failureReason: reason,
        description: `Spurious failure event recorded: ${reason}`,
        createdAt: new Date().toISOString(),
      };
    }

    const amount = milestone.fundedAmount || milestone.amount || 0;
    const { netTalentAmount } = calculatePlatformFee(amount);
    const now = new Date().toISOString();

    // Transition milestone to payout_failed if it was release_pending or payout_pending
    if (
      milestone.paymentState === 'release_pending' ||
      milestone.paymentState === 'payout_pending' ||
      milestone.paymentState === 'released'
    ) {
      assertValidPaymentStateTransition(milestone.paymentState, 'payout_failed', {
        contractId,
        milestoneId,
      });

      const updatedMilestone: ContractMilestone = {
        ...milestone,
        paymentState: 'payout_failed',
        payoutFailureReason: reason || 'Transfer failed',
        updatedAt: now,
      };

      const updatedMilestones = [...currentContract.milestones];
      updatedMilestones[mIdx] = updatedMilestone;

      const updatedContract: GigLinkContract = {
        ...currentContract,
        milestones: updatedMilestones,
        updatedAt: now,
      };

      txn.set(contractRef, normalizeContractData(updatedContract));
    }

    const ledgerRecord: FinancialLedgerRecord = {
      id: ledgerId,
      contractId,
      milestoneId,
      opportunityId: currentContract.opportunityId || '',
      payerId: currentContract.creatorId || 'client',
      payerName: currentContract.creatorName || 'Client',
      recipientId: currentContract.talentId || 'talent',
      recipientName: currentContract.talentName || 'Talent',
      amount: netTalentAmount,
      currency: milestone.currency || 'NGN',
      platformFeeRate: 0,
      platformFeeAmount: 0,
      netTalentAmount,
      type: 'payout_disbursement',
      provider,
      providerReference: payoutReference,
      status: 'failed',
      failureReason: reason || 'Transfer failed',
      description: `Payout disbursement failed: ${reason || 'Unknown error'}`,
      createdAt: now,
      completedAt: null as any,
    };

    txn.set(ledgerRef, ledgerRecord);

    if (eventRef) {
      txn.set(
        eventRef,
        {
          id: eventId!,
          status: 'failed',
          failureReason: reason,
          processedAt: now,
          contractId,
          milestoneId,
          transactionId: ledgerId,
        },
        { merge: true }
      );
    }

    return ledgerRecord;
  });
}

/**
 * Server-Authoritative Payout Reconciliation
 * Reconciles uncertain/pending payout outcomes via verified provider status.
 */
export async function serverReconcileMilestonePayout(params: {
  contractId: string;
  milestoneId: string;
  provider?: PaymentProvider;
}): Promise<{
  status: 'succeeded' | 'failed' | 'pending';
  contract: GigLinkContract;
  milestone: ContractMilestone;
  ledgerRecord?: FinancialLedgerRecord;
}> {
  assertPaymentsActive('serverReconcileMilestonePayout');
  const contract = await serverGetContract(params.contractId);
  if (!contract) throw new Error(`Contract ${params.contractId} not found.`);
  const milestone = contract.milestones.find((m) => m.id === params.milestoneId);
  if (!milestone) throw new Error(`Milestone ${params.milestoneId} not found.`);

  const payoutRef =
    milestone.providerPayoutReference ||
    getStablePayoutReference(params.contractId, params.milestoneId, milestone.payoutAttempts || 1);

  // Lazy import or reference PaymentOrchestrator
  const { defaultPaymentOrchestrator } = await import('./PaymentOrchestrator');
  const verif = await defaultPaymentOrchestrator.verifyPayout(
    payoutRef,
    params.provider || milestone.paymentProvider
  );

  if (verif.status === 'succeeded') {
    const rel = await serverRecordMilestonePaymentReleased({
      contractId: params.contractId,
      milestoneId: params.milestoneId,
      authorizedByUserId: contract.creatorId,
      providerPayoutReference: verif.payoutId || payoutRef,
      paymentProvider: params.provider || milestone.paymentProvider || 'paystack',
    });
    const succLedger = await serverRecordMilestonePayoutSuccess({
      contractId: params.contractId,
      milestoneId: params.milestoneId,
      payoutReference: verif.payoutId || payoutRef,
      provider: params.provider || milestone.paymentProvider || 'paystack',
    });
    return {
      status: 'succeeded',
      contract: rel.contract,
      milestone: { ...rel.milestone, paymentState: 'paid_out' },
      ledgerRecord: succLedger,
    };
  } else if (verif.status === 'failed') {
    const failLedger = await serverRecordMilestonePayoutFailure({
      contractId: params.contractId,
      milestoneId: params.milestoneId,
      payoutReference: verif.payoutId || payoutRef,
      reason: 'Reconciliation verified provider transfer failure',
      provider: params.provider || milestone.paymentProvider || 'paystack',
    });
    const updatedContract = await serverGetContract(params.contractId);
    return {
      status: 'failed',
      contract: updatedContract || contract,
      milestone: updatedContract?.milestones?.find((m) => m.id === params.milestoneId) || milestone,
      ledgerRecord: failLedger,
    };
  }

  return {
    status: 'pending',
    contract,
    milestone,
  };
}

/**
 * Server-Authoritative Webhook Audit Store
 */
export async function serverGetWebhookEventRecord(
  eventId: string
): Promise<ProviderWebhookEventRecord | null> {
  if (isTestIsolationActive()) {
    return getWebhookEventRecord(eventId);
  }

  const db = getAdminFirestore();
  const snap = await db.collection('webhookEvents').doc(eventId).get();
  if (!snap.exists) return null;
  return snap.data() as ProviderWebhookEventRecord;
}

export async function serverCheckAndRecordWebhookEvent(event: {
  id: string;
  type: string;
  created: number;
  provider?: PaymentProvider;
}): Promise<{ isDuplicate: boolean; record: ProviderWebhookEventRecord }> {
  assertPaymentsActive('serverCheckAndRecordWebhookEvent');

  if (isTestIsolationActive()) {
    return checkAndRecordWebhookEvent(event);
  }

  const db = getAdminFirestore();
  const eventRef = db.collection('webhookEvents').doc(event.id);

  return await db.runTransaction(async (txn) => {
    const snap = await txn.get(eventRef);

    if (snap.exists) {
      const rec = snap.data() as ProviderWebhookEventRecord;
      if (rec.status === 'processed') {
        return { isDuplicate: true, record: rec };
      }
    }

    const record: ProviderWebhookEventRecord = {
      id: event.id,
      provider: event.provider || 'paystack',
      type: event.type,
      created: event.created,
      processedAt: new Date().toISOString(),
      status: 'processed',
    };

    txn.set(eventRef, record);
    return { isDuplicate: false, record };
  });
}

export async function serverRecordWebhookEventPermanentFailure(
  eventId: string,
  reason: string,
  provider: PaymentProvider = 'paystack',
  eventType?: string
): Promise<ProviderWebhookEventRecord> {
  assertPaymentsActive('serverRecordWebhookEventPermanentFailure');

  if (isTestIsolationActive()) {
    return recordWebhookEventPermanentFailure(eventId, reason, provider, eventType);
  }

  const db = getAdminFirestore();
  const record: ProviderWebhookEventRecord = {
    id: eventId,
    provider,
    type: eventType || 'unknown',
    created: Math.floor(Date.now() / 1000),
    processedAt: new Date().toISOString(),
    status: 'failed',
    failureReason: reason,
  };

  await db.collection('webhookEvents').doc(eventId).set(record);
  return record;
}

/**
 * Server-Authoritative Talent Payout Account Access
 */
export async function serverGetTalentPayoutAccount(
  userId: string
): Promise<TalentPayoutAccount | null> {
  if (isTestIsolationActive()) {
    return getTalentPayoutAccount(userId);
  }

  const db = getAdminFirestore();
  const snap = await db.collection('talentPayoutAccounts').doc(userId).get();
  if (!snap.exists) return null;
  return snap.data() as TalentPayoutAccount;
}

export async function serverSetTalentPayoutAccount(
  account: TalentPayoutAccount
): Promise<TalentPayoutAccount> {
  assertPaymentsActive('serverSetTalentPayoutAccount');

  if (isTestIsolationActive()) {
    return setTalentPayoutAccount(account);
  }

  const db = getAdminFirestore();
  await db.collection('talentPayoutAccounts').doc(account.userId).set(account);
  return account;
}

/**
 * Server-Authoritative Contract Ledger Query
 */
export async function serverGetContractLedgerRecords(
  contractId: string
): Promise<FinancialLedgerRecord[]> {
  if (isTestIsolationActive()) {
    return getContractLedgerRecords(contractId);
  }

  const db = getAdminFirestore();
  const snap = await db.collection('financialLedger').where('contractId', '==', contractId).get();
  if (snap.empty) return [];
  const records: FinancialLedgerRecord[] = [];
  snap.forEach((d) => records.push(d.data() as FinancialLedgerRecord));
  return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
