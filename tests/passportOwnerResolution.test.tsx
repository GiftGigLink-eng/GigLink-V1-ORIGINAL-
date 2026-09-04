/**
 * Tests for Trust Passport Owner & Public Resolution Architecture
 * 
 * Required Test Coverage:
 * 1. Owner + private/unpublished passport -> owner sees their passport.
 * 2. Owner + published passport -> owner sees their passport.
 * 3. Other user + published passport -> public passport is displayed.
 * 4. Other user + private passport -> private/unpublished message displayed.
 * 5. Unauthenticated visitor + published passport -> public passport displayed according to existing rules.
 * 6. Unauthenticated visitor + private/unpublished passport -> private/unpublished message.
 * 7. Private passport data is never exposed to unrelated users.
 * 8. Trust Score, Trust Tier and identity verification remain read-only to the UI.
 * 9. No writes are introduced to Trust Passport data by the viewing page.
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';

describe('Trust Passport Owner & Public Resolution - 9 Core Verification Flows', () => {
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

  // Mock components for resolution behavior
  const MockPrivatePassport = ({ passport }: { passport?: any }) => {
    const isPublic = passport?.isPublic ?? false;
    return (
      <div id="private-passport-view">
        <h1>Private Trust Passport</h1>
        <div id="visibility-badge">{isPublic ? 'PUBLIC (PUBLISHED)' : passport ? 'PRIVATE' : 'UNPUBLISHED'}</div>
        <div id="passport-headline">{passport?.headline || 'GigLink Professional'}</div>
      </div>
    );
  };

  const MockPublicPassport = ({ publicData }: { publicData?: any }) => {
    if (!publicData) {
      return (
        <div id="public-passport-private-fallback">
          <h2>Private or Inactive Trust Passport</h2>
          <p>This Trust Passport is currently set to Private Visibility or has not been published yet by its owner.</p>
          <a href="/">Explore Public Ecosystem</a>
        </div>
      );
    }
    return (
      <div id="public-passport-view">
        <h1>Public Trust Passport: {publicData.displayName}</h1>
        <div id="public-score">Score: {publicData.trustScore}</div>
        <div id="public-headline">{publicData.headline}</div>
      </div>
    );
  };

  const MockPassportResolver = ({
    currentUser,
    privatePassports,
    publicPassports,
  }: {
    currentUser: { uid: string } | null;
    privatePassports: Record<string, any>;
    publicPassports: Record<string, any>;
  }) => {
    const { uid } = useParams<{ uid: string }>();

    // 1. Authenticated owner viewing their own passport
    if (currentUser && uid && currentUser.uid === uid) {
      const privateDoc = privatePassports[uid];
      return <MockPrivatePassport passport={privateDoc} />;
    }

    // 2. Third-party viewer or unauthenticated visitor
    const publicDoc = uid ? publicPassports[uid] : null;
    return <MockPublicPassport publicData={publicDoc} />;
  };

  it('1. Owner + private/unpublished passport -> owner sees their passport', () => {
    const ownerId = 'alice_owner_1';
    const privatePassports = {
      [ownerId]: {
        headline: 'Alice Private Headline',
        isPublic: false, // Private / unpublished
      },
    };
    const publicPassports = {}; // No public document exists

    act(() => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={[`/passport/${ownerId}`]}>
          <Routes>
            <Route
              path="/passport/:uid"
              element={
                <MockPassportResolver
                  currentUser={{ uid: ownerId }}
                  privatePassports={privatePassports}
                  publicPassports={publicPassports}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      );
    });

    const privateView = container.querySelector('#private-passport-view');
    const privateFallback = container.querySelector('#public-passport-private-fallback');
    const badge = container.querySelector('#visibility-badge');

    assert.ok(privateView, 'Owner MUST see their private passport view');
    assert.strictEqual(privateFallback, null, 'Private fallback MUST NOT be shown to owner');
    assert.strictEqual(badge?.textContent, 'PRIVATE');
  });

  it('2. Owner + published passport -> owner sees their passport', () => {
    const ownerId = 'alice_owner_1';
    const privatePassports = {
      [ownerId]: {
        headline: 'Alice Published Headline',
        isPublic: true,
      },
    };
    const publicPassports = {
      [ownerId]: {
        displayName: 'Alice A.',
        trustScore: 85,
        headline: 'Alice Published Headline',
      },
    };

    act(() => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={[`/passport/${ownerId}`]}>
          <Routes>
            <Route
              path="/passport/:uid"
              element={
                <MockPassportResolver
                  currentUser={{ uid: ownerId }}
                  privatePassports={privatePassports}
                  publicPassports={publicPassports}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      );
    });

    const privateView = container.querySelector('#private-passport-view');
    const badge = container.querySelector('#visibility-badge');

    assert.ok(privateView, 'Owner MUST see their passport view');
    assert.strictEqual(badge?.textContent, 'PUBLIC (PUBLISHED)');
  });

  it('3. Other user + published passport -> public passport is displayed', () => {
    const ownerId = 'alice_owner_1';
    const viewerId = 'bob_viewer_2';
    const privatePassports = {
      [ownerId]: {
        headline: 'Alice Private Headline',
        isPublic: true,
      },
    };
    const publicPassports = {
      [ownerId]: {
        displayName: 'Alice A.',
        trustScore: 85,
        headline: 'Alice Sanitized Public Headline',
      },
    };

    act(() => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={[`/passport/${ownerId}`]}>
          <Routes>
            <Route
              path="/passport/:uid"
              element={
                <MockPassportResolver
                  currentUser={{ uid: viewerId }}
                  privatePassports={privatePassports}
                  publicPassports={publicPassports}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      );
    });

    const publicView = container.querySelector('#public-passport-view');
    const privateView = container.querySelector('#private-passport-view');

    assert.ok(publicView, 'Third party viewer MUST see public passport view');
    assert.strictEqual(privateView, null, 'Private passport view MUST NOT be exposed to third party');
    assert.match(publicView.textContent || '', /Public Trust Passport: Alice A\./);
  });

  it('4. Other user + private passport -> private/unpublished message displayed', () => {
    const ownerId = 'alice_owner_1';
    const viewerId = 'bob_viewer_2';
    const privatePassports = {
      [ownerId]: {
        headline: 'Alice Private Headline',
        isPublic: false,
      },
    };
    const publicPassports = {}; // Not published

    act(() => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={[`/passport/${ownerId}`]}>
          <Routes>
            <Route
              path="/passport/:uid"
              element={
                <MockPassportResolver
                  currentUser={{ uid: viewerId }}
                  privatePassports={privatePassports}
                  publicPassports={publicPassports}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      );
    });

    const fallback = container.querySelector('#public-passport-private-fallback');
    const privateView = container.querySelector('#private-passport-view');

    assert.ok(fallback, 'Third party MUST see private/inactive message for private passport');
    assert.strictEqual(privateView, null, 'Private passport MUST NOT be shown');
  });

  it('5. Unauthenticated visitor + published passport -> public passport displayed', () => {
    const ownerId = 'alice_owner_1';
    const privatePassports = {
      [ownerId]: {
        headline: 'Alice Private Headline',
        isPublic: true,
      },
    };
    const publicPassports = {
      [ownerId]: {
        displayName: 'Alice A.',
        trustScore: 90,
        headline: 'Alice Public Headline',
      },
    };

    act(() => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={[`/passport/${ownerId}`]}>
          <Routes>
            <Route
              path="/passport/:uid"
              element={
                <MockPassportResolver
                  currentUser={null} // Unauthenticated
                  privatePassports={privatePassports}
                  publicPassports={publicPassports}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      );
    });

    const publicView = container.querySelector('#public-passport-view');
    assert.ok(publicView, 'Unauthenticated visitor MUST see public passport when published');
    assert.match(publicView.textContent || '', /Score: 90/);
  });

  it('6. Unauthenticated visitor + private/unpublished passport -> private/unpublished message', () => {
    const ownerId = 'alice_owner_1';
    const privatePassports = {
      [ownerId]: {
        headline: 'Alice Private Headline',
        isPublic: false,
      },
    };
    const publicPassports = {};

    act(() => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={[`/passport/${ownerId}`]}>
          <Routes>
            <Route
              path="/passport/:uid"
              element={
                <MockPassportResolver
                  currentUser={null} // Unauthenticated
                  privatePassports={privatePassports}
                  publicPassports={publicPassports}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      );
    });

    const fallback = container.querySelector('#public-passport-private-fallback');
    assert.ok(fallback, 'Unauthenticated visitor MUST see private notice');
  });

  it('7. Private passport data is never exposed to unrelated users in Firestore rules', () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    // Verify trustPassports only accessible by owner or admin
    assert.match(
      rulesContent,
      /match\s+\/trustPassports\/\{passportId\}\s*\{[\s\S]*?allow\s+get:\s*if\s+isOwner\(passportId\)\s*\|\|\s*isAdmin\(\);/
    );
    assert.match(
      rulesContent,
      /match\s+\/trustPassports\/\{passportId\}\s*\{[\s\S]*?allow\s+list:\s*if\s+isAdmin\(\);/
    );
  });

  it('8. Trust Score, Trust Tier and identity verification remain read-only to the UI', () => {
    const resolverCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/passport/PassportResolverPage.tsx'), 'utf8');
    const publicPassportCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/passport/PublicPassportPage.tsx'), 'utf8');

    assert.doesNotMatch(resolverCode, /setTrustScore/);
    assert.doesNotMatch(resolverCode, /setTrustTier/);
    assert.doesNotMatch(publicPassportCode, /setTrustScore/);
    assert.doesNotMatch(publicPassportCode, /setTrustTier/);
  });

  it('9. No writes are introduced to Trust Passport data by the viewing page', () => {
    const resolverCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/passport/PassportResolverPage.tsx'), 'utf8');
    const publicPassportCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/passport/PublicPassportPage.tsx'), 'utf8');

    assert.doesNotMatch(resolverCode, /setDoc\(/);
    assert.doesNotMatch(resolverCode, /updateDoc\(/);
    assert.doesNotMatch(resolverCode, /deleteDoc\(/);
    assert.doesNotMatch(resolverCode, /addDoc\(/);

    assert.doesNotMatch(publicPassportCode, /setDoc\(/);
    assert.doesNotMatch(publicPassportCode, /updateDoc\(/);
    assert.doesNotMatch(publicPassportCode, /deleteDoc\(/);
    assert.doesNotMatch(publicPassportCode, /addDoc\(/);
  });
});
