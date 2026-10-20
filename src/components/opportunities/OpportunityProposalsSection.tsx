import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Opportunity, OpportunityProposal, PublicTrustPassport } from '../../types';
import {
  getProposalsForOpportunity,
  getMySubmittedProposals,
  updateProposalStatus,
  acceptOpportunityProposal,
} from '../../lib/proposalService';
import { useToast } from '../../context/ToastContext';
import {
  ShieldCheck,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  User,
  ExternalLink,
  MessageSquare,
  Lock,
} from 'lucide-react';

interface OpportunityProposalsSectionProps {
  opportunity: Opportunity;
  currentUserId: string;
  isCreator: boolean;
  onOpportunityUpdated?: () => void;
}

export const OpportunityProposalsSection: React.FC<OpportunityProposalsSectionProps> = ({
  opportunity,
  currentUserId,
  isCreator,
  onOpportunityUpdated,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [proposals, setProposals] = useState<OpportunityProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmAcceptProposal, setConfirmAcceptProposal] = useState<OpportunityProposal | null>(
    null
  );

  const loadProposals = async () => {
    if (!currentUserId) {
      setProposals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (isCreator) {
        const list = await getProposalsForOpportunity(opportunity.id, currentUserId);
        setProposals(list);
      } else {
        const list = await getMySubmittedProposals(currentUserId);
        const myForThisOpp = list.filter((p) => p.opportunityId === opportunity.id);
        setProposals(myForThisOpp);
      }
    } catch (err: any) {
      if (err?.message?.includes('Unauthorized') || err?.code === 'permission-denied') {
        console.warn('[OpportunityProposalsSection] Caller not authorized to view proposals:', err?.message);
      } else {
        console.error('Failed to load proposals:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProposals();
  }, [opportunity.id, currentUserId, isCreator]);

  const handleStatusChange = async (
    proposalId: string,
    newStatus: OpportunityProposal['status'],
    feedback?: string
  ) => {
    setProcessingId(proposalId);
    try {
      await updateProposalStatus({
        proposalId,
        newStatus,
        callerUserId: currentUserId,
        clientFeedback: feedback,
      });
      showToast(`Proposal status updated to ${newStatus.replace('_', ' ')}.`, 'success');
      await loadProposals();
    } catch (err: any) {
      console.error('Failed to update proposal status:', err);
      showToast(err?.message || 'Failed to update status.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleAcceptProposal = async (proposal: OpportunityProposal) => {
    setProcessingId(proposal.id);
    try {
      const outcome = await acceptOpportunityProposal({
        opportunityId: opportunity.id,
        proposalId: proposal.id,
        creatorUserId: currentUserId,
      });

      showToast('Proposal accepted! Draft contract successfully created.', 'success');
      setConfirmAcceptProposal(null);
      if (onOpportunityUpdated) {
        onOpportunityUpdated();
      }
      await loadProposals();

      // Navigate to the newly created contract
      if (outcome.contract?.id) {
        navigate(`/contracts/${outcome.contract.id}`);
      }
    } catch (err: any) {
      console.error('Proposal acceptance failed:', err);
      showToast(err?.message || 'Failed to accept proposal.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: OpportunityProposal['status']) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Submitted
          </span>
        );
      case 'under_review':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Under Review
          </span>
        );
      case 'shortlisted':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            Shortlisted
          </span>
        );
      case 'accepted':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Accepted & Awarded
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800">
            Declined
          </span>
        );
      case 'withdrawn':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Withdrawn
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500">Loading proposals...</p>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {isCreator ? 'No proposals submitted yet' : 'You have not submitted a proposal'}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          {isCreator
            ? 'Structured proposals submitted by qualified talent will appear here with verified trust scores.'
            : 'Submit a structured proposal with milestone deliverables to bid on this opportunity.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Structured Proposals ({proposals.length})</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isCreator
              ? 'Review candidate proposals, verify authoritatively attached trust scores, and accept to bridge into contract formation.'
              : 'Track the status and client review of your submitted proposal.'}
          </p>
        </div>
      </div>

      {/* Proposals List */}
      <div className="space-y-3">
        {proposals.map((proposal) => {
          const isExpanded = expandedProposalId === proposal.id;
          const isWinner = proposal.status === 'accepted';

          return (
            <div
              key={proposal.id}
              className={`rounded-2xl border transition-all ${
                isWinner
                  ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/20 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Proposal Header Card */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center flex-shrink-0 text-indigo-600 dark:text-indigo-400 font-bold text-base shadow-sm">
                    {proposal.talentTrustScore}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {proposal.talentDisplayName}
                      </span>
                      {proposal.talentIdentityVerified && (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Verified</span>
                        </div>
                      )}
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {proposal.talentTrustTier}
                      </span>
                      <Link
                        to={`/p/${proposal.talentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline ml-1"
                      >
                        <span>View Live Passport</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    </div>

                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                        ${proposal.proposedTotalUSD.toLocaleString()} USD
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {proposal.proposedDeliveryDays} Days
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        {proposal.proposedMilestones.length} Milestones
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-center">
                  {getStatusBadge(proposal.status)}

                  <button
                    onClick={() =>
                      setExpandedProposalId(isExpanded ? null : proposal.id)
                    }
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Proposal Details */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
                  {/* Winning Contract Navigation Banner */}
                  {proposal.contractId && (
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          Contract created ({proposal.contractId}). Proceed to Phase 1 Contract Engine for signature and escrow.
                        </span>
                      </div>
                      <Link
                        to={`/contracts/${proposal.contractId}`}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 shadow-sm transition-colors"
                      >
                        <span>View Contract</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}

                  {/* Cover Letter */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Cover Letter
                    </h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
                      {proposal.coverLetter}
                    </p>
                  </div>

                  {/* Milestones Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Proposed Milestones ({proposal.proposedMilestones.length})
                    </h4>
                    <div className="space-y-2">
                      {proposal.proposedMilestones.map((m, idx) => (
                        <div
                          key={m.id || idx}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {idx + 1}. {m.title}
                            </div>
                            <div className="text-slate-600 dark:text-slate-400">
                              {m.description}
                            </div>
                            {m.deliverables && m.deliverables.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                {m.deliverables.map((deliv, dIdx) => (
                                  <span
                                    key={dIdx}
                                    className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 text-[10px]"
                                  >
                                    {deliv}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                              ${m.amountUSD.toLocaleString()}
                            </div>
                            <div className="text-slate-500">{m.estimatedDays} days</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Creator Actions Toolbar */}
                  {isCreator && proposal.status !== 'accepted' && (
                    <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {proposal.status !== 'under_review' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(proposal.id, 'under_review')}
                            disabled={processingId === proposal.id}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            Mark Under Review
                          </button>
                        )}

                        {proposal.status !== 'shortlisted' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(proposal.id, 'shortlisted')}
                            disabled={processingId === proposal.id}
                            className="px-3 py-1.5 rounded-lg border border-purple-300 dark:border-purple-800 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                          >
                            Shortlist
                          </button>
                        )}

                        {proposal.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(proposal.id, 'rejected')}
                            disabled={processingId === proposal.id}
                            className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            Decline
                          </button>
                        )}
                      </div>

                      {/* Accept & Bridge Button */}
                      <button
                        type="button"
                        onClick={() => setConfirmAcceptProposal(proposal)}
                        disabled={
                          processingId === proposal.id ||
                          opportunity.status === 'in_progress' ||
                          opportunity.status === 'awarded' ||
                          opportunity.status === 'closed'
                        }
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Accept Proposal & Create Contract</span>
                      </button>
                    </div>
                  )}

                  {/* Talent Actions (Withdrawal) */}
                  {!isCreator &&
                    proposal.talentId === currentUserId &&
                    proposal.status !== 'accepted' &&
                    proposal.status !== 'withdrawn' && (
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(proposal.id, 'withdrawn')}
                          disabled={processingId === proposal.id}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Withdraw Proposal
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal for Proposal Acceptance & Phase 1 Bridge */}
      {confirmAcceptProposal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Accept Proposal & Create Contract
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Award {confirmAcceptProposal.talentDisplayName} this opportunity
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-2 text-slate-700 dark:text-slate-300">
              <p>
                <span className="font-semibold">Agreed Total:</span> $
                {confirmAcceptProposal.proposedTotalUSD.toLocaleString()} USD
              </p>
              <p>
                <span className="font-semibold">Milestones:</span>{' '}
                {confirmAcceptProposal.proposedMilestones.length} proposed milestones will be
                locked into the agreement.
              </p>
              <p className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
                <strong>Bridge Invariant:</strong> Accepting this proposal creates a Phase 1{' '}
                <em>Draft Contract</em>. Both you and the talent will be required to digitally sign
                the contract before milestone funding and activation.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAcceptProposal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAcceptProposal(confirmAcceptProposal)}
                disabled={processingId === confirmAcceptProposal.id}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
              >
                {processingId === confirmAcceptProposal.id ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating Contract...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Create Contract</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
