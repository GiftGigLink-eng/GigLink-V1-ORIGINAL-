import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, Plus, AlertCircle, Sparkles } from 'lucide-react';
import {
  searchApprovedSkills,
  APPROVED_SKILLS_CATALOGUE,
  SkillCatalogueItem,
} from '../../lib/catalogue/skills';

interface SearchableSkillSelectorProps {
  selectedSkills: string[];
  onChange: (skills: string[]) => void;
  minSkills?: number;
  error?: string | null;
}

export const SearchableSkillSelector: React.FC<SearchableSkillSelectorProps> = ({
  selectedSkills,
  onChange,
  minSkills = 1,
  error,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered approved catalogue skills
  const matchingSkills = useMemo(() => {
    return searchApprovedSkills(searchQuery, selectedSkills, 8);
  }, [searchQuery, selectedSkills]);

  const handleSelectSkill = (skill: SkillCatalogueItem) => {
    if (!selectedSkills.includes(skill.name)) {
      onChange([...selectedSkills, skill.name]);
    }
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveSkill = (skillName: string) => {
    onChange(selectedSkills.filter((s) => s !== skillName));
  };

  return (
    <div id="searchable-skill-selector" className="space-y-2.5" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">
          Core Skills & Capabilities {minSkills > 0 && <span className="text-rose-500">*</span>}
        </label>
        <span className="text-xs text-slate-500">
          {selectedSkills.length} selected {minSkills > 0 && `(Min ${minSkills} required)`}
        </span>
      </div>

      {/* Selected Skill Chips */}
      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg min-h-[42px] items-center">
          {selectedSkills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-sky-200 text-sky-900 rounded-md text-xs font-semibold shadow-xs transition-all hover:border-sky-300"
            >
              <span>{skill}</span>
              <button
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                aria-label={`Remove skill ${skill}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            id="skill-search-input"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={
              selectedSkills.length === 0
                ? 'Type to search approved skills (e.g. React, Python, Figma)...'
                : 'Add more skills from approved catalogue...'
            }
            className={`w-full pl-9 pr-8 py-2.5 bg-white border text-sm rounded-lg shadow-sm placeholder-slate-400 text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 ${
              error ? 'border-rose-300 ring-1 ring-rose-300' : 'border-slate-300'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Suggestions */}
        {isOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
            <div className="p-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sky-600" />
                Approved Skill Catalogue
              </span>
              <span>Select to add</span>
            </div>

            <div className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-50">
              {matchingSkills.length === 0 ? (
                <div className="p-4 text-center">
                  <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-800">
                    No approved skills match &ldquo;{searchQuery}&rdquo;
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Only skills from the standardized canonical catalogue can be selected.
                  </p>
                </div>
              ) : (
                matchingSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => handleSelectSkill(skill)}
                    className="w-full text-left px-3 py-2 text-xs rounded hover:bg-sky-50 hover:text-sky-900 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900 group-hover:text-sky-950">
                        {skill.name}
                      </span>
                      <span className="text-[10px] text-slate-400 group-hover:text-sky-600">
                        {skill.category}
                      </span>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
    </div>
  );
};
