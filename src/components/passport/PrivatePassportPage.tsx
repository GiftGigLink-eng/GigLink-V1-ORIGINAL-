import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  Award,
  Layers,
  MapPin,
  FileCheck,
  Github,
  Sparkles,
  Info,
  HelpCircle,
  ChevronRight,
  Sliders,
  UserCheck,
  Share2,
  QrCode,
  Edit3,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { calculateTrustScore } from '../../lib/trustScore';
import { TrustScoreBreakdownModal } from './TrustScoreBreakdownModal';
import { IdentityVerificationModal } from './IdentityVerificationModal';
import { AddProjectProofModal } from './AddProjectProofModal';
import { SharePassportModal } from './SharePassportModal';
import { StructuredLocation } from '../../types';

export const PrivatePassportPage: React.FC = () => {
  const {
    user,
    profile,
    passport,
    activePersona,
    updatePassportVisibility,
    submitIdentityVerification,
    addProjectProof,
    deleteProjectProof,
  } = useAuth();
  const navigate = useNavigate();

  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  const trustBreakdown = calculateTrustScore(passport, profile, Boolean(user?.emailVerified));

  const isPublic = passport?.isPublic ?? false;
  const publicUrl = `${window.location.origin}/p/${user?.uid}`;

  const workspaceRoute = activePersona === 'client'
    ? '/client/dashboard'
    : activePersona === 'organization_admin'
      ? '/org/dashboard'
      : '/talent/dashboard';

  const handleToggleVisibility = async () => {
    if (!user) return;
    setUpdatingVisibility(true);
    try {
      await updatePassportVisibility(!isPublic);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingVisibility(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Link to={workspaceRoute} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              {activePersona === 'client' ? 'Client Workspace' : activePersona === 'organization_admin' ? 'Organization Workspace' : 'Talent Workspace'}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-bold text-slate-800 dark:text-white">Private Trust Passport</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Link
              to={workspaceRoute}
              className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 min-h-[44px] flex items-center transition-colors"
            >
              Workspace
            </Link>
          </div>
        </div>

        {/* 1. Header Profile & Dual Score Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            
            {/* User Bio & Details */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 dark:bg-indigo-500 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-md">
                {profile?.displayName
                  ? profile.displayName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'GP'}
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    {profile?.displayName || 'GigLink Professional'}
                  </h1>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                    {activePersona ? activePersona.replace('_', ' ') : 'Member'}
                  </span>
                  {passport?.identityVerified ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Identity Verified</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      Unverified Identity
                    </span>
                  )}
                </div>

                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {passport?.headline || 'Professional on GigLink'}
                </p>

                {/* Self-Declared Location Chip */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {passport?.structuredLocation?.formattedAddress ||
                        passport?.location ||
                        'Location not specified'}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/50 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                    <Info className="w-3 h-3" />
                    <span>Self-Declared (Unverified Location)</span>
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed pt-1">
                  {passport?.bio ||
                    'Developing technical competencies, completing verified project milestones, and attesting credentials on GigLink.'}
                </p>

                {/* Direct Link to Canonical Profile */}
                <div className="pt-2">
                  <Link
                    id="edit-profile-hub-link"
                    to="/profile"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Edit Profile & Identity Details</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Score Badges Card */}
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
              
              {/* Trust Score Metric */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl min-w-[200px]">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold uppercase tracking-wider">Earned Trust Score</span>
                  <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {trustBreakdown.totalScore}
                  </span>
                  <span className="text-xs text-slate-400">/ 100 pts</span>
                  <span className={`ml-auto px-2 py-0.5 text-[10px] font-bold rounded-md border ${trustBreakdown.tierColor}`}>
                    {trustBreakdown.tier}
                  </span>
                </div>
                <button
                  id="view-score-audit-btn"
                  onClick={() => setShowBreakdownModal(true)}
                  className="w-full mt-3 text-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center justify-center gap-1 transition-colors"
                >
                  <span>Audit Point Breakdown</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Profile Completeness Metric */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl min-w-[200px]">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold uppercase tracking-wider">Profile Completeness</span>
                  <Layers className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {trustBreakdown.profileCompletenessPercentage}%
                  </span>
                  <span className="text-[10px] text-slate-400">Form Inputs</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300"
                    style={{ width: `${trustBreakdown.profileCompletenessPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Public Visibility & Shareable Link Control */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isPublic ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                  {isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Public Passport Visibility Control
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isPublic 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                    : passport
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {isPublic ? 'PUBLIC (PUBLISHED)' : passport ? 'PRIVATE' : 'UNPUBLISHED'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isPublic
                  ? 'Your sanitized public passport is currently published and viewable by clients, recruiters, and counterparties via your public link.'
                  : passport
                    ? 'Your public passport is currently set to Private Visibility. External counterparties navigating to your public link will see a private notice while you maintain full private access.'
                    : 'Your passport has not been initialized or published yet. You can complete your profile below to start building your earned Trust Score.'}
              </p>
            </div>

            {/* Visibility Toggle Switch */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                id="toggle-passport-visibility-btn"
                onClick={handleToggleVisibility}
                disabled={updatingVisibility}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                  isPublic
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300'
                }`}
              >
                {isPublic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{isPublic ? 'Enabled: Public' : 'Disabled: Private'}</span>
              </button>
            </div>
          </div>

          {/* Shareable Link Bar */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-300 truncate">
              <span className="text-slate-400">Public URL:</span>
              <span className="truncate">{publicUrl}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                id="open-share-passport-modal-btn"
                onClick={() => setShowShareModal(true)}
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share & Embed</span>
              </button>

              <button
                id="copy-public-link-btn"
                onClick={handleCopyLink}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </button>

              <Link
                id="preview-public-passport-link"
                to={`/p/${user?.uid}`}
                target="_blank"
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
              >
                <span>Preview Public View</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 3. Official Identity Verification Banner */}
        <div className={`p-6 rounded-2xl border ${
          passport?.identityVerified
            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        } shadow-xs`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl ${
                passport?.identityVerified
                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300'
                  : 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400'
              }`}>
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {passport?.identityVerified
                      ? 'Government-Issued Identity Verified'
                      : 'Step 1: Verify Your Official Identity (+40 Points)'}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                  {passport?.identityVerified
                    ? 'Your official identification has been reviewed and verified against official registries. +40 trust points are permanently stamped.'
                    : 'Submit your National Identity Number (NIN), International Passport, or Driver’s License for administrative review to instantly unlock +40 Trust Score points.'}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              {!passport?.identityVerified && (
                <button
                  id="open-verify-identity-modal-btn"
                  onClick={() => setShowIdentityModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Start Verification</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4. Verified Proof of Work & Deliverables */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Verifiable Proof of Work & Projects
                </h3>
                <span className="text-xs text-slate-400">
                  (+10 pts per deliverable, max 30 pts)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Showcase deliverables with active repository links or client milestone confirmations.
              </p>
            </div>

            <button
              id="open-add-project-modal-btn"
              onClick={() => setShowProjectModal(true)}
              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-semibold hover:bg-indigo-100 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Proof</span>
            </button>
          </div>

          {passport?.projects && passport.projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {passport.projects.map((project) => (
                <div
                  key={project.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {project.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {project.role} • {project.completedAt}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified Proof (+10 pts)</span>
                      </span>
                      <button
                        onClick={() => deleteProjectProof(project.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {project.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(project.skillsUsed || []).map((skill, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-medium px-2 py-0.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-md"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-xs">
                    {project.repositoryUrl && (
                      <a
                        href={project.repositoryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Github className="w-3.5 h-3.5" />
                        <span>Repository</span>
                      </a>
                    )}
                    {project.projectUrl && (
                      <a
                        href={project.projectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Live Demo</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <FileCheck className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                No Verifiable Deliverables Added Yet
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Add GitHub repositories or live project deliverables to earn +10 Trust Score points each.
              </p>
            </div>
          )}
        </div>

        {/* 5. Skills & Attestations */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Skills & Technical Competencies
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Self-declared skills are shown for discovery. Verified skills earn +5 trust points each.
              </p>
            </div>

            <Link
              id="manage-skills-link"
              to="/profile"
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Manage Skills</span>
            </Link>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {(passport?.skills || []).map((skill) => (
              <div
                key={skill.id}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex items-center gap-2 text-xs"
              >
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {skill.name}
                </span>
                <span className="text-[10px] text-slate-400 px-1.5 py-0.2 bg-white dark:bg-slate-700 rounded capitalize">
                  {skill.proficiency}
                </span>
                {skill.verifiedCount && skill.verifiedCount > 0 ? (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                    Verified
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">
                    Self-Declared
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Modals & Drawers */}
      <TrustScoreBreakdownModal
        isOpen={showBreakdownModal}
        onClose={() => setShowBreakdownModal(false)}
        breakdown={trustBreakdown}
      />

      <IdentityVerificationModal
        isOpen={showIdentityModal}
        onClose={() => setShowIdentityModal(false)}
        onSubmit={submitIdentityVerification}
        userDisplayName={profile?.displayName || 'Applicant'}
      />

      <AddProjectProofModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        onSubmit={addProjectProof}
      />

      <SharePassportModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        uid={user?.uid || ''}
        passport={passport}
        displayName={profile?.displayName || 'GigLink Member'}
        trustTier={trustBreakdown.tier}
        trustScore={trustBreakdown.totalScore}
        isOwner={true}
        isPublic={isPublic}
        onToggleVisibility={handleToggleVisibility}
      />
    </div>
  );
};
