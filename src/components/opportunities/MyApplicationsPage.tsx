import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { OpportunityApplication } from '../../types';
import { getMyApplications, withdrawApplication } from '../../lib/opportunityService';
import {
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Ban,
  Shield,
  Compass,
} from 'lucide-react';

export const MyApplicationsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const fetchApplications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getMyApplications(user.uid);
      setApplications(data);
    } catch (err) {
      console.error('Failed to load my applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [user]);

  const handleWithdraw = async (app: OpportunityApplication) => {
    if (
      !window.confirm(
        'Are you sure you want to withdraw this application? This action cannot be undone.'
      )
    ) {
      return;
    }

    setWithdrawingId(app.id);
    try {
      await withdrawApplication(app);
      showToast('Application withdrawn successfully.', 'info');
      await fetchApplications();
    } catch (err) {
      console.error('Withdrawal failed:', err);
      showToast('Could not withdraw application.', 'error');
    } finally {
      setWithdrawingId(null);
    }
  };

  const getStatusBadge = (status: OpportunityApplication['status']) => {
    switch (status) {
      case 'accepted':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50';
      case 'shortlisted':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50';
      case 'under_review':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/50';
      case 'declined':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/50';
      case 'withdrawn':
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
      default:
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/50';
    }
  };

  return (
    <div id="my-applications-page" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
              <Sparkles className="w-3 h-3" />
              Applicant Hub
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            My Submitted Applications
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track your proposals, review feedback, and status transitions across opportunities.
          </p>
        </div>

        <Link
          to="/opportunities"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors min-h-[44px]"
        >
          <Briefcase className="w-4 h-4" />
          <span>Browse More Opportunities</span>
        </Link>
      </div>

      {/* Applications list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 animate-pulse h-36"
            />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 sm:p-14 text-center shadow-xs">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-200 dark:border-indigo-800/50">
            <Briefcase className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">
            No Active Applications Submitted Yet
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            You haven't submitted any proposals yet. Explore verified marketplace listings to discover gigs and contracts matching your skill catalog.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/opportunities"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs min-h-[44px]"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Marketplace</span>
            </Link>
            <Link
              to="/passport"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors min-h-[44px]"
            >
              <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Boost Trust Passport</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div
              key={app.id}
              id={`my-app-${app.id}`}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Link
                      to={`/opportunities/${app.opportunityId}`}
                      className="text-base font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      {app.opportunityTitle || 'Opportunity Listing'}
                    </Link>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border capitalize ${getStatusBadge(
                        app.status
                      )}`}
                    >
                      {app.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>Submitted on: {new Date(app.submittedAt).toLocaleDateString()}</span>
                    {app.proposedRate && (
                      <span>
                        • Rate: ${app.proposedRate} ({app.proposedRateType})
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {app.status === 'accepted' && (
                    <Link
                      id={`open-handoff-btn-${app.id}`}
                      to={`/opportunities/${app.opportunityId}/handoff/${app.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-xl transition-colors min-h-[44px] shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Kickoff & Milestones</span>
                    </Link>
                  )}

                  <Link
                    to={`/opportunities/${app.opportunityId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3 py-2 rounded-xl transition-colors min-h-[44px]"
                  >
                    <span>View Listing</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>

                  {app.status === 'submitted' && (
                    <button
                      onClick={() => handleWithdraw(app)}
                      disabled={withdrawingId === app.id}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 px-3 py-2 rounded-xl transition-colors min-h-[44px]"
                    >
                      <Ban className="w-3 h-3" />
                      <span>{withdrawingId === app.id ? 'Withdrawing...' : 'Withdraw'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Pitch Preview */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                {app.coverNote}
              </div>

              {/* Reviewer Feedback (if any) */}
              {app.creatorFeedback && (
                <div className="mt-3 p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs">
                  <span className="font-semibold text-indigo-900 dark:text-indigo-300 block mb-0.5">
                    Creator Decision Feedback:
                  </span>
                  <p className="italic text-indigo-800 dark:text-indigo-200">
                    "{app.creatorFeedback}"
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
