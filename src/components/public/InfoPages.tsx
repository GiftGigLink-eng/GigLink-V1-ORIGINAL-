import React from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  GraduationCap,
  HelpCircle,
  FileText,
  Lock,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Layers,
  Scale,
  Users,
  Compass,
  Briefcase,
} from 'lucide-react';

interface InfoSectionConfig {
  title: string;
  badge: string;
  icon: React.ReactNode;
  description: string;
  content: React.ReactNode;
}

export const InfoPages: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const getSectionConfig = (): InfoSectionConfig => {
    switch (pathname) {
      case '/for-students':
        return {
          title: 'For Students & Emerging Talent',
          badge: 'Career Infrastructure',
          icon: <GraduationCap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
          description: 'Build your cryptographic Trust Passport, verify project deliverables, and access merit-based opportunities.',
          content: (
            <div className="space-y-6 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
              <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-6">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Proof of Work Over Unverified Resumes
                </h3>
                <p>
                  GigLink shifts hiring from subjective resumes to verifiable accomplishments. Every completed project deliverable, GitHub repository link, and institutional credential adds tamper-proof credibility to your Trust Score.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Identity Verification</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verify government credentials or institutional status to instantly earn an identity trust badge (+40 pts).
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Project Deliverables</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Submit verified source code, Figma artifacts, or live demos to earn up to 30 project points.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Milestone Escrow</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Land client gigs with guaranteed payments protected by smart financial escrow vaults.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <Link
                  to="/opportunities"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs"
                >
                  <Compass className="w-4 h-4" />
                  <span>Browse Student & Entry Opportunities</span>
                </Link>
                <Link
                  to="/talent/passport"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  <span>View Trust Passport</span>
                </Link>
              </div>
            </div>
          ),
        };

      case '/help':
        return {
          title: 'Help Center & Documentation',
          badge: 'Support & Guidance',
          icon: <HelpCircle className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
          description: 'Frequently asked questions, contract guides, and platform governance instructions.',
          content: (
            <div className="space-y-6 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    How does the Milestone Escrow system protect payments?
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Before contract work begins, the client deposits the agreed milestone funds into a secure escrow vault. Funds are immutably held until the client reviews and signs off on the delivered milestone or the final handover is completed.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    How is the Trust Score calculated?
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    The GigLink Trust Score operates on a mathematical scale from 0 to 100 points: Email Verification (+10), Profile Completeness (+20), Identity Verification (+40), and Verified Projects & Deliverables (+30). Completed contracts and positive client reviews further establish your volume reputation tiers.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    What should I do if a dispute arises during a contract?
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Either party can initiate dispute mediation through the Contract & Delivery Workspace. Our Phase 5 dispute resolution engine freezes affected escrow funds and opens formal evidence submission for certified neutral arbitration.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Need direct platform support?</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Our compliance team and integrity verifiers are available 24/7.
                  </p>
                </div>
                <a
                  href="mailto:support@giglink.platform"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
                >
                  Contact Support
                </a>
              </div>
            </div>
          ),
        };

      case '/legal/privacy':
        return {
          title: 'Privacy Policy & Data Sovereignty',
          badge: 'Legal & Privacy',
          icon: <Lock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
          description: 'How GigLink handles personal information, identity verification records, and cryptographic data.',
          content: (
            <div className="space-y-4 text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">1. Data Minimization & Public Projections</h3>
                <p>
                  GigLink enforces strict isolation between private user credentials and public projections. Your government identity documentation, contact details, and banking information are never exposed in public profile views or unauthenticated API payloads.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">2. Verifiable Trust Passport Privacy</h3>
                <p>
                  You maintain 100% control over the visibility of your Trust Passport. At any time, you can toggle your public projection between Public (Published) and Private through your Trust Passport dashboard.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">3. Security Invariants & Firestore Rules</h3>
                <p>
                  Data security is strictly enforced at the database level through immutable Firestore security rules. Contracts, proposals, and ledger transactions require authenticated, cryptographically validated authorizations.
                </p>
              </div>
            </div>
          ),
        };

      case '/legal/terms':
        return {
          title: 'Terms of Service & Contract Governance',
          badge: 'Legal & Governance',
          icon: <Scale className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
          description: 'Standard operating agreements for talent, creators, enterprise organizations, and milestone contracts.',
          content: (
            <div className="space-y-4 text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">1. Mutual Digital Signatures</h3>
                <p>
                  All project agreements executed on GigLink require digital signatures from both the client and talent before transitioning to active status. Neither party can unilaterally alter scope after mutual execution.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">2. Milestone Review & Deliverables</h3>
                <p>
                  Talent agrees to submit deliverables through verifiable repositories, links, or documentation. Clients have an active review period to either approve the deliverable (releasing milestone escrow) or request specific revisions.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">3. Financial Ledger Invariants</h3>
                <p>
                  All monetary transactions, platform fees, and escrow vault locks are registered in double-entry audit ledgers. Self-release and direct ledger manipulation are strictly prohibited and programmatically blocked.
                </p>
              </div>
            </div>
          ),
        };

      case '/legal/security':
        return {
          title: 'Security Architecture & Platform Integrity',
          badge: 'Platform Security',
          icon: <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
          description: 'Overview of our cryptographic proofs, zero-trust verification model, and adversarial defenses.',
          content: (
            <div className="space-y-4 text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Adversarial Defense & Concurrency Locks</h3>
                <p>
                  GigLink operates with server-authoritative state machines and mutex locking mechanisms across all proposal submissions, contract handovers, and escrow transitions, preventing race conditions and double-spending.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Zero-Bypass Authentication</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mandatory email verification and role-guarded routing prevent unauthenticated data access.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Cryptographic Verification</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    SHA-256 hashes and digital attestations certify project authenticity and proof integrity.
                  </p>
                </div>
              </div>
            </div>
          ),
        };

      case '/about':
      default:
        return {
          title: 'About GigLink Ecosystem',
          badge: 'Platform Vision',
          icon: <Layers className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
          description: 'A verified, merit-based career and opportunity ecosystem built on cryptographic Trust Passports.',
          content: (
            <div className="space-y-6 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  The Trust-First Professional Platform
                </h3>
                <p>
                  GigLink connects emerging talent, experienced freelancers, project creators, and enterprise organizations into a unified meritocratic marketplace. By replacing unverified claims with verifiable project proofs and reputation scorecards, we empower hirers and builders to collaborate with absolute certainty.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">100%</div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white mt-1">Verified Proofs</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Every milestone attested with code or artifacts</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">Escrow</div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white mt-1">Guaranteed Payouts</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Locked funds released upon approved deliverables</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="text-xl font-black text-blue-600 dark:text-blue-400">Portable</div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white mt-1">Trust Passports</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Exportable public credentials anywhere</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/opportunities"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs"
                >
                  <span>Explore Marketplace</span>
                </Link>
                <Link
                  to="/auth/register"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  <span>Create Account</span>
                </Link>
              </div>
            </div>
          ),
        };
    }
  };

  const config = getSectionConfig();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[40px]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Go Back</span>
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/40">
            {config.icon}
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 mb-1">
              {config.badge}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {config.title}
            </h1>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
          {config.description}
        </p>
      </div>

      {/* Main Content Area */}
      {config.content}
    </div>
  );
};
