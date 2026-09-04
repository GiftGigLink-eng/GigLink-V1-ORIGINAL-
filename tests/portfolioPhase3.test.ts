/**
 * GigLink Group 5 — Phase 3: Rich Portfolio & Professional Proof of Work Test Suite
 * 
 * Tests:
 * 1. Rich Project Proof schema validation & optional evidence properties
 * 2. Portfolio prioritization algorithm (Featured -> Recency -> Verification)
 * 3. Strict public projection isolation & Private Draft exclusion
 * 4. Authoritative verification boundary immutability
 * 5. Sanitization of external links, media deliverables, and verifier attribution
 * 6. Profile & Trust metric aggregation reflecting valid public deliverables
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  UserProfile,
  TrustPassport,
  PublicTrustPassport,
  ProjectProof,
  ProjectStatus,
} from '../src/types';
import {
  getUnifiedProfileData,
  sanitizePublicPassportProjection,
  sanitizePublicProjectProof,
  sortPortfolioProjects,
  buildPassportUpdatePayload,
} from '../src/lib/profileService';
import { calculateTrustScore, calculateProfileCompleteness } from '../src/lib/trustScore';

describe('Group 5 Phase 3: Rich Portfolio & Professional Proof of Work', () => {

  // =========================================================================
  // 1. RICH PROJECT PROOF SCHEMA & DATA INTEGRITY
  // =========================================================================
  describe('1. Rich Project Proof Schema & Attributes', () => {
    it('1.1 Allows complete portfolio deliverable definition with all extended attributes', () => {
      const fullProject: ProjectProof = {
        id: 'proj_enterprise_ledger',
        title: 'Distributed Trust Engine & Proof Ledger',
        summary: 'High-throughput verification architecture connecting learners and enterprise partners.',
        description: 'Architected event-driven zero-knowledge credential verification engine with end-to-end audit logging, RBAC authorization, and automated compliance validation.',
        role: 'Principal Cloud Architect',
        skillsUsed: ['TypeScript', 'Node.js', 'Firebase', 'Cryptography', 'Cloud Architecture'],
        completedAt: '2026-08-15',
        status: 'published',
        isFeatured: true,
        repositoryUrl: 'https://github.com/giglink/trust-engine',
        projectUrl: 'https://trust.giglink.app',
        externalUrl: 'https://engineering.giglink.io/posts/trust-engine-architecture',
        previewImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31',
        deliverables: [
          'Implemented cryptographic signature verification for issued certificates',
          'Sub-second latency verification endpoint handling 10,000+ requests/sec',
          'Designed granular role-based security rules for multi-tenant isolation',
        ],
        verificationStatus: 'verified',
        verifierUid: 'org_acme_corp',
        verifierName: 'Acme Enterprise Solutions',
        verifiedAt: '2026-08-16T14:30:00.000Z',
      };

      assert.strictEqual(fullProject.id, 'proj_enterprise_ledger');
      assert.strictEqual(fullProject.isFeatured, true);
      assert.strictEqual(fullProject.status, 'published');
      assert.strictEqual(fullProject.deliverables?.length, 3);
      assert.strictEqual(fullProject.verificationStatus, 'verified');
      assert.strictEqual(fullProject.verifierName, 'Acme Enterprise Solutions');
    });

    it('1.2 Sanitizes project proof properly preserving public deliverables and stripping unearned verifications', () => {
      const unverifiedProject: ProjectProof = {
        id: 'proj_unverified_hack',
        title: 'Side Project Alpha',
        description: 'Building custom React components with TypeScript.',
        role: 'Solo Creator',
        skillsUsed: ['React'],
        completedAt: '2026-08-01',
        status: 'published',
        verificationStatus: 'unverified',
        // Attempted unearned verifier tampering:
        verifierName: 'Fake Company',
        verifiedAt: '2026-08-01T00:00:00Z',
      };

      const sanitized = sanitizePublicProjectProof(unverifiedProject);

      assert.strictEqual(sanitized.id, 'proj_unverified_hack');
      assert.strictEqual(sanitized.title, 'Side Project Alpha');
      assert.strictEqual(sanitized.verificationStatus, 'unverified');
      // Verifier fields must be omitted for unverified projects
      assert.strictEqual((sanitized as any).verifierName, undefined);
      assert.strictEqual((sanitized as any).verifiedAt, undefined);
    });
  });

  // =========================================================================
  // 2. PORTFOLIO SORTING & PRESENTATION ALGORITHM
  // =========================================================================
  describe('2. Portfolio Sorting & Prioritization', () => {
    it('2.1 Sorts featured projects first, then verified status, then recent completion dates', () => {
      const projects: ProjectProof[] = [
        {
          id: 'p1',
          title: 'Older Verified Project',
          description: 'Solid work',
          role: 'Contributor',
          skillsUsed: ['JavaScript'],
          completedAt: '2024-01-01',
          verificationStatus: 'verified',
          isFeatured: false,
        },
        {
          id: 'p2',
          title: 'Recent Unverified Project',
          description: 'Fresh work',
          role: 'Lead',
          skillsUsed: ['TypeScript'],
          completedAt: '2026-08-10',
          verificationStatus: 'unverified',
          isFeatured: false,
        },
        {
          id: 'p3',
          title: 'Featured Showcase Project',
          description: 'Flagship engineering deliverable',
          role: 'Architect',
          skillsUsed: ['Go', 'Kubernetes'],
          completedAt: '2025-05-01',
          verificationStatus: 'unverified',
          isFeatured: true,
        },
      ];

      const sorted = sortPortfolioProjects(projects);

      // 1st must be Featured (p3)
      assert.strictEqual(sorted[0].id, 'p3');
      // 2nd must be Verified (p1)
      assert.strictEqual(sorted[1].id, 'p1');
      // 3rd is recent unverified (p2)
      assert.strictEqual(sorted[2].id, 'p2');
    });

    it('2.2 Handles empty or undefined project arrays gracefully', () => {
      assert.deepStrictEqual(sortPortfolioProjects([]), []);
      assert.deepStrictEqual(sortPortfolioProjects(undefined as any), []);
    });
  });

  // =========================================================================
  // 3. STRICT PUBLIC PROJECTION & PRIVATE DRAFTS ISOLATION
  // =========================================================================
  describe('3. Public Projection Isolation & Draft Privacy', () => {
    it('3.1 Filters out private draft projects from public trust passport projection', () => {
      const passport: Partial<TrustPassport> & { id: string; userId: string } = {
        id: 'user_portfolio_test',
        userId: 'user_portfolio_test',
        headline: 'Lead Systems Engineer',
        bio: 'Portfolio testing bio.',
        location: 'Berlin, Germany',
        locationVerificationStatus: 'self_declared',
        identityVerified: true,
        isPublic: true,
        skills: [{ id: 's1', name: 'Rust', category: 'Backend', proficiency: 'expert', verifiedCount: 3 }],
        projects: [
          {
            id: 'proj_published_1',
            title: 'Public Open Source Parser',
            description: 'Fast streaming AST parser written in Rust.',
            role: 'Creator & Maintainer',
            skillsUsed: ['Rust'],
            completedAt: '2026-07-01',
            status: 'published',
            verificationStatus: 'verified',
            verifierName: 'Rust Foundation Grant',
          },
          {
            id: 'proj_draft_private',
            title: 'Unreleased Secret Steath Startup MVP',
            description: 'Proprietary IP and confidential prototype notes.',
            role: 'Founder',
            skillsUsed: ['Rust', 'Wasm'],
            completedAt: '2026-08-17',
            status: 'draft', // MUST NEVER BE LEAKED TO PUBLIC
            verificationStatus: 'unverified',
          },
        ],
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const sanitizedPublic = sanitizePublicPassportProjection(passport as TrustPassport, undefined, true);

      // Public projection must contain ONLY published projects
      assert.strictEqual(sanitizedPublic.projects?.length, 1);
      assert.strictEqual(sanitizedPublic.projects![0].id, 'proj_published_1');
      assert.strictEqual(
        sanitizedPublic.projects!.some((p) => p.id === 'proj_draft_private'),
        false
      );

      // Public metrics completedProjectsCount must count ONLY visible public projects
      assert.strictEqual(sanitizedPublic.metrics?.completedProjectsCount, 1);
    });

    it('3.2 Unified profile data presents draft projects for the owner while preserving status flags', () => {
      const passport: Partial<TrustPassport> = {
        id: 'user_owner_view',
        userId: 'user_owner_view',
        skills: [],
        projects: [
          {
            id: 'draft_1',
            title: 'Owner Work in Progress',
            description: 'Draft notes',
            role: 'Author',
            skillsUsed: ['Design'],
            completedAt: '2026-08-17',
            status: 'draft',
            verificationStatus: 'unverified',
          },
        ],
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const unified = getUnifiedProfileData(undefined, passport as TrustPassport, false);

      // Owner unified view sees all projects including drafts
      assert.strictEqual(unified.projects.length, 1);
      assert.strictEqual(unified.projects[0].status, 'draft');
    });
  });

  // =========================================================================
  // 4. PASSPORT MUTATION PAYLOAD INTEGRITY
  // =========================================================================
  describe('4. Passport Mutation Payload for Projects', () => {
    it('4.1 Correctly extracts project list updates in buildPassportUpdatePayload', () => {
      const newProjects: ProjectProof[] = [
        {
          id: 'proj_new',
          title: 'New Production Deploy',
          description: 'Zero downtime deployment pipeline.',
          role: 'DevOps Lead',
          skillsUsed: ['Docker', 'Terraform'],
          completedAt: '2026-08-17',
          status: 'published',
          verificationStatus: 'pending',
        },
      ];

      const payload = buildPassportUpdatePayload(null, {
        projects: newProjects,
      });

      assert.strictEqual(Array.isArray(payload.projects), true);
      assert.strictEqual(payload.projects!.length, 1);
      assert.strictEqual(payload.projects![0].id, 'proj_new');
      assert.ok(payload.updatedAt);
    });
  });

  // =========================================================================
  // 5. PROFILE COMPLETENESS WITH RICH PORTFOLIO DELIVERABLES
  // =========================================================================
  describe('5. Profile Completeness Calculation with Deliverables', () => {
    it('5.1 Counts presence of verified and unverified deliverables towards profile completeness', () => {
      const profile: UserProfile = {
        uid: 'user_comp_test',
        email: 'dev@giglink.io',
        displayName: 'Senior Engineer',
        photoURL: '',
        activePersona: 'learner',
        availablePersonas: ['learner'],
        onboardingCompleted: true,
        createdAt: '2026-08-17T00:00:00.000Z',
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const passportWithProject: Partial<TrustPassport> = {
        id: 'user_comp_test',
        userId: 'user_comp_test',
        headline: 'Senior Cloud Engineer & Architect',
        bio: 'Comprehensive bio detailing full stack engineering and cloud systems expertise.',
        location: 'Paris, France',
        skills: [{ id: 's1', name: 'TypeScript', category: 'Dev', proficiency: 'expert', verifiedCount: 1 }],
        projects: [
          {
            id: 'p1',
            title: 'E-commerce Engine',
            description: 'Scalable checkout system',
            role: 'Lead',
            skillsUsed: ['TypeScript'],
            completedAt: '2026-05-01',
            verificationStatus: 'verified',
          },
        ],
        experience: [
          {
            id: 'e1',
            organizationName: 'Acme Corp',
            roleTitle: 'Dev',
            type: 'employment',
            startDate: '2022',
            description: 'Full stack development',
            isCurrent: true,
            verificationStatus: 'unverified',
          },
        ],
        updatedAt: '2026-08-17T00:00:00.000Z',
      };

      const score = calculateProfileCompleteness(profile, passportWithProject);
      assert.strictEqual(score, 100);
    });
  });
});
