import React, { useState } from 'react';
import { X, Briefcase, Loader2, AlertCircle } from 'lucide-react';
import { ExperienceItem } from '../../types';

interface AddExperienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (experience: Omit<ExperienceItem, 'id' | 'verificationStatus'>) => Promise<void>;
}

export const AddExperienceModal: React.FC<AddExperienceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [organizationName, setOrganizationName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [type, setType] = useState<ExperienceItem['type']>('employment');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationName.trim()) {
      setError('Organization or Company name is required.');
      return;
    }
    if (!roleTitle.trim()) {
      setError('Role title is required.');
      return;
    }
    if (!startDate.trim()) {
      setError('Start date is required.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await onSubmit({
        organizationName: organizationName.trim(),
        roleTitle: roleTitle.trim(),
        type,
        startDate: startDate.trim(),
        endDate: isCurrent ? undefined : endDate.trim() || undefined,
        isCurrent,
        location: location.trim() || undefined,
        description: description.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save experience.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="add-experience-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Add Professional Experience
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Document past employment, internship, apprenticeship, or freelance roles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Role Title */}
          <div className="space-y-1.5">
            <label
              htmlFor="exp-role-input"
              className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
            >
              Role Title *
            </label>
            <input
              id="exp-role-input"
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. Lead Software Architect"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              required
            />
          </div>

          {/* Organization Name & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="exp-org-input"
                className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
              >
                Organization / Company *
              </label>
              <input
                id="exp-org-input"
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="e.g. Acme Tech Solutions"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="exp-type-select"
                className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
              >
                Engagement Type
              </label>
              <select
                id="exp-type-select"
                value={type}
                onChange={(e) => setType(e.target.value as ExperienceItem['type'])}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="employment">Full-Time / Part-Time Employment</option>
                <option value="contract">Contract / Freelance</option>
                <option value="internship">Internship</option>
                <option value="apprenticeship">Apprenticeship</option>
                <option value="freelance">Freelance Project</option>
              </select>
            </div>
          </div>

          {/* Dates & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="exp-start-input"
                className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
              >
                Start Date *
              </label>
              <input
                id="exp-start-input"
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="e.g. Jan 2022"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="exp-end-input"
                className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
              >
                End Date
              </label>
              <input
                id="exp-end-input"
                type="text"
                value={endDate}
                disabled={isCurrent}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder={isCurrent ? 'Present' : 'e.g. Dec 2024'}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="exp-is-current"
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
            />
            <label
              htmlFor="exp-is-current"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              I am currently working in this role
            </label>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <label
              htmlFor="exp-loc-input"
              className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
            >
              Location (e.g. City, Country or Remote)
            </label>
            <input
              id="exp-loc-input"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. London, UK / Remote"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label
              htmlFor="exp-desc-input"
              className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
            >
              Role Description & Key Accomplishments
            </label>
            <textarea
              id="exp-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe your primary responsibilities, team impact, and technical systems engineered."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-experience-btn"
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Position</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
