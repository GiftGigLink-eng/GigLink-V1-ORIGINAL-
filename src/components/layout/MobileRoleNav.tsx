import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Shield,
  Briefcase,
  FileCheck,
  Menu,
  PlusCircle,
  FolderKanban,
  BadgeCheck,
  Building2,
  Users,
  Lock,
  ShieldCheck,
  FileText,
} from 'lucide-react';

interface MobileRoleNavProps {
  onOpenDrawer: () => void;
}

export const MobileRoleNav: React.FC<MobileRoleNavProps> = ({ onOpenDrawer }) => {
  const { user, activeRole, activePersona } = useAuth();

  if (!user) return null;

  const renderTalentDock = () => (
    <>
      <NavLink
        to="/talent/dashboard"
        id="mobile-talent-dashboard"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <LayoutDashboard className="w-5 h-5 mb-0.5" />
        <span>Dashboard</span>
      </NavLink>

      <NavLink
        to="/talent/passport"
        id="mobile-talent-passport"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <Shield className="w-5 h-5 mb-0.5" />
        <span>Passport</span>
      </NavLink>

      <NavLink
        to="/talent/opportunities"
        id="mobile-talent-opportunities"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <Briefcase className="w-5 h-5 mb-0.5" />
        <span>Browse</span>
      </NavLink>

      <NavLink
        to="/talent/applications"
        id="mobile-talent-applications"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <FileCheck className="w-5 h-5 mb-0.5" />
        <span>Applications</span>
      </NavLink>
    </>
  );

  const renderCreatorDock = () => (
    <>
      <NavLink
        to="/creator/dashboard"
        id="mobile-creator-dashboard"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <LayoutDashboard className="w-5 h-5 mb-0.5" />
        <span>Command</span>
      </NavLink>

      <NavLink
        to="/creator/opportunities"
        id="mobile-creator-opportunities"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <FolderKanban className="w-5 h-5 mb-0.5" />
        <span>My Posts</span>
      </NavLink>

      <NavLink
        to="/creator/opportunities/new"
        id="mobile-creator-new-opportunity"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <PlusCircle className="w-5 h-5 mb-0.5" />
        <span>+ Post</span>
      </NavLink>

      <NavLink
        to="/creator/handoffs"
        id="mobile-creator-handoffs"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <BadgeCheck className="w-5 h-5 mb-0.5" />
        <span>Handoffs</span>
      </NavLink>
    </>
  );

  const renderEnterpriseDock = () => (
    <>
      <NavLink
        to="/enterprise/dashboard"
        id="mobile-enterprise-dashboard"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <Building2 className="w-5 h-5 mb-0.5" />
        <span>Org Hub</span>
      </NavLink>

      <NavLink
        to="/enterprise/team"
        id="mobile-enterprise-team"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <Users className="w-5 h-5 mb-0.5" />
        <span>Team</span>
      </NavLink>

      <NavLink
        to="/enterprise/opportunities"
        id="mobile-enterprise-opportunities"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <Briefcase className="w-5 h-5 mb-0.5" />
        <span>Postings</span>
      </NavLink>

      <NavLink
        to="/enterprise/bench"
        id="mobile-enterprise-bench"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <Shield className="w-5 h-5 mb-0.5" />
        <span>Bench</span>
      </NavLink>
    </>
  );

  const renderAdminDock = () => (
    <>
      <NavLink
        to="/admin/dashboard"
        id="mobile-admin-dashboard"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <LayoutDashboard className="w-5 h-5 mb-0.5" />
        <span>Integrity</span>
      </NavLink>

      <NavLink
        to="/admin/verifications"
        id="mobile-admin-verifications"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <ShieldCheck className="w-5 h-5 mb-0.5" />
        <span>KYC Queue</span>
      </NavLink>

      <NavLink
        to="/admin/proofs"
        id="mobile-admin-proofs"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <FileText className="w-5 h-5 mb-0.5" />
        <span>Proofs</span>
      </NavLink>

      <NavLink
        to="/admin/security"
        id="mobile-admin-security"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium min-h-[48px] ${
            isActive ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`
        }
      >
        <Lock className="w-5 h-5 mb-0.5" />
        <span>Security</span>
      </NavLink>
    </>
  );

  return (
    <aside
      aria-label="Mobile Navigation Dock"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg pb-safe"
    >
      <div className="grid grid-cols-5 h-14 max-w-lg mx-auto px-2">
        {(activeRole === 'creator' || (activePersona as string) === 'client' || (activePersona as string) === 'creator') && renderCreatorDock()}
        {activeRole === 'enterprise' && renderEnterpriseDock()}
        {activeRole === 'admin' && renderAdminDock()}
        {activeRole === 'talent' && (activePersona as string) !== 'client' && (activePersona as string) !== 'creator' && renderTalentDock()}

        {/* Global Drawer Menu Button */}
        <button
          type="button"
          id="mobile-menu-trigger-btn"
          onClick={onOpenDrawer}
          className="flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white min-h-[48px]"
          aria-label="Open Workspace Menu"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>Menu</span>
        </button>
      </div>
    </aside>
  );
};
