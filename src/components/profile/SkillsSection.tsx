import React, { useState } from 'react';
import { Award, CheckCircle2, Edit3, Plus, Sparkles, ShieldCheck } from 'lucide-react';
import { SkillItem } from '../../types';
import { RequestItemVerificationModal } from './RequestItemVerificationModal';

interface SkillsSectionProps {
  skills: SkillItem[];
  onManageSkills?: () => void;
  readOnly?: boolean;
}

export const SkillsSection: React.FC<SkillsSectionProps> = ({
  skills,
  onManageSkills,
  readOnly = false,
}) => {
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);

  return (
    <div
      id="profile-skills-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Skills & Core Competencies
            </h2>
            <span className="text-xs text-slate-400">({skills.length})</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Standardized competencies across frontend, backend, cloud, and systems.
          </p>
        </div>

        {!readOnly && onManageSkills && (
          <button
            id="manage-skills-btn"
            onClick={onManageSkills}
            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Manage Skills</span>
          </button>
        )}
      </div>

      {skills && skills.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          {skills.map((skill) => (
            <div
              key={skill.id || skill.name}
              className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-center justify-between gap-2 transition-all hover:border-indigo-300 dark:hover:border-indigo-800"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {skill.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="capitalize">{skill.category || 'General'}</span>
                  <span>•</span>
                  <span className="capitalize">{skill.proficiency}</span>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                {skill.verifiedCount && skill.verifiedCount > 0 ? (
                  <span
                    title={`${skill.verifiedCount} verified endorsement${
                      skill.verifiedCount > 1 ? 's' : ''
                    }`}
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Verified ({skill.verifiedCount})</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                      Self-Declared
                    </span>
                    {!readOnly && (
                      <button
                        onClick={() => setSelectedSkill(skill)}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 p-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded cursor-pointer transition-colors"
                        title="Request verification for this skill"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <Award className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            No Skills Added Yet
          </p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Select skills from the canonical catalogue to highlight your technical capabilities to counterparties.
          </p>
          {!readOnly && onManageSkills && (
            <button
              onClick={onManageSkills}
              className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Add skills from catalogue
            </button>
          )}
        </div>
      )}

      {selectedSkill && (
        <RequestItemVerificationModal
          isOpen={Boolean(selectedSkill)}
          onClose={() => setSelectedSkill(null)}
          itemType="skill"
          itemName={selectedSkill.name}
          itemId={selectedSkill.id}
        />
      )}
    </div>
  );
};
