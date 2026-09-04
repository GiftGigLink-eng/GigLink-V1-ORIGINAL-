/**
 * Passport Sharing & Verification Utility
 * Phase 6.4
 * 
 * Invariants:
 * 1. Canonical verification link resolves through `/p/:uid`.
 * 2. QR payload encodes the exact canonical public verification URL.
 * 3. All share texts, embed badges, and snippets explicitly state that the
 *    information is a public verification projection, not a transferable credential.
 * 4. Only exposes sanitized public projection fields.
 */

import { PublicTrustPassport } from '../types';
import { generateQrSvgString } from './qrCode';

/**
 * Returns the canonical public Trust Passport verification URL for a user.
 */
export function getCanonicalPassportUrl(uid: string, baseUrl?: string): string {
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://giglink.app');
  return `${origin.replace(/\/$/, '')}/p/${encodeURIComponent(uid)}`;
}

/**
 * Formatted plain text for sharing via messaging, social networks, or email.
 */
export function generatePassportShareText(params: {
  displayName: string;
  trustTier: string;
  trustScore: number;
  uid: string;
  baseUrl?: string;
}): string {
  const canonicalUrl = getCanonicalPassportUrl(params.uid, params.baseUrl);
  return `View ${params.displayName}'s Verified Public Trust Passport on GigLink (${params.trustTier} Tier • Trust Score: ${params.trustScore}/100).\n\nVerification Link: ${canonicalUrl}\n\nNotice: This is a read-only public verification projection, not a transferable credential.`;
}

/**
 * Generates an accessible, semantic HTML embed snippet for personal websites, portfolios, or resumes.
 */
export function generateHtmlEmbedSnippet(params: {
  displayName: string;
  trustTier: string;
  trustScore: number;
  identityVerified: boolean;
  uid: string;
  baseUrl?: string;
}): string {
  const canonicalUrl = getCanonicalPassportUrl(params.uid, params.baseUrl);
  const verifiedBadge = params.identityVerified ? ' [Official ID Verified]' : '';

  return `<!-- GigLink Verified Public Trust Passport Badge -->
<div class="giglink-trust-badge" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: inline-flex; flex-direction: column; padding: 14px 18px; border-radius: 12px; background: #0f172a; color: #ffffff; text-decoration: none; border: 1px solid #334155; max-width: 320px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #818cf8;">GigLink Trust Protocol</span>
    <span style="font-size: 11px; font-weight: 700; background: #1e293b; color: #38bdf8; padding: 2px 8px; border-radius: 6px;">${params.trustTier}</span>
  </div>
  <div style="font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 2px;">
    ${params.displayName}${verifiedBadge}
  </div>
  <div style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;">
    Earned Trust Score: <strong style="color: #4ade80;">${params.trustScore}</strong> / 100
  </div>
  <a href="${canonicalUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 12px; font-weight: 600; color: #6366f1; background: #ffffff; padding: 6px 12px; border-radius: 8px; text-align: center; text-decoration: none;">
    Verify Credentials &rarr;
  </a>
  <span style="font-size: 9px; color: #64748b; margin-top: 6px; text-align: center;">
    Public verification projection • Non-transferable credential
  </span>
</div>`;
}

/**
 * Generates Markdown embed snippet for GitHub profile READMEs and Markdown documents.
 */
export function generateMarkdownEmbedSnippet(params: {
  displayName: string;
  trustTier: string;
  trustScore: number;
  uid: string;
  baseUrl?: string;
}): string {
  const canonicalUrl = getCanonicalPassportUrl(params.uid, params.baseUrl);
  const tierColor =
    params.trustTier === 'Verified Pro'
      ? 'blue'
      : params.trustTier === 'Trusted Expert'
      ? 'success'
      : 'informational';

  return `[![GigLink Verified Trust Passport](https://img.shields.io/badge/GigLink%20Trust%20Passport-${encodeURIComponent(
    params.trustTier
  )}%20(${params.trustScore}%2F100)-${tierColor}?style=for-the-badge&logo=shield)](${canonicalUrl})\n\n> *Public verification projection for ${params.displayName} via [GigLink Trust Protocol](${canonicalUrl}). This is a read-only public projection, not a transferable credential.*`;
}

/**
 * Sanitizes and verifies that a public passport data object strictly adheres to
 * zero-knowledge public projection constraints (no internal notes, government IDs, etc.).
 */
export function sanitizePublicPassportProjection(raw: any): PublicTrustPassport {
  const allowedKeys: (keyof PublicTrustPassport)[] = [
    'userId',
    'uid',
    'organizationId',
    'isPublic',
    'displayName',
    'photoURL',
    'headline',
    'bio',
    'location',
    'structuredLocation',
    'locationVerificationStatus',
    'identityVerified',
    'trustScore',
    'trustTier',
    'skills',
    'projects',
    'certificates',
    'certifications',
    'education',
    'workHistory',
    'experience',
    'socialLinks',
    'portfolioUrl',
    'reviews',
    'metrics',
    'updatedAt',
  ];

  const sanitized: Partial<PublicTrustPassport> = {};
  for (const key of allowedKeys) {
    if (raw && raw[key] !== undefined) {
      (sanitized as any)[key] = raw[key];
    }
  }

  // Explicit safety check against accidental sensitive key propagation
  const forbiddenSensitiveKeys = [
    'idDocumentNumber',
    'idDocumentType',
    'internalVerifierNotes',
    'privatePassword',
    'reviewerUid',
    'auditLogs',
    'adminNotes',
  ];

  for (const forbidden of forbiddenSensitiveKeys) {
    if (forbidden in (sanitized as any)) {
      delete (sanitized as any)[forbidden];
    }
  }

  return sanitized as PublicTrustPassport;
}

/**
 * Generates the SVG QR code markup encoding the canonical URL.
 */
export function getPassportQrSvg(uid: string, baseUrl?: string, size: number = 240): string {
  const canonicalUrl = getCanonicalPassportUrl(uid, baseUrl);
  return generateQrSvgString(canonicalUrl, size);
}
