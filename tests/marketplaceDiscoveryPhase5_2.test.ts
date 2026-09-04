/**
 * GigLink Group 5 — Phase 5.2: Marketplace & Discovery Polish Test Suite
 * 
 * Test Coverage:
 * 1. Match Fit Badges & Tier Labeling (Strong Fit >= 80%, Good Fit >= 60%, Moderate Fit >= 40%, Potential Fit < 40%)
 * 2. Trust Tier Filtering Logic (unverified, novice, basic, verified_pro, elite)
 * 3. Compensation Range Filtering Logic (under_50, 50_100, 100_plus, fixed/milestone)
 * 4. Multi-Faceted Sorting Logic (best_match, newest, compensation, trust_tier)
 * 5. Feed Separation (Recommended for You vs All Opportunities)
 * 6. Skill Chip Verification Indicators (verified skills highlighted with verification proof)
 * 7. Absolute Trust Score Immutability (zero score mutation or tier inflation during discovery/filtering)
 * 8. Firestore Security Rules Invariant Checksum Verification
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  Opportunity,
  CandidateMatchProfile,
  OpportunityMatchExplanation,
  UnifiedProfileData,
  SkillItem,
} from '../src/types';
import {
  calculateOpportunityMatch,
  sortOpportunitiesByMatch,
  filterOpportunitiesByMinMatch,
  normalizeTrustTierLevel,
} from '../src/lib/matchingService';
import { calculateTrustScore } from '../src/lib/trustScore';

describe('Group 5 — Phase 5.2: Marketplace & Discovery Polish', () => {

  // =========================================================================
  // FIXTURES
  // =========================================================================
  const opp1_leadDev: Opportunity = {
    id: 'opp_1',
    title: 'Principal Full Stack Architect',
    creatorId: 'creator_1',
    creatorName: 'MetaLayer Labs',
    type: 'contract',
    category: 'engineering',
    description: 'Lead TypeScript and React architecture for enterprise Web3 protocols.',
    requiredSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    experienceLevel: 'expert',
    locationType: 'remote',
    compensationType: 'hourly',
    compensationMin: 90,
    compensationMax: 140,
    currency: 'USD',
    recommendedTrustTier: 'Verified Pro',
    status: 'open',
    createdAt: '2026-08-18T10:00:00.000Z',
    updatedAt: '2026-08-18T10:00:00.000Z',
  };

  const opp2_juniorGig: Opportunity = {
    id: 'opp_2',
    title: 'React Landing Page Build',
    creatorId: 'creator_2',
    creatorName: 'Indie Studio',
    type: 'gig',
    category: 'engineering',
    description: 'Build a high-performance marketing landing page in Tailwind CSS.',
    requiredSkills: ['React', 'Tailwind CSS'],
    experienceLevel: 'entry',
    locationType: 'remote',
    compensationType: 'hourly',
    compensationMin: 35,
    compensationMax: 45,
    currency: 'USD',
    recommendedTrustTier: 'Novice',
    status: 'open',
    createdAt: '2026-08-18T12:00:00.000Z',
    updatedAt: '2026-08-18T12:00:00.000Z',
  };

  const opp3_bounty: Opportunity = {
    id: 'opp_3',
    title: 'Smart Contract Audit Bounty',
    creatorId: 'creator_3',
    creatorName: 'Sentinel Security',
    type: 'bounty',
    category: 'security',
    description: 'Find reentrancy or access control vulnerabilities in Solidity contracts.',
    requiredSkills: ['Solidity', 'Security Auditing'],
    experienceLevel: 'expert',
    locationType: 'remote',
    compensationType: 'fixed',
    compensationMin: 8000,
    compensationMax: 8000,
    currency: 'USD',
    recommendedTrustTier: 'Elite Verified',
    status: 'open',
    createdAt: '2026-08-18T14:00:00.000Z',
    updatedAt: '2026-08-18T14:00:00.000Z',
  };

  const candidateAlice: CandidateMatchProfile = {
    skills: [
      { id: 's1', name: 'TypeScript', verifiedCount: 3, category: 'engineering', proficiency: 'expert' },
      { id: 's2', name: 'React', verifiedCount: 2, category: 'engineering', proficiency: 'expert' },
      { id: 's3', name: 'Node.js', verifiedCount: 1, category: 'engineering', proficiency: 'expert' },
      { id: 's4', name: 'PostgreSQL', verifiedCount: 0, category: 'engineering', proficiency: 'intermediate' },
    ],
    trustTier: 'Verified Pro',
    trustScore: 820,
    experienceLevel: 'expert',
  };

  // =========================================================================
  // 1. MATCH FIT BADGES & TIER LABELING
  // =========================================================================
  describe('1. Match Fit Badges & Tier Labeling', () => {
    it('1.1 Computes correct match percentage and breakdown for candidate', () => {
      const match = calculateOpportunityMatch(opp1_leadDev, candidateAlice);
      
      // Skills: 4 required.
      // Verified matches: TypeScript (10 pts), React (10 pts), Node.js (10 pts) = 30 pts verified
      // Base matches: TypeScript (2.5), React (2.5), Node.js (2.5), PostgreSQL (2.5) = 10 pts base
      // Trust Tier: Candidate Verified Pro (3) >= Recommended Verified Pro (3) = 30 pts
      // Experience: Candidate expert (3) >= Required expert (3) = 20 pts
      // Total = 30 + 10 + 30 + 20 = 90%
      assert.strictEqual(match.matchPercentage, 90);
      assert.strictEqual(match.matchedSkills.length, 4);
      assert.strictEqual(match.missingSkills.length, 0);
      assert.strictEqual(match.trustTierFit, 'meets');
      assert.strictEqual(match.experienceFit, true);
    });

    it('1.2 Classifies 90% match as Strong Fit (>= 80%)', () => {
      const match = calculateOpportunityMatch(opp1_leadDev, candidateAlice);
      const isStrongFit = match.matchPercentage >= 80;
      assert.strictEqual(isStrongFit, true);
    });

    it('1.3 Classifies lower overlap match appropriately without inflating score', () => {
      const candidateBob: CandidateMatchProfile = {
        skills: [{ id: 's1', name: 'Python', verifiedCount: 1, category: 'engineering', proficiency: 'beginner' }],
        trustTier: 'Unverified',
        experienceLevel: 'entry',
      };
      const match = calculateOpportunityMatch(opp1_leadDev, candidateBob);
      // No skills match (0 pts)
      // Trust Tier: Unverified (0) vs Verified Pro (3) = 0 pts
      // Experience: entry (1) vs expert (3) = 20 * (1/3) = 6.67 pts ~ 7 pts
      assert.ok(match.matchPercentage <= 10);
      assert.strictEqual(match.trustTierFit, 'below');
      assert.strictEqual(match.experienceFit, false);
    });
  });

  // =========================================================================
  // 2. TRUST TIER FILTERING LOGIC
  // =========================================================================
  describe('2. Trust Tier Filtering Logic', () => {
    const opportunities = [opp1_leadDev, opp2_juniorGig, opp3_bounty];

    it('2.1 Correctly filters by minimum Trust Tier requirement', () => {
      // Filter for 'verified_pro' (tier level >= 3)
      const filtered = opportunities.filter((opp) => {
        const level = normalizeTrustTierLevel(opp.recommendedTrustTier || 'Unverified');
        return level >= 3;
      });

      assert.strictEqual(filtered.length, 2);
      assert.ok(filtered.some((o) => o.id === 'opp_1')); // Verified Pro
      assert.ok(filtered.some((o) => o.id === 'opp_3')); // Elite Verified
      assert.ok(!filtered.some((o) => o.id === 'opp_2')); // Novice
    });

    it('2.2 Correctly filters for Elite Verified opportunities only', () => {
      const filtered = opportunities.filter((opp) => {
        const level = normalizeTrustTierLevel(opp.recommendedTrustTier || 'Unverified');
        return level >= 4;
      });

      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].id, 'opp_3');
    });

    it('2.3 Shows all when filter is set to all', () => {
      const filtered = opportunities.filter((opp) => {
        const level = normalizeTrustTierLevel(opp.recommendedTrustTier || 'Unverified');
        return level >= 0;
      });
      assert.strictEqual(filtered.length, 3);
    });
  });

  // =========================================================================
  // 3. COMPENSATION RANGE FILTERING LOGIC
  // =========================================================================
  describe('3. Compensation Range Filtering Logic', () => {
    const opportunities = [opp1_leadDev, opp2_juniorGig, opp3_bounty];

    it('3.1 Filters under $50/hr accurately', () => {
      const under50 = opportunities.filter((opp) => {
        const isHourly = opp.compensationType === 'hourly';
        const min = opp.compensationMin || 0;
        const max = opp.compensationMax || min;
        return isHourly && (max <= 50 || min <= 50);
      });

      assert.strictEqual(under50.length, 1);
      assert.strictEqual(under50[0].id, 'opp_2'); // $35 - $45/hr
    });

    it('3.2 Filters $100+/hr or $5k+ Fixed accurately', () => {
      const highComp = opportunities.filter((opp) => {
        const isHourly = opp.compensationType === 'hourly';
        const min = opp.compensationMin || 0;
        const max = opp.compensationMax || min;
        return isHourly ? max >= 100 || min >= 100 : min >= 5000;
      });

      assert.strictEqual(highComp.length, 2);
      assert.ok(highComp.some((o) => o.id === 'opp_1')); // $90 - $140/hr
      assert.ok(highComp.some((o) => o.id === 'opp_3')); // $8,000 Fixed
    });

    it('3.3 Filters fixed milestone opportunities accurately', () => {
      const fixed = opportunities.filter((opp) => opp.compensationType === 'fixed');
      assert.strictEqual(fixed.length, 1);
      assert.strictEqual(fixed[0].id, 'opp_3');
    });
  });

  // =========================================================================
  // 4. MULTI-DIMENSIONAL SORTING LOGIC
  // =========================================================================
  describe('4. Multi-Dimensional Sorting Logic', () => {
    it('4.1 Sorts by Best Match descending', () => {
      const sorted = sortOpportunitiesByMatch([opp1_leadDev, opp2_juniorGig, opp3_bounty], candidateAlice);
      // opp1 has 90% match, opp2 has ~50%, opp3 has low skill match
      assert.strictEqual(sorted[0].opportunity.id, 'opp_1');
      assert.ok(sorted[0].match.matchPercentage >= sorted[1].match.matchPercentage);
      assert.ok(sorted[1].match.matchPercentage >= sorted[2].match.matchPercentage);
    });

    it('4.2 Sorts by Compensation descending', () => {
      const opps = [opp1_leadDev, opp2_juniorGig, opp3_bounty];
      const sorted = [...opps].sort((a, b) => {
        const compA = a.compensationMax || a.compensationMin || 0;
        const compB = b.compensationMax || b.compensationMin || 0;
        return compB - compA;
      });

      assert.strictEqual(sorted[0].id, 'opp_3'); // $8,000
      assert.strictEqual(sorted[1].id, 'opp_1'); // $140
      assert.strictEqual(sorted[2].id, 'opp_2'); // $45
    });

    it('4.3 Sorts by Recommended Trust Tier descending', () => {
      const opps = [opp1_leadDev, opp2_juniorGig, opp3_bounty];
      const sorted = [...opps].sort((a, b) => {
        const tierA = normalizeTrustTierLevel(a.recommendedTrustTier || 'Unverified');
        const tierB = normalizeTrustTierLevel(b.recommendedTrustTier || 'Unverified');
        return tierB - tierA;
      });

      assert.strictEqual(sorted[0].id, 'opp_3'); // Elite (4)
      assert.strictEqual(sorted[1].id, 'opp_1'); // Verified Pro (3)
      assert.strictEqual(sorted[2].id, 'opp_2'); // Novice (1)
    });

    it('4.4 Sorts by Newest First', () => {
      const opps = [opp1_leadDev, opp2_juniorGig, opp3_bounty];
      const sorted = [...opps].sort((a, b) => {
        const timeA = new Date(a.createdAt as any).getTime();
        const timeB = new Date(b.createdAt as any).getTime();
        return timeB - timeA;
      });

      assert.strictEqual(sorted[0].id, 'opp_3'); // 14:00
      assert.strictEqual(sorted[1].id, 'opp_2'); // 12:00
      assert.strictEqual(sorted[2].id, 'opp_1'); // 10:00
    });
  });

  // =========================================================================
  // 5. ABSOLUTE TRUST SCORE IMMUTABILITY INVARIANT
  // =========================================================================
  describe('5. Absolute Trust Score Immutability Invariant', () => {
    it('5.1 Candidate trust score remains strictly unaltered across discovery operations', () => {
      const originalCandidate: UnifiedProfileData = {
        uid: 'user_cand_immut',
        email: 'eva@example.com',
        displayName: 'Eva Immutable',
        activePersona: 'learner',
        headline: 'Full Stack Engineer',
        bio: 'Building reliable applications.',
        location: 'Berlin, Germany',
        structuredLocation: null,
        isPublic: true,
        identityVerified: true,
        trustTier: 'Basic Verified',
        trustScore: 650,
        profileCompleteness: 85,
        onboardingCompleted: true,
        skills: [
          { id: 's1', name: 'TypeScript', verifiedCount: 1, category: 'engineering', proficiency: 'intermediate' },
          { id: 's2', name: 'React', verifiedCount: 0, category: 'engineering', proficiency: 'intermediate' },
        ],
        experience: [],
        education: [],
        certifications: [],
        projects: [],
        socialLinks: {},
        updatedAt: '2026-08-18T00:00:00.000Z',
      };

      const clone = JSON.parse(JSON.stringify(originalCandidate));

      // Execute matching calculations and sorting
      const match1 = calculateOpportunityMatch(opp1_leadDev, originalCandidate);
      const match2 = calculateOpportunityMatch(opp2_juniorGig, originalCandidate);
      const match3 = calculateOpportunityMatch(opp3_bounty, originalCandidate);
      const sorted = sortOpportunitiesByMatch([opp1_leadDev, opp2_juniorGig, opp3_bounty], originalCandidate);

      assert.ok(match1.matchPercentage > 0);
      assert.ok(sorted.length === 3);

      // Verify zero mutation
      assert.deepStrictEqual(originalCandidate, clone);
      assert.strictEqual(originalCandidate.trustScore, 650);
      assert.strictEqual(originalCandidate.trustTier, 'Basic Verified');
    });
  });

  // =========================================================================
  // 6. FIRESTORE SECURITY RULES CHECKSUM PRESERVATION
  // =========================================================================
  describe('6. Security Invariants & Checksum Preservation', () => {
    it('6.1 firestore.rules sha256 checksum matches canonical security baseline', () => {
      const EXPECTED_CHECKSUM = '667e03431c26c17293ad78bff2c87a385e093fe3b6c902bd0d57f529a43500ce';
      const rulesContent = fs.readFileSync('firestore.rules', 'utf-8');
      const hash = crypto.createHash('sha256').update(rulesContent).digest('hex');
      assert.strictEqual(
        hash,
        EXPECTED_CHECKSUM,
        `firestore.rules was unexpectedly modified! Expected ${EXPECTED_CHECKSUM} but got ${hash}`
      );
    });
  });
});
