import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Mail,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
  Inbox,
  LogOut,
  HelpCircle,
  ExternalLink,
  Send,
} from 'lucide-react';
import { useAuth, getAuthErrorMessage } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ROLE_DEFINITIONS } from '../../types';

const RESEND_COOLDOWN_SECONDS = 60;

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const {
    user,
    profile,
    activeRole,
    verifyEmailCode,
    resendVerificationEmail,
    reloadUser,
    checkEmailVerified,
    signOut,
  } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const oobCode = searchParams.get('oobCode');

  const [isVerifyingLink, setIsVerifyingLink] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isVerified = Boolean(user?.emailVerified || verificationSuccess);
  const userEmail = user?.email || profile?.email || 'user@giglink.com';

  // 1. If an oobCode action link was clicked directly or passed in URL, process it immediately
  useEffect(() => {
    if (oobCode) {
      handleDirectOobCodeVerification(oobCode);
    }
  }, [oobCode]);

  // 2. Cooldown timer interval handler
  useEffect(() => {
    if (cooldownRemaining > 0) {
      cooldownIntervalRef.current = setInterval(() => {
        setCooldownRemaining((prev) => {
          if (prev <= 1) {
            if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, [cooldownRemaining]);

  // 3. Periodic cross-device / cross-tab verification sync
  useEffect(() => {
    if (user && !user.emailVerified && !verificationSuccess) {
      const pollInterval = setInterval(async () => {
        try {
          const verified = await checkEmailVerified();
          if (verified) {
            setVerificationSuccess(true);
            addToast('Email verified successfully! Welcome to GigLink.', 'success');
          }
        } catch {
          // Gracefully ignore polling errors
        }
      }, 4000);

      return () => clearInterval(pollInterval);
    }
  }, [user, verificationSuccess, checkEmailVerified, addToast]);

  const handleDirectOobCodeVerification = async (code: string) => {
    setIsVerifyingLink(true);
    setErrorMessage(null);
    try {
      await verifyEmailCode(code);
      setVerificationSuccess(true);
      addToast('Email address verified successfully via link!', 'success');
    } catch (err: any) {
      const msg = getAuthErrorMessage(err);
      setErrorMessage(msg);
      addToast(msg, 'error');
    } finally {
      setIsVerifyingLink(false);
    }
  };

  const handleResendEmail = async () => {
    if (cooldownRemaining > 0 || isResending) return;

    setIsResending(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await resendVerificationEmail();
      setCooldownRemaining(RESEND_COOLDOWN_SECONDS);
      setInfoMessage(`A fresh verification link has been dispatched to ${userEmail}. Please check your inbox and spam folder.`);
      addToast('Verification email resent! Please check your inbox.', 'success');
    } catch (err: any) {
      if (err?.code === 'auth/too-many-requests') {
        setCooldownRemaining(err?.cooldownRemaining || RESEND_COOLDOWN_SECONDS);
      }
      const msg = getAuthErrorMessage(err);
      setErrorMessage(msg);
      addToast(msg, 'error');
    } finally {
      setIsResending(false);
    }
  };

  const handleManualCheckStatus = async () => {
    setIsCheckingStatus(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const updatedUser = await reloadUser();
      if (updatedUser?.emailVerified) {
        setVerificationSuccess(true);
        addToast('Email verified successfully! Welcome to GigLink.', 'success');
      } else {
        setInfoMessage("We haven't detected your verification yet. Please click the link in your email, then check status again.");
      }
    } catch {
      setErrorMessage('Unable to reload status. Please check your internet connection and try again.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleSignOutAndSwitch = async () => {
    try {
      await signOut();
      navigate('/auth/login', { replace: true });
    } catch {
      navigate('/auth/login', { replace: true });
    }
  };

  const handleContinue = () => {
    if (profile && profile.onboardingCompleted === false) {
      navigate('/onboarding', { replace: true });
    } else {
      const targetHome = ROLE_DEFINITIONS[activeRole]?.homeRoute || '/talent/dashboard';
      navigate(targetHome, { replace: true });
    }
  };

  // Helper to open email clients based on domain
  const getEmailProviderLink = () => {
    const domain = userEmail.split('@')[1]?.toLowerCase() || '';
    if (domain.includes('gmail')) return 'https://mail.google.com';
    if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live')) return 'https://outlook.live.com';
    if (domain.includes('yahoo')) return 'https://mail.yahoo.com';
    if (domain.includes('icloud')) return 'https://www.icloud.com/mail';
    return null;
  };

  const providerUrl = getEmailProviderLink();

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col justify-center py-4 sm:py-8 px-2 sm:px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="flex justify-center">
          <div
            className={`h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-xl transition-colors duration-300 ${
              isVerified
                ? 'bg-emerald-600 shadow-emerald-600/30'
                : 'bg-indigo-600 shadow-indigo-600/30'
            }`}
          >
            {isVerified ? (
              <ShieldCheck className="h-7 w-7" />
            ) : (
              <Mail className="h-7 w-7" />
            )}
          </div>
        </div>

        <h2 className="mt-4 text-center text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {isVerified
            ? 'Email Address Verified'
            : 'Verify your email'}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto font-medium">
          {isVerified ? (
            'Your account security is confirmed. You can now access your active workspace and Trust Passport.'
          ) : (
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {userEmail}
            </span>
          )}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white dark:bg-slate-800 py-8 px-4 sm:px-10 shadow-xl shadow-slate-200/50 dark:shadow-none sm:rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-6">
          {isVerified ? (
            <div className="text-center py-4 space-y-5">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified Email Account
                </span>
                <p className="text-base font-bold text-slate-900 dark:text-white pt-1">
                  {userEmail}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-left text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>Account Security Confirmed</span>
                </div>
                <p>
                  Your email address is verified in Firebase Authentication. Email verification is a permanent requirement for workspace access, escrow protections, and reputation scoring.
                </p>
              </div>

              <div className="pt-2">
                <button
                  id="verify-email-continue-btn"
                  onClick={handleContinue}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm min-h-[44px]"
                >
                  {profile && profile.onboardingCompleted === false
                    ? 'Continue to Onboarding'
                    : 'Continue to Dashboard'}{' '}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {errorMessage && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-medium flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
                  <span className="flex-1">{errorMessage}</span>
                </div>
              )}

              {infoMessage && (
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 text-xs font-medium flex items-start gap-3">
                  <Inbox className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="flex-1">{infoMessage}</span>
                </div>
              )}

              {/* Instructions Card */}
              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Check your inbox</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  We have sent an official verification email with a secure link to{' '}
                  <strong className="text-slate-900 dark:text-white">{userEmail}</strong>.
                  Click the link in your email to verify your account.
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Waiting for verification... This page automatically updates once confirmed.</span>
                </div>
              </div>

              {/* Primary Actions */}
              <div className="space-y-3">
                {providerUrl && (
                  <a
                    id="open-mail-provider-btn"
                    href={providerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm min-h-[44px]"
                  >
                    <span>Open Email Inbox</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}

                <button
                  type="button"
                  id="check-verification-status-btn"
                  onClick={handleManualCheckStatus}
                  disabled={isCheckingStatus}
                  className={`w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold border transition-colors shadow-sm min-h-[44px] ${
                    providerUrl
                      ? 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  <RefreshCw className={`h-4 w-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                  <span>{isCheckingStatus ? 'Checking Status...' : "I've Verified My Email — Check Status"}</span>
                </button>
              </div>

              {/* Resend Link with Cooldown */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  id="resend-verification-email-btn"
                  onClick={handleResendEmail}
                  disabled={isResending || cooldownRemaining > 0}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
                >
                  {cooldownRemaining > 0 ? (
                    <>
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-500 dark:text-slate-400">Resend email in {cooldownRemaining}s</span>
                    </>
                  ) : (
                    <>
                      <Send className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                      <span>{isResending ? 'Sending...' : 'Resend verification email'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Troubleshooting Tips */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Troubleshooting tips:</span>
                </div>
                <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 pl-4 list-disc">
                  <li>Check your spam, junk, or promotions folder.</li>
                  <li>If you verify on your phone or another tab, return here and click &quot;Check Status&quot;.</li>
                  <li>
                    Entered the wrong email?{' '}
                    <button
                      type="button"
                      onClick={handleSignOutAndSwitch}
                      className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                    >
                      Sign out and change email
                    </button>
                  </li>
                </ul>
              </div>

              {/* Secondary Navigation (No Skip option) */}
              <div className="pt-2 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  id="verify-email-signout-btn"
                  onClick={handleSignOutAndSwitch}
                  className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors py-2 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out of this account</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

