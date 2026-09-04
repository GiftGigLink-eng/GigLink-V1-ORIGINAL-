export type ProofVolumeTier = 'none' | 'tier_verified' | 'tier_established' | 'tier_high_value' | 'tier_enterprise';

export interface CanonicalProofData {
  category: string;
  completedAt: string;          // ISO 8601 UTC string
  creatorPublicHandle: string;
  deliverablesSummary: string[]; // Sorted alphabetically, trimmed
  skillsDemonstrated: string[];  // Sorted alphabetically, lowercase, trimmed
  talentPublicHandle: string;
  volumeTier: ProofVolumeTier;
}

export interface PublicProjectProof {
  id: string;                       // 'proof_' + contractId
  projectTitle: string;
  category: string;
  creatorPublicHandle: string;
  talentPublicHandle: string;
  completedAt: string;
  deliverablesSummary: string[];
  skillsDemonstrated: string[];
  volumeTier: ProofVolumeTier;
  verificationHash: string;         // SHA-256 Hex
  verifiedByPlatform: boolean;
  disclosedAmountUSD?: number;      // Populated only if both parties opted to disclose volume
  createdAt: string;
}

export interface ContractFeedback {
  id: string;                       // 'feedback_' + contractId + '_' + authorId
  contractId: string;
  authorId: string;
  authorRole: 'creator' | 'talent';
  targetUserId: string;
  ratingOverall: number;            // 1 - 5 (integer)
  ratingCommunication: number;      // 1 - 5 (integer)
  ratingQuality: number;            // 1 - 5 (integer)
  ratingTimeliness: number;         // 1 - 5 (integer)
  comment: string;                  // Trimmed string, 10-1000 characters
  isPublic: boolean;
  createdAt: string;
}

export interface PublicContractFeedback {
  id: string;
  authorRole: 'creator' | 'talent';
  ratingOverall: number;
  ratingCommunication: number;
  ratingQuality: number;
  ratingTimeliness: number;
  comment: string;
  createdAt: string;
}

export interface TrustScoreBreakdown {
  overallScore: number;             // 0 - 100 integer
  milestoneScore: number;           // 0 - 100 (30% weight)
  timelinessScore: number;          // 0 - 100 (25% weight)
  feedbackScore: number;            // 0 - 100 (25% weight)
  repeatScore: number;              // 0 - 100 (10% weight)
  volumeScore: number;              // 0 - 100 (10% weight)
  disputePenaltyPoints: number;     // Deductions
  totalCompletedContracts: number;
  totalApprovedMilestones: number;
  totalContractMilestones: number;
  onTimeDeliveryRate: number;        // Percentage 0-100
  averageRating: number;            // 1.0 - 5.0
  totalFeedbackCount: number;
  volumeTier: ProofVolumeTier;
  calculatedAt: string;
}

export interface PublicTrustPassport {
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  skills: string[];
  metrics: TrustScoreBreakdown;
  proofs: PublicProjectProof[];
  publicFeedback: PublicContractFeedback[];
  memberSince: string;
  isIdentityVerified: boolean;
}
