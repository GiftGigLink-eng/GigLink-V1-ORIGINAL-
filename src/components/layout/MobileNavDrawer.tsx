import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GigLinkRole, GIGLINK_ROLES } from '../../types';
import { NotificationDropdown } from '../common/NotificationDropdown';
import {
  X,
  Shield,
  GraduationCap,
  LogOut,
  LogIn,
  ChevronRight,
  Briefcase,
  Building2,
  Lock,
  LayoutDashboard,
  FileCheck,
  Flag,
  FolderKanban,
  PlusCircle,
  BadgeCheck,
  Users,
  ShieldCheck,
  FileText,
  User,
  Compass,
  Award,
} from 'lucide-react';

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({ isOpen, onClose }) => {
  const { user, profile, activeRole, activePersona, allowedRoles, switchRole, signOut } = useAuth();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const currentRoleDef = GIGLINK_ROLES[activeRole] || GIGLINK_ROLES.talent;

  const getRoleIcon = (roleKey: GigLinkRole) => {
    switch (roleKey) {
      case 'talent':
        return <GraduationCap className="w-4 h-4 text-indigo-500" />;
      case 'creator':
        return <Briefcase className="w-4 h-4 text-sky-500" />;
      case 'enterprise':
        return <Building2 className="w-4 h-4 text-purple-500" />;
      case 'admin':
        return <ShieldCheck className="w-4 h-4 text-amber-500" />;
      default:
        return <Shield className="w-4 h-4 text-slate-500" />;
    }
  };

  const handleRoleSelect = async (roleKey: GigLinkRole) => {
    if (roleKey === activeRole) {
      onClose();
      return;
    }
    try {
      await switchRole(roleKey);
      setTimeout(() => {
        onClose();
        navigate(GIGLINK_ROLES[roleKey].homeRoute);
      }, 150);
    } catch (err) {
      console.error('Failed to switch active role from mobile drawer:', err);
    }
  };

  return (
    <div id="mobile-nav-drawer-overlay" className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Drawer Container */}
      <div className="relative w-full max-w-xs bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-lg shadow-sm">
              G
            </div>
            <div>
              <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">GigLink</span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{currentRoleDef.badge}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close Navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile or Sign-In Card */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-sm border border-indigo-200 dark:border-indigo-900">
                  {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {profile?.displayName || 'User'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                </div>
              </div>

              {/* Active Role Context Badge */}
              <div className={`p-2.5 rounded-xl border ${currentRoleDef.bgColor} ${currentRoleDef.borderColor} text-xs`}>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
                  Active Workspace
                </div>
                <div className={`flex items-center gap-2 font-bold ${currentRoleDef.textColor}`}>
                  {getRoleIcon(activeRole)}
                  <span>{currentRoleDef.label}</span>
                </div>
              </div>

              {/* Mobile Notification Panel Trigger */}
              <div className="pt-1">
                <NotificationDropdown isMobile={true} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <NavLink
                to="/auth/login"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors min-h-[44px]"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </NavLink>
              <NavLink
                to="/auth/register"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center transition-colors min-h-[44px]"
              >
                <span>Create Account</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Role Switcher Section */}
        {user && (
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
              Switch Workspace Role
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {(Object.keys(GIGLINK_ROLES) as GigLinkRole[]).map((roleKey) => {
                const def = GIGLINK_ROLES[roleKey];
                const isSelected = activeRole === roleKey;
                const isAllowed = allowedRoles.includes(roleKey);

                return (
                  <button
                    key={roleKey}
                    onClick={() => handleRoleSelect(roleKey)}
                    disabled={!isAllowed}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors flex items-center justify-between min-h-[44px] ${
                      isSelected
                        ? `${def.bgColor} ${def.textColor} font-bold border ${def.borderColor}`
                        : isAllowed
                        ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        : 'opacity-40 cursor-not-allowed text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {getRoleIcon(roleKey)}
                      <div>
                        <div>{def.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{def.shortLabel}</div>
                      </div>
                    </div>
                    {isSelected && <ChevronRight className="w-4 h-4 text-indigo-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Role-Specific Navigation Links */}
        <div className="p-4 flex-1 space-y-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">
            {user ? `${(activeRole === 'creator' || (activePersona as string) === 'client' || (activePersona as string) === 'creator') ? 'Client' : currentRoleDef.shortLabel} Navigation` : 'Navigation'}
          </p>

          {/* Talent Links */}
          {user && activeRole === 'talent' && (activePersona as string) !== 'client' && (activePersona as string) !== 'creator' && (
            <>
              <NavLink
                to="/talent/dashboard"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <LayoutDashboard className="w-4 h-4 text-indigo-500" />
                <span>Career Dashboard</span>
              </NavLink>
              <NavLink
                to="/talent/passport"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Shield className="w-4 h-4 text-indigo-500" />
                <span>My Trust Passport</span>
              </NavLink>
              <NavLink
                to="/talent/opportunities"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Briefcase className="w-4 h-4 text-indigo-500" />
                <span>Browse Opportunities</span>
              </NavLink>
              <NavLink
                to="/talent/applications"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <FileCheck className="w-4 h-4 text-indigo-500" />
                <span>My Applications</span>
              </NavLink>
              <NavLink
                to="/talent/milestones"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Flag className="w-4 h-4 text-indigo-500" />
                <span>Deliverables & Handoffs</span>
              </NavLink>
              <NavLink
                to="/talent/credentials"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Award className="w-4 h-4 text-indigo-500" />
                <span>Verifiable Transcript</span>
              </NavLink>
            </>
          )}

          {/* Client / Creator Links */}
          {user && (activeRole === 'creator' || (activePersona as string) === 'client' || (activePersona as string) === 'creator') && (
            <>
              <NavLink
                to="/creator/dashboard"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <LayoutDashboard className="w-4 h-4 text-sky-500" />
                <span>Client Workspace</span>
              </NavLink>
              <NavLink
                to="/creator/opportunities"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <FolderKanban className="w-4 h-4 text-sky-500" />
                <span>My Opportunities</span>
              </NavLink>
              <NavLink
                to="/creator/opportunities/new"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <PlusCircle className="w-4 h-4 text-sky-500" />
                <span>Post Opportunity</span>
              </NavLink>
              <NavLink
                to="/creator/handoffs"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <BadgeCheck className="w-4 h-4 text-sky-500" />
                <span>Collaboration Handoffs</span>
              </NavLink>
            </>
          )}

          {/* Enterprise Links */}
          {user && activeRole === 'enterprise' && (
            <>
              <NavLink
                to="/enterprise/dashboard"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Building2 className="w-4 h-4 text-purple-500" />
                <span>Org Console</span>
              </NavLink>
              <NavLink
                to="/enterprise/team"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Users className="w-4 h-4 text-purple-500" />
                <span>Team & Seats</span>
              </NavLink>
              <NavLink
                to="/enterprise/opportunities"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Briefcase className="w-4 h-4 text-purple-500" />
                <span>Org Postings</span>
              </NavLink>
              <NavLink
                to="/enterprise/bench"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Shield className="w-4 h-4 text-purple-500" />
                <span>Talent Bench</span>
              </NavLink>
              <NavLink
                to="/enterprise/compliance"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Lock className="w-4 h-4 text-purple-500" />
                <span>Compliance & KYB</span>
              </NavLink>
            </>
          )}

          {/* Admin Links */}
          {user && activeRole === 'admin' && (
            <>
              <NavLink
                to="/admin/dashboard"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <LayoutDashboard className="w-4 h-4 text-amber-500" />
                <span>Integrity Console</span>
              </NavLink>
              <NavLink
                to="/admin/verifications"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <span>KYC Queue</span>
              </NavLink>
              <NavLink
                to="/admin/proofs"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <FileText className="w-4 h-4 text-amber-500" />
                <span>Proof Audits</span>
              </NavLink>
              <NavLink
                to="/admin/security"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Lock className="w-4 h-4 text-amber-500" />
                <span>Security & Invariants</span>
              </NavLink>
            </>
          )}

          {/* Guest Public Links */}
          {!user && (
            <>
              <NavLink
                to="/"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Compass className="w-4 h-4 text-indigo-500" />
                <span>Public Ecosystem Portal</span>
              </NavLink>
              <NavLink
                to="/opportunities"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium min-h-[44px] ${
                    isActive ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Briefcase className="w-4 h-4 text-indigo-500" />
                <span>Explore Opportunities</span>
              </NavLink>
            </>
          )}

          {user && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 mt-3">
              <NavLink
                to="/profile"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px]"
              >
                <User className="w-4 h-4 text-slate-400" />
                <span>My Profile</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Footer */}
        {user && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <button
              onClick={() => {
                onClose();
                signOut();
              }}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center gap-2 transition-colors min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
