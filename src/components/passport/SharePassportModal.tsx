import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  QrCode,
  Code2,
  Share2,
  ShieldCheck,
  ExternalLink,
  Download,
  AlertTriangle,
  FileText,
  Eye,
  Lock,
  Sparkles,
} from 'lucide-react';
import {
  getCanonicalPassportUrl,
  generatePassportShareText,
  generateHtmlEmbedSnippet,
  generateMarkdownEmbedSnippet,
  getPassportQrSvg,
} from '../../lib/passportSharing';
import { PublicTrustPassport, TrustPassport } from '../../types';

interface SharePassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  passport?: Partial<PublicTrustPassport> | Partial<TrustPassport> | null;
  displayName?: string;
  trustTier?: string;
  trustScore?: number;
  isOwner?: boolean;
  isPublic?: boolean;
  onToggleVisibility?: () => Promise<void>;
}

export const SharePassportModal: React.FC<SharePassportModalProps> = ({
  isOpen,
  onClose,
  uid,
  passport,
  displayName: propDisplayName,
  trustTier: propTrustTier,
  trustScore: propTrustScore,
  isOwner = false,
  isPublic = true,
  onToggleVisibility,
}) => {
  const [activeTab, setActiveTab] = useState<'link' | 'qr' | 'embed' | 'text'>('link');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  if (!isOpen) return null;

  const canonicalUrl = getCanonicalPassportUrl(uid);
  const displayName = propDisplayName || (passport as any)?.displayName || 'GigLink Professional';
  const trustTier = propTrustTier || (passport as any)?.trustTier || 'Verified Pro';
  const trustScore = propTrustScore !== undefined ? propTrustScore : ((passport as any)?.trustScore ?? 80);
  const identityVerified = passport?.identityVerified ?? false;

  const shareText = generatePassportShareText({
    displayName,
    trustTier,
    trustScore,
    uid,
  });

  const htmlEmbed = generateHtmlEmbedSnippet({
    displayName,
    trustTier,
    trustScore,
    identityVerified,
    uid,
  });

  const markdownEmbed = generateMarkdownEmbedSnippet({
    displayName,
    trustTier,
    trustScore,
    uid,
  });

  const qrSvgString = getPassportQrSvg(uid, undefined, 240);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2200);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${displayName}'s Verified Public Trust Passport`,
          text: `Check out ${displayName}'s Verified Trust Passport on GigLink (${trustTier} Tier • ${trustScore}/100 Trust Score).`,
          url: canonicalUrl,
        });
      } catch {
        // Fallback to copying
        handleCopy(shareText, 'share-text');
      }
    } else {
      handleCopy(shareText, 'share-text');
    }
  };

  const handleDownloadQr = () => {
    setDownloadingQr(true);
    try {
      const blob = new Blob([qrSvgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `giglink-passport-qr-${uid.substring(0, 8)}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download QR SVG:', err);
    } finally {
      setDownloadingQr(false);
    }
  };

  const handleToggle = async () => {
    if (!onToggleVisibility) return;
    setTogglingVisibility(true);
    try {
      await onToggleVisibility();
    } finally {
      setTogglingVisibility(false);
    }
  };

  return (
    <div
      id="share-passport-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="share-passport-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="share-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate"
              >
                Share Trust Passport
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Public verification projection for {displayName}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-share-modal-btn"
            onClick={onClose}
            aria-label="Close share dialog"
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Private Status Notice (if private) */}
        {!isPublic && isOwner && (
          <div
            id="private-passport-warning"
            className="p-3.5 mx-4 sm:mx-5 mt-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5 shrink-0"
          >
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold">Your Trust Passport is currently Private</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Visitors who open this link will see a privacy screen until you enable public visibility.
              </p>
              {onToggleVisibility && (
                <button
                  type="button"
                  id="make-public-btn"
                  onClick={handleToggle}
                  disabled={togglingVisibility}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 px-2.5 py-1 rounded-lg hover:bg-amber-100/50 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{togglingVisibility ? 'Publishing...' : 'Publish Passport Now'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-5 pt-3 pb-1 shrink-0 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            id="tab-share-link"
            onClick={() => setActiveTab('link')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap min-h-[44px] ${
              activeTab === 'link'
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Canonical Link</span>
          </button>

          <button
            type="button"
            id="tab-share-qr"
            onClick={() => setActiveTab('qr')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap min-h-[44px] ${
              activeTab === 'qr'
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Code</span>
          </button>

          <button
            type="button"
            id="tab-share-embed"
            onClick={() => setActiveTab('embed')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap min-h-[44px] ${
              activeTab === 'embed'
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Embed Badge</span>
          </button>

          <button
            type="button"
            id="tab-share-text"
            onClick={() => setActiveTab('text')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap min-h-[44px] ${
              activeTab === 'text'
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Share Copy</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: CANONICAL LINK */}
          {activeTab === 'link' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Canonical Public Verification URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={canonicalUrl}
                    id="canonical-url-input"
                    className="flex-1 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-mono select-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    id="copy-canonical-url-btn"
                    onClick={() => handleCopy(canonicalUrl, 'canonical-url')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0 min-h-[44px]"
                  >
                    {copiedType === 'canonical-url' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Passport Snapshot Preview */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {displayName}
                    </span>
                    {identityVerified && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded">
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {trustTier} Tier • {trustScore}/100 Earned Trust
                  </p>
                </div>

                <a
                  href={canonicalUrl}
                  target="_blank"
                  rel="noreferrer"
                  id="preview-canonical-link"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 p-2 min-h-[44px]"
                >
                  <span>Open View</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Native Mobile Share trigger */}
              <button
                type="button"
                id="native-share-trigger-btn"
                onClick={handleNativeShare}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors min-h-[44px]"
              >
                <Share2 className="w-4 h-4 text-indigo-600" />
                <span>Share via Messaging / Social Sheet</span>
              </button>
            </div>
          )}

          {/* TAB 2: QR CODE */}
          {activeTab === 'qr' && (
            <div className="space-y-4 text-center animate-in fade-in duration-150">
              <div className="inline-block p-4 bg-white rounded-2xl border border-slate-200 shadow-sm mx-auto">
                <div
                  id="passport-qr-code-container"
                  dangerouslySetInnerHTML={{ __html: qrSvgString }}
                  className="w-48 h-48 sm:w-56 sm:h-56 mx-auto flex items-center justify-center"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Scan to Verify Trust Passport
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Encodes the canonical public verification URL for resumes, badges, and business cards.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  id="download-qr-btn"
                  onClick={handleDownloadQr}
                  disabled={downloadingQr}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors min-h-[44px]"
                >
                  <Download className="w-4 h-4" />
                  <span>Download SVG Vector QR</span>
                </button>

                <button
                  type="button"
                  id="copy-qr-svg-btn"
                  onClick={() => handleCopy(qrSvgString, 'qr-svg')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
                >
                  {copiedType === 'qr-svg' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied SVG Code</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SVG Markup</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: EMBED BADGE */}
          {activeTab === 'embed' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Badge Live Visual Preview
                </span>
                
                {/* Visual Live Preview */}
                <div className="p-4 bg-slate-950 text-white rounded-2xl border border-slate-800 space-y-2 max-w-sm">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-indigo-400 uppercase tracking-wider">GigLink Trust Protocol</span>
                    <span className="bg-slate-800 text-sky-400 px-2 py-0.5 rounded-md font-semibold text-[10px]">{trustTier}</span>
                  </div>
                  <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    <span>{displayName}</span>
                    {identityVerified && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-xs text-slate-400">
                    Earned Trust Score: <strong className="text-emerald-400">{trustScore}</strong> / 100
                  </div>
                  <div className="pt-1">
                    <span className="inline-block bg-white text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-lg text-center">
                      Verify Credentials &rarr;
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500 pt-1">
                    Public verification projection • Non-transferable credential
                  </p>
                </div>
              </div>

              {/* HTML Embed Snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    HTML Embed Code (Website & Portfolio)
                  </label>
                  <button
                    type="button"
                    id="copy-html-embed-btn"
                    onClick={() => handleCopy(htmlEmbed, 'html-embed')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 p-1 min-h-[44px]"
                  >
                    {copiedType === 'html-embed' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied HTML</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy HTML</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={4}
                  value={htmlEmbed}
                  id="html-embed-textarea"
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-800 dark:text-slate-200 select-all focus:outline-none"
                />
              </div>

              {/* Markdown Embed Snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Markdown Badge (GitHub Profile README)
                  </label>
                  <button
                    type="button"
                    id="copy-markdown-embed-btn"
                    onClick={() => handleCopy(markdownEmbed, 'markdown-embed')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 p-1 min-h-[44px]"
                  >
                    {copiedType === 'markdown-embed' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied Markdown</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Markdown</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={3}
                  value={markdownEmbed}
                  id="markdown-embed-textarea"
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-800 dark:text-slate-200 select-all focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 4: SHARE TEXT */}
          {activeTab === 'text' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Formatted Text for Social / Messaging
                  </label>
                  <button
                    type="button"
                    id="copy-share-text-btn"
                    onClick={() => handleCopy(shareText, 'share-text')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 p-1 min-h-[44px]"
                  >
                    {copiedType === 'share-text' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied Text</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Formatted Text</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={5}
                  value={shareText}
                  id="share-text-textarea"
                  className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 select-all focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Strict Security & Projection Disclaimer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 shrink-0 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Public Verification Projection Guarantee</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
            Zero-knowledge privacy enforced. Private identification numbers, reviewer notes, and internal audit logs are cryptographically excluded. This link is a public verification projection, not a transferable credential.
          </p>
        </div>
      </div>
    </div>
  );
};
