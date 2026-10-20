/**
 * Express Server for GigLink V1
 * Serves Vite middleware in development, hosts advisory AI endpoints,
 * auth OTP endpoints, and authoritative Payments, Escrow & Webhook handlers.
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import firebaseConfig from './firebase-applet-config.json';
import { defaultOtpManager } from './src/server/otpService';
import {
  verifyStripeWebhookSignature,
} from './src/server/stripeService';
import { defaultPaymentOrchestrator } from './src/server/payments/PaymentOrchestrator';
import { requirePaymentAuth, VerifiedPaymentUser, verifyPaymentToken } from './src/server/payments/paymentAuth';
import {
  startMilestoneWork,
  submitMilestoneDeliverable as serverSubmitDeliverable,
  reviewMilestoneDeliverable as serverReviewDeliverable,
  MilestoneLifecycleError,
} from './src/server/payments/milestoneLifecycleService';
import {
  serverRecordMilestoneFunded as recordMilestoneFunded,
  serverReserveMilestonePayout as reserveMilestonePayout,
  serverRecordMilestonePaymentReleased as recordMilestonePaymentReleased,
  serverRecordMilestoneRefund as recordMilestoneRefund,
  serverRecordMilestonePayoutSuccess as recordMilestonePayoutSuccess,
  serverRecordMilestonePayoutFailure as recordMilestonePayoutFailure,
  serverReconcileMilestonePayout as reconcileMilestonePayout,
  serverCheckAndRecordWebhookEvent as checkAndRecordWebhookEvent,
  serverGetWebhookEventRecord as getWebhookEventRecord,
  serverRecordWebhookEventPermanentFailure as recordWebhookEventPermanentFailure,
  serverGetTalentPayoutAccount as getTalentPayoutAccount,
  serverSetTalentPayoutAccount as setTalentPayoutAccount,
  serverGetContractLedgerRecords as getContractLedgerRecords,
} from './src/server/payments/serverFinancialLedgerService';
import { getContract, persistContract } from './src/lib/contractService';
import {
  getAuthoritativeCeoOverview,
  getAuthoritativeCeoMembers,
  getAuthoritativeCeoFinancials,
  getAuthoritativeCeoActivity,
  getAuthoritativeCeoSystemHealth,
  recordRuntimeAuthFailure,
  recordRuntimeWebhookFailure,
} from './src/server/ceoMetricsService';
import { recomputeAndSyncPublicTrustPassport } from './src/server/serverTrustScoreService';
import { getAdminFirestore } from './src/server/firebaseAdmin';
import { buildSanitizedAiContext } from './src/server/aiContextBuilder';
import { defaultIlAiService } from './src/server/aiService';
import { IlAiGuidanceRequest } from './src/server/aiContextDTOs';
import { handleConfirmFunding } from './src/server/payments/confirmFundingHandler';
import { validatePaystackProductionKeyGuard } from './src/server/payments/PaystackAdapter';
import { isPaymentSandboxDisabled, requireActivePaymentMode } from './src/server/payments/paymentSandboxGuard';
export { handleConfirmFunding, validatePaystackProductionKeyGuard, isPaymentSandboxDisabled };

async function startServer() {
  // Production security guard: fail-closed if Paystack key configuration is invalid in production.
  // Explicit sandbox mode (GIGLINK_ALLOW_SANDBOX_TEST_KEYS=true) allows container startup with a test key
  // ONLY while placing all payment routes and ledger mutations into a fail-closed disabled state.
  // AI Studio environment indicators alone NEVER bypass this guard.
  validatePaystackProductionKeyGuard();

  if (isPaymentSandboxDisabled()) {
    console.warn(
      '[Paystack Security Guard] WARNING: Sandbox mode enabled (GIGLINK_ALLOW_SANDBOX_TEST_KEYS=true) with test key. All payment routes, funding confirmations, payouts, refunds, and financial ledger mutations are disabled fail-closed.'
    );
  }

  const app = express();
  const PORT = 3000;

  // Enforce sandbox payment isolation: block all payment routes fail-closed when sandbox mode is disabled
  app.use('/api/payments', requireActivePaymentMode);

  // IMPORTANT: Stripe Webhook endpoint needs raw body for signature verification
  app.post(
    '/api/payments/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const sig = req.headers['stripe-signature'] as string;
      const rawBody = req.body;

      if (!sig) {
        return res.status(400).json({ error: 'Missing stripe-signature header.' });
      }

      const verification = verifyStripeWebhookSignature(rawBody, sig);
      if (!verification.valid || !verification.event) {
        console.warn('[Stripe Webhook] Invalid signature:', verification.error);
        return res.status(400).json({ error: `Webhook Error: ${verification.error}` });
      }

      const event = verification.event;

      // Webhook Idempotency Check
      const { isDuplicate } = await checkAndRecordWebhookEvent({
        id: event.id,
        type: event.type,
        created: event.created,
      });

      if (isDuplicate) {
        console.log(`[Stripe Webhook] Duplicate event ignored: ${event.id}`);
        return res.status(200).json({ received: true, status: 'duplicate_ignored' });
      }

      try {
        switch (event.type) {
          case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object as any;
            const metadata = paymentIntent.metadata || {};
            const contractId = metadata.contractId;
            const milestoneId = metadata.milestoneId;
            const clientId = metadata.clientId;
            const clientName = metadata.clientName || 'Client';

            if (contractId && milestoneId && clientId) {
              const grossAmount = paymentIntent.amount ? paymentIntent.amount / 100 : 0;
              await recordMilestoneFunded({
                contractId,
                milestoneId,
                payerId: clientId,
                payerName: clientName,
                amount: grossAmount,
                currency: (paymentIntent.currency || 'usd').toUpperCase(),
                paymentIntentId: paymentIntent.id,
                provider: 'stripe',
                eventId: event.id,
              });
              console.log(`[Stripe Webhook] Milestone funded: ${milestoneId} on contract ${contractId}`);
            }
            break;
          }

          case 'charge.refunded': {
            const charge = event.data.object as any;
            console.log(`[Stripe Webhook] Charge refunded: ${charge.id}`);
            break;
          }

          default:
            if ((event.type as string).startsWith('transfer.')) {
              const transfer = event.data.object as any;
              console.log(`[Stripe Webhook] Transfer recorded: ${transfer.id}`);
            } else {
              console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
            }
        }

        return res.status(200).json({ received: true });
      } catch (err: any) {
        recordRuntimeWebhookFailure();
        console.error('[Stripe Webhook] Error processing event:', err);
        return res.status(500).json({ error: 'Failed to process webhook event.' });
      }
    }
  );

  // Paystack Webhook endpoint (raw body for HMAC-SHA512 signature verification)
  app.post(
    '/api/payments/paystack-webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const sig = req.headers['x-paystack-signature'] as string;
      const rawBody = req.body;

      if (!sig) {
        return res.status(400).json({ error: 'Missing x-paystack-signature header.' });
      }

      let adapter;
      try {
        adapter = defaultPaymentOrchestrator.getAdapter('paystack');
      } catch {
        return res.status(500).json({ error: 'Paystack adapter not configured.' });
      }

      const parsed = adapter.parseWebhookEvent(rawBody, sig);
      if (!parsed.valid || !parsed.normalizedEvent) {
        console.warn('[Paystack Webhook] Signature verification failed:', parsed.error);
        return res.status(400).json({ error: `Webhook Error: ${parsed.error}` });
      }

      const event = parsed.normalizedEvent;

      // Webhook Idempotency Check (Read-Only Check without pre-marking as processed)
      const existingEvent = await getWebhookEventRecord(event.eventId);
      if (existingEvent) {
        if (existingEvent.status === 'processed') {
          console.log(`[Paystack Webhook] Duplicate event already processed: ${event.eventId}`);
          return res.status(200).json({ received: true, status: 'duplicate_ignored' });
        }
        if (existingEvent.status === 'failed') {
          console.log(`[Paystack Webhook] Duplicate event previously recorded with fatal validation failure: ${event.eventId}`);
          return res.status(200).json({ received: true, status: 'permanent_failure_ignored' });
        }
      }

      try {
        const contractId = event.contractId;
        const milestoneId = event.milestoneId;

        switch (event.eventType) {
          case 'charge.success': {
            if (!contractId || !milestoneId) {
              const reason = 'Missing contractId or milestoneId in webhook event';
              console.warn(`[Paystack Webhook] ${reason}`);
              await recordWebhookEventPermanentFailure(event.eventId, reason, 'paystack', event.eventType);
              return res.status(200).json({ received: true, status: 'missing_identifiers_ignored' });
            }

            const contract = await getContract(contractId);
            if (!contract) {
              const reason = `Contract ${contractId} not found`;
              console.warn(`[Paystack Webhook] ${reason}`);
              await recordWebhookEventPermanentFailure(event.eventId, reason, 'paystack', event.eventType);
              return res.status(200).json({ received: true, status: 'contract_not_found_ignored' });
            }

            const milestone = contract.milestones.find((m) => m.id === milestoneId);
            if (!milestone) {
              const reason = `Milestone ${milestoneId} not found on contract ${contractId}`;
              console.warn(`[Paystack Webhook] ${reason}`);
              await recordWebhookEventPermanentFailure(event.eventId, reason, 'paystack', event.eventType);
              return res.status(200).json({ received: true, status: 'milestone_not_found_ignored' });
            }

            const expectedCurrency = (milestone.currency || contract.scopeLock.currency || 'USD').toUpperCase();
            if (!event.currency || event.currency.toUpperCase() !== expectedCurrency) {
              const reason = `Currency mismatch or missing: ${event.currency} !== ${expectedCurrency}`;
              console.warn(`[Paystack Webhook] ${reason}`);
              await recordWebhookEventPermanentFailure(event.eventId, reason, 'paystack', event.eventType);
              return res.status(200).json({ received: true, status: 'currency_mismatch_ignored' });
            }

            // F-01 Server-Authoritative Required Amount & Underpayment Protection
            const authoritativeRequiredAmount = milestone.requiredFundingAmount || milestone.amount;
            if (typeof authoritativeRequiredAmount !== 'number' || authoritativeRequiredAmount <= 0) {
              const reason = `Invalid milestone required amount for ${milestoneId}`;
              console.warn(`[Paystack Webhook] ${reason}`);
              await recordWebhookEventPermanentFailure(event.eventId, reason, 'paystack', event.eventType);
              return res.status(200).json({ received: true, status: 'invalid_milestone_amount_ignored' });
            }

            // Validate provider event amount: must be present, numeric, finite, and positive
            if (
              event.amount === undefined ||
              event.amount === null ||
              typeof event.amount !== 'number' ||
              !Number.isFinite(event.amount) ||
              event.amount <= 0
            ) {
              const reason = `Missing, non-numeric, or non-positive provider amount for ${milestoneId}: ${event.amount}`;
              console.warn(`[Paystack Webhook] ${reason}`);
              await recordWebhookEventPermanentFailure(event.eventId, reason, 'paystack', event.eventType);
              return res.status(200).json({ received: true, status: 'invalid_provider_amount_ignored' });
            }

            // Require providerAmount >= authoritativeRequiredFundingAmount
            if (event.amount < authoritativeRequiredAmount) {
              const reason = `Underpayment rejected: received ${event.amount} ${expectedCurrency}, required ${authoritativeRequiredAmount} ${expectedCurrency}`;
              console.warn(`[Paystack Webhook] ${reason}`);
              await recordWebhookEventPermanentFailure(event.eventId, reason, 'paystack', event.eventType);
              return res.status(200).json({ received: true, status: 'underpayment_ignored' });
            }

            // Atomic Funding Coordination:
            // Milestone transition to 'held', deterministic financial ledger write, and webhook event status: 'processed'
            // are committed atomically in a single Firestore transaction.
            const fundResult = await recordMilestoneFunded({
              contractId,
              milestoneId,
              payerId: contract.creatorId,
              payerName: contract.creatorName || 'Client',
              amount: event.amount,
              currency: expectedCurrency,
              paymentProvider: 'paystack',
              providerPaymentReference: event.paymentReference || event.eventId,
              provider: 'paystack',
              eventId: event.eventId,
              eventType: event.eventType,
            });
            console.log(
              `[Paystack Webhook] Milestone funded atomically: ${milestoneId} on contract ${contractId} (isReplay: ${Boolean(
                fundResult.isReplay
              )})`
            );
            break;
          }

          case 'charge.failed': {
            if (contractId && milestoneId) {
              const contract = await getContract(contractId);
              if (contract) {
                const milestone = contract.milestones.find((m) => m.id === milestoneId);
                if (milestone && milestone.paymentState === 'funding_pending') {
                  const mIdx = contract.milestones.findIndex((m) => m.id === milestoneId);
                  contract.milestones[mIdx] = {
                    ...milestone,
                    paymentState: 'funding_failed',
                    updatedAt: new Date().toISOString(),
                  };
                  await persistContract(contract);
                  console.log(`[Paystack Webhook] Milestone funding failed: ${milestoneId}`);
                }
              }
            }
            await recordWebhookEventPermanentFailure(event.eventId, 'Provider charge failed', 'paystack', event.eventType);
            break;
          }

          case 'transfer.success': {
            if (contractId && milestoneId) {
              const contract = await getContract(contractId);
              if (contract) {
                const milestone = contract.milestones.find((m) => m.id === milestoneId);
                const payoutRef = event.paymentReference || milestone?.providerPayoutReference || event.eventId;
                if (milestone && (milestone.paymentState === 'held' || milestone.paymentState === 'release_pending')) {
                  await recordMilestonePaymentReleased({
                    contractId,
                    milestoneId,
                    authorizedByUserId: contract.creatorId,
                    providerPayoutReference: payoutRef,
                    paymentProvider: 'paystack',
                  });
                }
                await recordMilestonePayoutSuccess({
                  contractId,
                  milestoneId,
                  payoutReference: payoutRef,
                  provider: 'paystack',
                  eventId: event.eventId,
                });
                console.log(`[Paystack Webhook] Payout settled: ${milestoneId} on contract ${contractId}`);
              }
            }
            break;
          }

          case 'transfer.failed':
          case 'transfer.reversed': {
            if (contractId && milestoneId) {
              const contract = await getContract(contractId);
              const milestone = contract?.milestones.find((m) => m.id === milestoneId);
              const payoutRef = event.paymentReference || milestone?.providerPayoutReference || event.eventId;
              await recordMilestonePayoutFailure({
                contractId,
                milestoneId,
                payoutReference: payoutRef,
                reason: `Transfer status: ${event.eventType}`,
                provider: 'paystack',
                eventId: event.eventId,
              });
              console.log(`[Paystack Webhook] Payout failed: ${milestoneId} on contract ${contractId}`);
            }
            break;
          }

          case 'refund.processed': {
            if (contractId && milestoneId) {
              const contract = await getContract(contractId);
              if (contract) {
                const milestone = contract.milestones.find((m) => m.id === milestoneId);
                if (milestone && (milestone.paymentState === 'held' || milestone.paymentState === 'refund_pending')) {
                  await recordMilestoneRefund({
                    contractId,
                    milestoneId,
                    authorizedByUserId: contract.creatorId,
                    reason: 'Paystack webhook refund processed',
                    providerRefundReference: event.paymentReference || event.eventId,
                    paymentProvider: 'paystack',
                    provider: 'paystack',
                  });
                  console.log(`[Paystack Webhook] Refund processed: ${milestoneId} on contract ${contractId}`);
                }
              }
            }
            break;
          }

          default:
            console.log(`[Paystack Webhook] Unhandled event type safely ignored: ${event.eventType}`);
            break;
        }

        return res.status(200).json({ received: true });
      } catch (err: any) {
        recordRuntimeWebhookFailure();
        console.error('[Paystack Webhook] Error processing event:', err);
        return res.status(500).json({ error: 'Failed to process Paystack webhook event.' });
      }
    }
  );

  // Standard JSON body parser for all other endpoints
  app.use(express.json());

  // Healthcheck endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'GigLink V1 Backend with Payments & Escrow' });
  });

  // 1. Send 6-digit OTP endpoint
  app.post('/api/auth/otp/send', async (req: Request, res: Response) => {
    try {
      const { email, userId, force } = req.body || {};
      const targetEmail = (email || '').trim().toLowerCase();
      const targetUid = (userId || targetEmail || 'anonymous-user').trim();

      if (!targetEmail || !targetEmail.includes('@')) {
        return res.status(400).json({ error: 'Valid email address is required.' });
      }

      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

      let oobCode: string | undefined;
      const firebaseApiKey = (firebaseConfig as any)?.apiKey;

      if (idToken && firebaseApiKey) {
        try {
          const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken }),
          });
          const data: any = await resp.json();
          if (data?.oobCode) {
            oobCode = data.oobCode;
          }
        } catch (fbErr) {
          console.warn('[GigLink OTP] Could not fetch oobCode from Firebase Identity Toolkit:', fbErr);
        }
      }

      const result = defaultOtpManager.sendOtp({
        userId: targetUid,
        email: targetEmail,
        oobCode,
        forceBypassCooldown: !!force,
      });

      if (!result.success) {
        return res.status(429).json({
          error: result.message,
          cooldownRemaining: result.cooldownRemaining,
        });
      }

      return res.json({
        success: true,
        message: result.message,
        cooldownRemaining: result.cooldownRemaining,
        expiresAt: result.expiresAt,
        devCode: result.devCode,
      });
    } catch (err: any) {
      console.error('Error sending OTP:', err);
      return res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
    }
  });

  // 2. Verify 6-digit OTP endpoint
  app.post('/api/auth/otp/verify', async (req: Request, res: Response) => {
    try {
      const { otp, email, userId } = req.body || {};
      const targetEmail = (email || '').trim().toLowerCase();
      const targetUid = (userId || targetEmail || 'anonymous-user').trim();

      if (!otp) {
        return res.status(400).json({ error: '6-digit verification code is required.' });
      }

      const verifyResult = defaultOtpManager.verifyOtp(targetUid, targetEmail, otp);

      if (!verifyResult.success) {
        const statusCode = verifyResult.code === 'OTP_LOCKED' ? 403 : verifyResult.code === 'OTP_EXPIRED' ? 410 : 400;
        return res.status(statusCode).json({
          error: verifyResult.error,
          code: verifyResult.code,
          remainingAttempts: verifyResult.remainingAttempts,
        });
      }

      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      const firebaseApiKey = (firebaseConfig as any)?.apiKey;
      let effectiveOobCode = verifyResult.oobCode;

      if (!effectiveOobCode && idToken && firebaseApiKey) {
        try {
          const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken }),
          });
          const data: any = await resp.json();
          if (data?.oobCode) {
            effectiveOobCode = data.oobCode;
          }
        } catch (fbErr) {
          console.warn('[GigLink OTP] Could not fetch oobCode during verification:', fbErr);
        }
      }

      if (effectiveOobCode && firebaseApiKey) {
        try {
          await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:setAccountInfo?key=${firebaseApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oobCode: effectiveOobCode }),
          });
        } catch (fbErr) {
          console.warn('[GigLink OTP] Failed to apply oobCode via setAccountInfo:', fbErr);
        }
      }

      return res.json({
        success: true,
        message: 'Email address verified successfully.',
        oobCode: effectiveOobCode,
      });
    } catch (err: any) {
      console.error('Error verifying OTP:', err);
      return res.status(500).json({ error: 'Failed to verify code. Please try again.' });
    }
  });

  // =========================================================================
  // PRIVILEGED CEO / OWNER AUTHORIZATION LAYER (SERVER-AUTHORITATIVE)
  // =========================================================================

  interface VerifiedAuthUser {
    uid: string;
    email: string;
    emailVerified: boolean;
    claims: Record<string, any>;
    isCeo: boolean;
  }

  /**
   * Cryptographically validates Firebase ID tokens server-side using Firebase Admin SDK.
   * Ensures account validity, signature verification, expiration, issuer, audience, and claims authenticity.
   */
  async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedAuthUser | null> {
    return verifyPaymentToken(idToken);
  }

  /**
   * Express middleware to enforce server-authoritative CEO authorization.
   */
  const requireCeoAuthorization = async (req: Request, res: Response, next: express.NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        recordRuntimeAuthFailure();
        return res.status(401).json({ error: 'Unauthorized: Missing or malformed authorization header.' });
      }

      const idToken = authHeader.substring(7).trim();
      if (!idToken) {
        recordRuntimeAuthFailure();
        return res.status(401).json({ error: 'Unauthorized: Empty token provided.' });
      }

      const authUser = await verifyFirebaseIdToken(idToken);
      if (!authUser) {
        recordRuntimeAuthFailure();
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
      }

      if (!authUser.isCeo) {
        recordRuntimeAuthFailure();
        return res.status(403).json({ error: 'Forbidden: Account does not have CEO authorization.' });
      }

      (req as any).ceoUser = authUser;
      return next();
    } catch (err) {
      recordRuntimeAuthFailure();
      console.error('[requireCeoAuthorization] Error in middleware:', err);
      return res.status(500).json({ error: 'Internal server error during authorization verification.' });
    }
  };

  // CEO Auth-Check endpoint: validates caller's authorization server-side
  app.get('/api/ceo/auth-check', requireCeoAuthorization, (req: Request, res: Response) => {
    const ceoUser = (req as any).ceoUser as VerifiedAuthUser;
    return res.json({
      isCeo: true,
      uid: ceoUser.uid,
      email: ceoUser.email,
      authorizedAt: new Date().toISOString(),
    });
  });

  // Stage 2: CEO Executive Platform Overview (Strictly READ-ONLY)
  app.get('/api/ceo/overview', requireCeoAuthorization, async (req: Request, res: Response) => {
    try {
      const overview = await getAuthoritativeCeoOverview();
      return res.json(overview);
    } catch (err: any) {
      console.error('[CEO Overview] Failed to fetch platform overview:', err);
      return res.status(500).json({ error: 'Failed to retrieve platform overview metrics.' });
    }
  });

  // Stage 2: CEO Authoritative Member Directory (Strictly READ-ONLY)
  app.get('/api/ceo/members', requireCeoAuthorization, async (req: Request, res: Response) => {
    try {
      const members = await getAuthoritativeCeoMembers();
      return res.json(members);
    } catch (err: any) {
      console.error('[CEO Members] Failed to fetch member directory:', err);
      return res.status(500).json({ error: 'Failed to retrieve member directory.' });
    }
  });

  // Stage 2: CEO Executive Financials & Escrow Ledger (Strictly READ-ONLY)
  app.get('/api/ceo/financials', requireCeoAuthorization, async (req: Request, res: Response) => {
    try {
      const financials = await getAuthoritativeCeoFinancials();
      return res.json(financials);
    } catch (err: any) {
      console.error('[CEO Financials] Failed to fetch platform financials:', err);
      return res.status(500).json({ error: 'Failed to retrieve platform financial metrics.' });
    }
  });

  // Stage 2: CEO Sanitized Platform Activity (Strictly READ-ONLY)
  app.get('/api/ceo/activity', requireCeoAuthorization, async (req: Request, res: Response) => {
    try {
      const activity = await getAuthoritativeCeoActivity();
      return res.json(activity);
    } catch (err: any) {
      console.error('[CEO Activity] Failed to fetch platform activity:', err);
      return res.status(500).json({ error: 'Failed to retrieve platform activity.' });
    }
  });

  // Stage 2: CEO Platform System Health (Strictly READ-ONLY)
  app.get('/api/ceo/system-health', requireCeoAuthorization, async (req: Request, res: Response) => {
    try {
      const health = await getAuthoritativeCeoSystemHealth();
      return res.json(health);
    } catch (err: any) {
      console.error('[CEO System Health] Failed to fetch system health:', err);
      return res.status(500).json({ error: 'Failed to retrieve system health.' });
    }
  });

  // ==========================================
  // PHASE 4: FINANCIAL & PAYMENT API ENDPOINTS
  // ==========================================

  // ==========================================
  // PHASE C-1: HARDENED PROVIDER-NEUTRAL PAYMENT & ESCROW ENDPOINTS
  // ==========================================

  // 1. Initialize Escrow Funding (Client / Org Admin Funds Milestone)
  // Server-authoritative: derives payable amount, currency, and participants from verified contract.
  // Requires cryptographically verified Firebase ID token.
  // Never trusts request body identity fields (clientId, etc.) for authentication.
  app.post('/api/payments/fund-milestone', requirePaymentAuth, async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).authenticatedUser as VerifiedPaymentUser;
      const callerUid = authUser.uid;
      const { contractId, milestoneId, preferredProvider, userIsOrgAdmin } = req.body || {};

      if (!contractId || !milestoneId) {
        return res.status(400).json({ error: 'Missing required contractId or milestoneId parameter.' });
      }

      // Authoritative contract lookup
      const contract = await getContract(contractId);
      if (!contract) {
        return res.status(404).json({ error: `Contract ${contractId} not found.` });
      }

      if (contract.status !== 'active') {
        return res.status(400).json({ error: `Escrow funding is only permitted on active contracts (current: ${contract.status}).` });
      }

      if (contract.disputeStatus === 'open' || contract.disputeStatus === 'under_admin_review') {
        return res.status(400).json({ error: 'Contract is currently in active dispute. Escrow funding is locked.' });
      }

      // Authorization Matrix: authenticated Client / authorized Organization Admin only
      const isClient = callerUid === contract.creatorId || authUser.isCeo || (Boolean(userIsOrgAdmin) && Boolean(contract.organizationId));
      if (!isClient) {
        return res.status(403).json({ error: 'Unauthorized: Only the contract Client/Creator or Org Admin can fund milestone escrow.' });
      }

      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        return res.status(404).json({ error: `Milestone ${milestoneId} not found on contract.` });
      }

      // Idempotency & state guards
      if (milestone.paymentState === 'held') {
        return res.status(400).json({ error: 'Milestone is already fully funded and held in escrow.' });
      }
      if ((milestone.paymentState as string) === 'released' || (milestone.paymentState as string) === 'paid_out') {
        return res.status(400).json({ error: 'Milestone funds have already been released to Talent.' });
      }
      if (milestone.paymentState === 'refunded') {
        return res.status(400).json({ error: 'Milestone has already been refunded.' });
      }

      // Route through Payment Orchestrator (Provider-neutral abstraction)
      const intent = await defaultPaymentOrchestrator.initializeMilestoneEscrow(contract, milestone, {
        preferredProvider: preferredProvider || req.body.provider,
      });

      return res.json({
        success: true,
        providerPaymentReference: intent.providerTransactionReference,
        paymentReference: intent.paymentReference,
        paymentIntentId: intent.providerTransactionReference, // Deprecated compatibility alias
        clientSecret: intent.clientSecret,
        provider: intent.provider,
        amount: intent.grossAmount,
        currency: intent.currency,
        platformFee: intent.platformFee,
        netTalentAmount: intent.partnerAmount,
        mode: intent.provider === 'test' ? 'simulated' : 'live_stripe',
        intent,
      });
    } catch (err: any) {
      console.error('[Payment Orchestrator] Error initializing escrow funding:', err);
      return res.status(500).json({ error: err.message || 'Failed to initialize escrow funding.' });
    }
  });

  // 2. Confirm Escrow Funding (Server/Provider verification only - never client assertion alone)
  app.post('/api/payments/confirm-funding', requirePaymentAuth, handleConfirmFunding);

  // 3. Release Escrow Funds (Server-authoritative settlement to Talent)
  // Protected: Only client or admin. Talent strictly forbidden from releasing their own escrow.
  // Invariant: FUNDED !== RELEASED !== PAID_OUT
  app.post('/api/payments/release-milestone', requirePaymentAuth, async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).authenticatedUser as VerifiedPaymentUser;
      const callerUid = authUser.uid;
      const { contractId, milestoneId, userIsOrgAdmin } = req.body || {};

      if (!contractId || !milestoneId) {
        return res.status(400).json({ error: 'Missing release parameters (contractId, milestoneId).' });
      }

      const contract = await getContract(contractId);
      if (!contract) {
        return res.status(404).json({ error: `Contract ${contractId} not found.` });
      }

      // Invariant: Talent CANNOT release their own funds
      if (callerUid === contract.talentId && callerUid !== contract.creatorId) {
        return res.status(403).json({ error: 'Unauthorized: Talent cannot release their own escrow funds.' });
      }

      const isClient = callerUid === contract.creatorId || authUser.isCeo || (Boolean(userIsOrgAdmin) && Boolean(contract.organizationId));
      if (!isClient) {
        return res.status(403).json({ error: 'Unauthorized: Only the contract Client/Creator or Admin can release escrow funds.' });
      }

      // Step 1: ATOMIC PRE-PAYOUT RESERVATION
      // Atomically transitions milestone from held -> release_pending and establishes a stable, persistent payout reference
      const reservation = await reserveMilestonePayout({
        contractId,
        milestoneId,
        authorizedByUserId: callerUid,
        userIsOrgAdmin: isClient && callerUid !== contract.creatorId,
      });

      if (reservation.status === 'already_finalized') {
        const ledgerRecords = await getContractLedgerRecords(contractId);
        const existingLedger = ledgerRecords.find((r) => r.milestoneId === milestoneId && r.type === 'escrow_release');
        return res.json({
          success: true,
          message: 'Milestone is already released and finalized (idempotent replay).',
          milestone: reservation.milestone,
          contract: reservation.contract,
          ledgerRecord: existingLedger || null,
          payoutId: reservation.payoutReference,
          providerPayoutReference: reservation.payoutReference,
        });
      }

      // Check authoritative talent payout account
      const talentAccount = await getTalentPayoutAccount(contract.talentId);

      // Step 2: Trigger provider payout via Payment Orchestrator with the STABLE reserved reference
      const payoutResult = await defaultPaymentOrchestrator.executeMilestonePayout(
        reservation.contract,
        reservation.milestone,
        talentAccount,
        {
          payoutReference: reservation.payoutReference,
          attempt: reservation.milestone.payoutAttempts || 1,
        }
      );

      // Step 3: Handle uncertain outcomes / timeout / pending status
      if (payoutResult.isTimeout || payoutResult.status === 'pending') {
        // Recoverable state: preserve release_pending and stable reference without creating new transfers
        return res.status(202).json({
          success: true,
          pending: true,
          message: payoutResult.error || 'Payout submitted to provider; awaiting settlement verification.',
          milestone: reservation.milestone,
          contract: reservation.contract,
          payoutId: payoutResult.payoutId || reservation.payoutReference,
          providerPayoutReference: payoutResult.payoutId || reservation.payoutReference,
          provider: payoutResult.provider,
        });
      }

      if (payoutResult.status === 'failed') {
        // Record failure and transition milestone to payout_failed
        await recordMilestonePayoutFailure({
          contractId: contract.id,
          milestoneId: reservation.milestone.id,
          payoutReference: payoutResult.payoutId || reservation.payoutReference,
          reason: payoutResult.error || 'Provider rejected transfer',
          provider: payoutResult.provider,
        });
        return res.status(400).json({
          error: payoutResult.error || 'Payment provider rejected milestone payout transfer.',
          payoutId: payoutResult.payoutId || reservation.payoutReference,
        });
      }

      // Step 4: ATOMIC RELEASE FINALIZATION
      const releaseResult = await recordMilestonePaymentReleased({
        contractId: contract.id,
        milestoneId: reservation.milestone.id,
        authorizedByUserId: callerUid,
        providerPayoutReference: payoutResult.payoutId || reservation.payoutReference,
        transferId: payoutResult.payoutId || reservation.payoutReference,
        paymentProvider: payoutResult.provider,
        provider: payoutResult.provider as any,
        userIsOrgAdmin: isClient && callerUid !== contract.creatorId,
      });

      // Synchronously record payout success ledger record if provider confirmed settlement
      let payoutLedger;
      try {
        payoutLedger = await recordMilestonePayoutSuccess({
          contractId: contract.id,
          milestoneId: reservation.milestone.id,
          payoutReference: payoutResult.payoutId || reservation.payoutReference,
          provider: payoutResult.provider,
        });
      } catch (succErr) {
        console.warn('[Release] Payout success settlement will be confirmed via webhook:', succErr);
      }

      return res.json({
        success: true,
        message: 'Milestone payment released successfully.',
        milestone: releaseResult.milestone,
        contract: releaseResult.contract,
        ledgerRecord: releaseResult.ledgerRecord,
        payoutLedgerRecord: payoutLedger || null,
        payoutId: payoutResult.payoutId || reservation.payoutReference,
        providerPayoutReference: payoutResult.payoutId || reservation.payoutReference,
        provider: payoutResult.provider,
      });
    } catch (err: any) {
      console.error('[Payment Orchestrator] Error releasing milestone funds:', err);
      return res.status(400).json({ error: err.message || 'Failed to release escrow funds.' });
    }
  });

  // Reconcile uncertain payout outcomes using verified provider status
  app.post('/api/payments/reconcile-payout', requirePaymentAuth, async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).authenticatedUser as VerifiedPaymentUser;
      const callerUid = authUser.uid;
      const { contractId, milestoneId, provider } = req.body || {};

      if (!contractId || !milestoneId) {
        return res.status(400).json({ error: 'Missing required contractId or milestoneId.' });
      }

      const contract = await getContract(contractId);
      if (!contract) {
        return res.status(404).json({ error: `Contract ${contractId} not found.` });
      }

      const isParticipant =
        callerUid === contract.creatorId ||
        callerUid === contract.talentId ||
        authUser.isCeo;
      if (!isParticipant) {
        return res.status(403).json({ error: 'Unauthorized to reconcile payout for this contract.' });
      }

      const result = await reconcileMilestonePayout({
        contractId,
        milestoneId,
        provider,
      });

      return res.json({
        success: true,
        status: result.status,
        contract: result.contract,
        milestone: result.milestone,
        ledgerRecord: result.ledgerRecord || null,
      });
    } catch (err: any) {
      console.error('[Payment Orchestrator] Error reconciling payout:', err);
      return res.status(500).json({ error: err.message || 'Failed to reconcile payout.' });
    }
  });

  // 4. Process Escrow Refund (Client or Admin requested refund of held funds)
  app.post('/api/payments/refund-milestone', requirePaymentAuth, async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).authenticatedUser as VerifiedPaymentUser;
      const callerUid = authUser.uid;
      const { contractId, milestoneId, reason, userIsOrgAdmin } = req.body || {};

      if (!contractId || !milestoneId) {
        return res.status(400).json({ error: 'Missing refund parameters (contractId, milestoneId).' });
      }

      const contract = await getContract(contractId);
      if (!contract) {
        return res.status(404).json({ error: `Contract ${contractId} not found.` });
      }

      const isClient = callerUid === contract.creatorId || authUser.isCeo || (Boolean(userIsOrgAdmin) && Boolean(contract.organizationId));
      if (!isClient) {
        return res.status(403).json({ error: 'Unauthorized: Only the client or platform admin can authorize a refund.' });
      }

      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        return res.status(404).json({ error: `Milestone ${milestoneId} not found.` });
      }

      if (milestone.paymentState !== 'held') {
        return res.status(400).json({
          error: `Cannot refund milestone in '${milestone.paymentState}' state. Only held escrow funds can be refunded.`,
        });
      }

      // Execute refund through Payment Orchestrator
      const refundResult = await defaultPaymentOrchestrator.executeMilestoneRefund(contract, milestone, reason);

      const recordedRefund = await recordMilestoneRefund({
        contractId: contract.id,
        milestoneId: milestone.id,
        authorizedByUserId: callerUid,
        reason,
        providerRefundReference: refundResult.refundId,
        refundId: refundResult.refundId, // Deprecated compatibility alias
        paymentProvider: refundResult.provider,
        provider: refundResult.provider as any,
        userIsOrgAdmin: isClient && callerUid !== contract.creatorId,
      });

      return res.json({
        success: true,
        message: 'Milestone refund processed successfully.',
        milestone: recordedRefund.milestone,
        contract: recordedRefund.contract,
        ledgerRecord: recordedRefund.ledgerRecord,
        refundId: refundResult.refundId,
        providerRefundReference: refundResult.refundId,
        provider: refundResult.provider,
      });
    } catch (err: any) {
      console.error('[Payment Orchestrator] Error refunding milestone funds:', err);
      return res.status(400).json({ error: err.message || 'Failed to process refund.' });
    }
  });

  // 5. Talent Payout Account Setup (Server-Authoritative)
  // Protected: Only authenticated user can configure their own payout account.
  // Never trusts req.body.userId for authentication.
  app.post('/api/payments/payout-account', requirePaymentAuth, async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).authenticatedUser as VerifiedPaymentUser;
      const callerUid = authUser.uid;
      const {
        userId,
        country = 'US',
        defaultCurrency = 'USD',
        provider = 'stripe',
        accountNumber,
        bankCode,
        accountName,
      } = req.body || {};

      // Invariant: One partner cannot assign another partner's payout account
      if (userId && userId !== callerUid) {
        return res.status(403).json({
          error: 'Unauthorized: You can only configure or update your own talent payout account.',
        });
      }

      // Validate required provider parameters for Paystack (fail closed, no dummy defaults)
      if (provider === 'paystack') {
        if (!accountNumber || typeof accountNumber !== 'string' || !accountNumber.trim()) {
          return res.status(400).json({ error: 'Missing required payout parameter: accountNumber.' });
        }
        if (!bankCode || typeof bankCode !== 'string' || !bankCode.trim()) {
          return res.status(400).json({ error: 'Missing required payout parameter: bankCode.' });
        }
        if (!accountName || typeof accountName !== 'string' || !accountName.trim()) {
          return res.status(400).json({ error: 'Missing required payout parameter: accountName.' });
        }
      }

      // Server-authoritative setup through Payment Orchestrator
      const account = await defaultPaymentOrchestrator.createPayoutAccount(
        {
          userId: callerUid,
          country: String(country).toUpperCase(),
          currency: String(defaultCurrency).toUpperCase(),
          accountNumber: accountNumber ? String(accountNumber).trim() : undefined,
          bankCode: bankCode ? String(bankCode).trim() : undefined,
          accountName: accountName ? String(accountName).trim() : undefined,
        },
        provider
      );

      // Persist server-authoritative account metadata (does not persist raw bank credentials)
      const savedAccount = await setTalentPayoutAccount(account);

      return res.json({
        success: true,
        account: savedAccount,
      });
    } catch (err: any) {
      console.error('[Payment Orchestrator] Error configuring payout account:', err);
      return res.status(500).json({ error: err.message || 'Failed to configure payout account.' });
    }
  });

  // =========================================================================
  // 6. C-2B-1: Server-Authoritative Milestone Lifecycle Endpoints
  // =========================================================================

  // 6A. Start Milestone Work (Partner only, funded & predecessor approved)
  app.post('/api/contracts/milestones/start', requirePaymentAuth, async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).authenticatedUser as VerifiedPaymentUser;
      const callerUid = authUser.uid;
      const { contractId, milestoneId, idempotencyKey } = req.body || {};

      if (!contractId || !milestoneId) {
        return res.status(400).json({ error: 'Missing required parameters: contractId, milestoneId.' });
      }

      const result = await startMilestoneWork({
        contractId,
        milestoneId,
        callerUid,
        idempotencyKey,
      });

      return res.json({
        success: true,
        message: 'Milestone work successfully started.',
        contract: result.contract,
        milestone: result.milestone,
      });
    } catch (err: any) {
      const statusCode = err instanceof MilestoneLifecycleError ? err.statusCode : 500;
      return res.status(statusCode).json({ error: err.message || 'Failed to start milestone work.' });
    }
  });

  // 6B. Submit Milestone Deliverable (Partner only, versioned archive)
  app.post('/api/contracts/milestones/submit', requirePaymentAuth, async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).authenticatedUser as VerifiedPaymentUser;
      const callerUid = authUser.uid;
      const {
        contractId,
        milestoneId,
        deliveryNote,
        demoUrl,
        repoUrl,
        figmaUrl,
        additionalLinks,
        evidenceFiles,
        idempotencyKey,
      } = req.body || {};

      if (!contractId || !milestoneId) {
        return res.status(400).json({ error: 'Missing required parameters: contractId, milestoneId.' });
      }

      const result = await serverSubmitDeliverable({
        contractId,
        milestoneId,
        callerUid,
        deliveryNote,
        demoUrl,
        repoUrl,
        figmaUrl,
        additionalLinks,
        evidenceFiles,
        idempotencyKey,
      });

      return res.json({
        success: true,
        message: `Milestone deliverable version ${result.submissionVersion} submitted for review.`,
        contract: result.contract,
        milestone: result.milestone,
        submissionVersion: result.submissionVersion,
      });
    } catch (err: any) {
      const statusCode = err instanceof MilestoneLifecycleError ? err.statusCode : 500;
      return res.status(statusCode).json({ error: err.message || 'Failed to submit milestone deliverable.' });
    }
  });

  // 6C. Review Milestone Deliverable (Client or Org Admin only)
  app.post('/api/contracts/milestones/review', requirePaymentAuth, async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).authenticatedUser as VerifiedPaymentUser;
      const callerUid = authUser.uid;
      const { contractId, milestoneId, decision, feedback, userIsOrgAdmin, idempotencyKey } = req.body || {};

      if (!contractId || !milestoneId || !decision) {
        return res.status(400).json({ error: 'Missing required parameters: contractId, milestoneId, decision.' });
      }

      const result = await serverReviewDeliverable({
        contractId,
        milestoneId,
        callerUid,
        decision,
        feedback,
        userIsOrgAdmin: Boolean(userIsOrgAdmin),
        idempotencyKey,
      });

      return res.json({
        success: true,
        message: `Milestone deliverable review decision '${decision}' successfully recorded.`,
        contract: result.contract,
        milestone: result.milestone,
        decision: result.decision,
      });
    } catch (err: any) {
      const statusCode = err instanceof MilestoneLifecycleError ? err.statusCode : 500;
      return res.status(statusCode).json({ error: err.message || 'Failed to record milestone review decision.' });
    }
  });

  // 8. Server-Authoritative Trust Score & Projection Recalculation
  app.post('/api/trust-passport/recalculate', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or malformed authorization token.' });
      }

      const idToken = authHeader.substring(7).trim();
      const verifiedUser = await verifyFirebaseIdToken(idToken);
      if (!verifiedUser) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
      }

      const targetUid = (req.body?.targetUid || verifiedUser.uid).trim();

      // Only self or CEO/admin can recalculate
      if (targetUid !== verifiedUser.uid && !verifiedUser.isCeo) {
        return res.status(403).json({ error: 'Forbidden: You can only recalculate your own Trust Passport.' });
      }

      const result = await recomputeAndSyncPublicTrustPassport(
        targetUid,
        verifiedUser.uid,
        verifiedUser.emailVerified
      );

      return res.json(result);
    } catch (err: any) {
      console.error('[Trust Score Sync] Error recalculating trust passport:', err);
      return res.status(500).json({ error: err.message || 'Failed to recalculate Trust Passport.' });
    }
  });

  // 8B. Server-Authoritative Review of Identity Verification
  app.post('/api/verifications/review-identity', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or malformed authorization token.' });
      }

      const idToken = authHeader.substring(7).trim();
      const verifiedUser = await verifyFirebaseIdToken(idToken);
      if (!verifiedUser) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
      }

      const { verificationId, subjectUserId, status, rejectionReason } = req.body || {};
      if (!verificationId || !subjectUserId || !status) {
        return res.status(400).json({ error: 'Missing required parameters: verificationId, subjectUserId, status.' });
      }

      if (status !== 'verified' && status !== 'rejected') {
        return res.status(400).json({ error: 'Invalid status. Must be "verified" or "rejected".' });
      }

      // 1. Strict anti-self-verification check: User CANNOT review their own verification request
      if (verifiedUser.uid === subjectUserId) {
        return res.status(403).json({ error: 'Forbidden: You cannot review your own verification submission.' });
      }

      // 2. Strict verifier authorization: Must be CEO, token admin, or token verifier
      const isPrivilegedVerifier =
        verifiedUser.isCeo ||
        verifiedUser.claims?.role === 'admin' ||
        verifiedUser.claims?.admin === true ||
        verifiedUser.claims?.role === 'verifier' ||
        verifiedUser.claims?.verifier === true;

      if (!isPrivilegedVerifier) {
        return res.status(403).json({
          error: 'Forbidden: Only authorized verifiers and platform admins can review verifications.',
        });
      }

      const adminDb = getAdminFirestore();
      const now = new Date().toISOString();

      // 3. Update verifications document with verifier attribution and review outcome
      const verifRef = adminDb.collection('verifications').doc(verificationId);
      await verifRef.set(
        {
          status,
          reviewedAt: now,
          verifierUid: verifiedUser.uid,
          verifierId: verifiedUser.uid,
          rejectionReason: rejectionReason || null,
        },
        { merge: true }
      );

      // 4. Update subject's trustPassports with server authority
      const subjectPassportRef = adminDb.collection('trustPassports').doc(subjectUserId);
      await subjectPassportRef.set(
        {
          identityVerified: status === 'verified',
          updatedAt: now,
        },
        { merge: true }
      );

      // 5. Update subject's users document with server authority
      const subjectUserRef = adminDb.collection('users').doc(subjectUserId);
      await subjectUserRef.set(
        {
          identityVerified: status === 'verified',
          updatedAt: now,
        },
        { merge: true }
      );

      // 6. Automatically recalculate and sync subject's public trust passport projection
      const syncResult = await recomputeAndSyncPublicTrustPassport(subjectUserId, verifiedUser.uid);

      return res.json({
        success: true,
        status,
        subjectUserId,
        verificationId,
        trustScore: syncResult.trustScore,
        trustTier: syncResult.trustTier,
      });
    } catch (err: any) {
      console.error('[Verification Review] Error reviewing verification:', err);
      return res.status(500).json({ error: err.message || 'Failed to review verification.' });
    }
  });

  // In-memory rate limiting for IL AI endpoints (15 requests per minute per authenticated UID)
  const aiRateLimitMap = new Map<string, { count: number; windowStart: number }>();
  const checkAiRateLimit = (uid: string, limit = 15, windowMs = 60000): boolean => {
    const now = Date.now();
    const record = aiRateLimitMap.get(uid);
    if (!record || now - record.windowStart > windowMs) {
      aiRateLimitMap.set(uid, { count: 1, windowStart: now });
      return true;
    }
    if (record.count >= limit) {
      return false;
    }
    record.count++;
    return true;
  };

  // 9. Advisory AI endpoint (Compatibility route - Secured with ID-Token authentication)
  app.post('/api/ai/advisory', async (req: Request, res: Response) => {
    try {
      // SEC-AI-01: Require cryptographic Firebase ID token verification
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing authorization bearer token.' });
      }
      const idToken = authHeader.substring(7).trim();
      const verifiedUser = await verifyFirebaseIdToken(idToken);
      if (!verifiedUser) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
      }

      if (!checkAiRateLimit(verifiedUser.uid, 10)) {
        return res.status(429).json({ error: 'Rate limit exceeded for AI Advisory. Please try again in 1 minute.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is missing.' });
      }

      const { type, context } = req.body || {};

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
You are an expert, supportive AI Career Advisory Engine for GigLink V1.
Your mandate: Provide purely advisory insights, skill gap guidance, readiness assessments, and career recommendations.
You do NOT have authority to hire, grant certifications, make binding decisions, or execute contracts.

ADVISORY REQUEST TYPE: ${type || 'career_recommendation'}
USER CONTEXT:
- Active Persona: ${context?.persona || 'learner'}
- Current Skills: ${Array.isArray(context?.skills) ? context.skills.join(', ') : 'Not specified'}
- Target Role / Goal: ${context?.targetRole || 'Software Development & Design'}
- Trust Score: ${context?.trustScore ?? 'N/A'}
- Opportunity Context: ${context?.opportunityTitle || 'General Career Path'}

Generate a structured JSON response strictly adhering to this JSON format:
{
  "summary": "High-level guidance summary",
  "suggestions": ["Actionable step 1", "Actionable step 2", "Actionable step 3"],
  "recommendedSkillsToAcquire": ["Skill 1", "Skill 2"],
  "readinessScore": 85,
  "explanation": "Detailed contextual breakdown explaining why these recommendations fit the user's Trust Passport and persona progression."
}
Respond with raw valid JSON only, without markdown formatting blocks.
`;

      const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
      const fallbackModel = 'gemini-3.1-flash-lite';

      let responseText = '';
      try {
        const response = await ai.models.generateContent({
          model: primaryModel,
          contents: prompt,
        });
        responseText = response.text || '';
      } catch (primaryErr: any) {
        try {
          const fallbackResponse = await ai.models.generateContent({
            model: fallbackModel,
            contents: prompt,
          });
          responseText = fallbackResponse.text || '';
        } catch (fallbackErr) {
          // Graceful fallback response
          return res.json({
            summary: `Advisory career path for ${context?.persona || 'learner'}.`,
            suggestions: [
              'Complete verified deliverables on open milestones to raise Trust Score.',
              'Submit identity verification documents for Trust Passport badge.',
              'Explore verified opportunities aligned with software and digital contracts.',
            ],
            recommendedSkillsToAcquire: ['Verified Escrow Delivery', 'Client Communication'],
            readinessScore: 80,
            explanation: 'Based on your current persona and profile, completing verified work milestones will systematically unlock higher tier contracts.',
          });
        }
      }

      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);

      return res.json(parsedData);
    } catch (error: any) {
      console.error('Error generating advisory insight:', error);
      return res.status(500).json({
        error: 'Failed to generate advisory response.',
        details: error?.message || String(error),
      });
    }
  });

  // 10. GigLink Intelligence Layer (IL AI) V1 Authenticated Gateway
  app.post('/api/ai/v1/guidance', async (req: Request, res: Response) => {
    try {
      // 1. Bearer Token Verification
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or malformed authorization token.' });
      }

      const idToken = authHeader.substring(7).trim();
      const verifiedUser = await verifyFirebaseIdToken(idToken);
      if (!verifiedUser) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
      }

      // 2. Per-User Rate Limiting (15 requests / min)
      if (!checkAiRateLimit(verifiedUser.uid, 15)) {
        return res.status(429).json({
          error: 'Intelligence Layer request limit reached. Please wait a moment before asking again.',
        });
      }

      const payload = req.body as IlAiGuidanceRequest;
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Invalid request payload.' });
      }

      // 3. Server-authoritative context building with strict entity authorization
      const sanitizedContext = await buildSanitizedAiContext(verifiedUser.uid, payload);

      // 4. Generate structured guidance via Gemini with safety guardrails
      const guidance = await defaultIlAiService.generateGuidance(
        sanitizedContext,
        payload.message
      );

      return res.json({
        success: true,
        guidance,
      });
    } catch (err: any) {
      console.error('[IL AI V1 Gateway] Error processing guidance request:', err);
      return res.status(500).json({
        error: 'Unable to generate intelligence guidance at this time.',
        details: err?.message || 'Internal error',
      });
    }
  });

  // Vite middleware in development mode
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Static file serving in production mode
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GigLink V1 Express Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
