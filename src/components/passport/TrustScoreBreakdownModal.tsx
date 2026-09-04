import React from 'react';
import { Shield, CheckCircle2, AlertCircle, Award, Sparkles, X, ChevronRight, FileCheck, Layers, Mail } from 'lucide-react';
import { TrustScoreBreakdown } from '../../lib/trustScore';

interface TrustScoreBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  breakdown: TrustScoreBreakdown;
  onVerifyIdentityClick?: () => void;
  onAddProjectClick?: () => void;
}

export const TrustScoreBreakdownModal: React.FC<TrustScoreBreakdownModalProps> = ({
  isOpen,
  onClose,
  breakdown,
  onVerifyIdentityClick,
  onAddProjectClick,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        id="trust-score-breakdown-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
      >
        {/* Modal Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Trust Score Calculation Audit
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deterministic, earned credibility index (Max 100 points)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Key Distinction Callout */}
          <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-950 dark:text-amber-100">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Core Principle: Profile Completeness ≠ Trust Score</span>
            </div>
            <p className="leading-relaxed">
              Completing onboarding inputs gives you <strong className="font-semibold">{breakdown.profileCompletenessPercentage}% Profile Completeness</strong>, but trust score is strictly earned through verified documents, validated work deliverables, and attested credentials.
            </p>
          </div>

          {/* Current Score Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Earned Trust Score
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {breakdown.totalScore}
                  </span>
                  <span className="text-xs text-slate-400">/ 100 pts</span>
                </div>
              </div>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${breakdown.tierColor}`}>
                {breakdown.tier} Tier
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Profile Completeness
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {breakdown.profileCompletenessPercentage}%
                  </span>
                  <span className="text-xs text-slate-400">Form Progress</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 4 Pillars Mathematical Breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Deterministic Point Breakdown
            </h3>

            <div className="space-y-2.5">
              {/* 1. Identity Verification (40 pts) */}
              <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg mt-0.5 ${breakdown.isIdentityVerified ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        1. Official Identity Verification
                      </h4>
                      {breakdown.isIdentityVerified ? (
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold rounded-full">
                          Verified
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-medium rounded-full">
                          Unverified
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Administrative review of National ID, International Passport, or Driver's License.
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    +{breakdown.identityPoints}
                  </span>
                  <span className="text-[10px] text-slate-400 block">/ 40 pts</span>
                </div>
              </div>

              {/* 2. Verified Proof of Work (30 pts) */}
              <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg mt-0.5 ${breakdown.proofOfWorkPoints > 0 ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        2. Verified Proof of Work & Deliverables
                      </h4>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        ({breakdown.verifiedProjectsCount} verified project{breakdown.verifiedProjectsCount !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      +10 pts per verified project repository link or signed-off client milestone (Max 30 pts).
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    +{breakdown.proofOfWorkPoints}
                  </span>
                  <span className="text-[10px] text-slate-400 block">/ 30 pts</span>
                </div>
              </div>

              {/* 3. Verified Skills & Endorsements (20 pts) */}
              <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg mt-0.5 ${breakdown.skillsPoints > 0 ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        3. Verified Skills & Peer Endorsements
                      </h4>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        ({breakdown.verifiedSkillsCount} verified skill{breakdown.verifiedSkillsCount !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      +5 pts per third-party verified skill assessment or client endorsement (Max 20 pts). Self-declared skills earn 0 pts.
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    +{breakdown.skillsPoints}
                  </span>
                  <span className="text-[10px] text-slate-400 block">/ 20 pts</span>
                </div>
              </div>

              {/* 4. Profile Hygiene (10 pts) */}
              <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg mt-0.5 ${breakdown.profileHygienePoints > 0 ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        4. Profile Hygiene & Verified Email
                      </h4>
                      {breakdown.profileHygienePoints > 0 ? (
                        <span className="text-[10px] px-2 py-0.5 bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-semibold rounded-full">
                          Achieved
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-medium rounded-full">
                          Incomplete
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Awarded only if 100% of profile details are completed and account email is verified.
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    +{breakdown.profileHygienePoints}
                  </span>
                  <span className="text-[10px] text-slate-400 block">/ 10 pts</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actionable Roadmap */}
          {breakdown.actionableInsights.length > 0 && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Actionable Steps to Increase Your Score</span>
              </h3>
              <div className="space-y-2">
                {breakdown.actionableInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{insight.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold rounded">
                          +{insight.points} pts
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">Deterministic & Auditable Index</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
