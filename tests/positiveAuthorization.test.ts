import { FirestoreRulesSimulator } from './rulesSimulator';

const sim = new FirestoreRulesSimulator('./firestore.rules');

console.log('====================================================');
console.log('EXECUTING 15 POSITIVE AUTHORIZATION & STATE TESTS');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assertPosTest(testNumber: number, title: string, condition: boolean, expected: boolean) {
  totalTests++;
  const passed = condition === expected;
  if (passed) {
    passedTests++;
    console.log(`✅ [POSITIVE TEST ${testNumber.toString().padStart(2, '0')}] PASS: ${title}`);
  } else {
    console.error(`❌ [POSITIVE TEST ${testNumber.toString().padStart(2, '0')}] FAIL: ${title} (Got ${condition}, Expected ${expected})`);
  }
}

// User context fixtures
const alice = { uid: 'user_alice_123', token: {} };
const bob = { uid: 'user_bob_456', token: {} };
const verifier = { uid: 'verifier_carol_789', token: { role: 'verifier' } };
const admin = { uid: 'admin_dave_000', token: { role: 'admin' } };
const publicVisitor = null;

// Existing passport states
const alicePassport = {
  id: 'user_alice_123',
  userId: 'user_alice_123',
  headline: 'Full Stack Engineer',
  bio: 'Building open trust networks',
  identityVerified: false,
  location: 'London, UK',
};

const alicePublicPassport = {
  userId: 'user_alice_123',
  displayName: 'Alice Walker',
  headline: 'Full Stack Engineer',
  bio: 'Building open trust networks',
  location: 'London, UK',
  locationVerificationStatus: 'self_declared',
  identityVerified: false,
  trustScore: 0,
  trustTier: 'Unverified',
};

const pendingVerification = {
  verificationId: 'verif_123',
  userId: 'user_alice_123',
  userDisplayName: 'Alice Walker',
  userEmail: 'alice@example.com',
  documentType: 'passport',
  maskedNumber: '•••• 8899',
  status: 'pending',
  submittedAt: '2026-08-14T00:00:00Z',
  verifierUid: null,
  reviewedAt: null,
  rejectionReason: null,
};

// 1. Owner can read their own private passport
const test1 = sim.evalTrustPassportGet(alice, 'user_alice_123');
assertPosTest(1, 'Owner can read their own private passport', test1, true);

// 2. Owner can update allowed profile fields (headline, bio)
const test2 = sim.evalTrustPassportUpdate(alice, 'user_alice_123', alicePassport, {
  ...alicePassport,
  headline: 'Lead Cloud Architect',
  bio: 'Specializing in secure distributed systems',
});
assertPosTest(2, 'Owner can update allowed profile fields', test2, true);

// 3. Owner cannot change authoritative trust fields (identityVerified)
const test3 = sim.evalTrustPassportUpdate(alice, 'user_alice_123', alicePassport, {
  ...alicePassport,
  identityVerified: true,
});
assertPosTest(3, 'Owner cannot change authoritative trust fields', test3, false);

// 4. Owner can submit a pending verification
const test4 = sim.evalVerificationCreate(alice, 'verif_123', {
  verificationId: 'verif_123',
  userId: 'user_alice_123',
  userDisplayName: 'Alice Walker',
  userEmail: 'alice@example.com',
  documentType: 'national_id',
  maskedNumber: '•••• 4321',
  status: 'pending',
  submittedAt: new Date().toISOString(),
});
assertPosTest(4, 'Owner can submit a pending verification', test4, true);

// 5. Owner cannot approve their own verification
const test5 = sim.evalVerificationUpdate(alice, 'verif_123', pendingVerification, {
  ...pendingVerification,
  status: 'verified',
  verifierUid: 'user_alice_123',
  reviewedAt: new Date().toISOString(),
});
assertPosTest(5, 'Owner cannot approve their own verification', test5, false);

// 6. Authorized verifier can approve/reject another user\'s verification
const test6 = sim.evalVerificationUpdate(verifier, 'verif_123', pendingVerification, {
  ...pendingVerification,
  status: 'verified',
  verifierUid: 'verifier_carol_789',
  reviewedAt: new Date().toISOString(),
});
assertPosTest(6, 'Authorized verifier can approve another user\'s verification', test6, true);

// 7. Verifier cannot approve their own verification
const verifierSelfVerification = {
  verificationId: 'verif_self',
  userId: 'verifier_carol_789',
  documentType: 'passport',
  maskedNumber: '•••• 9999',
  status: 'pending',
  submittedAt: '2026-08-14T00:00:00Z',
  verifierUid: null,
  reviewedAt: null,
};
const test7 = sim.evalVerificationUpdate(verifier, 'verif_self', verifierSelfVerification, {
  ...verifierSelfVerification,
  status: 'verified',
  verifierUid: 'verifier_carol_789',
  reviewedAt: new Date().toISOString(),
});
assertPosTest(7, 'Verifier cannot approve their own verification', test7, false);

// 8. Verifier cannot directly change Trust Score or Trust Tier on public passport
const test8 = sim.evalPublicPassportUpdate(verifier, 'user_alice_123', alicePublicPassport, {
  ...alicePublicPassport,
  trustScore: 90,
  trustTier: 'Top Tier',
});
assertPosTest(8, 'Verifier cannot directly change Trust Score or Trust Tier', test8, false);

// 9. Admin can perform authoritative verification actions and score synchronizations
const test9 = sim.evalTrustPassportUpdate(admin, 'user_alice_123', alicePassport, {
  ...alicePassport,
  identityVerified: true,
});
assertPosTest(9, 'Admin can perform authoritative verification actions', test9, true);

// 10. Public visitor can read a published sanitized passport
const test10 = sim.evalPublicPassportGet(publicVisitor, 'user_alice_123');
assertPosTest(10, 'Public visitor can read a published sanitized passport', test10, true);

// 11. Public visitor cannot read the private passport
const test11 = sim.evalTrustPassportGet(publicVisitor, 'user_alice_123');
assertPosTest(11, 'Public visitor cannot read the private passport', test11, false);

// 12. Public visitor cannot read verification records
const test12 = sim.evalVerificationGet(publicVisitor, pendingVerification);
assertPosTest(12, 'Public visitor cannot read verification records', test12, false);

// 13. Public collection listing remains denied
const test13 = sim.evalPublicPassportList(publicVisitor);
assertPosTest(13, 'Public collection listing remains denied', test13, false);

// 14. Owner can remove their public passport (take down projection)
const test14 = sim.evalPublicPassportDelete(alice, 'user_alice_123');
assertPosTest(14, 'Owner can remove their public passport projection', test14, true);

// 15. Authoritative Trust Score updates are restricted to the intended trusted authority
const test15Admin = sim.evalPublicPassportUpdate(admin, 'user_alice_123', alicePublicPassport, {
  ...alicePublicPassport,
  trustScore: 85,
  trustTier: 'Verified Specialist',
  identityVerified: true,
});
const test15Bob = sim.evalPublicPassportUpdate(bob, 'user_alice_123', alicePublicPassport, {
  ...alicePublicPassport,
  trustScore: 85,
  trustTier: 'Verified Specialist',
  identityVerified: true,
});
assertPosTest(15, 'Authoritative Trust Score updates restricted to trusted authority', test15Admin && !test15Bob, true);

console.log('\n====================================================');
console.log(`POSITIVE TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('====================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
