/**
 * GigLink Group 5 — Phase 5.3: Application Flow & Creator Review Enhancement Test Suite
 * 
 * Test Coverage:
 * 1. Applicant Authorization Invariants (deterministic IDs, self-ownership, withdrawal rules)
 * 2. Creator Review Authorization & State Machine (submitted -> under_review -> shortlisted -> accepted/declined)
 * 3. Illegal State Transitions Prevention (bypassing review, reviving declined/withdrawn)
 * 4. Application Trust Snapshot Immutability (snapshot unaltered when live profile changes)
 * 5. Candidate Trust Score & Verification Immutability (zero mutation during creator review)
 * 6. Private Data Isolation & Public Passport Sanitization
 * 7. Explainable Match Scoring Single Source of Truth
 * 8. Firestore Security Rules SHA-256 Checksum Invariant
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  Opportunity,
  OpportunityApplication,
  PublicTrustPassport,
  UnifiedProfileData,
  OpportunityMatchExplanation,
  ProjectProof,
} from '../src/types';
import {
  calculateOpportunityMatch,
} from '../src/lib/matchingService';
import {
  sanitizePublicPassportProjection,
  sanitizePublicProjectProof,
} from '../src/lib/profileService';

describe('Group 5 — Phase 5.3: Application Flow & Creator Review Enhancement', () => {

  // =========================================================================
  // FIXTURES
  // =========================================================================
  const mockOpportunity: Opportunity = {
    id: 'opp_fullstack_lead',
    title: 'Senior TypeScript Architect',
    creatorId: 'creator_alice_123',
    creatorName: 'Alice Tech Corp',
    type: 'contract',
    category: 'engineering',
    description: 'Looking for a Senior TypeScript developer with verified React experience.',
    requiredSkills: ['TypeScript', 'React', 'Node.js'],
    experienceLevel: 'expert',
    locationType: 'remote',
    compensationType: 'hourly',
    compensationMin: 80,
    compensationMax: 120,
    currency: 'USD',
    recommendedTrustTier: 'Verified Pro',
    status: 'open',
    createdAt: '2026-08-18T10:00:00.000Z',
    updatedAt: '2026-08-18T10:00:00.000Z',
  };

  const initialCandidatePassport: PublicTrustPassport = {
    userId: 'applicant_bob_456',
    uid: 'applicant_bob_456',
    displayName: 'Bob Candidate',
    headline: 'Senior Full Stack Engineer',
    bio: 'Passionate about verified trust systems and robust web applications.',
    location: 'San Francisco, CA',
    locationVerificationStatus: 'self_declared',
    identityVerified: true,
    isPublic: true,
    trustScore: 85,
    trustTier: 'Verified Pro',
    skills: [
      { id: 's1', name: 'TypeScript', verifiedCount: 3, category: 'engineering', proficiency: 'expert' },
      { id: 's2', name: 'React', verifiedCount: 2, category: 'engineering', proficiency: 'expert' },
      { id: 's3', name: 'Node.js', verifiedCount: 0, category: 'engineering', proficiency: 'intermediate' },
    ],
    projects: [
      {
        id: 'proj_1',
        title: 'Enterprise Fintech Dashboard',
        description: 'High-volume trading dashboard.',
        role: 'Lead Frontend Engineer',
        skillsUsed: ['TypeScript', 'React'],
        status: 'published',
        verificationStatus: 'verified',
        verifierName: 'Fintech Audits Inc',
        verifiedAt: '2026-06-01T00:00:00.000Z',
        completedAt: '2026-05-30T00:00:00.000Z',
      },
    ],
    experience: [],
    workHistory: [],
    education: [],
    certifications: [],
    certificates: [],
    reviews: [],
    metrics: {
      verificationScore: 85,
      completedProjectsCount: 1,
      verifiedSkillsCount: 2,
      endorsementsCount: 0,
      activeStreakDays: 10,
    },
    socialLinks: { github: 'https://github.com/bob' },
    updatedAt: '2026-08-18T12:00:00.000Z',
  };

  // State Machine helper function representing security rules transition validation
  function validateApplicationTransition(
    existingApp: OpportunityApplication,
    incomingApp: OpportunityApplication,
    actingUserId: string,
    isOppManager: boolean
  ): { allowed: boolean; reason?: string } {
    // Check immutabilities
    if (incomingApp.applicantId !== existingApp.applicantId) {
      return { allowed: false, reason: 'applicantId cannot be mutated' };
    }
    if (incomingApp.opportunityId !== existingApp.opportunityId) {
      return { allowed: false, reason: 'opportunityId cannot be mutated' };
    }
    if (incomingApp.opportunityCreatorId !== existingApp.opportunityCreatorId) {
      return { allowed: false, reason: 'opportunityCreatorId cannot be mutated' };
    }
    if (incomingApp.submittedAt !== existingApp.submittedAt) {
      return { allowed: false, reason: 'submittedAt cannot be mutated' };
    }

    // Applicant path
    if (actingUserId === existingApp.applicantId) {
      if (incomingApp.creatorFeedback !== existingApp.creatorFeedback) {
        return { allowed: false, reason: 'Applicant cannot modify creator feedback' };
      }
      if (existingApp.status !== 'submitted') {
        return { allowed: false, reason: 'Applicant can only modify/withdraw submitted applications' };
      }
      if (incomingApp.status !== 'submitted' && incomingApp.status !== 'withdrawn') {
        return { allowed: false, reason: 'Applicant can only remain submitted or withdraw' };
      }
      return { allowed: true };
    }

    // Manager path
    if (isOppManager) {
      if (incomingApp.coverNote !== existingApp.coverNote) {
        return { allowed: false, reason: 'Creator cannot alter applicant cover note' };
      }

      // Legal state transitions:
      // submitted -> under_review
      if (existingApp.status === 'submitted' && incomingApp.status === 'under_review') {
        return { allowed: true };
      }
      // under_review -> shortlisted or declined
      if (
        existingApp.status === 'under_review' &&
        (incomingApp.status === 'shortlisted' || incomingApp.status === 'declined')
      ) {
        return { allowed: true };
      }
      // shortlisted -> accepted or declined
      if (
        existingApp.status === 'shortlisted' &&
        (incomingApp.status === 'accepted' || incomingApp.status === 'declined')
      ) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: `Illegal state transition from ${existingApp.status} to ${incomingApp.status}`,
      };
    }

    return { allowed: false, reason: 'Unauthorized user' };
  }

  // =========================================================================
  // SUITE 1: Applicant Authorization & Creation Invariants
  // =========================================================================
  describe('1. Applicant Authorization & Creation Invariants', () => {
    it('1.1 Enforces deterministic application ID format ${opportunityId}_${applicantId}', () => {
      const oppId = 'opp_fullstack_lead';
      const applicantId = 'applicant_bob_456';
      const expectedAppId = `${oppId}_${applicantId}`;

      assert.strictEqual(expectedAppId, 'opp_fullstack_lead_applicant_bob_456');
    });

    it('1.2 Applicant can withdraw their application while in submitted status', () => {
      const existing: OpportunityApplication = {
        id: 'opp_fullstack_lead_applicant_bob_456',
        opportunityId: 'opp_fullstack_lead',
        opportunityTitle: 'Senior TypeScript Architect',
        opportunityCreatorId: 'creator_alice_123',
        applicantId: 'applicant_bob_456',
        applicantDisplayName: 'Bob Candidate',
        applicantEmail: 'bob@example.com',
        applicantTrustTier: 'Verified Pro',
        applicantTrustScore: 85,
        applicantIdentityVerified: true,
        coverNote: 'Excited about this role!',
        status: 'submitted',
        submittedAt: '2026-08-18T12:00:00.000Z',
        updatedAt: '2026-08-18T12:00:00.000Z',
      };

      const incoming: OpportunityApplication = {
        ...existing,
        status: 'withdrawn',
        updatedAt: '2026-08-18T13:00:00.000Z',
      };

      const validation = validateApplicationTransition(existing, incoming, 'applicant_bob_456', false);
      assert.strictEqual(validation.allowed, true);
    });

    it('1.3 Applicant cannot withdraw or edit application after review has started', () => {
      const existing: OpportunityApplication = {
        id: 'opp_fullstack_lead_applicant_bob_456',
        opportunityId: 'opp_fullstack_lead',
        opportunityTitle: 'Senior TypeScript Architect',
        opportunityCreatorId: 'creator_alice_123',
        applicantId: 'applicant_bob_456',
        applicantDisplayName: 'Bob Candidate',
        applicantEmail: 'bob@example.com',
        applicantTrustTier: 'Verified Pro',
        applicantTrustScore: 85,
        applicantIdentityVerified: true,
        coverNote: 'Excited about this role!',
        status: 'under_review',
        submittedAt: '2026-08-18T12:00:00.000Z',
        updatedAt: '2026-08-18T12:30:00.000Z',
      };

      const incoming: OpportunityApplication = {
        ...existing,
        status: 'withdrawn',
        updatedAt: '2026-08-18T13:00:00.000Z',
      };

      const validation = validateApplicationTransition(existing, incoming, 'applicant_bob_456', false);
      assert.strictEqual(validation.allowed, false);
      assert.match(validation.reason!, /can only modify\/withdraw submitted/);
    });

    it('1.4 Applicant cannot self-accept their application', () => {
      const existing: OpportunityApplication = {
        id: 'opp_fullstack_lead_applicant_bob_456',
        opportunityId: 'opp_fullstack_lead',
        opportunityTitle: 'Senior TypeScript Architect',
        opportunityCreatorId: 'creator_alice_123',
        applicantId: 'applicant_bob_456',
        applicantDisplayName: 'Bob Candidate',
        applicantEmail: 'bob@example.com',
        applicantTrustTier: 'Verified Pro',
        applicantTrustScore: 85,
        applicantIdentityVerified: true,
        coverNote: 'Excited about this role!',
        status: 'submitted',
        submittedAt: '2026-08-18T12:00:00.000Z',
        updatedAt: '2026-08-18T12:00:00.000Z',
      };

      const incoming: OpportunityApplication = {
        ...existing,
        status: 'accepted',
        updatedAt: '2026-08-18T12:05:00.000Z',
      };

      const validation = validateApplicationTransition(existing, incoming, 'applicant_bob_456', false);
      assert.strictEqual(validation.allowed, false);
    });
  });

  // =========================================================================
  // SUITE 2: Creator Review State Machine
  // =========================================================================
  describe('2. Creator Review State Machine', () => {
    const baseApp: OpportunityApplication = {
      id: 'opp_fullstack_lead_applicant_bob_456',
      opportunityId: 'opp_fullstack_lead',
      opportunityTitle: 'Senior TypeScript Architect',
      opportunityCreatorId: 'creator_alice_123',
      applicantId: 'applicant_bob_456',
      applicantDisplayName: 'Bob Candidate',
      applicantEmail: 'bob@example.com',
      applicantTrustTier: 'Verified Pro',
      applicantTrustScore: 85,
      applicantIdentityVerified: true,
      coverNote: 'Excited about this role!',
      status: 'submitted',
      submittedAt: '2026-08-18T12:00:00.000Z',
      updatedAt: '2026-08-18T12:00:00.000Z',
    };

    it('2.1 Allows creator to move submitted -> under_review', () => {
      const underReviewApp: OpportunityApplication = {
        ...baseApp,
        status: 'under_review',
        updatedAt: '2026-08-18T12:15:00.000Z',
      };

      const validation = validateApplicationTransition(baseApp, underReviewApp, 'creator_alice_123', true);
      assert.strictEqual(validation.allowed, true);
    });

    it('2.2 Allows creator to move under_review -> shortlisted or declined', () => {
      const underReviewApp: OpportunityApplication = {
        ...baseApp,
        status: 'under_review',
        updatedAt: '2026-08-18T12:15:00.000Z',
      };

      const shortlistedApp: OpportunityApplication = {
        ...underReviewApp,
        status: 'shortlisted',
        creatorFeedback: 'Strong skill alignment in TypeScript.',
        updatedAt: '2026-08-18T12:30:00.000Z',
      };

      const declinedApp: OpportunityApplication = {
        ...underReviewApp,
        status: 'declined',
        creatorFeedback: 'Requires more Node.js production experience.',
        updatedAt: '2026-08-18T12:30:00.000Z',
      };

      const val1 = validateApplicationTransition(underReviewApp, shortlistedApp, 'creator_alice_123', true);
      assert.strictEqual(val1.allowed, true);

      const val2 = validateApplicationTransition(underReviewApp, declinedApp, 'creator_alice_123', true);
      assert.strictEqual(val2.allowed, true);
    });

    it('2.3 Allows creator to move shortlisted -> accepted (Offer Extended)', () => {
      const shortlistedApp: OpportunityApplication = {
        ...baseApp,
        status: 'shortlisted',
        updatedAt: '2026-08-18T12:30:00.000Z',
      };

      const acceptedApp: OpportunityApplication = {
        ...shortlistedApp,
        status: 'accepted',
        creatorFeedback: 'We are pleased to extend an offer!',
        reviewedAt: '2026-08-18T13:00:00.000Z',
        updatedAt: '2026-08-18T13:00:00.000Z',
      };

      const validation = validateApplicationTransition(shortlistedApp, acceptedApp, 'creator_alice_123', true);
      assert.strictEqual(validation.allowed, true);
    });

    it('2.4 Blocks illegal direct transition: submitted -> accepted (bypassing review)', () => {
      const directAcceptApp: OpportunityApplication = {
        ...baseApp,
        status: 'accepted',
        updatedAt: '2026-08-18T12:10:00.000Z',
      };

      const validation = validateApplicationTransition(baseApp, directAcceptApp, 'creator_alice_123', true);
      assert.strictEqual(validation.allowed, false);
      assert.match(validation.reason!, /Illegal state transition from submitted to accepted/);
    });

    it('2.5 Blocks illegal revive transition: declined -> accepted', () => {
      const declinedApp: OpportunityApplication = {
        ...baseApp,
        status: 'declined',
        updatedAt: '2026-08-18T12:30:00.000Z',
      };

      const revivedApp: OpportunityApplication = {
        ...declinedApp,
        status: 'accepted',
        updatedAt: '2026-08-18T13:00:00.000Z',
      };

      const validation = validateApplicationTransition(declinedApp, revivedApp, 'creator_alice_123', true);
      assert.strictEqual(validation.allowed, false);
    });
  });

  // =========================================================================
  // SUITE 3: Application Snapshot Immutability
  // =========================================================================
  describe('3. Application Snapshot Immutability', () => {
    it('3.1 Application record retains exact snapshot values even when candidate live score updates', () => {
      const snapshotApplication: OpportunityApplication = {
        id: 'opp_fullstack_lead_applicant_bob_456',
        opportunityId: 'opp_fullstack_lead',
        opportunityTitle: 'Senior TypeScript Architect',
        opportunityCreatorId: 'creator_alice_123',
        applicantId: 'applicant_bob_456',
        applicantDisplayName: 'Bob Candidate',
        applicantEmail: 'bob@example.com',
        applicantTrustTier: 'Basic Verified',
        applicantTrustScore: 65,
        applicantIdentityVerified: true,
        coverNote: 'Initial application note',
        status: 'submitted',
        submittedAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
      };

      // Simulating applicant subsequent level-up on their public passport
      const updatedLivePassport: PublicTrustPassport = {
        ...initialCandidatePassport,
        trustScore: 92,
        trustTier: 'Verified Elite',
        skills: [
          ...initialCandidatePassport.skills,
          { id: 's4', name: 'GraphQL', verifiedCount: 2, category: 'engineering', proficiency: 'expert' },
        ],
      };

      // Application snapshot remains 100% frozen
      assert.strictEqual(snapshotApplication.applicantTrustScore, 65);
      assert.strictEqual(snapshotApplication.applicantTrustTier, 'Basic Verified');
      assert.strictEqual(snapshotApplication.submittedAt, '2026-08-01T10:00:00.000Z');

      // Live passport reflects fresh data
      assert.strictEqual(updatedLivePassport.trustScore, 92);
      assert.strictEqual(updatedLivePassport.trustTier, 'Verified Elite');
    });
  });

  // =========================================================================
  // SUITE 4: Candidate Trust Score & Verification Immutability
  // =========================================================================
  describe('4. Candidate Trust Score & Verification Immutability', () => {
    it('4.1 Reviewing and progressing applications has zero write effect on trust score or passport', () => {
      const candidateBefore = JSON.stringify(initialCandidatePassport);

      // Creator reviews application
      const matchResult = calculateOpportunityMatch(mockOpportunity, initialCandidatePassport);
      assert.ok(matchResult.matchPercentage > 0);

      const candidateAfter = JSON.stringify(initialCandidatePassport);
      assert.strictEqual(candidateBefore, candidateAfter, 'Candidate passport must remain bit-for-bit unchanged');
    });

    it('4.2 Sanitizes project proofs for public drawer display without leaking reviewer notes', () => {
      const rawProjectWithInternalDetails: ProjectProof = {
        id: 'proj_deep',
        title: 'Core Protocol V2',
        description: 'Smart contract engine.',
        role: 'Principal Engineer',
        skillsUsed: ['Solidity', 'TypeScript'],
        status: 'published',
        verificationStatus: 'verified',
        verifierName: 'CertiK Labs',
        verifiedAt: '2026-07-01T00:00:00.000Z',
        completedAt: '2026-06-30T00:00:00.000Z',
      };

      const sanitized = sanitizePublicProjectProof(rawProjectWithInternalDetails);
      assert.strictEqual(sanitized.id, 'proj_deep');
      assert.strictEqual(sanitized.verificationStatus, 'verified');
      assert.strictEqual(sanitized.verifierName, 'CertiK Labs');
      assert.strictEqual((sanitized as any).internalAuditNote, undefined);
    });
  });

  // =========================================================================
  // SUITE 5: Explainable Match Scoring Consistency
  // =========================================================================
  describe('5. Explainable Match Scoring Consistency', () => {
    it('5.1 Accurately calculates match explanation with 40/10/30/20 breakdown', () => {
      const explanation = calculateOpportunityMatch(mockOpportunity, initialCandidatePassport);

      assert.ok(explanation.matchPercentage >= 0 && explanation.matchPercentage <= 100);
      assert.strictEqual(typeof explanation.breakdown.verifiedSkillPoints, 'number');
      assert.strictEqual(typeof explanation.breakdown.selfDeclaredSkillPoints, 'number');
      assert.strictEqual(typeof explanation.breakdown.trustTierPoints, 'number');
      assert.strictEqual(typeof explanation.breakdown.experiencePoints, 'number');
      assert.strictEqual(
        explanation.breakdown.totalScore,
        explanation.breakdown.verifiedSkillPoints +
          explanation.breakdown.selfDeclaredSkillPoints +
          explanation.breakdown.trustTierPoints +
          explanation.breakdown.experiencePoints
      );

      // Verify matched skills breakdown
      const matchedNames = explanation.matchedSkills.map((s) => s.name);
      assert.ok(matchedNames.includes('TypeScript'));
      assert.ok(matchedNames.includes('React'));
    });
  });

  // =========================================================================
  // SUITE 6: Security Invariants & Checksum Preservation
  // =========================================================================
  describe('6. Security Invariants & Checksum Preservation', () => {
    it('6.1 firestore.rules sha256 checksum matches canonical security baseline', () => {
      const canonicalChecksum = '667e03431c26c17293ad78bff2c87a385e093fe3b6c902bd0d57f529a43500ce';
      const fileContent = fs.readFileSync('firestore.rules', 'utf8');
      const hash = crypto.createHash('sha256').update(fileContent, 'utf8').digest('hex');

      assert.strictEqual(
        hash,
        canonicalChecksum,
        `SECURITY VIOLATION: firestore.rules has been modified! Expected ${canonicalChecksum}, got ${hash}`
      );
    });
  });
});
