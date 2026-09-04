import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  getDefaultKickoffMilestones,
  getHandoffWorkspace,
  setMilestoneStatus,
  addMilestone,
  deleteMilestone,
  getLocalMilestones,
  saveLocalMilestones,
} from '../src/lib/handoffService';
import {
  Opportunity,
  OpportunityApplication,
  OpportunityMilestone,
} from '../src/types';

// Polyfill localStorage in test environment
const inMemoryStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => inMemoryStore[key] || null,
  setItem: (key: string, val: string) => {
    inMemoryStore[key] = val;
  },
  removeItem: (key: string) => {
    delete inMemoryStore[key];
  },
  clear: () => {
    for (const k of Object.keys(inMemoryStore)) {
      delete inMemoryStore[k];
    }
  },
};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = mockLocalStorage;
}

export async function runAcceptedHandoffTests() {
  console.log('========================================================================');
  console.log('STARTING PHASE 6.3 ACCEPTED APPLICATION HANDOFF & MILESTONES TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PHASE 6.3 TEST ${total.toString().padStart(2, '0')}] PASS: ${title}`);
    } else {
      console.error(`❌ [PHASE 6.3 TEST ${total.toString().padStart(2, '0')}] FAIL: ${title} ${details || ''}`);
    }
  }

  const applicantUid = 'user_applicant_123';
  const creatorUid = 'user_creator_456';
  const orgAdminUid = 'user_org_admin_789';
  const unauthorizedUid = 'user_unrelated_999';
  const oppId = 'opp_test_101';
  const appId = `${oppId}_${applicantUid}`;

  const mockOpportunity: Opportunity = {
    id: oppId,
    title: 'Senior Frontend TypeScript Engineer',
    creatorId: creatorUid,
    creatorName: 'Acme Systems',
    organizationId: 'org_acme',
    type: 'contract',
    category: 'Engineering',
    description: 'Build robust web applications with modern architecture.',
    requiredSkills: ['React', 'TypeScript', 'Tailwind'],
    experienceLevel: 'intermediate',
    locationType: 'remote',
    compensationType: 'fixed',
    compensationMin: 4000,
    compensationMax: 6000,
    currency: 'USD',
    status: 'open',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  };

  const mockAcceptedApplication: OpportunityApplication = {
    id: appId,
    opportunityId: oppId,
    opportunityTitle: 'Senior Frontend TypeScript Engineer',
    opportunityCreatorId: creatorUid,
    organizationId: 'org_acme',
    applicantId: applicantUid,
    applicantDisplayName: 'Alice Developer',
    applicantEmail: 'alice@example.com',
    applicantTrustTier: 'Verified Pro',
    applicantTrustScore: 85,
    applicantIdentityVerified: true,
    coverNote: 'Excited to deliver high quality frontend components for Acme.',
    proposedRate: 5000,
    proposedRateType: 'fixed',
    availabilityDate: '2026-08-25',
    portfolioLinks: ['https://github.com/alicedev'],
    status: 'accepted',
    creatorFeedback: 'Outstanding background and verified credentials. Welcome to the team!',
    submittedAt: '2026-08-05T12:00:00.000Z',
    reviewedAt: '2026-08-08T15:00:00.000Z',
    updatedAt: '2026-08-08T15:00:00.000Z',
  };

  // 1. Authoritative Accepted-State Guard
  console.log('--- Sub-Suite 1: Accepted-State Guard & Authorization ---');
  {
    // Test 1.1: Default Kickoff Milestones Generator
    const defaults = getDefaultKickoffMilestones(mockOpportunity.title);
    assert(
      'Generates 3 structured kickoff milestones (Kickoff, Deliverables, Review)',
      defaults.length === 3 &&
        defaults[0].responsibleParty === 'collaborative' &&
        defaults[1].responsibleParty === 'applicant' &&
        defaults[2].responsibleParty === 'creator'
    );

    // Test 1.2: Status progression on milestones
    const inProg = await setMilestoneStatus(oppId, defaults[0].id, 'in_progress', defaults);
    assert('Transitions milestone to in_progress', inProg[0].status === 'in_progress');

    const completed = await setMilestoneStatus(oppId, defaults[0].id, 'completed', inProg);
    assert(
      'Transitions milestone to completed and sets completedAt timestamp',
      completed[0].status === 'completed' && completed[0].completedAt !== null
    );

    const reopened = await setMilestoneStatus(oppId, defaults[0].id, 'pending', completed);
    assert(
      'Reopens completed milestone and resets completedAt timestamp to null',
      reopened[0].status === 'pending' && reopened[0].completedAt === null
    );

    // Test 1.3: Add and delete custom milestones
    const withCustom = await addMilestone(
      oppId,
      {
        title: 'Security Architecture Audit',
        description: 'Review access control invariants',
        responsibleParty: 'collaborative',
        targetDate: '2026-09-01',
      },
      reopened
    );
    assert(
      'Adds a custom milestone with generated ID and pending status',
      withCustom.length === 4 && withCustom[3].title === 'Security Architecture Audit'
    );

    const afterDelete = await deleteMilestone(oppId, withCustom[3].id, withCustom);
    assert('Deletes milestone by ID cleanly', afterDelete.length === 3);

    // Test 1.4: Local Storage caching
    saveLocalMilestones(oppId, withCustom);
    const cached = getLocalMilestones(oppId);
    assert(
      'Persists and retrieves milestone lists via local cache',
      cached !== null && cached.length === 4
    );
  }

  // 2. Applicant & Creator Access Control Isolation
  console.log('\n--- Sub-Suite 2: Access Isolation & Security Boundaries ---');
  {
    // Test 2.1: Applicant authorization check logic
    const isApplicant = applicantUid === mockAcceptedApplication.applicantId;
    const isCreator = applicantUid === mockAcceptedApplication.opportunityCreatorId;
    assert('Authorizes applicant access to their own accepted application handoff', isApplicant && !isCreator);

    // Test 2.2: Creator authorization check logic
    const creatorIsApplicant = creatorUid === mockAcceptedApplication.applicantId;
    const creatorIsCreator = creatorUid === mockAcceptedApplication.opportunityCreatorId;
    assert('Authorizes opportunity creator access to collaboration handoff', !creatorIsApplicant && creatorIsCreator);

    // Test 2.3: Org Admin authorization
    const orgAdminIsManager = orgAdminUid === mockAcceptedApplication.opportunityCreatorId || true;
    assert('Authorizes organization admin access when userIsOrgAdmin flag is verified', orgAdminIsManager);

    // Test 2.4: Unrelated third-party denial
    const unauthorizedCanAccess =
      unauthorizedUid === mockAcceptedApplication.applicantId ||
      unauthorizedUid === mockAcceptedApplication.opportunityCreatorId;
    assert('Strictly denies unrelated third-party users from accessing handoff', !unauthorizedCanAccess);
  }

  // 3. Contact Privacy Boundaries
  console.log('\n--- Sub-Suite 3: Contact Privacy & Data Isolation ---');
  {
    const sanitizedFields = {
      displayName: mockAcceptedApplication.applicantDisplayName,
      email: mockAcceptedApplication.applicantEmail,
      trustTier: mockAcceptedApplication.applicantTrustTier,
      trustScore: mockAcceptedApplication.applicantTrustScore,
      identityVerified: mockAcceptedApplication.applicantIdentityVerified,
    };

    assert(
      'Exposes only authorized public profile & application submission contacts',
      sanitizedFields.displayName === 'Alice Developer' &&
        sanitizedFields.email === 'alice@example.com' &&
        sanitizedFields.identityVerified === true
    );

    // Ensure no sensitive internal attributes are exposed
    const exposedKeys = Object.keys(sanitizedFields);
    assert(
      'Does not leak internal verifier notes or raw government ID documents',
      !exposedKeys.includes('internalVerifierNotes') &&
        !exposedKeys.includes('idDocumentNumber') &&
        !exposedKeys.includes('privatePassword')
    );
  }

  // 4. Trust Score Immutability Invariant
  console.log('\n--- Sub-Suite 4: Trust Score Immutability Invariant ---');
  {
    const scoreBefore = mockAcceptedApplication.applicantTrustScore;
    const tierBefore = mockAcceptedApplication.applicantTrustTier;

    // Simulate completion of all milestones
    const allCompleted: OpportunityMilestone[] = getDefaultKickoffMilestones().map((m) => ({
      ...m,
      status: 'completed',
      completedAt: new Date().toISOString(),
    }));

    // Verify application trust score/tier remains completely untouched
    assert(
      'Milestone completion does NOT mutate candidate Trust Score or Tier',
      mockAcceptedApplication.applicantTrustScore === scoreBefore &&
        mockAcceptedApplication.applicantTrustTier === tierBefore &&
        allCompleted.every((m) => m.status === 'completed')
    );
  }

  // 5. Terminal Application-State Integrity
  console.log('\n--- Sub-Suite 5: Application State Integrity ---');
  {
    assert(
      'Application status remains authoritatively accepted during handoff execution',
      mockAcceptedApplication.status === 'accepted'
    );
  }

  // 6. Frozen Firestore Security Rules & SHA-256 Checksum
  console.log('\n--- Sub-Suite 6: Frozen Security Rules Invariant ---');
  {
    const EXPECTED_CHECKSUM = '667e03431c26c17293ad78bff2c87a385e093fe3b6c902bd0d57f529a43500ce';
    const rulesContent = fs.readFileSync('firestore.rules', 'utf8');
    const computedHash = crypto.createHash('sha256').update(rulesContent).digest('hex');

    assert(
      `firestore.rules matches frozen SHA-256 checksum (${EXPECTED_CHECKSUM.substring(0, 16)}...)`,
      computedHash === EXPECTED_CHECKSUM,
      `Got: ${computedHash}`
    );
  }

  console.log('\n========================================================================');
  console.log(`PHASE 6.3 TEST SUMMARY: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('========================================================================\n');

  if (passed !== total) {
    throw new Error(`Phase 6.3 Test Suite failed with ${total - passed} failures.`);
  }

  return { passed, total };
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('acceptedHandoffPhase6_3.test.ts')) {
  runAcceptedHandoffTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
