import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapPin, ChevronDown, Check, Search, X } from 'lucide-react';
import {
  APPROVED_LOCATIONS_CATALOGUE,
  CountryOption,
  StateOption,
  CityOption,
  formatStructuredLocation,
} from '../../lib/catalogue/locations';
import { StructuredLocation } from '../../types';

interface HierarchicalLocationSelectorProps {
  value: Partial<StructuredLocation> | null;
  onChange: (location: StructuredLocation | null) => void;
  required?: boolean;
  error?: string | null;
}

export const HierarchicalLocationSelector: React.FC<HierarchicalLocationSelectorProps> = ({
  value,
  onChange,
  required = true,
  error,
}) => {
  // Selected IDs/Codes
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('');
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [selectedCityId, setSelectedCityId] = useState<string>('');

  // Dropdown Open States
  const [countryOpen, setCountryOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);

  // Search queries for dropdowns
  const [countrySearch, setCountrySearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  // Refs for click outside
  const countryRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
      if (stateRef.current && !stateRef.current.contains(e.target as Node)) {
        setStateOpen(false);
      }
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setCityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize from value if provided
  useEffect(() => {
    if (value?.country) {
      const country = APPROVED_LOCATIONS_CATALOGUE.find(
        (c) => c.name.toLowerCase() === value.country?.toLowerCase() || c.code === value.country
      );
      if (country) {
        setSelectedCountryCode(country.code);
        if (value.state) {
          const state = country.states.find(
            (s) => s.name.toLowerCase() === value.state?.toLowerCase() || s.id === value.state
          );
          if (state) {
            setSelectedStateId(state.id);
            if (value.city) {
              const city = state.cities.find(
                (ci) => ci.name.toLowerCase() === value.city?.toLowerCase() || ci.id === value.city
              );
              if (city) {
                setSelectedCityId(city.id);
              }
            }
          }
        }
      }
    }
  }, []);

  // Derive objects from selections
  const currentCountry: CountryOption | undefined = useMemo(() => {
    return APPROVED_LOCATIONS_CATALOGUE.find((c) => c.code === selectedCountryCode);
  }, [selectedCountryCode]);

  const currentState: StateOption | undefined = useMemo(() => {
    return currentCountry?.states.find((s) => s.id === selectedStateId);
  }, [currentCountry, selectedStateId]);

  const currentCity: CityOption | undefined = useMemo(() => {
    return currentState?.cities.find((ci) => ci.id === selectedCityId);
  }, [currentState, selectedCityId]);

  // Sync upwards when state changes
  useEffect(() => {
    if (currentCountry && currentState) {
      const loc: StructuredLocation = {
        country: currentCountry.name,
        state: currentState.name,
        ...(currentCity ? { city: currentCity.name } : {}),
        formattedAddress: formatStructuredLocation({
          country: currentCountry.name,
          state: currentState.name,
          ...(currentCity ? { city: currentCity.name } : {}),
        }),
      };
      onChange(loc);
    } else {
      onChange(null);
    }
  }, [currentCountry, currentState, currentCity]);

  // Filtered dropdown lists
  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return APPROVED_LOCATIONS_CATALOGUE;
    return APPROVED_LOCATIONS_CATALOGUE.filter((c) =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const filteredStates = useMemo(() => {
    if (!currentCountry) return [];
    const q = stateSearch.trim().toLowerCase();
    if (!q) return currentCountry.states;
    return currentCountry.states.filter((s) => s.name.toLowerCase().includes(q));
  }, [currentCountry, stateSearch]);

  const filteredCities = useMemo(() => {
    if (!currentState) return [];
    const q = citySearch.trim().toLowerCase();
    if (!q) return currentState.cities;
    return currentState.cities.filter((ci) => ci.name.toLowerCase().includes(q));
  }, [currentState, citySearch]);

  const handleSelectCountry = (code: string) => {
    setSelectedCountryCode(code);
    setSelectedStateId('');
    setSelectedCityId('');
    setCountryOpen(false);
    setCountrySearch('');
  };

  const handleSelectState = (stateId: string) => {
    setSelectedStateId(stateId);
    setSelectedCityId('');
    setStateOpen(false);
    setStateSearch('');
  };

  const handleSelectCity = (cityId: string) => {
    setSelectedCityId(cityId);
    setCityOpen(false);
    setCitySearch('');
  };

  const handleClearCity = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCityId('');
  };

  return (
    <div id="hierarchical-location-selector" className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Professional Location {required && <span className="text-rose-500">*</span>}
        </label>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Region-level matching • No street address
        </span>
      </div>

      <div className="space-y-3.5">
        {/* Tier 1: Country (Required - always shown first) */}
        <div className="relative" ref={countryRef}>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
            Country <span className="text-rose-500">*</span>
          </label>
          <button
            type="button"
            id="location-country-trigger"
            onClick={() => {
              setCountryOpen(!countryOpen);
              setStateOpen(false);
              setCityOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-white dark:bg-slate-900 border text-sm rounded-xl shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              error && !selectedCountryCode
                ? 'border-rose-300 ring-1 ring-rose-300'
                : 'border-slate-300 dark:border-slate-700'
            }`}
          >
            <span
              className={`truncate ${
                currentCountry
                  ? 'text-slate-900 dark:text-white font-medium'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {currentCountry ? currentCountry.name : 'Select Country...'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
          </button>

          {countryOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-hidden flex flex-col">
              <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-200"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto p-1 max-h-48 divide-y divide-slate-50 dark:divide-slate-800/50">
                {filteredCountries.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500">No matching country</div>
                ) : (
                  filteredCountries.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleSelectCountry(c.code)}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between transition-colors ${
                        selectedCountryCode === c.code
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{c.name}</span>
                      {selectedCountryCode === c.code && (
                        <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tier 2: State / Region (Required - Revealed only after Country selection) */}
        {currentCountry && (
          <div className="relative animate-in fade-in slide-in-from-top-1 duration-200" ref={stateRef}>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              State / Region <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              id="location-state-trigger"
              onClick={() => {
                setStateOpen(!stateOpen);
                setCountryOpen(false);
                setCityOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-white dark:bg-slate-900 border text-sm rounded-xl shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                error && !selectedStateId
                  ? 'border-rose-300 ring-1 ring-rose-300'
                  : 'border-slate-300 dark:border-slate-700'
              }`}
            >
              <span
                className={`truncate ${
                  currentState
                    ? 'text-slate-900 dark:text-white font-medium'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {currentState ? currentState.name : `Select State/Region in ${currentCountry.name}...`}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
            </button>

            {stateOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder={`Search states in ${currentCountry.name}...`}
                    value={stateSearch}
                    onChange={(e) => setStateSearch(e.target.value)}
                    className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-200"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto p-1 max-h-48 divide-y divide-slate-50 dark:divide-slate-800/50">
                  {filteredStates.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">No matching states</div>
                  ) : (
                    filteredStates.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectState(s.id)}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between transition-colors ${
                          selectedStateId === s.id
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{s.name}</span>
                        {selectedStateId === s.id && (
                          <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tier 3: City / District (Optional - Revealed only after State selection) */}
        {currentState && (
          <div className="relative animate-in fade-in slide-in-from-top-1 duration-200" ref={cityRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                City / District
              </label>
              <span className="text-[11px] text-slate-400 font-normal">Optional</span>
            </div>
            <div className="relative">
              <button
                type="button"
                id="location-city-trigger"
                disabled={currentState.cities.length === 0}
                onClick={() => {
                  if (currentState.cities.length > 0) {
                    setCityOpen(!cityOpen);
                    setCountryOpen(false);
                    setStateOpen(false);
                  }
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 border text-sm rounded-xl shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  currentState.cities.length === 0
                    ? 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'
                }`}
              >
                <span
                  className={`truncate ${
                    currentCity
                      ? 'text-slate-900 dark:text-white font-medium'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {currentCity
                    ? currentCity.name
                    : currentState.cities.length > 0
                    ? `Select City in ${currentState.name} (Optional)...`
                    : 'No specific city list for this region'}
                </span>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {currentCity && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={handleClearCity}
                      className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      title="Clear city selection"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
              </button>

              {cityOpen && currentState.cities.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder={`Search cities in ${currentState.name}...`}
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-200"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto p-1 max-h-48 divide-y divide-slate-50 dark:divide-slate-800/50">
                    {filteredCities.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">No matching cities</div>
                    ) : (
                      filteredCities.map((ci) => (
                        <button
                          key={ci.id}
                          type="button"
                          onClick={() => handleSelectCity(ci.id)}
                          className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between transition-colors ${
                            selectedCityId === ci.id
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span>{ci.name}</span>
                          {selectedCityId === ci.id && (
                            <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Automatic Canonical Formatted Address Preview */}
      {currentCountry && currentState && (
        <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
          <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold text-indigo-950 dark:text-indigo-100">
              Verified Location:{' '}
            </span>
            <span className="font-medium">
              {formatStructuredLocation({
                country: currentCountry.name,
                state: currentState.name,
                city: currentCity ? currentCity.name : undefined,
              })}
            </span>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
    </div>
  );
};
