/**
 * Client-side trigger for Server-Authoritative Trust Score & Projection Recalculation.
 */

import { auth } from '../config/firebase';

export async function requestAuthoritativeTrustRecalculation(targetUid?: string): Promise<{
  success: boolean;
  isPublic?: boolean;
  trustScore?: number;
  trustTier?: string;
  error?: string;
}> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: 'User is not authenticated' };
    }

    const idToken = await currentUser.getIdToken();
    const resp = await fetch('/api/trust-passport/recalculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        targetUid: targetUid || currentUser.uid,
      }),
    });

    if (!resp.ok) {
      const errJson = await resp.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error || `Server returned status ${resp.status}`,
      };
    }

    const data = await resp.json();
    return {
      success: true,
      isPublic: data.isPublic,
      trustScore: data.trustScore,
      trustTier: data.trustTier,
    };
  } catch (err: any) {
    console.warn('[requestAuthoritativeTrustRecalculation] Sync request failed:', err);
    return { success: false, error: err.message || String(err) };
  }
}
