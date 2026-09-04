import React, { useState } from 'react';
import { Opportunity, ProposedMilestoneItem, PublicTrustPassport } from '../../types';
import { submitOpportunityProposal } from '../../lib/proposalService';
import { useToast } from '../../context/ToastContext';
import {
  ShieldCheck,
  DollarSign,
  Calendar,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Clock,
  Layers,
  X,
} from 'lucide-react';

interface ProposalSubmissionModalProps {
  opportunity: Opportunity;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  myPassport?: PublicTrustPassport | null;
  onSuccess: () => void;
  onClose: () => void;
}

export const ProposalSubmissionModal: React.FC<ProposalSubmissionModalProps> = ({
  opportunity,
  userId,
  userDisplayName,
  userEmail,
  myPassport,
  onSuccess,
  onClose,
}) => {
  const { showToast } = useToast();

  const [coverLetter, setCoverLetter] = useState('');
  const [proposedTotalUSD, setProposedTotalUSD] = useState<number | ''>(
    opportunity.compensationMax || opportunity.compensationMin || 1000
  );
  const [proposedDeliveryDays, setProposedDeliveryDays] = useState<number | ''>(14);

  // Initial milestones default
  const [milestones, setMilestones] = useState<ProposedMilestoneItem[]>([
    {
      id: 'm1',
      title: 'Milestone 1: Project Setup & Architecture',
      description: 'Initial specifications, schema design, and core project setup.',
      amountUSD: Number(proposedTotalUSD) ? Math.round(Number(proposedTotalUSD) * 0.4) : 400,
      estimatedDays: 5,
      deliverables: ['Architecture Spec', 'Initial Schemas'],
    },
    {
      id: 'm2',
      title: 'Milestone 2: Core Development & Implementation',
      description: 'Primary business logic, frontend views, and core integration.',
      amountUSD: Number(proposedTotalUSD) ? Math.round(Number(proposedTotalUSD) * 0.6) : 600,
      estimatedDays: 9,
      deliverables: ['Working Application', 'Automated Tests'],
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trustScore = myPassport?.trustScore ?? 50;
  const trustTier = myPassport?.trustTier || 'Tier 1 (Emerging)';
  const identityVerified = myPassport?.identityVerified || false;
  const minRequiredScore = opportunity.minTrustScoreRequired || 0;
  const hasInsufficientScore = trustScore < minRequiredScore;

  // Milestone sums calculation
  const totalMilestonesSum = milestones.reduce((sum, m) => sum + (Number(m.amountUSD) || 0), 0);
  const isSumMatched = Math.abs(totalMilestonesSum - Number(proposedTotalUSD)) < 0.01;

  const handleAddMilestone = () => {
    if (milestones.length >= 10) {
      setErrorMessage('A maximum of 10 milestones is allowed per proposal.');
      return;
    }
    const newId = `m${milestones.length + 1}`;
    setMilestones([
      ...milestones,
      {
        id: newId,
        title: `Milestone ${milestones.length + 1}: Final Review & Handoff`,
        description: 'Comprehensive QA, documentation, and final deployment handoff.',
        amountUSD: 200,
        estimatedDays: 3,
        deliverables: ['Documentation', 'Handover'],
      },
    ]);
  };

  const handleRemoveMilestone = (idx: number) => {
    if (milestones.length <= 1) {
      setErrorMessage('Proposal must have at least one milestone.');
      return;
    }
    const updated = milestones.filter((_, i) => i !== idx);
    setMilestones(updated);
  };

  const handleUpdateMilestone = (idx: number, field: keyof ProposedMilestoneItem, val: any) => {
    const updated = [...milestones];
    updated[idx] = { ...updated[idx], [field]: val };
    setMilestones(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (hasInsufficientScore) {
      setErrorMessage(
        `This opportunity requires a minimum Trust Score of ${minRequiredScore}. Your current Trust Score is ${trustScore}.`
      );
      return;
    }

    if (!coverLetter.trim() || coverLetter.trim().length < 10) {
      setErrorMessage('Cover letter must be at least 10 characters.');
      return;
    }

    const totalUSD = Number(proposedTotalUSD);
    if (!totalUSD || totalUSD <= 0 || isNaN(totalUSD)) {
      setErrorMessage('Please enter a valid positive proposed total amount.');
      return;
    }

    const days = Number(proposedDeliveryDays);
    if (!days || days <= 0 || isNaN(days)) {
      setErrorMessage('Please enter a valid positive delivery timeline in days.');
      return;
    }

    if (!isSumMatched) {
      setErrorMessage(
        `Milestone amounts sum ($${totalMilestonesSum.toLocaleString()}) does not equal proposed total ($${totalUSD.toLocaleString()}).`
      );
      return;
    }

    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m.title.trim() || !m.description.trim()) {
        setErrorMessage(`Milestone ${i + 1} must have a title and description.`);
        return;
      }
      if (!m.amountUSD || m.amountUSD <= 0 || isNaN(m.amountUSD)) {
        setErrorMessage(`Milestone ${i + 1} amount must be greater than $0.`);
        return;
      }
    }

    setSubmitting(true);

    try {
      await submitOpportunityProposal({
        opportunityId: opportunity.id,
        talentId: userId,
        coverLetter: coverLetter.trim(),
        proposedTotalUSD: totalUSD,
        proposedDeliveryDays: days,
        proposedMilestones: milestones,
      });

      showToast('Proposal submitted successfully!', 'success');
      onSuccess();
    } catch (err: any) {
      console.error('Proposal submission failed:', err);
      setErrorMessage(err?.message || 'Failed to submit proposal.');
      showToast('Proposal submission failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Phase 8 Proposal Engine
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Submit Structured Proposal
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-lg mt-0.5">
              {opportunity.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-start gap-3 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Submission Invariant Error</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Authoritative Passport Verification Banner */}
          <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {trustScore}
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white text-sm">
                  <span>Authoritative Trust Passport</span>
                  {identityVerified && (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {trustTier} • {identityVerified ? 'Identity Verified' : 'Standard Verification'}
                </p>
              </div>
            </div>

            {minRequiredScore > 0 && (
              <div className="text-xs">
                <span className="text-slate-500 dark:text-slate-400">Required: </span>
                <span
                  className={`font-semibold ${
                    hasInsufficientScore
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  Score {minRequiredScore}+
                </span>
              </div>
            )}
          </div>

          {/* Cover Letter */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Cover Letter & Execution Approach <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              placeholder="Outline your specific technical approach, relevant experience, and how you will execute the milestones..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none text-sm"
              required
            />
          </div>

          {/* Pricing & Timeline Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Proposed Total Amount (USD) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={proposedTotalUSD}
                  onChange={(e) =>
                    setProposedTotalUSD(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none text-sm font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Estimated Delivery (Days) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={proposedDeliveryDays}
                  onChange={(e) =>
                    setProposedDeliveryDays(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                  }
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none text-sm font-medium"
                  required
                />
              </div>
            </div>
          </div>

          {/* Structured Proposed Milestones Section */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Proposed Project Milestones ({milestones.length}/10)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  If accepted, these milestones are bound directly into the Phase 1 Scope-Locked Contract.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddMilestone}
                disabled={milestones.length >= 10}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Milestone</span>
              </button>
            </div>

            {/* Milestones List */}
            <div className="space-y-3">
              {milestones.map((m, idx) => (
                <div
                  key={m.id || idx}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Milestone {idx + 1}
                    </span>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMilestone(idx)}
                        className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1"
                        title="Remove Milestone"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={m.title}
                        onChange={(e) => handleUpdateMilestone(idx, 'title', e.target.value)}
                        placeholder="Milestone Title"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={m.amountUSD}
                          onChange={(e) =>
                            handleUpdateMilestone(
                              idx,
                              'amountUSD',
                              e.target.value === '' ? 0 : parseFloat(e.target.value)
                            )
                          }
                          placeholder="Amount"
                          className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={m.description}
                      onChange={(e) => handleUpdateMilestone(idx, 'description', e.target.value)}
                      placeholder="Milestone Deliverables & Scope Description"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Sum Verification Meter */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                isSumMatched
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {isSumMatched ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
                <span>
                  Milestones Sum: ${totalMilestonesSum.toLocaleString()} / Proposed Total: $
                  {Number(proposedTotalUSD || 0).toLocaleString()}
                </span>
              </div>
              <span>{isSumMatched ? 'Balanced' : 'Sum Mismatch'}</span>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || hasInsufficientScore || !isSumMatched}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Submitting Proposal...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>Submit Proposal</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
