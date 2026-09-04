import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Mail, RefreshCw, CheckCircle, Clock, X, AlertTriangle } from 'lucide-react';
import { useAuth, getAuthErrorMessage } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const RESEND_COOLDOWN_SECONDS = 60;

export const EmailVerificationBanner: React.FC = () => {
  const { user, profile, resendVerificationEmail, reloadUser, checkEmailVerified } = useAuth();
  const { addToast } = useToast();

  const [isDismissed, setIsDismissed] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (cooldown > 0) {
      timerRef.current = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown]);

  // Don't render banner if user is not logged in, email is verified, or temporarily dismissed
  if (!user || user.emailVerified || isDismissed) {
    return null;
  }

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      await resendVerificationEmail();
      setCooldown(RESEND_COOLDOWN_SECONDS);
      addToast('Verification email resent! Please check your inbox.', 'success');
    } catch (err: any) {
      if (err?.code === 'auth/too-many-requests') {
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
      const msg = getAuthErrorMessage(err);
      addToast(msg, 'error');
    } finally {
      setIsResending(false);
    }
  };

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      const verified = await checkEmailVerified();
      if (verified) {
        addToast('Email verified successfully!', 'success');
      } else {
        addToast("Email not verified yet. Please check your inbox or click 'Resend'.", 'info');
      }
    } catch {
      addToast('Could not refresh status. Please try again.', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div
      id="email-verification-workspace-banner"
      className="bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-300/40 dark:border-amber-700/40 text-amber-900 dark:text-amber-200 px-4 py-2 text-xs"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-medium">
            Please verify your email address (<strong>{user.email}</strong>) to secure your account.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            id="banner-check-verified-btn"
            onClick={handleCheck}
            disabled={isChecking}
            className="font-bold underline hover:text-amber-950 dark:hover:text-amber-100 transition-colors inline-flex items-center gap-1 min-h-[32px]"
          >
            <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : "I've verified"}</span>
          </button>

          <button
            type="button"
            id="banner-resend-email-btn"
            onClick={handleResend}
            disabled={isResending || cooldown > 0}
            className="px-2.5 py-1 rounded-md bg-amber-600 dark:bg-amber-700 text-white font-semibold hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1 min-h-[32px]"
          >
            {cooldown > 0 ? (
              <>
                <Clock className="w-3 h-3" />
                <span>Resend ({cooldown}s)</span>
              </>
            ) : (
              <>
                <Mail className="w-3 h-3" />
                <span>{isResending ? 'Sending...' : 'Resend Email'}</span>
              </>
            )}
          </button>

          <Link
            to="/auth/verify-email"
            className="text-amber-800 dark:text-amber-300 hover:underline font-medium hidden sm:inline"
          >
            Details &rarr;
          </Link>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss verification banner"
            className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 p-1 rounded hover:bg-amber-500/20 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
