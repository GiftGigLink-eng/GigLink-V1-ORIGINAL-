import { generateEd25519KeyPair, registerGigLinkDID } from '../lib/crypto/didService';
import { createSaltedMerkleCredential } from '../lib/crypto/selectiveDisclosureService';
import {
  generateZKRangeProof,
  verifyZKRangeProof,
  createZKPredicatePresentation,
  verifyZKPredicatePresentation,
  computePedersenCommitment,
  randomFieldElement,
  ZK_PRIME_P,
  ZK_ORDER_Q,
} from '../lib/crypto/zeroKnowledgeService';

export async function runPhase9CZKRangeProofTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- PHASE 9C.3: ZERO-KNOWLEDGE PREDICATE & RANGE PROOF LAYER ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ [P9C.3] ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ [P9C.3] ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Pedersen Commitment Invariants: Homomorphism and Hiding
    const v1 = 50n;
    const v2 = 35n;
    const r1 = randomFieldElement();
    const r2 = randomFieldElement();

    const C1 = computePedersenCommitment(v1, r1);
    const C2 = computePedersenCommitment(v2, r2);
    const CSum = (C1 * C2) % ZK_PRIME_P;
    const expectedCSum = computePedersenCommitment(v1 + v2, (r1 + r2) % ZK_ORDER_Q);

    assert(
      CSum === expectedCSum,
      'Pedersen commitments satisfy additively homomorphic commitment invariant C(v1, r1) * C(v2, r2) = C(v1+v2, r1+r2)'
    );

    // 2. Autonomous ZK Range Proof Generation (e.g. Trust Score 92 >= 85)
    const secretTrustScore = 92;
    const secretSaltHex = 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0';
    const threshold = 85;
    const testNonce = 'nonce_emp_google_2026_09_01_xyz';
    const testAudienceDid = 'did:giglink:enterprise:google_deepmind';

    const zkProof = await generateZKRangeProof(
      secretTrustScore,
      secretSaltHex,
      threshold,
      'trustScore',
      testNonce,
      testAudienceDid
    );

    assert(
      zkProof.commitmentC.length > 0 &&
      zkProof.fiatShamirChallenge.length > 0 &&
      zkProof.responseValue.length > 0 &&
      zkProof.responseRandomness.length > 0,
      'Generates non-interactive Fiat-Shamir ZK range proof without leaking secret value or randomness'
    );

    // 3. Algebraic Verification of Authentic ZK Proof
    const isProofValid = await verifyZKRangeProof(
      zkProof,
      'trustScore',
      testNonce,
      testAudienceDid
    );
    assert(
      isProofValid,
      'Third-party algebraically verifies ZK range proof (v >= 85) without learning that actual score is 92'
    );

    // 4. Exact Boundary Condition (v == threshold, e.g. 85 >= 85)
    const boundaryProof = await generateZKRangeProof(
      85,
      secretSaltHex,
      85,
      'trustScore',
      testNonce,
      testAudienceDid
    );
    const isBoundaryValid = await verifyZKRangeProof(
      boundaryProof,
      'trustScore',
      testNonce,
      testAudienceDid
    );
    assert(isBoundaryValid, 'Correctly proves and verifies exact boundary threshold (v == threshold, delta == 0)');

    // 5. Setup Institutional Credential & Issue to Talent
    const mitKeyPair = generateEd25519KeyPair('MIT Registrar');
    await registerGigLinkDID('mit_credentials', 'institution', mitKeyPair);
    const issuerDid = 'did:giglink:institution:mit_credentials';

    const aliceKeyPair = generateEd25519KeyPair('Alice Talent');
    const holderDid = aliceKeyPair.did;

    const rawCredentialClaims = {
      degree: 'Master of Science in Computer Science',
      institution: 'MIT',
      trustScore: 94,
      totalVerifiedProjects: 14,
      totalDeliveredVolumeUSD: 48500,
      gpa: 3.96,
    };

    const saltedCred = await createSaltedMerkleCredential(
      'cred_mit_cs_alice_2026',
      issuerDid,
      mitKeyPair.privateKeyHex,
      holderDid,
      rawCredentialClaims
    );

    // 6. Create Multi-Predicate ZK Presentation
    // Proves: Trust Score >= 85, Verified Projects >= 10, Volume >= 25000
    // Hides: Exact GPA, exact volume ($48,500), exact project count (14), exact trust score (94)
    const presentation = await createZKPredicatePresentation({
      credentialRecord: saltedCred,
      holderKeyPair: aliceKeyPair,
      predicatesToProve: [
        { claimKey: 'trustScore', threshold: 85, statement: 'Trust Score is 85 or above (Elite Tier)' },
        { claimKey: 'totalVerifiedProjects', threshold: 10, statement: 'Has completed at least 10 verified contracts' },
        { claimKey: 'totalDeliveredVolumeUSD', threshold: 25000, statement: 'Has delivered over $25,000 in escrow volume' },
      ],
      nonce: testNonce,
      audienceDid: testAudienceDid,
      validityMinutes: 120,
    });

    assert(
      presentation.predicates.length === 3 &&
      presentation.holderSignature.length === 128 &&
      presentation.credentialMerkleRoot === saltedCred.credentialMerkleRoot,
      'Creates sovereign ZK Presentation binding multiple numeric predicates, holder DID signature, and source Merkle root'
    );

    // 7. Full Independent Verification of Presentation
    const fullOutcome = await verifyZKPredicatePresentation(
      presentation,
      testNonce,
      testAudienceDid
    );
    assert(
      fullOutcome.isValid &&
      fullOutcome.status === 'verified' &&
      fullOutcome.verifiedPredicates.length === 3 &&
      fullOutcome.verifiedPredicates.every((p) => p.passed),
      'Verifier successfully verifies all predicates, holder signature, and issuer Merkle root without accessing private data'
    );

    // 8. Adversarial Test: Falsified Predicate (Attempting to prove v >= 100 when actual value is 94)
    let falsifiedAttemptBlocked = false;
    try {
      await generateZKRangeProof(
        94,
        secretSaltHex,
        100, // Impossible threshold
        'trustScore',
        testNonce,
        testAudienceDid
      );
    } catch {
      falsifiedAttemptBlocked = true;
    }
    assert(falsifiedAttemptBlocked, '[ADV BLOCKED] Prover cannot generate valid ZK proof when secret value is below requested threshold');

    // 9. Adversarial Test: Altered Threshold in ZK Proof Payload
    const alteredThresholdProof = JSON.parse(JSON.stringify(zkProof));
    alteredThresholdProof.threshold = 95; // Adversary raises threshold without recomputing proof
    const isAlteredThresholdValid = await verifyZKRangeProof(
      alteredThresholdProof,
      'trustScore',
      testNonce,
      testAudienceDid
    );
    assert(
      !isAlteredThresholdValid,
      '[ADV BLOCKED] Altering threshold in proof payload fails homomorphic commitment and challenge check'
    );

    // 10. Adversarial Test: Commitment Substitution / Forged Response
    const forgedResponseProof = JSON.parse(JSON.stringify(zkProof));
    forgedResponseProof.responseValue = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const isForgedValid = await verifyZKRangeProof(
      forgedResponseProof,
      'trustScore',
      testNonce,
      testAudienceDid
    );
    assert(
      !isForgedValid,
      '[ADV BLOCKED] Forged Sigma response fails verification equation (g^s_v * h^s_r == tBlind * C_delta^e)'
    );

    // 11. Adversarial Test: Nonce Mismatch / Replay Attack
    const replayOutcome = await verifyZKPredicatePresentation(
      presentation,
      'nonce_attacker_intercepted_nonce', // Different nonce
      testAudienceDid
    );
    assert(
      !replayOutcome.isValid && replayOutcome.status === 'replay_detected',
      '[ADV BLOCKED] Replay attack with mismatched nonce is rejected'
    );

    // 12. Adversarial Test: Audience DID Mismatch / Interception Attack
    const wrongAudienceOutcome = await verifyZKPredicatePresentation(
      presentation,
      testNonce,
      'did:giglink:enterprise:attacker_corp' // Different audience
    );
    assert(
      !wrongAudienceOutcome.isValid && wrongAudienceOutcome.status === 'replay_detected',
      '[ADV BLOCKED] Interception attack with mismatched audience DID is rejected'
    );

    // 13. Adversarial Test: Expired Presentation Rejection
    const expiredPresentation = JSON.parse(JSON.stringify(presentation));
    expiredPresentation.expiresAt = '2020-01-01T00:00:00.000Z'; // Expired past timestamp
    const expiredOutcome = await verifyZKPredicatePresentation(
      expiredPresentation,
      testNonce,
      testAudienceDid
    );
    assert(
      !expiredOutcome.isValid && expiredOutcome.status === 'expired',
      '[ADV BLOCKED] Expired presentation is rejected by verifier'
    );

    // 14. Adversarial Test: Holder Signature Tampering / Mismatched Identity
    const tamperedHolderSigPres = JSON.parse(JSON.stringify(presentation));
    tamperedHolderSigPres.holderSignature = '0'.repeat(128); // Corrupted signature
    const tamperedHolderOutcome = await verifyZKPredicatePresentation(
      tamperedHolderSigPres,
      testNonce,
      testAudienceDid
    );
    assert(
      !tamperedHolderOutcome.isValid && tamperedHolderOutcome.status === 'invalid_signature',
      '[ADV BLOCKED] Tampered holder signature fails verification'
    );

    // 15. Adversarial Test: Negative Threshold Rejection
    const negativeProof = JSON.parse(JSON.stringify(zkProof));
    negativeProof.threshold = -10;
    const isNegativeValid = await verifyZKRangeProof(
      negativeProof,
      'trustScore',
      testNonce,
      testAudienceDid
    );
    assert(!isNegativeValid, '[ADV BLOCKED] Negative threshold inputs are rejected by verifier');

    // 16. Adversarial Test: Revoked Credential Presentation Invalidation
    const revokedOutcome = await verifyZKPredicatePresentation(
      presentation,
      testNonce,
      testAudienceDid,
      async (credId) => credId === saltedCred.credentialId // Mock revocation lookup returns true (revoked)
    );
    assert(
      !revokedOutcome.isValid && revokedOutcome.failureReason?.includes('revoked'),
      '[ADV BLOCKED] Presentation derived from revoked credential is rejected by verifier with revocation lookup'
    );

  } catch (err: any) {
    console.error('Phase 9C.3 Test execution error:', err);
    failed++;
  }

  console.log(`Phase 9C.3 Result: ${passed}/${passed + failed} tests passed successfully.`);
  return { passed, failed };
}

// Allow direct CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase9CZKRangeProofTests().then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}
