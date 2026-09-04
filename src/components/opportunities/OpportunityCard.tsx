import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Opportunity,
  CandidateMatchProfile,
  UnifiedProfileData,
  UserProfile,
  TrustPassport,
  PublicTrustPassport,
  OpportunityMatchExplanation,
} from '../../types';
import { calculateOpportunityMatch } from '../../lib/matchingService';
import { MatchExplanationModal } from './MatchExplanationModal';
import {
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  ShieldCheck,
  Building2,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface OpportunityCardProps {
  opportunity: Opportunity;
  candidateProfile?:
    | CandidateMatchProfile
    | UnifiedProfileData
    | UserProfile
    | TrustPassport
    | PublicTrustPassport
    | null;
  matchExplanation?: OpportunityMatchExplanation | null;
  showMatchBadge?: boolean;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  candidateProfile,
  matchExplanation,
  showMatchBadge = true,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Derive match calculation deterministically if profile is provided and explanation not pre-calculated
  const match: OpportunityMatchExplanation | null =
    matchExplanation !== undefined
      ? matchExplanation
      : candidateProfile
      ? calculateOpportunityMatch(opportunity, candidateProfile)
      : null;

  const getTypeBadgeClass = (type: Opportunity['type']) => {
    switch (type) {
      case 'gig':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50';
      case 'contract':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/50';
      case 'apprenticeship':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/50';
      case 'bounty':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/50';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getMatchBadgeStyle = (percentage: number) => {
    if (percentage >= 80) {
      return {
        container: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/50',
        dot: 'bg-emerald-500',
        label: 'Strong Fit',
      };
    }
    if (percentage >= 60) {
      return {
        container: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/50',
        dot: 'bg-indigo-500',
        label: 'Good Fit',
      };
    }
    if (percentage >= 40) {
      return {
        container: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/50',
        dot: 'bg-amber-500',
        label: 'Moderate Fit',
      };
    }
    return {
      container: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400',
      label: 'Potential Fit',
    };
  };

  const formatCompensation = () => {
    if (opportunity.compensationType === 'competitive') {
      return 'Competitive';
    }
    if (opportunity.compensationMin && opportunity.compensationMax) {
      return `${opportunity.currency} ${opportunity.compensationMin.toLocaleString()} - ${opportunity.compensationMax.toLocaleString()}${
        opportunity.compensationType === 'hourly' ? '/hr' : ''
      }`;
    }
    if (opportunity.compensationMin) {
      return `${opportunity.currency} ${opportunity.compensationMin.toLocaleString()}${
        opportunity.compensationType === 'hourly' ? '/hr' : ''
      }`;
    }
    return 'Fixed Compensation';
  };

  const matchStyle = match ? getMatchBadgeStyle(match.matchPercentage) : null;
  const verifiedMatchedCount = match?.matchedSkills.filter((s) => s.verified).length || 0;
  const totalRequiredSkills = opportunity.requiredSkills?.length || 0;

  return (
    <>
      <div
        id={`opportunity-card-${opportunity.id}`}
        className="group relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all flex flex-col justify-between"
      >
        <div>
          {/* Top Badges & Meta */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border capitalize ${getTypeBadgeClass(
                opportunity.type
              )}`}
            >
              {opportunity.type}
            </span>

            {opportunity.recommendedTrustTier && (
              <div className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/40">
                <ShieldCheck className="w-3 h-3" />
                <span>{opportunity.recommendedTrustTier}</span>
              </div>
            )}
          </div>

          {/* Match Fit Badge Banner (If authenticated and profile evaluated) */}
          {showMatchBadge && match && matchStyle && (
            <div
              id={`match-badge-${opportunity.id}`}
              className={`mb-3.5 p-2.5 rounded-xl border flex items-center justify-between gap-2 ${matchStyle.container}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex items-center gap-1 font-extrabold text-xs shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{match.matchPercentage}% Match</span>
                </span>
                <span className="text-[11px] font-medium truncate opacity-90">
                  • {matchStyle.label}
                  {totalRequiredSkills > 0 && ` (${match.matchedSkills.length}/${totalRequiredSkills} skills)`}
                </span>
              </div>

              <button
                type="button"
                id={`why-match-btn-${opportunity.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsModalOpen(true);
                }}
                className="text-[11px] font-bold underline hover:no-underline shrink-0 px-2 py-1 rounded-md bg-white/70 dark:bg-black/30 hover:bg-white dark:hover:bg-black/50 transition-colors cursor-pointer"
                title="View explainable matching breakdown"
              >
                Why?
              </button>
            </div>
          )}

          {/* Title */}
          <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1 mb-1.5">
            {opportunity.title}
          </h3>

          {/* Creator / Organization */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-3">
            {opportunity.organizationId ? (
              <Building2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            ) : (
              <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span className="font-medium truncate">{opportunity.creatorName || 'Verified Creator'}</span>
          </div>

          {/* Description Snippet */}
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed mb-4">
            {opportunity.description}
          </p>

          {/* Required Skills Chips */}
          {opportunity.requiredSkills && opportunity.requiredSkills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {opportunity.requiredSkills.slice(0, 3).map((skill, index) => {
                const isMatched = match?.matchedSkills.some(
                  (m) => m.name.toLowerCase() === skill.toLowerCase()
                );
                const isVerifiedMatch = match?.matchedSkills.some(
                  (m) => m.name.toLowerCase() === skill.toLowerCase() && m.verified
                );

                return (
                  <span
                    key={index}
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md transition-colors ${
                      isVerifiedMatch
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40'
                        : isMatched
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isVerifiedMatch && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />}
                    <span>{skill}</span>
                  </span>
                );
              })}
              {opportunity.requiredSkills.length > 3 && (
                <span className="text-[10px] font-medium text-slate-400 px-1 py-0.5">
                  +{opportunity.requiredSkills.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer Info & Action */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-auto">
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-slate-100">
              <DollarSign className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{formatCompensation()}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 capitalize">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span>
                {opportunity.locationType}
                {opportunity.locationString ? ` (${opportunity.locationString})` : ''}
              </span>
            </div>
          </div>

          <Link
            to={`/opportunities/${opportunity.id}`}
            id={`view-opportunity-btn-${opportunity.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 px-3 py-2 rounded-xl transition-all min-h-[36px]"
          >
            <span>View</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Match Explanation Modal */}
      {match && (
        <MatchExplanationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          opportunityTitle={opportunity.title}
          match={match}
        />
      )}
    </>
  );
};
