import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where } from 'firebase/firestore';

const PROJECT_ID = 'giglink-group4-test';

let testEnv: RulesTestEnvironment;

async function runGroup4SecurityTests() {
  console.log('================================================================');
  console.log('STARTING FIRESTORE SECURITY RULES TEST SUITE - GROUP 4 & REGRESSION');
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

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  const runTest = async (name: string, fn: () => Promise<void>) => {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`  [PASS] ${name}`);
    } catch (err: any) {
      failedTests++;
      console.error(`  [FAIL] ${name}`);
      console.error(`         Error: ${err.message}`);
    }
  };

  // Auth Contexts
  const unauthContext = testEnv.unauthenticatedContext();
  const aliceContext = testEnv.authenticatedContext('user_alice_123'); // Learner / Applicant
  const bobContext = testEnv.authenticatedContext('user_bob_456'); // Client / Creator
  const charlieContext = testEnv.authenticatedContext('user_charlie_789'); // Third-party / Org Admin
  const eveContext = testEnv.authenticatedContext('user_eve_999'); // Attacker
  const adminContext = testEnv.authenticatedContext('admin_dave_000', { role: 'admin' });

  // Baseline Seeding
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    // 1. Seed Organization with Charlie as admin
    await setDoc(doc(adminDb, 'organizations', 'org_acme_corp'), {
      id: 'org_acme_corp',
      name: 'Acme Corporation',
      adminUserIds: ['user_charlie_789'],
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });

    // 2. Seed Opportunities
    // Open Opp created by Bob
    await setDoc(doc(adminDb, 'opportunities', 'opp_open_1'), {
      id: 'opp_open_1',
      title: 'Fullstack React Developer',
      creatorId: 'user_bob_456',
      type: 'gig',
      category: 'engineering',
      description: 'Build a production web application with React & TypeScript.',
      status: 'open',
      requiredSkills: ['React', 'TypeScript'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });

    // Draft Opp created by Bob
    await setDoc(doc(adminDb, 'opportunities', 'opp_draft_1'), {
      id: 'opp_draft_1',
      title: 'Confidential Internal Bounty',
      creatorId: 'user_bob_456',
      type: 'bounty',
      category: 'security',
      description: 'Confidential security assessment in draft mode.',
      status: 'draft',
      requiredSkills: ['Auditing'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });

    // Closed Opp created by Bob
    await setDoc(doc(adminDb, 'opportunities', 'opp_closed_1'), {
      id: 'opp_closed_1',
      title: 'Past Design Project',
      creatorId: 'user_bob_456',
      type: 'contract',
      category: 'design',
      description: 'Completed contract work.',
      status: 'closed',
      requiredSkills: ['Figma'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });

    // Organization Opp created by Charlie for Acme Corp
    await setDoc(doc(adminDb, 'opportunities', 'opp_org_1'), {
      id: 'opp_org_1',
      title: 'Acme Senior Cloud Architect',
      creatorId: 'user_charlie_789',
      organizationId: 'org_acme_corp',
      type: 'contract',
      category: 'engineering',
      description: 'Architecting scalable cloud infrastructure.',
      status: 'open',
      requiredSkills: ['GCP', 'Kubernetes'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });

    // 3. Seed Public Trust Passport for Alice (Group 3 Baseline)
    await setDoc(doc(adminDb, 'publicTrustPassports', 'user_alice_123'), {
      id: 'user_alice_123',
      userId: 'user_alice_123',
      displayName: 'Alice Walker',
      trustTier: 'Basic Verified',
      trustScore: 75,
      identityVerified: true,
      publishedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });
  });

  console.log('--- SECTION 1: OPPORTUNITY DISCOVERY & QUERY SECURITY ---');

  await runTest('1.1 Public visitor can query open opportunities', async () => {
    const db = unauthContext.firestore();
    const q = query(collection(db, 'opportunities'), where('status', '==', 'open'));
    await assertSucceeds(getDocs(q));
  });

  await runTest('1.2 Public visitor CANNOT read draft opportunity directly', async () => {
    const db = unauthContext.firestore();
    await assertFails(getDoc(doc(db, 'opportunities', 'opp_draft_1')));
  });

  await runTest('1.3 Attacker Eve CANNOT read Bob draft opportunity', async () => {
    const db = eveContext.firestore();
    await assertFails(getDoc(doc(db, 'opportunities', 'opp_draft_1')));
  });

  await runTest('1.4 Creator Bob CAN read his own draft opportunity', async () => {
    const db = bobContext.firestore();
    await assertSucceeds(getDoc(doc(db, 'opportunities', 'opp_draft_1')));
  });

  console.log('\n--- SECTION 2: OPPORTUNITY CREATION & ORG SPOOFING RESISTANCE ---');

  await runTest('2.1 Creator Bob can create a valid open opportunity', async () => {
    const db = bobContext.firestore();
    const newOpp = {
      id: 'opp_bob_new_1',
      title: 'Mobile App Developer',
      creatorId: 'user_bob_456',
      type: 'gig',
      category: 'engineering',
      description: 'Build native iOS and Android application with React Native.',
      status: 'open',
      requiredSkills: ['React Native'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    await assertSucceeds(setDoc(doc(db, 'opportunities', 'opp_bob_new_1'), newOpp));
  });

  await runTest('2.2 Attacker Eve CANNOT forge Bob as creatorId', async () => {
    const db = eveContext.firestore();
    const spoofedOpp = {
      id: 'opp_eve_spoof_1',
      title: 'Spoofed Bounty',
      creatorId: 'user_bob_456', // Spoofing Bob!
      type: 'bounty',
      category: 'security',
      description: 'Attacker trying to post on behalf of Bob.',
      status: 'open',
      requiredSkills: ['Testing'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    await assertFails(setDoc(doc(db, 'opportunities', 'opp_eve_spoof_1'), spoofedOpp));
  });

  await runTest('2.3 Org Admin Charlie CAN create opportunity for Acme Corp', async () => {
    const db = charlieContext.firestore();
    const orgOpp = {
      id: 'opp_acme_valid_1',
      title: 'Lead DevOps Engineer',
      creatorId: 'user_charlie_789',
      organizationId: 'org_acme_corp',
      type: 'contract',
      category: 'engineering',
      description: 'Lead enterprise Kubernetes deployments.',
      status: 'open',
      requiredSkills: ['Kubernetes'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    await assertSucceeds(setDoc(doc(db, 'opportunities', 'opp_acme_valid_1'), orgOpp));
  });

  await runTest('2.4 Attacker Eve CANNOT spoof Acme Corp as organizationId', async () => {
    const db = eveContext.firestore();
    const spoofedOrgOpp = {
      id: 'opp_eve_spoof_org',
      title: 'Fake Acme Listing',
      creatorId: 'user_eve_999',
      organizationId: 'org_acme_corp', // Eve is NOT an admin of Acme!
      type: 'contract',
      category: 'engineering',
      description: 'Attacker attempting to attach to Acme Corp.',
      status: 'open',
      requiredSkills: ['Testing'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    await assertFails(setDoc(doc(db, 'opportunities', 'opp_eve_spoof_org'), spoofedOrgOpp));
  });

  console.log('\n--- SECTION 3: APPLICATION CREATION & DETERMINISTIC ID ENFORCEMENT ---');

  await runTest('3.1 Alice can apply to open opportunity with deterministic ID opp_open_1_user_alice_123', async () => {
    const db = aliceContext.firestore();
    const validApp = {
      id: 'opp_open_1_user_alice_123',
      opportunityId: 'opp_open_1',
      opportunityCreatorId: 'user_bob_456',
      applicantId: 'user_alice_123',
      applicantDisplayName: 'Alice Walker',
      applicantEmail: 'alice@example.com',
      coverNote: 'I have 4 years of React and TypeScript experience.',
      status: 'submitted',
      submittedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    await assertSucceeds(setDoc(doc(db, 'applications', 'opp_open_1_user_alice_123'), validApp));
  });

  await runTest('3.2 Non-deterministic application ID (e.g. random_app_id) is REJECTED', async () => {
    const db = aliceContext.firestore();
    const invalidIdApp = {
      id: 'random_app_id_999',
      opportunityId: 'opp_open_1',
      opportunityCreatorId: 'user_bob_456',
      applicantId: 'user_alice_123',
      applicantDisplayName: 'Alice Walker',
      applicantEmail: 'alice@example.com',
      coverNote: 'Testing non deterministic id rejection.',
      status: 'submitted',
      submittedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    await assertFails(setDoc(doc(db, 'applications', 'random_app_id_999'), invalidIdApp));
  });

  await runTest('3.3 Applying to a CLOSED opportunity is REJECTED', async () => {
    const db = aliceContext.firestore();
    const closedApp = {
      id: 'opp_closed_1_user_alice_123',
      opportunityId: 'opp_closed_1',
      opportunityCreatorId: 'user_bob_456',
      applicantId: 'user_alice_123',
      applicantDisplayName: 'Alice Walker',
      applicantEmail: 'alice@example.com',
      coverNote: 'Attempting to apply to closed listing.',
      status: 'submitted',
      submittedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    await assertFails(setDoc(doc(db, 'applications', 'opp_closed_1_user_alice_123'), closedApp));
  });

  await runTest('3.4 Applying to a DRAFT opportunity is REJECTED', async () => {
    const db = aliceContext.firestore();
    const draftApp = {
      id: 'opp_draft_1_user_alice_123',
      opportunityId: 'opp_draft_1',
      opportunityCreatorId: 'user_bob_456',
      applicantId: 'user_alice_123',
      applicantDisplayName: 'Alice Walker',
      applicantEmail: 'alice@example.com',
      coverNote: 'Attempting to apply to draft listing.',
      status: 'submitted',
      submittedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    await assertFails(setDoc(doc(db, 'applications', 'opp_draft_1_user_alice_123'), draftApp));
  });

  await runTest('3.5 Applicant CANNOT inject self-shortlist/accept during creation', async () => {
    const db = eveContext.firestore();
    const selfAcceptedApp = {
      id: 'opp_open_1_user_eve_999',
      opportunityId: 'opp_open_1',
      opportunityCreatorId: 'user_bob_456',
      applicantId: 'user_eve_999',
      applicantDisplayName: 'Eve Hacker',
      applicantEmail: 'eve@example.com',
      coverNote: 'Injecting accepted status directly.',
      status: 'accepted', // ILLEGAL initial status!
      creatorFeedback: 'Great candidate', // ILLEGAL field for applicant!
      submittedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    await assertFails(setDoc(doc(db, 'applications', 'opp_open_1_user_eve_999'), selfAcceptedApp));
  });

  console.log('\n--- SECTION 4: APPLICATION STATE MACHINE & ACCESS CONTROL ---');

  await runTest('4.1 Applicant Alice CAN withdraw her own submitted application', async () => {
    const db = aliceContext.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'applications', 'opp_open_1_user_alice_123'), {
        status: 'withdrawn',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  // Re-seed application to 'submitted' for subsequent testing
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'applications', 'opp_open_1_user_alice_123'), {
      id: 'opp_open_1_user_alice_123',
      opportunityId: 'opp_open_1',
      opportunityCreatorId: 'user_bob_456',
      applicantId: 'user_alice_123',
      applicantDisplayName: 'Alice Walker',
      applicantEmail: 'alice@example.com',
      coverNote: 'I have 4 years of React and TypeScript experience.',
      status: 'submitted',
      submittedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });
  });

  await runTest('4.2 Applicant Alice CANNOT self-advance to shortlisted or accepted', async () => {
    const db = aliceContext.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_1_user_alice_123'), {
        status: 'accepted',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await runTest('4.3 Creator Bob CAN advance Alice application to shortlisted with feedback', async () => {
    const db = bobContext.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'applications', 'opp_open_1_user_alice_123'), {
        status: 'shortlisted',
        creatorFeedback: 'Strong portfolio and clear proposal.',
        reviewedAt: '2026-08-14T01:00:00.000Z',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await runTest('4.4 Creator Bob CANNOT tamper with Alice coverNote during review', async () => {
    const db = bobContext.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_1_user_alice_123'), {
        coverNote: 'Tampered cover note by creator.',
        status: 'accepted',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await runTest('4.5 Third-party Eve CANNOT read Alice private application', async () => {
    const db = eveContext.firestore();
    await assertFails(getDoc(doc(db, 'applications', 'opp_open_1_user_alice_123')));
  });

  console.log('\n--- SECTION 5: GROUP 3 REGRESSION PROTECTION ---');

  await runTest('5.1 Public visitor CAN resolve Alice public trust passport by ID', async () => {
    const db = unauthContext.firestore();
    await assertSucceeds(getDoc(doc(db, 'publicTrustPassports', 'user_alice_123')));
  });

  await runTest('5.2 Public visitor CANNOT scrape/list all public trust passports', async () => {
    const db = unauthContext.firestore();
    await assertFails(getDocs(collection(db, 'publicTrustPassports')));
  });

  await runTest('5.3 Alice CANNOT forge her public trustScore or identityVerified', async () => {
    const db = aliceContext.firestore();
    await assertFails(
      updateDoc(doc(db, 'publicTrustPassports', 'user_alice_123'), {
        trustScore: 100, // Forged score!
        trustTier: 'Gold Verified', // Forged tier!
      })
    );
  });

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runGroup4SecurityTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
