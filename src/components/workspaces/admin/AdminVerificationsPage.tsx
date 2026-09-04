import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Eye,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

interface VerificationClaim {
  id: string;
  name: string;
  email: string;
  documentType: string;
  documentNumber: string;
  country: string;
  submittedAt: string;
  status: 'pending' | 'verified' | 'rejected' | 'changes_requested';
}

export const AdminVerificationsPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [claims, setClaims] = useState<VerificationClaim[]>([
    {
      id: 'claim-1',
      name: 'Sofia Chen',
      email: 'schen@dev.io',
      documentType: 'International Passport',
      documentNumber: 'P-9842104',
      country: 'Singapore',
      submittedAt: '2026-02-20 03:15 UTC',
      status: 'pending',
    },
    {
      id: 'claim-2',
      name: 'Mateo Rossi',
      email: 'mrossi@studio.it',
      documentType: 'National Identity Card',
      documentNumber: 'IT-4491023',
      country: 'Italy',
      submittedAt: '2026-02-20 02:40 UTC',
      status: 'pending',
    },
    {
      id: 'claim-3',
      name: 'Jordan Taylor',
      email: 'jtaylor@cloud.ca',
      documentType: "Driver's License",
      documentNumber: 'DL-CA-99120',
      country: 'Canada',
      submittedAt: '2026-02-20 01:10 UTC',
      status: 'pending',
    },
    {
      id: 'claim-4',
      name: 'Elena Rostova',
      email: 'erostova@zk.net',
      documentType: 'International Passport',
      documentNumber: 'P-1123984',
      country: 'United Kingdom',
      submittedAt: '2026-02-19 18:22 UTC',
      status: 'verified',
    },
  ]);

  const handleAction = (id: string, newStatus: VerificationClaim['status'], name: string) => {
    setClaims(claims.map((c) => (c.id === id ? { ...c, status: newStatus } : c)));
    if (newStatus === 'verified') {
      showSuccess(`Attestation confirmed & verified for ${name}`);
    } else if (newStatus === 'rejected') {
      showError(`Verification rejected for ${name}`);
    } else {
      showSuccess(`Requested additional verification documents from ${name}`);
    }
  };

  const filteredClaims = claims.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
            Platform Adjudication
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
          Identity & KYC Adjudication Queue
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Authorize Tier-1 and Tier-2 cryptographic identity attestations across the talent ecosystem.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {['all', 'pending', 'verified', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                filterStatus === status
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Claims List */}
      <div className="space-y-3">
        {filteredClaims.map((claim) => (
          <div
            key={claim.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{claim.name}</h3>
                <span className="text-xs text-slate-400">({claim.country})</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                    claim.status === 'verified'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : claim.status === 'pending'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {claim.status}
                </span>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400">
                {claim.email} • {claim.documentType} ({claim.documentNumber})
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Submitted at {claim.submittedAt}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {claim.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleAction(claim.id, 'verified', claim.name)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleAction(claim.id, 'changes_requested', claim.name)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Req. Docs</span>
                  </button>
                  <button
                    onClick={() => handleAction(claim.id, 'rejected', claim.name)}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </>
              )}
              {claim.status !== 'pending' && (
                <button
                  onClick={() => handleAction(claim.id, 'pending', claim.name)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-50"
                >
                  Reopen Claim
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
