import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Opportunity, OpportunityApplication } from '../../types';
import {
  getOpportunityById,
  getApplicationsForOpportunity,
  reviewApplication,
} from '../../lib/opportunityService';
import { ApplicantReviewDrawer } from './ApplicantReviewDrawer';
import { OpportunityProposalsSection } from './OpportunityProposalsSection';
import {
  ChevronLeft,
  Briefcase,
  ShieldCheck,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Sparkles,
  AlertCircle,
  Filter,
  Eye,
  Layers,
  FileText,
} from 'lucide-react';

export const ManageApplicationsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAppForDrawer, setSelectedAppForDrawer] = useState<OpportunityApplication | null>(null);
  const [updating, setUpdating] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'proposals' | 'applications'>('proposals');

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const opp = await getOpportunityById(id);
      setOpportunity(opp);

      const creatorId = opp?.creatorId || user?.uid;
      const apps = await getApplicationsForOpportunity(id, creatorId);
      setApplications(apps);
    } catch (err) {
      console.error('Error loading applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleUpdateStatus = async (
    app: OpportunityApplication,
    newStatus: 'under_review' | 'shortlisted' | 'accepted' | 'declined',
    feedback?: string
  ) => {
    setUpdating(true);
    try {
      await reviewApplication(app, newStatus, feedback);
      showToast(`Applicant status updated to ${newStatus.replace('_', ' ')}`, 'success');
      if (selectedAppForDrawer && selectedAppForDrawer.id === app.id) {
        setSelectedAppForDrawer({
          ...selectedAppForDrawer,
          status: newStatus,
          creatorFeedback: feedback || selectedAppForDrawer.creatorFeedback || null,
        });
      }
      await loadData();
    } catch (err) {
      console.error('Failed to update applicant review:', err);
      showToast('Status update failed.', 'error');
    } finally {
      setUpdating(false);
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

  const filteredApplications = applications.filter((app) => {
    if (statusFilter === 'all') return true;
    return app.status === statusFilter;
  });

  return (
    <div id="manage-applications-page" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Back Link */}
      <div className="mb-6">
        <Link
          to={`/opportunities/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Opportunity Details</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1">
            Applicant & Proposal Pipeline
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {opportunity?.title || 'Manage Applications'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Inspect applicant trust scores, review milestone proposals, and accept proposals to bridge into contract formation.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('proposals')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'proposals'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Structured Proposals</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('applications')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'applications'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Quick Applications ({applications.length})</span>
          </button>
        </div>

        {activeTab === 'applications' && (
          /* Filter by status */
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[36px]"
            >
              <option value="all">All Applicants ({applications.length})</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
        )}
      </div>

      {activeTab === 'proposals' && opportunity && (
        <OpportunityProposalsSection
          opportunity={opportunity}
          currentUserId={user?.uid || ''}
          isCreator={true}
          onOpportunityUpdated={loadData}
        />
      )}

      {activeTab === 'applications' && (
        <>
          {/* Applications List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 animate-pulse h-40"
                />
              ))}
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
              <Briefcase className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                No applicants found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {statusFilter === 'all'
                  ? 'No candidates have applied for this listing yet.'
                  : `No candidates currently in '${statusFilter.replace('_', ' ')}' status.`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApplications.map((app) => (
                <div
                  key={app.id}
                  id={`applicant-card-${app.id}`}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                    {/* Applicant Info & Trust Badges */}
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {app.applicantDisplayName}
                        </h3>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border capitalize ${getStatusBadge(
                            app.status
                          )}`}
                        >
                          {app.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Trust Indicators */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {app.applicantTrustTier} (Score: {app.applicantTrustScore})
                        </span>

                        {app.applicantIdentityVerified && (
                          <span className="flex items-center gap-1 font-medium text-emerald-600">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Identity Verified
                          </span>
                        )}

                        <span>• Applied {new Date(app.submittedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Passport Link & Quick Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {app.status === 'accepted' && (
                        <Link
                          id={`manage-handoff-link-${app.id}`}
                          to={`/opportunities/${opportunity?.id}/handoff/${app.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-xl transition-colors min-h-[44px] shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Collaboration Handoff</span>
                        </Link>
                      )}

                      <button
                        type="button"
                        id={`inspect-candidate-btn-${app.id}`}
                        onClick={() => setSelectedAppForDrawer(app)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl transition-colors min-h-[44px] cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Candidate</span>
                      </button>

                      <Link
                        to={`/p/${app.applicantId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl transition-colors min-h-[44px]"
                      >
                        <span>Public Passport</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Cover Note */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 mb-3">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Applicant Pitch / Cover Note
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {app.coverNote}
                    </p>
                  </div>

                  {/* Proposed Terms & Portfolio Links */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                    {app.proposedRate && (
                      <div>
                        <span className="text-slate-400">Proposed Rate: </span>
                        <strong className="text-slate-800 dark:text-slate-200">
                          ${app.proposedRate} ({app.proposedRateType})
                        </strong>
                      </div>
                    )}

                    {app.availabilityDate && (
                      <div>
                        <span className="text-slate-400">Earliest Start: </span>
                        <strong className="text-slate-800 dark:text-slate-200">{app.availabilityDate}</strong>
                      </div>
                    )}

                    {app.portfolioLinks && app.portfolioLinks.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Portfolio: </span>
                        {app.portfolioLinks.map((link, idx) => (
                          <a
                            key={idx}
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                          >
                            <span>Sample {idx + 1}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Creator Feedback (if given) */}
                  {app.creatorFeedback && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Your Review Feedback:{' '}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400 italic">
                        "{app.creatorFeedback}"
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Candidate Review Drawer */}
      <ApplicantReviewDrawer
        isOpen={!!selectedAppForDrawer}
        onClose={() => setSelectedAppForDrawer(null)}
        application={selectedAppForDrawer}
        opportunity={opportunity}
        onUpdateStatus={handleUpdateStatus}
        updating={updating}
      />
    </div>
  );
};
