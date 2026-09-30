import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface IntelligenceEmptyStateProps {
  title: string;
  description: string;
  contextualGuidance?: string;
  actionLabel?: string;
  actionTarget?: string;
}

export const IntelligenceEmptyState: React.FC<IntelligenceEmptyStateProps> = ({
  title,
  description,
  contextualGuidance,
  actionLabel,
  actionTarget,
}) => {
  const navigate = useNavigate();

  return (
    <div className="p-8 sm:p-12 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 space-y-4">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
        <Sparkles className="w-6 h-6" />
      </div>

      <div className="max-w-md mx-auto space-y-1.5">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
          {title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>

      {contextualGuidance && (
        <div className="max-w-md mx-auto p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100/60 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200">
          <span className="font-semibold text-indigo-700 dark:text-indigo-300">Context: </span>
          {contextualGuidance}
        </div>
      )}

      {actionLabel && actionTarget && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => navigate(actionTarget)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs min-h-[44px]"
          >
            <span>{actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
