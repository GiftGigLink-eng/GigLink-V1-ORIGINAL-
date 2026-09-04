import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GigLinkRole, GIGLINK_ROLES } from '../../types';
import {
  LayoutDashboard,
  Shield,
  Briefcase,
  FileCheck,
  Flag,
  FolderKanban,
  PlusCircle,
  Users,
  Building2,
  BadgeCheck,
  ShieldCheck,
  FileText,
  Lock,
  Compass,
  Award,
} from 'lucide-react';

interface NavItemConfig {
  to: string;
  label: string;
  id: string;
  icon: React.ReactNode;
  badge?: string | number;
}

export const RoleNavigation: React.FC = () => {
  const { user, activeRole, activePersona } = useAuth();

  // Public nav items for unauthenticated guests
  const publicNavItems: NavItemConfig[] = [
    {
      to: '/',
      label: 'Public Portal',
      id: 'nav-public-portal',
      icon: <Compass className="w-3.5 h-3.5 text-indigo-500" />,
    },
    {
      to: '/opportunities',
      label: 'Explore Opportunities',
      id: 'nav-public-opportunities',
      icon: <Briefcase className="w-3.5 h-3.5 text-indigo-500" />,
    },
  ];

  // Role 1: Independent Talent Navigation
  const talentNavItems: NavItemConfig[] = [
    {
      to: '/talent/dashboard',
      label: 'Dashboard',
      id: 'nav-talent-dashboard',
      icon: <LayoutDashboard className="w-3.5 h-3.5 text-indigo-500" />,
    },
    {
      to: '/talent/passport',
      label: 'My Passport',
      id: 'nav-talent-passport',
      icon: <Shield className="w-3.5 h-3.5 text-indigo-500" />,
    },
    {
      to: '/talent/opportunities',
      label: 'Browse Work',
      id: 'nav-talent-opportunities',
      icon: <Briefcase className="w-3.5 h-3.5 text-indigo-500" />,
    },
    {
      to: '/talent/applications',
      label: 'My Applications',
      id: 'nav-talent-applications',
      icon: <FileCheck className="w-3.5 h-3.5 text-indigo-500" />,
    },
    {
      to: '/talent/milestones',
      label: 'Deliverables & Handoff',
      id: 'nav-talent-milestones',
      icon: <Flag className="w-3.5 h-3.5 text-indigo-500" />,
    },
    {
      to: '/talent/credentials',
      label: 'Verifiable Transcript',
      id: 'nav-talent-credentials',
      icon: <Award className="w-3.5 h-3.5 text-indigo-500" />,
    },
  ];

  // Role 2: Client / Creator Navigation
  const creatorNavItems: NavItemConfig[] = [
    {
      to: '/creator/dashboard',
      label: 'Hiring Command',
      id: 'nav-creator-dashboard',
      icon: <LayoutDashboard className="w-3.5 h-3.5 text-sky-500" />,
    },
    {
      to: '/creator/opportunities',
      label: 'My Opportunities',
      id: 'nav-creator-opportunities',
      icon: <FolderKanban className="w-3.5 h-3.5 text-sky-500" />,
    },
    {
      to: '/creator/opportunities/new',
      label: 'Post Opportunity',
      id: 'nav-creator-new-opportunity',
      icon: <PlusCircle className="w-3.5 h-3.5 text-sky-500" />,
    },
    {
      to: '/creator/handoffs',
      label: 'Collaboration Handoffs',
      id: 'nav-creator-handoffs',
      icon: <BadgeCheck className="w-3.5 h-3.5 text-sky-500" />,
    },
  ];

  // Role 3: Enterprise / Agency Navigation
  const enterpriseNavItems: NavItemConfig[] = [
    {
      to: '/enterprise/dashboard',
      label: 'Org Console',
      id: 'nav-enterprise-dashboard',
      icon: <Building2 className="w-3.5 h-3.5 text-purple-500" />,
    },
    {
      to: '/enterprise/team',
      label: 'Team & Seats',
      id: 'nav-enterprise-team',
      icon: <Users className="w-3.5 h-3.5 text-purple-500" />,
    },
    {
      to: '/enterprise/opportunities',
      label: 'Org Postings',
      id: 'nav-enterprise-opportunities',
      icon: <Briefcase className="w-3.5 h-3.5 text-purple-500" />,
    },
    {
      to: '/enterprise/bench',
      label: 'Talent Bench',
      id: 'nav-enterprise-bench',
      icon: <Shield className="w-3.5 h-3.5 text-purple-500" />,
    },
    {
      to: '/enterprise/compliance',
      label: 'Compliance & KYB',
      id: 'nav-enterprise-compliance',
      icon: <Lock className="w-3.5 h-3.5 text-purple-500" />,
    },
    {
      to: '/enterprise/credentials',
      label: 'Issue Attestations',
      id: 'nav-enterprise-credentials',
      icon: <Award className="w-3.5 h-3.5 text-purple-500" />,
    },
  ];

  // Role 4: Platform Verifier / Admin Navigation
  const adminNavItems: NavItemConfig[] = [
    {
      to: '/admin/dashboard',
      label: 'Integrity Console',
      id: 'nav-admin-dashboard',
      icon: <LayoutDashboard className="w-3.5 h-3.5 text-amber-500" />,
    },
    {
      to: '/admin/verifications',
      label: 'KYC Queue',
      id: 'nav-admin-verifications',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />,
    },
    {
      to: '/admin/proofs',
      label: 'Proof Audits',
      id: 'nav-admin-proofs',
      icon: <FileText className="w-3.5 h-3.5 text-amber-500" />,
    },
    {
      to: '/admin/issue-credentials',
      label: 'Mint Credentials',
      id: 'nav-admin-issue-cred',
      icon: <Award className="w-3.5 h-3.5 text-amber-500" />,
    },
    {
      to: '/admin/security',
      label: 'Security & Invariants',
      id: 'nav-admin-security',
      icon: <Lock className="w-3.5 h-3.5 text-amber-500" />,
    },
  ];

  const getActiveNavItems = (): NavItemConfig[] => {
    if (!user) return publicNavItems;
    if (
      activeRole === 'creator' ||
      (activePersona as string) === 'client' ||
      (activePersona as string) === 'creator'
    ) {
      return creatorNavItems;
    }
    switch (activeRole) {
      case 'enterprise':
        return enterpriseNavItems;
      case 'admin':
        return adminNavItems;
      case 'talent':
      default:
        return talentNavItems;
    }
  };

  const navItems = getActiveNavItems();

  return (
    <nav className="hidden lg:flex items-center gap-1">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          id={item.id}
          className={({ isActive }) =>
            `px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 min-h-[40px] flex items-center gap-1.5 ${
              isActive
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
            }`
          }
        >
          {item.icon}
          <span>{item.label}</span>
          {item.badge !== undefined && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
              {item.badge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
};
