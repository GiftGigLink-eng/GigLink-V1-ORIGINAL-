import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

export interface MultiSelectDropdownProps {
  id?: string;
  label?: string;
  required?: boolean;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  helperText?: string;
  error?: string | null;
  searchable?: boolean;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  id: explicitId,
  label,
  required = false,
  options,
  selected,
  onChange,
  placeholder = 'Select options...',
  helperText,
  error,
  searchable = true,
}) => {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on outside click or touch
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const removeOption = (option: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(selected.filter((item) => item !== option));
  };

  const clearAll = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange([]);
  };

  const selectAll = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange([...options]);
  };

  const filteredOptions = searchable && searchQuery.trim()
    ? options.filter((opt) => opt.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  return (
    <div id={`${id}-container`} className="space-y-1.5 w-full" ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={id}
            id={`${id}-label`}
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {helperText && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
          {helperText}
        </p>
      )}

      {/* Dropdown Trigger */}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={label ? `${id}-label` : undefined}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-full min-h-[46px] px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/80 border text-sm rounded-xl shadow-xs transition-all flex items-center justify-between gap-2 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
            error
              ? 'border-rose-400 dark:border-rose-600 ring-1 ring-rose-300 dark:ring-rose-900'
              : isOpen
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-white dark:bg-slate-900'
              : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
          }`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
            {selected.length === 0 ? (
              <span className="text-slate-400 dark:text-slate-500 text-sm truncate">
                {placeholder}
              </span>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 shrink-0">
                  {selected.length} selected
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                  {selected.join(', ')}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-1 text-slate-400 dark:text-slate-500">
            {selected.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear all selections"
                onClick={clearAll}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    clearAll();
                  }
                }}
                className="p-1 hover:text-slate-600 dark:hover:text-slate-300 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
              }`}
            />
          </div>
        </button>

        {/* Dropdown Menu Panel */}
        {isOpen && (
          <div
            id={`${id}-listbox`}
            role="listbox"
            aria-multiselectable="true"
            className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-72 animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {/* Search Input & Quick Actions */}
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex flex-col gap-2">
              {searchable && options.length > 5 && (
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search options..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] px-1 text-slate-500 dark:text-slate-400">
                <span>
                  {selected.length} of {options.length} selected
                </span>
                <div className="flex items-center gap-2">
                  {selected.length < options.length && (
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
                    >
                      Select all
                    </button>
                  )}
                  {selected.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-rose-600 dark:text-rose-400 hover:underline font-medium cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Options List */}
            <div className="overflow-y-auto p-1.5 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-52">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  No matching options found
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = selected.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => toggleOption(option)}
                      className={`w-full min-h-[40px] px-3 py-2 text-xs rounded-lg flex items-center justify-between transition-colors text-left cursor-pointer group ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200 font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <span className="pr-2">{option}</span>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white dark:bg-emerald-500 dark:border-emerald-500'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-slate-400'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Bottom Done Bar */}
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Items Chips Display */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selected.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200 rounded-lg text-xs font-medium transition-all shadow-2xs"
            >
              <span>{item}</span>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={(e) => removeOption(item, e)}
                className="p-0.5 text-emerald-700 dark:text-emerald-300 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">{error}</p>}
    </div>
  );
};
