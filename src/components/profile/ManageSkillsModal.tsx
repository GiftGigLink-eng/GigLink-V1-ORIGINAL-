import React, { useState } from 'react';
import { X, Award, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { SkillItem } from '../../types';
import { SearchableSkillSelector } from '../common/SearchableSkillSelector';
import { APPROVED_SKILLS_CATALOGUE } from '../../lib/catalogue/skills';

interface ManageSkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSkills: SkillItem[];
  onSubmit: (skills: SkillItem[]) => Promise<void>;
}

export const ManageSkillsModal: React.FC<ManageSkillsModalProps> = ({
  isOpen,
  onClose,
  initialSkills,
  onSubmit,
}) => {
  const [skillsList, setSkillsList] = useState<SkillItem[]>(initialSkills || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectedNamesChange = (names: string[]) => {
    // Merge new skills preserving existing verified counts and proficiencies
    const updated = names.map((name) => {
      const existing = skillsList.find((s) => s.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing;

      const catalogueItem = APPROVED_SKILLS_CATALOGUE.find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );
      return {
        id: `skill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name,
        category: catalogueItem?.category || 'General',
        proficiency: 'intermediate' as const,
        verifiedCount: 0,
      };
    });
    setSkillsList(updated);
  };

  const handleProficiencyChange = (
    id: string,
    proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  ) => {
    setSkillsList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, proficiency } : s))
    );
  };

  const handleRemoveSkill = (id: string) => {
    setSkillsList((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await onSubmit(skillsList);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update skills.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="manage-skills-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Manage Professional Skills
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select core competencies from the canonical catalogue
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Searchable Skill Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Search & Add Skills
            </label>
            <SearchableSkillSelector
              selectedSkills={skillsList.map((s) => s.name)}
              onChange={handleSelectedNamesChange}
              hideLabel
            />
          </div>

          {/* Configured Skills List with Proficiency Selector */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Proficiency Level per Skill ({skillsList.length})
            </h3>

            {skillsList.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No skills selected yet. Use the search bar above to select skills.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {skillsList.map((skill) => (
                  <div
                    key={skill.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {skill.name}
                      </p>
                      <p className="text-[10px] text-slate-400 capitalize">
                        {skill.category}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Proficiency for ${skill.name}`}
                        value={skill.proficiency}
                        onChange={(e) =>
                          handleProficiencyChange(
                            skill.id,
                            e.target.value as 'beginner' | 'intermediate' | 'advanced' | 'expert'
                          )
                        }
                        className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="expert">Expert</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="Remove skill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-skills-changes-btn"
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Skills...</span>
                </>
              ) : (
                <span>Save Skills</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
