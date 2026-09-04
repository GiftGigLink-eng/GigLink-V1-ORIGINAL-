/**
 * Trust Passport Navigation & Route Regression Test Suite
 * Validates that Trust Passport buttons route directly to the read-only passport page
 * (/passport/:userId, /p/:userId, or /talent/passport) and NEVER trigger Role Selection or mutate data.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

describe('Trust Passport Navigation & Routing Regression Tests', () => {
  const globalHeaderPath = path.resolve(process.cwd(), 'src/components/layout/GlobalHeader.tsx');
  const mobileNavDrawerPath = path.resolve(process.cwd(), 'src/components/layout/MobileNavDrawer.tsx');
  const portalPath = path.resolve(process.cwd(), 'src/components/public/PublicEcosystemPortal.tsx');
  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const manageAppsPath = path.resolve(process.cwd(), 'src/components/opportunities/ManageApplicationsPage.tsx');
  const oppDetailPath = path.resolve(process.cwd(), 'src/components/opportunities/OpportunityDetailPage.tsx');

  it('1. App.tsx registers PassportResolverPage for /passport/:uid and PublicProfilePage or PublicPassportPage for /p/:uid', () => {
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.match(appContent, /path="\/passport\/:uid"\s+element={<PassportResolverPage\s*\/>}/);
    assert.match(appContent, /path="\/p\/:uid"\s+element={<(PublicProfilePage|PublicPassportPage)\s*\/>}/);
  });

  it('2. GlobalHeader links to /talent/passport or /passport/${user.uid}', () => {
    const headerContent = fs.readFileSync(globalHeaderPath, 'utf8');
    assert.ok(
      headerContent.includes('/talent/passport') || headerContent.includes('/passport/${user.uid}'),
      'GlobalHeader must link to talent passport'
    );
    // Ensure it does NOT link to unparameterized /passport which triggered role-selection redirect
    assert.doesNotMatch(headerContent, /to="\/passport"/);
  });

  it('3. GlobalHeader User Menu Trust Passport button navigates to /talent/passport or /passport/${user.uid}', () => {
    const headerContent = fs.readFileSync(globalHeaderPath, 'utf8');
    assert.ok(
      headerContent.includes("navigate('/talent/passport')") || headerContent.includes('navigate(`/passport/${user.uid}`)'),
      'User menu must navigate to talent passport'
    );
  });

  it('4. MobileNavDrawer Trust Passport link navigates to /talent/passport or /passport/${user.uid}', () => {
    const mobileContent = fs.readFileSync(mobileNavDrawerPath, 'utf8');
    assert.ok(
      mobileContent.includes('/talent/passport') || mobileContent.includes('/passport/${user.uid}'),
      'Mobile drawer must link to talent passport'
    );
  });

  it('5. PublicEcosystemPortal "My Trust Passport" button navigates to /passport/${user.uid}', () => {
    const portalContent = fs.readFileSync(portalPath, 'utf8');
    assert.match(portalContent, /navigate\(`\/passport\/\$\{user\.uid\}`\)/);
  });

  it('6. ManageApplicationsPage links directly to applicant public passport /p/${app.applicantId}', () => {
    const manageContent = fs.readFileSync(manageAppsPath, 'utf8');
    assert.match(manageContent, /to=\{`\/p\/\$\{app\.applicantId\}`\}/);
  });

  it('7. OpportunityDetailPage links directly to creator public passport /p/${opportunity.creatorId}', () => {
    const oppDetailContent = fs.readFileSync(oppDetailPath, 'utf8');
    assert.match(oppDetailContent, /to=\{`\/p\/\$\{opportunity\.creatorId\}`\}/);
  });

  it('8. PublicPassportPage remains purely read-only and does not write to Firestore or trigger role selection', () => {
    const publicPassportPath = path.resolve(process.cwd(), 'src/components/passport/PublicPassportPage.tsx');
    const content = fs.readFileSync(publicPassportPath, 'utf8');
    assert.doesNotMatch(content, /setDoc/);
    assert.doesNotMatch(content, /updateDoc/);
    assert.doesNotMatch(content, /deleteDoc/);
    assert.doesNotMatch(content, /addDoc/);
    assert.doesNotMatch(content, /activePersona/);
  });
});
