/**
 * Cryptographic 6-Digit Email OTP Verification Service (GigLink V1)
 *
 * Security & Functional Invariants:
 * 1. Cryptographically secure 6-digit random code generation (100000 - 999999).
 * 2. Raw OTP is never persisted in Firestore or shared memory — only HMAC-SHA256 hash.
 * 3. 10-minute expiration window (600,000 ms).
 * 4. Maximum 5 incorrect attempt limit (locks and invalidates code on exhaustion).
 * 5. Single-use guarantee (instantly cleared upon successful verification).
 * 6. 60-second cooldown rate protection on resends.
 * 7. Constant-time timing-safe hash comparison to thwart side-channel timing attacks.
 * 8. Automatic invalidation of previous OTPs when a fresh code is requested.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const OTP_SECRET = process.env.OTP_SECRET || 'giglink-v1-otp-secret-salt-2026-auth';
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;
const PERSISTENCE_FILE_PATH = path.join('/tmp', '.giglink_otp_store.json');

export interface OtpSessionRecord {
  userId: string;
  email: string;
  otpHash: string;
  oobCode?: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: number;
  lastSentAt: number;
  isLocked: boolean;
}

export interface SendOtpOptions {
  userId: string;
  email: string;
  idToken?: string;
  oobCode?: string;
  forceBypassCooldown?: boolean;
}

export interface SendOtpResult {
  success: boolean;
  message: string;
  cooldownRemaining: number;
  expiresAt: number;
  devCode?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  error?: string;
  code?: 'OTP_INVALID' | 'OTP_EXPIRED' | 'OTP_LOCKED' | 'NOT_FOUND' | 'ALREADY_VERIFIED';
  remainingAttempts?: number;
  oobCode?: string;
}

export class OtpManager {
  private sessions: Map<string, OtpSessionRecord> = new Map();
  private enablePersistence: boolean = true;

  constructor(enablePersistence = true) {
    this.enablePersistence = enablePersistence;
    if (this.enablePersistence) {
      this.loadFromDisk();
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(PERSISTENCE_FILE_PATH)) {
        const raw = fs.readFileSync(PERSISTENCE_FILE_PATH, 'utf-8');
        const data: Record<string, OtpSessionRecord> = JSON.parse(raw);
        const now = Date.now();
        for (const [k, rec] of Object.entries(data)) {
          if (rec && rec.expiresAt > now) {
            this.sessions.set(k, rec);
          }
        }
      }
    } catch {
      // Non-blocking fallback to in-memory store
    }
  }

  private saveToDisk(): void {
    if (!this.enablePersistence) return;
    try {
      const now = Date.now();
      const obj: Record<string, OtpSessionRecord> = {};
      for (const [k, rec] of this.sessions.entries()) {
        if (rec && rec.expiresAt > now) {
          obj[k] = rec;
        }
      }
      fs.writeFileSync(PERSISTENCE_FILE_PATH, JSON.stringify(obj), 'utf-8');
    } catch {
      // Non-blocking
    }
  }

  /**
   * Generates a cryptographically secure 6-digit OTP string.
   */
  public generateSecureOtp(): string {
    const num = crypto.randomInt(100000, 1000000);
    return num.toString();
  }

  /**
   * Hashes the 6-digit OTP using HMAC-SHA256.
   */
  public hashOtp(otp: string): string {
    return crypto
      .createHmac('sha256', OTP_SECRET)
      .update(otp.trim())
      .digest('hex');
  }

  private getKey(userId: string, email: string): string {
    return `${userId.trim().toLowerCase()}_${email.trim().toLowerCase()}`;
  }

  /**
   * Dispatches or generates a new 6-digit OTP with 60s cooldown enforcement.
   */
  public sendOtp(options: SendOtpOptions): SendOtpResult {
    const { userId, email, oobCode, forceBypassCooldown } = options;
    const key = this.getKey(userId, email);
    const now = Date.now();

    const existing = this.sessions.get(key);
    if (existing && !forceBypassCooldown) {
      const elapsed = now - existing.lastSentAt;
      if (elapsed < RESEND_COOLDOWN_MS) {
        const remainingSecs = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return {
          success: false,
          message: `Please wait ${remainingSecs}s before requesting another verification code.`,
          cooldownRemaining: remainingSecs,
          expiresAt: existing.expiresAt,
        };
      }
    }

    // Generate fresh OTP
    const rawOtp = this.generateSecureOtp();
    const otpHash = this.hashOtp(rawOtp);
    const expiresAt = now + OTP_EXPIRY_MS;

    // Overwrite previous OTP (invalidating previous codes)
    const newRecord: OtpSessionRecord = {
      userId,
      email: email.trim().toLowerCase(),
      otpHash,
      oobCode,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      expiresAt,
      lastSentAt: now,
      isLocked: false,
    };

    this.sessions.set(key, newRecord);

    // Also index by email only for flexible cross-device lookup
    this.sessions.set(`email_${email.trim().toLowerCase()}`, newRecord);
    this.saveToDisk();

    console.log(`[GigLink OTP Service] Generated 6-digit OTP for ${email}. Expires in 10m.`);

    return {
      success: true,
      message: `A 6-digit verification code has been dispatched to ${email}.`,
      cooldownRemaining: 60,
      expiresAt,
      // Provide devCode in non-production for testing/developer preview
      devCode: process.env.NODE_ENV !== 'production' ? rawOtp : undefined,
    };
  }

  /**
   * Verifies the submitted 6-digit OTP with timing-safe comparison, attempt limits, and single-use invalidation.
   */
  public verifyOtp(userId: string, email: string, inputOtp: string): VerifyOtpResult {
    const key = this.getKey(userId, email);
    let record = this.sessions.get(key);

    if (!record) {
      // Fallback lookup by email
      record = this.sessions.get(`email_${email.trim().toLowerCase()}`);
    }

    if (!record) {
      return {
        success: false,
        error: 'No active verification code found. Please request a new code.',
        code: 'NOT_FOUND',
      };
    }

    const now = Date.now();

    // Check expiration
    if (now > record.expiresAt) {
      this.sessions.delete(key);
      this.sessions.delete(`email_${email.trim().toLowerCase()}`);
      this.saveToDisk();
      return {
        success: false,
        error: 'Verification code has expired (10-minute limit). Please request a new one.',
        code: 'OTP_EXPIRED',
      };
    }

    // Check if locked due to previous excessive attempts
    if (record.isLocked || record.attempts >= record.maxAttempts) {
      this.sessions.delete(key);
      this.sessions.delete(`email_${email.trim().toLowerCase()}`);
      this.saveToDisk();
      return {
        success: false,
        error: 'Too many failed attempts. This code has been locked. Please request a new code.',
        code: 'OTP_LOCKED',
      };
    }

    // Validate code format
    const cleanedInput = (inputOtp || '').trim().replace(/\D/g, '');
    if (cleanedInput.length !== 6) {
      return {
        success: false,
        error: 'Please enter a valid 6-digit code.',
        code: 'OTP_INVALID',
      };
    }

    // Timing-safe comparison
    const inputHash = this.hashOtp(cleanedInput);
    const inputHashBuf = Buffer.from(inputHash, 'utf8');
    const storedHashBuf = Buffer.from(record.otpHash, 'utf8');

    const isMatch =
      inputHashBuf.length === storedHashBuf.length &&
      crypto.timingSafeEqual(inputHashBuf, storedHashBuf);

    if (!isMatch) {
      record.attempts += 1;
      const remainingAttempts = record.maxAttempts - record.attempts;

      if (remainingAttempts <= 0) {
        record.isLocked = true;
        this.sessions.delete(key);
        this.sessions.delete(`email_${email.trim().toLowerCase()}`);
        this.saveToDisk();
        return {
          success: false,
          error: 'Too many incorrect attempts. This code has been locked for your security. Please request a fresh code.',
          code: 'OTP_LOCKED',
          remainingAttempts: 0,
        };
      }

      this.saveToDisk();
      return {
        success: false,
        error: `Incorrect verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`,
        code: 'OTP_INVALID',
        remainingAttempts,
      };
    }

    // SUCCESS: Invalidate single-use code immediately
    const savedOobCode = record.oobCode;
    this.sessions.delete(key);
    this.sessions.delete(`email_${email.trim().toLowerCase()}`);
    this.saveToDisk();

    return {
      success: true,
      oobCode: savedOobCode,
    };
  }

  /**
   * Resets active session records (used for test teardowns).
   */
  public clearAll(): void {
    this.sessions.clear();
    this.saveToDisk();
  }

  /**
   * Inspects active session count (for telemetry / testing).
   */
  public getActiveCount(): number {
    return this.sessions.size;
  }
}

export const defaultOtpManager = new OtpManager();
