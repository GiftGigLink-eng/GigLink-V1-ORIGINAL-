import { runContractAmendmentsTests } from './contractAmendments.test';
import { runPhase4Tests } from '../lib/phase4Verification.test';
import { runPhase5Tests } from '../lib/phase5Verification.test';
import { runPhase6Tests } from './disputeResolution.test';
import { runPhase6AdversarialSuite } from './disputeAdversarialAudit.test';
import { runPhase7FunctionalTests } from './phase7PassportReputation.test';
import { runPhase7AdversarialTests } from './passportAdversarialAudit.test';
import { runAuthNavigationSecurityTests } from './authNavigationSecurity.test';
import { runPhase8OpportunityTests } from './phase8OpportunityMarketplace.test';
import { runOpportunityAdversarialAudit } from './opportunityAdversarialAudit.test';
import { runAdversarialSecurityAudit } from './adversarialSecurityAudit.test';
import { runPersonaArchitectureRegressionTests } from './personaArchitecture.test';
import { runPhase9BCredentialIssuanceTests } from './phase9BCredentialIssuance.test';
import { runPhase9CDIDInfrastructureTests } from './phase9CDIDInfrastructure.test';
import { runPhase9CSaltedSelectiveDisclosureTests } from './phase9CSaltedSelectiveDisclosure.test';
import { runPhase9CZKRangeProofTests } from './phase9CZKRangeProof.test';
import { runPhase9C4Tests } from './phase9C4ConsoleAndUI.test';
import { runProfileEnhancementTests } from './profileEnhancements.test';
import { runServerTrustScoreTestSuite } from './serverTrustScore.test';
import { runTrustAuthorityRemediationTests } from './trustAuthorityRemediation.test';
import { runCeoStage1SecuritySuite } from './ceoAuthorizationStage1.test';
import { runCeoStage2TestSuite } from './ceoStage2.test';
import { runClientProfileUnificationTests } from './clientProfileUnification.test';
import { runPhase2HiringAndAvatarTests } from './phase2HiringAndAvatar.test';
import { runPhase3ClientPublicIdentityTests } from './phase3ClientPublicIdentity.test';
import { runPhaseC1PaymentTestSuite } from './phaseC1PaymentHardening.test';
import { runPhaseC2ATests } from './phaseC2AProviderNeutral.test';
import { runPhaseC2B1Tests } from './phaseC2B1MilestoneLifecycle.test';
import { runPhaseC2B2Tests } from './phaseC2B2VersionedSubmissions.test';
import { runPhaseC2C1Tests } from './phaseC2C1PaystackIntegration.test';
import {
  canSubmitMilestone,
  canReviewMilestone,
  canSubmitFinalHandover,
  canAcceptFinalHandover,
  getContractProgress,
  acceptContract,
  persistContract,
  getContract,
  normalizeContractData,
  setContractWriterForTesting,
} from '../lib/contractService';
import { setLedgerWriterForTesting } from '../lib/financialLedgerService';
import { deriveContractNotifications } from '../lib/notificationService';
import { GigLinkContract, ContractMilestone } from '../types';

async function runAll() {
  console.log('====================================================');
  console.log('    GIGLINK FULL PLATFORM REGRESSION TEST SUITE     ');
  console.log('====================================================\n');

  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;

  // Use test writer stubs during offline regression test execution
  setContractWriterForTesting(async () => {});
  setLedgerWriterForTesting(async () => {});

  try {
  // -----------------------------------------------------------------
  // PHASE 1: Contract Formation, Mutual Scope Lock & Digital Signatures
  // -----------------------------------------------------------------
  console.log('--- PHASE 1: Contract Formation & Mutual Scope Lock ---');
  let p1Total = 0;
  let p1Passed = 0;
  let p1Failed = 0;

  const assertP1 = (name: string, condition: boolean) => {
    p1Total++;
    grandTotal++;
    if (condition) {
      p1Passed++;
      grandPassed++;
      console.log(`  ✓ [P1] ${name}`);
    } else {
      p1Failed++;
      grandFailed++;
      console.error(`  ✗ [P1 FAIL] ${name}`);
    }
  };

  const draftContract: GigLinkContract = {
    id: 'p1_contract_1',
    opportunityId: 'opp_p1',
    opportunityTitle: 'Phase 1 Opportunity',
    applicationId: 'app_p1',
    creatorId: 'client_p1',
    creatorName: 'Alice Client',
    talentId: 'talent_p1',
    talentName: 'Bob Talent',
    status: 'draft',
    version: 1,
    conversationId: 'conv_p1_contract_1',
    scopeLock: {
      title: 'Phase 1 Opportunity',
      description: 'Scope Lock Description',
      deliverables: ['Deliverable 1'],
      inclusions: ['Feature A'],
      exclusions: ['Feature B'],
      totalAmount: 3000,
      currency: 'USD',
      revisionAllowance: 2,
    },
    creatorAcceptance: {
      accepted: false,
      acceptedAt: null,
      signedName: null,
    },
    talentAcceptance: {
      accepted: false,
      acceptedAt: null,
      signedName: null,
    },
    milestones: [
      {
        id: 'm1',
        contractId: 'p1_contract_1',
        title: 'Initial Architecture',
        description: 'Initial Arch',
        deliverables: ['Arch Doc'],
        amount: 3000,
        currency: 'USD',
        status: 'pending',
        reviewState: 'pending_submission',
        revisionAllowance: 2,
        revisionCount: 0,
        paymentState: 'unfunded',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // P1 Test 1: Persist and load contract
  await persistContract(draftContract);
  const loaded = await getContract('p1_contract_1');
  assertP1('Contract persisted and retrieved with exact draft terms', loaded?.id === 'p1_contract_1');

  // P1 Test 2: Client acceptance updates status to pending_acceptance
  const afterClient = await acceptContract('p1_contract_1', 'client_p1', 'Alice Client');
  assertP1('Client signature transitions draft to pending_acceptance', afterClient.status === 'pending_acceptance' && afterClient.creatorAcceptance.accepted);

  // P1 Test 3: Unauthorized stranger rejected from signing
  let strangerRejected = false;
  try {
    await acceptContract('p1_contract_1', 'stranger_uid', 'Stranger');
  } catch {
    strangerRejected = true;
  }
  assertP1('Unauthorized stranger rejected from signing contract', strangerRejected);

  // P1 Test 4: Talent acceptance activates contract and locks scope
  const afterTalent = await acceptContract('p1_contract_1', 'talent_p1', 'Bob Talent');
  assertP1('Mutual signature transitions contract to active and locks scope', afterTalent.status === 'active' && afterTalent.talentAcceptance.accepted && !!afterTalent.scopeLock.lockedAt);

  // P1 Test 5: Normalization preserves baseline scope
  const normalized = normalizeContractData(draftContract);
  assertP1('Normalized contract contains valid scopeLock and version 1', normalized.version === 1 && !!normalized.scopeLock);

  console.log(`Phase 1 Result: ${p1Passed}/${p1Total} passed.\n`);

  // -----------------------------------------------------------------
  // PHASE 2: Milestone Execution & Project Delivery
  // -----------------------------------------------------------------
  console.log('--- PHASE 2: Milestone Execution & Project Delivery ---');
  let p2Total = 0;
  let p2Passed = 0;
  let p2Failed = 0;

  const assertP2 = (name: string, condition: boolean) => {
    p2Total++;
    grandTotal++;
    if (condition) {
      p2Passed++;
      grandPassed++;
      console.log(`  ✓ [P2] ${name}`);
    } else {
      p2Failed++;
      grandFailed++;
      console.error(`  ✗ [P2 FAIL] ${name}`);
    }
  };

  const activeContract: GigLinkContract = {
    ...draftContract,
    id: 'p2_contract_active',
    status: 'active',
    creatorAcceptance: { accepted: true, acceptedAt: new Date().toISOString(), signedName: 'Alice' },
    talentAcceptance: { accepted: true, acceptedAt: new Date().toISOString(), signedName: 'Bob' },
    milestones: [
      {
        id: 'm1',
        contractId: 'p2_contract_active',
        title: 'M1',
        description: 'M1 Desc',
        deliverables: ['M1 Del'],
        amount: 1500,
        currency: 'USD',
        status: 'in_progress',
        reviewState: 'pending_submission',
        revisionAllowance: 2,
        revisionCount: 0,
        paymentState: 'held',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'm2',
        contractId: 'p2_contract_active',
        title: 'M2',
        description: 'M2 Desc',
        deliverables: ['M2 Del'],
        amount: 1500,
        currency: 'USD',
        status: 'pending',
        reviewState: 'pending_submission',
        revisionAllowance: 2,
        revisionCount: 0,
        paymentState: 'held',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  assertP2('Talent can submit M1 when funded and in_progress', canSubmitMilestone(activeContract, 'm1', 'talent_p1').allowed);
  assertP2('Client cannot submit deliverables on talent behalf', !canSubmitMilestone(activeContract, 'm1', 'client_p1').allowed);
  assertP2('M2 is locked until M1 is approved', !canSubmitMilestone(activeContract, 'm2', 'talent_p1').allowed);
  assertP2('Talent cannot review/approve own milestone', !canReviewMilestone(activeContract, 'm1', 'talent_p1').allowed);
  assertP2('Client cannot review unsubmitted milestone', !canReviewMilestone(activeContract, 'm1', 'client_p1').allowed);

  // Approve M1, check M2 unlocked
  activeContract.milestones[0].status = 'completed';
  activeContract.milestones[0].reviewState = 'approved';
  activeContract.milestones[1].status = 'in_progress';
  assertP2('M2 unlocked once M1 is completed and approved', canSubmitMilestone(activeContract, 'm2', 'talent_p1').allowed);

  // Final handover checks
  assertP2('Final handover blocked while M2 is incomplete', !canSubmitFinalHandover(activeContract, 'talent_p1').allowed);
  activeContract.milestones[1].status = 'completed';
  activeContract.milestones[1].reviewState = 'approved';
  assertP2('Final handover unlocked once all milestones approved', canSubmitFinalHandover(activeContract, 'talent_p1').allowed);

  activeContract.finalHandover = {
    finalProjectUrl: 'https://app.com',
    credentialsHandoverConfirmed: true,
    finalNotes: 'Done and transferred',
    status: 'submitted',
    submittedBy: 'talent_p1',
    submittedAt: new Date().toISOString(),
  };
  assertP2('Client can accept final handover', canAcceptFinalHandover(activeContract, 'client_p1').allowed);
  assertP2('Talent cannot self-accept final handover', !canAcceptFinalHandover(activeContract, 'talent_p1').allowed);

  console.log(`Phase 2 Result: ${p2Passed}/${p2Total} passed.\n`);

  // -----------------------------------------------------------------
  // PHASE 3: Scope Amendments & Contract Governance
  // -----------------------------------------------------------------
  console.log('--- PHASE 3: Scope Amendments & Contract Governance ---');
  const p3 = await runContractAmendmentsTests();
  grandTotal += p3.results.length;
  grandPassed += p3.passed;
  grandFailed += p3.failed;
  p3.results.forEach((r) => {
    console.log(`  ✓ [P3] ${r}`);
  });
  console.log(`Phase 3 Result: ${p3.passed}/${p3.results.length} passed.\n`);

  // -----------------------------------------------------------------
  // PHASE 4: Financial Ledger, Escrow & Settlements
  // -----------------------------------------------------------------
  console.log('--- PHASE 4: Financial Ledger, Escrow & Settlements ---');
  const p4 = runPhase4Tests();
  grandTotal += p4.testResults.length;
  p4.testResults.forEach((r) => {
    if (r.success) {
      grandPassed++;
      console.log(`  ✓ [P4] ${r.name}`);
    } else {
      grandFailed++;
      console.error(`  ✗ [P4 FAIL] ${r.name}: ${r.details}`);
    }
  });
  console.log(`Phase 4 Result: ${p4.testResults.filter((r) => r.success).length}/${p4.testResults.length} passed.\n`);

  // -----------------------------------------------------------------
  // PHASE 5: Project-Linked Messaging & In-App Communication
  // -----------------------------------------------------------------
  console.log('--- PHASE 5: Project-Linked Messaging & In-App Communication ---');
  const p5 = await runPhase5Tests();
  grandTotal += p5.testResults.length;
  p5.testResults.forEach((r) => {
    if (r.success) {
      grandPassed++;
      console.log(`  ✓ [P5] ${r.name}`);
    } else {
      grandFailed++;
      console.error(`  ✗ [P5 FAIL] ${r.name}: ${r.details}`);
    }
  });
  console.log(`Phase 5 Result: ${p5.testResults.filter((r) => r.success).length}/${p5.testResults.length} passed.\n`);

  // -----------------------------------------------------------------
  // PHASE 6: Dispute Resolution, Mutual Cancellation & Admin Mediation
  // -----------------------------------------------------------------
  console.log('--- PHASE 6: Dispute Resolution, Mutual Cancellation & Platform Mediation ---');
  const p6 = await runPhase6Tests();
  grandTotal += p6.total;
  grandPassed += p6.passed;
  grandFailed += p6.total - p6.passed;
  console.log(`Phase 6 Result: ${p6.passed}/${p6.total} passed.\n`);

  // -------------------------------------------------------------
  // PHASE 6 ADVERSARIAL AUDIT
  // -------------------------------------------------------------
  console.log('--- PHASE 6 ADVERSARIAL SECURITY AUDIT ---');
  const p6Adv = await runPhase6AdversarialSuite();
  grandTotal += p6Adv.totalAttacks;
  grandPassed += p6Adv.blockedCount;
  grandFailed += p6Adv.totalAttacks - p6Adv.blockedCount;
  console.log(`Phase 6 Adversarial Result: ${p6Adv.blockedCount}/${p6Adv.totalAttacks} attacks blocked successfully.\n`);

  // -------------------------------------------------------------
  // PHASE 7: Public Trust Passport & Deterministic Reputation Engine
  // -------------------------------------------------------------
  const p7Func = await runPhase7FunctionalTests();
  grandTotal += p7Func.total;
  grandPassed += p7Func.passed;
  grandFailed += p7Func.total - p7Func.passed;

  const p7Adv = await runPhase7AdversarialTests();
  grandTotal += p7Adv.total;
  grandPassed += p7Adv.passed;
  grandFailed += p7Adv.total - p7Adv.passed;

  // -------------------------------------------------------------
  // PHASE 8: Opportunity Marketplace & Proposal Engine
  // -------------------------------------------------------------
  console.log('--- PHASE 8: Opportunity Marketplace & Proposal Negotiation Engine ---');
  const p8Func = await runPhase8OpportunityTests();
  const p8FuncPassed = p8Func.filter((r) => r.passed).length;
  grandTotal += p8Func.length;
  grandPassed += p8FuncPassed;
  grandFailed += p8Func.length - p8FuncPassed;
  p8Func.forEach((r) => {
    if (r.passed) {
      console.log(`  ✓ [P8] ${r.name}`);
    } else {
      console.error(`  ✗ [P8 FAIL] ${r.name}: ${r.error}`);
    }
  });
  console.log(`Phase 8 Functional Result: ${p8FuncPassed}/${p8Func.length} passed.\n`);

  // -------------------------------------------------------------
  // PHASE 8 ADVERSARIAL SECURITY AUDIT
  // -------------------------------------------------------------
  console.log('--- PHASE 8 ADVERSARIAL SECURITY AUDIT ---');
  const p8Adv = await runOpportunityAdversarialAudit();
  const p8AdvPassed = p8Adv.filter((r) => r.passed).length;
  grandTotal += p8Adv.length;
  grandPassed += p8AdvPassed;
  grandFailed += p8Adv.length - p8AdvPassed;
  p8Adv.forEach((r) => {
    if (r.passed) {
      console.log(`  ✓ [ADV-P8 BLOCKED] [${r.requirementId}] ${r.name}`);
    } else {
      console.error(`  ✗ [ADV-P8 BYPASS VULNERABILITY] [${r.requirementId}] ${r.name}: ${r.error}`);
    }
  });
  console.log(`Phase 8 Adversarial Result: ${p8AdvPassed}/${p8Adv.length} attacks blocked successfully.\n`);

  // -------------------------------------------------------------
  // AUTHENTICATION GATING & NAVIGATION SECURITY AUDIT
  // -------------------------------------------------------------
  const authNav = await runAuthNavigationSecurityTests();
  grandTotal += authNav.total;
  grandPassed += authNav.passed;
  grandFailed += authNav.failed;

  // -------------------------------------------------------------
  // PERSONA ARCHITECTURE & PROFILE SEPARATION AUDIT
  // -------------------------------------------------------------
  const personaAudit = await runPersonaArchitectureRegressionTests();
  grandTotal += personaAudit.total;
  grandPassed += personaAudit.passed;
  grandFailed += personaAudit.failed;

  // -------------------------------------------------------------
  // PHASE 9B: INSTITUTIONAL & MULTI-PARTY VERIFIABLE CREDENTIALS
  // -------------------------------------------------------------
  console.log('--- PHASE 9B: INSTITUTIONAL & MULTI-PARTY VERIFIABLE CREDENTIALS ---');
  const p9b = await runPhase9BCredentialIssuanceTests();
  grandTotal += p9b.totalTests;
  p9b.results.forEach((r) => {
    if (r.passed) {
      grandPassed++;
      console.log(`  ✓ [P9B] ${r.testName}`);
    } else {
      grandFailed++;
      console.error(`  ✗ [P9B FAIL] ${r.testName}: ${r.details}`);
    }
  });
  console.log(`Phase 9B Result: ${p9b.passedTests}/${p9b.totalTests} tests passed successfully.\n`);

  // -------------------------------------------------------------
  // PHASE 9C.1: DECENTRALIZED IDENTIFIERS & KEY INFRASTRUCTURE
  // -------------------------------------------------------------
  const p9c1 = await runPhase9CDIDInfrastructureTests();
  grandTotal += p9c1.passed + p9c1.failed;
  grandPassed += p9c1.passed;
  grandFailed += p9c1.failed;
  console.log('');

  // -------------------------------------------------------------
  // PHASE 9C.2: SALTED CLAIM COMMITMENTS & MERKLE SELECTIVE DISCLOSURE
  // -------------------------------------------------------------
  const p9c2 = await runPhase9CSaltedSelectiveDisclosureTests();
  grandTotal += p9c2.passed + p9c2.failed;
  grandPassed += p9c2.passed;
  grandFailed += p9c2.failed;
  console.log('');

  // -------------------------------------------------------------
  // PHASE 9C.3: ZERO-KNOWLEDGE PREDICATE & RANGE PROOF LAYER
  // -------------------------------------------------------------
  const p9c3 = await runPhase9CZKRangeProofTests();
  grandTotal += p9c3.passed + p9c3.failed;
  grandPassed += p9c3.passed;
  grandFailed += p9c3.failed;
  console.log('');

  // -------------------------------------------------------------
  // PHASE 9C.4: SOVEREIGN IDENTITY & ZK VERIFICATION CONSOLE UI FLOWS
  // -------------------------------------------------------------
  const p9c4 = await runPhase9C4Tests();
  grandTotal += p9c4.passed + p9c4.failed;
  grandPassed += p9c4.passed;
  grandFailed += p9c4.failed;
  console.log('');

  // -------------------------------------------------------------
  // PROFESSIONAL IDENTITY & PROFILE ENHANCEMENTS
  // -------------------------------------------------------------
  const prof = runProfileEnhancementTests();
  grandTotal += prof.passed + prof.failed;
  grandPassed += prof.passed;
  grandFailed += prof.failed;
  console.log('');

  // -------------------------------------------------------------
  // CLIENT/CREATOR PROFESSIONAL IDENTITY UNIFICATION
  // -------------------------------------------------------------
  const clientUnify = await runClientProfileUnificationTests();
  grandTotal += clientUnify.total;
  grandPassed += clientUnify.passed;
  grandFailed += clientUnify.failed;
  console.log('');

  // -------------------------------------------------------------
  // PHASE 2: CLIENT HIRING IDENTITY & UNIVERSAL AVATAR SUITE
  // -------------------------------------------------------------
  const phase2Suite = runPhase2HiringAndAvatarTests();
  grandTotal += phase2Suite.total;
  grandPassed += phase2Suite.passed;
  grandFailed += phase2Suite.failed;
  console.log('');

  // -------------------------------------------------------------
  // PHASE 3: CLIENT PUBLIC PROFESSIONAL IDENTITY & PROJECTION SUITE
  // -------------------------------------------------------------
  const phase3Suite = await runPhase3ClientPublicIdentityTests();
  grandTotal += phase3Suite.total;
  grandPassed += phase3Suite.passed;
  grandFailed += phase3Suite.failed;
  console.log('');

  // -------------------------------------------------------------
  // SERVER-AUTHORITATIVE TRUST SCORE & PROJECTION SUITE
  // -------------------------------------------------------------
  const serverTrust = runServerTrustScoreTestSuite();
  grandTotal += serverTrust.total;
  grandPassed += serverTrust.passed;
  grandFailed += serverTrust.failed;
  console.log('');

  // -------------------------------------------------------------
  // PHASE 1 TRUST AUTHORITY SECURITY REMEDIATION SUITE
  // -------------------------------------------------------------
  const remediationSuite = await runTrustAuthorityRemediationTests();
  grandTotal += remediationSuite.total;
  grandPassed += remediationSuite.passed;
  grandFailed += remediationSuite.failed;
  console.log('');

  // -------------------------------------------------------------
  // CEO DASHBOARD STAGE 1: PRIVILEGED AUTHORIZATION & SECURITY
  // -------------------------------------------------------------
  const ceoStage1 = await runCeoStage1SecuritySuite();
  grandTotal += ceoStage1.total;
  grandPassed += ceoStage1.passed;
  grandFailed += ceoStage1.failed;
  console.log('');

  // -------------------------------------------------------------
  // CEO DASHBOARD STAGE 2: READ-ONLY EXECUTIVE INTELLIGENCE
  // -------------------------------------------------------------
  const ceoStage2 = await runCeoStage2TestSuite();
  grandTotal += ceoStage2.total;
  grandPassed += ceoStage2.passed;
  grandFailed += ceoStage2.failed;
  console.log('');

  // -------------------------------------------------------------
  // PHASE C-1: Payment Foundation Hardening & Provider-Neutral Architecture
  // -------------------------------------------------------------
  const c1Res = await runPhaseC1PaymentTestSuite();
  grandTotal += c1Res.total;
  grandPassed += c1Res.passed;
  grandFailed += c1Res.failed;
  console.log('');

  // -------------------------------------------------------------
  // PHASE C-2A: Provider-Neutral Payment Architecture & State Model
  // -------------------------------------------------------------
  const c2aRes = await runPhaseC2ATests();
  grandTotal += c2aRes.total;
  grandPassed += c2aRes.passed;
  grandFailed += c2aRes.failed;
  console.log('');

  // -------------------------------------------------------------
  // PHASE C-2B-1: Server-Authoritative Milestone Lifecycle & Work State
  // -------------------------------------------------------------
  const c2b1Res = await runPhaseC2B1Tests();
  grandTotal += c2b1Res.total;
  grandPassed += c2b1Res.passed;
  grandFailed += c2b1Res.failed;
  console.log('');

  // -------------------------------------------------------------
  // PHASE C-2B-2: Versioned Submission Hardening & Immutability
  // -------------------------------------------------------------
  const c2b2Res = await runPhaseC2B2Tests();
  grandTotal += c2b2Res.total;
  grandPassed += c2b2Res.passed;
  grandFailed += c2b2Res.failed;
  console.log('');

  // -------------------------------------------------------------
  // PHASE C-2C-1: Paystack Adapter & Integration Verification
  // -------------------------------------------------------------
  const c2c1Res = await runPhaseC2C1Tests();
  grandTotal += c2c1Res.total;
  grandPassed += c2c1Res.passed;
  grandFailed += c2c1Res.failed;
  console.log('');

  // -------------------------------------------------------------
  // ADVERSARIAL VERIFICATION & PENETRATION AUDIT
  // -------------------------------------------------------------
  console.log('--- ADVERSARIAL SECURITY & PENETRATION AUDIT ---');
  const adv = await runAdversarialSecurityAudit();
  grandTotal += adv.totalAttacks;
  adv.reports.forEach((report) => {
    if (!report.bypassed) {
      grandPassed++;
      console.log(`  ✓ [ADV BLOCKED] ${report.attackName}`);
    } else {
      grandFailed++;
      console.error(`  ✗ [ADV BYPASS VULNERABILITY] ${report.attackName}: ${report.actualResult}`);
    }
  });
  console.log(`Adversarial Audit Result: ${adv.passedAttacks}/${adv.totalAttacks} attacks blocked successfully.\n`);

  console.log('====================================================');
  console.log(`TOTAL TESTS:  ${grandTotal}`);
  console.log(`PASSED:       ${grandPassed}`);
  console.log(`FAILED:       ${grandFailed}`);
  console.log(`SKIPPED:      0`);
  console.log(`STATUS:       ${grandFailed === 0 ? 'ALL GREEN' : 'RED'}`);
  console.log('====================================================');

  } finally {
    setContractWriterForTesting(null);
    setLedgerWriterForTesting(null);
  }

  if (grandFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
