import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { GraduationCap, Briefcase, UserCheck, Building, Sparkles, ArrowRight } from 'lucide-react';
import { UserPersona } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface PersonaOption {
  id: UserPersona;
  title: string;
  badge: string;
  icon: React.ReactNode;
  description: string;
  targetWizard: '/onboarding/talent' | '/onboarding/creator' | '/onboarding/enterprise' | '/onboarding/institution';
  color: string;
  hoverBorder: string;
}

const PERSONA_OPTIONS: PersonaOption[] = [
  {
    id: 'learner',
    title: 'Talent Workspace',
    badge: 'Individual Professional Profile',
    icon: <GraduationCap className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />,
    description: 'Build your cryptographic Trust Passport, verify project proofs, list professional skills, and apply for high-trust opportunities.',
    targetWizard: '/onboarding/talent',
    color: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300',
    hoverBorder: 'hover:border-indigo-500 dark:hover:border-indigo-400',
  },
  {
    id: 'partner',
    title: 'Creator Workspace',
    badge: 'Individual Client Profile',
    icon: <Briefcase className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />,
    description: 'Establish your client identity, hiring preferences, post verified listings, evaluate incoming talent proposals, and fund escrow.',
    targetWizard: '/onboarding/creator',
    color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    hoverBorder: 'hover:border-emerald-500 dark:hover:border-emerald-400',
  },
  {
    id: 'client',
    title: 'Enterprise Workspace',
    badge: 'Organization / Company Profile',
    icon: <UserCheck className="h-7 w-7 text-blue-600 dark:text-blue-400" />,
    description: 'Manage corporate talent benches, coordinate team seats, track organizational KYB compliance, and post large-scale enterprise contracts.',
    targetWizard: '/onboarding/enterprise',
    color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
    hoverBorder: 'hover:border-blue-500 dark:hover:border-blue-400',
  },
  {
    id: 'organization_admin',
    title: 'Institution & Admin Workspace',
    badge: 'Institution / Verifier Profile',
    icon: <Building className="h-7 w-7 text-purple-600 dark:text-purple-400" />,
    description: 'Issue verifiable certificates, audit project proofs, adjudicate KYC verification queues, and oversee institutional governance.',
    targetWizard: '/onboarding/institution',
    color: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
    hoverBorder: 'hover:border-purple-500 dark:hover:border-purple-400',
  },
];

export const InitialPersonaSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  if (profile && profile.onboardingCompleted === true) {
    return <Navigate to="/" replace />;
  }

  const handleSelectPersona = (option: PersonaOption) => {
    navigate(option.targetWizard);
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] py-4 sm:py-8 px-2 sm:px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Welcome to GigLink V1
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Select Your Primary Workspace
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Choose where you would like to start your workspace setup today. Each persona has a dedicated, tailored onboarding flow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PERSONA_OPTIONS.map((opt) => (
            <div
              key={opt.id}
              onClick={() => handleSelectPersona(opt)}
              className={`bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-700/80 shadow-lg shadow-slate-200/50 dark:shadow-none cursor-pointer transition-all hover:-translate-y-1 ${opt.hoverBorder} flex flex-col justify-between group min-h-[220px]`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700">
                    {opt.icon}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${opt.color}`}>
                    {opt.badge}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {opt.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white">
                <span>Start Workspace Onboarding</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
