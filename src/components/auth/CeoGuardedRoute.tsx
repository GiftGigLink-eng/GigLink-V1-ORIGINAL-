import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LoadingOverlay } from '../common/LoadingOverlay';
import { NotFoundPage } from '../common/NotFoundPage';
import { verifyCeoSession, CeoAuthCheckResponse } from '../../lib/ceoService';

interface CeoGuardedRouteProps {
  children: React.ReactNode;
}

/**
 * Privileged CEO / Platform Owner Route Guard (Stage 1).
 *
 * Enforces zero-knowledge existence for unauthorized visitors:
 * Any non-CEO, unauthenticated, unverified, or unauthorized user receives
 * the standard <NotFoundPage /> (404) rather than an error or redirect,
 * ensuring the canonical /ceo route remains completely non-revealing.
 */
export const CeoGuardedRoute: React.FC<CeoGuardedRouteProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [checkingServerAuth, setCheckingServerAuth] = useState(true);
  const [ceoAuth, setCeoAuth] = useState<CeoAuthCheckResponse | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAuthorization() {
      if (authLoading) return;

      if (!user) {
        if (isMounted) {
          setCeoAuth(null);
          setCheckingServerAuth(false);
        }
        return;
      }

      try {
        const idToken = await user.getIdToken();
        const result = await verifyCeoSession(idToken);
        if (isMounted) {
          setCeoAuth(result);
          setCheckingServerAuth(false);
        }
      } catch (err) {
        console.warn('[CeoGuardedRoute] Authorization verification error:', err);
        if (isMounted) {
          setCeoAuth(null);
          setCheckingServerAuth(false);
        }
      }
    }

    checkAuthorization();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  // Neutral loading state while verifying
  if (authLoading || checkingServerAuth) {
    return <LoadingOverlay message="Verifying session credentials..." />;
  }

  // If unauthenticated or failed CEO server verification, render 404 (non-revealing)
  if (!user || !ceoAuth || !ceoAuth.isCeo) {
    return <NotFoundPage />;
  }

  // Privileged CEO access granted
  return <>{children}</>;
};
