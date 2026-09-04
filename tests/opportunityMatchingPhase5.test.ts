/**
 * GigLink Group 5 — Phase 5.1: Explainable Matching Engine & Invariants Test Suite
 * 
 * Test Coverage:
 * 1. Verified vs Self-Declared Skill Weighting (Verified skills carry 4x weight)
 * 2. Exact Scoring Breakdown (40 pts verified skills, 10 pts self-declared, 30 pts trust tier, 20 pts experience = 100 max)
 * 3. Trust Tier Suitability Alignment (exceeds, meets, below with partial credit)
 * 4. Experience / Role Alignment (all_levels, exceeds, meets, below)
 * 5. Matched Skills (with verification flags) and Missing Skills Tracking
 * 6. Deterministic Repeated Calculations (identical inputs produce identical scores & explanations)
 * 7. Zero / Empty Skill Scenarios (handling listings with no required skills, candidates with no skills)
 * 8. Score Boundaries & Clamping (strictly bounded between 0 and 100)
 * 9. Absolute Trust Score Immutability (matching never alters candidate trust scores or verification records)
 * 10. Multi-Opportunity Sorting & Filtering by Match Fit
 * 11. Preservation of Firestore Security Rules Checksum
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  Opportunity,
  OpportunityMatchExplanation,
  UnifiedProfileData,
  UserProfile,
  TrustPassport,
  SkillItem,
} from '../src/types';
import {
  calculateOpportunityMatch,
  sortOpportunitiesByMatch,
  filterOpportunitiesByMinMatch,
  normalizeTrustTierLevel,
  normalizeExperienceLevel,
  CandidateMatchProfile,
} from '../src/lib/matchingService';
import { calculateTrustScore } from '../src/lib/trustScore';

describe('Group 5 — Phase 5.1: Explainable Matching Engine & Types', () => {

  // =========================================================================
  // FIXTURES
  // =========================================================================
  const sampleOpportunity: Opportunity = {
    id: 'opp_eng_001',
    title: 'Senior Distributed Backend Engineer',
    creatorId: 'creator_123',
    creatorName: 'Astra Protocol',
    type: 'contract',
    category: 'engineering',
    description: 'Lead backend microservice development using TypeScript, Node.js, and PostgreSQL.',
    requiredSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],
    experienceLevel: 'expert',
    locationType: 'remote',
    compensationType: 'hourly',
    compensationMin: 80,
    compensationMax: 120,
    currency: 'USD',
    recommendedTrustTier: 'Gold Verified',
    status: 'open',
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
  };

  // =========================================================================
  // 1. VERIFIED VS SELF-DECLARED SKILL WEIGHTING
  // =========================================================================
  describe('1. Verified vs Self-Declared Skill Weighting', () => {
    it('1.1 Verified skills carry 4x the weight of self-declared skills (40 pts vs 10 pts max)', () => {
      const oppWithTwoSkills: Partial<Opportunity> = {
        requiredSkills: ['TypeScript', 'Rust'],
        recommendedTrustTier: 'Unverified',
        experienceLevel: 'all_levels',
      };

      // Candidate A: 2 Verified skills
      const candidateVerified: CandidateMatchProfile = {
        skills: [
          { id: 's1', name: 'TypeScript', verifiedCount: 3, category: 'engineering', proficiency: 'expert' },
          { id: 's2', name: 'Rust', verifiedCount: 2, category: 'engineering', proficiency: 'expert' },
        ],
        trustTier: 'Unverified',
        experienceLevel: 'expert',
      };

      // Candidate B: 2 Self-declared skills (verifiedCount = 0)
      const candidateSelfDeclared: CandidateMatchProfile = {
        skills: [
          { id: 's1', name: 'TypeScript', verifiedCount: 0, category: 'engineering', proficiency: 'expert' },
          { id: 's2', name: 'Rust', verifiedCount: 0, category: 'engineering', proficiency: 'expert' },
        ],
        trustTier: 'Unverified',
        experienceLevel: 'expert',
      };

      const matchVerified = calculateOpportunityMatch(oppWithTwoSkills, candidateVerified);
      const matchSelfDeclared = calculateOpportunityMatch(oppWithTwoSkills, candidateSelfDeclared);

      // Verified candidate gets 40 verified skill points + 10 base skill points + 30 trust points + 20 exp points = 100
      assert.strictEqual(matchVerified.breakdown.verifiedSkillPoints, 40);
      assert.strictEqual(matchVerified.breakdown.selfDeclaredSkillPoints, 10);
      assert.strictEqual(matchVerified.matchPercentage, 100);

      // Self-declared candidate gets 0 verified points + 10 base skill points + 30 trust points + 20 exp points = 60
      assert.strictEqual(matchSelfDeclared.breakdown.verifiedSkillPoints, 0);
      assert.strictEqual(matchSelfDeclared.breakdown.selfDeclaredSkillPoints, 10);
      assert.strictEqual(matchSelfDeclared.matchPercentage, 60);

      // Verified candidate strictly exceeds self-declared candidate (50 skill points vs 10 skill points)
      assert.strictEqual(matchVerified.matchPercentage > matchSelfDeclared.matchPercentage, true);
      const verifiedTotalSkillPts = matchVerified.breakdown.verifiedSkillPoints + matchVerified.breakdown.selfDeclaredSkillPoints;
      const selfTotalSkillPts = matchSelfDeclared.breakdown.verifiedSkillPoints + matchSelfDeclared.breakdown.selfDeclaredSkillPoints;
      assert.strictEqual(verifiedTotalSkillPts, 5 * selfTotalSkillPts);
    });

    it('1.2 Correctly calculates mixed verified and self-declared skill allocations', () => {
      const oppWithFourSkills: Partial<Opportunity> = {
        requiredSkills: ['React', 'TypeScript', 'GraphQL', 'Tailwind'],
        recommendedTrustTier: 'Unverified',
        experienceLevel: 'all_levels',
      };

      // Candidate with 2 verified, 1 self-declared, 1 missing
      const mixedCandidate: CandidateMatchProfile = {
        skills: [
          { id: 's1', name: 'React', verifiedCount: 2, category: 'engineering', proficiency: 'expert' },
          { id: 's2', name: 'TypeScript', verifiedCount: 5, category: 'engineering', proficiency: 'expert' },
          { id: 's3', name: 'GraphQL', verifiedCount: 0, category: 'engineering', proficiency: 'intermediate' },
        ],
        trustTier: 'Unverified',
        experienceLevel: 'intermediate',
      };

      const match = calculateOpportunityMatch(oppWithFourSkills, mixedCandidate);

      // 2/4 verified = 20 pts; 3/4 matched skills base = 8 pts (Math.round(7.5))
      assert.strictEqual(match.breakdown.verifiedSkillPoints, 20);
      assert.strictEqual(match.breakdown.selfDeclaredSkillPoints, 8);
      assert.strictEqual(match.matchedSkills.length, 3);
      assert.strictEqual(match.matchedSkills.filter((s) => s.verified).length, 2);
      assert.strictEqual(match.matchedSkills.filter((s) => !s.verified).length, 1);
      assert.deepStrictEqual(match.missingSkills, ['Tailwind']);
    });
  });

  // =========================================================================
  // 2. EXACT POINT ALLOCATION & BREAKDOWN MODEL
  // =========================================================================
  describe('2. Exact Point Allocation (40 + 10 + 30 + 20 = 100)', () => {
    it('2.1 Perfect candidate receives exact maximum 100 points', () => {
      const perfectCandidate: CandidateMatchProfile = {
        skills: [
          { id: 's1', name: 'TypeScript', verifiedCount: 4, category: 'engineering', proficiency: 'expert' },
          { id: 's2', name: 'Node.js', verifiedCount: 2, category: 'engineering', proficiency: 'expert' },
          { id: 's3', name: 'PostgreSQL', verifiedCount: 1, category: 'engineering', proficiency: 'expert' },
          { id: 's4', name: 'Docker', verifiedCount: 1, category: 'engineering', proficiency: 'expert' },
        ],
        trustTier: 'Elite Verified',
        experienceLevel: 'expert',
      };

      const match = calculateOpportunityMatch(sampleOpportunity, perfectCandidate);

      assert.strictEqual(match.breakdown.verifiedSkillPoints, 40);
      assert.strictEqual(match.breakdown.selfDeclaredSkillPoints, 10);
      assert.strictEqual(match.breakdown.trustTierPoints, 30);
      assert.strictEqual(match.breakdown.experiencePoints, 20);
      assert.strictEqual(match.breakdown.totalScore, 100);
      assert.strictEqual(match.matchPercentage, 100);
      assert.strictEqual(match.trustTierFit, 'exceeds');
      assert.strictEqual(match.experienceFit, true);
      assert.strictEqual(match.missingSkills.length, 0);
    });

    it('2.2 Candidate with 0 match attributes receives exact minimum 0 points', () => {
      const zeroCandidate: CandidateMatchProfile = {
        skills: [
          { id: 's1', name: 'Photoshop', verifiedCount: 0, category: 'design', proficiency: 'beginner' },
        ],
        trustTier: 'Unverified', // 2+ levels below Gold
        experienceLevel: 'entry', // 2 levels below Expert
      };

      const match = calculateOpportunityMatch(sampleOpportunity, zeroCandidate);

      assert.strictEqual(match.breakdown.verifiedSkillPoints, 0);
      assert.strictEqual(match.breakdown.selfDeclaredSkillPoints, 0);
      assert.strictEqual(match.breakdown.trustTierPoints, 0);
      assert.strictEqual(match.breakdown.experiencePoints, 0);
      assert.strictEqual(match.breakdown.totalScore, 0);
      assert.strictEqual(match.matchPercentage, 0);
      assert.strictEqual(match.trustTierFit, 'below');
      assert.strictEqual(match.experienceFit, false);
      assert.strictEqual(match.missingSkills.length, 4);
    });
  });

  // =========================================================================
  // 3. TRUST TIER SUITABILITY ALIGNMENT
  // =========================================================================
  describe('3. Trust Tier Suitability Alignment', () => {
    it('3.1 Accurately evaluates exceeds, meets, and 1-tier below partial credit', () => {
      const oppTierTest: Partial<Opportunity> = {
        requiredSkills: [],
        recommendedTrustTier: 'Silver Verified', // Level 3
        experienceLevel: 'all_levels',
      };

      // Candidate 1: Elite (Level 4) -> Exceeds (30 pts)
      const cElite: CandidateMatchProfile = { trustTier: 'Elite' };
      const mElite = calculateOpportunityMatch(oppTierTest, cElite);
      assert.strictEqual(mElite.trustTierFit, 'exceeds');
      assert.strictEqual(mElite.breakdown.trustTierPoints, 30);

      // Candidate 2: Silver Verified (Level 3) -> Meets (30 pts)
      const cSilver: CandidateMatchProfile = { trustTier: 'Silver Verified' };
      const mSilver = calculateOpportunityMatch(oppTierTest, cSilver);
      assert.strictEqual(mSilver.trustTierFit, 'meets');
      assert.strictEqual(mSilver.breakdown.trustTierPoints, 30);

      // Candidate 3: Emerging / Basic (Level 2) -> 1 level below (15 pts)
      const cEmerging: CandidateMatchProfile = { trustTier: 'Emerging' };
      const mEmerging = calculateOpportunityMatch(oppTierTest, cEmerging);
      assert.strictEqual(mEmerging.trustTierFit, 'below');
      assert.strictEqual(mEmerging.breakdown.trustTierPoints, 15);

      // Candidate 4: Unverified (Level 0) -> 2+ levels below (0 pts)
      const cUnverified: CandidateMatchProfile = { trustTier: 'Unverified' };
      const mUnverified = calculateOpportunityMatch(oppTierTest, cUnverified);
      assert.strictEqual(mUnverified.trustTierFit, 'below');
      assert.strictEqual(mUnverified.breakdown.trustTierPoints, 0);
    });
  });

  // =========================================================================
  // 4. EXPERIENCE LEVEL ALIGNMENT
  // =========================================================================
  describe('4. Experience Level Alignment', () => {
    it('4.1 Accurately evaluates experience alignment and partial credit', () => {
      const oppExpert: Partial<Opportunity> = {
        requiredSkills: [],
        recommendedTrustTier: 'Unverified',
        experienceLevel: 'expert', // Level 3
      };

      // Candidate 1: Expert -> Meets (20 pts)
      const cExpert: CandidateMatchProfile = { experienceLevel: 'expert' };
      const mExpert = calculateOpportunityMatch(oppExpert, cExpert);
      assert.strictEqual(mExpert.experienceFit, true);
      assert.strictEqual(mExpert.breakdown.experiencePoints, 20);

      // Candidate 2: Intermediate -> 1 level below (10 pts)
      const cMid: CandidateMatchProfile = { experienceLevel: 'intermediate' };
      const mMid = calculateOpportunityMatch(oppExpert, cMid);
      assert.strictEqual(mMid.experienceFit, false);
      assert.strictEqual(mMid.breakdown.experiencePoints, 10);

      // Candidate 3: Entry -> 2 levels below (0 pts)
      const cEntry: CandidateMatchProfile = { experienceLevel: 'entry' };
      const mEntry = calculateOpportunityMatch(oppExpert, cEntry);
      assert.strictEqual(mEntry.experienceFit, false);
      assert.strictEqual(mEntry.breakdown.experiencePoints, 0);
    });

    it('4.2 Automatically derives experience level from project proofs and work history when not explicit', () => {
      const oppExpert: Partial<Opportunity> = {
        requiredSkills: [],
        recommendedTrustTier: 'Unverified',
        experienceLevel: 'expert',
      };

      // Candidate with 3 verified projects -> Derived as expert
      const cWithProjects: CandidateMatchProfile = {
        verifiedProjectsCount: 3,
      };
      const match = calculateOpportunityMatch(oppExpert, cWithProjects);
      assert.strictEqual(match.experienceFit, true);
      assert.strictEqual(match.breakdown.experiencePoints, 20);
    });
  });

  // =========================================================================
  // 5. DETERMINISM & HUMAN-READABLE EXPLANATIONS
  // =========================================================================
  describe('5. Determinism & Human-Readable Explanations', () => {
    it('5.1 Identical inputs produce exact same score and explanation across 100 iterations', () => {
      const candidate: CandidateMatchProfile = {
        skills: [
          { id: 's1', name: 'TypeScript', verifiedCount: 3, category: 'engineering', proficiency: 'expert' },
          { id: 's2', name: 'Node.js', verifiedCount: 0, category: 'engineering', proficiency: 'intermediate' },
        ],
        trustTier: 'Verified Pro',
        experienceLevel: 'intermediate',
      };

      const firstRun = calculateOpportunityMatch(sampleOpportunity, candidate);

      for (let i = 0; i < 100; i++) {
        const run = calculateOpportunityMatch(sampleOpportunity, candidate);
        assert.strictEqual(run.matchPercentage, firstRun.matchPercentage);
        assert.strictEqual(run.explanation, firstRun.explanation);
        assert.strictEqual(run.summary, firstRun.summary);
        assert.deepStrictEqual(run.breakdown, firstRun.breakdown);
      }
    });

    it('5.2 Generates structured explanation with matched and missing skill descriptions', () => {
      const candidate: CandidateMatchProfile = {
        skills: [
          { id: 's1', name: 'typescript', verifiedCount: 1, category: 'engineering', proficiency: 'expert' },
        ],
        trustTier: 'Gold Verified',
        experienceLevel: 'expert',
      };

      const match = calculateOpportunityMatch(sampleOpportunity, candidate);

      assert.strictEqual(typeof match.summary, 'string');
      assert.strictEqual(match.summary.length > 20, true);
      assert.strictEqual(match.matchedSkills.length, 1);
      assert.strictEqual(match.matchedSkills[0].name.toLowerCase(), 'typescript');
      assert.strictEqual(match.matchedSkills[0].verified, true);
      assert.strictEqual(match.missingSkills.includes('Node.js'), true);
      assert.strictEqual(match.missingSkills.includes('PostgreSQL'), true);
    });
  });

  // =========================================================================
  // 6. ZERO & EMPTY SKILL SCENARIOS
  // =========================================================================
  describe('6. Zero & Empty Skill Scenarios', () => {
    it('6.1 Handles opportunities with empty requiredSkills array cleanly', () => {
      const generalOpp: Partial<Opportunity> = {
        requiredSkills: [],
        recommendedTrustTier: 'Basic Verified',
        experienceLevel: 'all_levels',
      };

      const match = calculateOpportunityMatch(generalOpp, {
        trustTier: 'Basic Verified',
      });

      assert.strictEqual(match.breakdown.verifiedSkillPoints, 40);
      assert.strictEqual(match.breakdown.selfDeclaredSkillPoints, 10);
      assert.strictEqual(match.breakdown.trustTierPoints, 30);
      assert.strictEqual(match.breakdown.experiencePoints, 20);
      assert.strictEqual(match.matchPercentage, 100);
      assert.strictEqual(match.missingSkills.length, 0);
    });

    it('6.2 Handles null or undefined opportunity / candidate gracefully without throwing', () => {
      const matchNullOpp = calculateOpportunityMatch(null, null);
      assert.strictEqual(matchNullOpp.matchPercentage, 0);
      assert.strictEqual(matchNullOpp.matchedSkills.length, 0);

      const matchNullCand = calculateOpportunityMatch(sampleOpportunity, null);
      assert.strictEqual(matchNullCand.matchPercentage, 0);
      assert.strictEqual(matchNullCand.missingSkills.length, 4);
    });
  });

  // =========================================================================
  // 7. TRUST SCORE IMMUTABILITY INVARIANT
  // =========================================================================
  describe('7. Absolute Trust Score Immutability', () => {
    it('7.1 Opportunity matching never mutates candidate trust score or verification records', () => {
      const originalPassport: any = {
        id: 'usr_trust_test',
        userId: 'usr_trust_test',
        identityVerified: true,
        trustScore: 70,
        trustTier: 'Verified Pro',
        skills: [
          { id: 's1', name: 'TypeScript', verifiedCount: 3, category: 'engineering', proficiency: 'expert' },
        ],
        projects: [
          {
            id: 'p1',
            title: 'DeFi Bridge',
            verificationStatus: 'verified',
            deliverables: [{ title: 'GitHub', url: 'https://github.com/defi/bridge', type: 'github' }],
            role: 'Lead',
            skillsUsed: ['TypeScript'],
          },
        ],
      };

      // Deep clone before match
      const cloneBefore = JSON.parse(JSON.stringify(originalPassport));

      // Calculate score across 5 different opportunities
      const opp1 = { ...sampleOpportunity };
      const opp2 = { ...sampleOpportunity, requiredSkills: ['Photoshop'], recommendedTrustTier: 'Elite' };
      const opp3 = { ...sampleOpportunity, requiredSkills: ['Solidity'], experienceLevel: 'entry' as const };

      calculateOpportunityMatch(opp1, originalPassport as any);
      calculateOpportunityMatch(opp2, originalPassport as any);
      calculateOpportunityMatch(opp3, originalPassport as any);

      // Verify original passport is 100% byte-for-byte identical
      assert.deepStrictEqual(originalPassport, cloneBefore);
      assert.strictEqual(originalPassport.trustScore, 70);
      assert.strictEqual(originalPassport.trustTier, 'Verified Pro');
      assert.strictEqual(originalPassport.identityVerified, true);
    });
  });

  // =========================================================================
  // 8. BATCH SORTING & MIN-MATCH FILTERING
  // =========================================================================
  describe('8. Batch Sorting & Filtering Functions', () => {
    it('8.1 sortOpportunitiesByMatch orders opportunities in strict descending order of fit', () => {
      const oppHigh: Opportunity = {
        ...sampleOpportunity,
        id: 'opp_high',
        requiredSkills: ['TypeScript'],
        recommendedTrustTier: 'Basic Verified',
        experienceLevel: 'intermediate',
      };

      const oppLow: Opportunity = {
        ...sampleOpportunity,
        id: 'opp_low',
        requiredSkills: ['Solidity', 'Vyper', 'Rust', 'Substrate'],
        recommendedTrustTier: 'Elite',
        experienceLevel: 'expert',
      };

      const candidate: CandidateMatchProfile = {
        skills: [
          { id: 's1', name: 'TypeScript', verifiedCount: 3, category: 'engineering', proficiency: 'expert' },
        ],
        trustTier: 'Basic Verified',
        experienceLevel: 'intermediate',
      };

      const sorted = sortOpportunitiesByMatch([oppLow, oppHigh], candidate);

      assert.strictEqual(sorted.length, 2);
      assert.strictEqual(sorted[0].opportunity.id, 'opp_high');
      assert.strictEqual(sorted[1].opportunity.id, 'opp_low');
      assert.strictEqual(sorted[0].match.matchPercentage > sorted[1].match.matchPercentage, true);
    });

    it('8.2 filterOpportunitiesByMinMatch filters out opportunities below threshold', () => {
      const oppHigh: Opportunity = {
        ...sampleOpportunity,
        id: 'opp_high',
        requiredSkills: ['TypeScript'],
        recommendedTrustTier: 'Basic Verified',
        experienceLevel: 'intermediate',
      };

      const oppLow: Opportunity = {
        ...sampleOpportunity,
        id: 'opp_low',
        requiredSkills: ['Solidity', 'Vyper', 'Rust', 'Substrate'],
        recommendedTrustTier: 'Elite',
        experienceLevel: 'expert',
      };

      const candidate: CandidateMatchProfile = {
        skills: [
          { id: 's1', name: 'TypeScript', verifiedCount: 3, category: 'engineering', proficiency: 'expert' },
        ],
        trustTier: 'Basic Verified',
        experienceLevel: 'intermediate',
      };

      const filtered = filterOpportunitiesByMinMatch([oppLow, oppHigh], candidate, 70);

      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].opportunity.id, 'opp_high');
    });
  });

  // =========================================================================
  // 9. SECURITY RULES CHECKSUM PRESERVATION INVARIANT
  // =========================================================================
  describe('9. Security Rules Checksum Invariant', () => {
    it('9.1 firestore.rules must have exact checksum 667e03431c26c17293ad78bff2c87a385e093fe3b6c902bd0d57f529a43500ce', () => {
      const EXPECTED_CHECKSUM = '667e03431c26c17293ad78bff2c87a385e093fe3b6c902bd0d57f529a43500ce';
      const fileContent = fs.readFileSync('firestore.rules', 'utf8');
      const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
      assert.strictEqual(
        hash,
        EXPECTED_CHECKSUM,
        `firestore.rules checksum modified! Expected ${EXPECTED_CHECKSUM} but got ${hash}`
      );
    });
  });
});
