/**
 * @deprecated LEGACY STRIPE PROTOTYPE (Phase 4 Prototype)
 *
 * ARCHITECTURAL NOTICE (Phase C-2A Audit & Findings Closure):
 * This file is an isolated legacy prototype. It is NOT part of the active provider-neutral
 * payment architecture.
 *
 * ACTIVE ARCHITECTURE:
 * All authoritative payment, escrow funding, release, refund, and payout operations are handled
 * exclusively by PaymentOrchestrator (src/server/payments/PaymentOrchestrator.ts) and its
 * registered payment adapters.
 *
 * REMAINING DEPENDENCY:
 * The single remaining caller of this module in the entire application is server.ts:
 * `verifyStripeWebhookSignature` is called by the POST /api/payments/webhook endpoint to verify
 * inbound Stripe webhook payload signatures.
 *
 * NO ACTIVE PRODUCTION PAYMENT PATH INVOKES:
 * - createMilestonePaymentIntent() [DEPRECATED - Superseded by PaymentOrchestrator.createMilestonePayment]
 * - executeMilestonePayout()        [DEPRECATED - Superseded by PaymentOrchestrator.executeMilestonePayout]
 * - executeMilestoneRefund()        [DEPRECATED - Superseded by PaymentOrchestrator.executeMilestoneRefund]
 *
 * Note: Stripe Connect implementation is deferred; initial active providers are Flutterwave and Paystack.
 */

import Stripe from 'stripe';
import { calculatePlatformFee } from '../lib/financialService';

// Lazy Stripe client initialization
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as any,
    });
  }
  return stripeClient;
}

export interface PaymentIntentCreationResult {
  clientSecret?: string;
  paymentIntentId: string;
  mode: 'live_stripe' | 'simulated';
  amount: number;
  currency: string;
  platformFee: number;
  netTalentAmount: number;
}

/**
 * @deprecated Legacy prototype only.
 * Superseded by defaultPaymentOrchestrator.createMilestonePayment().
 * No active production path calls this function.
 */
export async function createMilestonePaymentIntent(params: {
  contractId: string;
  milestoneId: string;
  amount: number;
  currency: string;
  clientId: string;
  clientName: string;
  talentId: string;
  talentName: string;
}): Promise<PaymentIntentCreationResult> {
  const { contractId, milestoneId, amount, currency, clientId, clientName, talentId, talentName } = params;
  const stripe = getStripe();
  const { platformFeeAmount, netTalentAmount } = calculatePlatformFee(amount);
  const amountInCents = Math.round(amount * 100);

  if (stripe) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: (currency || 'usd').toLowerCase(),
        description: `GigLink Escrow Funding: Contract ${contractId} - Milestone ${milestoneId}`,
        metadata: {
          contractId,
          milestoneId,
          clientId,
          clientName,
          talentId,
          talentName,
          platformFee: platformFeeAmount.toString(),
          netTalentAmount: netTalentAmount.toString(),
          giglinkType: 'milestone_escrow_funding',
        },
      });

      return {
        clientSecret: paymentIntent.client_secret || undefined,
        paymentIntentId: paymentIntent.id,
        mode: 'live_stripe',
        amount,
        currency,
        platformFee: platformFeeAmount,
        netTalentAmount,
      };
    } catch (err: any) {
      console.error('[Stripe Service] Error creating PaymentIntent:', err);
      throw new Error(`Failed to create Stripe PaymentIntent: ${err.message}`);
    }
  }

  if (!stripe) {
    if (process.env.NODE_ENV === 'test') {
      const mockIntentId = `test_pi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      return {
        clientSecret: `${mockIntentId}_secret_test`,
        paymentIntentId: mockIntentId,
        mode: 'simulated',
        amount,
        currency,
        platformFee: platformFeeAmount,
        netTalentAmount,
      };
    }
    throw new Error(
      'Payment provider error: STRIPE_SECRET_KEY is not configured on server. Real payment operations fail closed; simulation is disabled.'
    );
  }
}

/**
 * @deprecated Legacy prototype only.
 * Superseded by defaultPaymentOrchestrator.executeMilestonePayout().
 * No active production path calls this function.
 */
export async function executeMilestonePayout(params: {
  contractId: string;
  milestoneId: string;
  amount: number;
  currency: string;
  talentId: string;
  talentStripeAccountId?: string;
  sourcePaymentIntentId?: string;
}): Promise<{
  transferId: string;
  mode: 'live_stripe' | 'simulated';
  status: 'succeeded' | 'pending';
}> {
  const { contractId, milestoneId, amount, currency, talentId, talentStripeAccountId, sourcePaymentIntentId } = params;
  const stripe = getStripe();
  const { netTalentAmount } = calculatePlatformFee(amount);
  const netInCents = Math.round(netTalentAmount * 100);

  if (stripe && talentStripeAccountId) {
    try {
      const transfer = await stripe.transfers.create({
        amount: netInCents,
        currency: (currency || 'usd').toLowerCase(),
        destination: talentStripeAccountId,
        description: `GigLink Payout: Contract ${contractId} - Milestone ${milestoneId}`,
        metadata: {
          contractId,
          milestoneId,
          talentId,
          sourcePaymentIntentId: sourcePaymentIntentId || '',
        },
      });

      return {
        transferId: transfer.id,
        mode: 'live_stripe',
        status: 'succeeded',
      };
    } catch (err: any) {
      console.error('[Stripe Service] Error creating Transfer to talent account:', err);
      // Fall through to record with error tracking
      throw new Error(`Stripe transfer failed: ${err.message}`);
    }
  }

  if (process.env.NODE_ENV === 'test') {
    const simulatedTransferId = `test_tr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      transferId: simulatedTransferId,
      mode: 'simulated',
      status: 'succeeded',
    };
  }

  throw new Error(
    'Payment provider error: Cannot execute payout because live Stripe credentials or talent payout account are not configured. Simulation is disabled.'
  );
}

/**
 * @deprecated Legacy prototype only.
 * Superseded by defaultPaymentOrchestrator.executeMilestoneRefund().
 * No active production path calls this function.
 */
export async function executeMilestoneRefund(params: {
  paymentIntentId: string;
  amount?: number;
  reason?: string;
}): Promise<{
  refundId: string;
  mode: 'live_stripe' | 'simulated';
  status: 'succeeded' | 'pending';
}> {
  const { paymentIntentId, amount, reason } = params;
  const stripe = getStripe();

  if (stripe && paymentIntentId && !paymentIntentId.startsWith('pi_sim_') && !paymentIntentId.startsWith('test_pi_')) {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: 'requested_by_customer',
      });

      return {
        refundId: refund.id,
        mode: 'live_stripe',
        status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
      };
    } catch (err: any) {
      console.error('[Stripe Service] Error processing Stripe refund:', err);
      throw new Error(`Stripe refund failed: ${err.message}`);
    }
  }

  if (process.env.NODE_ENV === 'test') {
    const simulatedRefundId = `test_re_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      refundId: simulatedRefundId,
      mode: 'simulated',
      status: 'succeeded',
    };
  }

  throw new Error(
    'Payment provider error: Cannot execute refund because live Stripe credentials or payment reference are unavailable. Simulation is disabled.'
  );
}

/**
 * Verifies the Stripe Webhook signature using raw payload buffer.
 * Preserved for incoming Stripe webhook validation at POST /api/payments/webhook.
 */
export function verifyStripeWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
  endpointSecret?: string
): { valid: boolean; event?: Stripe.Event; error?: string } {
  const secret = endpointSecret || process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();

  if (!stripe || !secret) {
    return {
      valid: false,
      error: 'Stripe or webhook secret is not configured on server.',
    };
  }

  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    return { valid: true, event };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

