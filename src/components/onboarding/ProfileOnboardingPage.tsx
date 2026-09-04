import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { TalentOnboardingPage } from './TalentOnboardingPage';
import { CreatorOnboardingPage } from './CreatorOnboardingPage';

/**
 * Route wrapper that renders either Talent or Creator onboarding
 * based on search params (e.g. ?persona=learner vs ?persona=partner).
 * Defaults to Talent if none specified.
 */
export const ProfileOnboardingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const personaParam = searchParams.get('persona');

  if (personaParam === 'partner' || personaParam === 'creator' || personaParam === 'client') {
    return <CreatorOnboardingPage />;
  }

  return <TalentOnboardingPage />;
};
