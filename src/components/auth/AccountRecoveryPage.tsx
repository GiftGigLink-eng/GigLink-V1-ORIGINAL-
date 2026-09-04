import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, KeyRound, Mail, LifeBuoy, CheckCircle2, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { BackNavButton } from '../layout/BackNavButton';

export const AccountRecoveryPage: React.FC = () => {
  const { addToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [supportEmail, setSupportEmail] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportEmail || !supportMessage) {
      addToast('Please fill out all fields.', 'error');
      return;
    }
    setSubmitted(true);
    addToast('Support ticket dispatched to GigLink Trust & Security Team', 'success');
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] py-4 sm:py-8 px-2 sm:px-4">
      <div className="max-w-2xl mx-auto space-y-8">
          <div>
            <BackNavButton fallbackPath="/auth/login" label="Back to Sign In" />
          </div>

          <div className="text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Account Recovery & Security Protocol
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
              If you lost access to your primary email, experienced an unauthorized security event, or need identity recovery assistance.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-700/80 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                to="/auth/forgot-password"
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-indigo-500 transition-all flex flex-col justify-between group min-h-[120px]"
              >
                <div>
                  <KeyRound className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mb-2" />
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 transition-colors">
                    Reset Password
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Send a password reset link to your registered email
                  </p>
                </div>
              </Link>

              <Link
                to="/auth/verify-email"
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-indigo-500 transition-all flex flex-col justify-between group min-h-[120px]"
              >
                <div>
                  <Mail className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mb-2" />
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 transition-colors">
                    Resend Email Verification
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Verify email ownership or resend verification link
                  </p>
                </div>
              </Link>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2">
                Need Manual Identity Verification?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                If your account has been compromised or you no longer have access to your OAuth provider, contact our Trust & Security Team directly.
              </p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 py-3 px-5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors min-h-[44px]"
              >
                <LifeBuoy className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Open Security Support Ticket
              </button>
            </div>
          </div>
        </div>

      {/* Contact Support Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 relative">
            <button
              onClick={() => {
                setShowModal(false);
                setSubmitted(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            {submitted ? (
              <div className="text-center py-6 space-y-3">
                <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Ticket Submitted</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Our Trust & Security Desk will review your query and respond to <strong className="text-slate-900 dark:text-white">{supportEmail}</strong> within 24 hours.
                </p>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSubmitted(false);
                  }}
                  className="mt-4 py-2.5 px-6 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors min-h-[44px]"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleSupportSubmit} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <LifeBuoy className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Security Desk Support</h3>
                    <p className="text-xs text-slate-500">Contact Trust & Security</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="your-contact@domain.com"
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Describe Recovery Issue
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Provide details about your account recovery request or compromised account status..."
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 transition-colors min-h-[44px]"
                >
                  Submit Security Support Ticket
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
