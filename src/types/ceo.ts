/**
 * CEO Control Center Stage 2 Type Definitions
 * Strictly read-only executive intelligence structures.
 * Completely decoupled from canonical user roles and personas.
 */

import { UserPersona, Opportunity, OpportunityApplication, GigLinkContract } from './index';

export interface CeoAuthCheckResponse {
  isCeo: boolean;
  uid: string;
  email: string;
  authorizedAt: string;
}

export interface CeoMemberMetrics {
  totalMembers: number;
  newMembersToday: number;
  newMembersLast7Days: number;
  membersByPersona: Record<string, number>;
}

export type CeoMemberTimeBucket = 'today' | 'last_7_days' | 'last_30_days' | 'older';

export interface CeoMemberListItem {
  id: string;
  displayName: string;
  activePersona: 'learner' | 'partner' | 'client' | 'organization_admin';
  activeRole?: string;
  onboardingCompleted: boolean;
  createdAt: string;
  timeBucket: CeoMemberTimeBucket;
}

export interface CeoMembersResponse {
  timestamp: string;
  totalMembers: number;
  members: CeoMemberListItem[];
}

export interface CeoOpportunityMetrics {
  totalOpportunities: number;
  byStatus: Record<string, number>;
}

export interface CeoApplicationMetrics {
  totalApplications: number;
  byStatus: Record<string, number>;
}

export interface CeoContractMetrics {
  totalContracts: number;
  activeContracts: number;
  completedContracts: number;
  byStatus: Record<string, number>;
}

export interface CeoOverviewResponse {
  timestamp: string;
  members: CeoMemberMetrics;
  opportunities: CeoOpportunityMetrics;
  applications: CeoApplicationMetrics;
  contracts: CeoContractMetrics;
}

export interface CeoCurrencyFinancials {
  currency: string;
  totalSettledVolume: number;
  heldEscrow: number;
  releasedFunds: number;
  refundedFunds: number;
  platformFeesCollected: number;
  disputedEscrow: number;
  activeContractsWithEscrow: number;
  totalContractsEvaluated: number;
  totalLedgerRecords: number;
}

export interface CeoFinancialsResponse {
  timestamp: string;
  byCurrency: Record<string, CeoCurrencyFinancials>;
  historicalLedgerSummary: {
    totalRecords: number;
    fundedEvents: number;
    releasedEvents: number;
    refundEvents: number;
  };
}

export interface CeoSanitizedActivityItem {
  id: string;
  type: 'member_joined' | 'opportunity_created' | 'application_submitted' | 'collaboration_completed' | 'settlement_released';
  title: string;
  timestamp: string;
  category?: string;
  statusBadge?: string;
  amountFormatted?: string;
}

export interface CeoActivityResponse {
  timestamp: string;
  events: CeoSanitizedActivityItem[];
}

export interface CeoSystemHealthResponse {
  timestamp: string;
  server: {
    status: 'healthy' | 'degraded' | 'failing';
    uptimeSeconds: number;
    nodeVersion: string;
    memoryUsage: {
      rssMb: number;
      heapTotalMb: number;
      heapUsedMb: number;
      externalMb: number;
    };
  };
  firestore: {
    status: 'connected' | 'disconnected' | 'unknown';
    latencyMs?: number;
    note: string;
  };
  telemetry: {
    runtimeAuthFailureCount: number;
    runtimeFailedWebhooksCount: number;
    disclaimer: string;
  };
}
