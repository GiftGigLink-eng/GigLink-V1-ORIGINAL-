import { describe, it, expect } from 'vitest';
import {
  computeCanonicalHash,
  compileAuthoritativeTranscriptSnapshot,
  DEFAULT_TRANSCRIPT_PRIVACY,
  exportTranscriptAsJsonLd,
} from '../lib/transcriptService';
import { UserProfile, PublicTrustPassport } from '../types';
import { VerifiableTranscript } from '../types/transcript';

describe('Phase 9A: Verifiable Work Transcript & Cryptographic Integrity Tests', () => {
  const mockProfile: UserProfile = {
    uid: 'talent_123',
    email: 'alex@example.com',
    displayName: 'Alex Rivers',
    headline: 'Senior Full Stack Engineer',
    bio: 'Building reliable distributed systems and web interfaces.',
    activePersona: 'partner',
    availablePersonas: ['partner'],
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
    location: 'London, UK',
  };

  const mockPassport: PublicTrustPassport = {
    userId: 'talent_123',
    displayName: 'Alex Rivers',
    headline: 'Senior Full Stack Engineer',
    bio: 'Building reliable distributed systems and web interfaces.',
    location: 'London, UK',
    locationVerificationStatus: 'self_declared',
    trustScore: 88,
    trustTier: 'Established',
    identityVerified: true,
    skills: [
      { id: 's1', name: 'TypeScript', category: 'Programming', proficiency: 'expert', verifiedCount: 5 },
      { id: 's2', name: 'React', category: 'Frontend', proficiency: 'advanced', verifiedCount: 8 },
    ],
    projects: [
      {
        id: 'proof_1',
        title: 'Microservices Payment Gateway',
        description: 'High throughput payment processing microservice',
        role: 'Lead Architect',
        completedAt: '2026-05-10T00:00:00.000Z',
        verificationStatus: 'verified',
        verifiedAt: '2026-05-10T00:00:00.000Z',
        projectUrl: 'https://github.com/alex/payment-gateway',
        skillsUsed: ['TypeScript', 'Node.js'],
      },
    ],
    education: [],
    reviews: [],
    metrics: {
      verificationScore: 88,
      completedProjectsCount: 1,
      verifiedSkillsCount: 2,
      endorsementsCount: 0,
      activeStreakDays: 5,
    },
    updatedAt: '2026-08-31T00:00:00.000Z',
  };

  it('1. Deterministically computes consistent SHA-256 canonical payload digest', async () => {
    const payloadA = { a: 1, b: 'test', c: [1, 2, 3] };
    const payloadB = { c: [1, 2, 3], b: 'test', a: 1 }; // Different key order

    const hashA = await computeCanonicalHash(payloadA);
    const hashB = await computeCanonicalHash(payloadB);

    expect(hashA).toBeDefined();
    expect(hashA.length).toBeGreaterThan(10);
    expect(hashA).toBe(hashB); // Order-independent canonical hashing
  });

  it('2. Detects any payload tampering or property alteration in canonical digest', async () => {
    const originalPayload = { talentId: 'talent_123', trustScore: 88, completedCount: 5 };
    const tamperedPayload = { talentId: 'talent_123', trustScore: 100, completedCount: 5 }; // Modified score

    const originalHash = await computeCanonicalHash(originalPayload);
    const tamperedHash = await computeCanonicalHash(tamperedPayload);

    expect(originalHash).not.toBe(tamperedHash);
  });

  it('3. Enforces privacy boundary: hides exact financial figures when showFinancialVolume is false', async () => {
    const privacy = {
      ...DEFAULT_TRANSCRIPT_PRIVACY,
      showFinancialVolume: false,
    };

    const snapshot = await compileAuthoritativeTranscriptSnapshot(
      'talent_123',
      mockProfile,
      mockPassport,
      privacy
    );

    expect(snapshot.totalSettledVolumeUSD).toBeUndefined();
    expect(snapshot.volumeTier).toBeDefined(); // Tier remains readable as a badge
  });

  it('4. Enforces privacy boundary: anonymizes counterparty names when showCounterpartyNames is false', async () => {
    const privacy = {
      ...DEFAULT_TRANSCRIPT_PRIVACY,
      showCounterpartyNames: false,
    };

    const snapshot = await compileAuthoritativeTranscriptSnapshot(
      'talent_123',
      mockProfile,
      mockPassport,
      privacy
    );

    snapshot.contracts.forEach((c) => {
      expect(c.counterpartyDisplay).toBe('Verified Enterprise Client');
    });
  });

  it('5. Exports valid W3C-compliant JSON-LD format with cryptographic signature block', () => {
    const mockTranscript: VerifiableTranscript = {
      id: 'tr_talent_123',
      talentId: 'talent_123',
      talentDisplayName: 'Alex Rivers',
      createdAt: '2026-08-31T00:00:00.000Z',
      updatedAt: '2026-08-31T00:00:00.000Z',
      isPublished: true,
      privacySettings: DEFAULT_TRANSCRIPT_PRIVACY,
      verifiedSnapshot: {
        talentId: 'talent_123',
        talentDisplayName: 'Alex Rivers',
        trustScore: 88,
        trustTier: 'Established',
        identityVerified: true,
        totalCompletedContracts: 3,
        totalMilestonesDelivered: 8,
        volumeTier: 'Gold Tier ($5,000+ settled)',
        memberSince: '2026-01-15',
        verifiedSkills: ['TypeScript', 'React'],
        contracts: [],
        projectProofs: [],
      },
      proof: {
        type: 'GigLinkCryptographicTranscript2026',
        created: '2026-08-31T00:00:00.000Z',
        verificationMethod: 'https://giglink.network/verify/keys/canonical-2026',
        payloadDigest: 'sha256_mock_abcdef1234567890',
        signature: 'sig_gl_abcdef1234567890_123456',
        issuer: 'GigLink Authoritative Attestation Network',
      },
    };

    const jsonLdString = exportTranscriptAsJsonLd(mockTranscript);
    expect(jsonLdString).toBeDefined();

    const parsed = JSON.parse(jsonLdString);
    expect(parsed['@context']).toContain('https://www.w3.org/2018/credentials/v1');
    expect(parsed.type).toContain('VerifiableCredential');
    expect(parsed.credentialSubject.trustScore).toBe(88);
    expect(parsed.proof.digest).toBe('sha256_mock_abcdef1234567890');
  });
});
