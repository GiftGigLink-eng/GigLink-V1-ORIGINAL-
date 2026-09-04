import { FirestoreRulesSimulator } from './rulesSimulator';

const sim = new FirestoreRulesSimulator('./firestore.rules');

console.log('====================================================');
console.log('EXECUTING STATE MACHINE & DETERMINISTIC TRUST TESTS');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assertTransition(title: string, condition: boolean, expected: boolean) {
  totalTests++;
  const passed = condition === expected;
  if (passed) {
    passedTests++;
    console.log(`✅ [TRANSITION TEST] PASS: ${title}`);
  } else {
    console.error(`❌ [TRANSITION TEST] FAIL: ${title} (Got ${condition}, Expected ${expected})`);
  }
}

const alice = { uid: 'user_alice_123', token: {} };
const bob = { uid: 'user_bob_456', token: {} };
const verifier = { uid: 'verifier_carol_789', token: { role: 'verifier' } };

const basePending = {
  verificationId: 'verif_123',
  userId: 'user_alice_123',
  status: 'pending',
  submittedAt: '2026-08-14T00:00:00Z',
  verifierUid: null,
  reviewedAt: null,
  rejectionReason: null,
};

const baseVerified = {
  verificationId: 'verif_123',
  userId: 'user_alice_123',
  status: 'verified',
  submittedAt: '2026-08-14T00:00:00Z',
  verifierUid: 'verifier_carol_789',
  reviewedAt: '2026-08-14T01:00:00Z',
  rejectionReason: null,
};

const baseRejected = {
  verificationId: 'verif_123',
  userId: 'user_alice_123',
  status: 'rejected',
  submittedAt: '2026-08-14T00:00:00Z',
  verifierUid: 'verifier_carol_789',
  reviewedAt: '2026-08-14T01:00:00Z',
  rejectionReason: 'ID scan unreadable',
};

// 1. "pending → verified" by normal user (Illegal)
const t1 = sim.evalVerificationUpdate(alice, 'verif_123', basePending, {
  ...basePending,
  status: 'verified',
  verifierUid: 'user_alice_123',
  reviewedAt: new Date().toISOString(),
});
assertTransition('Illegal transition: "pending → verified" by applicant', t1, false);

// 2. "pending → rejected" by normal user (Illegal)
const t2 = sim.evalVerificationUpdate(alice, 'verif_123', basePending, {
  ...basePending,
  status: 'rejected',
  rejectionReason: 'Self rejected',
});
assertTransition('Illegal transition: "pending → rejected" by applicant', t2, false);

// 3. "verified → pending" by normal user (Illegal)
const t3 = sim.evalVerificationUpdate(alice, 'verif_123', baseVerified, {
  ...baseVerified,
  status: 'pending',
});
assertTransition('Illegal transition: "verified → pending" by applicant', t3, false);

// 4. "verified → rejected" by normal user (Illegal)
const t4 = sim.evalVerificationUpdate(alice, 'verif_123', baseVerified, {
  ...baseVerified,
  status: 'rejected',
});
assertTransition('Illegal transition: "verified → rejected" by applicant', t4, false);

// 5. "rejected → verified" by normal user (Illegal)
const t5 = sim.evalVerificationUpdate(alice, 'verif_123', baseRejected, {
  ...baseRejected,
  status: 'verified',
});
assertTransition('Illegal transition: "rejected → verified" by applicant', t5, false);

// 6. "pending → verified" by authorized verifier (Legal)
const t6 = sim.evalVerificationUpdate(verifier, 'verif_123', basePending, {
  ...basePending,
  status: 'verified',
  verifierUid: 'verifier_carol_789',
  reviewedAt: new Date().toISOString(),
});
assertTransition('Legal transition: "pending → verified" by authorized verifier', t6, true);

// 7. "pending → rejected" by authorized verifier (Legal)
const t7 = sim.evalVerificationUpdate(verifier, 'verif_123', basePending, {
  ...basePending,
  status: 'rejected',
  verifierUid: 'verifier_carol_789',
  reviewedAt: new Date().toISOString(),
  rejectionReason: 'Expired credential document',
});
assertTransition('Legal transition: "pending → rejected" by authorized verifier', t7, true);

console.log('\n====================================================');
console.log(`STATE TRANSITION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('====================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
