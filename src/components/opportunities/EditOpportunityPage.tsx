import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getOpportunityById, updateOpportunity } from '../../lib/opportunityService';
import { Opportunity } from '../../types';
import { ChevronLeft, Sparkles, Plus, X, AlertCircle } from 'lucide-react';

const CATEGORIES = [
  { id: 'engineering', label: 'Software & Dev' },
  { id: 'design', label: 'Product & Design' },
  { id: 'ai_services', label: 'AI & Data Engineering' },
  { id: 'security', label: 'Security & Auditing' },
  { id: 'marketing', label: 'Growth & Content' },
];

export const EditOpportunityPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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
  const [status, setStatus] = useState<Opportunity['status']>('open');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOpportunity() {
      if (!id) return;
      setLoading(true);
      try {
        const data = await getOpportunityById(id);
        if (data) {
          setOpp(data);
          setTitle(data.title);
          setCategory(data.category);
          setType(data.type);
          setDescription(data.description);
          setSkills(data.requiredSkills || []);
          setExperienceLevel(data.experienceLevel || 'intermediate');
          setLocationType(data.locationType);
          setLocationString(data.locationString || '');
          setCompensationType(data.compensationType);
          setCompensationMin(data.compensationMin ? String(data.compensationMin) : '');
          setCompensationMax(data.compensationMax ? String(data.compensationMax) : '');
          setCurrency(data.currency || 'USD');
          setRecommendedTrustTier(data.recommendedTrustTier || 'Basic Verified');
          setStatus(data.status);
        }
      } catch (err) {
        console.error('Error fetching opportunity:', err);
      } finally {
        setLoading(false);
      }
    }
    loadOpportunity();
  }, [id]);

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
    if (!user || !opp) return;

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
      await updateOpportunity(opp.id, opp, {
        title: title.trim(),
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

      showToast('Opportunity updated successfully!', 'success');
      navigate(`/opportunities/${opp.id}`);
    } catch (err: any) {
      console.error('Opportunity update error:', err);
      setError('Failed to update opportunity. Check your permissions.');
      showToast('Update failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 animate-pulse h-96" />
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold">Opportunity not found</h2>
        <Link to="/opportunities" className="text-indigo-600 hover:underline text-xs mt-2 block">
          Back to marketplace
        </Link>
      </div>
    );
  }

  return (
    <div id="edit-opportunity-page" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back navigation */}
      <div className="mb-6">
        <Link
          to={`/opportunities/${opp.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to opportunity</span>
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Edit Opportunity Listing
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Update scope, required skills, compensation, and active status.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Opportunity Title *
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
            />
          </div>

          {/* Category & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
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
                Opportunity Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Opportunity['type'])}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
              >
                <option value="gig">Gig / Task</option>
                <option value="contract">Contract Project</option>
                <option value="apprenticeship">Apprenticeship</option>
                <option value="bounty">Bounty</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description & Scope *
            </label>
            <textarea
              required
              rows={6}
              maxLength={3000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
            />
          </div>

          {/* Skills Tag Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Required Skills (Max 10 tags)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                placeholder="e.g. React, TypeScript, Node.js"
                className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

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

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Listing Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Opportunity['status'])}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
            >
              <option value="open">Open (Accepting Applications)</option>
              <option value="in_progress">In Progress (Candidate Selected)</option>
              <option value="draft">Draft (Private)</option>
              <option value="closed">Closed (No Longer Accepting)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Link
              to={`/opportunities/${opp.id}`}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
