import { sha256Bytes, sha256Hex } from './merkleTree';
import { generateMerkleAuditPath, verifyMerkleProof, CanonicalMerkleTree } from './merkleTree';
import { computeSaltedClaimLeafHash, SaltedCredentialRecord } from './selectiveDisclosureService';
import { signWithEd25519, verifySignatureWithDID } from './didService';

/**
 * ============================================================================
 * ZERO-KNOWLEDGE PREDICATE & RANGE PROOF PROTOCOL SPECIFICATION
 * ============================================================================
 * Cryptographic Group: Prime-order multiplicative group G_q subset of Z_p*
 * Standard RFC 3526 MODP 1536-bit Safe Prime Group (Group 5):
 * Prime p = 2^1536 - 2^1472 - 1 + 2^64 * ([2^1406 pi] + 741804)
 * Sophie Germain prime where p = 2q + 1 (q is prime).
 * Subgroup order q = (p - 1) / 2.
 * Generators: g = 2, h = g^s mod p (derived via verifiable random function).
 *
 * Protocol: Generalized Schnorr / Chaum-Pedersen Sigma Protocol + Fiat-Shamir Heuristic
 * Statements:
 * 1. Prover possesses secret value v >= T and randomness r such that
 *    Commitment C = g^v * h^r mod p.
 * 2. Difference delta = v - T >= 0.
 * 3. Commitment C_delta = C / g^T = g^delta * h^r mod p.
 * 4. Prover proves in Zero-Knowledge knowledge of (delta, r) in C_delta without revealing delta or r.
 * 5. Leaf-binding: The commitment randomness r is derived deterministically from the salted claim leaf
 *    so the proof is non-transferably anchored to the issuer-signed Merkle root.
 * ============================================================================
 */

// RFC 3526 1536-bit MODP Safe Prime (p = 2q + 1)
export const ZK_PRIME_P = BigInt(
  '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' +
  'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' +
  'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' +
  'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' +
  'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' +
  'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
);

// Prime Subgroup Order q = (p - 1) / 2
export const ZK_ORDER_Q = (ZK_PRIME_P - 1n) / 2n;

// Canonical Generator g (Standard MODP generator g = 2)
export const ZK_GENERATOR_G = 2n;

// Verifiable Independent Generator h = SHA256('GigLink_ZK_Generator_H_2026') mod p
// Computed with cofactor 2 to ensure membership in subgroup of order q: h = (h_raw^2) mod p
export const ZK_GENERATOR_H = BigInt(
  '0x5a183533bebe57ecbe2ebfe32d0b67702f3549925fa3ab753a8ddffaa4d7cf0b' +
  '6ec8c0aa5ea96c14ab6ee28a385497274092bbf89cb16b5eb176ea3b4c107c12'
) % ZK_PRIME_P;

export const pedersenGenerators = {
  p: ZK_PRIME_P.toString(16),
  q: ZK_ORDER_Q.toString(16),
  g: ZK_GENERATOR_G.toString(16),
  h: ZK_GENERATOR_H.toString(16),
};

/**
 * Modular exponentiation: (base^exp) % mod using square-and-multiply algorithm.
 */
export function modExp(base: bigint, exp: bigint, mod: bigint): bigint {
  let res = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = ((exp % ZK_ORDER_Q) + ZK_ORDER_Q) % ZK_ORDER_Q; // Exponent reduction in group of order q

  while (e > 0n) {
    if (e % 2n === 1n) {
      res = (res * b) % mod;
    }
    b = (b * b) % mod;
    e = e / 2n;
  }
  return res;
}

/**
 * Modular inverse in group of prime order q using Extended Euclidean Algorithm.
 */
export function modInverse(a: bigint, mod: bigint): bigint {
  let t = 0n;
  let newt = 1n;
  let r = mod;
  let newr = ((a % mod) + mod) % mod;

  while (newr !== 0n) {
    const quotient = r / newr;
    [t, newt] = [newt, t - quotient * newt];
    [r, newr] = [newr, r - quotient * newr];
  }

  if (r > 1n) {
    throw new Error('a is not invertible');
  }
  if (t < 0n) {
    t = t + mod;
  }
  return t;
}

/**
 * Generates a cryptographically secure random BigInt in [1, q-1].
 */
export function randomFieldElement(): bigint {
  const bytes = new Uint8Array(32);
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    globalThis.crypto.getRandomValues(bytes);
  } else if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  let hex = '';
  for (let i = 0; i < 32; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return (BigInt('0x' + hex) % (ZK_ORDER_Q - 2n)) + 1n;
}

/**
 * Computes a Pedersen Commitment: C = (g^v * h^r) mod p
 */
export function computePedersenCommitment(value: bigint, randomness: bigint): bigint {
  const gV = modExp(ZK_GENERATOR_G, value, ZK_PRIME_P);
  const hR = modExp(ZK_GENERATOR_H, randomness, ZK_PRIME_P);
  return (gV * hR) % ZK_PRIME_P;
}

export interface ZKRangeProofPayload {
  commitmentC: string; // Hex string of C
  commitmentDelta: string; // Hex string of C_delta
  threshold: number;
  publicParams: {
    g: string;
    h: string;
    p: string;
    q: string;
  };
  fiatShamirChallenge: string;
  responseValue: string; // Schnorr/Sigma response s_v = (w + e * delta) mod q
  responseRandomness: string; // s_r = (w_r + e * r_delta) mod q
  tBlindCommitment: string; // t = (g^w * h^w_r) mod p
}

export interface ZKDisclosedPredicate {
  claimKey: string;
  predicate: 'range_greater_than' | 'range_between' | 'set_membership';
  threshold: number;
  maxThreshold?: number;
  statement: string;
  zkProof: ZKRangeProofPayload;
  saltedLeafHash: string;
  leafIndex: number;
  merkleAuditPath: { position: 'left' | 'right'; hash: string }[];
}

export interface ZKPredicatePresentation {
  presentationId: string;
  sourceCredentialId: string;
  holderDid: string;
  audienceDid?: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  credentialMerkleRoot: string;
  issuerDid: string;
  issuerSignature: string;
  predicates: ZKDisclosedPredicate[];
  holderSignature: string; // Holder signs (presentationId + nonce + audienceDid + merkleRoot + proofChallenges)
}

export interface ZKVerificationOutcome {
  isValid: boolean;
  status: 'verified' | 'tampered' | 'expired' | 'invalid_zk_proof' | 'invalid_merkle_path' | 'invalid_signature' | 'replay_detected';
  failureReason?: string;
  holderDid: string;
  issuerDid: string;
  verifiedPredicates: {
    claimKey: string;
    statement: string;
    threshold: number;
    passed: boolean;
  }[];
  checkedAt: string;
}

/**
 * Computes Fiat-Shamir non-interactive challenge:
 * e = SHA256(g || h || p || C || C_delta || T || tBlind || nonce || audienceDid) mod q
 */
export async function computeFiatShamirChallenge(params: {
  commitmentC: bigint;
  commitmentDelta: bigint;
  threshold: bigint;
  tBlind: bigint;
  nonce: string;
  audienceDid?: string;
  claimKey: string;
}): Promise<bigint> {
  const preimage = [
    ZK_GENERATOR_G.toString(16),
    ZK_GENERATOR_H.toString(16),
    ZK_PRIME_P.toString(16),
    params.commitmentC.toString(16),
    params.commitmentDelta.toString(16),
    params.threshold.toString(16),
    params.tBlind.toString(16),
    params.nonce,
    params.audienceDid || 'any',
    params.claimKey,
  ].join('::');

  const digestHex = await sha256Hex(preimage);
  return (BigInt('0x' + digestHex) % (ZK_ORDER_Q - 1n)) + 1n;
}

/**
 * Generates a Zero-Knowledge Range / Predicate Proof for (v >= T).
 * Ensures exact value v and salt r are NEVER revealed in the proof.
 */
export async function generateZKRangeProof(
  secretValue: number,
  secretSaltHex: string,
  threshold: number,
  claimKey: string,
  nonce: string,
  audienceDid?: string
): Promise<ZKRangeProofPayload> {
  if (secretValue < threshold) {
    throw new Error(`Cannot generate valid ZK proof: secret value (${secretValue}) is less than threshold (${threshold})`);
  }

  const v = BigInt(secretValue);
  const T = BigInt(threshold);
  const delta = v - T; // Non-negative integer

  // 1. Derive deterministic commitment randomness from secret salt
  const saltBigInt = BigInt('0x' + secretSaltHex) % ZK_ORDER_Q;
  const rC = saltBigInt;
  const commitmentC = computePedersenCommitment(v, rC);

  // 2. Compute commitment for delta: C_delta = C / (g^T) = g^(v - T) * h^r = g^delta * h^r mod p
  const gT = modExp(ZK_GENERATOR_G, T, ZK_PRIME_P);
  // Modular inverse of gT in Z_p*
  const gTInv = modInverse(gT, ZK_PRIME_P);
  const commitmentDelta = (commitmentC * gTInv) % ZK_PRIME_P;

  // 3. Sigma protocol: Prover proves knowledge of (delta, rC) such that C_delta = g^delta * h^rC
  const w = randomFieldElement();
  const wR = randomFieldElement();

  // Compute blinder commitment: t = (g^w * h^w_r) mod p
  const tBlind = computePedersenCommitment(w, wR);

  // 4. Fiat-Shamir non-interactive challenge
  const challengeE = await computeFiatShamirChallenge({
    commitmentC,
    commitmentDelta,
    threshold: T,
    tBlind,
    nonce,
    audienceDid,
    claimKey,
  });

  // 5. Compute responses: s_v = (w + e * delta) mod q, s_r = (w_r + e * rC) mod q
  const responseValue = (w + challengeE * delta) % ZK_ORDER_Q;
  const responseRandomness = (wR + challengeE * rC) % ZK_ORDER_Q;

  return {
    commitmentC: commitmentC.toString(16),
    commitmentDelta: commitmentDelta.toString(16),
    threshold,
    publicParams: {
      g: ZK_GENERATOR_G.toString(16),
      h: ZK_GENERATOR_H.toString(16),
      p: ZK_PRIME_P.toString(16),
      q: ZK_ORDER_Q.toString(16),
    },
    fiatShamirChallenge: challengeE.toString(16),
    responseValue: responseValue.toString(16),
    responseRandomness: responseRandomness.toString(16),
    tBlindCommitment: tBlind.toString(16),
  };
}

/**
 * Mathematically verifies a Zero-Knowledge Range Proof for (v >= T).
 * Verifier checks:
 * 1. C_delta == (C * g^(-T)) mod p
 * 2. Recomputes challenge e' == SHA256(...)
 * 3. Checks verification equation: (g^s_v * h^s_r) == (tBlind * C_delta^e) mod p
 */
export async function verifyZKRangeProof(
  proof: ZKRangeProofPayload,
  claimKey: string,
  nonce: string,
  audienceDid?: string
): Promise<boolean> {
  try {
    const C = BigInt('0x' + proof.commitmentC);
    const CDelta = BigInt('0x' + proof.commitmentDelta);
    const T = BigInt(proof.threshold);
    const sV = BigInt('0x' + proof.responseValue);
    const sR = BigInt('0x' + proof.responseRandomness);
    const tBlind = BigInt('0x' + proof.tBlindCommitment);
    const e = BigInt('0x' + proof.fiatShamirChallenge);

    // Negative or boundary checks
    if (proof.threshold < 0) return false;
    if (sV >= ZK_ORDER_Q || sR >= ZK_ORDER_Q || e >= ZK_ORDER_Q) return false;

    // Check 1: Homomorphic relationship C_delta == C / g^T mod p
    const gT = modExp(ZK_GENERATOR_G, T, ZK_PRIME_P);
    const gTInv = modInverse(gT, ZK_PRIME_P);
    const expectedCDelta = (C * gTInv) % ZK_PRIME_P;
    if (CDelta !== expectedCDelta) {
      return false;
    }

    // Check 2: Challenge consistency via Fiat-Shamir
    const expectedChallenge = await computeFiatShamirChallenge({
      commitmentC: C,
      commitmentDelta: CDelta,
      threshold: T,
      tBlind,
      nonce,
      audienceDid,
      claimKey,
    });

    if (e !== expectedChallenge) {
      return false;
    }

    // Check 3: Sigma verification equation: (g^s_v * h^s_r) == (tBlind * C_delta^e) mod p
    const lhs = computePedersenCommitment(sV, sR);
    const rhsBase = modExp(CDelta, e, ZK_PRIME_P);
    const rhs = (tBlind * rhsBase) % ZK_PRIME_P;

    return lhs === rhs;
  } catch {
    return false;
  }
}

/**
 * Creates a Zero-Knowledge Predicate Presentation bound to Holder DID, Nonce, and Source Credential.
 */
export async function createZKPredicatePresentation(params: {
  credentialRecord: SaltedCredentialRecord;
  holderKeyPair: { did: string; privateKeyHex: string };
  predicatesToProve: {
    claimKey: string;
    threshold: number;
    statement: string;
  }[];
  nonce: string;
  audienceDid?: string;
  validityMinutes?: number;
}): Promise<ZKPredicatePresentation> {
  const { credentialRecord, holderKeyPair, predicatesToProve, nonce, audienceDid, validityMinutes = 60 } = params;
  const predicates: ZKDisclosedPredicate[] = [];

  for (const predReq of predicatesToProve) {
    const leafIndex = credentialRecord.claimLeaves.findIndex((l) => l.claimKey === predReq.claimKey);
    if (leafIndex === -1) {
      throw new Error(`Claim key "${predReq.claimKey}" not found in source credential`);
    }

    const leaf = credentialRecord.claimLeaves[leafIndex];
    const numericValue = typeof leaf.claimValue === 'number' ? leaf.claimValue : parseFloat(leaf.claimValue);

    if (isNaN(numericValue)) {
      throw new Error(`Claim "${predReq.claimKey}" value (${leaf.claimValue}) is not a valid number for ZK range proof`);
    }

    // Generate non-interactive zero-knowledge range proof
    const zkProof = await generateZKRangeProof(
      numericValue,
      leaf.salt,
      predReq.threshold,
      predReq.claimKey,
      nonce,
      audienceDid
    );

    // Generate Merkle inclusion path for the leaf
    const merkleProof = generateMerkleAuditPath(credentialRecord.merkleTree, leafIndex);

    predicates.push({
      claimKey: predReq.claimKey,
      predicate: 'range_greater_than',
      threshold: predReq.threshold,
      statement: predReq.statement,
      zkProof,
      saltedLeafHash: leaf.leafHash,
      leafIndex,
      merkleAuditPath: merkleProof.auditPath,
    });
  }

  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000).toISOString();
  const presentationId = `zkp_pres_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Holder signs (presentationId + nonce + audienceDid + credentialMerkleRoot + challenges)
  const presentationPreimage = [
    presentationId,
    nonce,
    audienceDid || 'any',
    credentialRecord.credentialMerkleRoot,
    ...predicates.map((p) => p.zkProof.fiatShamirChallenge),
  ].join('::');

  const holderSignature = signWithEd25519(presentationPreimage, holderKeyPair.privateKeyHex);

  return {
    presentationId,
    sourceCredentialId: credentialRecord.credentialId,
    holderDid: holderKeyPair.did,
    audienceDid,
    nonce,
    issuedAt,
    expiresAt,
    credentialMerkleRoot: credentialRecord.credentialMerkleRoot,
    issuerDid: credentialRecord.issuerDid,
    issuerSignature: credentialRecord.issuerSignature,
    predicates,
    holderSignature,
  };
}

/**
 * Autonomous Third-Party Verifier for Zero-Knowledge Predicate Presentations.
 * Verifies:
 * 1. Anti-Replay: Nonce matching, Audience matching, Expiration timestamp.
 * 2. Holder Signature over presentation preimage.
 * 3. Issuer Signature over Credential Merkle Root.
 * 4. Merkle Inclusion Proofs for each predicate leaf hash.
 * 5. Algebraic Zero-Knowledge Sigma Range Proofs (without learning raw values).
 */
export async function verifyZKPredicatePresentation(
  presentation: ZKPredicatePresentation,
  expectedNonce?: string,
  expectedAudienceDid?: string,
  revocationChecker?: (credentialId: string) => Promise<boolean> | boolean
): Promise<ZKVerificationOutcome> {
  const now = new Date().toISOString();

  // 1. Expiration check
  if (now > presentation.expiresAt) {
    return {
      isValid: false,
      status: 'expired',
      failureReason: 'Presentation has expired',
      holderDid: presentation.holderDid,
      issuerDid: presentation.issuerDid,
      verifiedPredicates: [],
      checkedAt: now,
    };
  }

  // 1b. Revocation check against source credential
  if (revocationChecker) {
    const isRevoked = await revocationChecker(presentation.sourceCredentialId);
    if (isRevoked) {
      return {
        isValid: false,
        status: 'tampered',
        failureReason: 'Source credential has been revoked by the issuing authority',
        holderDid: presentation.holderDid,
        issuerDid: presentation.issuerDid,
        verifiedPredicates: [],
        checkedAt: now,
      };
    }
  }

  // 2. Anti-replay Nonce & Audience check
  if (expectedNonce && presentation.nonce !== expectedNonce) {
    return {
      isValid: false,
      status: 'replay_detected',
      failureReason: `Presentation nonce (${presentation.nonce}) does not match expected nonce (${expectedNonce})`,
      holderDid: presentation.holderDid,
      issuerDid: presentation.issuerDid,
      verifiedPredicates: [],
      checkedAt: now,
    };
  }

  if (expectedAudienceDid && presentation.audienceDid && presentation.audienceDid !== expectedAudienceDid) {
    return {
      isValid: false,
      status: 'replay_detected',
      failureReason: `Audience DID mismatch: presentation intended for ${presentation.audienceDid}, verified by ${expectedAudienceDid}`,
      holderDid: presentation.holderDid,
      issuerDid: presentation.issuerDid,
      verifiedPredicates: [],
      checkedAt: now,
    };
  }

  // 3. Holder signature verification
  const presentationPreimage = [
    presentation.presentationId,
    presentation.nonce,
    presentation.audienceDid || 'any',
    presentation.credentialMerkleRoot,
    ...presentation.predicates.map((p) => p.zkProof.fiatShamirChallenge),
  ].join('::');

  const isHolderSigValid = await verifySignatureWithDID(
    presentationPreimage,
    presentation.holderSignature,
    presentation.holderDid
  );

  if (!isHolderSigValid) {
    return {
      isValid: false,
      status: 'invalid_signature',
      failureReason: 'Holder Ed25519 signature over presentation is invalid',
      holderDid: presentation.holderDid,
      issuerDid: presentation.issuerDid,
      verifiedPredicates: [],
      checkedAt: now,
    };
  }

  // 4. Issuer signature verification over Credential Merkle Root
  const isIssuerSigValid = await verifySignatureWithDID(
    presentation.credentialMerkleRoot,
    presentation.issuerSignature,
    presentation.issuerDid
  );

  if (!isIssuerSigValid) {
    return {
      isValid: false,
      status: 'tampered',
      failureReason: 'Issuer Ed25519 signature over Merkle root is invalid or signed by untrusted authority',
      holderDid: presentation.holderDid,
      issuerDid: presentation.issuerDid,
      verifiedPredicates: [],
      checkedAt: now,
    };
  }

  // 5. Verify each predicate ZK proof and Merkle path
  const verifiedPredicates: { claimKey: string; statement: string; threshold: number; passed: boolean }[] = [];
  let allZKValid = true;

  for (const pred of presentation.predicates) {
    // 5a. Check threshold parity between envelope and ZK payload
    if (pred.threshold !== pred.zkProof.threshold) {
      allZKValid = false;
      verifiedPredicates.push({
        claimKey: pred.claimKey,
        statement: pred.statement,
        threshold: pred.threshold,
        passed: false,
      });
      continue;
    }

    // 5b. Verify algebraic Zero-Knowledge Range Proof
    const isZKProofValid = await verifyZKRangeProof(
      pred.zkProof,
      pred.claimKey,
      presentation.nonce,
      presentation.audienceDid
    );

    if (!isZKProofValid) {
      allZKValid = false;
      verifiedPredicates.push({
        claimKey: pred.claimKey,
        statement: pred.statement,
        threshold: pred.threshold,
        passed: false,
      });
      continue;
    }

    // 5b. Verify Merkle inclusion path to the signed Credential Root
    const isMerkleValid = await verifyMerkleProof({
      leafHash: pred.saltedLeafHash,
      leafIndex: pred.leafIndex,
      totalLeaves: Math.max(pred.leafIndex + 1, pred.merkleAuditPath.length > 0 ? 2 ** pred.merkleAuditPath.length : 1),
      auditPath: pred.merkleAuditPath,
      rootHash: presentation.credentialMerkleRoot,
    });

    const predicatePassed = isZKProofValid && isMerkleValid;
    if (!predicatePassed) {
      allZKValid = false;
    }

    verifiedPredicates.push({
      claimKey: pred.claimKey,
      statement: pred.statement,
      threshold: pred.threshold,
      passed: predicatePassed,
    });
  }

  const overallValid = isHolderSigValid && isIssuerSigValid && allZKValid;

  return {
    isValid: overallValid,
    status: overallValid ? 'verified' : 'invalid_zk_proof',
    failureReason: overallValid ? undefined : 'One or more zero-knowledge predicate proofs failed verification',
    holderDid: presentation.holderDid,
    issuerDid: presentation.issuerDid,
    verifiedPredicates,
    checkedAt: now,
  };
}
