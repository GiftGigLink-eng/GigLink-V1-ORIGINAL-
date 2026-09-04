/**
 * GigLink Authoritative Derived Notification Service (Phase 6.2)
 * 
 * Core Architectural & Security Principles:
 * 1. 100% Derived & Read-Only: Notifications are derived directly from authoritative
 *    Firestore records (Applications & Verifications) that the authenticated user is authorized to read.
 * 2. Zero Database Writes: No separate /notifications collection or client-writable records are introduced.
 *    firestore.rules remains 100% untouched.
 * 3. Recipient Isolation: Strict query isolation ensures users only ever receive notifications for their own
 *    applications, creator opportunities, or personal verifications.
 * 4. Client-Side Read/Dismiss State: Read statuses are maintained in isolated local storage keyed by recipient UID.
 */

import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppNotification, OpportunityApplication, VerificationStatus, GigLinkContract, ProjectConversation } from '../types';
import { getContractsForUser } from './contractService';

const STORAGE_KEY_PREFIX = 'giglink_notifications_read_';

/**
 * Retrieves the set of read notification IDs for a given user from local storage.
 */
export function getReadNotificationIds(userId: string): Set<string> {
  if (!userId) return new Set();
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!storage) return new Set();
    const raw = storage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch (err) {
    console.warn('[NotificationService] Failed to load read notification IDs from storage:', err);
    return new Set();
  }
}

/**
 * Marks a single notification as read for a given user in local storage.
 */
export function markNotificationAsRead(userId: string, notificationId: string): void {
  if (!userId || !notificationId) return;
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!storage) return;
    const readSet = getReadNotificationIds(userId);
    readSet.add(notificationId);
    storage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(Array.from(readSet)));
  } catch (err) {
    console.warn('[NotificationService] Failed to save read notification ID:', err);
  }
}

/**
 * Marks multiple notifications as read for a given user in local storage.
 */
export function markAllNotificationsAsRead(userId: string, notificationIds: string[]): void {
  if (!userId || !notificationIds.length) return;
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!storage) return;
    const readSet = getReadNotificationIds(userId);
    notificationIds.forEach((id) => readSet.add(id));
    storage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(Array.from(readSet)));
  } catch (err) {
    console.warn('[NotificationService] Failed to mark all notifications as read:', err);
  }
}

/**
 * Generates an applicant notification from an authoritative application document.
 */
export function deriveApplicantNotification(
  app: OpportunityApplication & { id: string },
  opportunityTitle?: string,
  isRead: boolean = false
): AppNotification | null {
  const oppTitle = opportunityTitle || app.opportunityTitle || 'Opportunity';
  const targetUrl = '/my-applications';
  const updatedAt = app.updatedAt || app.submittedAt || new Date().toISOString();

  switch (app.status) {
    case 'submitted':
      return {
        id: `applicant_${app.id}_submitted`,
        userId: app.applicantId,
        type: 'application_submitted',
        category: 'application',
        title: 'Application Submitted',
        message: `Your application for "${oppTitle}" was successfully submitted.`,
        linkUrl: targetUrl,
        createdAt: app.submittedAt || updatedAt,
        read: isRead,
        relatedEntityId: app.id,
      };
    case 'under_review':
      return {
        id: `applicant_${app.id}_under_review`,
        userId: app.applicantId,
        type: 'application_under_review',
        category: 'application',
        title: 'Application Under Review',
        message: `The creator is actively reviewing your application for "${oppTitle}".`,
        linkUrl: targetUrl,
        createdAt: updatedAt,
        read: isRead,
        relatedEntityId: app.id,
      };
    case 'shortlisted':
      return {
        id: `applicant_${app.id}_shortlisted`,
        userId: app.applicantId,
        type: 'application_shortlisted',
        category: 'application',
        title: 'Application Shortlisted!',
        message: `Great news! You were shortlisted for "${oppTitle}".`,
        linkUrl: targetUrl,
        createdAt: updatedAt,
        read: isRead,
        relatedEntityId: app.id,
      };
    case 'accepted':
      return {
        id: `applicant_${app.id}_accepted`,
        userId: app.applicantId,
        type: 'application_accepted',
        category: 'application',
        title: 'Application Accepted!',
        message: `Congratulations! Your application for "${oppTitle}" was accepted. View kickoff details.`,
        linkUrl: targetUrl,
        createdAt: updatedAt,
        read: isRead,
        relatedEntityId: app.id,
      };
    case 'declined':
      return {
        id: `applicant_${app.id}_declined`,
        userId: app.applicantId,
        type: 'application_declined',
        category: 'application',
        title: 'Application Status Update',
        message: `The creator has finalized their decision for "${oppTitle}".`,
        linkUrl: targetUrl,
        createdAt: updatedAt,
        read: isRead,
        relatedEntityId: app.id,
      };
    case 'withdrawn':
      return {
        id: `applicant_${app.id}_withdrawn`,
        userId: app.applicantId,
        type: 'application_withdrawn',
        category: 'application',
        title: 'Application Withdrawn',
        message: `You withdrew your application for "${oppTitle}".`,
        linkUrl: targetUrl,
        createdAt: updatedAt,
        read: isRead,
        relatedEntityId: app.id,
      };
    default:
      return null;
  }
}

/**
 * Generates a creator notification from an authoritative application document.
 */
export function deriveCreatorNotification(
  app: OpportunityApplication & { id: string; opportunityCreatorId?: string },
  opportunityTitle?: string,
  isRead: boolean = false
): AppNotification | null {
  const oppTitle = opportunityTitle || app.opportunityTitle || 'your opportunity';
  const targetUrl = `/opportunities/${app.opportunityId}/applications`;
  const creatorId = app.opportunityCreatorId;
  if (!creatorId) return null;

  const applicantLabel = app.applicantDisplayName || 'A candidate';
  const timestamp = app.updatedAt || app.submittedAt || new Date().toISOString();

  if (app.status === 'submitted') {
    return {
      id: `creator_${app.id}_new_submission`,
      userId: creatorId,
      type: 'application_submitted',
      category: 'application',
      title: 'New Candidate Application',
      message: `${applicantLabel} applied for "${oppTitle}".`,
      linkUrl: targetUrl,
      createdAt: app.submittedAt || timestamp,
      read: isRead,
      relatedEntityId: app.id,
      actorName: applicantLabel,
    };
  }

  if (app.status === 'withdrawn') {
    return {
      id: `creator_${app.id}_withdrawn`,
      userId: creatorId,
      type: 'application_withdrawn',
      category: 'application',
      title: 'Application Withdrawn',
      message: `${applicantLabel} withdrew their application for "${oppTitle}".`,
      linkUrl: targetUrl,
      createdAt: timestamp,
      read: isRead,
      relatedEntityId: app.id,
      actorName: applicantLabel,
    };
  }

  return null;
}

/**
 * Generates a verification notification from an authoritative verification document.
 */
export function deriveVerificationNotification(
  verif: {
    id: string;
    userId: string;
    status: VerificationStatus;
    documentType?: string;
    submittedAt?: string;
    reviewedAt?: string;
  },
  isRead: boolean = false
): AppNotification | null {
  const docLabel = verif.documentType || 'Identity';
  const timestamp = verif.reviewedAt || verif.submittedAt || new Date().toISOString();

  if (verif.status === 'verified') {
    return {
      id: `verification_${verif.id}_verified`,
      userId: verif.userId,
      type: 'verification_verified',
      category: 'verification',
      title: 'Identity Verified (+40 Trust)',
      message: `Your ${docLabel} verification was approved. Your Trust Score has increased.`,
      linkUrl: '/profile',
      createdAt: timestamp,
      read: isRead,
      relatedEntityId: verif.id,
    };
  }

  if (verif.status === 'rejected') {
    return {
      id: `verification_${verif.id}_rejected`,
      userId: verif.userId,
      type: 'verification_rejected',
      category: 'verification',
      title: 'Verification Request Update',
      message: `Your ${docLabel} proof was reviewed. Please check your verification status.`,
      linkUrl: '/profile',
      createdAt: timestamp,
      read: isRead,
      relatedEntityId: verif.id,
    };
  }

  return null;
}

/**
 * Generates contract and project execution notifications from an authoritative contract document.
 */
export function deriveContractNotifications(
  contract: GigLinkContract,
  currentUserId: string,
  isRead: boolean = false
): AppNotification[] {
  if (!contract || !currentUserId) return [];
  const results: AppNotification[] = [];
  const oppTitle = contract.opportunityTitle || contract.scopeLock.title || 'Project';
  const targetUrl = `/opportunities/${contract.opportunityId}/handoff`;

  const isCreator = currentUserId === contract.creatorId;
  const isTalent = currentUserId === contract.talentId;

  if (!isCreator && !isTalent) return [];

  // 1. Contract Terms Proposed & Ready for Talent Acceptance
  if (isTalent && contract.status === 'pending_acceptance' && contract.creatorAcceptance.accepted && !contract.talentAcceptance.accepted) {
    results.push({
      id: `contract_${contract.id}_pending_sign`,
      userId: currentUserId,
      type: 'contract_activated',
      category: 'contract',
      title: 'Contract Terms Ready to Sign',
      message: `${contract.creatorName || 'The client'} has proposed formal contract terms for "${oppTitle}". Review and accept to begin work.`,
      linkUrl: targetUrl,
      createdAt: contract.creatorAcceptance.acceptedAt || contract.updatedAt || contract.createdAt,
      read: isRead,
      relatedEntityId: contract.id,
      actorName: contract.creatorName || 'Client',
    });
  }

  // 2. Milestone-level execution notifications
  contract.milestones.forEach((m) => {
    // A. Talent submitted deliverable -> Creator notification
    if (isCreator && (m.reviewState === 'submitted' || m.reviewState === 'in_review') && m.submission) {
      results.push({
        id: `milestone_${m.id}_submitted_${m.submittedAt || contract.updatedAt}`,
        userId: currentUserId,
        type: 'milestone_submitted',
        category: 'contract',
        title: 'Deliverable Submitted for Review',
        message: `${contract.talentName || 'Talent'} submitted deliverables for "${m.title}".`,
        linkUrl: targetUrl,
        createdAt: m.submittedAt || contract.updatedAt,
        read: isRead,
        relatedEntityId: contract.id,
        actorName: contract.talentName || 'Talent',
      });
    }

    // B. Creator requested revisions -> Talent notification
    if (isTalent && m.reviewState === 'revision_requested') {
      results.push({
        id: `milestone_${m.id}_revision_${m.revisionCount}_${m.reviewedAt || contract.updatedAt}`,
        userId: currentUserId,
        type: 'milestone_revision_requested',
        category: 'contract',
        title: `Revision Requested (Round ${m.revisionCount})`,
        message: `Client requested adjustments for "${m.title}". View feedback and resubmit.`,
        linkUrl: targetUrl,
        createdAt: m.reviewedAt || contract.updatedAt,
        read: isRead,
        relatedEntityId: contract.id,
        actorName: contract.creatorName || 'Client',
      });
    }

    // C. Creator approved milestone -> Talent notification
    if (isTalent && m.reviewState === 'approved') {
      results.push({
        id: `milestone_${m.id}_approved_${m.approvedAt || contract.updatedAt}`,
        userId: currentUserId,
        type: 'milestone_approved',
        category: 'contract',
        title: 'Milestone Deliverable Approved!',
        message: `Great work! Your deliverables for "${m.title}" were approved by the client.`,
        linkUrl: targetUrl,
        createdAt: m.approvedAt || contract.updatedAt,
        read: isRead,
        relatedEntityId: contract.id,
        actorName: contract.creatorName || 'Client',
      });
    }
  });

  // 3. Final Handover Submitted -> Creator notification
  if (isCreator && contract.finalHandover?.status === 'submitted') {
    results.push({
      id: `final_handover_${contract.id}_submitted_${contract.finalHandover.submittedAt || contract.updatedAt}`,
      userId: currentUserId,
      type: 'final_handover_submitted',
      category: 'contract',
      title: 'Final Project Handover Submitted',
      message: `${contract.talentName || 'Talent'} submitted final handover assets for "${oppTitle}". Review and complete project.`,
      linkUrl: targetUrl,
      createdAt: contract.finalHandover.submittedAt || contract.updatedAt,
      read: isRead,
      relatedEntityId: contract.id,
      actorName: contract.talentName || 'Talent',
    });
  }

  // 4. Final Handover Accepted / Project Completed -> Both parties
  if (contract.status === 'completed') {
    results.push({
      id: `project_${contract.id}_completed_${contract.completedAt || contract.updatedAt}`,
      userId: currentUserId,
      type: 'project_completed',
      category: 'contract',
      title: isTalent ? 'Project Completed & Signed Off!' : 'Project Successfully Completed',
      message: isTalent
        ? `Congratulations! "${oppTitle}" has been signed off and completed.`
        : `Contract for "${oppTitle}" is complete with all verified deliverables accepted.`,
      linkUrl: targetUrl,
      createdAt: contract.completedAt || contract.updatedAt,
      read: isRead,
      relatedEntityId: contract.id,
    });
  }

  // 5. Phase 3: Change Requests & Contract Amendments
  if (contract.changeRequests && contract.changeRequests.length > 0) {
    contract.changeRequests.forEach((cr) => {
      // A. Pending Change Request -> Notify counterparty
      if (cr.status === 'pending') {
        const isCounterparty =
          (cr.requestedByRole === 'talent' && isCreator) ||
          (cr.requestedByRole === 'creator' && isTalent);

        if (isCounterparty) {
          results.push({
            id: `cr_${cr.id}_pending_${cr.createdAt}`,
            userId: currentUserId,
            type: 'change_request_created',
            category: 'contract',
            title: 'Scope Change Request Submitted',
            message: `${cr.requestedByName || 'Counterparty'} proposed a contract amendment: "${cr.title}". Review proposed changes.`,
            linkUrl: targetUrl,
            createdAt: cr.createdAt,
            read: isRead,
            relatedEntityId: contract.id,
            actorName: cr.requestedByName || 'Contract Party',
          });
        }
      }

      // B. Approved Change Request -> Notify requester
      if (cr.status === 'approved' && cr.approvedAt) {
        if (currentUserId === cr.requestedBy) {
          results.push({
            id: `cr_${cr.id}_approved_${cr.approvedAt}`,
            userId: currentUserId,
            type: 'change_request_approved',
            category: 'contract',
            title: 'Change Request Approved!',
            message: `Your change request "${cr.title}" was approved. Contract updated to Version ${contract.version || 1}.`,
            linkUrl: targetUrl,
            createdAt: cr.approvedAt,
            read: isRead,
            relatedEntityId: contract.id,
            actorName: cr.respondedByName || 'Counterparty',
          });
        }
      }

      // C. Rejected Change Request -> Notify requester
      if (cr.status === 'rejected' && cr.rejectedAt) {
        if (currentUserId === cr.requestedBy) {
          results.push({
            id: `cr_${cr.id}_rejected_${cr.rejectedAt}`,
            userId: currentUserId,
            type: 'change_request_rejected',
            category: 'contract',
            title: 'Change Request Declined',
            message: `Your change request "${cr.title}" was declined: "${cr.responseNote || 'No reason provided'}".`,
            linkUrl: targetUrl,
            createdAt: cr.rejectedAt,
            read: isRead,
            relatedEntityId: contract.id,
            actorName: cr.respondedByName || 'Counterparty',
          });
        }
      }

      // D. Withdrawn Change Request -> Notify counterparty
      if (cr.status === 'withdrawn' && cr.withdrawnAt) {
        const isCounterparty =
          (cr.requestedByRole === 'talent' && isCreator) ||
          (cr.requestedByRole === 'creator' && isTalent);

        if (isCounterparty) {
          results.push({
            id: `cr_${cr.id}_withdrawn_${cr.withdrawnAt}`,
            userId: currentUserId,
            type: 'change_request_withdrawn',
            category: 'contract',
            title: 'Change Request Withdrawn',
            message: `${cr.requestedByName || 'Counterparty'} withdrew change request "${cr.title}".`,
            linkUrl: targetUrl,
            createdAt: cr.withdrawnAt,
            read: isRead,
            relatedEntityId: contract.id,
            actorName: cr.requestedByName || 'Contract Party',
          });
        }
      }
    });
  }

  // 6. Phase 4: Financial & Escrow Notifications
  contract.milestones.forEach((m) => {
    // A. Escrow Funded / Held -> Notify Talent that funds are safely in escrow
    if (m.paymentState === 'held' && m.fundedAt) {
      if (isTalent) {
        results.push({
          id: `financial_held_${m.id}_${m.fundedAt}`,
          userId: currentUserId,
          type: 'milestone_payment_held',
          category: 'financial',
          title: 'Escrow Funded & Protected',
          message: `Client deposited $${m.amount} ${m.currency} into escrow for "${m.title}". You can safely submit deliverables.`,
          linkUrl: targetUrl,
          createdAt: m.fundedAt,
          read: isRead,
          relatedEntityId: contract.id,
          actorName: contract.creatorName || 'Client',
        });
      } else if (isCreator) {
        results.push({
          id: `financial_funded_${m.id}_${m.fundedAt}`,
          userId: currentUserId,
          type: 'milestone_funded',
          category: 'financial',
          title: 'Milestone Escrow Funded',
          message: `Successfully funded $${m.amount} ${m.currency} into escrow for "${m.title}".`,
          linkUrl: targetUrl,
          createdAt: m.fundedAt,
          read: isRead,
          relatedEntityId: contract.id,
        });
      }
    }

    // B. Payment Released -> Notify Talent & Creator
    if (m.paymentState === 'released' && m.releasedAt) {
      if (isTalent) {
        results.push({
          id: `financial_released_${m.id}_${m.releasedAt}`,
          userId: currentUserId,
          type: 'milestone_payment_released',
          category: 'financial',
          title: 'Payment Released to You!',
          message: `Client released $${m.amount} ${m.currency} for approved milestone "${m.title}". Payout initiated.`,
          linkUrl: targetUrl,
          createdAt: m.releasedAt,
          read: isRead,
          relatedEntityId: contract.id,
          actorName: contract.creatorName || 'Client',
        });
      } else if (isCreator) {
        results.push({
          id: `financial_released_creator_${m.id}_${m.releasedAt}`,
          userId: currentUserId,
          type: 'milestone_payment_released',
          category: 'financial',
          title: 'Milestone Payment Settled',
          message: `Funds for "${m.title}" ($${m.amount} ${m.currency}) released to talent.`,
          linkUrl: targetUrl,
          createdAt: m.releasedAt,
          read: isRead,
          relatedEntityId: contract.id,
        });
      }
    }

    // C. Escrow Refunded -> Notify both parties
    if (m.paymentState === 'refunded' && m.refundedAt) {
      results.push({
        id: `financial_refunded_${m.id}_${m.refundedAt}`,
        userId: currentUserId,
        type: 'refund_completed',
        category: 'financial',
        title: 'Milestone Escrow Refunded',
        message: `Escrow funds for "${m.title}" ($${m.amount} ${m.currency}) have been refunded.`,
        linkUrl: targetUrl,
        createdAt: m.refundedAt,
        read: isRead,
        relatedEntityId: contract.id,
      });
    }

    // D. Additional Funding Required -> Notify Client
    if (isCreator && m.requiredFundingAmount && m.fundedAmount && m.requiredFundingAmount > m.fundedAmount) {
      results.push({
        id: `financial_additional_funding_${m.id}_${contract.updatedAt}`,
        userId: currentUserId,
        type: 'additional_funding_required',
        category: 'financial',
        title: 'Additional Escrow Funding Required',
        message: `Budget amendment increased "${m.title}". Additional $${m.requiredFundingAmount - m.fundedAmount} ${m.currency} required in escrow.`,
        linkUrl: targetUrl,
        createdAt: contract.updatedAt,
        read: isRead,
        relatedEntityId: contract.id,
      });
    }
  });

  return results;
}

/**
 * Generates notification for incoming project messages from conversation records.
 */
export function deriveConversationNotification(
  conversation: ProjectConversation,
  currentUserId: string,
  opportunityTitle?: string,
  isRead: boolean = false
): AppNotification | null {
  if (!conversation || !currentUserId) return null;
  const isCreator = currentUserId === conversation.creatorId;
  const isTalent = currentUserId === conversation.talentId;
  if (!isCreator && !isTalent) return null;

  const unreadCount = isCreator ? conversation.unreadCountCreator : conversation.unreadCountTalent;
  if (!unreadCount || unreadCount <= 0 || !conversation.lastMessageAt) {
    return null;
  }

  // If the last message was sent by the current user, don't show self notification
  if (conversation.lastMessageSenderId === currentUserId) {
    return null;
  }

  const senderDisplayName = isCreator
    ? (conversation.talentName || 'Talent')
    : (conversation.creatorName || 'Client');

  const targetUrl = `/opportunities/${conversation.opportunityId}/handoff?tab=messages`;

  return {
    id: `message_${conversation.id}_${conversation.lastMessageAt}`,
    userId: currentUserId,
    type: 'new_project_message',
    category: 'messaging',
    title: `New Message from ${senderDisplayName}`,
    message: conversation.lastMessagePreview
      ? `"${conversation.lastMessagePreview.slice(0, 80)}${conversation.lastMessagePreview.length > 80 ? '...' : ''}"`
      : `You have an unread message regarding your project.`,
    linkUrl: targetUrl,
    createdAt: conversation.lastMessageAt,
    read: isRead,
    relatedEntityId: conversation.id,
    actorName: senderDisplayName,
  };
}

/**
 * Fetches all derived notifications for an authenticated user.
 */
export async function fetchDerivedNotifications(userUid: string): Promise<AppNotification[]> {
  if (!userUid) return [];

  const readSet = getReadNotificationIds(userUid);
  const notifications: AppNotification[] = [];
  const oppTitlesMap = new Map<string, string>();

  // Helper to fetch opportunity title with caching
  const getOpportunityTitle = async (oppId: string): Promise<string> => {
    if (oppTitlesMap.has(oppId)) return oppTitlesMap.get(oppId)!;
    try {
      const docSnap = await getDoc(doc(db, 'opportunities', oppId));
      if (docSnap.exists()) {
        const title = docSnap.data().title || 'Opportunity';
        oppTitlesMap.set(oppId, title);
        return title;
      }
    } catch {
      // Fallback
    }
    return 'Opportunity';
  };

  try {
    // 1. Fetch Applicant Applications
    const applicantAppsQuery = query(
      collection(db, 'applications'),
      where('applicantId', '==', userUid)
    );
    const applicantSnap = await getDocs(applicantAppsQuery);
    for (const docSnap of applicantSnap.docs) {
      const data = docSnap.data() as OpportunityApplication;
      const app = { ...data, id: docSnap.id };
      const oppTitle = await getOpportunityTitle(app.opportunityId);
      const notif = deriveApplicantNotification(app, oppTitle, false);
      if (notif) {
        notif.read = readSet.has(notif.id);
        notifications.push(notif);
      }
    }

    // 2. Fetch Creator Applications
    const creatorAppsQuery = query(
      collection(db, 'applications'),
      where('opportunityCreatorId', '==', userUid)
    );
    const creatorSnap = await getDocs(creatorAppsQuery);
    for (const docSnap of creatorSnap.docs) {
      const data = docSnap.data() as OpportunityApplication & { opportunityCreatorId?: string };
      const app = { ...data, id: docSnap.id, opportunityCreatorId: userUid };
      const oppTitle = await getOpportunityTitle(app.opportunityId);
      const notif = deriveCreatorNotification(app, oppTitle, false);
      if (notif) {
        notif.read = readSet.has(notif.id);
        notifications.push(notif);
      }
    }

    // 3. Fetch Verifications
    const verifQuery = query(
      collection(db, 'verifications'),
      where('userId', '==', userUid)
    );
    const verifSnap = await getDocs(verifQuery);
    for (const docSnap of verifSnap.docs) {
      const data = docSnap.data() as {
        userId: string;
        status: VerificationStatus;
        documentType?: string;
        submittedAt?: string;
        reviewedAt?: string;
      };
      const notif = deriveVerificationNotification({ ...data, id: docSnap.id }, false);
      if (notif) {
        notif.read = readSet.has(notif.id);
        notifications.push(notif);
      }
    }

    // 4. Fetch Contracts
    const userContracts = await getContractsForUser(userUid);
    for (const contract of userContracts) {
      const contractNotifs = deriveContractNotifications(contract, userUid, false);
      for (const notif of contractNotifs) {
        notif.read = readSet.has(notif.id);
        notifications.push(notif);
      }
    }

    // 5. Fetch Conversations (Creator & Talent)
    try {
      const creatorConvSnap = await getDocs(
        query(collection(db, 'conversations'), where('creatorId', '==', userUid))
      );
      for (const docSnap of creatorConvSnap.docs) {
        const conv = docSnap.data() as ProjectConversation;
        const notif = deriveConversationNotification(conv, userUid, undefined, false);
        if (notif) {
          notif.read = readSet.has(notif.id);
          notifications.push(notif);
        }
      }

      const talentConvSnap = await getDocs(
        query(collection(db, 'conversations'), where('talentId', '==', userUid))
      );
      for (const docSnap of talentConvSnap.docs) {
        const conv = docSnap.data() as ProjectConversation;
        const notif = deriveConversationNotification(conv, userUid, undefined, false);
        if (notif) {
          notif.read = readSet.has(notif.id);
          notifications.push(notif);
        }
      }
    } catch {
      // In-memory fallback
    }
  } catch (err) {
    console.warn('[NotificationService] Error querying authoritative records for notifications:', err);
  }

  // Sort descending by timestamp
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return notifications;
}

/**
 * Subscribes to real-time changes in applications and verifications to deliver derived notifications.
 */
export function subscribeToDerivedNotifications(
  userUid: string,
  onUpdate: (notifications: AppNotification[]) => void
): Unsubscribe {
  if (!userUid) {
    onUpdate([]);
    return () => {};
  }

  let applicantApps: (OpportunityApplication & { id: string })[] = [];
  let creatorApps: (OpportunityApplication & { id: string; opportunityCreatorId?: string })[] = [];
  let verifications: {
    id: string;
    userId: string;
    status: VerificationStatus;
    documentType?: string;
    submittedAt?: string;
    reviewedAt?: string;
  }[] = [];
  let userContracts: GigLinkContract[] = [];

  const oppTitlesMap = new Map<string, string>();

  const rebuildNotifications = () => {
    const readSet = getReadNotificationIds(userUid);
    const notifs: AppNotification[] = [];

    // Applicant notifications
    applicantApps.forEach((app) => {
      const title = oppTitlesMap.get(app.opportunityId) || 'Opportunity';
      const n = deriveApplicantNotification(app, title, false);
      if (n) {
        n.read = readSet.has(n.id);
        notifs.push(n);
      }
    });

    // Creator notifications
    creatorApps.forEach((app) => {
      const title = oppTitlesMap.get(app.opportunityId) || 'Opportunity';
      const n = deriveCreatorNotification(app, title, false);
      if (n) {
        n.read = readSet.has(n.id);
        notifs.push(n);
      }
    });

    // Verification notifications
    verifications.forEach((v) => {
      const n = deriveVerificationNotification(v, false);
      if (n) {
        n.read = readSet.has(n.id);
        notifs.push(n);
      }
    });

    // Contract notifications
    userContracts.forEach((c) => {
      const cNotifs = deriveContractNotifications(c, userUid, false);
      cNotifs.forEach((n) => {
        n.read = readSet.has(n.id);
        notifs.push(n);
      });
    });

    // Conversation notifications
    userConversations.forEach((conv) => {
      const n = deriveConversationNotification(conv, userUid, undefined, false);
      if (n) {
        n.read = readSet.has(n.id);
        notifs.push(n);
      }
    });

    notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onUpdate(notifs);
  };

  const unsubApplicant = onSnapshot(
    query(collection(db, 'applications'), where('applicantId', '==', userUid)),
    (snapshot) => {
      applicantApps = snapshot.docs.map((d) => ({
        ...(d.data() as OpportunityApplication),
        id: d.id,
      }));
      rebuildNotifications();
    },
    (err) => {
      console.warn('[NotificationService] Applicant listener warning:', err.message);
    }
  );

  const unsubCreator = onSnapshot(
    query(collection(db, 'applications'), where('opportunityCreatorId', '==', userUid)),
    (snapshot) => {
      creatorApps = snapshot.docs.map((d) => ({
        ...(d.data() as OpportunityApplication & { opportunityCreatorId?: string }),
        id: d.id,
        opportunityCreatorId: userUid,
      }));
      rebuildNotifications();
    },
    (err) => {
      console.warn('[NotificationService] Creator listener warning:', err.message);
    }
  );

  const unsubVerif = onSnapshot(
    query(collection(db, 'verifications'), where('userId', '==', userUid)),
    (snapshot) => {
      verifications = snapshot.docs.map((d) => ({
        ...(d.data() as {
          userId: string;
          status: VerificationStatus;
          documentType?: string;
          submittedAt?: string;
          reviewedAt?: string;
        }),
        id: d.id,
      }));
      rebuildNotifications();
    },
    (err) => {
      console.warn('[NotificationService] Verification listener warning:', err.message);
    }
  );

  // Contracts listener (Creator & Talent)
  let creatorContracts: GigLinkContract[] = [];
  let talentContracts: GigLinkContract[] = [];

  const updateContracts = () => {
    const map = new Map<string, GigLinkContract>();
    creatorContracts.forEach((c) => map.set(c.id, c));
    talentContracts.forEach((c) => map.set(c.id, c));
    userContracts = Array.from(map.values());
    rebuildNotifications();
  };

  const unsubContractsCreator = onSnapshot(
    query(collection(db, 'contracts'), where('creatorId', '==', userUid)),
    (snapshot) => {
      creatorContracts = snapshot.docs.map((d) => d.data() as GigLinkContract);
      updateContracts();
    },
    () => {
      // In-memory fallback
    }
  );

  const unsubContractsTalent = onSnapshot(
    query(collection(db, 'contracts'), where('talentId', '==', userUid)),
    (snapshot) => {
      talentContracts = snapshot.docs.map((d) => d.data() as GigLinkContract);
      updateContracts();
    },
    () => {
      // In-memory fallback
    }
  );

  // Conversations listener (Creator & Talent)
  let creatorConversations: ProjectConversation[] = [];
  let talentConversations: ProjectConversation[] = [];
  let userConversations: ProjectConversation[] = [];

  const updateConversations = () => {
    const map = new Map<string, ProjectConversation>();
    creatorConversations.forEach((c) => map.set(c.id, c));
    talentConversations.forEach((c) => map.set(c.id, c));
    userConversations = Array.from(map.values());
    rebuildNotifications();
  };

  const unsubConvCreator = onSnapshot(
    query(collection(db, 'conversations'), where('creatorId', '==', userUid)),
    (snapshot) => {
      creatorConversations = snapshot.docs.map((d) => d.data() as ProjectConversation);
      updateConversations();
    },
    () => {}
  );

  const unsubConvTalent = onSnapshot(
    query(collection(db, 'conversations'), where('talentId', '==', userUid)),
    (snapshot) => {
      talentConversations = snapshot.docs.map((d) => d.data() as ProjectConversation);
      updateConversations();
    },
    () => {}
  );

  return () => {
    unsubApplicant();
    unsubCreator();
    unsubVerif();
    unsubContractsCreator();
    unsubContractsTalent();
    unsubConvCreator();
    unsubConvTalent();
  };
}
