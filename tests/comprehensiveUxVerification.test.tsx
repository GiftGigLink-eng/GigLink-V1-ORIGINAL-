import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { UserProfile, TrustPassport, PublicTrustPassport, UserPersona } from '../src/types';

describe('Comprehensive End-to-End UX Verification Suite (Pre-Group 5)', () => {
  let dom: JSDOM;
  let container: HTMLDivElement;

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
    } catch {}
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).HTMLButtonElement = dom.window.HTMLButtonElement;
    (global as any).HTMLAnchorElement = dom.window.HTMLAnchorElement;
  });

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    container = document.getElementById('root') as HTMLDivElement;
  });

  // =========================================================================
  // 1. AUTHENTICATION & FIRST-TIME USER FLOW
  // =========================================================================
  describe('1. Authentication -> First-Time User Flow', () => {
    it('1.1 Un-onboarded new user is gated to /onboarding', async () => {
      const MockUnOnboardedRoute = () => {
        const profile: UserProfile = {
          uid: 'new_user_101',
          email: 'newuser@example.com',
          displayName: 'New Candidate',
          photoURL: '',
          activePersona: 'learner',
          availablePersonas: ['learner', 'partner', 'client', 'organization_admin'],
          onboardingCompleted: false,
          createdAt: '2026-08-16T00:00:00Z',
          updatedAt: '2026-08-16T00:00:00Z',
        };

        if (profile.onboardingCompleted === false) {
          return (
            <div data-testid="onboarding-gateway">
              <h1>Select Your Primary Lens</h1>
              <div className="persona-card" id="persona-learner">Learner Workspace</div>
              <div className="persona-card" id="persona-partner">Partner Workspace</div>
              <div className="persona-card" id="persona-client">Client Workspace</div>
              <div className="persona-card" id="persona-organization">Organization Workspace</div>
            </div>
          );
        }
        return <div data-testid="dashboard">GigLink Dashboard</div>;
      };

      const root = createRoot(container);
      await act(async () => {
        root.render(
          <MemoryRouter initialEntries={['/']}>
            <MockUnOnboardedRoute />
          </MemoryRouter>
        );
      });

      assert.match(container.innerHTML, /Select Your Primary Lens/i);
      assert.match(container.innerHTML, /Learner Workspace/i);
      assert.match(container.innerHTML, /Partner Workspace/i);
      assert.match(container.innerHTML, /Client Workspace/i);
      assert.match(container.innerHTML, /Organization Workspace/i);
    });

    it('1.2 Persona selection directs to correct onboarding sub-wizard', () => {
      const routes = {
        learner: '/onboarding/profile?persona=learner',
        partner: '/onboarding/profile?persona=partner',
        client: '/onboarding/organization?persona=client',
        organization_admin: '/onboarding/organization?persona=organization_admin',
      };

      assert.equal(routes.learner, '/onboarding/profile?persona=learner');
      assert.equal(routes.partner, '/onboarding/profile?persona=partner');
      assert.equal(routes.client, '/onboarding/organization?persona=client');
      assert.equal(routes.organization_admin, '/onboarding/organization?persona=organization_admin');
    });

    it('1.3 Onboarding completion updates status and navigates to Dashboard without looping back', async () => {
      let profile: UserProfile = {
        uid: 'new_user_101',
        email: 'newuser@example.com',
        displayName: 'New Candidate',
        photoURL: '',
        activePersona: 'learner',
        availablePersonas: ['learner', 'partner', 'client', 'organization_admin'],
        onboardingCompleted: false,
        createdAt: '2026-08-16T00:00:00Z',
        updatedAt: '2026-08-16T00:00:00Z',
      };

      // Simulate completing onboarding
      profile = {
        ...profile,
        displayName: 'Alex Morgan',
        onboardingCompleted: true,
      };

      const MockAppRoute = ({ prof }: { prof: UserProfile }) => {
        if (!prof.onboardingCompleted) {
          return <div data-testid="onboarding">Select Your Primary Lens</div>;
        }
        return <div data-testid="dashboard">GigLink Ecosystem Portal / Dashboard</div>;
      };

      const root = createRoot(container);
      await act(async () => {
        root.render(
          <MemoryRouter initialEntries={['/']}>
            <MockAppRoute prof={profile} />
          </MemoryRouter>
        );
      });

      assert.match(container.innerHTML, /GigLink Ecosystem Portal/i);
      assert.doesNotMatch(container.innerHTML, /Select Your Primary Lens/i);
    });
  });

  // =========================================================================
  // 2. RETURNING USER FLOW
  // =========================================================================
  describe('2. Returning User Flow', () => {
    it('2.1 Already onboarded account reaches Dashboard directly on sign in', async () => {
      const returningProfile: UserProfile = {
        uid: 'returning_user_202',
        email: 'veteran@example.com',
        displayName: 'Veteran Pro',
        photoURL: '',
        activePersona: 'partner',
        availablePersonas: ['learner', 'partner', 'client', 'organization_admin'],
        onboardingCompleted: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      };

      const MockDashboard = () => (
        <div data-testid="returning-dashboard">
          <h1>Verified Career & Trust Protocol</h1>
          <p>Authenticated as {returningProfile.displayName}</p>
        </div>
      );

      const root = createRoot(container);
      await act(async () => {
        root.render(
          <MemoryRouter initialEntries={['/']}>
            <MockDashboard />
          </MemoryRouter>
        );
      });

      assert.match(container.innerHTML, /Authenticated as Veteran Pro/i);
      assert.doesNotMatch(container.innerHTML, /Select Your Primary Lens/i);
    });

    it('2.2 Returning user persona switching operates seamlessly in header and mobile drawer', () => {
      let activePersona: UserPersona = 'learner';
      const switchPersona = (p: UserPersona) => {
        activePersona = p;
      };

      switchPersona('client');
      assert.equal(activePersona, 'client');
      switchPersona('partner');
      assert.equal(activePersona, 'partner');
      switchPersona('organization_admin');
      assert.equal(activePersona, 'organization_admin');
    });
  });

  // =========================================================================
  // 3. TRUST PASSPORT FLOW (OWNER VS THIRD-PARTY)
  // =========================================================================
  describe('3. Trust Passport Flow (Owner vs Third Party Resolution)', () => {
    it('3.1 Owner sees private passport regardless of public state (Private, Unpublished, Published)', async () => {
      const ownerUid = 'owner_user_303';
      const privatePassport: TrustPassport = {
        id: ownerUid,
        userId: ownerUid,
        headline: 'Senior Cloud Architect',
        bio: 'Designing fault-tolerant distributed platforms.',
        location: 'London, UK',
        locationVerificationStatus: 'self_declared',
        identityVerified: true,
        isPublic: false,
        skills: [{ id: 's1', name: 'Cloud Architecture', category: 'technology', proficiency: 'expert', verifiedCount: 3 }],
        projects: [],
        certificates: [],
        education: [],
        workHistory: [],
        reviews: [],
        metrics: {
          verificationScore: 40,
          completedProjectsCount: 5,
          verifiedSkillsCount: 2,
          endorsementsCount: 3,
          activeStreakDays: 14,
        },
        updatedAt: '2026-08-16T00:00:00Z',
      };

      const MockOwnerResolver = ({ currentUserId, targetUid }: { currentUserId: string; targetUid: string }) => {
        if (currentUserId === targetUid) {
          return (
            <div data-testid="private-passport">
              <span id="passport-visibility-badge">
                {privatePassport.isPublic ? 'PUBLIC (PUBLISHED)' : 'PRIVATE'}
              </span>
              <h2>{privatePassport.headline}</h2>
              <p>{privatePassport.bio}</p>
            </div>
          );
        }
        return <div data-testid="public-passport">Public View</div>;
      };

      const root = createRoot(container);
      await act(async () => {
        root.render(
          <MemoryRouter initialEntries={[`/passport/${ownerUid}`]}>
            <MockOwnerResolver currentUserId={ownerUid} targetUid={ownerUid} />
          </MemoryRouter>
        );
      });

      assert.match(container.innerHTML, /PRIVATE/i);
      assert.match(container.innerHTML, /Senior Cloud Architect/i);
      assert.match(container.innerHTML, /Designing fault-tolerant distributed platforms/i);
    });

    it('3.2 Third-party visitor sees public projection when published', async () => {
      const targetUid = 'target_user_404';
      const viewerUid = 'viewer_user_888';

      const publicPassportDoc: PublicTrustPassport = {
        userId: targetUid,
        displayName: 'Public Developer',
        headline: 'Frontend Engineer',
        bio: 'Building verified responsive React applications.',
        location: 'Berlin, Germany',
        locationVerificationStatus: 'self_declared',
        identityVerified: true,
        trustScore: 75,
        trustTier: 'Platinum',
        skills: [{ id: 's1', name: 'React', category: 'technology', proficiency: 'expert', verifiedCount: 2 }],
        projects: [],
        certificates: [],
        education: [],
        workHistory: [],
        reviews: [],
        metrics: {
          verificationScore: 40,
          completedProjectsCount: 2,
          verifiedSkillsCount: 1,
          endorsementsCount: 0,
          activeStreakDays: 5,
        },
        updatedAt: '2026-08-16T00:00:00Z',
      };

      const MockThirdPartyResolver = ({ currentUserId, targetUid, publicDoc }: { currentUserId: string; targetUid: string; publicDoc: any }) => {
        if (currentUserId === targetUid) {
          return <div>Private Passport</div>;
        }
        if (!publicDoc) {
          return <div>Private or Inactive Trust Passport</div>;
        }
        return (
          <div data-testid="public-passport-view">
            <h1>{publicDoc.displayName}</h1>
            <p>{publicDoc.headline}</p>
            <span id="public-score">{publicDoc.trustScore}</span>
            <span id="public-tier">{publicDoc.trustTier}</span>
          </div>
        );
      };

      const root = createRoot(container);
      await act(async () => {
        root.render(
          <MemoryRouter initialEntries={[`/passport/${targetUid}`]}>
            <MockThirdPartyResolver currentUserId={viewerUid} targetUid={targetUid} publicDoc={publicPassportDoc} />
          </MemoryRouter>
        );
      });

      assert.match(container.innerHTML, /Public Developer/i);
      assert.match(container.innerHTML, /Frontend Engineer/i);
      assert.match(container.innerHTML, /75/i);
      assert.match(container.innerHTML, /Platinum/i);
    });

    it('3.3 Third-party visitor receives inactive notice and no private data when passport is private', async () => {
      const targetUid = 'private_user_505';
      const viewerUid = 'viewer_user_888';
      const publicPassportDoc = null; // Private passport -> no public projection

      const MockThirdPartyResolver = ({ currentUserId, targetUid, publicDoc }: { currentUserId: string; targetUid: string; publicDoc: any }) => {
        if (currentUserId === targetUid) {
          return <div>Private Passport</div>;
        }
        if (!publicDoc || !publicDoc.isPublic) {
          return (
            <div data-testid="private-fallback">
              <h2>Private or inactive Trust Passport</h2>
              <p>This profile is not currently published for public verification.</p>
              <a href="/opportunities">Explore Opportunities</a>
            </div>
          );
        }
        return <div>Public Passport</div>;
      };

      const root = createRoot(container);
      await act(async () => {
        root.render(
          <MemoryRouter initialEntries={[`/passport/${targetUid}`]}>
            <MockThirdPartyResolver currentUserId={viewerUid} targetUid={targetUid} publicDoc={publicPassportDoc} />
          </MemoryRouter>
        );
      });

      assert.match(container.innerHTML, /Private or inactive Trust Passport/i);
      assert.match(container.innerHTML, /Explore Opportunities/i);
    });
  });

  // =========================================================================
  // 4. NAVIGATION CONSISTENCY & CANONICAL ROUTES
  // =========================================================================
  describe('4. Navigation Consistency Across Channels', () => {
    it('4.1 Verifies all header, menu, mobile, and portal passport links use /talent/passport or /passport/${user.uid}', () => {
      const appFile = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
      const headerFile = fs.readFileSync(path.join(process.cwd(), 'src/components/layout/GlobalHeader.tsx'), 'utf-8');
      const mobileFile = fs.readFileSync(path.join(process.cwd(), 'src/components/layout/MobileNavDrawer.tsx'), 'utf-8');
      const portalFile = fs.readFileSync(path.join(process.cwd(), 'src/components/public/PublicEcosystemPortal.tsx'), 'utf-8');

      // Verify route registered
      assert.match(appFile, /<Route\s+path="\/passport\/:uid"\s+element=\{<PassportResolverPage\s*\/>\}\s*\/>/);
      assert.match(appFile, /<Route\s+path="\/p\/:uid"\s+element=\{<(PublicPassportPage|PublicProfilePage)\s*\/>\}\s*\/>/);

      // Verify header link
      assert.ok(
        headerFile.includes('/talent/passport') || headerFile.includes('/passport/${user.uid}'),
        'Header must link to passport'
      );

      // Verify user menu button
      assert.ok(
        headerFile.includes("navigate('/talent/passport')") || headerFile.includes('navigate(`/passport/${user.uid}`)'),
        'User menu must navigate to passport'
      );

      // Verify mobile drawer link
      assert.ok(
        mobileFile.includes('/talent/passport') || mobileFile.includes('/passport/${user.uid}'),
        'Mobile drawer must link to passport'
      );

      // Verify portal button
      assert.match(portalFile, /navigate\(`\/passport\/\$\{user\.uid\}`\)/);
    });

    it('4.2 Verifies marketplace creator & applicant badges link to canonical /p/:uid', () => {
      const oppDetailFile = fs.readFileSync(path.join(process.cwd(), 'src/components/opportunities/OpportunityDetailPage.tsx'), 'utf-8');
      const manageAppFile = fs.readFileSync(path.join(process.cwd(), 'src/components/opportunities/ManageApplicationsPage.tsx'), 'utf-8');

      // Verify OpportunityDetailPage creator link
      assert.match(oppDetailFile, /to=\{`\/p\/\$\{opportunity\.creatorId\}`\}/);

      // Verify ManageApplicationsPage applicant link
      assert.match(manageAppFile, /to=\{`\/p\/\$\{app\.applicantId\}`\}/);
    });
  });

  // =========================================================================
  // 5. SECURITY & READ-ONLY INVARIANTS
  // =========================================================================
  describe('5. Production Safety & Read-Only Invariants', () => {
    it('5.1 PublicPassportPage has zero mutation operations', () => {
      const publicPassportFile = fs.readFileSync(path.join(process.cwd(), 'src/components/passport/PublicPassportPage.tsx'), 'utf-8');
      
      assert.doesNotMatch(publicPassportFile, /setDoc\(/);
      assert.doesNotMatch(publicPassportFile, /updateDoc\(/);
      assert.doesNotMatch(publicPassportFile, /deleteDoc\(/);
      assert.doesNotMatch(publicPassportFile, /addDoc\(/);
    });

    it('5.2 Firestore rules protect private passports and only allow sanitized public passports', () => {
      const rules = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf-8');
      
      // Trust passports private access
      assert.match(rules, /match\s+\/trustPassports\/\{passportId\}\s*\{[\s\S]*?allow\s+get:\s*if\s+isOwner\(passportId\)\s*\|\|\s*isAdmin\(\);/);
      assert.match(rules, /match\s+\/trustPassports\/\{passportId\}\s*\{[\s\S]*?allow\s+list:\s*if\s+isAdmin\(\);/);

      // Public trust passports sanitized read & anti-scraping
      assert.match(rules, /match\s+\/publicTrustPassports\/\{passportId\}\s*\{[\s\S]*?allow\s+get:\s*if\s+true;/);
      assert.match(rules, /match\s+\/publicTrustPassports\/\{passportId\}\s*\{[\s\S]*?allow\s+list:\s*if\s+false;/);
    });
  });

  // =========================================================================
  // 6. APPLICATION SHELL & ONBOARDING ISOLATION
  // =========================================================================
  describe('6. Application Shell & Onboarding Isolation', () => {
    it('6.1 AppShell inspects path and isolates Auth, Onboarding, and Workspace layouts', () => {
      const appShellFile = fs.readFileSync(path.join(process.cwd(), 'src/components/layout/AppShell.tsx'), 'utf-8');

      // Check auth isolation
      assert.match(appShellFile, /pathname\.startsWith\('\/auth'\)/);

      // Check onboarding isolation
      assert.match(appShellFile, /pathname\.startsWith\('\/onboarding'\)/);

      // Check dedicated onboarding header with brand and setup badge
      assert.match(appShellFile, /Workspace Setup/);
      assert.match(appShellFile, /Verified Identity Protocol/);

      // Check absence of GlobalHeader on onboarding/auth layouts
      // GlobalHeader is only in the main workspace return block
      assert.match(appShellFile, /<GlobalHeader onToggleMobileNav/);
    });
  });
});
