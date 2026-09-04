export type DIDMethod = 'did:key' | 'did:giglink' | 'did:web';

export interface DIDVerificationMethod {
  id: string; // e.g. "did:key:z6Mku...#z6Mku..." or "did:giglink:org:mit_eecs#key-1"
  type: 'Ed25519VerificationKey2020' | 'JsonWebKey2020';
  controller: string; // DID of controller
  publicKeyMultibase?: string; // Multibase base58btc string (starts with 'z')
  publicKeyHex?: string; // 32-byte hex string
}

export interface DIDDocument {
  '@context': string[];
  id: string; // e.g. "did:key:z6Mku..." or "did:giglink:talent:alice_99"
  controller?: string;
  verificationMethod: DIDVerificationMethod[];
  authentication: string[];
  assertionMethod: string[];
  capabilityInvocation?: string[];
  capabilityDelegation?: string[];
  service?: {
    id: string;
    type: string;
    serviceEndpoint: string;
  }[];
  created?: string;
  updated?: string;
}

export interface StoredKeyPair {
  did: string;
  publicKeyHex: string;
  publicKeyMultibase: string;
  privateKeyHex: string;
  algorithm: 'Ed25519';
  createdAt: string;
  label?: string;
}

export interface DIDResolutionResult {
  didDocument: DIDDocument | null;
  didDocumentMetadata: {
    deactivated?: boolean;
    canonicalId?: string;
    versionId?: string;
  };
  didResolutionMetadata: {
    contentType?: string;
    error?: 'invalidDid' | 'notFound' | 'representationNotSupported' | 'unsupportedDidMethod';
    errorMessage?: string;
  };
}

export interface CryptographicSignatureProof {
  type: 'Ed25519Signature2020';
  created: string;
  verificationMethod: string; // Reference to verificationMethod id
  proofPurpose: 'assertionMethod' | 'authentication';
  proofValue: string; // Base58btc or Hex signature
}
