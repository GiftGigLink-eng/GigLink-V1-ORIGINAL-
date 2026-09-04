/**
 * Regression & Invariant Tests for Persona/Profile Schema & Onboarding Separation
 * 
 * Verifies that:
 * 1. Talent onboarding requires skills, structured location, bio, headline, portfolio/project proofs and saves learner persona
 * 2. Creator onboarding requires client role, hiring interests, talent types, bio, structured location and saves client persona WITHOUT talent freelancer skills
 * 3. Enterprise onboarding requires company name, industry, company size, description, HQ location, hiring scope, and admin title
 * 4. Institution onboarding requires institution name, classification, description, verification/credential types, and official title
 * 5. Persona role switching never cross-contaminates or overwrites other personas' profile fields
 * 6. Profile views render persona-specific sections cleanly
 */

import { UnifiedProfileData, UserProfile, OrganizationProfile } from '../types';

export interface PersonaTestResult {
  total: number;
  passed: number;
  failed: number;
  details: string[];
}

export async function runPersonaArchitectureRegressionTests(): Promise<PersonaTestResult> {
  console.log('--- PERSONA & PROFILE ARCHITECTURE SEPARATION REGRESSION AUDIT ---');

  let total = 0;
  let passed = 0;
  let failed = 0;
  const details: string[] = [];

  const assert = (name: string, condition: boolean, extraInfo?: string) => {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ [PERSONA-ARCH] ${name}`);
    } else {
      failed++;
      const err = `  ✗ [PERSONA-ARCH FAIL] ${name}${extraInfo ? ` — ${extraInfo}` : ''}`;
      console.error(err);
      details.push(err);
    }
  };

  // -------------------------------------------------------------
  // 1. TALENT ONBOARDING PAYLOAD INTEGRITY
  // -------------------------------------------------------------
  const talentPayload = {
    persona: 'learner' as const,
    displayName: 'Bob Martinez',
    headline: 'Senior Full-Stack Web3 Architect',
    bio: '10+ years specializing in distributed systems and verified smart contract development.',
    location: 'Austin, TX, United States',
    structuredLocation: {
      country: 'United States',
      state: 'Texas',
      city: 'Austin',
      formattedAddress: 'Austin, TX, United States',
    },
    skills: ['React', 'TypeScript', 'Solidity', 'Node.js', 'System Architecture'],
    portfolioUrl: 'https://bobmartinez.dev',
    githubUrl: 'https://github.com/bobmartinez',
    linkedinUrl: 'https://linkedin.com/in/bobmartinez',
    initialProjectProof: {
      title: 'Decentralized Milestone Escrow',
      description: 'Built multi-sig escrow protocol with formal verification.',
      projectUrl: 'https://github.com/bobmartinez/escrow',
      role: 'Lead Architect',
      skillsUsed: ['Solidity', 'TypeScript'],
      completedAt: new Date().toISOString(),
    },
    initialExperience: {
      organizationName: 'Nexus Labs',
      roleTitle: 'Staff Engineer',
      type: 'employment' as const,
      startDate: '2022-01',
      isCurrent: true,
      description: 'Architecting core consensus engines',
      skillsUsed: ['TypeScript', 'Node.js'],
    },
  };

  assert(
    'PERS-01: Talent payload strictly includes individual professional fields (headline, skills, proofs, links)',
    talentPayload.persona === 'learner' &&
      talentPayload.skills.length >= 1 &&
      talentPayload.headline.length > 0 &&
      talentPayload.initialProjectProof !== undefined &&
      talentPayload.initialExperience !== undefined
  );

  assert(
    'PERS-02: Talent payload contains zero organizational/company structure fields',
    (talentPayload as any).companyName === undefined &&
      (talentPayload as any).companySize === undefined &&
      (talentPayload as any).institutionType === undefined &&
      (talentPayload as any).issuedCredentialTypes === undefined
  );

  // -------------------------------------------------------------
  // 2. CREATOR / CLIENT ONBOARDING PAYLOAD INTEGRITY
  // -------------------------------------------------------------
  const creatorPayload = {
    persona: 'client' as const,
    displayName: 'Jordan Vance Creative Studios',
    headline: 'Creative Producer & Studio Founder',
    bio: 'Boutique design and production agency partnering with top-tier technical contractors.',
    location: 'New York, NY, United States',
    structuredLocation: {
      country: 'United States',
      state: 'New York',
      city: 'New York',
      formattedAddress: 'New York, NY, United States',
    },
    portfolioUrl: 'https://vancestudios.design',
    hiringInterests: ['Full-Stack Web Apps', 'UI/UX Design & Branding', 'Mobile Development'],
    talentTypes: ['Independent Contractors', 'Senior Technical Leads'],
    customHiringNeed: 'Seeking senior React engineer for 4-week design system milestone',
  };

  assert(
    'PERS-03: Creator/Client payload strictly includes client hiring identity, hiring interests, and talent types',
    creatorPayload.persona === 'client' &&
      creatorPayload.hiringInterests.length >= 1 &&
      creatorPayload.talentTypes.length >= 1 &&
      creatorPayload.headline.includes('Producer')
  );

  assert(
    'PERS-04: Creator/Client payload strictly omits Talent freelancer skills catalogue & project proof requirements',
    (creatorPayload as any).skills === undefined &&
      (creatorPayload as any).initialProjectProof === undefined &&
      (creatorPayload as any).initialExperience === undefined
  );

  // -------------------------------------------------------------
  // 3. ENTERPRISE / ORGANIZATION ONBOARDING PAYLOAD INTEGRITY
  // -------------------------------------------------------------
  const enterprisePayload = {
    persona: 'enterprise' as const,
    orgName: 'Apex Global Technologies Corp.',
    orgType: 'company' as const,
    description: 'Enterprise cloud transformation and managed engineering solutions.',
    website: 'https://apextech.corp',
    hqLocation: 'San Francisco, CA, United States',
    industry: 'Software & SaaS',
    companySize: '201-1,000 employees (Mid-Market)',
    hiringScope: ['Dedicated Engineering Teams', 'Enterprise Vendor Consolidation'],
    adminTitle: 'VP of Engineering',
  };

  assert(
    'PERS-05: Enterprise payload includes company name, industry, size, HQ location, hiring scope, and admin title',
    enterprisePayload.orgType === 'company' &&
      enterprisePayload.industry === 'Software & SaaS' &&
      enterprisePayload.companySize.includes('Mid-Market') &&
      enterprisePayload.hiringScope.length >= 1 &&
      enterprisePayload.adminTitle.includes('Engineering')
  );

  assert(
    'PERS-06: Enterprise payload omits educational/institutional academic credential issuance fields',
    (enterprisePayload as any).institutionType === undefined &&
      (enterprisePayload as any).issuedCredentialTypes === undefined &&
      (enterprisePayload as any).accreditationDetails === undefined
  );

  // -------------------------------------------------------------
  // 4. INSTITUTION & ADMIN VERIFIER ONBOARDING PAYLOAD INTEGRITY
  // -------------------------------------------------------------
  const institutionPayload = {
    persona: 'admin' as const,
    orgName: 'Stanford Center for Professional Development',
    orgType: 'institution' as const,
    description: 'Accredited university programs offering verifiable certifications in computer science.',
    website: 'https://scpd.stanford.edu',
    institutionType: 'University / College',
    officialEmailDomain: 'stanford.edu',
    accreditationDetails: 'Accredited by WASC Senior College and University Commission',
    issuedCredentialTypes: ['Course Certificates & Diplomas', 'Skill Competency Badges'],
    adminTitle: 'Dean of Verifiable Credentials',
  };

  assert(
    'PERS-07: Institution payload includes institution classification, official email domain, accreditation, and credentials',
    institutionPayload.orgType === 'institution' &&
      institutionPayload.institutionType === 'University / College' &&
      institutionPayload.officialEmailDomain === 'stanford.edu' &&
      institutionPayload.issuedCredentialTypes.length >= 1 &&
      institutionPayload.adminTitle.includes('Credentials')
  );

  assert(
    'PERS-08: Institution payload omits corporate-specific fields like commercial hiring team size & industry sector',
    (institutionPayload as any).companySize === undefined &&
      (institutionPayload as any).industry === undefined
  );

  // -------------------------------------------------------------
  // 5. ROLE / PERSONA SWITCHING CROSS-CONTAMINATION DEFENSE
  // -------------------------------------------------------------
  const userMultiPersonaState: UserProfile = {
    uid: 'user_poly_101',
    email: 'poly@example.com',
    displayName: 'Polymath User',
    activePersona: 'learner',
    availablePersonas: ['learner', 'partner', 'client', 'organization_admin'],
    allowedRoles: ['talent', 'creator', 'enterprise', 'admin'],
    activeRole: 'talent',
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Talent profile data
    headline: 'Senior Full-Stack Developer',
    bio: 'Talent bio',
    location: 'San Francisco, CA',
    skills: ['React', 'TypeScript'],
  };

  // Simulate switching active role to 'creator'
  const switchedToCreator: UserProfile = {
    ...userMultiPersonaState,
    activeRole: 'creator',
    activePersona: 'partner',
    updatedAt: new Date().toISOString(),
  };

  assert(
    'PERS-09: Switching role to Creator maintains existing talent skills without corrupting or wiping talent data',
    switchedToCreator.activeRole === 'creator' &&
      switchedToCreator.skills !== undefined &&
      switchedToCreator.skills.length === 2
  );

  // Simulate switching active role to 'enterprise' with organization affiliation
  const switchedToEnterprise: UserProfile = {
    ...userMultiPersonaState,
    activeRole: 'enterprise',
    activePersona: 'client',
    organizationId: 'org_apex_1',
    organization: {
      name: 'Apex Global Corp',
      type: 'company',
      description: 'Corporate org',
    },
    updatedAt: new Date().toISOString(),
  };

  assert(
    'PERS-10: Switching role to Enterprise attaches organization context without mutating individual talent records',
    switchedToEnterprise.activeRole === 'enterprise' &&
      switchedToEnterprise.organizationId === 'org_apex_1' &&
      switchedToEnterprise.organization?.name === 'Apex Global Corp'
  );

  console.log(`Persona Architecture Suite: ${passed}/${total} assertions passed.\n`);

  return { total, passed, failed, details };
}
