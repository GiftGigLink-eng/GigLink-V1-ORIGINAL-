import React, { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { GlobalHeader } from './GlobalHeader';
import { MobileNavDrawer } from './MobileNavDrawer';
import { MobileRoleNav } from './MobileRoleNav';
import { OfflineBanner } from '../common/OfflineBanner';
import { EmailVerificationBanner } from '../common/EmailVerificationBanner';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, loading, profile } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const pathname = location.pathname;
  const isAuthRoute = pathname.startsWith('/auth');
  const isOnboardingRoute = pathname.startsWith('/onboarding');

  const handleOnboardingSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/auth/login', { replace: true });
    } catch (err) {
      console.error('Failed to sign out from onboarding', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  // 1. Authentication Dedicated Layout (No header, no navigation, no footer)
  if (isAuthRoute) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased">
        <OfflineBanner />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col justify-center">
          {children}
        </main>
      </div>
    );
  }

  // 2. Onboarding Dedicated Layout (Pre-workspace experience: No main app nav, no persona switcher, no chat, no notifications, no profile menu, no ecosystem footer)
  if (isOnboardingRoute) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased">
        <OfflineBanner />

        {/* Dedicated Minimal Onboarding Header */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black flex items-center justify-center text-sm shadow-md shadow-indigo-500/20">
                G
              </div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                  GigLink
                </span>
                <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Workspace Setup
                </span>
              </div>
            </div>

            {/* Onboarding Context & Security Badge */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden xs:inline">Verified Identity Protocol</span>
                <span className="xs:hidden">Setup</span>
              </div>

              {/* Clean Exit / Sign Out Control */}
              {user && (
                <button
                  type="button"
                  id="onboarding-signout-btn"
                  onClick={handleOnboardingSignOut}
                  disabled={isSigningOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors"
                  title="Sign out of current account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Dedicated Focused Onboarding Main Container */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {children}
        </main>

        {/* Minimal Onboarding Setup Footer */}
        <footer className="mt-auto border-t border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
          <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>GigLink Protocol — Trust-First Professional Ecosystem</span>
            <span className="text-[11px] text-slate-400">Step by step account & workspace initialization</span>
          </div>
        </footer>
      </div>
    );
  }

  // 3. Transient loading or incomplete onboarding state: Suppress workspace GlobalHeader/Drawer/Footer to prevent UI flash
  if (loading || (user && !profile) || (user && profile && profile.onboardingCompleted === false)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased">
        <OfflineBanner />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    );
  }

  // 4. Main Ecosystem / Workspace Full Authenticated Layout
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased">
      {/* Offline Connectivity Banner */}
      <OfflineBanner />

      {/* Global Header with Full Navigation Shell */}
      <GlobalHeader onToggleMobileNav={() => setMobileNavOpen(true)} />

      {/* Unverified Account Reminder Banner (Non-blocking) */}
      <EmailVerificationBanner />

      {/* Mobile Drawer */}
      <MobileNavDrawer isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Mobile Quick Bottom Navigation Dock (Role-Specific) */}
      <MobileRoleNav onOpenDrawer={() => setMobileNavOpen(true)} />

      {/* Main Responsive Viewport Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-6 space-y-6">
        {children}
      </main>

      {/* Clean Ecosystem Production Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 pb-20 lg:pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
              G
            </div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">GigLink Ecosystem</span>
            <span>— Verified Professional Career Platform</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <Link to="/verify/zk" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline transition-colors">
              ZK Verifier Console
            </Link>
            <Link to="/about" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              About
            </Link>
            <Link to="/for-students" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              For Students
            </Link>
            <Link to="/help" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Help
            </Link>
            <Link to="/legal/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Privacy
            </Link>
            <Link to="/legal/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Terms
            </Link>
            <Link to="/legal/security" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Security
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
