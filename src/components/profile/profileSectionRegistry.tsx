import React from 'react';
import { UserPersona } from '../../types';

export type ProfileSectionKey =
  | 'trajectory'
  | 'availability'
  | 'partner_services'
  | 'about'
  | 'skills'
  | 'projects'
  | 'experience'
  | 'education'
  | 'certifications'
  | 'social_links';

export interface ProfileSectionDefinition {
  key: ProfileSectionKey;
  label: string;
  render: () => React.ReactNode;
  visiblePersonas?: UserPersona[]; // If undefined, visible to all personas
}

/**
 * Declarative Persona-based section ordering registry.
 * Encapsulates the visual hierarchy of sections for each persona.
 */
export const PERSONA_SECTION_ORDER: Record<UserPersona, ProfileSectionKey[]> = {
  learner: [
    'trajectory',
    'availability',
    'about',
    'skills',
    'projects',
    'experience',
    'education',
    'certifications',
    'social_links',
  ],
  partner: [
    'partner_services',
    'availability',
    'trajectory',
    'about',
    'experience',
    'projects',
    'skills',
    'certifications',
    'education',
    'social_links',
  ],
  client: [
    'about',
    'projects',
    'experience',
    'skills',
    'social_links',
    'education',
    'certifications',
  ],
  organization_admin: [
    'about',
    'experience',
    'education',
    'certifications',
    'skills',
    'projects',
    'social_links',
  ],
  talent: [
    'trajectory',
    'availability',
    'about',
    'skills',
    'projects',
    'experience',
    'education',
    'certifications',
    'social_links',
  ],
  creator: [
    'about',
    'projects',
    'experience',
    'skills',
    'social_links',
    'education',
    'certifications',
  ],
  enterprise: [
    'about',
    'experience',
    'education',
    'certifications',
    'skills',
    'projects',
    'social_links',
  ],
  admin: [
    'about',
    'skills',
    'projects',
    'experience',
    'education',
    'certifications',
    'social_links',
  ],
};

/**
 * Resolves and renders the ordered list of section elements for a given persona.
 */
export function getOrderedProfileSections(
  persona: UserPersona,
  sectionsMap: Partial<Record<ProfileSectionKey, React.ReactNode>>
): React.ReactNode[] {
  const order = PERSONA_SECTION_ORDER[persona] || PERSONA_SECTION_ORDER.learner;

  return order
    .map((key) => sectionsMap[key])
    .filter((node): node is React.ReactNode => Boolean(node));
}
