import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { PublicEcosystemPortal } from './components/public/PublicEcosystemPortal';
import { InfoPages } from './components/public/InfoPages';
import { NotFoundPage } from './components/common/NotFoundPage';

// Auth Components & Guards
import { GuestRoute, AuthenticatedRoute, RoleGuardedRoute } from './components/auth/ProtectedRoute';
import { SignInPage } from './components/auth/SignInPage';
import { SignUpPage } from './components/auth/SignUpPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { VerifyEmailPage } from './components/auth/VerifyEmailPage';
import { AccountRecoveryPage } from './components/auth/AccountRecoveryPage';

// Onboarding Components
import { InitialPersonaSelectionPage } from './components/onboarding/InitialPersonaSelectionPage';
import { ProfileOnboardingPage } from './components/onboarding/ProfileOnboardingPage';
import { OrganizationOnboardingPage } from './components/onboarding/OrganizationOnboardingPage';
import { TalentOnboardingPage } from './components/onboarding/TalentOnboardingPage';
import { CreatorOnboardingPage } from './components/onboarding/CreatorOnboardingPage';
import { EnterpriseOnboardingPage } from './components/onboarding/EnterpriseOnboardingPage';
import { InstitutionOnboardingPage } from './components/onboarding/InstitutionOnboardingPage';

// Role Workspace Components (Phase 6.5)
import { TalentDashboardPage } from './components/workspaces/talent/TalentDashboardPage';
import { CreatorDashboardPage } from './components/workspaces/creator/CreatorDashboardPage';
import { EnterpriseDashboardPage } from './components/workspaces/enterprise/EnterpriseDashboardPage';
import { EnterpriseTeamPage } from './components/workspaces/enterprise/EnterpriseTeamPage';
import { EnterpriseBenchPage } from './components/workspaces/enterprise/EnterpriseBenchPage';
import { EnterpriseCompliancePage } from './components/workspaces/enterprise/EnterpriseCompliancePage';
import { AdminDashboardPage } from './components/workspaces/admin/AdminDashboardPage';
import { AdminVerificationsPage } from './components/workspaces/admin/AdminVerificationsPage';
import { AdminProofsPage } from './components/workspaces/admin/AdminProofsPage';
import { AdminSecurityPage } from './components/workspaces/admin/AdminSecurityPage';
import { CeoGuardedRoute } from './components/auth/CeoGuardedRoute';
import { CeoStage2Dashboard } from './components/workspaces/ceo/CeoStage2Dashboard';

// Group 5 Phase 2 & 3: Professional Profile & Portfolio Canonical Routes
import { PrivatePassportPage } from './components/passport/PrivatePassportPage';
import { PublicPassportPage } from './components/passport/PublicPassportPage';
import { PassportResolverPage } from './components/passport/PassportResolverPage';
import { MyProfilePage } from './components/profile/MyProfilePage';
import { PublicProfilePreviewPage } from './components/profile/PublicProfilePreviewPage';
import { PublicProfilePage } from './components/profile/PublicProfilePage';
import { ProjectDetailPage } from './components/profile/ProjectDetailPage';

// Group 5 Phase 4: Organization Profile Components
import { OrganizationProfilePage } from './components/organization/OrganizationProfilePage';
import { OrganizationEditPage } from './components/organization/OrganizationEditPage';

// Group 4 Opportunities & Marketplace Components
import { OpportunitiesExplorePage } from './components/opportunities/OpportunitiesExplorePage';
import { OpportunityDetailPage } from './components/opportunities/OpportunityDetailPage';
import { CreateOpportunityPage } from './components/opportunities/CreateOpportunityPage';
import { EditOpportunityPage } from './components/opportunities/EditOpportunityPage';
import { ManageApplicationsPage } from './components/opportunities/ManageApplicationsPage';
import { MyApplicationsPage } from './components/opportunities/MyApplicationsPage';
import { MyOpportunitiesPage } from './components/opportunities/MyOpportunitiesPage';
import { AcceptedHandoffPage } from './components/opportunities/AcceptedHandoffPage';

// Phase 9A & 9B Verifiable Credentials & Institutional Attestations
import { CredentialsManagementPage } from './components/credentials/CredentialsManagementPage';
import { PublicTranscriptVerificationPage } from './components/credentials/PublicTranscriptVerificationPage';
import { PublicCredentialVerificationPage } from './components/credentials/PublicCredentialVerificationPage';
import { PublicZKVerificationPage } from './components/credentials/PublicZKVerificationPage';
import { InstitutionCredentialIssuancePage } from './components/credentials/InstitutionCredentialIssuancePage';
import { InstitutionCredentialsManagementPage } from './components/credentials/InstitutionCredentialsManagementPage';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <NotificationProvider>
              <AppShell>
                <Routes>
                {/* Public Ecosystem Portal (Root Canonical Route) */}
                <Route path="/" element={<PublicEcosystemPortal />} />

                {/* ========================================================= */}
                {/* 1. TALENT ROLE WORKSPACE CANONICAL ROUTES                 */}
                {/* ========================================================= */}
                <Route
                  path="/talent/dashboard"
                  element={
                    <RoleGuardedRoute allowedRoles={['talent']}>
                      <TalentDashboardPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/talent/passport"
                  element={
                    <RoleGuardedRoute allowedRoles={['talent']}>
                      <PrivatePassportPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/talent/opportunities"
                  element={
                    <RoleGuardedRoute allowedRoles={['talent']}>
                      <OpportunitiesExplorePage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/talent/applications"
                  element={
                    <RoleGuardedRoute allowedRoles={['talent']}>
                      <MyApplicationsPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/talent/milestones"
                  element={
                    <RoleGuardedRoute allowedRoles={['talent']}>
                      <AcceptedHandoffPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/talent/credentials"
                  element={
                    <RoleGuardedRoute allowedRoles={['talent']}>
                      <CredentialsManagementPage />
                    </RoleGuardedRoute>
                  }
                />

                {/* ========================================================= */}
                {/* 2. CREATOR / CLIENT ROLE WORKSPACE CANONICAL ROUTES       */}
                {/* ========================================================= */}
                <Route
                  path="/creator/dashboard"
                  element={
                    <RoleGuardedRoute allowedRoles={['creator']}>
                      <CreatorDashboardPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/client/dashboard"
                  element={
                    <RoleGuardedRoute allowedRoles={['creator']}>
                      <CreatorDashboardPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/creator/opportunities"
                  element={
                    <RoleGuardedRoute allowedRoles={['creator']}>
                      <MyOpportunitiesPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/client/opportunities"
                  element={
                    <RoleGuardedRoute allowedRoles={['creator']}>
                      <MyOpportunitiesPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/creator/opportunities/new"
                  element={
                    <RoleGuardedRoute allowedRoles={['creator']}>
                      <CreateOpportunityPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/client/opportunities/new"
                  element={
                    <RoleGuardedRoute allowedRoles={['creator']}>
                      <CreateOpportunityPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/creator/handoffs"
                  element={
                    <RoleGuardedRoute allowedRoles={['creator']}>
                      <AcceptedHandoffPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/client/handoffs"
                  element={
                    <RoleGuardedRoute allowedRoles={['creator']}>
                      <AcceptedHandoffPage />
                    </RoleGuardedRoute>
                  }
                />

                {/* ========================================================= */}
                {/* 3. ENTERPRISE / AGENCY ROLE WORKSPACE CANONICAL ROUTES    */}
                {/* ========================================================= */}
                <Route
                  path="/enterprise/dashboard"
                  element={
                    <RoleGuardedRoute allowedRoles={['enterprise']}>
                      <EnterpriseDashboardPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/enterprise/team"
                  element={
                    <RoleGuardedRoute allowedRoles={['enterprise']}>
                      <EnterpriseTeamPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/enterprise/opportunities"
                  element={
                    <RoleGuardedRoute allowedRoles={['enterprise']}>
                      <MyOpportunitiesPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/enterprise/bench"
                  element={
                    <RoleGuardedRoute allowedRoles={['enterprise']}>
                      <EnterpriseBenchPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/enterprise/compliance"
                  element={
                    <RoleGuardedRoute allowedRoles={['enterprise']}>
                      <EnterpriseCompliancePage />
                    </RoleGuardedRoute>
                  }
                />

                {/* ========================================================= */}
                {/* 4. PLATFORM VERIFIER / ADMIN ROLE WORKSPACE ROUTES        */}
                {/* ========================================================= */}
                <Route
                  path="/admin/dashboard"
                  element={
                    <RoleGuardedRoute allowedRoles={['admin']}>
                      <AdminDashboardPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/admin/verifications"
                  element={
                    <RoleGuardedRoute allowedRoles={['admin']}>
                      <AdminVerificationsPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/admin/proofs"
                  element={
                    <RoleGuardedRoute allowedRoles={['admin']}>
                      <AdminProofsPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/admin/security"
                  element={
                    <RoleGuardedRoute allowedRoles={['admin']}>
                      <AdminSecurityPage />
                    </RoleGuardedRoute>
                  }
                />

                {/* ========================================================= */}
                {/* PRIVILEGED CEO / OWNER PLATFORM CONTROL (STAGE 2)         */}
                {/* ========================================================= */}
                <Route
                  path="/ceo"
                  element={
                    <CeoGuardedRoute>
                      <CeoStage2Dashboard />
                    </CeoGuardedRoute>
                  }
                />

                {/* ========================================================= */}
                {/* SHARED ECOSYSTEM & LEGACY CANONICAL COMPATIBILITY ROUTES   */}
                {/* ========================================================= */}
                <Route path="/opportunities" element={<OpportunitiesExplorePage />} />
                <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
                <Route
                  path="/opportunities/create"
                  element={
                    <AuthenticatedRoute>
                      <CreateOpportunityPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/opportunities/:id/edit"
                  element={
                    <AuthenticatedRoute>
                      <EditOpportunityPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/opportunities/:id/applications"
                  element={
                    <AuthenticatedRoute>
                      <ManageApplicationsPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/opportunities/:id/handoff/:applicationId"
                  element={
                    <AuthenticatedRoute>
                      <AcceptedHandoffPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/opportunities/:id/handoff"
                  element={
                    <AuthenticatedRoute>
                      <AcceptedHandoffPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/applications/:applicationId/handoff"
                  element={
                    <AuthenticatedRoute>
                      <AcceptedHandoffPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/my-applications"
                  element={
                    <AuthenticatedRoute>
                      <MyApplicationsPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/my-opportunities"
                  element={
                    <AuthenticatedRoute>
                      <MyOpportunitiesPage />
                    </AuthenticatedRoute>
                  }
                />

                {/* Group 5 Phase 2 & 3: Professional Profile & Portfolio Canonical Routes */}
                <Route
                  path="/profile"
                  element={
                    <AuthenticatedRoute>
                      <MyProfilePage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/profile/project/:projectId"
                  element={
                    <AuthenticatedRoute>
                      <ProjectDetailPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/profile/preview"
                  element={
                    <AuthenticatedRoute>
                      <PublicProfilePreviewPage />
                    </AuthenticatedRoute>
                  }
                />

                {/* Public & Resolved Trust Passport & Profile Routes */}
                <Route path="/p/:uid" element={<PublicProfilePage />} />
                <Route path="/p/:uid/project/:projectId" element={<ProjectDetailPage />} />
                <Route path="/passport/:uid" element={<PassportResolverPage />} />

                {/* Group 5 Phase 4: Organization Profile Canonical Routes */}
                <Route path="/org/:orgId" element={<OrganizationProfilePage />} />
                <Route
                  path="/org/:orgId/edit"
                  element={
                    <AuthenticatedRoute>
                      <OrganizationEditPage />
                    </AuthenticatedRoute>
                  }
                />

                {/* Authentication Canonical Routes (Guest Protection) */}
                <Route
                  path="/auth/login"
                  element={
                    <GuestRoute>
                      <SignInPage />
                    </GuestRoute>
                  }
                />
                <Route
                  path="/auth/register"
                  element={
                    <GuestRoute>
                      <SignUpPage />
                    </GuestRoute>
                  }
                />
                <Route
                  path="/auth/forgot-password"
                  element={
                    <GuestRoute>
                      <ForgotPasswordPage />
                    </GuestRoute>
                  }
                />
                <Route
                  path="/auth/reset-password"
                  element={
                    <GuestRoute>
                      <ResetPasswordPage />
                    </GuestRoute>
                  }
                />

                {/* Account Security & Verification Routes (Authenticated) */}
                <Route
                  path="/auth/verify-email"
                  element={
                    <AuthenticatedRoute>
                      <VerifyEmailPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/auth/recovery"
                  element={
                    <AuthenticatedRoute>
                      <AccountRecoveryPage />
                    </AuthenticatedRoute>
                  }
                />

                {/* Onboarding Flow Canonical Routes (Authenticated) */}
                <Route
                  path="/onboarding"
                  element={
                    <AuthenticatedRoute>
                      <InitialPersonaSelectionPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/onboarding/talent"
                  element={
                    <AuthenticatedRoute>
                      <TalentOnboardingPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/onboarding/creator"
                  element={
                    <AuthenticatedRoute>
                      <CreatorOnboardingPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/onboarding/enterprise"
                  element={
                    <AuthenticatedRoute>
                      <EnterpriseOnboardingPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/onboarding/institution"
                  element={
                    <AuthenticatedRoute>
                      <InstitutionOnboardingPage />
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

                {/* Private Trust Passport Canonical Routes (Authenticated) */}
                <Route
                  path="/credentials"
                  element={
                    <AuthenticatedRoute>
                      <CredentialsManagementPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/passport"
                  element={
                    <AuthenticatedRoute>
                      <PrivatePassportPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/passport/edit"
                  element={
                    <AuthenticatedRoute>
                      <PrivatePassportPage />
                    </AuthenticatedRoute>
                  }
                />

                {/* Phase 9B Institutional Credential Management & Issuance Routes */}
                <Route
                  path="/institution/issue-credentials"
                  element={
                    <AuthenticatedRoute>
                      <InstitutionCredentialIssuancePage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/institution/credentials"
                  element={
                    <AuthenticatedRoute>
                      <InstitutionCredentialsManagementPage />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/enterprise/issue-credentials"
                  element={
                    <RoleGuardedRoute allowedRoles={['enterprise', 'admin']}>
                      <InstitutionCredentialIssuancePage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/enterprise/credentials"
                  element={
                    <RoleGuardedRoute allowedRoles={['enterprise', 'admin']}>
                      <InstitutionCredentialsManagementPage />
                    </RoleGuardedRoute>
                  }
                />
                <Route
                  path="/admin/issue-credentials"
                  element={
                    <RoleGuardedRoute allowedRoles={['admin']}>
                      <InstitutionCredentialIssuancePage />
                    </RoleGuardedRoute>
                  }
                />

                {/* Public Informational & Legal Routes */}
                <Route path="/verify/zk" element={<PublicZKVerificationPage />} />
                <Route path="/verify/presentation" element={<PublicZKVerificationPage />} />
                <Route path="/verify/sovereign" element={<PublicZKVerificationPage />} />
                <Route path="/verify/transcript/:transcriptId" element={<PublicTranscriptVerificationPage />} />
                <Route path="/verify/credential/:credentialId" element={<PublicCredentialVerificationPage />} />
                <Route path="/about" element={<InfoPages />} />
                <Route path="/for-students" element={<InfoPages />} />
                <Route path="/help" element={<InfoPages />} />
                <Route path="/legal/privacy" element={<InfoPages />} />
                <Route path="/legal/terms" element={<InfoPages />} />
                <Route path="/legal/security" element={<InfoPages />} />

                {/* Catch-all 404 System State */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AppShell>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}


