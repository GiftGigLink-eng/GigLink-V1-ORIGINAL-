import React, { useEffect } from 'react';
import { OpportunityMatchExplanation } from '../../types';
import {
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  Layers,
  Award,
  Info,
} from 'lucide-react';

interface MatchExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityTitle: string;
  match: OpportunityMatchExplanation;
}

export const MatchExplanationModal: React.FC<MatchExplanationModalProps> = ({
  isOpen,
  onClose,
  opportunityTitle,
  match,
}) => {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { breakdown, matchedSkills, missingSkills, trustTierFit, experienceFit, summary } = match;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60';
    if (score >= 60) return 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/60';
    if (score >= 40) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60';
    return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
  };

  const getTierFitBadge = () => {
    switch (trustTierFit) {
      case 'exceeds':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            <CheckCircle2 className="w-3 h-3" /> Exceeds Requirement
          </span>
        );
      case 'meets':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
            <CheckCircle2 className="w-3 h-3" /> Meets Requirement
          </span>
        );
      case 'below':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <AlertCircle className="w-3 h-3" /> Below Recommended Tier
          </span>
        );
    }
  };

  return (
    <div
      id="match-explanation-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="match-explanation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-modal-title"
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh] text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-0.5 rounded-full border border-indigo-200/50 dark:border-indigo-800/40">
                <Sparkles className="w-3 h-3" />
                Explainable Match Breakdown
              </span>
            </div>
            <h2 id="match-modal-title" className="text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
              {opportunityTitle}
            </h2>
          </div>

          <button
            onClick={onClose}
            id="close-match-explanation-modal"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close match explanation modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overall Score Badge */}
        <div className="my-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Deterministic Fit Score
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
              {summary}
            </p>
          </div>
          <div
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl border font-black text-xl shrink-0 ${getScoreColor(
              match.matchPercentage
            )}`}
          >
            <span>{match.matchPercentage}%</span>
            <span className="text-[10px] font-semibold tracking-tight uppercase">Fit</span>
          </div>
        </div>

        {/* Breakdown Items */}
        <div className="space-y-4">
          {/* 1. Verified Skills */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Verified Skill Overlap (Max 40 pts)
                </span>
              </div>
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                {breakdown.verifiedSkillPoints} / 40 pts
              </span>
            </div>

            {matchedSkills.filter((s) => s.verified).length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {matchedSkills
                  .filter((s) => s.verified)
                  .map((s, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      {s.name} (Verified)
                    </span>
                  ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                No third-party verified skills match the requirements for this listing.
              </p>
            )}
          </div>

          {/* 2. Base / Self-Declared Skills */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Base Skill Match (Max 10 pts)
                </span>
              </div>
              <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                {breakdown.selfDeclaredSkillPoints} / 10 pts
              </span>
            </div>

            {matchedSkills.filter((s) => !s.verified).length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {matchedSkills
                  .filter((s) => !s.verified)
                  .map((s, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    >
                      {s.name} (Self-Declared)
                    </span>
                  ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {matchedSkills.filter((s) => s.verified).length > 0
                  ? 'All matched skills are third-party verified.'
                  : 'No self-declared skill overlaps found.'}
              </p>
            )}
          </div>

          {/* 3. Trust Tier Suitability */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Trust Tier Suitability (Max 30 pts)
                </span>
              </div>
              <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                {breakdown.trustTierPoints} / 30 pts
              </span>
            </div>
            <div className="mt-1">{getTierFitBadge()}</div>
          </div>

          {/* 4. Experience / Role Alignment */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Experience / Role Alignment (Max 20 pts)
                </span>
              </div>
              <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                {breakdown.experiencePoints} / 20 pts
              </span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300">
              {experienceFit ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Your experience level meets or exceeds the listing requirement.
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Listing seeks a higher experience level. Partial credit awarded.
                </span>
              )}
            </div>
          </div>

          {/* Missing Skills (Opportunities to level up) */}
          {missingSkills.length > 0 && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Skills to Acquire or Verify ({missingSkills.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {missingSkills.map((s, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Security & Immutability Guarantee Footer */}
        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
          <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          <span>
            Deterministic match based on verified records. Match scoring does not alter your Trust Score.
          </span>
        </div>
      </div>
    </div>
  );
};
