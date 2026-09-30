import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, Plus, AlertCircle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import {
  searchApprovedSkills,
  APPROVED_SKILLS_CATALOGUE,
  APPROVED_SKILL_CATEGORIES,
  SkillCatalogueItem,
} from '../../lib/catalogue/skills';

export interface SearchableSkillSelectorProps {
  selectedSkills: string[];
  onChange: (skills: string[]) => void;
  minSkills?: number;
  maxSkills?: number;
  error?: string | null;
  label?: string;
  hideLabel?: boolean;
  description?: string;
  placeholder?: string;
  allowCustom?: boolean;
  id?: string;
}

export const SearchableSkillSelector: React.FC<SearchableSkillSelectorProps> = ({
  selectedSkills,
  onChange,
  minSkills = 1,
  maxSkills = 15,
  error,
  label = 'Core Skills & Capabilities',
  hideLabel = false,
  description,
  placeholder,
  allowCustom = true,
  id = 'searchable-skill-selector',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
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

  // Filtered skills based on search query and selected category
  const matchingSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const excludedSet = new Set(selectedSkills.map((s) => s.toLowerCase()));

    return APPROVED_SKILLS_CATALOGUE.filter((item) => {
      // Exclude already selected skills from the suggestions
      if (excludedSet.has(item.name.toLowerCase())) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      // Text search filter
      if (!query) {
        return true;
      }
      const nameMatch = item.name.toLowerCase().includes(query);
      const categoryMatch = item.category.toLowerCase().includes(query);
      return nameMatch || categoryMatch;
    }).slice(0, 20);
  }, [searchQuery, selectedCategory, selectedSkills]);

  const handleSelectSkill = (skillName: string) => {
    if (!selectedSkills.includes(skillName) && selectedSkills.length < maxSkills) {
      onChange([...selectedSkills, skillName]);
    }
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleAddCustomSkill = (customName: string) => {
    const trimmed = customName.trim();
    if (trimmed && !selectedSkills.includes(trimmed) && selectedSkills.length < maxSkills) {
      onChange([...selectedSkills, trimmed]);
    }
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveSkill = (skillName: string) => {
    onChange(selectedSkills.filter((s) => s !== skillName));
  };

  const isExactMatchInCatalogue = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return APPROVED_SKILLS_CATALOGUE.some(
      (item) => item.name.toLowerCase() === query
    );
  }, [searchQuery]);

  const isAlreadySelected = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return false;
    return selectedSkills.some((s) => s.toLowerCase() === query);
  }, [searchQuery, selectedSkills]);

  return (
    <div id={id} className="space-y-2.5" ref={containerRef}>
      {!hideLabel && (
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            {label} {minSkills > 0 && <span className="text-rose-500">*</span>}
          </label>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {selectedSkills.length} selected{' '}
            {maxSkills ? `(Max ${maxSkills})` : minSkills > 0 ? `(Min ${minSkills} required)` : ''}
          </span>
        </div>
      )}

      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
          {description}
        </p>
      )}

      {/* Selected Skill Chips */}
      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl min-h-[46px] items-center">
          {selectedSkills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 text-indigo-800 dark:text-indigo-200 rounded-lg text-xs font-semibold shadow-2xs transition-all hover:border-indigo-300"
            >
              <span>{skill}</span>
              <button
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                className="p-0.5 text-indigo-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded transition-colors"
                aria-label={`Remove skill ${skill}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search & Dropdown Trigger Input */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            id={`${id}-input`}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (matchingSkills.length > 0) {
                  handleSelectSkill(matchingSkills[0].name);
                } else if (allowCustom && searchQuery.trim() && !isAlreadySelected) {
                  handleAddCustomSkill(searchQuery.trim());
                }
              } else if (e.key === 'Escape') {
                setIsOpen(false);
              }
            }}
            placeholder={
              placeholder ||
              (selectedSkills.length === 0
                ? 'Search canonical skills catalogue or click arrow to browse...'
                : 'Search to add more skills...')
            }
            className={`w-full pl-10 pr-20 py-2.5 bg-white dark:bg-slate-900 border text-sm rounded-xl shadow-xs placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              error ? 'border-rose-300 ring-1 ring-rose-300' : 'border-slate-300 dark:border-slate-700'
            }`}
          />
          <div className="absolute right-2.5 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  inputRef.current?.focus();
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                title="Clear query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsOpen(!isOpen);
                if (!isOpen) {
                  inputRef.current?.focus();
                }
              }}
              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
              title={isOpen ? 'Close catalogue dropdown' : 'Open catalogue dropdown'}
              aria-expanded={isOpen}
            >
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            id={`${id}-dropdown`}
            className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {/* Dropdown Header & Category Filters */}
            <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
                <span className="flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  Canonical Skills Catalogue ({APPROVED_SKILLS_CATALOGUE.length})
                </span>
                <span className="text-[11px] text-slate-400">Click to add</span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('All')}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-all ${
                    selectedCategory === 'All'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  All ({APPROVED_SKILLS_CATALOGUE.length})
                </button>
                {APPROVED_SKILL_CATEGORIES.map((cat) => {
                  const count = APPROVED_SKILLS_CATALOGUE.filter((s) => s.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-all ${
                        selectedCategory === cat
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dropdown Options List */}
            <div className="max-h-64 overflow-y-auto p-1 divide-y divide-slate-50 dark:divide-slate-800/60">
              {matchingSkills.length === 0 ? (
                <div className="p-4 text-center space-y-2">
                  <AlertCircle className="w-5 h-5 text-amber-500 mx-auto" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    No approved skills match &ldquo;{searchQuery}&rdquo;
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedCategory !== 'All'
                      ? `Try switching category from "${selectedCategory}" to "All"`
                      : 'You can add this as a custom skill below or try another keyword.'}
                  </p>
                  {allowCustom && searchQuery.trim() && !isAlreadySelected && (
                    <button
                      type="button"
                      onClick={() => handleAddCustomSkill(searchQuery.trim())}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add &ldquo;{searchQuery.trim()}&rdquo; as custom skill</span>
                    </button>
                  )}
                </div>
              ) : (
                matchingSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => handleSelectSkill(skill.name)}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-900 dark:hover:text-indigo-200 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-950 dark:group-hover:text-indigo-300">
                        {skill.name}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {skill.category}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </span>
                  </button>
                ))
              )}

              {/* Add Custom Skill Option at bottom of list if typed query doesn't match catalogue */}
              {allowCustom &&
                searchQuery.trim() &&
                !isExactMatchInCatalogue &&
                !isAlreadySelected &&
                matchingSkills.length > 0 && (
                  <div className="p-1 pt-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddCustomSkill(searchQuery.trim())}
                      className="w-full text-left px-3 py-2 text-xs rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 transition-colors flex items-center justify-between"
                    >
                      <span className="font-medium">
                        Add &ldquo;{searchQuery.trim()}&rdquo; as custom skill
                      </span>
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
            </div>

            {/* Dropdown Footer */}
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>{matchingSkills.length} available to select</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
    </div>
  );
};
