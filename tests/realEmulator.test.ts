import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

const PROJECT_ID = 'giglink-security-test';

let testEnv: RulesTestEnvironment;

async function runRealEmulatorTests() {
  console.log('================================================================');
  console.log('STARTING OFFICIAL FIREBASE EMULATOR FIRESTORE RULES TEST SUITE');
  console.log('================================================================\n');

  const rules = readFileSync('firestore.rules', 'utf8');

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8888,
    },
  });

  let attackPassed = 0;
  let attackTotal = 0;
  let positivePassed = 0;
  let positiveTotal = 0;
  let transitionPassed = 0;
  let transitionTotal = 0;

  // Contexts
  const unauthContext = testEnv.unauthenticatedContext();
  const aliceContext = testEnv.authenticatedContext('user_alice_123');
  const bobContext = testEnv.authenticatedContext('user_bob_456');
  const verifierContext = testEnv.authenticatedContext('verifier_carol_789', {
    role: 'verifier',
  });
  const adminContext = testEnv.authenticatedContext('admin_dave_000', {
    role: 'admin',
  });

  // Seed baseline data using withSecurityRulesDisabled
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    
    // Seed user A
    await setDoc(doc(adminDb, 'users', 'user_alice_123'), {
      uid: 'user_alice_123',
      email: 'alice@example.com',
      displayName: 'Alice Walker',
      activePersona: 'learner',
    });

    // Seed user B
    await setDoc(doc(adminDb, 'users', 'user_bob_456'), {
      uid: 'user_bob_456',
      email: 'bob@example.com',
      displayName: 'Bob Builder',
      activePersona: 'partner',
    });

    // Seed private passport for Alice
    await setDoc(doc(adminDb, 'trustPassports', 'user_alice_123'), {
      id: 'user_alice_123',
      userId: 'user_alice_123',
      headline: 'Frontend Engineer',
      bio: 'Passionate open source builder',
      identityVerified: false,
      isPublic: true,
    });

    // Seed public passport for Alice
    await setDoc(doc(adminDb, 'publicTrustPassports', 'user_alice_123'), {
      userId: 'user_alice_123',
      displayName: 'Alice Walker',
      headline: 'Frontend Engineer',
      bio: 'Passionate open source builder',
      location: 'San Francisco, CA',
      identityVerified: false,
      trustScore: 10,
      trustTier: 'Novice',
    });

    // Seed pending verification
    await setDoc(doc(adminDb, 'verifications', 'verif_123'), {
      verificationId: 'verif_123',
      userId: 'user_alice_123',
      documentType: 'passport',
      maskedNumber: '•••• 1234',
      status: 'pending',
      submittedAt: '2026-08-14T00:00:00Z',
      verifierUid: null,
      reviewedAt: null,
      rejectionReason: null,
    });
  });

  console.log('--- EXECUTING 15 ATTACK SCENARIO TESTS ON REAL EMULATOR ---');

  // Attack Test 1: Normal user attempts to set identityVerified: true on private passport
  attackTotal++;
  try {
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'trustPassports', 'user_alice_123'), {
      identityVerified: true,
    }));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 01] PASS: Normal user setting identityVerified: true DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 01] FAIL:', e.message);
  }

  // Attack Test 2: Normal user attempts to increase trustScore on public passport
  attackTotal++;
  try {
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'publicTrustPassports', 'user_alice_123'), {
      trustScore: 99,
    }));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 02] PASS: Normal user increasing trustScore DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 02] FAIL:', e.message);
  }

  // Attack Test 3: Normal user attempts to change trustTier on public passport
  attackTotal++;
  try {
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'publicTrustPassports', 'user_alice_123'), {
      trustTier: 'Master',
    }));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 03] PASS: Normal user changing trustTier DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 03] FAIL:', e.message);
  }

  // Attack Test 4: Normal user attempts to set verifierUid upon verification submission
  attackTotal++;
  try {
    const db = aliceContext.firestore();
    await assertFails(setDoc(doc(db, 'verifications', 'verif_attack_4'), {
      userId: 'user_alice_123',
      documentType: 'passport',
      maskedNumber: '•••• 5678',
      status: 'pending',
      verifierUid: 'user_alice_123',
    }));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 04] PASS: Normal user setting verifierUid upon creation DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 04] FAIL:', e.message);
  }

  // Attack Test 5: Normal user attempts to approve their own verification
  attackTotal++;
  try {
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'verifications', 'verif_123'), {
      status: 'verified',
      verifierUid: 'user_alice_123',
      reviewedAt: new Date().toISOString(),
    }));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 05] PASS: Normal user approving own verification DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 05] FAIL:', e.message);
  }

  // Attack Test 6: Normal user attempts to modify reviewedAt
  attackTotal++;
  try {
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'verifications', 'verif_123'), {
      reviewedAt: '2026-08-14T05:00:00Z',
    }));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 06] PASS: Normal user modifying reviewedAt DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 06] FAIL:', e.message);
  }

  // Attack Test 7: Normal user attempts to modify rejectionReason
  attackTotal++;
  try {
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'verifications', 'verif_123'), {
      rejectionReason: 'Invalid reason injection',
    }));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 07] PASS: Normal user modifying rejectionReason DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 07] FAIL:', e.message);
  }

  // Attack Test 8: Normal user Bob attempts to read Alice\'s private trustPassports/{uid}
  attackTotal++;
  try {
    const db = bobContext.firestore();
    await assertFails(getDoc(doc(db, 'trustPassports', 'user_alice_123')));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 08] PASS: User reading other user private passport DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 08] FAIL:', e.message);
  }

  // Attack Test 9: Normal user Bob attempts to read Alice\'s verification record
  attackTotal++;
  try {
    const db = bobContext.firestore();
    await assertFails(getDoc(doc(db, 'verifications', 'verif_123')));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 09] PASS: User reading other user verification DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 09] FAIL:', e.message);
  }

  // Attack Test 10: Unauthenticated visitor attempts to read private passport data
  attackTotal++;
  try {
    const db = unauthContext.firestore();
    await assertFails(getDoc(doc(db, 'trustPassports', 'user_alice_123')));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 10] PASS: Unauthenticated reading private passport DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 10] FAIL:', e.message);
  }

  // Attack Test 11: Public visitor can read only sanitized publicTrustPassports/{uid}
  attackTotal++;
  try {
    const db = unauthContext.firestore();
    await assertSucceeds(getDoc(doc(db, 'publicTrustPassports', 'user_alice_123')));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 11] PASS: Public visitor reading sanitized passport ALLOWED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 11] FAIL:', e.message);
  }

  // Attack Test 12: Public visitor cannot list/enumerate entire public passport collection
  attackTotal++;
  try {
    const db = unauthContext.firestore();
    await assertFails(getDocs(collection(db, 'publicTrustPassports')));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 12] PASS: Public visitor collection listing DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 12] FAIL:', e.message);
  }

  // Attack Test 13: User attempts to manipulate public passport authoritative fields
  attackTotal++;
  try {
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'publicTrustPassports', 'user_alice_123'), {
      identityVerified: true,
      trustScore: 100,
    }));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 13] PASS: User mutating public authoritative fields DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 13] FAIL:', e.message);
  }

  // Attack Test 14: User makes passport private and deletes public projection
  attackTotal++;
  try {
    const db = aliceContext.firestore();
    await assertSucceeds(deleteDoc(doc(db, 'publicTrustPassports', 'user_alice_123')));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 14] PASS: Owner deleting public projection ALLOWED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 14] FAIL:', e.message);
  }

  // Attack Test 15: Re-create public projection and verify user updating allowed fields works
  attackTotal++;
  try {
    const db = aliceContext.firestore();
    await assertSucceeds(setDoc(doc(db, 'publicTrustPassports', 'user_alice_123'), {
      userId: 'user_alice_123',
      displayName: 'Alice Walker',
      headline: 'Frontend Engineer',
      bio: 'Passionate open source builder',
      identityVerified: false,
      trustScore: 0,
      trustTier: 'Unverified',
    }));
    await assertSucceeds(updateDoc(doc(db, 'publicTrustPassports', 'user_alice_123'), {
      headline: 'Senior Cloud Engineer',
      bio: 'Updated bio safely',
    }));
    attackPassed++;
    console.log('✅ [EMULATOR ATTACK 15] PASS: Owner updating only allowed profile fields ALLOWED');
  } catch (e: any) {
    console.error('❌ [EMULATOR ATTACK 15] FAIL:', e.message);
  }

  console.log('\n--- EXECUTING 15 POSITIVE AUTHORIZATION TESTS ON REAL EMULATOR ---');

  // Pos Test 1: Owner can read their own private passport
  positiveTotal++;
  try {
    const db = aliceContext.firestore();
    await assertSucceeds(getDoc(doc(db, 'trustPassports', 'user_alice_123')));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 01] PASS: Owner reading own private passport ALLOWED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 01] FAIL:', e.message);
  }

  // Pos Test 2: Owner can update allowed profile fields on private passport
  positiveTotal++;
  try {
    const db = aliceContext.firestore();
    await assertSucceeds(updateDoc(doc(db, 'trustPassports', 'user_alice_123'), {
      headline: 'Staff Systems Architect',
      bio: 'Leading high throughput infra',
    }));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 02] PASS: Owner updating allowed profile fields ALLOWED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 02] FAIL:', e.message);
  }

  // Pos Test 3: Owner cannot change authoritative trust fields (identityVerified)
  positiveTotal++;
  try {
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'trustPassports', 'user_alice_123'), {
      identityVerified: true,
    }));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 03] PASS: Owner mutating identityVerified DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 03] FAIL:', e.message);
  }

  // Pos Test 4: Owner can submit a pending verification
  positiveTotal++;
  try {
    const db = aliceContext.firestore();
    await assertSucceeds(setDoc(doc(db, 'verifications', 'verif_legit_1'), {
      userId: 'user_alice_123',
      documentType: 'passport',
      maskedNumber: '•••• 9988',
      status: 'pending',
      submittedAt: new Date().toISOString(),
    }));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 04] PASS: Owner submitting pending verification ALLOWED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 04] FAIL:', e.message);
  }

  // Pos Test 5: Owner cannot approve their own verification
  positiveTotal++;
  try {
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'verifications', 'verif_legit_1'), {
      status: 'verified',
      verifierUid: 'user_alice_123',
    }));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 05] PASS: Owner self-approval DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 05] FAIL:', e.message);
  }

  // Pos Test 6: Authorized verifier can approve/reject another user\'s verification
  positiveTotal++;
  try {
    const db = verifierContext.firestore();
    await assertSucceeds(updateDoc(doc(db, 'verifications', 'verif_legit_1'), {
      status: 'verified',
      verifierUid: 'verifier_carol_789',
    }));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 06] PASS: Authorized verifier reviewing verification ALLOWED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 06] FAIL:', e.message);
  }

  // Pos Test 7: Verifier cannot approve their own verification
  positiveTotal++;
  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'verifications', 'verif_carol_self'), {
        userId: 'verifier_carol_789',
        documentType: 'national_id',
        maskedNumber: '•••• 7777',
        status: 'pending',
        submittedAt: '2026-08-14T00:00:00Z',
      });
    });
    const db = verifierContext.firestore();
    await assertFails(updateDoc(doc(db, 'verifications', 'verif_carol_self'), {
      status: 'verified',
      verifierUid: 'verifier_carol_789',
    }));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 07] PASS: Verifier self-approval DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 07] FAIL:', e.message);
  }

  // Pos Test 8: Verifier cannot directly change Trust Score or Trust Tier on public passport
  positiveTotal++;
  try {
    const db = verifierContext.firestore();
    await assertFails(updateDoc(doc(db, 'publicTrustPassports', 'user_alice_123'), {
      trustScore: 90,
      trustTier: 'Elite',
    }));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 08] PASS: Verifier mutating Trust Score DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 08] FAIL:', e.message);
  }

  // Pos Test 9: Admin can perform authoritative verification actions
  positiveTotal++;
  try {
    const db = adminContext.firestore();
    await assertSucceeds(updateDoc(doc(db, 'trustPassports', 'user_alice_123'), {
      identityVerified: true,
    }));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 09] PASS: Admin updating identityVerified ALLOWED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 09] FAIL:', e.message);
  }

  // Pos Test 10: Public visitor can read a published sanitized passport
  positiveTotal++;
  try {
    const db = unauthContext.firestore();
    await assertSucceeds(getDoc(doc(db, 'publicTrustPassports', 'user_alice_123')));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 10] PASS: Public visitor reading published passport ALLOWED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 10] FAIL:', e.message);
  }

  // Pos Test 11: Public visitor cannot read the private passport
  positiveTotal++;
  try {
    const db = unauthContext.firestore();
    await assertFails(getDoc(doc(db, 'trustPassports', 'user_alice_123')));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 11] PASS: Public visitor reading private passport DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 11] FAIL:', e.message);
  }

  // Pos Test 12: Public visitor cannot read verification records
  positiveTotal++;
  try {
    const db = unauthContext.firestore();
    await assertFails(getDoc(doc(db, 'verifications', 'verif_legit_1')));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 12] PASS: Public visitor reading verification DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 12] FAIL:', e.message);
  }

  // Pos Test 13: Public collection listing remains denied
  positiveTotal++;
  try {
    const db = unauthContext.firestore();
    await assertFails(getDocs(collection(db, 'publicTrustPassports')));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 13] PASS: Public collection listing DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 13] FAIL:', e.message);
  }

  // Pos Test 14: Owner can remove their public passport
  positiveTotal++;
  try {
    const db = aliceContext.firestore();
    await assertSucceeds(deleteDoc(doc(db, 'publicTrustPassports', 'user_alice_123')));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 14] PASS: Owner deleting public passport ALLOWED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 14] FAIL:', e.message);
  }

  // Pos Test 15: Authoritative Trust Score updates restricted to trusted authority (Admin)
  positiveTotal++;
  try {
    // Restore projection for test 15
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'publicTrustPassports', 'user_alice_123'), {
        userId: 'user_alice_123',
        displayName: 'Alice Walker',
        headline: 'Frontend Engineer',
        identityVerified: false,
        trustScore: 0,
        trustTier: 'Unverified',
      });
    });
    const adminDb = adminContext.firestore();
    await assertSucceeds(updateDoc(doc(adminDb, 'publicTrustPassports', 'user_alice_123'), {
      trustScore: 85,
      trustTier: 'Verified Specialist',
      identityVerified: true,
    }));
    const bobDb = bobContext.firestore();
    await assertFails(updateDoc(doc(bobDb, 'publicTrustPassports', 'user_alice_123'), {
      trustScore: 90,
    }));
    positivePassed++;
    console.log('✅ [EMULATOR POSITIVE 15] PASS: Authoritative score update restricted to Admin ALLOWED');
  } catch (e: any) {
    console.error('❌ [EMULATOR POSITIVE 15] FAIL:', e.message);
  }

  console.log('\n--- EXECUTING ILLEGAL VS LEGAL STATE TRANSITION TESTS ON REAL EMULATOR ---');

  // Transition 1: pending -> verified by normal user (ILLEGAL)
  transitionTotal++;
  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'verifications', 'verif_trans_1'), {
        userId: 'user_alice_123',
        documentType: 'passport',
        maskedNumber: '•••• 1111',
        status: 'pending',
        submittedAt: '2026-08-14T00:00:00Z',
      });
    });
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'verifications', 'verif_trans_1'), {
      status: 'verified',
      verifierUid: 'user_alice_123',
    }));
    transitionPassed++;
    console.log('✅ [EMULATOR TRANSITION 01] PASS: pending -> verified by normal user DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR TRANSITION 01] FAIL:', e.message);
  }

  // Transition 2: pending -> rejected by normal user (ILLEGAL)
  transitionTotal++;
  try {
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'verifications', 'verif_trans_1'), {
      status: 'rejected',
      rejectionReason: 'Self rejection',
    }));
    transitionPassed++;
    console.log('✅ [EMULATOR TRANSITION 02] PASS: pending -> rejected by normal user DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR TRANSITION 02] FAIL:', e.message);
  }

  // Transition 3: verified -> pending by normal user (ILLEGAL)
  transitionTotal++;
  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'verifications', 'verif_trans_3'), {
        userId: 'user_alice_123',
        documentType: 'passport',
        maskedNumber: '•••• 3333',
        status: 'verified',
        verifierUid: 'verifier_carol_789',
        submittedAt: '2026-08-14T00:00:00Z',
      });
    });
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'verifications', 'verif_trans_3'), {
      status: 'pending',
    }));
    transitionPassed++;
    console.log('✅ [EMULATOR TRANSITION 03] PASS: verified -> pending by normal user DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR TRANSITION 03] FAIL:', e.message);
  }

  // Transition 4: verified -> rejected by normal user (ILLEGAL)
  transitionTotal++;
  try {
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'verifications', 'verif_trans_3'), {
      status: 'rejected',
    }));
    transitionPassed++;
    console.log('✅ [EMULATOR TRANSITION 04] PASS: verified -> rejected by normal user DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR TRANSITION 04] FAIL:', e.message);
  }

  // Transition 5: rejected -> verified by normal user (ILLEGAL)
  transitionTotal++;
  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'verifications', 'verif_trans_5'), {
        userId: 'user_alice_123',
        documentType: 'passport',
        maskedNumber: '•••• 5555',
        status: 'rejected',
        verifierUid: 'verifier_carol_789',
        submittedAt: '2026-08-14T00:00:00Z',
      });
    });
    const db = aliceContext.firestore();
    await assertFails(updateDoc(doc(db, 'verifications', 'verif_trans_5'), {
      status: 'verified',
    }));
    transitionPassed++;
    console.log('✅ [EMULATOR TRANSITION 05] PASS: rejected -> verified by normal user DENIED');
  } catch (e: any) {
    console.error('❌ [EMULATOR TRANSITION 05] FAIL:', e.message);
  }

  // Transition 6: pending -> verified by authorized verifier (LEGAL)
  transitionTotal++;
  try {
    const db = verifierContext.firestore();
    await assertSucceeds(updateDoc(doc(db, 'verifications', 'verif_trans_1'), {
      status: 'verified',
      verifierUid: 'verifier_carol_789',
    }));
    transitionPassed++;
    console.log('✅ [EMULATOR TRANSITION 06] PASS: pending -> verified by verifier ALLOWED');
  } catch (e: any) {
    console.error('❌ [EMULATOR TRANSITION 06] FAIL:', e.message);
  }

  // Transition 7: pending -> rejected by authorized verifier (LEGAL)
  transitionTotal++;
  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'verifications', 'verif_trans_7'), {
        userId: 'user_alice_123',
        documentType: 'passport',
        maskedNumber: '•••• 7777',
        status: 'pending',
        submittedAt: '2026-08-14T00:00:00Z',
      });
    });
    const db = verifierContext.firestore();
    await assertSucceeds(updateDoc(doc(db, 'verifications', 'verif_trans_7'), {
      status: 'rejected',
      verifierUid: 'verifier_carol_789',
      rejectionReason: 'Blurry document image',
    }));
    transitionPassed++;
    console.log('✅ [EMULATOR TRANSITION 07] PASS: pending -> rejected by verifier ALLOWED');
  } catch (e: any) {
    console.error('❌ [EMULATOR TRANSITION 07] FAIL:', e.message);
  }

  await testEnv.cleanup();

  console.log('\n================================================================');
  console.log('FINAL REAL FIREBASE EMULATOR VALIDATION SUMMARY:');
  console.log(`- Attack Scenarios: ${attackPassed}/${attackTotal} Passed`);
  console.log(`- Positive Authorization Scenarios: ${positivePassed}/${positiveTotal} Passed`);
  console.log(`- State Transition Scenarios: ${transitionPassed}/${transitionTotal} Passed`);
  console.log(`- Total Tests: ${attackPassed + positivePassed + transitionPassed}/${attackTotal + positiveTotal + transitionTotal} Passed`);
  console.log('================================================================\n');

  if (
    attackPassed !== attackTotal ||
    positivePassed !== positiveTotal ||
    transitionPassed !== transitionTotal
  ) {
    process.exit(1);
  }
}

runRealEmulatorTests().catch((err) => {
  console.error('Emulator suite error:', err);
  process.exit(1);
});
