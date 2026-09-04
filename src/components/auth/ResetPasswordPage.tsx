import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth, getAuthErrorMessage } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { BackNavButton } from '../layout/BackNavButton';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { confirmResetPassword } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const oobCode = searchParams.get('oobCode');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!oobCode) {
      setErrorMessage('Invalid or missing password reset token. Please request a new password reset link.');
    }
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) {
      setErrorMessage('Missing password reset token.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await confirmResetPassword(oobCode, password);
      setIsSuccess(true);
      addToast('Password reset successfully! You can now sign in.', 'success');
      setTimeout(() => {
        navigate('/auth/login', { replace: true });
      }, 3000);
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
            Choose New Password
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            Set a secure new password for your GigLink account
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-slate-800 py-8 px-4 sm:px-10 shadow-xl shadow-slate-200/50 dark:shadow-none sm:rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
            {!oobCode ? (
              <div className="text-center py-4 space-y-4">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Invalid or Expired Link
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  The password reset link is missing a valid code token or has expired.
                </p>
                <div className="pt-2">
                  <Link
                    to="/auth/forgot-password"
                    className="inline-flex justify-center items-center gap-2 py-3 px-6 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors min-h-[44px]"
                  >
                    Request New Reset Link
                  </Link>
                </div>
              </div>
            ) : isSuccess ? (
              <div className="text-center py-4 space-y-4">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Password Updated!
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Your password has been reset successfully. Redirecting you to the sign in page in 3 seconds...
                </p>
                <div className="pt-2">
                  <Link
                    to="/auth/login"
                    className="inline-flex justify-center items-center gap-2 py-3 px-6 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors min-h-[44px]"
                  >
                    Sign In Now
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

                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      New Password
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-5 w-5" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="block w-full pl-11 pr-11 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all min-h-[44px]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 min-w-[44px] min-h-[44px] justify-center"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-5 w-5" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="block w-full pl-11 pr-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all min-h-[44px]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[44px]"
                  >
                    {isSubmitting ? 'Updating Password...' : 'Save New Password'}
                  </button>
                </form>

                <div className="mt-8 text-center text-sm">
                  <Link
                    to="/auth/login"
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline min-h-[44px] inline-flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Cancel and return to sign in
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
    </div>
  );
};
