/**
 * GigLink Phase C-2B-2 Test Suite: Versioned Submission Hardening & Immutability
 *
 * Verifies:
 * 1. Multi-iteration cycle: v1 -> rev1 -> v2 -> rev2 -> v3 -> approval
 * 2. Historical submission immutability (v1 untouched by v2, v2 untouched by v3)
 * 3. Review-to-version linkage (review 1 -> v1, review 2 -> v2, approval -> v3)
 * 4. Strict HTTPS URL validation (rejects javascript:, data:, blob:, file:, http:, malformed)
 * 5. Payload bounds (deliveryNote max 5,000, URL max 1,000, additionalLinks max 10, evidenceFiles max 10)
 * 6. Complete idempotency payload hashing (detects changed additionalLinks, evidenceFiles, URLs, deliveryNote)
 * 7. Payment isolation (paymentState remains held throughout all submissions, revisions, and approval)
 */

import { GigLinkContract } from '../types';
import {
  startMilestoneWork,
  submitMilestoneDeliverable,
  reviewMilestoneDeliverable,
  validateHttpsUrl,
  MilestoneLifecycleError,
} from '../server/payments/milestoneLifecycleService';
import {
  persistContract,
  getContract,
  setContractWriterForTesting,
} from '../lib/contractService';

export async function runPhaseC2B2Tests(): Promise<{ passed: number; total: number; failed: number }> {
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (!condition) {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`  ✓ ${message}`);
    passed++;
  }

  console.log('\n======================================================');
  console.log('   PHASE C-2B-2: VERSIONED SUBMISSION HARDENING SUITE   ');
  console.log('======================================================\n');

  // Setup test environment writer
  setContractWriterForTesting(async () => {});

  const baseContract: GigLinkContract = {
    id: `c_c2b2_${Date.now()}`,
    opportunityId: 'opp_c2b2',
    opportunityTitle: 'C-2B-2 Test Opportunity',
    applicationId: 'app_c2b2',
    creatorId: 'client_uid',
    creatorName: 'Enterprise Client',
    talentId: 'partner_uid',
    talentName: 'Elite Partner',
    version: 1,
    conversationId: 'conv_c2b2_test',
    status: 'active',
    scopeLock: {
      title: 'C-2B-2 Scope',
      description: 'Hardened versioned submission lifecycle',
      inclusions: ['Deliverables'],
      exclusions: [],
      deliverables: ['Deliverable V1', 'Deliverable V2', 'Deliverable V3'],
      totalAmount: 3000,
      currency: 'USD',
      revisionAllowance: 3,
    },
    milestones: [
      {
        id: 'm1',
        contractId: `c_c2b2_${Date.now()}`,
        title: 'Hardened Submission Milestone',
        description: 'Multi-round submission and review verification',
        deliverables: ['API Specification', 'Client Implementation'],
        amount: 3000,
        currency: 'USD',
        status: 'in_progress',
        reviewState: 'pending_submission',
        workState: 'in_progress',
        paymentState: 'held',
        fundedAmount: 3000,
        revisionAllowance: 3,
        revisionCount: 0,
        startedAt: new Date().toISOString(),
        submissions: [],
        reviewRecords: [],
        reviewHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    creatorAcceptance: { accepted: true, acceptedAt: new Date().toISOString() },
    talentAcceptance: { accepted: true, acceptedAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await persistContract(baseContract);

  // =========================================================================
  // 1. HTTPS URL VALIDATION & SCHEME REJECTION (C2B2-F01)
  // =========================================================================
  console.log('--- 1. HTTPS-Only URL Validation & Scheme Rejection (C2B2-F01) ---');

  // E. Valid HTTPS URLs accepted
  assert(
    validateHttpsUrl('https://example.com/demo', 'demoUrl') === 'https://example.com/demo',
    'Valid HTTPS URL accepted'
  );
  assert(
    validateHttpsUrl('  https://github.com/repo/v1  ', 'repoUrl') === 'https://github.com/repo/v1',
    'HTTPS URL trimmed and accepted'
  );

  // D. Disallowed schemes rejected with HTTP 400
  const illegalSchemes = [
    { url: 'javascript:alert(1)', name: 'javascript:' },
    { url: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', name: 'data:' },
    { url: 'blob:https://example.com/uuid', name: 'blob:' },
    { url: 'file:///etc/passwd', name: 'file:' },
    { url: 'http://insecure-site.com', name: 'insecure http:' },
    { url: 'ftp://ftp.example.com', name: 'ftp:' },
    { url: '/relative/path/not/absolute', name: 'relative path' },
    { url: 'not-even-a-url', name: 'malformed non-URL' },
    { url: '   ', name: 'whitespace-only' },
  ];

  for (const { url, name } of illegalSchemes) {
    let caught = false;
    try {
      validateHttpsUrl(url, 'testUrl');
    } catch (err: any) {
      if (err instanceof MilestoneLifecycleError && err.statusCode === 400) {
        caught = true;
      }
    }
    assert(caught, `Illegal scheme or format '${name}' is rejected with HTTP 400`);
  }

  // Submission with invalid demoUrl rejected at lifecycle endpoint
  let submitInvalidUrlRejected = false;
  try {
    await submitMilestoneDeliverable({
      contractId: baseContract.id,
      milestoneId: 'm1',
      callerUid: 'partner_uid',
      deliveryNote: 'Comprehensive delivery note with illegal javascript URL payload.',
      demoUrl: 'javascript:void(0)',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) {
      submitInvalidUrlRejected = true;
    }
  }
  assert(submitInvalidUrlRejected, 'submitMilestoneDeliverable rejects javascript: demoUrl with HTTP 400');

  // Submission with insecure http: repoUrl rejected
  let submitHttpRepoRejected = false;
  try {
    await submitMilestoneDeliverable({
      contractId: baseContract.id,
      milestoneId: 'm1',
      callerUid: 'partner_uid',
      deliveryNote: 'Comprehensive delivery note with unencrypted HTTP repo link.',
      repoUrl: 'http://github.com/insecure/repo',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) {
      submitHttpRepoRejected = true;
    }
  }
  assert(submitHttpRepoRejected, 'submitMilestoneDeliverable rejects http: repoUrl with HTTP 400');

  // =========================================================================
  // 2. PAYLOAD BOUNDS & VOLUMETRIC LIMITS (C2B2-F02)
  // =========================================================================
  console.log('--- 2. Payload Bounds & Volumetric Limits (C2B2-F02) ---');

  // F. Delivery note length bounds
  let deliveryNoteTooShort = false;
  try {
    await submitMilestoneDeliverable({
      contractId: baseContract.id,
      milestoneId: 'm1',
      callerUid: 'partner_uid',
      deliveryNote: 'Too short note',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) {
      deliveryNoteTooShort = true;
    }
  }
  assert(deliveryNoteTooShort, 'Delivery note < 15 characters rejected with HTTP 400');

  let deliveryNoteTooLong = false;
  try {
    await submitMilestoneDeliverable({
      contractId: baseContract.id,
      milestoneId: 'm1',
      callerUid: 'partner_uid',
      deliveryNote: 'A'.repeat(5001),
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) {
      deliveryNoteTooLong = true;
    }
  }
  assert(deliveryNoteTooLong, 'Delivery note > 5,000 characters rejected with HTTP 400');

  // URL > 1000 characters rejected
  let urlTooLong = false;
  try {
    validateHttpsUrl(`https://example.com/${'x'.repeat(1000)}`, 'longUrl');
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) {
      urlTooLong = true;
    }
  }
  assert(urlTooLong, 'URL > 1,000 characters rejected with HTTP 400');

  // G. Array volume limits
  const elevenLinks = Array.from({ length: 11 }, (_, i) => `https://link${i}.example.com`);
  let elevenLinksRejected = false;
  try {
    await submitMilestoneDeliverable({
      contractId: baseContract.id,
      milestoneId: 'm1',
      callerUid: 'partner_uid',
      deliveryNote: 'Deliverable note with eleven additional links exceeding boundary limit.',
      additionalLinks: elevenLinks,
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) {
      elevenLinksRejected = true;
    }
  }
  assert(elevenLinksRejected, '> 10 additionalLinks rejected with HTTP 400');

  const elevenFiles = Array.from({ length: 11 }, (_, i) => `https://files.example.com/doc${i}.pdf`);
  let elevenFilesRejected = false;
  try {
    await submitMilestoneDeliverable({
      contractId: baseContract.id,
      milestoneId: 'm1',
      callerUid: 'partner_uid',
      deliveryNote: 'Deliverable note with eleven evidence file references.',
      evidenceFiles: elevenFiles,
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 400) {
      elevenFilesRejected = true;
    }
  }
  assert(elevenFilesRejected, '> 10 evidenceFiles rejected with HTTP 400');

  // =========================================================================
  // 3. COMPLETE IDEMPOTENCY HASHING (C2B2-F03)
  // =========================================================================
  console.log('--- 3. Complete Idempotency Payload Hashing (C2B2-F03) ---');

  const idempKey = `idemp_complete_test_${Date.now()}`;
  const validPayload = {
    contractId: baseContract.id,
    milestoneId: 'm1',
    callerUid: 'partner_uid',
    deliveryNote: 'First authoritative version delivery note for full testing.',
    demoUrl: 'https://demo.giglink.test/v1',
    repoUrl: 'https://github.com/giglink/c2b2-repo',
    figmaUrl: 'https://figma.com/file/c2b2-design',
    additionalLinks: ['https://docs.giglink.test/v1'],
    evidenceFiles: ['https://evidence.giglink.test/proof1.pdf'],
    idempotencyKey: idempKey,
  };

  // First execution: succeeds and commits Version 1
  const v1Sub = await submitMilestoneDeliverable(validPayload);
  assert(v1Sub.submissionVersion === 1, 'Version 1 created successfully');

  // Replay with identical complete payload: replays cached result
  const v1Replay = await submitMilestoneDeliverable(validPayload);
  assert(v1Replay.submissionVersion === 1, 'Same idempotency key + identical payload replays cached result');

  // Conflict 1: Changed additionalLinks with same key -> HTTP 409
  let conflictLinksCaught = false;
  try {
    await submitMilestoneDeliverable({
      ...validPayload,
      additionalLinks: ['https://docs.giglink.test/v1-tampered'],
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 409) {
      conflictLinksCaught = true;
    }
  }
  assert(conflictLinksCaught, 'Same key + changed additionalLinks throws HTTP 409 conflict');

  // Conflict 2: Changed evidenceFiles with same key -> HTTP 409
  let conflictEvidenceCaught = false;
  try {
    await submitMilestoneDeliverable({
      ...validPayload,
      evidenceFiles: ['https://evidence.giglink.test/proof2-tampered.pdf'],
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 409) {
      conflictEvidenceCaught = true;
    }
  }
  assert(conflictEvidenceCaught, 'Same key + changed evidenceFiles throws HTTP 409 conflict');

  // Conflict 3: Changed demoUrl with same key -> HTTP 409
  let conflictUrlCaught = false;
  try {
    await submitMilestoneDeliverable({
      ...validPayload,
      demoUrl: 'https://demo.giglink.test/v1-modified',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 409) {
      conflictUrlCaught = true;
    }
  }
  assert(conflictUrlCaught, 'Same key + changed demoUrl throws HTTP 409 conflict');

  // Conflict 4: Changed deliveryNote with same key -> HTTP 409
  let conflictNoteCaught = false;
  try {
    await submitMilestoneDeliverable({
      ...validPayload,
      deliveryNote: 'Altered delivery note content using same idempotency key.',
    });
  } catch (err: any) {
    if (err instanceof MilestoneLifecycleError && err.statusCode === 409) {
      conflictNoteCaught = true;
    }
  }
  assert(conflictNoteCaught, 'Same key + changed deliveryNote throws HTTP 409 conflict');

  // =========================================================================
  // 4. MULTI-ROUND ITERATION: v1 -> rev1 -> v2 -> rev2 -> v3 -> approval
  // =========================================================================
  console.log('--- 4. Multi-Round Iteration & Audit Reconstruction (A, B, C) ---');

  // Review 1: Client requests revision on v1
  const rev1 = await reviewMilestoneDeliverable({
    contractId: baseContract.id,
    milestoneId: 'm1',
    callerUid: 'client_uid',
    decision: 'revision_requested',
    feedback: 'Please integrate pagination controls and add unit tests to the codebase.',
  });
  assert(rev1.milestone.workState === 'revision_requested', 'Milestone transitioned to revision_requested');
  assert(rev1.milestone.revisionCount === 1, 'revisionCount incremented to 1');
  assert(rev1.milestone.reviewRecords?.[0].versionEvaluated === 1, 'Review record 1 links to versionEvaluated 1');

  // Submission 2: Partner submits Version 2
  const v2Sub = await submitMilestoneDeliverable({
    contractId: baseContract.id,
    milestoneId: 'm1',
    callerUid: 'partner_uid',
    deliveryNote: 'Version 2: Added pagination controls and comprehensive Vitest suite.',
    demoUrl: 'https://demo.giglink.test/v2',
    repoUrl: 'https://github.com/giglink/c2b2-repo/tree/v2',
    additionalLinks: ['https://docs.giglink.test/v2'],
  });
  assert(v2Sub.submissionVersion === 2, 'Version 2 created successfully');
  assert(v2Sub.milestone.submissions?.length === 2, 'submissions[] now contains 2 versions');

  // B. Immutability check: v1 remains unchanged after v2
  const v1Preserved = v2Sub.milestone.submissions?.[0];
  assert(v1Preserved?.versionNumber === 1, 'v1 versionNumber remains 1');
  assert(v1Preserved?.demoUrl === 'https://demo.giglink.test/v1', 'v1 demoUrl remains unchanged');
  assert(v1Preserved?.deliveryNote === validPayload.deliveryNote, 'v1 deliveryNote remains unchanged');

  // Review 2: Client requests another revision on v2
  const rev2 = await reviewMilestoneDeliverable({
    contractId: baseContract.id,
    milestoneId: 'm1',
    callerUid: 'client_uid',
    decision: 'revision_requested',
    feedback: 'Pagination looks good; please add dark mode support to complete the deliverable.',
  });
  assert(rev2.milestone.revisionCount === 2, 'revisionCount incremented to 2');
  assert(rev2.milestone.reviewRecords?.[1].versionEvaluated === 2, 'Review record 2 links to versionEvaluated 2');

  // Submission 3: Partner submits Version 3
  const v3Sub = await submitMilestoneDeliverable({
    contractId: baseContract.id,
    milestoneId: 'm1',
    callerUid: 'partner_uid',
    deliveryNote: 'Version 3: Dark mode implementation complete with automated theme toggle tests.',
    demoUrl: 'https://demo.giglink.test/v3',
    repoUrl: 'https://github.com/giglink/c2b2-repo/tree/v3',
  });
  assert(v3Sub.submissionVersion === 3, 'Version 3 created successfully');
  assert(v3Sub.milestone.submissions?.length === 3, 'submissions[] now contains 3 versions');

  // B. Immutability check: v2 remains unchanged after v3
  const v2Preserved = v3Sub.milestone.submissions?.[1];
  assert(v2Preserved?.versionNumber === 2, 'v2 versionNumber remains 2');
  assert(v2Preserved?.demoUrl === 'https://demo.giglink.test/v2', 'v2 demoUrl remains unchanged');

  // Review 3: Client approves Version 3
  const appr = await reviewMilestoneDeliverable({
    contractId: baseContract.id,
    milestoneId: 'm1',
    callerUid: 'client_uid',
    decision: 'approved',
    feedback: 'Dark mode and theme tests verified. Fully approved!',
  });
  assert(appr.milestone.workState === 'approved', 'Milestone transitioned to approved (Terminal)');
  assert(appr.milestone.approvedVersion === 3, 'approvedVersion records Version 3');
  assert(appr.milestone.reviewRecords?.[2].versionEvaluated === 3, 'Review record 3 links to versionEvaluated 3');

  // =========================================================================
  // 5. PAYMENT ISOLATION (I)
  // =========================================================================
  console.log('--- 5. Payment Isolation Verification (I) ---');

  const finalContract = await getContract(baseContract.id);
  const m1Final = finalContract?.milestones.find((m) => m.id === 'm1');

  assert(m1Final?.paymentState === 'held', 'paymentState remains strictly held in escrow');
  assert(m1Final?.releasedAt === undefined || m1Final?.releasedAt === null, 'No releasedAt timestamp generated');
  assert(
    m1Final?.providerPayoutReference === undefined || m1Final?.providerPayoutReference === null,
    'No providerPayoutReference generated'
  );
  assert(
    m1Final?.providerRefundReference === undefined || m1Final?.providerRefundReference === null,
    'No providerRefundReference generated'
  );

  console.log('\n======================================================');
  console.log(`PHASE C-2B-2 TEST RESULTS: ${passed}/${total} PASSED (0 FAILED)`);
  console.log('======================================================\n');

  return { passed, total, failed: total - passed };
}
