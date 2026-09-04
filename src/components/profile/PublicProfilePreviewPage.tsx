import React from 'react';
import { PublicProfilePage } from './PublicProfilePage';

/**
 * PublicProfilePreviewPage
 * 
 * Part of the Canonical Unified Public Identity Architecture.
 * Renders the authenticated user's public profile in preview mode.
 */
export const PublicProfilePreviewPage: React.FC = () => {
  return <PublicProfilePage previewMode={true} />;
};
