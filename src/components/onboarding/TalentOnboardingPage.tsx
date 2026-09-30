import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { User, Sparkles, Briefcase, FileText, Globe, Github, Linkedin, Twitter, ArrowRight } from 'lucide-react';
import { useAuth, getAuthErrorMessage } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StructuredLocation, ROLE_DEFINITIONS } from '../../types';
import { BackNavButton } from '../layout/BackNavButton';
import { HierarchicalLocationSelector } from '../common/HierarchicalLocationSelector';
import { SearchableSkillSelector } from '../common/SearchableSkillSelector';

export const TalentOnboardingPage: React.FC = () => {
  const { user, profile, activeRole, completeIndividualOnboarding } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || '');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [structuredLocation, setStructuredLocation] = useState<StructuredLocation | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [portfolioProofTitle, setPortfolioProofTitle] = useState('');
  const [portfolioProofUrl, setPortfolioProofUrl] = useState('');
  const [portfolioProofDesc, setPortfolioProofDesc] = useState('');
  const [experienceOrg, setExperienceOrg] = useState('');
  const [experienceRole, setExperienceRole] = useState('');
  const [experienceDesc, setExperienceDesc] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const homeRoute = ROLE_DEFINITIONS[activeRole]?.homeRoute || '/talent/dashboard';

  if (profile && profile.onboardingCompleted === true) {
    return <Navigate to={homeRoute} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorMessage('Please enter your full display name.');
      return;
    }
    if (!headline.trim()) {
      setErrorMessage('Please enter your professional headline.');
      return;
    }
    if (!bio.trim()) {
      setErrorMessage('Please enter your bio / professional summary.');
      return;
    }
    if (!structuredLocation || !structuredLocation.country || !structuredLocation.state) {
      setErrorMessage('Please select your Country and State/Region.');
      return;
    }
    if (skills.length === 0) {
      setErrorMessage('Please select at least one core skill from the catalogue.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await completeIndividualOnboarding({
        persona: 'learner',
        displayName: displayName.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        location: structuredLocation.formattedAddress,
        structuredLocation,
        skills,
        portfolioUrl: portfolioUrl.trim() || undefined,
        githubUrl: githubUrl.trim() || undefined,
        linkedinUrl: linkedinUrl.trim() || undefined,
        twitterUrl: twitterUrl.trim() || undefined,
        initialProjectProof:
          portfolioProofTitle.trim() && portfolioProofDesc.trim()
            ? {
                title: portfolioProofTitle.trim(),
                description: portfolioProofDesc.trim(),
                projectUrl: portfolioProofUrl.trim() || undefined,
                role: headline.trim() || 'Contributor',
                skillsUsed: skills.slice(0, 5),
                completedAt: new Date().toISOString(),
              }
            : undefined,
        initialExperience:
          experienceOrg.trim() && experienceRole.trim()
            ? {
                organizationName: experienceOrg.trim(),
                roleTitle: experienceRole.trim(),
                type: 'employment',
                startDate: new Date().toISOString().slice(0, 7),
                isCurrent: true,
                description: experienceDesc.trim() || 'Professional role',
                skillsUsed: skills.slice(0, 5),
                verificationStatus: 'unverified',
              }
            : undefined,
      });

      addToast('Talent profile setup complete! Welcome to your Trust Passport.', 'success');
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            Step 2 of 2: Individual Professional Profile
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Setup Your Talent Profile
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            Build your verifiable Trust Passport. Showcase your verified skills, portfolio proofs, experience, and professional links.
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
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Display Name <span className="text-rose-500">*</span>
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
                  placeholder="e.g. Alex Rivera"
                  className="block w-full pl-11 pr-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all min-h-[44px]"
                />
              </div>
            </div>

            {/* Professional Headline */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Professional Headline <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={160}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Senior Full-Stack Engineer | React, TypeScript & Node.js"
                className="block w-full px-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all min-h-[44px]"
              />
              <div className="flex justify-between items-center mt-1 text-xs text-slate-400">
                <span>Position your craft and service specialization</span>
                <span>{headline.length}/160</span>
              </div>
            </div>

            {/* Bio / Professional Summary */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Bio / Professional Summary <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                maxLength={1000}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your technical background, domain expertise, notable achievements, and the types of contracts you excel at..."
                className="block w-full p-4 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all resize-none"
              />
              <div className="flex justify-between items-center mt-1 text-xs text-slate-400">
                <span>Detailed summary of your professional capabilities</span>
                <span>{bio.length}/1000</span>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Primary Location <span className="text-rose-500">*</span>
              </label>
              <HierarchicalLocationSelector
                value={structuredLocation}
                onChange={setStructuredLocation}
                required
              />
            </div>

            {/* Skills */}
            <div id="talent-onboarding-skills-section">
              <SearchableSkillSelector
                selectedSkills={skills}
                onChange={setSkills}
                minSkills={1}
                maxSkills={15}
                label="Core Skills & Capabilities"
                description="Select skills from the canonical catalogue. These appear on your Trust Passport."
                placeholder="Search canonical skills catalogue or click arrow to browse..."
                allowCustom={true}
                error={errorMessage && skills.length === 0 ? errorMessage : null}
              />
            </div>

            {/* Portfolio / Project Proof (Optional Initial Proof) */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Featured Portfolio Project Proof (Optional)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Highlight a standout project or deliverable proof to kickstart your Trust Passport portfolio.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Project Title
                  </label>
                  <input
                    type="text"
                    value={portfolioProofTitle}
                    onChange={(e) => setPortfolioProofTitle(e.target.value)}
                    placeholder="e.g. Distributed Ledger Explorer"
                    className="block w-full px-3 py-2 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Live Demo or Repository URL
                  </label>
                  <input
                    type="url"
                    value={portfolioProofUrl}
                    onChange={(e) => setPortfolioProofUrl(e.target.value)}
                    placeholder="https://github.com/example/project"
                    className="block w-full px-3 py-2 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Deliverable Summary & Outcomes
                </label>
                <textarea
                  rows={2}
                  value={portfolioProofDesc}
                  onChange={(e) => setPortfolioProofDesc(e.target.value)}
                  placeholder="Key contributions, architecture decisions, and delivered impact..."
                  className="block w-full p-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl text-xs resize-none"
                />
              </div>
            </div>

            {/* Experience / Background */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Work Experience & Background (Optional)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Add your current or most recent engagement to boost profile completeness.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    value={experienceOrg}
                    onChange={(e) => setExperienceOrg(e.target.value)}
                    placeholder="e.g. Apex Tech Solutions"
                    className="block w-full px-3 py-2 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Role / Position Title
                  </label>
                  <input
                    type="text"
                    value={experienceRole}
                    onChange={(e) => setExperienceRole(e.target.value)}
                    placeholder="e.g. Lead Frontend Architect"
                    className="block w-full px-3 py-2 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Role Summary
                </label>
                <input
                  type="text"
                  value={experienceDesc}
                  onChange={(e) => setExperienceDesc(e.target.value)}
                  placeholder="Brief summary of responsibilities and technologies used"
                  className="block w-full px-3 py-2 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Professional Links & Social Verification */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Professional Links & Social Verification</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Link your external code repositories, portfolio, and professional networks.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>Portfolio Website</span>
                  </label>
                  <input
                    type="url"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="https://yourname.dev"
                    className="block w-full px-3 py-2 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Github className="w-3.5 h-3.5 text-slate-400" />
                    <span>GitHub Profile</span>
                  </label>
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username"
                    className="block w-full px-3 py-2 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Linkedin className="w-3.5 h-3.5 text-slate-400" />
                    <span>LinkedIn Profile</span>
                  </label>
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="block w-full px-3 py-2 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Twitter className="w-3.5 h-3.5 text-slate-400" />
                    <span>X / Twitter</span>
                  </label>
                  <input
                    type="url"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    placeholder="https://x.com/username"
                    className="block w-full px-3 py-2 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-8 py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting ? (
                <span>Initializing Trust Passport...</span>
              ) : (
                <>
                  <span>Complete Talent Profile</span>
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
