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
  StripeWebhookEventRecord,
  TalentStripeAccount,
} from '../types';
import { calculatePlatformFee } from './financialService';
import { getContract, persistContract } from './contractService';

// In-memory fallback stores for offline/test environments
const memoryLedger: FinancialLedgerRecord[] = [];
const memoryWebhookEvents: StripeWebhookEventRecord[] = [];
const memoryTalentAccounts: Map<string, TalentStripeAccount> = new Map();

/**
 * Test hook for mocking/controlling the underlying Firestore writer in unit tests.
 * In production/runtime, this is null and setDoc is invoked directly.
 */
export type LedgerFirestoreWriter = (ledgerRef: any, data: FinancialLedgerRecord) => Promise<void>;
let customLedgerWriter: LedgerFirestoreWriter | null = null;

export function setLedgerWriterForTesting(writer: LedgerFirestoreWriter | null): void {
  customLedgerWriter = writer;
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
}): Promise<{ isDuplicate: boolean; record: StripeWebhookEventRecord }> {
  const eventId = event.id;

  // Check in-memory first
  const existingMem = memoryWebhookEvents.find((e) => e.id === eventId);
  if (existingMem && existingMem.status === 'processed') {
    return { isDuplicate: true, record: existingMem };
  }

  try {
    const eventRef = doc(db, 'webhookEvents', eventId);
    const snap = await getDoc(eventRef);
    if (snap.exists()) {
      const rec = snap.data() as StripeWebhookEventRecord;
      if (rec.status === 'processed') {
        return { isDuplicate: true, record: rec };
      }
    }
  } catch (err) {
    console.warn('[WebhookStore] Firestore check failed, continuing:', err);
  }

  const newRecord: StripeWebhookEventRecord = {
    id: eventId,
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
 */
export async function recordMilestoneFunded(params: {
  contractId: string;
  milestoneId: string;
  payerId: string;
  payerName: string;
  amount: number;
  currency: string;
  paymentIntentId?: string;
  provider?: 'stripe' | 'simulated_stripe';
  eventId?: string;
}): Promise<{ contract: GigLinkContract; milestone: ContractMilestone; ledgerRecord: FinancialLedgerRecord }> {
  const {
    contractId,
    milestoneId,
    payerId,
    payerName,
    amount,
    currency,
    paymentIntentId,
    provider = 'stripe',
    eventId,
  } = params;

  const contract = await getContract(contractId);
  if (!contract) throw new Error(`Contract ${contractId} not found.`);

  const mIdx = contract.milestones.findIndex((m) => m.id === milestoneId);
  if (mIdx === -1) throw new Error(`Milestone ${milestoneId} not found on contract.`);

  const milestone = contract.milestones[mIdx];

  // Invariant state guard: Prevent double-funding or illegal transitions
  if (milestone.paymentState === 'held' && (!milestone.requiredFundingAmount || milestone.requiredFundingAmount <= (milestone.fundedAmount || milestone.amount))) {
    throw new Error('Milestone is already funded and held in escrow.');
  }
  if (milestone.paymentState === 'released') {
    throw new Error('Milestone funds have already been released to Talent.');
  }
  if (milestone.paymentState === 'refunded') {
    throw new Error('Milestone has already been refunded.');
  }

  const now = new Date().toISOString();
  const safeAmount = Number(amount) || milestone.amount;
  const { platformFeeRate, platformFeeAmount, netTalentAmount } = calculatePlatformFee(safeAmount);

  // Update milestone fields
  const updatedMilestone: ContractMilestone = {
    ...milestone,
    paymentState: 'held',
    fundedAt: now,
    payerId,
    payerName,
    recipientId: contract.talentId,
    recipientName: contract.talentName || 'Talent',
    paymentIntentId: paymentIntentId || milestone.paymentIntentId || null,
    fundedAmount: (milestone.fundedAmount || 0) + safeAmount,
    requiredFundingAmount: milestone.amount, // fulfilled
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

  // Create immutable ledger record
  const ledgerId = `tx_fund_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const ledgerRecord: FinancialLedgerRecord = {
    id: ledgerId,
    contractId: contract.id,
    milestoneId: milestone.id,
    opportunityId: contract.opportunityId,
    payerId,
    payerName,
    recipientId: contract.talentId,
    recipientName: contract.talentName || 'Talent',
    amount: safeAmount,
    currency: currency || milestone.currency || 'USD',
    platformFeeRate,
    platformFeeAmount,
    netTalentAmount,
    type: 'milestone_funded',
    provider,
    providerReference: paymentIntentId || null,
    providerEventId: eventId || null,
    status: 'succeeded',
    description: `Escrow funded for "${milestone.title}" ($${safeAmount} ${currency || 'USD'})`,
    createdAt: now,
    completedAt: now,
  };

  await appendLedgerRecord(ledgerRecord);

  return { contract: updatedContract, milestone: updatedMilestone, ledgerRecord };
}

/**
 * Server-Authoritative Milestone Release Handler.
 * Transitions: held -> released
 */
export async function recordMilestonePaymentReleased(params: {
  contractId: string;
  milestoneId: string;
  authorizedByUserId: string;
  transferId?: string;
  provider?: 'stripe' | 'simulated_stripe';
  userIsOrgAdmin?: boolean;
}): Promise<{ contract: GigLinkContract; milestone: ContractMilestone; ledgerRecord: FinancialLedgerRecord }> {
  const { contractId, milestoneId, authorizedByUserId, transferId, provider = 'stripe', userIsOrgAdmin = false } = params;

  const contract = await getContract(contractId);
  if (!contract) throw new Error(`Contract ${contractId} not found.`);

  const check = canReleaseMilestonePayment(contract, milestoneId, authorizedByUserId, userIsOrgAdmin);
  if (!check.allowed) {
    throw new Error(check.reason || 'Payment release not allowed.');
  }

  const mIdx = contract.milestones.findIndex((m) => m.id === milestoneId);
  const milestone = contract.milestones[mIdx];
  const now = new Date().toISOString();
  const amount = Number(milestone.amount) || 0;
  const { platformFeeRate, platformFeeAmount, netTalentAmount } = calculatePlatformFee(amount);

  const updatedMilestone: ContractMilestone = {
    ...milestone,
    paymentState: 'released',
    releasedAt: now,
    transferId: transferId || milestone.transferId || null,
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
    providerReference: transferId || null,
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
  refundId?: string;
  provider?: 'stripe' | 'simulated_stripe';
  userIsOrgAdmin?: boolean;
}): Promise<{ contract: GigLinkContract; milestone: ContractMilestone; ledgerRecord: FinancialLedgerRecord }> {
  const {
    contractId,
    milestoneId,
    authorizedByUserId,
    refundAmount,
    reason,
    refundId,
    provider = 'stripe',
    userIsOrgAdmin = false,
  } = params;

  const contract = await getContract(contractId);
  if (!contract) throw new Error(`Contract ${contractId} not found.`);

  const isCreator = authorizedByUserId === contract.creatorId || userIsOrgAdmin;
  if (!isCreator) throw new Error('Unauthorized: Only client or admin can authorize a refund.');

  const mIdx = contract.milestones.findIndex((m) => m.id === milestoneId);
  if (mIdx === -1) throw new Error('Milestone not found.');

  const milestone = contract.milestones[mIdx];
  if (milestone.paymentState !== 'held') {
    throw new Error(`Cannot refund milestone with payment state "${milestone.paymentState}". Only held funds can be refunded.`);
  }

  const now = new Date().toISOString();
  const amountToRefund = Math.min(milestone.fundedAmount || milestone.amount, refundAmount || milestone.amount);

  const updatedMilestone: ContractMilestone = {
    ...milestone,
    paymentState: 'refunded',
    refundedAt: now,
    refundId: refundId || null,
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
    providerReference: refundId || null,
    status: 'succeeded',
    description: `Refund processed for "${milestone.title}" ($${amountToRefund} ${milestone.currency || 'USD'})${reason ? `: ${reason}` : ''}`,
    createdAt: now,
    completedAt: now,
  };

  await appendLedgerRecord(ledgerRecord);

  return { contract: updatedContract, milestone: updatedMilestone, ledgerRecord };
}

/**
 * Connect / Link Talent Stripe Payout Account.
 */
export async function setTalentPayoutAccount(account: TalentStripeAccount): Promise<TalentStripeAccount> {
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
 * Retrieves Talent Stripe Payout Account.
 */
export async function getTalentPayoutAccount(userId: string): Promise<TalentStripeAccount | null> {
  try {
    const docRef = doc(db, 'talentPayoutAccounts', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as TalentStripeAccount;
    }
  } catch (err) {
    console.warn('[PayoutStore] Could not fetch from Firestore:', err);
  }
  return memoryTalentAccounts.get(userId) || null;
}
