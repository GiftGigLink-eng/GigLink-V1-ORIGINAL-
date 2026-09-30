/**
 * Standardized Firestore Error Handler conforming to AI Studio Security Guidelines
 */

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export type FirestoreErrorCategory =
  | 'authorization'
  | 'network'
  | 'not_found'
  | 'already_exists'
  | 'validation'
  | 'unknown';

export interface FirestoreErrorInfo {
  category: FirestoreErrorCategory;
  operationType: OperationType;
  collection: string | null;
  sanitizedMessage: string;
}

export class SanitizedFirestoreError extends Error {
  readonly category: FirestoreErrorCategory;
  readonly operationType: OperationType;
  readonly path: string | null;
  readonly userFacingMessage: string;
  readonly isRecoverable: boolean;
  readonly code: string;

  constructor(
    category: FirestoreErrorCategory,
    operationType: OperationType,
    userFacingMessage: string,
    path: string | null = null,
    isRecoverable = false
  ) {
    super(userFacingMessage);
    this.name = 'SanitizedFirestoreError';
    this.category = category;
    this.operationType = operationType;
    this.userFacingMessage = userFacingMessage;
    this.path = path;
    this.isRecoverable = isRecoverable;
    this.code =
      category === 'authorization'
        ? 'permission-denied'
        : category === 'network'
        ? 'unavailable'
        : category === 'not_found'
        ? 'not-found'
        : category === 'already_exists'
        ? 'already-exists'
        : category === 'validation'
        ? 'invalid-argument'
        : 'unknown';
    Object.setPrototypeOf(this, SanitizedFirestoreError.prototype);
  }
}

/**
 * Sanitizes a raw Firestore path or collection path to strictly omit user IDs,
 * document IDs, email addresses, or internal database metadata.
 */
export function sanitizeFirestorePath(rawPath: string | null): string | null {
  if (!rawPath) return null;
  // Strip project/database prefixes if present
  const cleaned = rawPath.replace(/^projects\/[^/]+\/databases\/[^/]+\/documents\/?/, '');
  const segments = cleaned.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  // Return solely the top-level collection identifier (e.g. 'users', 'contracts')
  return segments[0];
}

/**
 * Scrubs any sensitive PII, email addresses, authentication tokens,
 * UIDs, and internal database paths from diagnostic strings.
 */
export function scrubSensitiveInfo(input: unknown): string {
  if (!input) return '';
  const str =
    input instanceof Error
      ? input.message
      : typeof input === 'object'
      ? JSON.stringify(input)
      : String(input);

  return str
    // Redact email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
    // Redact Bearer / JWT / Auth tokens
    .replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, 'Bearer [REDACTED_TOKEN]')
    // Redact internal Firebase project URLs
    .replace(/projects\/[^/]+\/databases\/[^/]+\/documents\/([a-zA-Z0-9_-]+)(\/[a-zA-Z0-9_-]+)*/g, 'projects/.../documents/$1/[REDACTED_ID]')
    // Redact raw UUIDs or long cryptographic hashes
    .replace(/\b[0-9a-fA-F-]{32,}\b/g, '[REDACTED_TOKEN]')
    // Redact UIDs / userId references
    .replace(/(?:uid|userId|user_id)\s*[:=]\s*["']?[a-zA-Z0-9_-]{16,}["']?/gi, 'userId: [REDACTED_UID]')
    // Redact tokens / credentials / secrets
    .replace(/(?:token|auth_token|authToken|secret|apiKey)\s*[:=]\s*["']?[^"'\s,]+["']?/gi, '$1: [REDACTED_TOKEN]');
}

export function classifyFirestoreError(
  error: unknown,
  operationType: OperationType = OperationType.GET
): {
  category: FirestoreErrorCategory;
  userFacingMessage: string;
  isRecoverable: boolean;
} {
  const errMsg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const errCode = (error as any)?.code ? String((error as any).code).toLowerCase() : '';

  if (
    errCode.includes('permission-denied') ||
    errMsg.includes('permission_denied') ||
    errMsg.includes('permission-denied') ||
    errMsg.includes('missing or insufficient permissions') ||
    errMsg.includes('unauthorized') ||
    errCode.includes('unauthenticated') ||
    errMsg.includes('unauthenticated')
  ) {
    const isWrite = [OperationType.CREATE, OperationType.UPDATE, OperationType.DELETE, OperationType.WRITE].includes(operationType);
    return {
      category: 'authorization',
      userFacingMessage: isWrite
        ? "You don't have permission to modify this information."
        : "You don't have permission to access this information.",
      isRecoverable: false,
    };
  }

  if (
    errCode.includes('unavailable') ||
    errCode.includes('deadline-exceeded') ||
    errCode.includes('resource-exhausted') ||
    errMsg.includes('unavailable') ||
    errMsg.includes('deadline-exceeded') ||
    errMsg.includes('the client is offline') ||
    errMsg.includes('offline') ||
    errMsg.includes('backend') ||
    errMsg.includes('failed to fetch') ||
    errMsg.includes('network') ||
    errMsg.includes('transport errored') ||
    errMsg.includes('grpcconnection') ||
    errMsg.includes('connection lost')
  ) {
    return {
      category: 'network',
      userFacingMessage: "We couldn't connect right now. Please check your network and try again.",
      isRecoverable: true,
    };
  }

  if (
    errCode.includes('not-found') ||
    errMsg.includes('not-found') ||
    errMsg.includes('not found') ||
    errMsg.includes('no document to update')
  ) {
    return {
      category: 'not_found',
      userFacingMessage: 'The requested resource was not found.',
      isRecoverable: false,
    };
  }

  if (
    errCode.includes('already-exists') ||
    errMsg.includes('already-exists') ||
    errMsg.includes('already exists')
  ) {
    return {
      category: 'already_exists',
      userFacingMessage: 'This record already exists.',
      isRecoverable: false,
    };
  }

  if (
    errCode.includes('invalid-argument') ||
    errCode.includes('failed-precondition') ||
    errCode.includes('out-of-range') ||
    errMsg.includes('invalid-argument') ||
    errMsg.includes('failed-precondition') ||
    errMsg.includes('out-of-range')
  ) {
    return {
      category: 'validation',
      userFacingMessage: 'The requested operation could not be completed due to invalid parameters.',
      isRecoverable: false,
    };
  }

  return {
    category: 'unknown',
    userFacingMessage: 'Something went wrong while communicating with the database. Please try again.',
    isRecoverable: true,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const classification = classifyFirestoreError(error, operationType);
  const sanitizedPath = sanitizeFirestorePath(path);

  // Diagnostic logging strictly scrubs sensitive information before logging
  const safeMessage = scrubSensitiveInfo(error);
  console.error('[Firestore Diagnostic]:', JSON.stringify({
    category: classification.category,
    operationType,
    collection: sanitizedPath,
    detail: safeMessage.slice(0, 200),
  }));

  // Create sanitized error object that does NOT leak email, uid, providerInfo, or raw internal paths in message or properties
  const sanitizedError = new SanitizedFirestoreError(
    classification.category,
    operationType,
    classification.userFacingMessage,
    sanitizedPath,
    classification.isRecoverable
  );

  throw sanitizedError;
}
