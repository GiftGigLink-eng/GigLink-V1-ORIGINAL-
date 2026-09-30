import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  Clock,
  UserCheck,
  Shield,
  Briefcase,
  Building2,
  GraduationCap,
  HelpCircle,
} from 'lucide-react';
import { CeoMembersResponse, CeoMemberListItem, CeoMemberTimeBucket } from '../../../types/ceo';

interface CeoMembersSectionProps {
  data: CeoMembersResponse | null;
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

type TimeframeFilter = 'all' | 'today' | 'last_7_days' | 'last_30_days';
type PersonaFilter = 'all' | 'learner' | 'partner' | 'client' | 'organization_admin';
type RoleFilter = 'all' | 'talent' | 'creator' | 'enterprise' | 'unassigned';

export const CeoMembersSection: React.FC<CeoMembersSectionProps> = ({
  data,
  loading,
  error,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [personaFilter, setPersonaFilter] = useState<PersonaFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>('all');

  const members = data?.members || [];

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // 1. Search by display name or UID prefix
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = m.displayName.toLowerCase().includes(query);
        const matchesId = m.id.toLowerCase().includes(query);
        if (!matchesName && !matchesId) return false;
      }

      // 2. Filter by canonical persona
      if (personaFilter !== 'all' && m.activePersona !== personaFilter) {
        return false;
      }

      // 3. Filter by active role
      if (roleFilter !== 'all') {
        if (roleFilter === 'unassigned') {
          if (m.activeRole) return false;
        } else {
          if (m.activeRole !== roleFilter) return false;
        }
      }

      // 4. Filter by timeframe
      if (timeframeFilter === 'today') {
        if (m.timeBucket !== 'today') return false;
      } else if (timeframeFilter === 'last_7_days') {
        if (m.timeBucket !== 'today' && m.timeBucket !== 'last_7_days') return false;
      } else if (timeframeFilter === 'last_30_days') {
        if (m.timeBucket === 'older') return false;
      }

      return true;
    });
  }, [members, searchTerm, personaFilter, roleFilter, timeframeFilter]);

  const getPersonaBadge = (persona: string) => {
    switch (persona) {
      case 'learner':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
            <GraduationCap className="w-3 h-3" />
            Learner
          </span>
        );
      case 'partner':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
            <Shield className="w-3 h-3" />
            Partner
          </span>
        );
      case 'client':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            <Briefcase className="w-3 h-3" />
            Client
          </span>
        );
      case 'organization_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <Building2 className="w-3 h-3" />
            Org Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <HelpCircle className="w-3 h-3" />
            {persona}
          </span>
        );
    }
  };

  const getTimeBucketBadge = (timeBucket: CeoMemberTimeBucket) => {
    switch (timeBucket) {
      case 'today':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
            Today
          </span>
        );
      case 'last_7_days':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
            Last 7 Days
          </span>
        );
      case 'last_30_days':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            8–30 Days
          </span>
        );
      case 'older':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-500">
            &gt; 30 Days
          </span>
        );
    }
  };

  if (loading && !data) {
    return (
      <div id="ceo-members-loading" className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Loading authoritative member directory...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div id="ceo-members-error" className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">Directory Query Failure</p>
        <p className="text-xs text-rose-600 dark:text-rose-300 max-w-md mx-auto">{error}</p>
        {onRefresh && (
          <button
            id="ceo-members-retry-btn"
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs font-medium bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-800/80 transition"
          >
            Retry Query
          </button>
        )}
      </div>
    );
  }

  return (
    <div id="ceo-members-section" className="space-y-5">
      {/* Directory Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              id="ceo-member-search-input"
              type="text"
              placeholder="Search member display name or UID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Aggregate Match Indicator */}
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredMembers.length}</span> of {members.length} registered platform members
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
          {/* Persona Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Persona:</span>
            {(['all', 'learner', 'client', 'organization_admin', 'partner'] as PersonaFilter[]).map((p) => (
              <button
                key={p}
                id={`filter-persona-${p}`}
                onClick={() => setPersonaFilter(p)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
                  personaFilter === p
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {p === 'all' ? 'All Personas' : p.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Timeframe Filter */}
          <div className="flex items-center gap-1.5 sm:ml-auto">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-medium">Joined:</span>
            {(['all', 'today', 'last_7_days', 'last_30_days'] as TimeframeFilter[]).map((tf) => (
              <button
                key={tf}
                id={`filter-timeframe-${tf}`}
                onClick={() => setTimeframeFilter(tf)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
                  timeframeFilter === tf
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {tf === 'all'
                  ? 'All Time'
                  : tf === 'today'
                  ? 'Today (UTC)'
                  : tf === 'last_7_days'
                  ? 'Last 7 Days'
                  : 'Last 30 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Members Directory Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {filteredMembers.length === 0 ? (
          <div id="ceo-members-empty" className="p-8 text-center text-slate-500 dark:text-slate-400">
            <UserCheck className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-xs">No members match the active search and filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table id="ceo-members-table" className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-medium">
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">User UID</th>
                  <th className="py-3 px-4">Canonical Persona</th>
                  <th className="py-3 px-4">Active Role</th>
                  <th className="py-3 px-4">Onboarding</th>
                  <th className="py-3 px-4">Joined (UTC)</th>
                  <th className="py-3 px-4">Time Bucket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    id={`member-row-${member.id}`}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {member.displayName}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {member.id}
                    </td>
                    <td className="py-3 px-4">
                      {getPersonaBadge(member.activePersona)}
                    </td>
                    <td className="py-3 px-4">
                      {member.activeRole ? (
                        <span className="capitalize font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {member.activeRole}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {member.onboardingCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          <Clock className="w-3.5 h-3.5" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {new Date(member.createdAt).toISOString().replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-3 px-4">
                      {getTimeBucketBadge(member.timeBucket)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
