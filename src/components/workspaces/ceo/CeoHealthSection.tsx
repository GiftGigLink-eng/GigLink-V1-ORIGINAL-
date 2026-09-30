import React from 'react';
import { Server, Database, Activity, ShieldAlert, Cpu, HardDrive } from 'lucide-react';
import { CeoSystemHealthResponse } from '../../../types/ceo';

interface CeoHealthSectionProps {
  data: CeoSystemHealthResponse | null;
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export const CeoHealthSection: React.FC<CeoHealthSectionProps> = ({ data, loading, error, onRefresh }) => {
  if (loading && !data) {
    return (
      <div id="ceo-health-loading" className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Loading system telemetry & operational status...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div id="ceo-health-error" className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">System Telemetry Query Failure</p>
        <p className="text-xs text-rose-600 dark:text-rose-300 max-w-md mx-auto">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs font-medium bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-800/80 transition"
          >
            Retry Query
          </button>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div id="ceo-health-empty" className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">System health information unavailable.</p>
      </div>
    );
  }

  const { server, firestore, telemetry } = data;

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  return (
    <div id="ceo-health-section" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Express Server Diagnostics */}
        <div id="ceo-health-server" className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
              <Server className="w-4 h-4 text-emerald-500" />
              <span>Express API Server Status</span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {server.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60">
              <div className="text-slate-500 dark:text-slate-400 text-[11px]">Uptime</div>
              <div className="font-mono font-semibold text-slate-900 dark:text-white mt-1">
                {formatUptime(server.uptimeSeconds)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60">
              <div className="text-slate-500 dark:text-slate-400 text-[11px]">Node.js Runtime</div>
              <div className="font-mono font-semibold text-slate-900 dark:text-white mt-1">
                {server.nodeVersion}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                <span>Memory Allocation</span>
              </span>
              <span className="font-mono">{server.memoryUsage.heapUsedMb} MB / {server.memoryUsage.heapTotalMb} MB Heap</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((server.memoryUsage.heapUsedMb / Math.max(1, server.memoryUsage.heapTotalMb)) * 100))}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
              <span>RSS: {server.memoryUsage.rssMb} MB</span>
              <span>External: {server.memoryUsage.externalMb} MB</span>
            </div>
          </div>
        </div>

        {/* Database & Cloud Connection */}
        <div id="ceo-health-firestore" className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
              <Database className="w-4 h-4 text-indigo-500" />
              <span>Google Cloud Firestore Health</span>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
              firestore.status === 'connected'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            }`}>
              {firestore.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60">
              <div className="text-slate-500 dark:text-slate-400 text-[11px]">Probe Latency</div>
              <div className="font-mono font-semibold text-slate-900 dark:text-white mt-1">
                {firestore.latencyMs !== undefined ? `${firestore.latencyMs} ms` : 'N/A'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60">
              <div className="text-slate-500 dark:text-slate-400 text-[11px]">Connection Type</div>
              <div className="font-mono font-semibold text-slate-900 dark:text-white mt-1">
                Long-Polling / WebChannel
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {firestore.note}
          </p>
        </div>
      </div>

      {/* Process Telemetry & Invariants */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
          <Activity className="w-4 h-4 text-sky-500" />
          <span>Active Runtime Security Telemetry</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
            <div className="text-xs text-slate-600 dark:text-slate-400">Runtime Authentication Failures</div>
            <div className="font-mono font-bold text-slate-900 dark:text-white">{telemetry.runtimeAuthFailureCount}</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
            <div className="text-xs text-slate-600 dark:text-slate-400">Runtime Webhook Failures</div>
            <div className="font-mono font-bold text-slate-900 dark:text-white">{telemetry.runtimeFailedWebhooksCount}</div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
          {telemetry.disclaimer}
        </p>
      </div>
    </div>
  );
};
