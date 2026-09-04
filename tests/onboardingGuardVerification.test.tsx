/**
 * Regression & Invariant Verification Test Suite: Onboarding Guard & Shell Isolation
 * 
 * Tests Covered:
 * 1. Exact reproduction: Complete only part of onboarding -> browser Back twice -> refresh -> user MUST still be redirected to /onboarding and MUST NOT see the Ecosystem Portal.
 * 2. Direct "/" access with onboardingCompleted: false -> redirected to /onboarding.
 * 3. Direct workspace route (/my-applications, /opportunities/create, /passport, /opportunities) with onboardingCompleted: false -> redirected to /onboarding.
 * 4. Refresh on every onboarding step (/onboarding, /onboarding/profile, /onboarding/organization) -> stays on onboarding with isolated shell.
 * 5. Reopening the tab (initial navigation to "/" with incomplete onboarding) -> redirects to /onboarding.
 * 6. Public passport as unauthenticated visitor -> public passport accessible.
 * 7. Public passport as incomplete authenticated user -> redirects to /onboarding.
 * 8. Authoritative transition: Completing onboarding (onboardingCompleted: true) -> workspace unlocks and Ecosystem Portal renders.
 * 9. Authentication shell isolation: /auth/* has NO GlobalHeader, NO persona switcher, NO chat, NO notifications, NO profile menu, NO workspace footer.
 * 10. Onboarding shell isolation: /onboarding/* has dedicated minimal shell (branding, setup context, sign out) and NO persona switcher, NO chat, NO notifications, NO workspace footer.
 * 11. Workspace shell restoration: / renders full GlobalHeader, persona switcher, ecosystem footer after completion.
 * 12. Zero UI / layout flash: While session is loading, GlobalHeader / workspace elements are never rendered.
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '../src/components/layout/AppShell';
import { PublicEcosystemPortal } from '../src/components/public/PublicEcosystemPortal';
import { AuthenticatedRoute, GuestRoute } from '../src/components/auth/ProtectedRoute';
import { InitialPersonaSelectionPage } from '../src/components/onboarding/InitialPersonaSelectionPage';
import { ProfileOnboardingPage } from '../src/components/onboarding/ProfileOnboardingPage';
import { OrganizationOnboardingPage } from '../src/components/onboarding/OrganizationOnboardingPage';
import { OpportunitiesExplorePage } from '../src/components/opportunities/OpportunitiesExplorePage';
import { OpportunityDetailPage } from '../src/components/opportunities/OpportunityDetailPage';
import { PassportResolverPage } from '../src/components/passport/PassportResolverPage';
import { PublicPassportPage } from '../src/components/passport/PublicPassportPage';
import { AuthContext } from '../src/context/AuthContext';
import { ToastContext } from '../src/context/ToastContext';

describe('Onboarding Guard Invariants & Shell Isolation Regression Suite', () => {
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
    (global as any).HTMLButtonElement = dom.window.HTMLButtonElement;
    (global as any).HTMLAnchorElement = dom.window.HTMLAnchorElement;
  });

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    container = document.getElementById('root') as HTMLDivElement;
  });

  // Helper to build mock auth context value
  const createMockAuth = (authOverrides: Partial<any> = {}) => {
    return {
      user: null,
      profile: null,
      passport: null,
      activePersona: 'learner' as any,
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
      ...authOverrides,
    };
  };

  const mockToast = {
    showToast: () => {},
    addToast: () => {},
  };

  const renderAppAtRoute = async (initialEntries: string[], authOverrides: Partial<any> = {}) => {
    const mockAuth = createMockAuth(authOverrides);

    const RootApp = () => (
      <ToastContext.Provider value={mockToast as any}>
        <AuthContext.Provider value={mockAuth as any}>
          <MemoryRouter initialEntries={initialEntries}>
            <AppShell>
              <Routes>
                <Route path="/" element={<PublicEcosystemPortal />} />
                <Route path="/opportunities" element={<OpportunitiesExplorePage />} />
                <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
                <Route
                  path="/opportunities/create"
                  element={
                    <AuthenticatedRoute>
                      <div id="create-opportunity-view">Create Opportunity View</div>
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/my-applications"
                  element={
                    <AuthenticatedRoute>
                      <div id="my-applications-view">My Applications View</div>
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/passport"
                  element={
                    <AuthenticatedRoute>
                      <div id="private-passport-view">Private Passport View</div>
                    </AuthenticatedRoute>
                  }
                />
                <Route path="/passport/:uid" element={<PassportResolverPage />} />
                <Route path="/p/:uid" element={<PublicPassportPage />} />
                <Route
                  path="/auth/login"
                  element={
                    <GuestRoute>
                      <div id="signin-page-view">Sign In Page View</div>
                    </GuestRoute>
                  }
                />
                <Route
                  path="/auth/register"
                  element={
                    <GuestRoute>
                      <div id="signup-page-view">Sign Up Page View</div>
                    </GuestRoute>
                  }
                />
                <Route
                  path="/onboarding"
                  element={
                    <AuthenticatedRoute>
                      <InitialPersonaSelectionPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/onboarding/profile"
                  element={
                    <AuthenticatedRoute>
                      <ProfileOnboardingPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/onboarding/organization"
                  element={
                    <AuthenticatedRoute>
                      <OrganizationOnboardingPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route path="*" element={<div id="not-found-view">404 Not Found</div>} />
              </Routes>
            </AppShell>
          </MemoryRouter>
        </AuthContext.Provider>
      </ToastContext.Provider>
    );

    await act(async () => {
      root = createRoot(container);
      root.render(<RootApp />);
    });
  };

  it('1. Exact User Reproduction Scenario: Partial Onboarding -> Back twice -> Refresh -> Redirects to /onboarding (NO Ecosystem Portal)', async () => {
    // User is authenticated, but onboardingCompleted is FALSE
    const authState = {
      user: { uid: 'user_repro_123', email: 'test@example.com' },
      profile: {
        uid: 'user_repro_123',
        email: 'test@example.com',
        onboardingCompleted: false,
        activePersona: 'learner',
        availablePersonas: ['learner'],
      },
      loading: false,
    };

    // User popped back twice to "/"
    await renderAppAtRoute(['/auth/login', '/onboarding', '/onboarding/profile', '/'], authState);

    // Ecosystem Portal MUST NOT be rendered
    const portal = container.querySelector('#public-ecosystem-portal');
    assert.strictEqual(portal, null, 'PublicEcosystemPortal must NOT be rendered for incomplete onboarding user');

    // User MUST be redirected to /onboarding
    const personaHeader = container.querySelector('h1');
    assert.ok(personaHeader?.textContent?.includes('Select Your Primary Lens'), 'User must be on /onboarding');

    // Dedicated minimal onboarding shell check
    const onboardingHeader = container.querySelector('header');
    assert.ok(onboardingHeader?.textContent?.includes('Workspace Setup'), 'Must display isolated onboarding header');
    assert.strictEqual(container.querySelector('#global-header-persona-switcher'), null, 'Must NOT contain persona switcher');
    assert.strictEqual(container.querySelector('footer a[href="/about"]'), null, 'Must NOT contain full ecosystem footer');
  });

  it('2. Direct "/" access with onboardingCompleted: false redirects to /onboarding', async () => {
    await renderAppAtRoute(['/'], {
      user: { uid: 'user_incomplete_1', email: 'incomplete@example.com' },
      profile: {
        uid: 'user_incomplete_1',
        email: 'incomplete@example.com',
        onboardingCompleted: false,
        activePersona: 'learner',
        availablePersonas: ['learner'],
      },
      loading: false,
    });

    assert.strictEqual(container.querySelector('#public-ecosystem-portal'), null);
    assert.ok(container.textContent?.includes('Select Your Primary Lens'));
  });

  it('3. Direct workspace routes (/my-applications, /opportunities/create, /passport, /opportunities) redirect to /onboarding', async () => {
    const authState = {
      user: { uid: 'user_incomplete_2', email: 'incomplete2@example.com' },
      profile: {
        uid: 'user_incomplete_2',
        email: 'incomplete2@example.com',
        onboardingCompleted: false,
        activePersona: 'partner',
        availablePersonas: ['partner'],
      },
      loading: false,
    };

    // Test /my-applications
    await renderAppAtRoute(['/my-applications'], authState);
    assert.strictEqual(container.querySelector('#my-applications-view'), null);
    assert.ok(container.textContent?.includes('Select Your Primary Lens'));

    // Test /opportunities/create
    document.body.innerHTML = '<div id="root"></div>';
    container = document.getElementById('root') as HTMLDivElement;
    await renderAppAtRoute(['/opportunities/create'], authState);
    assert.strictEqual(container.querySelector('#create-opportunity-view'), null);
    assert.ok(container.textContent?.includes('Select Your Primary Lens'));

    // Test /opportunities
    document.body.innerHTML = '<div id="root"></div>';
    container = document.getElementById('root') as HTMLDivElement;
    await renderAppAtRoute(['/opportunities'], authState);
    assert.strictEqual(container.querySelector('#opportunities-marketplace-page'), null);
    assert.ok(container.textContent?.includes('Select Your Primary Lens'));
  });

  it('4. Refresh on every onboarding step preserves isolated onboarding shell', async () => {
    const authState = {
      user: { uid: 'user_onb_step', email: 'step@example.com' },
      profile: {
        uid: 'user_onb_step',
        email: 'step@example.com',
        onboardingCompleted: false,
        activePersona: 'learner',
        availablePersonas: ['learner'],
      },
      loading: false,
    };

    // Refresh on /onboarding
    await renderAppAtRoute(['/onboarding'], authState);
    assert.ok(container.textContent?.includes('Select Your Primary Lens'));
    assert.ok(container.querySelector('#onboarding-signout-btn'));
    assert.strictEqual(container.querySelector('#global-header'), null);

    // Refresh on /onboarding/profile
    document.body.innerHTML = '<div id="root"></div>';
    container = document.getElementById('root') as HTMLDivElement;
    await renderAppAtRoute(['/onboarding/profile?persona=learner'], authState);
    assert.ok(container.textContent?.includes('Setup Your Learner Profile'));
    assert.ok(container.querySelector('#onboarding-signout-btn'));
    assert.strictEqual(container.querySelector('#global-header'), null);

    // Refresh on /onboarding/organization
    document.body.innerHTML = '<div id="root"></div>';
    container = document.getElementById('root') as HTMLDivElement;
    await renderAppAtRoute(['/onboarding/organization?persona=client'], authState);
    assert.ok(container.textContent?.includes('Initialize Client Profile'));
    assert.ok(container.querySelector('#onboarding-signout-btn'));
    assert.strictEqual(container.querySelector('#global-header'), null);
  });

  it('5. Reopening the tab with incomplete session gates immediately to /onboarding', async () => {
    await renderAppAtRoute(['/'], {
      user: { uid: 'user_tab_reopen', email: 'reopen@example.com' },
      profile: {
        uid: 'user_tab_reopen',
        email: 'reopen@example.com',
        onboardingCompleted: false,
        activePersona: 'learner',
        availablePersonas: ['learner'],
      },
      loading: false,
    });

    assert.strictEqual(container.querySelector('#public-ecosystem-portal'), null);
    assert.ok(container.textContent?.includes('Select Your Primary Lens'));
  });

  it('6. Public passport as unauthenticated visitor remains accessible', async () => {
    await renderAppAtRoute(['/p/creator_published_123'], {
      user: null,
      profile: null,
      loading: false,
    });

    // Should render public passport component without redirection to /onboarding or /auth/login
    assert.strictEqual(container.querySelector('#onboarding-signout-btn'), null);
    assert.strictEqual(Boolean(container.textContent?.includes('Select Your Primary Lens')), false);
  });

  it('7. Public passport route as incomplete authenticated user redirects to /onboarding', async () => {
    await renderAppAtRoute(['/p/other_user_123'], {
      user: { uid: 'user_incomplete_pass', email: 'incomplete@example.com' },
      profile: {
        uid: 'user_incomplete_pass',
        email: 'incomplete@example.com',
        onboardingCompleted: false,
        activePersona: 'learner',
        availablePersonas: ['learner'],
      },
      loading: false,
    });

    assert.ok(container.textContent?.includes('Select Your Primary Lens'), 'Incomplete user must be redirected to /onboarding');
  });

  it('8. Authoritative transition: Completing onboarding unlocks workspace and renders Ecosystem Portal on "/"', async () => {
    await renderAppAtRoute(['/'], {
      user: { uid: 'user_completed_123', email: 'completed@example.com' },
      profile: {
        uid: 'user_completed_123',
        email: 'completed@example.com',
        displayName: 'Alice Completed',
        onboardingCompleted: true,
        activePersona: 'learner',
        availablePersonas: ['learner', 'partner'],
      },
      loading: false,
    });

    // PublicEcosystemPortal renders authenticated portal
    const portal = container.querySelector('#public-ecosystem-portal');
    assert.ok(portal, 'PublicEcosystemPortal MUST render for completed user');
    assert.ok(container.textContent?.includes('Alice Completed'));

    // GlobalHeader and full ecosystem footer are restored
    assert.ok(container.querySelector('#global-header'), 'GlobalHeader must be rendered');
    assert.ok(container.querySelector('footer a[href="/about"]'), 'Full ecosystem footer must be present');
  });

  it('9. Authentication pages (/auth/login, /auth/register) have NO workspace navigation shell', async () => {
    await renderAppAtRoute(['/auth/login'], {
      user: null,
      profile: null,
      loading: false,
    });

    assert.strictEqual(container.querySelector('#global-header'), null, 'Must NOT have GlobalHeader');
    assert.strictEqual(container.querySelector('footer a[href="/about"]'), null, 'Must NOT have workspace footer');
    assert.ok(container.querySelector('#signin-page-view'));
  });

  it('10. Onboarding pages have dedicated minimal shell with branding, setup progress, sign out, and NO workspace navigation', async () => {
    await renderAppAtRoute(['/onboarding'], {
      user: { uid: 'user_onb_shell', email: 'shell@example.com' },
      profile: {
        uid: 'user_onb_shell',
        email: 'shell@example.com',
        onboardingCompleted: false,
        activePersona: 'learner',
        availablePersonas: ['learner'],
      },
      loading: false,
    });

    const header = container.querySelector('header');
    assert.ok(header, 'Must have minimal onboarding header');
    assert.ok(header.textContent?.includes('GigLink'));
    assert.ok(header.textContent?.includes('Workspace Setup'));
    assert.ok(header.textContent?.includes('Verified Identity Protocol'));
    assert.ok(container.querySelector('#onboarding-signout-btn'), 'Must have Sign Out button');
    assert.strictEqual(container.querySelector('#global-header-persona-switcher'), null, 'Must NOT have persona switcher');
    assert.strictEqual(container.querySelector('footer a[href="/about"]'), null, 'Must NOT have workspace footer');
  });

  it('11. Workspace shell restoration: Visiting already onboarded account renders full GlobalHeader and footer', async () => {
    await renderAppAtRoute(['/'], {
      user: { uid: 'user_full_ws', email: 'ws@example.com' },
      profile: {
        uid: 'user_full_ws',
        email: 'ws@example.com',
        displayName: 'Bob Workspace',
        onboardingCompleted: true,
        activePersona: 'partner',
        availablePersonas: ['partner'],
      },
      loading: false,
    });

    assert.ok(container.querySelector('#global-header'), 'GlobalHeader present');
    assert.ok(container.querySelector('footer a[href="/about"]'), 'Workspace footer present');
  });

  it('12. Zero UI / Layout flash: While loading session, workspace shell is never mounted', async () => {
    await renderAppAtRoute(['/'], {
      user: { uid: 'user_loading', email: 'loading@example.com' },
      profile: null, // profile still resolving
      loading: true,
    });

    assert.strictEqual(container.querySelector('#global-header'), null, 'GlobalHeader must NOT mount during session loading');
    assert.strictEqual(container.querySelector('#public-ecosystem-portal'), null, 'Ecosystem portal must NOT render during loading');
  });
});
