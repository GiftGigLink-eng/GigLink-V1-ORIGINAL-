import React, { useState } from 'react';
import { X, GraduationCap, Loader2, AlertCircle } from 'lucide-react';
import { EducationItem } from '../../types';

interface AddEducationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (education: Omit<EducationItem, 'id' | 'verificationStatus'>) => Promise<void>;
}

export const AddEducationModal: React.FC<AddEducationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [institutionName, setInstitutionName] = useState('');
  const [degree, setDegree] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [gradeOrGpa, setGradeOrGpa] = useState('');
  const [description, setDescription] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionName.trim()) {
      setError('Institution / University name is required.');
      return;
    }
    if (!degree.trim()) {
      setError('Degree or Diploma title is required.');
      return;
    }
    if (!fieldOfStudy.trim()) {
      setError('Field of Study is required.');
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
        institutionName: institutionName.trim(),
        degree: degree.trim(),
        fieldOfStudy: fieldOfStudy.trim(),
        startDate: startDate.trim(),
        endDate: isCurrent ? undefined : endDate.trim() || undefined,
        isCurrent,
        gradeOrGpa: gradeOrGpa.trim() || undefined,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save education.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="add-education-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Add Academic Education
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Document degrees, diplomas, or vocational study programs
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

          {/* Institution */}
          <div className="space-y-1.5">
            <label
              htmlFor="edu-inst-input"
              className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
            >
              Institution / University *
            </label>
            <input
              id="edu-inst-input"
              type="text"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              placeholder="e.g. Stanford University / Oxford"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              required
            />
          </div>

          {/* Degree & Field */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="edu-degree-input"
                className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
              >
                Degree / Qualification *
              </label>
              <input
                id="edu-degree-input"
                type="text"
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                placeholder="e.g. Bachelor of Science (B.Sc.)"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edu-field-input"
                className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
              >
                Field of Study *
              </label>
              <input
                id="edu-field-input"
                type="text"
                value={fieldOfStudy}
                onChange={(e) => setFieldOfStudy(e.target.value)}
                placeholder="e.g. Computer Science"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="edu-start-input"
                className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
              >
                Start Year / Date *
              </label>
              <input
                id="edu-start-input"
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="e.g. 2019"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edu-end-input"
                className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
              >
                End Year / Date
              </label>
              <input
                id="edu-end-input"
                type="text"
                value={endDate}
                disabled={isCurrent}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder={isCurrent ? 'Present' : 'e.g. 2023'}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="edu-is-current"
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
            />
            <label
              htmlFor="edu-is-current"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              I am currently enrolled in this degree program
            </label>
          </div>

          {/* Grade / GPA */}
          <div className="space-y-1.5">
            <label
              htmlFor="edu-gpa-input"
              className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
            >
              Grade / Honors / GPA (Optional)
            </label>
            <input
              id="edu-gpa-input"
              type="text"
              value={gradeOrGpa}
              onChange={(e) => setGradeOrGpa(e.target.value)}
              placeholder="e.g. First Class Honours / 3.9 GPA"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label
              htmlFor="edu-desc-input"
              className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
            >
              Program Details & Focus Areas
            </label>
            <textarea
              id="edu-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Key coursework, research dissertation, honors, or academic societies."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Actions */}
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
              id="save-education-btn"
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
                <span>Save Education</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
