import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Building2, Globe, Sparkles, ArrowRight, ShieldCheck, Users, MapPin, Briefcase } from 'lucide-react';
import { useAuth, getAuthErrorMessage } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ROLE_DEFINITIONS } from '../../types';
import { BackNavButton } from '../layout/BackNavButton';

const INDUSTRY_OPTIONS = [
  'Software & SaaS',
  'FinTech & Banking',
  'Healthcare & BioTech',
  'E-Commerce & Retail',
  'Media, Gaming & Entertainment',
  'Consulting & Professional Services',
  'Telecommunications',
  'Hardware & IoT',
  'Other Corporate Sector',
];

const COMPANY_SIZE_OPTIONS = [
  '1-10 employees (Startup / Seed)',
  '11-50 employees (Growth Stage)',
  '51-200 employees (Scale-Up)',
  '201-1,000 employees (Mid-Market)',
  '1,000+ employees (Enterprise)',
];

const TEAM_HIRING_NEEDS = [
  'Dedicated Engineering Teams',
  'Fractional Technical Specialists',
  'Multi-Seat Project Outsourcing',
  'Enterprise Vendor Consolidation',
  'Managed Apprenticeship Pipelines',
];

export const EnterpriseOnboardingPage: React.FC = () => {
  const { profile, activeRole, completeOrganizationOnboarding } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState(INDUSTRY_OPTIONS[0]);
  const [companySize, setCompanySize] = useState(COMPANY_SIZE_OPTIONS[1]);
  const [companyBio, setCompanyBio] = useState('');
  const [website, setWebsite] = useState('');
  const [hqLocation, setHqLocation] = useState('');
  const [hiringScope, setHiringScope] = useState<string[]>([]);
  const [adminTitle, setAdminTitle] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const homeRoute = ROLE_DEFINITIONS[activeRole]?.homeRoute || '/enterprise/dashboard';

  if (profile && profile.onboardingCompleted === true) {
    return <Navigate to={homeRoute} replace />;
  }

  const toggleHiringScope = (item: string) => {
    if (hiringScope.includes(item)) {
      setHiringScope(hiringScope.filter((s) => s !== item));
    } else {
      setHiringScope([...hiringScope, item]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setErrorMessage('Please enter your company / organization name.');
      return;
    }
    if (!companyBio.trim()) {
      setErrorMessage('Please enter a company overview / bio.');
      return;
    }
    if (!hqLocation.trim()) {
      setErrorMessage('Please enter your headquarters location.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await completeOrganizationOnboarding({
        persona: 'enterprise',
        orgName: companyName.trim(),
        orgType: 'company',
        description: companyBio.trim(),
        website: website.trim() || undefined,
        hqLocation: hqLocation.trim(),
        industry,
        companySize,
        hiringScope,
        adminTitle: adminTitle.trim() || undefined,
      });

      addToast('Enterprise organization profile initialized! Welcome to Org Console.', 'success');
      navigate(homeRoute, { replace: true });
    } catch (err: any) {
      const msg = getAuthErrorMessage(err);
      setErrorMessage(msg);
      addToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] py-4 sm:py-8 px-2 sm:px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <BackNavButton fallbackPath="/onboarding" label="Back to Lens Selection" />
        </div>

        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
            <Sparkles className="h-3.5 w-3.5" />
            Step 2 of 2: Enterprise / Organization Profile
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Setup Your Company / Organization Profile
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            Configure your enterprise workspace for multi-seat hiring, organizational KYB verification, and aggregate talent management.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-700/80">
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-medium flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Organization / Company Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Organization / Company Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex Global Technologies Corp."
                  className="block w-full pl-11 pr-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all min-h-[44px]"
                />
              </div>
            </div>

            {/* Industry / Sector & Company Size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Industry / Sector <span className="text-rose-500">*</span>
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="block w-full px-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px]"
                >
                  {INDUSTRY_OPTIONS.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Company / Team Size <span className="text-rose-500">*</span>
                </label>
                <select
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  className="block w-full px-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px]"
                >
                  {COMPANY_SIZE_OPTIONS.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description / Overview */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Company Description & Overview <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                maxLength={1000}
                value={companyBio}
                onChange={(e) => setCompanyBio(e.target.value)}
                placeholder="Describe your company's core mission, products, scale, and operational requirements..."
                className="block w-full p-4 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all resize-none"
              />
              <div className="flex justify-between items-center mt-1 text-xs text-slate-400">
                <span>Public organizational profile summary</span>
                <span>{companyBio.length}/1000</span>
              </div>
            </div>

            {/* Location & Website */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>Headquarters Location <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={hqLocation}
                  onChange={(e) => setHqLocation(e.target.value)}
                  placeholder="e.g. San Francisco, CA, United States"
                  className="block w-full px-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span>Corporate Website</span>
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://company.com"
                  className="block w-full px-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px]"
                />
              </div>
            </div>

            {/* Hiring Scale & Team Needs */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Organizational Hiring & Talent Scope
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">
                Select your enterprise workforce requirements and engagement formats.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TEAM_HIRING_NEEDS.map((need) => {
                  const selected = hiringScope.includes(need);
                  return (
                    <button
                      key={need}
                      type="button"
                      onClick={() => toggleHiringScope(need)}
                      className={`p-2.5 rounded-xl text-xs font-semibold text-left border transition-all flex items-center justify-between ${
                        selected
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-200 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{need}</span>
                      {selected && <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Admin Role in Company */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Your Role in Company (Admin Representative)
              </label>
              <input
                type="text"
                value={adminTitle}
                onChange={(e) => setAdminTitle(e.target.value)}
                placeholder="e.g. VP of Engineering | Talent Acquisition Director | COO"
                className="block w-full px-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-8 py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting ? (
                <span>Initializing Enterprise Workspace...</span>
              ) : (
                <>
                  <span>Complete Organization Profile</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
