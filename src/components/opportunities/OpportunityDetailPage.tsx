import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Opportunity, OpportunityApplication, PublicTrustPassport, OpportunityMatchExplanation } from '../../types';
import {
  getOpportunityById,
  getExistingApplication,
  submitOpportunityApplication,
  updateOpportunity,
} from '../../lib/opportunityService';
import { calculateOpportunityMatch } from '../../lib/matchingService';
import { MatchExplanationModal } from './MatchExplanationModal';
import { ProposalSubmissionModal } from './ProposalSubmissionModal';
import { OpportunityProposalsSection } from './OpportunityProposalsSection';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  ShieldCheck,
  Building2,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  User,
  Sparkles,
  Award,
  Layers,
  FileText,
} from 'lucide-react';

export const OpportunityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile, passport, unifiedProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Invariant: Authenticated users with incomplete onboarding cannot access workspace opportunity details
  if (user && profile && profile.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [existingApp, setExistingApp] = useState<OpportunityApplication | null>(null);
  const [creatorPassport, setCreatorPassport] = useState<PublicTrustPassport | null>(null);
  const [myPassport, setMyPassport] = useState<PublicTrustPassport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [showProposalModal, setShowProposalModal] = useState<boolean>(false);
  const [showMatchModal, setShowMatchModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'details' | 'proposals'>('details');

  // Form State for Application
  const [coverNote, setCoverNote] = useState<string>('');
  const [proposedRate, setProposedRate] = useState<string>('');
  const [proposedRateType, setProposedRateType] = useState<string>('fixed');
  const [availabilityDate, setAvailabilityDate] = useState<string>('');
  const [portfolioLink, setPortfolioLink] = useState<string>('');
  const [screeningAnswers, setScreeningAnswers] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const candidateData = unifiedProfile || passport || profile;
  const matchExplanation: OpportunityMatchExplanation | null =
    opportunity && candidateData ? calculateOpportunityMatch(opportunity, candidateData) : null;

  const isCreator = Boolean(user && opportunity && opportunity.creatorId === user.uid);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const oppData = await getOpportunityById(id);
      setOpportunity(oppData);

      if (oppData) {
        // Fetch Creator's Public Trust Passport
        try {
          const creatorSnap = await getDoc(doc(db, 'publicTrustPassports', oppData.creatorId));
          if (creatorSnap.exists()) {
            setCreatorPassport(creatorSnap.data() as PublicTrustPassport);
          }
        } catch (e) {
          console.error('Could not fetch creator passport:', e);
        }

        // If user signed in, check for existing application & user's public passport
        if (user) {
          const existing = await getExistingApplication(oppData.id, user.uid);
          setExistingApp(existing);

          try {
            const mySnap = await getDoc(doc(db, 'publicTrustPassports', user.uid));
            if (mySnap.exists()) {
              setMyPassport(mySnap.data() as PublicTrustPassport);
            }
          } catch (e) {
            console.error('Could not fetch applicant passport:', e);
          }
        }
      }
    } catch (err) {
      console.error('Error loading opportunity:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, user]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !opportunity) return;

    if (coverNote.trim().length < 50) {
      setFormError('Please provide a cover note of at least 50 characters describing your fit.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await submitOpportunityApplication({
        opportunity,
        applicantId: user.uid,
        applicantDisplayName: profile?.displayName || user.displayName || 'Applicant',
        applicantEmail: profile?.email || user.email || '',
        publicPassport: myPassport,
        coverNote: coverNote.trim(),
        proposedRate: proposedRate ? parseFloat(proposedRate) : null,
        proposedRateType,
        availabilityDate: availabilityDate || null,
        portfolioLinks: portfolioLink.trim() ? [portfolioLink.trim()] : [],
        screeningAnswers,
      });

      showToast('Application submitted successfully!', 'success');
      setShowApplyModal(false);

      // Refresh existing application state
      const existing = await getExistingApplication(opportunity.id, user.uid);
      setExistingApp(existing);
    } catch (err: any) {
      console.error('Submission error:', err);
      setFormError('Failed to submit application. Please check your permissions or network.');
      showToast('Application submission failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 animate-pulse">
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-md w-1/4 mb-4" />
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4 mb-6" />
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-full mb-3" />
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-5/6 mb-3" />
        </div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Opportunity Not Found</h2>
        <p className="text-xs text-slate-500 mb-6">
          This listing may have expired, been closed, or does not exist.
        </p>
        <Link
          to="/opportunities"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </Link>
      </div>
    );
  }

  return (
    <div id="opportunity-detail-page" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link
          to="/opportunities"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to all opportunities</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 uppercase tracking-wider">
                {opportunity.type}
              </span>
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-lg uppercase tracking-wider ${
                  opportunity.status === 'open'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {opportunity.status}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              {opportunity.title}
            </h1>

            {/* Quick Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Location Mode</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {opportunity.locationType}
                  {opportunity.locationString ? ` (${opportunity.locationString})` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Compensation</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  {opportunity.compensationType === 'competitive'
                    ? 'Competitive'
                    : `${opportunity.currency} ${opportunity.compensationMin || 0}${
                        opportunity.compensationMax ? ` - ${opportunity.compensationMax}` : ''
                      }`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Posted</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(opportunity.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Tab Navigation (Details vs Structured Proposals) */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'details'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Opportunity Details</span>
            </button>
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
              <span>Milestone Proposals</span>
            </button>
          </div>

          {activeTab === 'details' ? (
            <>
              {/* Description Section */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">
                  Opportunity Scope & Brief
                </h2>
                <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {opportunity.description}
                </div>
              </div>

              {/* Required Skills Section */}
              {opportunity.requiredSkills && opportunity.requiredSkills.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">
                    Required Skills & Tech Stack
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {opportunity.requiredSkills.map((skill, index) => (
                      <span
                        key={index}
                        className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-xl"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Screening Questions (if any) */}
              {opportunity.screeningQuestions && opportunity.screeningQuestions.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">
                    Screening Questions
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    {opportunity.screeningQuestions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <OpportunityProposalsSection
              opportunity={opportunity}
              currentUserId={user?.uid || ''}
              isCreator={isCreator}
              onOpportunityUpdated={loadData}
            />
          )}
        </div>

        {/* Sidebar Actions & Creator Card (1 Column) */}
        <div className="space-y-6">
          {/* Action Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs sticky top-24">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Application Status
            </h3>

            {/* Explainable Fit Assessment (For authenticated candidates before applying) */}
            {user && matchExplanation && !isCreator && (
              <div
                id="opportunity-detail-match-card"
                className="mb-4 p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/50 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-extrabold text-xs text-indigo-700 dark:text-indigo-300">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Explainable Fit Assessment</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      matchExplanation.matchPercentage >= 80
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : matchExplanation.matchPercentage >= 60
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {matchExplanation.matchPercentage}% Match
                  </span>
                </div>

                {/* Match Progress Meter */}
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      matchExplanation.matchPercentage >= 80
                        ? 'bg-emerald-500'
                        : matchExplanation.matchPercentage >= 60
                        ? 'bg-indigo-600'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.max(5, matchExplanation.matchPercentage)}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {matchExplanation.summary}
                </p>

                {/* Matched vs Missing Summary */}
                <div className="space-y-1.5 pt-1 text-[11px]">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span>Verified Skills Match:</span>
                    <strong className="text-slate-900 dark:text-white">
                      {matchExplanation.matchedSkills.filter((s) => s.verified).length} of{' '}
                      {opportunity.requiredSkills.length} verified
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span>Trust Tier Suitability:</span>
                    <span
                      className={`font-semibold capitalize ${
                        matchExplanation.trustTierFit === 'exceeds' ||
                        matchExplanation.trustTierFit === 'meets'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {matchExplanation.trustTierFit}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  id="detail-why-match-btn"
                  onClick={() => setShowMatchModal(true)}
                  className="w-full py-2 rounded-xl text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer min-h-[36px]"
                >
                  View Full Scoring Breakdown →
                </button>
              </div>
            )}

            {isCreator ? (
              <div className="space-y-3 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60">
                <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>You are managing this listing</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  As the opportunity creator, review incoming applicant proposals, evaluate Trust Passports, and initiate milestone contracts.
                </p>
                <Link
                  to={`/opportunities/${opportunity.id}/applications`}
                  id="creator-manage-applicants-btn"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors min-h-[44px] shadow-xs"
                >
                  <User className="w-4 h-4" />
                  <span>Review Proposals & Applicants</span>
                </Link>
                <Link
                  to={`/opportunities/${opportunity.id}/edit`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors min-h-[44px]"
                >
                  <span>Edit Listing Parameters</span>
                </Link>
              </div>
            ) : existingApp ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>You have applied for this opportunity!</span>
                </div>
                <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                  <div>
                    Status:{' '}
                    <strong className="capitalize text-slate-900 dark:text-white">
                      {existingApp.status.replace('_', ' ')}
                    </strong>
                  </div>
                  <div>Submitted on: {new Date(existingApp.submittedAt).toLocaleDateString()}</div>
                  {existingApp.creatorFeedback && (
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mt-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Creator Feedback:
                      </span>
                      <p className="italic text-slate-600 dark:text-slate-400">
                        {existingApp.creatorFeedback}
                      </p>
                    </div>
                  )}
                </div>
                <Link
                  to="/my-applications"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors min-h-[44px]"
                >
                  <span>View in My Applications</span>
                </Link>
              </div>
            ) : opportunity.status !== 'open' ? (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs border border-amber-200 dark:border-amber-800/50">
                This opportunity is currently {opportunity.status} and not accepting applications.
              </div>
            ) : !user ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Sign in or register to submit your verified application.
                </p>
                <Link
                  to="/auth/login"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors min-h-[44px]"
                >
                  <span>Sign in to Apply</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {opportunity.recommendedTrustTier && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs border border-indigo-100 dark:border-indigo-900/40">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Recommended: {opportunity.recommendedTrustTier}</span>
                  </div>
                )}
                <button
                  id="open-proposal-modal-btn"
                  onClick={() => setShowProposalModal(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-sm min-h-[44px]"
                >
                  <Layers className="w-4 h-4" />
                  <span>Submit Structured Proposal</span>
                </button>
                <button
                  id="open-apply-modal-btn"
                  onClick={() => setShowApplyModal(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors min-h-[40px]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Quick Pitch / Apply</span>
                </button>
              </div>
            )}
          </div>

          {/* Creator Profile Summary Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              About the Creator
            </h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                {(opportunity.creatorName || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {opportunity.creatorName || 'Verified Creator'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {opportunity.organizationId ? 'Organization Lead' : 'Client / Partner'}
                </span>
              </div>
            </div>

            {creatorPassport && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Trust Tier:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {creatorPassport.trustTier}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Identity Verified:</span>
                  <span className="font-semibold text-emerald-600">
                    {creatorPassport.identityVerified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
                <Link
                  to={`/p/${opportunity.creatorId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline pt-2"
                >
                  <span>View Creator's Public Passport</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Application Submission Slide-over Modal */}
      {showApplyModal && (
        <div
          id="apply-modal-backdrop"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            id="apply-modal-content"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Apply for {opportunity.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Submit your pitch backed by your verified Trust Passport.
                </p>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {/* Read-Only Passport Snapshot Highlight */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 mb-6 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    {profile?.displayName || user?.displayName || 'Applicant'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Tier: {myPassport?.trustTier || 'Unverified'} (Score: {myPassport?.trustScore || 0})
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                Snapshot attached
              </span>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleApplySubmit} className="space-y-4">
              {/* Cover Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cover Note / Pitch (Min 50 characters) *
                </label>
                <textarea
                  id="application-cover-note"
                  required
                  rows={4}
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Explain why you are the best fit for this project, your approach, and relevant experience..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-400 block text-right mt-0.5">
                  {coverNote.length} / 2000 chars
                </span>
              </div>

              {/* Proposed Rate & Rate Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Proposed Rate / Fee ({opportunity.currency})
                  </label>
                  <input
                    type="number"
                    id="application-proposed-rate"
                    value={proposedRate}
                    onChange={(e) => setProposedRate(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fee Type
                  </label>
                  <select
                    id="application-rate-type"
                    value={proposedRateType}
                    onChange={(e) => setProposedRateType(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="fixed">Fixed Price</option>
                    <option value="hourly">Per Hour</option>
                  </select>
                </div>
              </div>

              {/* Availability Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Earliest Start Date
                </label>
                <input
                  type="date"
                  id="application-availability-date"
                  value={availabilityDate}
                  onChange={(e) => setAvailabilityDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Portfolio Link */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Relevant Work URL / Portfolio Sample
                </label>
                <input
                  type="url"
                  id="application-portfolio-link"
                  value={portfolioLink}
                  onChange={(e) => setPortfolioLink(e.target.value)}
                  placeholder="https://github.com/username/project or https://portfolio.com"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="submit-application-confirm-btn"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors min-h-[40px]"
                >
                  {submitting ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Application</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phase 8 Proposal Submission Modal */}
      {showProposalModal && opportunity && user && (
        <ProposalSubmissionModal
          opportunity={opportunity}
          userId={user.uid}
          userDisplayName={profile?.displayName || user.displayName || user.email || 'Applicant'}
          userEmail={user.email || ''}
          myPassport={myPassport}
          onSuccess={() => {
            setShowProposalModal(false);
            setActiveTab('proposals');
            loadData();
          }}
          onClose={() => setShowProposalModal(false)}
        />
      )}

      {/* Match Explanation Modal */}
      {matchExplanation && opportunity && (
        <MatchExplanationModal
          isOpen={showMatchModal}
          onClose={() => setShowMatchModal(false)}
          opportunityTitle={opportunity.title}
          match={matchExplanation}
        />
      )}
    </div>
  );
};
