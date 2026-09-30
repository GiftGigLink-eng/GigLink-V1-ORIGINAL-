import React from 'react';
import { Target, Users, Edit3, Sparkles } from 'lucide-react';

export interface ClientHiringFocusSectionProps {
  hiringInterests?: string[];
  talentTypes?: string[];
  customHiringNeed?: string;
  isEditable?: boolean;
  onEdit?: () => void;
}

export const ClientHiringFocusSection: React.FC<ClientHiringFocusSectionProps> = ({
  hiringInterests = [],
  talentTypes = [],
  customHiringNeed,
  isEditable = false,
  onEdit,
}) => {
  const hasInterests = Array.isArray(hiringInterests) && hiringInterests.length > 0;
  const hasTalentTypes = Array.isArray(talentTypes) && talentTypes.length > 0;
  const hasCustomNeed = typeof customHiringNeed === 'string' && customHiringNeed.trim().length > 0;

  const hasAnyData = hasInterests || hasTalentTypes || hasCustomNeed;

  return (
    <section
      id="client-hiring-focus-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-colors"
      aria-labelledby="client-hiring-focus-title"
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 id="client-hiring-focus-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Hiring & Talent Focus
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Areas of technical interest and talent archetypes sought for projects
            </p>
          </div>
        </div>

        {isEditable && onEdit && (
          <button
            id="edit-hiring-focus-btn"
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Focus</span>
          </button>
        )}
      </div>

      {!hasAnyData ? (
        <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
          <Target className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No hiring preferences specified yet
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Highlight the technologies and talent levels you look for so qualified candidates understand your needs.
          </p>
          {isEditable && onEdit && (
            <button
              id="empty-state-edit-hiring-focus-btn"
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Define Hiring Focus</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Domain / Project Needs */}
          {hasInterests && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Domain & Project Needs
                </span>
                <span className="text-xs text-slate-400">({hiringInterests.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {hiringInterests.map((interest, idx) => (
                  <span
                    key={`interest-${idx}`}
                    className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preferred Talent Archetypes */}
          {hasTalentTypes && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Preferred Talent Archetypes
                </span>
                <span className="text-xs text-slate-400">({talentTypes.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {talentTypes.map((talent, idx) => (
                  <span
                    key={`talent-${idx}`}
                    className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60"
                  >
                    {talent}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Immediate or Custom Need */}
          {hasCustomNeed && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Immediate / Custom Need
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {customHiringNeed}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
