import React, { useState, useEffect, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Opportunity, OpportunityMatchExplanation } from '../../types';
import { getOpenOpportunities, OpportunityFilterParams } from '../../lib/opportunityService';
import { OpportunityCard } from './OpportunityCard';
import { calculateOpportunityMatch, normalizeTrustTierLevel } from '../../lib/matchingService';
import {
  Search,
  Filter,
  PlusCircle,
  Briefcase,
  Layers,
  MapPin,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ArrowUpDown,
  DollarSign,
  Award,
  SlidersHorizontal,
  Info,
  CheckCircle2,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'engineering', label: 'Software & Dev' },
  { id: 'design', label: 'Product & Design' },
  { id: 'ai_services', label: 'AI & Data Engineering' },
  { id: 'security', label: 'Security & Auditing' },
  { id: 'marketing', label: 'Growth & Content' },
];

export const OpportunitiesExplorePage: React.FC = () => {
  const { user, profile, passport, unifiedProfile, loading: authLoading, activePersona } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Invariant: Authenticated users with incomplete onboarding cannot access workspace marketplace
  if (user && profile && profile.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }

  // Active Feed Tab: 'recommended' (if authenticated) or 'all'
  const [activeTab, setActiveTab] = useState<'recommended' | 'all'>(user ? 'recommended' : 'all');

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedTrustTier, setSelectedTrustTier] = useState<string>('all');
  const [selectedCompensation, setSelectedCompensation] = useState<string>('all');
  const [minMatchThreshold, setMinMatchThreshold] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'best_match' | 'newest' | 'compensation' | 'trust_tier'>(
    user && activeTab === 'recommended' ? 'best_match' : 'newest'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Switch default sort when switching tabs
  const handleTabSwitch = (tab: 'recommended' | 'all') => {
    setActiveTab(tab);
    if (tab === 'recommended') {
      setSortBy('best_match');
    } else if (sortBy === 'best_match' && !user) {
      setSortBy('newest');
    }
  };

  const candidateData = unifiedProfile || passport || profile;

  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: OpportunityFilterParams = {
        category: selectedCategory,
        type: selectedType,
        locationType: selectedLocation,
        searchQuery: searchQuery,
      };
      const data = await getOpenOpportunities(filters);
      setOpportunities(data);
    } catch (err: any) {
      console.error('Failed to load opportunities:', err);
      setError('Unable to load opportunities from the marketplace. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [selectedCategory, selectedType, selectedLocation]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOpportunities();
  };

  const resetAllFilters = () => {
    setSelectedCategory('all');
    setSelectedType('all');
    setSelectedLocation('all');
    setSelectedTrustTier('all');
    setSelectedCompensation('all');
    setMinMatchThreshold(0);
    setSearchQuery('');
    setSortBy(activeTab === 'recommended' && user ? 'best_match' : 'newest');
  };

  // Pre-calculate match explanations deterministically for all fetched opportunities
  const opportunitiesWithMatch = useMemo(() => {
    return opportunities.map((opp) => {
      const matchExplanation: OpportunityMatchExplanation | null = candidateData
        ? calculateOpportunityMatch(opp, candidateData)
        : null;
      return {
        opportunity: opp,
        match: matchExplanation,
      };
    });
  }, [opportunities, candidateData]);

  // Apply Client-Side Trust Tier, Compensation, Min Match, and Sort logic
  const processedOpportunities = useMemo(() => {
    let list = [...opportunitiesWithMatch];

    // Filter by Recommended Trust Tier
    if (selectedTrustTier !== 'all') {
      list = list.filter(({ opportunity }) => {
        const tierLevel = normalizeTrustTierLevel(opportunity.recommendedTrustTier || 'Unverified');
        switch (selectedTrustTier) {
          case 'unverified':
            return tierLevel === 0;
          case 'novice':
            return tierLevel >= 1;
          case 'basic':
            return tierLevel >= 2;
          case 'verified_pro':
            return tierLevel >= 3;
          case 'elite':
            return tierLevel >= 4;
          default:
            return true;
        }
      });
    }

    // Filter by Compensation Range
    if (selectedCompensation !== 'all') {
      list = list.filter(({ opportunity }) => {
        const isHourly = opportunity.compensationType === 'hourly';
        const min = opportunity.compensationMin || 0;
        const max = opportunity.compensationMax || min;

        switch (selectedCompensation) {
          case 'under_50':
            return isHourly && (max <= 50 || min <= 50);
          case '50_100':
            return isHourly && ((min >= 50 && min <= 100) || (max >= 50 && max <= 100));
          case '100_plus':
            return isHourly ? max >= 100 || min >= 100 : min >= 5000;
          case 'fixed':
            return opportunity.compensationType === 'fixed' || opportunity.compensationType === 'competitive';
          default:
            return true;
        }
      });
    }

    // Filter by Tab / Minimum Match
    if (activeTab === 'recommended' && candidateData) {
      if (minMatchThreshold > 0) {
        list = list.filter(({ match }) => (match ? match.matchPercentage >= minMatchThreshold : false));
      }
    }

    // Multi-Dimensional Sorting
    list.sort((a, b) => {
      if (sortBy === 'best_match') {
        const scoreA = a.match ? a.match.matchPercentage : 0;
        const scoreB = b.match ? b.match.matchPercentage : 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
      } else if (sortBy === 'compensation') {
        const compA = a.opportunity.compensationMax || a.opportunity.compensationMin || 0;
        const compB = b.opportunity.compensationMax || b.opportunity.compensationMin || 0;
        if (compB !== compA) return compB - compA;
      } else if (sortBy === 'trust_tier') {
        const tierA = normalizeTrustTierLevel(a.opportunity.recommendedTrustTier || 'Unverified');
        const tierB = normalizeTrustTierLevel(b.opportunity.recommendedTrustTier || 'Unverified');
        if (tierB !== tierA) return tierB - tierA;
      }

      // Default fallback: Newest first
      const timeA = a.opportunity.createdAt ? new Date(a.opportunity.createdAt as any).getTime() : 0;
      const timeB = b.opportunity.createdAt ? new Date(b.opportunity.createdAt as any).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  }, [
    opportunitiesWithMatch,
    selectedTrustTier,
    selectedCompensation,
    minMatchThreshold,
    sortBy,
    activeTab,
    candidateData,
  ]);

  const isCreatorPersona =
    activePersona === 'client' ||
    activePersona === 'partner' ||
    activePersona === 'organization_admin';

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedType !== 'all' ||
    selectedLocation !== 'all' ||
    selectedTrustTier !== 'all' ||
    selectedCompensation !== 'all' ||
    minMatchThreshold > 0 ||
    searchQuery !== '';

  const highMatchCount = opportunitiesWithMatch.filter(
    (item) => item.match && item.match.matchPercentage >= 70
  ).length;

  return (
    <div id="opportunities-marketplace-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
              <Sparkles className="w-3 h-3" />
              Verified Marketplace
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Opportunities & Projects
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Discover verified gigs, apprenticeships, and contracts backed by verifiable Trust Passports.
          </p>
        </div>

        {/* Action Button: Post Opportunity */}
        <div className="flex items-center gap-3">
          {user && (
            <Link
              to="/my-applications"
              id="my-applications-nav-btn"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors min-h-[44px]"
            >
              <Briefcase className="w-4 h-4 text-slate-500" />
              <span>My Applications</span>
            </Link>
          )}

          {user && isCreatorPersona && (
            <Link
              to="/opportunities/create"
              id="create-opportunity-btn"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-xs min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Post Opportunity</span>
            </Link>
          )}
        </div>
      </div>

      {/* Unauthenticated CTA Banner */}
      {!user && (
        <div className="mb-6 p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5 sm:mt-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                Get Personalized & Explainable Fit Recommendations
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Sign in to see transparent match breakdowns calculated against your verified skills & Trust Passport.
              </p>
            </div>
          </div>
          <Link
            to="/auth"
            id="unauth-matching-cta-btn"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold whitespace-nowrap transition-colors min-h-[40px] flex items-center justify-center shrink-0"
          >
            Sign In for Match Ratings
          </Link>
        </div>
      )}

      {/* Main Feed Tabs (Recommended for You vs All Opportunities) */}
      <div className="flex items-center justify-between gap-3 mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          {user && (
            <button
              id="tab-recommended-feed"
              onClick={() => handleTabSwitch('recommended')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] cursor-pointer ${
                activeTab === 'recommended'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Recommended for You</span>
              {highMatchCount > 0 && (
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                    activeTab === 'recommended'
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  }`}
                >
                  {highMatchCount}
                </span>
              )}
            </button>
          )}

          <button
            id="tab-all-opportunities"
            onClick={() => handleTabSwitch('all')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] cursor-pointer ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>All Opportunities</span>
            <span
              className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                activeTab === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {opportunities.length}
            </span>
          </button>
        </div>

        {/* Dynamic Context Tag */}
        <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Deterministic match scores based on verified proof & skills</span>
        </div>
      </div>

      {/* Search & Multi-Faceted Filter Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-6 shadow-xs">
        {/* Top Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              id="marketplace-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, required skills (e.g. React, Python), or keywords..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[44px]"
            />
          </div>
          <button
            type="submit"
            id="marketplace-search-submit"
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition-colors min-h-[44px] shrink-0"
          >
            Search
          </button>
        </form>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              id={`category-filter-${cat.id}`}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all min-h-[36px] cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Faceted Dropdown Filters & Sorting Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-3 text-xs">
          {/* Role Type Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Role Type
            </label>
            <select
              id="filter-opportunity-type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Role Types</option>
              <option value="gig">Gig / Task</option>
              <option value="contract">Contract Project</option>
              <option value="apprenticeship">Apprenticeship</option>
              <option value="bounty">Bounty</option>
            </select>
          </div>

          {/* Location Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Location Mode
            </label>
            <select
              id="filter-opportunity-location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Locations</option>
              <option value="remote">Remote Only</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-Site</option>
            </select>
          </div>

          {/* Trust Tier Filter (NEW) */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Trust Tier Fit
            </label>
            <select
              id="filter-trust-tier"
              value={selectedTrustTier}
              onChange={(e) => setSelectedTrustTier(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Trust Tiers</option>
              <option value="unverified">Open / Unverified</option>
              <option value="novice">Novice (Level 1+)</option>
              <option value="basic">Basic / Emerging (Level 2+)</option>
              <option value="verified_pro">Verified Pro / Gold (Level 3+)</option>
              <option value="elite">Elite Verified (Level 4)</option>
            </select>
          </div>

          {/* Compensation Filter (NEW) */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Compensation
            </label>
            <select
              id="filter-compensation"
              value={selectedCompensation}
              onChange={(e) => setSelectedCompensation(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Compensation</option>
              <option value="under_50">Under $50 / hr</option>
              <option value="50_100">$50 - $100 / hr</option>
              <option value="100_plus">$100+ / hr or $5k+ Fixed</option>
              <option value="fixed">Fixed / Milestone Only</option>
            </select>
          </div>

          {/* Sorting Selector (NEW) */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Sort By
            </label>
            <select
              id="sort-by-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {user && <option value="best_match">★ Best Match Fit</option>}
              <option value="newest">Newest First</option>
              <option value="compensation">Highest Compensation</option>
              <option value="trust_tier">Recommended Trust Tier</option>
            </select>
          </div>
        </div>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800/60 text-xs">
            <span className="text-slate-400 text-[11px]">Filtered by active criteria</span>
            <button
              id="reset-marketplace-filters-btn"
              onClick={resetAllFilters}
              className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-semibold cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Results Section */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animate-pulse h-64"
            >
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-1/3 mb-4" />
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4 mb-3" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-full mb-2" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-5/6 mb-4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-1/2 mt-auto" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>
          <button
            onClick={fetchOpportunities}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors min-h-[36px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : processedOpportunities.length === 0 ? (
        <div
          id="opportunities-empty-state"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            {activeTab === 'recommended'
              ? 'No matching recommendations found'
              : 'No opportunities match your criteria'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            {activeTab === 'recommended'
              ? 'Try expanding your filter criteria, browsing All Opportunities, or adding verified skills to your Trust Passport.'
              : 'Try adjusting your search terms, clearing active filters, or check back soon as new verified listings are posted.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={resetAllFilters}
              id="empty-state-reset-btn"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors min-h-[40px] cursor-pointer"
            >
              <span>Clear All Filters</span>
            </button>
            {activeTab === 'recommended' && (
              <button
                onClick={() => handleTabSwitch('all')}
                id="empty-state-browse-all-btn"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors min-h-[40px] cursor-pointer"
              >
                <span>Browse All Opportunities</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-4 px-1">
            <span>
              Showing <strong className="text-slate-900 dark:text-white">{processedOpportunities.length}</strong>{' '}
              {activeTab === 'recommended' ? 'recommended' : 'active'} opportunity
              {processedOpportunities.length !== 1 ? 's' : ''}
            </span>

            {activeTab === 'recommended' && (
              <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                Sorted by deterministic match fit
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {processedOpportunities.map(({ opportunity, match }) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                candidateProfile={candidateData}
                matchExplanation={match}
                showMatchBadge={!!user}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

