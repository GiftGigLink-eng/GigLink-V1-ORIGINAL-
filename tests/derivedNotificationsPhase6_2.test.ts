import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import fs from 'fs';
import {
  deriveApplicantNotification,
  deriveCreatorNotification,
  deriveVerificationNotification,
  getReadNotificationIds,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../src/lib/notificationService';
import { OpportunityApplication } from '../src/types';

describe('Phase 6.2: Authoritative Derived Notification System', () => {
  beforeEach(() => {
    // Reset simulated localStorage if available in environment
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.clear();
    }
  });

  describe('1. Applicant Notification Derivation & State Machine', () => {
    const baseApp: OpportunityApplication & { id: string } = {
      id: 'opp_101_user_applicant_1',
      opportunityId: 'opp_101',
      opportunityTitle: 'Senior Full Stack Engineer',
      opportunityCreatorId: 'user_creator_88',
      applicantId: 'user_applicant_1',
      applicantDisplayName: 'Alice Candidate',
      applicantEmail: 'alice@example.com',
      applicantTrustTier: 'Verified Pro',
      applicantTrustScore: 70,
      applicantIdentityVerified: true,
      coverNote: 'Excited to contribute to this project.',
      status: 'submitted',
      submittedAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T00:00:00.000Z',
    };

    test('1.1 submitted status derives application_submitted notification', () => {
      const notif = deriveApplicantNotification(baseApp, 'Senior Full Stack Engineer', false);
      assert.ok(notif, 'Notification should be created');
      assert.strictEqual(notif.userId, 'user_applicant_1');
      assert.strictEqual(notif.type, 'application_submitted');
      assert.strictEqual(notif.linkUrl, '/my-applications');
      assert.strictEqual(notif.read, false);
      assert.ok(notif.message.includes('Senior Full Stack Engineer'));
    });

    test('1.2 under_review status derives application_under_review notification', () => {
      const reviewApp = { ...baseApp, status: 'under_review' as const };
      const notif = deriveApplicantNotification(reviewApp, 'Senior Full Stack Engineer', false);
      assert.ok(notif);
      assert.strictEqual(notif.type, 'application_under_review');
      assert.ok(notif.message.includes('actively reviewing'));
    });

    test('1.3 shortlisted status derives application_shortlisted notification', () => {
      const shortlistApp = { ...baseApp, status: 'shortlisted' as const };
      const notif = deriveApplicantNotification(shortlistApp, 'Senior Full Stack Engineer', false);
      assert.ok(notif);
      assert.strictEqual(notif.type, 'application_shortlisted');
      assert.ok(notif.title.includes('Shortlisted'));
    });

    test('1.4 accepted status derives application_accepted notification', () => {
      const acceptApp = { ...baseApp, status: 'accepted' as const };
      const notif = deriveApplicantNotification(acceptApp, 'Senior Full Stack Engineer', false);
      assert.ok(notif);
      assert.strictEqual(notif.type, 'application_accepted');
      assert.ok(notif.message.includes('accepted'));
    });

    test('1.5 declined status derives application_declined notification', () => {
      const declineApp = { ...baseApp, status: 'declined' as const };
      const notif = deriveApplicantNotification(declineApp, 'Senior Full Stack Engineer', false);
      assert.ok(notif);
      assert.strictEqual(notif.type, 'application_declined');
      assert.ok(notif.message.includes('decision'));
    });

    test('1.6 withdrawn status derives application_withdrawn notification', () => {
      const withdrawApp = { ...baseApp, status: 'withdrawn' as const };
      const notif = deriveApplicantNotification(withdrawApp, 'Senior Full Stack Engineer', false);
      assert.ok(notif);
      assert.strictEqual(notif.type, 'application_withdrawn');
      assert.ok(notif.message.includes('withdrew'));
    });
  });

  describe('2. Creator Notification Derivation & Recipient Isolation', () => {
    const creatorApp: OpportunityApplication & { id: string; opportunityCreatorId: string } = {
      id: 'opp_202_user_applicant_2',
      opportunityId: 'opp_202',
      opportunityTitle: 'Smart Contract Auditor',
      opportunityCreatorId: 'user_creator_99',
      applicantId: 'user_applicant_2',
      applicantDisplayName: 'Bob Builder',
      applicantEmail: 'bob@example.com',
      applicantTrustTier: 'Silver Verified',
      applicantTrustScore: 60,
      applicantIdentityVerified: true,
      coverNote: 'Audited 12 DeFi protocols.',
      status: 'submitted',
      submittedAt: '2026-08-19T01:00:00.000Z',
      updatedAt: '2026-08-19T01:00:00.000Z',
    };

    test('2.1 New candidate submission notifies creator with direct management URL', () => {
      const notif = deriveCreatorNotification(creatorApp, 'Smart Contract Auditor', false);
      assert.ok(notif);
      assert.strictEqual(notif.userId, 'user_creator_99');
      assert.strictEqual(notif.linkUrl, '/opportunities/opp_202/applications');
      assert.strictEqual(notif.actorName, 'Bob Builder');
      assert.ok(notif.message.includes('Bob Builder applied'));
    });

    test('2.2 Candidate withdrawal notifies creator', () => {
      const withdrawn = { ...creatorApp, status: 'withdrawn' as const };
      const notif = deriveCreatorNotification(withdrawn, 'Smart Contract Auditor', false);
      assert.ok(notif);
      assert.strictEqual(notif.userId, 'user_creator_99');
      assert.ok(notif.message.includes('withdrew their application'));
    });

    test('2.3 Creator notifications are NOT generated for applicant actions in terminal review states', () => {
      const underReview = { ...creatorApp, status: 'under_review' as const };
      const notif = deriveCreatorNotification(underReview, 'Smart Contract Auditor', false);
      assert.strictEqual(notif, null, 'Creator should not receive notifications for their own internal review transitions');
    });

    test('2.4 Missing creator ID safely returns null with zero exception', () => {
      const orphanApp = { ...creatorApp, opportunityCreatorId: undefined };
      const notif = deriveCreatorNotification(orphanApp, 'Smart Contract Auditor', false);
      assert.strictEqual(notif, null);
    });
  });

  describe('3. Trust & Verification Notifications', () => {
    test('3.1 Approved identity verification derives +40 Trust notification', () => {
      const verif = {
        id: 'verif_doc_555',
        userId: 'user_student_10',
        status: 'verified' as const,
        documentType: 'National ID',
        submittedAt: '2026-08-19T02:00:00.000Z',
        reviewedAt: '2026-08-19T02:30:00.000Z',
      };
      const notif = deriveVerificationNotification(verif, false);
      assert.ok(notif);
      assert.strictEqual(notif.userId, 'user_student_10');
      assert.strictEqual(notif.type, 'verification_verified');
      assert.strictEqual(notif.linkUrl, '/profile');
      assert.ok(notif.title.includes('+40 Trust'));
    });

    test('3.2 Rejected verification derives actionable review notification', () => {
      const verif = {
        id: 'verif_doc_556',
        userId: 'user_student_10',
        status: 'rejected' as const,
        documentType: 'Passport',
        submittedAt: '2026-08-19T02:00:00.000Z',
        reviewedAt: '2026-08-19T02:30:00.000Z',
      };
      const notif = deriveVerificationNotification(verif, false);
      assert.ok(notif);
      assert.strictEqual(notif.userId, 'user_student_10');
      assert.strictEqual(notif.type, 'verification_rejected');
      assert.strictEqual(notif.linkUrl, '/profile');
    });

    test('3.3 Pending verification produces zero premature notification', () => {
      const verif = {
        id: 'verif_doc_557',
        userId: 'user_student_10',
        status: 'pending' as const,
        documentType: 'Passport',
      };
      const notif = deriveVerificationNotification(verif, false);
      assert.strictEqual(notif, null);
    });
  });

  describe('4. Local Storage Read State & Isolation', () => {
    // Mock localStorage in Node test environment if not present
    class MockStorage {
      private store: Record<string, string> = {};
      getItem(key: string) {
        return this.store[key] || null;
      }
      setItem(key: string, value: string) {
        this.store[key] = value;
      }
      clear() {
        this.store = {};
      }
    }

    const mockStorage = new MockStorage();
    const originalLocalStorage = globalThis.localStorage;

    beforeEach(() => {
      (globalThis as any).localStorage = mockStorage;
      mockStorage.clear();
    });

    test('4.1 Reading notifications stores IDs isolated by userId', () => {
      markNotificationAsRead('user_alice', 'notif_1');
      markNotificationAsRead('user_alice', 'notif_2');
      markNotificationAsRead('user_bob', 'notif_3');

      const aliceRead = getReadNotificationIds('user_alice');
      const bobRead = getReadNotificationIds('user_bob');

      assert.strictEqual(aliceRead.has('notif_1'), true);
      assert.strictEqual(aliceRead.has('notif_2'), true);
      assert.strictEqual(aliceRead.has('notif_3'), false, 'Alice should NOT have Bob notifications');

      assert.strictEqual(bobRead.has('notif_3'), true);
      assert.strictEqual(bobRead.has('notif_1'), false);
    });

    test('4.2 markAllNotificationsAsRead marks batch cleanly', () => {
      markAllNotificationsAsRead('user_carol', ['notif_a', 'notif_b', 'notif_c']);
      const carolRead = getReadNotificationIds('user_carol');
      assert.strictEqual(carolRead.size, 3);
      assert.strictEqual(carolRead.has('notif_a'), true);
      assert.strictEqual(carolRead.has('notif_b'), true);
      assert.strictEqual(carolRead.has('notif_c'), true);
    });
  });

  describe('5. Security & Rule Checksum Invariant', () => {
    test('5.1 firestore.rules retains exact SHA-256 checksum without changes', () => {
      const content = fs.readFileSync('firestore.rules', 'utf8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      assert.strictEqual(
        hash,
        '667e03431c26c17293ad78bff2c87a385e093fe3b6c902bd0d57f529a43500ce',
        'firestore.rules must NOT be modified in Phase 6.2'
      );
    });

    test('5.2 No unauthorized /notifications collection introduced', () => {
      const content = fs.readFileSync('firestore.rules', 'utf8');
      assert.strictEqual(
        content.includes('match /notifications'),
        false,
        'No /notifications collection should exist in firestore.rules'
      );
    });
  });
});
