import { postApi } from './apiClient';
import { auth } from '../config/firebase';
import { IlAiClientRequest, IlAiGuidancePayload } from '../types';

const SESSION_STORAGE_KEY = 'giglink_il_session_ts';

export interface SessionContextHints {
  localHour: number;
  timezone: string;
  locale: string;
  lastSeenTimestamp?: number;
}

/**
 * Captures browser-local time hints and maintains lightweight session timestamps
 * in localStorage for returning member and same-day return awareness.
 */
export function captureSessionTimeHints(): SessionContextHints {
  const now = new Date();
  const localHour = now.getHours();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const locale = navigator.language || 'en-US';

  let lastSeenTimestamp: number | undefined;
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 0) {
        lastSeenTimestamp = parsed;
      }
    }
    // Update last seen to now
    localStorage.setItem(SESSION_STORAGE_KEY, String(Date.now()));
  } catch {
    // Graceful fallback if storage is restricted
  }

  return {
    localHour,
    timezone,
    locale,
    lastSeenTimestamp,
  };
}

/**
 * Requests authenticated guidance from the GigLink Intelligence Layer (IL AI) V1 Gateway.
 */
export async function fetchIlAiGuidance(
  request: IlAiClientRequest
): Promise<IlAiGuidancePayload> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Member must be authenticated to access GigLink Intelligence Layer.');
  }

  const idToken = await currentUser.getIdToken();
  const timeHints = captureSessionTimeHints();

  const payload = {
    ...request,
    timeHints,
  };

  const response = await postApi<{ success: boolean; guidance: IlAiGuidancePayload }>(
    '/api/ai/v1/guidance',
    payload,
    {
      Authorization: `Bearer ${idToken}`,
    }
  );

  return response.guidance;
}
