export interface MerkleTreeLeaf {
  leafId: string;               // e.g. credentialId or transcriptId
  leafType: 'credential' | 'transcript' | 'contract_seal' | 'presentation';
  payloadDigest: string;        // Canonical SHA-256 digest
  leafHash: string;             // SHA256(0x00 || payloadDigest) (RFC 6962 leaf prefix)
  timestamp: string;
}

export interface MerkleBatchAnchor {
  batchId: string;              // e.g. "batch_2026_09_01_001"
  batchNumber: number;
  rootHash: string;             // SHA-256 Merkle Root
  leavesCount: number;
  leaves: MerkleTreeLeaf[];
  previousBatchRoot: string;    // Cryptographic hash chain linking to previous batch
  anchoredAt: string;
  anchoredByAdminUid: string;
  signature: string;            // Authority signature over rootHash
  externalChainWitness?: {
    network: 'ethereum_sepolia' | 'polygon' | 'solana' | 'public_notary';
    txHash: string;
    blockNumber: number;
    witnessUrl: string;
  };
}

export interface MerkleInclusionProof {
  leafHash: string;
  leafIndex: number;
  totalLeaves: number;
  auditPath: {
    position: 'left' | 'right';
    hash: string;
  }[];
  rootHash: string;
  batchId: string;
}
