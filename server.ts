/**
 * Express Server for GigLink V1
 * Serves Vite middleware in development, hosts advisory AI endpoints,
 * auth OTP endpoints, and authoritative Stripe Payments, Escrow & Webhook handlers (Phase 4).
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import firebaseConfig from './firebase-applet-config.json';
import { defaultOtpManager } from './src/server/otpService';
import {
  createMilestonePaymentIntent,
  executeMilestonePayout,
  executeMilestoneRefund,
  verifyStripeWebhookSignature,
  getStripe,
} from './src/server/stripeService';
import {
  recordMilestoneFunded,
  recordMilestonePaymentReleased,
  recordMilestoneRefund,
  checkAndRecordWebhookEvent,
  getTalentPayoutAccount,
  setTalentPayoutAccount,
} from './src/lib/financialLedgerService';
import { getContract } from './src/lib/contractService';

async function startServer() {
  const app = express();
  const PORT = 3000;

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
        console.error('[Stripe Webhook] Error processing event:', err);
        return res.status(500).json({ error: 'Failed to process webhook event.' });
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

  // ==========================================
  // PHASE 4: FINANCIAL & PAYMENT API ENDPOINTS
  // ==========================================

  // 3. Create Escrow Funding PaymentIntent (Client Funds Milestone)
  // Server-authoritative: derives payable amount, currency, and participants from verified contract.
  app.post('/api/payments/fund-milestone', async (req: Request, res: Response) => {
    try {
      const { contractId, milestoneId, clientId, userIsOrgAdmin } = req.body || {};

      if (!contractId || !milestoneId || !clientId) {
        return res.status(400).json({ error: 'Missing required contract or party information.' });
      }

      // Authoritative contract lookup
      const contract = await getContract(contractId);
      if (!contract) {
        return res.status(404).json({ error: `Contract ${contractId} not found.` });
      }

      if (contract.status !== 'active') {
        return res.status(400).json({ error: `Escrow funding is only permitted on active contracts (current: ${contract.status}).` });
      }

      const isClient = clientId === contract.creatorId || !!userIsOrgAdmin;
      if (!isClient) {
        return res.status(403).json({ error: 'Unauthorized: Only the contract Client/Creator can fund milestone escrow.' });
      }

      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        return res.status(404).json({ error: `Milestone ${milestoneId} not found on contract.` });
      }

      // Check if already funded
      const requiredAmount = milestone.requiredFundingAmount || milestone.amount;
      const alreadyFunded = milestone.fundedAmount || (milestone.paymentState === 'held' || milestone.paymentState === 'released' ? milestone.amount : 0);
      const remainingFundingNeeded = Math.max(0, requiredAmount - alreadyFunded);

      if (remainingFundingNeeded <= 0 && milestone.paymentState === 'held') {
        return res.status(400).json({ error: 'Milestone is already fully funded and held in escrow.' });
      }
      if (milestone.paymentState === 'released') {
        return res.status(400).json({ error: 'Milestone funds have already been released to Talent.' });
      }
      if (milestone.paymentState === 'refunded') {
        return res.status(400).json({ error: 'Milestone has already been refunded.' });
      }

      const payableAmount = remainingFundingNeeded > 0 ? remainingFundingNeeded : milestone.amount;
      const payableCurrency = milestone.currency || contract.scopeLock.currency || 'USD';

      const intentResult = await createMilestonePaymentIntent({
        contractId: contract.id,
        milestoneId: milestone.id,
        amount: payableAmount,
        currency: payableCurrency,
        clientId: contract.creatorId,
        clientName: contract.creatorName || 'Client',
        talentId: contract.talentId,
        talentName: contract.talentName || 'Talent',
      });

      return res.json({
        success: true,
        ...intentResult,
      });
    } catch (err: any) {
      console.error('Error creating milestone payment intent:', err);
      return res.status(500).json({ error: err.message || 'Failed to initialize escrow funding.' });
    }
  });

  // 4. Confirm Escrow Funding (Server-authoritative confirmation / webhook fallback)
  app.post('/api/payments/confirm-funding', async (req: Request, res: Response) => {
    try {
      const { contractId, milestoneId, paymentIntentId, clientId, userIsOrgAdmin } = req.body || {};

      if (!contractId || !milestoneId || !clientId) {
        return res.status(400).json({ error: 'Missing required funding parameters.' });
      }

      const contract = await getContract(contractId);
      if (!contract) {
        return res.status(404).json({ error: `Contract ${contractId} not found.` });
      }

      const isClient = clientId === contract.creatorId || !!userIsOrgAdmin;
      if (!isClient) {
        return res.status(403).json({ error: 'Unauthorized: Only the contract Client/Creator can confirm milestone escrow.' });
      }

      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        return res.status(404).json({ error: `Milestone ${milestoneId} not found on contract.` });
      }

      // If live Stripe is active and paymentIntentId is provided, verify on Stripe API
      const stripe = getStripe();
      if (stripe && paymentIntentId && !paymentIntentId.startsWith('pi_sim_')) {
        try {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
          if (pi.status !== 'succeeded') {
            return res.status(400).json({ error: `PaymentIntent verification failed: Stripe status is '${pi.status}'.` });
          }
          if (pi.metadata?.contractId && pi.metadata.contractId !== contractId) {
            return res.status(400).json({ error: 'PaymentIntent metadata does not match target contract.' });
          }
        } catch (stripeErr: any) {
          console.error('[Stripe Confirmation] Verification failed:', stripeErr);
          return res.status(400).json({ error: `Stripe verification failed: ${stripeErr.message}` });
        }
      }

      const authoritativeAmount = milestone.requiredFundingAmount || milestone.amount;
      const authoritativeCurrency = milestone.currency || contract.scopeLock.currency || 'USD';

      const result = await recordMilestoneFunded({
        contractId: contract.id,
        milestoneId: milestone.id,
        payerId: contract.creatorId,
        payerName: contract.creatorName || 'Client',
        amount: authoritativeAmount,
        currency: authoritativeCurrency,
        paymentIntentId,
        provider: 'stripe',
      });

      return res.json({
        success: true,
        message: 'Escrow funding confirmed and locked.',
        milestone: result.milestone,
        contract: result.contract,
        ledgerRecord: result.ledgerRecord,
      });
    } catch (err: any) {
      console.error('Error confirming escrow funding:', err);
      return res.status(500).json({ error: err.message || 'Failed to record escrow funding.' });
    }
  });

  // 5. Release Escrow Funds (Server-authoritative settlement to Talent)
  app.post('/api/payments/release-milestone', async (req: Request, res: Response) => {
    try {
      const { contractId, milestoneId, authorizedByUserId, userIsOrgAdmin } = req.body || {};

      if (!contractId || !milestoneId || !authorizedByUserId) {
        return res.status(400).json({ error: 'Missing release parameters.' });
      }

      const contract = await getContract(contractId);
      if (!contract) {
        return res.status(404).json({ error: `Contract ${contractId} not found.` });
      }

      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        return res.status(404).json({ error: `Milestone ${milestoneId} not found.` });
      }

      // Check authoritative talent payout account (for assigned contract talent)
      let payoutAccount = null;
      try {
        const talentAccount = await getTalentPayoutAccount(contract.talentId);
        payoutAccount = talentAccount?.stripeAccountId;
      } catch (err) {
        console.warn('[Release] Could not retrieve talent payout account:', err);
      }

      // Trigger payout / transfer with authoritative contract amount and talent account
      const payoutResult = await executeMilestonePayout({
        contractId: contract.id,
        milestoneId: milestone.id,
        amount: milestone.amount,
        currency: milestone.currency || 'USD',
        talentId: contract.talentId,
        talentStripeAccountId: payoutAccount || undefined,
        sourcePaymentIntentId: milestone.paymentIntentId || undefined,
      });

      const releaseResult = await recordMilestonePaymentReleased({
        contractId: contract.id,
        milestoneId: milestone.id,
        authorizedByUserId,
        transferId: payoutResult.transferId,
        userIsOrgAdmin: !!userIsOrgAdmin,
      });

      return res.json({
        success: true,
        message: 'Milestone payment released successfully.',
        milestone: releaseResult.milestone,
        contract: releaseResult.contract,
        ledgerRecord: releaseResult.ledgerRecord,
      });
    } catch (err: any) {
      console.error('Error releasing milestone funds:', err);
      return res.status(400).json({ error: err.message || 'Failed to release escrow funds.' });
    }
  });

  // 6. Process Escrow Refund (Client or Admin requested refund of held funds)
  app.post('/api/payments/refund-milestone', async (req: Request, res: Response) => {
    try {
      const { contractId, milestoneId, authorizedByUserId, reason, userIsOrgAdmin } = req.body || {};

      if (!contractId || !milestoneId || !authorizedByUserId) {
        return res.status(400).json({ error: 'Missing refund parameters.' });
      }

      const contract = await getContract(contractId);
      if (!contract) {
        return res.status(404).json({ error: `Contract ${contractId} not found.` });
      }

      const isClient = authorizedByUserId === contract.creatorId || !!userIsOrgAdmin;
      if (!isClient) {
        return res.status(403).json({ error: 'Unauthorized: Only the client or platform admin can authorize a refund.' });
      }

      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        return res.status(404).json({ error: `Milestone ${milestoneId} not found.` });
      }

      if (milestone.paymentState !== 'held') {
        return res.status(400).json({ error: `Cannot refund milestone in '${milestone.paymentState}' state. Only held escrow funds can be refunded.` });
      }

      let stripeRefundId: string | undefined;
      if (milestone.paymentIntentId) {
        try {
          const refundExec = await executeMilestoneRefund({
            paymentIntentId: milestone.paymentIntentId,
            amount: milestone.fundedAmount || milestone.amount,
            reason,
          });
          stripeRefundId = refundExec.refundId;
        } catch (stErr: any) {
          console.error('[Refund] Stripe refund failed:', stErr);
          return res.status(500).json({ error: `Stripe refund failed: ${stErr.message}` });
        }
      }

      const refundResult = await recordMilestoneRefund({
        contractId: contract.id,
        milestoneId: milestone.id,
        authorizedByUserId,
        reason,
        refundId: stripeRefundId,
        userIsOrgAdmin: !!userIsOrgAdmin,
      });

      return res.json({
        success: true,
        message: 'Milestone refund processed successfully.',
        milestone: refundResult.milestone,
        contract: refundResult.contract,
        ledgerRecord: refundResult.ledgerRecord,
      });
    } catch (err: any) {
      console.error('Error refunding milestone funds:', err);
      return res.status(400).json({ error: err.message || 'Failed to process refund.' });
    }
  });

  // 7. Talent Stripe Connect Payout Setup
  app.post('/api/payments/payout-account', async (req: Request, res: Response) => {
    try {
      const { userId, country = 'US', defaultCurrency = 'USD' } = req.body || {};
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
      }

      const stripe = getStripe();
      let accountId = `acct_sim_${userId.substring(0, 8)}_${Date.now()}`;

      if (stripe) {
        try {
          const account = await stripe.accounts.create({
            type: 'express',
            country: country.toUpperCase(),
            capabilities: {
              transfers: { requested: true },
            },
            metadata: { userId },
          });
          accountId = account.id;
        } catch (stErr) {
          console.warn('[Stripe Connect] Could not create live express account, using simulation:', stErr);
        }
      }

      const talentAccount = await setTalentPayoutAccount({
        userId,
        stripeAccountId: accountId,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        defaultCurrency: defaultCurrency.toUpperCase(),
        country: country.toUpperCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return res.json({
        success: true,
        account: talentAccount,
      });
    } catch (err: any) {
      console.error('Error configuring payout account:', err);
      return res.status(500).json({ error: 'Failed to configure payout account.' });
    }
  });

  // 8. Advisory AI endpoint (Server-side Gemini API call)
  app.post('/api/ai/advisory', async (req: Request, res: Response) => {
    try {
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

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const responseText = response.text || '';
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
