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
  UserPersona,
  normalizeCanonicalPersona,
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

export interface ImageUrlValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedUrl?: string;
}

/**
 * Validates and sanitizes a profile picture image URL.
 * Strictly enforces HTTPS protocol and rejects dangerous schemes (javascript:, data:, blob:, file:, http:)
 * as well as localhost, private IP ranges, and malformed inputs.
 */
export function validateProfileImageUrl(
  rawUrl: string | null | undefined,
  options: { allowEmpty?: boolean } = { allowEmpty: false }
): ImageUrlValidationResult {
  if (!rawUrl || rawUrl.trim() === '') {
    if (options.allowEmpty) {
      return { isValid: true, sanitizedUrl: '' };
    }
    return { isValid: false, error: 'Image URL cannot be empty.' };
  }

  const trimmed = rawUrl.trim();

  if (trimmed.length > 2048) {
    return { isValid: false, error: 'Image URL exceeds maximum permissible length (2048 characters).' };
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('file:') ||
    lower.startsWith('http:')
  ) {
    return {
      isValid: false,
      error: 'Insecure or invalid URL protocol. Only secure HTTPS image URLs are permitted.',
    };
  }

  if (!lower.startsWith('https://')) {
    return {
      isValid: false,
      error: 'Profile picture URL must strictly begin with https://',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: 'Malformed URL syntax.' };
  }

  if (parsed.protocol !== 'https:') {
    return { isValid: false, error: 'Only HTTPS URLs are allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject localhost and local domain names
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '0.0.0.0'
  ) {
    return { isValid: false, error: 'Localhost and local network addresses are forbidden.' };
  }

  // Reject IPv4 loopback & private IP ranges
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  if (match) {
    const octet1 = parseInt(match[1], 10);
    const octet2 = parseInt(match[2], 10);
    const octet3 = parseInt(match[3], 10);
    const octet4 = parseInt(match[4], 10);

    if (octet1 > 255 || octet2 > 255 || octet3 > 255 || octet4 > 255) {
      return { isValid: false, error: 'Invalid IP address format.' };
    }

    if (
      octet1 === 127 || // Loopback
      octet1 === 10 || // Class A private
      octet1 === 0 || // Current network
      (octet1 === 172 && octet2 >= 16 && octet2 <= 31) || // Class B private
      (octet1 === 192 && octet2 === 168) || // Class C private
      (octet1 === 169 && octet2 === 254) // Link-local
    ) {
      return { isValid: false, error: 'Private and loopback IP addresses are forbidden.' };
    }
  }

  // Reject IPv6 loopback & private addresses
  if (
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.startsWith('fe80:') ||
    hostname.startsWith('[fe80:') ||
    hostname.startsWith('fc00:') ||
    hostname.startsWith('[fc00:')
  ) {
    return { isValid: false, error: 'Private IPv6 addresses are forbidden.' };
  }

  return { isValid: true, sanitizedUrl: trimmed };
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
    portfolio:
      passportLinks?.portfolio ||
      (passportLinks as any)?.website ||
      profile?.portfolioUrl ||
      (profile as any)?.website ||
      undefined,
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

  // 13. Client Hiring Identity (Hiring interests, talent types, custom needs)
  const hiringInterests: string[] = passport?.hiringInterests || (profile as any)?.hiringInterests || [];
  const talentTypes: string[] = passport?.talentTypes || (profile as any)?.talentTypes || [];
  const customHiringNeed: string = passport?.customHiringNeed || (profile as any)?.customHiringNeed || '';
  const publishHiringFocus: boolean =
    passport?.publishHiringFocus === true || (profile as any)?.publishHiringFocus === true;

  // 14. Verification & Trust Signals
  const isPublic = passport?.isPublic ?? false;
  const identityVerified = passport?.identityVerified === true;

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
    hiringInterests,
    talentTypes,
    customHiringNeed,
    publishHiringFocus,
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

  // Authoritative Persona Resolution:
  // Derived strictly from authoritative UserProfile, falling back to passport if profile is null.
  // Normalized strictly to one of the 4 canonical UserPersonas ('learner' | 'partner' | 'client' | 'organization_admin').
  const rawPersona =
    profile?.activePersona ||
    (profile as any)?.persona ||
    (passport as any)?.activePersona ||
    (passport as any)?.persona ||
    profile?.activeRole ||
    (passport as any)?.activeRole;
  const canonicalPersona: UserPersona = normalizeCanonicalPersona(rawPersona);

  // Filter out private drafts - only published/completed projects are visible publicly
  const publicProjects = (unified.projects || [])
    .filter((p) => p.status !== 'draft')
    .map(sanitizePublicProjectProof);

  const rawDoc: Record<string, any> = {
    userId: passport.userId || (passport as any).uid || profile?.uid || '',
    uid: passport.userId || (passport as any).uid || profile?.uid || '',
    persona: canonicalPersona,
    activePersona: canonicalPersona,
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

  if (unified.photoURL && unified.photoURL.trim().length > 0) {
    rawDoc.photoURL = unified.photoURL.trim();
  }

  // Hiring Focus Privacy Guard:
  // Must ONLY be included if effectivePassport.isPublic === true AND publishHiringFocus === true.
  // Safe default: if publishHiringFocus is false, missing, or undefined, hiring fields are strictly omitted.
  const isPublicPassport = passport.isPublic === true;
  const publishHiringFocus =
    passport.publishHiringFocus === true || (profile as any)?.publishHiringFocus === true;

  if (isPublicPassport && publishHiringFocus) {
    const rawInterests = passport.hiringInterests || unified.hiringInterests;
    if (Array.isArray(rawInterests) && rawInterests.length > 0) {
      const sanitized = rawInterests
        .filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
        .map((i) => i.trim().slice(0, 100))
        .slice(0, 10);
      if (sanitized.length > 0) {
        rawDoc.hiringInterests = sanitized;
      }
    }
    const rawTalents = passport.talentTypes || unified.talentTypes;
    if (Array.isArray(rawTalents) && rawTalents.length > 0) {
      const sanitized = rawTalents
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim().slice(0, 100))
        .slice(0, 10);
      if (sanitized.length > 0) {
        rawDoc.talentTypes = sanitized;
      }
    }
    const rawNeed = passport.customHiringNeed || unified.customHiringNeed;
    if (typeof rawNeed === 'string' && rawNeed.trim().length > 0) {
      rawDoc.customHiringNeed = rawNeed.trim().slice(0, 1000);
    }
    rawDoc.publishHiringFocus = true;
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
    | 'hiringInterests'
    | 'talentTypes'
    | 'customHiringNeed'
    | 'publishHiringFocus'
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
    const existingSkillMap = new Map(
      (currentPassport?.skills || []).map((s) => [s.id || s.name.toLowerCase(), s])
    );
    payload.skills = updates.skills.map((s) => {
      const existing = existingSkillMap.get(s.id || s.name.toLowerCase());
      const verifiedCount = existing?.verifiedCount ? Number(existing.verifiedCount) : 0;
      return {
        ...s,
        verifiedCount,
        verified: verifiedCount > 0,
      };
    });
  }
  if ('projects' in updates && updates.projects !== undefined) {
    // Preserve existing verified status & verifier attribution from current passport ONLY if genuinely verified
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
        verificationStatus: (existing?.verificationStatus === 'pending' ? 'pending' : 'unverified') as any,
        verifierUid: undefined,
        verifierName: undefined,
        verifiedAt: undefined,
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
    const existingCertMap = new Map(
      (currentPassport?.certifications || []).map((c) => [c.id || (c as any).credentialId, c])
    );
    payload.certifications = updates.certifications.map((c) => {
      const existing = existingCertMap.get(c.id || (c as any).credentialId);
      if (existing && existing.verificationStatus === 'verified') {
        return {
          ...c,
          verificationStatus: 'verified' as const,
          verifierUid: existing.verifierUid,
          verifierName: existing.verifierName,
          verifiedAt: existing.verifiedAt,
        };
      }
      return {
        ...c,
        verificationStatus: 'unverified' as const,
        verifierUid: undefined,
        verifierName: undefined,
        verifiedAt: undefined,
      };
    });
    payload.certificates = payload.certifications; // keep aliases synced
  } else if ('certificates' in updates && updates.certificates !== undefined) {
    const existingCertMap = new Map(
      (currentPassport?.certifications || []).map((c) => [c.id || (c as any).credentialId, c])
    );
    payload.certifications = updates.certificates.map((c) => {
      const existing = existingCertMap.get(c.id || (c as any).credentialId);
      if (existing && existing.verificationStatus === 'verified') {
        return {
          ...c,
          verificationStatus: 'verified' as const,
          verifierUid: existing.verifierUid,
          verifierName: existing.verifierName,
          verifiedAt: existing.verifiedAt,
        };
      }
      return {
        ...c,
        verificationStatus: 'unverified' as const,
        verifierUid: undefined,
        verifierName: undefined,
        verifiedAt: undefined,
      };
    });
    payload.certificates = payload.certifications;
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

  if ('hiringInterests' in updates && updates.hiringInterests !== undefined) {
    payload.hiringInterests = Array.isArray(updates.hiringInterests)
      ? updates.hiringInterests
          .filter((item): item is string => typeof item === 'string')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
  }
  if ('talentTypes' in updates && updates.talentTypes !== undefined) {
    payload.talentTypes = Array.isArray(updates.talentTypes)
      ? updates.talentTypes
          .filter((item): item is string => typeof item === 'string')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
  }
  if ('customHiringNeed' in updates && updates.customHiringNeed !== undefined) {
    payload.customHiringNeed = typeof updates.customHiringNeed === 'string' ? updates.customHiringNeed.trim() : '';
  }
  if ('publishHiringFocus' in updates && updates.publishHiringFocus !== undefined) {
    payload.publishHiringFocus = updates.publishHiringFocus === true;
  }

  return removeUndefinedFields(payload);
}
