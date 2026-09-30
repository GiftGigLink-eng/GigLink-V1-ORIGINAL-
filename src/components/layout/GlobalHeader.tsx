import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GIGLINK_ROLES } from '../../types';
import { NotificationDropdown } from '../common/NotificationDropdown';
import { PersonaSwitcher } from './PersonaSwitcher';
import { RoleNavigation } from './RoleNavigation';
import {
  Shield,
  Menu,
  LogOut,
  LogIn,
  User,
  Settings,
  Compass,
  Building2,
  Sparkles,
} from 'lucide-react';

interface GlobalHeaderProps {
  onToggleMobileNav: () => void;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  onToggleMobileNav,
}) => {
  const { user, profile, activeRole, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();

  const currentRoleDef = GIGLINK_ROLES[activeRole] || GIGLINK_ROLES.talent;
  const brandTargetRoute = user ? currentRoleDef.homeRoute : '/';

  return (
    <header
      id="global-header"
      className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand Identity & Role-Specific Desktop Navigation */}
          <div className="flex items-center gap-6">
            <Link
              to={brandTargetRoute}
              className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 rounded-xl p-1"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-lg shadow-sm">
                G
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                  GigLink
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  {user ? currentRoleDef.badge : 'Trust Protocol'}
                </span>
              </div>
            </Link>

            {/* Role-Specific Desktop Navigation */}
            <RoleNavigation />
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Persona / Role Switcher (Authenticated Users) */}
            {user && <PersonaSwitcher />}

            {/* Quick Actions (Notifications) */}
            {user && <NotificationDropdown />}

            {/* User Profile Avatar / Sign In Button */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs border border-indigo-200 dark:border-indigo-900 min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  aria-label="User Account Menu"
                >
                  {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
                </button>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                    onMouseLeave={() => setShowUserMenu(false)}
                  >
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {profile?.displayName || 'User'}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${currentRoleDef.bgColor} ${currentRoleDef.textColor}`}>
                          {currentRoleDef.label}
                        </span>
                        {user.emailVerified ? (
                          <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Verified
                          </span>
                        ) : (
                          <Link
                            to="/auth/verify-email"
                            onClick={() => setShowUserMenu(false)}
                            className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:underline"
                          >
                            Verify Email
                          </Link>
                        )}
                      </div>
                    </div>

                    <button
                      id="user-menu-my-profile-btn"
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/profile');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 min-h-[40px]"
                    >
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                      <span>My Profile</span>
                    </button>

                    <button
                      id="user-menu-trust-passport-btn"
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/talent/passport');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 min-h-[40px]"
                    >
                      <Shield className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Trust Passport</span>
                    </button>

                    <button
                      id="user-menu-public-preview-btn"
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/profile/preview');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 min-h-[40px]"
                    >
                      <Compass className="w-3.5 h-3.5 text-amber-500" />
                      <span>Public Profile Preview</span>
                    </button>

                    {profile?.organizationId && (
                      <button
                        id="user-menu-org-profile-btn"
                        onClick={() => {
                          setShowUserMenu(false);
                          navigate(`/org/${profile.organizationId}`);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 min-h-[40px]"
                      >
                        <Building2 className="w-3.5 h-3.5 text-purple-500" />
                        <span>Organization Profile</span>
                      </button>
                    )}

                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        signOut();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-600 dark:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 min-h-[40px]"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/auth/login"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors min-h-[44px]"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/auth/register"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors min-h-[44px]"
                >
                  <span>Register</span>
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={onToggleMobileNav}
              className="lg:hidden p-2.5 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle Mobile Navigation Drawer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

