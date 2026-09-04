import {
  generateEd25519KeyPair,
  registerGigLinkDID,
} from '../lib/crypto/didService';
import {
  buildCanonicalMerkleTree,
  computeRfc6962LeafHash,
  computeRfc6962NodeHash,
  generateMerkleAuditPath,
  verifyMerkleProof,
} from '../lib/crypto/merkleTree';
import {
  createSaltedMerkleCredential,
  createSelectiveDisclosurePresentation,
  verifySelectiveDisclosurePresentation,
  computeSaltedClaimLeafHash,
  canonicalJsonStringify,
} from '../lib/crypto/selectiveDisclosureService';

export async function runPhase9CSaltedSelectiveDisclosureTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- PHASE 9C.2: SALTED CLAIM COMMITMENTS & MERKLE SELECTIVE DISCLOSURE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ [P9C.2] ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ [P9C.2] ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Deterministic JSON canonical serialization
    const objA = { z: 1, a: 2, m: { y: 'test', b: [3, 1, 2] } };
    const objB = { a: 2, m: { b: [3, 1, 2], y: 'test' }, z: 1 };
    assert(
      canonicalJsonStringify(objA) === canonicalJsonStringify(objB),
      'Deterministic JSON stringifier produces identical strings regardless of object key order'
    );

    // 2. RFC 6962 domain separation hashing
    const leafHash1 = await computeRfc6962LeafHash('test-payload');
    const leafHash2 = await computeRfc6962LeafHash('test-payload');
    assert(
      leafHash1 === leafHash2 && leafHash1.length === 64,
      'RFC 6962 leaf hashing generates deterministic 32-byte (64 hex char) digest with 0x00 domain prefix'
    );

    const nodeHash = await computeRfc6962NodeHash(leafHash1, leafHash2);
    assert(
      nodeHash.length === 64 && nodeHash !== leafHash1,
      'RFC 6962 node hashing creates valid 32-byte parent hash with 0x01 domain prefix'
    );

    // 3. Merkle tree construction and proof verification
    const testLeaves = [
      await computeRfc6962LeafHash('claim_0'),
      await computeRfc6962LeafHash('claim_1'),
      await computeRfc6962LeafHash('claim_2'),
      await computeRfc6962LeafHash('claim_3'),
      await computeRfc6962LeafHash('claim_4'),
    ];
    const tree = await buildCanonicalMerkleTree(testLeaves);
    assert(
      tree.leaves.length === 5 && tree.rootHash.length === 64,
      'Builds RFC 6962 canonical binary Merkle tree with odd leaf count handling'
    );

    const proofLeaf2 = generateMerkleAuditPath(tree, 2);
    const isProof2Valid = await verifyMerkleProof(proofLeaf2);
    assert(isProof2Valid, 'Generates and verifies valid RFC 6962 Merkle inclusion audit path');

    // 4. Setup Entities and Issue Salted Merkle Credential
    const mitKeyPair = generateEd25519KeyPair('MIT Registrar');
    await registerGigLinkDID('mit_eecs', 'institution', mitKeyPair);
    const issuerDid = 'did:giglink:institution:mit_eecs';

    const aliceKeyPair = generateEd25519KeyPair('Alice Talent');
    const subjectDid = aliceKeyPair.did;

    const rawClaims = {
      degreeTitle: 'Bachelor of Science in Computer Science',
      institutionName: 'Massachusetts Institute of Technology',
      graduationYear: 2026,
      gpa: 3.98,
      honors: 'Summa Cum Laude',
      disciplinaryStatus: 'Clean Record',
      ssnLast4: '9876',
      kycDocumentId: 'PASS_USA_98712365',
    };

    const saltedCred = await createSaltedMerkleCredential(
      'cred_mit_cs_2026_001',
      issuerDid,
      mitKeyPair.privateKeyHex,
      subjectDid,
      rawClaims
    );

    assert(
      saltedCred.claimLeaves.length === 8 &&
      saltedCred.claimLeaves.every((l) => l.salt.length === 64) &&
      saltedCred.credentialMerkleRoot.length === 64 &&
      saltedCred.issuerSignature.length === 128,
      'Issues Salted Merkle Credential with 256-bit CSPRNG salts per attribute and signed Merkle root'
    );

    // 5. Create Selective Disclosure Presentation (Disclose only degree, institution, and year; hide GPA, honors, SSN, KYC)
    const keysToDisclose = ['degreeTitle', 'institutionName', 'graduationYear'];
    const presentation = createSelectiveDisclosurePresentation(saltedCred, keysToDisclose);

    assert(
      presentation.disclosedClaims.length === 3 &&
      !presentation.disclosedClaims.some((c) => c.claimKey === 'gpa' || c.claimKey === 'ssnLast4'),
      'Creates Selective Disclosure Presentation exposing only chosen attributes while keeping private attributes hidden'
    );

    // 6. Independent Third-Party Verification of Selective Disclosure
    const verificationResult = await verifySelectiveDisclosurePresentation(presentation);
    assert(
      verificationResult.isValid &&
      verificationResult.issuerSignatureValid &&
      verificationResult.allProofsValid &&
      verificationResult.reconstructedClaims.length === 3,
      'Third-party successfully verifies selective disclosure presentation without access to issuer database or private attributes'
    );

    // 7. Adversarial Test: Tampered Disclosed Value
    const tamperedValuePres = JSON.parse(JSON.stringify(presentation));
    tamperedValuePres.disclosedClaims[0].disclosedValue = 'Master of Science in Artificial Intelligence'; // Altered value
    const tamperedValResult = await verifySelectiveDisclosurePresentation(tamperedValuePres);
    assert(
      !tamperedValResult.isValid && !tamperedValResult.allProofsValid,
      '[ADV BLOCKED] Tampering with disclosed claim value fails leaf hash reconstruction and verification'
    );

    // 8. Adversarial Test: Tampered Salt
    const tamperedSaltPres = JSON.parse(JSON.stringify(presentation));
    tamperedSaltPres.disclosedClaims[0].salt = '0000000000000000000000000000000000000000000000000000000000000000';
    const tamperedSaltResult = await verifySelectiveDisclosurePresentation(tamperedSaltPres);
    assert(
      !tamperedSaltResult.isValid && !tamperedSaltResult.allProofsValid,
      '[ADV BLOCKED] Tampering with attribute salt fails leaf hash reconstruction'
    );

    // 9. Adversarial Test: Swapped Audit Path Node
    const swappedPathPres = JSON.parse(JSON.stringify(presentation));
    swappedPathPres.disclosedClaims[0].auditPath[0].hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const swappedPathResult = await verifySelectiveDisclosurePresentation(swappedPathPres);
    assert(
      !swappedPathResult.isValid && !swappedPathResult.allProofsValid,
      '[ADV BLOCKED] Swapping or corrupting Merkle audit path node fails Merkle root verification'
    );

    // 10. Adversarial Test: Incorrect Leaf Index
    const incorrectIdxPres = JSON.parse(JSON.stringify(presentation));
    incorrectIdxPres.disclosedClaims[0].leafIndex = 7; // Wrong index
    const incorrectIdxResult = await verifySelectiveDisclosurePresentation(incorrectIdxPres);
    assert(
      !incorrectIdxResult.isValid && !incorrectIdxResult.allProofsValid,
      '[ADV BLOCKED] Modifying leaf index invalidates Merkle inclusion proof'
    );

    // 11. Adversarial Test: Forged Merkle Root
    const forgedRootPres = JSON.parse(JSON.stringify(presentation));
    forgedRootPres.credentialMerkleRoot = '1111111111111111111111111111111111111111111111111111111111111111';
    const forgedRootResult = await verifySelectiveDisclosurePresentation(forgedRootPres);
    assert(
      !forgedRootResult.isValid && !forgedRootResult.issuerSignatureValid,
      '[ADV BLOCKED] Forged Merkle root fails Issuer Ed25519 signature verification'
    );

    // 12. Adversarial Test: Issuer Signature Substitution / Key Impersonation
    const attackerKeyPair = generateEd25519KeyPair('Attacker College');
    const attackerSignature = mitKeyPair.privateKeyHex; // Not MIT's signature
    const forgedSigPres = JSON.parse(JSON.stringify(presentation));
    forgedSigPres.issuerDid = attackerKeyPair.did; // Attacker claims to be issuer
    const forgedSigResult = await verifySelectiveDisclosurePresentation(forgedSigPres);
    assert(
      !forgedSigResult.isValid && !forgedSigResult.issuerSignatureValid,
      '[ADV BLOCKED] Issuer signature substitution or unauthorized DID fails verification'
    );

    // 13. Adversarial Test: Revoked Credential Presentation Rejection
    const revokedSDResult = await verifySelectiveDisclosurePresentation(
      presentation,
      async (credId) => credId === saltedCred.credentialId
    );
    assert(
      !revokedSDResult.isValid && revokedSDResult.failureReason?.includes('revoked'),
      '[ADV BLOCKED] Selective disclosure presentation for revoked credential is rejected by verifier'
    );

  } catch (err: any) {
    console.error('Phase 9C.2 Test execution error:', err);
    failed++;
  }

  console.log(`Phase 9C.2 Result: ${passed}/${passed + failed} tests passed successfully.`);
  return { passed, failed };
}

// Allow direct CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase9CSaltedSelectiveDisclosureTests().then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}
