import React from 'react';
import { ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

export const CeoStage1StatusPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div id="ceo-stage1-view" className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Platform Owner Authorization Verified</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            CEO Control Center — Stage 1
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Server-authoritative cryptographic gateway active. Standing by for Stage 2 Overview & Financial Ledger deployment.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-semibold text-sm">
            <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Authentication Layer Invariants</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>Google Identity Toolkit cryptographic token signature verified</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>Server-side Firebase UID cryptographic match verified</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>Server-enforced authorization check passed (/api/ceo/auth-check)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>Unauthorized requests routed to non-revealing 404 handler</span>
            </li>
          </ul>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-semibold text-sm">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Authorized Principal</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-xs space-y-1.5">
            <div className="text-slate-500 dark:text-slate-400">Authenticated Email</div>
            <div className="font-mono text-slate-900 dark:text-white font-medium">{user?.email || 'N/A'}</div>
            <div className="text-slate-500 dark:text-slate-400 pt-1">User Identifier (UID)</div>
            <div className="font-mono text-slate-700 dark:text-slate-300 truncate">{user?.uid || 'N/A'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
