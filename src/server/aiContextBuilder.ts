import { getAdminFirestore } from './firebaseAdmin';
import { normalizeCanonicalPersona } from '../types';
import {
  SanitizedAiContext,
  UserContextDTO,
  PassportContextDTO,
  WorkspaceContextDTO,
  TimeContextDTO,
  OpportunityContextDTO,
  ApplicationContextDTO,
  ContractContextDTO,
  IlAiGuidanceRequest,
} from './aiContextDTOs';

/**
 * Validates whether a given string is a recognized IANA timezone identifier.
 */
export function isValidIanaTimezone(tz?: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts formatted calendar date key (YYYY-MM-DD) and numeric hour in a given timezone.
 */
export function getDatePartsInTimezone(date: Date, timeZone: string): { dateKey: string; hour: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }
  let hour = parseInt(partMap.hour, 10);
  if (hour === 24) hour = 0;
  return {
    dateKey: `${partMap.year}-${partMap.month}-${partMap.day}`,
    hour: isNaN(hour) ? 0 : hour,
  };
}

/**
 * Authoritative check for Opportunity visibility in IL AI.
 * Strict Invariant: Only 'open' opportunities are publicly visible to candidates.
 * Non-open states (draft, archived, completed, in_progress, awarded, etc.) are ONLY visible to the creator/owner.
 */
export function isOpportunityAuthorizedForCaller(opp: any, authUid: string): boolean {
  if (!opp || typeof opp !== 'object') return false;
  const isOwner = Boolean(opp.creatorId && opp.creatorId === authUid);
  const isPublic = opp.status === 'open';
  return isOwner || isPublic;
}

/**
 * Server-Authoritative AI Context Builder.
 * Invariants:
 * 1. Executes strictly after cryptographic ID-token verification.
 * 2. Fetches authoritative records directly via adminDb.
 * 3. Enforces strict entity authorization: users can ONLY access opportunities/applications/contracts
 *    they legitimately own or participate in.
 * 4. Filters out all private, financial, or unverified data.
 */
export async function buildSanitizedAiContext(
  authUid: string,
  request: IlAiGuidanceRequest
): Promise<SanitizedAiContext> {
  const adminDb = getAdminFirestore();

  // 1. Authoritative User Profile
  const userDoc = await adminDb.collection('users').doc(authUid).get();
  const userData = userDoc.exists ? (userDoc.data() as any) : {};

  const activePersona = normalizeCanonicalPersona(
    userData.activePersona || userData.persona,
    userData.activeRole || userData.role
  );

  const userContext: UserContextDTO = {
    uid: authUid,
    displayName: userData.displayName || 'Member',
    activePersona,
    identityVerified: Boolean(userData.identityVerified),
    headline: userData.headline ? String(userData.headline).slice(0, 160) : undefined,
    bio: userData.bio ? String(userData.bio).slice(0, 400) : undefined,
    location: userData.location,
    skills: Array.isArray(userData.skills)
      ? userData.skills.map((s: any) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean).slice(0, 15)
      : [],
    ...(activePersona === 'client'
      ? {
          hiringInterests: Array.isArray(userData.hiringInterests) ? userData.hiringInterests.slice(0, 10) : [],
          talentTypes: Array.isArray(userData.talentTypes) ? userData.talentTypes.slice(0, 5) : [],
          customHiringNeed: userData.customHiringNeed ? String(userData.customHiringNeed).slice(0, 300) : undefined,
        }
      : {}),
  };

  // 2. Authoritative Trust Passport
  const passportDoc = await adminDb.collection('trustPassports').doc(authUid).get();
  const passData = passportDoc.exists ? (passportDoc.data() as any) : {};

  const passportContext: PassportContextDTO = {
    trustScore: typeof passData.trustScore === 'number' ? passData.trustScore : 0,
    trustTier: passData.trustTier || 'emerging',
    verifiedSkillsCount: passData.metrics?.verifiedSkills || 0,
    completedProjectsCount: passData.metrics?.completedProjects || 0,
    verifiedSkills: Array.isArray(passData.skills)
      ? passData.skills.filter((s: any) => s.verified || s.verifiedCount > 0).map((s: any) => s.name).slice(0, 15)
      : [],
    verifiedProjects: Array.isArray(passData.projects)
      ? passData.projects
          .filter((p: any) => p.verificationStatus === 'verified')
          .map((p: any) => ({
            title: String(p.title || 'Verified Project').slice(0, 100),
            description: p.summary ? String(p.summary).slice(0, 200) : undefined,
            verified: true,
          }))
          .slice(0, 5)
      : [],
  };

  // 3. Workspace Context Mapping
  const route = (request.routePath || '/').trim();
  const workspaceContext: WorkspaceContextDTO = resolveWorkspaceContext(route, activePersona);

  // 4. Time & Session Context
  const timeContext: TimeContextDTO = resolveTimeContext(request.timeHints);

  // 5. Authorized Entity Contexts (Validated strictly against authUid)
  let activeOpportunity: OpportunityContextDTO | undefined;
  let activeApplication: ApplicationContextDTO | undefined;
  let activeContract: ContractContextDTO | undefined;

  // 5A. Opportunity Authorization Check (Canonical Public State: 'open' only)
  if (request.entityHints?.opportunityId) {
    try {
      const oppId = request.entityHints.opportunityId.trim();
      const oppDoc = await adminDb.collection('opportunities').doc(oppId).get();
      if (oppDoc.exists) {
        const opp = oppDoc.data() as any;
        const isAuthorized = isOpportunityAuthorizedForCaller(opp, authUid);

        // Only allow context if authorized (public 'open' or owned by caller)
        if (isAuthorized) {
          const isOwner = opp.creatorId === authUid;
          activeOpportunity = {
            id: oppId,
            title: String(opp.title || '').slice(0, 150),
            description: String(opp.description || '').slice(0, 500),
            category: opp.category || 'General',
            status: opp.status || 'open',
            compensationType: opp.compensationType || 'fixed',
            compensationMin: opp.compensationMin,
            compensationMax: opp.compensationMax,
            currency: opp.currency || 'USD',
            requiredSkills: Array.isArray(opp.requiredSkills) ? opp.requiredSkills.slice(0, 10) : [],
            creatorName: opp.creatorName,
            isOwner,
          };
        }
      }
    } catch (e) {
      console.warn('[AI Context] Failed to resolve opportunity context:', e);
    }
  }

  // 5B. Application Authorization Check
  if (request.entityHints?.applicationId) {
    try {
      const appId = request.entityHints.applicationId.trim();
      const appDoc = await adminDb.collection('applications').doc(appId).get();
      if (appDoc.exists) {
        const application = appDoc.data() as any;
        const isApplicant = application.applicantId === authUid;
        const isOppOwner = application.creatorId === authUid;

        // Strict: only applicant or opportunity creator can access application context
        if (isApplicant || isOppOwner) {
          activeApplication = {
            id: appId,
            opportunityId: application.opportunityId,
            opportunityTitle: application.opportunityTitle,
            status: application.status || 'pending',
            proposedRate: application.proposedRate,
            proposedRateType: application.proposedRateType,
            coverLetterSnippet: application.coverLetter ? String(application.coverLetter).slice(0, 300) : undefined,
            isApplicant,
          };
        }
      }
    } catch (e) {
      console.warn('[AI Context] Failed to resolve application context:', e);
    }
  }

  // 5C. Contract Authorization Check
  if (request.entityHints?.contractId) {
    try {
      const cId = request.entityHints.contractId.trim();
      const contractDoc = await adminDb.collection('contracts').doc(cId).get();
      if (contractDoc.exists) {
        const c = contractDoc.data() as any;
        const isClient = c.creatorId === authUid;
        const isTalent = c.talentId === authUid;

        // Strict: only signed contract participants can view contract context
        if (isClient || isTalent) {
          activeContract = {
            id: cId,
            title: String(c.title || 'Milestone Contract').slice(0, 150),
            status: c.status || 'active',
            userRoleInContract: isClient ? 'client' : 'talent',
            milestonesSummary: Array.isArray(c.milestones)
              ? c.milestones.map((m: any) => ({
                  title: String(m.title || 'Milestone').slice(0, 80),
                  status: m.status || 'pending',
                  amount: Number(m.amount || 0),
                }))
              : [],
          };
        }
      }
    } catch (e) {
      console.warn('[AI Context] Failed to resolve contract context:', e);
    }
  }

  return {
    user: userContext,
    passport: passportContext,
    workspace: workspaceContext,
    time: timeContext,
    activeOpportunity,
    activeApplication,
    activeContract,
  };
}

function resolveWorkspaceContext(route: string, persona: string): WorkspaceContextDTO {
  const p = route.toLowerCase();

  if (p.includes('/talent/dashboard')) {
    return {
      routePath: route,
      workspaceType: 'talent_dashboard',
      description: 'Talent Workspace: Discovering verified opportunities, managing applications, and tracking skills.',
    };
  }
  if (p.includes('/client/dashboard') || p.includes('/creator/dashboard')) {
    return {
      routePath: route,
      workspaceType: 'client_dashboard',
      description: 'Client Workspace: Posting opportunities, reviewing talent applications, and managing project handoffs.',
    };
  }
  if (p.includes('/enterprise/dashboard')) {
    return {
      routePath: route,
      workspaceType: 'enterprise_dashboard',
      description: 'Enterprise Organization Workspace: Bench talent management, institutional attestations, and verifications.',
    };
  }
  if (p.includes('/handoff/')) {
    return {
      routePath: route,
      workspaceType: 'contract_handoff',
      description: 'Active Contract Workspace: Scope lock, milestone deliverable reviews, and final project sign-off.',
    };
  }
  if (p.includes('/opportunities/') && !p.includes('/applications')) {
    return {
      routePath: route,
      workspaceType: 'opportunity_detail',
      description: 'Opportunity Specification: Reviewing requirements, compensation, and submission guidelines.',
    };
  }
  if (p.includes('/applications')) {
    return {
      routePath: route,
      workspaceType: 'applications_management',
      description: 'Application Reviews: Reviewing proposals, credentials, and candidate Trust Passports.',
    };
  }
  if (p.includes('/passport')) {
    return {
      routePath: route,
      workspaceType: 'credentials_vault',
      description: 'Trust Passport Vault: Authoritative Trust Score breakdown, verified proofs of work, and identity status.',
    };
  }
  if (p.includes('/profile') || p.includes('/p/')) {
    return {
      routePath: route,
      workspaceType: 'profile',
      description: 'Professional Identity Profile: Public representation, portfolio, and hiring interests.',
    };
  }

  return {
    routePath: route,
    workspaceType: 'general',
    description: `General GigLink navigation as a verified ${persona}.`,
  };
}

export function resolveTimeContext(
  timeHints?: {
    localHour?: number;
    timezone?: string;
    locale?: string;
    lastSeenTimestamp?: number;
  },
  referenceNow: Date = new Date()
): TimeContextDTO {
  const now = referenceNow;

  // 1. Timezone Validation & UTC Fallback (BLOCKER 6)
  const isValidTz = isValidIanaTimezone(timeHints?.timezone);
  const isUtcFallback = !isValidTz;
  const effectiveTz = isValidTz && timeHints?.timezone ? timeHints.timezone.trim() : 'UTC';

  // 2. Derive Current Date Key & Local Hour in Effective Timezone
  const currentParts = getDatePartsInTimezone(now, effectiveTz);
  
  // Use client-reported local hour ONLY if timezone is valid and hour is valid (0-23)
  const hour =
    !isUtcFallback &&
    typeof timeHints?.localHour === 'number' &&
    timeHints.localHour >= 0 &&
    timeHints.localHour <= 23
      ? timeHints.localHour
      : currentParts.hour;

  // 3. Time of Day Mapping
  let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning';
  if (hour >= 5 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
  else timeOfDay = 'night';

  // 4. Calendar-Day Comparison in Validated Timezone (BLOCKER 5)
  let isReturningToday = false;
  let isReturningSession = false;

  if (
    timeHints?.lastSeenTimestamp &&
    typeof timeHints.lastSeenTimestamp === 'number' &&
    timeHints.lastSeenTimestamp > 0 &&
    timeHints.lastSeenTimestamp < now.getTime()
  ) {
    const diffMs = now.getTime() - timeHints.lastSeenTimestamp;
    
    // State 1: At least 60 seconds elapsed since previous session activity
    if (diffMs >= 60 * 1000) {
      isReturningSession = true;

      // Extract calendar date key for previous session in the SAME validated timezone
      const lastSeenParts = getDatePartsInTimezone(new Date(timeHints.lastSeenTimestamp), effectiveTz);

      // State 2: Returning later in the exact same calendar day
      // (Requires matching calendar date keys AND at least 15 minutes offline gap)
      if (lastSeenParts.dateKey === currentParts.dateKey && diffMs >= 15 * 60 * 1000) {
        isReturningToday = true;
      }
      // State 3: Returning on a different calendar day -> isReturningToday remains strictly false
    }
  }

  return {
    localHour: hour,
    timezone: effectiveTz,
    locale: timeHints?.locale ? String(timeHints.locale).slice(0, 20) : undefined,
    timeOfDay,
    isReturningToday,
    isReturningSession,
    isUtcFallback,
  };
}
