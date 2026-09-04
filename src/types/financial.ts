/**
 * Financial & Escrow Data Structures for GigLink V1 (Phase 4)
 */

export type FinancialTransactionType =
  | 'milestone_funded'
  | 'escrow_held'
  | 'milestone_released'
  | 'payout_initiated'
  | 'payout_completed'
  | 'refund_initiated'
  | 'refund_completed'
  | 'platform_fee';

export type FinancialTransactionStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type EscrowDisputeStatus = 'none' | 'disputed' | 'resolved_released' | 'resolved_refunded';

export type TalentPayoutStatus = 'not_configured' | 'pending_verification' | 'ready' | 'processing' | 'paid';

export interface MilestonePaymentDetails {
  amount: number;
  currency: string;
  paymentState: 'unfunded' | 'held' | 'released' | 'refunded';
  fundedAt?: string | null;
  releasedAt?: string | null;
  refundedAt?: string | null;
  payerId?: string; // Client user ID
  payerName?: string;
  recipientId?: string; // Talent user ID
  recipientName?: string;
  paymentIntentId?: string; // Stripe PaymentIntent ID
  transferId?: string; // Stripe Transfer ID
  refundId?: string; // Stripe Refund ID
  disputeStatus?: EscrowDisputeStatus;
  disputeReason?: string | null;
  disputedAt?: string | null;
  fundedAmount?: number; // In case of partial or amended amount
  requiredFundingAmount?: number; // Total amount needed to satisfy current contract terms
}

export interface FinancialLedgerRecord {
  id: string; // Unique transaction / ledger ID
  contractId: string;
  milestoneId?: string | null;
  opportunityId?: string;
  payerId: string;
  payerName: string;
  recipientId: string;
  recipientName: string;
  amount: number; // Gross amount in currency units
  currency: string;
  platformFeeRate: number; // E.g. 0.05 for 5%
  platformFeeAmount: number; // E.g. 50
  netTalentAmount: number; // E.g. 950
  type: FinancialTransactionType;
  provider: 'stripe' | 'simulated_stripe';
  providerReference?: string | null; // PaymentIntent ID, Transfer ID, Refund ID, or charge ID
  providerEventId?: string | null; // Webhook event ID for idempotency tracking
  status: FinancialTransactionStatus;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
  completedAt?: string | null;
}

export interface StripeWebhookEventRecord {
  id: string; // Stripe event ID e.g. evt_12345
  type: string;
  created: number;
  processedAt: string;
  status: 'processed' | 'ignored' | 'failed';
  contractId?: string;
  milestoneId?: string;
  transactionId?: string;
  error?: string | null;
}

export interface TalentStripeAccount {
  userId: string;
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  defaultCurrency: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractFinancialSummary {
  totalContractValue: number;
  totalFunded: number;
  totalReleased: number;
  totalHeldInEscrow: number;
  totalUnfunded: number;
  totalRefunded: number;
  totalPlatformFees: number;
  netTalentEarned: number;
  currency: string;
  hasUnfundedActiveMilestones: boolean;
  hasAdditionalFundingRequired: boolean;
  isFullyFunded: boolean;
  isFullySettled: boolean;
}
