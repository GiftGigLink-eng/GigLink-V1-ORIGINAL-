import React from 'react';
import { Activity, UserPlus, Briefcase, FileCheck, CheckCircle2, ShieldCheck, Clock } from 'lucide-react';
import { CeoActivityResponse, CeoSanitizedActivityItem } from '../../../types/ceo';

interface CeoActivitySectionProps {
  data: CeoActivityResponse | null;
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export const CeoActivitySection: React.FC<CeoActivitySectionProps> = ({ data, loading, error, onRefresh }) => {
  if (loading && !data) {
    return (
      <div id="ceo-activity-loading" className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Loading sanitized executive activity stream...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div id="ceo-activity-error" className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">Platform Activity Query Failure</p>
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

  if (!data || data.events.length === 0) {
    return (
      <div id="ceo-activity-empty" className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">No platform activity events recorded yet.</p>
      </div>
    );
  }

  const getIcon = (type: CeoSanitizedActivityItem['type']) => {
    switch (type) {
      case 'member_joined':
        return <UserPlus className="w-4 h-4 text-indigo-500 shrink-0" />;
      case 'opportunity_created':
        return <Briefcase className="w-4 h-4 text-sky-500 shrink-0" />;
      case 'application_submitted':
        return <FileCheck className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'collaboration_completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'settlement_released':
        return <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />;
      default:
        return <Activity className="w-4 h-4 text-slate-500 shrink-0" />;
    }
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div id="ceo-activity-section" className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Displaying {data.events.length} sanitized ecosystem events</span>
        <span>PII & private messages strictly scrubbed</span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {data.events.map((evt) => (
          <div key={evt.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60">
                {getIcon(evt.type)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
                  {evt.title}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <span>{evt.category}</span>
                  {evt.amountFormatted && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{evt.amountFormatted}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-right">
              {evt.statusBadge && (
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {evt.statusBadge}
                </span>
              )}
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                <Clock className="w-3 h-3" />
                <span>{formatTime(evt.timestamp)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
