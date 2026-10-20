/**
 * GigLink API Client & Service Gateway
 *
 * Directs frontend calls to backend microservices (Payments, Gemini Advisory, Auth OTP).
 * When running on static hosting (such as Firebase Hosting on the Spark plan) without
 * a configured backend, it provides clean, graceful diagnostics instead of unhandled
 * HTML/JSON parsing crashes.
 */

import { auth } from '../config/firebase';

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class BackendUnavailableError extends Error {
  public readonly isBackendUnavailable = true;
  public readonly endpoint: string;

  constructor(endpoint: string, message: string) {
    super(message);
    this.name = 'BackendUnavailableError';
    this.endpoint = endpoint;
  }
}

async function getAuthHeaders(existingHeaders?: Record<string, string>): Promise<Record<string, string>> {
  const merged: Record<string, string> = { ...existingHeaders };
  if (!merged.Authorization && !merged.authorization) {
    try {
      if (auth?.currentUser) {
        const token = await auth.currentUser.getIdToken();
        if (token) {
          merged.Authorization = `Bearer ${token}`;
        }
      }
    } catch {
      // Gracefully continue without bearer if offline or unauthenticated
    }
  }
  return merged;
}

export async function postApi<T = any>(
  endpoint: string,
  body: any,
  headers?: Record<string, string>
): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  const resolvedHeaders = await getAuthHeaders(headers);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...resolvedHeaders,
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr: any) {
    throw new BackendUnavailableError(
      normalizedEndpoint,
      `Backend service is unreachable at ${url}. ${networkErr?.message || 'Network connection failed.'}`
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    // Under Firebase Hosting SPA rewrites, non-existent /api/* routes rewrite to index.html
    throw new BackendUnavailableError(
      normalizedEndpoint,
      `The backend endpoint '${normalizedEndpoint}' returned static HTML. The GigLink server-side microservice is not hosted at this domain. Ensure an external backend service is running and configured via VITE_API_BASE_URL.`
    );
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new BackendUnavailableError(
      normalizedEndpoint,
      `Invalid response format received from '${normalizedEndpoint}'. Expected JSON response.`
    );
  }

  if (!response.ok) {
    const error: any = new Error(data?.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.code = data?.code;
    error.cooldownRemaining = data?.cooldownRemaining;
    error.remainingAttempts = data?.remainingAttempts;
    error.data = data;
    throw error;
  }

  return data as T;
}

export async function getApi<T = any>(
  endpoint: string,
  headers?: Record<string, string>
): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  const resolvedHeaders = await getAuthHeaders(headers);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...resolvedHeaders,
      },
    });
  } catch (networkErr: any) {
    throw new BackendUnavailableError(
      normalizedEndpoint,
      `Backend service is unreachable at ${url}. ${networkErr?.message || 'Network connection failed.'}`
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new BackendUnavailableError(
      normalizedEndpoint,
      `The backend endpoint '${normalizedEndpoint}' returned static HTML.`
    );
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new BackendUnavailableError(
      normalizedEndpoint,
      `Invalid response format received from '${normalizedEndpoint}'. Expected JSON response.`
    );
  }

  if (!response.ok) {
    const error: any = new Error(data?.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.code = data?.code;
    error.data = data;
    throw error;
  }

  return data as T;
}
