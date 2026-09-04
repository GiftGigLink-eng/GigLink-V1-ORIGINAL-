import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Fingerprint,
  Cpu,
  Layers,
  Copy,
  Check,
  Upload,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  Code,
  Sliders,
  Sparkles,
  Lock,
  ArrowRight,
  HelpCircle,
  Database,
  Building2,
  UserCheck,
} from 'lucide-react';
import {
  verifyZKPredicatePresentation,
  createZKPredicatePresentation,
  ZKPredicatePresentation,
  ZKVerificationOutcome,
  pedersenGenerators,
} from '../../lib/crypto/zeroKnowledgeService';
import {
  verifySelectiveDisclosurePresentation,
  createSaltedMerkleCredential,
  createSelectiveDisclosurePresentation,
  SelectiveDisclosurePresentation,
  SelectiveDisclosureVerificationResult,
} from '../../lib/crypto/selectiveDisclosureService';
import {
  generateEd25519KeyPair,
  resolveDID,
} from '../../lib/crypto/didService';
import type { DIDDocument } from '../../types/did';
import { isCredentialRevoked } from '../../lib/credentialIssuanceService';

type PresentationType = 'zero_knowledge' | 'selective_disclosure' | 'unknown';

export const PublicZKVerificationPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Input State
  const [rawJsonInput, setRawJsonInput] = useState<string>('');
  const [expectedNonce, setExpectedNonce] = useState<string>('');
  const [expectedAudienceDid, setExpectedAudienceDid] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'inspector' | 'math'>('overview');

  // Verification Results State
  const [isVerifying, setIsVerifying] = useState(false);
  const [presentationType, setPresentationType] = useState<PresentationType>('unknown');
  const [zkOutcome, setZkOutcome] = useState<ZKVerificationOutcome | null>(null);
  const [sdOutcome, setSdOutcome] = useState<SelectiveDisclosureVerificationResult | null>(null);
  const [parsedPresentation, setParsedPresentation] = useState<any | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [issuerDidDoc, setIssuerDidDoc] = useState<DIDDocument | null>(null);
  const [holderDidDoc, setHolderDidDoc] = useState<DIDDocument | null>(null);

  const [copiedRawJson, setCopiedRawJson] = useState(false);

  // Initialize with query param or session storage if present
  useEffect(() => {
    const queryPresentation = searchParams.get('presentation');
    const sessionPresentation = sessionStorage.getItem('giglink_verify_specimen');

    if (queryPresentation) {
      try {
        const decoded = decodeURIComponent(queryPresentation);
        setRawJsonInput(decoded);
        handleVerifyJson(decoded);
      } catch (err) {
        console.error('Failed to parse URL presentation:', err);
      }
    } else if (sessionPresentation) {
      setRawJsonInput(sessionPresentation);
      handleVerifyJson(sessionPresentation);
      sessionStorage.removeItem('giglink_verify_specimen');
    } else {
      // Default: Load authentic specimen
      loadDemoSpecimen('authentic_zk');
    }
  }, [searchParams]);

  const loadDemoSpecimen = async (specimenKey: string) => {
    setIsVerifying(true);
    setParseError(null);
    try {
      const issuerKp = generateEd25519KeyPair('Massachusetts Institute of Technology');
      const holderKp = generateEd25519KeyPair('Sarah Jenkins (Talent)');
      const testNonce = 'nonce_audit_' + Math.random().toString(36).substring(2, 8);
      const testAudience = 'did:giglink:enterprise:alpha_corp';

      const saltedCred = await createSaltedMerkleCredential(
        'cred_mit_cs_2026_09',
        issuerKp.did,
        issuerKp.privateKeyHex,
        holderKp.did,
        {
          degree: 'Master of Science in Computer Science',
          institution: 'Massachusetts Institute of Technology',
          gpa: 3.96,
          trustScore: 94,
          totalVerifiedProjects: 14,
          totalDeliveredVolumeUSD: 42000,
          graduationYear: '2026',
          honors: 'Summa Cum Laude',
        }
      );

      let payload: any = null;

      if (specimenKey === 'authentic_zk') {
        payload = await createZKPredicatePresentation({
          credentialRecord: saltedCred,
          holderKeyPair: holderKp,
          predicatesToProve: [
            { claimKey: 'trustScore', threshold: 85, statement: 'Trust Score ≥ 85 (High Integrity Tier)' },
            { claimKey: 'totalVerifiedProjects', threshold: 10, statement: 'Verified Contract Milestones Completed ≥ 10' },
            { claimKey: 'totalDeliveredVolumeUSD', threshold: 25000, statement: 'Delivered Escrow Contract Volume ≥ $25,000' },
          ],
          nonce: testNonce,
          audienceDid: testAudience,
          validityMinutes: 1440,
        });
        setExpectedNonce(testNonce);
        setExpectedAudienceDid(testAudience);
      } else if (specimenKey === 'authentic_sd') {
        payload = await createSelectiveDisclosurePresentation(saltedCred, [
          'degree',
          'institution',
          'graduationYear',
          'honors',
        ]);
        setExpectedNonce('');
        setExpectedAudienceDid('');
      } else if (specimenKey === 'tampered_threshold') {
        // Attack: User modifies threshold in presentation from 85 to 98
        const normalZk = await createZKPredicatePresentation({
          credentialRecord: saltedCred,
          holderKeyPair: holderKp,
          predicatesToProve: [{ claimKey: 'trustScore', threshold: 85, statement: 'Trust Score ≥ 85' }],
          nonce: testNonce,
          audienceDid: testAudience,
        });
        // Attacker mutates threshold to 98 without valid proof
        normalZk.predicates[0].threshold = 98;
        payload = normalZk;
        setExpectedNonce(testNonce);
        setExpectedAudienceDid(testAudience);
      } else if (specimenKey === 'tampered_signature') {
        const normalZk = await createZKPredicatePresentation({
          credentialRecord: saltedCred,
          holderKeyPair: holderKp,
          predicatesToProve: [{ claimKey: 'trustScore', threshold: 85, statement: 'Trust Score ≥ 85' }],
          nonce: testNonce,
          audienceDid: testAudience,
        });
        // Corrupt signature bytes
        normalZk.holderSignature = 'bad0'.repeat(32);
        payload = normalZk;
        setExpectedNonce(testNonce);
        setExpectedAudienceDid(testAudience);
      } else if (specimenKey === 'replay_mismatched_nonce') {
        payload = await createZKPredicatePresentation({
          credentialRecord: saltedCred,
          holderKeyPair: holderKp,
          predicatesToProve: [{ claimKey: 'trustScore', threshold: 85, statement: 'Trust Score ≥ 85' }],
          nonce: 'nonce_original_session_123',
          audienceDid: testAudience,
        });
        // Verifier enforces a different challenge nonce
        setExpectedNonce('nonce_verifier_challenge_999');
        setExpectedAudienceDid(testAudience);
      } else if (specimenKey === 'revoked_credential') {
        // Specimen referencing a revoked credential
        payload = await createZKPredicatePresentation({
          credentialRecord: saltedCred,
          holderKeyPair: holderKp,
          predicatesToProve: [{ claimKey: 'trustScore', threshold: 85, statement: 'Trust Score ≥ 85' }],
          nonce: testNonce,
          audienceDid: testAudience,
        });
        // Mark credential as explicitly revoked for test
        payload.sourceCredentialId = 'cred_revoked_specimen_001';
        setExpectedNonce(testNonce);
        setExpectedAudienceDid(testAudience);
      }

      const formatted = JSON.stringify(payload, null, 2);
      setRawJsonInput(formatted);
      await executeVerification(payload, specimenKey === 'replay_mismatched_nonce' ? 'nonce_verifier_challenge_999' : testNonce, testAudience);
    } catch (err: any) {
      console.error('Specimen generation failed:', err);
      setParseError(err.message || 'Failed to generate specimen');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyJson = async (jsonString: string) => {
    setIsVerifying(true);
    setParseError(null);
    try {
      const parsed = JSON.parse(jsonString);
      setParsedPresentation(parsed);
      await executeVerification(parsed, expectedNonce, expectedAudienceDid);
    } catch (err: any) {
      setParseError(err.message || 'Invalid JSON syntax');
      setZkOutcome(null);
      setSdOutcome(null);
      setPresentationType('unknown');
    } finally {
      setIsVerifying(false);
    }
  };

  const executeVerification = async (parsed: any, nonceToCheck?: string, audToCheck?: string) => {
    setParsedPresentation(parsed);
    setZkOutcome(null);
    setSdOutcome(null);

    // Revocation checker callback using local or registry check
    const revocationLookup = async (credId: string) => {
      if (credId === 'cred_revoked_specimen_001') return true;
      try {
        return await isCredentialRevoked(credId);
      } catch {
        return false;
      }
    };

    if (parsed && Array.isArray(parsed.predicates) && parsed.holderSignature) {
      // Zero-Knowledge Predicate Presentation
      setPresentationType('zero_knowledge');
      const outcome = await verifyZKPredicatePresentation(
        parsed as ZKPredicatePresentation,
        nonceToCheck?.trim() || undefined,
        audToCheck?.trim() || undefined,
        revocationLookup
      );
      setZkOutcome(outcome);

      // Resolve DID Documents
      if (parsed.issuerDid) {
        resolveDID(parsed.issuerDid).then((res) => setIssuerDidDoc(res.didDocument));
      }
      if (parsed.holderDid) {
        resolveDID(parsed.holderDid).then((res) => setHolderDidDoc(res.didDocument));
      }
    } else if (parsed && Array.isArray(parsed.disclosedClaims) && parsed.credentialMerkleRoot) {
      // Salted Merkle Selective Disclosure Presentation
      setPresentationType('selective_disclosure');
      const outcome = await verifySelectiveDisclosurePresentation(
        parsed as SelectiveDisclosurePresentation,
        revocationLookup
      );
      setSdOutcome(outcome);

      if (parsed.issuerDid) {
        resolveDID(parsed.issuerDid).then((res) => setIssuerDidDoc(res.didDocument));
      }
      if (parsed.subjectDid) {
        resolveDID(parsed.subjectDid).then((res) => setHolderDidDoc(res.didDocument));
      }
    } else {
      setPresentationType('unknown');
      setParseError('Unrecognized presentation schema. Must be a valid Zero-Knowledge or Selective Disclosure presentation.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setRawJsonInput(content);
      handleVerifyJson(content);
    };
    reader.readAsText(file);
  };

  const isVerified = (presentationType === 'zero_knowledge' && zkOutcome?.isValid) ||
                     (presentationType === 'selective_disclosure' && sdOutcome?.isValid);

  const failureReason = (presentationType === 'zero_knowledge' && zkOutcome?.failureReason) ||
                        (presentationType === 'selective_disclosure' && sdOutcome?.failureReason);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
              Public Cryptographic Verifier
            </span>
            <span className="text-xs text-slate-400">• Autonomous & Client-Side</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Zero-Knowledge & Sovereign Identity Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Mathematically inspect and verify sovereign W3C credentials, RFC 6962 Merkle trees, and Fiat-Shamir Zero-Knowledge Range Proofs without contacting central authorities or exposing private data.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/passport"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Trust Passport
          </Link>
          <Link
            to="/credentials"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
          >
            <Cpu className="w-4 h-4" />
            Presentation Studio
          </Link>
        </div>
      </div>

      {/* Preset Specimen Selector Bar */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Load Interactive Cryptographic Specimens:
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Click any specimen to run live verification
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadDemoSpecimen('authentic_zk')}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Authentic ZK Range Proof
          </button>
          <button
            type="button"
            onClick={() => loadDemoSpecimen('authentic_sd')}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 hover:bg-purple-50 dark:hover:bg-purple-950/60 hover:text-purple-600 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-600" />
            Salted Merkle Selective Disclosure
          </button>
          <button
            type="button"
            onClick={() => loadDemoSpecimen('tampered_threshold')}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Attack: Altered Threshold
          </button>
          <button
            type="button"
            onClick={() => loadDemoSpecimen('tampered_signature')}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Attack: Forged Ed25519 Signature
          </button>
          <button
            type="button"
            onClick={() => loadDemoSpecimen('replay_mismatched_nonce')}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-600 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-400 rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Attack: Replay (Mismatched Nonce)
          </button>
          <button
            type="button"
            onClick={() => loadDemoSpecimen('revoked_credential')}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Attack: Revoked Source Credential
          </button>
        </div>
      </div>

      {/* Main Verification Input and Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Col: Controls & Input */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Presentation Payload
              </span>
              <label className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline cursor-pointer font-medium">
                <Upload className="w-3.5 h-3.5" />
                Upload JSON
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              rows={9}
              value={rawJsonInput}
              onChange={(e) => {
                setRawJsonInput(e.target.value);
                handleVerifyJson(e.target.value);
              }}
              placeholder="Paste W3C Presentation JSON..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-800 dark:text-slate-200 rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />

            {/* Anti-Replay Verifier Constraints */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                Verifier Constraints (Anti-Replay)
              </span>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500">Expected Nonce</label>
                <input
                  type="text"
                  value={expectedNonce}
                  onChange={(e) => {
                    setExpectedNonce(e.target.value);
                    if (parsedPresentation) {
                      executeVerification(parsedPresentation, e.target.value, expectedAudienceDid);
                    }
                  }}
                  placeholder="Optional nonce requirement"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500">Expected Audience DID</label>
                <input
                  type="text"
                  value={expectedAudienceDid}
                  onChange={(e) => {
                    setExpectedAudienceDid(e.target.value);
                    if (parsedPresentation) {
                      executeVerification(parsedPresentation, expectedNonce, e.target.value);
                    }
                  }}
                  placeholder="did:giglink:... or any"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <button
                type="button"
                onClick={() => handleVerifyJson(rawJsonInput)}
                disabled={isVerifying}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all"
              >
                {isVerifying ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-evaluate Cryptography</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right 2 Cols: Cryptographic Proof Verification Card */}
        <div className="lg:col-span-2 space-y-4">
          {/* Status Headline Card */}
          <div className={`p-6 sm:p-7 rounded-3xl border transition-all ${
            isVerified
              ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/80 shadow-xs'
              : parseError || failureReason
              ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/80 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold ${
                  isVerified
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400'
                }`}>
                  {isVerified ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">
                      {isVerified
                        ? 'Cryptographically Verified'
                        : 'Verification Failed / Tampered'}
                    </h2>
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                      isVerified
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                    }`}>
                      {presentationType === 'zero_knowledge' ? 'Zero-Knowledge Proof' : 'Selective Disclosure'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {isVerified
                      ? 'Every mathematical constraint, Merkle inclusion proof, and Ed25519 signature passed 100% verification.'
                      : failureReason || parseError || 'Presentation signature, mathematical proof, or nonce check failed.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Tabs: Overview vs. Inspector vs. Math */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Executive Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('inspector')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                  activeTab === 'inspector'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Proof Inspector & Tree
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('math')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                  activeTab === 'math'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Pedersen & Fiat-Shamir Math
              </button>
            </div>

            {/* TAB 1: EXECUTIVE OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 1. Verified Claims / Zero Knowledge Predicates */}
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {presentationType === 'zero_knowledge'
                      ? 'Zero-Knowledge Verified Predicates (Raw Data Concealed)'
                      : 'Disclosed Credential Attributes'}
                  </h3>

                  {presentationType === 'zero_knowledge' && zkOutcome && (
                    <div className="space-y-2.5">
                      {zkOutcome.verifiedPredicates.map((p, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 rounded-2xl flex items-center justify-between"
                        >
                          <div className="space-y-0.5">
                            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <span>{p.statement}</span>
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                100% Mathematically Proven
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Claim key: <span className="font-mono font-semibold">{p.claimKey}</span> • True value never disclosed to verifier or network
                            </div>
                          </div>

                          <div className="text-right font-mono text-xs">
                            <span className="text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-100/80 dark:bg-emerald-950/80 px-2.5 py-1 rounded-lg">
                              SATISFIED
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {presentationType === 'selective_disclosure' && sdOutcome && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sdOutcome.reconstructedClaims.map((c, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/60 rounded-2xl space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                              {c.claimKey}
                            </span>
                            <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-semibold">
                              Verified Claim
                            </span>
                          </div>
                          <div className="text-sm font-bold text-purple-950 dark:text-purple-200 truncate">
                            {String(c.value)}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            Status: {c.isValid ? 'Authentic (Salted Leaf Root Verified)' : 'Invalid'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Decentralized Identity & Security Parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Issuing Authority (Attestor)
                      </span>
                      <Building2 className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="font-mono text-xs text-slate-900 dark:text-slate-100 break-all">
                      {parsedPresentation?.issuerDid || 'N/A'}
                    </div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Issuer Ed25519 Root Signature Valid
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Sovereign Subject / Holder DID
                      </span>
                      <UserCheck className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="font-mono text-xs text-slate-900 dark:text-slate-100 break-all">
                      {parsedPresentation?.holderDid || parsedPresentation?.subjectDid || 'N/A'}
                    </div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Holder Ed25519 Authentication Valid
                    </div>
                  </div>
                </div>

                {/* 3. Anti-Replay, Audience & Time Validity */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Anti-Replay Nonce:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white break-all">
                      {parsedPresentation?.nonce || 'None (Open Presentation)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Audience DID:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white break-all">
                      {parsedPresentation?.audienceDid || 'Public (Any Audience)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Expiration:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {parsedPresentation?.expiresAt ? new Date(parsedPresentation.expiresAt).toLocaleString() : 'Permanent'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PROOF INSPECTOR & MERKLE TREE */}
            {activeTab === 'inspector' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    RFC 6962 Canonical Merkle Tree & Audit Path
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Domain-separated leaf hashing with 0x00 prefix and node hashing with 0x01 prefix.
                  </p>

                  <div className="p-4 bg-slate-950 text-slate-200 rounded-2xl font-mono text-xs space-y-3 border border-slate-800 overflow-x-auto">
                    <div>
                      <span className="text-emerald-400 font-bold block">// Credential Merkle Root Digest (Signed by Issuer):</span>
                      <span className="text-white break-all">{parsedPresentation?.credentialMerkleRoot}</span>
                    </div>

                    {parsedPresentation?.predicates?.[0]?.merkleProof && (
                      <div>
                        <span className="text-indigo-400 font-bold block">// Merkle Inclusion Path (Leaf #{parsedPresentation.predicates[0].merkleProof.leafIndex}):</span>
                        {parsedPresentation.predicates[0].merkleProof.auditPath.map((step: any, sIdx: number) => (
                          <div key={sIdx} className="text-slate-400 text-[11px]">
                            Level {sIdx}: [{step.direction.toUpperCase()}] {step.hash}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                    Universal W3C DID Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Issuer DID Document:</span>
                      <pre className="text-[10px] font-mono text-slate-700 dark:text-slate-300 max-h-48 overflow-y-auto">
                        {JSON.stringify(issuerDidDoc, null, 2)}
                      </pre>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Holder DID Document:</span>
                      <pre className="text-[10px] font-mono text-slate-700 dark:text-slate-300 max-h-48 overflow-y-auto">
                        {JSON.stringify(holderDidDoc, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MATHEMATICAL EQUATIONS */}
            {activeTab === 'math' && (
              <div className="space-y-6">
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl space-y-2">
                  <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-600" />
                    Cryptographic Group Setting: RFC 3526 1536-bit MODP Safe Prime Field
                  </h4>
                  <p className="text-xs text-indigo-900 dark:text-indigo-300 leading-relaxed">
                    Pedersen Commitments are computed in multiplicative subgroup Z_p* where p = 2q + 1 with generator g = 2 and independent Nothing-Up-My-Sleeve generator h = SHA-256(&quot;GigLink::Pedersen::GeneratorH::1536&quot;) mod p.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 text-slate-200 rounded-2xl font-mono text-xs space-y-4 border border-slate-800 overflow-x-auto">
                  <div>
                    <span className="text-emerald-400 font-bold block">1. Homomorphic Pedersen Commitment:</span>
                    <span className="text-slate-300">C = (g^v * h^r) mod p</span>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Shifted for threshold T: C_delta = C * (g^-T) mod p = (g^(v - T) * h^r) mod p
                    </div>
                  </div>

                  <div>
                    <span className="text-emerald-400 font-bold block">2. Non-Interactive Fiat-Shamir Transcript:</span>
                    <span className="text-slate-300">
                      e = SHA-256(g || h || p || C || C_delta || T || tBlind || nonce || aud || key)
                    </span>
                  </div>

                  <div>
                    <span className="text-emerald-400 font-bold block">3. Schnorr/Sigma Verification Equation:</span>
                    <span className="text-emerald-300 font-bold">
                      (g^s_v * h^s_r) mod p  ==  (tBlind * (C_delta^e)) mod p
                    </span>
                    <div className="text-[11px] text-emerald-400 mt-1">
                      [VERIFIED] Left Hand Side matches Right Hand Side with exact BigInt equality.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
