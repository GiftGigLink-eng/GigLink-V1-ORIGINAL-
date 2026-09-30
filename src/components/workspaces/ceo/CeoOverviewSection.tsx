import React from 'react';
import { Users, Briefcase, FileText, CheckCircle, TrendingUp, Clock } from 'lucide-react';
import { CeoOverviewResponse } from '../../../types/ceo';

interface CeoOverviewSectionProps {
  data: CeoOverviewResponse | null;
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export const CeoOverviewSection: React.FC<CeoOverviewSectionProps> = ({ data, loading, error, onRefresh }) => {
  if (loading && !data) {
    return (
      <div id="ceo-overview-loading" className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Loading executive overview metrics...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div id="ceo-overview-error" className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">Database Query Failure</p>
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
      <div id="ceo-overview-empty" className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">No overview metrics available.</p>
      </div>
    );
  }

  const { members, opportunities, applications, contracts } = data;

  return (
    <div id="ceo-overview-section" className="space-y-6">
      {/* High-level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <div id="ceo-metric-members" className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Total Members</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {members.totalMembers.toLocaleString()}
          </div>
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Today: <strong className="text-slate-700 dark:text-slate-200 font-semibold">+{members.newMembersToday}</strong></span>
            <span>7 Days: <strong className="text-slate-700 dark:text-slate-200 font-semibold">+{members.newMembersLast7Days}</strong></span>
          </div>
        </div>

        {/* Opportunities */}
        <div id="ceo-metric-opportunities" className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Published Opportunities</span>
            <Briefcase className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {opportunities.totalOpportunities.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Open: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{opportunities.byStatus['open'] || opportunities.byStatus['published'] || 0}</strong></span>
            <span>In Review: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{opportunities.byStatus['in_review'] || 0}</strong></span>
          </div>
        </div>

        {/* Applications */}
        <div id="ceo-metric-applications" className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Total Applications</span>
            <FileText className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {applications.totalApplications.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Submitted: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{applications.byStatus['submitted'] || 0}</strong></span>
            <span>Accepted: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{applications.byStatus['accepted'] || 0}</strong></span>
          </div>
        </div>

        {/* Active Collaborations */}
        <div id="ceo-metric-contracts" className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Active Contracts</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {contracts.activeContracts.toLocaleString()}
          </div>
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Completed: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{contracts.completedContracts}</strong></span>
            <span>Total: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{contracts.totalContracts}</strong></span>
          </div>
        </div>
      </div>

      {/* Breakdown Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Persona Distribution */}
        <div id="ceo-breakdown-personas" className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
            <Users className="w-4 h-4 text-indigo-500" />
            <span>Persona Distribution</span>
          </div>
          <div className="space-y-2 text-xs">
            {Object.entries(members.membersByPersona).map(([persona, count]) => {
              const label = persona.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
              const percent = members.totalMembers > 0 ? Math.round((count / members.totalMembers) * 100) : 0;
              return (
                <div key={persona} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                  <span className="text-slate-600 dark:text-slate-400">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{count}</span>
                    <span className="text-[10px] text-slate-400">({percent}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Opportunity Statuses */}
        <div id="ceo-breakdown-opportunities" className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
            <Briefcase className="w-4 h-4 text-sky-500" />
            <span>Opportunities by Status</span>
          </div>
          <div className="space-y-2 text-xs">
            {Object.keys(opportunities.byStatus).length === 0 ? (
              <p className="text-slate-400 text-xs py-2">No opportunity status data recorded.</p>
            ) : (
              Object.entries(opportunities.byStatus).map(([status, count]) => {
                const label = status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
                return (
                  <div key={status} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                    <span className="text-slate-600 dark:text-slate-400">{label}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{count}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Contract Lifecycle */}
        <div id="ceo-breakdown-contracts" className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span>Contract Lifecycle</span>
          </div>
          <div className="space-y-2 text-xs">
            {Object.keys(contracts.byStatus).length === 0 ? (
              <p className="text-slate-400 text-xs py-2">No active contract data recorded.</p>
            ) : (
              Object.entries(contracts.byStatus).map(([status, count]) => {
                const label = status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
                return (
                  <div key={status} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                    <span className="text-slate-600 dark:text-slate-400">{label}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{count}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
