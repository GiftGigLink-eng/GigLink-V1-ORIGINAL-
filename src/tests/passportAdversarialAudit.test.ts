import {
  generateProjectProofArtifact,
  computeCanonicalProofHash,
  verifyProofIntegrity,
} from '../lib/passportService';
import { submitContractFeedback } from '../lib/feedbackService';
import { GigLinkContract } from '../types';
import { FinancialLedgerRecord } from '../types/financial';
import { PublicProjectProof, CanonicalProofData } from '../types/passport';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function runPhase7AdversarialTests(): Promise<{ passed: number; total: number; errors: string[] }> {
  let passed = 0;
  let total = 0;
  const errors: string[] = [];

  function assertBlocked(condition: boolean, attackName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✓ [P7 ADV BLOCKED] ${attackName}`);
      passed++;
    } else {
      console.error(`  ✗ [P7 ADV VULNERABILITY] ${attackName}: ${detail || 'Attack was not blocked'}`);
      errors.push(`${attackName}: ${detail || 'Attack was not blocked'}`);
    }
  }

  console.log('\n--- PHASE 7 ADVERSARIAL SECURITY AUDIT ---');

  // ADV-01: Forged ProjectProof Creation on Uncompleted (Active / In Dispute / Draft) Contract
  try {
    const activeContract: GigLinkContract = {
      id: 'contract_adv_active',
      opportunityId: 'opp_adv1',
      opportunityTitle: 'Active Unsettled Contract',
      applicationId: 'app_adv1',
      creatorId: 'c1',
      talentId: 't1',
      version: 1,
      status: 'active',
      conversationId: 'conv_adv1',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      creatorAcceptance: { accepted: true },
      talentAcceptance: { accepted: true },
      scopeLock: {
        title: 'Active Scope',
        description: 'Test scope',
        inclusions: [],
        exclusions: [],
        deliverables: ['Active deliverable'],
        totalAmount: 5000,
        currency: 'USD',
        revisionAllowance: 2,
      },
      milestones: [
        {
          id: 'm1',
          contractId: 'contract_adv_active',
          title: 'Active Work',
          description: 'In progress work',
          deliverables: ['deliverable'],
          amount: 5000,
          currency: 'USD',
          status: 'in_progress',
          revisionAllowance: 2,
          revisionCount: 0,
          paymentState: 'held',
          reviewState: 'in_review',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    };
    let blocked = false;
    try {
      await generateProjectProofArtifact(activeContract, [], 'c1_handle', 't1_handle');
    } catch (e) {
      blocked = true;
    }
    assertBlocked(
      blocked,
      'ADV-P7-01: Forged ProjectProof generation on uncompleted active contract rejected'
    );
  } catch (err: any) {
    assertBlocked(false, 'ADV-P7-01', err.message);
  }

  // ADV-02: Proof Creation Before Milestones Are Approved and Settled
  try {
    const unsettledContract: GigLinkContract = {
      id: 'contract_adv_unsettled',
      opportunityId: 'opp_adv2',
      opportunityTitle: 'Unsettled Completed Contract',
      applicationId: 'app_adv2',
      creatorId: 'c2',
      talentId: 't2',
      version: 1,
      status: 'completed',
      conversationId: 'conv_adv2',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      creatorAcceptance: { accepted: true },
      talentAcceptance: { accepted: true },
      scopeLock: {
        title: 'Unsettled Scope',
        description: 'Test scope',
        inclusions: [],
        exclusions: [],
        deliverables: ['Rejected deliverable'],
        totalAmount: 5000,
        currency: 'USD',
        revisionAllowance: 2,
      },
      milestones: [
        {
          id: 'm1',
          contractId: 'contract_adv_unsettled',
          title: 'Rejected Work',
          description: 'Rejected',
          deliverables: ['rejected'],
          amount: 5000,
          currency: 'USD',
          status: 'in_progress',
          revisionAllowance: 2,
          revisionCount: 0,
          paymentState: 'held',
          reviewState: 'revision_requested', // Not approved
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    };
    let blocked = false;
    try {
      await generateProjectProofArtifact(unsettledContract, [], 'c2_handle', 't2_handle');
    } catch (e) {
      blocked = true;
    }
    assertBlocked(
      blocked,
      'ADV-P7-02: Proof generation on contract with unapproved milestones rejected'
    );
  } catch (err: any) {
    assertBlocked(false, 'ADV-P7-02', err.message);
  }

  // ADV-03: Direct Client SDK Attempt to Write / Forge a ProjectProof Document
  try {
    let directWriteBlocked = false;
    try {
      const proofRef = doc(db, 'projectProofs', 'forged_proof_client');
      await setDoc(proofRef, {
        id: 'forged_proof_client',
        projectTitle: 'Fabricated Enterprise Contract',
        category: 'Development',
        creatorPublicHandle: 'hacker',
        talentPublicHandle: 'victim',
        completedAt: new Date().toISOString(),
        deliverablesSummary: ['Fake Deliverable'],
        skillsDemonstrated: ['hacking'],
        volumeTier: 'tier_enterprise',
        verificationHash: '0000000000000000000000000000000000000000000000000000000000000000',
        verifiedByPlatform: true,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      directWriteBlocked = true;
    }
    assertBlocked(
      directWriteBlocked,
      'ADV-P7-03: Direct unauthenticated / non-admin client SDK write to /projectProofs blocked by Firestore rules'
    );
  } catch (err: any) {
    assertBlocked(false, 'ADV-P7-03', err.message);
  }

  // ADV-04: Direct Client Mutation / Deletion of an Existing Proof Record
  try {
    let updateBlocked = false;
    let deleteBlocked = false;
    try {
      const proofRef = doc(db, 'projectProofs', 'proof_contract_705');
      await updateDoc(proofRef, { volumeTier: 'tier_enterprise' });
    } catch (e) {
      updateBlocked = true;
    }
    try {
      const proofRef = doc(db, 'projectProofs', 'proof_contract_705');
      await deleteDoc(proofRef);
    } catch (e) {
      deleteBlocked = true;
    }
    assertBlocked(
      updateBlocked && deleteBlocked,
      'ADV-P7-04: Direct modification or deletion of /projectProofs documents blocked by immutability invariant'
    );
  } catch (err: any) {
    assertBlocked(false, 'ADV-P7-04', err.message);
  }

  // ADV-05: Feedback Submission from a Third-Party Stranger
  try {
    const contract: GigLinkContract = {
      id: 'contract_adv_fb1',
      opportunityId: 'opp_adv_fb1',
      opportunityTitle: 'Completed Design Project',
      applicationId: 'app_adv_fb1',
      creatorId: 'creator_legit',
      talentId: 'talent_legit',
      version: 1,
      status: 'completed',
      conversationId: 'conv_adv_fb1',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      creatorAcceptance: { accepted: true },
      talentAcceptance: { accepted: true },
      scopeLock: {
        title: 'Design Project',
        description: 'Completed design',
        inclusions: [],
        exclusions: [],
        deliverables: [],
        totalAmount: 1000,
        currency: 'USD',
        revisionAllowance: 2,
      },
      milestones: [],
    };
    let strangerBlocked = false;
    try {
      await submitContractFeedback({
        contract,
        authorId: 'attacker_stranger', // Stranger
        ratingOverall: 1,
        ratingCommunication: 1,
        ratingQuality: 1,
        ratingTimeliness: 1,
        comment: 'Fake negative review to hurt reputation',
        isPublic: true,
      });
    } catch (e) {
      strangerBlocked = true;
    }
    assertBlocked(
      strangerBlocked,
      'ADV-P7-05: Third-party stranger feedback submission blocked by authorization boundary'
    );
  } catch (err: any) {
    assertBlocked(false, 'ADV-P7-05', err.message);
  }

  // ADV-06: Self-Review / Vanity Rating Attack
  try {
    const contract: GigLinkContract = {
      id: 'contract_adv_self',
      opportunityId: 'opp_adv_self',
      opportunityTitle: 'Self-Review Attack',
      applicationId: 'app_adv_self',
      creatorId: 'user_same',
      talentId: 'user_same',
      version: 1,
      status: 'completed',
      conversationId: 'conv_adv_self',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      creatorAcceptance: { accepted: true },
      talentAcceptance: { accepted: true },
      scopeLock: {
        title: 'Self Scope',
        description: 'Self test',
        inclusions: [],
        exclusions: [],
        deliverables: [],
        totalAmount: 1000,
        currency: 'USD',
        revisionAllowance: 2,
      },
      milestones: [],
    };
    let selfReviewBlocked = false;
    try {
      await submitContractFeedback({
        contract,
        authorId: 'user_same',
        ratingOverall: 5,
        ratingCommunication: 5,
        ratingQuality: 5,
        ratingTimeliness: 5,
        comment: 'I am the greatest developer in the world!',
        isPublic: true,
      });
    } catch (e) {
      selfReviewBlocked = true;
    }
    assertBlocked(
      selfReviewBlocked,
      'ADV-P7-06: Self-review / vanity rating injection blocked'
    );
  } catch (err: any) {
    assertBlocked(false, 'ADV-P7-06', err.message);
  }

  // ADV-07: Duplicate Feedback / Replay Attack on the Same Contract
  try {
    const contract: GigLinkContract = {
      id: 'contract_adv_dup',
      opportunityId: 'opp_adv_dup',
      opportunityTitle: 'Duplicate Review Test',
      applicationId: 'app_adv_dup',
      creatorId: 'creator_dup',
      talentId: 'talent_dup',
      version: 1,
      status: 'completed',
      conversationId: 'conv_adv_dup',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      creatorAcceptance: { accepted: true },
      talentAcceptance: { accepted: true },
      scopeLock: {
        title: 'Duplicate Review Test',
        description: 'Test',
        inclusions: [],
        exclusions: [],
        deliverables: [],
        totalAmount: 1000,
        currency: 'USD',
        revisionAllowance: 2,
      },
      milestones: [],
    };
    // First review succeeds
    await submitContractFeedback({
      contract,
      authorId: 'creator_dup',
      ratingOverall: 5,
      ratingCommunication: 5,
      ratingQuality: 5,
      ratingTimeliness: 5,
      comment: 'First legitimate review.',
      isPublic: true,
    });
    // Second duplicate review should be blocked
    let duplicateBlocked = false;
    try {
      await submitContractFeedback({
        contract,
        authorId: 'creator_dup',
        ratingOverall: 5,
        ratingCommunication: 5,
        ratingQuality: 5,
        ratingTimeliness: 5,
        comment: 'Second spammed review.',
        isPublic: true,
      });
    } catch (e) {
      duplicateBlocked = true;
    }
    assertBlocked(
      duplicateBlocked,
      'ADV-P7-07: Duplicate feedback replay attack on the same contract blocked by deterministic document ID'
    );
  } catch (err: any) {
    assertBlocked(false, 'ADV-P7-07', err.message);
  }

  // ADV-08: Feedback on Uncompleted (Active / Cancelled / In Dispute) Contract
  try {
    const cancelledContract: GigLinkContract = {
      id: 'contract_adv_cancelled',
      opportunityId: 'opp_adv_cancelled',
      opportunityTitle: 'Cancelled Project',
      applicationId: 'app_adv_cancelled',
      creatorId: 'c_canc',
      talentId: 't_canc',
      version: 1,
      status: 'cancelled',
      conversationId: 'conv_adv_cancelled',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      creatorAcceptance: { accepted: true },
      talentAcceptance: { accepted: true },
      scopeLock: {
        title: 'Cancelled Project',
        description: 'Test',
        inclusions: [],
        exclusions: [],
        deliverables: [],
        totalAmount: 1000,
        currency: 'USD',
        revisionAllowance: 2,
      },
      milestones: [],
    };
    let cancelledBlocked = false;
    try {
      await submitContractFeedback({
        contract: cancelledContract,
        authorId: 'c_canc',
        ratingOverall: 1,
        ratingCommunication: 1,
        ratingQuality: 1,
        ratingTimeliness: 1,
        comment: 'Retaliatory review on cancelled contract.',
        isPublic: true,
      });
    } catch (e) {
      cancelledBlocked = true;
    }
    assertBlocked(
      cancelledBlocked,
      'ADV-P7-08: Review submission on cancelled contract blocked'
    );
  } catch (err: any) {
    assertBlocked(false, 'ADV-P7-08', err.message);
  }

  // ADV-09: Invalid Rating Boundary Injection (< 1 or > 5 or Non-Integer)
  try {
    const contract: GigLinkContract = {
      id: 'contract_adv_rating',
      opportunityId: 'opp_adv_rating',
      opportunityTitle: 'Rating Bounds Test',
      applicationId: 'app_adv_rating',
      creatorId: 'c_rate',
      talentId: 't_rate',
      version: 1,
      status: 'completed',
      conversationId: 'conv_adv_rating',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      creatorAcceptance: { accepted: true },
      talentAcceptance: { accepted: true },
      scopeLock: {
        title: 'Rating Test',
        description: 'Test',
        inclusions: [],
        exclusions: [],
        deliverables: [],
        totalAmount: 1000,
        currency: 'USD',
        revisionAllowance: 2,
      },
      milestones: [],
    };
    let forgedRatingBlocked = false;
    try {
      await submitContractFeedback({
        contract,
        authorId: 'c_rate',
        ratingOverall: 100, // Invalid: exceeds 5
        ratingCommunication: 5,
        ratingQuality: 5,
        ratingTimeliness: 5,
        comment: 'Inflated 100 star rating!',
        isPublic: true,
      });
    } catch (e) {
      forgedRatingBlocked = true;
    }
    assertBlocked(
      forgedRatingBlocked,
      'ADV-P7-09: Forged rating out of bounds (> 5) blocked by validation rule'
    );
  } catch (err: any) {
    assertBlocked(false, 'ADV-P7-09', err.message);
  }

  // ADV-10: Tampered Verification Hash Detection
  try {
    const authenticProof: PublicProjectProof = {
      id: 'proof_tamper_test',
      projectTitle: 'Authentic High Value Contract',
      category: 'Backend Architecture',
      creatorPublicHandle: 'corp_client',
      talentPublicHandle: 'expert_dev',
      completedAt: '2026-08-20T12:00:00.000Z',
      deliverablesSummary: ['Database Architecture', 'Microservice Auth'],
      skillsDemonstrated: ['postgresql', 'docker'],
      volumeTier: 'tier_high_value',
      verificationHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // Valid placeholder
      verifiedByPlatform: true,
      createdAt: '2026-08-20T12:00:00.000Z',
    };

    // Calculate real canonical hash
    const realHash = await computeCanonicalProofHash({
      category: authenticProof.category,
      completedAt: authenticProof.completedAt,
      creatorPublicHandle: authenticProof.creatorPublicHandle,
      deliverablesSummary: authenticProof.deliverablesSummary,
      skillsDemonstrated: authenticProof.skillsDemonstrated,
      talentPublicHandle: authenticProof.talentPublicHandle,
      volumeTier: authenticProof.volumeTier,
    });
    authenticProof.verificationHash = realHash;

    // Tamper with volume tier
    const tamperedProof = { ...authenticProof, volumeTier: 'tier_enterprise' as any };
    const isTamperedValid = await verifyProofIntegrity(tamperedProof);

    assertBlocked(
      isTamperedValid === false,
      'ADV-P7-10: Cryptographic audit detects tampered volume tier in project proof'
    );
  } catch (err: any) {
    assertBlocked(false, 'ADV-P7-10', err.message);
  }

  // ADV-11: Tampered Deliverable Insertion Detection
  try {
    const basePayload: CanonicalProofData = {
      category: 'Cloud Engineering',
      completedAt: '2026-08-21T00:00:00.000Z',
      creatorPublicHandle: 'acme_corp',
      deliverablesSummary: ['Kubernetes Cluster Setup'],
      skillsDemonstrated: ['kubernetes', 'terraform'],
      talentPublicHandle: 'devops_ninja',
      volumeTier: 'tier_established',
    };
    const legitimateHash = await computeCanonicalProofHash(basePayload);

    const forgedProof: PublicProjectProof = {
      id: 'proof_forged_deliv',
      projectTitle: 'Cloud Deployment',
      category: basePayload.category,
      creatorPublicHandle: basePayload.creatorPublicHandle,
      talentPublicHandle: basePayload.talentPublicHandle,
      completedAt: basePayload.completedAt,
      deliverablesSummary: ['Kubernetes Cluster Setup', 'Fake Enterprise AI Model'], // Injected extra unverified deliverable
      skillsDemonstrated: basePayload.skillsDemonstrated,
      volumeTier: basePayload.volumeTier,
      verificationHash: legitimateHash,
      verifiedByPlatform: true,
      createdAt: basePayload.completedAt,
    };

    const isForgedValid = await verifyProofIntegrity(forgedProof);
    assertBlocked(
      isForgedValid === false,
      'ADV-P7-11: Cryptographic audit detects fabricated deliverables injection in proof record'
    );
  } catch (err: any) {
    assertBlocked(false, 'ADV-P7-11', err.message);
  }

  // ADV-12: Direct Client Attempt to Forge isIdentityVerified
  try {
    let idForgeBlocked = false;
    try {
      const userRef = doc(db, 'users', 'unverified_attacker');
      await updateDoc(userRef, { isIdentityVerified: true });
    } catch (e) {
      idForgeBlocked = true;
    }
    assertBlocked(
      idForgeBlocked,
      'ADV-P7-12: Direct client attempt to forge isIdentityVerified on user document blocked by Firestore rules'
    );
  } catch (err: any) {
    assertBlocked(false, 'ADV-P7-12', err.message);
  }

  console.log(`Phase 7 Adversarial Result: ${passed}/${total} attacks blocked successfully.`);
  return { passed, total, errors };
}
