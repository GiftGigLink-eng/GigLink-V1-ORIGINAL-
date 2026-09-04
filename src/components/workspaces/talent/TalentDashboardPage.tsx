import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import {
  Shield,
  ShieldCheck,
  Briefcase,
  FileCheck,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award,
  Layers,
  Clock,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  PlusCircle,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Opportunity, OpportunityApplication } from '../../../types';
import { calculateOpportunityMatch } from '../../../lib/matchingService';
import { getMyApplications, getOpenOpportunities } from '../../../lib/opportunityService';

export const TalentDashboardPage: React.FC = () => {
  const { user, profile, passport, unifiedProfile } = useAuth();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [recommendedOpportunities, setRecommendedOpportunities] = useState<{
    opportunity: Opportunity;
    matchScore: number;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  // Trust score calculations
  const trustScore = passport?.metrics?.verificationScore ?? unifiedProfile?.trustScore ?? 45;
  const kycStatus = passport?.identityVerified ? 'verified' : (unifiedProfile?.identityVerified ? 'verified' : 'unverified');
  const proofCount = passport?.projects?.length ?? unifiedProfile?.projects?.length ?? 0;
  const skillCount = passport?.skills?.length ?? unifiedProfile?.skills?.length ?? 0;

  const getTier = (score: number) => {
    if (score >= 90) return { name: 'Elite Master', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' };
    if (score >= 70) return { name: 'Established Pro', color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30' };
    if (score >= 40) return { name: 'Verified Talent', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' };
    return { name: 'Emerging Talent', color: 'text-slate-500 bg-slate-500/10 border-slate-500/30' };
  };

  const tier = getTier(trustScore);

  useEffect(() => {
    async function loadTalentData() {
      if (!user) return;
      setLoading(true);
      try {
        // 1. Fetch user's active applications with in-memory sorting
        const loadedApps = await getMyApplications(user.uid);
        setApplications(loadedApps.slice(0, 5));

        // 2. Fetch open opportunities with in-memory sorting and compute match score
        const opps = await getOpenOpportunities();

        // Rank by matching engine
        const ranked = opps
          .map((opp) => {
            const matchResult = calculateOpportunityMatch(opp, unifiedProfile || undefined);
            return {
              opportunity: opp,
              matchScore: matchResult.matchPercentage,
            };
          })
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 4);

        setRecommendedOpportunities(ranked);
      } catch (err) {
        console.error('Error loading talent dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadTalentData();
  }, [user, unifiedProfile]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Trust Protocol Command Ribbon */}
      <div className="rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>Independent Talent Workspace</span>
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${tier.color}`}>
                {tier.name}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {profile?.displayName || 'Talent'}
            </h1>
            <p className="text-indigo-200/80 text-sm max-w-xl">
              Your career reputation is powered by verifiable proofs and real cryptographic trust.
            </p>
          </div>

          {/* Trust Score Radial Card */}
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black text-white">{trustScore}</div>
              <div className="text-[10px] uppercase font-bold text-indigo-200">Trust Score</div>
            </div>
            <div className="h-10 w-[1px] bg-white/20" />
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="capitalize">{kycStatus} Identity</span>
              </div>
              <div className="text-indigo-200/80 text-[11px]">
                {proofCount} Verified Proofs • {skillCount} Skills
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. First-Time Talent Quickstart Checklist (Rendered if user has low proofs or 0 applications) */}
      {(applications.length === 0 || kycStatus !== 'verified' || proofCount === 0) && (
        <div className="p-5 sm:p-6 rounded-3xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Quickstart: Launch Your Verified Talent Profile
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Complete these 3 foundational steps to maximize your Trust Score and attract top creators.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
              {[kycStatus === 'verified', proofCount > 0, applications.length > 0].filter(Boolean).length}/3 Completed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Step 1: KYC */}
            <Link
              to="/talent/passport"
              className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                kycStatus === 'verified'
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {kycStatus === 'verified' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-600 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                    1
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Verify Identity</span>
                  {kycStatus === 'verified' && <span className="text-[10px] text-emerald-600 font-bold">Done</span>}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  Unlock Level 1 KYC for +25 Trust Score points.
                </p>
              </div>
            </Link>

            {/* Step 2: Proofs */}
            <Link
              to="/profile"
              className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                proofCount > 0
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {proofCount > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-600 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                    2
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Add Project Proofs</span>
                  {proofCount > 0 && <span className="text-[10px] text-emerald-600 font-bold">{proofCount} Added</span>}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  Link GitHub, Figma, or live apps to prove execution skills.
                </p>
              </div>
            </Link>

            {/* Step 3: Browse & Apply */}
            <Link
              to="/talent/opportunities"
              className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                applications.length > 0
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {applications.length > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-600 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                    3
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Apply for First Gig</span>
                  {applications.length > 0 && <span className="text-[10px] text-emerald-600 font-bold">Active</span>}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  Submit a structured proposal with milestone timelines.
                </p>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* 3. Quick Action Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link
          to="/talent/passport"
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Trust Passport</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Manage reputation & proofs</div>
          </div>
        </Link>

        <Link
          to="/talent/opportunities"
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Explore Work</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Find matching gigs</div>
          </div>
        </Link>

        <Link
          to="/talent/applications"
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <FileCheck className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Applications</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Track status & proposals</div>
          </div>
        </Link>

        <Link
          to="/talent/milestones"
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Award className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Handoffs & Milestones</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Submit deliverable proofs</div>
          </div>
        </Link>
      </div>

      {/* 3. Main Dashboard Grid: Recommended Matches & Active Applications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: AI/Algorithmic Matching Opportunities */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Recommended Opportunities
              </h2>
            </div>
            <Link
              to="/talent/opportunities"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              Loading matching opportunities...
            </div>
          ) : recommendedOpportunities.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                No open opportunities found yet. Check back shortly!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendedOpportunities.map(({ opportunity, matchScore }) => (
                <div
                  key={opportunity.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                        {matchScore}% Match
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                        {opportunity.type}
                      </span>
                      {opportunity.compensationMin && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          ${opportunity.compensationMin}
                          {opportunity.compensationMax ? ` - $${opportunity.compensationMax}` : ''}
                          {opportunity.compensationType === 'hourly' ? '/hr' : ' fixed'}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {opportunity.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {opportunity.description}
                    </p>

                    {opportunity.requiredSkills && opportunity.requiredSkills.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {opportunity.requiredSkills.slice(0, 3).map((skill: any, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium"
                          >
                            {typeof skill === 'string' ? skill : skill?.name || String(skill)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/opportunities/${opportunity.id}`)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <span>View & Apply</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Active Applications Tracker */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                My Active Applications
              </h2>
            </div>
            <Link
              to="/talent/applications"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              All ({applications.length})
            </Link>
          </div>

          {applications.length === 0 ? (
            <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <FileText className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                You haven't submitted any applications yet.
              </p>
              <Link
                to="/talent/opportunities"
                className="inline-block mt-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-semibold"
              >
                Browse Gigs
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {applications.map((app) => (
                <div
                  key={app.id}
                  onClick={() => navigate('/talent/applications')}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {app.opportunityTitle || 'Opportunity Application'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        app.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : app.status === 'under_review'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {app.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Applied {new Date(app.submittedAt || Date.now()).toLocaleDateString()}</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">View details →</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Profile Health Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">Trust Tier Progression</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(trustScore, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Score: <strong className="text-slate-900 dark:text-white">{trustScore}/100</strong>. Add project proofs to advance to the next reputation tier.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
