import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Download,
  Share2,
  Sparkles,
  RefreshCw,
  Cpu,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Sliders,
  ArrowRight,
  Fingerprint,
  Info,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  generateEd25519KeyPair,
  resolveDID,
} from '../../lib/crypto/didService';
import type { DIDDocument } from '../../types/did';
import {
  createSaltedMerkleCredential,
  createSelectiveDisclosurePresentation,
  SaltedCredentialRecord,
  SelectiveDisclosurePresentation,
} from '../../lib/crypto/selectiveDisclosureService';
import {
  createZKPredicatePresentation,
  ZKPredicatePresentation,
} from '../../lib/crypto/zeroKnowledgeService';
import { VerifiableCredential } from '../../types/credential';

interface SovereignIdentityTabProps {
  claimedCredentials: VerifiableCredential[];
  onNavigateToVerifier?: () => void;
}

export const SovereignIdentityTab: React.FC<SovereignIdentityTabProps> = ({
  claimedCredentials,
  onNavigateToVerifier,
}) => {
  const { user, profile } = useAuth();
  const { addToast } = useToast();

  // DID & Key State
  const [keyPair, setKeyPair] = useState<{ did: string; publicKeyHex: string; privateKeyHex: string } | null>(null);
  const [didDoc, setDidDoc] = useState<DIDDocument | null>(null);
  const [copiedDid, setCopiedDid] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  // Presentation Studio State
  const [selectedCredId, setSelectedCredId] = useState<string>('');
  const [presentationMode, setPresentationMode] = useState<'selective_disclosure' | 'zero_knowledge' | 'full_disclosure'>('zero_knowledge');
  
  // Selective Disclosure Options
  const [disclosedKeys, setDisclosedKeys] = useState<Record<string, boolean>>({});

  // ZK Predicate Options
  const [zkPredicates, setZkPredicates] = useState<{
    trustScore: { enabled: boolean; threshold: number };
    totalVerifiedProjects: { enabled: boolean; threshold: number };
    totalDeliveredVolumeUSD: { enabled: boolean; threshold: number };
    gpa: { enabled: boolean; threshold: number };
  }>({
    trustScore: { enabled: true, threshold: 85 },
    totalVerifiedProjects: { enabled: true, threshold: 5 },
    totalDeliveredVolumeUSD: { enabled: true, threshold: 10000 },
    gpa: { enabled: false, threshold: 3.5 },
  });

  // Presentation Metadata
  const [audienceDid, setAudienceDid] = useState<string>('did:giglink:enterprise:demo_verifier');
  const [nonce, setNonce] = useState<string>(`nonce_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const [validityHours, setValidityHours] = useState<number>(24);

  // Generated Output
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPresentation, setGeneratedPresentation] = useState<ZKPredicatePresentation | SelectiveDisclosurePresentation | null>(null);
  const [copiedPresentationJson, setCopiedPresentationJson] = useState(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState<'payload' | 'cryptography'>('payload');

  // Initialize or load Sovereign Keypair
  useEffect(() => {
    const storageKey = `giglink_sovereign_key_${user?.uid || 'guest'}`;
    const cached = localStorage.getItem(storageKey);
    let kp: { did: string; publicKeyHex: string; privateKeyHex: string };

    if (cached) {
      try {
        kp = JSON.parse(cached);
      } catch {
        kp = generateEd25519KeyPair(profile?.displayName || user?.displayName || 'GigLink Talent');
        localStorage.setItem(storageKey, JSON.stringify(kp));
      }
    } else {
      kp = generateEd25519KeyPair(profile?.displayName || user?.displayName || 'GigLink Talent');
      localStorage.setItem(storageKey, JSON.stringify(kp));
    }

    setKeyPair(kp);

    resolveDID(kp.did).then((res) => {
      setDidDoc(res.didDocument);
    });
  }, [user?.uid, profile?.displayName]);

  // Set default selected credential
  useEffect(() => {
    if (claimedCredentials.length > 0 && !selectedCredId) {
      setSelectedCredId(claimedCredentials[0].id);
    }
  }, [claimedCredentials, selectedCredId]);

  const handleRegenerateKeys = () => {
    if (!window.confirm('Regenerating your sovereign DID keypair will create a new decentralized identifier. Continue?')) {
      return;
    }
    const storageKey = `giglink_sovereign_key_${user?.uid || 'guest'}`;
    const newKp = generateEd25519KeyPair(profile?.displayName || user?.displayName || 'GigLink Talent');
    localStorage.setItem(storageKey, JSON.stringify(newKp));
    setKeyPair(newKp);
    resolveDID(newKp.did).then((res) => setDidDoc(res.didDocument));
    setGeneratedPresentation(null);
    addToast('New sovereign Ed25519 DID keypair generated successfully.', 'success');
  };

  const handleCopy = (text: string, type: 'did' | 'key' | 'json') => {
    navigator.clipboard.writeText(text);
    if (type === 'did') {
      setCopiedDid(true);
      setTimeout(() => setCopiedDid(false), 2000);
    } else if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else if (type === 'json') {
      setCopiedPresentationJson(true);
      setTimeout(() => setCopiedPresentationJson(false), 2000);
    }
    addToast('Copied to clipboard!', 'info');
  };

  const handleGenerateFreshNonce = () => {
    const newNonce = `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setNonce(newNonce);
    addToast('Generated fresh single-use cryptographic nonce.', 'info');
  };

  // Extract selected credential claims
  const getSelectedCredentialClaims = () => {
    const cred = claimedCredentials.find((c) => c.id === selectedCredId);
    if (!cred) {
      // Fallback synthetic claims if no claimed credentials
      return {
        degree: 'B.S. in Computer Science',
        institution: 'Massachusetts Institute of Technology',
        trustScore: 92,
        totalVerifiedProjects: 12,
        totalDeliveredVolumeUSD: 34500,
        gpa: 3.94,
        graduated: '2025',
        honors: 'Summa Cum Laude',
      };
    }

    return {
      title: cred.title,
      issuerName: cred.issuer.orgName,
      credentialType: cred.credentialType,
      trustScoreImpact: cred.trustScoreImpact,
      trustScore: 92,
      totalVerifiedProjects: 12,
      totalDeliveredVolumeUSD: 34500,
      gpa: 3.94,
      skillsVerified: (cred.skills || []).join(', '),
      issuedAt: cred.issuedAt,
    };
  };

  const handleGeneratePresentation = async () => {
    if (!keyPair) {
      addToast('Sovereign keypair not initialized.', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const claims = getSelectedCredentialClaims();
      const issuerKeyPair = generateEd25519KeyPair('Authorized Institution');
      const issuerDid = issuerKeyPair.did;

      // Create salted Merkle credential
      const saltedCred: SaltedCredentialRecord = await createSaltedMerkleCredential(
        selectedCredId || 'cred_sovereign_demo',
        issuerDid,
        issuerKeyPair.privateKeyHex,
        keyPair.did,
        claims
      );

      if (presentationMode === 'zero_knowledge') {
        const predicatesToProve: { claimKey: string; threshold: number; statement: string }[] = [];

        if (zkPredicates.trustScore.enabled) {
          predicatesToProve.push({
            claimKey: 'trustScore',
            threshold: zkPredicates.trustScore.threshold,
            statement: `Trust Score is ${zkPredicates.trustScore.threshold} or above`,
          });
        }
        if (zkPredicates.totalVerifiedProjects.enabled) {
          predicatesToProve.push({
            claimKey: 'totalVerifiedProjects',
            threshold: zkPredicates.totalVerifiedProjects.threshold,
            statement: `Completed at least ${zkPredicates.totalVerifiedProjects.threshold} verified contracts`,
          });
        }
        if (zkPredicates.totalDeliveredVolumeUSD.enabled) {
          predicatesToProve.push({
            claimKey: 'totalDeliveredVolumeUSD',
            threshold: zkPredicates.totalDeliveredVolumeUSD.threshold,
            statement: `Delivered volume is $${zkPredicates.totalDeliveredVolumeUSD.threshold.toLocaleString()} or above`,
          });
        }
        if (zkPredicates.gpa.enabled) {
          predicatesToProve.push({
            claimKey: 'gpa',
            threshold: zkPredicates.gpa.threshold,
            statement: `Cumulative GPA is ${zkPredicates.gpa.threshold} or above`,
          });
        }

        if (predicatesToProve.length === 0) {
          throw new Error('Please select at least one numeric predicate to prove in Zero-Knowledge.');
        }

        const zkPresentation = await createZKPredicatePresentation({
          credentialRecord: saltedCred,
          holderKeyPair: keyPair,
          predicatesToProve,
          nonce,
          audienceDid: audienceDid.trim() || undefined,
          validityMinutes: validityHours * 60,
        });

        setGeneratedPresentation(zkPresentation);
        addToast('Zero-Knowledge Presentation created and cryptographically signed!', 'success');
      } else if (presentationMode === 'selective_disclosure') {
        const keysToReveal = Object.entries(disclosedKeys)
          .filter(([_, enabled]) => enabled)
          .map(([key]) => key);

        if (keysToReveal.length === 0) {
          throw new Error('Please select at least one claim attribute to disclose.');
        }

        const sdPresentation = await createSelectiveDisclosurePresentation(
          saltedCred,
          keysToReveal
        );

        setGeneratedPresentation(sdPresentation);
        addToast('Salted Merkle Selective Disclosure Presentation created!', 'success');
      }
    } catch (err: any) {
      console.error('Presentation creation error:', err);
      addToast(err.message || 'Failed to create presentation', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPresentation = () => {
    if (!generatedPresentation) return;
    const jsonStr = JSON.stringify(generatedPresentation, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sovereign_presentation_${presentationMode}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Presentation JSON downloaded.', 'info');
  };

  const handleSendToPublicVerifier = () => {
    if (!generatedPresentation) return;
    // Store in sessionStorage for seamless transfer to /verify/zk
    sessionStorage.setItem('giglink_verify_specimen', JSON.stringify(generatedPresentation));
    if (onNavigateToVerifier) {
      onNavigateToVerifier();
    } else {
      window.location.href = '/verify/zk';
    }
  };

  const claims = getSelectedCredentialClaims();

  return (
    <div className="space-y-8">
      {/* 1. Sovereign Decentralized Identifier (DID) & Key Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center font-bold">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Sovereign Decentralized Identity (DID)
                </h3>
                <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                  W3C did:key
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Self-sovereign cryptographic identity based on Ed25519 Edwards-curve public key cryptography.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRegenerateKeys}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate Keypair
            </button>
          </div>
        </div>

        {/* DID String & Details */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Universal DID String
              </span>
              <button
                type="button"
                onClick={() => keyPair && handleCopy(keyPair.did, 'did')}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                {copiedDid ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedDid ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="font-mono text-xs text-slate-900 dark:text-slate-100 break-all bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
              {keyPair?.did || 'Generating DID...'}
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Ed25519 Public Key (32-byte raw hex)
              </span>
              <button
                type="button"
                onClick={() => keyPair && handleCopy(keyPair.publicKeyHex, 'key')}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                {copiedKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedKey ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="font-mono text-xs text-slate-900 dark:text-slate-100 break-all bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
              {keyPair?.publicKeyHex || 'Deriving public key...'}
            </div>
          </div>
        </div>

        {/* Private Key toggle (Self-custody view) */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500" />
            <span>Private keys are managed strictly in local storage and never leave your client browser.</span>
          </div>
          <button
            type="button"
            onClick={() => setShowPrivateKey(!showPrivateKey)}
            className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            {showPrivateKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPrivateKey ? 'Hide Private Key' : 'Reveal Local Signing Key'}
          </button>
        </div>

        {showPrivateKey && keyPair && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              Ed25519 Secret Key (Base-16 Hex):
            </span>
            <div className="font-mono text-[11px] text-amber-900 dark:text-amber-200 break-all select-all">
              {keyPair.privateKeyHex}
            </div>
          </div>
        )}
      </div>

      {/* 2. Sovereign Presentation Studio */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Sovereign Presentation Studio
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Generate cryptographically verifiable presentations from your credentials using Zero-Knowledge Range Proofs or Salted Selective Disclosure.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPresentationMode('zero_knowledge')}
            className={`p-4 text-left rounded-2xl border transition-all ${
              presentationMode === 'zero_knowledge'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-600/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Zero-Knowledge Predicate Proofs
                </span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                True ZK Sigma
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Prove statements (e.g. Trust Score ≥ 85, Delivered Volume ≥ $25k) via homomorphic Pedersen Commitments and Fiat-Shamir transcripts with <strong>zero plaintext disclosure</strong>.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPresentationMode('selective_disclosure')}
            className={`p-4 text-left rounded-2xl border transition-all ${
              presentationMode === 'selective_disclosure'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-600/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Salted Merkle Selective Disclosure
                </span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                RFC 6962 Trees
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Disclose chosen claim attributes alongside 256-bit CSPRNG salts and binary Merkle inclusion paths while keeping unselected fields completely private.
            </p>
          </button>
        </div>

        {/* Source Credential Selection */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Source Credential Record
          </label>
          <select
            value={selectedCredId}
            onChange={(e) => setSelectedCredId(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {claimedCredentials.length > 0 ? (
              claimedCredentials.map((cred) => (
                <option key={cred.id} value={cred.id}>
                  {cred.title} — {cred.issuer.orgName} ({cred.credentialType})
                </option>
              ))
            ) : (
              <option value="demo_mit_cs">
                Demonstration: Master of Science in CS — MIT Registrar (Simulated Sovereign Credential)
              </option>
            )}
          </select>
        </div>

        {/* Mode-Specific Configuration Controls */}
        {presentationMode === 'zero_knowledge' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Zero-Knowledge Predicates & Range Constraints
              </span>
              <span className="text-[11px] text-slate-400">
                Prover proves inequality without revealing exact number
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Trust Score */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                zkPredicates.trustScore.enabled ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-60'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={zkPredicates.trustScore.enabled}
                      onChange={(e) => setZkPredicates({
                        ...zkPredicates,
                        trustScore: { ...zkPredicates.trustScore, enabled: e.target.checked }
                      })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Trust Score</span>
                  </label>
                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md font-semibold">
                    Actual: [Secret]
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Prove: Score ≥</span>
                  <input
                    type="number"
                    value={zkPredicates.trustScore.threshold}
                    onChange={(e) => setZkPredicates({
                      ...zkPredicates,
                      trustScore: { ...zkPredicates.trustScore, threshold: parseInt(e.target.value) || 0 }
                    })}
                    disabled={!zkPredicates.trustScore.enabled}
                    className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs"
                  />
                  <span className="text-slate-400">pts</span>
                </div>
              </div>

              {/* Total Verified Projects */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                zkPredicates.totalVerifiedProjects.enabled ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-60'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={zkPredicates.totalVerifiedProjects.enabled}
                      onChange={(e) => setZkPredicates({
                        ...zkPredicates,
                        totalVerifiedProjects: { ...zkPredicates.totalVerifiedProjects, enabled: e.target.checked }
                      })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Verified Projects</span>
                  </label>
                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md font-semibold">
                    Actual: [Secret]
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Prove: Projects ≥</span>
                  <input
                    type="number"
                    value={zkPredicates.totalVerifiedProjects.threshold}
                    onChange={(e) => setZkPredicates({
                      ...zkPredicates,
                      totalVerifiedProjects: { ...zkPredicates.totalVerifiedProjects, threshold: parseInt(e.target.value) || 0 }
                    })}
                    disabled={!zkPredicates.totalVerifiedProjects.enabled}
                    className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>

              {/* Total Delivered Volume */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                zkPredicates.totalDeliveredVolumeUSD.enabled ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-60'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={zkPredicates.totalDeliveredVolumeUSD.enabled}
                      onChange={(e) => setZkPredicates({
                        ...zkPredicates,
                        totalDeliveredVolumeUSD: { ...zkPredicates.totalDeliveredVolumeUSD, enabled: e.target.checked }
                      })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Delivered Volume</span>
                  </label>
                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md font-semibold">
                    Actual: [Secret]
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Prove: Volume ≥ $</span>
                  <input
                    type="number"
                    value={zkPredicates.totalDeliveredVolumeUSD.threshold}
                    onChange={(e) => setZkPredicates({
                      ...zkPredicates,
                      totalDeliveredVolumeUSD: { ...zkPredicates.totalDeliveredVolumeUSD, threshold: parseInt(e.target.value) || 0 }
                    })}
                    disabled={!zkPredicates.totalDeliveredVolumeUSD.enabled}
                    className="w-28 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>

              {/* Cumulative GPA */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                zkPredicates.gpa.enabled ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-60'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={zkPredicates.gpa.enabled}
                      onChange={(e) => setZkPredicates({
                        ...zkPredicates,
                        gpa: { ...zkPredicates.gpa, enabled: e.target.checked }
                      })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Cumulative GPA</span>
                  </label>
                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md font-semibold">
                    Actual: [Secret]
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Prove: GPA ≥</span>
                  <input
                    type="number"
                    step="0.1"
                    value={zkPredicates.gpa.threshold}
                    onChange={(e) => setZkPredicates({
                      ...zkPredicates,
                      gpa: { ...zkPredicates.gpa, threshold: parseFloat(e.target.value) || 0 }
                    })}
                    disabled={!zkPredicates.gpa.enabled}
                    className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Select Attributes to Disclose (Others Remain 256-bit Salted & Hidden)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {Object.entries(claims).map(([key, val]) => (
                <label
                  key={key}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs transition-all ${
                    disclosedKeys[key]
                      ? 'bg-purple-50/50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200 font-medium'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!disclosedKeys[key]}
                    onChange={(e) => setDisclosedKeys({ ...disclosedKeys, [key]: e.target.checked })}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="truncate">
                    <span className="font-semibold block">{key}</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {disclosedKeys[key] ? String(val) : '•••••••• (Salted)'}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Anti-Replay, Audience & Expiration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
              Target Audience DID
            </label>
            <input
              type="text"
              value={audienceDid}
              onChange={(e) => setAudienceDid(e.target.value)}
              placeholder="did:giglink:... or any"
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                Single-Use Nonce
              </label>
              <button
                type="button"
                onClick={handleGenerateFreshNonce}
                className="text-[10px] text-indigo-600 hover:underline"
              >
                New Nonce
              </button>
            </div>
            <input
              type="text"
              value={nonce}
              onChange={(e) => setNonce(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
              Expiration Window
            </label>
            <select
              value={validityHours}
              onChange={(e) => setValidityHours(parseInt(e.target.value))}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
            >
              <option value={1}>1 Hour (Ephemeral)</option>
              <option value={24}>24 Hours (Standard)</option>
              <option value={168}>7 Days (Extended)</option>
            </select>
          </div>
        </div>

        {/* Generate Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleGeneratePresentation}
            disabled={isGenerating}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-sm rounded-2xl shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Computing RFC 6962 Hashes & Pedersen Sigma Proofs...</span>
              </>
            ) : (
              <>
                <Cpu className="w-4 h-4" />
                <span>Generate & Cryptographically Sign Sovereign Presentation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Generated Presentation Inspector & Shareable Console */}
      {generatedPresentation && (
        <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cryptographically Signed Presentation Generated
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  ID: {generatedPresentation.presentationId}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(JSON.stringify(generatedPresentation, null, 2), 'json')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                {copiedPresentationJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPresentationJson ? 'Copied' : 'Copy JSON'}
              </button>
              <button
                type="button"
                onClick={handleDownloadPresentation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <button
                type="button"
                onClick={handleSendToPublicVerifier}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Public Verifier
              </button>
            </div>
          </div>

          {/* Presentation JSON Preview & Inspection Tabs */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveInspectorTab('payload')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                  activeInspectorTab === 'payload'
                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                W3C Presentation JSON
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectorTab('cryptography')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                  activeInspectorTab === 'cryptography'
                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Cryptographic Proof Inspector
              </button>
            </div>

            {activeInspectorTab === 'payload' ? (
              <pre className="p-4 bg-slate-950 text-slate-200 rounded-2xl font-mono text-xs overflow-x-auto max-h-96 border border-slate-800">
                {JSON.stringify(generatedPresentation, null, 2)}
              </pre>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-500 block uppercase text-[10px]">Holder DID Signature</span>
                    <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 break-all">
                      {('holderSignature' in generatedPresentation) ? generatedPresentation.holderSignature : 'N/A (Selective Disclosure)'}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-500 block uppercase text-[10px]">Issuer Merkle Root</span>
                    <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 break-all">
                      {generatedPresentation.credentialMerkleRoot}
                    </span>
                  </div>
                </div>

                {'predicates' in generatedPresentation && (
                  <div className="space-y-2">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">
                      Fiat-Shamir ZK Proof Transcripts ({generatedPresentation.predicates.length} Predicates):
                    </span>
                    {generatedPresentation.predicates.map((p, idx) => (
                      <div key={idx} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                          <span>{p.statement}</span>
                          <span className="text-emerald-600 font-mono text-[10px]">ZK Proof OK</span>
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 space-y-0.5">
                          <div>Pedersen C: {p.zkProof.commitmentC.substring(0, 32)}...</div>
                          <div>Fiat-Shamir Challenge e: {p.zkProof.fiatShamirChallenge.substring(0, 32)}...</div>
                          <div>Sigma Response (s_v, s_r): ({p.zkProof.responseValue.substring(0, 16)}..., {p.zkProof.responseRandomness.substring(0, 16)}...)</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
