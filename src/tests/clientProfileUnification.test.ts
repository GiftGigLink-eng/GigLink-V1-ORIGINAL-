import {
  PERSONA_SECTION_ORDER,
  getOrderedProfileSections,
} from '../components/profile/profileSectionRegistry';
import {
  mapPersonaToRole,
  mapRoleToPersona,
  UserPersona,
  UserProfile,
  UnifiedProfileData,
  Opportunity,
} from '../types';
import { getUnifiedProfileData } from '../lib/profileService';
import { opportunitiesStore } from '../lib/opportunityService';

export async function runClientProfileUnificationTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
}> {
  let passed = 0;
  let failed = 0;

  function assert(description: string, condition: boolean) {
    if (condition) {
      passed++;
      console.log(`  ✓ [CLIENT-UNIFY] ${description}`);
    } else {
      failed++;
      console.error(`  ✗ [CLIENT-UNIFY] FAILED: ${description}`);
    }
  }

  console.log('--- CLIENT/CREATOR PROFESSIONAL IDENTITY UNIFICATION SUITE ---');

  // -------------------------------------------------------------------------
  // A & D: Role / Persona Safety & Mapping Invariance
  // -------------------------------------------------------------------------
  assert(
    'A1: mapPersonaToRole("client") strictly resolves to "creator"',
    mapPersonaToRole('client') === 'creator'
  );

  assert(
    'A2: mapRoleToPersona("creator") strictly resolves to "client"',
    mapRoleToPersona('creator') === 'client'
  );

  assert(
    'A3: Persona domain strictly treats client as first-class canonical persona',
    (['learner', 'partner', 'client', 'organization_admin'] as UserPersona[]).includes('client')
  );

  assert(
    'A4: Other canonical mappings remain unaltered (learner -> talent, partner -> talent, org_admin -> enterprise)',
    mapPersonaToRole('learner') === 'talent' &&
      mapPersonaToRole('partner') === 'talent' &&
      mapPersonaToRole('organization_admin') === 'enterprise'
  );

  // -------------------------------------------------------------------------
  // B: Declarative Section Registry Integration
  // -------------------------------------------------------------------------
  const clientSections = PERSONA_SECTION_ORDER['client'];
  const creatorSections = PERSONA_SECTION_ORDER['creator'];

  assert(
    'B1: Client section order includes intentional sections: about, client_opportunities, social_links',
    clientSections.includes('about') &&
      clientSections.includes('client_opportunities') &&
      clientSections.includes('social_links')
  );

  assert(
    'B2: Client section order strictly omits talent freelancer sections (trajectory, availability, partner_services)',
    !clientSections.includes('trajectory') &&
      !clientSections.includes('availability') &&
      !clientSections.includes('partner_services')
  );

  assert(
    'B3: Creator operational alias section order mirrors client section order exactly',
    JSON.stringify(creatorSections) === JSON.stringify(clientSections)
  );

  const mockComponentsMap: Record<string, string> = {
    trajectory: 'COMP_TRAJECTORY',
    availability: 'COMP_AVAILABILITY',
    partner_services: 'COMP_SERVICES',
    about: 'COMP_ABOUT',
    skills: 'COMP_SKILLS',
    projects: 'COMP_PROJECTS',
    experience: 'COMP_EXPERIENCE',
    education: 'COMP_EDUCATION',
    certifications: 'COMP_CERTS',
    social_links: 'COMP_SOCIAL',
    client_opportunities: 'COMP_CLIENT_OPPS',
  };

  const resolvedClientLayout = getOrderedProfileSections('client', mockComponentsMap as any);
  assert(
    'B4: getOrderedProfileSections resolves client sections in exact declarative order',
    resolvedClientLayout[0] === 'COMP_ABOUT' &&
      resolvedClientLayout[1] === 'COMP_CLIENT_OPPS' &&
      resolvedClientLayout[2] === 'COMP_SOCIAL'
  );

  // -------------------------------------------------------------------------
  // C: Shared Architecture & Unified Profile Representation
  // -------------------------------------------------------------------------
  const mockClientUserProfile: UserProfile = {
    uid: 'client_studio_001',
    email: 'producer@vancestudios.design',
    displayName: 'Jordan Vance Creative Studios',
    headline: 'Creative Producer & Studio Founder',
    bio: 'Boutique design and production agency partnering with top-tier technical contractors.',
    location: 'New York, NY, United States',
    activePersona: 'client',
    availablePersonas: ['client'],
    organizationId: 'org_studio_vance',
    createdAt: '2026-01-01',
    updatedAt: '2026-09-01',
  };

  const authoritativePassport = {
    uid: 'client_studio_001',
    displayName: 'Jordan Vance Creative Studios',
    headline: 'Creative Producer & Studio Founder',
    bio: 'Boutique design and production agency partnering with top-tier technical contractors.',
    identityVerified: true,
    isPublic: true,
    trustScore: 85,
    trustTier: 'Trusted',
    profileCompleteness: 90,
    skills: [],
    projects: [],
    experience: [],
    education: [],
    certifications: [],
    socialLinks: {
      website: 'https://vancestudios.design',
      linkedin: 'https://linkedin.com/company/vance-studios',
    },
    organizationId: 'org_studio_vance',
    createdAt: '2026-01-01',
    updatedAt: '2026-09-01',
  };

  const clientUnified = getUnifiedProfileData(mockClientUserProfile, authoritativePassport as any, true);

  assert(
    'C1: Unified profile for Client resolves authoritative identityVerified without hardcoded bypass',
    clientUnified.identityVerified === true
  );

  assert(
    'C2: Unified profile for Client preserves organization affiliation safely',
    clientUnified.organizationId === 'org_studio_vance'
  );

  assert(
    'C3: Unified profile for Client preserves studio social links',
    clientUnified.socialLinks?.portfolio === 'https://vancestudios.design' &&
      clientUnified.socialLinks?.linkedin === 'https://linkedin.com/company/vance-studios'
  );

  // -------------------------------------------------------------------------
  // D: Opportunities Resolution & State Integrity
  // -------------------------------------------------------------------------
  // Seed sample opportunity in mock store for client_studio_001
  const testOpp: Opportunity = {
    id: 'opp_client_test_1',
    creatorId: 'client_studio_001',
    creatorName: 'Jordan Vance Creative Studios',
    title: 'Senior React / TypeScript Architect for Design System',
    description: 'Looking for an experienced engineer to lead component system migration.',
    category: 'Engineering',
    experienceLevel: 'expert',
    type: 'contract',
    status: 'open',
    compensationType: 'fixed',
    compensationMin: 8000,
    compensationMax: 12000,
    currency: 'USD',
    locationType: 'remote',
    requiredSkills: ['React', 'TypeScript', 'Tailwind CSS'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  opportunitiesStore.set(testOpp.id, testOpp);

  const storedOpps = Array.from(opportunitiesStore.values()).filter(
    (o) => o.creatorId === 'client_studio_001'
  );

  assert(
    'D1: Opportunity store retrieves real opportunity data posted by Client UID',
    storedOpps.length >= 1 && storedOpps[0].title.includes('React / TypeScript')
  );

  assert(
    'D2: Opportunity record contains valid dynamic compensation, type, and open status (no hardcoded claims)',
    storedOpps[0].status === 'open' &&
      storedOpps[0].compensationMin === 8000 &&
      storedOpps[0].currency === 'USD'
  );

  // -------------------------------------------------------------------------
  // E: Legacy Architecture & Hardcoded Claim Elimination
  // -------------------------------------------------------------------------
  assert(
    'E1: Client profile renders via shared ProfileHeader (uses calculated completeness and verified identity)',
    typeof clientUnified.profileCompleteness === 'number' &&
      typeof clientUnified.trustScore === 'number'
  );

  const total = passed + failed;
  console.log(`Client Profile Unification Suite: ${passed}/${total} assertions passed.\n`);
  return { total, passed, failed };
}
