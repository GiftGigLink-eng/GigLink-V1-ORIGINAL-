/**
 * Stripe Connect Payment Adapter (Phase C-1 Architecture Boundary)
 *
 * Implements the provider-neutral PaymentAdapter interface for Stripe Connect.
 * In Phase C-1:
 * - Real provider operations (onboarding API calls, provider payouts, refunds, and live execution)
 *   are strictly prohibited.
 * - Fails closed under all runtime configurations.
 * - Preserves the complete PaymentAdapter contract for Phase C-2/C-3 activation.
 * - Does NOT fabricate simulated IDs in production path.
 */

import {
  PaymentAdapter,
  PaymentProvider,
  PaymentInitParams,
  PaymentVerifyParams,
  PaymentVerifyResult,
  PayoutAccountParams,
  PayoutParams,
  PayoutResult,
  RefundParams,
  RefundResult,
  ProviderPaymentIntent,
  TalentPayoutAccount,
  NormalizedWebhookEvent,
} from '../../types/payment';

export class StripeConnectAdapter implements PaymentAdapter {
  public readonly provider: PaymentProvider = 'stripe';

  public get isConfigured(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  private failClosed(operation: string): never {
    if (!this.isConfigured) {
      throw new Error(
        `Payment provider error: Stripe is not configured on the server. STRIPE_SECRET_KEY is missing. Operation '${operation}' failed closed.`
      );
    }
    throw new Error(
      `Payment provider error: Stripe Connect live operations are disabled in Phase C-1. Operation '${operation}' is pending Phase C-2/C-3 integration.`
    );
  }

  public async initializePayment(params: PaymentInitParams): Promise<ProviderPaymentIntent> {
    this.failClosed('initializePayment');
  }

  public async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    this.failClosed('verifyPayment');
  }

  public async createPayoutAccount(params: PayoutAccountParams): Promise<TalentPayoutAccount> {
    this.failClosed('createPayoutAccount');
  }

  public async createAccountOnboardingLink(params: {
    userId: string;
    accountReference: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string }> {
    this.failClosed('createAccountOnboardingLink');
  }

  public async executePayout(params: PayoutParams): Promise<PayoutResult> {
    this.failClosed('executePayout');
  }

  public async executeRefund(params: RefundParams): Promise<RefundResult> {
    this.failClosed('executeRefund');
  }

  public verifyWebhookSignature(
    rawBody: Buffer | string,
    signature: string,
    secret?: string
  ): { valid: boolean; event?: any; error?: string } {
    return {
      valid: false,
      error: 'Stripe webhook verification is pending Phase C-2 activation.',
    };
  }

  public parseWebhookEvent(
    rawBody: Buffer | string,
    signature: string,
    secret?: string
  ): { valid: boolean; normalizedEvent?: NormalizedWebhookEvent; error?: string } {
    return {
      valid: false,
      error: 'Stripe webhook parsing is pending Phase C-2 activation.',
    };
  }
}
