import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth, getAuthErrorMessage } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { BackNavButton } from '../layout/BackNavButton';

export const ForgotPasswordPage: React.FC = () => {
  const { sendPasswordReset } = useAuth();
  const { addToast } = useToast();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await sendPasswordReset(email.trim());
      setIsSent(true);
      addToast('Password reset link sent to your email!', 'success');
    } catch (err: any) {
      const msg = getAuthErrorMessage(err);
      setErrorMessage(msg);
      addToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col justify-center py-4 sm:py-8 px-2 sm:px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="mb-4">
            <BackNavButton fallbackPath="/auth/login" label="Back to Sign In" />
          </div>

          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <KeyRound className="h-6 w-6" />
            </div>
          </div>

          <h2 className="mt-4 text-center text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Reset Your Password
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            Enter your email address and we&apos;ll send you a password reset link
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-slate-800 py-8 px-4 sm:px-10 shadow-xl shadow-slate-200/50 dark:shadow-none sm:rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
            {isSent ? (
              <div className="text-center py-4 space-y-4">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Reset Link Dispatched
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  We&apos;ve sent a password reset link to <strong className="text-slate-900 dark:text-white">{email}</strong>. Please check your inbox and spam folders.
                </p>
                <div className="pt-4 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSent(false)}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors min-h-[44px]"
                  >
                    Resend to a different email
                  </button>
                  <Link
                    to="/auth/login"
                    className="w-full py-3 px-4 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-center transition-colors min-h-[44px] flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Return to Sign In
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {errorMessage && (
                  <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-medium flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="h-5 w-5" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="block w-full pl-11 pr-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all min-h-[44px]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[44px]"
                  >
                    {isSubmitting ? 'Sending Reset Email...' : 'Send Password Reset Link'}
                  </button>
                </form>

                <div className="mt-8 text-center text-sm">
                  <Link
                    to="/auth/login"
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline min-h-[44px] inline-flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Remember your password? Sign in
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
    </div>
  );
};
