import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import {
  Briefcase,
  Users,
  PlusCircle,
  FolderKanban,
  BadgeCheck,
  Clock,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Search,
  Layers,
  ChevronRight,
  TrendingUp,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { Opportunity, Application } from '../../../types';

export const CreatorDashboardPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [inboundApplications, setInboundApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCreatorData() {
      if (!user) return;
      setLoading(true);
      try {
        // 1. Fetch Creator's created opportunities
        const oppsQuery = query(
          collection(db, 'opportunities'),
          where('creatorId', '==', user.uid)
        );
        const oppsSnapshot = await getDocs(oppsQuery);
        const loadedOpps: Opportunity[] = [];
        oppsSnapshot.forEach((doc) => {
          loadedOpps.push({ id: doc.id, ...(doc.data() as any) });
        });
        loadedOpps.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setOpportunities(loadedOpps.slice(0, 10));

        // 2. Fetch Inbound Applications for Creator's opportunities
        const appsQuery = query(
          collection(db, 'applications'),
          where('opportunityCreatorId', '==', user.uid)
        );
        const appsSnapshot = await getDocs(appsQuery);
        const loadedApps: Application[] = [];
        appsSnapshot.forEach((doc) => {
          loadedApps.push({ id: doc.id, ...(doc.data() as any) });
        });
        loadedApps.sort((a, b) => {
          const timeA = a.submittedAt || (a as any).createdAt ? new Date(a.submittedAt || (a as any).createdAt).getTime() : 0;
          const timeB = b.submittedAt || (b as any).createdAt ? new Date(b.submittedAt || (b as any).createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setInboundApplications(loadedApps.slice(0, 10));
      } catch (err) {
        console.error('Error loading creator dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCreatorData();
  }, [user]);

  // Derived KPI metrics
  const activePostingsCount = opportunities.filter((o) => o.status === 'open').length;
  const pendingReviewCount = inboundApplications.filter((a) => a.status === 'under_review' || a.status === 'submitted').length;
  const acceptedHandoffsCount = inboundApplications.filter((a) => a.status === 'accepted').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Hiring Command Ribbon */}
      <div className="rounded-3xl bg-gradient-to-r from-sky-900 via-sky-800 to-slate-900 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-200 border border-sky-400/30 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-sky-300" />
                <span>Client Workspace & Hiring Hub</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {profile?.displayName || 'Client'} Workspace
            </h1>
            <p className="text-sky-200/80 text-sm max-w-xl">
              Commission work with pre-vetted talent, evaluate verified trust scores, and manage milestone handoffs.
            </p>
          </div>

          {/* Quick Post Button */}
          <button
            onClick={() => navigate('/creator/opportunities/new')}
            className="px-5 py-3 rounded-2xl bg-white text-sky-900 font-extrabold text-sm hover:bg-sky-50 transition-all shadow-md flex items-center gap-2 shrink-0"
          >
            <PlusCircle className="w-4 h-4 text-sky-600" />
            <span>Post Opportunity</span>
          </button>
        </div>
      </div>

      {/* 2. First-Time Client Quickstart Guide (Rendered if user has 0 postings) */}
      {opportunities.length === 0 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-600 text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Client Quickstart: Commission Work with Escrow Protection
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Follow the 3-step trust lifecycle to hire verified talent safely.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300">
              3 Steps to Hire
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Step 1: Post */}
            <div
              onClick={() => navigate('/creator/opportunities/new')}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 transition-all cursor-pointer flex items-start gap-3"
            >
              <div className="w-5 h-5 rounded-full border-2 border-sky-600 flex items-center justify-center text-[10px] font-bold text-sky-600 shrink-0 mt-0.5">
                1
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Post Opportunity
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  Define milestone scopes, deliverables, and compensation.
                </p>
              </div>
            </div>

            {/* Step 2: Evaluate */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3 opacity-90">
              <div className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">
                2
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Evaluate Trust Passports
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  Review applicant profiles ranked by mathematical Trust Score.
                </p>
              </div>
            </div>

            {/* Step 3: Lock & Deliver */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3 opacity-90">
              <div className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">
                3
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Lock Milestones & Escrow
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  Sign mutual contracts and release funds upon approved delivery.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Hiring KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Postings</span>
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">{activePostingsCount}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Open for applications</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Applicants</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">{inboundApplications.length}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Received across all posts</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending Review</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{pendingReviewCount}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Awaiting your evaluation</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Handoffs</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{acceptedHandoffsCount}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">In-progress collaborations</div>
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard Sections: Inbound Applicants & My Postings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Inbound Applicant Review Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Applicant Review Queue
              </h2>
            </div>
            <Link
              to="/creator/opportunities"
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
            >
              <span>Manage Postings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              Loading inbound applicants...
            </div>
          ) : inboundApplications.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                No applicants yet. Create an opportunity to start receiving verified candidates.
              </p>
              <button
                onClick={() => navigate('/creator/opportunities/new')}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors"
              >
                + Post New Opportunity
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {inboundApplications.map((app) => (
                <div
                  key={app.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {app.applicantDisplayName || 'Verified Candidate'}
                      </span>
                      {app.applicantTrustScore !== undefined && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Trust Score: {app.applicantTrustScore}</span>
                        </span>
                      )}
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

                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Applied for: <strong>{app.opportunityTitle}</strong> • {new Date(app.submittedAt || Date.now()).toLocaleDateString()}
                    </p>

                    {app.coverNote && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 italic bg-slate-50 dark:bg-slate-950 p-2 rounded-xl">
                        "{app.coverNote}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/opportunities/${app.opportunityId}/applications`)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors flex items-center gap-1.5"
                    >
                      <span>Review Candidate</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Active Postings Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                My Postings
              </h2>
            </div>
            <Link
              to="/creator/opportunities"
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
            >
              All ({opportunities.length})
            </Link>
          </div>

          {opportunities.length === 0 ? (
            <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <FolderKanban className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                You haven't posted any opportunities yet.
              </p>
              <button
                onClick={() => navigate('/creator/opportunities/new')}
                className="mt-2 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 text-xs font-semibold"
              >
                + Create First Opportunity
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  onClick={() => navigate(`/opportunities/${opp.id}/applications`)}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {opp.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        opp.status === 'open'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {opp.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{(opp as any).applicationsCount || 0} applicants</span>
                    <span className="font-semibold text-sky-600 dark:text-sky-400">Manage →</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Verification Protocol Requirement Tip */}
          <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800/80 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900 dark:text-sky-200">
              <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Trust Protocol Guarantee</span>
            </div>
            <p className="text-[11px] text-sky-800 dark:text-sky-300 leading-relaxed">
              Every applicant comes with a cryptographically verified Trust Passport, transparent proof links, and skill level validation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
