export type DisclosurePredicateType =
  | 'revealed_value'           // Plaintext attribute revealed with Merkle salt proof
  | 'range_greater_than'        // ZK predicate proof: value >= threshold
  | 'range_between'             // ZK predicate proof: min <= value <= max
  | 'set_membership'           // ZK proof: attribute in accredited_list
  | 'boolean_existence';        // Attribute exists and is verified without revealing value

export interface SaltedClaimLeaf {
  claimKey: string;             // e.g., "gpa", "totalVolumeUSD", "degreeTitle"
  claimValue: any;              // Raw value (known to holder)
  salt: string;                 // 256-bit hex salt
  leafHash: string;             // SHA256(claimKey + ":" + JSON.stringify(claimValue) + ":" + salt)
}

export interface DisclosedClaimProof {
  claimKey: string;
  predicate: DisclosurePredicateType;
  disclosedValue?: any;         // Populated ONLY if predicate === 'revealed_value'
  thresholdValue?: number;      // e.g., 85 (for "Trust Score > 85")
  salt?: string;                // Revealed ONLY if predicate === 'revealed_value'
  zkProofPayload?: {
    commitment: string;         // Pedersen Commitment C = g^v h^r
    proofChallenge: string;     // Fiat-Shamir challenge
    proofResponse: string;      // Non-interactive proof response
    publicParams: { g: string; h: string; p: string };
  };
  merkleAuditPath: string[];    // Sibling hashes up to the Credential Merkle Root
  leafIndex: number;
}

export interface ZeroKnowledgePresentation {
  id: string;                   // Presentation ID: `zkp_pres_...`
  version: '1.0';
  presentationType: 'GigLinkSelectivePresentation2026';
  holderDid: string;            // Prover's DID (e.g. `did:key:z6M...` or `did:giglink:...`)
  audienceDid?: string;         // Verifier's DID (anti-replay binding)
  nonce: string;                // Verifier-provided or ephemeral nonce (anti-replay)
  issuedAt: string;
  expiresAt: string;
  sourceCredentialId: string;   // Reference to root credential
  credentialMerkleRoot: string; // The root signed by the institutional issuer
  issuerDid: string;            // Institutional Issuer's DID
  issuerSignature: string;      // Issuer's signature over `credentialMerkleRoot`
  disclosedProofs: DisclosedClaimProof[];
  anchoredBatchProof?: {
    batchId: string;
    merkleRoot: string;
    inclusionAuditPath: string[];
    ledgerTimestamp: string;
    chainTxHash?: string;
  };
  holderProof: {
    type: 'Ed25519Signature2020';
    signature: string;          // Holder signs (nonce + audience + proofHashes)
    signedAt: string;
  };
  isPublic?: boolean;
}

export interface VerificationEvaluationResult {
  isValid: boolean;
  status: 'verified' | 'tampered' | 'expired' | 'revoked' | 'unanchored' | 'invalid_zk_proof';
  summary: string;
  holderDid: string;
  issuerDid: string;
  issuerName: string;
  verifiedPredicates: {
    label: string;
    claimKey: string;
    statement: string;
    predicate: DisclosurePredicateType;
    passed: boolean;
    disclosedValue?: any;
  }[];
  isAnchoredToLedger: boolean;
  ledgerBatchId?: string;
  checkedAt: string;
}
