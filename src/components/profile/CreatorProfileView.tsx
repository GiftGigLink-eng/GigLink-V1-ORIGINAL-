import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Plus,
  Shield,
  Star,
  Users,
  MapPin,
  Globe,
  Twitter,
  Linkedin,
  Clock,
  ArrowRight,
  Sparkles,
  Award,
  Layers,
  FileText,
  DollarSign,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Opportunity, OrganizationProfile } from '../../types';
import { getMyPostedOpportunities } from '../../lib/opportunityService';
import { getOrganization } from '../../lib/organizationService';

interface CreatorProfileViewProps {
  onEditProfile: () => void;
}

export const CreatorProfileView: React.FC<CreatorProfileViewProps> = ({ onEditProfile }) => {
  const { user, profile, unifiedProfile } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [organization, setOrganization] = useState<OrganizationProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const loadCreatorData = async () => {
      setLoading(true);
      try {
        const opps = await getMyPostedOpportunities(user.uid);
        setOpportunities(opps);

        if (profile?.organizationId) {
          const org = await getOrganization(profile.organizationId);
          setOrganization(org);
        }
      } catch (err) {
        console.error('Error loading creator profile records:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCreatorData();
  }, [user, profile?.organizationId]);

  const activeCount = opportunities.filter((o) => o.status === 'open').length;
  const inProgressCount = opportunities.filter((o) => o.status === 'in_progress').length;
  const closedCount = opportunities.filter((o) => o.status === 'closed').length;

  return (
    <div id="creator-profile-view" className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Creator Brand & Studio Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 flex-1">
            {/* Avatar / Logo */}
            <div className="relative shrink-0">
              {profile?.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-md"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-amber-600 dark:bg-amber-500 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-md">
                  {profile?.displayName
                    ? profile.displayName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'CL'}
                </div>
              )}

              <div
                title="Verified Client Identity"
                className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-1 rounded-lg shadow-sm border-2 border-white dark:border-slate-900"
              >
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {profile?.displayName || 'Creative Producer / Client'}
                </h1>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>Verified Client & Studio</span>
                </span>
              </div>

              <p className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">
                {profile?.headline || 'Studio Lead & Hiring Producer'}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {profile?.location && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{profile.location}</span>
                  </div>
                )}

                {/* Organization Affiliation Badge */}
                {organization && (
                  <Link
                    to={`/org/${organization.id}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 transition-colors"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Affiliated with {organization.name}</span>
                    {organization.verifiedStatus && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    )}
                  </Link>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  onClick={onEditProfile}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Edit Studio Profile
                </button>

                <Link
                  to={`/p/${user?.uid}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold rounded-xl border border-indigo-200 dark:border-indigo-800/60 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Public View</span>
                </Link>

                <Link
                  to="/opportunities/create"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Post Opportunity</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Hiring Trust & Credibility Metrics */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3 shrink-0 sm:w-64">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold uppercase tracking-wider">Client Trust Track Record</span>
              <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <p className="text-xl font-black text-slate-900 dark:text-white">{opportunities.length}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Total Posted</p>
              </div>
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{activeCount}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Open Gigs</p>
              </div>
            </div>

            <div className="pt-1 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Verified Payment Method & Escrow Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Studio Bio / Hiring Overview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>About Our Studio / Hiring Focus</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
          {profile?.bio ||
            'We collaborate with verified elite engineering, creative, and technical talent to build high-impact production deliverables.'}
        </p>
      </div>

      {/* 3. Posted Opportunities & Active Hiring */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Studio Opportunities ({opportunities.length})
            </h2>
          </div>

          <Link
            to="/creator/opportunities"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <span>Manage All Listings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {opportunities.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You have not posted any opportunities yet.
            </p>
            <Link
              to="/opportunities/create"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Your First Listing</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {opportunities.slice(0, 4).map((opp) => (
              <div
                key={opp.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        opp.status === 'open'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : opp.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opp.status}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {opp.currency || 'USD'} {opp.compensationMin || opp.compensationMax || 'Competitive'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white pt-2 line-clamp-1">
                    {opp.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 pt-0.5">
                    {opp.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-400 text-[10px] capitalize">
                    {opp.type} • {opp.locationType}
                  </span>
                  <Link
                    to={`/opportunities/${opp.id}/applications`}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <span>View Applicants</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Studio Links */}
      {unifiedProfile?.socialLinks &&
        Object.values(unifiedProfile.socialLinks).some(Boolean) && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Studio & Organization Links
            </h2>
            <div className="flex flex-wrap gap-3">
              {unifiedProfile.socialLinks.portfolio && (
                <a
                  href={unifiedProfile.socialLinks.portfolio}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 hover:bg-slate-200 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Studio Website</span>
                </a>
              )}
              {unifiedProfile.socialLinks.linkedin && (
                <a
                  href={unifiedProfile.socialLinks.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 hover:bg-slate-200 transition-colors"
                >
                  <Linkedin className="w-3.5 h-3.5 text-blue-600" />
                  <span>LinkedIn</span>
                </a>
              )}
              {unifiedProfile.socialLinks.twitter && (
                <a
                  href={unifiedProfile.socialLinks.twitter}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 hover:bg-slate-200 transition-colors"
                >
                  <Twitter className="w-3.5 h-3.5 text-sky-500" />
                  <span>Twitter / X</span>
                </a>
              )}
            </div>
          </div>
        )}
    </div>
  );
};
