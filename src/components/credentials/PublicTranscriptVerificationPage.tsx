import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Lock,
  ExternalLink,
  Award,
  Calendar,
  Building,
  FileCheck,
  ArrowLeft,
  Printer,
  Copy,
  Check,
} from 'lucide-react';
import { verifyPublicTranscript } from '../../lib/transcriptService';
import { TranscriptVerificationResult } from '../../types/transcript';

export const PublicTranscriptVerificationPage: React.FC = () => {
  const { transcriptId } = useParams<{ transcriptId: string }>();
  const [result, setResult] = useState<TranscriptVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    async function loadAndVerify() {
      if (!transcriptId) return;
      try {
        const res = await verifyPublicTranscript(transcriptId);
        setResult(res);
      } catch (err) {
        console.error('Failed to verify transcript:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAndVerify();
  }, [transcriptId]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">
            Verifying cryptographic signature against platform ledger...
          </p>
        </div>
      </div>
    );
  }

  if (!result || result.status === 'not_found' || !result.transcript) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Transcript Not Found or Private
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            The requested verifiable transcript identifier does not exist or has been made private by the owner.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to GigLink Home</span>
          </Link>
        </div>
      </div>
    );
  }

  const { transcript, isValid, computedHash, storedHash } = result;
  const snapshot = transcript.verifiedSnapshot;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Verification Status Banner */}
        <div
          className={`rounded-3xl p-6 sm:p-8 border shadow-xs transition-colors ${
            isValid
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  isValid
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 text-white'
                }`}
              >
                {isValid ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {isValid ? 'Authentic Verifiable Transcript' : 'Verification Checksum Failed'}
                  </h1>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isValid
                        ? 'bg-emerald-200/60 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                        : 'bg-rose-200/60 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                    }`}
                  >
                    {isValid ? 'MATCH CONFIRMED' : 'INTEGRITY MISMATCH'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                  {isValid
                    ? 'This transcript has been cryptographically validated against GigLink’s immutable platform ledger. All milestone delivery records and verified proofs are authentic.'
                    : 'Warning: The computed hash does not match the stored cryptographic seal. The data presented may have been modified or tampered with.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Copy</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Document Body */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 space-y-8 shadow-xs">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xs">
                GL
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Official GigLink Work Transcript
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Issued by GigLink Authoritative Attestation Network
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right text-xs text-slate-500 dark:text-slate-400 font-mono">
              <p>ID: {transcript.id}</p>
              <p>Date: {new Date(transcript.proof.created).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Candidate Profile Block */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xl overflow-hidden border border-indigo-200 dark:border-indigo-800">
              {snapshot.talentAvatarUrl ? (
                <img
                  src={snapshot.talentAvatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                snapshot.talentDisplayName.charAt(0)
              )}
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {snapshot.talentDisplayName}
                </h3>
                {snapshot.identityVerified && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                    KYC Level 2 Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {snapshot.talentHeadline || 'Verified Platform Professional'}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <span>Trust Score: <strong className="text-indigo-600 dark:text-indigo-400">{snapshot.trustScore}/100</strong> ({snapshot.trustTier})</span>
                <span>•</span>
                <span>Settled Volume: <strong className="text-emerald-600 dark:text-emerald-400">{snapshot.volumeTier}</strong></span>
              </div>
            </div>

            <Link
              to={`/p/${snapshot.talentId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <span>View Public Passport</span>
              <ExternalLink className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            </Link>
          </div>

          {/* Core Verified Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {snapshot.totalCompletedContracts}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Completed Contracts
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {snapshot.totalMilestonesDelivered}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Milestones Delivered
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {snapshot.projectProofs.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Verified Code Proofs
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                100%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Escrow Settlement Rate
              </p>
            </div>
          </div>

          {/* Verified Completed Contracts */}
          {snapshot.contracts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Verified Contract Work History
              </h3>
              <div className="space-y-2">
                {snapshot.contracts.map((c, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {c.opportunityTitle}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {c.counterpartyDisplay} • {c.category} • {c.milestoneCount} Milestone(s)
                      </p>
                    </div>
                    {c.amountUSD !== undefined && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        ${c.amountUSD.toLocaleString()} USD
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verified Project Proofs */}
          {snapshot.projectProofs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Verified Proof Deliverables
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {snapshot.projectProofs.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {p.title}
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                        Attested
                      </span>
                    </div>
                    {p.verifiedUrl && (
                      <a
                        href={p.verifiedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline break-all"
                      >
                        <span>Inspect Deliverable</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    {p.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {p.skills.map((s, si) => (
                          <span
                            key={si}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cryptographic Footprint Card */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span>CRYPTOGRAPHIC ATTESTATION FINGERPRINT</span>
              <button
                onClick={() => handleCopyHash(storedHash)}
                className="hover:text-white inline-flex items-center gap-1 transition-colors"
              >
                {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
              </button>
            </div>
            <p className="break-all text-indigo-300 selection:bg-indigo-500 selection:text-white">
              {storedHash}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400 text-[10px] pt-1 border-t border-slate-800">
              <span>Issuer: {transcript.proof.issuer}</span>
              <span>Algorithm: SHA-256 (Canonical JSON-LD Digest)</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
