export interface TranscriptPrivacySettings {
  showFinancialVolume: boolean;     // Show exact $ or hide/display volume tier only
  showCounterpartyNames: boolean;    // Show client/creator names or anonymize to "Verified Client"
  showCompletedContracts: boolean;   // Include list of completed milestone contracts
  showProjectProofs: boolean;        // Include verified source code/design artifact proofs
  showKycAttestation: boolean;       // Include government identity verification badge
  showSkillsList: boolean;           // Include verified and self-attested skills
}

export interface TranscriptContractRecord {
  contractId: string;
  opportunityTitle: string;
  category: string;
  completedAt: string;
  milestoneCount: number;
  amountUSD?: number;
  counterpartyDisplay: string;
}

export interface TranscriptProjectProofRecord {
  proofId: string;
  title: string;
  category: string;
  verifiedUrl?: string;
  verifiedAt: string;
  skills: string[];
}

export interface TranscriptVerifiedSnapshot {
  talentId: string;
  talentDisplayName: string;
  talentHeadline?: string;
  talentBio?: string;
  talentAvatarUrl?: string;
  talentLocation?: string;
  trustScore: number;
  trustTier: string;
  identityVerified: boolean;
  identityVerifiedAt?: string;
  totalCompletedContracts: number;
  totalMilestonesDelivered: number;
  totalSettledVolumeUSD?: number;
  volumeTier: string;
  memberSince: string;
  verifiedSkills: string[];
  contracts: TranscriptContractRecord[];
  projectProofs: TranscriptProjectProofRecord[];
}

export interface TranscriptCryptographicProof {
  type: 'GigLinkCryptographicTranscript2026';
  created: string;
  verificationMethod: string;
  payloadDigest: string; // SHA-256 hash of canonical snapshot payload
  signature: string;     // Platform cryptographic attestation seal
  issuer: string;
}

export interface VerifiableTranscript {
  id: string; // `tr_${talentId}`
  talentId: string;
  talentDisplayName: string;
  talentHandle?: string;
  talentAvatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  privacySettings: TranscriptPrivacySettings;
  verifiedSnapshot: TranscriptVerifiedSnapshot;
  proof: TranscriptCryptographicProof;
}

export interface TranscriptVerificationResult {
  isValid: boolean;
  transcript: VerifiableTranscript | null;
  computedHash: string;
  storedHash: string;
  status: 'verified' | 'tampered' | 'unpublished' | 'not_found';
  verificationTimestamp: string;
  errorMessage?: string;
}
