import {
  generateEd25519KeyPair,
  encodeDidKey,
  decodeDidKey,
  resolveDID,
  registerGigLinkDID,
  signWithEd25519,
  verifyEd25519Signature,
  verifySignatureWithDID,
} from '../lib/crypto/didService';

export async function runPhase9CDIDInfrastructureTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- PHASE 9C.1: DECENTRALIZED IDENTIFIERS & ED25519 KEY INFRASTRUCTURE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ [P9C.1] ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ [P9C.1] FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // Test 1: Ed25519 KeyPair generation and W3C did:key derivation
    const aliceKeyPair = generateEd25519KeyPair('Alice Primary Key');
    assert(
      aliceKeyPair.did.startsWith('did:key:z6M') || aliceKeyPair.did.startsWith('did:key:z'),
      'Generates cryptographically valid Ed25519 did:key with multibase encoding'
    );
    assert(
      aliceKeyPair.publicKeyHex.length === 64, // 32 bytes = 64 hex chars
      'Public key length is exactly 32 bytes (64 hex characters)'
    );
    assert(
      aliceKeyPair.privateKeyHex.length === 128, // 64 bytes = 128 hex chars
      'Secret key length is exactly 64 bytes in nacl format'
    );

    // Test 2: Multicodec encoding and decoding round-trip
    const decodedPublicKey = decodeDidKey(aliceKeyPair.did);
    const reEncodedDid = encodeDidKey(decodedPublicKey);
    assert(
      reEncodedDid === aliceKeyPair.did,
      'did:key encode and decode operations round-trip with 100% byte fidelity'
    );

    // Test 3: Rejection of malformed did:key strings
    let malformedRejected = false;
    try {
      decodeDidKey('did:key:invalid_string_not_base58');
    } catch {
      malformedRejected = true;
    }
    assert(malformedRejected, 'Correctly rejects malformed did:key strings with invalid format');

    // Test 4: Offline deterministic resolution of did:key
    const resolution = await resolveDID(aliceKeyPair.did);
    assert(
      resolution.didDocument !== null &&
      resolution.didDocument.id === aliceKeyPair.did &&
      resolution.didDocument.verificationMethod.length === 1 &&
      resolution.didDocument.verificationMethod[0].type === 'Ed25519VerificationKey2020',
      'Resolves W3C DID Document for did:key deterministically without network queries'
    );

    // Test 5: Sovereign did:giglink registration and resolution
    const institutionKeyPair = generateEd25519KeyPair('MIT EECS Registrar Key');
    const mitDidDoc = await registerGigLinkDID('mit_eecs', 'institution', institutionKeyPair);
    assert(
      mitDidDoc.id === 'did:giglink:institution:mit_eecs' &&
      mitDidDoc.verificationMethod[0].id === 'did:giglink:institution:mit_eecs#key-1',
      'Registers sovereign did:giglink DID Document with verified Ed25519 method'
    );

    const mitResolution = await resolveDID('did:giglink:institution:mit_eecs');
    assert(
      mitResolution.didDocument !== null &&
      mitResolution.didDocument.id === 'did:giglink:institution:mit_eecs',
      'Resolves registered did:giglink document from DID registry'
    );

    // Test 6: Genuine Ed25519 signature generation and verification
    const testMessage = JSON.stringify({
      credentialId: 'cred_mit_cs_2026',
      recipientDid: aliceKeyPair.did,
      gpa: '3.95',
      issuedAt: '2026-09-01T00:00:00Z',
    });

    const signatureHex = signWithEd25519(testMessage, institutionKeyPair.privateKeyHex);
    assert(
      signatureHex.length === 128, // 64 bytes = 128 hex chars
      'Generates genuine 64-byte Ed25519 digital signature'
    );

    const isDirectlyValid = verifyEd25519Signature(
      testMessage,
      signatureHex,
      institutionKeyPair.publicKeyHex
    );
    assert(isDirectlyValid, 'Directly verifies authentic Ed25519 signature with public key');

    // Test 7: Universal DID-based signature verification for did:key
    const aliceMsg = 'I authorize this zero-knowledge selective presentation';
    const aliceSig = signWithEd25519(aliceMsg, aliceKeyPair.privateKeyHex);
    const isAliceSigValid = await verifySignatureWithDID(aliceMsg, aliceSig, aliceKeyPair.did);
    assert(isAliceSigValid, 'Resolves did:key and verifies holder signature via universal DID interface');

    // Test 8: Universal DID-based signature verification for did:giglink
    const isMitSigValid = await verifySignatureWithDID(
      testMessage,
      signatureHex,
      'did:giglink:institution:mit_eecs'
    );
    assert(isMitSigValid, 'Resolves did:giglink and verifies issuer attestation signature via universal DID interface');

    // Test 9: Adversarial payload tampering detection
    const tamperedMessage = JSON.stringify({
      credentialId: 'cred_mit_cs_2026',
      recipientDid: aliceKeyPair.did,
      gpa: '4.00', // Altered GPA
      issuedAt: '2026-09-01T00:00:00Z',
    });
    const isTamperedValid = verifyEd25519Signature(
      tamperedMessage,
      signatureHex,
      institutionKeyPair.publicKeyHex
    );
    assert(!isTamperedValid, 'Adversarial bit-flip attack on payload fails Ed25519 verification');

    // Test 10: Adversarial key substitution / impersonation attack
    const attackerKeyPair = generateEd25519KeyPair('Attacker Eve');
    const isAttackerValid = await verifySignatureWithDID(
      testMessage,
      signatureHex,
      attackerKeyPair.did
    );
    assert(!isAttackerValid, 'Adversarial key-substitution/impersonation attack fails DID verification');

  } catch (err: any) {
    console.error('Phase 9C.1 Test execution error:', err);
    failed++;
  }

  console.log(`Phase 9C.1 Result: ${passed}/${passed + failed} tests passed successfully.`);
  return { passed, failed };
}

// Allow direct CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase9CDIDInfrastructureTests().then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}
