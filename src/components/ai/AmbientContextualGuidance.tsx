import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Compass,
  ArrowRight,
  X,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchIlAiGuidance } from '../../lib/ilAiService';
import { IlAiGuidancePayload, IlAiActionItem } from '../../types';

const DISMISSED_SESSION_PREFIX = 'giglink_il_dismissed_';

export const AmbientContextualGuidance: React.FC = () => {
  const { user, profile, unifiedProfile, activePersona } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [guidance, setGuidance] = useState<IlAiGuidancePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const pathname = location.pathname;

  // Extract entity hints from path (e.g. /opportunities/:id, /handoff/:id)
  const entityHints = useMemo(() => {
    const hints: { opportunityId?: string; contractId?: string; applicationId?: string } = {};
    const oppMatch = pathname.match(/\/opportunities\/([a-zA-Z0-9_-]+)/);
    if (oppMatch && oppMatch[1] && oppMatch[1] !== 'new') {
      hints.opportunityId = oppMatch[1];
    }
    const handoffMatch = pathname.match(/\/handoff\/([a-zA-Z0-9_-]+)/);
    if (handoffMatch && handoffMatch[1]) {
      hints.contractId = handoffMatch[1];
    }
    return hints;
  }, [pathname]);

  // Session-level suppression key for Zero Spam compliance
  const dismissalKey = `${DISMISSED_SESSION_PREFIX}${pathname}`;

  useEffect(() => {
    // Check if this route's guidance was already dismissed in this session
    try {
      if (sessionStorage.getItem(dismissalKey) === 'true') {
        setIsDismissed(true);
        return;
      }
    } catch {
      // Storage restricted fallback
    }

    setIsDismissed(false);

    if (!user) return;

    let isMounted = true;
    setLoading(true);

    // Call authenticated IL AI gateway for proactive contextual guidance (no arbitrary chat prompt)
    fetchIlAiGuidance({
      routePath: pathname,
      entityHints,
    })
      .then((data) => {
        if (isMounted && data) {
          setGuidance(data);
        }
      })
      .catch((err) => {
        // Ambient intelligence fails silently without interrupting the member
        console.warn('[Ambient IL AI] Guidance unavailable for this route:', err?.message || err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pathname, user, dismissalKey, entityHints]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem(dismissalKey, 'true');
    } catch {
      // Storage restricted fallback
    }
  };

  const handleAction = (action: IlAiActionItem) => {
    if (action.target) {
      navigate(action.target);
    }
  };

  // If dismissed, loading without cached data, or not available, stay completely invisible
  if (isDismissed || !guidance || loading) {
    return null;
  }

  const primaryAction = guidance.suggestedActions && guidance.suggestedActions.length > 0
    ? guidance.suggestedActions[0]
    : null;

  const memberName = unifiedProfile?.displayName || profile?.displayName || 'Member';

  return (
    <aside
      id="il-ambient-guidance-card"
      aria-label="Workspace Contextual Guidance"
      className="rounded-2xl border border-indigo-100 dark:border-indigo-950 bg-gradient-to-r from-indigo-50/70 via-slate-50/50 to-white dark:from-indigo-950/20 dark:via-slate-900/60 dark:to-slate-900 p-4 sm:p-5 shadow-xs transition-all animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Icon & Ambient Content */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5 p-2 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            {/* Header: Personalized Greeting & Persona Context */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {guidance.greeting || `Welcome, ${memberName}`}
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 capitalize">
                {activePersona} Workspace
              </span>
            </div>

            {/* Guidance Content: Quiet, Authoritative, Concise */}
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-3xl">
              {guidance.guidance || guidance.summary}
            </p>

            {/* Invariant or Contextual Tip */}
            {guidance.contextualTip && (
              <div className="pt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Compass className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate">{guidance.contextualTip}</span>
              </div>
            )}

            {/* Action Item: One Direct Workflow Next Step */}
            {primaryAction && primaryAction.target && (
              <div className="pt-2">
                <button
                  type="button"
                  id="il-ambient-next-action-btn"
                  onClick={() => handleAction(primaryAction)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-98 transition-all shadow-xs min-h-[44px]"
                >
                  <span>{primaryAction.label}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Subtle Dismiss Button */}
        <button
          type="button"
          id="il-ambient-dismiss-btn"
          onClick={handleDismiss}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Dismiss guidance for this session"
          aria-label="Dismiss workspace guidance"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
