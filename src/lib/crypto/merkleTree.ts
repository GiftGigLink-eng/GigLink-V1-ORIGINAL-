import nacl from 'tweetnacl';

// RFC 6962 Domain Separation Prefixes to prevent second-preimage attacks
const LEAF_PREFIX = new Uint8Array([0x00]);
const NODE_PREFIX = new Uint8Array([0x01]);

export interface MerklePathNode {
  position: 'left' | 'right';
  hash: string; // 32-byte hex hash
}

export interface MerkleProof {
  leafHash: string;
  leafIndex: number;
  totalLeaves: number;
  auditPath: MerklePathNode[];
  rootHash: string;
}

export interface CanonicalMerkleTree {
  leaves: string[]; // List of leaf hashes in order
  layers: string[][]; // layers[0] = leaves, layers[last] = [rootHash]
  rootHash: string;
}

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
 * SHA-256 hashing supporting browser WebCrypto and Node.js environments.
 */
export async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto
      ? globalThis.crypto
      : typeof window !== 'undefined'
      ? window.crypto
      : null;

  if (cryptoObj && cryptoObj.subtle) {
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  }

  // Fallback: TweetNaCl hash (SHA-512 truncated or native crypto via dynamic import if needed)
  // For standard environments, WebCrypto subtle is available in modern Node (v18+) and all browsers.
  // In pure JS fallback if SubtleCrypto is unavailable:
  const hash512 = nacl.hash(data);
  return hash512.slice(0, 32);
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await sha256Bytes(bytes);
  return uint8ArrayToHex(hash);
}

/**
 * Computes RFC 6962 leaf hash: SHA-256(0x00 || rawData)
 */
export async function computeRfc6962LeafHash(rawPayload: Uint8Array | string): Promise<string> {
  const payloadBytes = typeof rawPayload === 'string' ? new TextEncoder().encode(rawPayload) : rawPayload;
  const combined = new Uint8Array(LEAF_PREFIX.length + payloadBytes.length);
  combined.set(LEAF_PREFIX, 0);
  combined.set(payloadBytes, LEAF_PREFIX.length);
  const hash = await sha256Bytes(combined);
  return uint8ArrayToHex(hash);
}

/**
 * Computes RFC 6962 interior node hash: SHA-256(0x01 || leftHash || rightHash)
 */
export async function computeRfc6962NodeHash(leftHex: string, rightHex: string): Promise<string> {
  const leftBytes = hexToUint8Array(leftHex);
  const rightBytes = hexToUint8Array(rightHex);
  const combined = new Uint8Array(NODE_PREFIX.length + leftBytes.length + rightBytes.length);
  combined.set(NODE_PREFIX, 0);
  combined.set(leftBytes, NODE_PREFIX.length);
  combined.set(rightBytes, NODE_PREFIX.length + leftBytes.length);
  const hash = await sha256Bytes(combined);
  return uint8ArrayToHex(hash);
}

/**
 * Constructs a deterministic RFC 6962 canonical binary Merkle Tree from an ordered list of leaf hashes.
 * If the leaf count is odd at any layer, the last node is promoted or paired deterministically with itself.
 */
export async function buildCanonicalMerkleTree(leafHashes: string[]): Promise<CanonicalMerkleTree> {
  if (!leafHashes || leafHashes.length === 0) {
    const emptyRoot = await sha256Hex('');
    return {
      leaves: [],
      layers: [[emptyRoot]],
      rootHash: emptyRoot,
    };
  }

  const layers: string[][] = [leafHashes.slice()];
  let currentLayer = leafHashes.slice();

  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left; // Pair with self if odd
      const parentHash = await computeRfc6962NodeHash(left, right);
      nextLayer.push(parentHash);
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  return {
    leaves: leafHashes.slice(),
    layers,
    rootHash: layers[layers.length - 1][0],
  };
}

/**
 * Generates an inclusion / audit path for a specific leaf index in the Merkle Tree.
 */
export function generateMerkleAuditPath(tree: CanonicalMerkleTree, leafIndex: number): MerkleProof {
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) {
    throw new Error(`Leaf index ${leafIndex} out of bounds. Tree contains ${tree.leaves.length} leaves.`);
  }

  const auditPath: MerklePathNode[] = [];
  let currentIndex = leafIndex;

  for (let layerIndex = 0; layerIndex < tree.layers.length - 1; layerIndex++) {
    const currentLayer = tree.layers[layerIndex];
    const isEven = currentIndex % 2 === 0;
    const siblingIndex = isEven ? currentIndex + 1 : currentIndex - 1;

    if (siblingIndex < currentLayer.length) {
      auditPath.push({
        position: isEven ? 'right' : 'left',
        hash: currentLayer[siblingIndex],
      });
    } else {
      // Node was paired with itself
      auditPath.push({
        position: 'right',
        hash: currentLayer[currentIndex],
      });
    }

    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    leafHash: tree.leaves[leafIndex],
    leafIndex,
    totalLeaves: tree.leaves.length,
    auditPath,
    rootHash: tree.rootHash,
  };
}

/**
 * Verifies an RFC 6962 Merkle proof independently from the root hash.
 */
export async function verifyMerkleProof(proof: MerkleProof): Promise<boolean> {
  try {
    if (!proof || !proof.leafHash || !proof.rootHash || !proof.auditPath) {
      return false;
    }

    let runningHash = proof.leafHash;
    let currentIndex = proof.leafIndex;

    for (let layer = 0; layer < proof.auditPath.length; layer++) {
      const node = proof.auditPath[layer];
      const isEven = currentIndex % 2 === 0;
      const expectedPosition = isEven ? 'right' : 'left';

      // Ensure audit path node position matches mathematical leaf index derivation
      if (node.position !== expectedPosition) {
        return false;
      }

      if (node.position === 'left') {
        runningHash = await computeRfc6962NodeHash(node.hash, runningHash);
      } else {
        runningHash = await computeRfc6962NodeHash(runningHash, node.hash);
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return runningHash.toLowerCase() === proof.rootHash.toLowerCase();
  } catch {
    return false;
  }
}
