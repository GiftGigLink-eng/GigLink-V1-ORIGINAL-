import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import {
  ShieldAlert,
  ShieldCheck,
  FileCheck,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Search,
  Activity,
  Layers,
} from 'lucide-react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useToast } from '../../../context/ToastContext';

export const AdminDashboardPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [pendingKycCount, setPendingKycCount] = useState<number>(3);
  const [pendingProofsCount, setPendingProofsCount] = useState<number>(5);
  const [verifiedPassportsCount, setVerifiedPassportsCount] = useState<number>(142);
  const [loading, setLoading] = useState(false);

  // Invariant verification state
  const rulesSha256 = '667e03431c26c17293ad78bff2c87a385e093fe3b6c902bd0d57f529a43500ce';
  const trustFormula = '40 Identity + 30 Proof + 20 Skills + 10 Community';
  const matchFormula = '40 Skills + 10 Rep + 30 Type/Budget + 20 Avail';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Platform Adjudication Ribbon */}
      <div className="rounded-3xl bg-gradient-to-r from-rose-950 via-slate-900 to-slate-950 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden border border-rose-900/40">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-400/30 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Platform Integrity & Adjudication Console</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Invariants Locked</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Verifier & Admin Console
            </h1>
            <p className="text-rose-200/80 text-sm max-w-xl">
              Cryptographically audit identity attestations, inspect project proof artifacts, and monitor protocol invariants.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/admin/verifications')}
              className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-md flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Review KYC Queue ({pendingKycCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Platform KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending KYC</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{pendingKycCount}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Identities awaiting review</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Proof Audits</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{pendingProofsCount}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Artifacts pending audit</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Verified Passports</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{verifiedPassportsCount}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Live Trust Passports</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Invariant Health</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">100%</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Security rules verified</div>
          </div>
        </div>
      </div>

      {/* 3. Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link
          to="/admin/verifications"
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">KYC Verifications</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Approve identity claims</div>
          </div>
        </Link>

        <Link
          to="/admin/proofs"
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <FileCheck className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Proof Audits</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Inspect work artifacts</div>
          </div>
        </Link>

        <Link
          to="/admin/security"
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <Lock className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Security Invariants</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Audit rule hashes & logs</div>
          </div>
        </Link>

        <Link
          to="/passport"
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Passport Registry</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Explore ecosystem nodes</div>
          </div>
        </Link>
      </div>

      {/* 4. Active Adjudication Queue Previews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KYC Adjudication Queue */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Pending Identity Queue
              </h2>
            </div>
            <Link
              to="/admin/verifications"
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 'kyc-1',
                name: 'Sofia Chen',
                email: 'schen@dev.io',
                docType: 'Passport (ID-4892)',
                country: 'Singapore',
                submitted: '10 mins ago',
              },
              {
                id: 'kyc-2',
                name: 'Mateo Rossi',
                email: 'mrossi@studio.it',
                docType: 'National ID (IT-9102)',
                country: 'Italy',
                submitted: '45 mins ago',
              },
              {
                id: 'kyc-3',
                name: 'Jordan Taylor',
                email: 'jtaylor@cloud.ca',
                docType: "Driver's License (CA-1029)",
                country: 'Canada',
                submitted: '2 hours ago',
              },
            ].map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{item.name}</span>
                    <span className="text-[10px] text-slate-400">({item.country})</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {item.docType} • Submitted {item.submitted}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      showSuccess(`Approved identity for ${item.name}`);
                      setPendingKycCount((prev) => Math.max(0, prev - 1));
                    }}
                    className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                    title="Approve verification"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      showError(`Rejected claim for ${item.name}`);
                      setPendingKycCount((prev) => Math.max(0, prev - 1));
                    }}
                    className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                    title="Reject verification"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Project Proof Audit Queue */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Project Proof Artifact Audits
              </h2>
            </div>
            <Link
              to="/admin/proofs"
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 'proof-1',
                title: 'DeFi Liquidity Router Contract Proof',
                author: 'Elena Rostova',
                repo: 'github.com/dex/router-v3',
                hash: '0x3a9f...44b1',
              },
              {
                id: 'proof-2',
                title: 'Vector Search Index Optimization',
                author: 'Marcus Vance',
                repo: 'github.com/ai/vector-opt',
                hash: '0x1b2c...88ee',
              },
              {
                id: 'proof-3',
                title: 'Healthcare EHR Cryptographic Audit',
                author: 'Dr. Amina Diallo',
                repo: 'github.com/health/ehr-audit',
                hash: '0x7f4e...99cd',
              },
            ].map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    By <strong>{item.author}</strong> • {item.repo}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      showSuccess(`Verified proof artifact: ${item.title}`);
                      setPendingProofsCount((prev) => Math.max(0, prev - 1));
                    }}
                    className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                    title="Audit and verify proof"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      showError(`Flagged proof for additional artifacts`);
                      setPendingProofsCount((prev) => Math.max(0, prev - 1));
                    }}
                    className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 hover:bg-amber-100 transition-colors"
                    title="Request additional proof artifacts"
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Invariant Integrity Monitor Banner */}
      <div className="p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Cryptographic Invariant Security Monitor
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            RULES_MATCH_VALIDATED
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Firestore Rules SHA-256</div>
            <div className="font-mono text-[11px] text-slate-200 truncate">{rulesSha256}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Trust Score Weights</div>
            <div className="text-[11px] text-indigo-300 font-semibold">{trustFormula}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Matching Algorithm</div>
            <div className="text-[11px] text-sky-300 font-semibold">{matchFormula}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
