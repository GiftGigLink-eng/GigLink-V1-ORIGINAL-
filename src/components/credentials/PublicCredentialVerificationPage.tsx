import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Building2,
  Calendar,
  Award,
  CheckCircle2,
  ExternalLink,
  Download,
  Share2,
  Sparkles,
  Lock,
  QrCode,
  Printer,
  Copy,
  Check,
  User,
  BadgeAlert,
  ArrowLeft,
} from 'lucide-react';
import {
  getVerifiableCredentialById,
  verifyCredentialCryptographicProof,
  exportCredentialAsW3CJsonLd,
} from '../../lib/credentialIssuanceService';
import {
  VerifiableCredential,
  CredentialVerificationResult,
} from '../../types/credential';

export const PublicCredentialVerificationPage: React.FC = () => {
  const { credentialId } = useParams<{ credentialId: string }>();
  const [credential, setCredential] = useState<VerifiableCredential | null>(null);
  const [verification, setVerification] = useState<CredentialVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    async function loadAndVerify() {
      if (!credentialId) {
        setLoading(false);
        return;
      }
      try {
        const cred = await getVerifiableCredentialById(credentialId);
        if (cred) {
          setCredential(cred);
          const result = await verifyCredentialCryptographicProof(cred);
          setVerification(result);
        }
      } catch (err) {
        console.error('Failed to load credential:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAndVerify();
  }, [credentialId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleDownloadW3CJsonLd = () => {
    if (!credential) return;
    const jsonStr = exportCredentialAsW3CJsonLd(credential);
    const blob = new Blob([jsonStr], { type: 'application/ld+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credential_${credential.id}_${credential.recipient.recipientName.replace(/\s+/g, '_').toLowerCase()}.jsonld`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 py-12 px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            Validating Cryptographic Attestation...
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Checking issuer cryptographic signatures and recalculating canonical SHA-256 digest.
          </p>
        </div>
      </div>
    );
  }

  if (!credential) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 py-12 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Credential Record Not Found
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            The credential identifier <span className="font-mono text-indigo-600 font-bold">{credentialId}</span> could not be located on the platform ledger.
          </p>
          <div className="pt-4">
            <Link
              to="/opportunities"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Marketplace</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isVerified = verification?.isValid === true;
  const isRevoked = verification?.status === 'revoked';
  const isTampered = verification?.status === 'tampered';
  const isExpired = verification?.status === 'expired';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Actions Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Link to="/" className="hover:text-indigo-600 transition-colors">GigLink Protocol</Link>
            <span>/</span>
            <span>Credential Verification Ledger</span>
            <span>/</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{credential.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              id="verify-page-copy-link-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-2xs transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedLink ? 'Copied' : 'Share'}</span>
            </button>

            <button
              onClick={() => setShowQrModal(true)}
              id="verify-page-qr-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-2xs transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Seal</span>
            </button>

            <button
              onClick={handleDownloadW3CJsonLd}
              id="verify-page-download-jsonld-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>W3C JSON-LD</span>
            </button>

            <button
              onClick={handlePrintCertificate}
              id="verify-page-print-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Certificate</span>
            </button>
          </div>
        </div>

        {/* Real-time Verification Status Banner */}
        {isVerified && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-5 flex items-start gap-4 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  Cryptographically Verified Institutional Attestation
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  Status: Active & Authentic
                </span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400/90 leading-relaxed">
                This credential was issued by <strong className="font-semibold text-emerald-900 dark:text-emerald-200">{credential.issuer.orgName}</strong> and signed with their verified institutional authority key. The SHA-256 cryptographic payload digest matches the original tamper-proof issuance record.
              </p>
            </div>
          </div>
        )}

        {isRevoked && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-3xl p-5 flex items-start gap-4 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <BadgeAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-rose-800 dark:text-rose-300">
                  Revoked Credential Notice
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                  Status: REVOKED
                </span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-400/90 leading-relaxed">
                {verification?.details || 'This credential has been officially revoked by the issuing institution.'}
              </p>
            </div>
          </div>
        )}

        {isTampered && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 flex items-start gap-4 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  Security Warning: Cryptographic Digest Tampered
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                  Integrity Check Failed
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400/90 leading-relaxed">
                The computed hash of the credential fields does not match the stored cryptographic seal. The contents have been altered.
              </p>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 flex items-start gap-4 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  Expired Credential
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                  Status: Expired
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400/90 leading-relaxed">
                {verification?.details || 'This credential has passed its expiration date.'}
              </p>
            </div>
          </div>
        )}

        {/* Main Certificate Card (Institutional Layout) */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-md relative overflow-hidden">
          {/* Certificate Decorative Top Border Pattern */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-sky-500 to-indigo-600" />

          <div className="space-y-8">
            {/* Header: Issuer Organization & Official Seal */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xl shrink-0">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {credential.issuer.orgName}
                    </h3>
                    <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {credential.issuer.accreditationDetails || `${credential.issuer.orgType === 'institution' ? 'Accredited Educational Institution' : 'Enterprise Partner'} • Official Domain: ${credential.issuer.officialEmailDomain || 'Verified'}`}
                  </p>
                </div>
              </div>

              <div className="text-right sm:border-l sm:border-slate-100 sm:dark:border-slate-800 sm:pl-6">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                  {credential.credentialType.replace('_', ' ')}
                </span>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">
                  Issued: {new Date(credential.issuedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Recipient & Credential Title */}
            <div className="space-y-4 text-center sm:text-left py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                This Verifiable Attestation is Awarded To
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {credential.recipient.recipientName}
              </h1>
              {credential.recipient.recipientUid && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Recipient Account: <Link to={`/p/${credential.recipient.recipientUid}`} className="text-indigo-600 hover:underline font-semibold">View Trust Passport</Link></span>
                </div>
              )}
            </div>

            {/* Credential Core Content */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-700/60 space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Attestation / Competency Conferred
                </h4>
                <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {credential.title}
                </p>
                {credential.achievementGrade && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-bold">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Honors / Grade: {credential.achievementGrade}</span>
                  </div>
                )}
              </div>

              {credential.description && (
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {credential.description}
                </p>
              )}

              {/* Skills Validated */}
              {credential.skills && credential.skills.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    Verified Competencies & Skills Covered:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {credential.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 shadow-2xs"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Verification Criteria */}
              {credential.criteria && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Formal Verification Criteria:
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                    "{credential.criteria}"
                  </p>
                </div>
              )}

              {/* Evidence Link */}
              {credential.evidenceUrl && (
                <div className="pt-2">
                  <a
                    href={credential.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                  >
                    <span>View Official Artifact & Evidence Repository</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Issuer Signature & Cryptographic Seal Footer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Authorized Signatory
                </p>
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {credential.issuer.issuerAdminName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {credential.issuer.issuerAdminTitle || 'Dean / Program Director'}
                  </p>
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono">
                    {credential.issuer.orgName}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-left sm:text-right">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Cryptographic Attestation Digest
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 justify-start sm:justify-end">
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                      {credential.cryptographicProof.payloadDigest}
                    </span>
                    <button
                      onClick={() => handleCopyHash(credential.cryptographicProof.payloadDigest)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title="Copy SHA-256 Digest"
                    >
                      {copiedHash ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Protocol: {credential.cryptographicProof.type}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Trust Passport Impact: +{credential.trustScoreImpact} Points
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Protocol Verification & Standards Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-3 shadow-xs text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
            <Lock className="w-4 h-4 text-indigo-500" />
            <span>W3C Verifiable Credentials Standard Interoperability</span>
          </div>
          <p className="leading-relaxed">
            This digital credential adheres to the W3C Verifiable Credentials Data Model 1.1 and the GigLink Multi-Party Cryptographic Proof suite. Any employer, admissions committee, or background-checking authority can verify this credential directly against the canonical ledger digest without contacting the issuer manually.
          </p>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 text-center shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Verifiable QR Code Seal
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Scan with any mobile device to immediately open this verified ledger entry.
            </p>
            <div className="p-4 bg-white rounded-2xl inline-block border border-slate-200 shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.href)}`}
                alt="Credential QR Code"
                className="w-44 h-44 mx-auto"
              />
            </div>
            <p className="text-[11px] font-mono text-slate-400 truncate">
              {credential.id}
            </p>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
