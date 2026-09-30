import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Plus,
  ArrowRight,
  ExternalLink,
  Briefcase,
  MapPin,
  Clock,
} from 'lucide-react';
import { Opportunity } from '../../types';
import { getMyPostedOpportunities, getPublicOpportunitiesByCreator } from '../../lib/opportunityService';

export interface ClientOpportunitiesSectionProps {
  userId?: string;
  opportunities?: Opportunity[];
  isLoading?: boolean;
  isReadOnly?: boolean;
  emptyMessage?: string;
}

export const ClientOpportunitiesSection: React.FC<ClientOpportunitiesSectionProps> = ({
  userId,
  opportunities: initialOpportunities,
  isLoading: initialLoading,
  isReadOnly = false,
  emptyMessage,
}) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(initialOpportunities || []);
  const [loading, setLoading] = useState<boolean>(
    initialLoading ?? (Boolean(userId) && initialOpportunities === undefined)
  );

  useEffect(() => {
    if (initialOpportunities !== undefined) {
      setOpportunities(initialOpportunities);
      setLoading(false);
      return;
    }

    if (!userId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchOpportunities = async () => {
      setLoading(true);
      try {
        const results = isReadOnly
          ? await getPublicOpportunitiesByCreator(userId)
          : await getMyPostedOpportunities(userId);
        if (isMounted) {
          setOpportunities(results);
        }
      } catch (err) {
        console.warn('[ClientOpportunitiesSection] Failed to load opportunities:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOpportunities();

    return () => {
      isMounted = false;
    };
  }, [userId, initialOpportunities, isReadOnly]);

  const activeCount = opportunities.filter((o) => o.status === 'open' || o.status === 'published').length;

  return (
    <div
      id="profile-client-opportunities-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {isReadOnly ? `Open Opportunities (${activeCount})` : `Posted Opportunities (${opportunities.length})`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeCount} active open {activeCount === 1 ? 'listing' : 'listings'} seeking verified talent
            </p>
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <Link
              id="manage-opportunities-link"
              to="/client/opportunities"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 min-h-[44px] px-2 transition-colors"
            >
              <span>Manage All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              id="post-opportunity-btn"
              to="/opportunities/create"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs min-h-[44px] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Post Opportunity</span>
            </Link>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Loading posted opportunities...</p>
        </div>
      ) : opportunities.length === 0 ? (
        <div
          id="client-opportunities-empty"
          className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Briefcase className="w-5 h-5" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {isReadOnly
              ? emptyMessage || 'No open opportunities currently posted by this client.'
              : 'You have not posted any opportunities yet. Create your first listing to connect with verified talent.'}
          </p>
          {!isReadOnly && (
            <Link
              to="/opportunities/create"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl min-h-[44px] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Your First Listing</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {opportunities.slice(0, 6).map((opp) => (
            <div
              key={opp.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex flex-col justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      opp.status === 'open' || opp.status === 'published'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : opp.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opp.status}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {opp.currency || 'USD'}{' '}
                    {opp.compensationMin && opp.compensationMax
                      ? `${opp.compensationMin} - ${opp.compensationMax}`
                      : opp.compensationMin || opp.compensationMax || 'Competitive'}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                  {opp.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {opp.description}
                </p>

                {opp.requiredSkills && opp.requiredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {opp.requiredSkills.slice(0, 3).map((sk) => (
                      <span
                        key={sk}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-medium"
                      >
                        {sk}
                      </span>
                    ))}
                    {opp.requiredSkills.length > 3 && (
                      <span className="text-[10px] text-slate-400 self-center">
                        +{opp.requiredSkills.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                <span className="text-slate-400 text-[10px] capitalize">
                  {opp.type} • {opp.locationType}
                </span>
                {isReadOnly ? (
                  <Link
                    to={`/opportunities/${opp.id}`}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 min-h-[44px] py-1"
                  >
                    <span>View & Apply</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                ) : (
                  <Link
                    to={`/opportunities/${opp.id}/applications`}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 min-h-[44px] py-1"
                  >
                    <span>View Applicants</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
