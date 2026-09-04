import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  Sparkles,
  XCircle,
  ShieldCheck,
  ArrowRight,
  CheckCheck,
  FileText,
  DollarSign,
  MessageSquare,
  AlertTriangle,
  FileSignature,
  Layers,
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { AppNotification } from '../../types';

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

function getNotificationIcon(type: AppNotification['type']) {
  switch (type) {
    case 'application_accepted':
    case 'milestone_approved':
    case 'project_completed':
    case 'final_handover_accepted':
      return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    case 'application_shortlisted':
      return <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    case 'application_under_review':
      return <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    case 'application_declined':
    case 'application_withdrawn':
    case 'change_request_rejected':
    case 'change_request_withdrawn':
      return <XCircle className="w-4 h-4 text-slate-400" />;
    case 'verification_verified':
      return <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    case 'verification_rejected':
      return <XCircle className="w-4 h-4 text-rose-500" />;
    case 'contract_activated':
    case 'contract_amended':
    case 'change_request_created':
    case 'change_request_approved':
      return <FileSignature className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    case 'milestone_submitted':
    case 'milestone_in_review':
    case 'final_handover_submitted':
      return <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
    case 'milestone_revision_requested':
    case 'additional_funding_required':
      return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    case 'milestone_funded':
    case 'milestone_payment_released':
    case 'payout_initiated':
    case 'payout_completed':
      return <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    case 'refund_initiated':
    case 'refund_completed':
    case 'payment_failed':
      return <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
    case 'new_project_message':
      return <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    case 'application_submitted':
    default:
      return <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
  }
}

export const NotificationDropdown: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => {
  const navigate = useNavigate();
  const { user, activePersona } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notif: AppNotification) => {
    markAsRead(notif.id);
    setIsOpen(false);
    navigate(notif.linkUrl);
  };

  const getWorkspaceDestination = () => {
    if (activePersona === 'creator') return '/creator/dashboard';
    if (activePersona === 'enterprise') return '/enterprise/dashboard';
    return '/my-applications';
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        id="notification-bell-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        aria-expanded={isOpen}
        className={`relative flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[44px] min-h-[44px] ${
          isMobile ? 'w-full justify-start px-3' : 'w-11 h-11'
        }`}
      >
        <div className="relative flex items-center">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span
              id="notification-unread-badge"
              className="absolute -top-1 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-indigo-600 rounded-full border-2 border-white dark:border-slate-900 shadow-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        {isMobile && (
          <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          id="notification-panel"
          className={`absolute z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden ${
            isMobile
              ? 'top-12 left-0 right-0 w-full max-w-[340px]'
              : 'top-12 right-0 w-80 sm:w-96'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                id="mark-all-read-btn"
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline min-h-[32px] px-2"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 sm:max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  No notifications yet
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Updates on your applications and verifications will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  id={`notification-item-${notif.id}`}
                  type="button"
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left p-3.5 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-start gap-3 min-h-[44px] ${
                    notif.read
                      ? 'bg-transparent opacity-85'
                      : 'bg-indigo-50/40 dark:bg-indigo-950/20'
                  }`}
                >
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p
                        className={`text-xs font-semibold truncate ${
                          notif.read
                            ? 'text-slate-800 dark:text-slate-200'
                            : 'text-indigo-950 dark:text-indigo-200 font-bold'
                        }`}
                      >
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1.5 shadow-xs" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate(getWorkspaceDestination());
                }}
                className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1.5 min-h-[44px] px-3 transition-colors"
              >
                <span>
                  {activePersona === 'creator'
                    ? 'Go to Creator Hiring Hub'
                    : activePersona === 'enterprise'
                    ? 'Go to Enterprise Command Center'
                    : 'View all my applications'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
