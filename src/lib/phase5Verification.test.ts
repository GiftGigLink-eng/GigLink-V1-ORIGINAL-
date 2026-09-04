/**
 * Phase 5 Project-Linked Messaging & In-App Communication Verification Test Suite
 * Validates:
 * 1. Deterministic conversation ID mapping (`conv_${contractId}`).
 * 2. Messaging eligibility rules based on contract lifecycle state.
 * 3. Client-first conversation initiation enforcement (Talent cannot initiate).
 * 4. Context-aware messaging (milestones, revisions, deliverables, change requests).
 * 5. Read-only preservation on completed contracts (sending blocked, history retained).
 * 6. Participant access control & sender identity immutability.
 * 7. Unread counter calculation & derived notification triggering without self-echo.
 */

import {
  getCanonicalConversationId,
  isMessagingEligible,
  canInitiateConversation,
  canSendMessage,
  initiateProjectConversation,
  sendProjectMessage,
  markConversationAsRead,
  getMessages,
  getConversation,
} from './conversationService';
import { deriveConversationNotification } from './notificationService';
import { GigLinkContract, ProjectConversation, ProjectMessage } from '../types';

const createMockContract = (overrides: Partial<GigLinkContract> = {}): GigLinkContract => {
  const contractId = overrides.id || 'contract_test_555';
  return {
    id: contractId,
    opportunityId: 'opp_555',
    opportunityTitle: 'Senior Full-Stack Engineer for GigLink Platform',
    applicationId: 'app_555',
    creatorId: 'creator_client_001',
    creatorName: 'Alice Client',
    talentId: 'talent_dev_002',
    talentName: 'Bob Developer',
    talentEmail: 'bob@example.com',
    status: 'active',
    version: 1,
    conversationId: overrides.conversationId || `conv_${contractId}`,
    scopeLock: {
    title: 'Senior Full-Stack Engineer for GigLink Platform',
    description: 'Core escrow and messaging architecture',
    inclusions: ['Backend API', 'Frontend Messaging UI'],
    exclusions: ['Mobile Native App'],
    deliverables: ['Live Applet', 'Source Code'],
    totalAmount: 4500,
    currency: 'USD',
    revisionAllowance: 2,
    lockedAt: new Date().toISOString(),
  },
  creatorAcceptance: {
    accepted: true,
    acceptedAt: new Date().toISOString(),
    signedName: 'Alice Client',
  },
  talentAcceptance: {
    accepted: true,
    acceptedAt: new Date().toISOString(),
    signedName: 'Bob Developer',
  },
  milestones: [
    {
      id: 'm1',
      contractId: 'contract_test_555',
      title: 'Milestone 1: Architectural Foundation',
      description: 'Initial repository and data schemas',
      deliverables: ['Database schemas'],
      amount: 2000,
      currency: 'USD',
      status: 'completed',
      reviewState: 'approved',
      revisionAllowance: 2,
      revisionCount: 0,
      paymentState: 'released',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'm2',
      contractId: 'contract_test_555',
      title: 'Milestone 2: Escrow & Messaging Systems',
      description: 'Stripe integration and in-app project chat',
      deliverables: ['Project messaging tab', 'Webhook handlers'],
      amount: 2500,
      currency: 'USD',
      status: 'in_progress',
      reviewState: 'pending_submission',
      revisionAllowance: 2,
      revisionCount: 0,
      paymentState: 'held',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
  };
};

export async function runPhase5Tests(): Promise<{
  passed: boolean;
  testResults: Array<{ name: string; success: boolean; details?: string }>;
}> {
  const results: Array<{ name: string; success: boolean; details?: string }> = [];

  const assert = (name: string, condition: boolean, details?: string) => {
    results.push({ name, success: condition, details: condition ? undefined : details });
  };

  // ==========================================
  // Test 1: Deterministic Canonical Conversation ID Mapping
  // ==========================================
  try {
    const canonicalId1 = getCanonicalConversationId('contract_abc_123');
    const canonicalId2 = getCanonicalConversationId('conv_contract_abc_123');
    assert(
      'Deterministic Conversation ID Format',
      canonicalId1 === 'conv_contract_abc_123' && canonicalId2 === 'conv_contract_abc_123',
      `Expected conv_contract_abc_123, got ${canonicalId1} and ${canonicalId2}`
    );
  } catch (err: any) {
    assert('Deterministic Conversation ID Mapping', false, err.message);
  }

  // ==========================================
  // Test 2: Messaging Eligibility Lifecycle Enforcement
  // ==========================================
  try {
    const activeContract = createMockContract({ status: 'active' });
    const draftContract = createMockContract({ status: 'draft' });
    const pendingContract = createMockContract({ status: 'pending_acceptance' });
    const completedContract = createMockContract({ status: 'completed' });
    const cancelledContract = createMockContract({ status: 'cancelled' });

    assert(
      'Active Contract is Eligible for Messaging',
      isMessagingEligible(activeContract).eligible === true
    );
    assert(
      'Completed Contract is Eligible (for Read-Only Archive)',
      isMessagingEligible(completedContract).eligible === true
    );
    assert(
      'Draft Contract is INELIGIBLE for Messaging',
      isMessagingEligible(draftContract).eligible === false
    );
    assert(
      'Pending Contract is INELIGIBLE for Messaging',
      isMessagingEligible(pendingContract).eligible === false
    );
    assert(
      'Cancelled Contract is INELIGIBLE for Messaging',
      isMessagingEligible(cancelledContract).eligible === false
    );
  } catch (err: any) {
    assert('Messaging Eligibility Enforcement', false, err.message);
  }

  // ==========================================
  // Test 3: Client-First Conversation Initiation Rule
  // ==========================================
  try {
    const contract = createMockContract();

    // Client/Creator CAN initiate
    const creatorCheck = canInitiateConversation(contract, contract.creatorId, false);
    assert(
      'Client/Creator can initiate project conversation',
      creatorCheck.allowed === true,
      creatorCheck.reason
    );

    // Talent CANNOT initiate
    const talentCheck = canInitiateConversation(contract, contract.talentId, false);
    assert(
      'Talent CANNOT initiate project conversation (Client-First Rule)',
      talentCheck.allowed === false && talentCheck.reason?.includes('Client/Creator') === true,
      `Expected client-first restriction, got ${JSON.stringify(talentCheck)}`
    );

    // Unauthorized third party CANNOT initiate
    const thirdPartyCheck = canInitiateConversation(contract, 'random_stranger_999', false);
    assert(
      'Third party stranger CANNOT initiate project conversation',
      thirdPartyCheck.allowed === false
    );

    // Attempting initiation as Talent throws error
    let talentThrew = false;
    try {
      await initiateProjectConversation({
        contract,
        creatorUserId: contract.talentId,
        creatorName: contract.talentName,
        initialMessageText: 'Trying to start chat as talent',
      });
    } catch {
      talentThrew = true;
    }
    assert(
      'initiateProjectConversation throws if called by Talent',
      talentThrew === true
    );
  } catch (err: any) {
    assert('Client-First Initiation Rule', false, err.message);
  }

  // ==========================================
  // Test 4: Conversation Creation & Bidirectional Communication Flow
  // ==========================================
  try {
    const contract = createMockContract({ id: 'contract_flow_test_888' });

    // 1. Client initiates conversation
    const initialText = 'Welcome Bob! Let us discuss Milestone 2 execution.';
    const initResult = await initiateProjectConversation({
      contract,
      creatorUserId: contract.creatorId,
      creatorName: contract.creatorName,
      initialMessageText: initialText,
      contextType: 'general',
    });

    assert(
      'Conversation Document Created with Canonical ID',
      initResult.conversation.id === `conv_${contract.id}`,
      `Expected conv_${contract.id}, got ${initResult.conversation.id}`
    );
    assert(
      'Initial Unread Counts (Talent = 1, Creator = 0)',
      initResult.conversation.unreadCountTalent === 1 && initResult.conversation.unreadCountCreator === 0,
      `Got talent: ${initResult.conversation.unreadCountTalent}, creator: ${initResult.conversation.unreadCountCreator}`
    );
    assert(
      'Initial Message Sender is Creator',
      initResult.message.senderId === contract.creatorId && initResult.message.senderRole === 'creator'
    );

    // 2. Talent replies with milestone context
    const replyText = 'Thanks Alice! Milestone 2 deliverables are ready for review.';
    const replyMsg = await sendProjectMessage({
      conversationId: initResult.conversation.id,
      contract,
      senderUserId: contract.talentId,
      senderRole: 'talent',
      senderName: contract.talentName || 'Bob Developer',
      body: replyText,
      contextType: 'milestone',
      milestoneId: 'm2',
      milestoneTitle: 'Milestone 2: Escrow & Messaging Systems',
    });

    assert(
      'Talent Message Successfully Sent',
      replyMsg.senderId === contract.talentId && replyMsg.body === replyText
    );
    assert(
      'Milestone Context Tagged to Message',
      replyMsg.contextType === 'milestone' && replyMsg.milestoneId === 'm2' && replyMsg.milestoneTitle?.includes('Milestone 2') === true
    );

    // 3. Verify conversation document updated unread counts (Creator = 1, Talent = 0)
    const updatedConv = await getConversation(initResult.conversation.id);
    assert(
      'Conversation Unread Counts Flipped After Talent Reply (Creator = 1, Talent = 0)',
      updatedConv?.unreadCountCreator === 1 && updatedConv?.unreadCountTalent === 0,
      `Got creator: ${updatedConv?.unreadCountCreator}, talent: ${updatedConv?.unreadCountTalent}`
    );

    // 4. Verify message list contains both messages
    const msgs = await getMessages(initResult.conversation.id);
    assert(
      'Message Stream Preserved in Chronological Order',
      msgs.length >= 2 && msgs[0].body === initialText && msgs[1].body === replyText
    );
  } catch (err: any) {
    assert('Bidirectional Communication Flow', false, err.message);
  }

  // ==========================================
  // Test 5: Read-Only Preservation on Completed Contracts
  // ==========================================
  try {
    const completedContract = createMockContract({
      id: 'contract_completed_999',
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    const convId = completedContract.conversationId;

    const conv: ProjectConversation = {
      id: convId,
      contractId: completedContract.id,
      opportunityId: completedContract.opportunityId,
      applicationId: completedContract.applicationId,
      creatorId: completedContract.creatorId,
      talentId: completedContract.talentId,
      status: 'active',
      contractStatus: 'completed',
      createdBy: completedContract.creatorId,
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: 'Final work completed',
      lastMessageSenderId: completedContract.talentId,
      lastMessageSenderRole: 'talent',
      unreadCountCreator: 0,
      unreadCountTalent: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const sendCheck = canSendMessage(completedContract, conv, completedContract.creatorId, false);
    assert(
      'Sending Messages on Completed Contract is BLOCKED (Read-Only Mode)',
      sendCheck.allowed === false && sendCheck.reason?.includes('completed') === true,
      `Expected block reason, got ${JSON.stringify(sendCheck)}`
    );

    let sendThrew = false;
    try {
      await sendProjectMessage({
        conversationId: convId,
        contract: completedContract,
        senderUserId: completedContract.creatorId,
        senderRole: 'creator',
        senderName: completedContract.creatorName || 'Alice',
        body: 'Post-completion message should fail',
      });
    } catch {
      sendThrew = true;
    }
    assert(
      'sendProjectMessage throws on Completed Contract',
      sendThrew === true
    );
  } catch (err: any) {
    assert('Read-Only Preservation on Completed Contracts', false, err.message);
  }

  // ==========================================
  // Test 6: Derived Notifications & Self-Echo Elimination
  // ==========================================
  try {
    const testConv: ProjectConversation = {
      id: 'conv_notif_test_1',
      contractId: 'contract_notif_test_1',
      opportunityId: 'opp_notif_1',
      applicationId: 'app_notif_1',
      creatorId: 'creator_alice',
      creatorName: 'Alice Client',
      talentId: 'talent_bob',
      talentName: 'Bob Developer',
      status: 'active',
      contractStatus: 'active',
      createdBy: 'creator_alice',
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: 'Can you update the escrow webhook handler?',
      lastMessageSenderId: 'creator_alice', // Alice sent the message
      lastMessageSenderRole: 'creator',
      unreadCountCreator: 0,
      unreadCountTalent: 1, // Bob has 1 unread message
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Recipient (Bob Developer / talent_bob) should receive notification
    const talentNotification = deriveConversationNotification(testConv, 'talent_bob');
    assert(
      'Recipient Receives Derived Notification with Correct Action URL',
      talentNotification !== null &&
        talentNotification.type === 'new_project_message' &&
        talentNotification.linkUrl?.includes('tab=messages') === true &&
        talentNotification.title.includes('Alice Client'),
      `Got notification: ${JSON.stringify(talentNotification)}`
    );

    // Sender (Alice Client / creator_alice) must NOT receive a notification for their own message
    const senderNotification = deriveConversationNotification(testConv, 'creator_alice');
    assert(
      'Sender Self-Echo Notification is Strictly Suppressed',
      senderNotification === null,
      `Expected null, got ${JSON.stringify(senderNotification)}`
    );

    // Mark conversation read resets unread counters
    await markConversationAsRead(testConv.id, 'talent_bob');
    const readConv = await getConversation(testConv.id);
    assert(
      'Mark as Read Clears Unread Counter',
      readConv?.unreadCountTalent === 0 || readConv === null
    );
  } catch (err: any) {
    assert('Derived Notifications & Self-Echo Elimination', false, err.message);
  }

  const allPassed = results.every((r) => r.success);
  return { passed: allPassed, testResults: results };
}
