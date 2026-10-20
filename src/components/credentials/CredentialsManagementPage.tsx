import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Download,
  Share2,
  QrCode,
  Printer,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Award,
  Layers,
  ArrowRight,
  Building2,
  Clock,
  Check,
  X,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  VerifiableTranscript,
  TranscriptPrivacySettings,
} from '../../types/transcript';
import {
  getTranscriptByTalentId,
  generateAndPublishTranscript,
  exportTranscriptAsJsonLd,
  DEFAULT_TRANSCRIPT_PRIVACY,
} from '../../lib/transcriptService';
import { VerifiableCredential } from '../../types/credential';
import {
  getPendingCredentialsForTalent,
  getClaimedCredentialsForTalent,
  claimVerifiableCredential,
  rejectVerifiableCredential,
} from '../../lib/credentialIssuanceService';
import { useToast } from '../../context/ToastContext';
import { SovereignIdentityTab } from './SovereignIdentityTab';
import { Cpu } from 'lucide-react';

export const CredentialsManagementPage: React.FC = () => {
  const { user, profile, passport } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'transcripts' | 'institutional' | 'sovereign'>('sovereign');

  // Transcript state (Phase 9A)
  const [transcript, setTranscript] = useState<VerifiableTranscript | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [privacy, setPrivacy] = useState<TranscriptPrivacySettings>(DEFAULT_TRANSCRIPT_PRIVACY);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Institutional Credentials state (Phase 9B)
  const [pendingCredentials, setPendingCredentials] = useState<VerifiableCredential[]>([]);
  const [claimedCredentials, setClaimedCredentials] = useState<VerifiableCredential[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const talentUid = user?.uid || '';
  const verificationUrl = `${window.location.origin}/verify/transcript/tr_${talentUid}`;

  const loadAllData = async () => {
    if (!talentUid) return;
    try {
      // Load Phase 9A Transcript
      const existing = await getTranscriptByTalentId(talentUid);
      if (existing) {
        setTranscript(existing);
        setPrivacy(existing.privacySettings || DEFAULT_TRANSCRIPT_PRIVACY);
      }

      // Load Phase 9B Credentials
      if (user?.email) {
        const pending = await getPendingCredentialsForTalent(user.email, talentUid);
        setPendingCredentials(pending);
      }
      const claimed = await getClaimedCredentialsForTalent(talentUid);
      setClaimedCredentials(claimed);
    } catch (err) {
      console.warn('[CredentialsManagement] Non-fatal notice loading credentials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [talentUid, user?.email]);

  const handleGenerateOrRefresh = async () => {
    if (!talentUid || !profile) return;
    setPublishing(true);
    try {
      const updated = await generateAndPublishTranscript(
        talentUid,
        profile,
        passport,
        privacy
      );
      setTranscript(updated);
      addToast('Transcript updated and signed cryptographically.', 'success');
    } catch (err) {
      console.error('Failed to generate transcript:', err);
      addToast('Failed to generate transcript.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleClaimCredential = async (cred: VerifiableCredential) => {
    if (!talentUid || !profile) return;
    setClaimingId(cred.id);
    try {
      await claimVerifiableCredential(cred.id, talentUid, profile);
      addToast(`"${cred.title}" claimed and synced to your Trust Passport! (+${cred.trustScoreImpact} Pts)`, 'success');
      await loadAllData();
    } catch (err: any) {
      console.error('Failed to claim credential:', err);
      addToast(err.message || 'Failed to claim credential.', 'error');
    } finally {
      setClaimingId(null);
    }
  };

  const handleRejectCredential = async (cred: VerifiableCredential) => {
    if (!talentUid || !user?.email) return;
    setRejectingId(cred.id);
    try {
      await rejectVerifiableCredential(cred.id, talentUid, user.email);
      addToast(`"${cred.title}" declined.`, 'info');
      await loadAllData();
    } catch (err: any) {
      console.error('Failed to decline credential:', err);
      addToast(err.message || 'Failed to decline credential.', 'error');
    } finally {
      setRejectingId(null);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verificationUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadJsonLd = () => {
    if (!transcript) return;
    const jsonString = exportTranscriptAsJsonLd(transcript);
    const blob = new Blob([jsonString], { type: 'application/ld+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `giglink_transcript_${transcript.talentDisplayName.replace(/\s+/g, '_').toLowerCase()}.jsonld`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Cryptographic Proof Engine (Phases 9A & 9B)</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Verifiable Credentials & Transcripts
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                Compile on-chain and ledger-verified work history, milestone deliveries, and accredited institutional diplomas into portable, tamper-proof credentials.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeTab === 'transcripts' && (
                <button
                  id="refresh-transcript-btn"
                  onClick={handleGenerateOrRefresh}
                  disabled={publishing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 min-h-[44px]"
                >
                  <RefreshCw className={`w-4 h-4 ${publishing ? 'animate-spin' : ''}`} />
                  <span>{transcript ? 'Re-Sync & Sign Transcript' : 'Generate Cryptographic Transcript'}</span>
                </button>
              )}

              {activeTab === 'institutional' && (
                <Link
                  to="/institution/issue-credentials"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Issue Attestations</span>
                </Link>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('sovereign')}
              id="tab-sovereign-btn"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
                activeTab === 'sovereign'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Sovereign DID & ZK Presentations (Phase 9C)</span>
            </button>

            <button
              onClick={() => setActiveTab('institutional')}
              id="tab-institutional-btn"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
                activeTab === 'institutional'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Institutional Credentials & Attestations (Phase 9B)</span>
              {pendingCredentials.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {pendingCredentials.length} New
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('transcripts')}
              id="tab-transcripts-btn"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
                activeTab === 'transcripts'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Work Transcript & Milestones (Phase 9A)</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Work Transcripts (Phase 9A) */}
        {activeTab === 'transcripts' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Privacy & Presentation Controls (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-5 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Privacy & Disclosure
                  </h3>
                </div>

                <div className="space-y-4 text-xs">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={privacy.showFinancialVolume}
                      onChange={(e) => setPrivacy({ ...privacy, showFinancialVolume: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Disclose Exact Dollar Amounts</p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">When off, only your high-level Volume Tier is shown.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={privacy.showCounterpartyNames}
                      onChange={(e) => setPrivacy({ ...privacy, showCounterpartyNames: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Show Client Names</p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">When off, clients appear as "Verified Enterprise Client".</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={privacy.showCompletedContracts}
                      onChange={(e) => setPrivacy({ ...privacy, showCompletedContracts: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">List Completed Contracts</p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Include individual completed milestones and project titles.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={privacy.showProjectProofs}
                      onChange={(e) => setPrivacy({ ...privacy, showProjectProofs: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Include Verified Code Proofs</p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Show links to verified GitHub repositories and design artifacts.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={privacy.showKycAttestation}
                      onChange={(e) => setPrivacy({ ...privacy, showKycAttestation: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Show Identity Attestation Badge</p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Displays cryptographic confirmation of verified government ID.</p>
                    </div>
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    id="apply-privacy-btn"
                    onClick={handleGenerateOrRefresh}
                    className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
                  >
                    Save Privacy Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Live Transcript Preview (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              {transcript ? (
                <div className="space-y-6">
                  {/* Share & Verification Actions Bar */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          Public Verifier Link Active
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {verificationUrl}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyLink}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        onClick={handleDownloadJsonLd}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>W3C VC</span>
                      </button>

                      <Link
                        to={`/verify/transcript/tr_${talentUid}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                      >
                        <span>Preview Live</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Summary Metric Snapshot */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Total Volume Tier</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white capitalize mt-1">
                        {transcript.verifiedSnapshot.volumeTier || 'Tier 1'}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Milestones Done</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        {transcript.verifiedSnapshot.totalMilestonesDelivered}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Trust Score</p>
                      <p className="text-lg font-black text-emerald-600 mt-1">
                        {transcript.verifiedSnapshot.trustScore} / 100
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                      <p className="text-[10px] uppercase font-bold text-slate-400">KYC Status</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white capitalize mt-1">
                        {transcript.verifiedSnapshot.identityVerified ? 'Verified' : 'Unverified'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4">
                  <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    No Verifiable Work Transcript Published Yet
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Generate your cryptographic snapshot to bundle all verified deliveries into a single verifiable credential.
                  </p>
                  <button
                    onClick={handleGenerateOrRefresh}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Transcript Now</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Institutional Attestations (Phase 9B) */}
        {activeTab === 'institutional' && (
          <div className="space-y-8">
            
            {/* Section A: Pending Credentials Claims Inbox */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Pending Attestation Claims
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                      {pendingCredentials.length} Waiting
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Diplomas, university degrees, course certificates, and skill badges issued to your email.
                  </p>
                </div>
              </div>

              {pendingCredentials.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <span>No pending credentials waiting to be claimed.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingCredentials.map((cred) => (
                    <div
                      key={cred.id}
                      className="border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 rounded-2xl p-5 space-y-4 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-[10px] font-bold uppercase tracking-wider">
                            {cred.credentialType.replace('_', ' ')}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                            {cred.title}
                          </h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{cred.issuer.orgName}</span>
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                            +{cred.trustScoreImpact} Pts
                          </span>
                        </div>
                      </div>

                      {cred.skills && cred.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cred.skills.map((s, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
                        <button
                          onClick={() => handleRejectCredential(cred)}
                          disabled={rejectingId === cred.id}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                        >
                          Decline
                        </button>

                        <button
                          onClick={() => handleClaimCredential(cred)}
                          disabled={claimingId === cred.id}
                          id={`claim-cred-${cred.id}`}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-60"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{claimingId === cred.id ? 'Claiming...' : 'Claim & Attach to Passport'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section B: Active Verified Claimed Credentials */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Active Verified Credentials
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                      {claimedCredentials.length} Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Attestations verified and displayed directly on your public Trust Passport.
                  </p>
                </div>
              </div>

              {claimedCredentials.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <Award className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <span>You have not claimed any institutional attestations yet.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {claimedCredentials.map((cred) => (
                    <div
                      key={cred.id}
                      className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 bg-white dark:bg-slate-850 hover:border-indigo-500/50 transition-colors shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                            {cred.credentialType.replace('_', ' ')}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                            {cred.title}
                          </h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{cred.issuer.orgName}</span>
                          </p>
                        </div>

                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          +{cred.trustScoreImpact} Pts
                        </span>
                      </div>

                      {cred.skills && cred.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cred.skills.map((s, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400 font-mono">
                          Issued {new Date(cred.issuedAt).toLocaleDateString()}
                        </span>

                        <Link
                          to={`/verify/credential/${cred.id}`}
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                        >
                          <span>Public Audit Seal</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: Sovereign Identity & ZK Presentations (Phase 9C) */}
        {activeTab === 'sovereign' && (
          <SovereignIdentityTab
            claimedCredentials={claimedCredentials}
            onNavigateToVerifier={() => {
              window.location.href = '/verify/zk';
            }}
          />
        )}

      </div>
    </div>
  );
};
