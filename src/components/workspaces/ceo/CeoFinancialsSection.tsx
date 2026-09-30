import React from 'react';
import { DollarSign, ShieldAlert, CheckCircle2, Lock, ArrowDownLeft, RotateCcw, AlertTriangle } from 'lucide-react';
import { CeoFinancialsResponse } from '../../../types/ceo';

interface CeoFinancialsSectionProps {
  data: CeoFinancialsResponse | null;
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export const CeoFinancialsSection: React.FC<CeoFinancialsSectionProps> = ({ data, loading, error, onRefresh }) => {
  if (loading && !data) {
    return (
      <div id="ceo-financials-loading" className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Loading platform financial ledger & escrow balances...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div id="ceo-financials-error" className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">Financial Ledger Query Failure</p>
        <p className="text-xs text-rose-600 dark:text-rose-300 max-w-md mx-auto">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs font-medium bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-800/80 transition"
          >
            Retry Query
          </button>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div id="ceo-financials-empty" className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">No financial metrics available.</p>
      </div>
    );
  }

  const currencies = Object.keys(data.byCurrency);

  return (
    <div id="ceo-financials-section" className="space-y-6">
      {/* Historical Ledger Event Summary Bar */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-500" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">Historical Ledger Activity</span>
        </div>
        <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
          <span>Total Ledger Records: <strong className="text-slate-900 dark:text-white font-mono">{data.historicalLedgerSummary.totalRecords}</strong></span>
          <span>Funded Events: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{data.historicalLedgerSummary.fundedEvents}</strong></span>
          <span>Released Events: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{data.historicalLedgerSummary.releasedEvents}</strong></span>
          <span>Refund Events: <strong className="text-amber-600 dark:text-amber-400 font-mono">{data.historicalLedgerSummary.refundEvents}</strong></span>
        </div>
      </div>

      {/* Currency Sections - strictly segregated by currency */}
      {currencies.map((curr) => {
        const fin = data.byCurrency[curr];

        return (
          <div key={curr} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span>Currency: {curr}</span>
              </h3>
              <span className="text-[11px] text-slate-500">
                {fin.totalContractsEvaluated} contracts evaluated
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Held in Escrow */}
              <div id={`ceo-escrow-held-${curr}`} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                  <span>Currently Held in Escrow</span>
                  <Lock className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono mt-2">
                  ${fin.heldEscrow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  Across {fin.activeContractsWithEscrow} active contract{fin.activeContractsWithEscrow === 1 ? '' : 's'}
                </div>
              </div>

              {/* Total Settled Volume */}
              <div id={`ceo-settled-volume-${curr}`} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                  <span>Total Settled Volume</span>
                  <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono mt-2">
                  ${fin.totalSettledVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  Completed releases to talent
                </div>
              </div>

              {/* Platform Fees Collected */}
              <div id={`ceo-platform-fees-${curr}`} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                  <span>Platform Fees Collected</span>
                  <ArrowDownLeft className="w-4 h-4 text-sky-500" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono mt-2">
                  ${fin.platformFeesCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  Derived from 5% standard protocol fee
                </div>
              </div>

              {/* Disputed Escrow */}
              <div id={`ceo-disputed-escrow-${curr}`} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                  <span>Disputed Escrow</span>
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                </div>
                <div className={`text-2xl font-bold tracking-tight font-mono mt-2 ${fin.disputedEscrow > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                  ${fin.disputedEscrow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  Funds under formal review
                </div>
              </div>

              {/* Refunded Funds */}
              <div id={`ceo-refunded-funds-${curr}`} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                  <span>Total Refunded Funds</span>
                  <RotateCcw className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono mt-2">
                  ${fin.refundedFunds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  Returned to clients
                </div>
              </div>

              {/* Total Ledger Records */}
              <div id={`ceo-ledger-count-${curr}`} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                  <span>Ledger Transactions</span>
                  <DollarSign className="w-4 h-4 text-slate-500" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono mt-2">
                  {fin.totalLedgerRecords}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  Recorded in financialLedger
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
