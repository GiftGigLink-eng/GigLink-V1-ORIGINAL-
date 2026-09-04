import React, { useEffect, useState } from 'react';
import { Shield, CheckCircle2, XCircle, Clock, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { IdentityVerificationSubmission } from '../../types';

interface AdminVerificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onReview: (
    verificationId: string,
    subjectUserId: string,
    status: 'verified' | 'rejected',
    reason?: string
  ) => Promise<void>;
  currentUserId: string;
}

export const AdminVerificationDrawer: React.FC<AdminVerificationDrawerProps> = ({
  isOpen,
  onClose,
  onReview,
}) => {
  const [requests, setRequests] = useState<IdentityVerificationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const q = query(collection(db, 'verifications'), limit(25));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: IdentityVerificationSubmission[] = [];
        snapshot.forEach((doc) => {
          items.push(doc.data() as IdentityVerificationSubmission);
        });
        // Sort with pending first, then by date desc
        items.sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        });
        setRequests(items);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load verifications queue:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApprove = async (item: IdentityVerificationSubmission) => {
    setProcessingId(item.verificationId);
    try {
      await onReview(item.verificationId, item.userId, 'verified');
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async (item: IdentityVerificationSubmission) => {
    setProcessingId(item.verificationId);
    try {
      await onReview(
        item.verificationId,
        item.userId,
        'rejected',
        rejectReason.trim() || 'Document could not be validated against official register.'
      );
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        id="admin-verification-drawer"
        className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-lg h-full overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Identity Verification Audit Queue
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official Reviewer & Compliance Workflow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 space-y-4">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-600 dark:text-slate-300">
            This administrative drawer provides full audit transparency over identity submissions. When approved, +40 trust points are officially stamped onto the user's private passport.
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
              <p className="text-xs">Loading verification submissions...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8">
              <Shield className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                No Verification Submissions Found
              </p>
              <p className="text-[11px] text-slate-400">
                Submit an identity verification request from your passport to populate the review queue.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((item) => {
                const isPending = item.status === 'pending';
                const isVerified = item.status === 'verified';
                const isRejected = item.status === 'rejected';
                const isBusy = processingId === item.verificationId;

                return (
                  <div
                    key={item.verificationId}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.userDisplayName || 'User'}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.userEmail || 'UID: ' + item.userId.slice(0, 8)}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 font-bold rounded-full flex items-center gap-1 ${
                          isVerified
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : isRejected
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {isVerified && <CheckCircle2 className="w-3 h-3" />}
                        {isRejected && <XCircle className="w-3 h-3" />}
                        {isPending && <Clock className="w-3 h-3" />}
                        <span className="capitalize">{item.status}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Doc Type</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                          {item.documentType?.replace('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Masked Ref</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {item.documentNumberMasked}
                        </span>
                      </div>
                    </div>

                    {item.evidenceNotes && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/30 p-2 rounded">
                        "{item.evidenceNotes}"
                      </p>
                    )}

                    {item.rejectionReason && (
                      <div className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded">
                        <strong>Rejection Reason:</strong> {item.rejectionReason}
                      </div>
                    )}

                    {/* Action Controls for Pending */}
                    {isPending && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        {rejectingId === item.verificationId ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Specify reason for rejection..."
                              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-rose-300 dark:border-rose-900 rounded-lg text-xs"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setRejectingId(null)}
                                className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmReject(item)}
                                disabled={isBusy}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg"
                              >
                                Confirm Rejection
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setRejectingId(item.verificationId)}
                              disabled={isBusy}
                              className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApprove(item)}
                              disabled={isBusy}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                            >
                              {isBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Approve (+40 pts)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
