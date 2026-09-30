import {
  validateProfileImageUrl,
  sanitizePublicPassportProjection,
  buildPassportUpdatePayload,
  getUnifiedProfileData,
} from '../lib/profileService';
import { PERSONA_SECTION_ORDER } from '../components/profile/profileSectionRegistry';
import { TrustPassport, UserProfile, UserPersona } from '../types';

export function runPhase2HiringAndAvatarTests() {
  console.log('--- PHASE 2: CLIENT HIRING PRIVACY & PHOTO SECURITY AUDIT SUITE ---');
  let total = 0;
  let passed = 0;
  let failed = 0;

  const assert = (name: string, condition: boolean) => {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      failed++;
      console.error(`  ✗ FAIL: ${name}`);
    }
  };

  // =========================================================================
  // A. HIRING-FOCUS PRIVACY TESTS
  // =========================================================================

  const baseClientPassport: TrustPassport = {
    id: 'user_client_1',
    userId: 'user_client_1',
    headline: 'Founder & Hiring Manager',
    bio: 'Building next-gen fintech.',
    isPublic: true,
    hiringInterests: ['React', 'Solana', 'Rust Architecture'],
    talentTypes: ['Senior Full-Stack Engineer', 'Security Auditor'],
    customHiringNeed: 'Looking for a Rust expert for an immediate 2-month protocol audit.',
    skills: [],
    projects: [],
    experience: [],
    education: [],
    certifications: [],
    socialLinks: {},
    identityVerified: true,
    reviews: [],
    metrics: {
      verificationScore: 80,
      completedProjectsCount: 0,
      verifiedSkillsCount: 0,
      endorsementsCount: 0,
      activeStreakDays: 0,
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const baseClientProfile: UserProfile = {
    uid: 'user_client_1',
    email: 'client@example.com',
    displayName: 'Elena Rostova',
    photoURL: 'https://images.unsplash.com/photo-test?w=400',
    role: 'creator',
    activePersona: 'client',
    availablePersonas: ['client'],
    allowedRoles: ['creator'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  // A1: isPublic = false, publishHiringFocus = false -> no public hiring projection
  const projA1 = sanitizePublicPassportProjection(
    { ...baseClientPassport, isPublic: false, publishHiringFocus: false },
    baseClientProfile
  );
  assert(
    'A1: isPublic = false, publishHiringFocus = false -> no hiringInterests projected',
    projA1.hiringInterests === undefined
  );
  assert(
    'A1: isPublic = false, publishHiringFocus = false -> no talentTypes projected',
    projA1.talentTypes === undefined
  );
  assert(
    'A1: isPublic = false, publishHiringFocus = false -> no customHiringNeed projected',
    projA1.customHiringNeed === undefined
  );

  // A2: isPublic = false, publishHiringFocus = true -> no public hiring projection
  const projA2 = sanitizePublicPassportProjection(
    { ...baseClientPassport, isPublic: false, publishHiringFocus: true },
    baseClientProfile
  );
  assert(
    'A2: isPublic = false, publishHiringFocus = true -> no hiringInterests projected',
    projA2.hiringInterests === undefined
  );
  assert(
    'A2: isPublic = false, publishHiringFocus = true -> no talentTypes projected',
    projA2.talentTypes === undefined
  );
  assert(
    'A2: isPublic = false, publishHiringFocus = true -> no customHiringNeed projected',
    projA2.customHiringNeed === undefined
  );

  // A3: isPublic = true, publishHiringFocus = false -> public profile exists, but hiring fields are omitted
  const projA3 = sanitizePublicPassportProjection(
    { ...baseClientPassport, isPublic: true, publishHiringFocus: false },
    baseClientProfile
  );
  assert(
    'A3: isPublic = true, publishHiringFocus = false -> displayName is projected',
    projA3.displayName === 'Elena Rostova'
  );
  assert(
    'A3: isPublic = true, publishHiringFocus = false -> hiringInterests strictly omitted',
    projA3.hiringInterests === undefined
  );
  assert(
    'A3: isPublic = true, publishHiringFocus = false -> talentTypes strictly omitted',
    projA3.talentTypes === undefined
  );
  assert(
    'A3: isPublic = true, publishHiringFocus = false -> customHiringNeed strictly omitted',
    projA3.customHiringNeed === undefined
  );

  // A4: isPublic = true, publishHiringFocus = true -> public profile exists and sanitized hiring fields are included
  const projA4 = sanitizePublicPassportProjection(
    { ...baseClientPassport, isPublic: true, publishHiringFocus: true },
    baseClientProfile
  );
  assert(
    'A4: isPublic = true, publishHiringFocus = true -> hiringInterests included',
    Array.isArray(projA4.hiringInterests) && projA4.hiringInterests.length === 3 && projA4.hiringInterests[0] === 'React'
  );
  assert(
    'A4: isPublic = true, publishHiringFocus = true -> talentTypes included',
    Array.isArray(projA4.talentTypes) && projA4.talentTypes.length === 2 && projA4.talentTypes[0] === 'Senior Full-Stack Engineer'
  );
  assert(
    'A4: isPublic = true, publishHiringFocus = true -> customHiringNeed included',
    projA4.customHiringNeed === 'Looking for a Rust expert for an immediate 2-month protocol audit.'
  );
  assert(
    'A4: isPublic = true, publishHiringFocus = true -> publishHiringFocus flag is true',
    projA4.publishHiringFocus === true
  );

  // A5: legacy passport without publishHiringFocus -> default to false (private)
  const legacyPassport: TrustPassport = {
    ...baseClientPassport,
    isPublic: true,
    publishHiringFocus: undefined,
  };
  const projA5 = sanitizePublicPassportProjection(legacyPassport, baseClientProfile);
  assert(
    'A5: Legacy passport without publishHiringFocus omits hiringInterests',
    projA5.hiringInterests === undefined
  );
  assert(
    'A5: Legacy passport without publishHiringFocus omits talentTypes',
    projA5.talentTypes === undefined
  );
  assert(
    'A5: Legacy passport without publishHiringFocus omits customHiringNeed',
    projA5.customHiringNeed === undefined
  );
  const unifiedA5 = getUnifiedProfileData(baseClientProfile, legacyPassport);
  assert(
    'A5: getUnifiedProfileData defaults publishHiringFocus to false for legacy passport',
    unifiedA5.publishHiringFocus === false
  );

  // A6: invalid/unsupported hiring fields -> stripped or sanitized appropriately
  const payloadA6 = buildPassportUpdatePayload(
    baseClientPassport,
    {
      hiringInterests: ['  Valid Interest  ', '', '   ', 42 as any, null as any],
      talentTypes: ['   Principal Architect   ', '  '],
      customHiringNeed: '   Immediate need for lead engineer   ',
      publishHiringFocus: true,
    }
  );
  assert(
    'A6: buildPassportUpdatePayload sanitizes and filters empty/invalid hiringInterests',
    Array.isArray(payloadA6.hiringInterests) &&
      payloadA6.hiringInterests.length === 1 &&
      payloadA6.hiringInterests[0] === 'Valid Interest'
  );
  assert(
    'A6: buildPassportUpdatePayload trims talentTypes',
    Array.isArray(payloadA6.talentTypes) &&
      payloadA6.talentTypes.length === 1 &&
      payloadA6.talentTypes[0] === 'Principal Architect'
  );
  assert(
    'A6: buildPassportUpdatePayload trims customHiringNeed',
    payloadA6.customHiringNeed === 'Immediate need for lead engineer'
  );
  assert(
    'A6: buildPassportUpdatePayload correctly persists publishHiringFocus: true',
    payloadA6.publishHiringFocus === true
  );

  // Payload with publishHiringFocus: false
  const payloadA6False = buildPassportUpdatePayload(
    baseClientPassport,
    { publishHiringFocus: false }
  );
  assert(
    'A6: buildPassportUpdatePayload correctly persists publishHiringFocus: false',
    payloadA6False.publishHiringFocus === false
  );

  // Sanitization of excessive items and characters in projection
  const excessivePassport: TrustPassport = {
    ...baseClientPassport,
    isPublic: true,
    publishHiringFocus: true,
    hiringInterests: Array.from({ length: 25 }, (_, i) => `Skill ${i}`),
    talentTypes: Array.from({ length: 20 }, (_, i) => `Role ${i}`),
    customHiringNeed: 'A'.repeat(2000),
  };
  const projExcessive = sanitizePublicPassportProjection(excessivePassport, baseClientProfile);
  assert(
    'A6: sanitizePublicPassportProjection caps hiringInterests at 10 items',
    Array.isArray(projExcessive.hiringInterests) && projExcessive.hiringInterests.length === 10
  );
  assert(
    'A6: sanitizePublicPassportProjection caps talentTypes at 10 items',
    Array.isArray(projExcessive.talentTypes) && projExcessive.talentTypes.length === 10
  );
  assert(
    'A6: sanitizePublicPassportProjection caps customHiringNeed at 1000 characters',
    typeof projExcessive.customHiringNeed === 'string' && projExcessive.customHiringNeed.length === 1000
  );

  // =========================================================================
  // B. PROFILE-PHOTO SECURITY TESTS
  // =========================================================================

  // Helper matching the Firestore rule validation logic:
  // url is string && url.size() <= 2048 && (url == '' || (url.matches('^https://.+') && !url.matches('^http://.*') && ...))
  const checkFirestorePhotoUrlRule = (url: unknown): boolean => {
    if (typeof url !== 'string') return false;
    if (url.length > 2048) return false;
    if (url === '') return true;
    const isHttps = /^https:\/\/.+/.test(url);
    const isHttp = /^http:\/\/.*/.test(url);
    const isJs = /^javascript:.*/.test(url);
    const isData = /^data:.*/.test(url);
    const isBlob = /^blob:.*/.test(url);
    const isFile = /^file:.*/.test(url);
    return isHttps && !isHttp && !isJs && !isData && !isBlob && !isFile;
  };

  // B1: Valid HTTPS photoURL accepted
  const validUrl1 = validateProfileImageUrl('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400');
  assert('B1: HTTPS URL is valid via validateProfileImageUrl', validUrl1.isValid);
  assert('B1: HTTPS URL satisfies Firestore rule', checkFirestorePhotoUrlRule('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'));

  // B2: http:// rejected
  const httpUrl = validateProfileImageUrl('http://example.com/avatar.jpg');
  assert('B2: http:// is rejected via validateProfileImageUrl', !httpUrl.isValid && httpUrl.error?.includes('HTTPS'));
  assert('B2: http:// is rejected by Firestore rule', !checkFirestorePhotoUrlRule('http://example.com/avatar.jpg'));

  // B3: javascript: rejected
  const jsUrl = validateProfileImageUrl('javascript:alert(1)');
  assert('B3: javascript: is rejected via validateProfileImageUrl', !jsUrl.isValid);
  assert('B3: javascript: is rejected by Firestore rule', !checkFirestorePhotoUrlRule('javascript:alert(1)'));

  // B4: data: rejected
  const dataUrl = validateProfileImageUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA');
  assert('B4: data: is rejected via validateProfileImageUrl', !dataUrl.isValid);
  assert('B4: data: is rejected by Firestore rule', !checkFirestorePhotoUrlRule('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA'));

  // B5: blob: rejected
  const blobUrl = validateProfileImageUrl('blob:https://example.com/uuid');
  assert('B5: blob: is rejected via validateProfileImageUrl', !blobUrl.isValid);
  assert('B5: blob: is rejected by Firestore rule', !checkFirestorePhotoUrlRule('blob:https://example.com/uuid'));

  // B6: file: rejected
  const fileUrl = validateProfileImageUrl('file:///etc/passwd');
  assert('B6: file: is rejected via validateProfileImageUrl', !fileUrl.isValid);
  assert('B6: file: is rejected by Firestore rule', !checkFirestorePhotoUrlRule('file:///etc/passwd'));

  // B7: URL > 2048 chars rejected
  const longUrl = 'https://example.com/avatar?' + 'a'.repeat(2045);
  const validatedLong = validateProfileImageUrl(longUrl);
  assert('B7: URL > 2048 chars is rejected via validateProfileImageUrl', !validatedLong.isValid);
  assert('B7: URL > 2048 chars is rejected by Firestore rule', !checkFirestorePhotoUrlRule(longUrl));

  // B8: Non-string rejected
  assert('B8: Non-string (number) rejected by Firestore rule', !checkFirestorePhotoUrlRule(12345));
  assert('B8: Non-string (object) rejected by Firestore rule', !checkFirestorePhotoUrlRule({ url: 'https://example.com' }));
  assert('B8: Non-string (array) rejected by Firestore rule', !checkFirestorePhotoUrlRule(['https://example.com']));

  // SSRF Protection checks in client validator:
  assert('B-Extra: localhost hostname is rejected', !validateProfileImageUrl('https://localhost/avatar.jpg').isValid);
  assert('B-Extra: 127.0.0.1 loopback IP is rejected', !validateProfileImageUrl('https://127.0.0.1/avatar.jpg').isValid);
  assert('B-Extra: 10.x.x.x private network is rejected', !validateProfileImageUrl('https://10.0.0.1/pic.png').isValid);
  assert('B-Extra: 192.168.x.x private network is rejected', !validateProfileImageUrl('https://192.168.1.100/pic.png').isValid);
  assert('B-Extra: Link-local cloud metadata IP is rejected', !validateProfileImageUrl('https://169.254.169.254/latest/meta-data').isValid);

  // =========================================================================
  // C. REGRESSION & NON-CLIENT CHECKS
  // =========================================================================

  // C1: Non-client personas (learner, partner, org_admin) are unaffected
  const personas: UserPersona[] = ['learner', 'partner', 'organization_admin'];
  personas.forEach((p) => {
    const pProfile: UserProfile = {
      uid: `user_${p}`,
      email: `${p}@example.com`,
      displayName: `User ${p}`,
      photoURL: 'https://example.com/photo.jpg',
      role: 'talent',
      activePersona: p,
      availablePersonas: [p],
      allowedRoles: ['talent'],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const pPassport: TrustPassport = {
      id: `user_${p}`,
      userId: `user_${p}`,
      headline: `${p} Headline`,
      bio: `${p} Bio`,
      isPublic: true,
      skills: [],
      projects: [],
      experience: [],
      education: [],
      certifications: [],
      socialLinks: {},
      identityVerified: true,
      reviews: [],
      metrics: {
        verificationScore: 75,
        completedProjectsCount: 1,
        verifiedSkillsCount: 2,
        endorsementsCount: 0,
        activeStreakDays: 10,
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const pUnified = getUnifiedProfileData(pProfile, pPassport);
    assert(`C1: ${p} persona resolves valid UnifiedProfileData`, pUnified.activePersona === p);
    assert(`C1: ${p} persona default publishHiringFocus is false`, pUnified.publishHiringFocus === false);

    const pProjection = sanitizePublicPassportProjection(pPassport, pProfile);
    assert(`C1: ${p} projection has no hiring fields`, pProjection.hiringInterests === undefined && pProjection.talentTypes === undefined);
  });

  // C2: Existing universal photoURL functionality remains intact for all personas
  const projUniversalPhoto = sanitizePublicPassportProjection(baseClientPassport, baseClientProfile);
  assert(
    'C2: Universal photoURL is preserved in public projection',
    projUniversalPhoto.photoURL === 'https://images.unsplash.com/photo-test?w=400'
  );

  // C3: Existing valid Trust Scores and Identity Verification are unaffected
  assert(
    'C3: Identity verification preserved',
    projUniversalPhoto.identityVerified === true
  );
  assert(
    'C3: Trust score calculated and preserved',
    typeof projUniversalPhoto.trustScore === 'number' && projUniversalPhoto.trustScore > 0
  );
  assert(
    'C3: Trust tier assigned properly',
    typeof projUniversalPhoto.trustTier === 'string' && projUniversalPhoto.trustTier.length > 0
  );

  // C4: Public projection recalculation still works as expected
  const clientWithoutPhoto = sanitizePublicPassportProjection(baseClientPassport, { ...baseClientProfile, photoURL: undefined });
  assert(
    'C4: Client without photo leaves photoURL omitted in projection',
    clientWithoutPhoto.photoURL === undefined
  );

  // Persona section ordering checks
  assert(
    'C5: client persona order includes client_hiring_focus',
    PERSONA_SECTION_ORDER.client.includes('client_hiring_focus')
  );
  assert(
    'C5: client_hiring_focus is placed between about and client_opportunities in client order',
    PERSONA_SECTION_ORDER.client.indexOf('client_hiring_focus') === 1 &&
      PERSONA_SECTION_ORDER.client.indexOf('client_opportunities') === 2
  );

  console.log(`Phase 2 Hiring Privacy & Photo Security Suite: ${passed}/${total} assertions passed.\n`);

  return { total, passed, failed };
}
