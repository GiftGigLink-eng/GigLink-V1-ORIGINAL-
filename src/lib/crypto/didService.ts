import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  DIDDocument,
  DIDResolutionResult,
  DIDVerificationMethod,
  StoredKeyPair,
} from '../../types/did';

export type {
  DIDDocument,
  DIDResolutionResult,
  DIDVerificationMethod,
  StoredKeyPair,
};

// Multicodec identifier for Ed25519 public key: 0xed, 0x01 (varint [237, 1])
const ED25519_MULTICODEC_PREFIX = new Uint8Array([0xed, 0x01]);

// In-memory key store for server-side / test runners / session caching
const inMemoryDIDRegistry = new Map<string, DIDDocument>();
const inMemoryKeyStore = new Map<string, StoredKeyPair>();

function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToUint8Array(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Encodes an Ed25519 32-byte public key into a standard W3C did:key identifier.
 * Format: did:key:z<base58btc(0xed01 + rawPublicKeyBytes)>
 */
export function encodeDidKey(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) {
    throw new Error(`Invalid Ed25519 public key length. Expected 32 bytes, got ${publicKey.length}`);
  }

  const combined = new Uint8Array(ED25519_MULTICODEC_PREFIX.length + publicKey.length);
  combined.set(ED25519_MULTICODEC_PREFIX, 0);
  combined.set(publicKey, ED25519_MULTICODEC_PREFIX.length);

  const encoded = bs58.encode(combined);
  return `did:key:z${encoded}`;
}

/**
 * Decodes a did:key identifier into raw 32-byte Ed25519 public key bytes.
 */
export function decodeDidKey(didKey: string): Uint8Array {
  if (!didKey.startsWith('did:key:z')) {
    throw new Error(`Invalid did:key format. Must start with 'did:key:z'`);
  }

  const multibasePart = didKey.slice('did:key:z'.length);
  const decoded = bs58.decode(multibasePart);

  if (decoded.length !== 34) {
    throw new Error(`Invalid decoded did:key length. Expected 34 bytes (2 prefix + 32 key), got ${decoded.length}`);
  }

  if (decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error(`Invalid multicodec prefix for Ed25519 did:key. Expected 0xed01`);
  }

  return decoded.slice(2);
}

/**
 * Generates a cryptographically secure Ed25519 KeyPair and derives its did:key.
 */
export function generateEd25519KeyPair(label?: string): StoredKeyPair {
  const pair = nacl.sign.keyPair();
  const publicKey = pair.publicKey;
  const secretKey = pair.secretKey; // 64 bytes in nacl (32 private seed + 32 public)

  const did = encodeDidKey(publicKey);
  const publicKeyHex = uint8ArrayToHex(publicKey);
  const privateKeyHex = uint8ArrayToHex(secretKey);
  const publicKeyMultibase = did.replace('did:key:', '');

  const keyPair: StoredKeyPair = {
    did,
    publicKeyHex,
    publicKeyMultibase,
    privateKeyHex,
    algorithm: 'Ed25519',
    createdAt: new Date().toISOString(),
    label,
  };

  inMemoryKeyStore.set(did, keyPair);
  return keyPair;
}

/**
 * Builds a W3C DID Document for a did:key identifier deterministically without network calls.
 */
export function resolveDidKeyDocument(didKey: string): DIDDocument {
  const publicKey = decodeDidKey(didKey);
  const publicKeyMultibase = didKey.slice('did:key:'.length);
  const publicKeyHex = uint8ArrayToHex(publicKey);
  const verificationMethodId = `${didKey}#${publicKeyMultibase}`;

  const vm: DIDVerificationMethod = {
    id: verificationMethodId,
    type: 'Ed25519VerificationKey2020',
    controller: didKey,
    publicKeyMultibase,
    publicKeyHex,
  };

  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: didKey,
    verificationMethod: [vm],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
    capabilityInvocation: [verificationMethodId],
    capabilityDelegation: [verificationMethodId],
    created: new Date().toISOString(),
  };
}

/**
 * Builds and registers a sovereign did:giglink DID Document (e.g. did:giglink:org:mit_eecs).
 */
export async function registerGigLinkDID(
  entityId: string,
  entityType: 'talent' | 'institution' | 'enterprise' | 'verifier',
  keyPair: StoredKeyPair,
  serviceEndpoints?: { id: string; type: string; serviceEndpoint: string }[]
): Promise<DIDDocument> {
  const did = `did:giglink:${entityType}:${entityId}`;
  const verificationMethodId = `${did}#key-1`;

  const vm: DIDVerificationMethod = {
    id: verificationMethodId,
    type: 'Ed25519VerificationKey2020',
    controller: did,
    publicKeyMultibase: keyPair.publicKeyMultibase,
    publicKeyHex: keyPair.publicKeyHex,
  };

  const didDoc: DIDDocument = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: did,
    controller: did,
    verificationMethod: [vm],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
    capabilityInvocation: [verificationMethodId],
    capabilityDelegation: [verificationMethodId],
    service: serviceEndpoints || [
      {
        id: `${did}#verificationService`,
        type: 'GigLinkCredentialVerification2026',
        serviceEndpoint: `https://giglink.io/verify/did/${encodeURIComponent(did)}`,
      },
    ],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };

  inMemoryDIDRegistry.set(did, didDoc);

  if (db) {
    try {
      const sanitizedDocId = did.replace(/:/g, '_');
      const docRef = doc(db, 'dids', sanitizedDocId);
      await setDoc(docRef, didDoc, { merge: true });
    } catch (err) {
      console.warn('[DIDService] Firestore sync notice (in-memory registry active):', err);
    }
  }

  return didDoc;
}

/**
 * Universal DID Resolver supporting did:key and did:giglink.
 */
export async function resolveDID(didString: string): Promise<DIDResolutionResult> {
  if (!didString || typeof didString !== 'string') {
    return {
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: { error: 'invalidDid', errorMessage: 'DID must be a non-empty string' },
    };
  }

  // 1. Resolve did:key (Deterministic, offline)
  if (didString.startsWith('did:key:')) {
    try {
      const didDoc = resolveDidKeyDocument(didString);
      return {
        didDocument: didDoc,
        didDocumentMetadata: { canonicalId: didString },
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
      };
    } catch (err: any) {
      return {
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: { error: 'invalidDid', errorMessage: err.message },
      };
    }
  }

  // 2. Resolve did:giglink
  if (didString.startsWith('did:giglink:')) {
    if (inMemoryDIDRegistry.has(didString)) {
      return {
        didDocument: inMemoryDIDRegistry.get(didString)!,
        didDocumentMetadata: { canonicalId: didString },
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
      };
    }

    if (db) {
      try {
        const sanitizedDocId = didString.replace(/:/g, '_');
        const docRef = doc(db, 'dids', sanitizedDocId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const docData = snapshot.data() as DIDDocument;
          inMemoryDIDRegistry.set(didString, docData);
          return {
            didDocument: docData,
            didDocumentMetadata: { canonicalId: didString },
            didResolutionMetadata: { contentType: 'application/did+ld+json' },
          };
        }
      } catch (err) {
        console.warn('[DIDService] Firestore read notice:', err);
      }
    }

    return {
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: { error: 'notFound', errorMessage: `DID Document for ${didString} was not found.` },
    };
  }

  return {
    didDocument: null,
    didDocumentMetadata: {},
    didResolutionMetadata: { error: 'unsupportedDidMethod', errorMessage: `Unsupported DID method in ${didString}` },
  };
}

export const resolveUniversalDID = resolveDID;

/**
 * Signs arbitrary data using a stored Ed25519 secret key.
 * Returns a 64-byte Ed25519 signature in hex format.
 */
export function signWithEd25519(
  message: string | Uint8Array,
  privateKeyHex: string
): string {
  const messageBytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const secretKeyBytes = hexToUint8Array(privateKeyHex);

  if (secretKeyBytes.length !== 64) {
    throw new Error(`Invalid secret key length. Expected 64 bytes, got ${secretKeyBytes.length}`);
  }

  const signatureBytes = nacl.sign.detached(messageBytes, secretKeyBytes);
  return uint8ArrayToHex(signatureBytes);
}

/**
 * Verifies an Ed25519 signature given the message, signature hex, and raw public key.
 */
export function verifyEd25519Signature(
  message: string | Uint8Array,
  signatureHex: string,
  publicKeyBytesOrHex: Uint8Array | string
): boolean {
  try {
    const messageBytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;
    const signatureBytes = hexToUint8Array(signatureHex);
    const publicKeyBytes =
      typeof publicKeyBytesOrHex === 'string'
        ? hexToUint8Array(publicKeyBytesOrHex)
        : publicKeyBytesOrHex;

    if (signatureBytes.length !== 64) return false;
    if (publicKeyBytes.length !== 32) return false;

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Verifies an Ed25519 signature against any resolvable DID (did:key or did:giglink).
 */
export async function verifySignatureWithDID(
  message: string | Uint8Array,
  signatureHex: string,
  signerDid: string
): Promise<boolean> {
  const resolution = await resolveDID(signerDid);
  if (!resolution.didDocument || !resolution.didDocument.verificationMethod.length) {
    return false;
  }

  const vm = resolution.didDocument.verificationMethod[0];
  let publicKeyBytes: Uint8Array;

  if (vm.publicKeyHex) {
    publicKeyBytes = hexToUint8Array(vm.publicKeyHex);
  } else if (vm.publicKeyMultibase) {
    if (signerDid.startsWith('did:key:')) {
      publicKeyBytes = decodeDidKey(signerDid);
    } else {
      const decoded = bs58.decode(vm.publicKeyMultibase.startsWith('z') ? vm.publicKeyMultibase.slice(1) : vm.publicKeyMultibase);
      publicKeyBytes = decoded.slice(0, 32);
    }
  } else {
    return false;
  }

  return verifyEd25519Signature(message, signatureHex, publicKeyBytes);
}
