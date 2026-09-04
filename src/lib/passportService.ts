import {
  CanonicalProofData,
  PublicProjectProof,
  ProofVolumeTier,
  TrustScoreBreakdown,
  PublicTrustPassport,
  ContractFeedback,
} from '../types/passport';
import { GigLinkContract } from '../types';
import { FinancialLedgerRecord } from '../types/financial';
import { doc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

// ==========================================
// In-Memory Fallback Cache for Server/Testing Contexts
// ==========================================
const inMemoryProofs = new Map<string, PublicProjectProof>();

// ==========================================
// Cryptographic Canonical Hash Implementation
// ==========================================

export async function computeCanonicalProofHash(payload: CanonicalProofData): Promise<string> {
  const canonicalObject = {
    category: payload.category.trim(),
    completedAt: new Date(payload.completedAt).toISOString(),
    creatorPublicHandle: payload.creatorPublicHandle.trim(),
    deliverablesSummary: [...payload.deliverablesSummary].map((s) => s.trim()).sort(),
    skillsDemonstrated: [...payload.skillsDemonstrated].map((s) => s.trim().toLowerCase()).sort(),
    talentPublicHandle: payload.talentPublicHandle.trim(),
    volumeTier: payload.volumeTier,
  };

  const jsonString = JSON.stringify(canonicalObject);

  // Use Web Crypto API or Node crypto fallback
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Synchronous Node fallback if available
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(jsonString, 'utf8').digest('hex');
  }
}

export function computeVolumeTier(settledVolumeUSD: number): ProofVolumeTier {
  if (settledVolumeUSD >= 25000) return 'tier_enterprise';
  if (settledVolumeUSD >= 5000) return 'tier_high_value';
  if (settledVolumeUSD >= 1000) return 'tier_established';
  if (settledVolumeUSD > 0) return 'tier_verified';
  return 'none';
}

// ==========================================
// Deterministic Trust Score Engine
// ==========================================

export interface TrustScoreInputs {
  contracts: GigLinkContract[];
  ledgerRecords: FinancialLedgerRecord[];
  receivedFeedback: ContractFeedback[];
  openDisputeCount?: number;
  adverseDisputeCount?: number;
}

export function calculateDeterministicTrustScore(
  userId: string,
  inputs: TrustScoreInputs
): TrustScoreBreakdown {
  const { contracts, ledgerRecords, receivedFeedback, openDisputeCount = 0, adverseDisputeCount = 0 } = inputs;

  const completedContracts = contracts.filter(
    (c) => (c.creatorId === userId || c.talentId === userId) && c.status === 'completed'
  );

  // 1. Milestone Success Rate (Weight 30%)
  let totalContractMilestones = 0;
  let totalApprovedMilestones = 0;
  contracts
    .filter((c) => c.creatorId === userId || c.talentId === userId)
    .forEach((c) => {
      if (c.milestones && Array.isArray(c.milestones)) {
        c.milestones.forEach((m) => {
          totalContractMilestones++;
          if (m.reviewState === 'approved') {
            totalApprovedMilestones++;
          }
        });
      }
    });

  const milestoneScore =
    totalContractMilestones === 0
      ? 80.0
      : Math.min(100.0, (totalApprovedMilestones / totalContractMilestones) * 100.0);

  // 2. On-Time Delivery Rate (Weight 25%)
  let datedMilestoneCount = 0;
  let onTimeMilestoneCount = 0;
  contracts
    .filter((c) => c.talentId === userId) // Timeliness primarily evaluates delivery role
    .forEach((c) => {
      if (c.milestones && Array.isArray(c.milestones)) {
        c.milestones.forEach((m) => {
          if (m.dueDate && m.submission && m.submission.submittedAt) {
            datedMilestoneCount++;
            const dueDateMs = new Date(m.dueDate).getTime();
            const subDateMs = new Date(m.submission.submittedAt).getTime();
            if (subDateMs <= dueDateMs) {
              onTimeMilestoneCount++;
            }
          }
        });
      }
    });

  const timelinessScore =
    datedMilestoneCount === 0
      ? 100.0
      : Math.min(100.0, (onTimeMilestoneCount / datedMilestoneCount) * 100.0);
  const onTimeDeliveryRate = datedMilestoneCount === 0 ? 100.0 : (onTimeMilestoneCount / datedMilestoneCount) * 100.0;

  // 3. Verified Peer Feedback Score (Weight 25%)
  const validFeedback = receivedFeedback.filter((f) => f.targetUserId === userId);
  let feedbackScore = 80.0;
  let averageRating = 5.0;
  if (validFeedback.length > 0) {
    const sum = validFeedback.reduce((acc, f) => acc + f.ratingOverall, 0);
    averageRating = sum / validFeedback.length;
    // Map 1.0 - 5.0 onto 0.0 - 100.0
    feedbackScore = Math.max(0.0, Math.min(100.0, ((averageRating - 1.0) / 4.0) * 100.0));
  }

  // 4. Repeat Collaboration Score (Weight 10%)
  let repeatScore = 0.0;
  const totalCompletedCount = completedContracts.length;
  if (totalCompletedCount > 1) {
    const counterpartyCounts = new Map<string, number>();
    completedContracts.forEach((c) => {
      const other = c.creatorId === userId ? c.talentId : c.creatorId;
      counterpartyCounts.set(other, (counterpartyCounts.get(other) || 0) + 1);
    });
    let repeatContracts = 0;
    counterpartyCounts.forEach((count) => {
      if (count > 1) {
        repeatContracts += count;
      }
    });
    repeatScore = Math.min(100.0, (repeatContracts / totalCompletedCount) * 150.0);
  }

  // 5. Settled Volume Maturity Score (Weight 10%)
  // Sum settled ledger volume involving this user
  let totalSettledVolumeUSD = 0;
  ledgerRecords.forEach((r) => {
    if (r.status === 'succeeded' && (r.payerId === userId || r.recipientId === userId)) {
      if (r.type === 'milestone_released' || r.type === 'payout_completed') {
        totalSettledVolumeUSD += r.amount;
      }
    }
  });

  const volumeScore =
    totalSettledVolumeUSD <= 0
      ? 0.0
      : Math.min(100.0, Math.log10(1.0 + totalSettledVolumeUSD / 100.0) * 50.0);

  // 6. Dispute Penalty Invariant
  const disputePenaltyPoints = openDisputeCount * 5.0 + adverseDisputeCount * 15.0;

  // 7. Base and Final Score
  const baseScore =
    0.30 * milestoneScore +
    0.25 * timelinessScore +
    0.25 * feedbackScore +
    0.10 * repeatScore +
    0.10 * volumeScore;

  const rawFinalScore = baseScore - disputePenaltyPoints;
  const overallScore = Math.round(Math.max(0, Math.min(100, rawFinalScore)));

  return {
    overallScore,
    milestoneScore: Math.round(milestoneScore * 10) / 10,
    timelinessScore: Math.round(timelinessScore * 10) / 10,
    feedbackScore: Math.round(feedbackScore * 10) / 10,
    repeatScore: Math.round(repeatScore * 10) / 10,
    volumeScore: Math.round(volumeScore * 10) / 10,
    disputePenaltyPoints,
    totalCompletedContracts: totalCompletedCount,
    totalApprovedMilestones,
    totalContractMilestones,
    onTimeDeliveryRate: Math.round(onTimeDeliveryRate * 10) / 10,
    averageRating: Math.round(averageRating * 100) / 100,
    totalFeedbackCount: validFeedback.length,
    volumeTier: computeVolumeTier(totalSettledVolumeUSD),
    calculatedAt: new Date().toISOString(),
  };
}

// ==========================================
// Project Proof Generation Service (Server/Admin Authoritative)
// ==========================================

export async function generateProjectProofArtifact(
  contract: GigLinkContract,
  ledgerRecords: FinancialLedgerRecord[],
  creatorPublicHandle: string,
  talentPublicHandle: string
): Promise<PublicProjectProof> {
  // Invariant 1: Terminal Status
  if (contract.status !== 'completed') {
    throw new Error(`Cannot generate proof: Contract ${contract.id} is in status '${contract.status}', must be 'completed'.`);
  }

  // Invariant 2: Milestone Approval & Escrow Release
  const allApprovedAndReleased = contract.milestones.every(
    (m) => m.reviewState === 'approved' && (m.paymentState === 'released' || m.paymentState === 'refunded')
  );
  if (!allApprovedAndReleased && contract.milestones.length > 0) {
    throw new Error(`Cannot generate proof: All milestones in contract ${contract.id} must be approved and settled.`);
  }

  // Invariant 3: Authoritative Settlement Verification from Ledger
  const contractSettledLedger = ledgerRecords.filter(
    (r) => r.contractId === contract.id && r.status === 'succeeded'
  );
  const totalSettledAmount = contractSettledLedger.reduce((sum, r) => sum + (r.amount || 0), 0);

  const deliverablesSummary = contract.milestones.map((m) => m.title);
  const skillsDemonstrated = contract.scopeLock?.deliverables || [];
  const volumeTier = computeVolumeTier(totalSettledAmount);
  const completedAt = contract.completedAt || contract.updatedAt || new Date().toISOString();
  const projectTitle = contract.opportunityTitle || contract.scopeLock?.title || 'Completed Project';

  const canonicalPayload: CanonicalProofData = {
    category: 'Verified Delivery',
    completedAt,
    creatorPublicHandle,
    deliverablesSummary,
    skillsDemonstrated,
    talentPublicHandle,
    volumeTier,
  };

  const verificationHash = await computeCanonicalProofHash(canonicalPayload);
  const proofId = `proof_${contract.id}`;

  const proof: PublicProjectProof = {
    id: proofId,
    projectTitle,
    category: canonicalPayload.category,
    creatorPublicHandle,
    talentPublicHandle,
    completedAt,
    deliverablesSummary,
    skillsDemonstrated,
    volumeTier,
    verificationHash,
    verifiedByPlatform: true,
    createdAt: new Date().toISOString(),
  };

  // Cache in-memory
  inMemoryProofs.set(proofId, proof);

  // Persist to Firestore
  try {
    const proofRef = doc(db, 'projectProofs', proofId);
    await setDoc(proofRef, proof);
  } catch (err) {
    console.warn(`[PassportService] Notice: Could not write proof to Firestore, saved to in-memory store:`, err);
  }

  return proof;
}

export async function getProjectProof(proofId: string): Promise<PublicProjectProof | null> {
  if (inMemoryProofs.has(proofId)) {
    return inMemoryProofs.get(proofId)!;
  }
  try {
    const snap = await getDoc(doc(db, 'projectProofs', proofId));
    if (snap.exists()) {
      const proof = snap.data() as PublicProjectProof;
      inMemoryProofs.set(proofId, proof);
      return proof;
    }
  } catch (err) {
    console.warn(`[PassportService] getProjectProof Firestore read error:`, err);
  }
  return null;
}

export async function verifyProofIntegrity(proof: PublicProjectProof): Promise<boolean> {
  const canonicalPayload: CanonicalProofData = {
    category: proof.category,
    completedAt: proof.completedAt,
    creatorPublicHandle: proof.creatorPublicHandle,
    deliverablesSummary: proof.deliverablesSummary,
    skillsDemonstrated: proof.skillsDemonstrated,
    talentPublicHandle: proof.talentPublicHandle,
    volumeTier: proof.volumeTier,
  };
  const expectedHash = await computeCanonicalProofHash(canonicalPayload);
  return expectedHash === proof.verificationHash;
}
