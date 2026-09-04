/**
 * GigLink Group 5 — Phase 2: Profile UI & Read Views Test Suite
 * 
 * Tests:
 * 1. Canonical routes verification (/profile, /profile/preview, /p/:uid, /passport)
 * 2. Unified Profile UI data binding and persona-aware presentation
 * 3. Profile editing mutations targeting /trustPassports/{uid}
 * 4. Public Profile (/p/:uid) security isolation & zero-knowledge invariants
 * 5. Public Profile Preview mode consistency with public projection
 * 6. Profile Completeness vs Trust Score strict separation
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
  UnifiedProfileData,
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

describe('Group 5 Phase 2: Profile UI & Read Views', () => {

  // =========================================================================
  // 1. CANONICAL ROUTES & PERSPECTIVE SEPARATION
  // =========================================================================
  describe('1. Canonical Routes & View Model Mapping', () => {

    it('1.1 My Profile (/profile) constructs authoritative unified view model for authenticated owner', () => {
      const profile: UserProfile = {
        uid: 'user_auth_100',
        email: 'dev@giglink.io',
        displayName: 'Sammy Developer',
        photoURL: 'https://images.example.com/sammy.jpg',
        activePersona: 'learner',
        availablePersonas: ['learner', 'partner'],
        onboardingCompleted: true,
        createdAt: '2026-08-17T00:00:00.000Z',
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const passport: TrustPassport = {
        id: 'user_auth_100',
        userId: 'user_auth_100',
        headline: 'Full-Stack TypeScript & Cloud Engineer',
        bio: 'Passionate about distributed systems, React architecture, and verifiable credentials.',
        location: 'London, UK',
        structuredLocation: {
          country: 'United Kingdom',
          state: 'England',
          city: 'London',
          formattedAddress: 'London, UK',
        },
        locationVerificationStatus: 'self_declared',
        identityVerified: true,
        isPublic: true,
        skills: [
          { id: 's1', name: 'TypeScript', category: 'Backend Development', proficiency: 'expert', verifiedCount: 2 },
          { id: 's2', name: 'React', category: 'Frontend Development', proficiency: 'expert', verifiedCount: 1 },
        ],
        projects: [
          {
            id: 'p1',
            title: 'GigLink Applet',
            description: 'Next generation career ecosystem.',
            role: 'Lead Full-Stack Developer',
            skillsUsed: ['TypeScript', 'React'],
            completedAt: '2026-08-17',
            projectUrl: 'https://giglink.app',
            repositoryUrl: 'https://github.com/giglink/applet',
            verificationStatus: 'verified',
          },
        ],
        education: [
          {
            id: 'edu_1',
            institutionName: 'University of Cambridge',
            degree: 'Master of Engineering',
            fieldOfStudy: 'Computer Science',
            startDate: '2018',
            endDate: '2022',
            isCurrent: false,
            verificationStatus: 'unverified',
          },
        ],
        experience: [
          {
            id: 'exp_1',
            organizationName: 'TechCorp UK',
            roleTitle: 'Senior Software Engineer',
            type: 'employment',
            startDate: '2022-09',
            isCurrent: true,
            description: 'Leading frontend architecture.',
            verificationStatus: 'verified',
          },
        ],
        certifications: [
          {
            id: 'cert_1',
            title: 'AWS Certified Solutions Architect - Associate',
            issuer: 'Amazon Web Services',
            issueDate: '2023-04',
            credentialUrl: 'https://aws.amazon.com/verification',
            verificationStatus: 'verified',
          },
        ],
        socialLinks: {
          github: 'https://github.com/sammydev',
          linkedin: 'https://linkedin.com/in/sammydev',
          portfolio: 'https://sammy.dev',
        },
        reviews: [],
        metrics: {
          verificationScore: 40,
          completedProjectsCount: 1,
          verifiedSkillsCount: 2,
          endorsementsCount: 0,
          activeStreakDays: 10,
        },
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const unified: UnifiedProfileData = getUnifiedProfileData(profile, passport, true);

      assert.strictEqual(unified.uid, 'user_auth_100');
      assert.strictEqual(unified.displayName, 'Sammy Developer');
      assert.strictEqual(unified.photoURL, 'https://images.example.com/sammy.jpg');
      assert.strictEqual(unified.headline, 'Full-Stack TypeScript & Cloud Engineer');
      assert.strictEqual(unified.location, 'London, UK');
      assert.strictEqual(unified.skills.length, 2);
      assert.strictEqual(unified.projects.length, 1);
      assert.strictEqual(unified.experience.length, 1);
      assert.strictEqual(unified.education.length, 1);
      assert.strictEqual(unified.certifications.length, 1);
      assert.strictEqual(unified.socialLinks.github, 'https://github.com/sammydev');
      assert.strictEqual(unified.trustScore, 70); // 40 (identity) + 10 (project) + 10 (2 skills) + 10 (hygiene)
      assert.strictEqual(unified.trustTier, 'Verified Pro');
      assert.strictEqual(unified.profileCompleteness, 100);
    });

    it('1.2 Public Profile (/p/:uid) contains only sanitized public projection data without private credentials', () => {
      const passport: TrustPassport = {
        id: 'user_pub_200',
        userId: 'user_pub_200',
        headline: 'Lead Cloud Security Architect',
        bio: 'Auditing high assurance systems.',
        location: 'Zurich, Switzerland',
        structuredLocation: {
          country: 'Switzerland',
          state: 'Zurich',
          city: 'Zurich',
          formattedAddress: 'Zurich, Switzerland',
        },
        locationVerificationStatus: 'self_declared',
        identityVerified: true,
        isPublic: true,
        skills: [{ id: 's1', name: 'Cybersecurity', category: 'Security', proficiency: 'expert', verifiedCount: 3 }],
        projects: [],
        education: [],
        reviews: [],
        metrics: {
          verificationScore: 40,
          completedProjectsCount: 0,
          verifiedSkillsCount: 1,
          endorsementsCount: 0,
          activeStreakDays: 7,
        },
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const profile: UserProfile = {
        uid: 'user_pub_200',
        email: 'confidential_corp_email@banking.ch',
        displayName: 'Clara Oswald',
        activePersona: 'partner',
        availablePersonas: ['partner'],
        createdAt: '2026-08-17T00:00:00.000Z',
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const publicProjection: PublicTrustPassport = sanitizePublicPassportProjection(passport, profile, true);

      assert.strictEqual(publicProjection.userId, 'user_pub_200');
      assert.strictEqual(publicProjection.displayName, 'Clara Oswald');
      assert.strictEqual(publicProjection.headline, 'Lead Cloud Security Architect');
      assert.strictEqual(publicProjection.location, 'Zurich, Switzerland');
      assert.strictEqual(publicProjection.identityVerified, true);
      assert.strictEqual(publicProjection.skills.length, 1);

      // Verify privacy isolation
      assert.strictEqual((publicProjection as any).email, undefined);
      assert.strictEqual((publicProjection as any).documentNumberMasked, undefined);
      assert.strictEqual((publicProjection as any).evidenceNotes, undefined);
      assert.strictEqual((publicProjection as any).internalAudits, undefined);
    });
  });

  // =========================================================================
  // 2. PROFILE EDITING & MUTATION INVARIANTS
  // =========================================================================
  describe('2. Profile Editing & Mutations Target /trustPassports/{uid}', () => {

    it('2.1 Updates to headline, bio, location, and social links are sanitized and directed to passport', () => {
      const existingPassport: TrustPassport = {
        id: 'usr_edit_300',
        userId: 'usr_edit_300',
        headline: 'Initial Headline',
        bio: 'Initial Bio',
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

      const payload = buildPassportUpdatePayload(existingPassport, {
        headline: 'Updated Principal AI Engineer',
        bio: 'Building production-grade multimodal agentic workflows.',
        location: 'San Francisco, CA',
        socialLinks: {
          github: 'https://github.com/aiengineer',
          linkedin: 'https://linkedin.com/in/aiengineer',
          portfolio: 'https://aiengineer.io',
        },
      });

      assert.strictEqual(payload.headline, 'Updated Principal AI Engineer');
      assert.strictEqual(payload.bio, 'Building production-grade multimodal agentic workflows.');
      assert.strictEqual(payload.location, 'San Francisco, CA');
      assert.strictEqual(payload.socialLinks?.github, 'https://github.com/aiengineer');
      assert.strictEqual(payload.portfolioUrl, 'https://aiengineer.io');
      assert.ok(payload.updatedAt);
    });

    it('2.2 Unsolicited mutations to identityVerified or trustScore are strictly stripped', () => {
      const payload = buildPassportUpdatePayload(null, {
        headline: 'Attacker Profile',
        // Attempting to inject privileged fields
        ...({ identityVerified: true, trustScore: 100, trustTier: 'Elite' } as any),
      });

      assert.strictEqual((payload as any).identityVerified, undefined);
      assert.strictEqual((payload as any).trustScore, undefined);
      assert.strictEqual((payload as any).trustTier, undefined);
    });
  });

  // =========================================================================
  // 3. COMPLETENESS VS TRUST SCORE INDEPENDENCE
  // =========================================================================
  describe('3. Completeness vs Trust Score Independence', () => {

    it('3.1 100% Profile Completeness with self-declared claims yields 0 Trust Score without verifications', () => {
      const profile: Partial<UserProfile> = {
        displayName: 'John Unverified',
      };
      const passport: Partial<TrustPassport> = {
        headline: 'Self Proclaimed Expert',
        bio: 'Detailed 200-word biography filled out with all requirements.',
        location: 'Denver, CO, USA',
        structuredLocation: {
          country: 'United States',
          state: 'Colorado',
          city: 'Denver',
          formattedAddress: 'Denver, CO, USA',
        },
        identityVerified: false, // Unverified
        skills: [
          { id: 's1', name: 'React', category: 'Frontend', proficiency: 'expert', verifiedCount: 0 },
        ],
        projects: [
          {
            id: 'p1',
            title: 'Unverified Project',
            description: 'Self-reported without repository or proof links',
            role: 'Author',
            skillsUsed: ['React'],
            completedAt: '2026-01-01',
            verificationStatus: 'unverified',
          },
        ],
      };

      const completeness = calculateProfileCompleteness(profile, passport);
      const score = calculateTrustScore(passport, profile, false);

      // Completeness is 100% because all required profile fields are present
      assert.strictEqual(completeness, 100);

      // Trust Score is 0 because no claims are verified and email is unverified
      assert.strictEqual(score.totalScore, 0);
      assert.strictEqual(score.tier, 'Unverified');
    });

    it('3.2 Sparse profile with verified identity receives earned trust points without artificial inflation', () => {
      const profile: Partial<UserProfile> = {
        displayName: 'Minimal Verified',
      };
      const passport: Partial<TrustPassport> = {
        headline: '',
        bio: '',
        location: '',
        identityVerified: true, // +40 pts
        skills: [],
        projects: [],
      };

      const completeness = calculateProfileCompleteness(profile, passport);
      const score = calculateTrustScore(passport, profile, false);

      // Completeness is low (25% for displayName only)
      assert.strictEqual(completeness, 25);

      // Trust score reflects exactly verified identity (40 pts)
      assert.strictEqual(score.identityPoints, 40);
      assert.strictEqual(score.totalScore, 40);
      assert.strictEqual(score.tier, 'Novice');
    });
  });

  // =========================================================================
  // 4. PERSONA-AWARE LAYOUT STRUCTURES
  // =========================================================================
  describe('4. Persona-Aware Representation', () => {

    it('4.1 Unified profile correctly reflects active persona contexts', () => {
      const personas = ['learner', 'partner', 'client', 'organization_admin'] as const;

      for (const persona of personas) {
        const profile: UserProfile = {
          uid: `user_${persona}`,
          email: `${persona}@example.com`,
          displayName: `${persona} User`,
          activePersona: persona,
          availablePersonas: [persona],
          onboardingCompleted: true,
          createdAt: '2026-08-17T00:00:00.000Z',
          updatedAt: '2026-08-17T00:00:00.000Z',
        };

        const unified = getUnifiedProfileData(profile, null, true);
        assert.strictEqual(unified.activePersona, persona);
      }
    });
  });
});
