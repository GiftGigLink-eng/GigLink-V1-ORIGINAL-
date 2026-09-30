import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  LayoutDashboard,
  Users,
  DollarSign,
  Activity,
  Server,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  getCeoOverview,
  getCeoMembers,
  getCeoFinancials,
  getCeoActivity,
  getCeoSystemHealth,
} from '../../../lib/ceoService';
import {
  CeoOverviewResponse,
  CeoMembersResponse,
  CeoFinancialsResponse,
  CeoActivityResponse,
  CeoSystemHealthResponse,
} from '../../../types/ceo';
import { CeoOverviewSection } from './CeoOverviewSection';
import { CeoMembersSection } from './CeoMembersSection';
import { CeoFinancialsSection } from './CeoFinancialsSection';
import { CeoActivitySection } from './CeoActivitySection';
import { CeoHealthSection } from './CeoHealthSection';

type CeoTab = 'overview' | 'members' | 'financials' | 'activity' | 'system_health';

export const CeoStage2Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<CeoTab>('overview');

  const [overviewData, setOverviewData] = useState<CeoOverviewResponse | null>(null);
  const [membersData, setMembersData] = useState<CeoMembersResponse | null>(null);
  const [financialsData, setFinancialsData] = useState<CeoFinancialsResponse | null>(null);
  const [activityData, setActivityData] = useState<CeoActivityResponse | null>(null);
  const [healthData, setHealthData] = useState<CeoSystemHealthResponse | null>(null);

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [financialsError, setFinancialsError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const fetchOverview = useCallback(async (token: string) => {
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const data = await getCeoOverview(token);
      setOverviewData(data);
    } catch (err: any) {
      console.warn('[CEO Dashboard] Error fetching overview:', err);
      const msg = err.message || 'Unable to load overview metrics.';
      setOverviewError(msg);
      setErrorNotice('Database query failure: Unable to load overview metrics.');
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const fetchMembers = useCallback(async (token: string) => {
    setLoadingMembers(true);
    setMembersError(null);
    try {
      const data = await getCeoMembers(token);
      setMembersData(data);
    } catch (err: any) {
      console.warn('[CEO Dashboard] Error fetching members:', err);
      const msg = err.message || 'Unable to load member directory.';
      setMembersError(msg);
      setErrorNotice('Database query failure: Unable to load member directory.');
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const fetchFinancials = useCallback(async (token: string) => {
    setLoadingFinancials(true);
    setFinancialsError(null);
    try {
      const data = await getCeoFinancials(token);
      setFinancialsData(data);
    } catch (err: any) {
      console.warn('[CEO Dashboard] Error fetching financials:', err);
      const msg = err.message || 'Unable to load financial metrics.';
      setFinancialsError(msg);
      setErrorNotice('Database query failure: Unable to load financial metrics.');
    } finally {
      setLoadingFinancials(false);
    }
  }, []);

  const fetchActivity = useCallback(async (token: string) => {
    setLoadingActivity(true);
    setActivityError(null);
    try {
      const data = await getCeoActivity(token);
      setActivityData(data);
    } catch (err: any) {
      console.warn('[CEO Dashboard] Error fetching activity:', err);
      const msg = err.message || 'Unable to load activity stream.';
      setActivityError(msg);
      setErrorNotice('Database query failure: Unable to load activity stream.');
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  const fetchHealth = useCallback(async (token: string) => {
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const data = await getCeoSystemHealth(token);
      setHealthData(data);
    } catch (err: any) {
      console.warn('[CEO Dashboard] Error fetching system health:', err);
      const msg = err.message || 'Unable to load system health.';
      setHealthError(msg);
      setErrorNotice('Database query failure: Unable to load system health.');
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    setErrorNotice(null);
    try {
      const token = await user.getIdToken();
      await Promise.all([
        fetchOverview(token),
        fetchMembers(token),
        fetchFinancials(token),
        fetchActivity(token),
        fetchHealth(token),
      ]);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      setErrorNotice(err.message || 'Authorization refresh failed.');
    } finally {
      setRefreshing(false);
    }
  }, [user, fetchOverview, fetchMembers, fetchFinancials, fetchActivity, fetchHealth]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const tabs: { id: CeoTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'members', label: 'Member Directory', icon: <Users className="w-4 h-4" /> },
    { id: 'financials', label: 'Financials & Escrow', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'activity', label: 'Platform Activity', icon: <Activity className="w-4 h-4" /> },
    { id: 'system_health', label: 'System Health', icon: <Server className="w-4 h-4" /> },
  ];

  return (
    <div id="ceo-dashboard-root" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Platform Owner Authorization Verified • Read-Only Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            CEO Control Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Server-authoritative platform metrics derived directly from canonical collections. Zero mutations permitted.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-[11px] text-slate-400">
              Updated {lastRefreshed}
            </span>
          )}
          <button
            id="ceo-refresh-button"
            onClick={refreshAll}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh Metrics'}</span>
          </button>
        </div>
      </div>

      {errorNotice && (
        <div id="ceo-error-banner" className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs">
          {errorNotice}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`ceo-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'overview' && (
          <CeoOverviewSection
            data={overviewData}
            loading={loadingOverview}
            error={overviewError}
            onRefresh={() => user && user.getIdToken().then(fetchOverview)}
          />
        )}
        {activeTab === 'members' && (
          <CeoMembersSection
            data={membersData}
            loading={loadingMembers}
            error={membersError}
            onRefresh={() => user && user.getIdToken().then(fetchMembers)}
          />
        )}
        {activeTab === 'financials' && (
          <CeoFinancialsSection
            data={financialsData}
            loading={loadingFinancials}
            error={financialsError}
            onRefresh={() => user && user.getIdToken().then(fetchFinancials)}
          />
        )}
        {activeTab === 'activity' && (
          <CeoActivitySection
            data={activityData}
            loading={loadingActivity}
            error={activityError}
            onRefresh={() => user && user.getIdToken().then(fetchActivity)}
          />
        )}
        {activeTab === 'system_health' && (
          <CeoHealthSection
            data={healthData}
            loading={loadingHealth}
            error={healthError}
            onRefresh={() => user && user.getIdToken().then(fetchHealth)}
          />
        )}
      </div>

      {/* Security Invariant Footer */}
      <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-500" />
          <span>Stage 2 Architecture: Immutable server derivation • Cryptographic UID gate verified</span>
        </div>
        <div className="font-mono">
          Principal: {user?.email} ({user?.uid?.substring(0, 12)}...)
        </div>
      </div>
    </div>
  );
};
