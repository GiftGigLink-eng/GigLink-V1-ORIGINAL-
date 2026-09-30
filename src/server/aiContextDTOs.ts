import { UserPersona } from '../types';

/**
 * Sanitized Data Transfer Objects (DTOs) for AI Consumption.
 * Invariant: Never contains passwords, auth secrets, raw government IDs,
 * financialLedger items, Stripe IDs, bank accounts, or internal CEO metrics.
 */

export interface UserContextDTO {
  uid: string;
  displayName: string;
  activePersona: UserPersona;
  identityVerified: boolean;
  headline?: string;
  bio?: string;
  location?: string;
  skills: string[];
  hiringInterests?: string[];
  talentTypes?: string[];
  customHiringNeed?: string;
}

export interface PassportContextDTO {
  trustScore: number;
  trustTier: string;
  verifiedSkillsCount: number;
  completedProjectsCount: number;
  verifiedSkills: string[];
  verifiedProjects: Array<{
    title: string;
    description?: string;
    verified: boolean;
  }>;
}

export interface WorkspaceContextDTO {
  routePath: string;
  workspaceType:
    | 'talent_dashboard'
    | 'client_dashboard'
    | 'enterprise_dashboard'
    | 'profile'
    | 'public_profile'
    | 'opportunity_detail'
    | 'contract_handoff'
    | 'applications_management'
    | 'credentials_vault'
    | 'general';
  description: string;
}

export interface OpportunityContextDTO {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  compensationType: string;
  compensationMin?: number;
  compensationMax?: number;
  currency: string;
  requiredSkills: string[];
  creatorName?: string;
  isOwner: boolean;
}

export interface ApplicationContextDTO {
  id: string;
  opportunityId: string;
  opportunityTitle?: string;
  status: string;
  proposedRate?: number;
  proposedRateType?: string;
  coverLetterSnippet?: string;
  isApplicant: boolean;
}

export interface ContractContextDTO {
  id: string;
  title: string;
  status: string;
  milestonesSummary: Array<{
    title: string;
    status: string;
    amount: number;
  }>;
  userRoleInContract: 'client' | 'talent';
}

export interface TimeContextDTO {
  localHour: number;
  timezone: string;
  locale?: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  isReturningToday: boolean;
  isReturningSession: boolean;
  isUtcFallback: boolean;
}

export interface SanitizedAiContext {
  user: UserContextDTO;
  passport: PassportContextDTO;
  workspace: WorkspaceContextDTO;
  time: TimeContextDTO;
  activeOpportunity?: OpportunityContextDTO;
  activeApplication?: ApplicationContextDTO;
  activeContract?: ContractContextDTO;
}

export interface IlAiGuidanceRequest {
  message?: string;
  routePath: string;
  entityHints?: {
    opportunityId?: string;
    applicationId?: string;
    contractId?: string;
  };
  timeHints?: {
    localHour?: number;
    timezone?: string;
    locale?: string;
    lastSeenTimestamp?: number;
  };
}

export interface IlAiGuidanceResponse {
  greeting: string;
  summary: string;
  guidance: string;
  suggestedActions: Array<{
    label: string;
    actionType: 'navigate' | 'filter' | 'review' | 'info';
    target?: string;
  }>;
  contextualTip?: string;
  trustInvariantNote?: string;
}
