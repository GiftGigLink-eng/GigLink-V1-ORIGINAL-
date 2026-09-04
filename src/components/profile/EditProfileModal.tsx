import React, { useState } from 'react';
import {
  X,
  User,
  MapPin,
  Globe,
  Github,
  Linkedin,
  Twitter,
  Loader2,
  AlertCircle,
  Eye,
  Lock,
} from 'lucide-react';
import { HierarchicalLocationSelector } from '../common/HierarchicalLocationSelector';
import { StructuredLocation, SocialLinks, UnifiedProfileData } from '../../types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: UnifiedProfileData;
  onSubmit: (updates: {
    headline: string;
    bio: string;
    structuredLocation: StructuredLocation | null;
    socialLinks: SocialLinks;
    isPublic: boolean;
  }) => Promise<void>;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSubmit,
}) => {
  const [headline, setHeadline] = useState(initialData.headline || '');
  const [bio, setBio] = useState(initialData.bio || '');
  const [structuredLocation, setStructuredLocation] = useState<StructuredLocation | null>(
    initialData.structuredLocation || null
  );
  const [isPublic, setIsPublic] = useState(initialData.isPublic ?? false);
  const [portfolio, setPortfolio] = useState(initialData.socialLinks?.portfolio || '');
  const [github, setGithub] = useState(initialData.socialLinks?.github || '');
  const [linkedin, setLinkedin] = useState(initialData.socialLinks?.linkedin || '');
  const [twitter, setTwitter] = useState(initialData.socialLinks?.twitter || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headline.trim()) {
      setError('Professional headline is required.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await onSubmit({
        headline: headline.trim(),
        bio: bio.trim(),
        structuredLocation,
        isPublic,
        socialLinks: {
          portfolio: portfolio.trim() || undefined,
          github: github.trim() || undefined,
          linkedin: linkedin.trim() || undefined,
          twitter: twitter.trim() || undefined,
        },
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="edit-profile-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Professional Profile
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update your professional headline, bio, location, and web links
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Professional Headline */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-headline-input"
              className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
            >
              Professional Headline *
            </label>
            <input
              id="edit-headline-input"
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Senior Frontend Architect | React, TypeScript & Web3"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              required
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              A concise summary of your primary technical focus and senior capability.
            </p>
          </div>

          {/* Bio / Summary */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-bio-input"
              className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
            >
              About & Professional Bio
            </label>
            <textarea
              id="edit-bio-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Provide a detailed overview of your engineering background, key accomplishments, problem-solving domain, and areas of passion."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          {/* Location Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>Location (Country, State/Region & City)</span>
            </label>
            <HierarchicalLocationSelector
              value={structuredLocation}
              onChange={setStructuredLocation}
            />
          </div>

          {/* Public Visibility Toggle */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <Eye className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-400" />
                )}
                <div>
                  <label
                    htmlFor="toggle-public-profile-btn"
                    className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    Public Profile Visibility
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    When enabled, counterparties can view your profile at{' '}
                    <code className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">
                      /p/{initialData.uid}
                    </code>
                  </p>
                </div>
              </div>

              <button
                id="toggle-public-profile-btn"
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setIsPublic(!isPublic)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                  isPublic ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isPublic ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Social Links Sub-section */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Social Links & Online Presence
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Portfolio */}
              <div className="space-y-1">
                <label
                  htmlFor="edit-portfolio-input"
                  className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Portfolio / Personal Website</span>
                </label>
                <input
                  id="edit-portfolio-input"
                  type="url"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  placeholder="https://myportfolio.com"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* GitHub */}
              <div className="space-y-1">
                <label
                  htmlFor="edit-github-input"
                  className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub Profile</span>
                </label>
                <input
                  id="edit-github-input"
                  type="url"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  placeholder="https://github.com/username"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* LinkedIn */}
              <div className="space-y-1">
                <label
                  htmlFor="edit-linkedin-input"
                  className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"
                >
                  <Linkedin className="w-3.5 h-3.5 text-blue-600" />
                  <span>LinkedIn Profile</span>
                </label>
                <input
                  id="edit-linkedin-input"
                  type="url"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Twitter */}
              <div className="space-y-1">
                <label
                  htmlFor="edit-twitter-input"
                  className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"
                >
                  <Twitter className="w-3.5 h-3.5 text-sky-500" />
                  <span>X / Twitter</span>
                </label>
                <input
                  id="edit-twitter-input"
                  type="url"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="https://x.com/username"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-profile-changes-btn"
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Updates...</span>
                </>
              ) : (
                <span>Save Profile</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
