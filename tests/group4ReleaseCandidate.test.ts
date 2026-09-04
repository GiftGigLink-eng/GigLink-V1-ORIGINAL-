import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where } from 'firebase/firestore';

const PROJECT_ID = 'giglink-rc-audit-test';
let testEnv: RulesTestEnvironment;

async function runReleaseCandidateAudit() {
  console.log('========================================================================');
  console.log('STARTING GROUP 4 RELEASE CANDIDATE SECURITY & ARCHITECTURE AUDIT SUITE');
  console.log('========================================================================\n');

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
  const failedTestDetails: string[] = [];

  const runTest = async (name: string, fn: () => Promise<void>) => {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`  [PASS] ${name}`);
    } catch (err: any) {
      failedTests++;
      const msg = `  [FAIL] ${name} -> ${err.message}`;
      console.error(msg);
      failedTestDetails.push(msg);
    }
  };

  // Auth Contexts
  const unauth = testEnv.unauthenticatedContext();
  const alice = testEnv.authenticatedContext('user_alice_applicant'); // Learner / Applicant 1
  const bob = testEnv.authenticatedContext('user_bob_creator'); // Client / Creator
  const charlie = testEnv.authenticatedContext('user_charlie_org_admin'); // Org Admin
  const david = testEnv.authenticatedContext('user_david_org_member'); // Regular Org Member (non-admin)
  const eve = testEnv.authenticatedContext('user_eve_attacker'); // Attacker / Unrelated user
  const frank = testEnv.authenticatedContext('user_frank_applicant2'); // Applicant 2
  const admin = testEnv.authenticatedContext('platform_admin', { role: 'admin' });

  // Baseline Seeding
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // 1. Organization with Charlie as admin, David as member only
    await setDoc(doc(db, 'organizations', 'org_acme_corp'), {
      id: 'org_acme_corp',
      name: 'Acme Corporation',
      type: 'company',
      description: 'Enterprise partner organization',
      adminUserIds: ['user_charlie_org_admin'],
      memberUserIds: ['user_charlie_org_admin', 'user_david_org_member'],
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });

    // 2. Base Opportunities
    // Open opportunity by Bob
    await setDoc(doc(db, 'opportunities', 'opp_open_bob'), {
      id: 'opp_open_bob',
      title: 'Fullstack React Engineer',
      creatorId: 'user_bob_creator',
      type: 'gig',
      category: 'engineering',
      description: 'Build production web application.',
      status: 'open',
      requiredSkills: ['React', 'TypeScript'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });

    // Draft opportunity by Bob
    await setDoc(doc(db, 'opportunities', 'opp_draft_bob'), {
      id: 'opp_draft_bob',
      title: 'Draft Bounty',
      creatorId: 'user_bob_creator',
      type: 'bounty',
      category: 'security',
      description: 'Internal security draft.',
      status: 'draft',
      requiredSkills: ['Rust'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });

    // In-Progress opportunity by Bob
    await setDoc(doc(db, 'opportunities', 'opp_inprogress_bob'), {
      id: 'opp_inprogress_bob',
      title: 'In Progress App Build',
      creatorId: 'user_bob_creator',
      type: 'contract',
      category: 'engineering',
      description: 'Contract actively underway.',
      status: 'in_progress',
      requiredSkills: ['React'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });

    // Closed opportunity by Bob
    await setDoc(doc(db, 'opportunities', 'opp_closed_bob'), {
      id: 'opp_closed_bob',
      title: 'Closed Design Gig',
      creatorId: 'user_bob_creator',
      type: 'gig',
      category: 'design',
      description: 'Completed design work.',
      status: 'closed',
      requiredSkills: ['Figma'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });

    // Org opportunity created by acme_creator for Acme Corp
    await setDoc(doc(db, 'opportunities', 'opp_org_acme'), {
      id: 'opp_org_acme',
      title: 'Acme Cloud Architect',
      creatorId: 'user_acme_founder',
      organizationId: 'org_acme_corp',
      type: 'contract',
      category: 'cloud',
      description: 'Cloud infrastructure deployment.',
      status: 'open',
      requiredSkills: ['GCP', 'Kubernetes'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });

    // 3. Passports for Group 3 Regression Testing
    await setDoc(doc(db, 'trustPassports', 'user_alice_applicant'), {
      userId: 'user_alice_applicant',
      headline: 'Fullstack Engineer',
      bio: 'Audited profile',
      identityVerified: false,
    });
    await setDoc(doc(db, 'publicTrustPassports', 'user_alice_applicant'), {
      userId: 'user_alice_applicant',
      displayName: 'Alice Applicant',
      headline: 'Fullstack Engineer',
      trustScore: 88,
      trustTier: 'Level 2 Verified',
      identityVerified: true,
    });
  });

  // =========================================================================
  console.log('\n--- 1. FULL APPLICATION STATE-MACHINE AUDIT ---');
  // =========================================================================

  // Setup seed application for state machine tests
  const seedApp = async (status: string) => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        id: 'opp_open_bob_user_alice_applicant',
        opportunityId: 'opp_open_bob',
        opportunityCreatorId: 'user_bob_creator',
        applicantId: 'user_alice_applicant',
        applicantDisplayName: 'Alice Applicant',
        applicantEmail: 'alice@test.com',
        coverNote: 'Initial pitch for state machine test.',
        status: status,
        submittedAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
      });
    });
  };

  // Legal transitions
  await seedApp('submitted');
  await runTest('1.1 Legal: submitted -> under_review (by creator)', async () => {
    const db = bob.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'under_review',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await seedApp('submitted');
  await runTest('1.2 Legal: submitted -> withdrawn (by applicant)', async () => {
    const db = alice.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'withdrawn',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await seedApp('under_review');
  await runTest('1.3 Legal: under_review -> shortlisted (by creator)', async () => {
    const db = bob.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'shortlisted',
        creatorFeedback: 'Strong candidate portfolio.',
        reviewedAt: '2026-08-14T01:00:00.000Z',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await seedApp('under_review');
  await runTest('1.4 Legal: under_review -> declined (by creator)', async () => {
    const db = bob.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'declined',
        creatorFeedback: 'Position filled internally.',
        reviewedAt: '2026-08-14T01:00:00.000Z',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await seedApp('shortlisted');
  await runTest('1.5 Legal: shortlisted -> accepted (by creator)', async () => {
    const db = bob.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'accepted',
        creatorFeedback: 'Offer accepted and kickoff scheduled.',
        reviewedAt: '2026-08-14T01:00:00.000Z',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await seedApp('shortlisted');
  await runTest('1.6 Legal: shortlisted -> declined (by creator)', async () => {
    const db = bob.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'declined',
        creatorFeedback: 'Selected another candidate.',
        reviewedAt: '2026-08-14T01:00:00.000Z',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  // Illegal transitions
  await seedApp('submitted');
  await runTest('1.7 Illegal: applicant -> under_review is REJECTED', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'under_review',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await runTest('1.8 Illegal: applicant -> shortlisted is REJECTED', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'shortlisted',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await runTest('1.9 Illegal: applicant -> accepted is REJECTED', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'accepted',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await runTest('1.10 Illegal: applicant -> declined is REJECTED', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'declined',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await seedApp('withdrawn');
  await runTest('1.11 Illegal: withdrawn -> submitted (revive) is REJECTED', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'submitted',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await runTest('1.12 Illegal: withdrawn -> accepted (by creator) is REJECTED', async () => {
    const db = bob.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'accepted',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await seedApp('declined');
  await runTest('1.13 Illegal: declined -> accepted (by creator) is REJECTED', async () => {
    const db = bob.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'accepted',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await seedApp('accepted');
  await runTest('1.14 Illegal: accepted -> declined is REJECTED', async () => {
    const db = bob.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'declined',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await seedApp('shortlisted');
  await runTest('1.15 Illegal: shortlisted -> withdrawn (by applicant) is REJECTED', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'withdrawn',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await seedApp('under_review');
  await runTest('1.16 Illegal: under_review -> withdrawn (by applicant) is REJECTED', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'withdrawn',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await seedApp('submitted');
  await runTest('1.17 Illegal: Unrelated user Eve CANNOT transition review status', async () => {
    const db = eve.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        status: 'under_review',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  // =========================================================================
  console.log('\n--- 2. CANONICAL ORGANIZATION AUTHORIZATION AUDIT ---');
  // =========================================================================

  await runTest('2.1 Legitimate Org Admin Charlie CAN manage organization opportunity', async () => {
    const db = charlie.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'opportunities', 'opp_org_acme'), {
        description: 'Updated description by verified org admin.',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await runTest('2.2 Non-admin Org Member David CANNOT manage organization opportunity', async () => {
    const db = david.firestore();
    await assertFails(
      updateDoc(doc(db, 'opportunities', 'opp_org_acme'), {
        description: 'Unauthorized update attempt by regular member.',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await runTest('2.3 Creator Bob CANNOT grant himself org admin on Acme opportunity', async () => {
    const db = bob.firestore();
    const spoofedOpp = {
      id: 'opp_bob_spoofed_org',
      title: 'Spoofed Acme Listing',
      creatorId: 'user_bob_creator',
      organizationId: 'org_acme_corp',
      type: 'contract',
      category: 'cloud',
      description: 'Bob pretending to be Acme admin.',
      status: 'open',
      requiredSkills: ['GCP'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    await assertFails(setDoc(doc(db, 'opportunities', 'opp_bob_spoofed_org'), spoofedOpp));
  });

  await runTest('2.4 Stale / client-provided orgAdminUserIds array does NOT grant access', async () => {
    const db = eve.firestore();
    // Eve tries to create an opp claiming Acme with her own injected admin list
    const spoofedArrayOpp = {
      id: 'opp_eve_injected_admin_array',
      title: 'Injected Admin Array Attempt',
      creatorId: 'user_eve_attacker',
      organizationId: 'org_acme_corp',
      adminUserIds: ['user_eve_attacker'], // Client-injected fake array
      type: 'contract',
      category: 'cloud',
      description: 'Attempting to bypass canonical org doc.',
      status: 'open',
      requiredSkills: ['Testing'],
      locationType: 'remote',
      compensationType: 'fixed',
      currency: 'USD',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    await assertFails(setDoc(doc(db, 'opportunities', 'opp_eve_injected_admin_array'), spoofedArrayOpp));
  });

  await runTest('2.5 Removing user from canonical org admin list immediately REVOKES authority', async () => {
    // 1. Revoke Charlie from Acme Corp in canonical document
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await updateDoc(doc(db, 'organizations', 'org_acme_corp'), {
        adminUserIds: [], // Charlie removed!
      });
    });

    // 2. Charlie attempts to update opportunity -> MUST FAIL immediately
    const db = charlie.firestore();
    await assertFails(
      updateDoc(doc(db, 'opportunities', 'opp_org_acme'), {
        description: 'Post-revocation update attempt.',
        updatedAt: '2026-08-14T02:00:00.000Z',
      })
    );

    // Restore Charlie for subsequent tests
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await updateDoc(doc(db, 'organizations', 'org_acme_corp'), {
        adminUserIds: ['user_charlie_org_admin'],
      });
    });
  });

  // =========================================================================
  console.log('\n--- 3. APPLICATION PRIVACY AUDIT ---');
  // =========================================================================

  // Seed two distinct applications
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
      id: 'opp_open_bob_user_alice_applicant',
      opportunityId: 'opp_open_bob',
      opportunityCreatorId: 'user_bob_creator',
      applicantId: 'user_alice_applicant',
      applicantDisplayName: 'Alice Applicant',
      applicantEmail: 'alice@test.com',
      coverNote: 'Confidential proposal from Alice.',
      creatorFeedback: 'Internal note for Alice.',
      status: 'submitted',
      submittedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });
    await setDoc(doc(db, 'applications', 'opp_open_bob_user_frank_applicant2'), {
      id: 'opp_open_bob_user_frank_applicant2',
      opportunityId: 'opp_open_bob',
      opportunityCreatorId: 'user_bob_creator',
      applicantId: 'user_frank_applicant2',
      applicantDisplayName: 'Frank Applicant',
      applicantEmail: 'frank@test.com',
      coverNote: 'Confidential proposal from Frank.',
      status: 'submitted',
      submittedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });
    // Org application for Acme
    await setDoc(doc(db, 'applications', 'opp_org_acme_user_alice_applicant'), {
      id: 'opp_org_acme_user_alice_applicant',
      opportunityId: 'opp_org_acme',
      organizationId: 'org_acme_corp',
      opportunityCreatorId: 'user_charlie_org_admin',
      applicantId: 'user_alice_applicant',
      applicantDisplayName: 'Alice Applicant',
      applicantEmail: 'alice@test.com',
      coverNote: 'Alice proposal to Acme.',
      status: 'submitted',
      submittedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    });
  });

  await runTest('3.1 Applicant Alice CAN read her own application', async () => {
    const db = alice.firestore();
    await assertSucceeds(getDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant')));
  });

  await runTest('3.2 Opportunity Creator Bob CAN read applications for his opportunity', async () => {
    const db = bob.firestore();
    await assertSucceeds(getDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant')));
    await assertSucceeds(getDoc(doc(db, 'applications', 'opp_open_bob_user_frank_applicant2')));
  });

  await runTest('3.3 Canonical Org Admin Charlie CAN read application for Acme opportunity', async () => {
    const db = charlie.firestore();
    await assertSucceeds(getDoc(doc(db, 'applications', 'opp_org_acme_user_alice_applicant')));
  });

  await runTest('3.4 Unrelated authenticated user Eve CANNOT read Alice application', async () => {
    const db = eve.firestore();
    await assertFails(getDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant')));
  });

  await runTest('3.5 Unauthenticated visitor CANNOT read applications', async () => {
    const db = unauth.firestore();
    await assertFails(getDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant')));
  });

  await runTest('3.6 Applicant Alice CANNOT read Frank application', async () => {
    const db = alice.firestore();
    await assertFails(getDoc(doc(db, 'applications', 'opp_open_bob_user_frank_applicant2')));
  });

  await runTest('3.7 Non-admin Org Member David CANNOT read applications for Acme opportunity', async () => {
    const db = david.firestore();
    await assertFails(getDoc(doc(db, 'applications', 'opp_org_acme_user_alice_applicant')));
  });

  // =========================================================================
  console.log('\n--- 4. TRUST PASSPORT ISOLATION AUDIT ---');
  // =========================================================================

  await runTest('4.1 Alice CANNOT mutate private trustPassports to forged identityVerified: true', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'trustPassports', 'user_alice_applicant'), {
        identityVerified: true,
      })
    );
  });

  await runTest('4.2 Alice CANNOT write to publicTrustPassports with forged trustScore or trustTier', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'publicTrustPassports', 'user_alice_applicant'), {
        trustScore: 99,
        trustTier: 'Elite Master',
        identityVerified: true,
      })
    );
  });

  await runTest('4.3 Alice CANNOT create verification request with verified status or verifierUid set', async () => {
    const db = alice.firestore();
    const forgedVerif = {
      userId: 'user_alice_applicant',
      status: 'verified', // ILLEGAL initial status!
      documentType: 'passport',
      maskedNumber: '***1234',
      verifierUid: 'user_eve_attacker', // ILLEGAL field on create!
    };
    await assertFails(setDoc(doc(db, 'verifications', 'verif_fake_alice'), forgedVerif));
  });

  await runTest('4.4 Creator Bob CANNOT mutate Alice verification record', async () => {
    const db = bob.firestore();
    await assertFails(
      updateDoc(doc(db, 'verifications', 'verif_fake_alice'), {
        status: 'verified',
      })
    );
  });

  // =========================================================================
  console.log('\n--- 5. OPPORTUNITY LIFECYCLE AUDIT ---');
  // =========================================================================

  await runTest('5.1 Creator Bob can transition: draft -> open', async () => {
    const db = bob.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'opportunities', 'opp_draft_bob'), {
        status: 'open',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await runTest('5.2 Creator Bob can transition: open -> in_progress', async () => {
    const db = bob.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'opportunities', 'opp_open_bob'), {
        status: 'in_progress',
        updatedAt: '2026-08-14T01:00:00.000Z',
      })
    );
  });

  await runTest('5.3 Creator Bob can transition: in_progress -> closed', async () => {
    const db = bob.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'opportunities', 'opp_open_bob'), {
        status: 'closed',
        updatedAt: '2026-08-14T02:00:00.000Z',
      })
    );
  });

  await runTest('5.4 Creator Bob can transition: closed -> open', async () => {
    const db = bob.firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'opportunities', 'opp_open_bob'), {
        status: 'open',
        updatedAt: '2026-08-14T03:00:00.000Z',
      })
    );
  });

  await runTest('5.5 Unauthorized user Eve CANNOT transition opportunity lifecycle', async () => {
    const db = eve.firestore();
    await assertFails(
      updateDoc(doc(db, 'opportunities', 'opp_open_bob'), {
        status: 'closed',
        updatedAt: '2026-08-14T04:00:00.000Z',
      })
    );
  });

  await runTest('5.6 Draft listings remain private from public visitors', async () => {
    // Reset opp_draft_bob back to draft
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await updateDoc(doc(db, 'opportunities', 'opp_draft_bob'), { status: 'draft' });
    });
    const db = unauth.firestore();
    await assertFails(getDoc(doc(db, 'opportunities', 'opp_draft_bob')));
  });

  await runTest('5.7 Applying to a CLOSED opportunity is REJECTED', async () => {
    const db = alice.firestore();
    const appOnClosed = {
      id: 'opp_closed_bob_user_alice_applicant',
      opportunityId: 'opp_closed_bob',
      opportunityCreatorId: 'user_bob_creator',
      applicantId: 'user_alice_applicant',
      applicantDisplayName: 'Alice Applicant',
      applicantEmail: 'alice@test.com',
      coverNote: 'Attempting to apply to closed opportunity.',
      status: 'submitted',
      submittedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    await assertFails(setDoc(doc(db, 'applications', 'opp_closed_bob_user_alice_applicant'), appOnClosed));
  });

  await runTest('5.8 Applying to an IN_PROGRESS opportunity is REJECTED', async () => {
    const db = alice.firestore();
    const appOnInProgress = {
      id: 'opp_inprogress_bob_user_alice_applicant',
      opportunityId: 'opp_inprogress_bob',
      opportunityCreatorId: 'user_bob_creator',
      applicantId: 'user_alice_applicant',
      applicantDisplayName: 'Alice Applicant',
      applicantEmail: 'alice@test.com',
      coverNote: 'Attempting to apply to in_progress opportunity.',
      status: 'submitted',
      submittedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };
    await assertFails(setDoc(doc(db, 'applications', 'opp_inprogress_bob_user_alice_applicant'), appOnInProgress));
  });

  // =========================================================================
  console.log('\n--- 6. DUPLICATE / RACE PROTECTION AUDIT ---');
  // =========================================================================

  await runTest('6.1 Deterministic ID prevents duplicate application collision', async () => {
    const db = frank.firestore();
    const validApp = {
      id: 'opp_open_bob_user_frank_applicant2',
      opportunityId: 'opp_open_bob',
      opportunityCreatorId: 'user_bob_creator',
      applicantId: 'user_frank_applicant2',
      applicantDisplayName: 'Frank Applicant',
      applicantEmail: 'frank@test.com',
      coverNote: 'First application attempt.',
      status: 'submitted',
      submittedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };

    // Creating document under deterministic ID succeeds
    await assertSucceeds(setDoc(doc(db, 'applications', 'opp_open_bob_user_frank_applicant2'), validApp));

    // Non-deterministic random ID creation attempt MUST FAIL
    const randomIdApp = { ...validApp, id: 'random_duplicate_id_999' };
    await assertFails(setDoc(doc(db, 'applications', 'random_duplicate_id_999'), randomIdApp));
  });

  // =========================================================================
  console.log('\n--- 7. QUERY SECURITY AUDIT ---');
  // =========================================================================

  await runTest('7.1 Public visitor can execute where("status", "==", "open") query', async () => {
    const db = unauth.firestore();
    const q = query(collection(db, 'opportunities'), where('status', '==', 'open'));
    const snapshot = await assertSucceeds(getDocs(q));
    // Verify results only contain open
    snapshot.forEach((d) => {
      if (d.data().status !== 'open') throw new Error(`Query leaked status ${d.data().status}`);
    });
  });

  await runTest('7.2 Public visitor can execute category-filtered open opportunities query', async () => {
    const db = unauth.firestore();
    const q = query(
      collection(db, 'opportunities'),
      where('status', '==', 'open'),
      where('category', '==', 'engineering')
    );
    await assertSucceeds(getDocs(q));
  });

  await runTest('7.3 Creator Bob can query his own opportunities in any status', async () => {
    const db = bob.firestore();
    const q = query(collection(db, 'opportunities'), where('creatorId', '==', 'user_bob_creator'));
    await assertSucceeds(getDocs(q));
  });

  await runTest('7.4 Applicant Alice can query only her own applications', async () => {
    const db = alice.firestore();
    const q = query(collection(db, 'applications'), where('applicantId', '==', 'user_alice_applicant'));
    await assertSucceeds(getDocs(q));
  });

  await runTest('7.5 Creator Bob can query applications for his opportunity', async () => {
    const db = bob.firestore();
    const q = query(collection(db, 'applications'), where('opportunityCreatorId', '==', 'user_bob_creator'));
    await assertSucceeds(getDocs(q));
  });

  await runTest('7.6 Org Admin Charlie can query applications for Acme opportunity', async () => {
    const db = charlie.firestore();
    const q = query(collection(db, 'applications'), where('opportunityCreatorId', '==', 'user_charlie_org_admin'));
    await assertSucceeds(getDocs(q));
  });

  // =========================================================================
  console.log('\n--- 8. DATA INTEGRITY & IMMUTABILITY AUDIT ---');
  // =========================================================================

  await runTest('8.1 Creator Bob CANNOT mutate creatorId on opportunity update', async () => {
    const db = bob.firestore();
    await assertFails(
      updateDoc(doc(db, 'opportunities', 'opp_open_bob'), {
        creatorId: 'user_eve_attacker', // Forging creatorId
        updatedAt: '2026-08-14T05:00:00.000Z',
      })
    );
  });

  await runTest('8.2 Creator Bob CANNOT mutate createdAt on opportunity update', async () => {
    const db = bob.firestore();
    await assertFails(
      updateDoc(doc(db, 'opportunities', 'opp_open_bob'), {
        createdAt: '2020-01-01T00:00:00.000Z', // Forging createdAt
        updatedAt: '2026-08-14T05:00:00.000Z',
      })
    );
  });

  await runTest('8.3 Applicant Alice CANNOT mutate applicantId on application update', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        applicantId: 'user_eve_attacker',
        updatedAt: '2026-08-14T05:00:00.000Z',
      })
    );
  });

  await runTest('8.4 Applicant Alice CANNOT mutate submittedAt on application update', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        submittedAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2026-08-14T05:00:00.000Z',
      })
    );
  });

  await runTest('8.5 Applicant Alice CANNOT forge creatorFeedback on application update', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        creatorFeedback: 'Alice gave herself positive feedback.',
        updatedAt: '2026-08-14T05:00:00.000Z',
      })
    );
  });

  await runTest('8.6 Applicant Alice CANNOT forge reviewedAt timestamp', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        reviewedAt: '2026-08-14T05:00:00.000Z',
        updatedAt: '2026-08-14T05:00:00.000Z',
      })
    );
  });

  await runTest('8.7 Creator Bob CANNOT tamper with applicant coverNote during review', async () => {
    const db = bob.firestore();
    await assertFails(
      updateDoc(doc(db, 'applications', 'opp_open_bob_user_alice_applicant'), {
        coverNote: 'Tampered cover note by creator.',
        status: 'under_review',
        updatedAt: '2026-08-14T05:00:00.000Z',
      })
    );
  });

  // =========================================================================
  console.log('\n--- 9. GROUP 3 REGRESSION PROTECTION AUDIT ---');
  // =========================================================================

  await runTest('9.1 Public visitor can get Alice public trust passport by ID', async () => {
    const db = unauth.firestore();
    await assertSucceeds(getDoc(doc(db, 'publicTrustPassports', 'user_alice_applicant')));
  });

  await runTest('9.2 Public visitor CANNOT scrape all public trust passports', async () => {
    const db = unauth.firestore();
    await assertFails(getDocs(collection(db, 'publicTrustPassports')));
  });

  await runTest('9.3 Alice CANNOT forge identityVerified in private trustPassports', async () => {
    const db = alice.firestore();
    await assertFails(
      updateDoc(doc(db, 'trustPassports', 'user_alice_applicant'), {
        identityVerified: true,
      })
    );
  });

  console.log('\n========================================================================');
  console.log(`AUDIT RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    console.error('Failed Tests Summary:');
    failedTestDetails.forEach((d) => console.error(d));
    await testEnv.cleanup();
    process.exit(1);
  }

  await testEnv.cleanup();
  process.exit(0);
}

runReleaseCandidateAudit().catch((err) => {
  console.error('Fatal Release Candidate execution error:', err);
  process.exit(1);
});
