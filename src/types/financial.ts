/**
 * Financial & Escrow Data Structures for GigLink V1 (Phase 4)
 */

import {
  MilestoneEscrowState,
  TalentPayoutAccount,
  PaymentProvider,
} from './payment';

export type { MilestoneEscrowState, TalentPayoutAccount, PaymentProvider };

export type FinancialTransactionType =
  | 'milestone_funded'
  | 'escrow_held'
  | 'milestone_released'
  | 'payout_initiated'
  | 'payout_completed'
  | 'refund_initiated'
  | 'refund_completed'
  | 'platform_fee'
  | 'escrow_funding'
  | 'escrow_release'
  | 'escrow_refund'
  | 'payout_disbursement';

export type FinancialTransactionStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'held'
  | 'released'
  | 'refunded';

export type EscrowDisputeStatus = 'none' | 'disputed' | 'resolved_released' | 'resolved_refunded';

export type TalentPayoutStatus = 'not_configured' | 'pending_verification' | 'ready' | 'processing' | 'paid';

export interface MilestonePaymentDetails {
  amount: number;
  currency: string;
  paymentState: MilestoneEscrowState;
  fundedAt?: string | null;
  releasedAt?: string | null;
  refundedAt?: string | null;
  payerId?: string; // Client user ID
  payerName?: string;
  recipientId?: string; // Talent user ID
  recipientName?: string;

  // Provider-Neutral Settlement References
  paymentProvider?: PaymentProvider;
  providerPaymentReference?: string | null;
  providerPayoutReference?: string | null;
  providerRefundReference?: string | null;

  // Backward-compatibility aliases for legacy callers (deprecated)
  /** @deprecated Use providerPaymentReference */
  paymentIntentId?: string; // Provider Payment Intent ID / Reference
  /** @deprecated Use providerPayoutReference */
  transferId?: string; // Provider Payout / Transfer ID
  /** @deprecated Use providerRefundReference */
  refundId?: string; // Provider Refund ID

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
  provider: PaymentProvider | 'simulated_stripe';
  providerReference?: string | null; // Canonical provider reference
  providerPaymentReference?: string | null;
  providerPayoutReference?: string | null;
  providerRefundReference?: string | null;
  providerEventId?: string | null; // Webhook event ID for idempotency tracking
  status: FinancialTransactionStatus;
  description: string;
  failureReason?: string | null;
  platformFee?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  completedAt?: string | null;
}

/**
 * Provider-Neutral Webhook Event Persistence Record
 */
export interface ProviderWebhookEventRecord {
  id: string; // Unique provider event ID e.g. evt_12345 or paystack evt
  provider?: PaymentProvider;
  type: string;
  created: number;
  processedAt: string;
  status: 'processed' | 'ignored' | 'failed';
  contractId?: string;
  milestoneId?: string;
  transactionId?: string;
  error?: string | null;
  failureReason?: string | null;
}

/**
 * Backward-compatibility alias for Stripe webhook event records
 * @deprecated Use ProviderWebhookEventRecord
 */
export type StripeWebhookEventRecord = ProviderWebhookEventRecord;

/**
 * Backward-compatibility interface for legacy TalentStripeAccount callers
 * @deprecated Use TalentPayoutAccount from ./payment
 */
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
