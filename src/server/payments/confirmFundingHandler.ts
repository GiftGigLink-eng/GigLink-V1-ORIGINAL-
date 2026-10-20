/**
 * Server-Authoritative Confirm Escrow Funding Handler (VERIF-02)
 *
 * Implements strict server-side validation for escrow funding confirmations:
 * 1. Checks milestone idempotency before external calls.
 * 2. Authoritatively verifies the payment with the provider adapter.
 * 3. Enforces that verified amount >= authoritative milestone amount (rejects underpayment).
 * 4. Enforces that verified currency matches authoritative milestone currency (rejects currency mismatch).
 * 5. Rejects missing, non-numeric, non-positive, or non-finite verified amounts.
 * 6. Derives payer identity, amount, currency, and contract strictly from authoritative records.
 * 7. Ignores client-supplied body overrides.
 * 8. Commits atomic milestone funding and deterministic ledger record.
 */

import { Request, Response } from 'express';
import { VerifiedPaymentUser } from './paymentAuth';
import { defaultPaymentOrchestrator } from './PaymentOrchestrator';
import { getContract } from '../../lib/contractService';
import {
  serverRecordMilestoneFunded as recordMilestoneFunded,
  serverGetContractLedgerRecords as getContractLedgerRecords,
} from './serverFinancialLedgerService';
import { isPaymentSandboxDisabled } from './paymentSandboxGuard';

export async function handleConfirmFunding(req: Request, res: Response): Promise<Response> {
  if (isPaymentSandboxDisabled()) {
    return res.status(403).json({
      error: 'Payments are disabled in sandbox preview mode. Funding confirmation and ledger mutations are blocked fail-closed.',
      code: 'PAYMENTS_SANDBOX_DISABLED',
    });
  }

  try {
    const authUser = (req as any).authenticatedUser as VerifiedPaymentUser | undefined;
    const callerUid = authUser?.uid;
    const {
      contractId,
      milestoneId,
      providerPaymentReference,
      paymentIntentId,
      paymentReference,
      provider = 'stripe',
      userIsOrgAdmin,
    } = req.body || {};

    const effectiveReference = providerPaymentReference || paymentReference || paymentIntentId;
    if (!contractId || !milestoneId || !effectiveReference) {
      return res.status(400).json({
        error: 'Missing required funding confirmation parameters (contractId, milestoneId, paymentReference).',
      });
    }

    const contract = await getContract(contractId);
    if (!contract) {
      return res.status(404).json({ error: `Contract ${contractId} not found.` });
    }

    if (contract.status !== 'active') {
      return res.status(400).json({
        error: `Escrow funding confirmation is only permitted on active contracts (current: ${contract.status}).`,
      });
    }

    if (contract.disputeStatus === 'open' || contract.disputeStatus === 'under_admin_review') {
      return res.status(400).json({
        error: 'Contract is currently in active dispute. Escrow funding is locked.',
      });
    }

    const isClient =
      callerUid === contract.creatorId ||
      authUser?.isCeo ||
      (Boolean(userIsOrgAdmin) && Boolean(contract.organizationId));
    if (!isClient) {
      return res.status(403).json({
        error: 'Unauthorized: Only the contract Client/Creator or Org Admin can confirm milestone escrow.',
      });
    }

    const milestone = contract.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      return res.status(404).json({ error: `Milestone ${milestoneId} not found on contract.` });
    }

    // Check invalid post-settlement states
    if ((milestone.paymentState as string) === 'released' || (milestone.paymentState as string) === 'paid_out') {
      return res.status(400).json({ error: 'Milestone funds have already been released to Talent.' });
    }
    if (milestone.paymentState === 'refunded') {
      return res.status(400).json({ error: 'Milestone has already been refunded.' });
    }

    // Idempotency: Prevent duplicate funding if already locked
    if (milestone.paymentState === 'held') {
      if (milestone.providerPaymentReference === effectiveReference) {
        const ledgerRecords = await getContractLedgerRecords(contract.id);
        const existingLedger = ledgerRecords.find((r) => r.providerPaymentReference === effectiveReference);
        return res.json({
          success: true,
          message: 'Milestone is already funded and locked (idempotent replay).',
          milestone,
          contract,
          ledgerRecord: existingLedger || null,
        });
      }
      return res.status(400).json({ error: 'Milestone is already fully funded and held in escrow.' });
    }

    // Server/Provider verification only (never trust client assertion alone)
    let verification;
    try {
      verification = await defaultPaymentOrchestrator.verifyEscrowFunding(
        effectiveReference,
        contract.id,
        milestone.id,
        provider
      );
    } catch (verifErr: any) {
      return res.status(400).json({
        error: verifErr?.message || 'Payment provider verification failed.',
      });
    }

    if (!verification || !verification.verified) {
      return res.status(400).json({ error: 'Payment provider verification failed.' });
    }

    // -------------------------------------------------------------
    // VERIF-02: Server-Authoritative Amount & Currency Verification
    // -------------------------------------------------------------
    const expectedCurrency = (milestone.currency || contract.scopeLock?.currency || 'USD').trim().toUpperCase();
    const authoritativeRequiredAmount = milestone.requiredFundingAmount || milestone.amount;

    if (
      typeof authoritativeRequiredAmount !== 'number' ||
      !Number.isFinite(authoritativeRequiredAmount) ||
      authoritativeRequiredAmount <= 0
    ) {
      return res.status(400).json({
        error: `Invalid milestone required funding amount for milestone ${milestone.id}.`,
      });
    }

    // Validate provider verified amount is present, numeric, finite, and positive
    if (
      verification.amount === undefined ||
      verification.amount === null ||
      typeof verification.amount !== 'number' ||
      !Number.isFinite(verification.amount) ||
      verification.amount <= 0
    ) {
      return res.status(400).json({
        error: `Payment provider verification error: Missing, non-numeric, or non-positive verified amount (${verification.amount}).`,
      });
    }

    // Validate provider verified currency is present and matches authoritative currency
    if (!verification.currency || typeof verification.currency !== 'string') {
      return res.status(400).json({
        error: 'Payment provider verification error: Missing verified currency from payment provider.',
      });
    }

    const verifiedCurrency = verification.currency.trim().toUpperCase();
    if (verifiedCurrency !== expectedCurrency) {
      return res.status(400).json({
        error: `Payment provider currency mismatch: Provider verified '${verifiedCurrency}', required '${expectedCurrency}'.`,
      });
    }

    // Reject underpayment: verified amount must be at least authoritativeRequiredAmount
    if (verification.amount < authoritativeRequiredAmount) {
      return res.status(400).json({
        error: `Payment provider underpayment rejected: Provider verified ${verification.amount} ${verifiedCurrency}, required ${authoritativeRequiredAmount} ${expectedCurrency}.`,
      });
    }

    if (!verification.providerTransactionReference || typeof verification.providerTransactionReference !== 'string') {
      return res.status(400).json({
        error: 'Payment provider verification error: Missing providerTransactionReference from payment provider.',
      });
    }

    // Server-authoritative funding execution: payer is strictly contract.creatorId
    const result = await recordMilestoneFunded({
      contractId: contract.id,
      milestoneId: milestone.id,
      payerId: contract.creatorId,
      payerName: contract.creatorName || 'Client',
      amount: verification.amount,
      currency: verifiedCurrency,
      paymentProvider: provider as any,
      providerPaymentReference: verification.providerTransactionReference,
      paymentIntentId: verification.providerTransactionReference,
      provider: provider as any,
    });

    return res.json({
      success: true,
      message: 'Escrow funding confirmed and locked.',
      milestone: result.milestone,
      contract: result.contract,
      ledgerRecord: result.ledgerRecord,
    });
  } catch (err: any) {
    console.error('[Payment Orchestrator] Error confirming escrow funding:', err);
    return res.status(500).json({ error: err.message || 'Failed to record escrow funding.' });
  }
}
