import {
  generateEd25519KeyPair,
  resolveUniversalDID,
  verifySignatureWithDID,
} from '../lib/crypto/didService';
import {
  createSaltedMerkleCredential,
  createSelectiveDisclosurePresentation,
  verifySelectiveDisclosurePresentation,
} from '../lib/crypto/selectiveDisclosureService';
import {
  createZKPredicatePresentation,
  verifyZKPredicatePresentation,
  pedersenGenerators,
} from '../lib/crypto/zeroKnowledgeService';

export async function runPhase9C4Tests(): Promise<{ total: number; passed: number; failed: number }> {
  console.log('\n--- PHASE 9C.4: SOVEREIGN IDENTITY & ZK VERIFICATION CONSOLE UI FLOWS ---');
  let total = 0;
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  ✓ [P9C.4] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [P9C.4] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Holder Sovereign DID initialization and local derivation
    const holderKp = generateEd25519KeyPair('Alice Sovereign Talent');
    assert(holderKp.did.startsWith('did:key:z6M'), 'Generates valid W3C did:key decentralized identifier for talent');
    assert(holderKp.publicKeyHex.length === 64, 'Derives 32-byte Ed25519 public key hex for DID document');
    assert(holderKp.privateKeyHex.length === 128, 'Derives 64-byte Ed25519 secret key hex for client-side signing');

    // 2. Issuer DID and Salted Credential Issuance
    const issuerKp = generateEd25519KeyPair('MIT Registrar Authority');
    const rawClaims = {
      degree: 'Master of Science in Computer Science',
      institution: 'Massachusetts Institute of Technology',
      gpa: 3.96,
      trustScore: 95,
      totalVerifiedProjects: 15,
      totalDeliveredVolumeUSD: 52000,
      graduationYear: '2026',
      honors: 'Summa Cum Laude',
    };

    const saltedCred = await createSaltedMerkleCredential(
      'cred_mit_cs_alice_001',
      issuerKp.did,
      issuerKp.privateKeyHex,
      holderKp.did,
      rawClaims
    );
    assert(saltedCred.credentialMerkleRoot.length === 64, 'Calculates 32-byte RFC 6962 canonical Merkle root for credential');
    assert(saltedCred.issuerSignature.length === 128, 'Issuer cryptographically signs Merkle root with Ed25519');

    // 3. UI Flow A: Sovereign Presentation Studio generates ZK Predicate Presentation
    const testNonce = 'nonce_console_' + Math.random().toString(36).substring(2, 8);
    const testAudience = 'did:giglink:enterprise:hedge_fund_corp';

    const zkPresentation = await createZKPredicatePresentation({
      credentialRecord: saltedCred,
      holderKeyPair: holderKp,
      predicatesToProve: [
        { claimKey: 'trustScore', threshold: 90, statement: 'Trust Score ≥ 90' },
        { claimKey: 'totalVerifiedProjects', threshold: 10, statement: 'Projects ≥ 10' },
        { claimKey: 'totalDeliveredVolumeUSD', threshold: 25000, statement: 'Delivered Volume ≥ $25,000' },
      ],
      nonce: testNonce,
      audienceDid: testAudience,
      validityMinutes: 120,
    });

    assert(zkPresentation.presentationId.startsWith('zkp_'), 'Sovereign Presentation Studio creates unique presentation ID');
    assert(zkPresentation.predicates.length === 3, 'Presentation bundles all 3 requested zero-knowledge predicates');
    assert(zkPresentation.holderSignature.length === 128, 'Holder signs presentation bundle with sovereign Ed25519 key');

    // 4. Autonomous Public Verification Console (Executive View)
    const publicVerificationOutcome = await verifyZKPredicatePresentation(
      zkPresentation,
      testNonce,
      testAudience
    );
    assert(publicVerificationOutcome.isValid, 'Public Verification Console confirms authentic ZK presentation as Valid');
    assert(publicVerificationOutcome.verifiedPredicates.length === 3, 'All 3 zero-knowledge predicates verified as Satisfied');
    assert(publicVerificationOutcome.status === 'verified', 'Verification status is verified without contacting issuer');

    // 5. Technical Proof Inspector Math Invariants
    const p1 = zkPresentation.predicates[0];
    assert(p1.zkProof.commitmentC.length > 0, 'Proof Inspector displays Pedersen Commitment C');
    assert(p1.zkProof.fiatShamirChallenge.length > 0, 'Proof Inspector exposes Fiat-Shamir non-interactive challenge e');
    assert(p1.zkProof.responseValue.length > 0 && p1.zkProof.responseRandomness.length > 0, 'Proof Inspector exposes Schnorr response vectors (s_v, s_r)');

    // 6. UI Flow B: Salted Merkle Selective Disclosure Studio
    const sdPresentation = await createSelectiveDisclosurePresentation(saltedCred, [
      'degree',
      'institution',
      'honors',
    ]);
    assert(sdPresentation.disclosedClaims.length === 3, 'Selective disclosure exposes exactly 3 chosen attributes');
    assert(!sdPresentation.disclosedClaims.some((c) => c.claimKey === 'gpa'), 'Undisclosed attribute GPA is omitted from disclosure');
    assert(!sdPresentation.disclosedClaims.some((c) => c.claimKey === 'trustScore'), 'Undisclosed attribute trustScore is omitted from disclosure');

    const sdVerification = await verifySelectiveDisclosurePresentation(sdPresentation);
    assert(sdVerification.isValid, 'Public Console verifies Salted Merkle Selective Disclosure presentation');
    assert(sdVerification.reconstructedClaims.length === 3, 'All disclosed claims successfully reconstruct Merkle root');

    // 7. Console Specimen: Attack Altered Threshold
    const tamperedZk = JSON.parse(JSON.stringify(zkPresentation));
    tamperedZk.predicates[0].threshold = 99; // Attacker increases threshold from 90 to 99
    const tamperedThresholdOutcome = await verifyZKPredicatePresentation(
      tamperedZk,
      testNonce,
      testAudience
    );
    assert(!tamperedThresholdOutcome.isValid, '[SPECIMEN ATTACK] Tampered threshold in console fails verification');

    // 8. Console Specimen: Attack Forged Holder Signature
    const tamperedSigZk = JSON.parse(JSON.stringify(zkPresentation));
    tamperedSigZk.holderSignature = '00'.repeat(64);
    const tamperedSigOutcome = await verifyZKPredicatePresentation(
      tamperedSigZk,
      testNonce,
      testAudience
    );
    assert(!tamperedSigOutcome.isValid, '[SPECIMEN ATTACK] Forged holder Ed25519 signature fails verification');

    // 9. Console Specimen: Attack Replay (Mismatched Nonce)
    const replayOutcome = await verifyZKPredicatePresentation(
      zkPresentation,
      'nonce_attacker_replayed_nonce',
      testAudience
    );
    assert(!replayOutcome.isValid && replayOutcome.failureReason?.toLowerCase().includes('nonce'), '[SPECIMEN ATTACK] Replay attack with mismatched verifier nonce is rejected');

    // 10. Console Specimen: Attack Interception (Mismatched Audience)
    const interceptionOutcome = await verifyZKPredicatePresentation(
      zkPresentation,
      testNonce,
      'did:giglink:enterprise:stolen_verifier_target'
    );
    assert(!interceptionOutcome.isValid && interceptionOutcome.failureReason?.toLowerCase().includes('audience'), '[SPECIMEN ATTACK] Mismatched audience DID is rejected by console');

    // 11. Console Specimen: Attack Revoked Source Credential
    const revokedOutcome = await verifyZKPredicatePresentation(
      zkPresentation,
      testNonce,
      testAudience,
      async (credId) => credId === saltedCred.credentialId // Revocation registry flags as revoked
    );
    assert(!revokedOutcome.isValid && revokedOutcome.failureReason?.includes('revoked'), '[SPECIMEN ATTACK] Presentation referencing revoked credential is mathematically rejected');

    // 12. Serialization & Roundtrip Fidelity
    const serializedJson = JSON.stringify(zkPresentation);
    const parsedBack = JSON.parse(serializedJson);
    const roundtripOutcome = await verifyZKPredicatePresentation(
      parsedBack,
      testNonce,
      testAudience
    );
    assert(roundtripOutcome.isValid, 'Presentation JSON stringification & parsing retains 100% cryptographic verification fidelity');

  } catch (err: any) {
    console.error('Phase 9C.4 Test execution error:', err);
    failed++;
  }

  console.log(`Phase 9C.4 Result: ${passed}/${total} tests passed successfully.`);
  return { total, passed, failed };
}
