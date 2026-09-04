/**
 * GigLink Explainable Opportunity Matching Engine (Phase 5.1)
 * 
 * Core Architectural Principles:
 * 1. Deterministic & Transparent: Exactly reproducible results without opaque AI models or random variations.
 * 2. Merit & Verification First: Third-party verified skills and proofs always outweigh self-declared claims.
 * 3. Trust Score Immutability: Matching calculations read candidate data but NEVER mutate, inflate, or alter
 *    underlying Trust Scores, Trust Tiers, or verification statuses.
 * 4. Human-Readable Explainability: Every match score is accompanied by a structured breakdown and plain-language
 *    explanation detailing matched verified skills, matched self-declared skills, missing skills, and tier alignment.
 * 
 * Locked Scoring Weights (Max 100 Points Total):
 * - Verified Skill Overlap: 40 points (Max)
 * - Self-Declared Skill Overlap: 10 points (Max)
 * - Trust Tier Suitability: 30 points (Max)
 * - Experience / Role Alignment: 20 points (Max)
 */

import {
  Opportunity,
  OpportunityMatchExplanation,
  MatchedSkillItem,
  OpportunityMatchBreakdown,
  UnifiedProfileData,
  UserProfile,
  TrustPassport,
  PublicTrustPassport,
  SkillItem,
  CandidateMatchProfile,
} from '../types';

export type { CandidateMatchProfile };

/**
 * Normalized Trust Tier numeric rank (0 to 4)
 */
export const TRUST_TIER_HIERARCHY: Record<string, number> = {
  unverified: 0,
  none: 0,
  novice: 1,
  basic: 2,
  'basic verified': 2,
  emerging: 2,
  'verified pro': 3,
  silver: 3,
  'silver verified': 3,
  gold: 3,
  'gold verified': 3,
  expert: 4,
  elite: 4,
  'elite verified': 4,
};

/**
 * Normalized Experience Level numeric rank (1 to 3)
 */
export const EXPERIENCE_LEVEL_HIERARCHY: Record<string, number> = {
  entry: 1,
  junior: 1,
  intermediate: 2,
  mid: 2,
  senior: 3,
  expert: 3,
  all_levels: 0,
};

/**
 * Helper to normalize Trust Tier strings to a standard numeric hierarchy level (0 - 4).
 */
export function normalizeTrustTierLevel(tier?: string | null): number {
  if (!tier) return 0;
  const key = tier.trim().toLowerCase();
  return TRUST_TIER_HIERARCHY[key] ?? 0;
}

/**
 * Helper to normalize Experience Level strings to a standard numeric level (1 - 3, or 0 for all_levels).
 */
export function normalizeExperienceLevel(level?: string | null): number {
  if (!level) return 1;
  const key = level.trim().toLowerCase();
  return EXPERIENCE_LEVEL_HIERARCHY[key] ?? 1;
}

/**
 * Extracts and normalizes candidate skills into a lookup map with verification status.
 */
function extractCandidateSkillMap(
  candidate?: CandidateMatchProfile | UnifiedProfileData | UserProfile | TrustPassport | PublicTrustPassport | null
): Map<string, { originalName: string; isVerified: boolean }> {
  const skillMap = new Map<string, { originalName: string; isVerified: boolean }>();
  if (!candidate) return skillMap;

  const rawSkills: any[] = (candidate as any).skills || [];

  for (const item of rawSkills) {
    if (!item) continue;

    if (typeof item === 'string') {
      const normalized = item.trim().toLowerCase();
      if (normalized && !skillMap.has(normalized)) {
        skillMap.set(normalized, { originalName: item.trim(), isVerified: false });
      }
    } else if (typeof item === 'object') {
      const name = (item.name || '').trim();
      const normalized = name.toLowerCase();
      if (!normalized) continue;

      const isVerified = Boolean(
        (typeof item.verifiedCount === 'number' && item.verifiedCount > 0) ||
        item.verified === true ||
        item.verificationStatus === 'verified'
      );

      // If already recorded, verified flag takes precedence
      const existing = skillMap.get(normalized);
      if (!existing || (!existing.isVerified && isVerified)) {
        skillMap.set(normalized, { originalName: name, isVerified });
      }
    }
  }

  return skillMap;
}

/**
 * Derives the candidate's experience level (entry, intermediate, expert) from candidate records.
 */
function deriveCandidateExperienceLevel(
  candidate?: CandidateMatchProfile | UnifiedProfileData | UserProfile | TrustPassport | PublicTrustPassport | null
): 'entry' | 'intermediate' | 'expert' {
  if (!candidate) return 'entry';

  // 1. Explicit experienceLevel on candidate if present
  if ((candidate as any).experienceLevel) {
    const raw = String((candidate as any).experienceLevel).toLowerCase();
    if (raw === 'expert' || raw === 'senior') return 'expert';
    if (raw === 'intermediate' || raw === 'mid') return 'intermediate';
    return 'entry';
  }

  // 2. Count experience records, verified projects, and credentials
  let expCount = 0;
  if (typeof (candidate as any).experienceCount === 'number') {
    expCount += (candidate as any).experienceCount;
  }
  if (Array.isArray((candidate as any).experience)) {
    expCount += (candidate as any).experience.length;
  }
  if (Array.isArray((candidate as any).workExperience)) {
    expCount += (candidate as any).workExperience.length;
  }

  let verifiedProjects = 0;
  if (typeof (candidate as any).verifiedProjectsCount === 'number') {
    verifiedProjects += (candidate as any).verifiedProjectsCount;
  }
  if (Array.isArray((candidate as any).projects)) {
    verifiedProjects += (candidate as any).projects.filter(
      (p: any) => p && (p.verificationStatus === 'verified' || p.verified === true)
    ).length;
  }
  if (Array.isArray((candidate as any).publishedProjects)) {
    verifiedProjects += (candidate as any).publishedProjects.length;
  }

  if (expCount >= 3 || verifiedProjects >= 3) {
    return 'expert';
  }
  if (expCount >= 1 || verifiedProjects >= 1) {
    return 'intermediate';
  }

  return 'entry';
}

/**
 * Core Deterministic Matching Function
 * 
 * Computes an explainable match between an Opportunity and a Candidate.
 * The calculation is strictly read-only and will never alter candidate profile records.
 */
export function calculateOpportunityMatch(
  opportunity: Partial<Opportunity> | null | undefined,
  candidate: CandidateMatchProfile | UnifiedProfileData | UserProfile | TrustPassport | PublicTrustPassport | null | undefined
): OpportunityMatchExplanation {
  // Safe Fallback for Empty Opportunity
  if (!opportunity) {
    return {
      matchPercentage: 0,
      matchedSkills: [],
      missingSkills: [],
      trustTierFit: 'below',
      experienceFit: false,
      explanation: 'No opportunity data provided for evaluation.',
      summary: 'No opportunity data provided.',
      breakdown: {
        verifiedSkillPoints: 0,
        selfDeclaredSkillPoints: 0,
        trustTierPoints: 0,
        experiencePoints: 0,
        totalScore: 0,
      },
    };
  }

  // =========================================================================
  // 1. SKILL OVERLAP SCORING (Max 50 pts: 40 Verified, 10 Self-Declared)
  // =========================================================================
  const candidateSkillMap = extractCandidateSkillMap(candidate);
  const requiredSkills = (opportunity.requiredSkills || [])
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0);

  const matchedSkills: MatchedSkillItem[] = [];
  const missingSkills: string[] = [];
  let verifiedMatchesCount = 0;
  let selfDeclaredMatchesCount = 0;

  if (requiredSkills.length === 0) {
    // If the opportunity requires 0 specific skills (open to all skillsets), award full baseline skill points
    verifiedMatchesCount = 0;
    selfDeclaredMatchesCount = 0;
  } else {
    for (const reqSkill of requiredSkills) {
      const normalizedReq = reqSkill.toLowerCase();
      const match = candidateSkillMap.get(normalizedReq);

      if (match) {
        if (match.isVerified) {
          verifiedMatchesCount++;
          matchedSkills.push({ name: match.originalName || reqSkill, verified: true });
        } else {
          selfDeclaredMatchesCount++;
          matchedSkills.push({ name: match.originalName || reqSkill, verified: false });
        }
      } else {
        missingSkills.push(reqSkill);
      }
    }
  }

  let verifiedSkillPoints = 0;
  let selfDeclaredSkillPoints = 0;

  if (requiredSkills.length === 0) {
    verifiedSkillPoints = 40;
    selfDeclaredSkillPoints = 10;
  } else {
    // Deterministic linear point allocation:
    // Verified match weight = 40 / total_required_skills
    // Base skill match weight = 10 / total_required_skills (awarded for all matched skills, verified or self-declared)
    const totalMatchedCount = verifiedMatchesCount + selfDeclaredMatchesCount;
    verifiedSkillPoints = Math.round((verifiedMatchesCount / requiredSkills.length) * 40);
    selfDeclaredSkillPoints = Math.round((totalMatchedCount / requiredSkills.length) * 10);
  }

  // =========================================================================
  // 2. TRUST TIER SUITABILITY SCORING (Max 30 pts)
  // =========================================================================
  const candidateTierString = (candidate as any)?.trustTier || 'Unverified';
  const candidateTierLevel = normalizeTrustTierLevel(candidateTierString);

  const oppRecommendedTierString = opportunity.recommendedTrustTier || 'Unverified';
  const oppTierLevel = normalizeTrustTierLevel(oppRecommendedTierString);

  let trustTierFit: 'exceeds' | 'meets' | 'below' = 'meets';
  let trustTierPoints = 0;

  if (oppTierLevel === 0) {
    // Opportunity has no minimum recommended trust tier
    trustTierFit = candidateTierLevel > 0 ? 'exceeds' : 'meets';
    trustTierPoints = 30;
  } else if (candidateTierLevel > oppTierLevel) {
    trustTierFit = 'exceeds';
    trustTierPoints = 30;
  } else if (candidateTierLevel === oppTierLevel) {
    trustTierFit = 'meets';
    trustTierPoints = 30;
  } else {
    trustTierFit = 'below';
    const tierDiff = oppTierLevel - candidateTierLevel;
    if (tierDiff === 1) {
      // 1 tier below: award 50% partial credit (15 pts)
      trustTierPoints = 15;
    } else {
      // 2 or more tiers below: 0 pts
      trustTierPoints = 0;
    }
  }

  // =========================================================================
  // 3. EXPERIENCE / ROLE ALIGNMENT SCORING (Max 20 pts)
  // =========================================================================
  const oppExpRequirement = opportunity.experienceLevel || 'all_levels';
  const oppExpLevel = normalizeExperienceLevel(oppExpRequirement);
  const candidateExp = deriveCandidateExperienceLevel(candidate);
  const candidateExpLevel = normalizeExperienceLevel(candidateExp);

  let experienceFit = true;
  let experiencePoints = 20;

  if (oppExpRequirement === 'all_levels' || oppExpLevel === 0) {
    experienceFit = true;
    experiencePoints = 20;
  } else if (candidateExpLevel >= oppExpLevel) {
    experienceFit = true;
    experiencePoints = 20;
  } else {
    experienceFit = false;
    const expDiff = oppExpLevel - candidateExpLevel;
    if (expDiff === 1) {
      // 1 level below (e.g. entry candidate applying for intermediate): 10 pts partial
      experiencePoints = 10;
    } else {
      // 2 levels below (e.g. entry candidate applying for expert): 0 pts
      experiencePoints = 0;
    }
  }

  // =========================================================================
  // 4. TOTAL SCORE CALCULATION & BOUNDARY CLAMP (0 - 100)
  // =========================================================================
  const rawTotal = verifiedSkillPoints + selfDeclaredSkillPoints + trustTierPoints + experiencePoints;
  const totalScore = Math.min(100, Math.max(0, rawTotal));
  const matchPercentage = totalScore;

  // =========================================================================
  // 5. HUMAN-READABLE EXPLANATION & SUMMARY SYNTHESIS
  // =========================================================================
  const explanationParts: string[] = [];

  // Skill explanation
  if (requiredSkills.length === 0) {
    explanationParts.push('Open skill requirements: your general profile fits this listing.');
  } else if (matchedSkills.length === 0) {
    explanationParts.push(
      `No required skills matched. Missing: ${missingSkills.slice(0, 3).join(', ')}${
        missingSkills.length > 3 ? ` (+${missingSkills.length - 3} more)` : ''
      }.`
    );
  } else {
    const verifiedText = verifiedMatchesCount > 0 ? `${verifiedMatchesCount} verified` : '';
    const selfText = selfDeclaredMatchesCount > 0 ? `${selfDeclaredMatchesCount} self-declared` : '';
    const overlapDesc = [verifiedText, selfText].filter(Boolean).join(', ');

    explanationParts.push(
      `${matchedSkills.length}/${requiredSkills.length} required skills matched (${overlapDesc}).`
    );

    if (missingSkills.length > 0) {
      explanationParts.push(
        `Missing: ${missingSkills.slice(0, 2).join(', ')}${missingSkills.length > 2 ? ` (+${missingSkills.length - 2} more)` : ''}.`
      );
    }
  }

  // Trust tier explanation
  if (trustTierFit === 'exceeds') {
    explanationParts.push(`Your Trust Tier (${candidateTierString}) exceeds the recommended ${oppRecommendedTierString}.`);
  } else if (trustTierFit === 'meets') {
    explanationParts.push(`Your Trust Tier (${candidateTierString}) meets the recommended requirement.`);
  } else {
    explanationParts.push(
      `Your Trust Tier (${candidateTierString}) is below the recommended ${oppRecommendedTierString}.`
    );
  }

  // Experience explanation
  if (experienceFit) {
    if (oppExpRequirement !== 'all_levels') {
      explanationParts.push(`Experience level aligns with the ${oppExpRequirement} requirement.`);
    }
  } else {
    explanationParts.push(`Opportunity seeks a ${oppExpRequirement}-level contributor.`);
  }

  // Classification summary label
  let fitCategory = 'Low Fit';
  if (matchPercentage >= 80) {
    fitCategory = 'Strong Fit';
  } else if (matchPercentage >= 60) {
    fitCategory = 'Good Fit';
  } else if (matchPercentage >= 40) {
    fitCategory = 'Moderate Fit';
  }

  const summary = `${fitCategory} (${matchPercentage}%): ${explanationParts.join(' ')}`;
  const explanation = explanationParts.join(' ');

  const breakdown: OpportunityMatchBreakdown = {
    verifiedSkillPoints,
    selfDeclaredSkillPoints,
    trustTierPoints,
    experiencePoints,
    totalScore,
  };

  return {
    matchPercentage,
    matchedSkills,
    missingSkills,
    trustTierFit,
    experienceFit,
    explanation,
    summary,
    breakdown,
  };
}

/**
 * Sorts an array of opportunities by match percentage in descending order.
 */
export function sortOpportunitiesByMatch(
  opportunities: Opportunity[],
  candidate: CandidateMatchProfile | UnifiedProfileData | UserProfile | TrustPassport | PublicTrustPassport | null | undefined
): Array<{ opportunity: Opportunity; match: OpportunityMatchExplanation }> {
  const scored = opportunities.map((opp) => ({
    opportunity: opp,
    match: calculateOpportunityMatch(opp, candidate),
  }));

  return scored.sort((a, b) => b.match.matchPercentage - a.match.matchPercentage);
}

/**
 * Filters opportunities that meet a minimum match percentage threshold.
 */
export function filterOpportunitiesByMinMatch(
  opportunities: Opportunity[],
  candidate: CandidateMatchProfile | UnifiedProfileData | UserProfile | TrustPassport | PublicTrustPassport | null | undefined,
  minMatchPercentage: number = 50
): Array<{ opportunity: Opportunity; match: OpportunityMatchExplanation }> {
  const sorted = sortOpportunitiesByMatch(opportunities, candidate);
  return sorted.filter((item) => item.match.matchPercentage >= minMatchPercentage);
}
