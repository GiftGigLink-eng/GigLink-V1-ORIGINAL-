import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { EnterpriseOnboardingPage } from './EnterpriseOnboardingPage';
import { InstitutionOnboardingPage } from './InstitutionOnboardingPage';

/**
 * Route wrapper that renders either Enterprise or Institution onboarding
 * based on search params (e.g. ?persona=client vs ?persona=organization_admin).
 * Defaults to Enterprise if none specified.
 */
export const OrganizationOnboardingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const personaParam = searchParams.get('persona');

  if (personaParam === 'organization_admin' || personaParam === 'admin' || personaParam === 'institution') {
    return <InstitutionOnboardingPage />;
  }

  return <EnterpriseOnboardingPage />;
};
