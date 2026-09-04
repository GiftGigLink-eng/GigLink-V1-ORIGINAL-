import {
  buildCanonicalMerkleTree,
  computeRfc6962LeafHash,
  generateMerkleAuditPath,
  verifyMerkleProof,
  CanonicalMerkleTree,
} from './merkleTree';
import {
  signWithEd25519,
  verifySignatureWithDID,
} from './didService';
import { SaltedClaimLeaf } from '../../types/selectiveDisclosure';

export interface SaltedCredentialRecord {
  credentialId: string;
  issuerDid: string;
  subjectDid: string;
  claimLeaves: SaltedClaimLeaf[];
  merkleTree: CanonicalMerkleTree;
  credentialMerkleRoot: string;
  issuerSignature: string; // Ed25519 signature over credentialMerkleRoot
  issuedAt: string;
}

export interface DisclosedClaimItem {
  claimKey: string;
  disclosedValue: any;
  salt: string;
  leafHash: string;
  leafIndex: number;
  auditPath: { position: 'left' | 'right'; hash: string }[];
}

export interface SelectiveDisclosurePresentation {
  presentationId: string;
  sourceCredentialId: string;
  issuerDid: string;
  subjectDid: string;
  credentialMerkleRoot: string;
  issuerSignature: string;
  disclosedClaims: DisclosedClaimItem[];
  totalClaimsInCredential: number;
  created: string;
}

export interface SelectiveDisclosureVerificationResult {
  isValid: boolean;
  issuerSignatureValid: boolean;
  allProofsValid: boolean;
  reconstructedClaims: {
    claimKey: string;
    value: any;
    isValid: boolean;
  }[];
  issuerDid: string;
  subjectDid: string;
  credentialMerkleRoot: string;
  failureReason?: string;
}

function generate256BitSalt(): string {
  const bytes = new Uint8Array(32);
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    globalThis.crypto.getRandomValues(bytes);
  } else if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    // Fallback in test runner
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Deterministic JSON stringifier with sorted object keys.
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalJsonStringify).join(',')}]`;
  }

  const keys = Object.keys(obj).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(obj[key])}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Computes canonical salted claim leaf hash:
 * Leaf = SHA256(0x00 || claimKey + "::" + canonicalJson(value) + "::" + salt)
 */
export async function computeSaltedClaimLeafHash(
  claimKey: string,
  claimValue: any,
  saltHex: string
): Promise<string> {
  const canonicalVal = canonicalJsonStringify(claimValue);
  const rawString = `${claimKey}::${canonicalVal}::${saltHex}`;
  return computeRfc6962LeafHash(rawString);
}

/**
 * Mints a Salted Merkle Credential from a key-value claims dictionary.
 * Each claim gets a 256-bit CSPRNG salt.
 * The Merkle root is computed and signed by the Issuer's Ed25519 private key.
 */
export async function createSaltedMerkleCredential(
  credentialId: string,
  issuerDid: string,
  issuerPrivateKeyHex: string,
  subjectDid: string,
  rawClaims: Record<string, any>
): Promise<SaltedCredentialRecord> {
  const sortedKeys = Object.keys(rawClaims).sort();
  const claimLeaves: SaltedClaimLeaf[] = [];

  for (const key of sortedKeys) {
    const salt = generate256BitSalt();
    const value = rawClaims[key];
    const leafHash = await computeSaltedClaimLeafHash(key, value, salt);
    claimLeaves.push({
      claimKey: key,
      claimValue: value,
      salt,
      leafHash,
    });
  }

  const leafHashes = claimLeaves.map((l) => l.leafHash);
  const merkleTree = await buildCanonicalMerkleTree(leafHashes);
  const credentialMerkleRoot = merkleTree.rootHash;

  // Issuer signs the Merkle Root using Ed25519
  const issuerSignature = signWithEd25519(credentialMerkleRoot, issuerPrivateKeyHex);

  return {
    credentialId,
    issuerDid,
    subjectDid,
    claimLeaves,
    merkleTree,
    credentialMerkleRoot,
    issuerSignature,
    issuedAt: new Date().toISOString(),
  };
}

/**
 * Creates an attribute-level selective disclosure presentation.
 * The holder reveals only the chosen claim keys.
 * For each revealed key, includes the value, 256-bit salt, leaf index, and Merkle audit path.
 * Undisclosed attributes remain completely private.
 */
export function createSelectiveDisclosurePresentation(
  credentialRecord: SaltedCredentialRecord,
  keysToDisclose: string[]
): SelectiveDisclosurePresentation {
  const disclosedClaims: DisclosedClaimItem[] = [];
  const discloseSet = new Set(keysToDisclose);

  credentialRecord.claimLeaves.forEach((leaf, idx) => {
    if (discloseSet.has(leaf.claimKey)) {
      const proof = generateMerkleAuditPath(credentialRecord.merkleTree, idx);
      disclosedClaims.push({
        claimKey: leaf.claimKey,
        disclosedValue: leaf.claimValue,
        salt: leaf.salt,
        leafHash: leaf.leafHash,
        leafIndex: idx,
        auditPath: proof.auditPath,
      });
    }
  });

  return {
    presentationId: `sd_pres_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    sourceCredentialId: credentialRecord.credentialId,
    issuerDid: credentialRecord.issuerDid,
    subjectDid: credentialRecord.subjectDid,
    credentialMerkleRoot: credentialRecord.credentialMerkleRoot,
    issuerSignature: credentialRecord.issuerSignature,
    disclosedClaims,
    totalClaimsInCredential: credentialRecord.claimLeaves.length,
    created: new Date().toISOString(),
  };
}

/**
 * Independently verifies a Selective Disclosure presentation without contacting the issuer database.
 * 1. Verifies Issuer's Ed25519 signature over `credentialMerkleRoot` using the Issuer's DID.
 * 2. For each disclosed claim, recomputes the salted leaf hash from (claimKey, disclosedValue, salt).
 * 3. Verifies the Merkle inclusion path against `credentialMerkleRoot`.
 */
export async function verifySelectiveDisclosurePresentation(
  presentation: SelectiveDisclosurePresentation,
  revocationChecker?: (credentialId: string) => Promise<boolean> | boolean
): Promise<SelectiveDisclosureVerificationResult> {
  if (!presentation || !presentation.credentialMerkleRoot || !presentation.issuerSignature) {
    return {
      isValid: false,
      issuerSignatureValid: false,
      allProofsValid: false,
      reconstructedClaims: [],
      issuerDid: presentation?.issuerDid || '',
      subjectDid: presentation?.subjectDid || '',
      credentialMerkleRoot: presentation?.credentialMerkleRoot || '',
      failureReason: 'Missing presentation root or issuer signature',
    };
  }

  // 0. Revocation check against source credential
  if (revocationChecker) {
    const isRevoked = await revocationChecker(presentation.sourceCredentialId);
    if (isRevoked) {
      return {
        isValid: false,
        issuerSignatureValid: true,
        allProofsValid: false,
        reconstructedClaims: [],
        issuerDid: presentation.issuerDid,
        subjectDid: presentation.subjectDid,
        credentialMerkleRoot: presentation.credentialMerkleRoot,
        failureReason: 'Source credential has been revoked by the issuing authority',
      };
    }
  }

  // 1. Verify Issuer's Ed25519 signature over the credentialMerkleRoot
  const isSignatureValid = await verifySignatureWithDID(
    presentation.credentialMerkleRoot,
    presentation.issuerSignature,
    presentation.issuerDid
  );

  if (!isSignatureValid) {
    return {
      isValid: false,
      issuerSignatureValid: false,
      allProofsValid: false,
      reconstructedClaims: [],
      issuerDid: presentation.issuerDid,
      subjectDid: presentation.subjectDid,
      credentialMerkleRoot: presentation.credentialMerkleRoot,
      failureReason: 'Issuer Ed25519 signature over Merkle root is invalid or signed by unauthorized DID',
    };
  }

  // 2. Verify each disclosed claim leaf and its Merkle inclusion proof
  const reconstructedClaims: { claimKey: string; value: any; isValid: boolean }[] = [];
  let allProofsValid = true;

  for (const item of presentation.disclosedClaims) {
    // Recompute leaf hash from claimed values
    const expectedLeafHash = await computeSaltedClaimLeafHash(
      item.claimKey,
      item.disclosedValue,
      item.salt
    );

    if (expectedLeafHash.toLowerCase() !== item.leafHash.toLowerCase()) {
      allProofsValid = false;
      reconstructedClaims.push({
        claimKey: item.claimKey,
        value: item.disclosedValue,
        isValid: false,
      });
      continue;
    }

    // Verify Merkle inclusion path
    const isPathValid = await verifyMerkleProof({
      leafHash: item.leafHash,
      leafIndex: item.leafIndex,
      totalLeaves: presentation.totalClaimsInCredential,
      auditPath: item.auditPath,
      rootHash: presentation.credentialMerkleRoot,
    });

    if (!isPathValid) {
      allProofsValid = false;
    }

    reconstructedClaims.push({
      claimKey: item.claimKey,
      value: item.disclosedValue,
      isValid: isPathValid,
    });
  }

  const overallValid = isSignatureValid && allProofsValid;

  return {
    isValid: overallValid,
    issuerSignatureValid: isSignatureValid,
    allProofsValid,
    reconstructedClaims,
    issuerDid: presentation.issuerDid,
    subjectDid: presentation.subjectDid,
    credentialMerkleRoot: presentation.credentialMerkleRoot,
    failureReason: overallValid ? undefined : 'One or more disclosed claim proofs failed verification',
  };
}
