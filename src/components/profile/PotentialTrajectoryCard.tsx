import React from 'react';
import {
  TrendingUp,
  Sparkles,
  Award,
  Zap,
  CheckCircle2,
  ChevronRight,
  Target,
} from 'lucide-react';
import { PotentialTrajectoryIndicator } from '../../types';

interface PotentialTrajectoryCardProps {
  trajectory: PotentialTrajectoryIndicator;
  verifiedProjectsCount?: number;
  verifiedSkillsCount?: number;
}

export const PotentialTrajectoryCard: React.FC<PotentialTrajectoryCardProps> = ({
  trajectory,
  verifiedProjectsCount = 0,
  verifiedSkillsCount = 0,
}) => {
  const getTierColor = (tier: PotentialTrajectoryIndicator['skillTrajectoryTier']) => {
    switch (tier) {
      case 'Master Practitioner':
        return 'text-amber-700 bg-amber-50 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'High-Impact Contributor':
        return 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'Accelerating Specialist':
        return 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Emerging Builder':
      default:
        return 'text-sky-700 bg-sky-50 dark:bg-sky-950/70 dark:text-sky-300 border-sky-200 dark:border-sky-800';
    }
  };

  return (
    <div
      id="potential-trajectory-card"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Potential Trajectory & Momentum
              </h2>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${getTierColor(
                  trajectory.skillTrajectoryTier
                )}`}
              >
                {trajectory.skillTrajectoryTier}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verified career velocity, deliverable milestones & domain depth
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Domain: {trajectory.primaryDomain}</span>
        </div>
      </div>

      {/* Summary Narrative */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3">
        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
          {trajectory.trajectorySummary}
        </p>

        {/* Momentum Metric Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              <strong className="text-slate-900 dark:text-white">
                {trajectory.verifiedMilestoneMomenta}
              </strong>{' '}
              Verified Deliverables
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Award className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              <strong className="text-slate-900 dark:text-white">{verifiedSkillsCount}</strong> Verified Skills
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Zap className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong className="text-slate-900 dark:text-white">{trajectory.momentumScore}%</strong> Execution Velocity
            </span>
          </div>
        </div>
      </div>

      {/* Next Milestone Target */}
      <div className="flex items-start gap-2.5 p-3.5 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 rounded-xl">
        <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
            Next Growth Milestone
          </span>
          <p className="text-xs text-amber-900 dark:text-amber-200">
            {trajectory.nextGrowthMilestone}
          </p>
        </div>
      </div>
    </div>
  );
};
