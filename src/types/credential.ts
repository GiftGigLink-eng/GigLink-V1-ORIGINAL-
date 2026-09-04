/**
 * Verifiable Credentials & Institutional Attestations Schema
 * Phase 9B: Institutional & Multi-Party Verifiable Credential Protocol
 */

export type VerifiableCredentialType =
  | 'degree'
  | 'course_certificate'
  | 'skill_badge'
  | 'enterprise_accreditation'
  | 'license'
  | 'assessment'
  | 'award';

export type CredentialClaimStatus =
  | 'issued'      // Issued by institution, pending recipient claim
  | 'claimed'     // Claimed and accepted into recipient Trust Passport
  | 'rejected'    // Rejected by recipient
  | 'revoked'     // Revoked by issuing authority
  | 'expired';    // Passed expiration date

export interface CredentialIssuerProfile {
  orgId: string;
  orgName: string;
  orgType: 'institution' | 'company';
  officialEmailDomain?: string;
  accreditationDetails?: string;
  issuerAdminUid: string;
  issuerAdminName: string;
  issuerAdminTitle: string;
  issuerLogoUrl?: string;
  website?: string;
  isVerifiedIssuer: boolean;
}

export interface CredentialRecipientProfile {
  recipientUid?: string; // Optional if issued prior to registration
  recipientEmail: string;
  recipientName: string;
  recipientAvatarUrl?: string;
}

export interface CredentialRevocationRecord {
  isRevoked: boolean;
  revokedAt?: string;
  revokedByUid?: string;
  revokedByName?: string;
  revocationReason?: string;
}

export interface CredentialCryptographicProof {
  type: 'GigLinkInstitutionalCredential2026';
  created: string;
  payloadDigest: string; // SHA-256 hash of immutable canonical credential fields
  signature: string;     // Cryptographic signature issued by accredited entity
  issuerDomain: string;
  verificationMethod: string;
}

export interface VerifiableCredential {
  id: string; // `cred_${uniqueId}`
  title: string;
  credentialType: VerifiableCredentialType;
  description: string;
  issuer: CredentialIssuerProfile;
  recipient: CredentialRecipientProfile;
  skills: string[];
  criteria: string;
  issuedAt: string;
  expiresAt?: string;
  achievementGrade?: string; // e.g. "Distinction", "Grade A+", "Top 5% Cohort"
  evidenceUrl?: string;     // Link to project, portfolio piece, or syllabus
  evidenceHash?: string;    // SHA-256 of evidence document
  claimStatus: CredentialClaimStatus;
  claimedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  revocationStatus?: CredentialRevocationRecord;
  cryptographicProof: CredentialCryptographicProof;
  trustScoreImpact: number; // Positive points boost in Trust Passport
  isPublic: boolean;
  batchId?: string;         // Optional cohort issuance batch ID
  createdAt: string;
  updatedAt: string;
}

export interface CredentialIssuanceInput {
  title: string;
  credentialType: VerifiableCredentialType;
  description: string;
  recipientEmail: string;
  recipientName: string;
  recipientUid?: string;
  skills: string[];
  criteria: string;
  expiresAt?: string;
  achievementGrade?: string;
  evidenceUrl?: string;
  batchId?: string;
}

export interface CredentialVerificationResult {
  isValid: boolean;
  credential: VerifiableCredential | null;
  computedHash: string;
  storedHash: string;
  status: 'verified' | 'tampered' | 'revoked' | 'expired' | 'not_found';
  verificationTimestamp: string;
  issuerVerified: boolean;
  details?: string;
}

export interface W3CVerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: {
    id: string;
    name: string;
    domain?: string;
  };
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id: string;
    name: string;
    email: string;
    achievement: {
      title: string;
      type: string;
      description: string;
      criteria: string;
      grade?: string;
      skills: string[];
    };
  };
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofValue: string;
    payloadDigest: string;
  };
}
