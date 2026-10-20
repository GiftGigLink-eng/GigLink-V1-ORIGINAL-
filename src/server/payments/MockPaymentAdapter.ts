/**
 * Mock / Test Payment Adapter (Phase C-1 Testing Architecture)
 *
 * Explicit test adapter strictly isolated from production behavior.
 * Provider is explicitly 'test' (never silently masquerading as live Stripe or Paystack).
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
import { calculatePlatformFee } from '../../lib/financialService';

export class MockPaymentAdapter implements PaymentAdapter {
  public readonly provider: PaymentProvider = 'test';
  public readonly isConfigured: boolean = true;

  // Audit history for test assertions
  public initializedIntents: ProviderPaymentIntent[] = [];
  public executedPayouts: PayoutParams[] = [];
  public executedRefunds: RefundParams[] = [];

  // Test simulation hooks
  public simulatePayoutTimeout: boolean = false;
  public simulatePayoutFailureReason: string | null = null;
  public simulateServerCrashAfterPayout: boolean = false;

  public async initializePayment(params: PaymentInitParams): Promise<ProviderPaymentIntent> {
    const { contractId, milestoneId, amount, currency, clientId, talentId } = params;
    const { platformFeeAmount, netTalentAmount } = calculatePlatformFee(amount);
    const mockRef = `test_pi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const intent: ProviderPaymentIntent = {
      provider: 'test',
      providerTransactionReference: mockRef,
      paymentReference: mockRef,
      currency: currency.toUpperCase(),
      grossAmount: amount,
      platformFee: platformFeeAmount,
      partnerAmount: netTalentAmount,
      status: 'pending',
      contractId,
      milestoneId,
      clientId,
      talentId,
      clientSecret: `${mockRef}_secret_test`,
      createdAt: now,
      updatedAt: now,
    };

    this.initializedIntents.push(intent);
    return intent;
  }

  public async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    if (params.paymentReference === 'invalid_reference' || params.paymentReference === 'failed_ref') {
      return {
        status: 'failed',
        amount: 0,
        currency: 'USD',
        providerTransactionReference: params.paymentReference,
      };
    }
    const found = this.initializedIntents.find(
      (i) => i.paymentReference === params.paymentReference || i.providerTransactionReference === params.paymentReference
    );
    return {
      status: 'succeeded',
      amount: found ? found.grossAmount : 1000,
      currency: found ? found.currency : 'USD',
      providerTransactionReference: params.paymentReference,
    };
  }

  public async createPayoutAccount(params: PayoutAccountParams): Promise<TalentPayoutAccount> {
    const now = new Date().toISOString();
    return {
      userId: params.userId,
      provider: 'test',
      providerAccountReference: `test_acct_${params.userId}`,
      country: params.country.toUpperCase(),
      currency: params.currency.toUpperCase(),
      status: 'ready',
      payoutsEnabled: true,
      chargesEnabled: true,
      detailsSubmitted: true,
      createdAt: now,
      updatedAt: now,
      stripeAccountId: `test_acct_${params.userId}`,
      defaultCurrency: params.currency.toUpperCase(),
    };
  }

  public async createAccountOnboardingLink(params: {
    userId: string;
    accountReference: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string }> {
    return { url: `https://test.giglink.network/onboarding?user=${params.userId}` };
  }

  public async executePayout(params: PayoutParams): Promise<PayoutResult> {
    this.executedPayouts.push(params);
    const stableRef =
      params.payoutReference ||
      (params.attempt && params.attempt > 1
        ? `pstk_trf_${params.contractId}_${params.milestoneId}_att${params.attempt}`
        : `pstk_trf_${params.contractId}_${params.milestoneId}`);

    if (this.simulatePayoutTimeout) {
      return {
        payoutId: stableRef,
        status: 'pending',
        isTimeout: true,
        error: 'Simulated payment provider transport timeout during transfer execution.',
      };
    }

    if (this.simulatePayoutFailureReason) {
      return {
        payoutId: stableRef,
        status: 'failed',
        error: this.simulatePayoutFailureReason,
      };
    }

    return {
      payoutId: stableRef,
      status: 'succeeded',
    };
  }

  public async verifyPayout(reference: string): Promise<PayoutResult> {
    const found = this.executedPayouts.find(
      (p) =>
        p.payoutReference === reference ||
        `pstk_trf_${p.contractId}_${p.milestoneId}` === reference
    );

    if (this.simulatePayoutFailureReason) {
      return {
        payoutId: reference,
        status: 'failed',
        error: this.simulatePayoutFailureReason,
      };
    }

    return {
      payoutId: reference,
      status: found ? 'succeeded' : 'pending',
    };
  }

  public async executeRefund(params: RefundParams): Promise<RefundResult> {
    this.executedRefunds.push(params);
    return {
      refundId: `test_refund_${Date.now()}`,
      status: 'succeeded',
    };
  }

  public verifyWebhookSignature(
    rawBody: Buffer | string,
    signature: string,
    secret?: string
  ): { valid: boolean; event?: any; error?: string } {
    if (signature === 'invalid_signature') {
      return { valid: false, error: 'Invalid mock test signature.' };
    }
    return {
      valid: true,
      event: { id: 'evt_test_123', type: 'payment_intent.succeeded' },
    };
  }

  public parseWebhookEvent(
    rawBody: Buffer | string,
    signature: string,
    secret?: string
  ): { valid: boolean; normalizedEvent?: NormalizedWebhookEvent; error?: string } {
    return {
      valid: true,
      normalizedEvent: {
        eventId: 'evt_test_123',
        eventType: 'payment_intent.succeeded',
        provider: 'test',
        status: 'succeeded',
      },
    };
  }
}
