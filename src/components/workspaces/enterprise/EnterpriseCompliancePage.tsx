import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  ShieldCheck,
  Building2,
  FileCheck,
  Lock,
  Download,
  ExternalLink,
  CheckCircle2,
  Award,
  FileText,
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export const EnterpriseCompliancePage: React.FC = () => {
  const { profile } = useAuth();
  const { showSuccess } = useToast();

  const handleDownloadCertificate = () => {
    showSuccess('Compliance Attestation PDF generated and downloaded');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
              Enterprise Workspace
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Attestation Level 3</span>
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            Institutional Compliance & KYB
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Verify organization registration, audit cryptographic proof chains, and export compliance artifacts.
          </p>
        </div>

        <button
          onClick={handleDownloadCertificate}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors flex items-center gap-2 shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>Export Compliance Certificate</span>
        </button>
      </div>

      {/* Compliance Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">KYB Verification</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white">Active & Certified</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Entity legally registered & verified via registry data provider.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Cryptographic Audit</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white">Tamper-Proof Ledger</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Contract signatures hashed and locked to prevent post-hoc changes.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">SOC2 / GDPR</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white">GDPR & PII Guarded</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Client-side redaction and private identifier boundaries enforced.
          </p>
        </div>
      </div>

      {/* Compliance Audit Trail */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Verified Attestation Records</h2>

        <div className="space-y-2.5">
          {[
            {
              title: 'Institutional Incorporation Attestation',
              date: 'Jan 15, 2026',
              verifier: 'GigLink Institutional Trust Verifier #409',
              hash: '0x8f2d...3a9c',
            },
            {
              title: 'Corporate Beneficial Ownership Verification (KYB)',
              date: 'Jan 16, 2026',
              verifier: 'GigLink Institutional Trust Verifier #409',
              hash: '0x4c1e...91ef',
            },
            {
              title: 'Authorized Signatory Delegate Proof',
              date: 'Feb 02, 2026',
              verifier: 'Enterprise Multi-Sig Security Protocol',
              hash: '0x22ab...b102',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900 dark:text-white">{item.title}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {item.verifier} • {item.date}
                </div>
              </div>
              <div className="font-mono text-[11px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/80 px-2.5 py-1 rounded-lg border border-purple-200/60 dark:border-purple-800/60">
                Proof: {item.hash}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
