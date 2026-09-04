import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  MoreVertical,
  CheckCircle2,
  Clock,
  Trash2,
  Building2,
  Copy,
  Check,
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Hiring Manager' | 'Reviewer';
  status: 'Active' | 'Invited';
  joinedAt: string;
}

export const EnterpriseTeamPage: React.FC = () => {
  const { profile } = useAuth();
  const { showSuccess, showError } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([
    {
      id: '1',
      name: profile?.displayName || 'Organization Admin',
      email: profile?.email || 'admin@enterprise.com',
      role: 'Admin',
      status: 'Active',
      joinedAt: '2026-01-15',
    },
    {
      id: '2',
      name: 'Sarah Chen',
      email: 'schen@enterprise.com',
      role: 'Hiring Manager',
      status: 'Active',
      joinedAt: '2026-02-01',
    },
    {
      id: '3',
      name: 'Alex Rivera',
      email: 'arivera@enterprise.com',
      role: 'Reviewer',
      status: 'Invited',
      joinedAt: '2026-02-18',
    },
  ]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Hiring Manager' | 'Reviewer'>('Hiring Manager');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes('@')) {
      showError('Please enter a valid email address');
      return;
    }

    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
      status: 'Invited',
      joinedAt: new Date().toISOString().split('T')[0],
    };

    setMembers([...members, newMember]);
    setInviteEmail('');
    showSuccess(`Invitation dispatched to ${inviteEmail}`);
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(`https://giglink.com/join/${profile?.organizationId || 'enterprise-org'}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    showSuccess('Enterprise invitation link copied to clipboard');
  };

  const handleRemoveMember = (id: string) => {
    if (id === '1') {
      showError('Cannot remove primary organization administrator');
      return;
    }
    setMembers(members.filter((m) => m.id !== id));
    showSuccess('Team member removed');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
              Enterprise Workspace
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            Team & Seat Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Allocate organizational seats, configure hiring roles, and audit access logs.
          </p>
        </div>

        <button
          onClick={handleCopyInviteLink}
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-2"
        >
          {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          <span>{copiedLink ? 'Copied Link' : 'Copy Org Invite Link'}</span>
        </button>
      </div>

      {/* Seat Allocation Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Enterprise Seats</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">10 Seats</div>
          <div className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-0.5">Enterprise Tier Included</div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Assigned Seats</span>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{members.length} Seats</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{10 - members.length} available</div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Administrators</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {members.filter((m) => m.role === 'Admin').length} Admin
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Full governance permissions</div>
        </div>
      </div>

      {/* Invite Member Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Invite New Team Member</h2>
        </div>

        <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="email"
            placeholder="colleague@enterprise.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
          />

          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as any)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
          >
            <option value="Hiring Manager">Hiring Manager (Post & Evaluate)</option>
            <option value="Reviewer">Reviewer (Read & Score Candidates)</option>
            <option value="Admin">Administrator (Full Access)</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            Send Invitation
          </button>
        </form>
      </div>

      {/* Team Member Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">Active Seats ({members.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{member.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{member.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 w-fit ${
                        member.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {member.status === 'Active' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      <span>{member.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {member.id !== '1' && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
