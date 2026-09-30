import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import fs from 'fs';
import {
  deriveApplicantNotification,
  deriveCreatorNotification,
  deriveVerificationNotification,
  deriveContractNotifications,
  getReadNotificationIds,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationWorkspaceDestination,
} from '../src/lib/notificationService';
import { OpportunityApplication, GigLinkContract } from '../src/types';

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
        '516cff2670d96ed84dd0e16fd14dd1daabb4f0311458b7b7017368b2c1ac2761',
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

  describe('6. Contract Notifications & Recipient Isolation', () => {
    const baseContract = {
      id: 'contract_xyz_777',
      opportunityId: 'opp_alpha',
      opportunityTitle: 'Senior Rust Protocol Engineer',
      applicationId: 'app_123',
      creatorId: 'user_client_1',
      creatorName: 'Aether Capital',
      talentId: 'user_talent_1',
      talentName: 'Bob Developer',
      status: 'pending_acceptance',
      version: 1,
      scopeLock: {
        totalAmount: 5000,
        currency: 'USD',
        milestones: [{ id: 'm1', title: 'Core Protocol', amount: 5000, currency: 'USD', status: 'pending' }],
      },
      milestones: [
        {
          id: 'm1',
          title: 'Core Protocol',
          amount: 5000,
          currency: 'USD',
          status: 'pending',
          paymentState: 'unfunded',
          reviewState: 'pending',
        },
      ],
      creatorAcceptance: {
        accepted: true,
        acceptedAt: '2026-08-01T10:00:00Z',
      },
      talentAcceptance: {
        accepted: false,
      },
      conversationId: 'conv_contract_xyz_777',
      createdAt: '2026-08-01T09:00:00Z',
      updatedAt: '2026-08-01T10:00:00Z',
    } as unknown as GigLinkContract;

    test('6.1 Talent receives pending sign notification when contract terms are proposed', () => {
      const notifs = deriveContractNotifications(baseContract, 'user_talent_1', false);
      assert.strictEqual(notifs.length, 1);
      assert.strictEqual(notifs[0].type, 'contract_activated');
      assert.strictEqual(notifs[0].id, 'contract_contract_xyz_777_pending_sign');
      assert.strictEqual(notifs[0].linkUrl, '/opportunities/opp_alpha/handoff');
      assert.ok(notifs[0].title.includes('Ready to Sign'));
      assert.ok(notifs[0].message.includes('Senior Rust Protocol Engineer'));
    });

    test('6.2 Unrelated third-party user receives zero notifications for contract', () => {
      const notifs = deriveContractNotifications(baseContract, 'user_eavesdropper_9', false);
      assert.strictEqual(notifs.length, 0, 'Third party must not receive contract notifications');
    });

    test('6.3 Creator does not receive sign prompt for contract they already accepted', () => {
      const notifs = deriveContractNotifications(baseContract, 'user_client_1', false);
      assert.strictEqual(notifs.length, 0);
    });
  });

  describe('7. Milestone Execution Notifications', () => {
    const activeContract = {
      id: 'contract_exec_888',
      opportunityId: 'opp_beta',
      opportunityTitle: 'Full Stack Dashboard',
      applicationId: 'app_456',
      creatorId: 'user_client_1',
      creatorName: 'Client Corp',
      talentId: 'user_talent_1',
      talentName: 'Alice Dev',
      status: 'active',
      version: 1,
      scopeLock: {
        totalAmount: 2000,
        currency: 'USD',
        milestones: [{ id: 'm1', title: 'Frontend UI', amount: 2000, currency: 'USD', status: 'pending' }],
      },
      milestones: [
        {
          id: 'm1',
          title: 'Frontend UI',
          amount: 2000,
          currency: 'USD',
          status: 'pending',
          paymentState: 'held',
          fundedAt: '2026-08-02T10:00:00Z',
          reviewState: 'submitted',
          submission: {
            deliveryNote: 'UI build finished',
            repoUrl: 'https://github.com/repo',
            submittedAt: '2026-08-03T12:00:00Z',
            submittedBy: 'user_talent_1',
          },
          submittedAt: '2026-08-03T12:00:00Z',
        },
      ],
      creatorAcceptance: { accepted: true, acceptedAt: '2026-08-01T10:00:00Z' },
      talentAcceptance: { accepted: true, acceptedAt: '2026-08-01T11:00:00Z' },
      conversationId: 'conv_contract_exec_888',
      createdAt: '2026-08-01T09:00:00Z',
      updatedAt: '2026-08-03T12:00:00Z',
    } as unknown as GigLinkContract;

    test('7.1 Milestone deliverable submitted generates notification for Creator with deterministic ID', () => {
      const notifs = deriveContractNotifications(activeContract, 'user_client_1', false);
      const subNotif = notifs.find((n) => n.type === 'milestone_submitted');
      assert.ok(subNotif, 'Creator must receive milestone_submitted notification');
      assert.strictEqual(subNotif.id, 'milestone_contract_exec_888_m1_submitted');
      assert.ok(subNotif.message.includes('Frontend UI'));
      assert.strictEqual(subNotif.linkUrl, '/opportunities/opp_beta/handoff');
    });

    test('7.2 Revision requested generates notification for Talent with round count and deterministic ID', () => {
      const revisionContract: GigLinkContract = {
        ...activeContract,
        milestones: [
          {
            ...activeContract.milestones[0],
            reviewState: 'revision_requested',
            revisionCount: 2,
            reviewedAt: '2026-08-04T10:00:00Z',
          },
        ],
      };

      const notifs = deriveContractNotifications(revisionContract, 'user_talent_1', false);
      const revNotif = notifs.find((n) => n.type === 'milestone_revision_requested');
      assert.ok(revNotif, 'Talent must receive milestone_revision_requested');
      assert.strictEqual(revNotif.id, 'milestone_contract_exec_888_m1_revision_2');
      assert.ok(revNotif.title.includes('Round 2'));
    });

    test('7.3 Milestone approval generates celebration notification for Talent', () => {
      const approvedContract: GigLinkContract = {
        ...activeContract,
        milestones: [
          {
            ...activeContract.milestones[0],
            reviewState: 'approved',
            approvedAt: '2026-08-05T10:00:00Z',
          },
        ],
      };

      const notifs = deriveContractNotifications(approvedContract, 'user_talent_1', false);
      const appNotif = notifs.find((n) => n.type === 'milestone_approved');
      assert.ok(appNotif, 'Talent must receive milestone_approved');
      assert.strictEqual(appNotif.id, 'milestone_contract_exec_888_m1_approved');
    });

    test('7.4 Final project completion notifies both Talent and Creator', () => {
      const completedContract: GigLinkContract = {
        ...activeContract,
        status: 'completed',
        completedAt: '2026-08-06T15:00:00Z',
      };

      const talentNotifs = deriveContractNotifications(completedContract, 'user_talent_1', false);
      const creatorNotifs = deriveContractNotifications(completedContract, 'user_client_1', false);

      const talentCompleted = talentNotifs.find((n) => n.type === 'project_completed');
      const creatorCompleted = creatorNotifs.find((n) => n.type === 'project_completed');

      assert.ok(talentCompleted);
      assert.ok(creatorCompleted);
      assert.strictEqual(talentCompleted.id, 'project_contract_exec_888_completed');
      assert.strictEqual(creatorCompleted.id, 'project_contract_exec_888_completed');
    });
  });

  describe('8. Financial Notifications & Stable ID Invariant (CRIT-04)', () => {
    const fundedContract = {
      id: 'contract_fin_999',
      opportunityId: 'opp_gamma',
      opportunityTitle: 'DeFi Protocol Audit',
      applicationId: 'app_789',
      creatorId: 'user_client_1',
      creatorName: 'Audit DAO',
      talentId: 'user_talent_1',
      talentName: 'Security Expert',
      status: 'active',
      version: 1,
      scopeLock: {
        totalAmount: 10000,
        currency: 'USD',
        milestones: [{ id: 'm1', title: 'Audit Report', amount: 10000, currency: 'USD', status: 'pending' }],
      },
      milestones: [
        {
          id: 'm1',
          title: 'Audit Report',
          amount: 10000,
          currency: 'USD',
          status: 'pending',
          paymentState: 'held',
          fundedAt: '2026-08-01T12:00:00Z',
          reviewState: 'pending',
        },
      ],
      creatorAcceptance: { accepted: true, acceptedAt: '2026-08-01T10:00:00Z' },
      talentAcceptance: { accepted: true, acceptedAt: '2026-08-01T11:00:00Z' },
      conversationId: 'conv_contract_fin_999',
      createdAt: '2026-08-01T09:00:00Z',
      updatedAt: '2026-08-01T12:00:00Z',
    } as unknown as GigLinkContract;

    test('8.1 Escrow funded notifies Talent that funds are protected with stable ID', () => {
      const notifs = deriveContractNotifications(fundedContract, 'user_talent_1', false);
      const heldNotif = notifs.find((n) => n.type === 'milestone_payment_held');
      assert.ok(heldNotif);
      assert.strictEqual(heldNotif.id, 'financial_held_contract_fin_999_m1');
      assert.ok(heldNotif.message.includes('$10000 USD'));
    });

    test('8.2 Payment release generates payout notification for Talent and settled for Creator', () => {
      const releasedContract: GigLinkContract = {
        ...fundedContract,
        milestones: [
          {
            ...fundedContract.milestones[0],
            paymentState: 'released',
            releasedAt: '2026-08-05T12:00:00Z',
          },
        ],
      };

      const talentNotifs = deriveContractNotifications(releasedContract, 'user_talent_1', false);
      const creatorNotifs = deriveContractNotifications(releasedContract, 'user_client_1', false);

      const tNotif = talentNotifs.find((n) => n.type === 'milestone_payment_released');
      const cNotif = creatorNotifs.find((n) => n.type === 'milestone_payment_released');

      assert.ok(tNotif);
      assert.ok(cNotif);
      assert.strictEqual(tNotif.id, 'financial_released_contract_fin_999_m1');
      assert.strictEqual(cNotif.id, 'financial_released_creator_contract_fin_999_m1');
    });

    test('8.3 CRIT-04 Verification: Additional funding notification ID remains completely stable across contract.updatedAt changes', () => {
      const additionalFundingContract1: GigLinkContract = {
        ...fundedContract,
        updatedAt: '2026-08-02T10:00:00Z',
        milestones: [
          {
            ...fundedContract.milestones[0],
            fundedAmount: 10000,
            requiredFundingAmount: 12500, // Budget increased by $2500
          },
        ],
      };

      const notifsTime1 = deriveContractNotifications(additionalFundingContract1, 'user_client_1', false);
      const addFundNotif1 = notifsTime1.find((n) => n.type === 'additional_funding_required');
      assert.ok(addFundNotif1);
      assert.strictEqual(addFundNotif1.id, 'financial_additional_funding_contract_fin_999_m1');

      // Now simulate unrelated contract edit (e.g. scope note updated, bumping updatedAt)
      const additionalFundingContract2: GigLinkContract = {
        ...additionalFundingContract1,
        updatedAt: '2026-08-10T18:30:00Z', // BUMPED UPDATEDAT
      };

      const notifsTime2 = deriveContractNotifications(additionalFundingContract2, 'user_client_1', false);
      const addFundNotif2 = notifsTime2.find((n) => n.type === 'additional_funding_required');
      assert.ok(addFundNotif2);

      // CRITICAL CHECK: Notification ID MUST remain identical so client localStorage read state does not reset!
      assert.strictEqual(
        addFundNotif2.id,
        addFundNotif1.id,
        'Additional funding notification ID must NOT change when contract.updatedAt changes'
      );
      assert.strictEqual(addFundNotif2.id, 'financial_additional_funding_contract_fin_999_m1');
    });
  });

  describe('9. Change Request Notifications', () => {
    const crContract = {
      id: 'contract_cr_111',
      opportunityId: 'opp_delta',
      opportunityTitle: 'Smart Contract Staking',
      applicationId: 'app_999',
      creatorId: 'user_client_1',
      creatorName: 'Crypto Ventures',
      talentId: 'user_talent_1',
      talentName: 'Solidity Pro',
      status: 'active',
      version: 1,
      scopeLock: {
        totalAmount: 8000,
        currency: 'USD',
        milestones: [{ id: 'm1', title: 'Staking Logic', amount: 8000, currency: 'USD', status: 'pending' }],
      },
      milestones: [
        {
          id: 'm1',
          title: 'Staking Logic',
          amount: 8000,
          currency: 'USD',
          status: 'pending',
          paymentState: 'unfunded',
          reviewState: 'pending',
        },
      ],
      changeRequests: [
        {
          id: 'cr_abc_555',
          contractId: 'contract_cr_111',
          requestedBy: 'user_talent_1',
          requestedByRole: 'talent',
          requestedByName: 'Solidity Pro',
          title: 'Add Emergency Pause Feature',
          description: 'Need additional milestone for audit of pause mechanism',
          proposedChanges: {
            priceDelta: 1500,
            deadlineDeltaDays: 5,
          },
          status: 'pending',
          createdAt: '2026-08-03T10:00:00Z',
          updatedAt: '2026-08-03T10:00:00Z',
        },
      ],
      creatorAcceptance: { accepted: true, acceptedAt: '2026-08-01T10:00:00Z' },
      talentAcceptance: { accepted: true, acceptedAt: '2026-08-01T11:00:00Z' },
      conversationId: 'conv_contract_cr_111',
      createdAt: '2026-08-01T09:00:00Z',
      updatedAt: '2026-08-03T10:00:00Z',
    } as unknown as GigLinkContract;

    test('9.1 Pending change request notifies counterparty with deterministic ID', () => {
      // Talent made request -> Client/Creator should receive notification
      const creatorNotifs = deriveContractNotifications(crContract, 'user_client_1', false);
      const crNotif = creatorNotifs.find((n) => n.type === 'change_request_created');
      assert.ok(crNotif, 'Creator should receive change_request_created notification');
      assert.strictEqual(crNotif.id, 'cr_cr_abc_555_pending');
      assert.ok(crNotif.message.includes('Add Emergency Pause Feature'));

      // Requester should NOT receive change_request_created notification for their own request
      const talentNotifs = deriveContractNotifications(crContract, 'user_talent_1', false);
      const talentCrNotif = talentNotifs.find((n) => n.type === 'change_request_created');
      assert.strictEqual(talentCrNotif, undefined);
    });

    test('9.2 Approved change request notifies requester with deterministic ID', () => {
      const approvedCrContract: GigLinkContract = {
        ...crContract,
        changeRequests: [
          {
            ...crContract.changeRequests![0],
            status: 'approved',
            approvedAt: '2026-08-04T12:00:00Z',
            respondedBy: 'user_client_1',
            respondedByName: 'Crypto Ventures',
          },
        ],
      };

      const talentNotifs = deriveContractNotifications(approvedCrContract, 'user_talent_1', false);
      const appNotif = talentNotifs.find((n) => n.type === 'change_request_approved');
      assert.ok(appNotif);
      assert.strictEqual(appNotif.id, 'cr_cr_abc_555_approved');
      assert.ok(appNotif.title.includes('Approved'));
    });

    test('9.3 Rejected change request notifies requester with response note and deterministic ID', () => {
      const rejectedCrContract: GigLinkContract = {
        ...crContract,
        changeRequests: [
          {
            ...crContract.changeRequests![0],
            status: 'rejected',
            rejectedAt: '2026-08-04T12:00:00Z',
            responseNote: 'Out of scope for V1',
            respondedBy: 'user_client_1',
            respondedByName: 'Crypto Ventures',
          },
        ],
      };

      const talentNotifs = deriveContractNotifications(rejectedCrContract, 'user_talent_1', false);
      const rejNotif = talentNotifs.find((n) => n.type === 'change_request_rejected');
      assert.ok(rejNotif);
      assert.strictEqual(rejNotif.id, 'cr_cr_abc_555_rejected');
      assert.ok(rejNotif.message.includes('Out of scope for V1'));
    });
  });

  describe('10. Opportunity Title Resolution & Safe Fallback (MED-05)', () => {
    const testApp = {
      id: 'app_title_check_1',
      opportunityId: 'opp_title_real',
      opportunityCreatorId: 'user_creator_5',
      applicantId: 'user_applicant_5',
      applicantDisplayName: 'Dev One',
      status: 'submitted',
      submittedAt: '2026-08-01T10:00:00Z',
    } as unknown as OpportunityApplication & { id: string };

    test('10.1 Uses real opportunity title when provided explicitly in derivation', () => {
      const notif = deriveApplicantNotification(testApp, 'Senior Rust Engineer', false);
      assert.ok(notif);
      assert.ok(notif.message.includes('Senior Rust Engineer'));
      assert.strictEqual(notif.message.includes('Opportunity'), false);
    });

    test('10.2 Uses opportunityTitle embedded on application doc when param is default', () => {
      const appWithTitle: OpportunityApplication & { id: string } = {
        ...testApp,
        opportunityTitle: 'Staff Frontend Architect',
      };
      const notif = deriveApplicantNotification(appWithTitle, 'Opportunity', false);
      assert.ok(notif);
      assert.ok(notif.message.includes('Staff Frontend Architect'));
    });

    test('10.3 Preserves safe fallback to Opportunity when title genuinely cannot be resolved', () => {
      const notif = deriveApplicantNotification(testApp, undefined, false);
      assert.ok(notif);
      assert.ok(notif.message.includes('Opportunity'));
    });

    test('10.4 Creator notification resolves opportunity title correctly', () => {
      const appWithTitle: OpportunityApplication & { id: string; opportunityCreatorId: string } = {
        ...testApp,
        opportunityCreatorId: 'user_creator_5',
        opportunityTitle: 'Smart Contract Auditor',
      };
      const notif = deriveCreatorNotification(appWithTitle, 'your opportunity', false);
      assert.ok(notif);
      assert.ok(notif.message.includes('Smart Contract Auditor'));
    });
  });

  describe('11. Canonical Persona-Aware Notification Navigation (MED-03 & Org Admin)', () => {
    test('11.1 Canonical learner persona navigates to /talent/dashboard with Learner Workspace label', () => {
      const dest = getNotificationWorkspaceDestination('learner');
      assert.strictEqual(dest.path, '/talent/dashboard');
      assert.strictEqual(dest.label, 'Go to Learner Workspace');
    });

    test('11.2 Canonical partner persona navigates to /talent/dashboard with Partner Workspace label', () => {
      const dest = getNotificationWorkspaceDestination('partner');
      assert.strictEqual(dest.path, '/talent/dashboard');
      assert.strictEqual(dest.label, 'Go to Partner Workspace');
    });

    test('11.3 Canonical client persona navigates to /client/dashboard with Client Workspace label', () => {
      const dest = getNotificationWorkspaceDestination('client');
      assert.strictEqual(dest.path, '/client/dashboard');
      assert.strictEqual(dest.label, 'Go to Client Workspace');
    });

    test('11.4 Canonical organization_admin persona navigates to /enterprise/dashboard with Organization Workspace label', () => {
      const dest = getNotificationWorkspaceDestination('organization_admin');
      assert.strictEqual(dest.path, '/enterprise/dashboard');
      assert.strictEqual(dest.label, 'Go to Organization Workspace');
    });

    test('11.5 Organization Admin & Client never fall through to wrong routes even with legacy persona aliases', () => {
      const enterpriseDest = getNotificationWorkspaceDestination('enterprise');
      assert.strictEqual(enterpriseDest.path, '/enterprise/dashboard');
      assert.strictEqual(enterpriseDest.label, 'Go to Organization Workspace');

      const creatorDest = getNotificationWorkspaceDestination('creator');
      assert.strictEqual(creatorDest.path, '/client/dashboard');
      assert.strictEqual(creatorDest.label, 'Go to Client Workspace');

      const talentDest = getNotificationWorkspaceDestination('talent');
      assert.strictEqual(talentDest.path, '/talent/dashboard');
      assert.strictEqual(talentDest.label, 'Go to Learner Workspace');
    });

    test('11.6 Undefined or unknown persona safely falls back to default Learner Workspace', () => {
      const unknownDest = getNotificationWorkspaceDestination('unknown_role');
      assert.strictEqual(unknownDest.path, '/talent/dashboard');
      assert.strictEqual(unknownDest.label, 'Go to Learner Workspace');

      const undefinedDest = getNotificationWorkspaceDestination(undefined);
      assert.strictEqual(undefinedDest.path, '/talent/dashboard');
      assert.strictEqual(undefinedDest.label, 'Go to Learner Workspace');
    });
  });
});
