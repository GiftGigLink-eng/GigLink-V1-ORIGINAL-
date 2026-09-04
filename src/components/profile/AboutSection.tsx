import React from 'react';
import { User, Edit3, Sparkles } from 'lucide-react';

interface AboutSectionProps {
  bio: string;
  onEdit?: () => void;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ bio, onEdit }) => {
  return (
    <div
      id="profile-about-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            About & Professional Summary
          </h2>
        </div>

        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        )}
      </div>

      {bio && bio.trim().length > 0 ? (
        <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
          {bio}
        </div>
      ) : (
        <div className="py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            No professional summary added yet.
          </p>
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Add a summary to introduce your background and specializations
            </button>
          )}
        </div>
      )}
    </div>
  );
};
