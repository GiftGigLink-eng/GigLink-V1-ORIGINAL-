import React, { useState } from 'react';
import { FileCheck, X, Loader2, ArrowRight, Github, ExternalLink, AlertCircle } from 'lucide-react';
import { ProjectProof } from '../../types';
import { SearchableSkillSelector } from '../common/SearchableSkillSelector';

interface AddProjectProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (proof: Omit<ProjectProof, 'id' | 'verificationStatus'>) => Promise<void>;
}

export const AddProjectProofModal: React.FC<AddProjectProofModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('Lead Contributor');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [skillsUsed, setSkillsUsed] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a project title.');
      return;
    }
    if (!description.trim() || description.length < 20) {
      setError('Please provide a descriptive overview of at least 20 characters.');
      return;
    }
    if (!repositoryUrl.trim() && !projectUrl.trim()) {
      setError('Please provide at least a GitHub/Repository URL or a Live Project URL as proof.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        role: role.trim(),
        repositoryUrl: repositoryUrl.trim() || undefined,
        projectUrl: projectUrl.trim() || undefined,
        skillsUsed,
        completedAt: new Date().toISOString().split('T')[0],
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save project proof.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        id="add-project-proof-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Add Verifiable Proof of Work
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Each verified deliverable adds +10 Trust Score points
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="project-title-input" className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Project Title
            </label>
            <input
              id="project-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. GigLink Decentralized Trust Engine"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              required
            />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label htmlFor="project-role-input" className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Your Role / Contribution
            </label>
            <input
              id="project-role-input"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Full-Stack Engineer, Lead Designer"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="project-desc-input" className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Deliverable Summary & Outcomes
            </label>
            <textarea
              id="project-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the architectural scope, technical implementation, and measurable outcomes achieved."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none"
              required
            />
          </div>

          {/* Links Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="project-repo-input" className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1">
                <Github className="w-3.5 h-3.5" />
                <span>Code Repository URL</span>
              </label>
              <input
                id="project-repo-input"
                type="url"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="project-live-input" className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Live Demonstration URL</span>
              </label>
              <input
                id="project-live-input"
                type="url"
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                placeholder="https://project.domain.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Skills Tag Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Skills Demonstrated in Deliverable
            </label>
            <SearchableSkillSelector
              selectedSkills={skillsUsed}
              onChange={setSkillsUsed}
              hideLabel
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-project-proof-btn"
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Deliverable...</span>
                </>
              ) : (
                <>
                  <span>Save Deliverable Proof</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
