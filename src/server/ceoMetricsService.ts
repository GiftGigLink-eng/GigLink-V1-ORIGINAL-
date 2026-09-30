/**
 * Server-Side CEO Read-Only Metrics & Intelligence Engine (Stage 2)
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Strictly READ-ONLY. Contains zero mutation functions, zero payments/escrow releases,
 *    and zero role changes.
 * 2. Directly queries canonical verified GigLink collections via server-side Firebase Admin SDK
 *    targeting project 'giglink-bf27b' with Google Application Default Credentials (ADC).
 *    Canonical collections:
 *    - users
 *    - opportunities
 *    - applications
 *    - contracts
 *    - financialLedger
 *    - webhookEvents
 * 3. Never creates or queries duplicate collections (no 'escrows', 'transactions', 'ceo_metrics', 'audit_logs').
 * 4. Explicit Error Handling: Genuine Firestore query/permission/authentication failures
 *    are NEVER silently caught and converted to 0 or empty arrays. Real failures throw
 *    and bubble up as explicit server errors (HTTP 500) to distinguish failures from authentic zero data.
 * 5. Financial Invariant: Historical settled volume and platform fee aggregation uses the canonical
 *    'milestone_released' ledger event ONLY. A subsequent 'payout_completed' record for the same
 *    milestone is NOT counted as another settlement event (preventing double-counting).
 *    Currency separation is strictly preserved. Escrow is never counted as platform revenue.
 * 6. Sanitizes all activity and executive summaries: NEVER leaks PII (emails, phone numbers,
 *    passwords, tokens, KYC submissions, etc.).
 * 7. Completely decoupled from Personal AI (no AI models, no Gemini SDK, no chatbot logic).
 */

import { getAdminFirestore, getTargetProjectId } from './firebaseAdmin';
import {
  CeoOverviewResponse,
  CeoFinancialsResponse,
  CeoActivityResponse,
  CeoSystemHealthResponse,
  CeoCurrencyFinancials,
  CeoSanitizedActivityItem,
  CeoMemberListItem,
  CeoMembersResponse,
  CeoMemberTimeBucket,
} from '../types/ceo';
import { calculatePlatformFee } from '../lib/financialService';
import {
  UserProfile,
  Opportunity,
  OpportunityApplication,
  GigLinkContract,
  FinancialLedgerRecord,
} from '../types';

// Runtime in-memory counters for process-local telemetry
let runtimeAuthFailureCounter = 0;
let runtimeWebhookFailureCounter = 0;

export function recordRuntimeAuthFailure(): void {
  runtimeAuthFailureCounter++;
}

export function recordRuntimeWebhookFailure(): void {
  runtimeWebhookFailureCounter++;
}

/**
 * Derives executive platform overview metrics.
 * Uses Firebase Admin Firestore targeting giglink-bf27b.
 * If Firestore queries fail (e.g. permission/network failure), throws an explicit error.
 */
export async function getAuthoritativeCeoOverview(): Promise<CeoOverviewResponse> {
  const adminDb = getAdminFirestore();
  const now = new Date();
  const startOfTodayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
  const sevenDaysAgoUtc = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  // 1. Members
  let totalMembers = 0;
  let newMembersToday = 0;
  let newMembersLast7Days = 0;
  const membersByPersona: Record<string, number> = {
    learner: 0,
    partner: 0,
    client: 0,
    organization_admin: 0,
  };

  const usersSnap = await adminDb.collection('users').get();
  totalMembers = usersSnap.size;
  usersSnap.forEach((docSnap) => {
    const u = docSnap.data() as UserProfile;
    const createdTime = u.createdAt ? new Date(u.createdAt).getTime() : 0;
    if (createdTime >= startOfTodayUtc) {
      newMembersToday++;
    }
    if (createdTime >= sevenDaysAgoUtc) {
      newMembersLast7Days++;
    }

    const persona = u.activePersona || 'learner';
    membersByPersona[persona] = (membersByPersona[persona] || 0) + 1;
  });

  // 2. Opportunities (Canonical collection 'opportunities')
  let totalOpportunities = 0;
  const oppsByStatus: Record<string, number> = {};

  const oppsSnap = await adminDb.collection('opportunities').get();
  totalOpportunities = oppsSnap.size;
  oppsSnap.forEach((docSnap) => {
    const opp = docSnap.data() as Opportunity;
    const st = opp.status || 'open';
    oppsByStatus[st] = (oppsByStatus[st] || 0) + 1;
  });

  // 3. Applications (Canonical collection 'applications')
  let totalApplications = 0;
  const appsByStatus: Record<string, number> = {};

  const appsSnap = await adminDb.collection('applications').get();
  totalApplications = appsSnap.size;
  appsSnap.forEach((docSnap) => {
    const app = docSnap.data() as OpportunityApplication;
    const st = app.status || 'submitted';
    appsByStatus[st] = (appsByStatus[st] || 0) + 1;
  });

  // 4. Contracts (Canonical collection 'contracts')
  let totalContracts = 0;
  let activeContracts = 0;
  let completedContracts = 0;
  const contractsByStatus: Record<string, number> = {};

  const contractsSnap = await adminDb.collection('contracts').get();
  totalContracts = contractsSnap.size;
  contractsSnap.forEach((docSnap) => {
    const c = docSnap.data() as GigLinkContract;
    const st = c.status || 'draft';
    contractsByStatus[st] = (contractsByStatus[st] || 0) + 1;
    if (st === 'active') activeContracts++;
    if (st === 'completed') completedContracts++;
  });

  return {
    timestamp: now.toISOString(),
    members: {
      totalMembers,
      newMembersToday,
      newMembersLast7Days,
      membersByPersona,
    },
    opportunities: {
      totalOpportunities,
      byStatus: oppsByStatus,
    },
    applications: {
      totalApplications,
      byStatus: appsByStatus,
    },
    contracts: {
      totalContracts,
      activeContracts,
      completedContracts,
      byStatus: contractsByStatus,
    },
  };
}

/**
 * Retrieves the authoritative, sanitized member directory for the CEO Control Center.
 * Strictly READ-ONLY.
 * 
 * Data sanitization guarantees:
 * - Reads directly from the canonical 'users' collection via Admin SDK.
 * - Explicitly excludes sensitive PII (emails, phone numbers, KYC/financial info).
 * - NEVER exposes raw allowedRoles or treats allowedRoles as authorization.
 * - Computes explicit UTC time buckets:
 *   - today: calendar UTC day [00:00:00.000 UTC to now]
 *   - last_7_days: rolling 168 hours [now - 7*24h to now]
 *   - last_30_days: rolling 720 hours [now - 30*24h to now]
 *   - older: created > 720 hours ago
 * - Uses createdAt ONLY (never updatedAt) for creation age.
 */
export async function getAuthoritativeCeoMembers(): Promise<CeoMembersResponse> {
  const adminDb = getAdminFirestore();
  const now = new Date();
  const startOfTodayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
  const sevenDaysAgoUtc = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgoUtc = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  const usersSnap = await adminDb.collection('users').get();
  const members: CeoMemberListItem[] = [];

  usersSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const createdAtStr = data.createdAt ? String(data.createdAt) : new Date(0).toISOString();
    const createdTime = new Date(createdAtStr).getTime();

    let timeBucket: CeoMemberTimeBucket = 'older';
    if (createdTime >= startOfTodayUtc) {
      timeBucket = 'today';
    } else if (createdTime >= sevenDaysAgoUtc) {
      timeBucket = 'last_7_days';
    } else if (createdTime >= thirtyDaysAgoUtc) {
      timeBucket = 'last_30_days';
    }

    // Map to canonical persona
    let activePersona: 'learner' | 'partner' | 'client' | 'organization_admin' = 'learner';
    if (
      data.activePersona === 'learner' ||
      data.activePersona === 'partner' ||
      data.activePersona === 'client' ||
      data.activePersona === 'organization_admin'
    ) {
      activePersona = data.activePersona;
    }

    // Safe activeRole (display metadata only)
    const activeRole = typeof data.activeRole === 'string' ? data.activeRole : undefined;

    members.push({
      id: docSnap.id,
      displayName: typeof data.displayName === 'string' && data.displayName.trim() ? data.displayName.trim() : 'New User',
      activePersona,
      activeRole,
      onboardingCompleted: Boolean(data.onboardingCompleted),
      createdAt: createdAtStr,
      timeBucket,
    });
  });

  // Sort descending by creation date (newest members first)
  members.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    timestamp: now.toISOString(),
    totalMembers: members.length,
    members,
  };
}

/**
 * Derives strictly read-only executive financial metrics across currencies.
 * Uses financialLedger for settled history and contracts.milestones for current escrow status.
 *
 * Invariants:
 * - Settled volume and platform fees are counted ONLY from 'milestone_released' events.
 * - 'payout_completed' events are NOT counted as additional settlements (prevents double counting).
 * - Multi-currency buckets remain strictly separated.
 * - Throws on genuine database errors rather than returning fake zero metrics.
 */
export async function getAuthoritativeCeoFinancials(): Promise<CeoFinancialsResponse> {
  const adminDb = getAdminFirestore();
  const byCurrency: Record<string, CeoCurrencyFinancials> = {};

  const ensureCurrencyBucket = (rawCur?: string): CeoCurrencyFinancials => {
    const cur = (rawCur || 'USD').toUpperCase();
    if (!byCurrency[cur]) {
      byCurrency[cur] = {
        currency: cur,
        totalSettledVolume: 0,
        heldEscrow: 0,
        releasedFunds: 0,
        refundedFunds: 0,
        platformFeesCollected: 0,
        disputedEscrow: 0,
        activeContractsWithEscrow: 0,
        totalContractsEvaluated: 0,
        totalLedgerRecords: 0,
      };
    }
    return byCurrency[cur];
  };

  let totalLedgerRecords = 0;
  let fundedEvents = 0;
  let releasedEvents = 0;
  let refundEvents = 0;

  // 1. Process canonical financialLedger
  const ledgerSnap = await adminDb.collection('financialLedger').get();
  totalLedgerRecords = ledgerSnap.size;

  ledgerSnap.forEach((docSnap) => {
    const record = docSnap.data() as FinancialLedgerRecord;
    const bucket = ensureCurrencyBucket(record.currency);
    bucket.totalLedgerRecords++;

    const amount = Number(record.amount) || 0;

    if (record.type === 'milestone_funded') {
      fundedEvents++;
    } else if (record.type === 'milestone_released') {
      releasedEvents++;
      bucket.totalSettledVolume += amount;
      bucket.releasedFunds += amount;
      bucket.platformFeesCollected += Number(record.platformFeeAmount) || 0;
    } else if (record.type === 'refund_completed') {
      refundEvents++;
      bucket.refundedFunds += amount;
    }
    // Note: 'payout_completed' is deliberately ignored here to avoid double-counting
    // settled milestone releases as subsequent transfer payouts.
  });

  // 2. Process contracts for current live Escrow State
  const contractsSnap = await adminDb.collection('contracts').get();
  contractsSnap.forEach((docSnap) => {
    const contract = docSnap.data() as GigLinkContract;
    const cur = (contract.scopeLock?.currency || 'USD').toUpperCase();
    const bucket = ensureCurrencyBucket(cur);
    bucket.totalContractsEvaluated++;

    const milestones = contract.milestones || [];
    let contractHasEscrow = false;

    for (const m of milestones) {
      const milestoneAmount = Number(m.amount) || 0;
      if (m.paymentState === 'held') {
        bucket.heldEscrow += milestoneAmount;
        contractHasEscrow = true;
        if (m.disputeStatus === 'disputed') {
          bucket.disputedEscrow += milestoneAmount;
        }
      }
    }

    if (contractHasEscrow && contract.status === 'active') {
      bucket.activeContractsWithEscrow++;
    }
  });

  // Ensure at least USD bucket exists
  ensureCurrencyBucket('USD');

  return {
    timestamp: new Date().toISOString(),
    byCurrency,
    historicalLedgerSummary: {
      totalRecords: totalLedgerRecords,
      fundedEvents,
      releasedEvents,
      refundEvents,
    },
  };
}

/**
 * Returns a sanitized executive activity feed.
 * Never exposes PII, emails, tokens, or private pitch text.
 * Throws on genuine database errors rather than returning empty array.
 */
export async function getAuthoritativeCeoActivity(): Promise<CeoActivityResponse> {
  const adminDb = getAdminFirestore();
  const events: CeoSanitizedActivityItem[] = [];

  // 1. Recent Users
  const usersSnap = await adminDb.collection('users').limit(15).get();
  usersSnap.forEach((docSnap) => {
    const u = docSnap.data() as UserProfile;
    const persona = u.activePersona || 'learner';
    const label = persona.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    events.push({
      id: `act_usr_${docSnap.id}`,
      type: 'member_joined',
      title: `New member joined as ${label}`,
      timestamp: u.createdAt || new Date().toISOString(),
      category: 'Member',
      statusBadge: 'Active',
    });
  });

  // 2. Recent Opportunities
  const oppsSnap = await adminDb.collection('opportunities').limit(15).get();
  oppsSnap.forEach((docSnap) => {
    const o = docSnap.data() as Opportunity;
    events.push({
      id: `act_opp_${docSnap.id}`,
      type: 'opportunity_created',
      title: `Opportunity published: "${o.title}"`,
      timestamp: o.createdAt || new Date().toISOString(),
      category: o.category || 'General',
      statusBadge: o.status,
    });
  });

  // 3. Recent Applications
  const appsSnap = await adminDb.collection('applications').limit(15).get();
  appsSnap.forEach((docSnap) => {
    const a = docSnap.data() as OpportunityApplication;
    events.push({
      id: `act_app_${docSnap.id}`,
      type: 'application_submitted',
      title: `Application submitted for "${a.opportunityTitle}"`,
      timestamp: a.submittedAt || a.updatedAt || new Date().toISOString(),
      category: 'Opportunity',
      statusBadge: a.status,
    });
  });

  // 4. Completed Collaborations
  const contractsSnap = await adminDb.collection('contracts').limit(15).get();
  contractsSnap.forEach((docSnap) => {
    const c = docSnap.data() as GigLinkContract;
    if (c.status === 'completed') {
      events.push({
        id: `act_con_${docSnap.id}`,
        type: 'collaboration_completed',
        title: `Collaboration completed: "${c.scopeLock?.title || 'Contract'}"`,
        timestamp: c.updatedAt || new Date().toISOString(),
        category: 'Contract',
        statusBadge: 'Completed',
        amountFormatted: `${c.scopeLock?.totalAmount || 0} ${c.scopeLock?.currency || 'USD'}`,
      });
    }
  });

  // 5. Recent Settlements (financialLedger)
  const ledgerSnap = await adminDb.collection('financialLedger').limit(15).get();
  ledgerSnap.forEach((docSnap) => {
    const l = docSnap.data() as FinancialLedgerRecord;
    if (l.type === 'milestone_released') {
      events.push({
        id: `act_led_${docSnap.id}`,
        type: 'settlement_released',
        title: `Escrow milestone released and settled`,
        timestamp: l.completedAt || l.createdAt || new Date().toISOString(),
        category: 'Financial',
        statusBadge: 'Settled',
        amountFormatted: `${l.amount} ${l.currency || 'USD'}`,
      });
    }
  });

  // Sort newest first
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    timestamp: new Date().toISOString(),
    events: events.slice(0, 30),
  };
}

/**
 * Returns platform operational health information.
 * Does not expose raw secrets, tokens, or filesystem paths.
 */
export async function getAuthoritativeCeoSystemHealth(): Promise<CeoSystemHealthResponse> {
  const adminDb = getAdminFirestore();
  const mem = process.memoryUsage();

  let firestoreStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
  let latencyMs = 0;
  const startProbe = Date.now();

  try {
    // Probe Firestore via Admin SDK targeting giglink-bf27b
    await adminDb.collection('publicTrustPassports').limit(1).get();
    latencyMs = Date.now() - startProbe;
    firestoreStatus = 'connected';
  } catch (err: any) {
    latencyMs = Date.now() - startProbe;
    // Distinguish offline/network issues vs permissions
    const msg = err?.message || '';
    if (err?.code === 7 || msg.includes('PERMISSION_DENIED')) {
      // Reached Google Cloud Firestore service, returned permission status
      firestoreStatus = 'connected';
    } else {
      firestoreStatus = 'disconnected';
    }
  }

  return {
    timestamp: new Date().toISOString(),
    server: {
      status: 'healthy',
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memoryUsage: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        externalMb: Math.round(mem.external / 1024 / 1024),
      },
    },
    firestore: {
      status: firestoreStatus,
      latencyMs,
      note: `Target database: ${getTargetProjectId()} (via Firebase Admin SDK ADC)`,
    },
    telemetry: {
      runtimeAuthFailureCount: runtimeAuthFailureCounter,
      runtimeFailedWebhooksCount: runtimeWebhookFailureCounter,
      disclaimer: 'Process-local runtime telemetry for the active server instance. Not a durable historical audit log.',
    },
  };
}
