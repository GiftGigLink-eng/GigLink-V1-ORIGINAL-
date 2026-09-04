import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { OrganizationProfile, OrganizationType } from '../../types';
import { getOrganization, updateOrganization } from '../../lib/organizationService';
import {
  Building2,
  Save,
  ArrowLeft,
  Loader2,
  Globe,
  FileText,
  AlertCircle,
  Shield,
} from 'lucide-react';

export const OrganizationEditPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [organization, setOrganization] = useState<OrganizationProfile | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<OrganizationType>('company');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Incomplete onboarding isolation
  if (!authLoading && profile && profile.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }

  useEffect(() => {
    if (!orgId) {
      setError('Organization ID is missing.');
      setLoading(false);
      return;
    }

    const loadOrg = async () => {
      setLoading(true);
      try {
        const orgData = await getOrganization(orgId);
        if (!orgData) {
          setError('Organization not found.');
        } else {
          setOrganization(orgData);
          setName(orgData.name || '');
          setType(orgData.type || 'company');
          setDescription(orgData.description || '');
          setWebsite(orgData.website || '');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load organization.');
      } finally {
        setLoading(false);
      }
    };

    loadOrg();
  }, [orgId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Loading organization details...
        </p>
      </div>
    );
  }

  // Authorization Check: Must be in adminUserIds
  if (!user || (organization && !organization.adminUserIds.includes(user.uid))) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Access Restricted
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              You do not have administrative permissions to edit this organization entity.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to={orgId ? `/org/${orgId}` : '/opportunities'}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Organization</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    if (!name.trim()) {
      showToast('Organization name is required.', 'error');
      return;
    }

    if (website && !/^https?:\/\//i.test(website)) {
      showToast('Website must begin with http:// or https://', 'error');
      return;
    }

    setSaving(true);
    try {
      await updateOrganization(orgId, {
        name: name.trim(),
        type,
        description: description.trim(),
        website: website.trim(),
      });
      showToast('Organization profile updated successfully!', 'success');
      navigate(`/org/${orgId}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update organization.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            to={`/org/${orgId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancel & View Public Profile</span>
          </Link>
        </div>

        {/* Form Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Edit Organization Profile
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update official organizational presence and public details.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Organization Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Organization / Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="org-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                placeholder="e.g. Acme Innovations Corp"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors"
              />
            </div>

            {/* Organization Type */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Organization Classification
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('company')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                    type === 'company'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Company / Enterprise</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType('institution')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                    type === 'institution'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Academic / Institution</span>
                </button>
              </div>
            </div>

            {/* Website */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Official Website URL
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="org-website-input"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Organization Description & Mission
              </label>
              <textarea
                id="org-desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Describe your organization's mission, industry scope, and partner focus..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors leading-relaxed"
              />
            </div>

            {/* Security Isolation Disclaimer */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Organization entity records are completely decoupled from individual member Trust Passports. Updates here will not mutate personal professional claims or verification metrics.
              </p>
            </div>

            {/* Submit Actions */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <Link
                to={`/org/${orgId}`}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </Link>

              <button
                id="save-org-btn"
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Organization</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
