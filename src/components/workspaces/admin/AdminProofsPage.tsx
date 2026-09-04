import React, { useState } from 'react';
import {
  FileCheck,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Github,
  Clock,
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

interface ProofClaim {
  id: string;
  title: string;
  talentName: string;
  talentId: string;
  category: string;
  repoUrl: string;
  liveUrl?: string;
  hash: string;
  submittedAt: string;
  status: 'pending' | 'verified' | 'flagged';
}

export const AdminProofsPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [proofs, setProofs] = useState<ProofClaim[]>([
    {
      id: 'proof-1',
      title: 'Zero-Knowledge Proof Verifier Circuit in Circom',
      talentName: 'Elena Rostova',
      talentId: 'talent-1',
      category: 'Smart Contracts / Cryptography',
      repoUrl: 'https://github.com/zk-protocol/zk-verifier',
      liveUrl: 'https://zk-verifier-demo.dev',
      hash: '0x99fa...3102',
      submittedAt: '2026-02-20 02:00 UTC',
      status: 'pending',
    },
    {
      id: 'proof-2',
      title: 'High-Throughput Vector Embedding Pipeline',
      talentName: 'Marcus Vance',
      talentId: 'talent-2',
      category: 'AI / Data Systems',
      repoUrl: 'https://github.com/ai-stack/vector-pipeline',
      hash: '0x81be...9942',
      submittedAt: '2026-02-19 23:15 UTC',
      status: 'pending',
    },
    {
      id: 'proof-3',
      title: 'Multi-Sig Governance Smart Contracts',
      talentName: 'Dr. Amina Diallo',
      talentId: 'talent-3',
      category: 'Security Auditing',
      repoUrl: 'https://github.com/audit-lab/multisig-v2',
      hash: '0x32cc...ff01',
      submittedAt: '2026-02-19 14:10 UTC',
      status: 'verified',
    },
  ]);

  const handleAction = (id: string, newStatus: ProofClaim['status'], title: string) => {
    setProofs(proofs.map((p) => (p.id === id ? { ...p, status: newStatus } : p)));
    if (newStatus === 'verified') {
      showSuccess(`Proof cryptographically attested & awarded trust score: ${title}`);
    } else {
      showError(`Proof flagged for manual investigation: ${title}`);
    }
  };

  const filteredProofs = proofs.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.talentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
            Platform Adjudication
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
          Project Proof Artifact Audits
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Verify source code commits, cryptographic signatures, and technical deliverables submitted by talent.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by proof title or talent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {['all', 'pending', 'verified', 'flagged'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                filterStatus === status
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Proof List */}
      <div className="space-y-3">
        {filteredProofs.map((proof) => (
          <div
            key={proof.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-slate-900 dark:text-white">{proof.title}</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {proof.category}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                    proof.status === 'verified'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : proof.status === 'pending'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {proof.status}
                </span>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400">
                Submitted by <strong>{proof.talentName}</strong> • {proof.submittedAt}
              </div>

              <div className="flex items-center gap-3 text-xs">
                <a
                  href={proof.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-indigo-600 font-medium"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>Repository Artifact</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span className="font-mono text-[11px] text-slate-400">Hash: {proof.hash}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {proof.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleAction(proof.id, 'verified', proof.title)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Attest & Award</span>
                  </button>
                  <button
                    onClick={() => handleAction(proof.id, 'flagged', proof.title)}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Flag / Request Fix</span>
                  </button>
                </>
              )}
              {proof.status !== 'pending' && (
                <button
                  onClick={() => handleAction(proof.id, 'pending', proof.title)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-50"
                >
                  Re-audit
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
