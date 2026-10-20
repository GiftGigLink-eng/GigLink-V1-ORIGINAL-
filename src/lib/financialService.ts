/**
 * Financial Ledger & Escrow Platform Configuration for GigLink V1
 */

import { ContractMilestone, ContractFinancialSummary, GigLinkContract, FinancialLedgerRecord } from '../types';

/**
 * Standard platform fee percentage for GigLink V1.
 * Platform fee is 5% of gross milestone compensation.
 */
export const PLATFORM_FEE_RATE = 0.05;

/**
 * Calculates the platform fee amount and net talent amount deterministically.
 */
export function calculatePlatformFee(grossAmount: number, customFeeRate: number = PLATFORM_FEE_RATE): {
  platformFeeRate: number;
  platformFeeAmount: number;
  netTalentAmount: number;
} {
  const safeGross = Math.max(0, Number(grossAmount) || 0);
  const safeRate = Math.max(0, Math.min(1, Number(customFeeRate) || PLATFORM_FEE_RATE));
  
  // Calculate round to 2 decimal places
  const platformFeeAmount = Math.round(safeGross * safeRate * 100) / 100;
  const netTalentAmount = Math.round((safeGross - platformFeeAmount) * 100) / 100;

  return {
    platformFeeRate: safeRate,
    platformFeeAmount,
    netTalentAmount,
  };
}

/**
 * Derives a comprehensive financial summary for a contract.
 */
export function deriveContractFinancialSummary(
  contract: GigLinkContract,
  ledgerRecords: FinancialLedgerRecord[] = []
): ContractFinancialSummary {
  const milestones = contract.milestones || [];
  const currency = contract.scopeLock?.currency || 'USD';
  
  const totalContractValue = contract.scopeLock?.totalAmount || 0;
  
  let totalFunded = 0;
  let totalReleased = 0;
  let totalHeldInEscrow = 0;
  let totalUnfunded = 0;
  let totalRefunded = 0;
  let totalPlatformFees = 0;
  let netTalentEarned = 0;
  let hasUnfundedActiveMilestones = false;
  let hasAdditionalFundingRequired = false;

  for (const m of milestones) {
    const amount = Number(m.amount) || 0;
    const fundedAmount = Number(m.fundedAmount ?? (m.paymentState === 'held' || m.paymentState === 'released' ? amount : 0));
    
    // Check if additional funding is required (e.g. after budget amendment)
    if (m.requiredFundingAmount && m.requiredFundingAmount > fundedAmount) {
      hasAdditionalFundingRequired = true;
    }

    if (m.paymentState === 'released' || m.paymentState === 'payout_pending' || m.paymentState === 'paid_out') {
      totalReleased += amount;
      totalFunded += amount;
      const { platformFeeAmount, netTalentAmount } = calculatePlatformFee(amount);
      totalPlatformFees += platformFeeAmount;
      netTalentEarned += netTalentAmount;
    } else if (m.paymentState === 'held' || m.paymentState === 'release_pending' || m.paymentState === 'refund_pending') {
      totalHeldInEscrow += amount;
      totalFunded += amount;
    } else if (m.paymentState === 'refunded') {
      totalRefunded += amount;
    } else {
      // unfunded, funding_pending, funding_failed, payout_failed
      totalUnfunded += amount;
      if (m.status === 'in_progress' || m.reviewState === 'pending_submission' || m.reviewState === 'submitted') {
        hasUnfundedActiveMilestones = true;
      }
    }
  }

  const isFullyFunded = totalUnfunded === 0 && totalFunded >= totalContractValue;
  const isFullySettled = totalUnfunded === 0 && totalHeldInEscrow === 0 && (totalReleased + totalRefunded) >= totalContractValue;

  return {
    totalContractValue,
    totalFunded,
    totalReleased,
    totalHeldInEscrow,
    totalUnfunded,
    totalRefunded,
    totalPlatformFees,
    netTalentEarned,
    currency,
    hasUnfundedActiveMilestones,
    hasAdditionalFundingRequired,
    isFullyFunded,
    isFullySettled,
  };
}

/**
 * Checks if a milestone is funded and held in escrow before work submission.
 */
export function isMilestoneEscrowFunded(milestone: ContractMilestone): boolean {
  return (
    milestone.paymentState === 'held' ||
    milestone.paymentState === 'release_pending' ||
    milestone.paymentState === 'released' ||
    milestone.paymentState === 'payout_pending' ||
    milestone.paymentState === 'paid_out'
  );
}

/**
 * Validates whether an action requires additional funding check.
 */
export function requiresAdditionalFunding(milestone: ContractMilestone): boolean {
  if (!milestone.requiredFundingAmount) return false;
  const currentFunded = milestone.fundedAmount || 0;
  return milestone.requiredFundingAmount > currentFunded;
}
