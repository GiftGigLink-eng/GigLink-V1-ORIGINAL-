import React from 'react';
import { GraduationCap, CheckCircle2, Plus, Trash2, Calendar, Clock } from 'lucide-react';
import { EducationItem } from '../../types';

interface EducationSectionProps {
  education: EducationItem[];
  onAddEducation?: () => void;
  onDeleteEducation?: (id: string) => void;
  readOnly?: boolean;
}

export const EducationSection: React.FC<EducationSectionProps> = ({
  education,
  onAddEducation,
  onDeleteEducation,
  readOnly = false,
}) => {
  return (
    <div
      id="profile-education-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Education & Academic Background
            </h2>
            <span className="text-xs text-slate-400">({education.length})</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Accredited degrees, diplomas, and ongoing higher education programs.
          </p>
        </div>

        {!readOnly && onAddEducation && (
          <button
            id="add-education-btn"
            onClick={onAddEducation}
            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Education</span>
          </button>
        )}
      </div>

      {education && education.length > 0 ? (
        <div className="space-y-4 pt-1">
          {education.map((item) => (
            <div
              key={item.id}
              className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2 relative"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {item.degree} in {item.fieldOfStudy}
                  </h3>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {item.institutionName}
                  </p>

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {item.startDate} — {item.isCurrent ? 'Present' : item.endDate || 'N/A'}
                      </span>
                    </span>

                    {item.gradeOrGpa && (
                      <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-semibold">
                        Grade / GPA: {item.gradeOrGpa}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.verificationStatus === 'verified' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full flex items-center gap-1 border border-emerald-200 dark:border-emerald-900">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Verified Institution</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Self-Declared</span>
                    </span>
                  )}

                  {!readOnly && onDeleteEducation && (
                    <button
                      onClick={() => onDeleteEducation(item.id)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-md transition-colors"
                      title="Delete education"
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
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <GraduationCap className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            No Education Records Added
          </p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Add academic credentials, university degrees, or certified vocational studies.
          </p>
          {!readOnly && onAddEducation && (
            <button
              onClick={onAddEducation}
              className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Add academic degree or program
            </button>
          )}
        </div>
      )}
    </div>
  );
};
