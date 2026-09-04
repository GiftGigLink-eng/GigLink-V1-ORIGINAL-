import React, { useState } from 'react';
import {
  FileEdit,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  Lock,
  Layers,
  Calendar,
  DollarSign,
  FileCheck,
} from 'lucide-react';
import {
  GigLinkContract,
  ContractChangeRequest,
  ContractAmendmentRecord,
  ContractProposedChanges,
  ContractMilestoneChange,
  ContractScopeLock,
} from '../../types';
import {
  createChangeRequest,
  respondToChangeRequest,
  withdrawChangeRequest,
  canCreateChangeRequest,
  canRespondToChangeRequest,
  canWithdrawChangeRequest,
  getOriginalContractScope,
} from '../../lib/contractService';
import { useToast } from '../../context/ToastContext';

interface ContractAmendmentsSectionProps {
  contract: GigLinkContract;
  currentUserId: string;
  isManager: boolean;
  isTalent: boolean;
  onContractUpdated: (updatedContract: GigLinkContract) => void;
}

export const ContractAmendmentsSection: React.FC<ContractAmendmentsSectionProps> = ({
  contract,
  currentUserId,
  isManager,
  isTalent,
  onContractUpdated,
}) => {
  const { showToast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showBaselineDiff, setShowBaselineDiff] = useState(false);

  // Response Form States
  const [reviewNote, setReviewNote] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  // Create Change Request Form States
  const [crTitle, setCrTitle] = useState('');
  const [crReason, setCrReason] = useState('');
  const [crDescription, setCrDescription] = useState('');
  const [hasPriceChange, setHasPriceChange] = useState(false);
  const [newTotalAmount, setNewTotalAmount] = useState<number>(contract.scopeLock.totalAmount || 0);
  const [hasDeadlineChange, setHasDeadlineChange] = useState(false);
  const [proposedDeadline, setProposedDeadline] = useState(contract.scopeLock.deadline || '');
  const [hasRevisionChange, setHasRevisionChange] = useState(false);
  const [newRevisionAllowance, setNewRevisionAllowance] = useState<number>(contract.scopeLock.revisionAllowance || 2);
  
  // Custom deliverables/inclusions to add
  const [newInclusionInput, setNewInclusionInput] = useState('');
  const [inclusionsToAdd, setInclusionsToAdd] = useState<string[]>([]);
  const [inclusionsToRemove, setInclusionsToRemove] = useState<string[]>([]);

  // Milestone modifications inside change request
  const [milestoneChanges, setMilestoneChanges] = useState<ContractMilestoneChange[]>([]);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneAmount, setNewMilestoneAmount] = useState<number>(0);
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState('');
  const [newMilestoneDeliverables, setNewMilestoneDeliverables] = useState('');

  const currentVersion = contract.version || 1;
  const changeRequests = contract.changeRequests || [];
  const amendmentHistory = contract.amendmentHistory || [];

  const pendingChangeRequest = changeRequests.find((cr) => cr.status === 'pending');
  const createCheck = canCreateChangeRequest(contract, currentUserId);
  const originalScope = getOriginalContractScope(contract);

  // Reset form
  const resetForm = () => {
    setCrTitle('');
    setCrReason('');
    setCrDescription('');
    setHasPriceChange(false);
    setNewTotalAmount(contract.scopeLock.totalAmount || 0);
    setHasDeadlineChange(false);
    setProposedDeadline(contract.scopeLock.deadline || '');
    setHasRevisionChange(false);
    setNewRevisionAllowance(contract.scopeLock.revisionAllowance || 2);
    setInclusionsToAdd([]);
    setInclusionsToRemove([]);
    setMilestoneChanges([]);
    setNewMilestoneTitle('');
    setNewMilestoneAmount(0);
    setNewMilestoneDueDate('');
    setNewMilestoneDeliverables('');
  };

  // Add a new milestone change
  const handleAddMilestoneChange = () => {
    if (!newMilestoneTitle.trim()) {
      showToast('Milestone title is required.', 'error');
      return;
    }
    const deliverablesList = newMilestoneDeliverables
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const changeItem: ContractMilestoneChange = {
      type: 'add',
      title: newMilestoneTitle.trim(),
      amount: newMilestoneAmount >= 0 ? newMilestoneAmount : 0,
      dueDate: newMilestoneDueDate || undefined,
      deliverables: deliverablesList.length > 0 ? deliverablesList : ['Key Milestone Deliverable'],
    };

    setMilestoneChanges((prev) => [...prev, changeItem]);
    setNewMilestoneTitle('');
    setNewMilestoneAmount(0);
    setNewMilestoneDueDate('');
    setNewMilestoneDeliverables('');
  };

  // Mark an existing milestone for removal
  const handleToggleRemoveMilestone = (mId: string) => {
    const existingChangeIndex = milestoneChanges.findIndex(
      (mc) => mc.milestoneId === mId && mc.type === 'remove'
    );
    if (existingChangeIndex >= 0) {
      setMilestoneChanges((prev) => prev.filter((_, idx) => idx !== existingChangeIndex));
    } else {
      setMilestoneChanges((prev) => [...prev, { type: 'remove', milestoneId: mId }]);
    }
  };

  // Add custom inclusion to add
  const handleAddInclusion = () => {
    if (!newInclusionInput.trim()) return;
    setInclusionsToAdd((prev) => [...prev, newInclusionInput.trim()]);
    setNewInclusionInput('');
  };

  // Submit new Change Request
  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crTitle.trim() || !crReason.trim()) {
      showToast('Title and justification reason are required.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const proposedChanges: ContractProposedChanges = {
        newTotalAmount: hasPriceChange ? newTotalAmount : undefined,
        proposedDeadline: hasDeadlineChange ? proposedDeadline : undefined,
        newRevisionAllowance: hasRevisionChange ? newRevisionAllowance : undefined,
        inclusionsToAdd: inclusionsToAdd.length > 0 ? inclusionsToAdd : undefined,
        inclusionsToRemove: inclusionsToRemove.length > 0 ? inclusionsToRemove : undefined,
        milestoneChanges: milestoneChanges.length > 0 ? milestoneChanges : undefined,
      };

      const result = await createChangeRequest({
        contractId: contract.id,
        userId: currentUserId,
        title: crTitle,
        reason: crReason,
        description: crDescription,
        proposedChanges,
      });

      onContractUpdated(result.contract);
      showToast('Change request submitted! Awaiting counterparty review.', 'success');
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit change request.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Respond to Change Request (Approve / Reject)
  const handleRespond = async (decision: 'approved' | 'rejected') => {
    if (!pendingChangeRequest) return;
    setIsResponding(true);
    try {
      const result = await respondToChangeRequest({
        contractId: contract.id,
        changeRequestId: pendingChangeRequest.id,
        userId: currentUserId,
        decision,
        responseNote: reviewNote,
      });

      onContractUpdated(result.contract);
      if (decision === 'approved') {
        showToast(`Amendment approved! Contract updated to Version ${result.contract.version}.`, 'success');
      } else {
        showToast('Change request rejected.', 'info');
      }
      setReviewNote('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to process change request.', 'error');
    } finally {
      setIsResponding(false);
    }
  };

  // Withdraw Change Request
  const handleWithdraw = async () => {
    if (!pendingChangeRequest) return;
    setIsResponding(true);
    try {
      const result = await withdrawChangeRequest({
        contractId: contract.id,
        changeRequestId: pendingChangeRequest.id,
        userId: currentUserId,
      });
      onContractUpdated(result.contract);
      showToast('Change request withdrawn.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to withdraw change request.', 'error');
    } finally {
      setIsResponding(false);
    }
  };

  return (
    <div id="contract-amendments-container" className="space-y-6">
      {/* Amendment Header & Controls Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Contract Versioning & Scope Governance
                </h2>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300">
                  v{currentVersion}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {amendmentHistory.length === 0
                  ? 'Baseline Agreement (v1) in effect — Scope is strictly locked.'
                  : `${amendmentHistory.length} formal amendment(s) ratified.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Original Scope Baseline Button */}
            {currentVersion > 1 && (
              <button
                type="button"
                id="toggle-scope-diff-btn"
                onClick={() => setShowBaselineDiff(!showBaselineDiff)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
              >
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>{showBaselineDiff ? 'Hide v1 Comparison' : 'Compare v1 Baseline'}</span>
              </button>
            )}

            {/* View Amendment History Button */}
            {amendmentHistory.length > 0 && (
              <button
                type="button"
                id="view-amendment-history-btn"
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
              >
                <FileCheck className="w-3.5 h-3.5 text-violet-500" />
                <span>History ({amendmentHistory.length})</span>
                {showHistoryDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Request Change Button */}
            {createCheck.allowed && !pendingChangeRequest && (
              <button
                type="button"
                id="request-contract-amendment-btn"
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span>Request Scope Change</span>
              </button>
            )}
          </div>
        </div>

        {/* Completed Contract Locked Notice */}
        {contract.status === 'completed' && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              <strong>Project Finalized:</strong> This contract has been signed off and completed. Scope and terms are permanently immutable.
            </span>
          </div>
        )}

        {/* Baseline v1 Comparison Drawer */}
        {showBaselineDiff && currentVersion > 1 && (
          <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  Baseline (Version 1) vs Active (Version {currentVersion}) Scope
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/30 space-y-2">
                <span className="font-bold text-slate-500 block">Original Scope (v1 Baseline)</span>
                <div><strong>Title:</strong> {originalScope.title}</div>
                <div><strong>Agreed Amount:</strong> ${originalScope.totalAmount} {originalScope.currency}</div>
                <div><strong>Deadline:</strong> {originalScope.deadline || 'None'}</div>
                <div><strong>Revision Allowance:</strong> {originalScope.revisionAllowance} rounds</div>
                <div className="pt-2">
                  <span className="font-semibold block text-slate-600 dark:text-slate-400 mb-1">Inclusions:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                    {originalScope.inclusions?.map((inc, i) => <li key={i}>{inc}</li>)}
                  </ul>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-violet-100 dark:border-violet-900/30 space-y-2">
                <span className="font-bold text-violet-600 dark:text-violet-400 block">Active Ratified Scope (v{currentVersion})</span>
                <div><strong>Title:</strong> {contract.scopeLock.title}</div>
                <div><strong>Agreed Amount:</strong> ${contract.scopeLock.totalAmount} {contract.scopeLock.currency}</div>
                <div><strong>Deadline:</strong> {contract.scopeLock.deadline || 'None'}</div>
                <div><strong>Revision Allowance:</strong> {contract.scopeLock.revisionAllowance} rounds</div>
                <div className="pt-2">
                  <span className="font-semibold block text-slate-600 dark:text-slate-400 mb-1">Inclusions:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                    {contract.scopeLock.inclusions?.map((inc, i) => <li key={i}>{inc}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ratified Amendment History List */}
        {showHistoryDrawer && amendmentHistory.length > 0 && (
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Ratified Amendment Audit Trail
            </h4>
            <div className="space-y-3">
              {amendmentHistory.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-violet-600 dark:text-violet-400">
                        v{rec.versionBefore} → v{rec.versionAfter}: {rec.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Ratified on {new Date(rec.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-slate-600 dark:text-slate-400">
                    <strong>Justification:</strong> {rec.reason}
                  </p>

                  <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
                    <span>Proposed by: <strong>{rec.requestedByName}</strong></span>
                    <span>Approved by: <strong>{rec.approvedByName}</strong></span>
                  </div>

                  {rec.diff && rec.diff.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                        Recorded Amendments:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {rec.diff.map((d, dIdx) => (
                          <div key={dIdx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-[11px] space-y-0.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">{d.label}</span>
                            <span className="text-violet-600 dark:text-violet-400 block font-medium">{d.changeDescription}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active / Pending Change Request Review Card */}
        {pendingChangeRequest && (
          <div
            id="pending-change-request-card"
            className="p-6 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700/60 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 dark:border-amber-800/60 pb-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                    Change Request Pending Review: {pendingChangeRequest.title}
                  </h3>
                  <span className="text-xs text-amber-800 dark:text-amber-400">
                    Submitted by {pendingChangeRequest.requestedByName} ({pendingChangeRequest.requestedByRole === 'talent' ? 'Talent' : 'Client'}) on {new Date(pendingChangeRequest.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                Action Required
              </span>
            </div>

            {/* Justification & Specifications */}
            <div className="space-y-2 text-xs text-amber-950 dark:text-amber-200">
              <div>
                <strong>Justification / Reason:</strong>
                <p className="mt-0.5 p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800 text-slate-700 dark:text-slate-300">
                  {pendingChangeRequest.reason}
                </p>
              </div>

              {pendingChangeRequest.description && (
                <div>
                  <strong>Detailed Specifications:</strong>
                  <p className="mt-0.5 p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800 text-slate-700 dark:text-slate-300">
                    {pendingChangeRequest.description}
                  </p>
                </div>
              )}
            </div>

            {/* Proposed Amendments Breakdown */}
            <div className="space-y-2 text-xs">
              <strong className="text-amber-950 dark:text-amber-200 block">Proposed Scope Modifications:</strong>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {pendingChangeRequest.proposedChanges.newTotalAmount !== undefined && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 space-y-1">
                    <span className="text-slate-400 block font-medium">Proposed Budget</span>
                    <div className="text-sm font-extrabold text-emerald-600">
                      ${pendingChangeRequest.proposedChanges.newTotalAmount} {contract.scopeLock.currency}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Current: ${contract.scopeLock.totalAmount}
                    </span>
                  </div>
                )}

                {pendingChangeRequest.proposedChanges.proposedDeadline && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 space-y-1">
                    <span className="text-slate-400 block font-medium">Target Deadline</span>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {pendingChangeRequest.proposedChanges.proposedDeadline}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Current: {contract.scopeLock.deadline || 'None'}
                    </span>
                  </div>
                )}

                {pendingChangeRequest.proposedChanges.newRevisionAllowance !== undefined && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 space-y-1">
                    <span className="text-slate-400 block font-medium">Revision Allowance</span>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {pendingChangeRequest.proposedChanges.newRevisionAllowance} rounds
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Current: {contract.scopeLock.revisionAllowance} rounds
                    </span>
                  </div>
                )}
              </div>

              {/* Proposed Milestone Changes */}
              {pendingChangeRequest.proposedChanges.milestoneChanges && pendingChangeRequest.proposedChanges.milestoneChanges.length > 0 && (
                <div className="mt-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 space-y-2">
                  <span className="font-bold text-slate-900 dark:text-white block text-xs">
                    Milestone Schedule Adjustments:
                  </span>
                  <div className="space-y-1.5">
                    {pendingChangeRequest.proposedChanges.milestoneChanges.map((mc, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                        <span className="flex items-center gap-1.5">
                          {mc.type === 'add' && <span className="font-bold text-emerald-600">+ Add:</span>}
                          {mc.type === 'modify' && <span className="font-bold text-amber-600">~ Modify:</span>}
                          {mc.type === 'remove' && <span className="font-bold text-rose-600">- Remove:</span>}
                          <span className="font-medium text-slate-800 dark:text-slate-200">{mc.title || mc.milestoneId}</span>
                        </span>
                        {mc.amount !== undefined && (
                          <span className="font-mono text-slate-600 dark:text-slate-300 font-bold">${mc.amount}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Review Decision Controls */}
            {canRespondToChangeRequest(contract, pendingChangeRequest.id, currentUserId).allowed ? (
              <div className="pt-3 border-t border-amber-200 dark:border-amber-800 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Response Note / Review Feedback (Optional):
                  </label>
                  <input
                    type="text"
                    id="cr-response-note-input"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="e.g. Approved. Let's incorporate these additional graphics."
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    id="approve-change-request-btn"
                    disabled={isResponding}
                    onClick={() => handleRespond('approved')}
                    className="flex-1 text-xs font-bold py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Amend Scope (v{currentVersion + 1})</span>
                  </button>

                  <button
                    type="button"
                    id="reject-change-request-btn"
                    disabled={isResponding}
                    onClick={() => handleRespond('rejected')}
                    className="flex-1 text-xs font-bold py-2.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Decline Request</span>
                  </button>
                </div>
              </div>
            ) : pendingChangeRequest.requestedBy === currentUserId ? (
              /* Requester waiting state with option to withdraw */
              <div className="pt-3 border-t border-amber-200 dark:border-amber-800 flex items-center justify-between">
                <span className="text-xs text-amber-800 dark:text-amber-300 italic">
                  Awaiting counterparty review and signature. Self-approval is strictly forbidden.
                </span>
                <button
                  type="button"
                  id="withdraw-change-request-btn"
                  disabled={isResponding}
                  onClick={handleWithdraw}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Withdraw Request
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* CREATE CHANGE REQUEST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            id="create-change-request-modal"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full my-8 space-y-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
                  <FileEdit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Submit Formal Scope Change Request
                  </h3>
                  <p className="text-xs text-slate-500">
                    Propose amendments to contract terms. Scope will update only upon counterparty approval.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitChangeRequest} className="space-y-4 text-xs">
              {/* Title & Reason */}
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Change Request Title *
                  </label>
                  <input
                    type="text"
                    id="cr-form-title-input"
                    required
                    value={crTitle}
                    onChange={(e) => setCrTitle(e.target.value)}
                    placeholder="e.g. Scope Extension: Additional Landing Page Illustrations"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Justification & Business Reason *
                  </label>
                  <textarea
                    id="cr-form-reason-input"
                    required
                    rows={2}
                    value={crReason}
                    onChange={(e) => setCrReason(e.target.value)}
                    placeholder="Explain why this change is necessary (e.g. Client requested 3 additional custom asset variants beyond original v1 scope)..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Detailed Scope Description (Optional)
                  </label>
                  <textarea
                    id="cr-form-description-input"
                    rows={2}
                    value={crDescription}
                    onChange={(e) => setCrDescription(e.target.value)}
                    placeholder="Provide technical details or acceptance criteria for this amendment..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Adjust Budget & Compensation */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      id="cr-enable-price-change-checkbox"
                      checked={hasPriceChange}
                      onChange={(e) => setHasPriceChange(e.target.checked)}
                      className="rounded text-violet-600 focus:ring-violet-500"
                    />
                    <span>Adjust Contract Total Budget / Compensation</span>
                  </label>
                  <span className="text-slate-400">Current: ${contract.scopeLock.totalAmount}</span>
                </div>

                {hasPriceChange && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        New Total Amount (${contract.scopeLock.currency})
                      </label>
                      <input
                        type="number"
                        id="cr-new-total-amount-input"
                        min="0"
                        value={newTotalAmount}
                        onChange={(e) => setNewTotalAmount(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <span className="text-xs text-slate-500 pb-2">
                        Delta: <strong>{newTotalAmount - contract.scopeLock.totalAmount >= 0 ? `+$${newTotalAmount - contract.scopeLock.totalAmount}` : `-$${contract.scopeLock.totalAmount - newTotalAmount}`}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Adjust Deadline & Revision Allowance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80 space-y-2">
                  <label className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      id="cr-enable-deadline-change-checkbox"
                      checked={hasDeadlineChange}
                      onChange={(e) => setHasDeadlineChange(e.target.checked)}
                      className="rounded text-violet-600 focus:ring-violet-500"
                    />
                    <span>Adjust Target Deadline</span>
                  </label>
                  {hasDeadlineChange && (
                    <input
                      type="date"
                      id="cr-proposed-deadline-input"
                      value={proposedDeadline}
                      onChange={(e) => setProposedDeadline(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white mt-1"
                    />
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80 space-y-2">
                  <label className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      id="cr-enable-revision-change-checkbox"
                      checked={hasRevisionChange}
                      onChange={(e) => setHasRevisionChange(e.target.checked)}
                      className="rounded text-violet-600 focus:ring-violet-500"
                    />
                    <span>Adjust Revision Allowance</span>
                  </label>
                  {hasRevisionChange && (
                    <input
                      type="number"
                      id="cr-new-revision-allowance-input"
                      min="1"
                      max="10"
                      value={newRevisionAllowance}
                      onChange={(e) => setNewRevisionAllowance(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white mt-1"
                    />
                  )}
                </div>
              </div>

              {/* Milestone Adjustments */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80 space-y-3">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Milestone Modifications (Optional):
                </span>

                {/* List Existing Unapproved Milestones for Removal / Adjustment */}
                {contract.milestones.some((m) => m.reviewState !== 'approved') && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 block">Existing Active Milestones:</span>
                    {contract.milestones
                      .filter((m) => m.reviewState !== 'approved')
                      .map((m) => {
                        const isMarked = milestoneChanges.some((mc) => mc.milestoneId === m.id && mc.type === 'remove');
                        return (
                          <div
                            key={m.id}
                            className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                              isMarked ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <span className={isMarked ? 'line-through text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'}>
                              {m.title} (${m.amount})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleRemoveMilestone(m.id)}
                              className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${
                                isMarked ? 'bg-slate-200 dark:bg-slate-700 text-slate-700' : 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {isMarked ? 'Undo Remove' : 'Propose Removal'}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Add New Milestone Row */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-500 block">+ Propose New Milestone:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      id="cr-new-milestone-title-input"
                      placeholder="Milestone Title"
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <input
                      type="number"
                      id="cr-new-milestone-amount-input"
                      placeholder="Amount ($)"
                      min="0"
                      value={newMilestoneAmount || ''}
                      onChange={(e) => setNewMilestoneAmount(parseFloat(e.target.value) || 0)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      id="cr-add-milestone-btn"
                      onClick={handleAddMilestoneChange}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-white font-bold hover:bg-slate-900"
                    >
                      + Add to Request
                    </button>
                  </div>
                </div>

                {/* Added Milestone Changes Summary */}
                {milestoneChanges.filter((mc) => mc.type === 'add').length > 0 && (
                  <div className="space-y-1 pt-2">
                    <span className="text-[11px] font-semibold text-emerald-600 block">Newly Added Milestones in Request:</span>
                    {milestoneChanges
                      .filter((mc) => mc.type === 'add')
                      .map((mc, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                          <span className="text-emerald-800 dark:text-emerald-300 font-medium">
                            + {mc.title} (${mc.amount})
                          </span>
                          <button
                            type="button"
                            onClick={() => setMilestoneChanges((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-rose-500 hover:text-rose-700 font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="submit-new-change-request-form-btn"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-md transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Change Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
