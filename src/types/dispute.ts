/**
 * GigLink Contract Dispute Resolution & Mutual Cancellation Types (Phase 6)
 */

export type ContractDisputeStatus =
  | 'none'
  | 'open'
  | 'under_admin_review'
  | 'resolved_mutual_agreement'
  | 'resolved_admin_arbitration'
  | 'withdrawn';

export type DisputeReasonCategory =
  | 'deliverable_quality'
  | 'scope_disagreement'
  | 'missed_deadline'
  | 'unresponsive_counterparty'
  | 'other';

export type CancellationProposalStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'countered'
  | 'withdrawn';

export interface DisputeEvidence {
  id: string;
  uploadedByUserId: string;
  uploadedByRole: 'creator' | 'talent' | 'admin';
  title: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
  uploadedAt: string;
  description?: string;
}

export interface MutualCancellationProposal {
  id: string;
  contractId: string;
  disputeId?: string | null;
  proposedByUserId: string;
  proposedByRole: 'creator' | 'talent';
  proposedAt: string;
  reason: string;
  refundToClientAmount: number; // Gross refund to Client
  releaseToTalentAmount: number; // Gross release to Talent before platform fee
  currency: string;
  status: CancellationProposalStatus;
  respondedAt?: string | null;
  respondedByUserId?: string | null;
  responseNote?: string | null;
}

export interface AdminArbitrationVerdict {
  arbitratedByAdminId: string;
  arbitratedAt: string;
  verdictType: 'full_refund_client' | 'full_release_talent' | 'split_settlement';
  clientRefundAmount: number;
  talentReleaseGrossAmount: number;
  talentReleaseFeeAmount: number;
  talentReleaseNetAmount: number;
  adminNotes: string;
  financialLedgerRecordIds: string[];
}

export interface ContractDisputeRecord {
  id: string;
  contractId: string;
  disputedByUserId: string;
  disputedByRole: 'creator' | 'talent';
  disputedMilestoneId?: string | null; // Optional: targets specific milestone
  reasonCategory: DisputeReasonCategory;
  description: string;
  requestedRemedy: 'full_refund' | 'partial_refund' | 'full_release' | 'scope_adjustment';
  status: ContractDisputeStatus;
  evidence: DisputeEvidence[];
  cancellationProposals: MutualCancellationProposal[];
  adminArbitration?: AdminArbitrationVerdict | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
}
