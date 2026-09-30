import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import { terminate } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import {
  persistContract,
  getContract,
  clearContractStore,
  setContractWriterForTesting,
  acceptContract,
  reviewMilestoneDeliverable,
} from '../src/lib/contractService';
import {
  appendLedgerRecord,
  getContractLedgerRecords,
  clearMemoryLedgerForTesting,
  getMemoryLedgerForTesting,
  setLedgerWriterForTesting,
  recordMilestoneFunded,
  recordMilestonePaymentReleased,
  checkAndRecordWebhookEvent,
} from '../src/lib/financialLedgerService';
import { GigLinkContract, FinancialLedgerRecord } from '../src/types';

describe('GigLink E: Error & Recovery Phase 1 — Fail-Closed Persistence Remediation', () => {
  const sampleContract: GigLinkContract = {
    id: 'contract_test_e01',
    opportunityId: 'opp_e01',
    opportunityTitle: 'Full-Stack Recovery Audit',
    applicationId: 'app_e01',
    creatorId: 'client_e01',
    creatorName: 'Enterprise Client',
    talentId: 'talent_e01',
    talentName: 'Senior Security Architect',
    status: 'draft',
    version: 1,
    conversationId: 'conv_e01',
    scopeLock: {
      title: 'Full-Stack Recovery Audit',
      description: 'Audit scope',
      totalAmount: 5000,
      currency: 'USD',
      revisionAllowance: 2,
      inclusions: ['Audit Deliverables'],
      exclusions: ['Non-audit tasks'],
      deliverables: ['Audit Report'],
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
        id: 'm1_e01',
        contractId: 'contract_test_e01',
        title: 'Initial Architecture Review',
        description: 'Audit baseline',
        deliverables: ['Audit Report'],
        amount: 5000,
        currency: 'USD',
        status: 'in_progress',
        reviewState: 'submitted',
        paymentState: 'held',
        revisionAllowance: 2,
        revisionCount: 0,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  beforeEach(() => {
    clearContractStore();
    clearMemoryLedgerForTesting();
    setContractWriterForTesting(null);
    setLedgerWriterForTesting(null);
  });

  after(async () => {
    try {
      await terminate(db);
    } catch {
      // Ignored if already terminated
    }
  });

  // =========================================================================
  // 1. E-01: CONTRACT PERSISTENCE (FAIL-CLOSED)
  // =========================================================================
  describe('1. E-01 Contract Persistence Fail-Closed Verification', () => {
    test('Test 1 — Successful contract persistence resolves and updates in-memory cache', async () => {
      let firestoreWriteCalled = false;
      setContractWriterForTesting(async (_ref, data) => {
        firestoreWriteCalled = true;
        assert.strictEqual(data.id, sampleContract.id);
      });

      // Given: Valid contract mutation, Firestore succeeds
      await persistContract(sampleContract);

      // Assert:
      assert.strictEqual(firestoreWriteCalled, true, 'Authoritative Firestore write was invoked');
      const cached = await getContract(sampleContract.id);
      assert.notStrictEqual(cached, null, 'Contract must be present in store/cache after successful write');
      assert.strictEqual(cached?.id, sampleContract.id);
      assert.strictEqual(cached?.status, 'draft');
    });

    test('Test 2 — Failed contract persistence throws and does NOT leave uncommitted mutation in memory', async () => {
      // First, seed an initial valid baseline contract in store with a successful write
      setContractWriterForTesting(async () => {});
      await persistContract(sampleContract);
      const baseline = await getContract(sampleContract.id);
      assert.strictEqual(baseline?.status, 'draft');

      // Now configure Firestore to fail (simulate network drop or permission denial)
      const firestoreError = new Error('7 PERMISSION_DENIED: Firestore connection lost');
      setContractWriterForTesting(async () => {
        throw firestoreError;
      });

      // Attempt to mutate contract status to "active"
      const failedMutation: GigLinkContract = {
        ...sampleContract,
        status: 'active',
        version: 2,
        updatedAt: '2026-09-28T12:00:00.000Z',
      };

      let errorThrown = false;
      try {
        await persistContract(failedMutation);
      } catch (err: any) {
        errorThrown = true;
        assert.strictEqual(err.message, firestoreError.message);
      }

      // Assert:
      assert.strictEqual(errorThrown, true, 'persistContract must reject and throw on Firestore failure');
      const storeState = await getContract(sampleContract.id);
      assert.strictEqual(storeState?.status, 'draft', 'In-memory store must NOT reflect the failed "active" mutation');
      assert.strictEqual(storeState?.version, 1, 'Contract version must remain at baseline (1), not mutated (2)');
    });

    test('Test 2B — Failed initial contract creation does NOT leave phantom document in memory', async () => {
      setContractWriterForTesting(async () => {
        throw new Error('Unavailable: Backend offline');
      });

      const newContract: GigLinkContract = {
        ...sampleContract,
        id: 'contract_phantom_new',
      };

      await assert.rejects(
        async () => {
          await persistContract(newContract);
        },
        { message: 'Unavailable: Backend offline' }
      );

      const cached = await getContract('contract_phantom_new');
      assert.strictEqual(cached, null, 'Phantom contract must NOT exist in store after failed write');
    });

    test('Test 3 — Representative contract caller (acceptContract) fails safely on persistence error', async () => {
      // Seed initial draft contract
      setContractWriterForTesting(async () => {});
      await persistContract(sampleContract);

      // Now simulate Firestore write failure on counter-party signing
      setContractWriterForTesting(async () => {
        throw new Error('Write failed: Network disconnect');
      });

      let loadingFlag = true;
      let errorToast: string | null = null;
      let successToast: string | null = null;

      try {
        // Representative UI caller pattern
        const updated = await acceptContract(sampleContract.id, 'client_e01', 'Alice Client');
        successToast = `Contract accepted with status ${updated.status}`;
      } catch (err: any) {
        errorToast = err.message;
      } finally {
        loadingFlag = false;
      }

      // Assert:
      assert.strictEqual(loadingFlag, false, 'Loading flag must reset in finally block');
      assert.strictEqual(successToast, null, 'Success toast must NEVER be triggered when persistence fails');
      assert.strictEqual(errorToast, 'Write failed: Network disconnect', 'Error path must receive the authoritative error');

      // Verify contract state was not mutated in store
      const persistedState = await getContract(sampleContract.id);
      assert.strictEqual(persistedState?.creatorAcceptance.accepted, false, 'Creator acceptance must remain false');
      assert.strictEqual(persistedState?.status, 'draft', 'Status must remain draft');
    });

    test('Test 3B — Representative milestone caller (reviewMilestoneDeliverable) fails safely on persistence error', async () => {
      // Seed active contract with submitted milestone
      setContractWriterForTesting(async () => {});
      await persistContract({
        ...sampleContract,
        status: 'active',
        creatorAcceptance: { accepted: true, acceptedAt: '2026-09-01T00:00:00.000Z', signedName: 'Client' },
        talentAcceptance: { accepted: true, acceptedAt: '2026-09-01T00:00:00.000Z', signedName: 'Talent' },
      });

      // Now simulate persistence failure during client approval
      setContractWriterForTesting(async () => {
        throw new Error('Firestore transaction aborted');
      });

      await assert.rejects(
        async () => {
          await reviewMilestoneDeliverable({
            contractId: sampleContract.id,
            milestoneId: 'm1_e01',
            reviewerUserId: 'client_e01',
            decision: 'approved',
            feedback: 'Deliverable verified',
          });
        },
        { message: 'Firestore transaction aborted' }
      );

      const contractAfter = await getContract(sampleContract.id);
      const m1 = contractAfter?.milestones.find((m) => m.id === 'm1_e01');
      assert.strictEqual(m1?.reviewState, 'submitted', 'Milestone reviewState must remain "submitted", NOT approved');
      assert.strictEqual(m1?.status, 'in_progress', 'Milestone status must remain "in_progress", NOT completed');
    });
  });

  // =========================================================================
  // 2. E-02: FINANCIAL LEDGER (FAIL-CLOSED)
  // =========================================================================
  describe('2. E-02 Financial Ledger Persistence Fail-Closed Verification', () => {
    const sampleRecord: FinancialLedgerRecord = {
      id: 'tx_fund_test_999',
      contractId: 'contract_test_e01',
      milestoneId: 'm1_e01',
      opportunityId: 'opp_e01',
      payerId: 'client_e01',
      payerName: 'Enterprise Client',
      recipientId: 'talent_e01',
      recipientName: 'Senior Security Architect',
      amount: 5000,
      currency: 'USD',
      platformFeeRate: 0.1,
      platformFeeAmount: 500,
      netTalentAmount: 4500,
      type: 'milestone_funded',
      provider: 'stripe',
      status: 'succeeded',
      description: 'Escrow funded for Milestone 1 ($5000 USD)',
      createdAt: '2026-09-28T12:00:00.000Z',
      completedAt: '2026-09-28T12:00:00.000Z',
    };

    test('Test 4 — Successful ledger persistence returns authoritative record and preserves immutability', async () => {
      let firestoreWriteCalled = false;
      setLedgerWriterForTesting(async (_ref, data) => {
        firestoreWriteCalled = true;
        assert.strictEqual(data.id, sampleRecord.id);
        assert.strictEqual(data.amount, 5000);
      });

      const result = await appendLedgerRecord(sampleRecord);

      assert.strictEqual(firestoreWriteCalled, true);
      assert.strictEqual(result.id, sampleRecord.id);
      assert.strictEqual(result.amount, 5000);
      assert.strictEqual(result.netTalentAmount, 4500);

      // Verify available in ledger records
      const memoryRecords = getMemoryLedgerForTesting();
      assert.strictEqual(memoryRecords.length, 1);
      assert.strictEqual(memoryRecords[0].id, sampleRecord.id);
    });

    test('Test 5 — Failed ledger persistence throws and does NOT append to memoryLedger', async () => {
      const firestoreLedgerError = new Error('7 PERMISSION_DENIED: Financial ledger write unauthorized');
      setLedgerWriterForTesting(async () => {
        throw firestoreLedgerError;
      });

      let errorCaught = false;
      try {
        await appendLedgerRecord(sampleRecord);
      } catch (err: any) {
        errorCaught = true;
        assert.strictEqual(err.message, firestoreLedgerError.message);
      }

      assert.strictEqual(errorCaught, true, 'appendLedgerRecord must throw when Firestore write fails');
      const memoryRecords = getMemoryLedgerForTesting();
      assert.strictEqual(memoryRecords.length, 0, 'memoryLedger must be EMPTY after failed write');
    });

    test('Test 6 — Financial caller workflow (recordMilestoneFunded) fails closed on ledger error', async () => {
      // Seed contract
      setContractWriterForTesting(async () => {});
      await persistContract({
        ...sampleContract,
        status: 'active',
        milestones: [
          {
            ...sampleContract.milestones[0],
            paymentState: 'unfunded',
            fundedAmount: 0,
          },
        ],
      });

      // Contract persistence succeeds, but ledger write fails
      setLedgerWriterForTesting(async () => {
        throw new Error('Firestore write quota exceeded on financialLedger');
      });

      await assert.rejects(
        async () => {
          await recordMilestoneFunded({
            contractId: sampleContract.id,
            milestoneId: 'm1_e01',
            payerId: 'client_e01',
            payerName: 'Enterprise Client',
            amount: 5000,
            currency: 'USD',
          });
        },
        { message: 'Firestore write quota exceeded on financialLedger' }
      );

      // Verify no phantom ledger record was added
      const memoryRecords = getMemoryLedgerForTesting();
      assert.strictEqual(memoryRecords.length, 0, 'No ledger record should exist in memory');
    });

    test('Test 7 (MANDATORY INVARIANT) — Firestore ledger failure NEVER results in memoryLedger containing authoritative financial transaction', async () => {
      // Explicit invariant enforcement
      assert.strictEqual(getMemoryLedgerForTesting().length, 0, 'Baseline memory ledger is empty');

      // Inject deterministic failure
      setLedgerWriterForTesting(async () => {
        throw new Error('Cloud Firestore storage network partition');
      });

      const highValueRecord: FinancialLedgerRecord = {
        ...sampleRecord,
        id: 'tx_high_value_50000',
        amount: 50000,
        netTalentAmount: 45000,
        platformFeeAmount: 5000,
        type: 'milestone_released',
      };

      await assert.rejects(async () => {
        await appendLedgerRecord(highValueRecord);
      });

      // Strict post-condition check
      const currentMemory = getMemoryLedgerForTesting();
      assert.strictEqual(
        currentMemory.length,
        0,
        'CRITICAL INVARIANT VIOLATION PREVENTED: memoryLedger must NEVER contain an unpersisted financial record'
      );
      const found = currentMemory.find((r) => r.id === highValueRecord.id);
      assert.strictEqual(found, undefined, 'High-value transaction must NOT exist in memory ledger');
    });
  });

  // =========================================================================
  // 3. WEBHOOK IDEMPOTENCY PRESERVATION
  // =========================================================================
  describe('3. Webhook Idempotency Preservation', () => {
    test('Test 8 — Webhook idempotency check retains duplicate detection', async () => {
      const event = {
        id: `evt_stripe_e01_${Date.now()}`,
        type: 'payment_intent.succeeded',
        created: Math.floor(Date.now() / 1000),
      };

      // First delivery: not duplicate
      const firstCheck = await checkAndRecordWebhookEvent(event);
      assert.strictEqual(firstCheck.isDuplicate, false);
      assert.strictEqual(firstCheck.record.id, event.id);
      assert.strictEqual(firstCheck.record.status, 'processed');

      // Second delivery with identical event ID: duplicate detected
      const duplicateCheck = await checkAndRecordWebhookEvent(event);
      assert.strictEqual(duplicateCheck.isDuplicate, true);
      assert.strictEqual(duplicateCheck.record.id, event.id);
    });
  });
});
