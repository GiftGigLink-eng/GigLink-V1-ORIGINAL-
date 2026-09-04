import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck,
  CheckCircle2,
  Github,
  ExternalLink,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  Edit3,
  Layers,
  Calendar,
  Lock,
  ArrowRight,
  Shield,
  Eye,
} from 'lucide-react';
import { ProjectProof } from '../../types';
import { sortPortfolioProjects } from '../../lib/profileService';

interface ProjectsSectionProps {
  projects: ProjectProof[];
  onAddProject?: () => void;
  onEditProject?: (project: ProjectProof) => void;
  onDeleteProject?: (projectId: string) => void;
  readOnly?: boolean;
  profileUid?: string;
}

type FilterTab = 'all' | 'featured' | 'verified' | 'drafts';

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({
  projects,
  onAddProject,
  onEditProject,
  onDeleteProject,
  readOnly = false,
  profileUid,
}) => {
  const [filter, setFilter] = useState<FilterTab>('all');

  // Sort projects using canonical portfolio prioritization
  const sortedProjects = sortPortfolioProjects(projects || []);

  // Filter projects according to selected tab
  const filteredProjects = sortedProjects.filter((p) => {
    if (filter === 'featured') return p.isFeatured === true;
    if (filter === 'verified') return p.verificationStatus === 'verified';
    if (filter === 'drafts') return p.status === 'draft';
    return true;
  });

  const verifiedCount = (projects || []).filter((p) => p.verificationStatus === 'verified').length;
  const featuredCount = (projects || []).filter((p) => p.isFeatured === true).length;
  const draftCount = (projects || []).filter((p) => p.status === 'draft').length;

  return (
    <div
      id="profile-projects-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5"
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileCheck className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Proof of Work & Project Portfolio
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {projects?.length || 0}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Showcase of shipped deliverables, technical contributions, and verifiable evidence.
          </p>
        </div>

        {!readOnly && onAddProject && (
          <button
            id="add-project-btn"
            onClick={onAddProject}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Deliverable</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      {projects && projects.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-b border-slate-100 dark:border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All Deliverables ({projects.length})
          </button>

          {featuredCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter('featured')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                filter === 'featured'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-100'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Featured ({featuredCount})</span>
            </button>
          )}

          {verifiedCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter('verified')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                filter === 'verified'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Verified Proof ({verifiedCount})</span>
            </button>
          )}

          {!readOnly && draftCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter('drafts')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                filter === 'drafts'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100'
              }`}
            >
              <Lock className="w-3 h-3" />
              <span>Drafts ({draftCount})</span>
            </button>
          )}
        </div>
      )}

      {/* Projects Grid */}
      {filteredProjects && filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((project) => {
            const isVerified = project.verificationStatus === 'verified';
            const detailUrl = readOnly && profileUid
              ? `/p/${profileUid}/project/${project.id}`
              : `/profile/project/${project.id}`;

            return (
              <div
                key={project.id}
                id={`project-card-${project.id}`}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  project.isFeatured
                    ? 'bg-gradient-to-b from-amber-50/40 to-slate-50 dark:from-amber-950/20 dark:to-slate-800/60 border-amber-200/80 dark:border-amber-900/50 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80'
                }`}
              >
                <div className="space-y-3">
                  {/* Card Header: Title, Featured Pill, Verification Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {project.isFeatured && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                            <Sparkles className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                            <span>Featured</span>
                          </span>
                        )}

                        {isVerified ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-md flex items-center gap-1 border border-emerald-200 dark:border-emerald-900">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-200/70 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-md flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-slate-400" />
                            <span>Self-Declared</span>
                          </span>
                        )}

                        {project.status === 'draft' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded-md flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Draft</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug pt-1">
                        <Link
                          to={detailUrl}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          {project.title}
                        </Link>
                      </h3>

                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          {project.role}
                        </span>{' '}
                        • {project.completedAt}
                      </p>
                    </div>

                    {/* Owner Card Action Buttons */}
                    {!readOnly && (
                      <div className="flex items-center gap-1 shrink-0">
                        {onEditProject && (
                          <button
                            onClick={() => onEditProject(project)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            title="Edit deliverable"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteProject && (
                          <button
                            onClick={() => onDeleteProject(project.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            title="Delete deliverable"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Summary / Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                    {project.summary || project.description}
                  </p>

                  {/* Skills tags */}
                  {project.skillsUsed && project.skillsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {project.skillsUsed.slice(0, 5).map((skill, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-medium px-2 py-0.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-md"
                        >
                          {skill}
                        </span>
                      ))}
                      {project.skillsUsed.length > 5 && (
                        <span className="text-[10px] text-slate-400 px-1 py-0.5">
                          +{project.skillsUsed.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer: Evidence Links & Case Study Detail Trigger */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700/60 text-xs">
                  <div className="flex items-center gap-3">
                    {project.repositoryUrl && (
                      <a
                        href={project.repositoryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 font-medium"
                      >
                        <Github className="w-3.5 h-3.5" />
                        <span>Code</span>
                      </a>
                    )}
                    {project.projectUrl && (
                      <a
                        href={project.projectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Live Demo</span>
                      </a>
                    )}
                  </div>

                  <Link
                    to={detailUrl}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                  >
                    <span>View Case Study</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400">
            <FileCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {filter === 'all'
                ? 'No Portfolio Deliverables Added Yet'
                : `No deliverables found under "${filter}" filter`}
            </p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">
              Attach shipped deliverables with active code repositories or deployed demos to build verifiable proof of work.
            </p>
          </div>
          {!readOnly && onAddProject && (
            <button
              onClick={onAddProject}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Your First Deliverable</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
