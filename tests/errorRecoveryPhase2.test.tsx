/**
 * GigLink E: Error & Recovery Phase 2 Verification Suite
 * 
 * Verifies:
 * 1. E-03: Firebase Error Sanitization (no leaked emails, UIDs, tokens, or raw paths)
 * 2. E-03: Machine-readable categories and caller compatibility
 * 3. E-04: AcceptedHandoffPage error classification (Authorization vs Network vs Not Found)
 * 4. E-04: Network retry behavior without state corruption
 * 5. Silent Empty-List Failure Remediation:
 *    - ManageApplicationsPage: Query failure != zero applications empty state
 *    - MyApplicationsPage: Query failure != zero applications empty state
 *    - AcceptedHandoff Overview: Contract query failure != zero contracts empty state
 */

import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { terminate } from 'firebase/firestore';
import { db } from '../src/config/firebase';

import {
  handleFirestoreError,
  classifyFirestoreError,
  sanitizeFirestorePath,
  scrubSensitiveInfo,
  SanitizedFirestoreError,
  OperationType,
} from '../src/lib/firebaseErrors';

import {
  getHandoffWorkspace,
  setHandoffWorkspaceLoaderForTesting,
  HandoffWorkspaceResult,
} from '../src/lib/handoffService';

import {
  getContractsForUser,
  clearContractStore,
  setContractReaderForTesting,
} from '../src/lib/contractService';

import {
  getApplicationsForOpportunity,
  getMyApplications,
  clearOpportunityStore,
  setApplicationsReaderForTesting,
  setMyApplicationsReaderForTesting,
  opportunitiesStore,
} from '../src/lib/opportunityService';

import { AcceptedHandoffPage } from '../src/components/opportunities/AcceptedHandoffPage';
import { ManageApplicationsPage } from '../src/components/opportunities/ManageApplicationsPage';
import { MyApplicationsPage } from '../src/components/opportunities/MyApplicationsPage';
import { AuthContext } from '../src/context/AuthContext';
import { ToastContext } from '../src/context/ToastContext';
import { ApplicationHandoffData } from '../src/types';

describe('GigLink E: Error & Recovery Phase 2 — High-Severity Error Remediation', () => {
  let dom: JSDOM;
  let container: HTMLDivElement;
  let root: any;

  before(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
      url: 'https://ais-dev-6cgu6qe3tazce7zbe54vwv-193674771200.europe-west2.run.app/',
      pretendToBeVisual: true,
    });

    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: dom.window.navigator,
        configurable: true,
        writable: true,
      });
    } catch {
      // already defined
    }
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).HTMLInputElement = dom.window.HTMLInputElement;
    (global as any).HTMLButtonElement = dom.window.HTMLButtonElement;
    (global as any).Element = dom.window.Element;
  });

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    container = document.getElementById('root') as HTMLDivElement;
    clearContractStore();
    clearOpportunityStore();
    setHandoffWorkspaceLoaderForTesting(null);
    setApplicationsReaderForTesting(null);
    setMyApplicationsReaderForTesting(null);
    setContractReaderForTesting(null);
  });

  after(async () => {
    try {
      await terminate(db);
    } catch {
      // Ignored
    }
  });

  const createMockAuth = (userOverrides: Partial<any> = {}) => ({
    user: {
      uid: 'user_test_client_001',
      email: 'client@giglink.test',
      displayName: 'Test Client',
      emailVerified: true,
      ...userOverrides,
    } as any,
    profile: null,
    passport: null,
    activePersona: 'client' as any,
    loading: false,
    firestoreConnected: true,
    signInWithGoogle: async () => {},
    signUpWithEmail: async () => {},
    signInWithEmail: async () => {},
    sendPasswordReset: async () => {},
    confirmResetPassword: async () => {},
    verifyEmailCode: async () => {},
    resendVerificationEmail: async () => {},
    signOut: async () => {},
    switchPersona: async () => {},
    completeIndividualOnboarding: async () => {},
    completeOrganizationOnboarding: async () => {},
    updatePassportVisibility: async () => {},
    updatePassportDetails: async () => {},
    submitIdentityVerification: async () => {},
    reviewIdentityVerification: async () => {},
    addProjectProof: async () => {},
    deleteProjectProof: async () => {},
  });

  const mockToast = {
    showToast: () => {},
    addToast: () => {},
    showSuccess: () => {},
    showError: () => {},
    showInfo: () => {},
  };

  const sampleHandoffData: ApplicationHandoffData = {
    applicationId: 'app_123',
    opportunityId: 'opp_123',
    opportunityTitle: 'Verified Smart Contract Audit',
    opportunityCreatorId: 'user_test_client_001',
    applicantId: 'user_applicant_002',
    applicantDisplayName: 'Bob Security Auditor',
    applicantEmail: 'bob@example.com',
    applicantTrustTier: 'Verified Pro',
    applicantTrustScore: 90,
    applicantIdentityVerified: true,
    creatorName: 'Test Client',
    status: 'accepted',
    acceptedAt: new Date().toISOString(),
    milestones: [
      {
        id: 'm1',
        title: 'Initial Review',
        description: 'Review contracts',
        responsibleParty: 'collaborative',
        status: 'in_progress',
        createdAt: new Date().toISOString(),
        completedAt: null,
      },
    ],
  };

  // =========================================================================
  // 1. E-03: FIREBASE ERROR SANITIZATION & CALLER COMPATIBILITY
  // =========================================================================
  describe('PART 1: E-03 Firebase Error Sanitization', () => {
    test('Test 1 — User-facing error contains NO leaked emails, UIDs, provider metadata, or raw paths', () => {
      const sensitiveRawError = new Error(
        'PERMISSION_DENIED: User confidential.user@giglink.test with uid_secret_9988776655443322 and provider google.com cannot access projects/giglink-prod-99/databases/(default)/documents/users/uid_secret_9988776655443322'
      );
      (sensitiveRawError as any).code = 'permission-denied';

      let caughtError: any = null;
      try {
        handleFirestoreError(
          sensitiveRawError,
          OperationType.GET,
          'projects/giglink-prod-99/databases/(default)/documents/users/uid_secret_9988776655443322'
        );
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError, 'Expected handleFirestoreError to throw');
      assert.ok(caughtError instanceof SanitizedFirestoreError, 'Must be instance of SanitizedFirestoreError');

      // Invariant: User-facing message must NOT contain sensitive strings
      assert.ok(!caughtError.message.includes('confidential.user@giglink.test'), 'Must not leak user email');
      assert.ok(!caughtError.message.includes('uid_secret_9988776655443322'), 'Must not leak user UID');
      assert.ok(!caughtError.message.includes('google.com'), 'Must not leak provider info');
      assert.ok(!caughtError.message.includes('giglink-prod-99'), 'Must not leak internal GCP project ID');
      assert.ok(!caughtError.message.includes('(default)'), 'Must not leak internal database ID');

      // Invariant: Error object properties must also be sanitized
      assert.strictEqual(caughtError.path, 'users', 'Path must be sanitized to top-level collection identifier only');
      assert.strictEqual(caughtError.category, 'authorization', 'Category must be authorization');
      assert.strictEqual(
        caughtError.userFacingMessage,
        "You don't have permission to access this information.",
        'User-facing message must be safe and concise'
      );
    });

    test('Test 2 — Safe error categories remain distinguishable across failure types', () => {
      // 1. Authorization
      const authClass = classifyFirestoreError({ code: 'permission-denied', message: 'Missing permissions' }, OperationType.GET);
      assert.strictEqual(authClass.category, 'authorization');
      assert.strictEqual(authClass.isRecoverable, false);

      // 2. Network / Recoverable
      const networkClass = classifyFirestoreError({ code: 'unavailable', message: 'The client is offline' }, OperationType.GET);
      assert.strictEqual(networkClass.category, 'network');
      assert.strictEqual(networkClass.isRecoverable, true);

      // 3. Not Found
      const notFoundClass = classifyFirestoreError({ code: 'not-found', message: 'Document not found' }, OperationType.GET);
      assert.strictEqual(notFoundClass.category, 'not_found');
      assert.strictEqual(notFoundClass.isRecoverable, false);

      // 4. Already Exists
      const existsClass = classifyFirestoreError({ code: 'already-exists', message: 'Already exists' }, OperationType.CREATE);
      assert.strictEqual(existsClass.category, 'already_exists');

      // 5. Validation / Precondition
      const validationClass = classifyFirestoreError({ code: 'failed-precondition', message: 'Precondition check failed' }, OperationType.UPDATE);
      assert.strictEqual(validationClass.category, 'validation');

      // 6. Unknown
      const unknownClass = classifyFirestoreError(new Error('Internal unexpected error'), OperationType.GET);
      assert.strictEqual(unknownClass.category, 'unknown');
    });

    test('Test 3 — Caller compatibility: structured properties (category, code, instanceof) are preserved', () => {
      let caught: any = null;
      try {
        handleFirestoreError({ code: 'unavailable', message: 'transport errored' }, OperationType.GET, 'contracts/c123');
      } catch (e) {
        caught = e;
      }

      assert.ok(caught instanceof Error, 'Must be instanceof Error');
      assert.ok(caught instanceof SanitizedFirestoreError, 'Must be instanceof SanitizedFirestoreError');
      assert.strictEqual(caught.category, 'network');
      assert.strictEqual(caught.code, 'unavailable');
      assert.strictEqual(caught.isRecoverable, true);
      assert.strictEqual(caught.path, 'contracts');
      assert.ok(!caught.message.includes('c123'), 'Path must not leak document ID');
    });
  });

  // =========================================================================
  // 2. E-04: ACCEPTED HANDOFF RECOVERY & TRUTHFUL STATE CLASSIFICATION
  // =========================================================================
  describe('PART 2: E-04 AcceptedHandoffPage Error Classification & Recovery', () => {
    test('Test 4 — Authorization failure displays safe authorization message, not network error', async () => {
      setHandoffWorkspaceLoaderForTesting(async () => ({
        success: false,
        error: 'You are not authorized to view this collaboration handoff workspace.',
        errorCode: 'UNAUTHORIZED',
      }));

      await act(async () => {
        root = createRoot(container);
        root.render(
          <AuthContext.Provider value={createMockAuth() as any}>
            <ToastContext.Provider value={mockToast}>
              <MemoryRouter initialEntries={['/opportunities/opp_123/handoff/app_123']}>
                <Routes>
                  <Route
                    path="/opportunities/:id/handoff/:applicationId"
                    element={<AcceptedHandoffPage />}
                  />
                </Routes>
              </MemoryRouter>
            </ToastContext.Provider>
          </AuthContext.Provider>
        );
      });

      await new Promise((r) => setTimeout(r, 20));

      const pageText = container.textContent || '';
      // Truthful authorization message displayed
      assert.ok(
        pageText.includes('Access Denied') || pageText.includes('not authorized'),
        'Must display Access Denied for authorization failure'
      );
      // Invariant: Network connection error or retry must NOT be shown for auth failure
      assert.ok(!pageText.includes('Connection Interrupted'), 'Must NOT conflate auth failure with connection failure');
      const retryBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Retry'));
      assert.strictEqual(retryBtn, undefined, 'Must NOT provide Retry action for unauthorized access');
    });

    test('Test 5 — Network failure displays Connection Interrupted with Retry action, NOT Access Denied', async () => {
      setHandoffWorkspaceLoaderForTesting(async () => ({
        success: false,
        error: 'We could not connect to load the project workspace. Please check your network connection.',
        errorCode: 'NETWORK',
      }));

      await act(async () => {
        root = createRoot(container);
        root.render(
          <AuthContext.Provider value={createMockAuth() as any}>
            <ToastContext.Provider value={mockToast}>
              <MemoryRouter initialEntries={['/opportunities/opp_123/handoff/app_123']}>
                <Routes>
                  <Route
                    path="/opportunities/:id/handoff/:applicationId"
                    element={<AcceptedHandoffPage />}
                  />
                </Routes>
              </MemoryRouter>
            </ToastContext.Provider>
          </AuthContext.Provider>
        );
      });

      await new Promise((r) => setTimeout(r, 20));

      const pageText = container.textContent || '';
      assert.ok(pageText.includes('Connection Interrupted'), 'Must display Connection Interrupted for network errors');
      assert.ok(!pageText.includes('Access Denied'), 'Must NOT display Access Denied for network errors');

      const retryButton = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Retry')
      );
      assert.ok(retryButton, 'Network failure must provide an explicit Retry action');
    });

    test('Test 6 — Missing resource is rendered as Workspace Not Found, not Access Denied', async () => {
      setHandoffWorkspaceLoaderForTesting(async () => ({
        success: false,
        error: 'Application not found.',
        errorCode: 'NOT_FOUND',
      }));

      await act(async () => {
        root = createRoot(container);
        root.render(
          <AuthContext.Provider value={createMockAuth() as any}>
            <ToastContext.Provider value={mockToast}>
              <MemoryRouter initialEntries={['/opportunities/opp_123/handoff/app_123']}>
                <Routes>
                  <Route
                    path="/opportunities/:id/handoff/:applicationId"
                    element={<AcceptedHandoffPage />}
                  />
                </Routes>
              </MemoryRouter>
            </ToastContext.Provider>
          </AuthContext.Provider>
        );
      });

      await new Promise((r) => setTimeout(r, 20));

      const pageText = container.textContent || '';
      assert.ok(pageText.includes('Workspace Not Found'), 'Must display Workspace Not Found when application does not exist');
      assert.ok(!pageText.includes('Access Denied'), 'Not Found must not be falsely described as Access Denied');
    });

    test('Test 7 — Retry action invokes load operation and restores valid state on recovery', async () => {
      let callCount = 0;
      setHandoffWorkspaceLoaderForTesting(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            success: false,
            error: 'We could not connect to load the project workspace.',
            errorCode: 'NETWORK',
          };
        }
        return {
          success: true,
          handoffData: sampleHandoffData,
          isApplicant: true,
          isCreator: false,
        };
      });

      await act(async () => {
        root = createRoot(container);
        root.render(
          <AuthContext.Provider value={createMockAuth() as any}>
            <ToastContext.Provider value={mockToast}>
              <MemoryRouter initialEntries={['/opportunities/opp_123/handoff/app_123']}>
                <Routes>
                  <Route
                    path="/opportunities/:id/handoff/:applicationId"
                    element={<AcceptedHandoffPage />}
                  />
                </Routes>
              </MemoryRouter>
            </ToastContext.Provider>
          </AuthContext.Provider>
        );
      });

      await new Promise((r) => setTimeout(r, 20));

      // Initial state is Connection Interrupted
      assert.ok(container.textContent?.includes('Connection Interrupted'));
      const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Retry')
      );
      assert.ok(retryBtn, 'Retry button must exist');

      // Click retry
      await act(async () => {
        retryBtn.click();
      });
      await new Promise((r) => setTimeout(r, 50));

      assert.strictEqual(callCount, 2, 'Retry must invoke the loader a second time');
      assert.ok(!container.textContent?.includes('Connection Interrupted'), 'Connection error must be cleared');
      assert.ok(container.textContent?.includes('Project Delivery Workspace'), 'Workspace must be successfully loaded');
    });
  });

  // =========================================================================
  // 3. SILENT EMPTY-LIST FAILURE REMEDIATION
  // =========================================================================
  describe('PART 3: Silent Empty-List Failure Remediation', () => {
    test('Test 8 — ManageApplicationsPage: Query failure must NOT render legitimate zero-applications empty state', async () => {
      opportunitiesStore.set('opp_123', {
        id: 'opp_123',
        creatorId: 'user_test_client_001',
        title: 'Verified Smart Contract Audit',
      } as any);

      let failQuery = true;
      setApplicationsReaderForTesting(async () => {
        if (failQuery) {
          const err = new Error('The client is offline');
          (err as any).code = 'unavailable';
          throw err;
        }
        return [];
      });

      await act(async () => {
        root = createRoot(container);
        root.render(
          <AuthContext.Provider value={createMockAuth() as any}>
            <ToastContext.Provider value={mockToast}>
              <MemoryRouter initialEntries={['/opportunities/opp_123/applications']}>
                <Routes>
                  <Route
                    path="/opportunities/:id/applications"
                    element={<ManageApplicationsPage />}
                  />
                </Routes>
              </MemoryRouter>
            </ToastContext.Provider>
          </AuthContext.Provider>
        );
      });

      await new Promise((r) => setTimeout(r, 20));

      // Switch to Applications tab
      const appsTab = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Applications')
      );
      if (appsTab) {
        await act(async () => {
          appsTab.click();
        });
        await new Promise((r) => setTimeout(r, 20));
      }

      // Assert error state is rendered with Retry, and NOT legitimate zero-applications message
      const text = container.textContent || '';
      assert.ok(text.includes('Connection Interrupted'), 'Must display Connection Interrupted on query failure');
      assert.ok(!text.includes('No applicants found'), 'Must NOT display legitimate zero-applications empty state on failure');
      assert.ok(!text.includes('No candidates have applied for this listing yet.'), 'Must NOT state 0 candidates applied on failure');

      const retryBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Retry'));
      assert.ok(retryBtn, 'Must render Retry button on query failure');

      // Now simulate recovery to genuine 0 applications
      failQuery = false;
      await act(async () => {
        retryBtn.click();
      });
      await new Promise((r) => setTimeout(r, 30));

      const recoveredText = container.textContent || '';
      assert.ok(recoveredText.includes('No applicants found'), 'Legitimate zero-applications state renders only after successful query');
    });

    test('Test 9 — MyApplicationsPage: Query failure must NOT render legitimate zero-applications empty state', async () => {
      let failQuery = true;
      setMyApplicationsReaderForTesting(async () => {
        if (failQuery) {
          const err = new Error('Transport unavailable');
          (err as any).code = 'unavailable';
          throw err;
        }
        return [];
      });

      await act(async () => {
        root = createRoot(container);
        root.render(
          <AuthContext.Provider value={createMockAuth() as any}>
            <ToastContext.Provider value={mockToast}>
              <MemoryRouter initialEntries={['/my-applications']}>
                <Routes>
                  <Route path="/my-applications" element={<MyApplicationsPage />} />
                </Routes>
              </MemoryRouter>
            </ToastContext.Provider>
          </AuthContext.Provider>
        );
      });

      await new Promise((r) => setTimeout(r, 20));

      const text = container.textContent || '';
      assert.ok(text.includes('Connection Interrupted'), 'Must display Connection Interrupted on query failure');
      assert.ok(!text.includes('No Active Applications Submitted Yet'), 'Query error must NOT display legitimate empty-state');

      const retryBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Retry'));
      assert.ok(retryBtn, 'Query error must render Retry button');

      // Simulate recovery to genuine 0 applications
      failQuery = false;
      await act(async () => {
        retryBtn.click();
      });
      await new Promise((r) => setTimeout(r, 30));

      const recoveredText = container.textContent || '';
      assert.ok(recoveredText.includes('No Active Applications Submitted Yet'), 'Legitimate zero-applications state renders after successful query');
    });

    test('Test 10 — AcceptedHandoff Overview: Contract query failure must NOT render legitimate zero-contracts empty state', async () => {
      let failQuery = true;
      setContractReaderForTesting(async () => {
        if (failQuery) {
          const err = new Error('Connection lost');
          (err as any).code = 'unavailable';
          throw err;
        }
        return [];
      });

      await act(async () => {
        root = createRoot(container);
        root.render(
          <AuthContext.Provider value={createMockAuth() as any}>
            <ToastContext.Provider value={mockToast}>
              <MemoryRouter initialEntries={['/talent/contracts']}>
                <Routes>
                  <Route path="/talent/contracts" element={<AcceptedHandoffPage />} />
                </Routes>
              </MemoryRouter>
            </ToastContext.Provider>
          </AuthContext.Provider>
        );
      });

      await new Promise((r) => setTimeout(r, 20));

      const text = container.textContent || '';
      assert.ok(text.includes('Connection Interrupted'), 'Must display Connection Interrupted on overview contract query failure');
      assert.ok(!text.includes('No Active Milestone Contracts'), 'Contract query failure must NOT render legitimate zero-contracts empty state');

      const retryBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Retry'));
      assert.ok(retryBtn, 'Overview query failure must render Retry button');

      // Simulate recovery to genuine 0 contracts
      failQuery = false;
      await act(async () => {
        retryBtn.click();
      });
      await new Promise((r) => setTimeout(r, 30));

      const recoveredText = container.textContent || '';
      assert.ok(recoveredText.includes('No Active Milestone Contracts'), 'Legitimate zero-contracts state renders only after successful query');
    });
  });
});
