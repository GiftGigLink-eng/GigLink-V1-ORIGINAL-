import React, { useState } from 'react';
import {
  Shield,
  CheckCircle2,
  Lock,
  AlertCircle,
  X,
  Loader2,
  Award,
  ExternalLink,
  FileCheck,
  Building,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../config/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../lib/firebaseErrors';

interface RequestItemVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'skill' | 'certification' | 'experience' | 'project';
  itemName: string;
  itemId?: string;
  onSuccess?: () => void;
}

export const RequestItemVerificationModal: React.FC<RequestItemVerificationModalProps> = ({
  isOpen,
  onClose,
  itemType,
  itemName,
  itemId,
  onSuccess,
}) => {
  const { user, profile } = useAuth();

  const [evidenceType, setEvidenceType] = useState<'certificate_id' | 'repo_commit' | 'credential_url' | 'client_proof'>('certificate_id');
  const [credentialReference, setCredentialReference] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be signed in to submit a verification request.');
      return;
    }

    if (!credentialReference.trim() && !evidenceUrl.trim()) {
      setError('Please provide a credential reference ID or evidence link.');
      return;
    }

    if (!consent) {
      setError('Please review and confirm the accuracy declaration.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const verifId = `verif_item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const verifRef = doc(db, 'verifications', verifId);

      // Mask reference number
      const rawRef = credentialReference.trim() || evidenceUrl.trim();
      const maskedNumber =
        rawRef.length > 4
          ? `${'•'.repeat(Math.max(4, Math.min(12, rawRef.length - 4)))} ${rawRef.slice(-4)}`
          : `••• ${rawRef}`;

      const notesPayload = JSON.stringify({
        itemType,
        itemName,
        itemId: itemId || itemName,
        evidenceType,
        evidenceUrl: evidenceUrl.trim() || undefined,
        userNotes: evidenceNotes.trim() || undefined,
      });

      const submission = {
        verificationId: verifId,
        userId: user.uid,
        userDisplayName: profile?.displayName || user.displayName || 'Applicant',
        userEmail: user.email || '',
        documentType: `item_${itemType}`,
        maskedNumber: maskedNumber.slice(0, 64),
        evidenceNotes: notesPayload.slice(0, 1000),
        status: 'pending' as const,
        submittedAt: new Date().toISOString(),
      };

      await setDoc(verifRef, submission);

      setSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Verification submission failed:', err);
      setError(err.message || 'Failed to submit verification request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getItemTypeLabel = () => {
    switch (itemType) {
      case 'skill':
        return 'Technical Skill';
      case 'certification':
        return 'Professional Certification';
      case 'experience':
        return 'Work Experience / Employment';
      case 'project':
        return 'Deliverable Proof';
      default:
        return 'Credential';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="item-verification-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Request Attestation
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {getItemTypeLabel()}: <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{itemName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Verification Request Submitted!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Your evidence for <strong className="text-slate-900 dark:text-white">{itemName}</strong> has been routed to the verifier review queue. You will be credited trust points once reviewed.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Evidence Type Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Verification Proof Method
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEvidenceType('certificate_id')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    evidenceType === 'certificate_id'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold">Certification / License ID</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Exam badge, license #, ID</p>
                </button>

                <button
                  type="button"
                  onClick={() => setEvidenceType('repo_commit')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    evidenceType === 'repo_commit'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold">Code Repository / PR</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">GitHub repo, commit proof</p>
                </button>

                <button
                  type="button"
                  onClick={() => setEvidenceType('credential_url')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    evidenceType === 'credential_url'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold">Issuer Verification URL</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Credly, Coursera, AWS URL</p>
                </button>

                <button
                  type="button"
                  onClick={() => setEvidenceType('client_proof')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    evidenceType === 'client_proof'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold">Client / Org Attestation</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Deliverable contract or note</p>
                </button>
              </div>
            </div>

            {/* Credential Reference */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Credential Number / Identifier
              </label>
              <input
                type="text"
                value={credentialReference}
                onChange={(e) => setCredentialReference(e.target.value)}
                placeholder="e.g. CERT-882194 or LIC-2026-X9"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Encrypted & masked for verifiers.
              </p>
            </div>

            {/* Verification Link / URL */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Public Verification Link or Repository URL
              </label>
              <input
                type="url"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://credly.com/badges/... or https://github.com/..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Additional Evidence Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Verification Details & Context
              </label>
              <textarea
                rows={2}
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
                placeholder="Details for the verifier regarding issuer, issue date, or scope..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>

            {/* Consent Declaration */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                I declare that this credential is authentic and belongs to me. I authorize GigLink verifiers to attest this proof.
              </span>
            </label>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Submit for Attestation</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
