import {
  calculatePotentialTrajectory,
  calculateProfileCompleteness,
  calculateTrustScore,
} from '../lib/trustScore';
import {
  getUnifiedProfileData,
  sanitizePublicPassportProjection,
  buildPassportUpdatePayload,
} from '../lib/profileService';
import {
  getOrderedProfileSections,
  PERSONA_SECTION_ORDER,
} from '../components/profile/profileSectionRegistry';
import {
  TrustPassport,
  UserProfile,
  WorkAvailability,
  PartnerServiceOffering,
  UserPersona,
} from '../types';

export function runProfileEnhancementTests() {
  console.log('--- PROFESSIONAL IDENTITY & PROFILE ENHANCEMENT SUITE ---');
  let total = 0;
  let passed = 0;
  let failed = 0;

  const assert = (name: string, condition: boolean) => {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ [PROFILE] ${name}`);
    } else {
      failed++;
      console.error(`  ✗ [PROFILE FAIL] ${name}`);
    }
  };

  // 1. Potential Trajectory Calculation
  const mockPassportWithDeliverables: Partial<TrustPassport> = {
    userId: 'user_talent_1',
    skills: [
      { id: 's1', name: 'TypeScript', category: 'Programming', proficiency: 'expert', verifiedCount: 3 },
      { id: 's2', name: 'Solidity', category: 'Blockchain', proficiency: 'advanced', verifiedCount: 2 },
    ],
    projects: [
      {
        id: 'p1',
        title: 'DeFi Liquidity Engine',
        description: 'Automated market maker protocol',
        role: 'Core Contributor',
        verificationStatus: 'verified',
        skillsUsed: ['Solidity', 'TypeScript'],
        completedAt: '2026-06-01',
      },
      {
        id: 'p2',
        title: 'ZK Verification Bridge',
        description: 'Light client verifier in Rust',
        role: 'Protocol Engineer',
        verificationStatus: 'verified',
        skillsUsed: ['Rust', 'Cryptography'],
        completedAt: '2026-07-01',
      },
    ],
    experience: [
      {
        id: 'e1',
        organizationName: 'OpenZeppelin',
        roleTitle: 'Security Researcher',
        startDate: '2024-01-01',
        isCurrent: true,
        type: 'employment',
        description: 'Smart contract security audits and invariant testing.',
        verificationStatus: 'verified',
      },
    ],
  };

  const trajectory = calculatePotentialTrajectory(mockPassportWithDeliverables, null);
  assert('Trajectory calculation returns valid tier and velocity', Boolean(trajectory.skillTrajectoryTier && trajectory.momentumScore > 0));
  assert('Identifies primary domain from verified project skills', Boolean(trajectory.primaryDomain && trajectory.primaryDomain.length > 0));
  assert('Counts verified milestone momenta correctly (2 verified deliverables)', trajectory.verifiedMilestoneMomenta === 2);
  assert('Calculates non-empty growth milestone recommendation', Boolean(trajectory.nextGrowthMilestone.length > 5));

  // 2. Work Availability & Preferences Persistence Payload
  const availabilityData: WorkAvailability = {
    status: 'available',
    preferredEngagement: 'contract',
    availableFrom: '2026-09-15',
    hoursPerWeek: 35,
    workLocationPreference: 'remote',
  };

  const passportPayload = buildPassportUpdatePayload(mockPassportWithDeliverables as TrustPassport, {
    availability: availabilityData,
  });
  assert('buildPassportUpdatePayload serializes availability terms', passportPayload.availability?.status === 'available');
  assert('buildPassportUpdatePayload preserves location and engagement preferences', passportPayload.availability?.preferredEngagement === 'contract' && passportPayload.availability?.hoursPerWeek === 35);

  // 3. Partner Services Management
  const partnerServicesData: PartnerServiceOffering[] = [
    {
      id: 'svc_1',
      title: 'Smart Contract Audit & Formal Verification',
      description: 'Comprehensive static and formal verification of Solidity contracts',
      category: 'Blockchain & Cryptography',
      deliveryType: 'fixed_milestone',
      targetDeliverables: ['Audit Report', 'Automated Hardhat Suite'],
      skillsOffered: ['Solidity', 'Slither'],
      isActive: true,
    },
    {
      id: 'svc_2',
      title: 'Draft Inactive Advisory Offering',
      description: 'Consulting package',
      category: 'Advisory',
      deliveryType: 'hourly_retainer',
      isActive: false,
    },
  ];

  const servicesPayload = buildPassportUpdatePayload(mockPassportWithDeliverables as TrustPassport, {
    partnerServices: partnerServicesData,
  });
  assert('buildPassportUpdatePayload persists partner service list', Array.isArray(servicesPayload.partnerServices) && servicesPayload.partnerServices.length === 2);

  // 4. Public Passport Projection Sanitization Boundary
  const fullAuthoritativePassport: TrustPassport = {
    id: 'user_partner_1',
    userId: 'user_partner_1',
    headline: 'Principal Smart Contract Auditor',
    bio: 'Securing mission critical protocols',
    location: 'Zurich, Switzerland',
    locationVerificationStatus: 'self_declared',
    structuredLocation: undefined,
    identityVerified: true,
    skills: (mockPassportWithDeliverables.skills || []) as any,
    projects: [
      mockPassportWithDeliverables.projects![0] as any,
      {
        id: 'draft_p3',
        title: 'Unpublished Internal Draft Deliverable',
        description: 'Confidential work',
        role: 'Consultant',
        completedAt: '2026-08-01',
        status: 'draft',
        verificationStatus: 'unverified',
        skillsUsed: ['Python'],
      },
    ],
    experience: (mockPassportWithDeliverables.experience || []) as any,
    workHistory: (mockPassportWithDeliverables.experience || []) as any,
    education: [],
    certifications: [],
    certificates: [],
    reviews: [],
    socialLinks: { github: 'https://github.com/elena' },
    isPublic: true,
    metrics: {
      verificationScore: 92,
      completedProjectsCount: 1,
      verifiedSkillsCount: 2,
      endorsementsCount: 0,
      activeStreakDays: 14,
    },
    availability: availabilityData,
    partnerServices: partnerServicesData,
    createdAt: '2026-01-01',
    updatedAt: '2026-09-01',
  };

  const mockUserProfile: UserProfile = {
    uid: 'user_partner_1',
    email: 'elena@example.com',
    displayName: 'Elena Rostova',
    headline: 'Principal Smart Contract Auditor',
    bio: 'Securing mission critical protocols',
    activePersona: 'partner',
    availablePersonas: ['partner'],
    createdAt: '2026-01-01',
    updatedAt: '2026-09-01',
  };

  const publicProjection = sanitizePublicPassportProjection(fullAuthoritativePassport, mockUserProfile);
  assert('Public projection includes availability preferences', publicProjection.availability?.status === 'available');
  assert('Public projection exposes only active partner services (filters out draft/inactive)', Array.isArray(publicProjection.partnerServices) && publicProjection.partnerServices.length === 1 && publicProjection.partnerServices[0].id === 'svc_1');
  assert('Public projection filters out private/draft project proofs', publicProjection.projects.length === 1 && !publicProjection.projects.some((p) => p.id === 'draft_p3'));
  assert('Public projection calculates trajectory indicator for verified public profile', Boolean(publicProjection.potentialTrajectory?.skillTrajectoryTier));

  // 5. Dual-Read Unified Profile Resolution
  const unifiedProfile = getUnifiedProfileData(mockUserProfile, fullAuthoritativePassport, true);
  assert('Unified profile data resolves potential trajectory', Boolean(unifiedProfile.potentialTrajectory));
  assert('Unified profile includes availability and all partner services for the owner', unifiedProfile.partnerServices?.length === 2 && unifiedProfile.availability?.preferredEngagement === 'contract');

  // 6. Declarative Section Registry Order
  const learnerOrder = PERSONA_SECTION_ORDER['learner'];
  const partnerOrder = PERSONA_SECTION_ORDER['partner'];
  const clientOrder = PERSONA_SECTION_ORDER['client'];

  assert('Learner section order prioritizes trajectory, availability, and skills', learnerOrder[0] === 'trajectory' && learnerOrder[1] === 'availability' && learnerOrder[3] === 'skills');
  assert('Partner section order prioritizes partner_services, availability, and trajectory', partnerOrder[0] === 'partner_services' && partnerOrder[1] === 'availability' && partnerOrder[2] === 'trajectory');
  assert('Client section order focuses on organizational needs without partner_services', !clientOrder.includes('partner_services'));

  const mockSectionsMap = {
    trajectory: 'COMP_TRAJECTORY',
    availability: 'COMP_AVAILABILITY',
    partner_services: 'COMP_SERVICES',
    about: 'COMP_ABOUT',
    skills: 'COMP_SKILLS',
  };

  const resolvedPartnerSections = getOrderedProfileSections('partner', mockSectionsMap as any);
  assert('getOrderedProfileSections resolves partner layout in correct hierarchy', resolvedPartnerSections[0] === 'COMP_SERVICES' && resolvedPartnerSections[1] === 'COMP_AVAILABILITY' && resolvedPartnerSections[2] === 'COMP_TRAJECTORY');

  console.log(`Profile Enhancements Result: ${passed}/${total} tests passed successfully.\n`);
  return { total, passed, failed };
}
