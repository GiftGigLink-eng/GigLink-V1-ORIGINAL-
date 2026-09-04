import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Lock,
  Clock,
  Sparkles,
  ExternalLink,
  Github,
  Figma,
  Globe,
  FileText,
  AlertCircle,
  CheckCheck,
  Check,
  Tag,
  Paperclip,
  X,
  Info,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  GigLinkContract,
  ProjectConversation,
  ProjectMessage,
  ProjectLinkAttachment,
  MessageContextType,
} from '../../types';
import {
  canInitiateConversation,
  canSendMessage,
  getConversationForContract,
  getMessages,
  initiateProjectConversation,
  sendProjectMessage,
  markConversationAsRead,
  subscribeToConversation,
  subscribeToMessages,
  getCanonicalConversationId,
  isMessagingEligible,
} from '../../lib/conversationService';
import { useToast } from '../../context/ToastContext';

interface ProjectMessagingSectionProps {
  contract: GigLinkContract;
  currentUserId: string;
  isCreator: boolean;
  isTalent: boolean;
  userIsOrgAdmin?: boolean;
  preselectedContext?: {
    contextType: MessageContextType;
    milestoneId?: string;
    milestoneTitle?: string;
    changeRequestId?: string;
  } | null;
  onClearPreselectedContext?: () => void;
}

export const ProjectMessagingSection: React.FC<ProjectMessagingSectionProps> = ({
  contract,
  currentUserId,
  isCreator,
  isTalent,
  userIsOrgAdmin = false,
  preselectedContext,
  onClearPreselectedContext,
}) => {
  const { showToast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<ProjectConversation | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Message Composer State
  const [messageBody, setMessageBody] = useState('');
  const [contextType, setContextType] = useState<MessageContextType>('general');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [attachments, setAttachments] = useState<ProjectLinkAttachment[]>([]);
  const [newAttachmentType, setNewAttachmentType] = useState<'github' | 'figma' | 'demo' | 'doc' | 'custom'>('github');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newAttachmentLabel, setNewAttachmentLabel] = useState('');

  // Handle preselected context passed from milestone cards or change request sections
  useEffect(() => {
    if (preselectedContext) {
      setContextType(preselectedContext.contextType);
      if (preselectedContext.milestoneId) {
        setSelectedMilestoneId(preselectedContext.milestoneId);
      }
    }
  }, [preselectedContext]);

  const conversationId = contract.conversationId || getCanonicalConversationId(contract.id);

  // Load initial data and real-time subscriptions
  useEffect(() => {
    if (!contract || !conversationId) return;

    let isMounted = true;

    // 1. Initial fetch
    const loadData = async () => {
      try {
        const [convData, msgsData] = await Promise.all([
          getConversationForContract(contract),
          getMessages(conversationId),
        ]);
        if (isMounted) {
          setConversation(convData);
          setMessages(msgsData);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[ProjectMessaging] Load warning:', err);
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    // 2. Real-time subscriptions
    const unsubConv = subscribeToConversation(conversationId, (updatedConv) => {
      if (isMounted && updatedConv) {
        setConversation(updatedConv);
      }
    });

    const unsubMsgs = subscribeToMessages(conversationId, (updatedMsgs) => {
      if (isMounted) {
        setMessages(updatedMsgs);
      }
    });

    return () => {
      isMounted = false;
      unsubConv();
      unsubMsgs();
    };
  }, [contract.id, conversationId]);

  // Mark as read whenever messages or active conversation is viewed
  useEffect(() => {
    if (conversation && currentUserId) {
      const hasUnread =
        (isCreator && (conversation.unreadCountCreator || 0) > 0) ||
        (isTalent && (conversation.unreadCountTalent || 0) > 0);

      if (hasUnread) {
        markConversationAsRead(conversation.id, currentUserId, contract);
      }
    }
  }, [conversation?.id, conversation?.unreadCountCreator, conversation?.unreadCountTalent, currentUserId, isCreator, isTalent]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const eligibility = isMessagingEligible(contract);
  const senderRole: 'creator' | 'talent' | 'admin' = isCreator ? 'creator' : 'talent';
  const senderName = isCreator
    ? contract.creatorName || 'Client'
    : contract.talentName || 'Talent';

  const sendCheck = canSendMessage(contract, conversation, currentUserId, userIsOrgAdmin);
  const initCheck = canInitiateConversation(contract, currentUserId, userIsOrgAdmin);

  // Add attachment handler
  const handleAddAttachment = () => {
    if (!newAttachmentUrl.trim()) {
      showToast('Please enter a valid URL', 'error');
      return;
    }
    const cleanUrl = newAttachmentUrl.trim().startsWith('http')
      ? newAttachmentUrl.trim()
      : `https://${newAttachmentUrl.trim()}`;

    setAttachments([
      ...attachments,
      {
        type: newAttachmentType,
        url: cleanUrl,
        label: newAttachmentLabel.trim() || undefined,
      },
    ]);
    setNewAttachmentUrl('');
    setNewAttachmentLabel('');
    setShowAttachmentMenu(false);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Submit message handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim() || sending) return;

    // Derive milestone title if milestone context is active
    let milestoneTitle: string | null = null;
    if (selectedMilestoneId) {
      const m = contract.milestones.find((item) => item.id === selectedMilestoneId);
      if (m) milestoneTitle = m.title;
    }

    setSending(true);
    try {
      if (!conversation || conversation.status === 'pending_initiation') {
        // Client-first initiation
        const result = await initiateProjectConversation({
          contract,
          creatorUserId: currentUserId,
          creatorName: senderName,
          initialMessageText: messageBody,
          contextType,
          milestoneId: selectedMilestoneId || null,
          milestoneTitle,
          attachments,
          userIsOrgAdmin,
        });
        setConversation(result.conversation);
        setMessages([result.message]);
        showToast('Project conversation started.', 'success');
      } else {
        // Existing active conversation message
        const newMsg = await sendProjectMessage({
          conversationId: conversation.id,
          contract,
          senderUserId: currentUserId,
          senderRole,
          senderName,
          body: messageBody,
          contextType,
          milestoneId: selectedMilestoneId || null,
          milestoneTitle,
          attachments,
          userIsOrgAdmin,
        });
        setMessages((prev) => [...prev, newMsg]);
      }

      // Reset composer
      setMessageBody('');
      setAttachments([]);
      if (onClearPreselectedContext) onClearPreselectedContext();
    } catch (err: any) {
      console.error('[ProjectMessaging] Send error:', err);
      showToast(err?.message || 'Failed to send message.', 'error');
    } finally {
      setSending(false);
    }
  };

  // Render attachment icon
  const renderAttachmentIcon = (type: string) => {
    switch (type) {
      case 'github':
        return <Github className="w-3.5 h-3.5" />;
      case 'figma':
        return <Figma className="w-3.5 h-3.5" />;
      case 'demo':
        return <Globe className="w-3.5 h-3.5" />;
      case 'doc':
        return <FileText className="w-3.5 h-3.5" />;
      default:
        return <ExternalLink className="w-3.5 h-3.5" />;
    }
  };

  // Render context badge
  const renderContextBadge = (msg: ProjectMessage) => {
    if (!msg.contextType || msg.contextType === 'general') return null;

    let badgeText = '';
    let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';

    switch (msg.contextType) {
      case 'milestone':
        badgeText = msg.milestoneTitle ? `Milestone: ${msg.milestoneTitle}` : 'Milestone';
        badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        break;
      case 'deliverable':
        badgeText = msg.milestoneTitle ? `Deliverable: ${msg.milestoneTitle}` : 'Deliverables';
        badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
      case 'revision':
        badgeText = msg.milestoneTitle ? `Revision: ${msg.milestoneTitle}` : 'Revision Request';
        badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
      case 'change_request':
        badgeText = 'Contract Scope Amendment';
        badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
        break;
      case 'final_handover':
        badgeText = 'Final Handover Assets';
        badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
    }

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${badgeColor} mb-2 max-w-full truncate`}>
        <Tag className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{badgeText}</span>
      </div>
    );
  };

  return (
    <div id="project-messaging-container" className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[650px]">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-sm">Project Communication</h3>
              {contract.status === 'active' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  Active Project
                </span>
              )}
              {contract.status === 'completed' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  <Lock className="w-3 h-3 mr-1" />
                  Archived (Read-Only)
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Secure, contract-linked channel between <span className="font-medium text-gray-700">{contract.creatorName || 'Client'}</span> and <span className="font-medium text-gray-700">{contract.talentName || 'Talent'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <span className="text-xs text-gray-400 font-mono">
              {messages.length} message{messages.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50/40 space-y-4">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-sm">Loading project messages...</p>
          </div>
        ) : !eligibility.eligible ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="text-base font-medium text-gray-900 mb-1">Messaging Locked</h4>
            <p className="text-sm text-gray-500 max-w-md">
              {eligibility.reason}
            </p>
          </div>
        ) : (!conversation || conversation.status === 'pending_initiation') && messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            {isCreator ? (
              <div className="max-w-md bg-white border border-indigo-100 rounded-xl p-6 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto mb-3">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="text-base font-semibold text-gray-900 mb-1">Initiate Project Communication</h4>
                <p className="text-sm text-gray-600 mb-4">
                  As the Client, send the first message to welcome <span className="font-medium text-gray-900">{contract.talentName || 'Talent'}</span> and share project kick-off guidelines.
                </p>
                <div className="bg-indigo-50/50 rounded-lg p-3 text-xs text-indigo-800 border border-indigo-100 text-left mb-2 flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>
                    Once you send your initial message, the talent will be notified and this channel will unlock for bidirectional messaging.
                  </span>
                </div>
              </div>
            ) : (
              <div className="max-w-md bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 mx-auto mb-3">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="text-base font-semibold text-gray-900 mb-1">Awaiting Client Kick-off</h4>
                <p className="text-sm text-gray-600">
                  Your client (<span className="font-medium text-gray-900">{contract.creatorName || 'Client'}</span>) hasn&apos;t started the project conversation yet. Once initiated, you will receive a notification and be able to reply right here.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Security Guarantee Notice */}
            <div className="flex items-center justify-center my-2">
              <div className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-500 flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>End-to-end verified project channel (Contract #{contract.id.slice(-8)})</span>
              </div>
            </div>

            {messages.map((msg) => {
              const isOwnMessage = msg.senderId === currentUserId;
              const isCreatorMsg = msg.senderRole === 'creator';

              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-semibold text-gray-800">
                      {isOwnMessage ? 'You' : msg.senderName}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                      isCreatorMsg ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {isCreatorMsg ? 'Client' : 'Talent'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-2xs ${
                      isOwnMessage
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none'
                    }`}
                  >
                    {/* Context Tag */}
                    {renderContextBadge(msg)}

                    {/* Message Body */}
                    <div className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                      {msg.body}
                    </div>

                    {/* Structured Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-black/10 flex flex-wrap gap-1.5">
                        {msg.attachments.map((att, idx) => (
                          <a
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                              isOwnMessage
                                ? 'bg-indigo-700/80 hover:bg-indigo-700 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200'
                            }`}
                          >
                            {renderAttachmentIcon(att.type)}
                            <span>{att.label || att.type.toUpperCase()}</span>
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Read Receipts */}
                  {isOwnMessage && (
                    <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-gray-400">
                      {msg.readBy && msg.readBy.length > 1 ? (
                        <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
                          <CheckCheck className="w-3 h-3" /> Seen
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Delivered
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Composer Area */}
      {eligibility.eligible && (
        <div className="p-3 bg-white border-t border-gray-200">
          {/* Read-Only Notice if contract is completed */}
          {contract.status === 'completed' ? (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center text-xs text-gray-500 flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-gray-400" />
              <span>Project completed. All messages are preserved for your records in read-only mode.</span>
            </div>
          ) : !sendCheck.allowed && !isCreator ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{sendCheck.reason}</span>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="space-y-2">
              {/* Context Selector Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-gray-400 font-medium flex items-center gap-1 flex-shrink-0">
                  <Tag className="w-3 h-3" /> Context:
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setContextType('general');
                    setSelectedMilestoneId('');
                  }}
                  className={`px-2 py-0.5 rounded-full border transition-colors flex-shrink-0 ${
                    contextType === 'general'
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  General
                </button>

                {contract.milestones && contract.milestones.length > 0 && (
                  <div className="flex items-center gap-1">
                    <select
                      value={selectedMilestoneId}
                      onChange={(e) => {
                        setSelectedMilestoneId(e.target.value);
                        if (e.target.value) setContextType('milestone');
                        else setContextType('general');
                      }}
                      className={`text-xs rounded-md px-2 py-0.5 border bg-white ${
                        contextType === 'milestone'
                          ? 'border-indigo-500 text-indigo-900 font-medium ring-1 ring-indigo-500'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      <option value="">Tag a Milestone...</option>
                      {contract.milestones.map((m, idx) => (
                        <option key={m.id} value={m.id}>
                          M{idx + 1}: {m.title.slice(0, 30)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setContextType('change_request')}
                  className={`px-2 py-0.5 rounded-full border transition-colors flex-shrink-0 ${
                    contextType === 'change_request'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  Scope Amendment
                </button>

                <button
                  type="button"
                  onClick={() => setContextType('final_handover')}
                  className={`px-2 py-0.5 rounded-full border transition-colors flex-shrink-0 ${
                    contextType === 'final_handover'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  Final Handover
                </button>
              </div>

              {/* Active Attachments Badges */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  {attachments.map((att, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white text-gray-700 text-xs border border-gray-200 shadow-2xs"
                    >
                      {renderAttachmentIcon(att.type)}
                      <span className="font-mono text-[11px] max-w-[150px] truncate">{att.label || att.url}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="text-gray-400 hover:text-rose-500 ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Attachment Creator Menu */}
              {showAttachmentMenu && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between font-medium text-indigo-900">
                    <span className="flex items-center gap-1">
                      <Paperclip className="w-3.5 h-3.5" /> Attach Project Asset Link
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAttachmentMenu(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={newAttachmentType}
                      onChange={(e: any) => setNewAttachmentType(e.target.value)}
                      className="px-2 py-1.5 bg-white border border-gray-300 rounded text-xs"
                    >
                      <option value="github">GitHub Repository</option>
                      <option value="figma">Figma Design File</option>
                      <option value="demo">Live Staging / Demo URL</option>
                      <option value="doc">Documentation / Specs</option>
                      <option value="custom">Other Link</option>
                    </select>

                    <input
                      type="url"
                      placeholder="https://..."
                      value={newAttachmentUrl}
                      onChange={(e) => setNewAttachmentUrl(e.target.value)}
                      className="px-2 py-1.5 bg-white border border-gray-300 rounded text-xs sm:col-span-2"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Optional label (e.g. 'Frontend PR #14')"
                      value={newAttachmentLabel}
                      onChange={(e) => setNewAttachmentLabel(e.target.value)}
                      className="px-2 py-1.5 bg-white border border-gray-300 rounded text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddAttachment}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition-colors"
                    >
                      Add Link
                    </button>
                  </div>
                </div>
              )}

              {/* Text Input and Action Buttons */}
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  title="Attach project link (GitHub, Figma, Demo)"
                  className={`p-2.5 rounded-lg border transition-colors flex-shrink-0 ${
                    showAttachmentMenu || attachments.length > 0
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                      : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-600'
                  }`}
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <textarea
                  id="project-message-input"
                  rows={2}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder={
                    !conversation || conversation.status === 'pending_initiation'
                      ? 'Write your project welcome message to kick off collaboration...'
                      : 'Type a project message... (Enter to send, Shift+Enter for newline)'
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  className="flex-1 p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />

                <button
                  type="submit"
                  id="send-project-message-btn"
                  disabled={!messageBody.trim() || sending}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex-shrink-0 flex items-center justify-center"
                >
                  {sending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
