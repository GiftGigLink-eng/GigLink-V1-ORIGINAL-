import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingOverlay } from '../common/LoadingOverlay';
import { GigLinkRole } from '../../types';
import {
  getPostSignInRedirect,
  getAuthenticatedGuardRedirect,
  getRoleGuardedRedirect,
} from '../../lib/authNavigationService';

interface RouteProps {
  children: React.ReactNode;
}

interface RoleGuardedRouteProps extends RouteProps {
  allowedRoles?: GigLinkRole[];
}

export const GuestRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, profile, loading, activeRole } = useAuth();
  const location = useLocation();

  if (loading || (user && !profile)) {
    return <LoadingOverlay message="Checking authentication status..." />;
  }

  if (user) {
    const fromPath = (location.state as any)?.from?.pathname;
    const targetRedirect = getPostSignInRedirect(user, profile, activeRole, fromPath);
    return <Navigate to={targetRedirect} replace />;
  }

  return <>{children}</>;
};

export const AuthenticatedRoute: React.FC<RouteProps> = ({ children }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading || (user && !profile)) {
    return <LoadingOverlay message="Verifying session..." />;
  }

  const redirectPath = getAuthenticatedGuardRedirect(user, profile, location.pathname);
  if (redirectPath) {
    if (redirectPath === '/auth/login') {
      return <Navigate to="/auth/login" state={{ from: location }} replace />;
    }
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export const RoleGuardedRoute: React.FC<RoleGuardedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, loading, activeRole, allowedRoles: userAllowedRoles } = useAuth();
  const location = useLocation();

  if (loading || (user && !profile)) {
    return <LoadingOverlay message="Verifying role permissions..." />;
  }

  const redirectPath = getRoleGuardedRedirect(
    user,
    profile,
    userAllowedRoles,
    activeRole,
    allowedRoles,
    location.pathname
  );

  if (redirectPath) {
    if (redirectPath === '/auth/login') {
      return <Navigate to="/auth/login" state={{ from: location }} replace />;
    }
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};


