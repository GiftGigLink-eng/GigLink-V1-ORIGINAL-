import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Building, Globe, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, Award, FileText, User } from 'lucide-react';
import { useAuth, getAuthErrorMessage } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ROLE_DEFINITIONS } from '../../types';
import { BackNavButton } from '../layout/BackNavButton';

const INSTITUTION_TYPE_OPTIONS = [
  'University / College',
  'Vocational / Technical Institute',
  'Coding Academy / Bootcamp',
  'Accreditation Body',
  'Industry Standards Authority',
  'Government / Public Training Entity',
];

const ISSUED_CREDENTIAL_TYPES = [
  'Course Certificates & Diplomas',
  'Degree Programs',
  'Skill Competency Badges',
  'Professional Licensing Credentials',
  'Cryptographic Work Endorsements',
];

export const InstitutionOnboardingPage: React.FC = () => {
  const { profile, activeRole, completeOrganizationOnboarding } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [institutionName, setInstitutionName] = useState('');
  const [institutionType, setInstitutionType] = useState(INSTITUTION_TYPE_OPTIONS[0]);
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [officialEmailDomain, setOfficialEmailDomain] = useState('');
  const [accreditationDetails, setAccreditationDetails] = useState('');
  const [credentialTypes, setCredentialTypes] = useState<string[]>([]);
  const [adminOfficialRole, setAdminOfficialRole] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const homeRoute = ROLE_DEFINITIONS[activeRole]?.homeRoute || '/admin/dashboard';

  if (profile && profile.onboardingCompleted === true) {
    return <Navigate to={homeRoute} replace />;
  }

  const toggleCredentialType = (type: string) => {
    if (credentialTypes.includes(type)) {
      setCredentialTypes(credentialTypes.filter((t) => t !== type));
    } else {
      setCredentialTypes([...credentialTypes, type]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionName.trim()) {
      setErrorMessage('Please enter your institution name.');
      return;
    }
    if (!description.trim()) {
      setErrorMessage('Please enter an institutional overview or description.');
      return;
    }
    if (!adminOfficialRole.trim()) {
      setErrorMessage('Please enter your administrative or verifier title.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await completeOrganizationOnboarding({
        persona: 'admin',
        orgName: institutionName.trim(),
        orgType: 'institution',
        description: description.trim(),
        website: website.trim() || undefined,
        institutionType,
        officialEmailDomain: officialEmailDomain.trim() || undefined,
        accreditationDetails: accreditationDetails.trim() || undefined,
        issuedCredentialTypes: credentialTypes,
        adminTitle: adminOfficialRole.trim(),
      });

      addToast('Institution and Verification Hub profile initialized!', 'success');
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300">
            <Sparkles className="h-3.5 w-3.5" />
            Step 2 of 2: Institution & Verifier Profile
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Setup Your Institution Profile
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            Establish your verifiable institutional identity for issuing certificates, conducting KYC audits, and protocol verifications.
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
            {/* Institution Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Institution / Verifier Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="e.g. Stanford Center for Professional Development"
                  className="block w-full pl-11 pr-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm transition-all min-h-[44px]"
                />
              </div>
            </div>

            {/* Institution Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Institution Classification / Entity Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={institutionType}
                onChange={(e) => setInstitutionType(e.target.value)}
                className="block w-full px-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-sm min-h-[44px]"
              >
                {INSTITUTION_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Description / Overview */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Institution Overview & Mission <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your educational programs, accreditation standards, and institutional verification focus..."
                className="block w-full p-4 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm transition-all resize-none"
              />
              <div className="flex justify-between items-center mt-1 text-xs text-slate-400">
                <span>Public institutional profile summary</span>
                <span>{description.length}/1000</span>
              </div>
            </div>

            {/* Website & Official Domain */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span>Official Website</span>
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://institution.edu"
                  className="block w-full px-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-sm min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Institutional Email Domain
                </label>
                <input
                  type="text"
                  value={officialEmailDomain}
                  onChange={(e) => setOfficialEmailDomain(e.target.value)}
                  placeholder="e.g. stanford.edu"
                  className="block w-full px-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-sm min-h-[44px]"
                />
              </div>
            </div>

            {/* Accreditation Details */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Accreditation & Regulatory Authority (Optional)</span>
              </label>
              <input
                type="text"
                value={accreditationDetails}
                onChange={(e) => setAccreditationDetails(e.target.value)}
                placeholder="e.g. Accredited by WASC Senior College and University Commission"
                className="block w-full px-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-sm min-h-[44px]"
              />
            </div>

            {/* Issued Credential Types */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Issued Credential & Verification Formats
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">
                Select the types of certifications or credentials your institution issues on GigLink.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ISSUED_CREDENTIAL_TYPES.map((type) => {
                  const selected = credentialTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleCredentialType(type)}
                      className={`p-2.5 rounded-xl text-xs font-semibold text-left border transition-all flex items-center justify-between ${
                        selected
                          ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-400 dark:border-purple-600 text-purple-900 dark:text-purple-200 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{type}</span>
                      {selected && <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Admin Verifier Title */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Your Official Role / Title <span className="text-rose-500">*</span>
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  required
                  value={adminOfficialRole}
                  onChange={(e) => setAdminOfficialRole(e.target.value)}
                  placeholder="e.g. Dean of Credentials | Lead Verifier | Program Director"
                  className="block w-full pl-11 pr-4 py-3 text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-sm min-h-[44px]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-8 py-3.5 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting ? (
                <span>Initializing Institutional Verifier Hub...</span>
              ) : (
                <>
                  <span>Complete Institution Profile</span>
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
