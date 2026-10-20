/**
 * Paystack Payment Adapter (Phase C-2C-1 Implementation)
 *
 * Implements the provider-neutral PaymentAdapter interface for Paystack.
 * Authoritative boundaries:
 * 1. Coordinates Paystack server-to-server operations over standard HTTPS.
 * 2. Never trusts browser or client-supplied status, amounts, or currencies.
 * 3. Enforces platform fee calculation via canonical financialService.
 * 4. Verifies webhook signatures using HMAC-SHA512.
 * 5. Supports test transport injection for deterministic unit testing without external calls.
 */

import crypto from 'crypto';
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
import { assertPaymentsActive } from './paymentSandboxGuard';

export interface PaystackHttpResponse {
  status: number;
  data: any;
}

export type PaystackHttpTransport = (options: {
  method: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
}) => Promise<PaystackHttpResponse>;

/**
 * Validates the syntax format of a Paystack secret key locally.
 * Enforces:
 * 1. Key must be defined, non-empty, and non-whitespace.
 * 2. Key must have a recognized Paystack secret key prefix ('sk_live_' or 'sk_test_').
 * 3. Key must possess a non-empty credential suffix following the prefix.
 * Fails locally before any external HTTP request is dispatched.
 */
export function validatePaystackKeyFormat(rawKey: string | undefined): string {
  if (!rawKey || typeof rawKey !== 'string' || rawKey.trim() === '') {
    throw new Error(
      'Paystack configuration error: PAYSTACK_SECRET_KEY is not defined in server environment.'
    );
  }

  const key = rawKey.trim();
  const isLive = key.startsWith('sk_live_');
  const isTest = key.startsWith('sk_test_');

  if (!isLive && !isTest) {
    throw new Error(
      'Paystack configuration error: PAYSTACK_SECRET_KEY has an invalid key prefix. Expected "sk_live_" or "sk_test_".'
    );
  }

  const prefix = isLive ? 'sk_live_' : 'sk_test_';
  const suffix = key.slice(prefix.length).trim();
  if (suffix.length === 0) {
    throw new Error(
      'Paystack configuration error: PAYSTACK_SECRET_KEY is incomplete. Expected a non-empty credential suffix following the key prefix.'
    );
  }

  return key;
}

export class PaystackAdapter implements PaymentAdapter {
  public readonly provider: PaymentProvider = 'paystack';
  private static readonly BASE_URL = 'https://api.paystack.co';

  // Injectable transport for unit test isolation (prevents live external network calls)
  private testTransport: PaystackHttpTransport | null = null;

  public setHttpTransportForTesting(transport: PaystackHttpTransport | null): void {
    this.testTransport = transport;
  }

  private getSecretKey(): string {
    return process.env.PAYSTACK_SECRET_KEY || '';
  }

  public get isConfigured(): boolean {
    return Boolean(this.getSecretKey());
  }

  /**
   * Internal HTTPS request dispatcher for Paystack REST endpoints
   */
  private async request(method: string, path: string, body?: any): Promise<PaystackHttpResponse> {
    assertPaymentsActive(`Paystack.${method} ${path}`);

    const secretKey = validatePaystackKeyFormat(this.getSecretKey());

    const headers: Record<string, string> = {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.testTransport) {
      return this.testTransport({ method, path, body, headers });
    }

    const url = `${PaystackAdapter.BASE_URL}${path}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Paystack API error: Failed to parse response from ${method} ${path}`);
    }

    return {
      status: response.status,
      data,
    };
  }

  /**
   * 1. Initialize Payment
   * Calls POST /transaction/initialize to create Paystack hosted checkout session.
   */
  public async initializePayment(params: PaymentInitParams): Promise<ProviderPaymentIntent> {
    const { contractId, milestoneId, amount, currency, clientId, clientName, talentId, talentName } = params;

    if (!contractId || !milestoneId) {
      throw new Error('Paystack initialization error: Missing required contractId or milestoneId.');
    }
    if (!amount || amount <= 0) {
      throw new Error('Paystack initialization error: Amount must be greater than zero.');
    }
    if (!currency) {
      throw new Error('Paystack initialization error: Currency is required.');
    }

    const normalizedCurrency = currency.toUpperCase();
    const { platformFeeAmount, netTalentAmount } = calculatePlatformFee(amount);

    // Paystack amounts are specified in minor currency subunits (e.g. kobo, cents)
    const amountInSubunits = Math.round(amount * 100);

    const reference = `pstk_${contractId}_${milestoneId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const email = `${clientId}@giglink.network`;

    const payload = {
      email,
      amount: amountInSubunits,
      currency: normalizedCurrency,
      reference,
      metadata: {
        contractId,
        milestoneId,
        clientId,
        clientName: clientName || 'Client',
        talentId,
        talentName: talentName || 'Talent',
        platformFee: platformFeeAmount,
        partnerAmount: netTalentAmount,
      },
    };

    const res = await this.request('POST', '/transaction/initialize', payload);

    if (res.status >= 400 || !res.data?.status) {
      const errorMsg = res.data?.message || `Paystack rejected initialization (HTTP ${res.status})`;
      throw new Error(`Paystack transaction initialization failed: ${errorMsg}`);
    }

    const responseData = res.data.data;
    if (!responseData || !responseData.reference) {
      throw new Error('Paystack API error: Malformed response from /transaction/initialize');
    }

    const now = new Date().toISOString();
    return {
      provider: 'paystack',
      providerTransactionReference: responseData.reference,
      paymentReference: responseData.reference,
      currency: normalizedCurrency,
      grossAmount: amount,
      platformFee: platformFeeAmount,
      partnerAmount: netTalentAmount,
      status: 'pending',
      contractId,
      milestoneId,
      clientId,
      talentId,
      authorizationUrl: responseData.authorization_url,
      clientSecret: responseData.access_code,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * 2. Verify Payment
   * Calls GET /transaction/verify/:reference to authoritatively check transaction state.
   */
  public async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    const { paymentReference, contractId, milestoneId } = params;

    if (!paymentReference) {
      throw new Error('Paystack verification error: paymentReference is required.');
    }

    const res = await this.request(
      'GET',
      `/transaction/verify/${encodeURIComponent(paymentReference)}`
    );

    if (res.status >= 400 || !res.data?.status) {
      return {
        status: 'failed',
        amount: 0,
        currency: 'USD',
        providerTransactionReference: paymentReference,
      };
    }

    const txData = res.data.data;
    if (!txData) {
      return {
        status: 'failed',
        amount: 0,
        currency: 'USD',
        providerTransactionReference: paymentReference,
      };
    }

    // Correlation check against metadata if available
    const meta = txData.metadata || {};
    if (contractId && meta.contractId && meta.contractId !== contractId) {
      throw new Error(
        `Paystack verification security violation: Transaction belongs to contract '${meta.contractId}', not '${contractId}'.`
      );
    }
    if (milestoneId && meta.milestoneId && meta.milestoneId !== milestoneId) {
      throw new Error(
        `Paystack verification security violation: Transaction belongs to milestone '${meta.milestoneId}', not '${milestoneId}'.`
      );
    }

    const isSuccess = txData.status === 'success';
    // Convert minor subunit amount back to standard currency amount
    const grossAmount = typeof txData.amount === 'number' ? txData.amount / 100 : 0;
    const currency = String(txData.currency || 'USD').toUpperCase();

    return {
      status: isSuccess ? 'succeeded' : txData.status === 'abandoned' ? 'failed' : 'failed',
      amount: grossAmount,
      currency,
      providerTransactionReference: txData.reference || paymentReference,
    };
  }

  /**
   * 3. Create Payout Account (Transfer Recipient)
   * Calls POST /transferrecipient to register bank account or mobile money destination.
   */
  public async createPayoutAccount(params: PayoutAccountParams): Promise<TalentPayoutAccount> {
    const { userId, country, currency, accountNumber, bankCode, accountName } = params;

    if (!userId || !userId.trim()) {
      throw new Error('Paystack payout account error: userId is required.');
    }

    if (!accountNumber || typeof accountNumber !== 'string' || !accountNumber.trim()) {
      throw new Error('Paystack payout account error: accountNumber is required.');
    }

    if (!bankCode || typeof bankCode !== 'string' || !bankCode.trim()) {
      throw new Error('Paystack payout account error: bankCode is required.');
    }

    if (!accountName || typeof accountName !== 'string' || !accountName.trim()) {
      throw new Error('Paystack payout account error: accountName is required.');
    }

    const normalizedCountry = (country || 'NG').toUpperCase();
    const normalizedCurrency = (currency || 'NGN').toUpperCase();

    // Map recipient type according to corridor
    let recipientType = 'nuban';
    if (normalizedCountry === 'ZA') {
      recipientType = 'basa';
    } else if (normalizedCountry === 'GH' || normalizedCountry === 'KE') {
      recipientType = 'mobile_money';
    }

    const payload = {
      type: recipientType,
      name: accountName.trim(),
      account_number: accountNumber.trim(),
      bank_code: bankCode.trim(),
      currency: normalizedCurrency,
      metadata: {
        userId: userId.trim(),
      },
    };

    const res = await this.request('POST', '/transferrecipient', payload);

    if (res.status >= 400 || !res.data?.status) {
      const errorMsg = res.data?.message || `Paystack rejected recipient creation (HTTP ${res.status})`;
      throw new Error(`Paystack recipient creation failed: ${errorMsg}`);
    }

    const recipientData = res.data.data;
    if (!recipientData || !recipientData.recipient_code) {
      throw new Error('Paystack API error: Malformed response from /transferrecipient');
    }

    const now = new Date().toISOString();
    return {
      userId,
      provider: 'paystack',
      providerAccountReference: recipientData.recipient_code,
      country: normalizedCountry,
      currency: normalizedCurrency,
      status: 'ready',
      payoutsEnabled: true,
      chargesEnabled: true,
      detailsSubmitted: true,
      createdAt: now,
      updatedAt: now,
      stripeAccountId: recipientData.recipient_code, // Compatibility alias
      defaultCurrency: normalizedCurrency,
    };
  }

  /**
   * 4. Account Onboarding Link
   * In Paystack, recipient creation is direct API; returns returnUrl confirmation.
   */
  public async createAccountOnboardingLink(params: {
    userId: string;
    accountReference: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string }> {
    return { url: params.returnUrl };
  }

  /**
   * 5. Execute Payout (Outbound Transfer)
   * Calls POST /transfer to disburse funds to Partner's recipient code.
   * Uses stable, deterministic payout reference tied to the persisted payout operation.
   */
  public async executePayout(params: PayoutParams): Promise<PayoutResult> {
    const { contractId, milestoneId, amount, currency, destinationAccountReference, payoutReference, attempt } = params;

    if (!destinationAccountReference || destinationAccountReference === 'unconfigured') {
      throw new Error('Paystack payout error: Destination recipient account is not configured.');
    }
    if (!amount || amount <= 0) {
      throw new Error('Paystack payout error: Amount must be greater than zero.');
    }

    const amountInSubunits = Math.round(amount * 100);
    const reference =
      payoutReference ||
      (attempt && attempt > 1
        ? `pstk_trf_${contractId}_${milestoneId}_att${attempt}`
        : `pstk_trf_${contractId}_${milestoneId}`);

    const payload = {
      source: 'balance',
      amount: amountInSubunits,
      recipient: destinationAccountReference,
      reference,
      reason: `Milestone settlement: Contract ${contractId} Milestone ${milestoneId}`,
      currency: (currency || 'NGN').toUpperCase(),
    };

    let res;
    try {
      res = await this.request('POST', '/transfer', payload);
    } catch (netErr: any) {
      console.warn(`[PaystackAdapter] Network error during transfer request for ${reference}:`, netErr?.message);
      return {
        payoutId: reference,
        status: 'pending',
        isTimeout: true,
        error: `Provider transport error or timeout: ${netErr?.message || 'Network error'}. Payout operation remains in pending reconciliation.`,
      };
    }

    if (res.status >= 400 || !res.data?.status) {
      const errorMsg = res.data?.message || `Paystack transfer rejected (HTTP ${res.status})`;

      // If Paystack reports duplicate reference, verify the existing transfer authoritatively
      if (
        errorMsg.toLowerCase().includes('duplicate') ||
        errorMsg.toLowerCase().includes('already exists')
      ) {
        try {
          const verified = await this.verifyPayout(reference);
          return verified;
        } catch {
          return {
            payoutId: reference,
            status: 'pending',
            error: `Transfer with reference '${reference}' already exists on Paystack. Pending reconciliation.`,
          };
        }
      }

      return {
        payoutId: reference,
        status: 'failed',
        error: errorMsg,
      };
    }

    const transferData = res.data.data;
    const transferCode = transferData?.transfer_code || reference;
    const transferStatus = transferData?.status;

    return {
      payoutId: transferCode,
      status: transferStatus === 'success' ? 'succeeded' : transferStatus === 'failed' ? 'failed' : 'pending',
    };
  }

  /**
   * Authoritatively verifies an existing transfer on Paystack via GET /transfer/verify/:reference.
   */
  public async verifyPayout(reference: string): Promise<PayoutResult> {
    if (!reference) {
      throw new Error('Paystack payout verification error: reference is required.');
    }

    const res = await this.request(
      'GET',
      `/transfer/verify/${encodeURIComponent(reference)}`
    );

    if (res.status >= 400 || !res.data?.status || !res.data?.data) {
      return {
        payoutId: reference,
        status: 'pending',
      };
    }

    const transferData = res.data.data;
    const transferStatus = transferData.status;
    const payoutId = transferData.transfer_code || reference;

    return {
      payoutId,
      status: transferStatus === 'success' ? 'succeeded' : transferStatus === 'failed' ? 'failed' : 'pending',
    };
  }

  /**
   * 6. Execute Refund
   * Calls POST /refund to process refund back to the Client.
   */
  public async executeRefund(params: RefundParams): Promise<RefundResult> {
    const { transactionReference, amount, reason } = params;

    if (!transactionReference) {
      throw new Error('Paystack refund error: transactionReference is required.');
    }

    const payload: Record<string, any> = {
      transaction: transactionReference,
      merchant_note: reason || 'Client authorized refund',
    };

    if (amount && amount > 0) {
      payload.amount = Math.round(amount * 100);
    }

    const res = await this.request('POST', '/refund', payload);

    if (res.status >= 400 || !res.data?.status) {
      const errorMsg = res.data?.message || `Paystack refund rejected (HTTP ${res.status})`;
      throw new Error(`Paystack refund execution failed: ${errorMsg}`);
    }

    const refundData = res.data.data;
    const refundId = String(refundData?.id || refundData?.transaction_reference || `ref_${Date.now()}`);
    const refundStatus = refundData?.status;

    return {
      refundId,
      status: refundStatus === 'processed' ? 'succeeded' : refundStatus === 'failed' ? 'failed' : 'pending',
    };
  }

  /**
   * 7. Verify Webhook Signature
   * Verifies the x-paystack-signature header using HMAC-SHA512.
   */
  public verifyWebhookSignature(
    rawBody: Buffer | string,
    signature: string,
    secret?: string
  ): { valid: boolean; event?: any; error?: string } {
    if (!signature) {
      return { valid: false, error: 'Missing x-paystack-signature header.' };
    }

    const secretKey = secret || this.getSecretKey();
    if (!secretKey) {
      return { valid: false, error: 'PAYSTACK_SECRET_KEY is not configured on server.' };
    }

    const rawBodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');

    try {
      const hmac = crypto.createHmac('sha512', secretKey);
      hmac.update(rawBodyBuffer);
      const computedSignature = hmac.digest('hex');

      const sigBuffer = Buffer.from(signature, 'utf8');
      const compBuffer = Buffer.from(computedSignature, 'utf8');

      if (sigBuffer.length !== compBuffer.length) {
        return { valid: false, error: 'Paystack signature length mismatch.' };
      }

      const match = crypto.timingSafeEqual(sigBuffer, compBuffer);
      if (!match) {
        return { valid: false, error: 'Paystack signature hash verification failed.' };
      }

      const event = JSON.parse(rawBodyBuffer.toString('utf8'));
      return { valid: true, event };
    } catch (err: any) {
      return { valid: false, error: `Paystack signature validation error: ${err.message}` };
    }
  }

  /**
   * 8. Parse Webhook Event
   * Normalizes verified Paystack webhook events into the provider-neutral model.
   */
  public parseWebhookEvent(
    rawBody: Buffer | string,
    signature: string,
    secret?: string
  ): { valid: boolean; normalizedEvent?: NormalizedWebhookEvent; error?: string } {
    const verification = this.verifyWebhookSignature(rawBody, signature, secret);
    if (!verification.valid || !verification.event) {
      return { valid: false, error: verification.error };
    }

    const event = verification.event;
    const eventType = String(event.event || '');
    const data = event.data || {};
    const metadata = data.metadata || {};

    const eventId = String(data.id || `${eventType}_${data.reference || Date.now()}`);
    let contractId = metadata.contractId;
    let milestoneId = metadata.milestoneId;
    const paymentReference = data.reference;

    // Fallback extraction for transfer events (where Paystack transfer payloads don't store metadata)
    if ((!contractId || !milestoneId) && paymentReference && typeof paymentReference === 'string') {
      if (paymentReference.startsWith('pstk_trf_')) {
        const withoutPrefix = paymentReference.substring('pstk_trf_'.length);
        const parts = withoutPrefix.split('_');
        if (parts.length >= 2) {
          contractId = parts[0];
          // Strip optional attempt suffix e.g. _att2
          const rest = parts.slice(1).join('_');
          milestoneId = rest.replace(/_att\d+$/, '');
        }
      }
    }

    const amount = typeof data.amount === 'number' ? data.amount / 100 : undefined;
    const currency = data.currency ? String(data.currency).toUpperCase() : undefined;

    let normalizedStatus: 'succeeded' | 'failed' | 'pending' = 'pending';
    switch (eventType) {
      case 'charge.success':
        normalizedStatus = 'succeeded';
        break;
      case 'charge.failed':
        normalizedStatus = 'failed';
        break;
      case 'transfer.success':
        normalizedStatus = 'succeeded';
        break;
      case 'transfer.failed':
      case 'transfer.reversed':
        normalizedStatus = 'failed';
        break;
      case 'refund.processed':
        normalizedStatus = 'succeeded';
        break;
      case 'refund.failed':
        normalizedStatus = 'failed';
        break;
      default:
        normalizedStatus = 'pending';
        break;
    }

    const normalizedEvent: NormalizedWebhookEvent = {
      eventId,
      eventType,
      provider: 'paystack',
      contractId,
      milestoneId,
      paymentReference,
      status: normalizedStatus,
      amount,
      currency,
    };

    return {
      valid: true,
      normalizedEvent,
    };
  }
}

/**
 * Validates the Paystack secret key configuration at server startup.
 *
 * Rules:
 * - When NODE_ENV === 'production', the application must refuse to start if PAYSTACK_SECRET_KEY begins with 'sk_test_'.
 * - When NODE_ENV === 'production', a configured Paystack secret must use the expected live-key prefix, 'sk_live_'.
 * - A missing or empty Paystack key must not be silently replaced with a test key, mock key, or fallback secret.
 * - In production, a missing or empty Paystack key is rejected with a fail-closed configuration error.
 * - Does not print the secret, any portion of the secret, or other sensitive credential material in logs or errors.
 * - In non-production (development, test), does not require a live key.
 */
export function validatePaystackProductionKeyGuard(env: Record<string, string | undefined> = process.env): void {
  const nodeEnv = env.NODE_ENV;
  if (nodeEnv !== 'production') {
    return;
  }

  // Explicit sandbox mode:
  // ONLY an explicit configuration flag (GIGLINK_ALLOW_SANDBOX_TEST_KEYS=true) permits
  // preview container startup with a test key (placing all payment operations into disabled state).
  // AI Studio environment indicators (APPLET_ID, K_SERVICE, etc.) ALONE NEVER bypass this guard.
  const isExplicitSandbox = env.GIGLINK_ALLOW_SANDBOX_TEST_KEYS === 'true';

  const rawKey = env.PAYSTACK_SECRET_KEY;
  if (!rawKey || typeof rawKey !== 'string' || rawKey.trim() === '') {
    throw new Error(
      '[Paystack Security Guard] Production startup failed: PAYSTACK_SECRET_KEY is missing or empty. A live Paystack secret key ("sk_live_...") must be configured in production.'
    );
  }

  const key = rawKey.trim();

  if (key.startsWith('sk_test_')) {
    if (isExplicitSandbox) {
      return;
    }
    throw new Error(
      '[Paystack Security Guard] Production startup failed: PAYSTACK_SECRET_KEY uses a test key prefix ("sk_test_"). Test keys are strictly prohibited in production. A live key ("sk_live_...") is required.'
    );
  }

  if (!key.startsWith('sk_live_')) {
    throw new Error(
      '[Paystack Security Guard] Production startup failed: PAYSTACK_SECRET_KEY has an invalid key prefix. Expected live Paystack key prefix ("sk_live_...").'
    );
  }

  const credentialSuffix = key.slice('sk_live_'.length).trim();
  if (credentialSuffix.length === 0) {
    throw new Error(
      '[Paystack Security Guard] Production startup failed: PAYSTACK_SECRET_KEY is incomplete. Expected a non-empty credential suffix following the "sk_live_" prefix.'
    );
  }
}
