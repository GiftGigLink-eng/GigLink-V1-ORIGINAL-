import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { createOpportunity } from '../../lib/opportunityService';
import { Opportunity } from '../../types';
import { doc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Briefcase,
  Layers,
  MapPin,
  DollarSign,
  ShieldCheck,
  Building2,
  ChevronLeft,
  Sparkles,
  Plus,
  X,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'engineering', label: 'Software & Dev' },
  { id: 'design', label: 'Product & Design' },
  { id: 'ai_services', label: 'AI & Data Engineering' },
  { id: 'security', label: 'Security & Auditing' },
  { id: 'marketing', label: 'Growth & Content' },
];

export const CreateOpportunityPage: React.FC = () => {
  const { user, profile, activePersona } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('engineering');
  const [type, setType] = useState<Opportunity['type']>('gig');
  const [description, setDescription] = useState<string>('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState<string>('');
  const [experienceLevel, setExperienceLevel] = useState<Opportunity['experienceLevel']>('intermediate');
  const [locationType, setLocationType] = useState<Opportunity['locationType']>('remote');
  const [locationString, setLocationString] = useState<string>('');
  const [compensationType, setCompensationType] = useState<Opportunity['compensationType']>('fixed');
  const [compensationMin, setCompensationMin] = useState<string>('');
  const [compensationMax, setCompensationMax] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [recommendedTrustTier, setRecommendedTrustTier] = useState<string>('Basic Verified');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [status, setStatus] = useState<Opportunity['status']>('open');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Available organizations where user is admin
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    async function loadOrgs() {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'organizations'),
          where('adminUserIds', 'array-contains', user.uid)
        );
        const snap = await getDocs(q);
        const loaded = snap.docs.map((d) => ({ id: d.id, name: d.data().name }));
        setOrgs(loaded);
      } catch (err) {
        console.error('Could not load user organizations:', err);
      }
    }
    loadOrgs();
  }, [user]);

  const handleAddSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim()) && skills.length < 10) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim() || title.length > 120) {
      setError('Title is required and must be under 120 characters.');
      return;
    }

    if (!description.trim() || description.length < 30) {
      setError('Description is required and must be at least 30 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newOppId = await createOpportunity({
        title: title.trim(),
        creatorId: user.uid,
        creatorName: profile?.displayName || user.displayName || 'Verified Client',
        organizationId: organizationId.trim() || null,
        type,
        category,
        description: description.trim(),
        requiredSkills: skills,
        experienceLevel,
        locationType,
        locationString: locationString.trim() || null,
        compensationType,
        compensationMin: compensationMin ? parseFloat(compensationMin) : null,
        compensationMax: compensationMax ? parseFloat(compensationMax) : null,
        currency: currency.toUpperCase(),
        recommendedTrustTier: recommendedTrustTier || 'Basic Verified',
        status,
      });

      showToast('Opportunity created successfully!', 'success');
      navigate(`/opportunities/${newOppId}`);
    } catch (err: any) {
      console.error('Opportunity creation error:', err);
      setError('Failed to create opportunity. Please check all fields and permissions.');
      showToast('Creation failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="create-opportunity-page" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back navigation */}
      <div className="mb-6">
        <Link
          to="/opportunities"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to marketplace</span>
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
              <Sparkles className="w-3 h-3" />
              Creator Studio
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Post New Opportunity
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Create a verified gig, apprenticeship, or contract opportunity for qualified talent.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Role Overview */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
              1. Role Specifications
            </h2>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Opportunity Title *
              </label>
              <input
                type="text"
                id="create-opp-title"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer - React & TypeScript"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
              />
            </div>

            {/* Category & Type Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category *
                </label>
                <select
                  id="create-opp-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Opportunity Type *
                </label>
                <select
                  id="create-opp-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as Opportunity['type'])}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
                >
                  <option value="gig">Gig / Task</option>
                  <option value="contract">Contract Project</option>
                  <option value="apprenticeship">Apprenticeship</option>
                  <option value="bounty">Bounty</option>
                </select>
              </div>
            </div>

            {/* Organization Affiliation (Optional) */}
            {orgs.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Post on behalf of Organization (Optional)
                </label>
                <select
                  id="create-opp-org"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
                >
                  <option value="">Personal / Individual Client</option>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Section 2: Details & Description */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
              2. Scope & Requirements
            </h2>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Description & Deliverables (Markdown supported) *
              </label>
              <textarea
                id="create-opp-description"
                required
                rows={6}
                maxLength={3000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detail the scope of work, key deliverables, expectations, and any tools required..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed"
              />
              <span className="text-[10px] text-slate-400 block text-right mt-0.5">
                {description.length} / 3000 chars
              </span>
            </div>

            {/* Skills Tag Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Required Skills (Max 10 tags)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  id="create-opp-skill-input"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  placeholder="e.g. React, TailwindCSS, Node.js"
                  className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Skills Chips */}
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 px-2.5 py-1 rounded-lg"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="text-indigo-400 hover:text-indigo-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Experience Level & Location Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Experience Level
                </label>
                <select
                  id="create-opp-experience"
                  value={experienceLevel}
                  onChange={(e) =>
                    setExperienceLevel(e.target.value as Opportunity['experienceLevel'])
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
                >
                  <option value="entry">Entry Level</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="expert">Expert</option>
                  <option value="all_levels">All Levels Welcome</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Location Mode
                </label>
                <select
                  id="create-opp-location-type"
                  value={locationType}
                  onChange={(e) =>
                    setLocationType(e.target.value as Opportunity['locationType'])
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
                >
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-Site</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Location (City / Country)
                </label>
                <input
                  type="text"
                  id="create-opp-location-string"
                  value={locationString}
                  onChange={(e) => setLocationString(e.target.value)}
                  placeholder="e.g. London, UK or Worldwide"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Compensation & Trust Criteria */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
              3. Compensation & Trust Criteria
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pay Structure
                </label>
                <select
                  id="create-opp-comp-type"
                  value={compensationType}
                  onChange={(e) =>
                    setCompensationType(e.target.value as Opportunity['compensationType'])
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
                >
                  <option value="fixed">Fixed Budget</option>
                  <option value="hourly">Hourly Rate</option>
                  <option value="stipend">Stipend</option>
                  <option value="competitive">Competitive / To Discuss</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Min Amount
                </label>
                <input
                  type="number"
                  id="create-opp-comp-min"
                  value={compensationMin}
                  onChange={(e) => setCompensationMin(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Max Amount
                </label>
                <input
                  type="number"
                  id="create-opp-comp-max"
                  value={compensationMax}
                  onChange={(e) => setCompensationMax(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Currency
                </label>
                <select
                  id="create-opp-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                </select>
              </div>
            </div>

            {/* Recommended Trust Tier */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Recommended Trust Tier
              </label>
              <select
                id="create-opp-trust-tier"
                value={recommendedTrustTier}
                onChange={(e) => setRecommendedTrustTier(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
              >
                <option value="Any">Any Tier Welcome</option>
                <option value="Basic Verified">Basic Verified (Identity Checked)</option>
                <option value="Silver Trust">Silver Trust (Verified Proofs)</option>
                <option value="Gold Verified">Gold Verified (Top Tier Trust)</option>
              </select>
            </div>

            {/* Initial Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Publishing Status
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="open"
                    checked={status === 'open'}
                    onChange={() => setStatus('open')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Publish Immediately (Open to applicants)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="draft"
                    checked={status === 'draft'}
                    onChange={() => setStatus('draft')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Save as Private Draft</span>
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Link
              to="/opportunities"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] flex items-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              id="create-opportunity-submit-btn"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-sm min-h-[44px]"
            >
              {submitting ? 'Creating...' : status === 'open' ? 'Publish Opportunity' : 'Save Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
