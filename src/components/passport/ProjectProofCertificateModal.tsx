import React, { useState } from 'react';
import {
  ShieldCheck,
  Award,
  ExternalLink,
  Copy,
  Check,
  Lock,
  Layers,
  Calendar,
  Sparkles,
  CheckCircle2,
  X,
} from 'lucide-react';
import { PublicProjectProof } from '../../types/passport';
import { verifyProofIntegrity } from '../../lib/passportService';

interface ProjectProofCertificateModalProps {
  proof: PublicProjectProof;
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectProofCertificateModal: React.FC<ProjectProofCertificateModalProps> = ({
  proof,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);

  if (!isOpen) return null;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(proof.verificationHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const isValid = await verifyProofIntegrity(proof);
      setVerificationResult(isValid);
    } catch (e) {
      setVerificationResult(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const tierLabels: Record<string, { label: string; bg: string; text: string }> = {
    none: { label: 'Standard', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400' },
    tier_verified: { label: 'Verified Escrow Delivery', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400' },
    tier_established: { label: 'Established Project ($1k+)', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400' },
    tier_high_value: { label: 'High-Value Project ($5k+)', bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-400' },
    tier_enterprise: { label: 'Enterprise Project ($25k+)', bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-400' },
  };

  const currentTier = tierLabels[proof.volumeTier] || tierLabels.tier_verified;

  return (
    <div
      id="project-proof-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
    >
      <div
        id="project-proof-certificate-card"
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Decorative Header Banner */}
        <div className="bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 px-6 py-6 text-white relative">
          <button
            id="close-proof-modal-btn"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest font-semibold text-indigo-400">
                GigLink Cryptographic Proof
              </span>
              <h2 className="text-xl font-bold text-zinc-100">{proof.projectTitle}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${currentTier.bg} ${currentTier.text}`}>
              {currentTier.label}
            </span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Completed {new Date(proof.completedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Certificate Content */}
        <div className="p-6 space-y-6">
          {/* Parties Grid */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/50 text-sm">
            <div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Contract Client</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">@{proof.creatorPublicHandle}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Delivered By</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">@{proof.talentPublicHandle}</span>
            </div>
          </div>

          {/* Delivered Milestones */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              Verified Deliverables & Handover
            </h4>
            <div className="space-y-1.5">
              {proof.deliverablesSummary.map((deliv, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 text-xs text-zinc-800 dark:text-zinc-200 border border-zinc-100 dark:border-zinc-800"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-medium">{deliv}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Skills Demonstrated */}
          {proof.skillsDemonstrated && proof.skillsDemonstrated.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Demonstrated Competencies
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {proof.skillsDemonstrated.map((skill, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Verification Hash & Cryptographic Audit */}
          <div className="p-4 rounded-xl bg-zinc-900 text-zinc-100 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                Deterministic SHA-256 Digest
              </span>
              <button
                id="copy-proof-hash-btn"
                onClick={handleCopyHash}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Digest
                  </>
                )}
              </button>
            </div>
            <div className="font-mono text-xs bg-zinc-950 p-2.5 rounded-lg text-emerald-400 break-all select-all border border-zinc-800">
              {proof.verificationHash}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
              <button
                id="run-sha256-verify-btn"
                onClick={handleVerify}
                disabled={isVerifying}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isVerifying ? 'Recomputing Hash...' : 'Audit Cryptographic Integrity'}
              </button>
              {verificationResult !== null && (
                <span
                  className={`text-xs font-medium flex items-center gap-1 ${
                    verificationResult ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {verificationResult ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Hash Verified Valid
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" /> Hash Mismatch
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/60 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Certificate ID: {proof.id}</span>
          <button
            id="dismiss-proof-modal-btn"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-100 rounded-lg font-medium transition-colors"
          >
            Close Proof
          </button>
        </div>
      </div>
    </div>
  );
};
