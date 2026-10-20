/**
 * GigLink Payment Orchestrator (Phase C-1 Architecture)
 *
 * Sits between Core GigLink Business Logic and Provider Adapters:
 * GigLink -> Payment Orchestrator -> PaymentAdapter -> [Stripe, Paystack, Mock]
 *
 * Authoritative boundaries:
 * 1. Coordinates provider adapters without hardcoding provider-specific logic.
 * 2. Enforces state transitions via Payment State Machine.
 * 3. Enforces server-side idempotency across funding, release, refund, and payouts.
 * 4. Strictly separates FUNDED from RELEASED and PAID_OUT.
 */

import {
  PaymentAdapter,
  PaymentProvider,
  ProviderPaymentIntent,
  PaymentInitParams,
  TalentPayoutAccount,
  PayoutAccountParams,
  PayoutParams,
  RefundParams,
} from '../../types/payment';
import { StripeConnectAdapter } from './StripeConnectAdapter';
import { PaystackAdapter } from './PaystackAdapter';
import { MockPaymentAdapter } from './MockPaymentAdapter';
import { assertValidPaymentStateTransition } from './paymentStateMachine';
import { calculatePlatformFee } from '../../lib/financialService';
import { GigLinkContract, ContractMilestone } from '../../types';
import { assertPaymentsActive } from './paymentSandboxGuard';

export class PaymentOrchestrator {
  private adapters: Map<PaymentProvider, PaymentAdapter> = new Map();
  private static instance: PaymentOrchestrator | null = null;

  constructor() {
    this.registerAdapter('stripe', new StripeConnectAdapter());
    this.registerAdapter('paystack', new PaystackAdapter());
    // In test environment, register mock adapter
    if (process.env.NODE_ENV === 'test') {
      this.registerAdapter('test', new MockPaymentAdapter());
    }
  }

  public static getInstance(): PaymentOrchestrator {
    if (!PaymentOrchestrator.instance) {
      PaymentOrchestrator.instance = new PaymentOrchestrator();
    }
    return PaymentOrchestrator.instance;
  }

  public registerAdapter(provider: PaymentProvider, adapter: PaymentAdapter): void {
    this.adapters.set(provider, adapter);
  }

  public getAdapter(provider: PaymentProvider = 'stripe'): PaymentAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Payment Orchestrator error: No adapter registered for provider '${provider}'.`);
    }
    return adapter;
  }

  /**
   * Resolves the appropriate payment adapter for a given contract and corridor.
   * In C-1, defaults to configured adapter without premature speculation.
   */
  public resolveAdapter(preferredProvider?: PaymentProvider): PaymentAdapter {
    if (preferredProvider && this.adapters.has(preferredProvider)) {
      return this.getAdapter(preferredProvider);
    }
    // If in test environment and test adapter is registered, prefer test adapter if stripe is unconfigured
    if (process.env.NODE_ENV === 'test' && this.adapters.has('test')) {
      const stripe = this.adapters.get('stripe');
      if (!stripe?.isConfigured) {
        return this.getAdapter('test');
      }
    }
    return this.getAdapter('stripe');
  }

  /**
   * Initializes milestone escrow funding with provider-neutral intent and state verification.
   */
  public async initializeMilestoneEscrow(
    contract: GigLinkContract,
    milestone: ContractMilestone,
    options?: { preferredProvider?: PaymentProvider }
  ): Promise<ProviderPaymentIntent> {
    assertPaymentsActive('PaymentOrchestrator.initializeMilestoneEscrow');

    // Invariant check: Contract must be active
    if (contract.status !== 'active') {
      throw new Error(`Escrow funding is only permitted on active contracts (current: ${contract.status}).`);
    }

    // State machine check & Idempotency
    const currentState = milestone.paymentState || 'unfunded';
    if (currentState === 'held') {
      throw new Error('Milestone is already fully funded and held in escrow.');
    }
    if (currentState === 'released') {
      throw new Error('Milestone funds have already been released to Talent.');
    }
    if (currentState === 'refunded') {
      throw new Error('Milestone has already been refunded.');
    }

    assertValidPaymentStateTransition(currentState, 'funding_pending', {
      contractId: contract.id,
      milestoneId: milestone.id,
    });

    const payableAmount = milestone.requiredFundingAmount || milestone.amount;
    const payableCurrency = milestone.currency || contract.scopeLock.currency || 'USD';

    const adapter = this.resolveAdapter(options?.preferredProvider);

    const initParams: PaymentInitParams = {
      contractId: contract.id,
      milestoneId: milestone.id,
      amount: payableAmount,
      currency: payableCurrency,
      clientId: contract.creatorId,
      clientName: contract.creatorName || 'Client',
      talentId: contract.talentId,
      talentName: contract.talentName || 'Talent',
    };

    return adapter.initializePayment(initParams);
  }

  /**
   * Authoritatively verifies escrow funding with the payment provider.
   */
  public async verifyEscrowFunding(
    paymentReference: string,
    contractId: string,
    milestoneId: string,
    provider: PaymentProvider = 'stripe'
  ): Promise<{
    verified: boolean;
    providerTransactionReference: string;
    amount: number;
    currency: string;
  }> {
    assertPaymentsActive('PaymentOrchestrator.verifyEscrowFunding');

    const adapter = this.getAdapter(provider);
    const result = await adapter.verifyPayment({
      paymentReference,
      contractId,
      milestoneId,
    });

    if (result.status !== 'succeeded') {
      throw new Error(`Payment verification failed: Provider reported status '${result.status}'.`);
    }

    return {
      verified: true,
      providerTransactionReference: result.providerTransactionReference,
      amount: result.amount,
      currency: result.currency,
    };
  }

  /**
   * Executes milestone payout to Talent.
   * Invariant: Milestone must be held in escrow or reserved in release_pending; cannot release unfunded or refunded milestone.
   */
  public async executeMilestonePayout(
    contract: GigLinkContract,
    milestone: ContractMilestone,
    talentPayoutAccount: TalentPayoutAccount | null,
    options?: { preferredProvider?: PaymentProvider; payoutReference?: string; attempt?: number }
  ): Promise<{
    payoutId: string;
    status: 'pending' | 'succeeded' | 'failed';
    provider: PaymentProvider;
    providerPayoutReference: string;
    isTimeout?: boolean;
    error?: string;
  }> {
    assertPaymentsActive('PaymentOrchestrator.executeMilestonePayout');

    const currentState = milestone.paymentState;
    if (currentState !== 'held' && currentState !== 'release_pending') {
      throw new Error(
        `Cannot release milestone in '${currentState}' state. Funds must be held in escrow prior to release.`
      );
    }

    if (currentState === 'held') {
      assertValidPaymentStateTransition(currentState, 'release_pending', {
        contractId: contract.id,
        milestoneId: milestone.id,
      });
    }

    const destinationAccount =
      talentPayoutAccount?.providerAccountReference || talentPayoutAccount?.stripeAccountId;

    const adapter = this.resolveAdapter(options?.preferredProvider || talentPayoutAccount?.provider);

    // If destination account is not configured and adapter is not in test mode, fail closed
    if (!destinationAccount && adapter.provider !== 'test') {
      throw new Error(
        'Cannot execute milestone payout: Talent has not configured an active payout account.'
      );
    }

    // F-02: Calculate canonical 5% platform fee and disburse only net Partner amount to adapter
    const { netTalentAmount } = calculatePlatformFee(milestone.amount);

    const stablePayoutRef =
      options?.payoutReference ||
      milestone.providerPayoutReference ||
      (options?.attempt && options.attempt > 1
        ? `pstk_trf_${contract.id}_${milestone.id}_att${options.attempt}`
        : `pstk_trf_${contract.id}_${milestone.id}`);

    const payoutResult = await adapter.executePayout({
      contractId: contract.id,
      milestoneId: milestone.id,
      amount: netTalentAmount,
      currency: milestone.currency || 'USD',
      talentId: contract.talentId,
      destinationAccountReference: destinationAccount || 'unconfigured',
      sourceTransactionReference: milestone.providerPaymentReference || milestone.paymentIntentId || undefined,
      payoutReference: stablePayoutRef,
      attempt: options?.attempt || milestone.payoutAttempts || 1,
    });

    return {
      payoutId: payoutResult.payoutId || stablePayoutRef,
      status: payoutResult.status,
      provider: adapter.provider,
      providerPayoutReference: payoutResult.payoutId || stablePayoutRef,
      isTimeout: payoutResult.isTimeout,
      error: payoutResult.error,
    };
  }

  /**
   * Authoritatively verifies an existing payout transfer on the payment provider.
   */
  public async verifyPayout(
    payoutReference: string,
    preferredProvider?: PaymentProvider
  ): Promise<{ payoutId: string; status: 'pending' | 'succeeded' | 'failed' }> {
    assertPaymentsActive('PaymentOrchestrator.verifyPayout');

    const adapter = this.resolveAdapter(preferredProvider);
    if (adapter.verifyPayout) {
      return adapter.verifyPayout(payoutReference);
    }

    return {
      payoutId: payoutReference,
      status: 'pending',
    };
  }

  /**
   * Executes milestone refund to Client.
   * Invariant: Milestone must be held in escrow; cannot refund released or paid-out milestone.
   */
  public async executeMilestoneRefund(
    contract: GigLinkContract,
    milestone: ContractMilestone,
    reason?: string,
    options?: { preferredProvider?: PaymentProvider }
  ): Promise<{ refundId: string; provider: PaymentProvider; providerRefundReference: string }> {
    assertPaymentsActive('PaymentOrchestrator.executeMilestoneRefund');

    const currentState = milestone.paymentState;
    if (currentState !== 'held') {
      throw new Error(
        `Cannot refund milestone in '${currentState}' state. Only held escrow funds can be refunded.`
      );
    }

    assertValidPaymentStateTransition(currentState, 'refund_pending', {
      contractId: contract.id,
      milestoneId: milestone.id,
    });

    const adapter = this.resolveAdapter(options?.preferredProvider);

    const transactionReference =
      milestone.providerPaymentReference || milestone.paymentIntentId || `milestone_${milestone.id}`;
    const res = await adapter.executeRefund({
      transactionReference,
      amount: milestone.fundedAmount || milestone.amount,
      reason,
    });

    return {
      refundId: res.refundId,
      provider: adapter.provider,
      providerRefundReference: res.refundId,
    };
  }

  /**
   * Server-authoritative Payout Account setup.
   */
  public async createPayoutAccount(
    params: PayoutAccountParams,
    provider: PaymentProvider = 'stripe'
  ): Promise<TalentPayoutAccount> {
    assertPaymentsActive('PaymentOrchestrator.createPayoutAccount');

    const adapter = this.resolveAdapter(provider);
    return adapter.createPayoutAccount(params);
  }
}

export const defaultPaymentOrchestrator = PaymentOrchestrator.getInstance();
