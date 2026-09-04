import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, UserCheck, Search, HelpCircle, ArrowRight, Lock, Sparkles, Loader2 } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';
import { getLandingPageRedirect } from '../../lib/authNavigationService';

export const PublicEcosystemPortal: React.FC = () => {
  const { user, profile, activeRole, loading } = useAuth();
  const navigate = useNavigate();

  // 1. Session resolution loading state to prevent layout flash
  if (loading || (user && !profile)) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm h-64 flex flex-col justify-center items-center text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Verifying GigLink credentials...
          </p>
        </div>
      </div>
    );
  }

  // 2. Authenticated user navigation: Redirect from public landing page to Dashboard / Verification / Onboarding
  const landingRedirect = getLandingPageRedirect(user, profile, activeRole);
  if (landingRedirect) {
    return <Navigate to={landingRedirect} replace />;
  }

  return (
    <div id="public-ecosystem-portal" className="space-y-8">
      {/* Ecosystem Portal Hero */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/80 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Career & Trust Protocol</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            Connect verified skills, project proof, and opportunity contracts.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            GigLink is a career ecosystem connecting Learners 🎓, Partners 💼, Clients 🤝, and Organizations 🏢 through a single verified Trust Passport.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {!user ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => navigate('/auth/login')}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-2 transition-colors min-h-[44px]"
                >
                  <span>Sign In / Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/auth/register')}
                  className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors min-h-[44px]"
                >
                  <span>Create Account</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 text-indigo-800 dark:text-indigo-200 text-xs font-semibold flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  <span>
                    Authenticated as <strong>{profile?.displayName || user.email}</strong>
                  </span>
                </div>

                <button
                  id="portal-my-trust-passport-btn"
                  onClick={() => navigate(`/passport/${user.uid}`)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-2 transition-colors min-h-[44px]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>My Trust Passport</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Core Ecosystem Pillars Overview */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Learner Persona Lens */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-lg">
            🎓
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Learners & Students</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Build verified project proofs, request institutional credential endorsements, and access entry-level opportunities.
          </p>
        </div>

        {/* Partner Persona Lens */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-lg">
            💼
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Professional Partners</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Bid on client opportunities, execute milestone-backed contracts, and build long-term reputation.
          </p>
        </div>

        {/* Client Persona Lens */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center text-lg">
            🤝
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Clients & Hirers</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Post opportunities, inspect candidates&apos; verified Trust Passports, and manage funded escrow milestones.
          </p>
        </div>

        {/* Organization Persona Lens */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-lg">
            🏢
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Organizations & Schools</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Audit student claims, issue official credentials, and verify project submissions into the Trust Passport registry.
          </p>
        </div>
      </section>
    </div>
  );
};
