import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  X,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Github,
  ExternalLink,
  AlertCircle,
  Sparkles,
  Layers,
  Calendar,
  CheckCircle2,
  Plus,
  Trash2,
  Image as ImageIcon,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { ProjectProof, ProjectStatus } from '../../types';
import { SearchableSkillSelector } from '../common/SearchableSkillSelector';

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (proof: Omit<ProjectProof, 'id' | 'verificationStatus' | 'verifierUid' | 'verifierName' | 'verifiedAt'>) => Promise<void>;
  initialProject?: ProjectProof | null;
  mode?: 'create' | 'edit';
}

type TabKey = 'overview' | 'skills' | 'evidence';

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialProject,
  mode = 'create',
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Form State
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('Lead Contributor');
  const [status, setStatus] = useState<ProjectStatus>('published');
  const [isFeatured, setIsFeatured] = useState(false);

  const [skillsUsed, setSkillsUsed] = useState<string[]>([]);
  const [completedAt, setCompletedAt] = useState('');

  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [newDeliverable, setNewDeliverable] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset form state when modal opens or initialProject changes
  useEffect(() => {
    if (isOpen) {
      if (initialProject) {
        setTitle(initialProject.title || '');
        setSummary(initialProject.summary || '');
        setDescription(initialProject.description || '');
        setRole(initialProject.role || 'Lead Contributor');
        setStatus(initialProject.status || 'published');
        setIsFeatured(initialProject.isFeatured || false);
        setSkillsUsed(initialProject.skillsUsed || []);
        setCompletedAt(initialProject.completedAt || new Date().toISOString().split('T')[0]);
        setRepositoryUrl(initialProject.repositoryUrl || '');
        setProjectUrl(initialProject.projectUrl || '');
        setExternalUrl(initialProject.externalUrl || '');
        setPreviewImage(initialProject.previewImage || '');
        setDeliverables(initialProject.deliverables || []);
      } else {
        setTitle('');
        setSummary('');
        setDescription('');
        setRole('Lead Contributor');
        setStatus('published');
        setIsFeatured(false);
        setSkillsUsed([]);
        setCompletedAt(new Date().toISOString().split('T')[0]);
        setRepositoryUrl('');
        setProjectUrl('');
        setExternalUrl('');
        setPreviewImage('');
        setDeliverables([]);
      }
      setActiveTab('overview');
      setError(null);
    }
  }, [isOpen, initialProject]);

  if (!isOpen) return null;

  const validateOverview = (): boolean => {
    if (!title.trim()) {
      setError('Please provide a project title.');
      setActiveTab('overview');
      return false;
    }
    if (!description.trim() || description.length < 20) {
      setError('Please provide a detailed project description of at least 20 characters.');
      setActiveTab('overview');
      return false;
    }
    if (!role.trim()) {
      setError('Please specify your contributor role.');
      setActiveTab('overview');
      return false;
    }
    return true;
  };

  const validateSkillsAndTimeline = (): boolean => {
    if (skillsUsed.length === 0) {
      setError('Please attach at least one skill used in this project.');
      setActiveTab('skills');
      return false;
    }
    if (!completedAt.trim()) {
      setError('Please specify the completion date.');
      setActiveTab('skills');
      return false;
    }
    return true;
  };

  const handleAddDeliverable = () => {
    if (!newDeliverable.trim()) return;
    setDeliverables([...deliverables, newDeliverable.trim()]);
    setNewDeliverable('');
  };

  const handleRemoveDeliverable = (index: number) => {
    setDeliverables(deliverables.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateOverview()) return;
    if (!validateSkillsAndTimeline()) return;

    setError(null);
    setSubmitting(true);

    try {
      await onSubmit({
        title: title.trim(),
        summary: summary.trim() || undefined,
        description: description.trim(),
        role: role.trim(),
        skillsUsed,
        completedAt: completedAt.trim(),
        status,
        isFeatured,
        repositoryUrl: repositoryUrl.trim() || undefined,
        projectUrl: projectUrl.trim() || undefined,
        externalUrl: externalUrl.trim() || undefined,
        previewImage: previewImage.trim() || undefined,
        deliverables: deliverables.length > 0 ? deliverables : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save portfolio project.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="project-form-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        id="project-form-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {mode === 'edit' ? 'Edit Portfolio Project' : 'Add Verifiable Proof of Work'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showcase what you built, your contribution role, and verifiable deliverables
              </p>
            </div>
          </div>
          <button
            id="close-project-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Navigation Tabs */}
        <div className="px-6 pt-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex gap-2 shrink-0">
          <button
            type="button"
            id="tab-overview-btn"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Overview & Role</span>
          </button>

          <button
            type="button"
            id="tab-skills-btn"
            onClick={() => setActiveTab('skills')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'skills'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>2. Skills & Timeline</span>
          </button>

          <button
            type="button"
            id="tab-evidence-btn"
            onClick={() => setActiveTab('evidence')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'evidence'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>3. Evidence & Links</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Verification Guard Notice for Edit Mode */}
          {mode === 'edit' && initialProject?.verificationStatus === 'verified' && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>Verified Proof:</strong> This project has been validated by{' '}
                {initialProject.verifierName || 'an authoritative verifier'}. Verification stamps remain locked and protected.
              </span>
            </div>
          )}

          {/* SECTION 1: Overview & Role */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Project Title */}
              <div className="space-y-1.5">
                <label
                  htmlFor="project-title-input"
                  className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
                >
                  Project Title <span className="text-rose-500">*</span>
                </label>
                <input
                  id="project-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Distributed Trust Engine & Ledger"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              {/* Short Summary */}
              <div className="space-y-1.5">
                <label
                  htmlFor="project-summary-input"
                  className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
                >
                  Short Summary (One-liner)
                </label>
                <input
                  id="project-summary-input"
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="e.g. High-throughput verification architecture connecting learners and enterprise partners"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Contributor Role */}
              <div className="space-y-1.5">
                <label
                  htmlFor="project-role-input"
                  className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
                >
                  Your Contributor Role <span className="text-rose-500">*</span>
                </label>
                <input
                  id="project-role-input"
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Full-Stack Lead, Backend Architect, UI Designer"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              {/* Detailed Description */}
              <div className="space-y-1.5">
                <label
                  htmlFor="project-desc-input"
                  className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
                >
                  Detailed Description & Architectural Scope <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="project-desc-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Detail the technical architecture, problems solved, specific components built, and measurable engineering outcomes..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none leading-relaxed"
                  required
                />
                <span className="text-[10px] text-slate-400">Minimum 20 characters.</span>
              </div>

              {/* Status & Featured Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label
                    htmlFor="project-status-select"
                    className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
                  >
                    Project Status
                  </label>
                  <select
                    id="project-status-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  >
                    <option value="published">Published (Public in Portfolio)</option>
                    <option value="draft">Draft (Private to Owner)</option>
                    <option value="completed">Completed</option>
                    <option value="in_progress">In Progress</option>
                  </select>
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <label
                    id="project-featured-label"
                    className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <input
                      id="project-featured-checkbox"
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 dark:border-slate-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">
                        Feature in Portfolio
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: Skills & Timeline */}
          {activeTab === 'skills' && (
            <div className="space-y-5 animate-in fade-in duration-100">
              {/* Skills Used */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Skills & Technologies Used <span className="text-rose-500">*</span>
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select key languages, frameworks, or methodologies applied in this deliverable.
                </p>
                <SearchableSkillSelector
                  selectedSkills={skillsUsed}
                  onChange={setSkillsUsed}
                  hideLabel
                />
              </div>

              {/* Completion Date */}
              <div className="space-y-1.5 pt-2">
                <label
                  htmlFor="project-date-input"
                  className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Completion Date <span className="text-rose-500">*</span></span>
                </label>
                <input
                  id="project-date-input"
                  type="date"
                  value={completedAt}
                  onChange={(e) => setCompletedAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>
          )}

          {/* SECTION 3: Evidence, Deliverables & Media */}
          {activeTab === 'evidence' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Provide verifiable proof links and concrete deliverables. Backed deliverables earn higher trust credibility.
              </p>

              {/* Code Repository URL */}
              <div className="space-y-1.5">
                <label
                  htmlFor="project-repo-input"
                  className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>Code Repository Link</span>
                </label>
                <input
                  id="project-repo-input"
                  type="url"
                  value={repositoryUrl}
                  onChange={(e) => setRepositoryUrl(e.target.value)}
                  placeholder="https://github.com/username/project"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Live Project URL */}
              <div className="space-y-1.5">
                <label
                  htmlFor="project-url-input"
                  className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Live Deployed Demo URL</span>
                </label>
                <input
                  id="project-url-input"
                  type="url"
                  value={projectUrl}
                  onChange={(e) => setProjectUrl(e.target.value)}
                  placeholder="https://myproject.app or https://demo.example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* External Portfolio URL */}
              <div className="space-y-1.5">
                <label
                  htmlFor="project-external-url-input"
                  className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Portfolio / Case Study URL (Optional)</span>
                </label>
                <input
                  id="project-external-url-input"
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://portfolio.com/project-deep-dive"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Preview Image URL */}
              <div className="space-y-1.5">
                <label
                  htmlFor="project-image-input"
                  className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Preview Thumbnail / Hero Image URL (Optional)</span>
                </label>
                <input
                  id="project-image-input"
                  type="url"
                  value={previewImage}
                  onChange={(e) => setPreviewImage(e.target.value)}
                  placeholder="https://images.unsplash.com/... or hosted screenshot"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
                {previewImage && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 h-28 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <img
                      src={previewImage}
                      alt="Preview thumbnail"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Key Deliverables Bullet Points */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Key Deliverables & Shipped Features
                </label>
                <div className="flex gap-2">
                  <input
                    id="deliverable-item-input"
                    type="text"
                    value={newDeliverable}
                    onChange={(e) => setNewDeliverable(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDeliverable();
                      }
                    }}
                    placeholder="e.g. End-to-end OAuth integration with RBAC authorization"
                    className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    id="add-deliverable-item-btn"
                    onClick={handleAddDeliverable}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {deliverables.length > 0 && (
                  <ul className="space-y-1.5 mt-2">
                    {deliverables.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg text-xs text-slate-700 dark:text-slate-200"
                      >
                        <span className="truncate">• {item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDeliverable(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
            {activeTab !== 'overview' ? (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'evidence') setActiveTab('skills');
                  else if (activeTab === 'skills') setActiveTab('overview');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous Step</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {activeTab !== 'evidence' ? (
                <button
                  type="button"
                  id="next-step-btn"
                  onClick={() => {
                    if (activeTab === 'overview') {
                      if (validateOverview()) {
                        setError(null);
                        setActiveTab('skills');
                      }
                    } else if (activeTab === 'skills') {
                      if (validateSkillsAndTimeline()) {
                        setError(null);
                        setActiveTab('evidence');
                      }
                    }
                  }}
                  className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  id="save-project-btn"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Deliverable...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{mode === 'edit' ? 'Save Changes' : 'Publish Deliverable Proof'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
