import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Building2,
  CheckCircle2,
  Search,
  Filter,
  Plus,
  ExternalLink,
  ShieldCheck,
  Ban,
  Clock,
  AlertTriangle,
  FileCheck,
  ChevronRight,
  Sparkles,
  Users,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { VerifiableCredential } from '../../types/credential';
import {
  getIssuedCredentialsForOrg,
  revokeVerifiableCredential,
} from '../../lib/credentialIssuanceService';
import { useToast } from '../../context/ToastContext';

export const InstitutionCredentialsManagementPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { addToast } = useToast();

  const [credentials, setCredentials] = useState<VerifiableCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'issued' | 'claimed' | 'revoked'>('all');
  
  // Revocation Modal State
  const [selectedCredToRevoke, setSelectedCredToRevoke] = useState<VerifiableCredential | null>(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const orgId = profile?.organizationId || `org_${user?.uid || 'inst'}`;
  const orgName = profile?.organization?.name || 'Academic & Partner Authority';

  const loadOrgCredentials = async () => {
    setLoading(true);
    try {
      const items = await getIssuedCredentialsForOrg(orgId);
      setCredentials(items);
    } catch (err) {
      console.error('Error loading org credentials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgCredentials();
  }, [orgId]);

  const handleCopyLink = (credId: string) => {
    const url = `${window.location.origin}/verify/credential/${credId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(credId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConfirmRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCredToRevoke || !revocationReason.trim()) {
      addToast('Please enter a revocation reason for the audit log.', 'error');
      return;
    }

    setRevoking(true);
    try {
      await revokeVerifiableCredential(
        selectedCredToRevoke.id,
        user?.uid || 'admin',
        profile?.displayName || 'Issuer Admin',
        revocationReason.trim()
      );
      addToast(`Credential ${selectedCredToRevoke.id} has been revoked.`, 'info');
      setSelectedCredToRevoke(null);
      setRevocationReason('');
      await loadOrgCredentials();
    } catch (err: any) {
      console.error('Revocation error:', err);
      addToast(err.message || 'Failed to revoke credential.', 'error');
    } finally {
      setRevoking(false);
    }
  };

  const filteredCredentials = credentials.filter((cred) => {
    const matchesSearch =
      cred.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cred.recipient.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cred.recipient.recipientEmail.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || cred.claimStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalIssued = credentials.length;
  const totalClaimed = credentials.filter((c) => c.claimStatus === 'claimed').length;
  const totalPending = credentials.filter((c) => c.claimStatus === 'issued').length;
  const totalRevoked = credentials.filter((c) => c.claimStatus === 'revoked').length;
  const claimRate = totalIssued > 0 ? Math.round((totalClaimed / totalIssued) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
              Institutional Console
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Issued Verifiable Credentials
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track, audit, and manage all cryptographic attestations minted by {orgName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/institution/issue-credentials"
            id="issue-new-cred-header-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Issue New Credential</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Minted</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{totalIssued}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Claim Rate</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-black text-emerald-600">{claimRate}%</p>
            <span className="text-[11px] text-slate-400">({totalClaimed} Claimed)</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Claim</p>
          <p className="text-2xl font-black text-amber-500">{totalPending}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Revoked</p>
          <p className="text-2xl font-black text-rose-500">{totalRevoked}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student, email, title..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            All ({totalIssued})
          </button>
          <button
            onClick={() => setStatusFilter('claimed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'claimed'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            Claimed ({totalClaimed})
          </button>
          <button
            onClick={() => setStatusFilter('issued')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'issued'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            Pending ({totalPending})
          </button>
          <button
            onClick={() => setStatusFilter('revoked')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'revoked'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            Revoked ({totalRevoked})
          </button>
        </div>
      </div>

      {/* Credentials Table / List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span>Loading issued credentials ledger...</span>
          </div>
        ) : filteredCredentials.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Award className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No credentials found matching your criteria.
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Issue your first verifiable diploma or skill certification to student or talent cohorts.
            </p>
            <Link
              to="/institution/issue-credentials"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Issue Credential</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-6">Recipient</th>
                  <th className="py-3.5 px-6">Credential Title & Type</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Issued Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredCredentials.map((cred) => {
                  return (
                    <tr key={cred.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {cred.recipient.recipientName}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {cred.recipient.recipientEmail}
                          </p>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {cred.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 uppercase">
                              {cred.credentialType.replace('_', ' ')}
                            </span>
                            {cred.achievementGrade && (
                              <span className="text-[10px] text-slate-400">
                                • {cred.achievementGrade}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        {cred.claimStatus === 'claimed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Claimed</span>
                          </span>
                        )}
                        {cred.claimStatus === 'issued' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                            <Clock className="w-3 h-3" />
                            <span>Pending Claim</span>
                          </span>
                        )}
                        {cred.claimStatus === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                            <span>Declined</span>
                          </span>
                        )}
                        {cred.claimStatus === 'revoked' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 text-[10px] font-bold">
                            <Ban className="w-3 h-3" />
                            <span>Revoked</span>
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-slate-500 font-mono text-[11px]">
                        {new Date(cred.issuedAt).toLocaleDateString()}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleCopyLink(cred.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Copy Verification Link"
                          >
                            {copiedId === cred.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <Link
                            to={`/verify/credential/${cred.id}`}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                            title="View Public Certificate"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>

                          {cred.claimStatus !== 'revoked' && (
                            <button
                              onClick={() => setSelectedCredToRevoke(cred)}
                              className="px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-[11px] font-bold"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revocation Confirmation Modal */}
      {selectedCredToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Revoke Verifiable Credential
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                You are revoking <strong className="text-slate-800 dark:text-slate-200 font-semibold">{selectedCredToRevoke.title}</strong> issued to <strong className="text-slate-800 dark:text-slate-200 font-semibold">{selectedCredToRevoke.recipient.recipientName}</strong>. This revocation will be recorded immutably on the cryptographic ledger.
              </p>
            </div>

            <form onSubmit={handleConfirmRevoke} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Reason for Revocation *
                </label>
                <textarea
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                  placeholder="e.g. Academic integrity violation, administrative data entry error, or curriculum requirement retracted."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-rose-500/20"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCredToRevoke(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revoking}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-colors disabled:opacity-60"
                >
                  {revoking ? 'Revoking on Ledger...' : 'Confirm Revocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
