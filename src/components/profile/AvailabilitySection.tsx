import React, { useState } from 'react';
import {
  Clock,
  Calendar,
  Briefcase,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Edit3,
} from 'lucide-react';
import { WorkAvailability, AvailabilityStatus, EngagementTypePreference } from '../../types';

interface AvailabilitySectionProps {
  availability?: WorkAvailability;
  isEditable?: boolean;
  onSaveAvailability?: (availability: WorkAvailability) => Promise<void>;
}

export const AvailabilitySection: React.FC<AvailabilitySectionProps> = ({
  availability,
  isEditable = false,
  onSaveAvailability,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<AvailabilityStatus>(availability?.status || 'available');
  const [preferredEngagement, setPreferredEngagement] = useState<EngagementTypePreference>(
    availability?.preferredEngagement || 'flexible'
  );
  const [availableFrom, setAvailableFrom] = useState<string>(availability?.availableFrom || '');
  const [hoursPerWeek, setHoursPerWeek] = useState<string>(
    availability?.hoursPerWeek ? String(availability.hoursPerWeek) : ''
  );
  const [workLocationPreference, setWorkLocationPreference] = useState<'remote' | 'hybrid' | 'onsite' | 'flexible'>(
    availability?.workLocationPreference || 'flexible'
  );
  const [saving, setSaving] = useState(false);

  const getStatusBadge = (s: AvailabilityStatus) => {
    switch (s) {
      case 'available':
        return {
          label: 'Available for Opportunities',
          badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          dotClass: 'bg-emerald-500',
        };
      case 'partially_available':
        return {
          label: 'Partially Available / Select Gigs',
          badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300 border-sky-200 dark:border-sky-800',
          dotClass: 'bg-sky-500',
        };
      case 'busy':
        return {
          label: 'Engaged on Contracts',
          badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          dotClass: 'bg-amber-500',
        };
      case 'not_available':
      default:
        return {
          label: 'Not Currently Available',
          badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
          dotClass: 'bg-slate-400',
        };
    }
  };

  const getEngagementLabel = (pref: EngagementTypePreference) => {
    switch (pref) {
      case 'full_time':
        return 'Full-Time Engagements';
      case 'part_time':
        return 'Part-Time (20h/wk)';
      case 'contract':
        return 'Fixed-Scope Milestones';
      case 'apprenticeship':
        return 'Apprenticeship / Mentorship';
      case 'flexible':
      default:
        return 'Flexible / Open to All';
    }
  };

  const activeStatus = getStatusBadge(availability?.status || 'available');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveAvailability) return;
    setSaving(true);
    try {
      await onSaveAvailability({
        status,
        preferredEngagement,
        availableFrom: availableFrom || null,
        hoursPerWeek: hoursPerWeek ? parseInt(hoursPerWeek, 10) : null,
        workLocationPreference,
      });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="availability-preferences-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Availability & Work Preferences
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clear terms for counterparty opportunity matching
            </p>
          </div>
        </div>

        {isEditable && onSaveAvailability && !isEditing && (
          <button
            id="edit-availability-btn"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-xl transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Update Terms</span>
          </button>
        )}
      </div>

      {!isEditing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Status Badge */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Engagement Status
            </span>
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className={`w-2 h-2 rounded-full ${activeStatus.dotClass}`} />
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                {activeStatus.label}
              </span>
            </div>
          </div>

          {/* Preferred Engagement */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Preferred Engagement
            </span>
            <div className="flex items-center gap-1.5 pt-0.5 text-xs font-semibold text-slate-900 dark:text-white">
              <Briefcase className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>{getEngagementLabel(availability?.preferredEngagement || 'flexible')}</span>
            </div>
          </div>

          {/* Available From */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Available From
            </span>
            <div className="flex items-center gap-1.5 pt-0.5 text-xs font-semibold text-slate-900 dark:text-white">
              <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{availability?.availableFrom ? availability.availableFrom : 'Immediate'}</span>
            </div>
          </div>

          {/* Location Preference */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Work Location
            </span>
            <div className="flex items-center gap-1.5 pt-0.5 text-xs font-semibold text-slate-900 dark:text-white capitalize">
              <MapPin className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span>
                {availability?.workLocationPreference || 'Flexible'}
                {availability?.hoursPerWeek ? ` • ${availability.hoursPerWeek}h/wk` : ''}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Status Selector */}
            <div className="space-y-1">
              <label htmlFor="availability-status-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Availability Status
              </label>
              <select
                id="availability-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as AvailabilityStatus)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="available">Available for Opportunities</option>
                <option value="partially_available">Partially Available (Select Projects)</option>
                <option value="busy">Busy / Active on Contracts</option>
                <option value="not_available">Not Available</option>
              </select>
            </div>

            {/* Engagement Preference */}
            <div className="space-y-1">
              <label htmlFor="preferred-engagement-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Preferred Engagement Type
              </label>
              <select
                id="preferred-engagement-select"
                value={preferredEngagement}
                onChange={(e) => setPreferredEngagement(e.target.value as EngagementTypePreference)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="flexible">Flexible / Open to All</option>
                <option value="contract">Fixed-Scope Milestones</option>
                <option value="part_time">Part-Time Contract</option>
                <option value="full_time">Full-Time Commitment</option>
                <option value="apprenticeship">Apprenticeship / Mentorship</option>
              </select>
            </div>

            {/* Available From Date */}
            <div className="space-y-1">
              <label htmlFor="available-from-date-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Available From (Leave empty for Immediate)
              </label>
              <input
                id="available-from-date-input"
                type="date"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Location Preference & Hours */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="work-location-pref-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Location Mode
                </label>
                <select
                  id="work-location-pref-select"
                  value={workLocationPreference}
                  onChange={(e) => setWorkLocationPreference(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="flexible">Flexible</option>
                  <option value="remote">Remote Only</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-Site</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="hours-per-week-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Hours/Week
                </label>
                <input
                  id="hours-per-week-input"
                  type="number"
                  min="1"
                  max="80"
                  placeholder="e.g. 30"
                  value={hoursPerWeek}
                  onChange={(e) => setHoursPerWeek(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={saving}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-availability-terms-btn"
              type="submit"
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
            >
              {saving ? 'Saving...' : 'Save Availability'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
