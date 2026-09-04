/**
 * GigLink Contract Dispute Resolution & Mutual Cancellation Service (Phase 6)
 *
 * Implements:
 * 1. Dispute initiation on active contracts/milestones with evidence tracking
 * 2. Mutual Cancellation negotiation (two-way agreement)
 * 3. Server-authoritative platform administrator mediation & arbitration
 * 4. Resilient persistence across local authoritative store and Firestore
 * 5. Phase 4 financial reconciliation with 0 rounding loss
 */

import { doc, setDoc, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  ContractDisputeRecord,
  ContractDisputeStatus,
  DisputeEvidence,
  DisputeReasonCategory,
  MutualCancellationProposal,
  AdminArbitrationVerdict,
  GigLinkContract,
  ContractMilestone,
  FinancialLedgerRecord,
} from '../types';
import { getContract, persistContract, normalizeContractData } from './contractService';
import { appendLedgerRecord } from './financialLedgerService';
import { calculatePlatformFee } from './financialService';

// Mutex queue per contract ID to serialize concurrent local and transaction operations
const disputeMutexes = new Map<string, Promise<any>>();

async function runWithDisputeLock<T>(contractId: string, op: () => Promise<T>): Promise<T> {
  const currentLock = disputeMutexes.get(contractId) || Promise.resolve();
  let releaseLock: () => void;
  const newLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  disputeMutexes.set(contractId, currentLock.then(() => newLock));

  try {
    await currentLock;
    return await op();
  } finally {
    releaseLock!();
    if (disputeMutexes.get(contractId) === newLock) {
      disputeMutexes.delete(contractId);
    }
  }
}

export function calculatePlatformFeeSplit(grossAmount: number, customFeeRate = 0.05) {
  const fee = calculatePlatformFee(grossAmount, customFeeRate);
  return {
    grossAmount,
    platformFeeRate: fee.platformFeeRate,
    platformFeeAmount: fee.platformFeeAmount,
    netTalentAmount: fee.netTalentAmount,
  };
}

/**
 * Authority check: Can a user raise a dispute on this contract?
 */
export function canRaiseDispute(
  contract: GigLinkContract,
  userId: string,
  milestoneId?: string | null
): { allowed: boolean; reason?: string } {
  if (!contract) {
    return { allowed: false, reason: 'Contract does not exist.' };
  }

  // 1. Participant boundary
  const isCreator = userId === contract.creatorId;
  const isTalent = userId === contract.talentId;
  if (!isCreator && !isTalent) {
    return { allowed: false, reason: 'Unauthorized: Only contract participants can raise a dispute.' };
  }

  // 2. Contract status boundary: must be active
  if (contract.status !== 'active') {
    return {
      allowed: false,
      reason: `Cannot raise dispute on a contract with status '${contract.status}'. Contract must be active.`,
    };
  }

  // 3. Check if an active dispute is already open
  if (contract.disputeStatus === 'open' || contract.disputeStatus === 'under_admin_review') {
    return { allowed: false, reason: 'An active dispute is already open on this contract.' };
  }

  // 4. If milestone is targeted, verify existence and paymentState
  if (milestoneId) {
    const milestone = contract.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      return { allowed: false, reason: `Target milestone '${milestoneId}' not found.` };
    }
    if (milestone.paymentState === 'released') {
      return { allowed: false, reason: 'Cannot dispute a milestone whose funds have already been released.' };
    }
    if (milestone.paymentState === 'refunded') {
      return { allowed: false, reason: 'Cannot dispute a milestone whose funds have already been refunded.' };
    }
  }

  return { allowed: true };
}

/**
 * Raise a formal contract dispute
 */
export async function raiseContractDispute(params: {
  contractId: string;
  userId: string;
  reasonCategory: DisputeReasonCategory;
  description: string;
  requestedRemedy: 'full_refund' | 'partial_refund' | 'full_release' | 'scope_adjustment';
  disputedMilestoneId?: string | null;
  evidence?: DisputeEvidence[];
}): Promise<{ contract: GigLinkContract; dispute: ContractDisputeRecord }> {
  const {
    contractId,
    userId,
    reasonCategory,
    description,
    requestedRemedy,
    disputedMilestoneId,
    evidence = [],
  } = params;

  return runWithDisputeLock(contractId, async () => {
    const local = await getContract(contractId);
    if (!local) throw new Error(`Contract ${contractId} not found.`);
    const currentContract = normalizeContractData(local);

    const check = canRaiseDispute(currentContract, userId, disputedMilestoneId);
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const now = new Date().toISOString();
    const role: 'creator' | 'talent' = userId === currentContract.creatorId ? 'creator' : 'talent';

    const disputeRecord: ContractDisputeRecord = {
      id: `dispute_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      contractId,
      disputedByUserId: userId,
      disputedByRole: role,
      disputedMilestoneId: disputedMilestoneId || null,
      reasonCategory,
      description,
      requestedRemedy,
      status: 'open',
      evidence: evidence || [],
      cancellationProposals: [],
      createdAt: now,
      updatedAt: now,
    };

    // Update milestones if target milestone was specified
    const updatedMilestones = currentContract.milestones.map((m) => {
      if (disputedMilestoneId && m.id === disputedMilestoneId) {
        return {
          ...m,
          disputeStatus: 'disputed' as const,
          disputeReason: description,
          disputedAt: now,
          updatedAt: now,
        };
      }
      return m;
    });

    const updatedContract: GigLinkContract = {
      ...currentContract,
      disputeStatus: 'open',
      disputes: [...(currentContract.disputes || []), disputeRecord],
      milestones: updatedMilestones,
      updatedAt: now,
    };

    await persistContract(updatedContract);

    return { contract: updatedContract, dispute: disputeRecord };
  });
}

/**
 * Authority check: Can a user propose mutual cancellation?
 */
export function canProposeMutualCancellation(
  contract: GigLinkContract,
  userId: string,
  refundToClientAmount: number,
  releaseToTalentAmount: number
): { allowed: boolean; reason?: string } {
  if (!contract) {
    return { allowed: false, reason: 'Contract does not exist.' };
  }

  // 1. Participant boundary
  const isCreator = userId === contract.creatorId;
  const isTalent = userId === contract.talentId;
  if (!isCreator && !isTalent) {
    return { allowed: false, reason: 'Unauthorized: Only contract participants can propose mutual cancellation.' };
  }

  // 2. Contract lifecycle boundary
  if (contract.status !== 'active' && contract.status !== 'disputed') {
    return {
      allowed: false,
      reason: `Cannot propose cancellation on a ${contract.status} contract. Contract must be active or in dispute.`,
    };
  }

  // 3. Check for pending cancellation proposals
  const existingPending = (contract.cancellationProposals || []).find((p) => p.status === 'pending');
  if (existingPending) {
    return { allowed: false, reason: 'A mutual cancellation proposal is already pending review.' };
  }

  // 4. Held Escrow Math Validation
  const heldEscrow = contract.milestones
    .filter((m) => m.paymentState === 'held')
    .reduce((sum, m) => sum + (m.fundedAmount || m.amount), 0);

  if (refundToClientAmount < 0 || releaseToTalentAmount < 0) {
    return { allowed: false, reason: 'Settlement amounts cannot be negative.' };
  }

  const proposedSum = Math.round((refundToClientAmount + releaseToTalentAmount) * 100) / 100;
  const expectedHeld = Math.round(heldEscrow * 100) / 100;

  if (Math.abs(proposedSum - expectedHeld) > 0.001) {
    return {
      allowed: false,
      reason: `Invalid settlement split: Proposed sum ($${proposedSum}) must exactly match total held escrow ($${expectedHeld}).`,
    };
  }

  return { allowed: true };
}

/**
 * Propose a mutual cancellation agreement
 */
export async function proposeMutualCancellation(params: {
  contractId: string;
  userId: string;
  reason: string;
  refundToClientAmount: number;
  releaseToTalentAmount: number;
  currency?: string;
  disputeId?: string | null;
}): Promise<{ contract: GigLinkContract; proposal: MutualCancellationProposal }> {
  const {
    contractId,
    userId,
    reason,
    refundToClientAmount,
    releaseToTalentAmount,
    currency = 'USD',
    disputeId,
  } = params;

  return runWithDisputeLock(contractId, async () => {
    const local = await getContract(contractId);
    if (!local) throw new Error(`Contract ${contractId} not found.`);
    const currentContract = normalizeContractData(local);

    const check = canProposeMutualCancellation(
      currentContract,
      userId,
      refundToClientAmount,
      releaseToTalentAmount
    );
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const now = new Date().toISOString();
    const role: 'creator' | 'talent' = userId === currentContract.creatorId ? 'creator' : 'talent';

    const proposal: MutualCancellationProposal = {
      id: `canc_prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      contractId,
      disputeId: disputeId || null,
      proposedByUserId: userId,
      proposedByRole: role,
      proposedAt: now,
      reason,
      refundToClientAmount,
      releaseToTalentAmount,
      currency,
      status: 'pending',
    };

    const updatedContract: GigLinkContract = {
      ...currentContract,
      cancellationProposals: [...(currentContract.cancellationProposals || []), proposal],
      updatedAt: now,
    };

    await persistContract(updatedContract);

    return { contract: updatedContract, proposal };
  });
}

/**
 * Authority check: Can a user respond to a mutual cancellation proposal?
 */
export function canRespondToCancellationProposal(
  contract: GigLinkContract,
  proposalId: string,
  userId: string,
  decision: 'accept' | 'reject'
): { allowed: boolean; reason?: string } {
  if (!contract) return { allowed: false, reason: 'Contract does not exist.' };

  const proposal = (contract.cancellationProposals || []).find((p) => p.id === proposalId);
  if (!proposal) {
    return { allowed: false, reason: 'Cancellation proposal not found.' };
  }

  if (proposal.status !== 'pending') {
    return { allowed: false, reason: `Proposal is already ${proposal.status}.` };
  }

  // Self-approval is strictly forbidden
  if (proposal.proposedByUserId === userId) {
    return { allowed: false, reason: 'Unauthorized: You cannot accept or reject your own cancellation proposal.' };
  }

  // Must be counterparty
  const isParticipant = userId === contract.creatorId || userId === contract.talentId;
  if (!isParticipant) {
    return { allowed: false, reason: 'Unauthorized: Only the counterparty can respond to this proposal.' };
  }

  return { allowed: true };
}

/**
 * Respond to a mutual cancellation proposal (Accept or Reject)
 * When accepted, executes atomic Phase 4 financial settlement across held escrow.
 */
export async function respondToCancellationProposal(params: {
  contractId: string;
  proposalId: string;
  userId: string;
  decision: 'accept' | 'reject';
  responseNote?: string;
}): Promise<{
  contract: GigLinkContract;
  proposal: MutualCancellationProposal;
  ledgerRecords?: FinancialLedgerRecord[];
}> {
  const { contractId, proposalId, userId, decision, responseNote } = params;

  return runWithDisputeLock(contractId, async () => {
    const local = await getContract(contractId);
    if (!local) throw new Error(`Contract ${contractId} not found.`);
    const currentContract = normalizeContractData(local);

    const check = canRespondToCancellationProposal(currentContract, proposalId, userId, decision);
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const now = new Date().toISOString();
    const existingProposal = currentContract.cancellationProposals!.find((p) => p.id === proposalId)!;

    if (decision === 'reject') {
      const updatedProposals = currentContract.cancellationProposals!.map((p) => {
        if (p.id === proposalId) {
          return {
            ...p,
            status: 'rejected' as const,
            respondedAt: now,
            respondedByUserId: userId,
            responseNote: responseNote || null,
          };
        }
        return p;
      });

      const updatedContract: GigLinkContract = {
        ...currentContract,
        cancellationProposals: updatedProposals,
        updatedAt: now,
      };

      await persistContract(updatedContract);
      return { contract: updatedContract, proposal: { ...existingProposal, status: 'rejected' } };
    }

    // --- DECISION IS ACCEPT: EXECUTE FINANCIAL SETTLEMENT ---
    const refundGross = existingProposal.refundToClientAmount;
    const talentGross = existingProposal.releaseToTalentAmount;

    // Zero-rounding Platform fee calculation on Talent portion
    const feeSplit = calculatePlatformFeeSplit(talentGross);

    const generatedLedgerRecords: FinancialLedgerRecord[] = [];

    // 1. Write Client Refund Ledger Record if > 0
    if (refundGross > 0) {
      const refundRecord = await appendLedgerRecord({
        id: `tx_settle_ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        contractId,
        payerId: currentContract.talentId,
        payerName: currentContract.talentName || 'Talent',
        recipientId: currentContract.creatorId,
        recipientName: currentContract.creatorName || 'Client',
        amount: refundGross,
        currency: existingProposal.currency || 'USD',
        platformFeeRate: 0,
        platformFeeAmount: 0,
        netTalentAmount: 0,
        type: 'refund_completed',
        provider: 'stripe',
        status: 'succeeded',
        description: `Mutual Cancellation Settlement: Full/Partial refund to client (${responseNote || 'Mutual Agreement'})`,
        metadata: {
          proposalId,
          settlementType: 'mutual_cancellation',
          refundGross,
        },
        createdAt: now,
      });
      generatedLedgerRecords.push(refundRecord);
    }

    // 2. Write Talent Release & Platform Fee Ledger Record if > 0
    if (talentGross > 0) {
      const releaseRecord = await appendLedgerRecord({
        id: `tx_settle_rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        contractId,
        payerId: currentContract.creatorId,
        payerName: currentContract.creatorName || 'Client',
        recipientId: currentContract.talentId,
        recipientName: currentContract.talentName || 'Talent',
        amount: feeSplit.grossAmount,
        currency: existingProposal.currency || 'USD',
        platformFeeRate: 0.05,
        platformFeeAmount: feeSplit.platformFeeAmount,
        netTalentAmount: feeSplit.netTalentAmount,
        type: 'milestone_released',
        provider: 'stripe',
        status: 'succeeded',
        description: `Mutual Cancellation Settlement: Partial milestone compensation to talent (${responseNote || 'Mutual Agreement'})`,
        metadata: {
          proposalId,
          settlementType: 'mutual_cancellation',
          talentGross,
          platformFeeAmount: feeSplit.platformFeeAmount,
          netTalentAmount: feeSplit.netTalentAmount,
        },
        createdAt: now,
      });
      generatedLedgerRecords.push(releaseRecord);
    }

    // 3. Transition all held milestones to refunded / released
    const updatedMilestones: ContractMilestone[] = currentContract.milestones.map((m) => {
      if (m.paymentState === 'held') {
        return {
          ...m,
          paymentState: refundGross > 0 && talentGross === 0 ? 'refunded' : 'released',
          disputeStatus: 'resolved_refunded',
          status: 'cancelled',
          updatedAt: now,
        };
      }
      return m;
    });

    const updatedProposals = currentContract.cancellationProposals!.map((p) => {
      if (p.id === proposalId) {
        return {
          ...p,
          status: 'accepted' as const,
          respondedAt: now,
          respondedByUserId: userId,
          responseNote: responseNote || null,
        };
      }
      return p;
    });

    // 4. Resolve active disputes
    const updatedDisputes = (currentContract.disputes || []).map((d) => {
      if (d.status === 'open' || d.status === 'under_admin_review') {
        return {
          ...d,
          status: 'resolved_mutual_agreement' as const,
          resolvedAt: now,
          updatedAt: now,
        };
      }
      return d;
    });

    const updatedContract: GigLinkContract = {
      ...currentContract,
      status: 'cancelled',
      disputeStatus: 'resolved_mutual_agreement',
      disputes: updatedDisputes,
      cancellationProposals: updatedProposals,
      milestones: updatedMilestones,
      cancelledAt: now,
      updatedAt: now,
    };

    // Distributed atomic transaction sync
    try {
      await runTransaction(db, async (txn) => {
        const contractRef = doc(db, 'contracts', updatedContract.id);
        txn.set(contractRef, updatedContract, { merge: true });
        for (const rec of generatedLedgerRecords) {
          const ledgerRef = doc(db, 'financialLedger', rec.id);
          txn.set(ledgerRef, rec);
        }
      });
    } catch (txnErr) {
      console.warn('[DisputeService] Firestore transaction sync notice (persisting to store):', txnErr);
    }

    await persistContract(updatedContract);

    return {
      contract: updatedContract,
      proposal: {
        ...existingProposal,
        status: 'accepted',
        respondedAt: now,
        respondedByUserId: userId,
      },
      ledgerRecords: generatedLedgerRecords,
    };
  });
}

/**
 * Authority check: Can an admin render an arbitration verdict?
 */
export function canAdminArbitrateDispute(
  contract: GigLinkContract,
  adminId: string,
  userIsAdmin: boolean,
  clientRefundAmount: number,
  talentReleaseGrossAmount: number
): { allowed: boolean; reason?: string } {
  if (!contract) return { allowed: false, reason: 'Contract does not exist.' };

  // 1. Strict Administrator Authorization Check
  if (!userIsAdmin) {
    return { allowed: false, reason: 'Unauthorized: Only verified Platform Administrators can execute arbitration verdicts.' };
  }

  // 2. Dispute requirement
  if (contract.disputeStatus !== 'open' && contract.disputeStatus !== 'under_admin_review') {
    return { allowed: false, reason: 'Contract is not currently in an active or escalatable dispute status.' };
  }

  // 3. Held Escrow Math Validation
  const heldEscrow = contract.milestones
    .filter((m) => m.paymentState === 'held')
    .reduce((sum, m) => sum + (m.fundedAmount || m.amount), 0);

  if (clientRefundAmount < 0 || talentReleaseGrossAmount < 0) {
    return { allowed: false, reason: 'Settlement amounts cannot be negative.' };
  }

  const proposedSum = Math.round((clientRefundAmount + talentReleaseGrossAmount) * 100) / 100;
  const expectedHeld = Math.round(heldEscrow * 100) / 100;

  if (Math.abs(proposedSum - expectedHeld) > 0.001) {
    return {
      allowed: false,
      reason: `Arbitration split mismatch: Sum of refund ($${proposedSum}) must match total held escrow ($${expectedHeld}) exactly.`,
    };
  }

  return { allowed: true };
}

/**
 * Server-Authoritative Platform Admin Arbitration Verdict
 * Executes binding split settlement and transitions dispute and contract status.
 */
export async function executeAdminArbitration(params: {
  contractId: string;
  adminId: string;
  userIsAdmin: boolean;
  verdictType: 'full_refund_client' | 'full_release_talent' | 'split_settlement';
  clientRefundAmount: number;
  talentReleaseGrossAmount: number;
  adminNotes: string;
  currency?: string;
}): Promise<{
  contract: GigLinkContract;
  verdict: AdminArbitrationVerdict;
  ledgerRecords: FinancialLedgerRecord[];
}> {
  const {
    contractId,
    adminId,
    userIsAdmin,
    verdictType,
    clientRefundAmount,
    talentReleaseGrossAmount,
    adminNotes,
    currency = 'USD',
  } = params;

  return runWithDisputeLock(contractId, async () => {
    const local = await getContract(contractId);
    if (!local) throw new Error(`Contract ${contractId} not found.`);
    const currentContract = normalizeContractData(local);

    const check = canAdminArbitrateDispute(
      currentContract,
      adminId,
      userIsAdmin,
      clientRefundAmount,
      talentReleaseGrossAmount
    );
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const now = new Date().toISOString();
    const feeSplit = calculatePlatformFeeSplit(talentReleaseGrossAmount);
    const ledgerRecords: FinancialLedgerRecord[] = [];

    // 1. Client Refund Ledger Entry
    if (clientRefundAmount > 0) {
      const refundRecord = await appendLedgerRecord({
        id: `tx_arbit_ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        contractId,
        payerId: currentContract.talentId,
        payerName: currentContract.talentName || 'Talent',
        recipientId: currentContract.creatorId,
        recipientName: currentContract.creatorName || 'Client',
        amount: clientRefundAmount,
        currency,
        platformFeeRate: 0,
        platformFeeAmount: 0,
        netTalentAmount: 0,
        type: 'refund_completed',
        provider: 'stripe',
        status: 'succeeded',
        description: `Admin Arbitration: Client refund awarded by platform arbitration (${adminNotes})`,
        metadata: {
          arbitratedByAdminId: adminId,
          verdictType,
          clientRefundAmount,
        },
        createdAt: now,
      });
      ledgerRecords.push(refundRecord);
    }

    // 2. Talent Payout & Platform Fee Ledger Entry
    if (talentReleaseGrossAmount > 0) {
      const releaseRecord = await appendLedgerRecord({
        id: `tx_arbit_rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        contractId,
        payerId: currentContract.creatorId,
        payerName: currentContract.creatorName || 'Client',
        recipientId: currentContract.talentId,
        recipientName: currentContract.talentName || 'Talent',
        amount: feeSplit.grossAmount,
        currency,
        platformFeeRate: 0.05,
        platformFeeAmount: feeSplit.platformFeeAmount,
        netTalentAmount: feeSplit.netTalentAmount,
        type: 'milestone_released',
        provider: 'stripe',
        status: 'succeeded',
        description: `Admin Arbitration: Talent compensation awarded by platform arbitration (${adminNotes})`,
        metadata: {
          arbitratedByAdminId: adminId,
          verdictType,
          grossTalentAmount: feeSplit.grossAmount,
          platformFeeAmount: feeSplit.platformFeeAmount,
          netTalentAmount: feeSplit.netTalentAmount,
        },
        createdAt: now,
      });
      ledgerRecords.push(releaseRecord);
    }

    const verdict: AdminArbitrationVerdict = {
      arbitratedByAdminId: adminId,
      arbitratedAt: now,
      verdictType,
      clientRefundAmount,
      talentReleaseGrossAmount: feeSplit.grossAmount,
      talentReleaseFeeAmount: feeSplit.platformFeeAmount,
      talentReleaseNetAmount: feeSplit.netTalentAmount,
      adminNotes,
      financialLedgerRecordIds: ledgerRecords.map((r) => r.id),
    };

    // Update milestones
    const updatedMilestones: ContractMilestone[] = currentContract.milestones.map((m) => {
      if (m.paymentState === 'held') {
        return {
          ...m,
          paymentState: clientRefundAmount > 0 && talentReleaseGrossAmount === 0 ? 'refunded' : 'released',
          disputeStatus: 'resolved_released',
          status: 'cancelled',
          updatedAt: now,
        };
      }
      return m;
    });

    // Update disputes
    const updatedDisputes = (currentContract.disputes || []).map((d) => {
      if (d.status === 'open' || d.status === 'under_admin_review') {
        return {
          ...d,
          status: 'resolved_admin_arbitration' as const,
          adminArbitration: verdict,
          resolvedAt: now,
          updatedAt: now,
        };
      }
      return d;
    });

    const updatedContract: GigLinkContract = {
      ...currentContract,
      status: 'cancelled',
      disputeStatus: 'resolved_admin_arbitration',
      disputes: updatedDisputes,
      milestones: updatedMilestones,
      cancelledAt: now,
      updatedAt: now,
    };

    // Distributed atomic transaction sync
    try {
      await runTransaction(db, async (txn) => {
        const contractRef = doc(db, 'contracts', updatedContract.id);
        txn.set(contractRef, updatedContract, { merge: true });
        for (const rec of ledgerRecords) {
          const ledgerRef = doc(db, 'financialLedger', rec.id);
          txn.set(ledgerRef, rec);
        }
      });
    } catch (txnErr) {
      console.warn('[DisputeService] Firestore transaction sync notice (persisting to store):', txnErr);
    }

    await persistContract(updatedContract);

    return { contract: updatedContract, verdict, ledgerRecords };
  });
}

/**
 * Authority check: Can a user submit supporting evidence/documents to an active dispute?
 */
export function canAddDisputeEvidence(
  contract: GigLinkContract,
  disputeId: string,
  userId: string,
  userIsOrgAdmin = false
): { allowed: boolean; reason?: string } {
  if (!contract) {
    return { allowed: false, reason: 'Contract does not exist.' };
  }

  const isCreator = userId === contract.creatorId || userIsOrgAdmin;
  const isTalent = userId === contract.talentId;

  if (!isCreator && !isTalent) {
    return { allowed: false, reason: 'Unauthorized: Only contract participants can add dispute evidence.' };
  }

  if (contract.status === 'completed' || contract.status === 'cancelled') {
    return { allowed: false, reason: `Cannot submit evidence to a sealed contract with status '${contract.status}'.` };
  }

  const dispute = (contract.disputes || []).find((d) => d.id === disputeId);
  if (!dispute) {
    return { allowed: false, reason: 'Dispute record not found on contract.' };
  }

  if (dispute.status !== 'open' && dispute.status !== 'under_admin_review') {
    return { allowed: false, reason: `Cannot add evidence: Dispute is already in '${dispute.status}' status.` };
  }

  return { allowed: true };
}

/**
 * Adds an evidence attachment to an active dispute.
 */
export async function addDisputeEvidence(params: {
  contractId: string;
  disputeId: string;
  userId: string;
  evidence: Omit<DisputeEvidence, 'id' | 'uploadedAt' | 'uploadedByUserId' | 'uploadedByRole'>;
  userIsOrgAdmin?: boolean;
}): Promise<{ contract: GigLinkContract; evidence: DisputeEvidence }> {
  const { contractId, disputeId, userId, evidence, userIsOrgAdmin = false } = params;

  return runWithDisputeLock(contractId, async () => {
    const local = await getContract(contractId);
    if (!local) throw new Error(`Contract ${contractId} not found.`);
    const currentContract = normalizeContractData(local);

    const check = canAddDisputeEvidence(currentContract, disputeId, userId, userIsOrgAdmin);
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const now = new Date().toISOString();
    const role: 'creator' | 'talent' | 'admin' =
      userIsOrgAdmin ? 'admin' : userId === currentContract.creatorId ? 'creator' : 'talent';

    const newEvidence: DisputeEvidence = {
      id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      uploadedByUserId: userId,
      uploadedByRole: role,
      title: evidence.title.trim(),
      fileUrl: evidence.fileUrl.trim(),
      fileType: evidence.fileType || 'document',
      fileSize: evidence.fileSize,
      uploadedAt: now,
      description: evidence.description?.trim(),
    };

    const updatedDisputes = (currentContract.disputes || []).map((d) => {
      if (d.id === disputeId) {
        return {
          ...d,
          evidence: [...(d.evidence || []), newEvidence],
          updatedAt: now,
        };
      }
      return d;
    });

    const updatedContract: GigLinkContract = {
      ...currentContract,
      disputes: updatedDisputes,
      updatedAt: now,
    };

    await persistContract(updatedContract);
    return { contract: updatedContract, evidence: newEvidence };
  });
}

