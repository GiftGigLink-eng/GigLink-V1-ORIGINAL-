import React, { useState } from 'react';
import { Shield, CheckCircle2, Lock, AlertCircle, X, Loader2, ArrowRight } from 'lucide-react';
import { IdentityDocumentType } from '../../types';

interface IdentityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (documentType: IdentityDocumentType, documentNumberMasked: string, evidenceNotes?: string) => Promise<void>;
  userDisplayName: string;
}

export const IdentityVerificationModal: React.FC<IdentityVerificationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  userDisplayName,
}) => {
  const [docType, setDocType] = useState<IdentityDocumentType>('national_id');
  const [docNumber, setDocNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docNumber.trim()) {
      setError('Please provide your official identification reference number.');
      return;
    }
    if (!consent) {
      setError('Please review and check the declaration consent to proceed.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // Mask document number for privacy (e.g. keeping only the last 4 characters)
      const cleanNum = docNumber.trim();
      const masked = cleanNum.length > 4 
        ? `${'•'.repeat(Math.max(4, cleanNum.length - 4))} ${cleanNum.slice(-4)}`
        : `••• ${cleanNum}`;

      await onSubmit(docType, masked, notes.trim() || undefined);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to submit verification request.');
    } finally {
      setSubmitting(false);
    }
  };

  const docOptions: { id: IdentityDocumentType; title: string; desc: string }[] = [
    {
      id: 'national_id',
      title: 'National Identity Card / NIN (Nigeria / ECOWAS)',
      desc: '11-digit National Identification Number or National e-ID Card',
    },
    {
      id: 'passport',
      title: 'International Passport',
      desc: 'Valid government-issued travel passport document',
    },
    {
      id: 'drivers_license',
      title: "Driver's License",
      desc: 'Official state or federal driver licensing identification',
    },
    {
      id: 'voter_card',
      title: "Voter's Registration Card",
      desc: 'Official national voter registration credential',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        id="identity-verification-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Official Identity Verification
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Level 1 Verification (+40 Trust Score points)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
              Your official identification record has been safely encrypted and submitted to the verification audit queue.
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

            {/* Privacy Shield Callout */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
              <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="font-semibold text-slate-900 dark:text-white">Zero-Exposure Privacy Guarantee:</strong> Your raw document numbers and private identity data are NEVER exposed on your public Trust Passport (/p/:uid). Only the cryptographic verified state is visible.
              </p>
            </div>

            {/* Document Type Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Select Official Document Type
              </label>
              <div className="grid grid-cols-1 gap-2">
                {docOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDocType(opt.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between ${
                      docType === opt.id
                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {opt.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {opt.desc}
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ml-3 ${
                        docType === opt.id
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {docType === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Identification Reference Number */}
            <div className="space-y-1.5">
              <label htmlFor="id-ref-input" className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Document / Identification Number
              </label>
              <input
                id="id-ref-input"
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="e.g. 12345678901 or A12345678"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                required
              />
              <p className="text-[10px] text-slate-400">
                This will be securely masked upon storage.
              </p>
            </div>

            {/* Optional Evidence / Issuing Notes */}
            <div className="space-y-1.5">
              <label htmlFor="id-notes-input" className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Issuing Authority / Notes (Optional)
              </label>
              <input
                id="id-notes-input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. National Identity Management Commission (NIMC)"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Declaration & Consent Checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                id="id-consent-checkbox"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                I attest that I am <strong className="font-semibold">{userDisplayName}</strong> and that this document is genuine and legally registered to my person.
              </span>
            </label>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                id="submit-identity-verification-btn"
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <span>Submit for Verification</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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
