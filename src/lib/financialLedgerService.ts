/**
 * Authoritative Financial Ledger & Escrow Persistence Service (Phase 4)
 * Handles durable Firestore ledger entries, milestone escrow funding state,
 * milestone payment releases, refunds, and talent payout records.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  GigLinkContract,
  ContractMilestone,
  FinancialLedgerRecord,
  ProviderWebhookEventRecord,
  StripeWebhookEventRecord,
  TalentStripeAccount,
  TalentPayoutAccount,
  PaymentProvider,
} from '../types';
import { calculatePlatformFee } from './financialService';
import {
  getContract,
  persistContract,
  normalizeContractData,
  setContractInStore,
  isCustomContractWriterInstalled,
  isTestRuntime,
} from './contractService';
import { assertValidPaymentStateTransition } from '../server/payments/paymentStateMachine';
import { assertPaymentsActive } from '../server/payments/paymentSandboxGuard';

// In-memory fallback stores for offline/test environments
const memoryLedger: FinancialLedgerRecord[] = [];
const memoryWebhookEvents: ProviderWebhookEventRecord[] = [];
const memoryTalentAccounts: Map<string, TalentPayoutAccount> = new Map();

/**
 * Generates a deterministic, immutable ledger ID for escrow funding transactions.
 * Prevents duplicate ledger entries for the same provider payment reference.
 */
export function getDeterministicFundingLedgerId(providerPaymentReference: string): string {
  const sanitized = (providerPaymentReference || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `tx_fund_${sanitized}`;
}

/**
 * Generates a stable, deterministic payout transfer reference for a milestone payout.
 * Reused on retries of the same operation across timeouts and restarts.
 */
export function getStablePayoutReference(
  contractId: string,
  milestoneId: string,
  attempt: number = 1
): string {
  const sanitizedContract = (contractId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedMilestone = (milestoneId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (attempt > 1) {
    return `pstk_trf_${sanitizedContract}_${sanitizedMilestone}_att${attempt}`;
  }
  return `pstk_trf_${sanitizedContract}_${sanitizedMilestone}`;
}

/**
 * Generates a deterministic, immutable ledger ID for milestone release transactions.
 */
export function getDeterministicReleaseLedgerId(contractId: string, milestoneId: string): string {
  const sanitizedContract = (contractId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedMilestone = (milestoneId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `tx_rel_${sanitizedContract}_${sanitizedMilestone}`;
}

/**
 * Generates a deterministic, immutable ledger ID for payout disbursements.
 */
export function getDeterministicPayoutLedgerId(providerPayoutReference: string): string {
  const sanitized = (providerPayoutReference || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `tx_payout_${sanitized}`;
}

/**
 * Generates a deterministic, immutable ledger ID for escrow refunds.
 */
export function getDeterministicRefundLedgerId(providerRefundReference: string): string {
  const sanitized = (providerRefundReference || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `tx_ref_${sanitized}`;
}

export function clearMemoryWebhookEventsForTesting(): void {
  memoryWebhookEvents.length = 0;
}

export function getMemoryWebhookEventsForTesting(): readonly ProviderWebhookEventRecord[] {
  return [...memoryWebhookEvents];
}

let simulatedFundingTxFailure: Error | null = null;
export function setSimulatedFundingTxFailureForTesting(err: Error | null): void {
  simulatedFundingTxFailure = err;
}
export function getSimulatedFundingTxFailureForTesting(): Error | null {
  return simulatedFundingTxFailure;
}

/**
 * Inspects whether a webhook event was already processed or recorded.
 * Does NOT mutate or mark the event as processed.
 */
export async function getWebhookEventRecord(eventId: string): Promise<ProviderWebhookEventRecord | null> {
  const mem = memoryWebhookEvents.find((e) => e.id === eventId);
  if (mem) return mem;

  try {
    const snap = await getDoc(doc(db, 'webhookEvents', eventId));
    if (snap.exists()) {
      return snap.data() as ProviderWebhookEventRecord;
    }
  } catch {
    // Offline or permission restrictions in test runtime
  }
  return null;
}

/**
 * Permanently records a fatal/irrecoverable validation failure for a webhook event
 * (e.g. underpayment, wrong currency, missing contract/milestone) to prevent infinite retries.
 */
export async function recordWebhookEventPermanentFailure(
  eventId: string,
  error: string,
  provider: PaymentProvider = 'paystack',
  eventType = 'charge.success'
): Promise<ProviderWebhookEventRecord> {
  assertPaymentsActive('recordWebhookEventPermanentFailure');

  const record: ProviderWebhookEventRecord = {
    id: eventId,
    provider,
    type: eventType,
    created: Date.now(),
    processedAt: new Date().toISOString(),
    status: 'failed',
    error,
  };

  try {
    await setDoc(doc(db, 'webhookEvents', eventId), record);
  } catch {
    // Offline / test fallback
  }

  const existingIdx = memoryWebhookEvents.findIndex((e) => e.id === eventId);
  if (existingIdx >= 0) {
    memoryWebhookEvents[existingIdx] = record;
  } else {
    memoryWebhookEvents.push(record);
  }
  return record;
}

/**
 * Test hook for mocking/controlling the underlying Firestore writer in unit tests.
 * In production/runtime, this is null and setDoc is invoked directly.
 */
export type LedgerFirestoreWriter = (ledgerRef: any, data: FinancialLedgerRecord) => Promise<void>;
let customLedgerWriter: LedgerFirestoreWriter | null = null;

/**
 * Server-Authoritative Admin SDK Ledger Writer Hook.
 * Set by serverFinancialLedgerService in Node.js server runtime to bypass client rules authoritatively.
 */
export type AuthoritativeLedgerWriter = (record: FinancialLedgerRecord) => Promise<void>;
let authoritativeLedgerWriter: AuthoritativeLedgerWriter | null = null;

export function setAuthoritativeLedgerWriter(writer: AuthoritativeLedgerWriter | null): void {
  authoritativeLedgerWriter = writer;
}

export function getAuthoritativeLedgerWriter(): AuthoritativeLedgerWriter | null {
  return authoritativeLedgerWriter;
}

export function setLedgerWriterForTesting(writer: LedgerFirestoreWriter | null): void {
  if (writer && !isTestRuntime()) {
    throw new Error('setLedgerWriterForTesting is strictly forbidden outside test environments.');
  }
  customLedgerWriter = writer;
}

export function isCustomLedgerWriterInstalled(): boolean {
  return customLedgerWriter !== null;
}

/**
 * Validates whether isolated offline test writers are actively configured in a non-production test runtime.
 * In production or normal client runtime, this strictly returns false.
 */
export function isTestIsolationActive(): boolean {
  return isTestRuntime() && (isCustomContractWriterInstalled() || isCustomLedgerWriterInstalled());
}

export function clearMemoryLedgerForTesting(): void {
  memoryLedger.length = 0;
}

export function getMemoryLedgerForTesting(): readonly FinancialLedgerRecord[] {
  return [...memoryLedger];
}

/**
 * Appends an immutable financial transaction record to the ledger.
 *
 * CRITICAL BUILDER'S PRINCIPLE & E-02 INVARIANT:
 * Fail-closed durability: If Firestore persistence fails, the record is
 * NOT appended to memoryLedger and no successful transaction is returned.
 * The authoritative failure is propagated immediately to the caller.
 */
export async function appendLedgerRecord(record: FinancialLedgerRecord): Promise<FinancialLedgerRecord> {
  const immutableRecord: FinancialLedgerRecord = {
    ...record,
    createdAt: record.createdAt || new Date().toISOString(),
  };

  const ledgerRef = doc(db, 'financialLedger', immutableRecord.id);

  if (customLedgerWriter) {
    await customLedgerWriter(ledgerRef, immutableRecord);
  } else if (authoritativeLedgerWriter) {
    await authoritativeLedgerWriter(immutableRecord);
  } else {
    await setDoc(ledgerRef, immutableRecord);
  }

  // Only reached after authoritative Firestore confirmation
  const existingIdx = memoryLedger.findIndex((r) => r.id === immutableRecord.id);
  if (existingIdx >= 0) {
    memoryLedger[existingIdx] = immutableRecord;
  } else {
    memoryLedger.unshift(immutableRecord);
  }

  return immutableRecord;
}

/**
 * Retrieves all ledger records for a given contract.
 */
export async function getContractLedgerRecords(contractId: string): Promise<FinancialLedgerRecord[]> {
  try {
    const ledgerQuery = query(
      collection(db, 'financialLedger'),
      where('contractId', '==', contractId)
    );
    const snap = await getDocs(ledgerQuery);
    if (!snap.empty) {
      const records: FinancialLedgerRecord[] = [];
      snap.forEach((d) => records.push(d.data() as FinancialLedgerRecord));
      // Sort newest first
      return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (err) {
    console.warn('[FinancialLedger] Could not fetch from Firestore, checking in-memory:', err);
  }

  return memoryLedger
    .filter((r) => r.contractId === contractId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Records and checks webhook idempotency.
 * Returns { isDuplicate: true } if event has already been processed.
 */
export async function checkAndRecordWebhookEvent(event: {
  id: string;
  type: string;
  created: number;
  provider?: PaymentProvider;
}): Promise<{ isDuplicate: boolean; record: ProviderWebhookEventRecord }> {
  assertPaymentsActive('checkAndRecordWebhookEvent');

  const eventId = event.id;
  const provider = event.provider || 'stripe';

  // Check in-memory first
  const existingMem = memoryWebhookEvents.find((e) => e.id === eventId);
  if (existingMem && existingMem.status === 'processed') {
    return { isDuplicate: true, record: existingMem };
  }

  try {
    const eventRef = doc(db, 'webhookEvents', eventId);
    const snap = await getDoc(eventRef);
    if (snap.exists()) {
      const rec = snap.data() as ProviderWebhookEventRecord;
      if (rec.status === 'processed') {
        return { isDuplicate: true, record: rec };
      }
    }
  } catch (err) {
    console.warn('[WebhookStore] Firestore check failed, continuing:', err);
  }

  const newRecord: ProviderWebhookEventRecord = {
    id: eventId,
    provider,
    type: event.type,
    created: event.created,
    processedAt: new Date().toISOString(),
    status: 'processed',
  };

  try {
    await setDoc(doc(db, 'webhookEvents', eventId), newRecord);
  } catch (err) {
    console.warn('[WebhookStore] Could not persist webhook record to Firestore:', err);
  }

  memoryWebhookEvents.push(newRecord);
  return { isDuplicate: false, record: newRecord };
}

/**
 * Authority check: Can the user fund this milestone?
 * Only the contract creator / organization admin can fund milestones on active contracts.
 */
export function canFundMilestone(
  contract: GigLinkContract,
  milestoneId: string,
  userId: string,
  userIsOrgAdmin = false
): { allowed: boolean; reason?: string } {
  if (!contract) return { allowed: false, reason: 'Contract does not exist.' };
  if (contract.status !== 'active') {
    return { allowed: false, reason: `Contract is ${contract.status}. Escrow funding is only permitted on active contracts.` };
  }
  if (contract.disputeStatus === 'open' || contract.disputeStatus === 'under_admin_review') {
    return { allowed: false, reason: 'Contract is currently in active dispute. Escrow funding is locked.' };
  }
  const isCreator = userId === contract.creatorId || userIsOrgAdmin;
  if (!isCreator) {
    return { allowed: false, reason: 'Unauthorized: Only the Client/Creator can fund milestone escrow.' };
  }

  const milestone = contract.milestones.find((m) => m.id === milestoneId);
  if (!milestone) {
    return { allowed: false, reason: 'Milestone not found.' };
  }

  if (milestone.paymentState === 'held' && (!milestone.requiredFundingAmount || milestone.requiredFundingAmount <= (milestone.fundedAmount || milestone.amount))) {
    return { allowed: false, reason: 'Milestone is already funded and held in escrow.' };
  }
  if (milestone.paymentState === 'released') {
    return { allowed: false, reason: 'Milestone funds have already been released to Talent.' };
  }
  if (milestone.paymentState === 'refunded') {
    return { allowed: false, reason: 'Milestone has already been refunded.' };
  }

  return { allowed: true };
}

/**
 * Authority check: Can the user release funds for this milestone?
 * Only creator/admin can trigger release, and milestone MUST be approved and paymentState == 'held'.
 */
export function canReleaseMilestonePayment(
  contract: GigLinkContract,
  milestoneId: string,
  userId: string,
  userIsOrgAdmin = false
): { allowed: boolean; reason?: string } {
  if (!contract) return { allowed: false, reason: 'Contract does not exist.' };
  if (contract.status !== 'active' && contract.status !== 'completed') {
    return { allowed: false, reason: `Contract is ${contract.status}. Payment release is not allowed.` };
  }

  // Talent can never release their own funds
  if (userId === contract.talentId && userId !== contract.creatorId) {
    return { allowed: false, reason: 'Unauthorized: Talent cannot release their own escrow funds.' };
  }

  const isCreator = userId === contract.creatorId || userIsOrgAdmin;
  if (!isCreator) {
    return { allowed: false, reason: 'Unauthorized: Only the Client/Creator can release escrow funds.' };
  }

  const milestone = contract.milestones.find((m) => m.id === milestoneId);
  if (!milestone) {
    return { allowed: false, reason: 'Milestone not found.' };
  }

  if (milestone.reviewState !== 'approved' && milestone.status !== 'completed') {
    return { allowed: false, reason: 'Milestone deliverables must be reviewed and approved before releasing payment.' };
  }

  if (milestone.paymentState !== 'held') {
    return {
      allowed: false,
      reason: milestone.paymentState === 'released'
        ? 'Milestone funds have already been released.'
        : milestone.paymentState === 'refunded'
        ? 'Milestone funds have been refunded.'
        : 'Milestone is unfunded. Escrow must be funded before release.',
    };
  }

  if (contract.disputeStatus === 'open' || contract.disputeStatus === 'under_admin_review') {
    return { allowed: false, reason: 'Contract is currently in active dispute. Escrow release is locked until dispute is resolved.' };
  }

  if (milestone.disputeStatus === 'disputed') {
    return { allowed: false, reason: 'Milestone is currently in dispute. Escrow funds are locked until dispute is resolved.' };
  }

  return { allowed: true };
}

/**
 * Client Escrow Funding Confirmation Handler.
 * Transitions: unfunded -> held
 * Coordinates contract milestone, deterministic financial ledger record, and webhook event status
 * in a single atomic Firestore transaction wherever feasible.
 */
export async function recordMilestoneFunded(params: {
  contractId: string;
  milestoneId: string;
  payerId: string;
  payerName: string;
  amount: number;
  currency: string;
  paymentProvider?: PaymentProvider;
  providerPaymentReference?: string;
  paymentIntentId?: string; // Backward-compatibility alias
  provider?: PaymentProvider | 'simulated_stripe';
  eventId?: string;
  eventType?: string;
}): Promise<{
  contract: GigLinkContract;
  milestone: ContractMilestone;
  ledgerRecord: FinancialLedgerRecord;
  webhookRecord?: ProviderWebhookEventRecord;
  isReplay?: boolean;
}> {
  assertPaymentsActive('recordMilestoneFunded');

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
    provider = 'stripe',
    eventId,
    eventType = 'charge.success',
  } = params;

  // Determine effective payment reference
  const effectivePaymentRef =
    providerPaymentReference || paymentIntentId || `ref_${contractId}_${milestoneId}`;
  const effectiveProvider: PaymentProvider =
    paymentProvider || (provider === 'simulated_stripe' ? 'test' : provider) || 'stripe';
  const deterministicLedgerId = getDeterministicFundingLedgerId(effectivePaymentRef);

  // Check test simulation hook for atomic failure testing
  if (simulatedFundingTxFailure) {
    throw simulatedFundingTxFailure;
  }

  const contractRef = doc(db, 'contracts', contractId);
  const ledgerRef = doc(db, 'financialLedger', deterministicLedgerId);
  const eventRef = eventId ? doc(db, 'webhookEvents', eventId) : null;

  let result: {
    contract: GigLinkContract;
    milestone: ContractMilestone;
    ledgerRecord: FinancialLedgerRecord;
    webhookRecord?: ProviderWebhookEventRecord;
    isReplay: boolean;
  };

  try {
    // ATOMIC TRANSACTION: Coordinates contract milestone, deterministic financial ledger record, and webhook event status
    result = await runTransaction(db, async (txn) => {
      // Check test simulation hook inside transaction
      if (simulatedFundingTxFailure) {
        throw simulatedFundingTxFailure;
      }

      // -------------------------------------------------------------
      // READ PHASE (Must precede all writes in Firestore transaction)
      // -------------------------------------------------------------
      const contractSnap = await txn.get(contractRef);
      if (!contractSnap.exists()) {
        throw new Error(`Contract ${contractId} not found.`);
      }
      const currentContract = normalizeContractData(contractSnap.data() as GigLinkContract);

      const mIdx = currentContract.milestones.findIndex((m) => m.id === milestoneId);
      if (mIdx === -1) {
        throw new Error(`Milestone ${milestoneId} not found on contract.`);
      }
      const milestone = currentContract.milestones[mIdx];
      const safeAmount = Number(amount) || milestone.amount;
      const expectedCurrency = (currency || milestone.currency || 'USD').toUpperCase();

      // Read existing deterministic ledger record
      const ledgerSnap = await txn.get(ledgerRef);
      let existingLedgerRecord: FinancialLedgerRecord | null = null;
      if (ledgerSnap.exists()) {
        existingLedgerRecord = ledgerSnap.data() as FinancialLedgerRecord;
        // Requirement 6: Prevent same provider payment reference from funding different milestones/contracts
        if (existingLedgerRecord.contractId !== contractId || existingLedgerRecord.milestoneId !== milestoneId) {
          throw new Error(
            `Conflict: Payment reference '${effectivePaymentRef}' was already used for contract '${existingLedgerRecord.contractId}' milestone '${existingLedgerRecord.milestoneId}'. Cross-milestone reuse is strictly prohibited.`
          );
        }
        // Requirement 5: Detect conflicting amounts/currency on same milestone
        if (
          existingLedgerRecord.amount !== safeAmount ||
          existingLedgerRecord.currency.toUpperCase() !== expectedCurrency
        ) {
          throw new Error(
            `Conflict: Payment reference '${effectivePaymentRef}' already recorded with conflicting amount/currency (${existingLedgerRecord.amount} ${existingLedgerRecord.currency} vs ${safeAmount} ${expectedCurrency}).`
          );
        }
      }

      // Read webhook event record if eventId provided
      let existingEventRecord: ProviderWebhookEventRecord | null = null;
      if (eventRef) {
        const eventSnap = await txn.get(eventRef);
        if (eventSnap.exists()) {
          existingEventRecord = eventSnap.data() as ProviderWebhookEventRecord;
        }
      }

      // -------------------------------------------------------------
      // IDEMPOTENT REPLAY DETECTION
      // -------------------------------------------------------------
      if (existingLedgerRecord) {
        // Milestone is already funded and ledger record exists with exact matching parameters
        let webhookRec: ProviderWebhookEventRecord | undefined;
        if (eventRef && (!existingEventRecord || existingEventRecord.status !== 'processed')) {
          webhookRec = {
            id: eventId!,
            provider: effectiveProvider,
            type: eventType,
            created: Date.now(),
            processedAt: new Date().toISOString(),
            status: 'processed',
            contractId: currentContract.id,
            milestoneId: milestone.id,
            transactionId: deterministicLedgerId,
          };
          txn.set(eventRef, webhookRec);
        }

        return {
          contract: currentContract,
          milestone,
          ledgerRecord: existingLedgerRecord,
          webhookRecord: webhookRec || existingEventRecord || undefined,
          isReplay: true,
        };
      }

      // -------------------------------------------------------------
      // PAYMENT STATE MACHINE & INVARIANT VALIDATION
      // -------------------------------------------------------------
      if (milestone.paymentState === 'held') {
        if (milestone.providerPaymentReference === effectivePaymentRef) {
          // Already held with same reference
          const fallbackLedger: FinancialLedgerRecord = {
            id: deterministicLedgerId,
            contractId: currentContract.id,
            milestoneId: milestone.id,
            opportunityId: currentContract.opportunityId,
            payerId: currentContract.creatorId,
            payerName: currentContract.creatorName || 'Client',
            recipientId: currentContract.talentId,
            recipientName: currentContract.talentName || 'Talent',
            amount: safeAmount,
            currency: expectedCurrency,
            platformFeeRate: 0.05,
            platformFeeAmount: safeAmount * 0.05,
            netTalentAmount: safeAmount * 0.95,
            type: 'milestone_funded',
            provider: effectiveProvider,
            providerReference: effectivePaymentRef,
            providerPaymentReference: effectivePaymentRef,
            providerEventId: eventId || null,
            status: 'succeeded',
            description: `Escrow funded for "${milestone.title}" (${safeAmount} ${expectedCurrency})`,
            createdAt: milestone.fundedAt || new Date().toISOString(),
            completedAt: milestone.fundedAt || new Date().toISOString(),
          };
          return {
            contract: currentContract,
            milestone,
            ledgerRecord: fallbackLedger,
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

      assertValidPaymentStateTransition(milestone.paymentState || 'unfunded', 'held', {
        contractId: currentContract.id,
        milestoneId: milestone.id,
      });

      // -------------------------------------------------------------
      // WRITE PHASE (Atomic multi-document mutations)
      // -------------------------------------------------------------
      const now = new Date().toISOString();
      const { platformFeeRate, platformFeeAmount, netTalentAmount } = calculatePlatformFee(safeAmount);

      // Server-authoritative payer identity: strictly contract.creatorId
      const authoritativePayerId = currentContract.creatorId;
      const authoritativePayerName = currentContract.creatorName || payerName || 'Client';

      const updatedMilestone: ContractMilestone = {
        ...milestone,
        paymentState: 'held',
        paymentProvider: effectiveProvider,
        providerPaymentReference: effectivePaymentRef,
        paymentIntentId: effectivePaymentRef,
        fundedAt: now,
        payerId: authoritativePayerId,
        payerName: authoritativePayerName,
        recipientId: currentContract.talentId,
        recipientName: currentContract.talentName || 'Talent',
        fundedAmount: (milestone.fundedAmount || 0) + safeAmount,
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
        netTalentAmount,
        type: 'milestone_funded',
        provider: effectiveProvider,
        providerReference: effectivePaymentRef,
        providerPaymentReference: effectivePaymentRef,
        providerEventId: eventId || null,
        status: 'succeeded',
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

      // Execute all atomic writes in the transaction
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
    // 1. Business validation & conflict errors must retain their exact error semantics and rethrow immediately
    const isConflict = txErr?.message?.includes('Conflict:');
    const isStateError =
      txErr?.message?.includes('already funded') ||
      txErr?.message?.includes('already been released') ||
      txErr?.message?.includes('already been refunded') ||
      txErr?.message?.includes('State transition') ||
      (txErr?.message?.includes('Contract ') && txErr?.message?.includes('not found')) ||
      (txErr?.message?.includes('Milestone ') && txErr?.message?.includes('not found'));
    const isSimulated = txErr === simulatedFundingTxFailure || txErr?.message?.includes('Simulated');

    if (isConflict || isStateError || isSimulated) {
      throw txErr;
    }

    // 2. PRODUCTION SAFETY BOUNDARY:
    // In production, Firestore transaction failures must NEVER trigger the non-atomic offline fallback.
    // Unexpected transaction errors, permission errors, timeouts, unavailable-service errors,
    // and transaction-abort errors must propagate so the webhook route returns HTTP 500 and allows Paystack retry.
    // Permit the offline fallback ONLY when the explicit test isolation mechanism proves that
    // test writers are installed and the runtime is not production.
    // Do not treat a missing Firestore connection or an uninitialized client as permission to bypass the atomic transaction in production.
    if (!isTestIsolationActive()) {
      throw txErr;
    }

    // 3. OFFLINE / TEST RUNTIME FALLBACK (Only permitted when test writers are explicitly installed in non-production test runtime)
    const memContract = await getContract(contractId);
    if (!memContract) throw new Error(`Contract ${contractId} not found.`);

    const mIdx = memContract.milestones.findIndex((m) => m.id === milestoneId);
    if (mIdx === -1) throw new Error(`Milestone ${milestoneId} not found on contract.`);
    const milestone = memContract.milestones[mIdx];
    const safeAmount = Number(amount) || milestone.amount;
    const expectedCurrency = (currency || milestone.currency || 'USD').toUpperCase();

    // Check memory ledger for deterministic record
    const existingLedgerRecord = memoryLedger.find((r) => r.id === deterministicLedgerId);
    if (existingLedgerRecord) {
      if (existingLedgerRecord.contractId !== contractId || existingLedgerRecord.milestoneId !== milestoneId) {
        throw new Error(
          `Conflict: Payment reference '${effectivePaymentRef}' was already used for contract '${existingLedgerRecord.contractId}' milestone '${existingLedgerRecord.milestoneId}'. Cross-milestone reuse is strictly prohibited.`
        );
      }
      if (
        existingLedgerRecord.amount !== safeAmount ||
        existingLedgerRecord.currency.toUpperCase() !== expectedCurrency
      ) {
        throw new Error(
          `Conflict: Payment reference '${effectivePaymentRef}' already recorded with conflicting amount/currency (${existingLedgerRecord.amount} ${existingLedgerRecord.currency} vs ${safeAmount} ${expectedCurrency}).`
        );
      }
      // Replay
      let webhookRecord: ProviderWebhookEventRecord | undefined;
      if (eventId) {
        const existingHook = memoryWebhookEvents.find((e) => e.id === eventId);
        if (!existingHook || existingHook.status !== 'processed') {
          webhookRecord = {
            id: eventId,
            provider: effectiveProvider,
            type: eventType,
            created: Date.now(),
            processedAt: new Date().toISOString(),
            status: 'processed',
            contractId: memContract.id,
            milestoneId: milestone.id,
            transactionId: deterministicLedgerId,
          };
          const existingHookIdx = memoryWebhookEvents.findIndex((e) => e.id === eventId);
          if (existingHookIdx >= 0) {
            memoryWebhookEvents[existingHookIdx] = webhookRecord;
          } else {
            memoryWebhookEvents.push(webhookRecord);
          }
        }
      }

      return {
        contract: memContract,
        milestone,
        ledgerRecord: existingLedgerRecord,
        webhookRecord,
        isReplay: true,
      };
    }

    // State machine check
    if (milestone.paymentState === 'held') {
      if (milestone.providerPaymentReference === effectivePaymentRef) {
        const matchingLedger = memoryLedger.find((r) => r.providerPaymentReference === effectivePaymentRef);
        let webhookRecord: ProviderWebhookEventRecord | undefined;
        if (eventId) {
          const existingHook = memoryWebhookEvents.find((e) => e.id === eventId);
          if (!existingHook || existingHook.status !== 'processed') {
            webhookRecord = {
              id: eventId,
              provider: effectiveProvider,
              type: eventType,
              created: Date.now(),
              processedAt: new Date().toISOString(),
              status: 'processed',
              contractId: memContract.id,
              milestoneId: milestone.id,
              transactionId: deterministicLedgerId,
            };
            const existingHookIdx = memoryWebhookEvents.findIndex((e) => e.id === eventId);
            if (existingHookIdx >= 0) {
              memoryWebhookEvents[existingHookIdx] = webhookRecord;
            } else {
              memoryWebhookEvents.push(webhookRecord);
            }
          }
        }
        return {
          contract: memContract,
          milestone,
          ledgerRecord: matchingLedger || ({} as any),
          webhookRecord,
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

    assertValidPaymentStateTransition(milestone.paymentState || 'unfunded', 'held', {
      contractId: memContract.id,
      milestoneId: milestone.id,
    });

    const now = new Date().toISOString();
    const { platformFeeRate, platformFeeAmount, netTalentAmount } = calculatePlatformFee(safeAmount);
    const authoritativePayerId = memContract.creatorId;
    const authoritativePayerName = memContract.creatorName || payerName || 'Client';

    const updatedMilestone: ContractMilestone = {
      ...milestone,
      paymentState: 'held',
      paymentProvider: effectiveProvider,
      providerPaymentReference: effectivePaymentRef,
      paymentIntentId: effectivePaymentRef,
      fundedAt: now,
      payerId: authoritativePayerId,
      payerName: authoritativePayerName,
      recipientId: memContract.talentId,
      recipientName: memContract.talentName || 'Talent',
      fundedAmount: (milestone.fundedAmount || 0) + safeAmount,
      requiredFundingAmount: milestone.amount,
      updatedAt: now,
    };

    const updatedMilestones = [...memContract.milestones];
    updatedMilestones[mIdx] = updatedMilestone;

    const updatedContract: GigLinkContract = {
      ...memContract,
      milestones: updatedMilestones,
      updatedAt: now,
    };

    const ledgerRecord: FinancialLedgerRecord = {
      id: deterministicLedgerId,
      contractId: memContract.id,
      milestoneId: milestone.id,
      opportunityId: memContract.opportunityId,
      payerId: authoritativePayerId,
      payerName: authoritativePayerName,
      recipientId: memContract.talentId,
      recipientName: memContract.talentName || 'Talent',
      amount: safeAmount,
      currency: expectedCurrency,
      platformFeeRate,
      platformFeeAmount,
      netTalentAmount,
      type: 'milestone_funded',
      provider: effectiveProvider,
      providerReference: effectivePaymentRef,
      providerPaymentReference: effectivePaymentRef,
      providerEventId: eventId || null,
      status: 'succeeded',
      description: `Escrow funded for "${milestone.title}" (${safeAmount} ${expectedCurrency})`,
      createdAt: now,
      completedAt: now,
    };

    let webhookRecord: ProviderWebhookEventRecord | undefined;
    if (eventId) {
      webhookRecord = {
        id: eventId,
        provider: effectiveProvider,
        type: eventType,
        created: Date.now(),
        processedAt: now,
        status: 'processed',
        contractId: memContract.id,
        milestoneId: milestone.id,
        transactionId: deterministicLedgerId,
      };
    }

    result = {
      contract: updatedContract,
      milestone: updatedMilestone,
      ledgerRecord,
      webhookRecord,
      isReplay: false,
    };

    await persistContract(updatedContract);
    if (customLedgerWriter) {
      await customLedgerWriter(ledgerRef, ledgerRecord);
    }
  }

  // Update in-memory caches strictly AFTER transaction successfully committed
  setContractInStore(result.contract);
  const existingLedgerIdx = memoryLedger.findIndex((r) => r.id === result.ledgerRecord.id);
  if (existingLedgerIdx >= 0) {
    memoryLedger[existingLedgerIdx] = result.ledgerRecord;
  } else {
    memoryLedger.unshift(result.ledgerRecord);
  }

  if (result.webhookRecord) {
    const existingHookIdx = memoryWebhookEvents.findIndex((e) => e.id === result.webhookRecord!.id);
    if (existingHookIdx >= 0) {
      memoryWebhookEvents[existingHookIdx] = result.webhookRecord;
    } else {
      memoryWebhookEvents.push(result.webhookRecord);
    }
  }

  return {
    contract: result.contract,
    milestone: result.milestone,
    ledgerRecord: result.ledgerRecord,
    isReplay: result.isReplay,
  };
}

/**
 * Server-Authoritative Milestone Release Handler.
 * Transitions: held -> released
 */
export async function recordMilestonePaymentReleased(params: {
  contractId: string;
  milestoneId: string;
  authorizedByUserId: string;
  providerPayoutReference?: string;
  transferId?: string; // Backward-compatibility alias
  provider?: PaymentProvider | 'simulated_stripe';
  paymentProvider?: PaymentProvider;
  userIsOrgAdmin?: boolean;
}): Promise<{ contract: GigLinkContract; milestone: ContractMilestone; ledgerRecord: FinancialLedgerRecord }> {
  assertPaymentsActive('recordMilestonePaymentReleased');

  const {
    contractId,
    milestoneId,
    authorizedByUserId,
    providerPayoutReference,
    transferId,
    provider = 'stripe',
    paymentProvider,
    userIsOrgAdmin = false,
  } = params;

  const contract = await getContract(contractId);
  if (!contract) throw new Error(`Contract ${contractId} not found.`);

  const check = canReleaseMilestonePayment(contract, milestoneId, authorizedByUserId, userIsOrgAdmin);
  if (!check.allowed) {
    throw new Error(check.reason || 'Payment release not allowed.');
  }

  const mIdx = contract.milestones.findIndex((m) => m.id === milestoneId);
  const milestone = contract.milestones[mIdx];

  assertValidPaymentStateTransition(milestone.paymentState, 'released', {
    contractId: contract.id,
    milestoneId: milestone.id,
  });

  const now = new Date().toISOString();
  const amount = Number(milestone.amount) || 0;
  const { platformFeeRate, platformFeeAmount, netTalentAmount } = calculatePlatformFee(amount);

  const effectivePayoutRef =
    providerPayoutReference || transferId || milestone.providerPayoutReference || milestone.transferId || null;
  const effectiveProvider: PaymentProvider =
    paymentProvider || (provider === 'simulated_stripe' ? 'test' : provider) || milestone.paymentProvider || 'stripe';

  const updatedMilestone: ContractMilestone = {
    ...milestone,
    paymentState: 'released',
    paymentProvider: effectiveProvider,
    providerPayoutReference: effectivePayoutRef,
    transferId: effectivePayoutRef, // Backward-compatibility sync
    releasedAt: now,
    updatedAt: now,
  };

  const updatedMilestones = [...contract.milestones];
  updatedMilestones[mIdx] = updatedMilestone;

  const updatedContract: GigLinkContract = {
    ...contract,
    milestones: updatedMilestones,
    updatedAt: now,
  };

  await persistContract(updatedContract);

  // Append ledger records: milestone_released and platform_fee
  const ledgerId = `tx_rel_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const ledgerRecord: FinancialLedgerRecord = {
    id: ledgerId,
    contractId: contract.id,
    milestoneId: milestone.id,
    opportunityId: contract.opportunityId,
    payerId: contract.creatorId,
    payerName: contract.creatorName || 'Client',
    recipientId: contract.talentId,
    recipientName: contract.talentName || 'Talent',
    amount,
    currency: milestone.currency || 'USD',
    platformFeeRate,
    platformFeeAmount,
    netTalentAmount,
    type: 'milestone_released',
    provider,
    providerReference: effectivePayoutRef,
    providerPayoutReference: effectivePayoutRef,
    status: 'succeeded',
    description: `Escrow released for approved milestone "${milestone.title}" (Net: $${netTalentAmount}, Fee: $${platformFeeAmount})`,
    createdAt: now,
    completedAt: now,
  };

  await appendLedgerRecord(ledgerRecord);

  return { contract: updatedContract, milestone: updatedMilestone, ledgerRecord };
}

/**
 * Milestone Escrow Refund Handler.
 * Transitions: held -> refunded (or partial)
 */
export async function recordMilestoneRefund(params: {
  contractId: string;
  milestoneId: string;
  authorizedByUserId: string;
  refundAmount?: number;
  reason?: string;
  providerRefundReference?: string;
  refundId?: string; // Backward-compatibility alias
  provider?: PaymentProvider | 'simulated_stripe';
  paymentProvider?: PaymentProvider;
  userIsOrgAdmin?: boolean;
}): Promise<{ contract: GigLinkContract; milestone: ContractMilestone; ledgerRecord: FinancialLedgerRecord }> {
  assertPaymentsActive('recordMilestoneRefund');

  const {
    contractId,
    milestoneId,
    authorizedByUserId,
    refundAmount,
    reason,
    providerRefundReference,
    refundId,
    provider = 'stripe',
    paymentProvider,
    userIsOrgAdmin = false,
  } = params;

  const contract = await getContract(contractId);
  if (!contract) throw new Error(`Contract ${contractId} not found.`);

  const isCreator = authorizedByUserId === contract.creatorId || userIsOrgAdmin;
  if (!isCreator) throw new Error('Unauthorized: Only client or admin can authorize a refund.');

  const mIdx = contract.milestones.findIndex((m) => m.id === milestoneId);
  if (mIdx === -1) throw new Error('Milestone not found.');

  const milestone = contract.milestones[mIdx];
  assertValidPaymentStateTransition(milestone.paymentState, 'refunded', {
    contractId: contract.id,
    milestoneId: milestone.id,
  });

  if (milestone.paymentState !== 'held') {
    throw new Error(`Cannot refund milestone with payment state "${milestone.paymentState}". Only held funds can be refunded.`);
  }

  const now = new Date().toISOString();
  const amountToRefund = Math.min(milestone.fundedAmount || milestone.amount, refundAmount || milestone.amount);

  const effectiveRefundRef =
    providerRefundReference || refundId || milestone.providerRefundReference || milestone.refundId || null;
  const effectiveProvider: PaymentProvider =
    paymentProvider || (provider === 'simulated_stripe' ? 'test' : provider) || milestone.paymentProvider || 'stripe';

  const updatedMilestone: ContractMilestone = {
    ...milestone,
    paymentState: 'refunded',
    paymentProvider: effectiveProvider,
    providerRefundReference: effectiveRefundRef,
    refundId: effectiveRefundRef, // Backward-compatibility sync
    refundedAt: now,
    updatedAt: now,
  };

  const updatedMilestones = [...contract.milestones];
  updatedMilestones[mIdx] = updatedMilestone;

  const updatedContract: GigLinkContract = {
    ...contract,
    milestones: updatedMilestones,
    updatedAt: now,
  };

  await persistContract(updatedContract);

  const ledgerId = `tx_ref_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const ledgerRecord: FinancialLedgerRecord = {
    id: ledgerId,
    contractId: contract.id,
    milestoneId: milestone.id,
    opportunityId: contract.opportunityId,
    payerId: contract.creatorId,
    payerName: contract.creatorName || 'Client',
    recipientId: contract.talentId,
    recipientName: contract.talentName || 'Talent',
    amount: amountToRefund,
    currency: milestone.currency || 'USD',
    platformFeeRate: 0,
    platformFeeAmount: 0,
    netTalentAmount: 0,
    type: 'refund_completed',
    provider,
    providerReference: effectiveRefundRef,
    providerRefundReference: effectiveRefundRef,
    status: 'succeeded',
    description: `Refund processed for "${milestone.title}" ($${amountToRefund} ${milestone.currency || 'USD'})${reason ? `: ${reason}` : ''}`,
    createdAt: now,
    completedAt: now,
  };

  await appendLedgerRecord(ledgerRecord);

  return { contract: updatedContract, milestone: updatedMilestone, ledgerRecord };
}

/**
 * Milestone Payout Settled Handler (Webhooks: transfer.success).
 * Transitions: released -> paid_out or payout_pending -> paid_out
 */
export async function recordMilestonePayoutSuccess(params: {
  contractId: string;
  milestoneId: string;
  payoutReference: string;
  provider?: PaymentProvider;
  eventId?: string;
}): Promise<{ contract: GigLinkContract; milestone: ContractMilestone; ledgerRecord: FinancialLedgerRecord }> {
  assertPaymentsActive('recordMilestonePayoutSuccess');

  const { contractId, milestoneId, payoutReference, provider = 'paystack', eventId } = params;
  const contract = await getContract(contractId);
  if (!contract) throw new Error(`Contract ${contractId} not found.`);

  const mIdx = contract.milestones.findIndex((m) => m.id === milestoneId);
  if (mIdx === -1) throw new Error(`Milestone ${milestoneId} not found.`);
  const milestone = contract.milestones[mIdx];

  assertValidPaymentStateTransition(milestone.paymentState, 'paid_out', {
    contractId: contract.id,
    milestoneId: milestone.id,
  });

  const now = new Date().toISOString();
  const amount = Number(milestone.amount) || 0;
  const { platformFeeRate, platformFeeAmount, netTalentAmount } = calculatePlatformFee(amount);

  const updatedMilestone: ContractMilestone = {
    ...milestone,
    paymentState: 'paid_out',
    providerPayoutReference: payoutReference || milestone.providerPayoutReference,
    updatedAt: now,
  };

  const updatedMilestones = [...contract.milestones];
  updatedMilestones[mIdx] = updatedMilestone;

  const updatedContract: GigLinkContract = {
    ...contract,
    milestones: updatedMilestones,
    updatedAt: now,
  };

  await persistContract(updatedContract);

  const ledgerId = `tx_po_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const ledgerRecord: FinancialLedgerRecord = {
    id: ledgerId,
    contractId: contract.id,
    milestoneId: milestone.id,
    opportunityId: contract.opportunityId,
    payerId: contract.creatorId,
    payerName: contract.creatorName || 'Client',
    recipientId: contract.talentId,
    recipientName: contract.talentName || 'Talent',
    amount,
    currency: milestone.currency || 'USD',
    platformFeeRate,
    platformFeeAmount,
    netTalentAmount,
    type: 'payout_completed',
    provider,
    providerReference: payoutReference,
    providerPayoutReference: payoutReference,
    providerEventId: eventId,
    status: 'succeeded',
    description: `Payout settled to partner for milestone "${milestone.title}" (Net: $${netTalentAmount})`,
    createdAt: now,
    completedAt: now,
  };

  await appendLedgerRecord(ledgerRecord);

  return { contract: updatedContract, milestone: updatedMilestone, ledgerRecord };
}

/**
 * Milestone Payout Failure Handler (Webhooks: transfer.failed / transfer.reversed).
 */
export async function recordMilestonePayoutFailure(params: {
  contractId: string;
  milestoneId: string;
  payoutReference?: string;
  reason?: string;
}): Promise<{ contract: GigLinkContract; milestone: ContractMilestone }> {
  assertPaymentsActive('recordMilestonePayoutFailure');

  const { contractId, milestoneId, payoutReference } = params;
  const contract = await getContract(contractId);
  if (!contract) throw new Error(`Contract ${contractId} not found.`);

  const mIdx = contract.milestones.findIndex((m) => m.id === milestoneId);
  if (mIdx === -1) throw new Error(`Milestone ${milestoneId} not found.`);
  const milestone = contract.milestones[mIdx];

  const now = new Date().toISOString();
  const updatedMilestone: ContractMilestone = {
    ...milestone,
    paymentState: 'payout_failed',
    providerPayoutReference: payoutReference || milestone.providerPayoutReference,
    updatedAt: now,
  };

  const updatedMilestones = [...contract.milestones];
  updatedMilestones[mIdx] = updatedMilestone;

  const updatedContract: GigLinkContract = {
    ...contract,
    milestones: updatedMilestones,
    updatedAt: now,
  };

  await persistContract(updatedContract);
  return { contract: updatedContract, milestone: updatedMilestone };
}

/**
 * Connect / Link Talent Payout Account (Server-authoritative).
 */
export async function setTalentPayoutAccount(account: TalentPayoutAccount): Promise<TalentPayoutAccount> {
  assertPaymentsActive('setTalentPayoutAccount');

  try {
    const docRef = doc(db, 'talentPayoutAccounts', account.userId);
    await setDoc(docRef, account);
  } catch (err) {
    console.warn('[PayoutStore] Could not persist to Firestore:', err);
  }
  memoryTalentAccounts.set(account.userId, account);
  return account;
}

/**
 * Retrieves Talent Payout Account.
 */
export async function getTalentPayoutAccount(userId: string): Promise<TalentPayoutAccount | null> {
  try {
    const docRef = doc(db, 'talentPayoutAccounts', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as TalentPayoutAccount;
    }
  } catch (err) {
    console.warn('[PayoutStore] Could not fetch from Firestore:', err);
  }
  return memoryTalentAccounts.get(userId) || null;
}
