/**
 * GigLink Group 5 — Phase 4: Professional Identity, Verification & Organization Foundation Test Suite
 * 
 * Tests:
 * 1. Persona-Specific Projections & Lens Switching on Unified Architecture
 * 2. Strict Public Profile Projection & Data Sanitization Invariants
 * 3. Third-Party Verified vs Self-Declared Information Classification
 * 4. Absolute Separation of Profile Completeness vs Cryptographic Trust Score
 * 5. Organization Profile Service, Public Views & Admin Authorization Invariants
 * 6. Privacy & Visibility State Transitions
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  UserProfile,
  TrustPassport,
  PublicTrustPassport,
  ProjectProof,
  OrganizationProfile,
  UserPersona,
  UnifiedProfileData,
  SkillItem,
} from '../src/types';
import {
  getUnifiedProfileData,
  sanitizePublicPassportProjection,
  buildPassportUpdatePayload,
} from '../src/lib/profileService';
import {
  calculateTrustScore,
  calculateProfileCompleteness,
} from '../src/lib/trustScore';
import {
  canUserManageOrganization,
} from '../src/lib/organizationService';

describe('Group 5 Phase 4: Professional Identity, Verification & Organization Foundations', () => {

  // =========================================================================
  // 1. PERSONA-SPECIFIC UNIFIED PROJECTIONS & LENS SWITCHING
  // =========================================================================
  describe('1. Unified Profile Architecture & Persona Projections', () => {
    const baseProfile: UserProfile = {
      uid: 'user_alex_identity',
      email: 'alex@example.com',
      displayName: 'Alex Morgan',
      activePersona: 'learner',
      availablePersonas: ['learner', 'partner', 'client', 'organization_admin'],
      headline: 'Full-Stack Distributed Systems Engineer',
      bio: 'Building trust-first decentralized applications and robust web platforms.',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      location: 'San Francisco, CA',
      skills: [
        { id: 's1', name: 'TypeScript', category: 'engineering', proficiency: 'expert', verifiedCount: 3 },
        { id: 's2', name: 'React', category: 'engineering', proficiency: 'advanced', verifiedCount: 0 },
      ],
      githubUrl: 'https://github.com/alexmorgan',
      linkedinUrl: 'https://linkedin.com/in/alexmorgan',
      portfolioUrl: 'https://alexmorgan.dev',
      organizationId: 'org_apex_technologies',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
    };

    const basePassport: TrustPassport = {
      id: 'user_alex_identity',
      userId: 'user_alex_identity',
      headline: 'Full-Stack Distributed Systems Engineer',
      bio: 'Building trust-first decentralized applications and robust web platforms.',
      location: 'San Francisco, CA',
      isPublic: true,
      identityVerified: true,
      skills: [
        { id: 's1', name: 'TypeScript', category: 'engineering', proficiency: 'expert', verifiedCount: 3 },
      ],
      projects: [
        {
          id: 'proj_published_1',
          title: 'Distributed State Sync Engine',
          description: 'Production event sync engine handling millions of real-time state broadcasts.',
          role: 'Lead Architect',
          skillsUsed: ['TypeScript', 'Node.js'],
          completedAt: '2026-07-20',
          status: 'published',
          isFeatured: true,
          verificationStatus: 'verified',
          verifierUid: 'org_acme',
          verifierName: 'Acme Enterprise',
          verifiedAt: '2026-07-22T10:00:00.000Z',
        },
        {
          id: 'proj_draft_1',
          title: 'Internal Secret Prototype',
          description: 'Experimental unreleased algorithms.',
          role: 'Researcher',
          skillsUsed: ['Python'],
          completedAt: '2026-08-01',
          status: 'draft',
          isFeatured: false,
          verificationStatus: 'unverified',
        },
      ],
      experience: [
        {
          id: 'exp_1',
          roleTitle: 'Senior Staff Engineer',
          organizationName: 'Apex Technologies',
          type: 'employment',
          location: 'San Francisco, CA',
          startDate: '2023-01',
          isCurrent: true,
          description: 'Leading platform reliability and trust infrastructure.',
          verificationStatus: 'unverified',
        },
      ],
      education: [
        {
          id: 'edu_1',
          institutionName: 'Stanford University',
          degree: 'B.S. in Computer Science',
          fieldOfStudy: 'Distributed Systems',
          startDate: '2018-09',
          endDate: '2022-06',
          isCurrent: false,
          verificationStatus: 'unverified',
        },
      ],
      certifications: [
        {
          id: 'cert_1',
          title: 'Certified Cloud Security Professional',
          issuer: 'Cloud Trust Consortium',
          issueDate: '2025-03',
          credentialId: 'CTC-99281',
          verificationStatus: 'unverified',
        },
      ],
      reviews: [],
      metrics: {
        verificationScore: 82,
        completedProjectsCount: 1,
        verifiedSkillsCount: 1,
        endorsementsCount: 0,
        activeStreakDays: 12,
      },
      updatedAt: '2026-08-15T00:00:00.000Z',
    };

    it('1.1 Generates a unified profile structure preserving all persona attributes without schema divergence', () => {
      const unified = getUnifiedProfileData(baseProfile, basePassport);

      assert.strictEqual(unified.uid, 'user_alex_identity');
      assert.strictEqual(unified.displayName, 'Alex Morgan');
      assert.strictEqual(unified.headline, 'Full-Stack Distributed Systems Engineer');
      assert.strictEqual(unified.organizationId, 'org_apex_technologies');
      assert.strictEqual(unified.activePersona, 'learner');
      assert.strictEqual(unified.projects.length, 2);
      assert.strictEqual(unified.experience.length, 1);
      assert.strictEqual(unified.education.length, 1);
      assert.strictEqual(unified.certifications.length, 1);
      assert.strictEqual(unified.trustScore, 55);
      assert.strictEqual(unified.trustTier, 'Emerging');
    });

    it('1.2 Supports dynamic persona lens context without mutating the underlying identity data', () => {
      const partnerView: UnifiedProfileData = {
        ...getUnifiedProfileData(baseProfile, basePassport),
        activePersona: 'partner' as UserPersona,
      };

      const clientView: UnifiedProfileData = {
        ...getUnifiedProfileData(baseProfile, basePassport),
        activePersona: 'client' as UserPersona,
      };

      const orgAdminView: UnifiedProfileData = {
        ...getUnifiedProfileData(baseProfile, basePassport),
        activePersona: 'organization_admin' as UserPersona,
      };

      assert.strictEqual(partnerView.uid, baseProfile.uid);
      assert.strictEqual(clientView.uid, baseProfile.uid);
      assert.strictEqual(orgAdminView.uid, baseProfile.uid);

      assert.strictEqual(partnerView.activePersona, 'partner');
      assert.strictEqual(clientView.activePersona, 'client');
      assert.strictEqual(orgAdminView.activePersona, 'organization_admin');

      // Base cryptographic credentials remain identical across all lenses
      assert.strictEqual(partnerView.trustScore, 55);
      assert.strictEqual(clientView.trustScore, 55);
      assert.strictEqual(orgAdminView.trustScore, 55);
    });
  });

  // =========================================================================
  // 2. STRICT PUBLIC PROFILE PROJECTION & PRIVACY INVARIANTS
  // =========================================================================
  describe('2. Public Profile Projection & Data Isolation', () => {
    const fullPassport: TrustPassport = {
      id: 'user_privacy_test',
      userId: 'user_privacy_test',
      headline: 'Security & Cloud Systems Engineer',
      bio: 'Specializing in enterprise identity security and cloud-native backends.',
      location: 'Seattle, WA',
      locationVerificationStatus: 'self_declared',
      isPublic: true,
      identityVerified: true,
      skills: [
        { id: 's1', name: 'TypeScript', category: 'engineering', proficiency: 'expert', verifiedCount: 3 },
      ],
      projects: [
        {
          id: 'proj_published',
          title: 'Public Verified Showcase',
          description: 'A verified open-source framework for distributed trust scoring.',
          role: 'Maintainer',
          skillsUsed: ['TypeScript'],
          completedAt: '2026-07-01',
          status: 'published',
          isFeatured: true,
          verificationStatus: 'verified',
          verifierUid: 'org_acme',
          verifierName: 'Acme Labs',
          verifiedAt: '2026-07-05T00:00:00.000Z',
        },
        {
          id: 'proj_draft_private',
          title: 'Private Internal Scratchpad',
          description: 'Confidential internal tooling not yet approved for public viewing.',
          role: 'Developer',
          skillsUsed: ['Python'],
          completedAt: '2026-08-01',
          status: 'draft',
          isFeatured: false,
          verificationStatus: 'unverified',
        },
      ],
      experience: [
        {
          id: 'exp_1',
          roleTitle: 'Lead Architect',
          organizationName: 'Acme Global',
          type: 'employment',
          startDate: '2022-01',
          isCurrent: true,
          description: 'Cloud systems',
          verificationStatus: 'unverified',
        },
      ],
      education: [
        {
          id: 'edu_1',
          institutionName: 'MIT',
          degree: 'Master of Engineering',
          fieldOfStudy: 'Computer Science',
          startDate: '2020-09',
          endDate: '2022-05',
          isCurrent: false,
          verificationStatus: 'unverified',
        },
      ],
      certifications: [
        {
          id: 'cert_1',
          title: 'Certified Zero-Trust Architect',
          issuer: 'Security Standards Board',
          issueDate: '2024-01',
          verificationStatus: 'unverified',
        },
      ],
      reviews: [],
      metrics: {
        verificationScore: 78,
        completedProjectsCount: 1,
        verifiedSkillsCount: 1,
        endorsementsCount: 0,
        activeStreakDays: 5,
      },
      updatedAt: '2026-08-10T00:00:00.000Z',
    };

    const userProfile: UserProfile = {
      uid: 'user_privacy_test',
      email: 'test@example.com',
      displayName: 'Jane Doe',
      activePersona: 'partner',
      availablePersonas: ['partner'],
      headline: 'Security & Cloud Systems Engineer',
      bio: 'Specializing in enterprise identity security and cloud-native backends.',
      location: 'Seattle, WA',
      skills: [
        { id: 's1', name: 'TypeScript', category: 'engineering', proficiency: 'expert', verifiedCount: 3 },
        { id: 's2', name: 'Go', category: 'engineering', proficiency: 'intermediate', verifiedCount: 0 },
      ],
      organizationId: 'org_acme_global',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    };

    it('2.1 Strips private drafts from public projection, retaining only published deliverables', () => {
      const projection = sanitizePublicPassportProjection(fullPassport, userProfile, true);

      assert.strictEqual(projection.userId, 'user_privacy_test');
      assert.strictEqual(projection.displayName, 'Jane Doe');
      assert.strictEqual(projection.projects.length, 1);
      assert.strictEqual(projection.projects[0].id, 'proj_published');
      assert.strictEqual(projection.projects[0].status, 'published');

      // Confirm private draft is completely excluded
      const draftExists = projection.projects.some((p) => p.id === 'proj_draft_private');
      assert.strictEqual(draftExists, false);
    });

    it('2.2 Projects public organization link and verified metadata', () => {
      const projection = sanitizePublicPassportProjection(fullPassport, userProfile, true);

      assert.strictEqual(projection.organizationId, 'org_acme_global');
      assert.strictEqual(projection.identityVerified, true);
      assert.strictEqual(projection.trustScore, 65);
      assert.strictEqual(projection.trustTier, 'Emerging');
    });

    it('2.3 When isPublic is false, projection isPublic flag is false', () => {
      const privatePassport: TrustPassport = {
        ...fullPassport,
        isPublic: false,
      };

      const projection = sanitizePublicPassportProjection(privatePassport, userProfile, true);
      assert.strictEqual(projection.isPublic, false);
    });
  });

  // =========================================================================
  // 3. THIRD-PARTY VERIFIED VS SELF-DECLARED CLASSIFICATION
  // =========================================================================
  describe('3. Verified vs Self-Declared Information Classification', () => {
    it('3.1 Distinguishes verified skills from self-declared skills', () => {
      const skills: SkillItem[] = [
        { id: 's1', name: 'TypeScript', category: 'engineering', proficiency: 'expert', verifiedCount: 2 },
        { id: 's2', name: 'GraphQL', category: 'engineering', proficiency: 'intermediate', verifiedCount: 0 },
      ];

      const verifiedSkills = skills.filter((s) => s.verifiedCount > 0);
      const selfDeclaredSkills = skills.filter((s) => s.verifiedCount === 0);

      assert.strictEqual(verifiedSkills.length, 1);
      assert.strictEqual(verifiedSkills[0].name, 'TypeScript');
      assert.strictEqual(verifiedSkills[0].verifiedCount, 2);

      assert.strictEqual(selfDeclaredSkills.length, 1);
      assert.strictEqual(selfDeclaredSkills[0].name, 'GraphQL');
      assert.strictEqual(selfDeclaredSkills[0].verifiedCount, 0);
    });

    it('3.2 Distinguishes verified projects with verifier attribution from unverified projects', () => {
      const projects: ProjectProof[] = [
        {
          id: 'p1',
          title: 'Verified Enterprise Audit Tool',
          description: 'Auditing platform verified by partner.',
          role: 'Architect',
          skillsUsed: ['TypeScript'],
          completedAt: '2026-06-01',
          status: 'published',
          verificationStatus: 'verified',
          verifierUid: 'org_audit_firm',
          verifierName: 'Certified Audit Group',
          verifiedAt: '2026-06-05T00:00:00.000Z',
        },
        {
          id: 'p2',
          title: 'Personal Sandbox Exploration',
          description: 'Self-guided experiment.',
          role: 'Learner',
          skillsUsed: ['Rust'],
          completedAt: '2026-07-01',
          status: 'published',
          verificationStatus: 'unverified',
        },
      ];

      const verifiedProjects = projects.filter((p) => p.verificationStatus === 'verified');
      const unverifiedProjects = projects.filter((p) => p.verificationStatus !== 'verified');

      assert.strictEqual(verifiedProjects.length, 1);
      assert.strictEqual(verifiedProjects[0].verifierName, 'Certified Audit Group');

      assert.strictEqual(unverifiedProjects.length, 1);
      assert.strictEqual(unverifiedProjects[0].verificationStatus, 'unverified');
      assert.strictEqual(unverifiedProjects[0].verifierName, undefined);
    });
  });

  // =========================================================================
  // 4. ABSOLUTE SEPARATION OF PROFILE COMPLETENESS VS TRUST SCORE
  // =========================================================================
  describe('4. Separation of Profile Completeness vs Trust Score', () => {
    it('4.1 Completing self-declared profile fields increases Profile Completeness but NEVER Trust Score', () => {
      // Scenario A: Unverified member with minimal profile
      const minimalPassport: TrustPassport = {
        id: 'user_test_separation',
        userId: 'user_test_separation',
        headline: '',
        bio: '',
        isPublic: false,
        identityVerified: false,
        skills: [],
        projects: [],
        experience: [],
        education: [],
        certifications: [],
        reviews: [],
        metrics: {
          verificationScore: 0,
          completedProjectsCount: 0,
          verifiedSkillsCount: 0,
          endorsementsCount: 0,
          activeStreakDays: 0,
        },
        updatedAt: '2026-08-01T00:00:00.000Z',
      };

      const minimalProfile: UserProfile = {
        uid: 'user_test_separation',
        email: 'test@example.com',
        displayName: 'John User',
        activePersona: 'learner',
        availablePersonas: ['learner'],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      };

      const initialCompleteness = calculateProfileCompleteness(minimalProfile, minimalPassport);
      const initialScore = calculateTrustScore(minimalPassport, minimalProfile, false);

      // Scenario B: Member fills out extensive self-declared fields (bio, headline, location, unverified skills, unverified projects)
      const filledProfile: UserProfile = {
        ...minimalProfile,
        headline: 'Aspiring Full Stack Engineer',
        bio: 'Passionate software developer interested in web development and cloud systems.',
        location: 'Austin, TX',
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        skills: [
          { id: 's1', name: 'HTML/CSS', category: 'design', proficiency: 'advanced', verifiedCount: 0 },
          { id: 's2', name: 'JavaScript', category: 'engineering', proficiency: 'intermediate', verifiedCount: 0 },
        ],
        githubUrl: 'https://github.com/johnuser',
        linkedinUrl: 'https://linkedin.com/in/johnuser',
      };

      const filledPassport: TrustPassport = {
        ...minimalPassport,
        headline: 'Aspiring Full Stack Engineer',
        bio: 'Passionate software developer interested in web development and cloud systems.',
        location: 'Austin, TX',
        projects: [
          {
            id: 'p_unverified_1',
            title: 'My Custom Portfolio Website',
            description: 'Built with React and Tailwind CSS.',
            role: 'Developer',
            skillsUsed: ['JavaScript', 'HTML/CSS'],
            completedAt: '2026-08-02',
            status: 'published',
            verificationStatus: 'unverified',
          },
        ],
        experience: [
          {
            id: 'exp_1',
            roleTitle: 'Freelance Web Developer',
            organizationName: 'Self-Employed',
            type: 'freelance',
            startDate: '2025-01',
            isCurrent: true,
            description: 'Web dev',
            verificationStatus: 'unverified',
          },
        ],
        education: [
          {
            id: 'edu_1',
            institutionName: 'University of Texas',
            degree: 'B.A. in English',
            fieldOfStudy: 'English',
            startDate: '2020-09',
            endDate: '2024-05',
            isCurrent: false,
            verificationStatus: 'unverified',
          },
        ],
      };

      const filledCompleteness = calculateProfileCompleteness(filledProfile, filledPassport);
      const filledScore = calculateTrustScore(filledPassport, filledProfile, false);

      // Invariant: Profile completeness rises significantly due to self-declared data
      assert.ok(filledCompleteness > initialCompleteness, 'Profile completeness must increase when self-declared info is provided');
      assert.ok(filledCompleteness >= 70, 'Comprehensive self-declared profile should achieve substantial completeness');

      // Invariant: Trust Score remains exactly 0 because no verified credentials, verifiers, or identity proofs exist
      assert.strictEqual(initialScore.totalScore, 0, 'Initial unverified trust score must be 0');
      assert.strictEqual(filledScore.totalScore, 0, 'Trust score must NOT increase simply by filling out self-declared profile fields');
      assert.strictEqual(filledScore.tier, 'Unverified', 'Trust tier must remain Unverified');
    });

    it('4.2 Trust Score only increases when authoritative third-party proofs are attached', () => {
      const verifiedPassport: TrustPassport = {
        id: 'user_test_verified',
        userId: 'user_test_verified',
        headline: 'Verified Engineer',
        bio: 'Senior engineer',
        isPublic: true,
        identityVerified: true, // +40 points
        skills: [
          { id: 's1', name: 'TypeScript', category: 'engineering', proficiency: 'expert', verifiedCount: 1 },
        ],
        projects: [
          {
            id: 'p_verified_1',
            title: 'Verified Enterprise Gateway',
            description: 'Delivered client solution with cryptographic signature.',
            role: 'Lead Architect',
            skillsUsed: ['TypeScript'],
            completedAt: '2026-08-01',
            status: 'published',
            verificationStatus: 'verified',
            verifierUid: 'org_enterprise',
            verifierName: 'Enterprise Solutions Corp',
            verifiedAt: '2026-08-02T00:00:00.000Z',
          },
        ],
        experience: [],
        education: [],
        certifications: [],
        reviews: [],
        metrics: {
          verificationScore: 60,
          completedProjectsCount: 1,
          verifiedSkillsCount: 1,
          endorsementsCount: 0,
          activeStreakDays: 1,
        },
        updatedAt: '2026-08-01T00:00:00.000Z',
      };

      const verifiedScore = calculateTrustScore(verifiedPassport, null, true);
      assert.ok(verifiedScore.totalScore > 0, 'Verified proofs must award trust score points');
      assert.ok(verifiedScore.tier !== 'Unverified', 'Tier must elevate above Unverified');
    });
  });

  // =========================================================================
  // 5. ORGANIZATION PROFILE SERVICE & ADMIN AUTHORIZATION
  // =========================================================================
  describe('5. Organization Profile Foundations & Admin Authorization', () => {
    const orgData: OrganizationProfile = {
      id: 'org_nexus_innovations',
      name: 'Nexus Innovations Inc.',
      type: 'company',
      description: 'Enterprise technology organization offering apprenticeship and client projects.',
      website: 'https://nexusinnovations.example.com',
      logoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623',
      verifiedStatus: true,
      adminUserIds: ['user_founder_1', 'user_lead_admin_2'],
      memberUserIds: ['user_founder_1', 'user_lead_admin_2', 'user_staff_member_3'],
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    it('5.1 Allows organization owner and explicit admins to manage the organization profile', () => {
      const isOwnerAuthorized = canUserManageOrganization(orgData, 'user_founder_1');
      const isAdminAuthorized = canUserManageOrganization(orgData, 'user_lead_admin_2');

      assert.strictEqual(isOwnerAuthorized, true, 'Organization owner must have management authorization');
      assert.strictEqual(isAdminAuthorized, true, 'Designated organization admin must have management authorization');
    });

    it('5.2 Denies standard organization members and external users from managing organization settings', () => {
      const isStaffAuthorized = canUserManageOrganization(orgData, 'user_staff_member_3');
      const isExternalAuthorized = canUserManageOrganization(orgData, 'user_unrelated_outsider');
      const isNullAuthorized = canUserManageOrganization(orgData, null);

      assert.strictEqual(isStaffAuthorized, false, 'Standard member must NOT have admin management authorization');
      assert.strictEqual(isExternalAuthorized, false, 'External user must NOT have admin management authorization');
      assert.strictEqual(isNullAuthorized, false, 'Unauthenticated user must NOT have admin management authorization');
    });
  });

  // =========================================================================
  // 6. BUILD PASSPORT UPDATE PAYLOAD IMMUTABILITY & PROTECTION
  // =========================================================================
  describe('6. Trust Field Protection & Update Payload Security', () => {
    it('6.1 Preserves trustScore, trustTier, verificationsCount, and verificationStatus from user tampering in update payloads', () => {
      const existingPassport: TrustPassport = {
        id: 'user_secure_update',
        userId: 'user_secure_update',
        headline: 'Original Title',
        bio: 'Original bio',
        isPublic: true,
        identityVerified: true,
        skills: [],
        projects: [
          {
            id: 'p_original',
            title: 'Production System',
            description: 'Verified deliverable.',
            role: 'Lead',
            skillsUsed: ['TypeScript'],
            completedAt: '2026-07-01',
            status: 'published',
            verificationStatus: 'verified',
            verifierUid: 'org_acme',
            verifierName: 'Acme Systems',
            verifiedAt: '2026-07-02T00:00:00.000Z',
          },
        ],
        experience: [],
        education: [],
        certifications: [],
        reviews: [],
        metrics: {
          verificationScore: 88,
          completedProjectsCount: 1,
          verifiedSkillsCount: 0,
          endorsementsCount: 0,
          activeStreakDays: 1,
        },
        updatedAt: '2026-08-01T00:00:00.000Z',
      };

      const userModifications: any = {
        isPublic: false,
        projects: [
          {
            id: 'p_original',
            title: 'Production System Updated Title',
            description: 'Updated description.',
            role: 'Principal Engineer',
            skillsUsed: ['TypeScript', 'Cloud Architecture'],
            completedAt: '2026-07-01',
            status: 'published',
            // Attempt to forge verification status
            verificationStatus: 'unverified',
          },
        ],
        // Attempt to forge trust score
        trustScore: 100,
        trustTier: 'Elite',
      };

      const payload = buildPassportUpdatePayload(existingPassport, userModifications);

      // Invariant: User can update public visibility and project metadata
      assert.strictEqual(payload.isPublic, false);
      assert.strictEqual(payload.projects?.[0].title, 'Production System Updated Title');
      assert.strictEqual(payload.projects?.[0].role, 'Principal Engineer');

      // Invariant: Preserves verified project attestation
      assert.strictEqual(payload.projects?.[0].verificationStatus, 'verified');
      assert.strictEqual(payload.projects?.[0].verifierName, 'Acme Systems');

      // Invariant: trustScore and trustTier are completely stripped/omitted from user update payload
      assert.strictEqual((payload as any).trustScore, undefined, 'User payload must not contain trustScore');
      assert.strictEqual((payload as any).trustTier, undefined, 'User payload must not contain trustTier');
    });
  });
});
