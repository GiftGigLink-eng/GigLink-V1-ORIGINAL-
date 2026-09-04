import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  GigLinkContract,
  ProjectConversation,
  ProjectMessage,
  ProjectLinkAttachment,
  MessageContextType,
  ConversationStatus,
} from '../types';

// In-Memory fallback caches for instant rendering & local dev tests
const conversationsStore = new Map<string, ProjectConversation>();
const messagesStore = new Map<string, ProjectMessage[]>(); // Keyed by conversationId

/**
 * Deterministic conversation ID generator based on canonical contract ID.
 */
export function getCanonicalConversationId(contractId: string): string {
  if (!contractId) return '';
  return contractId.startsWith('conv_') ? contractId : `conv_${contractId}`;
}

/**
 * Validates whether a project or contract is eligible for in-app messaging.
 * Rules:
 * - Application must have been accepted and canonical contract created.
 * - Contract must be active, completed (read-only archive), or disputed.
 * - Draft/pending contracts are NOT eligible.
 */
export function isMessagingEligible(contract: GigLinkContract | null | undefined): {
  eligible: boolean;
  reason?: string;
} {
  if (!contract) {
    return {
      eligible: false,
      reason: 'No contract found. Messaging requires an accepted application and initialized contract.',
    };
  }

  if (contract.status === 'draft' || contract.status === 'pending_acceptance') {
    return {
      eligible: false,
      reason: 'Contract is still pending activation. Messaging opens as soon as both parties sign and the contract becomes active.',
    };
  }

  if (contract.status === 'cancelled') {
    return {
      eligible: false,
      reason: 'This contract was cancelled. Messaging is closed.',
    };
  }

  return { eligible: true };
}

/**
 * Enforces the Client-First Conversation Rule:
 * Only the contract's Client/Creator (or authorized admin) may initiate the conversation.
 * Talent cannot create the initial conversation.
 */
export function canInitiateConversation(
  contract: GigLinkContract,
  userId: string,
  userIsOrgAdmin = false
): { allowed: boolean; reason?: string } {
  const eligibility = isMessagingEligible(contract);
  if (!eligibility.eligible) {
    return { allowed: false, reason: eligibility.reason };
  }

  if (contract.status === 'completed') {
    return {
      allowed: false,
      reason: 'This contract is completed. Project communication is archived in read-only mode.',
    };
  }

  const isClient = userId === contract.creatorId || userIsOrgAdmin;
  if (!isClient) {
    return {
      allowed: false,
      reason: 'Only the Client/Creator can initiate the conversation for this project.',
    };
  }

  return { allowed: true };
}

/**
 * Validates if the authenticated user can send a message in this conversation.
 */
export function canSendMessage(
  contract: GigLinkContract,
  conversation: ProjectConversation | null,
  userId: string,
  userIsOrgAdmin = false
): { allowed: boolean; reason?: string } {
  const eligibility = isMessagingEligible(contract);
  if (!eligibility.eligible) {
    return { allowed: false, reason: eligibility.reason };
  }

  const isClient = userId === contract.creatorId || userIsOrgAdmin;
  const isTalent = userId === contract.talentId;

  if (!isClient && !isTalent) {
    return {
      allowed: false,
      reason: 'Unauthorized: Only contract participants can send messages.',
    };
  }

  // Contract completed policy: Read-only communication archive
  if (contract.status === 'completed') {
    return {
      allowed: false,
      reason: 'This contract is completed. Project communication is archived in read-only mode.',
    };
  }

  // If conversation doesn't exist or is pending initiation, enforce client-first rule
  if (!conversation || conversation.status === 'pending_initiation') {
    if (!isClient) {
      return {
        allowed: false,
        reason: "Your client hasn't started the project conversation yet. Once initiated by your client, you will be able to reply here.",
      };
    }
  }

  if (conversation?.status === 'archived') {
    return {
      allowed: false,
      reason: 'This conversation is archived. No further messages can be sent.',
    };
  }

  return { allowed: true };
}

/**
 * Fetch a conversation by ID from Firestore or in-memory fallback.
 */
export async function getConversation(conversationId: string): Promise<ProjectConversation | null> {
  if (!conversationId) return null;

  if (conversationsStore.has(conversationId)) {
    return conversationsStore.get(conversationId)!;
  }

  try {
    const docRef = doc(db, 'conversations', conversationId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as ProjectConversation;
      conversationsStore.set(conversationId, data);
      return data;
    }
  } catch (err) {
    console.warn('[ConversationService] Firestore fetch notice (falling back to memory):', err);
  }

  return null;
}

/**
 * Fetch the canonical conversation for a given contract.
 */
export async function getConversationForContract(
  contract: GigLinkContract
): Promise<ProjectConversation | null> {
  const conversationId = contract.conversationId || getCanonicalConversationId(contract.id);
  return getConversation(conversationId);
}

/**
 * Client initiates the conversation by sending the very first message.
 * Strictly enforces Client-First Initiation Rule.
 */
export async function initiateProjectConversation(params: {
  contract: GigLinkContract;
  creatorUserId: string;
  creatorName?: string;
  initialMessageText: string;
  contextType?: MessageContextType;
  milestoneId?: string | null;
  milestoneTitle?: string | null;
  changeRequestId?: string | null;
  attachments?: ProjectLinkAttachment[];
  userIsOrgAdmin?: boolean;
}): Promise<{ conversation: ProjectConversation; message: ProjectMessage }> {
  const {
    contract,
    creatorUserId,
    creatorName,
    initialMessageText,
    contextType = 'general',
    milestoneId = null,
    milestoneTitle = null,
    changeRequestId = null,
    attachments = [],
    userIsOrgAdmin = false,
  } = params;

  // 1. Authorization check
  const initCheck = canInitiateConversation(contract, creatorUserId, userIsOrgAdmin);
  if (!initCheck.allowed) {
    throw new Error(initCheck.reason || 'Initiation forbidden.');
  }

  const trimmedBody = initialMessageText.trim();
  if (!trimmedBody) {
    throw new Error('Initial message cannot be empty.');
  }

  const conversationId = contract.conversationId || getCanonicalConversationId(contract.id);
  const now = new Date().toISOString();

  // 2. Build canonical Conversation document
  const conversation: ProjectConversation = {
    id: conversationId,
    contractId: contract.id,
    opportunityId: contract.opportunityId,
    applicationId: contract.applicationId,
    creatorId: contract.creatorId,
    creatorName: creatorName || contract.creatorName || 'Client',
    talentId: contract.talentId,
    talentName: contract.talentName || 'Talent',
    status: 'active',
    contractStatus: contract.status,
    createdBy: creatorUserId,
    lastMessageAt: now,
    lastMessagePreview: trimmedBody.slice(0, 150),
    lastMessageSenderId: creatorUserId,
    lastMessageSenderRole: 'creator',
    unreadCountCreator: 0,
    unreadCountTalent: 1, // Talent has 1 unread message
    createdAt: now,
    updatedAt: now,
  };

  // 3. Build initial Message document
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const message: ProjectMessage = {
    id: messageId,
    conversationId,
    contractId: contract.id,
    senderId: creatorUserId,
    senderRole: 'creator',
    senderName: creatorName || contract.creatorName || 'Client',
    body: trimmedBody,
    contextType,
    milestoneId,
    milestoneTitle,
    changeRequestId,
    attachments: sanitizeAttachments(attachments),
    readBy: [creatorUserId],
    readAt: { [creatorUserId]: now },
    createdAt: now,
  };

  // Update in-memory store
  conversationsStore.set(conversationId, conversation);
  const existingMsgs = messagesStore.get(conversationId) || [];
  messagesStore.set(conversationId, [...existingMsgs, message]);

  // Persist to Firestore
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await setDoc(convRef, conversation);

    const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await setDoc(msgRef, message);
  } catch (err) {
    console.warn('[ConversationService] Firestore sync notice (in-memory store preserved):', err);
  }

  return { conversation, message };
}

/**
 * Sends a message in an existing conversation.
 * Handles role verification, context tagging, unread counter updates, and links.
 */
export async function sendProjectMessage(params: {
  conversationId: string;
  contract: GigLinkContract;
  senderUserId: string;
  senderRole: 'creator' | 'talent' | 'admin';
  senderName: string;
  body: string;
  contextType?: MessageContextType;
  milestoneId?: string | null;
  milestoneTitle?: string | null;
  changeRequestId?: string | null;
  attachments?: ProjectLinkAttachment[];
  userIsOrgAdmin?: boolean;
}): Promise<ProjectMessage> {
  const {
    conversationId,
    contract,
    senderUserId,
    senderRole,
    senderName,
    body,
    contextType = 'general',
    milestoneId = null,
    milestoneTitle = null,
    changeRequestId = null,
    attachments = [],
    userIsOrgAdmin = false,
  } = params;

  let conversation = await getConversation(conversationId);

  // If conversation doesn't exist yet, check if client can initiate
  if (!conversation || conversation.status === 'pending_initiation') {
    const initResult = await initiateProjectConversation({
      contract,
      creatorUserId: senderUserId,
      creatorName: senderName,
      initialMessageText: body,
      contextType,
      milestoneId,
      milestoneTitle,
      changeRequestId,
      attachments,
      userIsOrgAdmin,
    });
    return initResult.message;
  }

  // Permission check for active conversation
  const sendCheck = canSendMessage(contract, conversation, senderUserId, userIsOrgAdmin);
  if (!sendCheck.allowed) {
    throw new Error(sendCheck.reason || 'Sending message is not permitted.');
  }

  const trimmedBody = body.trim();
  if (!trimmedBody) {
    throw new Error('Message text cannot be empty.');
  }

  const now = new Date().toISOString();
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const message: ProjectMessage = {
    id: messageId,
    conversationId,
    contractId: contract.id,
    senderId: senderUserId,
    senderRole,
    senderName,
    body: trimmedBody,
    contextType,
    milestoneId,
    milestoneTitle,
    changeRequestId,
    attachments: sanitizeAttachments(attachments),
    readBy: [senderUserId],
    readAt: { [senderUserId]: now },
    createdAt: now,
  };

  // Determine updated unread counters
  const isSenderCreator = senderRole === 'creator' || senderUserId === contract.creatorId;
  const updatedCreatorUnread = isSenderCreator ? 0 : (conversation.unreadCountCreator || 0) + 1;
  const updatedTalentUnread = isSenderCreator ? (conversation.unreadCountTalent || 0) + 1 : 0;

  const updatedConversation: ProjectConversation = {
    ...conversation,
    lastMessageAt: now,
    lastMessagePreview: trimmedBody.slice(0, 150),
    lastMessageSenderId: senderUserId,
    lastMessageSenderRole: senderRole,
    unreadCountCreator: updatedCreatorUnread,
    unreadCountTalent: updatedTalentUnread,
    contractStatus: contract.status,
    updatedAt: now,
  };

  // Update in-memory
  conversationsStore.set(conversationId, updatedConversation);
  const currentList = messagesStore.get(conversationId) || [];
  messagesStore.set(conversationId, [...currentList, message]);

  // Persist to Firestore
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      lastMessageAt: now,
      lastMessagePreview: trimmedBody.slice(0, 150),
      lastMessageSenderId: senderUserId,
      lastMessageSenderRole: senderRole,
      unreadCountCreator: updatedCreatorUnread,
      unreadCountTalent: updatedTalentUnread,
      contractStatus: contract.status,
      updatedAt: now,
    });

    const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await setDoc(msgRef, message);
  } catch (err) {
    console.warn('[ConversationService] Firestore send notice (in-memory preserved):', err);
  }

  return message;
}

/**
 * Fetch all messages for a given conversation.
 */
export async function getMessages(conversationId: string): Promise<ProjectMessage[]> {
  if (!conversationId) return [];

  // Check in-memory first
  if (messagesStore.has(conversationId)) {
    return messagesStore.get(conversationId)!;
  }

  try {
    const msgsRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    const msgs = snap.docs.map((d) => d.data() as ProjectMessage);
    messagesStore.set(conversationId, msgs);
    return msgs;
  } catch (err) {
    console.warn('[ConversationService] Firestore getMessages notice:', err);
    return messagesStore.get(conversationId) || [];
  }
}

/**
 * Marks conversation messages as read for a given participant.
 */
export async function markConversationAsRead(
  conversationId: string,
  userId: string,
  contract?: GigLinkContract | null
): Promise<void> {
  if (!conversationId || !userId) return;

  const conversation = await getConversation(conversationId);
  if (!conversation) return;

  const isCreator = userId === conversation.creatorId || (contract && userId === contract.creatorId);
  const isTalent = userId === conversation.talentId || (contract && userId === contract.talentId);

  if (!isCreator && !isTalent) return;

  const updatedCreatorUnread = isCreator ? 0 : conversation.unreadCountCreator;
  const updatedTalentUnread = isTalent ? 0 : conversation.unreadCountTalent;

  const updatedConv: ProjectConversation = {
    ...conversation,
    unreadCountCreator: updatedCreatorUnread,
    unreadCountTalent: updatedTalentUnread,
  };
  conversationsStore.set(conversationId, updatedConv);

  // Update in-memory messages readBy
  const msgs = messagesStore.get(conversationId) || [];
  const now = new Date().toISOString();
  let updatedAnyMessage = false;

  const updatedMsgs = msgs.map((m) => {
    if (!m.readBy?.includes(userId)) {
      updatedAnyMessage = true;
      return {
        ...m,
        readBy: [...(m.readBy || []), userId],
        readAt: { ...(m.readAt || {}), [userId]: now },
      };
    }
    return m;
  });

  if (updatedAnyMessage) {
    messagesStore.set(conversationId, updatedMsgs);
  }

  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      unreadCountCreator: updatedCreatorUnread,
      unreadCountTalent: updatedTalentUnread,
    });
  } catch (err) {
    console.warn('[ConversationService] Error updating read state in Firestore:', err);
  }
}

/**
 * Real-time subscription to conversation metadata updates.
 */
export function subscribeToConversation(
  conversationId: string,
  onUpdate: (conv: ProjectConversation | null) => void
): Unsubscribe {
  if (!conversationId) {
    onUpdate(null);
    return () => {};
  }

  try {
    const convRef = doc(db, 'conversations', conversationId);
    return onSnapshot(
      convRef,
      (snap) => {
        if (snap.exists()) {
          const conv = snap.data() as ProjectConversation;
          conversationsStore.set(conversationId, conv);
          onUpdate(conv);
        } else {
          // Check in-memory store before returning null
          const cached = conversationsStore.get(conversationId) || null;
          onUpdate(cached);
        }
      },
      (err) => {
        console.warn('[ConversationService] Conversation snapshot error, using cached:', err);
        const cached = conversationsStore.get(conversationId) || null;
        onUpdate(cached);
      }
    );
  } catch (err) {
    console.warn('[ConversationService] subscribeToConversation error:', err);
    onUpdate(conversationsStore.get(conversationId) || null);
    return () => {};
  }
}

/**
 * Real-time subscription to conversation messages.
 */
export function subscribeToMessages(
  conversationId: string,
  onUpdate: (messages: ProjectMessage[]) => void
): Unsubscribe {
  if (!conversationId) {
    onUpdate([]);
    return () => {};
  }

  try {
    const msgsRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        const msgs = snap.docs.map((d) => d.data() as ProjectMessage);
        messagesStore.set(conversationId, msgs);
        onUpdate(msgs);
      },
      (err) => {
        console.warn('[ConversationService] Messages snapshot error, using cached:', err);
        onUpdate(messagesStore.get(conversationId) || []);
      }
    );
  } catch (err) {
    console.warn('[ConversationService] subscribeToMessages error:', err);
    onUpdate(messagesStore.get(conversationId) || []);
    return () => {};
  }
}

/**
 * Helper to sanitize and validate project link attachments.
 */
export function sanitizeAttachments(attachments?: ProjectLinkAttachment[]): ProjectLinkAttachment[] {
  if (!attachments || !Array.isArray(attachments)) return [];

  return attachments
    .filter((a) => a && typeof a.url === 'string' && a.url.trim().length > 0)
    .map((a) => ({
      type: a.type || 'custom',
      url: a.url.trim(),
      label: a.label?.trim() || undefined,
    }))
    .slice(0, 5); // Max 5 structured attachments per message
}

/**
 * Quick helper to get unread message count for a specific user.
 */
export function getUnreadCountForUser(conversation: ProjectConversation | null, userId: string): number {
  if (!conversation || !userId) return 0;
  if (userId === conversation.creatorId) return conversation.unreadCountCreator || 0;
  if (userId === conversation.talentId) return conversation.unreadCountTalent || 0;
  return 0;
}
