/**
 * GigLink Group 5 — Phase 1: Profile Foundation & Data Normalization Test Suite
 * 
 * Tests:
 * 1. Type contract compatibility & field mapping
 * 2. Dual-read resolution with legacy /users/{uid} fallback (Phase A)
 * 3. Unified writes targeting /trustPassports/{uid} (Phase B)
 * 4. Sanitized public projection generation for /publicTrustPassports/{uid} (Phase C)
 * 5. Deterministic Trust Score & Profile Completeness calculation with dual-read support
 * 6. Strict Privacy & Security Invariants (no private ID / reviewer notes leakage)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  UserProfile,
  TrustPassport,
  PublicTrustPassport,
  SkillItem,
  ProjectProof,
  ExperienceItem,
  EducationItem,
  CertificationItem,
  SocialLinks,
} from '../src/types';
import {
  getUnifiedProfileData,
  sanitizePublicPassportProjection,
  buildPassportUpdatePayload,
  normalizeSkills,
  normalizeSocialLinks,
  removeUndefinedFields,
} from '../src/lib/profileService';
import {
  calculateTrustScore,
  calculateProfileCompleteness,
} from '../src/lib/trustScore';

describe('Group 5 Phase 1: Profile Foundation & Data Normalization', () => {

  // =========================================================================
  // 1. DUAL-READ RESOLUTION TESTS (PHASE A)
  // =========================================================================
  describe('1. Dual-Read Resolution (getUnifiedProfileData)', () => {

    it('1.1 Brand-new onboarded user reads authoritative data from TrustPassport', () => {
      const profile: UserProfile = {
        uid: 'usr_new_101',
        email: 'alex@example.com',
        displayName: 'Alex Rivers',
        activePersona: 'learner',
        availablePersonas: ['learner', 'partner', 'client', 'organization_admin'],
        onboardingCompleted: true,
        createdAt: '2026-08-17T00:00:00.000Z',
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const passport: TrustPassport = {
        id: 'usr_new_101',
        userId: 'usr_new_101',
        headline: 'Frontend Engineer & UI Architect',
        bio: 'Building verified scalable web applications with React and TypeScript.',
        location: 'San Francisco, CA, USA',
        structuredLocation: {
          country: 'United States',
          state: 'California',
          city: 'San Francisco',
          formattedAddress: 'San Francisco, CA, USA',
        },
        locationVerificationStatus: 'self_declared',
        identityVerified: false,
        isPublic: true,
        skills: [
          {
            id: 'sk_1',
            name: 'React',
            category: 'Engineering',
            proficiency: 'expert',
            verifiedCount: 1,
          },
        ],
        projects: [
          {
            id: 'proj_1',
            title: 'GigLink Applet',
            description: 'Full stack decentralized gig ecosystem.',
            role: 'Lead Architect',
            skillsUsed: ['React', 'TypeScript'],
            completedAt: '2026-08-17',
            verificationStatus: 'verified',
          },
        ],
        education: [
          {
            id: 'edu_1',
            institutionName: 'Stanford University',
            degree: 'BS',
            fieldOfStudy: 'Computer Science',
            startDate: '2020-09-01',
            endDate: '2024-06-15',
            isCurrent: false,
            verificationStatus: 'unverified',
          },
        ],
        experience: [
          {
            id: 'exp_1',
            organizationName: 'Acme Labs',
            roleTitle: 'Software Engineering Intern',
            type: 'internship',
            startDate: '2023-06-01',
            endDate: '2023-09-01',
            isCurrent: false,
            description: 'Engineered frontend modules.',
            verificationStatus: 'verified',
          },
        ],
        certifications: [
          {
            id: 'cert_1',
            title: 'AWS Certified Cloud Practitioner',
            issuer: 'Amazon Web Services',
            issueDate: '2024-01-10',
            verificationStatus: 'verified',
          },
        ],
        socialLinks: {
          github: 'https://github.com/alexrivers',
          linkedin: 'https://linkedin.com/in/alexrivers',
          portfolio: 'https://alexrivers.dev',
        },
        reviews: [],
        metrics: {
          verificationScore: 20,
          completedProjectsCount: 1,
          verifiedSkillsCount: 1,
          endorsementsCount: 0,
          activeStreakDays: 5,
        },
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const unified = getUnifiedProfileData(profile, passport, true);

      assert.strictEqual(unified.uid, 'usr_new_101');
      assert.strictEqual(unified.displayName, 'Alex Rivers');
      assert.strictEqual(unified.email, 'alex@example.com');
      assert.strictEqual(unified.headline, 'Frontend Engineer & UI Architect');
      assert.strictEqual(unified.bio, 'Building verified scalable web applications with React and TypeScript.');
      assert.strictEqual(unified.location, 'San Francisco, CA, USA');
      assert.strictEqual(unified.skills.length, 1);
      assert.strictEqual(unified.skills[0].name, 'React');
      assert.strictEqual(unified.projects.length, 1);
      assert.strictEqual(unified.education.length, 1);
      assert.strictEqual(unified.experience.length, 1);
      assert.strictEqual(unified.certifications.length, 1);
      assert.strictEqual(unified.socialLinks.github, 'https://github.com/alexrivers');
      assert.strictEqual(unified.isPublic, true);
    });

    it('1.2 Existing user with professional data ONLY in /users/{uid} resolves correctly via fallback', () => {
      const legacyProfile: UserProfile = {
        uid: 'usr_legacy_202',
        email: 'legacy@example.com',
        displayName: 'Morgan Chen',
        activePersona: 'partner',
        availablePersonas: ['learner', 'partner'],
        onboardingCompleted: true,
        headline: 'Senior Cloud Consultant',
        bio: 'Over 8 years building distributed systems and microservices architectures.',
        location: 'Austin, TX, USA',
        skills: ['TypeScript', 'Kubernetes', 'Go'],
        portfolioUrl: 'https://morganchen.io',
        githubUrl: 'https://github.com/morganchen',
        linkedinUrl: 'https://linkedin.com/in/morganchen',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      // Passport is empty/sparse for this legacy user
      const sparsePassport: TrustPassport = {
        id: 'usr_legacy_202',
        userId: 'usr_legacy_202',
        headline: '',
        bio: '',
        identityVerified: false,
        skills: [],
        projects: [],
        education: [],
        reviews: [],
        metrics: {
          verificationScore: 0,
          completedProjectsCount: 0,
          verifiedSkillsCount: 0,
          endorsementsCount: 0,
          activeStreakDays: 1,
        },
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const unified = getUnifiedProfileData(legacyProfile, sparsePassport, true);

      // Fallback assertions
      assert.strictEqual(unified.uid, 'usr_legacy_202');
      assert.strictEqual(unified.displayName, 'Morgan Chen');
      assert.strictEqual(unified.headline, 'Senior Cloud Consultant');
      assert.strictEqual(unified.bio, 'Over 8 years building distributed systems and microservices architectures.');
      assert.strictEqual(unified.location, 'Austin, TX, USA');
      assert.strictEqual(unified.skills.length, 3);
      assert.strictEqual(unified.skills[0].name, 'TypeScript');
      assert.strictEqual(unified.socialLinks.portfolio, 'https://morganchen.io');
      assert.strictEqual(unified.socialLinks.github, 'https://github.com/morganchen');
      assert.strictEqual(unified.socialLinks.linkedin, 'https://linkedin.com/in/morganchen');
    });

    it('1.3 Conflict resolution: /trustPassports/{uid} takes precedence over legacy /users/{uid}', () => {
      const profile: UserProfile = {
        uid: 'usr_conflict_303',
        email: 'conflict@example.com',
        displayName: 'Jordan Taylor',
        activePersona: 'client',
        availablePersonas: ['learner', 'client'],
        headline: 'Old Legacy Headline',
        bio: 'Old legacy bio from 2 years ago.',
        location: 'Old City, Old State',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const passport: TrustPassport = {
        id: 'usr_conflict_303',
        userId: 'usr_conflict_303',
        headline: 'Authoritative Modern Headline',
        bio: 'Authoritative fresh bio updated in Trust Passport.',
        location: 'New City, New State',
        identityVerified: true,
        skills: [
          {
            id: 'sk_new',
            name: 'React',
            category: 'Engineering',
            proficiency: 'advanced',
            verifiedCount: 2,
          },
        ],
        projects: [],
        education: [],
        reviews: [],
        metrics: {
          verificationScore: 40,
          completedProjectsCount: 0,
          verifiedSkillsCount: 1,
          endorsementsCount: 0,
          activeStreakDays: 3,
        },
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const unified = getUnifiedProfileData(profile, passport, true);

      assert.strictEqual(unified.headline, 'Authoritative Modern Headline');
      assert.strictEqual(unified.bio, 'Authoritative fresh bio updated in Trust Passport.');
      assert.strictEqual(unified.location, 'New City, New State');
      assert.strictEqual(unified.skills.length, 1);
      assert.strictEqual(unified.skills[0].name, 'React');
      assert.strictEqual(unified.identityVerified, true);
    });

    it('1.4 Missing and sparse fields return safe defaults without runtime exceptions', () => {
      const unified = getUnifiedProfileData(null, null, false);

      assert.strictEqual(unified.uid, '');
      assert.strictEqual(unified.displayName, 'GigLink Member');
      assert.strictEqual(unified.headline, 'Professional on GigLink');
      assert.strictEqual(unified.bio, '');
      assert.strictEqual(unified.location, '');
      assert.deepStrictEqual(unified.skills, []);
      assert.deepStrictEqual(unified.projects, []);
      assert.deepStrictEqual(unified.experience, []);
      assert.deepStrictEqual(unified.education, []);
      assert.deepStrictEqual(unified.certifications, []);
      assert.strictEqual(unified.isPublic, false);
      assert.strictEqual(unified.identityVerified, false);
    });
  });

  // =========================================================================
  // 2. UNIFIED WRITE PAYLOAD BUILDER TESTS (PHASE B)
  // =========================================================================
  describe('2. Unified Write Payload Builder (buildPassportUpdatePayload)', () => {

    it('2.1 Correctly formats partial updates targeting /trustPassports/{uid}', () => {
      const currentPassport: TrustPassport = {
        id: 'usr_write_404',
        userId: 'usr_write_404',
        headline: 'Old Title',
        bio: 'Old Bio',
        identityVerified: true,
        skills: [],
        projects: [],
        education: [],
        reviews: [],
        metrics: {
          verificationScore: 40,
          completedProjectsCount: 0,
          verifiedSkillsCount: 0,
          endorsementsCount: 0,
          activeStreakDays: 1,
        },
        updatedAt: '2026-08-01T00:00:00.000Z',
      };

      const payload = buildPassportUpdatePayload(currentPassport, {
        headline: '  Staff Security Engineer  ',
        bio: '  Specializing in threat modeling and zero-trust identity.  ',
        socialLinks: {
          github: 'https://github.com/sec-pro',
          portfolio: 'https://sec-pro.dev',
        },
      });

      assert.strictEqual(payload.headline, 'Staff Security Engineer');
      assert.strictEqual(payload.bio, 'Specializing in threat modeling and zero-trust identity.');
      assert.strictEqual(payload.portfolioUrl, 'https://sec-pro.dev');
      assert.strictEqual(payload.socialLinks?.github, 'https://github.com/sec-pro');
      assert.ok(payload.updatedAt);
      // Ensure identityVerified cannot be altered via regular update payload
      assert.strictEqual((payload as any).identityVerified, undefined);
    });

    it('2.2 Synchronizes field aliases (experience <-> workHistory, certifications <-> certificates)', () => {
      const newExp: ExperienceItem[] = [
        {
          id: 'exp_10',
          organizationName: 'Google',
          roleTitle: 'Software Engineer',
          type: 'employment',
          startDate: '2024-01-01',
          isCurrent: true,
          description: 'Working on developer tooling.',
          verificationStatus: 'verified',
        },
      ];

      const newCerts: CertificationItem[] = [
        {
          id: 'cert_10',
          title: 'CKA: Certified Kubernetes Administrator',
          issuer: 'CNCF',
          issueDate: '2025-05-01',
          verificationStatus: 'verified',
        },
      ];

      const payload = buildPassportUpdatePayload(null, {
        experience: newExp,
        certifications: newCerts,
      });

      assert.deepStrictEqual(payload.experience, newExp);
      assert.deepStrictEqual(payload.workHistory, newExp);
      assert.deepStrictEqual(payload.certifications, newCerts);
      assert.deepStrictEqual(payload.certificates, newCerts);
    });
  });

  // =========================================================================
  // 3. SANITIZED PUBLIC PROJECTION TESTS (PHASE C)
  // =========================================================================
  describe('3. Public Projection Sanitization (sanitizePublicPassportProjection)', () => {

    it('3.1 Generates a fully populated and sanitized PublicTrustPassport', () => {
      const profile: UserProfile = {
        uid: 'usr_pub_505',
        email: 'private_contact@secret.com',
        displayName: 'Taylor Swiftness',
        activePersona: 'learner',
        availablePersonas: ['learner'],
        createdAt: '2026-08-17T00:00:00.000Z',
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const passport: TrustPassport = {
        id: 'usr_pub_505',
        userId: 'usr_pub_505',
        headline: 'Distributed Systems Specialist',
        bio: '10 years designing high-throughput data processing pipelines.',
        location: 'Seattle, WA, USA',
        structuredLocation: {
          country: 'United States',
          state: 'Washington',
          city: 'Seattle',
          formattedAddress: 'Seattle, WA, USA',
        },
        locationVerificationStatus: 'self_declared',
        identityVerified: true,
        isPublic: true,
        skills: [
          {
            id: 'sk_dist',
            name: 'Distributed Systems',
            category: 'Engineering',
            proficiency: 'expert',
            verifiedCount: 3,
          },
        ],
        projects: [
          {
            id: 'proj_pipeline',
            title: 'Real-time Event Ingestion Stream',
            description: 'Processes 1M events/sec with sub-second latency.',
            role: 'Principal Architect',
            skillsUsed: ['Go', 'Kafka'],
            completedAt: '2026-06-01',
            verificationStatus: 'verified',
          },
        ],
        education: [],
        experience: [],
        certifications: [],
        reviews: [
          {
            id: 'rev_1',
            reviewerId: 'client_bob',
            reviewerName: 'Bob Vance',
            reviewerRole: 'client',
            rating: 5,
            feedback: 'Exceptional architectural delivery.',
            projectTitle: 'Real-time Event Ingestion Stream',
            createdAt: '2026-07-01T00:00:00.000Z',
          },
        ],
        metrics: {
          verificationScore: 40,
          completedProjectsCount: 1,
          verifiedSkillsCount: 1,
          endorsementsCount: 1,
          activeStreakDays: 14,
        },
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const publicDoc = sanitizePublicPassportProjection(passport, profile, true);

      assert.strictEqual(publicDoc.userId, 'usr_pub_505');
      assert.strictEqual(publicDoc.displayName, 'Taylor Swiftness');
      assert.strictEqual(publicDoc.headline, 'Distributed Systems Specialist');
      assert.strictEqual(publicDoc.location, 'Seattle, WA, USA');
      assert.strictEqual(publicDoc.identityVerified, true);
      assert.strictEqual(publicDoc.projects.length, 1);
      assert.strictEqual(publicDoc.skills.length, 1);
      assert.strictEqual(publicDoc.reviews.length, 1);
      // Trust Score calculation: Identity (40) + Project (10) + Skill (5) + Hygiene (10) = 65
      assert.strictEqual(publicDoc.trustScore, 65);
      assert.strictEqual(publicDoc.trustTier, 'Emerging');

      // STRICT PRIVACY INVARIANTS
      assert.strictEqual((publicDoc as any).email, undefined, 'Public passport must NEVER include email');
      assert.strictEqual((publicDoc as any).documentNumberMasked, undefined, 'Public passport must NEVER include document numbers');
      assert.strictEqual((publicDoc as any).evidenceNotes, undefined, 'Public passport must NEVER include evidence notes');
    });

    it('3.2 Sanitized Public Projection contains 0 undefined fields (Firestore setDoc compatibility)', () => {
      // User with no photoURL, no structuredLocation, no portfolioUrl
      const minimalProfile: UserProfile = {
        uid: 'usr_no_photo',
        email: 'user@example.com',
        displayName: 'No Photo User',
        activePersona: 'learner',
        availablePersonas: ['learner'],
        createdAt: '2026-08-17T00:00:00.000Z',
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const minimalPassport: TrustPassport = {
        id: 'usr_no_photo',
        userId: 'usr_no_photo',
        headline: 'Minimal Profile',
        bio: 'Just getting started.',
        identityVerified: false,
        skills: [],
        projects: [],
        education: [],
        reviews: [],
        metrics: {
          verificationScore: 0,
          completedProjectsCount: 0,
          verifiedSkillsCount: 0,
          endorsementsCount: 0,
          activeStreakDays: 1,
        },
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const doc = sanitizePublicPassportProjection(minimalPassport, minimalProfile, false);

      // Verify no top-level key has an undefined value
      for (const [k, v] of Object.entries(doc)) {
        assert.notStrictEqual(v, undefined, `Key "${k}" must not be undefined in public projection`);
      }
      assert.strictEqual('photoURL' in doc, false, 'photoURL should be omitted when undefined');
    });
  });

  // =========================================================================
  // 4. PROFILE COMPLETENESS & TRUST SCORE RESOLUTION TESTS
  // =========================================================================
  describe('4. Profile Completeness & Trust Score Engine', () => {

    it('4.1 Completeness reaches 100% when all 4 core dimensions are filled via dual-read', () => {
      const profile: Partial<UserProfile> = {
        displayName: 'Jordan Lee',
      };
      const passport: Partial<TrustPassport> = {
        headline: 'Senior Fullstack Software Engineer',
        bio: 'Specialized in building high performance cloud native web services and UI.',
        structuredLocation: {
          country: 'United States',
          state: 'New York',
          formattedAddress: 'New York, NY, USA',
        },
        skills: [
          {
            id: 'sk_1',
            name: 'TypeScript',
            category: 'Engineering',
            proficiency: 'expert',
            verifiedCount: 0,
          },
        ],
      };

      const completeness = calculateProfileCompleteness(profile, passport);
      assert.strictEqual(completeness, 100);
    });

    it('4.2 Trust score strictly counts earned verifications and excludes unverified claims', () => {
      const profile: Partial<UserProfile> = {
        displayName: 'Unverified Candidate',
      };
      const passport: Partial<TrustPassport> = {
        headline: 'Self Proclaimed Expert',
        bio: 'I have many unverified skills and self reported projects listed here.',
        identityVerified: false, // NOT verified
        projects: [
          {
            id: 'p1',
            title: 'Unverified Project',
            description: 'No proof provided',
            role: 'Author',
            skillsUsed: [],
            completedAt: '2026-01-01',
            verificationStatus: 'unverified', // unverified -> 0 pts
          },
        ],
        skills: [
          {
            id: 's1',
            name: 'React',
            category: 'Engineering',
            proficiency: 'beginner',
            verifiedCount: 0, // unverified -> 0 pts
          },
        ],
      };

      const score = calculateTrustScore(passport, profile, false);

      assert.strictEqual(score.identityPoints, 0);
      assert.strictEqual(score.proofOfWorkPoints, 0);
      assert.strictEqual(score.skillsPoints, 0);
      assert.strictEqual(score.profileHygienePoints, 0);
      assert.strictEqual(score.totalScore, 0);
      assert.strictEqual(score.tier, 'Unverified');
    });

    it('4.3 Verified identity (+40), verified projects (+30), and verified skills (+20) achieve Elite tier', () => {
      const profile: Partial<UserProfile> = {
        displayName: 'Elite Engineer',
      };
      const passport: Partial<TrustPassport> = {
        headline: 'Principal Software Architect',
        bio: '15 years of industry experience across distributed infrastructure.',
        location: 'San Francisco, CA',
        identityVerified: true, // 40 pts
        projects: [
          { id: '1', title: 'P1', description: 'Desc', role: 'Dev', skillsUsed: [], completedAt: '2026', verificationStatus: 'verified' },
          { id: '2', title: 'P2', description: 'Desc', role: 'Dev', skillsUsed: [], completedAt: '2026', verificationStatus: 'verified' },
          { id: '3', title: 'P3', description: 'Desc', role: 'Dev', skillsUsed: [], completedAt: '2026', verificationStatus: 'verified' },
        ], // 3 * 10 = 30 pts
        skills: [
          { id: '1', name: 'Go', category: 'Eng', proficiency: 'expert', verifiedCount: 2 },
          { id: '2', name: 'Rust', category: 'Eng', proficiency: 'expert', verifiedCount: 1 },
          { id: '3', name: 'Kubernetes', category: 'Eng', proficiency: 'expert', verifiedCount: 3 },
          { id: '4', name: 'GCP', category: 'Eng', proficiency: 'expert', verifiedCount: 1 },
        ], // 4 * 5 = 20 pts
      };

      const score = calculateTrustScore(passport, profile, true); // +10 hygiene (100% complete + email verified)

      assert.strictEqual(score.identityPoints, 40);
      assert.strictEqual(score.proofOfWorkPoints, 30);
      assert.strictEqual(score.skillsPoints, 20);
      assert.strictEqual(score.profileHygienePoints, 10);
      assert.strictEqual(score.totalScore, 100);
      assert.strictEqual(score.tier, 'Elite');
    });
  });

  // =========================================================================
  // 5. HELPER NORMALIZATION UTILITY TESTS
  // =========================================================================
  describe('5. Normalization Helpers', () => {

    it('5.1 normalizeSkills transforms legacy string arrays to canonical SkillItem format', () => {
      const raw = ['React', 'TypeScript', 'Custom Unknown Skill'];
      const normalized = normalizeSkills(raw);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0].name, 'React');
      assert.strictEqual(normalized[0].category, 'Frontend Development');
      assert.strictEqual(normalized[1].name, 'TypeScript');
      assert.strictEqual(normalized[2].name, 'Custom Unknown Skill');
      assert.strictEqual(normalized[2].category, 'General');
      assert.strictEqual(normalized[2].verifiedCount, 0);
    });

    it('5.2 normalizeSocialLinks maps both structured and legacy profile fields cleanly', () => {
      const links = normalizeSocialLinks(
        { github: 'https://github.com/new' },
        { linkedinUrl: 'https://linkedin.com/legacy', portfolioUrl: 'https://portfolio.legacy' }
      );

      assert.strictEqual(links.github, 'https://github.com/new');
      assert.strictEqual(links.linkedin, 'https://linkedin.com/legacy');
      assert.strictEqual(links.portfolio, 'https://portfolio.legacy');
    });

    it('5.3 removeUndefinedFields recursively purges undefined keys while preserving valid structures', () => {
      const input = {
        name: 'Test',
        age: undefined,
        nested: {
          sub1: 'val',
          sub2: undefined,
          arr: [{ keep: true, drop: undefined }],
        },
      };

      const cleaned = removeUndefinedFields(input);

      assert.strictEqual('age' in cleaned, false);
      assert.strictEqual(cleaned.name, 'Test');
      assert.strictEqual('sub2' in cleaned.nested, false);
      assert.strictEqual(cleaned.nested.sub1, 'val');
      assert.strictEqual('drop' in cleaned.nested.arr[0], false);
      assert.strictEqual(cleaned.nested.arr[0].keep, true);
    });
  });
});
