import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import {
  Building2,
  Users,
  Briefcase,
  Shield,
  ShieldCheck,
  PlusCircle,
  FolderKanban,
  FileCheck,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Award,
  Sparkles,
  Lock,
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { Opportunity, Application } from '../../../types';

export const EnterpriseDashboardPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [inboundApplications, setInboundApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const orgName = profile?.organization?.name || (profile as any)?.organizationName || 'Enterprise Organization';
  const orgId = profile?.organizationId;

  useEffect(() => {
    async function loadEnterpriseData() {
      if (!user) return;
      setLoading(true);
      try {
        // 1. Fetch Organization's opportunities
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

        // 2. Fetch Inbound Applications
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
        console.error('Error loading enterprise dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadEnterpriseData();
  }, [user]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Organization Console Ribbon */}
      <div className="rounded-3xl bg-gradient-to-r from-purple-950 via-purple-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-200 border border-purple-400/30 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-purple-300" />
                <span>Organization & Enterprise Console</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>KYB Verified</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {orgName} Console
            </h1>
            <p className="text-purple-200/80 text-sm max-w-xl">
              Scale enterprise talent pipelines, assign role-based seat access, and manage institutional verified contracts.
            </p>
          </div>

          {/* Enterprise Action Controls */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/enterprise/team')}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
            >
              <Users className="w-4 h-4 text-purple-300" />
              <span>Team Seats</span>
            </button>
            <button
              onClick={() => navigate('/opportunities/create')}
              className="px-4 py-2.5 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs transition-colors shadow-md flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Post Enterprise Gig</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Enterprise KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Team Seats</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">4 / 10</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Seats allocated</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Enterprise Postings</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">{opportunities.length}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Active listings</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Talent Bench</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">24</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Pre-vetted talent pool</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Compliance & KYB</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">100%</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Institutional certified</div>
          </div>
        </div>
      </div>

      {/* 3. Quick Action Hub */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link
          to="/enterprise/team"
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Team & Seats</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Manage staff permissions</div>
          </div>
        </Link>

        <Link
          to="/enterprise/bench"
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Talent Bench</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">High-trust vetted creators</div>
          </div>
        </Link>

        <Link
          to="/enterprise/opportunities"
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Org Postings</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Departmental listings</div>
          </div>
        </Link>

        <Link
          to="/enterprise/compliance"
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Compliance & KYB</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Audit trail & docs</div>
          </div>
        </Link>
      </div>

      {/* 4. Enterprise Pipelines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Enterprise Opportunities */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Enterprise Postings & Pipelines
              </h2>
            </div>
            <Link
              to="/enterprise/opportunities"
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              Loading enterprise postings...
            </div>
          ) : opportunities.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                No active enterprise postings found. Create your organization's first posting.
              </p>
              <button
                onClick={() => navigate('/opportunities/create')}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors"
              >
                + Post Enterprise Opportunity
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 uppercase">
                        {opp.type}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                        {opp.status}
                      </span>
                      {opp.compensationMin && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          ${opp.compensationMin}
                          {opp.compensationMax ? ` - $${opp.compensationMax}` : ''}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {opp.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {(opp as any).applicationsCount || 0} applicants received
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/opportunities/${opp.id}/applications`)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-1.5"
                    >
                      <span>Manage Applicants</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Talent Bench Quick Access */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Vetted Talent Bench
              </h2>
            </div>
            <Link
              to="/enterprise/bench"
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
            >
              Explore Pool
            </Link>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 flex items-center justify-center font-bold text-sm">
                EP
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Enterprise Fast-Track</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Trust Score 80+ only</div>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Access 24+ top verified developers, designers, and domain specialists with proven project proofs.
            </p>
            <button
              onClick={() => navigate('/enterprise/bench')}
              className="w-full py-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 font-bold text-xs hover:bg-purple-100 transition-colors"
            >
              Browse Enterprise Bench →
            </button>
          </div>

          {/* Org Profile Link Card */}
          {orgId && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white">Public Brand Showcase</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Manage your organization profile, brand logo, and public job board.
              </p>
              <Link
                to={`/org/${orgId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
              >
                <span>View Public Org Profile</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
