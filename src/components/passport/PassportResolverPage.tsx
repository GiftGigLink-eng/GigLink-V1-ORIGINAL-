import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PrivatePassportPage } from './PrivatePassportPage';
import { PublicPassportPage } from './PublicPassportPage';
import { Loader2 } from 'lucide-react';

/**
 * PassportResolverPage
 * 
 * Resolves /passport/:uid route:
 * 1. OWNER VIEWING THEIR OWN TRUST PASSPORT:
 *    When the authenticated user opens /passport/${user.uid} (uid === user.uid),
 *    renders the owner's private Trust Passport (PrivatePassportPage).
 *    Does NOT require publicTrustPassports to be published or exist.
 *    The owner can always view and manage their passport even if visibility is Private or Unpublished.
 * 
 * 2. OTHER PERSON / UNAUTHENTICATED VISITOR VIEWING A TRUST PASSPORT:
 *    When viewer.uid !== uid or viewer is unauthenticated,
 *    renders the PublicPassportPage (which loads sanitized publicTrustPassports/{uid}
 *    and shows the private/inactive message if not published or private).
 */
export const PassportResolverPage: React.FC = () => {
  const { uid } = useParams<{ uid: string }>();
  const { user, profile, loading } = useAuth();

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Resolving Trust Passport credentials...
        </p>
      </div>
    );
  }

  // Invariant: Authenticated users with incomplete onboarding cannot access workspace passport
  if (user && profile && profile.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }

  // 1. Authenticated owner viewing their own passport
  if (user && uid && user.uid === uid) {
    return <PrivatePassportPage />;
  }

  // 2. Third-party viewer or unauthenticated visitor
  return <PublicPassportPage />;
};
