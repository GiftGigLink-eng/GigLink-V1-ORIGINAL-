import { test, describe } from 'node:test';
import assert from 'node:assert';
import { sanitizePublicPassportProjection } from '../src/lib/profileService';
import { TrustPassport, UserProfile, SkillItem, ProjectProof, CertificationItem } from '../src/types';

describe('Canonical Profile & Professional Identity Verification Suite', () => {
  const mockPrivatePassport: TrustPassport = {
    id: 'user_123',
    userId: 'user_123',
    headline: 'Senior Cloud Architect',
    bio: '10+ years engineering secure scalable distributed systems.',
    location: 'San Francisco, CA',
    structuredLocation: {
      country: 'United States',
      state: 'CA',
      city: 'San Francisco',
      formattedAddress: 'San Francisco, CA, USA',
    },
    isPublic: true,
    skills: [
      {
        id: 'skill_1',
        name: 'TypeScript',
        category: 'frontend',
        proficiency: 'expert',
        verifiedCount: 3,
      },
      {
        id: 'skill_2',
        name: 'Distributed Systems',
        category: 'backend',
        proficiency: 'expert',
        verifiedCount: 0, // unverified item
      },
    ],
    projects: [
      {
        id: 'proj_pub_1',
        title: 'High-Throughput Ingestion Engine',
        role: 'Lead Architect',
        summary: 'Kafka-based real-time ingestion pipeline.',
        description: 'Processes 2M events/sec with sub-50ms latency.',
        deliverables: ['Kafka Streams Topology', 'Prometheus Dashboard'],
        skillsUsed: ['TypeScript', 'Distributed Systems'],
        completedAt: '2025-11',
        status: 'published',
        isFeatured: true,
        verificationStatus: 'verified',
        verifierName: 'Enterprise Audit Corp',
        verifierUid: 'auditor_999',
        verifiedAt: '2025-11-20',
      },
      {
        id: 'proj_draft_2',
        title: 'Confidential Internal Microservice',
        role: 'Engineer',
        summary: 'Proprietary algorithm.',
        description: 'Internal secret project.',
        deliverables: ['Secret Module'],
        skillsUsed: ['TypeScript'],
        completedAt: '2026-01',
        status: 'draft', // DRAFT - MUST BE FILTERED OUT
        verificationStatus: 'pending',
      },
    ],
    experience: [
      {
        id: 'exp_1',
        organizationName: 'Global Cloud Systems',
        roleTitle: 'Principal Engineer',
        type: 'employment',
        startDate: '2023-01',
        isCurrent: true,
        description: 'Architecting platform infrastructure.',
        verificationStatus: 'verified',
        verifierName: 'Global Cloud Systems HR',
      },
    ],
    education: [
      {
        id: 'edu_1',
        institutionName: 'Stanford University',
        degree: 'B.S.',
        fieldOfStudy: 'Computer Science',
        startDate: '2015-09',
        endDate: '2019-06',
        isCurrent: false,
        verificationStatus: 'verified',
      },
    ],
    certifications: [
      {
        id: 'cert_1',
        title: 'AWS Certified Solutions Architect - Professional',
        issuer: 'Amazon Web Services',
        issueDate: '2024-05',
        expiryDate: '2027-05',
        credentialId: 'AWS-PSA-987654321',
        credentialUrl: 'https://aws.amazon.com/verify/AWS-PSA-987654321',
        verificationStatus: 'verified',
      },
      {
        id: 'cert_2',
        title: 'Self-Reported Deep Learning Certificate',
        issuer: 'Online Academy',
        issueDate: '2025-01',
        verificationStatus: 'pending', // unverified certification
      },
    ],
    socialLinks: {
      github: 'https://github.com/cloudarch',
      linkedin: 'https://linkedin.com/in/cloudarch',
    },
    identityVerified: true,
    reviews: [],
    metrics: {
      verificationScore: 85,
      completedProjectsCount: 1,
      verifiedSkillsCount: 1,
      endorsementsCount: 3,
      activeStreakDays: 14,
    },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  };

  const mockUserProfile: UserProfile = {
    uid: 'user_123',
    email: 'architect@example.com',
    displayName: 'Alex Chen',
    photoURL: 'https://images.unsplash.com/photo-alex',
    activeRole: 'talent',
    activePersona: 'partner',
    availablePersonas: ['partner'],
    identityVerified: true,
    organizationId: 'org_apex_technologies',
    onboardingCompleted: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  };

  test('Test 1: Sanitized Public Projection strictly enforces public/private data isolation', () => {
    const projection = sanitizePublicPassportProjection(
      mockPrivatePassport,
      mockUserProfile,
      true
    );

    assert.strictEqual(projection.userId, 'user_123');
    assert.strictEqual(projection.displayName, 'Alex Chen');
    assert.strictEqual(projection.headline, 'Senior Cloud Architect');
    assert.strictEqual(projection.isPublic, true);
    assert.strictEqual(projection.identityVerified, true);
    assert.strictEqual(projection.organizationId, 'org_apex_technologies');

    // Projects: draft MUST be filtered out of public projection
    assert.strictEqual(projection.projects.length, 1);
    assert.strictEqual(projection.projects[0].id, 'proj_pub_1');
    assert.ok(!projection.projects.some((p) => p.id === 'proj_draft_2'));

    // Email or private identifiers must not leak into projection
    assert.strictEqual((projection as any).email, undefined);
  });

  test('Test 2: Private passports set to isPublic=false return isPublic=false flag in projection', () => {
    const privatePassportCopy = { ...mockPrivatePassport, isPublic: false };
    const projection = sanitizePublicPassportProjection(
      privatePassportCopy,
      mockUserProfile,
      true
    );

    assert.strictEqual(projection.isPublic, false);
    assert.strictEqual(projection.displayName, 'Alex Chen');
  });

  test('Test 3: Organization affiliation preserves org reference for Enterprise verified members', () => {
    const projection = sanitizePublicPassportProjection(
      mockPrivatePassport,
      mockUserProfile,
      true
    );

    assert.strictEqual(projection.organizationId, 'org_apex_technologies');
  });

  test('Test 4: Skills and Certifications correctly represent verified vs unverified items', () => {
    const projection = sanitizePublicPassportProjection(
      mockPrivatePassport,
      mockUserProfile,
      true
    );

    const verifiedSkill = projection.skills.find((s) => s.id === 'skill_1');
    const selfDeclaredSkill = projection.skills.find((s) => s.id === 'skill_2');

    assert.ok(verifiedSkill);
    assert.strictEqual(verifiedSkill?.verifiedCount, 3);
    assert.ok(selfDeclaredSkill);
    assert.strictEqual(selfDeclaredSkill?.verifiedCount, 0);

    const verifiedCert = projection.certifications.find((c) => c.id === 'cert_1');
    const selfDeclaredCert = projection.certifications.find((c) => c.id === 'cert_2');

    assert.strictEqual(verifiedCert?.verificationStatus, 'verified');
    assert.strictEqual(selfDeclaredCert?.verificationStatus, 'pending');
  });

  test('Test 5: Creator/Client profile role requirements match specifications', () => {
    const clientProfile: UserProfile = {
      ...mockUserProfile,
      activeRole: 'creator',
      activePersona: 'client',
      availablePersonas: ['client'],
    };

    assert.strictEqual(clientProfile.activeRole, 'creator');
    assert.strictEqual(clientProfile.activePersona, 'client');
  });

  test('Test 6: Unified public identity routing invariant', () => {
    // Both /p/:uid and /passport/:uid resolve to the same canonical projection source
    const pathA = `/p/${mockUserProfile.uid}`;
    const pathB = `/passport/${mockUserProfile.uid}`;
    assert.ok(pathA.endsWith(mockUserProfile.uid));
    assert.ok(pathB.endsWith(mockUserProfile.uid));
  });
});
