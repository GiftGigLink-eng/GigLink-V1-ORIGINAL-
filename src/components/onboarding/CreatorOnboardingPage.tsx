import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { User, Sparkles, Globe, ArrowRight } from 'lucide-react';
import { useAuth, getAuthErrorMessage } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StructuredLocation, ROLE_DEFINITIONS } from '../../types';
import { BackNavButton } from '../layout/BackNavButton';
import { HierarchicalLocationSelector } from '../common/HierarchicalLocationSelector';
import { MultiSelectDropdown } from '../common/MultiSelectDropdown';

export const PRESET_HIRING_INTERESTS = [
  'Full-Stack Web Apps',
  'Mobile Development',
  'UI/UX Design & Branding',
  'Backend & Distributed Systems',
  'Smart Contracts & Blockchain',
  'AI / Machine Learning Integration',
  'DevOps & Cloud Infrastructure',
  'Technical Writing & Docs',
  'Security & Code Auditing',
];

export const PRESET_TALENT_TYPES = [
  'Independent Contractors',
  'Specialist Freelancers',
  'Apprentices & Emerging Talent',
  'Senior Technical Leads',
  'Boutique Dev Teams',
];

export const HIRING_INTEREST_OPTIONS = PRESET_HIRING_INTERESTS;
export const TALENT_TYPE_OPTIONS = PRESET_TALENT_TYPES;

export const CreatorOnboardingPage: React.FC = () => {
  const { user, profile, activeRole, completeIndividualOnboarding } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || '');
  const [roleTitle, setRoleTitle] = useState('');
  const [bio, setBio] = useState('');
  const [structuredLocation, setStructuredLocation] = useState<StructuredLocation | null>(null);
  const [selectedHiringInterests, setSelectedHiringInterests] = useState<string[]>([]);
  const [selectedTalentTypes, setSelectedTalentTypes] = useState<string[]>([]);
  const [website, setWebsite] = useState('');
  const [customHiringNeed, setCustomHiringNeed] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const homeRoute = ROLE_DEFINITIONS[activeRole]?.homeRoute || '/creator/dashboard';

  if (profile && profile.onboardingCompleted === true) {
    return <Navigate to={homeRoute} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorMessage('Please enter your full client name or hiring identity.');
      return;
    }
    if (!roleTitle.trim()) {
      setErrorMessage('Please enter your professional role or hiring title.');
      return;
    }
    if (!bio.trim()) {
      setErrorMessage('Please enter a short bio or description of your studio / hiring scope.');
      return;
    }
    if (!structuredLocation || !structuredLocation.country || !structuredLocation.state) {
      setErrorMessage('Please select your Country and State/Region.');
      return;
    }
    if (selectedHiringInterests.length === 0) {
      setErrorMessage('Please select at least one hiring interest / project area.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await completeIndividualOnboarding({
        persona: 'client',
        displayName: displayName.trim(),
        headline: roleTitle.trim(),
        bio: bio.trim(),
        location: structuredLocation.formattedAddress,
        structuredLocation,
        portfolioUrl: website.trim() || undefined,
        hiringInterests: selectedHiringInterests,
        talentTypes: selectedTalentTypes,
        customHiringNeed: customHiringNeed.trim() || undefined,
        publishHiringFocus: false,
      });

      addToast('Creator / Client profile created successfully! Welcome to your Hiring Hub.', 'success');
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            Step 2 of 2: Individual Client Profile
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Setup Your Creator / Client Profile
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            Establish your client identity, hiring preferences, and project requirements. Post listings and review verified proposals.
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
            {/* Full Name / Hiring Identity */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name / Client Identity <span className="text-rose-500">*</span>
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Jordan Vance (or Vance Creative)"
                  className="block w-full pl-11 pr-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all min-h-[44px]"
                />
              </div>
            </div>

            {/* Professional Role / Title */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Professional Role / Hiring Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={160}
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Product Producer | Design Director | Startup Founder"
                className="block w-full px-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all min-h-[44px]"
              />
              <div className="flex justify-between items-center mt-1 text-xs text-slate-400">
                <span>Your title shown to talent when reviewing opportunities</span>
                <span>{roleTitle.length}/160</span>
              </div>
            </div>

            {/* Bio / About the Client */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                About the Client / Hiring Overview <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                maxLength={1000}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your studio, business, products you build, and your approach to working with talent..."
                className="block w-full p-4 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all resize-none"
              />
              <div className="flex justify-between items-center mt-1 text-xs text-slate-400">
                <span>Provides context to talent when submitting proposals</span>
                <span>{bio.length}/1000</span>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Client Location <span className="text-rose-500">*</span>
              </label>
              <HierarchicalLocationSelector
                value={structuredLocation}
                onChange={setStructuredLocation}
                required
              />
            </div>

            {/* Hiring Interests / Project Areas */}
            <MultiSelectDropdown
              id="client-hiring-interests"
              label="Hiring Interests & Project Domains"
              required
              helperText="Select the project areas where you frequently hire or need expertise."
              options={HIRING_INTEREST_OPTIONS}
              selected={selectedHiringInterests}
              onChange={setSelectedHiringInterests}
              placeholder="Select project domains and hiring interests..."
            />

            {/* Types of Talent / Projects */}
            <MultiSelectDropdown
              id="client-talent-types"
              label="Types of Talent You Work With"
              helperText="Indicate the engagement models and talent tiers you prefer."
              options={TALENT_TYPE_OPTIONS}
              selected={selectedTalentTypes}
              onChange={setSelectedTalentTypes}
              placeholder="Select talent engagement models..."
            />

            {/* Client Website / Studio URL */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>Studio / Client Website (Optional)</span>
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourstudio.com"
                  className="block w-full px-3 py-2 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Upcoming Project Need or Focus (Optional)
                </label>
                <input
                  type="text"
                  value={customHiringNeed}
                  onChange={(e) => setCustomHiringNeed(e.target.value)}
                  placeholder="e.g. Seeking senior React engineer for 4-week milestone contract"
                  className="block w-full px-3 py-2 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-8 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting ? (
                <span>Initializing Client Hub...</span>
              ) : (
                <>
                  <span>Complete Client Profile</span>
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
