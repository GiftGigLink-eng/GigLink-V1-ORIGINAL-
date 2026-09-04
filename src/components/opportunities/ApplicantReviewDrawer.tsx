import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Opportunity,
  OpportunityApplication,
  PublicTrustPassport,
  OpportunityMatchExplanation,
  ProjectProof,
  SkillItem,
} from '../../types';
import { calculateOpportunityMatch } from '../../lib/matchingService';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Briefcase,
  Calendar,
  DollarSign,
  User,
  Clock,
  Layers,
  FolderGit2,
  Award,
  Check,
  Send,
  Lock,
  ChevronRight,
  Info,
} from 'lucide-react';

interface ApplicantReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  application: OpportunityApplication | null;
  opportunity: Opportunity | null;
  onUpdateStatus: (
    app: OpportunityApplication,
    newStatus: 'under_review' | 'shortlisted' | 'accepted' | 'declined',
    feedback?: string
  ) => Promise<void>;
  updating: boolean;
}

export const ApplicantReviewDrawer: React.FC<ApplicantReviewDrawerProps> = ({
  isOpen,
  onClose,
  application,
  opportunity,
  onUpdateStatus,
  updating,
}) => {
  const [publicPassport, setPublicPassport] = useState<PublicTrustPassport | null>(null);
  const [loadingPassport, setLoadingPassport] = useState<boolean>(false);
  const [matchExplanation, setMatchExplanation] = useState<OpportunityMatchExplanation | null>(null);
  const [feedbackNote, setFeedbackNote] = useState<string>('');
  const [selectedTargetStatus, setSelectedTargetStatus] = useState<
    'under_review' | 'shortlisted' | 'accepted' | 'declined' | null
  >(null);
  const [activeTab, setActiveTab] = useState<'fit' | 'snapshot' | 'portfolio' | 'pitch'>('fit');

  // Load applicant's public passport when drawer opens
  useEffect(() => {
    if (!isOpen || !application) {
      setPublicPassport(null);
      setMatchExplanation(null);
      setFeedbackNote('');
      setSelectedTargetStatus(null);
      return;
    }

    setFeedbackNote(application.creatorFeedback || '');

    const fetchApplicantPassport = async () => {
      setLoadingPassport(true);
      try {
        const passportRef = doc(db, 'publicTrustPassports', application.applicantId);
        const passportSnap = await getDoc(passportRef);
        if (passportSnap.exists()) {
          const data = passportSnap.data() as PublicTrustPassport;
          setPublicPassport(data);

          if (opportunity) {
            const explanation = calculateOpportunityMatch(opportunity, data);
            setMatchExplanation(explanation);
          }
        } else {
          setPublicPassport(null);
          // Fallback match calculation using application snapshot
          if (opportunity) {
            const explanation = calculateOpportunityMatch(opportunity, {
              trustScore: application.applicantTrustScore,
              trustTier: application.applicantTrustTier,
            });
            setMatchExplanation(explanation);
          }
        }
      } catch (err) {
        console.error('Error fetching applicant public passport:', err);
      } finally {
        setLoadingPassport(false);
      }
    };

    fetchApplicantPassport();
  }, [isOpen, application, opportunity]);

  if (!isOpen || !application) return null;

  const currentStatus = application.status;

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

  const handleActionClick = (targetStatus: 'under_review' | 'shortlisted' | 'accepted' | 'declined') => {
    setSelectedTargetStatus(targetStatus);
  };

  const handleConfirmDecision = async () => {
    if (!selectedTargetStatus || !application) return;
    await onUpdateStatus(application, selectedTargetStatus, feedbackNote.trim() || undefined);
    setSelectedTargetStatus(null);
  };

  return (
    <div
      id="applicant-review-drawer-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="applicant-review-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="applicant-drawer-title"
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
      >
        {/* Drawer Sticky Header */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0 text-sm">
              {application.applicantDisplayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="applicant-drawer-title"
                  className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate"
                >
                  {application.applicantDisplayName}
                </h2>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border capitalize shrink-0 ${getStatusBadge(
                    application.status
                  )}`}
                >
                  {application.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                Applied on {new Date(application.submittedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-applicant-drawer-btn"
            onClick={onClose}
            aria-label="Close candidate review drawer"
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Tabs Navigation */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 bg-slate-50/50 dark:bg-slate-950/30 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('fit')}
            className={`px-3.5 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors min-h-[44px] flex items-center gap-1.5 ${
              activeTab === 'fit'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Explainable Fit ({matchExplanation?.matchPercentage ?? '—'}%)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('snapshot')}
            className={`px-3.5 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors min-h-[44px] flex items-center gap-1.5 ${
              activeTab === 'snapshot'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Trust Snapshot vs Live</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pitch')}
            className={`px-3.5 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors min-h-[44px] flex items-center gap-1.5 ${
              activeTab === 'pitch'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Pitch & Terms</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('portfolio')}
            className={`px-3.5 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors min-h-[44px] flex items-center gap-1.5 ${
              activeTab === 'portfolio'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>Verified Proofs ({publicPassport?.projects?.length ?? 0})</span>
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
          {/* TAB 1: EXPLAINABLE FIT ASSESSMENT */}
          {activeTab === 'fit' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Score Banner */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-indigo-600 text-white font-extrabold text-sm">
                      {matchExplanation?.matchPercentage ?? 0}%
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {matchExplanation?.matchPercentage && matchExplanation.matchPercentage >= 80
                          ? 'Strong Candidate Fit'
                          : matchExplanation?.matchPercentage && matchExplanation.matchPercentage >= 60
                          ? 'Good Candidate Fit'
                          : matchExplanation?.matchPercentage && matchExplanation.matchPercentage >= 40
                          ? 'Moderate Candidate Fit'
                          : 'Potential Candidate Fit'}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Evaluated deterministically against opportunity requirements
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 block">
                      Trust Tier: {application.applicantTrustTier}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                  {matchExplanation?.summary ||
                    'Candidate trust tier and credentials meet baseline suitability criteria.'}
                </p>
              </div>

              {/* 4-Part Point Breakdown */}
              {matchExplanation?.breakdown && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Scoring Breakdown (100 pts max)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block">Verified Skills</span>
                      <strong className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                        {matchExplanation.breakdown.verifiedSkillPoints} / 40
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block">Self-Declared</span>
                      <strong className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
                        {matchExplanation.breakdown.selfDeclaredSkillPoints} / 10
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block">Trust Tier</span>
                      <strong className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                        {matchExplanation.breakdown.trustTierPoints} / 30
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block">Experience</span>
                      <strong className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
                        {matchExplanation.breakdown.experiencePoints} / 20
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Matched vs Missing Skills */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Skill Alignment
                </h4>

                {matchExplanation?.matchedSkills && matchExplanation.matchedSkills.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block mb-1.5">
                      Matched Skills ({matchExplanation.matchedSkills.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {matchExplanation.matchedSkills.map((sk, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
                            sk.verified
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {sk.verified && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
                          <span>{sk.name}</span>
                          <span className="text-[10px] opacity-75">
                            {sk.verified ? '(Verified)' : '(Self-declared)'}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {matchExplanation?.missingSkills && matchExplanation.missingSkills.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block mb-1.5">
                      Unmatched Required Skills ({matchExplanation.missingSkills.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {matchExplanation.missingSkills.map((sk, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border bg-amber-50/60 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/40"
                        >
                          <span>{sk}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: APPLICATION-TIME SNAPSHOT VS LIVE PROFILE */}
          {activeTab === 'snapshot' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-300">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Immutable Trust Record Verification</span>
                </div>
                <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                  GigLink captures an immutable snapshot of the applicant's Trust Score and credentials at the exact moment of application submission.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Snapshot Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Application Snapshot
                    </span>
                    <span className="text-[10px] text-slate-400">Captured at Submission</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Trust Tier:</span>
                      <strong className="text-slate-900 dark:text-white">
                        {application.applicantTrustTier}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Trust Score:</span>
                      <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold">
                        {application.applicantTrustScore} / 100
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Identity Status:</span>
                      <span
                        className={`font-semibold ${
                          application.applicantIdentityVerified ? 'text-emerald-600' : 'text-slate-500'
                        }`}
                      >
                        {application.applicantIdentityVerified ? 'Verified' : 'Unverified'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Submitted:</span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {new Date(application.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Current Live Profile */}
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      Current Live Profile
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Live Synced
                    </span>
                  </div>

                  {loadingPassport ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      Loading current live credentials...
                    </div>
                  ) : publicPassport ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Live Trust Tier:</span>
                        <strong className="text-slate-900 dark:text-white">
                          {publicPassport.trustTier}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Live Trust Score:</span>
                        <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold">
                          {publicPassport.trustScore} / 100
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Live Identity:</span>
                        <span
                          className={`font-semibold ${
                            publicPassport.identityVerified ? 'text-emerald-600' : 'text-slate-500'
                          }`}
                        >
                          {publicPassport.identityVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Verified Skills:</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">
                          {(publicPassport.skills || []).filter((s) => s.verifiedCount > 0).length} skills
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-400">
                      Live passport is private or inactive.
                    </div>
                  )}
                </div>
              </div>

              {/* Full Passport Link */}
              <div className="pt-2">
                <Link
                  to={`/p/${application.applicantId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 transition-colors min-h-[44px]"
                >
                  <span>Open Full Public Trust Passport</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* TAB 3: PITCH & SUBMITTED TERMS */}
          {activeTab === 'pitch' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Pitch / Cover Note */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Applicant Pitch / Cover Note
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {application.coverNote || 'No cover note provided.'}
                </p>
              </div>

              {/* Proposed Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-1">Proposed Compensation</span>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white">
                    {application.proposedRate
                      ? `$${application.proposedRate} (${application.proposedRateType || 'fixed'})`
                      : 'Standard listing terms accepted'}
                  </strong>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-1">Earliest Availability</span>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white">
                    {application.availabilityDate || 'Immediate'}
                  </strong>
                </div>
              </div>

              {/* Portfolio Links */}
              {application.portfolioLinks && application.portfolioLinks.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Attached Work Samples & Repositories
                  </span>
                  <div className="space-y-1.5">
                    {application.portfolioLinks.map((link, idx) => (
                      <a
                        key={idx}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 transition-colors text-xs font-medium text-indigo-600 dark:text-indigo-400 min-h-[44px]"
                      >
                        <span className="truncate">{link}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Screening Answers */}
              {application.screeningAnswers &&
                Object.keys(application.screeningAnswers).length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Screening Question Answers
                    </span>
                    <div className="space-y-2">
                      {Object.entries(application.screeningAnswers).map(([q, a], idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                        >
                          <strong className="text-slate-700 dark:text-slate-300 block">{q}</strong>
                          <p className="text-slate-600 dark:text-slate-400">{a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* TAB 4: VERIFIED PROOFS & CASE STUDIES */}
          {activeTab === 'portfolio' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {loadingPassport ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Loading verified project proofs...
                </div>
              ) : publicPassport?.projects && publicPassport.projects.length > 0 ? (
                <div className="space-y-3">
                  {publicPassport.projects.map((proj: ProjectProof) => (
                    <div
                      key={proj.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {proj.title}
                          </h4>
                          <span className="text-[11px] text-slate-500">Role: {proj.role}</span>
                        </div>
                        {proj.verificationStatus === 'verified' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified Proof
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Self-Reported
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {proj.description}
                      </p>

                      {proj.skillsUsed && proj.skillsUsed.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {proj.skillsUsed.map((sk, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}

                      {proj.projectUrl && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <a
                            href={proj.projectUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            <span>View Live Project</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          {proj.verifierName && (
                            <span className="text-[10px] text-slate-400">
                              Verified by {proj.verifierName}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                  No public project proofs published on this candidate's profile.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Sticky Footer: Creator Pipeline Decision */}
        <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-3">
          {/* Current Decision State or Decision Trigger */}
          {selectedTargetStatus ? (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Confirm Decision: Move candidate to{' '}
                  <span className="capitalize font-extrabold text-indigo-600">
                    {selectedTargetStatus.replace('_', ' ')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTargetStatus(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Creator Feedback Note to Applicant (Optional)
                </label>
                <textarea
                  rows={2}
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  placeholder="Share feedback on qualifications, next interview steps, or decision rationale..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedTargetStatus(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
                >
                  Back
                </button>
                <button
                  type="button"
                  id="confirm-pipeline-transition-btn"
                  disabled={updating}
                  onClick={handleConfirmDecision}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors min-h-[44px]"
                >
                  {updating ? (
                    <span>Saving Decision...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Confirm {selectedTargetStatus.replace('_', ' ')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : currentStatus === 'withdrawn' ? (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 text-center font-medium">
              This application was withdrawn by the applicant.
            </div>
          ) : currentStatus === 'accepted' ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 text-xs text-center font-medium flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Application has been Accepted (Offer Extended).</span>
              </div>
              {opportunity && (
                <Link
                  id="drawer-open-handoff-btn"
                  to={`/opportunities/${opportunity.id}/handoff/${application.id}`}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors min-h-[44px] shadow-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Open Collaboration Handoff & Milestones</span>
                </Link>
              )}
            </div>
          ) : currentStatus === 'declined' ? (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 text-xs text-center font-medium">
              Application was declined.
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Pipeline Progress Actions
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {/* Legal Transition: submitted -> under_review */}
                {currentStatus === 'submitted' && (
                  <button
                    type="button"
                    id="action-start-review-btn"
                    onClick={() => handleActionClick('under_review')}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors min-h-[44px] flex-1"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Move to Under Review</span>
                  </button>
                )}

                {/* Legal Transition: under_review -> shortlisted or declined */}
                {currentStatus === 'under_review' && (
                  <>
                    <button
                      type="button"
                      id="action-shortlist-btn"
                      onClick={() => handleActionClick('shortlisted')}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors min-h-[44px] flex-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Shortlist Candidate</span>
                    </button>
                    <button
                      type="button"
                      id="action-decline-btn"
                      onClick={() => handleActionClick('declined')}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors min-h-[44px]"
                    >
                      <span>Decline</span>
                    </button>
                  </>
                )}

                {/* Legal Transition: shortlisted -> accepted or declined */}
                {currentStatus === 'shortlisted' && (
                  <>
                    <button
                      type="button"
                      id="action-accept-btn"
                      onClick={() => handleActionClick('accepted')}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[44px] flex-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept (Extend Offer)</span>
                    </button>
                    <button
                      type="button"
                      id="action-decline-btn"
                      onClick={() => handleActionClick('declined')}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors min-h-[44px]"
                    >
                      <span>Decline</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
