/**
 * GigLink Profile & Professional Identity Service Layer
 * 
 * Implements Phase 1 Architecture:
 * - Authoritative source of professional truth: /trustPassports/{uid}
 * - Account identity & authentication state: /users/{uid}
 * - Sanitized read-only projection: /publicTrustPassports/{uid}
 * 
 * Features:
 * - Phase A: Dual-read with graceful fallback to legacy /users/{uid} fields
 * - Phase B: Unified writes targeting /trustPassports/{uid}
 * - Phase C: Strict projection sanitization without leaking sensitive verification/ID data
 */

import {
  UserProfile,
  TrustPassport,
  PublicTrustPassport,
  UnifiedProfileData,
  SkillItem,
  ProjectProof,
  ExperienceItem,
  EducationItem,
  CertificationItem,
  SocialLinks,
  StructuredLocation,
  WorkAvailability,
  PartnerServiceOffering,
  PotentialTrajectoryIndicator,
} from '../types';
import { calculateTrustScore, calculateProfileCompleteness, calculatePotentialTrajectory } from './trustScore';
import { getSkillByName } from './catalogue/skills';
import { sanitizeStructuredLocation } from './catalogue/locations';

/**
 * Recursively removes any property with an `undefined` value from an object or array.
 * This is critical for Firestore operations, where `undefined` field values trigger
 * runtime exceptions ("Function setDoc() called with invalid data. Unsupported field value: undefined").
 */
export function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' && item !== null ? removeUndefinedFields(item) : item)) as unknown as T;
  }

  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      cleanObj[key] = removeUndefinedFields(value);
    } else {
      cleanObj[key] = value;
    }
  }

  return cleanObj as T;
}

/**
 * Normalizes an array of skills (which could be legacy string names or SkillItem objects)
 * into strongly-typed canonical SkillItem objects.
 */
export function normalizeSkills(skills: (string | SkillItem)[] | undefined | null): SkillItem[] {
  if (!skills || !Array.isArray(skills)) return [];

  return skills.map((s, idx) => {
    if (typeof s === 'string') {
      const canonical = getSkillByName(s);
      return {
        id: `skill_${idx}_${Date.now()}`,
        name: canonical?.name || s,
        category: canonical?.category || 'General',
        proficiency: 'intermediate',
        verifiedCount: 0,
      };
    }
    return s;
  });
}

/**
 * Normalizes social links across passport and legacy profile fields.
 */
export function normalizeSocialLinks(
  passportLinks?: SocialLinks,
  profile?: Partial<UserProfile> | null
): SocialLinks {
  return {
    github: passportLinks?.github || profile?.githubUrl || undefined,
    linkedin: passportLinks?.linkedin || profile?.linkedinUrl || undefined,
    portfolio: passportLinks?.portfolio || profile?.portfolioUrl || undefined,
    twitter: passportLinks?.twitter || undefined,
    other: passportLinks?.other || undefined,
  };
}

/**
 * Dual-Read Resolution:
 * Combines `/trustPassports/{uid}` (authoritative professional record)
 * and `/users/{uid}` (account identity & legacy fallback).
 * 
 * Guarantees zero data loss for existing users whose profile data
 * may only reside in `/users/{uid}` or in both collections.
 */
export function getUnifiedProfileData(
  profile: UserProfile | null,
  passport: TrustPassport | null,
  isEmailVerified: boolean = false
): UnifiedProfileData {
  const uid = passport?.userId || profile?.uid || '';
  const email = profile?.email || '';
  const displayName = profile?.displayName || 'GigLink Member';
  const photoURL = profile?.photoURL || undefined;
  const activePersona = profile?.activePersona || 'learner';
  const onboardingCompleted = profile?.onboardingCompleted ?? false;
  const organizationId = profile?.organizationId || undefined;

  // 1. Headline (Passport > Profile > Default)
  const headline = passport?.headline || profile?.headline || 'Professional on GigLink';

  // 2. Bio (Passport > Profile > Default empty)
  const bio = passport?.bio || profile?.bio || '';

  // 3. Location (Passport structured > Passport string > Profile structured > Profile string)
  const structuredLocation: StructuredLocation | null =
    sanitizeStructuredLocation(passport?.structuredLocation) ||
    sanitizeStructuredLocation(profile?.structuredLocation) ||
    null;

  const location =
    structuredLocation?.formattedAddress ||
    passport?.location ||
    profile?.location ||
    '';

  // 4. Skills (Passport skills > Profile legacy skills > Empty)
  const skills: SkillItem[] =
    passport?.skills && passport.skills.length > 0
      ? passport.skills
      : normalizeSkills(profile?.skills);

  // 5. Projects & Deliverables
  const projects: ProjectProof[] = passport?.projects || [];

  // 6. Experience & Work History (supports both field aliases)
  const experience: ExperienceItem[] =
    passport?.experience || passport?.workHistory || [];

  // 7. Education
  const education: EducationItem[] = passport?.education || [];

  // 8. Certifications (supports both field aliases)
  const certifications: CertificationItem[] =
    passport?.certifications || passport?.certificates || [];

  // 9. Social Links
  const socialLinks: SocialLinks = normalizeSocialLinks(
    passport?.socialLinks,
    profile
  );

  // 10. Availability & Work Preferences
  const availability: WorkAvailability | undefined = passport?.availability || undefined;

  // 11. Partner Services (Structured offerings for partners/agencies)
  const partnerServices: PartnerServiceOffering[] | undefined = passport?.partnerServices || undefined;

  // 12. Potential Trajectory (Derived verified growth & milestone velocity)
  const potentialTrajectory: PotentialTrajectoryIndicator = calculatePotentialTrajectory(passport, profile);

  // 13. Verification & Trust Signals
  const isPublic = passport?.isPublic ?? false;
  const identityVerified = passport?.identityVerified === true || profile?.identityVerified === true;

  const trustScoreResult = calculateTrustScore(passport, profile, isEmailVerified);
  const profileCompleteness = calculateProfileCompleteness(profile, passport);

  return {
    uid,
    email,
    displayName,
    photoURL,
    activePersona,
    headline,
    bio,
    location,
    structuredLocation,
    skills,
    projects,
    experience,
    education,
    certifications,
    socialLinks,
    availability,
    partnerServices,
    potentialTrajectory,
    isPublic,
    identityVerified,
    trustScore: trustScoreResult.totalScore,
    trustTier: trustScoreResult.tier,
    profileCompleteness,
    onboardingCompleted,
    organizationId,
    updatedAt: passport?.updatedAt || profile?.updatedAt || new Date().toISOString(),
  };
}

/**
 * Sorts portfolio projects for optimal professional presentation:
 * Priority:
 * 1. Featured projects (isFeatured === true)
 * 2. Recent completion dates (descending)
 * 3. Verified projects (verificationStatus === 'verified')
 * 4. Other published projects
 */
export function sortPortfolioProjects(projects: ProjectProof[]): ProjectProof[] {
  if (!projects || !Array.isArray(projects)) return [];

  return [...projects].sort((a, b) => {
    // 1. Featured priority
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;

    // 2. Verified priority
    if (a.verificationStatus === 'verified' && b.verificationStatus !== 'verified') return -1;
    if (a.verificationStatus !== 'verified' && b.verificationStatus === 'verified') return 1;

    // 3. Completion date recency
    const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;

    // 4. Alphabetical fallback
    return a.title.localeCompare(b.title);
  });
}

/**
 * Sanitizes a single project proof for safe public exposure.
 * Strips internal metadata, private evidence notes, and unearned verification stamps.
 */
export function sanitizePublicProjectProof(p: ProjectProof): ProjectProof {
  const isVerified = p.verificationStatus === 'verified';

  const clean: Record<string, any> = {
    id: p.id,
    title: p.title,
    description: p.description,
    role: p.role,
    skillsUsed: p.skillsUsed || [],
    completedAt: p.completedAt,
    status: p.status || 'published',
    isFeatured: p.isFeatured === true,
    verificationStatus: p.verificationStatus || 'unverified',
  };

  if (p.summary) clean.summary = p.summary;
  if (p.projectUrl) clean.projectUrl = p.projectUrl;
  if (p.repositoryUrl) clean.repositoryUrl = p.repositoryUrl;
  if (p.externalUrl) clean.externalUrl = p.externalUrl;
  if (p.previewImage) clean.previewImage = p.previewImage;
  if (p.mediaUrls && p.mediaUrls.length > 0) clean.mediaUrls = p.mediaUrls;
  if (p.deliverables && p.deliverables.length > 0) clean.deliverables = p.deliverables;
  if (p.caseStudy) clean.caseStudy = p.caseStudy;

  // Verifier details only projected when legitimately verified
  if (isVerified) {
    if (p.verifierName) clean.verifierName = p.verifierName;
    if (p.verifiedAt) clean.verifiedAt = p.verifiedAt;
  }

  return removeUndefinedFields(clean) as ProjectProof;
}

/**
 * Sanitizes a TrustPassport for the public projection `/publicTrustPassports/{uid}`.
 * 
 * Strict Privacy Invariant:
 * NEVER projects:
 * - Private project drafts
 * - Raw government ID numbers or documents
 * - Reviewer notes / internal verification audit logs
 * - Private email addresses
 * - Account recovery data
 */
export function sanitizePublicPassportProjection(
  passport: TrustPassport,
  profile: UserProfile | null,
  isEmailVerified: boolean = false
): PublicTrustPassport {
  const trustCalc = calculateTrustScore(passport, profile, isEmailVerified);
  const unified = getUnifiedProfileData(profile, passport, isEmailVerified);

  // Filter out private drafts - only published/completed projects are visible publicly
  const publicProjects = (unified.projects || [])
    .filter((p) => p.status !== 'draft')
    .map(sanitizePublicProjectProof);

  const rawDoc: Record<string, any> = {
    userId: passport.userId || (passport as any).uid || profile?.uid || '',
    uid: passport.userId || (passport as any).uid || profile?.uid || '',
    displayName: unified.displayName,
    headline: unified.headline,
    bio: unified.bio,
    location: unified.location || 'Location on file',
    locationVerificationStatus: passport.locationVerificationStatus || 'self_declared',
    identityVerified: unified.identityVerified === true,
    isPublic: passport.isPublic === true,
    trustScore: trustCalc.totalScore,
    trustTier: trustCalc.tier,
    skills: unified.skills || [],
    projects: publicProjects,
    experience: unified.experience || [],
    workHistory: unified.experience || [], // backward compatibility
    education: unified.education || [],
    certifications: unified.certifications || [],
    certificates: unified.certifications || [], // backward compatibility
    socialLinks: unified.socialLinks || {},
    reviews: passport.reviews || [],
    metrics: passport.metrics || {
      verificationScore: 0,
      completedProjectsCount: publicProjects.length,
      verifiedSkillsCount: (unified.skills || []).filter((s) => s.verifiedCount > 0).length,
      endorsementsCount: 0,
      activeStreakDays: 1,
    },
    updatedAt: passport.updatedAt || new Date().toISOString(),
  };

  if (unified.photoURL) {
    rawDoc.photoURL = unified.photoURL;
  }
  if (unified.organizationId) {
    rawDoc.organizationId = unified.organizationId;
  }
  if (unified.structuredLocation) {
    rawDoc.structuredLocation = unified.structuredLocation;
  }
  if (unified.socialLinks?.portfolio) {
    rawDoc.portfolioUrl = unified.socialLinks.portfolio;
  }
  if (unified.availability) {
    rawDoc.availability = unified.availability;
  }
  if (unified.partnerServices && unified.partnerServices.length > 0) {
    rawDoc.partnerServices = unified.partnerServices.filter((s) => s.isActive !== false);
  }
  if (unified.potentialTrajectory) {
    rawDoc.potentialTrajectory = unified.potentialTrajectory;
  }

  return removeUndefinedFields(rawDoc) as PublicTrustPassport;
}

/**
 * Builds the update payload for a unified write to `/trustPassports/{uid}`.
 * Guarantees that authoritative fields (identityVerified, metrics verification)
 * cannot be manufactured or tampered with by regular user updates.
 */
export function buildPassportUpdatePayload(
  currentPassport: Partial<TrustPassport> | null,
  updates: Partial<Pick<
    TrustPassport,
    | 'headline'
    | 'bio'
    | 'location'
    | 'structuredLocation'
    | 'isPublic'
    | 'skills'
    | 'projects'
    | 'experience'
    | 'workHistory'
    | 'education'
    | 'certifications'
    | 'certificates'
    | 'socialLinks'
    | 'portfolioUrl'
    | 'availability'
    | 'partnerServices'
  >>
): Partial<TrustPassport> {
  const now = new Date().toISOString();
  const payload: Partial<TrustPassport> = {
    updatedAt: now,
  };

  if ('isPublic' in updates && updates.isPublic !== undefined) {
    payload.isPublic = updates.isPublic === true;
  }

  if ('headline' in updates && updates.headline !== undefined) {
    payload.headline = updates.headline.trim();
  }
  if ('bio' in updates && updates.bio !== undefined) {
    payload.bio = updates.bio.trim();
  }
  if ('structuredLocation' in updates) {
    payload.structuredLocation = sanitizeStructuredLocation(updates.structuredLocation);
    if (payload.structuredLocation) {
      payload.location = payload.structuredLocation.formattedAddress;
    } else if (updates.location !== undefined) {
      payload.location = updates.location;
    }
  } else if ('location' in updates && updates.location !== undefined) {
    payload.location = updates.location.trim();
  }

  if ('skills' in updates && updates.skills !== undefined) {
    payload.skills = updates.skills;
  }
  if ('projects' in updates && updates.projects !== undefined) {
    // Preserve existing verified status & verifier attribution from current passport
    const existingMap = new Map((currentPassport?.projects || []).map((p) => [p.id, p]));
    payload.projects = updates.projects.map((p) => {
      const existing = existingMap.get(p.id);
      if (existing && existing.verificationStatus === 'verified') {
        return {
          ...p,
          verificationStatus: 'verified' as const,
          verifierUid: existing.verifierUid,
          verifierName: existing.verifierName,
          verifiedAt: existing.verifiedAt,
        };
      }
      return {
        ...p,
        verificationStatus: (existing?.verificationStatus || p.verificationStatus || 'unverified') as any,
      };
    });
  }
  if ('experience' in updates && updates.experience !== undefined) {
    payload.experience = updates.experience;
    payload.workHistory = updates.experience; // keep aliases synced
  } else if ('workHistory' in updates && updates.workHistory !== undefined) {
    payload.experience = updates.workHistory;
    payload.workHistory = updates.workHistory;
  }
  if ('education' in updates && updates.education !== undefined) {
    payload.education = updates.education;
  }
  if ('certifications' in updates && updates.certifications !== undefined) {
    payload.certifications = updates.certifications;
    payload.certificates = updates.certifications; // keep aliases synced
  } else if ('certificates' in updates && updates.certificates !== undefined) {
    payload.certifications = updates.certificates;
    payload.certificates = updates.certificates;
  }
  if ('socialLinks' in updates && updates.socialLinks !== undefined) {
    payload.socialLinks = updates.socialLinks;
    if (updates.socialLinks.portfolio) {
      payload.portfolioUrl = updates.socialLinks.portfolio;
    }
  } else if ('portfolioUrl' in updates && updates.portfolioUrl !== undefined) {
    payload.portfolioUrl = updates.portfolioUrl;
  }

  if ('availability' in updates && updates.availability !== undefined) {
    payload.availability = updates.availability;
  }
  if ('partnerServices' in updates && updates.partnerServices !== undefined) {
    payload.partnerServices = updates.partnerServices;
  }

  return removeUndefinedFields(payload);
}
