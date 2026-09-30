import React, { useEffect, useState } from 'react';
import { useParams, Link, Navigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { PublicTrustPassport, OrganizationProfile, ProjectProof, normalizeCanonicalPersona } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ProjectsSection } from './ProjectsSection';
import { AvailabilitySection } from './AvailabilitySection';
import { ServicesSection } from './ServicesSection';
import { PotentialTrajectoryCard } from './PotentialTrajectoryCard';
import { ClientHiringFocusSection } from './ClientHiringFocusSection';
import { ClientOpportunitiesSection } from './ClientOpportunitiesSection';
import { SharePassportModal } from '../passport/SharePassportModal';
import { TrustScoreBreakdownModal } from '../passport/TrustScoreBreakdownModal';
import { MediaLightboxModal } from './MediaLightboxModal';
import { getOrganization } from '../../lib/organizationService';
import { calculateTrustScore } from '../../lib/trustScore';
import {
  Shield,
  CheckCircle2,
  Lock,
  MapPin,
  FileCheck,
  Github,
  ExternalLink,
  Award,
  ArrowLeft,
  Loader2,
  Share2,
  Check,
  Briefcase,
  GraduationCap,
  Globe,
  Building2,
  Info,
  QrCode,
  Sparkles,
  Layers,
  Star,
  Eye,
} from 'lucide-react';

interface PublicProfilePageProps {
  initialTab?: 'overview' | 'projects' | 'passport' | 'organization';
  previewMode?: boolean;
}

export const PublicProfilePage: React.FC<PublicProfilePageProps> = ({
  initialTab = 'overview',
  previewMode = false,
}) => {
  const { uid: routeUid } = useParams<{ uid: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();

  const uid = routeUid || (previewMode ? user?.uid : undefined);

  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'passport' | 'organization'>(
    (searchParams.get('tab') as any) || initialTab
  );

  const [publicProfile, setPublicProfile] = useState<PublicTrustPassport | null>(null);
  const [organization, setOrganization] = useState<OrganizationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Modals
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxTitle, setLightboxTitle] = useState('');
  const [showLightbox, setShowLightbox] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [publicProfile?.photoURL]);

  // Incomplete onboarding isolation
  if (user && profile && profile.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }

  useEffect(() => {
    if (!uid) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const fetchPublicData = async () => {
      setLoading(true);
      try {
        // Strictly read from isolated publicTrustPassports projection
        const publicPassportRef = doc(db, 'publicTrustPassports', uid);
        const passportSnap = await getDoc(publicPassportRef);

        if (!passportSnap.exists()) {
          setNotFound(true);
          setPublicProfile(null);
        } else {
          const data = passportSnap.data() as PublicTrustPassport;
          setPublicProfile(data);
          setNotFound(false);

          if (data.organizationId) {
            const org = await getOrganization(data.organizationId);
            setOrganization(org);
          }
        }
      } catch (err) {
        console.error('Error fetching public profile:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicData();
  }, [uid]);

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleTabChange = (tab: 'overview' | 'projects' | 'passport' | 'organization') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

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

  const openMediaLightbox = (images: string[], index = 0, title = '') => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxTitle(title);
    setShowLightbox(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Resolving verified public identity...
        </p>
      </div>
    );
  }

  if (notFound || !publicProfile) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-sm animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Private or Inactive Profile
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This profile is currently set to <strong className="font-semibold text-slate-800 dark:text-slate-200">Private Visibility</strong> or has not been published yet by its owner.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Explore Public Marketplace</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const verifiedSkills = (publicProfile.skills || []).filter((s) => (s.verifiedCount || 0) > 0);
  const verifiedProjects = (publicProfile.projects || []).filter((p) => p.verificationStatus === 'verified');

  // Authoritative Persona Derivation
  const canonicalPersona = normalizeCanonicalPersona(
    publicProfile.persona || publicProfile.activePersona,
    (publicProfile as any).activeRole
  );
  const isClient = canonicalPersona === 'client';
  const isPartner = canonicalPersona === 'partner';
  const isOrgAdmin = canonicalPersona === 'organization_admin';

  // Fallback to overview tab if projects tab is active for a client with 0 projects
  useEffect(() => {
    if (isClient && (!publicProfile?.projects || publicProfile.projects.length === 0) && activeTab === 'projects') {
      setActiveTab('overview');
    }
  }, [isClient, publicProfile?.projects, activeTab]);

  // Deterministic trust breakdown for modal
  const trustBreakdown = calculateTrustScore(publicProfile, null, true);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Preview Mode Banner */}
        {previewMode && (
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
              <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                <strong className="font-bold">Public Preview Mode:</strong> This is the verified view visible to employers, clients, and partners.
              </span>
            </div>
            <Link
              to="/profile"
              className="px-3 py-2 min-h-[44px] flex items-center bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
            >
              Back to Profile Editor
            </Link>
          </div>
        )}

        {/* Navigation & Public Actions */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 min-h-[44px] px-2 py-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to GigLink</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBreakdownModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Trust Audit</span>
            </button>

            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              <span>{copied ? 'Link Copied' : 'Share Identity & QR'}</span>
            </button>
          </div>
        </div>

        {/* 1. Header Identity Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 flex-1">
              <div className="relative shrink-0">
                {publicProfile.photoURL && !imageError ? (
                  <img
                    src={publicProfile.photoURL}
                    alt={publicProfile.displayName}
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-md"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-indigo-600 dark:bg-indigo-500 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-md">
                    {publicProfile.displayName
                      ? publicProfile.displayName
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : 'GP'}
                  </div>
                )}

                {publicProfile.identityVerified && (
                  <div
                    title="Cryptographically Identity Verified by GigLink"
                    className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-lg shadow-sm border-2 border-white dark:border-slate-900"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {publicProfile.displayName}
                  </h1>

                  {/* Canonical Persona Badge */}
                  {isClient && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      <Briefcase className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Client / Hiring Member</span>
                    </span>
                  )}
                  {isPartner && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>Partner / Studio</span>
                    </span>
                  )}
                  {isOrgAdmin && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      <Building2 className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                      <span>Organization Admin</span>
                    </span>
                  )}

                  {publicProfile.identityVerified && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Official Identity Verified</span>
                    </span>
                  )}
                </div>

                <p className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">
                  {publicProfile.headline || (isClient ? 'Hiring Member on GigLink' : 'Professional on GigLink')}
                </p>

                {/* Location & Organization Affiliation */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {publicProfile.location && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{publicProfile.location}</span>
                    </div>
                  )}

                  {/* Verified Organization Affiliation Badge */}
                  {publicProfile.organizationId && organization && (
                    <Link
                      to={`/org/${publicProfile.organizationId}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 transition-colors"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Verified Affiliate @ {organization.name}</span>
                      {organization.verifiedStatus && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      )}
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Earned Trust Score Metric */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2 shrink-0 sm:w-60">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold uppercase tracking-wider">Earned Trust Score</span>
                <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {publicProfile.trustScore}
                </span>
                <span className="text-xs text-slate-400">/ 100 pts</span>
                <span
                  className={`ml-auto px-2 py-0.5 text-[10px] font-bold rounded-md border ${getTierColor(
                    publicProfile.trustTier
                  )}`}
                >
                  {publicProfile.trustTier}
                </span>
              </div>

              <button
                onClick={() => setShowBreakdownModal(true)}
                className="w-full text-left text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center justify-between pt-1 cursor-pointer"
              >
                <span>View Mathematical Breakdown</span>
                <ArrowLeft className="w-3 h-3 rotate-180" />
              </button>
            </div>
          </div>

          {/* Canonical Modular View Navigation Tabs */}
          <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-4 overflow-x-auto">
            <button
              onClick={() => handleTabChange('overview')}
              className={`px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isClient ? 'Client Profile' : 'Professional Profile'}
            </button>

            {/* Suppress Portfolio & Projects tab for Client if 0 projects */}
            {(!isClient || (publicProfile.projects && publicProfile.projects.length > 0)) && (
              <button
                onClick={() => handleTabChange('projects')}
                className={`px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'projects'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Portfolio & Projects ({publicProfile.projects?.length || 0})</span>
              </button>
            )}

            <button
              onClick={() => handleTabChange('passport')}
              className={`px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'passport'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-indigo-500" />
              <span>Trust Passport & Attestations</span>
            </button>

            {publicProfile.organizationId && organization && (
              <button
                onClick={() => handleTabChange('organization')}
                className={`px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'organization'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-purple-500" />
                <span>Organization ({organization.name})</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. TAB: OVERVIEW & PROFESSIONAL PROFILE */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Bio / About */}
            {publicProfile.bio && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  About
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {publicProfile.bio}
                </p>
              </div>
            )}

            {/* Client / Creator Hiring Focus */}
            {(Boolean(publicProfile.hiringInterests?.length) ||
              Boolean(publicProfile.talentTypes?.length) ||
              Boolean(publicProfile.customHiringNeed)) && (
              <ClientHiringFocusSection
                hiringInterests={publicProfile.hiringInterests}
                talentTypes={publicProfile.talentTypes}
                customHiringNeed={publicProfile.customHiringNeed}
                isEditable={false}
              />
            )}

            {/* Public Read-Only Client Opportunities */}
            {isClient && (
              <ClientOpportunitiesSection
                userId={uid || publicProfile.userId || publicProfile.uid}
                isReadOnly={true}
                emptyMessage="No open opportunities currently posted by this client."
              />
            )}

            {/* Potential Trajectory Card - Only for non-clients */}
            {!isClient && publicProfile.potentialTrajectory && (
              <PotentialTrajectoryCard
                trajectory={publicProfile.potentialTrajectory}
                verifiedProjectsCount={verifiedProjects.length}
                verifiedSkillsCount={verifiedSkills.length}
              />
            )}

            {/* Partner Services Section (if any services are listed) */}
            {publicProfile.partnerServices && publicProfile.partnerServices.length > 0 && (
              <ServicesSection
                services={publicProfile.partnerServices}
                isEditable={false}
              />
            )}

            {/* Availability & Work Preferences (if present and non-client) */}
            {!isClient && publicProfile.availability && (
              <AvailabilitySection
                availability={publicProfile.availability}
                isEditable={false}
              />
            )}

            {/* Verification & Trust Signals Explanation Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Info className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Trust Signals on GigLink
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Verified items</span> are backed by third-party proofs, verifier attestation, or authenticated platforms. <span className="font-semibold text-slate-600 dark:text-slate-300">Self-declared items</span> are provided by the member.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Verified Proof</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  <span>Self-Declared</span>
                </span>
              </div>
            </div>

            {/* Skills */}
            {publicProfile.skills && publicProfile.skills.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Skills & Competencies ({publicProfile.skills.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {publicProfile.skills.map((skill) => (
                    <div
                      key={skill.id || skill.name}
                      className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {skill.name}
                        </p>
                        <p className="text-[10px] text-slate-400 capitalize">
                          {skill.category} • {skill.proficiency}
                        </p>
                      </div>

                      {skill.verifiedCount && skill.verifiedCount > 0 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 border border-emerald-200 dark:border-emerald-900">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Verified ({skill.verifiedCount})</span>
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                          Self-Declared
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {publicProfile.experience && publicProfile.experience.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Experience & Work History ({publicProfile.experience.length})
                  </h3>
                </div>

                <div className="space-y-3">
                  {publicProfile.experience.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.roleTitle}{' '}
                          <span className="text-indigo-600 dark:text-indigo-400">
                            @ {item.organizationName}
                          </span>
                        </h4>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">
                          {item.type}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.startDate} — {item.isCurrent ? 'Present' : item.endDate || 'N/A'}{' '}
                        {item.location && `• ${item.location}`}
                      </p>

                      {item.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {publicProfile.education && publicProfile.education.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Education ({publicProfile.education.length})
                  </h3>
                </div>

                <div className="space-y-3">
                  {publicProfile.education.map((edu) => (
                    <div
                      key={edu.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1"
                    >
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {edu.degree} in {edu.fieldOfStudy}
                      </h4>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        {edu.institutionName} • {edu.startDate} —{' '}
                        {edu.isCurrent ? 'Present' : edu.endDate || 'N/A'}
                      </p>
                      {edu.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">
                          {edu.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {publicProfile.certifications && publicProfile.certifications.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Certifications ({publicProfile.certifications.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {publicProfile.certifications.map((cert) => (
                    <div
                      key={cert.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5"
                    >
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {cert.title}
                      </h4>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        {cert.issuer} • Issued: {cert.issueDate}
                      </p>
                      {cert.credentialUrl && (
                        <a
                          href={cert.credentialUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 pt-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Verify Certificate</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Social Links */}
            {publicProfile.socialLinks &&
              Object.values(publicProfile.socialLinks).some(Boolean) && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Links & Online Presence
                  </h3>

                  <div className="flex flex-wrap gap-3">
                    {publicProfile.socialLinks.portfolio && (
                      <a
                        href={publicProfile.socialLinks.portfolio}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 hover:bg-slate-200 transition-colors"
                      >
                        <Globe className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Portfolio</span>
                      </a>
                    )}
                    {publicProfile.socialLinks.github && (
                      <a
                        href={publicProfile.socialLinks.github}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 hover:bg-slate-200 transition-colors"
                      >
                        <Github className="w-3.5 h-3.5" />
                        <span>GitHub</span>
                      </a>
                    )}
                    {publicProfile.socialLinks.linkedin && (
                      <a
                        href={publicProfile.socialLinks.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 hover:bg-slate-200 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                        <span>LinkedIn</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* 3. TAB: PORTFOLIO & PROJECTS */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            <ProjectsSection
              projects={publicProfile.projects || []}
              readOnly={true}
              profileUid={uid}
            />
          </div>
        )}

        {/* 4. TAB: TRUST PASSPORT & ATTESTATIONS */}
        {activeTab === 'passport' && (
          <div className="space-y-6">
            {/* Trust Passport Overview Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Cryptographic Trust Passport
                  </h2>
                </div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  ID: {uid?.substring(0, 12)}...
                </span>
              </div>

              {/* 4 Pillars Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Pillar 1 (40 pts)</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Official ID</span>
                    {publicProfile.identityVerified ? (
                      <span className="text-xs font-bold text-emerald-600">+40 pts</span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">0 pts</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {publicProfile.identityVerified ? 'Government identity verified' : 'Pending verification'}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Pillar 2 (30 pts)</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Deliverables</span>
                    <span className="text-xs font-bold text-emerald-600">+{trustBreakdown.proofOfWorkPoints} pts</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {verifiedProjects.length} verified project proofs
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Pillar 3 (20 pts)</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Attested Skills</span>
                    <span className="text-xs font-bold text-emerald-600">+{trustBreakdown.skillsPoints} pts</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {verifiedSkills.length} attested competencies
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Pillar 4 (10 pts)</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Profile Hygiene</span>
                    <span className="text-xs font-bold text-emerald-600">+10 pts</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Complete public credentials
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
                <button
                  onClick={() => setShowBreakdownModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Inspect Mathematical Proof
                </button>

                <button
                  onClick={handleShare}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Generate QR Attestation</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. TAB: ORGANIZATION AFFILIATION */}
        {activeTab === 'organization' && organization && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-600 text-white font-black text-xl flex items-center justify-center shadow-md">
                  {organization.logoUrl ? (
                    <img
                      src={organization.logoUrl}
                      alt={organization.name}
                      className="w-full h-full rounded-2xl object-cover"
                    />
                  ) : (
                    organization.name.substring(0, 2).toUpperCase()
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {organization.name}
                    </h2>
                    {organization.verifiedStatus && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified KYB Organization</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 capitalize">{organization.type} Organization</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 pt-1 leading-relaxed">
                    {organization.description}
                  </p>
                </div>
              </div>

              <Link
                to={`/org/${organization.id}`}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
              >
                View Full Company Profile
              </Link>
            </div>
          </div>
        )}

        {/* Cryptographic Trust Footer */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-1 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
            <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Verified via GigLink Trust Protocol</span>
          </div>
          <p className="text-[11px]">
            Zero-knowledge privacy enforced. Private verification documents and internal notes are cryptographically isolated.
          </p>
        </div>
      </div>

      {/* Modals */}
      <SharePassportModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        uid={uid || ''}
        passport={publicProfile}
        isOwner={user?.uid === uid}
        isPublic={true}
      />

      <TrustScoreBreakdownModal
        isOpen={showBreakdownModal}
        onClose={() => setShowBreakdownModal(false)}
        breakdown={trustBreakdown}
      />

      <MediaLightboxModal
        isOpen={showLightbox}
        onClose={() => setShowLightbox(false)}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        title={lightboxTitle}
      />
    </div>
  );
};
