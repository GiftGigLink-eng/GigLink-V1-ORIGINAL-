import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GigLinkRole, GIGLINK_ROLES } from '../../types';
import {
  Sparkles,
  ChevronDown,
  Check,
  GraduationCap,
  Briefcase,
  Building2,
  ShieldAlert,
  ShieldCheck,
  Layers,
} from 'lucide-react';

interface PersonaSwitcherProps {
  compact?: boolean;
}

export const PersonaSwitcher: React.FC<PersonaSwitcherProps> = ({ compact = false }) => {
  const { activeRole, allowedRoles, switchRole, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const currentRoleDef = GIGLINK_ROLES[activeRole] || GIGLINK_ROLES.talent;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        return <Layers className="w-4 h-4 text-slate-500" />;
    }
  };

  const handleRoleSelect = async (roleKey: GigLinkRole) => {
    if (roleKey === activeRole) {
      setIsOpen(false);
      return;
    }

    if (!allowedRoles.includes(roleKey)) {
      console.warn(`Attempted to switch to unauthorized role: ${roleKey}`);
      return;
    }

    setIsSwitching(true);
    try {
      await switchRole(roleKey);
      setIsOpen(false);
      const targetHome = GIGLINK_ROLES[roleKey].homeRoute;
      navigate(targetHome);
    } catch (err) {
      console.error('Failed to switch active role:', err);
    } finally {
      setIsSwitching(false);
    }
  };

  if (!user) return null;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        id="persona-switcher-btn"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-150 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
          currentRoleDef.bgColor
        } ${currentRoleDef.borderColor} ${currentRoleDef.textColor} hover:shadow-xs`}
        aria-label="Switch Workspace Role"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5">
          {getRoleIcon(activeRole)}
          <span className="font-bold tracking-tight">{currentRoleDef.badge}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          id="persona-switcher-dropdown"
          className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/10 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Workspace Roles
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span>Single Identity</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">
              Switch role context to view your specialized dashboard and tools.
            </p>
          </div>

          {/* Role List */}
          <div className="p-2 space-y-1">
            {(Object.keys(GIGLINK_ROLES) as GigLinkRole[]).map((roleKey) => {
              const def = GIGLINK_ROLES[roleKey];
              const isSelected = activeRole === roleKey;
              const isAllowed = allowedRoles.includes(roleKey);

              return (
                <button
                  key={roleKey}
                  type="button"
                  id={`role-switch-option-${roleKey}`}
                  disabled={!isAllowed || isSwitching}
                  onClick={() => handleRoleSelect(roleKey)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-start gap-3 min-h-[52px] ${
                    isSelected
                      ? `${def.bgColor} ${def.borderColor} border ${def.textColor} font-bold shadow-xs`
                      : isAllowed
                      ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                      : 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40 text-slate-400'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0 p-1 rounded-lg bg-white dark:bg-slate-800 shadow-xs border border-slate-200 dark:border-slate-700">
                    {getRoleIcon(roleKey)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold truncate text-slate-900 dark:text-white">
                        {def.label}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 ml-1" />}
                    </div>
                    <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                      {def.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-950/70 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
            <span>Permissions and verified records remain tied to your core account.</span>
          </div>
        </div>
      )}
    </div>
  );
};
