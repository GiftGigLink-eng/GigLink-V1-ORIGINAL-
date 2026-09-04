import React from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  CheckCircle2,
  MapPin,
  Edit3,
  Eye,
  Layers,
  Sparkles,
  ExternalLink,
  GraduationCap,
  Briefcase,
  Compass,
  Building2,
  Award,
} from 'lucide-react';
import { UnifiedProfileData, UserPersona } from '../../types';

interface ProfileHeaderProps {
  profileData: UnifiedProfileData;
  onOpenEditModal: () => void;
  onOpenBreakdownModal?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profileData,
  onOpenEditModal,
  onOpenBreakdownModal,
}) => {
  const getPersonaBadge = (persona: UserPersona) => {
    switch (persona) {
      case 'learner':
        return {
          label: 'Learner',
          icon: <GraduationCap className="w-3.5 h-3.5" />,
          color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        };
      case 'partner':
        return {
          label: 'Partner',
          icon: <Briefcase className="w-3.5 h-3.5" />,
          color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        };
      case 'client':
        return {
          label: 'Client',
          icon: <Compass className="w-3.5 h-3.5" />,
          color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        };
      case 'organization_admin':
        return {
          label: 'Organization Admin',
          icon: <Building2 className="w-3.5 h-3.5" />,
          color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        };
      default:
        return {
          label: 'Member',
          icon: null,
          color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        };
    }
  };

  const personaConfig = getPersonaBadge(profileData.activePersona);

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'elite':
        return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800';
      case 'established':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800';
      case 'emerging':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  return (
    <div
      id="profile-header-card"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        {/* Left: Avatar & Identity Details */}
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 flex-1">
          {/* Avatar Container */}
          <div className="relative shrink-0">
            {profileData.photoURL ? (
              <img
                src={profileData.photoURL}
                alt={profileData.displayName}
                referrerPolicy="no-referrer"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-md"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-indigo-600 dark:bg-indigo-500 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-md">
                {profileData.displayName
                  ? profileData.displayName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'GP'}
              </div>
            )}

            {/* Verified Identity Badge Floating Indicator */}
            {profileData.identityVerified && (
              <div
                title="Identity Verified by GigLink"
                className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-lg shadow-sm border-2 border-white dark:border-slate-900"
              >
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Core Info */}
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {profileData.displayName}
              </h1>

              {/* Persona Lens Badge */}
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${personaConfig.color}`}
              >
                {personaConfig.icon}
                <span>{personaConfig.label}</span>
              </span>

              {/* Identity Verification Status */}
              {profileData.identityVerified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Identity Verified</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  <span>Unverified Identity</span>
                </span>
              )}
            </div>

            {/* Professional Headline */}
            <p className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">
              {profileData.headline || 'Professional on GigLink'}
            </p>

            {/* Structured Location */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{profileData.location || 'Location not specified'}</span>
              </div>

              {profileData.isPublic ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <Eye className="w-3 h-3" />
                  <span>Public Profile</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  <span>Private Profile</span>
                </span>
              )}

              {profileData.organizationId && (
                <Link
                  to={`/org/${profileData.organizationId}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-900/50 text-[11px] font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors"
                >
                  <Building2 className="w-3 h-3" />
                  <span>View Organization</span>
                </Link>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <button
                id="edit-profile-main-btn"
                onClick={onOpenEditModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>

              <Link
                id="preview-public-profile-btn"
                to="/profile/preview"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Preview Public View</span>
              </Link>

              <Link
                id="view-trust-passport-link"
                to="/passport"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold rounded-xl border border-indigo-200 dark:border-indigo-800/60 transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Trust Passport</span>
              </Link>

              <Link
                id="view-verifiable-transcript-link"
                to="/talent/credentials"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <Award className="w-3.5 h-3.5 text-indigo-500" />
                <span>Work Transcript</span>
              </Link>

              {profileData.organizationId && (
                <Link
                  id="org-manage-link"
                  to={`/org/${profileData.organizationId}/edit`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-xs font-semibold rounded-xl border border-purple-200 dark:border-purple-800/60 transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Manage Org</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Right: Dual Trust & Completeness Metrics */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 lg:w-64">
          {/* 1. Earned Trust Score Metric */}
          <div
            onClick={onOpenBreakdownModal}
            className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            title="Click to view full Trust Score breakdown"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold uppercase tracking-wider">Earned Trust Score</span>
              <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                {profileData.trustScore}
              </span>
              <span className="text-xs text-slate-400">/ 100 pts</span>
              <span
                className={`ml-auto px-2 py-0.5 text-[10px] font-bold rounded-md border ${getTierColor(
                  profileData.trustTier
                )}`}
              >
                {profileData.trustTier}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Verified identity, proof of work & credentials.
            </p>
          </div>

          {/* 2. Form Completeness Score Metric */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold uppercase tracking-wider">Profile Completeness</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {profileData.profileCompleteness}%
              </span>
              <span className="text-[11px] text-slate-400">Form Fields</span>
            </div>

            {/* Completeness Bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-300"
                style={{ width: `${profileData.profileCompleteness}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Completing profile forms does not inflate Trust Score.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
