/**
 * GigLink Trust Score & Profile Completeness Calculation Engine (V1)
 * 
 * Core Architectural Principle:
 * - Profile Completeness != Trust Score
 * - Completeness measures data input (0 - 100%)
 * - Trust Score measures earned, verifiable credibility (0 - 100 pts)
 * 
 * Exact Point Allocations (Max 100 pts):
 * 1. Verified Identity: 40 pts (Admin/Official ID approval)
 * 2. Verified Proof of Work: 30 pts (10 pts per verified project/contract milestone, max 3)
 * 3. Verified Skills & Endorsements: 20 pts (5 pts per verified skill or client endorsement, max 4)
 * 4. Profile Hygiene Base: 10 pts (100% Profile Completeness + Verified Email)
 */

import { TrustPassport, UserProfile } from '../types';

export interface TrustScoreBreakdown {
  totalScore: number;
  tier: 'Unverified' | 'Novice' | 'Emerging' | 'Verified Pro' | 'Elite';
  tierColor: string;
  identityPoints: number; // Max 40
  proofOfWorkPoints: number; // Max 30
  skillsPoints: number; // Max 20
  profileHygienePoints: number; // Max 10
  profileCompletenessPercentage: number; // 0 - 100%
  isIdentityVerified: boolean;
  isEmailVerified: boolean;
  verifiedProjectsCount: number;
  verifiedSkillsCount: number;
  actionableInsights: {
    title: string;
    points: number;
    category: 'identity' | 'work' | 'skills' | 'hygiene';
    description: string;
  }[];
}

/**
 * Calculates Profile Completeness percentage (0 to 100%)
 * Measures form filling and onboarding progress only.
 */
export function calculateProfileCompleteness(
  profile: Partial<UserProfile> | null,
  passport: Partial<TrustPassport> | null
): number {
  let score = 0;

  // 1. Display Name (25%)
  if (profile?.displayName && profile.displayName.trim().length >= 2) {
    score += 25;
  }

  // 2. Headline (25%) (Dual-read: Passport > Profile)
  const headline = passport?.headline || profile?.headline;
  if (headline && headline.trim().length >= 5) {
    score += 25;
  }

  // 3. Professional Bio (25%) (Dual-read: Passport > Profile)
  const bio = passport?.bio || profile?.bio;
  if (bio && bio.trim().length >= 30) {
    score += 25;
  }

  // 4. Location & Skills (25%) (Dual-read: Passport > Profile)
  const hasLocation = Boolean(
    (passport?.structuredLocation?.country && passport?.structuredLocation?.state) ||
    (passport?.location && passport.location.trim().length > 0) ||
    (profile?.structuredLocation?.country && profile?.structuredLocation?.state) ||
    (profile?.location && profile.location.trim().length > 0)
  );
  const hasSkills = Boolean(
    (passport?.skills && passport.skills.length >= 1) ||
    (profile?.skills && profile.skills.length >= 1)
  );

  if (hasLocation && hasSkills) {
    score += 25;
  } else if (hasLocation || hasSkills) {
    score += 15;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Deterministic Trust Score Calculator
 * 
 * Formula:
 * Trust Score = Identity (40) + Proof of Work (30) + Skills/Endorsements (20) + Hygiene (10)
 */
export function calculateTrustScore(
  passport: Partial<TrustPassport> | null,
  profile: Partial<UserProfile> | null,
  emailVerified: boolean = false
): TrustScoreBreakdown {
  const profileCompleteness = calculateProfileCompleteness(profile, passport);

  // 1. Identity Points (0 or 40)
  const isIdentityVerified = Boolean(passport?.identityVerified);
  const identityPoints = isIdentityVerified ? 40 : 0;

  // 2. Verified Proof of Work (10 pts per verified project proof, max 30)
  const verifiedProjects = (passport?.projects || []).filter(
    (p) => p.verificationStatus === 'verified'
  );
  const verifiedProjectsCount = verifiedProjects.length;
  const proofOfWorkPoints = Math.min(30, verifiedProjectsCount * 10);

  // 3. Verified Skills & Endorsements (5 pts per verified skill, max 20)
  const verifiedSkills = (passport?.skills || []).filter(
    (s) => (s.verifiedCount && s.verifiedCount > 0) || (s as any).verified === true
  );
  const verifiedSkillsCount = verifiedSkills.length;
  const skillsPoints = Math.min(20, verifiedSkillsCount * 5);

  // 4. Profile Hygiene (10 pts only if Profile Completeness is 100% and email is verified)
  const profileHygienePoints = profileCompleteness === 100 && emailVerified ? 10 : 0;

  // Total Score (0 - 100)
  const totalScore = Math.min(
    100,
    identityPoints + proofOfWorkPoints + skillsPoints + profileHygienePoints
  );

  // Tier Classification
  let tier: TrustScoreBreakdown['tier'] = 'Unverified';
  let tierColor = 'text-slate-500 bg-slate-100 dark:bg-slate-800';

  if (totalScore >= 90) {
    tier = 'Elite';
    tierColor = 'text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300';
  } else if (totalScore >= 70) {
    tier = 'Verified Pro';
    tierColor = 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300';
  } else if (totalScore >= 50) {
    tier = 'Emerging';
    tierColor = 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300';
  } else if (totalScore >= 25) {
    tier = 'Novice';
    tierColor = 'text-sky-700 bg-sky-50 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300';
  } else {
    tier = 'Unverified';
    tierColor = 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 border-slate-300';
  }

  // Actionable Insights to Level Up
  const actionableInsights: TrustScoreBreakdown['actionableInsights'] = [];

  if (!isIdentityVerified) {
    actionableInsights.push({
      title: 'Verify Official Identity',
      points: 40,
      category: 'identity',
      description: 'Submit government ID verification to earn an immediate +40 trust score boost.',
    });
  }

  if (verifiedProjectsCount < 3) {
    const needed = 3 - verifiedProjectsCount;
    actionableInsights.push({
      title: `Add ${needed} Verified Project Proof${needed > 1 ? 's' : ''}`,
      points: needed * 10,
      category: 'work',
      description: 'Add verifiable deliverables or client milestone sign-offs to earn +10 points each.',
    });
  }

  if (verifiedSkillsCount < 4) {
    const needed = 4 - verifiedSkillsCount;
    actionableInsights.push({
      title: `Verify ${needed} Skill${needed > 1 ? 's' : ''}`,
      points: needed * 5,
      category: 'skills',
      description: 'Have clients, mentors, or peer assessments attest your technical capabilities.',
    });
  }

  if (profileHygienePoints === 0) {
    if (!emailVerified) {
      actionableInsights.push({
        title: 'Verify Account Email',
        points: 10,
        category: 'hygiene',
        description: 'Confirm your email address and ensure 100% profile completeness to unlock base hygiene points.',
      });
    } else if (profileCompleteness < 100) {
      actionableInsights.push({
        title: 'Complete 100% of Profile Details',
        points: 10,
        category: 'hygiene',
        description: 'Complete headline, bio, location, and skills to unlock 10 base profile hygiene points.',
      });
    }
  }

  return {
    totalScore,
    tier,
    tierColor,
    identityPoints,
    proofOfWorkPoints,
    skillsPoints,
    profileHygienePoints,
    profileCompletenessPercentage: profileCompleteness,
    isIdentityVerified,
    isEmailVerified: emailVerified,
    verifiedProjectsCount,
    verifiedSkillsCount,
    actionableInsights,
  };
}

/**
 * Calculates a verified Potential Trajectory indicator.
 * 
 * STRICT ARCHITECTURAL INVARIANT:
 * - This is NOT a duplicate of Profile Completeness or Trust Score.
 * - It evaluates verified milestone momentum, multi-domain skill progression,
 *   and platform execution velocity to convey directional professional trajectory.
 */
export function calculatePotentialTrajectory(
  passport: Partial<TrustPassport> | null,
  profile: Partial<UserProfile> | null
): import('../types').PotentialTrajectoryIndicator {
  const verifiedProjects = (passport?.projects || []).filter(
    (p) => p.verificationStatus === 'verified'
  );
  const verifiedSkills = (passport?.skills || []).filter(
    (s) => (s.verifiedCount && s.verifiedCount > 0) || (s as any).verified === true
  );
  const totalProjects = passport?.projects?.length || 0;
  const experiences = passport?.experience || passport?.workHistory || [];
  const certs = passport?.certifications || passport?.certificates || [];

  // Calculate verified milestone momenta
  const verifiedMilestoneMomenta = verifiedProjects.length + certs.length;

  // Determine Primary Domain from skills category or projects
  const categoryCounts: Record<string, number> = {};
  for (const skill of passport?.skills || []) {
    const cat = skill.category || 'Engineering';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + (skill.proficiency === 'expert' ? 3 : skill.proficiency === 'advanced' ? 2 : 1);
  }
  let primaryDomain = 'Full-Stack Development';
  let maxCount = 0;
  for (const [cat, count] of Object.entries(categoryCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primaryDomain = cat;
    }
  }

  // Momentum Score (0 - 100) based on verified outcomes, skill depth, and experience
  let momentum = 15; // baseline momentum for active member
  momentum += Math.min(35, verifiedProjects.length * 12);
  momentum += Math.min(25, verifiedSkills.length * 6);
  momentum += Math.min(15, experiences.length * 5);
  momentum += Math.min(10, certs.length * 5);
  const momentumScore = Math.min(100, momentum);

  // Skill Trajectory Tier
  let skillTrajectoryTier: import('../types').PotentialTrajectoryIndicator['skillTrajectoryTier'] = 'Emerging Builder';
  let trajectorySummary = 'Building foundational milestone artifacts and establishing professional capabilities.';
  let nextGrowthMilestone = 'Complete and verify first client deliverable or project proof.';

  if (momentumScore >= 80 || verifiedMilestoneMomenta >= 4) {
    skillTrajectoryTier = 'Master Practitioner';
    trajectorySummary = `Demonstrating verified leadership across ${primaryDomain} with consistent high-integrity deliverables.`;
    nextGrowthMilestone = 'Expand enterprise service engagements or mentor emerging platform talent.';
  } else if (momentumScore >= 55 || verifiedMilestoneMomenta >= 2) {
    skillTrajectoryTier = 'High-Impact Contributor';
    trajectorySummary = `Accelerating execution velocity with verified competency across multiple ${primaryDomain} deliverables.`;
    nextGrowthMilestone = 'Deliver a specialized multi-milestone contract or earn a sovereign credential.';
  } else if (momentumScore >= 30 || totalProjects >= 1 || verifiedSkills.length >= 2) {
    skillTrajectoryTier = 'Accelerating Specialist';
    trajectorySummary = `Deepening specialized capabilities in ${primaryDomain} with proven applied work artifacts.`;
    nextGrowthMilestone = 'Attest project deliverables through decentralized client verification.';
  }

  return {
    verifiedMilestoneMomenta,
    skillTrajectoryTier,
    primaryDomain,
    momentumScore,
    trajectorySummary,
    nextGrowthMilestone,
  };
}
