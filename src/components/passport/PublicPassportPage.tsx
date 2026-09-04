import React from 'react';
import { PublicProfilePage } from '../profile/PublicProfilePage';

/**
 * PublicPassportPage
 * 
 * Part of the Canonical Unified Public Identity Architecture.
 * Delegates to PublicProfilePage with the Trust Passport tab initially focused,
 * maintaining modular presentation and zero-knowledge privacy guarantees.
 */
export const PublicPassportPage: React.FC = () => {
  return <PublicProfilePage initialTab="passport" />;
};
