/**
 * Contract Financials, Escrow & Settlement Section Component (Phase 4)
 * Presents comprehensive client and talent views of contract finances,
 * milestone funding controls, release triggers, and immutable ledger history.
 */

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Receipt,
  CreditCard,
  Building2,
  Info,
} from 'lucide-react';
import {
  GigLinkContract,
  ContractMilestone,
  FinancialLedgerRecord,
  ContractFinancialSummary,
  TalentStripeAccount,
} from '../../types';
import {
  deriveContractFinancialSummary,
  calculatePlatformFee,
} from '../../lib/financialService';
import {
  getContractLedgerRecords,
  getTalentPayoutAccount,
} from '../../lib/financialLedgerService';
import { postApi } from '../../lib/apiClient';

interface ContractFinancialSectionProps {
  contract: GigLinkContract;
  currentUserId: string;
  isManager: boolean; // Creator / Client
  isTalent: boolean; // Assigned Talent
  onContractUpdated: (updated: GigLinkContract) => void;
}

export const ContractFinancialSection: React.FC<ContractFinancialSectionProps> = ({
  contract,
  currentUserId,
  isManager,
  isTalent,
  onContractUpdated,
}) => {
  const [ledger, setLedger] = useState<FinancialLedgerRecord[]>([]);
  const [loadingLedger, setLoadingLedger] = useState<boolean>(true);
  const [payoutAccount, setPayoutAccount] = useState<TalentStripeAccount | null>(null);
  const [loadingPayout, setLoadingPayout] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showLedgerDetails, setShowLedgerDetails] = useState<boolean>(false);
  const [fundingModalMilestone, setFundingModalMilestone] = useState<ContractMilestone | null>(null);
  const [refundModalMilestone, setRefundModalMilestone] = useState<ContractMilestone | null>(null);
  const [refundReason, setRefundReason] = useState<string>('');

  const summary: ContractFinancialSummary = deriveContractFinancialSummary(contract, ledger);

  const fetchLedger = async () => {
    try {
      setLoadingLedger(true);
      const records = await getContractLedgerRecords(contract.id);
      setLedger(records);
    } catch (err) {
      console.warn('[FinancialUI] Error loading ledger records:', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  const fetchPayoutAccount = async () => {
    if (!isTalent) return;
    try {
      setLoadingPayout(true);
      const acc = await getTalentPayoutAccount(currentUserId);
      setPayoutAccount(acc);
    } catch (err) {
      console.warn('[FinancialUI] Error loading talent payout account:', err);
    } finally {
      setLoadingPayout(false);
    }
  };

  useEffect(() => {
    fetchLedger();
    fetchPayoutAccount();
  }, [contract.id, currentUserId]);

  // Client Action: Fund Milestone Escrow via Backend
  const handleFundMilestone = async (milestone: ContractMilestone) => {
    setActionError(null);
    setActionSuccess(null);
    setActionLoadingId(milestone.id);

    try {
      // 1. Call server to initiate PaymentIntent
      const initData = await postApi('/api/payments/fund-milestone', {
        contractId: contract.id,
        milestoneId: milestone.id,
        amount: milestone.amount,
        currency: milestone.currency,
        clientId: contract.creatorId,
        clientName: contract.creatorName,
        talentId: contract.talentId,
        talentName: contract.talentName,
      });

      if (!initData.success) {
        throw new Error(initData.error || 'Failed to initialize escrow payment.');
      }

      // 2. Authoritatively confirm funding
      const confirmData = await postApi('/api/payments/confirm-funding', {
        contractId: contract.id,
        milestoneId: milestone.id,
        paymentIntentId: initData.paymentIntentId,
        clientId: currentUserId,
        clientName: contract.creatorName,
        amount: milestone.amount,
        currency: milestone.currency,
      });

      if (!confirmData.success) {
        throw new Error(confirmData.error || 'Failed to confirm escrow funding.');
      }

      setActionSuccess(`Escrow successfully funded for "${milestone.title}". Funds are held securely.`);
      setFundingModalMilestone(null);
      onContractUpdated(confirmData.contract);
      await fetchLedger();
    } catch (err: any) {
      setActionError(err.message || 'Payment processing failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Client Action: Release Milestone Escrow Funds to Talent
  const handleReleaseMilestone = async (milestone: ContractMilestone) => {
    if (!window.confirm(`Are you sure you want to release $${milestone.amount} ${milestone.currency} to ${contract.talentName || 'Talent'}? This cannot be undone.`)) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setActionLoadingId(milestone.id);

    try {
      const data = await postApi('/api/payments/release-milestone', {
        contractId: contract.id,
        milestoneId: milestone.id,
        authorizedByUserId: currentUserId,
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to release payment.');
      }

      setActionSuccess(`Payment of $${milestone.amount} ${milestone.currency} released to talent.`);
      onContractUpdated(data.contract);
      await fetchLedger();
    } catch (err: any) {
      setActionError(err.message || 'Failed to release funds.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Client Action: Process Refund of Held Escrow Funds
  const handleRefundMilestone = async () => {
    if (!refundModalMilestone) return;

    setActionError(null);
    setActionSuccess(null);
    setActionLoadingId(refundModalMilestone.id);

    try {
      const data = await postApi('/api/payments/refund-milestone', {
        contractId: contract.id,
        milestoneId: refundModalMilestone.id,
        authorizedByUserId: currentUserId,
        reason: refundReason.trim() || 'Client authorized refund',
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to process refund.');
      }

      setActionSuccess(`Escrow refund processed for "${refundModalMilestone.title}".`);
      setRefundModalMilestone(null);
      setRefundReason('');
      onContractUpdated(data.contract);
      await fetchLedger();
    } catch (err: any) {
      setActionError(err.message || 'Failed to process refund.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Talent Action: Connect Stripe Payout Account
  const handleConnectPayoutAccount = async () => {
    setActionError(null);
    setActionSuccess(null);
    setLoadingPayout(true);

    try {
      const data = await postApi('/api/payments/payout-account', {
        userId: currentUserId,
        country: 'US',
        defaultCurrency: contract.scopeLock?.currency || 'USD',
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to link payout account.');
      }

      setPayoutAccount(data.account);
      setActionSuccess('Stripe Connect payout account linked. Released funds will be automatically transferred.');
    } catch (err: any) {
      setActionError(err.message || 'Failed to set up payout account.');
    } finally {
      setLoadingPayout(false);
    }
  };

  return (
    <section
      id="contract-financial-escrow-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Financial Settlement & Escrow</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Stripe Protected
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative milestone escrow lifecycle with guaranteed dual-party financial safety.
            </p>
          </div>
        </div>

        {/* Talent Stripe Payout Setup Badge */}
        {isTalent && (
          <div className="shrink-0">
            {payoutAccount ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Payouts Active ({payoutAccount.stripeAccountId.substring(0, 12)}...)</span>
              </div>
            ) : (
              <button
                type="button"
                id="connect-talent-payout-btn"
                disabled={loadingPayout}
                onClick={handleConnectPayoutAccount}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{loadingPayout ? 'Connecting...' : 'Set Up Stripe Payouts'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Notifications / Alerts */}
      {actionError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Financial Overview Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Contract Total
          </span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">
            ${summary.totalContractValue} {summary.currency}
          </span>
          <span className="text-[10px] text-slate-400 block">Agreed scope lock</span>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-1">
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider block flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Held in Escrow
          </span>
          <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
            ${summary.totalHeldInEscrow} {summary.currency}
          </span>
          <span className="text-[10px] text-amber-600/70 block">Protected pending approval</span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-1">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block flex items-center gap-1">
            <Unlock className="w-3 h-3" />
            {isTalent ? 'Earned & Released' : 'Released to Talent'}
          </span>
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            ${isTalent ? summary.netTalentEarned : summary.totalReleased} {summary.currency}
          </span>
          <span className="text-[10px] text-emerald-600/70 block">
            {isTalent ? `After 5% fee ($${summary.totalPlatformFees})` : 'Settled milestones'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Unfunded Balance
          </span>
          <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
            ${summary.totalUnfunded} {summary.currency}
          </span>
          <span className="text-[10px] text-slate-400 block">
            {summary.isFullyFunded ? 'Fully funded' : 'Pending client deposit'}
          </span>
        </div>
      </div>

      {/* Milestone Escrow Status & Controls Breakdown */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Milestone Escrow & Payment Controls
        </h3>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {contract.milestones.map((m, idx) => {
            const isHeld = m.paymentState === 'held';
            const isReleased = m.paymentState === 'released';
            const isUnfunded = m.paymentState === 'unfunded';
            const isRefunded = m.paymentState === 'refunded';
            const isApproved = m.reviewState === 'approved' || m.status === 'completed';
            const isEligibleForRelease = isHeld && isApproved;
            const feeInfo = calculatePlatformFee(m.amount);
            const isLoadingThis = actionLoadingId === m.id;

            return (
              <div
                key={m.id}
                id={`milestone-financial-row-${m.id}`}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400">
                      M{idx + 1}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {m.title}
                    </h4>

                    {/* Escrow State Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider flex items-center gap-1 ${
                        isReleased
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : isHeld
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                          : isRefunded
                          ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      {isReleased && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                      {isHeld && <Lock className="w-3 h-3 text-amber-600" />}
                      {isUnfunded && <AlertCircle className="w-3 h-3 text-rose-600" />}
                      <span>{m.paymentState}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Gross: ${m.amount} {m.currency}
                    </span>
                    <span>•</span>
                    <span>Platform Fee (5%): ${feeInfo.platformFeeAmount}</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Net Talent: ${feeInfo.netTalentAmount}
                    </span>
                  </div>
                </div>

                {/* Actions based on role and state */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Client: Fund Unfunded Milestone */}
                  {isManager && isUnfunded && (
                    <button
                      type="button"
                      id={`fund-milestone-btn-${m.id}`}
                      disabled={isLoadingThis || contract.status !== 'active'}
                      onClick={() => setFundingModalMilestone(m)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs min-h-[38px]"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{isLoadingThis ? 'Processing...' : `Fund Escrow ($${m.amount})`}</span>
                    </button>
                  )}

                  {/* Client: Release Funds if Approved & Held */}
                  {isManager && isHeld && isApproved && (
                    <button
                      type="button"
                      id={`release-payment-btn-${m.id}`}
                      disabled={isLoadingThis}
                      onClick={() => handleReleaseMilestone(m)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs min-h-[38px]"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>{isLoadingThis ? 'Releasing...' : 'Release Escrow to Talent'}</span>
                    </button>
                  )}

                  {/* Client: Refund Held Funds */}
                  {isManager && isHeld && (
                    <button
                      type="button"
                      id={`refund-milestone-btn-${m.id}`}
                      disabled={isLoadingThis}
                      onClick={() => {
                        setRefundModalMilestone(m);
                        setRefundReason('');
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[38px]"
                    >
                      Refund
                    </button>
                  )}

                  {/* Talent Informational State */}
                  {isTalent && isUnfunded && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Awaiting client deposit
                    </span>
                  )}
                  {isTalent && isHeld && !isApproved && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Funds locked in escrow
                    </span>
                  )}
                  {isTalent && isReleased && (
                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Paid: ${feeInfo.netTalentAmount}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Immutable Financial Ledger Audit Section */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          id="toggle-financial-ledger-btn"
          onClick={() => setShowLedgerDetails(!showLedgerDetails)}
          className="w-full flex items-center justify-between py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-400" />
            <span>Immutable Financial Ledger & Audit Trail ({ledger.length} Records)</span>
          </span>
          {showLedgerDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showLedgerDetails && (
          <div className="mt-4 space-y-2 animate-in fade-in duration-150">
            {ledger.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <p className="text-xs text-slate-500">No financial transactions recorded on this contract yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ledger.map((record) => (
                  <div
                    key={record.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white capitalize">
                          {record.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {record.id.substring(0, 14)}...
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">{record.description}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                          ${record.amount} {record.currency}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {new Date(record.createdAt).toLocaleDateString()} {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Funding Modal */}
      {fundingModalMilestone && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Fund Milestone Escrow
                </h3>
                <p className="text-xs text-slate-500">
                  Stripe Payment & Secure Escrow Deposit
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Milestone:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{fundingModalMilestone.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Deposit Amount:</span>
                <span className="font-bold text-emerald-600">${fundingModalMilestone.amount} {fundingModalMilestone.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Platform Fee (5%):</span>
                <span className="text-slate-600">${calculatePlatformFee(fundingModalMilestone.amount).platformFeeAmount}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1.5">
                <span className="text-slate-700 dark:text-slate-300 font-semibold">Net Talent Payout upon Release:</span>
                <span className="font-bold text-emerald-600">${calculatePlatformFee(fundingModalMilestone.amount).netTalentAmount}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Deposited funds are held securely in escrow and will only be released to the talent once deliverables are reviewed and approved by you.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFundingModalMilestone(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-escrow-payment-btn"
                disabled={actionLoadingId === fundingModalMilestone.id}
                onClick={() => handleFundMilestone(fundingModalMilestone)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors min-h-[44px]"
              >
                {actionLoadingId === fundingModalMilestone.id ? 'Authorizing...' : `Pay & Fund Escrow ($${fundingModalMilestone.amount})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModalMilestone && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Authorize Escrow Refund
                </h3>
                <p className="text-xs text-slate-500">
                  Refund held escrow balance to client account
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Refund
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Explain the reason for refunding this held milestone..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefundModalMilestone(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-escrow-refund-btn"
                disabled={actionLoadingId === refundModalMilestone.id}
                onClick={handleRefundMilestone}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors min-h-[44px]"
              >
                {actionLoadingId === refundModalMilestone.id ? 'Processing...' : `Refund $${refundModalMilestone.amount}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
