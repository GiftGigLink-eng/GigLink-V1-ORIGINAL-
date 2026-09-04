import {
  issueVerifiableCredential,
  bulkIssueVerifiableCredentials,
  claimVerifiableCredential,
  rejectVerifiableCredential,
  revokeVerifiableCredential,
  verifyCredentialCryptographicProof,
  computeCredentialCanonicalHash,
  exportCredentialAsW3CJsonLd,
  calculateCredentialTrustImpact,
} from '../lib/credentialIssuanceService';
import {
  CredentialIssuerProfile,
  CredentialIssuanceInput,
  VerifiableCredential,
} from '../types/credential';
import { UserProfile } from '../types';

export interface Phase9BTestReport {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: { testName: string; passed: boolean; details?: string }[];
}

export async function runPhase9BCredentialIssuanceTests(): Promise<Phase9BTestReport> {
  const results: { testName: string; passed: boolean; details?: string }[] = [];

  const mockIssuer: CredentialIssuerProfile = {
    orgId: 'org_mit_eecs',
    orgName: 'MIT School of Engineering',
    orgType: 'institution',
    officialEmailDomain: 'mit.edu',
    accreditationDetails: 'Accredited Institutional Verifier Member #2026-MIT',
    issuerAdminUid: 'admin_dean_johnson',
    issuerAdminName: 'Dean Robert Johnson',
    issuerAdminTitle: 'Dean of Engineering',
    isVerifiedIssuer: true,
  };

  const mockRecipientUser: UserProfile = {
    uid: 'talent_alice_99',
    email: 'alice.smith@example.com',
    displayName: 'Alice Smith',
    activePersona: 'talent',
    availablePersonas: ['talent'],
    activeRole: 'talent',
    allowedRoles: ['talent'],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockAttackerUser: UserProfile = {
    uid: 'attacker_eve_01',
    email: 'eve.hacker@darknet.io',
    displayName: 'Eve Hacker',
    activePersona: 'talent',
    availablePersonas: ['talent'],
    activeRole: 'talent',
    allowedRoles: ['talent'],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Test 1: Valid Credential Issuance & Cryptographic Seal Generation
  try {
    const input: CredentialIssuanceInput = {
      title: 'Advanced Distributed Systems & Consensus Architectures',
      credentialType: 'degree',
      description: 'Rigorous coursework spanning Paxos, Raft, Byzantine Fault Tolerance, and verifiable compute.',
      recipientName: 'Alice Smith',
      recipientEmail: 'alice.smith@example.com',
      recipientUid: 'talent_alice_99',
      skills: ['Distributed Systems', 'Consensus Algorithms', 'Raft', 'Rust'],
      criteria: 'Passed capstone distributed KV-store evaluation with 98% test coverage and formal TLA+ verification.',
      achievementGrade: 'Summa Cum Laude',
    };

    const cred = await issueVerifiableCredential(mockIssuer, input);

    const passed =
      cred.id.startsWith('cred_') &&
      cred.claimStatus === 'issued' &&
      cred.cryptographicProof.payloadDigest.length > 20 &&
      cred.cryptographicProof.signature.startsWith('sig_gl2026_') &&
      cred.trustScoreImpact === 15;

    results.push({
      testName: 'Phase 9B.1: Valid Credential Issuance & Cryptographic Seal Generation',
      passed,
      details: passed ? 'Cryptographic seal and canonical SHA-256 digest minted successfully.' : 'Field verification failed.',
    });
  } catch (err: any) {
    results.push({
      testName: 'Phase 9B.1: Valid Credential Issuance & Cryptographic Seal Generation',
      passed: false,
      details: err.message,
    });
  }

  // Test 2: Deterministic Verification of Authentic Untampered Credential
  try {
    const input: CredentialIssuanceInput = {
      title: 'Full-Stack TypeScript & Cloud Architecture',
      credentialType: 'course_certificate',
      description: 'Professional certificate in modern cloud design patterns.',
      recipientName: 'Alice Smith',
      recipientEmail: 'alice.smith@example.com',
      skills: ['TypeScript', 'Node.js', 'Firestore'],
      criteria: '100 hours of lab work and production deployments.',
    };

    const cred = await issueVerifiableCredential(mockIssuer, input);
    const verification = await verifyCredentialCryptographicProof(cred);

    const passed = verification.isValid === true && verification.status === 'verified' && verification.issuerVerified === true;

    results.push({
      testName: 'Phase 9B.2: Verification of Authentic Untampered Credential',
      passed,
      details: passed ? 'Proof verification returned isValid=true and status=verified.' : `Verification status: ${verification.status}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'Phase 9B.2: Verification of Authentic Untampered Credential',
      passed: false,
      details: err.message,
    });
  }

  // Test 3: Adversarial Bit-Flip / Tamper Attack Detection (Payload Alteration)
  try {
    const input: CredentialIssuanceInput = {
      title: 'Machine Learning Engineering Level 1',
      credentialType: 'skill_badge',
      description: 'Foundational ML certification.',
      recipientName: 'Alice Smith',
      recipientEmail: 'alice.smith@example.com',
      skills: ['PyTorch', 'Linear Algebra'],
      criteria: 'Completed 5 standard supervised learning projects.',
      achievementGrade: 'Pass',
    };

    const cred = await issueVerifiableCredential(mockIssuer, input);

    // Adversary modifies achievementGrade from "Pass" to "Top 1% Honors" without re-signing
    const tamperedCred: VerifiableCredential = {
      ...cred,
      achievementGrade: 'Top 1% Honors (Tampered)',
    };

    const verification = await verifyCredentialCryptographicProof(tamperedCred);

    const passed = verification.isValid === false && verification.status === 'tampered';

    results.push({
      testName: 'Phase 9B.3: Adversarial Bit-Flip / Tamper Attack Detection',
      passed,
      details: passed ? 'Hash mismatch caught! Status=tampered, isValid=false.' : 'Failed: Tampered credential was not rejected.',
    });
  } catch (err: any) {
    results.push({
      testName: 'Phase 9B.3: Adversarial Bit-Flip / Tamper Attack Detection',
      passed: false,
      details: err.message,
    });
  }

  // Test 4: Adversarial Recipient Hijack Attack (Unauthorized Claim)
  try {
    const input: CredentialIssuanceInput = {
      title: 'Doctor of Philosophy in Computer Science',
      credentialType: 'degree',
      description: 'Doctoral dissertation award.',
      recipientName: 'Alice Smith',
      recipientEmail: 'alice.smith@example.com',
      recipientUid: 'talent_alice_99',
      skills: ['Quantum Computing'],
      criteria: 'Dissertation defense approved.',
    };

    const cred = await issueVerifiableCredential(mockIssuer, input);

    let caughtUnauthorized = false;
    try {
      // Eve attempts to claim Alice's degree
      await claimVerifiableCredential(cred.id, mockAttackerUser.uid, mockAttackerUser);
    } catch (err: any) {
      if (err.message.includes('Unauthorized')) {
        caughtUnauthorized = true;
      }
    }

    results.push({
      testName: 'Phase 9B.4: Adversarial Recipient Hijack Attack (Unauthorized Claim Blocked)',
      passed: caughtUnauthorized,
      details: caughtUnauthorized ? 'Unauthorized claiming by non-recipient strictly rejected.' : 'Security defect: Eve hijacked Alice\'s credential.',
    });
  } catch (err: any) {
    results.push({
      testName: 'Phase 9B.4: Adversarial Recipient Hijack Attack',
      passed: false,
      details: err.message,
    });
  }

  // Test 5: Legitimate Recipient Claim Lifecycle & Passport Sync
  try {
    const input: CredentialIssuanceInput = {
      title: 'Enterprise Security Architect Accreditation',
      credentialType: 'enterprise_accreditation',
      description: 'Zero-trust architecture and SOC2 compliance.',
      recipientName: 'Alice Smith',
      recipientEmail: 'alice.smith@example.com',
      recipientUid: 'talent_alice_99',
      skills: ['SOC2', 'Zero-Trust', 'OAuth2'],
      criteria: 'Audited enterprise security infrastructure.',
    };

    const cred = await issueVerifiableCredential(mockIssuer, input);
    const claimedCred = await claimVerifiableCredential(cred.id, mockRecipientUser.uid, mockRecipientUser);

    const passed =
      claimedCred.claimStatus === 'claimed' &&
      claimedCred.claimedAt !== undefined &&
      claimedCred.recipient.recipientUid === mockRecipientUser.uid;

    results.push({
      testName: 'Phase 9B.5: Legitimate Recipient Claim Lifecycle & Passport Sync',
      passed,
      details: passed ? 'Credential transitioned to claimed status with audit timestamp.' : 'Claim lifecycle failed.',
    });
  } catch (err: any) {
    results.push({
      testName: 'Phase 9B.5: Legitimate Recipient Claim Lifecycle',
      passed: false,
      details: err.message,
    });
  }

  // Test 6: Recipient Rejection Lifecycle
  try {
    const input: CredentialIssuanceInput = {
      title: 'Unsolicited Marketing Badge',
      credentialType: 'skill_badge',
      description: 'Unwanted attestation.',
      recipientName: 'Alice Smith',
      recipientEmail: 'alice.smith@example.com',
      skills: ['Spam'],
      criteria: 'Random promotion.',
    };

    const cred = await issueVerifiableCredential(mockIssuer, input);
    const rejectedCred = await rejectVerifiableCredential(cred.id, mockRecipientUser.uid, mockRecipientUser.email, 'Not relevant to my professional portfolio.');

    const passed =
      rejectedCred.claimStatus === 'rejected' &&
      rejectedCred.rejectedAt !== undefined &&
      rejectedCred.rejectionReason === 'Not relevant to my professional portfolio.';

    results.push({
      testName: 'Phase 9B.6: Recipient Rejection Lifecycle',
      passed,
      details: passed ? 'Credential safely declined with custom reason.' : 'Rejection lifecycle failed.',
    });
  } catch (err: any) {
    results.push({
      testName: 'Phase 9B.6: Recipient Rejection Lifecycle',
      passed: false,
      details: err.message,
    });
  }

  // Test 7: Adversarial Unauthorized Revocation Blocked
  try {
    const input: CredentialIssuanceInput = {
      title: 'Cybersecurity Certification',
      credentialType: 'course_certificate',
      description: 'Network Defense.',
      recipientName: 'Alice Smith',
      recipientEmail: 'alice.smith@example.com',
      skills: ['Penetration Testing'],
      criteria: 'Exam passed.',
    };

    const cred = await issueVerifiableCredential(mockIssuer, input);

    let caughtUnauthorized = false;
    try {
      // Attacker attempts to revoke someone else's credential
      await revokeVerifiableCredential(cred.id, 'unauthorized_attacker_uid', 'Fake Admin', 'Malicious cancellation');
    } catch (err: any) {
      if (err.message.includes('Unauthorized')) {
        caughtUnauthorized = true;
      }
    }

    results.push({
      testName: 'Phase 9B.7: Adversarial Unauthorized Revocation Blocked',
      passed: caughtUnauthorized,
      details: caughtUnauthorized ? 'Unauthorized non-issuer revocation blocked.' : 'Security defect: Unauthorized revocation permitted.',
    });
  } catch (err: any) {
    results.push({
      testName: 'Phase 9B.7: Adversarial Unauthorized Revocation Blocked',
      passed: false,
      details: err.message,
    });
  }

  // Test 8: Legitimate Issuer Revocation & Cryptographic Invalidation
  try {
    const input: CredentialIssuanceInput = {
      title: 'State Engineering License',
      credentialType: 'license',
      description: 'Professional Engineering License #7890.',
      recipientName: 'Alice Smith',
      recipientEmail: 'alice.smith@example.com',
      skills: ['Structural Engineering'],
      criteria: 'State board examination.',
    };

    const cred = await issueVerifiableCredential(mockIssuer, input);
    const revokedCred = await revokeVerifiableCredential(
      cred.id,
      mockIssuer.issuerAdminUid,
      mockIssuer.issuerAdminName,
      'License expired without required continuing education credits.'
    );

    const verification = await verifyCredentialCryptographicProof(revokedCred);

    const passed =
      revokedCred.claimStatus === 'revoked' &&
      revokedCred.revocationStatus?.isRevoked === true &&
      verification.isValid === false &&
      verification.status === 'revoked';

    results.push({
      testName: 'Phase 9B.8: Legitimate Issuer Revocation & Cryptographic Invalidation',
      passed,
      details: passed ? 'Revocation recorded on ledger; public audit immediately flags status=revoked.' : 'Revocation flow failed.',
    });
  } catch (err: any) {
    results.push({
      testName: 'Phase 9B.8: Legitimate Issuer Revocation',
      passed: false,
      details: err.message,
    });
  }

  // Test 9: Adversarial Claiming of Revoked Credential Blocked
  try {
    const input: CredentialIssuanceInput = {
      title: 'Cancelled Credential',
      credentialType: 'course_certificate',
      description: 'Cancelled course.',
      recipientName: 'Alice Smith',
      recipientEmail: 'alice.smith@example.com',
      skills: ['Math'],
      criteria: 'Course.',
    };

    const cred = await issueVerifiableCredential(mockIssuer, input);
    await revokeVerifiableCredential(cred.id, mockIssuer.issuerAdminUid, mockIssuer.issuerAdminName, 'Administrative cancellation');

    let caughtRevokedClaim = false;
    try {
      await claimVerifiableCredential(cred.id, mockRecipientUser.uid, mockRecipientUser);
    } catch (err: any) {
      if (err.message.includes('revoked')) {
        caughtRevokedClaim = true;
      }
    }

    results.push({
      testName: 'Phase 9B.9: Adversarial Claiming of Revoked Credential Blocked',
      passed: caughtRevokedClaim,
      details: caughtRevokedClaim ? 'Attempt to claim revoked credential prevented.' : 'Security defect: Revoked credential was claimed.',
    });
  } catch (err: any) {
    results.push({
      testName: 'Phase 9B.9: Claiming Revoked Credential Blocked',
      passed: false,
      details: err.message,
    });
  }

  // Test 10: Expiration Integrity Verification
  try {
    const input: CredentialIssuanceInput = {
      title: 'Time-Limited Safety Certificate',
      credentialType: 'assessment',
      description: 'Annual safety compliance test.',
      recipientName: 'Alice Smith',
      recipientEmail: 'alice.smith@example.com',
      skills: ['Safety Compliance'],
      criteria: 'Score 100% on annual safety test.',
      expiresAt: new Date(Date.now() - 86400000).toISOString(), // Expired yesterday
    };

    const cred = await issueVerifiableCredential(mockIssuer, input);
    const verification = await verifyCredentialCryptographicProof(cred);

    const passed = verification.isValid === false && verification.status === 'expired';

    results.push({
      testName: 'Phase 9B.10: Expiration Integrity Verification',
      passed,
      details: passed ? 'Expired credential identified and marked status=expired.' : 'Failed: Expired credential was verified.',
    });
  } catch (err: any) {
    results.push({
      testName: 'Phase 9B.10: Expiration Integrity Verification',
      passed: false,
      details: err.message,
    });
  }

  // Test 11: Bulk Cohort Batch Issuance
  try {
    const cohortInputs: CredentialIssuanceInput[] = [
      {
        title: 'Cloud Native Practitioner',
        credentialType: 'course_certificate',
        description: 'Cohort 2026 graduate.',
        recipientName: 'Student Alpha',
        recipientEmail: 'alpha@school.edu',
        skills: ['Kubernetes', 'Docker'],
        criteria: 'Completed 6 labs.',
      },
      {
        title: 'Cloud Native Practitioner',
        credentialType: 'course_certificate',
        description: 'Cohort 2026 graduate.',
        recipientName: 'Student Beta',
        recipientEmail: 'beta@school.edu',
        skills: ['Kubernetes', 'Docker'],
        criteria: 'Completed 6 labs.',
      },
    ];

    const bulkRes = await bulkIssueVerifiableCredentials(mockIssuer, cohortInputs, 'Spring 2026 Batch');

    const passed =
      bulkRes.totalIssued === 2 &&
      bulkRes.batchId.includes('spring_2026_batch') &&
      bulkRes.credentials.length === 2 &&
      bulkRes.credentials[0].id !== bulkRes.credentials[1].id &&
      bulkRes.credentials[0].cryptographicProof.signature !== bulkRes.credentials[1].cryptographicProof.signature;

    results.push({
      testName: 'Phase 9B.11: Bulk Cohort Batch Issuance with Distinct Cryptographic Digests',
      passed,
      details: passed ? 'Bulk cohort minted with shared batchId and unique cryptographic signatures.' : 'Bulk issuance failed.',
    });
  } catch (err: any) {
    results.push({
      testName: 'Phase 9B.11: Bulk Cohort Batch Issuance',
      passed: false,
      details: err.message,
    });
  }

  // Test 12: W3C Verifiable Credential JSON-LD Compliance
  try {
    const input: CredentialIssuanceInput = {
      title: 'W3C Standard Verifiable Diploma',
      credentialType: 'degree',
      description: 'W3C VC 1.1 compliant export.',
      recipientName: 'Alice Smith',
      recipientEmail: 'alice.smith@example.com',
      recipientUid: 'talent_alice_99',
      skills: ['Cryptography', 'JSON-LD'],
      criteria: 'Standard validation.',
    };

    const cred = await issueVerifiableCredential(mockIssuer, input);
    const jsonLdStr = exportCredentialAsW3CJsonLd(cred);
    const parsed = JSON.parse(jsonLdStr);

    const passed =
      Array.isArray(parsed['@context']) &&
      parsed.type.includes('VerifiableCredential') &&
      parsed.issuer.name === mockIssuer.orgName &&
      parsed.credentialSubject.name === 'Alice Smith' &&
      parsed.proof.type === 'GigLinkInstitutionalCredential2026' &&
      parsed.proof.payloadDigest === cred.cryptographicProof.payloadDigest;

    results.push({
      testName: 'Phase 9B.12: W3C Verifiable Credential JSON-LD Interoperability',
      passed,
      details: passed ? 'Export conforms to W3C Verifiable Credentials Data Model v1.1.' : 'JSON-LD structure invalid.',
    });
  } catch (err: any) {
    results.push({
      testName: 'Phase 9B.12: W3C Verifiable Credential JSON-LD Interoperability',
      passed: false,
      details: err.message,
    });
  }

  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.filter((r) => !r.passed).length;

  return {
    suiteName: 'Phase 9B: Institutional & Multi-Party Verifiable Credentials',
    totalTests: results.length,
    passedTests,
    failedTests,
    results,
  };
}
