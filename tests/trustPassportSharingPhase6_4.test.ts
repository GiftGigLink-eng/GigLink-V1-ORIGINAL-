import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  getCanonicalPassportUrl,
  generatePassportShareText,
  generateHtmlEmbedSnippet,
  generateMarkdownEmbedSnippet,
  sanitizePublicPassportProjection,
  getPassportQrSvg,
} from '../src/lib/passportSharing';
import { generateQrMatrix, generateQrSvgString } from '../src/lib/qrCode';
import { PublicTrustPassport } from '../src/types';

export async function runTrustPassportSharingTests() {
  console.log('========================================================================');
  console.log('STARTING PHASE 6.4 TRUST PASSPORT SHARING & VERIFICATION TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ PASS: ${title}`);
    } else {
      console.error(`  ✗ FAIL: ${title}`);
      if (details) console.error(`    Detail: ${details}`);
    }
  }

  const mockUid = 'user_abc_123';
  const mockDisplayName = 'Alex Chen';
  const mockTrustTier = 'Verified Pro';
  const mockTrustScore = 85;

  // -------------------------------------------------------------------------
  // 1. CANONICAL URL INTEGRITY
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Canonical Verification URL Integrity ---');

  const urlStandard = getCanonicalPassportUrl(mockUid, 'https://giglink.app');
  assert(
    'Generates canonical /p/:uid URL format',
    urlStandard === 'https://giglink.app/p/user_abc_123',
    `Expected https://giglink.app/p/user_abc_123, got ${urlStandard}`
  );

  const urlTrailing = getCanonicalPassportUrl(mockUid, 'https://giglink.app/');
  assert(
    'Handles base URLs with trailing slashes without duplicate slashes',
    urlTrailing === 'https://giglink.app/p/user_abc_123',
    `Expected https://giglink.app/p/user_abc_123, got ${urlTrailing}`
  );

  const complexUid = 'user+special@123';
  const urlEncoded = getCanonicalPassportUrl(complexUid, 'https://giglink.app');
  assert(
    'URL-encodes special characters in user IDs safely',
    urlEncoded === 'https://giglink.app/p/user%2Bspecial%40123',
    `Expected https://giglink.app/p/user%2Bspecial%40123, got ${urlEncoded}`
  );

  // -------------------------------------------------------------------------
  // 2. QR CODE PAYLOAD & VECTOR SVG INTEGRITY
  // -------------------------------------------------------------------------
  console.log('\n--- 2. QR Code Payload & Vector SVG Integrity ---');

  const canonicalUrl = getCanonicalPassportUrl(mockUid, 'https://giglink.app');
  const matrix = generateQrMatrix(canonicalUrl);
  assert(
    'Generates valid square boolean matrix for QR code',
    Array.isArray(matrix) && matrix.length >= 21 && matrix[0].length === matrix.length,
    `Matrix dimensions: ${matrix.length}x${matrix[0]?.length}`
  );

  const qrSvg = getPassportQrSvg(mockUid, 'https://giglink.app', 240);
  assert(
    'Generates scalable vector SVG markup with xmlns, viewBox, and crisp vector rects',
    qrSvg.includes('<svg') &&
      qrSvg.includes('xmlns="http://www.w3.org/2000/svg"') &&
      qrSvg.includes('viewBox="0 0 240 240"') &&
      qrSvg.includes('shape-rendering="crispEdges"') &&
      qrSvg.includes('</svg>'),
    `SVG structure missing required vector attributes`
  );

  // -------------------------------------------------------------------------
  // 3. PUBLIC VERIFICATION DISCLAIMER COMPLIANCE
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Public Verification Disclaimer Compliance ---');

  const shareText = generatePassportShareText({
    displayName: mockDisplayName,
    trustTier: mockTrustTier,
    trustScore: mockTrustScore,
    uid: mockUid,
    baseUrl: 'https://giglink.app',
  });

  assert(
    'Plain text share copy contains display name, tier, score, and canonical link',
    shareText.includes(mockDisplayName) &&
      shareText.includes(mockTrustTier) &&
      shareText.includes('85/100') &&
      shareText.includes('https://giglink.app/p/user_abc_123'),
    `Missing required attributes in share text: ${shareText}`
  );

  assert(
    'Plain text share copy communicates that information is a public verification projection, not a transferable credential',
    shareText.includes('public verification projection, not a transferable credential'),
    `Missing mandatory disclaimer in plain text share copy`
  );

  const htmlEmbed = generateHtmlEmbedSnippet({
    displayName: mockDisplayName,
    trustTier: mockTrustTier,
    trustScore: mockTrustScore,
    identityVerified: true,
    uid: mockUid,
    baseUrl: 'https://giglink.app',
  });

  assert(
    'HTML embed snippet renders semantic verification badge with target="_blank" and rel="noopener noreferrer"',
    htmlEmbed.includes('https://giglink.app/p/user_abc_123') &&
      htmlEmbed.includes('target="_blank"') &&
      htmlEmbed.includes('rel="noopener noreferrer"') &&
      htmlEmbed.includes(mockDisplayName) &&
      htmlEmbed.includes('Official ID Verified'),
    `HTML embed snippet missing required semantic markup`
  );

  assert(
    'HTML embed snippet communicates public verification projection and non-transferable credential disclaimer',
    htmlEmbed.includes('Public verification projection • Non-transferable credential'),
    `HTML embed snippet missing mandatory disclaimer`
  );

  const markdownEmbed = generateMarkdownEmbedSnippet({
    displayName: mockDisplayName,
    trustTier: mockTrustTier,
    trustScore: mockTrustScore,
    uid: mockUid,
    baseUrl: 'https://giglink.app',
  });

  assert(
    'Markdown embed snippet contains valid markdown link and badge shield',
    markdownEmbed.includes('https://giglink.app/p/user_abc_123') &&
      markdownEmbed.includes('img.shields.io') &&
      markdownEmbed.includes(mockDisplayName),
    `Markdown embed snippet missing required markdown structure`
  );

  assert(
    'Markdown embed snippet communicates public verification projection and non-transferable credential disclaimer',
    markdownEmbed.includes('read-only public projection, not a transferable credential'),
    `Markdown embed snippet missing mandatory disclaimer`
  );

  // -------------------------------------------------------------------------
  // 4. ZERO-KNOWLEDGE SANITIZATION & PRIVACY BOUNDARIES
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Zero-Knowledge Sanitization & Privacy Boundaries ---');

  const sensitiveRawData = {
    userId: 'user_123',
    displayName: 'Sam Taylor',
    headline: 'Senior Full Stack Engineer',
    bio: 'Building decentralized protocols',
    location: 'San Francisco, CA',
    trustScore: 92,
    trustTier: 'Trusted Expert',
    identityVerified: true,
    // Sensitive attributes that MUST NOT leak
    idDocumentNumber: 'PASSPORT-X99887722',
    idDocumentType: 'passport',
    internalVerifierNotes: 'Verified against California DMV database by Admin #42',
    privatePassword: 'hashed_password_abc',
    reviewerUid: 'admin_super_99',
    auditLogs: [{ action: 'kyc_override', timestamp: 1234567 }],
    adminNotes: 'Confidential review notes',
  };

  const sanitized = sanitizePublicPassportProjection(sensitiveRawData);

  assert(
    'Sanitized projection preserves legitimate public identity and trust metrics',
    sanitized.userId === 'user_123' &&
      sanitized.displayName === 'Sam Taylor' &&
      sanitized.trustScore === 92 &&
      sanitized.trustTier === 'Trusted Expert' &&
      sanitized.identityVerified === true,
    `Sanitized projection lost public properties`
  );

  assert(
    'Sanitized projection strictly purges sensitive government IDs, internal verifier notes, passwords, and reviewer trails',
    (sanitized as any).idDocumentNumber === undefined &&
      (sanitized as any).idDocumentType === undefined &&
      (sanitized as any).internalVerifierNotes === undefined &&
      (sanitized as any).privatePassword === undefined &&
      (sanitized as any).reviewerUid === undefined &&
      (sanitized as any).auditLogs === undefined &&
      (sanitized as any).adminNotes === undefined,
    `Sensitive keys leaked into sanitized public projection: ${JSON.stringify(sanitized)}`
  );

  // -------------------------------------------------------------------------
  // 5. IMMUTABILITY OF CORE TRUST INVARIANTS
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Immutability of Core Trust Invariants ---');

  const originalPassport: PublicTrustPassport = {
    userId: 'u_100',
    displayName: 'Dev User',
    trustScore: 85,
    trustTier: 'Verified Pro',
    identityVerified: true,
    headline: 'Tech Lead',
    bio: 'Open source enthusiast',
    location: 'Austin, TX',
    locationVerificationStatus: 'verified',
    projects: [],
    skills: [],
    education: [],
    reviews: [],
    metrics: {
      verificationScore: 85,
      completedProjectsCount: 5,
      verifiedSkillsCount: 4,
      endorsementsCount: 3,
      activeStreakDays: 12,
    },
    updatedAt: new Date().toISOString(),
  };

  const generatedUrl = getCanonicalPassportUrl(originalPassport.userId);
  const generatedText = generatePassportShareText({
    displayName: originalPassport.displayName,
    trustTier: originalPassport.trustTier,
    trustScore: originalPassport.trustScore,
    uid: originalPassport.userId,
  });

  assert(
    'Sharing actions and URL generation do not mutate or allow client alteration of Trust Score, Tier, or Verification status',
    originalPassport.trustScore === 85 &&
      originalPassport.trustTier === 'Verified Pro' &&
      originalPassport.identityVerified === true &&
      generatedUrl.includes('/p/u_100') &&
      generatedText.includes('85/100'),
    `Passport invariants mutated during sharing operations`
  );

  // -------------------------------------------------------------------------
  // 6. FROZEN FIRESTORE RULES BASELINE INTEGRITY
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Frozen Firestore Rules Baseline Integrity ---');

  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');
  const actualHash = crypto.createHash('sha256').update(rulesContent).digest('hex');
  const expectedHash = '667e03431c26c17293ad78bff2c87a385e093fe3b6c902bd0d57f529a43500ce';

  assert(
    'firestore.rules matches the frozen SHA-256 baseline checksum exactly',
    actualHash === expectedHash,
    `Expected ${expectedHash}, got ${actualHash}`
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`PHASE 6.4 TEST SUMMARY: ${passed} / ${total} TESTS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('========================================================================\n');

  if (passed !== total) {
    throw new Error(`Phase 6.4 test suite failed: ${total - passed} failures`);
  }
}

// Auto-run if invoked directly via tsx
if (process.argv[1]?.includes('trustPassportSharingPhase6_4')) {
  runTrustPassportSharingTests().catch((err) => {
    console.error('Fatal test execution error:', err);
    process.exit(1);
  });
}
