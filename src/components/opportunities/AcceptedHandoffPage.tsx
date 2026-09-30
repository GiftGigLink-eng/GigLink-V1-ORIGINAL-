import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  DollarSign,
  Lock,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  FileCheck2,
  PenTool,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
  History,
  Globe,
  Github,
  Figma,
  Check,
  Info,
  PackageCheck,
  RefreshCw,
  Layers,
  CreditCard,
  Users,
  Briefcase,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getHandoffWorkspace,
  HandoffWorkspaceResult,
} from '../../lib/handoffService';
import {
  acceptContract,
  proposeContractTerms,
  submitMilestoneDeliverable,
  reviewMilestoneDeliverable,
  submitFinalHandover,
  acceptFinalHandover,
  canSubmitMilestone,
  canReviewMilestone,
  getContractProgress,
  getContractsForUser,
} from '../../lib/contractService';
import {
  GigLinkContract,
  ApplicationHandoffData,
  MessageContextType,
} from '../../types';
import { ContractAmendmentsSection } from './ContractAmendmentsSection';
import { ContractFinancialSection } from './ContractFinancialSection';
import { ProjectMessagingSection } from './ProjectMessagingSection';
import { getCanonicalConversationId, subscribeToConversation } from '../../lib/conversationService';

export const AcceptedHandoffPage: React.FC = () => {
  const { id: routeOppId, applicationId: routeAppId } = useParams<{
    id?: string;
    applicationId?: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const effectiveAppId = routeAppId || (routeOppId && user?.uid ? `${routeOppId}_${user.uid}` : '');

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'milestones';

  const setActiveTab = (tab: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [preselectedMessageContext, setPreselectedMessageContext] = useState<{
    contextType: MessageContextType;
    milestoneId?: string;
    milestoneTitle?: string;
    changeRequestId?: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workspaceResult, setWorkspaceResult] = useState<HandoffWorkspaceResult | null>(null);
  const [contract, setContract] = useState<GigLinkContract | null>(null);
  const [userContracts, setUserContracts] = useState<GigLinkContract[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'in_review' | 'approved'>('all');

  // Track real-time conversation unread counts
  useEffect(() => {
    if (!contract || !user?.uid) return;
    const convId = contract.conversationId || getCanonicalConversationId(contract.id);
    const unsub = subscribeToConversation(convId, (conv) => {
      if (conv) {
        const isCreatorUser = user.uid === conv.creatorId;
        const count = isCreatorUser ? conv.unreadCountCreator : conv.unreadCountTalent;
        setUnreadMessagesCount(count || 0);
      }
    });
    return () => unsub();
  }, [contract?.id, contract?.conversationId, user?.uid]);

  // Contract Signing State
  const [signingName, setSigningName] = useState('');
  const [signingInProgress, setSigningInProgress] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);

  // Active Milestone Submission Form States
  const [submittingMilestoneId, setSubmittingMilestoneId] = useState<string | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [additionalLink, setAdditionalLink] = useState('');
  const [isSubmittingWork, setIsSubmittingWork] = useState(false);

  // Active Milestone Review Form States
  const [reviewingMilestoneId, setReviewingMilestoneId] = useState<string | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [isReviewingWork, setIsReviewingWork] = useState(false);

  // Expanded History Drawers
  const [expandedHistoryMilestoneId, setExpandedHistoryMilestoneId] = useState<string | null>(null);

  // Final Handover Submission State
  const [showFinalHandoverForm, setShowFinalHandoverForm] = useState(false);
  const [finalLiveUrl, setFinalLiveUrl] = useState('');
  const [finalRepoUrl, setFinalRepoUrl] = useState('');
  const [finalDocsUrl, setFinalDocsUrl] = useState('');
  const [finalNotes, setFinalNotes] = useState('');
  const [confirmedTransfer, setConfirmedTransfer] = useState(false);
  const [isSubmittingFinalHandover, setIsSubmittingFinalHandover] = useState(false);
  const [isAcceptingFinalHandover, setIsAcceptingFinalHandover] = useState(false);

  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewErrorCode, setOverviewErrorCode] = useState<'NETWORK' | 'UNAUTHORIZED' | 'UNKNOWN' | null>(null);

  // Load Workspace Data
  const loadWorkspace = async (silent = false) => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    if (!effectiveAppId) {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setOverviewError(null);
      setOverviewErrorCode(null);
      try {
        const contracts = await getContractsForUser(user.uid);
        setUserContracts(contracts);
      } catch (err: any) {
        console.error('Error fetching user contracts overview:', err);
        const errMsg = (err?.message || String(err)).toLowerCase();
        const errCode = (err?.code || '').toLowerCase();
        const isNetwork =
          errCode.includes('unavailable') ||
          errCode.includes('deadline-exceeded') ||
          errMsg.includes('offline') ||
          errMsg.includes('failed to fetch') ||
          errMsg.includes('network') ||
          errMsg.includes('connection lost');
        const isAuth =
          errCode.includes('permission-denied') ||
          errCode.includes('unauthenticated') ||
          errMsg.includes('permission') ||
          errMsg.includes('unauthorized');
        
        setOverviewErrorCode(isNetwork ? 'NETWORK' : isAuth ? 'UNAUTHORIZED' : 'UNKNOWN');
        setOverviewError(
          isNetwork
            ? 'Connection interrupted. We could not fetch your contracts right now.'
            : isAuth
            ? 'You are not authorized to view these contracts.'
            : 'Failed to load contracts overview.'
        );
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
      return;
    }

    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const result = await getHandoffWorkspace(effectiveAppId, user.uid);
      setWorkspaceResult(result);
      if (result.contract) {
        setContract(result.contract);
      }
    } catch (err: any) {
      console.error('Error loading project workspace:', err);
      if (!silent) {
        const errMsg = (err?.message || String(err)).toLowerCase();
        const errCode = (err?.code || '').toLowerCase();
        const isNetwork =
          errCode.includes('unavailable') ||
          errCode.includes('deadline-exceeded') ||
          errMsg.includes('offline') ||
          errMsg.includes('failed to fetch') ||
          errMsg.includes('network') ||
          errMsg.includes('connection lost');
        const isAuth =
          errCode.includes('permission-denied') ||
          errCode.includes('unauthenticated') ||
          errMsg.includes('permission') ||
          errMsg.includes('unauthorized');

        setWorkspaceResult({
          success: false,
          error: isNetwork
            ? 'We could not connect to load the project workspace. Please check your network connection.'
            : isAuth
            ? 'You are not authorized to access this project workspace.'
            : 'Failed to load project workspace.',
          errorCode: isNetwork ? 'NETWORK' : isAuth ? 'UNAUTHORIZED' : 'UNKNOWN',
        });
      }
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [effectiveAppId, user?.uid]);

  const handoffData: ApplicationHandoffData | undefined = workspaceResult?.handoffData;
  const isManager = workspaceResult?.isCreator ?? (contract ? user?.uid === contract.creatorId : false);
  const isTalent = workspaceResult?.isApplicant ?? (contract ? user?.uid === contract.talentId : false);

  // Progress metrics from contract service
  const progress = useMemo(() => {
    if (!contract) {
      return {
        total: 0,
        approved: 0,
        percentage: 0,
        allApproved: false,
        currentMilestoneIndex: -1,
        isCompleted: false,
        hasFinalHandoverSubmitted: false,
        hasFinalHandoverAccepted: false,
      };
    }
    return getContractProgress(contract);
  }, [contract]);

  const filteredMilestones = useMemo(() => {
    if (!contract?.milestones) return [];
    if (filterStatus === 'active') {
      return contract.milestones.filter((m) => m.reviewState !== 'approved');
    }
    if (filterStatus === 'in_review') {
      return contract.milestones.filter((m) => m.reviewState === 'submitted' || m.reviewState === 'in_review');
    }
    if (filterStatus === 'approved') {
      return contract.milestones.filter((m) => m.reviewState === 'approved');
    }
    return contract.milestones;
  }, [contract?.milestones, filterStatus]);

  // Handle Contract Acceptance
  const handleSignContract = async () => {
    if (!contract || !user?.uid) return;
    const nameToSign = signingName.trim() || user.displayName || (isManager ? 'Client' : 'Talent');

    setSigningInProgress(true);
    try {
      let updated: GigLinkContract;
      if (isManager && contract.status === 'draft') {
        updated = await proposeContractTerms(contract.id, user.uid, nameToSign);
        showToast('Contract terms proposed to talent.', 'success');
      } else {
        updated = await acceptContract(contract.id, user.uid, nameToSign);
        if (updated.status === 'active') {
          showToast('Both parties accepted. Contract is now ACTIVE and scope is locked!', 'success');
        } else {
          showToast('Terms accepted. Awaiting counter-party signature.', 'success');
        }
      }
      setContract(updated);
      setShowSignModal(false);
    } catch (err: any) {
      showToast(err?.message || 'Failed to accept contract.', 'error');
    } finally {
      setSigningInProgress(false);
    }
  };

  // Handle Milestone Deliverable Submission
  const handleSubmitDeliverable = async (milestoneId: string) => {
    if (!contract || !user?.uid) return;
    if (!deliveryNotes.trim()) {
      showToast('Please provide a delivery note describing the completed work.', 'error');
      return;
    }

    setIsSubmittingWork(true);
    try {
      const res = await submitMilestoneDeliverable({
        contractId: contract.id,
        milestoneId,
        talentUserId: user.uid,
        submission: {
          deliveryNote: deliveryNotes.trim(),
          demoUrl: demoUrl.trim() || undefined,
          repoUrl: repoUrl.trim() || undefined,
          figmaUrl: figmaUrl.trim() || undefined,
          links: additionalLink.trim() ? [additionalLink.trim()] : undefined,
        },
      });

      setContract(res.contract);
      setSubmittingMilestoneId(null);
      setDeliveryNotes('');
      setDemoUrl('');
      setRepoUrl('');
      setFigmaUrl('');
      setAdditionalLink('');
      showToast('Milestone deliverable submitted for client review!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit milestone deliverable.', 'error');
    } finally {
      setIsSubmittingWork(false);
    }
  };

  // Handle Milestone Review (Approve or Request Revision)
  const handleReviewDeliverable = async (
    milestoneId: string,
    decision: 'approved' | 'revision_requested'
  ) => {
    if (!contract || !user?.uid) return;
    if (decision === 'revision_requested' && !revisionFeedback.trim()) {
      showToast('Please specify the required adjustments in the feedback note.', 'error');
      return;
    }

    setIsReviewingWork(true);
    try {
      const res = await reviewMilestoneDeliverable({
        contractId: contract.id,
        milestoneId,
        reviewerUserId: user.uid,
        decision,
        feedback: revisionFeedback.trim() || undefined,
        reviewerName: user.displayName || contract.creatorName,
        userIsOrgAdmin: isManager,
      });

      setContract(res.contract);
      setReviewingMilestoneId(null);
      setRevisionFeedback('');
      if (decision === 'approved') {
        showToast('Milestone deliverable approved!', 'success');
      } else {
        showToast('Revision request sent to talent.', 'info');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to record milestone review.', 'error');
    } finally {
      setIsReviewingWork(false);
    }
  };

  // Handle Final Handover Submission (Talent)
  const handleSubmitFinalHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !user?.uid) return;
    if (!confirmedTransfer) {
      showToast('Please confirm that all deliverables and assets have been transferred.', 'error');
      return;
    }
    if (!finalNotes.trim()) {
      showToast('Please provide final handover summary notes.', 'error');
      return;
    }

    setIsSubmittingFinalHandover(true);
    try {
      const updated = await submitFinalHandover({
        contractId: contract.id,
        talentUserId: user.uid,
        handover: {
          finalProjectUrl: finalLiveUrl.trim() || undefined,
          repoUrl: finalRepoUrl.trim() || undefined,
          documentationUrl: finalDocsUrl.trim() || undefined,
          finalNotes: finalNotes.trim(),
          credentialsHandoverConfirmed: confirmedTransfer,
        },
      });

      setContract(updated);
      setShowFinalHandoverForm(false);
      showToast('Final project handover submitted to client for sign-off!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit final handover.', 'error');
    } finally {
      setIsSubmittingFinalHandover(false);
    }
  };

  // Handle Final Handover Acceptance (Client / Completion)
  const handleAcceptFinalHandover = async () => {
    if (!contract || !user?.uid) return;
    setIsAcceptingFinalHandover(true);
    try {
      const updated = await acceptFinalHandover({
        contractId: contract.id,
        reviewerUserId: user.uid,
        userIsOrgAdmin: isManager,
      });
      setContract(updated);
      showToast('Project signed off and successfully completed! 🎉', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to complete project handover.', 'error');
    } finally {
      setIsAcceptingFinalHandover(false);
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-10 w-96 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
            <div className="h-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
            <div className="h-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
          </div>
          <div className="h-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  // 1.5 Overview List when no specific application/opportunity ID is provided in route
  if (!effectiveAppId) {
    const isTalentRoute = location.pathname.startsWith('/talent');
    const relevantContracts = userContracts.filter((c) =>
      isTalentRoute ? c.talentId === user?.uid : c.creatorId === user?.uid
    );
    const displayContracts = relevantContracts.length > 0 ? relevantContracts : userContracts;

    return (
      <div id="contracts-overview-page" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
                <Sparkles className="w-3 h-3" />
                {isTalentRoute ? 'Talent Delivery Hub' : 'Creator Project Management'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {isTalentRoute ? 'My Milestone Contracts' : 'Active Project Handoffs & Contracts'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isTalentRoute
                ? 'Track your active delivery contracts, submit milestone deliverables, and monitor escrow releases.'
                : 'Manage active project handoffs, review milestone submissions, and release escrow funds.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isTalentRoute ? (
              <Link
                to="/opportunities"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors min-h-[44px]"
              >
                <Briefcase className="w-4 h-4" />
                <span>Browse Opportunities</span>
              </Link>
            ) : (
              <Link
                to="/opportunities/create"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors min-h-[44px]"
              >
                <FileText className="w-4 h-4" />
                <span>Post Opportunity</span>
              </Link>
            )}
          </div>
        </div>

        {/* Contract List, Error State, or Empty State */}
        {overviewError ? (
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-3xl p-10 sm:p-12 text-center shadow-xs">
            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-800/50">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">
              {overviewErrorCode === 'NETWORK'
                ? 'Connection Interrupted'
                : overviewErrorCode === 'UNAUTHORIZED'
                ? 'Access Denied'
                : 'Unable to Load Contracts'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
              {overviewError}
            </p>
            {overviewErrorCode !== 'UNAUTHORIZED' && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => loadWorkspace()}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs min-h-[44px]"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Retry</span>
                </button>
              </div>
            )}
          </div>
        ) : displayContracts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-xs">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-200 dark:border-indigo-800/50">
              <Layers className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              {isTalentRoute ? 'No Active Milestone Contracts' : 'No Active Project Handoffs'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
              {isTalentRoute
                ? "You don't have any active milestone-backed contracts yet. Apply to verified listings or respond to client invitations to start."
                : "You don't have any active project contracts in progress. Review incoming proposals or post a new opportunity to hire talent."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {isTalentRoute ? (
                <>
                  <Link
                    to="/opportunities"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors min-h-[44px]"
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>Explore Marketplace</span>
                  </Link>
                  <Link
                    to="/my-applications"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 transition-colors min-h-[44px]"
                  >
                    <span>View Submitted Applications</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/opportunities/create"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors min-h-[44px]"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Post New Opportunity</span>
                  </Link>
                  <Link
                    to="/client/opportunities"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 transition-colors min-h-[44px]"
                  >
                    <span>Manage My Listings</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {displayContracts.map((c) => {
              const completedMilestones = c.milestones?.filter((m) => m.status === 'completed' || m.reviewState === 'approved').length || 0;
              const totalMilestones = c.milestones?.length || 0;
              const progressPercent = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
              const isCreator = user?.uid === c.creatorId;
              const counterpartyName = isCreator ? c.talentName || 'Talent' : c.creatorName || 'Client';
              const targetHandoffUrl = `/opportunities/${c.opportunityId}/handoff/${c.applicationId || `${c.opportunityId}_${c.talentId}`}`;
              const contractTotalAmount = c.scopeLock?.totalAmount ?? c.milestones?.reduce((sum, m) => sum + (m.amount || 0), 0) ?? 0;
              const contractCurrency = c.scopeLock?.currency || 'USD';

              return (
                <div
                  key={c.id}
                  id={`contract-item-${c.id}`}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {c.opportunityTitle || 'Project Contract'}
                      </h3>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md uppercase ${
                          c.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60'
                            : c.status === 'completed'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span>Counterparty: <strong className="text-slate-800 dark:text-slate-200">{counterpartyName}</strong></span>
                      <span>Total Escrow: <strong className="text-emerald-600 dark:text-emerald-400">${contractTotalAmount.toLocaleString()} {contractCurrency}</strong></span>
                      <span>Milestones: <strong className="text-slate-800 dark:text-slate-200">{completedMilestones}/{totalMilestones} Completed</strong></span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full max-w-md pt-1">
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-3">
                    <Link
                      id={`open-contract-btn-${c.id}`}
                      to={targetHandoffUrl}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors min-h-[44px] shadow-xs"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 2. Application Not Accepted Lock Screen
  if (workspaceResult?.errorCode === 'NOT_ACCEPTED') {
    const appStatus = workspaceResult.application?.status || 'pending';
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-amber-200 dark:border-amber-800/50">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Project Workspace Locked
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-lg mx-auto leading-relaxed">
            The Contract & Delivery Workspace is accessible exclusively after an opportunity application reaches the{' '}
            <strong className="text-emerald-600 font-semibold">Accepted</strong> state. The current application status is{' '}
            <span className="capitalize font-semibold text-slate-800 dark:text-slate-200">
              {appStatus.replace('_', ' ')}
            </span>.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 transition-colors min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go Back</span>
            </button>
            <Link
              to="/my-applications"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors min-h-[44px]"
            >
              <span>My Applications</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Truthful Error Screen: Network, Not Found, or Unauthorized
  if (!workspaceResult?.success || !handoffData) {
    const isNetwork = workspaceResult?.errorCode === 'NETWORK';
    const isNotFound = workspaceResult?.errorCode === 'NOT_FOUND';
    const isAuth = workspaceResult?.errorCode === 'UNAUTHORIZED';

    const title = isNetwork
      ? 'Connection Interrupted'
      : isNotFound
      ? 'Workspace Not Found'
      : isAuth
      ? 'Access Denied'
      : 'Unable to Load Workspace';

    const message = isNetwork
      ? (workspaceResult?.error || 'We could not connect to load the project workspace. Please check your network connection and try again.')
      : isNotFound
      ? (workspaceResult?.error || 'The requested project workspace or application does not exist or has been removed.')
      : isAuth
      ? (workspaceResult?.error || 'You do not have permission to access this project workspace.')
      : (workspaceResult?.error || 'Failed to load project workspace. Please try again.');

    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-3xl p-8 sm:p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-rose-200 dark:border-rose-800/50">
            {isNetwork ? <RefreshCw className="w-8 h-8" /> : isAuth ? <Lock className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {title}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-lg mx-auto leading-relaxed">
            {message}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isNetwork && (
              <button
                onClick={() => loadWorkspace()}
                disabled={loading || refreshing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs min-h-[44px]"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
                <span>Retry</span>
              </button>
            )}
            <Link
              to="/opportunities"
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl ${
                isNetwork
                  ? 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              } text-xs font-semibold transition-colors min-h-[44px]`}
            >
              <span>Explore Marketplace</span>
            </Link>
            {isNotFound ? (
              <Link
                to="/my-applications"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 transition-colors min-h-[44px]"
              >
                <span>My Applications</span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const isContractActive = contract?.status === 'active';
  const isContractCompleted = contract?.status === 'completed';
  const myAcceptance = isManager ? contract?.creatorAcceptance : contract?.talentAcceptance;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <nav aria-label="Breadcrumbs" className="flex items-center gap-2 text-xs text-slate-500">
          <Link to="/opportunities" className="hover:text-indigo-600 transition-colors">
            Opportunities
          </Link>
          <span>/</span>
          <Link
            to={`/opportunities/${handoffData.opportunityId}`}
            className="hover:text-indigo-600 transition-colors truncate max-w-[200px]"
          >
            {handoffData.opportunityTitle}
          </Link>
          <span>/</span>
          <span className="text-slate-900 dark:text-white font-semibold">Project Delivery Workspace</span>
        </nav>

        <button
          onClick={() => loadWorkspace(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
          title="Refresh Workspace State"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sync</span>
        </button>
      </div>

      {/* Main Header Banner */}
      <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Project Delivery Workspace</span>
              </span>
              <span className="text-xs text-slate-400">
                Accepted {new Date(handoffData.acceptedAt).toLocaleDateString()}
              </span>
              {contract && (
                <span
                  className={`text-[11px] font-bold px-3 py-0.5 rounded-full border uppercase tracking-wider ${
                    isContractCompleted
                      ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300'
                      : isContractActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : contract.status === 'pending_acceptance'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  Status: {contract.status.replace('_', ' ')}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {handoffData.opportunityTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Authoritative workspace for scope-locked milestone submissions, client feedback cycles, and final verified handover.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to={`/opportunities/${handoffData.opportunityId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors min-h-[44px]"
            >
              <span>View Listing</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            {isManager && (
              <Link
                to={`/opportunities/${handoffData.opportunityId}/applications`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors min-h-[44px]"
              >
                <span>Manage Applicants</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Workspace Navigation Tabs */}
      <nav id="handoff-workspace-tabs" className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          id="tab-milestones-btn"
          onClick={() => setActiveTab('milestones')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] cursor-pointer shrink-0 ${
            activeTab === 'milestones'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Milestones & Deliverables</span>
          {contract && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'milestones'
                  ? 'bg-indigo-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {contract.milestones.length}
            </span>
          )}
        </button>

        <button
          type="button"
          id="tab-messages-btn"
          onClick={() => setActiveTab('messages')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] cursor-pointer shrink-0 relative ${
            activeTab === 'messages'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Project Messaging</span>
          {unreadMessagesCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
              {unreadMessagesCount}
            </span>
          )}
        </button>

        {contract && (isContractActive || isContractCompleted) && (
          <button
            type="button"
            id="tab-amendments-btn"
            onClick={() => setActiveTab('amendments')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] cursor-pointer shrink-0 ${
              activeTab === 'amendments'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Scope & Amendments</span>
            {contract.amendmentHistory && contract.amendmentHistory.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'amendments'
                    ? 'bg-indigo-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                v{contract.version}
              </span>
            )}
          </button>
        )}

        {contract && (isContractActive || isContractCompleted) && (
          <button
            type="button"
            id="tab-financials-btn"
            onClick={() => setActiveTab('financials')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] cursor-pointer shrink-0 ${
              activeTab === 'financials'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Escrow & Payments</span>
          </button>
        )}

        <button
          type="button"
          id="tab-contacts-btn"
          onClick={() => setActiveTab('contacts')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] cursor-pointer shrink-0 ${
            activeTab === 'contacts'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team & Guidelines</span>
        </button>
      </nav>

      {/* Contract & Scope Lock Summary Card (Visible in Milestones, Amendments & Financials) */}
      {contract && (activeTab === 'milestones' || activeTab === 'amendments' || activeTab === 'financials') && (
        <section
          id="contract-scope-lock-card"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Contract Agreement & Scope Lock
                </h2>
                <p className="text-xs text-slate-500">
                  {contract.scopeLock.lockedAt
                    ? `Scope locked on ${new Date(contract.scopeLock.lockedAt).toLocaleDateString()}`
                    : 'Draft terms awaiting dual-party acceptance'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full border ${
                  isContractCompleted
                    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300'
                    : isContractActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                {isContractCompleted ? 'Completed' : isContractActive ? 'Active Scope Lock' : 'Pending Signatures'}
              </span>
            </div>
          </div>

          {/* Scope Grid Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 space-y-1.5">
              <span className="text-slate-400 font-medium">Agreed Contract Value</span>
              <div className="text-base font-extrabold text-emerald-600">
                ${contract.scopeLock.totalAmount} {contract.scopeLock.currency}
              </div>
              <span className="text-[11px] text-slate-500 block">
                {contract.scopeLock.revisionAllowance} Revisions per Milestone Included
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 space-y-1.5">
              <span className="text-slate-400 font-medium">Project Checkpoints</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {progress.approved} of {progress.total} Milestones Approved
              </div>
              <span className="text-[11px] text-slate-500 block">
                {progress.allApproved ? 'All milestones approved' : `${progress.percentage}% completed`}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 space-y-1.5">
              <span className="text-slate-400 font-medium">Contract Reference</span>
              <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                {contract.id}
              </div>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 block font-medium">
                Channel ID: {contract.conversationId}
              </span>
            </div>
          </div>

          {/* Scope Inclusions & Exclusions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 space-y-2">
              <span className="font-bold text-slate-900 dark:text-white block">
                Agreed Deliverables & Inclusions:
              </span>
              <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                {contract.scopeLock.inclusions.map((inc, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 space-y-2">
              <span className="font-bold text-slate-900 dark:text-white block">
                Explicit Scope Exclusions:
              </span>
              <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                {contract.scopeLock.exclusions.map((exc, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-rose-500 font-bold">✕</span>
                    <span>{exc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Dual Acceptance Status Bar */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Dual-Party Signature Status
              </span>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  {contract.creatorAcceptance.accepted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span className="text-slate-700 dark:text-slate-300">
                    Client ({contract.creatorName}):{' '}
                    <strong>
                      {contract.creatorAcceptance.accepted ? 'Signed & Accepted' : 'Pending Signature'}
                    </strong>
                  </span>
                </span>

                <span className="flex items-center gap-1.5">
                  {contract.talentAcceptance.accepted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span className="text-slate-700 dark:text-slate-300">
                    Talent ({contract.talentName}):{' '}
                    <strong>
                      {contract.talentAcceptance.accepted ? 'Signed & Accepted' : 'Pending Signature'}
                    </strong>
                  </span>
                </span>
              </div>
            </div>

            {/* Action to Sign */}
            {!myAcceptance?.accepted && (
              <button
                type="button"
                id="sign-contract-terms-btn"
                onClick={() => setShowSignModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors min-h-[44px] shrink-0 cursor-pointer shadow-xs"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>{isManager && contract.status === 'draft' ? 'Propose & Sign Terms' : 'Review & Sign Contract'}</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Project Messaging Tab View (Phase 5) */}
      {contract && user?.uid && activeTab === 'messages' && (
        <section id="project-messaging-tab-view" className="space-y-4">
          <ProjectMessagingSection
            contract={contract}
            currentUserId={user.uid}
            isCreator={isManager}
            isTalent={isTalent}
            preselectedContext={preselectedMessageContext}
            onClearPreselectedContext={() => setPreselectedMessageContext(null)}
          />
        </section>
      )}

      {/* Contract Versioning, Amendments & Change Requests Governance (Phase 3) */}
      {contract && user?.uid && (isContractActive || isContractCompleted) && activeTab === 'amendments' && (
        <ContractAmendmentsSection
          contract={contract}
          currentUserId={user.uid}
          isManager={isManager}
          isTalent={isTalent}
          onContractUpdated={(updated) => setContract(updated)}
        />
      )}

      {/* Contract Financials, Milestone Escrow & Settlement (Phase 4) */}
      {contract && user?.uid && (isContractActive || isContractCompleted) && activeTab === 'financials' && (
        <ContractFinancialSection
          contract={contract}
          currentUserId={user.uid}
          isManager={isManager}
          isTalent={isTalent}
          onContractUpdated={(updated) => setContract(updated)}
        />
      )}

      {/* Signature Modal */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                <PenTool className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Digital Contract Sign-off
                </h3>
                <p className="text-xs text-slate-500">
                  {isManager ? 'Confirm client proposal and lock terms' : 'Confirm talent acceptance of scope and rate'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Project:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{contract?.scopeLock.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Agreed Amount:</span>
                <span className="font-bold text-emerald-600">${contract?.scopeLock.totalAmount} {contract?.scopeLock.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Revisions:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{contract?.scopeLock.revisionAllowance} included per milestone</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Your Full Legal / Signature Name *
              </label>
              <input
                type="text"
                value={signingName}
                onChange={(e) => setSigningName(e.target.value)}
                placeholder={user?.displayName || 'Type your name to sign'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              By confirming, you digitally sign this contract agreement and acknowledge that deliverables will be tracked against the locked scope.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-digital-signature-btn"
                disabled={signingInProgress}
                onClick={handleSignContract}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors min-h-[44px]"
              >
                {signingInProgress ? 'Signing...' : 'Sign & Confirm Terms'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Section: Contract Milestones Execution & Review Workflow (Visible in Milestones Tab) */}
      {activeTab === 'milestones' && (
        <div className="space-y-6">
          <section
            id="milestone-execution-section"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
          >
        {/* Milestone Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Milestones & Deliverables</span>
              {progress.allApproved && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle className="w-3.5 h-3.5" />
                  All Approved
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isContractActive
                ? 'Sequential project execution: Submit work, review deliverables, and request revisions according to agreed scope.'
                : isContractCompleted
                ? 'Project completed: All milestone deliverables have been reviewed and accepted.'
                : 'Pending activation: Milestones will unlock for execution once both parties sign the contract.'}
            </p>
          </div>
        </div>

        {/* Milestone Progress Bar */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-700 dark:text-slate-300">Milestone Review Progress</span>
            <span className="text-indigo-600 dark:text-indigo-400">
              {progress.approved} of {progress.total} Approved ({progress.percentage}%)
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                progress.allApproved ? 'bg-emerald-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          {(['all', 'active', 'in_review', 'approved'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterStatus(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize min-h-[36px] ${
                filterStatus === filter
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {filter.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Milestones List */}
        {filteredMilestones.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <p className="text-xs text-slate-500">No milestones match the selected filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMilestones.map((milestone, idx) => {
              const isApproved = milestone.reviewState === 'approved';
              const isInReview = milestone.reviewState === 'submitted' || milestone.reviewState === 'in_review';
              const isRevision = milestone.reviewState === 'revision_requested';
              const isSubmittingThis = submittingMilestoneId === milestone.id;
              const isReviewingThis = reviewingMilestoneId === milestone.id;
              const isHistoryExpanded = expandedHistoryMilestoneId === milestone.id;

              // Check permissions
              const submitPermission = contract && user?.uid
                ? canSubmitMilestone(contract, milestone.id, user.uid)
                : { allowed: false, reason: 'Not loaded' };

              return (
                <div
                  key={milestone.id}
                  id={`milestone-card-${milestone.id}`}
                  className={`p-5 sm:p-6 rounded-2xl border transition-all ${
                    isApproved
                      ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-200/70 dark:border-emerald-800/40'
                      : isInReview
                      ? 'bg-indigo-50/20 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-800/60 shadow-xs'
                      : isRevision
                      ? 'bg-amber-50/20 dark:bg-amber-950/10 border-amber-300 dark:border-amber-800/60 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-col gap-4">
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-400">
                            Milestone {idx + 1} of {contract?.milestones.length || 0}
                          </span>

                          {/* Review State Badge */}
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider flex items-center gap-1 ${
                              isApproved
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : isInReview
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
                                : isRevision
                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                : milestone.status === 'in_progress'
                                ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300'
                                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {isInReview && <Clock className="w-3 h-3 text-indigo-600" />}
                            {isRevision && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                            <span>
                              {isApproved
                                ? 'Approved'
                                : isInReview
                                ? 'Under Review'
                                : isRevision
                                ? `Revision Requested (${milestone.revisionCount || 1})`
                                : milestone.status.replace('_', ' ')}
                            </span>
                          </span>

                          {milestone.amount ? (
                            <span className="text-xs font-bold text-emerald-600">
                              ${milestone.amount} {milestone.currency || 'USD'}
                            </span>
                          ) : null}

                          {/* Escrow State Pill */}
                          {milestone.paymentState && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider flex items-center gap-1 ${
                                milestone.paymentState === 'released'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : milestone.paymentState === 'held'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                  : milestone.paymentState === 'refunded'
                                  ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}
                            >
                              {milestone.paymentState === 'released' ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              ) : milestone.paymentState === 'held' ? (
                                <Lock className="w-3 h-3 text-amber-600" />
                              ) : (
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                              )}
                              <span>Escrow: {milestone.paymentState}</span>
                            </span>
                          )}
                        </div>

                        <h3
                          className={`text-base font-bold ${
                            isApproved
                              ? 'text-slate-700 dark:text-slate-300'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {milestone.title}
                        </h3>

                        {milestone.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                            {milestone.description}
                          </p>
                        )}
                      </div>

                      {/* Milestone Action Trigger Buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Talent: Submit Deliverable Trigger */}
                        {isTalent && isContractActive && !isApproved && (
                          <button
                            type="button"
                            disabled={!submitPermission.allowed}
                            onClick={() => {
                              setSubmittingMilestoneId(isSubmittingThis ? null : milestone.id);
                              setReviewingMilestoneId(null);
                            }}
                            title={!submitPermission.allowed ? submitPermission.reason : ''}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors min-h-[40px] cursor-pointer shadow-xs"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {isSubmittingThis
                                ? 'Close Submission'
                                : isRevision
                                ? 'Submit Revised Work'
                                : isInReview
                                ? 'Update Deliverable'
                                : 'Submit Deliverable'}
                            </span>
                          </button>
                        )}

                        {/* Client: Review Deliverable Trigger */}
                        {isManager && isContractActive && isInReview && (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewingMilestoneId(isReviewingThis ? null : milestone.id);
                              setSubmittingMilestoneId(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[40px] cursor-pointer shadow-xs"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{isReviewingThis ? 'Close Review' : 'Review Deliverable'}</span>
                          </button>
                        )}

                        {/* Discuss in Chat Button */}
                        {contract && (isContractActive || isContractCompleted) && (
                          <button
                            type="button"
                            id={`discuss-milestone-${milestone.id}-btn`}
                            onClick={() => {
                              setPreselectedMessageContext({
                                contextType: isRevision ? 'revision' : 'milestone',
                                milestoneId: milestone.id,
                                milestoneTitle: milestone.title,
                              });
                              setActiveTab('messages');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors min-h-[40px] cursor-pointer"
                            title="Discuss this milestone in project chat"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Discuss</span>
                          </button>
                        )}

                        {/* Review History Toggle */}
                        {milestone.reviewHistory && milestone.reviewHistory.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedHistoryMilestoneId(isHistoryExpanded ? null : milestone.id)
                            }
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 transition-colors min-h-[40px]"
                          >
                            <History className="w-3.5 h-3.5 text-slate-400" />
                            <span>History ({milestone.reviewHistory.length})</span>
                            {isHistoryExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Preceding milestone locked message */}
                    {isTalent && !submitPermission.allowed && !isApproved && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>{submitPermission.reason}</span>
                      </div>
                    )}

                    {/* Deliverable Details Display if Submitted */}
                    {milestone.submission && (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 space-y-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <FileCheck2 className="w-3.5 h-3.5 text-indigo-600" />
                            Deliverable Submission
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Submitted {new Date(milestone.submission.submittedAt).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {milestone.submission.deliveryNote}
                        </p>

                        {/* Artifact & Live Links */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {milestone.submission.demoUrl && (
                            <a
                              href={milestone.submission.demoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 hover:underline font-semibold"
                            >
                              <Globe className="w-3 h-3" />
                              <span>Live Demo</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}

                          {milestone.submission.repoUrl && (
                            <a
                              href={milestone.submission.repoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:underline font-semibold"
                            >
                              <Github className="w-3 h-3" />
                              <span>Repository</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}

                          {milestone.submission.figmaUrl && (
                            <a
                              href={milestone.submission.figmaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 hover:underline font-semibold"
                            >
                              <Figma className="w-3 h-3" />
                              <span>Figma Design</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}

                          {milestone.submission.links?.map((link, lIdx) => (
                            <a
                              key={lIdx}
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:underline text-[11px]"
                            >
                              <span>Link {lIdx + 1}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active Revision Feedback Banner from latest review */}
                    {isRevision && milestone.reviewHistory && milestone.reviewHistory.length > 0 && (
                      <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-1.5 text-xs">
                        <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          Client Revision Feedback (Round {milestone.revisionCount || 1} of{' '}
                          {contract?.scopeLock.revisionAllowance || 2}):
                        </span>
                        <p className="text-amber-800 dark:text-amber-300 leading-relaxed whitespace-pre-wrap">
                          "{milestone.reviewHistory[milestone.reviewHistory.length - 1].feedback}"
                        </p>
                      </div>
                    )}

                    {/* Approved Confirmation Note */}
                    {isApproved && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-xs">
                        <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Deliverables verified and accepted by Client.
                        </span>
                        {milestone.approvedAt && (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            {new Date(milestone.approvedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Interactive Talent Submission Form */}
                    {isSubmittingThis && isTalent && (
                      <div className="p-5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-4 animate-in fade-in duration-200">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit Deliverable Package for "{milestone.title}"</span>
                        </h4>

                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Work Summary & Delivery Notes *
                            </label>
                            <textarea
                              rows={3}
                              required
                              value={deliveryNotes}
                              onChange={(e) => setDeliveryNotes(e.target.value)}
                              placeholder="Detail the completed features, bug fixes, test steps, or design deliverables submitted for review."
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Live Demo / Preview URL
                              </label>
                              <input
                                type="url"
                                value={demoUrl}
                                onChange={(e) => setDemoUrl(e.target.value)}
                                placeholder="https://demo.myapp.com"
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                GitHub / Code Repository URL
                              </label>
                              <input
                                type="url"
                                value={repoUrl}
                                onChange={(e) => setRepoUrl(e.target.value)}
                                placeholder="https://github.com/org/repo"
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Figma / Design Asset URL
                              </label>
                              <input
                                type="url"
                                value={figmaUrl}
                                onChange={(e) => setFigmaUrl(e.target.value)}
                                placeholder="https://figma.com/file/..."
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Additional Documentation Link
                              </label>
                              <input
                                type="url"
                                value={additionalLink}
                                onChange={(e) => setAdditionalLink(e.target.value)}
                                placeholder="https://docs.google.com/..."
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                          <button
                            type="button"
                            onClick={() => setSubmittingMilestoneId(null)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[40px]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isSubmittingWork || !deliveryNotes.trim()}
                            onClick={() => handleSubmitDeliverable(milestone.id)}
                            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors min-h-[40px] shadow-xs cursor-pointer"
                          >
                            {isSubmittingWork ? 'Submitting...' : 'Submit Deliverable'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Interactive Client Review Module */}
                    {isReviewingThis && isManager && (
                      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Client Deliverable Review Decision</span>
                        </h4>

                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Revision Feedback (Required if requesting adjustments)
                            </label>
                            <textarea
                              rows={3}
                              value={revisionFeedback}
                              onChange={(e) => setRevisionFeedback(e.target.value)}
                              placeholder="Provide clear, actionable feedback specifying what adjustments are needed before sign-off."
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-[11px] text-slate-400 block mt-1">
                              Note: Scope includes {contract?.scopeLock.revisionAllowance || 2} revision rounds per milestone. Current round: {milestone.revisionCount || 0}.
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setReviewingMilestoneId(null)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[40px]"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            disabled={isReviewingWork}
                            onClick={() => handleReviewDeliverable(milestone.id, 'revision_requested')}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 disabled:opacity-50 transition-colors min-h-[40px] cursor-pointer"
                          >
                            {isReviewingWork ? 'Saving...' : 'Request Revision'}
                          </button>

                          <button
                            type="button"
                            disabled={isReviewingWork}
                            onClick={() => handleReviewDeliverable(milestone.id, 'approved')}
                            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors min-h-[40px] shadow-xs cursor-pointer"
                          >
                            {isReviewingWork ? 'Approving...' : 'Approve Milestone'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Expandable Review & Revision History Timeline */}
                    {isHistoryExpanded && milestone.reviewHistory && milestone.reviewHistory.length > 0 && (
                      <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3 text-xs animate-in fade-in duration-150">
                        <h5 className="font-bold text-slate-800 dark:text-slate-200">
                          Audit History ({milestone.reviewHistory.length} review cycles)
                        </h5>
                        <div className="space-y-2.5">
                          {milestone.reviewHistory.map((entry, hIdx) => (
                            <div
                              key={hIdx}
                              className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`font-bold capitalize ${
                                    entry.decision === 'approved'
                                      ? 'text-emerald-600'
                                      : 'text-amber-600'
                                  }`}
                                >
                                  {entry.decision.replace('_', ' ')}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {new Date(entry.reviewedAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-400 italic">
                                "{entry.feedback || 'No comments left.'}"
                              </p>
                              <div className="text-[10px] text-slate-400">
                                Reviewed by: {entry.reviewerName || entry.reviewedBy}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Terminal Section: Final Project Handover & Sign-off Stage */}
      <section
        id="final-project-handover-section"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                isContractCompleted
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : progress.allApproved
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
              }`}
            >
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Final Project Handover & Sign-off
              </h2>
              <p className="text-xs text-slate-500">
                {isContractCompleted
                  ? `Completed and signed off on ${new Date(contract.completedAt || contract.updatedAt).toLocaleDateString()}`
                  : progress.allApproved
                  ? 'All milestones approved! Ready for final project handover transfer.'
                  : 'Unlocks once all milestone deliverables are fully approved.'}
              </p>
            </div>
          </div>

          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border ${
              isContractCompleted
                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300'
                : contract?.finalHandover?.status === 'submitted'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
                : progress.allApproved
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {isContractCompleted
              ? 'Project Completed'
              : contract?.finalHandover?.status === 'submitted'
              ? 'Handover Awaiting Sign-off'
              : progress.allApproved
              ? 'Ready for Handover'
              : 'Milestones Pending'}
          </span>
        </div>

        {/* Milestone Lock Notice */}
        {!progress.allApproved && !isContractCompleted && (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-2">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Final Handover Stage Locked
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You have {progress.approved} of {progress.total} milestones approved. The final handover package can be submitted once all deliverables are verified and accepted.
            </p>
          </div>
        )}

        {/* Unlocked / Submitted Final Handover Package Details */}
        {progress.allApproved && (
          <div className="space-y-6">
            {/* If Final Handover is already submitted by Talent */}
            {contract?.finalHandover && (
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      Delivered Project Package
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Handover submitted on {new Date(contract.finalHandover.submittedAt || contract.updatedAt).toLocaleString()}
                    </span>
                  </div>

                  {contract.finalHandover.credentialsHandoverConfirmed && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle className="w-3 h-3" />
                      Asset & Access Transfer Confirmed
                    </span>
                  )}
                </div>

                {contract.finalHandover.finalNotes && (
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Final Summary & Transition Guide:
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                      {contract.finalHandover.finalNotes}
                    </p>
                  </div>
                )}

                {/* Final Links */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {contract.finalHandover.finalProjectUrl && (
                    <a
                      href={contract.finalHandover.finalProjectUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-indigo-600" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Production App</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}

                  {contract.finalHandover.repoUrl && (
                    <a
                      href={contract.finalHandover.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Github className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Final Source Code</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}

                  {contract.finalHandover.documentationUrl && (
                    <a
                      href={contract.finalHandover.documentationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-purple-600" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Documentation</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* If Client Needs to Accept Final Handover */}
            {isManager && contract?.finalHandover?.status === 'submitted' && !isContractCompleted && (
              <div className="p-6 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Ready to Sign Off & Complete Project
                  </h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    All milestones are verified and final handover assets have been provided. Click below to sign off and conclude the contract.
                  </p>
                </div>

                <button
                  type="button"
                  id="accept-final-handover-btn"
                  disabled={isAcceptingFinalHandover}
                  onClick={handleAcceptFinalHandover}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors min-h-[44px] shrink-0 shadow-sm cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAcceptingFinalHandover ? 'Signing Off...' : 'Accept Handover & Complete Project'}</span>
                </button>
              </div>
            )}

            {/* If Talent needs to submit Final Handover */}
            {isTalent && (!contract?.finalHandover || contract.finalHandover.status === 'pending') && !isContractCompleted && (
              <div>
                {!showFinalHandoverForm ? (
                  <div className="p-6 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                        Milestones Complete: Submit Final Handover Package
                      </h3>
                      <p className="text-xs text-indigo-800 dark:text-indigo-300">
                        Provide the production URLs, final repository links, and transfer confirmation to the client.
                      </p>
                    </div>

                    <button
                      type="button"
                      id="open-final-handover-btn"
                      onClick={() => setShowFinalHandoverForm(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors min-h-[44px] shrink-0 shadow-sm cursor-pointer"
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>Prepare Handover Package</span>
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmitFinalHandover}
                    className="p-6 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-4 animate-in fade-in duration-200"
                  >
                    <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                      <PackageCheck className="w-4 h-4" />
                      <span>Final Handover Package Submission</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Final Production / Deployment URL
                        </label>
                        <input
                          type="url"
                          value={finalLiveUrl}
                          onChange={(e) => setFinalLiveUrl(e.target.value)}
                          placeholder="https://app.clientdomain.com"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Final Master Code Repository URL
                        </label>
                        <input
                          type="url"
                          value={finalRepoUrl}
                          onChange={(e) => setFinalRepoUrl(e.target.value)}
                          placeholder="https://github.com/client-org/production-repo"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Documentation & Admin Handoff URL
                        </label>
                        <input
                          type="url"
                          value={finalDocsUrl}
                          onChange={(e) => setFinalDocsUrl(e.target.value)}
                          placeholder="https://notion.so/client-org/project-documentation"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Handover Summary Notes & Instructions *
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={finalNotes}
                          onChange={(e) => setFinalNotes(e.target.value)}
                          placeholder="Provide any concluding notes, maintenance instructions, or key handover points for the client team."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-2 pt-2">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmedTransfer}
                            onChange={(e) => setConfirmedTransfer(e.target.checked)}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                            I confirm that all agreed deliverables, repository permissions, documentation, and assets have been transferred to the client.
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-indigo-100 dark:border-indigo-900/40">
                      <button
                        type="button"
                        onClick={() => setShowFinalHandoverForm(false)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingFinalHandover || !confirmedTransfer || !finalNotes.trim()}
                        className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors min-h-[44px] shadow-xs cursor-pointer"
                      >
                        {isSubmittingFinalHandover ? 'Submitting...' : 'Submit Handover Package'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Celebratory Completed State */}
            {isContractCompleted && (
              <div className="p-6 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Project Successfully Completed & Signed Off!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                  All milestones have been verified and accepted. Both client and talent have concluded contract execution for{' '}
                  <strong className="text-slate-900 dark:text-white font-semibold">
                    {contract.opportunityTitle}
                  </strong>.
                </p>
                <div className="pt-2">
                  <Link
                    to="/opportunities"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors min-h-[44px]"
                  >
                    <span>Explore More Opportunities</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
        </div>
      )}

      {/* Collaborator & Team Guidelines Cards (Visible in Contacts & Milestones Tabs) */}
      {(activeTab === 'contacts' || activeTab === 'milestones') && (
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Talent Card */}
        <div
          id="handoff-applicant-card"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Selected Talent / Assignee
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {handoffData.applicantTrustTier}
              </span>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center text-lg shrink-0">
                {handoffData.applicantDisplayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {handoffData.applicantDisplayName}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Trust Score: {handoffData.applicantTrustScore}
                  </span>
                  {handoffData.applicantIdentityVerified && (
                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle className="w-3 h-3" />
                      ID Verified
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Authorized Contact Info */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="text-slate-400">Authorized Email:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {handoffData.applicantEmail}
                </span>
              </div>
              {handoffData.proposedRate && (
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span className="text-slate-400">Agreed Compensation:</span>
                  <span className="font-semibold text-emerald-600">
                    ${handoffData.proposedRate} ({handoffData.proposedRateType || 'fixed'})
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <Link
              to={`/p/${handoffData.applicantId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline min-h-[44px]"
            >
              <span>View Talent Trust Passport</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Opportunity Creator Card */}
        <div
          id="handoff-creator-card"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Opportunity Creator / Client
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/40">
                Authorized Lead
              </span>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white font-bold flex items-center justify-center text-lg shrink-0">
                {handoffData.creatorName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {handoffData.creatorName}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Project Lead & Acceptance Reviewer</p>
              </div>
            </div>

            {/* Authorized Contact & Coordination Guidelines */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
              {handoffData.creatorEmail && (
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span className="text-slate-400">Authorized Email:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {handoffData.creatorEmail}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 font-semibold text-indigo-950 dark:text-indigo-200">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Kickoff Channel:</span>
                <code className="font-mono text-indigo-600 dark:text-indigo-400 font-bold ml-auto">{contract?.conversationId}</code>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <Link
              to={`/p/${handoffData.opportunityCreatorId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline min-h-[44px]"
            >
              <span>View Client Public Passport</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* Trust Score & Security Invariant Footer */}
      <footer className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-500">
        <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Trust & Security Boundary Invariant
          </span>
          <p className="leading-relaxed">
            Contracts manage scope lock, milestone review cycles, and deliverable handoffs. Milestone reviews and digital signatures do not mutate immutable Trust Scores or identity verification tiers.
          </p>
        </div>
      </footer>
    </div>
  );
};
