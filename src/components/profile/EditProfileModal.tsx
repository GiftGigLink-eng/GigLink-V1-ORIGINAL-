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
  Camera,
  Trash2,
  Target,
  Users,
  Check,
} from 'lucide-react';
import { HierarchicalLocationSelector } from '../common/HierarchicalLocationSelector';
import { StructuredLocation, SocialLinks, UnifiedProfileData } from '../../types';
import { validateProfileImageUrl } from '../../lib/profileService';
import { PRESET_HIRING_INTERESTS, PRESET_TALENT_TYPES } from '../onboarding/CreatorOnboardingPage';

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: UnifiedProfileData;
  onSubmit: (updates: {
    headline: string;
    bio: string;
    structuredLocation: StructuredLocation | null;
    socialLinks: SocialLinks;
    isPublic: boolean;
    photoURL?: string;
    hiringInterests?: string[];
    talentTypes?: string[];
    customHiringNeed?: string;
    publishHiringFocus?: boolean;
  }) => Promise<void>;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSubmit,
}) => {
  const isClientPersona =
    initialData.activePersona === 'client' || initialData.activePersona === 'creator';

  const [headline, setHeadline] = useState(initialData.headline || '');
  const [bio, setBio] = useState(initialData.bio || '');
  const [structuredLocation, setStructuredLocation] = useState<StructuredLocation | null>(
    initialData.structuredLocation || null
  );
  const [isPublic, setIsPublic] = useState(initialData.isPublic ?? false);
  const [photoURL, setPhotoURL] = useState(initialData.photoURL || '');
  const [avatarImageError, setAvatarImageError] = useState(false);

  // Client hiring identity state
  const [hiringInterests, setHiringInterests] = useState<string[]>(
    initialData.hiringInterests || []
  );
  const [talentTypes, setTalentTypes] = useState<string[]>(
    initialData.talentTypes || []
  );
  const [customHiringNeed, setCustomHiringNeed] = useState(
    initialData.customHiringNeed || ''
  );
  const [publishHiringFocus, setPublishHiringFocus] = useState(
    initialData.publishHiringFocus ?? false
  );
  const [customInterestInput, setCustomInterestInput] = useState('');

  // Social links
  const [portfolio, setPortfolio] = useState(initialData.socialLinks?.portfolio || '');
  const [github, setGithub] = useState(initialData.socialLinks?.github || '');
  const [linkedin, setLinkedin] = useState(initialData.socialLinks?.linkedin || '');
  const [twitter, setTwitter] = useState(initialData.socialLinks?.twitter || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleInterest = (interest: string) => {
    if (hiringInterests.includes(interest)) {
      setHiringInterests(hiringInterests.filter((i) => i !== interest));
    } else {
      setHiringInterests([...hiringInterests, interest]);
    }
  };

  const handleAddCustomInterest = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = customInterestInput.trim();
    if (trimmed && !hiringInterests.includes(trimmed)) {
      setHiringInterests([...hiringInterests, trimmed]);
      setCustomInterestInput('');
    }
  };

  const toggleTalentType = (type: string) => {
    if (talentTypes.includes(type)) {
      setTalentTypes(talentTypes.filter((t) => t !== type));
    } else {
      setTalentTypes([...talentTypes, type]);
    }
  };

  const handlePhotoURLChange = (val: string) => {
    setPhotoURL(val);
    setAvatarImageError(false);
  };

  const handleRemovePhoto = () => {
    setPhotoURL('');
    setAvatarImageError(false);
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headline.trim()) {
      setError('Professional headline is required.');
      return;
    }

    // Validate photoURL if provided
    if (photoURL.trim()) {
      const urlValidation = validateProfileImageUrl(photoURL, { allowEmpty: true });
      if (!urlValidation.isValid) {
        setError(urlValidation.error || 'Invalid profile picture URL.');
        return;
      }
    }

    setError(null);
    setSaving(true);

    try {
      await onSubmit({
        headline: headline.trim(),
        bio: bio.trim(),
        structuredLocation,
        isPublic,
        photoURL: photoURL.trim(),
        ...(isClientPersona
          ? {
              hiringInterests,
              talentTypes,
              customHiringNeed: customHiringNeed.trim(),
              publishHiringFocus,
            }
          : {}),
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
                Update your identity, visual avatar, hiring focus, and links
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Universal Profile Picture (Avatar) Management */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Profile Picture & Avatar
              </label>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Avatar Preview */}
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center shadow-inner">
                  {photoURL.trim() && !avatarImageError ? (
                    <img
                      src={photoURL.trim()}
                      alt="Avatar preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={() => setAvatarImageError(true)}
                    />
                  ) : (
                    <span className="text-base font-bold text-slate-600 dark:text-slate-300">
                      {getInitials(initialData.displayName)}
                    </span>
                  )}
                </div>
              </div>

              {/* URL Input and Controls */}
              <div className="w-full space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    id="edit-photo-url-input"
                    type="url"
                    value={photoURL}
                    onChange={(e) => handlePhotoURLChange(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  {photoURL.trim() && (
                    <button
                      id="remove-photo-url-btn"
                      type="button"
                      onClick={handleRemovePhoto}
                      title="Remove custom picture"
                      className="px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/60 rounded-xl transition-colors shrink-0 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Provide a direct, secure HTTPS image URL. Clear to revert to your default initials.
                </p>
              </div>
            </div>
          </div>

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

          {/* Client Hiring Identity (Conditionally Rendered for Client / Creator Persona) */}
          {isClientPersona && (
            <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/50 rounded-2xl space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Hiring & Project Focus
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Define the domain needs and talent types you actively recruit or hire for
                  </p>
                </div>
              </div>

              {/* Hiring Interests */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Domain & Project Needs
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_HIRING_INTERESTS.map((interest) => {
                    const selected = hiringInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          selected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3" />}
                        <span>{interest}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Interest Input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={customInterestInput}
                    onChange={(e) => setCustomInterestInput(e.target.value)}
                    onKeyDown={handleAddCustomInterest}
                    placeholder="Add custom domain focus..."
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 grow"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomInterest}
                    disabled={!customInterestInput.trim()}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Preferred Talent Archetypes */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Preferred Talent Archetypes
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TALENT_TYPES.map((type) => {
                    const selected = talentTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleTalentType(type)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          selected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3" />}
                        <span>{type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom / Immediate Hiring Need */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Immediate / Custom Hiring Need
                </label>
                <textarea
                  value={customHiringNeed}
                  onChange={(e) => setCustomHiringNeed(e.target.value)}
                  rows={2}
                  placeholder="e.g. Currently seeking a senior Rust/Solana developer for a 3-month contract starting next month."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              {/* Hiring Focus Privacy Toggle */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {publishHiringFocus ? (
                      <Eye className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-400" />
                    )}
                    <div>
                      <label
                        htmlFor="toggle-publish-hiring-focus-btn"
                        className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                      >
                        Publish Hiring Focus on Public Profile
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        When enabled (and your profile is public), your hiring needs and preferences appear on your public professional profile. When disabled, your hiring needs remain strictly private.
                      </p>
                    </div>
                  </div>

                  <button
                    id="toggle-publish-hiring-focus-btn"
                    type="button"
                    role="switch"
                    aria-checked={publishHiringFocus}
                    onClick={() => setPublishHiringFocus(!publishHiringFocus)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                      publishHiringFocus ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        publishHiringFocus ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

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
                    When enabled, counterparties can view your verified profile at{' '}
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
