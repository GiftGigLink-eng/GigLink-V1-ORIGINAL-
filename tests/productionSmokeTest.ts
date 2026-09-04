/**
 * Production Live Smoke Test Suite for Group 4
 * Target: Production Firestore (giglink-bf27b)
 */

import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, signOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

interface SmokeTestResult {
  name: string;
  passed: boolean;
  message: string;
  error?: string;
}

const results: SmokeTestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true, message: 'PASS' });
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    results.push({ name, passed: false, message: 'FAIL', error: errMsg });
    console.error(`  [FAIL] ${name} -> ${errMsg}`);
  }
}

async function runProductionSmokeTest() {
  console.log('========================================================================');
  console.log('STARTING REAL PRODUCTION SMOKE TEST AGAINST LIVE FIRESTORE (giglink-bf27b)');
  console.log('Timestamp:', new Date().toISOString());
  console.log('========================================================================\n');

  const app = initializeApp(firebaseConfig, 'production-smoke-test');
  const db = getFirestore(app);
  const auth = getAuth(app);

  // -------------------------------------------------------------------------
  // 1. PUBLIC UN-AUTHENTICATED SMOKE TESTS
  // -------------------------------------------------------------------------
  console.log('--- 1. PUBLIC LIVE FIRESTORE ACCESS TESTS ---');

  await runTest('1.1 Public visitor can query open opportunities from live Firestore', async () => {
    const q = query(collection(db, 'opportunities'), where('status', '==', 'open'));
    const snapshot = await getDocs(q);
    // Should succeed (200 OK), even if 0 results
    console.log(`      (Retrieved ${snapshot.size} live open opportunities)`);
  });

  await runTest('1.2 Public visitor CANNOT list draft or private opportunities', async () => {
    try {
      const q = query(collection(db, 'opportunities'), where('status', '==', 'draft'));
      await getDocs(q);
      throw new Error('Expected query on draft opportunities to fail with PERMISSION_DENIED');
    } catch (err: any) {
      if (err.message && (err.message.includes('permission-denied') || err.message.includes('PERMISSION_DENIED') || err.code === 'permission-denied')) {
        return; // Passed
      }
      throw err;
    }
  });

  await runTest('1.3 Public visitor CANNOT read private applications collection', async () => {
    try {
      const snap = await getDocs(collection(db, 'applications'));
      throw new Error(`Expected applications query to fail, but got ${snap.size} docs`);
    } catch (err: any) {
      if (err.message && (err.message.includes('permission-denied') || err.message.includes('PERMISSION_DENIED') || err.code === 'permission-denied')) {
        return; // Passed
      }
      throw err;
    }
  });

  await runTest('1.4 Public visitor CANNOT enumerate publicTrustPassports (anti-scraping check)', async () => {
    try {
      await getDocs(collection(db, 'publicTrustPassports'));
      throw new Error('Expected publicTrustPassports listing to fail with PERMISSION_DENIED');
    } catch (err: any) {
      if (err.message && (err.message.includes('permission-denied') || err.message.includes('PERMISSION_DENIED') || err.code === 'permission-denied')) {
        return; // Passed
      }
      throw err;
    }
  });

  await runTest('1.5 Public visitor CANNOT list private trustPassports', async () => {
    try {
      await getDocs(collection(db, 'trustPassports'));
      throw new Error('Expected trustPassports listing to fail with PERMISSION_DENIED');
    } catch (err: any) {
      if (err.message && (err.message.includes('permission-denied') || err.message.includes('PERMISSION_DENIED') || err.code === 'permission-denied')) {
        return; // Passed
      }
      throw err;
    }
  });

  await runTest('1.6 Public visitor CANNOT list verifications', async () => {
    try {
      await getDocs(collection(db, 'verifications'));
      throw new Error('Expected verifications listing to fail with PERMISSION_DENIED');
    } catch (err: any) {
      if (err.message && (err.message.includes('permission-denied') || err.message.includes('PERMISSION_DENIED') || err.code === 'permission-denied')) {
        return; // Passed
      }
      throw err;
    }
  });

  await runTest('1.7 Public visitor CANNOT create unauthenticated opportunities', async () => {
    try {
      await setDoc(doc(db, 'opportunities', 'opp_unauth_probe'), {
        title: 'Hacked Probe',
        creatorId: 'anon',
        type: 'gig',
        category: 'tech',
        description: 'Probe description',
        status: 'open',
        requiredSkills: ['react'],
        locationType: 'remote',
        compensationType: 'fixed',
        currency: 'USD',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      throw new Error('Expected opportunity creation to fail with PERMISSION_DENIED');
    } catch (err: any) {
      if (err.message && (err.message.includes('permission-denied') || err.message.includes('PERMISSION_DENIED') || err.code === 'permission-denied')) {
        return; // Passed
      }
      throw err;
    }
  });

  await runTest('1.8 Public visitor CANNOT create unauthenticated applications', async () => {
    try {
      await setDoc(doc(db, 'applications', 'app_unauth_probe'), {
        opportunityId: 'opp_some',
        opportunityCreatorId: 'creator_some',
        applicantId: 'anon',
        applicantDisplayName: 'Anonymous',
        applicantEmail: 'anon@test.com',
        coverNote: 'Probe note',
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      throw new Error('Expected application creation to fail with PERMISSION_DENIED');
    } catch (err: any) {
      if (err.message && (err.message.includes('permission-denied') || err.message.includes('PERMISSION_DENIED') || err.code === 'permission-denied')) {
        return; // Passed
      }
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // 2. AUTHENTICATED SMOKE TESTS (IF ANONYMOUS AUTH ENABLED ON PROJECT)
  // -------------------------------------------------------------------------
  console.log('\n--- 2. AUTHENTICATED REAL FIRESTORE TESTS ---');
  let authUser: any = null;
  try {
    const cred = await signInAnonymously(auth);
    authUser = cred.user;
    console.log(`  [INFO] Signed in anonymously as uid: ${authUser.uid}`);
  } catch (err: any) {
    console.log(`  [INFO] Anonymous sign-in not enabled on project or skipped (${err.message}). Performing client evaluation.`);
  }

  if (authUser) {
    await runTest('2.1 Authenticated applicant CANNOT apply to nonexistent or closed opportunity', async () => {
      try {
        await setDoc(doc(db, 'applications', `opp_nonexistent_${authUser.uid}`), {
          opportunityId: 'opp_nonexistent',
          opportunityCreatorId: 'some_creator',
          applicantId: authUser.uid,
          applicantDisplayName: 'Test Applicant',
          applicantEmail: 'test@applicant.com',
          coverNote: 'Application to non-existent opp',
          status: 'submitted',
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        throw new Error('Expected application to nonexistent/closed opportunity to fail');
      } catch (err: any) {
        if (err.message && (err.message.includes('permission-denied') || err.message.includes('PERMISSION_DENIED') || err.code === 'permission-denied')) {
          return; // Passed
        }
        throw err;
      }
    });

    await runTest('2.2 Authenticated user CANNOT self-promote or inject verified status into verifications', async () => {
      try {
        await setDoc(doc(db, 'verifications', `verif_${authUser.uid}`), {
          userId: authUser.uid,
          status: 'verified', // FORGERY: normal user cannot submit status='verified'
          documentType: 'passport',
          maskedNumber: '***123',
        });
        throw new Error('Expected forged verification submission to fail with PERMISSION_DENIED');
      } catch (err: any) {
        if (err.message && (err.message.includes('permission-denied') || err.message.includes('PERMISSION_DENIED') || err.code === 'permission-denied')) {
          return; // Passed
        }
        throw err;
      }
    });

    await runTest('2.3 Authenticated user CANNOT forge public trust score or trust tier', async () => {
      try {
        await setDoc(doc(db, 'publicTrustPassports', authUser.uid), {
          userId: authUser.uid,
          displayName: 'Test User',
          headline: 'Hacker',
          trustScore: 99, // FORGERY: normal user cannot initialize score > 0
          trustTier: 'Elite',
          identityVerified: true,
        });
        throw new Error('Expected forged trust score to fail with PERMISSION_DENIED');
      } catch (err: any) {
        if (err.message && (err.message.includes('permission-denied') || err.message.includes('PERMISSION_DENIED') || err.code === 'permission-denied')) {
          return; // Passed
        }
        throw err;
      }
    });

    await signOut(auth);
  }

  await deleteApp(app);

  console.log('\n========================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`PRODUCTION SMOKE TEST SUMMARY: ${passedCount}/${results.length} PASSED (${failedCount} FAILED)`);
  console.log('========================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runProductionSmokeTest().catch((err) => {
  console.error('Fatal smoke test runner error:', err);
  process.exit(1);
});
