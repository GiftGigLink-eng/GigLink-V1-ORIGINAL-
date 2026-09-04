import { FirestoreRulesSimulator } from './rulesSimulator';

const sim = new FirestoreRulesSimulator('./firestore.rules');

console.log('====================================================');
console.log('EXECUTING 15 FIRESTORE SECURITY ATTACK SCENARIO TESTS');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assertTest(testNumber: number, title: string, condition: boolean, expected: boolean) {
  totalTests++;
  const passed = condition === expected;
  if (passed) {
    passedTests++;
    console.log(`✅ [ATTACK TEST ${testNumber.toString().padStart(2, '0')}] PASS: ${title}`);
  } else {
    console.error(`❌ [ATTACK TEST ${testNumber.toString().padStart(2, '0')}] FAIL: ${title} (Got ${condition}, Expected ${expected})`);
  }
}

// User context fixtures
const userA = { uid: 'user_alice_123', token: {} };
const userB = { uid: 'user_bob_456', token: {} };
const verifierUser = { uid: 'verifier_carol_789', token: { role: 'verifier' } };
const adminUser = { uid: 'admin_dave_000', token: { role: 'admin' } };
const unauth = null;

// Existing passport states
const existingAlicePassport = {
  id: 'user_alice_123',
  userId: 'user_alice_123',
  headline: 'Frontend Engineer',
  bio: 'Passionate builder',
  identityVerified: false,
  location: 'San Francisco, CA',
};

const existingAlicePublicPassport = {
  userId: 'user_alice_123',
  displayName: 'Alice Walker',
  headline: 'Frontend Engineer',
  bio: 'Passionate builder',
  location: 'San Francisco, CA',
  locationVerificationStatus: 'self_declared',
  identityVerified: false,
  trustScore: 10,
  trustTier: 'Novice',
};

const existingAliceVerification = {
  verificationId: 'verif_123',
  userId: 'user_alice_123',
  userDisplayName: 'Alice Walker',
  userEmail: 'alice@example.com',
  documentType: 'passport',
  maskedNumber: '•••• 1234',
  status: 'pending',
  submittedAt: '2026-08-14T00:00:00Z',
  verifierUid: null,
  reviewedAt: null,
  rejectionReason: null,
};

// =========================================================================
// 1. Normal user attempts to set "identityVerified: true" on private passport
// =========================================================================
const attack1Result = sim.evalTrustPassportUpdate(
  userA,
  'user_alice_123',
  existingAlicePassport,
  {
    ...existingAlicePassport,
    identityVerified: true, // Malicious escalation
  }
);
assertTest(1, 'Normal user attempts to set "identityVerified: true" on private passport', attack1Result, false);

// =========================================================================
// 2. Normal user attempts to increase "trustScore" on public passport
// =========================================================================
const attack2Result = sim.evalPublicPassportUpdate(
  userA,
  'user_alice_123',
  existingAlicePublicPassport,
  {
    ...existingAlicePublicPassport,
    trustScore: 95, // Malicious escalation
  }
);
assertTest(2, 'Normal user attempts to increase "trustScore" on public passport', attack2Result, false);

// =========================================================================
// 3. Normal user attempts to change "trustTier" on public passport
// =========================================================================
const attack3Result = sim.evalPublicPassportUpdate(
  userA,
  'user_alice_123',
  existingAlicePublicPassport,
  {
    ...existingAlicePublicPassport,
    trustTier: 'Verified Pro', // Malicious escalation
  }
);
assertTest(3, 'Normal user attempts to change "trustTier" on public passport', attack3Result, false);

// =========================================================================
// 4. Normal user attempts to set "verifierUid" to themselves upon submission
// =========================================================================
const attack4Result = sim.evalVerificationCreate(
  userA,
  'verif_123',
  {
    verificationId: 'verif_123',
    userId: 'user_alice_123',
    status: 'pending',
    verifierUid: 'user_alice_123', // Malicious self-assignment
  }
);
assertTest(4, 'Normal user attempts to set "verifierUid" to themselves upon creation', attack4Result, false);

// =========================================================================
// 5. Normal user attempts to approve their own verification
// =========================================================================
const attack5Result = sim.evalVerificationUpdate(
  userA,
  'verif_123',
  existingAliceVerification,
  {
    ...existingAliceVerification,
    status: 'verified',
    verifierUid: 'user_alice_123',
    reviewedAt: new Date().toISOString(),
  }
);
assertTest(5, 'Normal user attempts to approve their own verification', attack5Result, false);

// =========================================================================
// 6. Normal user attempts to modify "reviewedAt"
// =========================================================================
const attack6Result = sim.evalVerificationUpdate(
  userA,
  'verif_123',
  existingAliceVerification,
  {
    ...existingAliceVerification,
    reviewedAt: '2026-08-14T05:00:00Z', // Malicious modification
  }
);
assertTest(6, 'Normal user attempts to modify "reviewedAt"', attack6Result, false);

// =========================================================================
// 7. Normal user attempts to modify "rejectionReason" as an authoritative field
// =========================================================================
const attack7Result = sim.evalVerificationUpdate(
  userA,
  'verif_123',
  existingAliceVerification,
  {
    ...existingAliceVerification,
    rejectionReason: 'Falsified review note',
  }
);
assertTest(7, 'Normal user attempts to modify "rejectionReason"', attack7Result, false);

// =========================================================================
// 8. Normal user attempts to read another user\'s private "trustPassports/{uid}"
// =========================================================================
const attack8Result = sim.evalTrustPassportGet(
  userB, // Bob attempts to read Alice's private passport
  'user_alice_123'
);
assertTest(8, 'Normal user attempts to read another user\'s private "trustPassports/{uid}"', attack8Result, false);

// =========================================================================
// 9. Normal user attempts to read another user\'s verification record
// =========================================================================
const attack9Result = sim.evalVerificationGet(
  userB, // Bob attempts to read Alice's verification
  existingAliceVerification
);
assertTest(9, 'Normal user attempts to read another user\'s verification record', attack9Result, false);

// =========================================================================
// 10. Unauthenticated visitor attempts to read private passport data
// =========================================================================
const attack10Result = sim.evalTrustPassportGet(
  unauth,
  'user_alice_123'
);
assertTest(10, 'Unauthenticated visitor attempts to read private passport data', attack10Result, false);

// =========================================================================
// 11. Public visitor can read only the sanitized "publicTrustPassports/{uid}"
// =========================================================================
const attack11Result = sim.evalPublicPassportGet(
  unauth,
  'user_alice_123'
);
assertTest(11, 'Public visitor can read sanitized "publicTrustPassports/{uid}"', attack11Result, true);

// =========================================================================
// 12. Public visitor cannot list/enumerate the entire public passport collection
// =========================================================================
const attack12Result = sim.evalPublicPassportList(unauth);
assertTest(12, 'Public visitor cannot list/enumerate entire public passport collection', attack12Result, false);

// =========================================================================
// 13. User attempts to manipulate public passport\'s authoritative fields
// =========================================================================
const attack13Result = sim.evalPublicPassportUpdate(
  userA,
  'user_alice_123',
  existingAlicePublicPassport,
  {
    ...existingAlicePublicPassport,
    identityVerified: true, // Malicious attempt to self-certify
    trustScore: 80,
  }
);
assertTest(13, 'User attempts to manipulate public passport\'s authoritative fields', attack13Result, false);

// =========================================================================
// 14. User makes their passport private and public projection is deleted
// =========================================================================
const attack14Result = sim.evalPublicPassportDelete(
  userA,
  'user_alice_123'
);
assertTest(14, 'Owner can delete public projection when toggling to private', attack14Result, true);

// =========================================================================
// 15. User updates only approved sanitized user-controlled fields (headline, bio)
// =========================================================================
const attack15Result = sim.evalPublicPassportUpdate(
  userA,
  'user_alice_123',
  existingAlicePublicPassport,
  {
    ...existingAlicePublicPassport,
    headline: 'Senior Full Stack & AI Engineer', // Valid user-controlled edit
    bio: 'Updated bio information without touching authoritative metrics.',
  }
);
assertTest(15, 'User can update approved user-controlled fields while authoritative metrics remain immutable', attack15Result, true);

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} SECURITY TESTS PASSED`);
console.log('====================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
