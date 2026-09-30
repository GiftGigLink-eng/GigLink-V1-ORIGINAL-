/**
 * Privileged CEO / Platform Owner Service (Stage 1 & Stage 2)
 *
 * Interacts with server-authoritative CEO verification endpoints.
 * Never relies on client-side state, localStorage, or Firestore profile documents.
 * All queries are strictly READ-ONLY.
 */

import { getApi } from './apiClient';
import {
  CeoAuthCheckResponse,
  CeoOverviewResponse,
  CeoFinancialsResponse,
  CeoActivityResponse,
  CeoSystemHealthResponse,
  CeoMemberListItem,
  CeoMembersResponse,
  CeoMemberTimeBucket,
} from '../types/ceo';

export type {
  CeoAuthCheckResponse,
  CeoOverviewResponse,
  CeoFinancialsResponse,
  CeoActivityResponse,
  CeoSystemHealthResponse,
  CeoMemberListItem,
  CeoMembersResponse,
  CeoMemberTimeBucket,
};

/**
 * Validates the caller's Firebase ID token against the server-authoritative CEO endpoint.
 * Returns CeoAuthCheckResponse if authorized, or null if unauthorized/forbidden.
 */
export async function verifyCeoSession(idToken: string): Promise<CeoAuthCheckResponse | null> {
  if (!idToken) return null;

  try {
    const data = await getApi<CeoAuthCheckResponse>('/api/ceo/auth-check', {
      Authorization: `Bearer ${idToken}`,
    });

    if (data && data.isCeo) {
      return data;
    }
    return null;
  } catch (err: any) {
    // 401 Unauthorized or 403 Forbidden indicate lack of CEO authority
    return null;
  }
}

/**
 * Retrieves executive platform overview metrics (members, opportunities, applications, contracts).
 */
export async function getCeoOverview(idToken: string): Promise<CeoOverviewResponse> {
  if (!idToken) throw new Error('Authentication required');

  return await getApi<CeoOverviewResponse>('/api/ceo/overview', {
    Authorization: `Bearer ${idToken}`,
  });
}

/**
 * Retrieves executive member directory list (strictly read-only).
 */
export async function getCeoMembers(idToken: string): Promise<CeoMembersResponse> {
  if (!idToken) throw new Error('Authentication required');

  return await getApi<CeoMembersResponse>('/api/ceo/members', {
    Authorization: `Bearer ${idToken}`,
  });
}

/**
 * Retrieves executive financial and escrow metrics by currency.
 */
export async function getCeoFinancials(idToken: string): Promise<CeoFinancialsResponse> {
  if (!idToken) throw new Error('Authentication required');

  return await getApi<CeoFinancialsResponse>('/api/ceo/financials', {
    Authorization: `Bearer ${idToken}`,
  });
}

/**
 * Retrieves sanitized executive platform activity stream.
 */
export async function getCeoActivity(idToken: string): Promise<CeoActivityResponse> {
  if (!idToken) throw new Error('Authentication required');

  return await getApi<CeoActivityResponse>('/api/ceo/activity', {
    Authorization: `Bearer ${idToken}`,
  });
}

/**
 * Retrieves platform server and database operational health.
 */
export async function getCeoSystemHealth(idToken: string): Promise<CeoSystemHealthResponse> {
  if (!idToken) throw new Error('Authentication required');

  return await getApi<CeoSystemHealthResponse>('/api/ceo/system-health', {
    Authorization: `Bearer ${idToken}`,
  });
}
