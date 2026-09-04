import React, { useState } from 'react';
import {
  Globe,
  Github,
  Linkedin,
  Twitter,
  Link as LinkIcon,
  ExternalLink,
  Edit3,
  Check,
  Copy,
} from 'lucide-react';
import { SocialLinks } from '../../types';

interface SocialLinksSectionProps {
  socialLinks?: SocialLinks;
  onEdit?: () => void;
  readOnly?: boolean;
}

export const SocialLinksSection: React.FC<SocialLinksSectionProps> = ({
  socialLinks,
  onEdit,
  readOnly = false,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (key: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const links = [
    {
      key: 'portfolio',
      label: 'Portfolio & Website',
      url: socialLinks?.portfolio,
      icon: <Globe className="w-4 h-4 text-indigo-500" />,
    },
    {
      key: 'github',
      label: 'GitHub Profile',
      url: socialLinks?.github,
      icon: <Github className="w-4 h-4 text-slate-900 dark:text-white" />,
    },
    {
      key: 'linkedin',
      label: 'LinkedIn Profile',
      url: socialLinks?.linkedin,
      icon: <Linkedin className="w-4 h-4 text-blue-600" />,
    },
    {
      key: 'twitter',
      label: 'X / Twitter',
      url: socialLinks?.twitter,
      icon: <Twitter className="w-4 h-4 text-sky-500" />,
    },
    {
      key: 'other',
      label: 'Other Online Reference',
      url: socialLinks?.other,
      icon: <LinkIcon className="w-4 h-4 text-slate-500" />,
    },
  ].filter((l) => Boolean(l.url && l.url.trim().length > 0));

  return (
    <div
      id="profile-social-links-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Online Presence & Social Links
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified web presence and public code repositories.
          </p>
        </div>

        {!readOnly && onEdit && (
          <button
            id="edit-social-links-btn"
            onClick={onEdit}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Links</span>
          </button>
        )}
      </div>

      {links.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {links.map((link) => (
            <div
              key={link.key}
              className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shrink-0">
                  {link.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {link.label}
                  </p>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
                  >
                    {link.url}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => link.url && copyToClipboard(link.key, link.url)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Copy URL"
                >
                  {copiedKey === link.key ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Open Link in New Tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            No social or portfolio links added yet.
          </p>
          {!readOnly && onEdit && (
            <button
              onClick={onEdit}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Add GitHub, LinkedIn, or personal portfolio URL
            </button>
          )}
        </div>
      )}
    </div>
  );
};
