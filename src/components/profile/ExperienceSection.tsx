import React from 'react';
import { Briefcase, CheckCircle2, Plus, Trash2, MapPin, Calendar, Clock } from 'lucide-react';
import { ExperienceItem } from '../../types';

interface ExperienceSectionProps {
  experience: ExperienceItem[];
  onAddExperience?: () => void;
  onDeleteExperience?: (id: string) => void;
  readOnly?: boolean;
}

export const ExperienceSection: React.FC<ExperienceSectionProps> = ({
  experience,
  onAddExperience,
  onDeleteExperience,
  readOnly = false,
}) => {
  return (
    <div
      id="profile-experience-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Experience & Professional History
            </h2>
            <span className="text-xs text-slate-400">({experience.length})</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified roles, apprenticeships, internships, and freelance contracts.
          </p>
        </div>

        {!readOnly && onAddExperience && (
          <button
            id="add-experience-btn"
            onClick={onAddExperience}
            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Experience</span>
          </button>
        )}
      </div>

      {experience && experience.length > 0 ? (
        <div className="space-y-4 pt-1">
          {experience.map((item) => (
            <div
              key={item.id}
              className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2 relative"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.roleTitle}
                    </h3>
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      @ {item.organizationName}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md">
                      {item.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {item.startDate} — {item.isCurrent ? 'Present' : item.endDate || 'N/A'}
                      </span>
                    </span>

                    {item.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{item.location}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.verificationStatus === 'verified' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full flex items-center gap-1 border border-emerald-200 dark:border-emerald-900">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Verified Organization</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Self-Reported</span>
                    </span>
                  )}

                  {!readOnly && onDeleteExperience && (
                    <button
                      onClick={() => onDeleteExperience(item.id)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-md transition-colors"
                      title="Delete experience"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {item.description && (
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                  {item.description}
                </p>
              )}

              {item.skillsUsed && item.skillsUsed.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {item.skillsUsed.map((skill, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-medium px-2 py-0.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-md"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <Briefcase className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            No Experience Records Added
          </p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Document your professional employment, internships, apprenticeships, or contract roles.
          </p>
          {!readOnly && onAddExperience && (
            <button
              onClick={onAddExperience}
              className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Add a professional position
            </button>
          )}
        </div>
      )}
    </div>
  );
};
