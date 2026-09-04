import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { OrganizationProfile, Opportunity } from '../../types';
import {
  getOrganization,
  getOrganizationOpportunities,
  getOrganizationMembers,
} from '../../lib/organizationService';
import {
  Building2,
  CheckCircle2,
  Globe,
  Users,
  Briefcase,
  Edit3,
  ArrowLeft,
  Loader2,
  Calendar,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';

export const OrganizationProfilePage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuth();
  const [organization, setOrganization] = useState<OrganizationProfile | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [members, setMembers] = useState<
    Array<{ uid: string; displayName: string; photoURL?: string; headline?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!orgId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const loadOrgData = async () => {
      setLoading(true);
      try {
        const orgData = await getOrganization(orgId);
        if (!orgData) {
          setNotFound(true);
        } else {
          setOrganization(orgData);
          setNotFound(false);

          // Load active opportunities & public members in parallel
          const [opps, memberProfiles] = await Promise.all([
            getOrganizationOpportunities(orgId),
            getOrganizationMembers(orgData.memberUserIds || []),
          ]);

          setOpportunities(opps);
          setMembers(memberProfiles);
        }
      } catch (err) {
        console.error('Error loading organization profile:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadOrgData();
  }, [orgId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
          Loading organization profile...
        </p>
      </div>
    );
  }

  if (notFound || !organization) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Organization Not Found
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              The requested organization entity could not be found or has not been registered yet.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/opportunities"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Explore Opportunities</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isCurrentUserAdmin = user && organization.adminUserIds?.includes(user.uid);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Admin Edit Bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/opportunities"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Opportunities</span>
          </Link>

          {isCurrentUserAdmin && (
            <Link
              id="edit-organization-btn"
              to={`/org/${organization.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Manage Organization</span>
            </Link>
          )}
        </div>

        {/* Organization Header Card */}
        <div
          id="organization-header-card"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6"
        >
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 flex-1">
              {/* Organization Logo/Avatar */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-2xl sm:text-3xl shadow-sm shrink-0">
                {organization.name ? (
                  organization.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                ) : (
                  <Building2 className="w-10 h-10" />
                )}
              </div>

              {/* Core Details */}
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {organization.name}
                  </h1>

                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase tracking-wider text-[10px]">
                    <Building2 className="w-3 h-3" />
                    <span>{organization.type}</span>
                  </span>

                  {organization.verifiedStatus ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verified Entity</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      <span>Registered Organization</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Partner since {new Date(organization.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                  </span>
                </p>

                {organization.website && (
                  <a
                    href={organization.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium pt-1"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{organization.website.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex sm:flex-col gap-3 shrink-0">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-0.5 text-center sm:text-left min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-slate-400">Open Gigs</span>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  {opportunities.length}
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-0.5 text-center sm:text-left min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-slate-400">Team Members</span>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  {organization.memberUserIds?.length || 1}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Organization Mission & Description */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            About Organization
          </h3>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            {organization.description || 'No detailed organization description provided.'}
          </p>
        </div>

        {/* Active Posted Opportunities */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Active Opportunities ({opportunities.length})
              </h3>
            </div>
          </div>

          {opportunities.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <Layers className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                No active public opportunities posted at this time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {opp.type}
                      </span>
                      <span className="text-xs text-slate-500 capitalize">
                        {opp.experienceLevel}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {opp.title}
                    </h4>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {opp.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {opp.requiredSkills.slice(0, 3).map((skill) => (
                        <span
                          key={skill}
                          className="text-[10px] px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    <Link
                      to={`/opportunities/${opp.id}`}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span>Details</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Public Member Directory */}
        {members.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Public Team & Contributors ({members.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {members.map((member) => (
                <Link
                  key={member.uid}
                  to={`/p/${member.uid}`}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                    {member.photoURL ? (
                      <img
                        src={member.photoURL}
                        alt={member.displayName}
                        className="w-full h-full rounded-xl object-cover"
                      />
                    ) : (
                      member.displayName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
                      {member.displayName}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {member.headline || 'Team Member'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Security & Organization Integrity Stamp */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-1 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
            <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Official GigLink Organization Registry</span>
          </div>
          <p className="text-[11px]">
            Individual partner identities remain strictly independent from institutional entities.
          </p>
        </div>
      </div>
    </div>
  );
};
