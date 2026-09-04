import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Opportunity } from '../../types';
import { getMyPostedOpportunities, updateOpportunity } from '../../lib/opportunityService';
import {
  Briefcase,
  PlusCircle,
  Clock,
  Users,
  Edit,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

export const MyOpportunitiesPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchOpportunities = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getMyPostedOpportunities(user.uid);
      setOpportunities(data);
    } catch (err) {
      console.error('Failed to load posted opportunities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [user]);

  const handleToggleStatus = async (opp: Opportunity) => {
    const nextStatus: Opportunity['status'] = opp.status === 'open' ? 'closed' : 'open';
    try {
      await updateOpportunity(opp.id, opp, { status: nextStatus });
      showToast(`Listing ${nextStatus === 'open' ? 're-opened' : 'closed'}.`, 'info');
      await fetchOpportunities();
    } catch (err) {
      console.error('Error toggling status:', err);
      showToast('Could not update status.', 'error');
    }
  };

  return (
    <div id="my-opportunities-page" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
              <Sparkles className="w-3 h-3" />
              Creator Management
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            My Posted Opportunities
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your project briefs, review applications, and toggle listing visibility.
          </p>
        </div>

        <Link
          to="/opportunities/create"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors min-h-[44px]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Post New Opportunity</span>
        </Link>
      </div>

      {/* Listings */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 animate-pulse h-36"
            />
          ))}
        </div>
      ) : opportunities.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 sm:p-14 text-center shadow-xs">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-200 dark:border-indigo-800/50">
            <Briefcase className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">
            No Opportunities Posted Yet
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            Create your first verified opportunity listing to attract verified talent with cryptographic Trust Passports and escrow milestone security.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/opportunities/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Post New Opportunity</span>
            </Link>
            <Link
              to="/creator/handoffs"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors min-h-[44px]"
            >
              <span>View Milestone Handoffs</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {opportunities.map((opp) => (
            <div
              key={opp.id}
              id={`posted-opp-${opp.id}`}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                    {opp.type}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase ${
                      opp.status === 'open'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {opp.status}
                  </span>
                  <Link
                    to={`/opportunities/${opp.id}`}
                    className="text-base font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    {opp.title}
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                  <span>Posted: {new Date(opp.createdAt).toLocaleDateString()}</span>
                  <span>• Category: {opp.category}</span>
                  <span>• Location: {opp.locationType}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to={`/opportunities/${opp.id}/applications`}
                  id={`manage-apps-${opp.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl transition-colors min-h-[38px]"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Review Applicants</span>
                </Link>

                <Link
                  to={`/opportunities/${opp.id}/edit`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-2 rounded-xl transition-colors min-h-[38px]"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Link>

                <button
                  onClick={() => handleToggleStatus(opp)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-2 rounded-lg"
                >
                  {opp.status === 'open' ? 'Close' : 'Reopen'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
