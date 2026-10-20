/**
 * Provider-Neutral Payment & Escrow Domain Types (Phase C-1)
 *
 * Establishes a clean architectural boundary for multi-provider settlement:
 * GigLink -> Payment Orchestrator -> PaymentAdapter -> [StripeConnect, Paystack]
 */

export type PaymentProvider = 'stripe' | 'paystack' | 'test';

export type PaymentOperationStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';

/**
 * Production Payment & Escrow State Machine
 * Extends the baseline ('unfunded' | 'held' | 'released' | 'refunded')
 * with granular operational lifecycle states.
 */
export type MilestoneEscrowState =
  | 'unfunded'
  | 'funding_pending'
  | 'held'
  | 'funding_failed'
  | 'release_pending'
  | 'released'
  | 'payout_pending'
  | 'paid_out'
  | 'payout_failed'
  | 'refund_pending'
  | 'refunded';

/**
 * Provider-Neutral Payout Account Status
 */
export type PayoutAccountStatus =
  | 'not_configured'
  | 'pending_verification'
  | 'ready'
  | 'processing'
  | 'paid';

/**
 * Provider-Neutral Talent Payout Account Model
 * Server-authoritative: client may request onboarding, but the server
 * controls provider identity metadata.
 */
export interface TalentPayoutAccount {
  userId: string;
  provider: PaymentProvider;
  providerAccountReference: string; // e.g. Stripe acct_xxx or Paystack recipient/subaccount
  country: string;
  currency: string;
  status: PayoutAccountStatus;
  payoutsEnabled: boolean;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;
  createdAt: string;
  updatedAt: string;
  // Backward-compatibility aliases for legacy Stripe callers
  stripeAccountId?: string;
  defaultCurrency?: string;
}

/**
 * Provider-Neutral Payment Intent / Escrow Funding Metadata
 */
export interface ProviderPaymentIntent {
  provider: PaymentProvider;
  providerTransactionReference: string;
  paymentReference: string;
  currency: string;
  grossAmount: number;
  platformFee: number;
  partnerAmount: number;
  status: PaymentOperationStatus;
  contractId: string;
  milestoneId: string;
  clientId: string;
  talentId: string;
  clientSecret?: string;
  authorizationUrl?: string; // For Paystack redirect / checkout flows
  createdAt: string;
  updatedAt: string;
}

export interface PaymentInitParams {
  contractId: string;
  milestoneId: string;
  amount: number;
  currency: string;
  clientId: string;
  clientName: string;
  talentId: string;
  talentName: string;
}

export interface PaymentVerifyParams {
  paymentReference: string;
  contractId: string;
  milestoneId: string;
}

export interface PaymentVerifyResult {
  status: 'succeeded' | 'pending' | 'failed';
  amount: number;
  currency: string;
  providerTransactionReference: string;
}

export interface PayoutAccountParams {
  userId: string;
  country: string;
  currency: string;
  accountNumber?: string;
  bankCode?: string;
  accountName?: string;
}

export interface PayoutParams {
  contractId: string;
  milestoneId: string;
  amount: number;
  currency: string;
  talentId: string;
  destinationAccountReference: string;
  sourceTransactionReference?: string;
  payoutReference?: string;
  attempt?: number;
}

export interface PayoutResult {
  payoutId: string;
  status: 'pending' | 'succeeded' | 'failed';
  error?: string;
  isTimeout?: boolean;
}

export interface RefundParams {
  transactionReference: string;
  amount?: number;
  reason?: string;
}

export interface RefundResult {
  refundId: string;
  status: 'pending' | 'succeeded' | 'failed';
}

export interface NormalizedWebhookEvent {
  eventId: string;
  eventType: string;
  provider: PaymentProvider;
  contractId?: string;
  milestoneId?: string;
  paymentReference?: string;
  status: 'succeeded' | 'failed' | 'pending';
  amount?: number;
  currency?: string;
}

/**
 * Provider-Neutral Payment Adapter Interface
 */
export interface PaymentAdapter {
  readonly provider: PaymentProvider;
  readonly isConfigured: boolean;

  initializePayment(params: PaymentInitParams): Promise<ProviderPaymentIntent>;
  verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult>;
  createPayoutAccount(params: PayoutAccountParams): Promise<TalentPayoutAccount>;
  createAccountOnboardingLink(params: {
    userId: string;
    accountReference: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string }>;
  executePayout(params: PayoutParams): Promise<PayoutResult>;
  verifyPayout?(reference: string): Promise<PayoutResult>;
  executeRefund(params: RefundParams): Promise<RefundResult>;
  verifyWebhookSignature(
    rawBody: Buffer | string,
    signature: string,
    secret?: string
  ): { valid: boolean; event?: any; error?: string };
  parseWebhookEvent(
    rawBody: Buffer | string,
    signature: string,
    secret?: string
  ): { valid: boolean; normalizedEvent?: NormalizedWebhookEvent; error?: string };
}
