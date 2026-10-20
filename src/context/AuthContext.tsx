/**
 * GigLink AuthContext & User Persona Provider
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  sendEmailVerification,
  applyActionCode,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, deleteDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  UserProfile,
  UserPersona,
  GigLinkRole,
  mapPersonaToRole,
  mapRoleToPersona,
  TrustPassport,
  PublicTrustPassport,
  OrganizationProfile,
  StructuredLocation,
  SkillItem,
  ProjectProof,
  ExperienceItem,
  EducationItem,
  CertificationItem,
  SocialLinks,
  UnifiedProfileData,
  IdentityDocumentType,
  IdentityVerificationSubmission,
} from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';
import { getSkillByName } from '../lib/catalogue/skills';
import { sanitizeStructuredLocation } from '../lib/catalogue/locations';
import {
  getUnifiedProfileData,
  buildPassportUpdatePayload,
  validateProfileImageUrl,
} from '../lib/profileService';
import { requestAuthoritativeTrustRecalculation } from '../lib/trustSyncClient';
import { postApi } from '../lib/apiClient';

export function getAuthErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred.';
  const code = error.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please check your credentials or create a new account.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact platform support or an administrator.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Access temporarily disabled. Try again later or reset password.';
    case 'auth/expired-action-code':
      return 'This verification/reset link has expired. Please request a new one.';
    case 'auth/invalid-action-code':
      return 'This verification/reset link is invalid or has already been used.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing.';
    case 'auth/unauthorized-domain': {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      return `Domain unauthorized for Google Sign-In: please add "${currentHost}" to Firebase Console (Authentication > Settings > Authorized domains), or sign in with Email & Password.`;
    }
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is disabled in your Firebase project settings. Please enable Email/Password in the Firebase Console (Authentication > Sign-in method) or sign in with Google.';
    default:
      return error.message || 'Authentication failed. Please try again.';
  }
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  passport: TrustPassport | null;
  unifiedProfile: UnifiedProfileData | null;
  activeRole: GigLinkRole;
  allowedRoles: GigLinkRole[];
  activePersona: UserPersona;
  loading: boolean;
  firestoreConnected: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  confirmResetPassword: (oobCode: string, newPass: string) => Promise<void>;
  verifyEmailCode: (oobCode: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  sendOtpCode: (targetEmail?: string, force?: boolean) => Promise<{ success: boolean; cooldownRemaining: number; devCode?: string }>;
  verifyOtpCode: (otp: string, targetEmail?: string) => Promise<boolean>;
  reloadUser: () => Promise<FirebaseUser | null>;
  checkEmailVerified: () => Promise<boolean>;
  signOut: () => Promise<void>;
  switchRole: (newRole: GigLinkRole) => Promise<void>;
  switchPersona: (newPersona: UserPersona) => Promise<void>;
  completeIndividualOnboarding: (data: {
    persona: UserPersona;
    displayName: string;
    headline: string;
    bio: string;
    location?: string;
    structuredLocation?: StructuredLocation | null;
    skills?: string[];
    portfolioUrl?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    twitterUrl?: string;
    initialProjectProof?: Omit<ProjectProof, 'id' | 'verificationStatus' | 'verifierUid' | 'verifierName' | 'verifiedAt'>;
    initialExperience?: Omit<ExperienceItem, 'id'>;
    hiringInterests?: string[];
    talentTypes?: string[];
    customHiringNeed?: string;
    publishHiringFocus?: boolean;
  }) => Promise<void>;
  completeOrganizationOnboarding: (data: {
    persona: UserPersona;
    orgName: string;
    orgType: 'company' | 'institution';
    description: string;
    website?: string;
    hqLocation?: string;
    industry?: string;
    companySize?: string;
    hiringScope?: string[];
    adminTitle?: string;
    institutionType?: string;
    officialEmailDomain?: string;
    accreditationDetails?: string;
    issuedCredentialTypes?: string[];
  }) => Promise<void>;
  updatePassportVisibility: (isPublic: boolean) => Promise<void>;
  updatePassportDetails: (
    data: Partial<
      Pick<
        TrustPassport,
        | 'headline'
        | 'bio'
        | 'location'
        | 'structuredLocation'
        | 'skills'
        | 'experience'
        | 'workHistory'
        | 'education'
        | 'certifications'
        | 'certificates'
        | 'socialLinks'
        | 'portfolioUrl'
        | 'availability'
        | 'partnerServices'
        | 'hiringInterests'
        | 'talentTypes'
        | 'customHiringNeed'
        | 'publishHiringFocus'
      >
    >
  ) => Promise<void>;
  updateProfilePicture: (photoURL: string) => Promise<void>;
  submitIdentityVerification: (
    documentType: IdentityDocumentType,
    documentNumberMasked: string,
    evidenceNotes?: string
  ) => Promise<void>;
  reviewIdentityVerification: (
    verificationId: string,
    subjectUserId: string,
    status: 'verified' | 'rejected',
    rejectionReason?: string
  ) => Promise<void>;
  addProjectProof: (proof: Omit<ProjectProof, 'id' | 'verificationStatus' | 'verifierUid' | 'verifierName' | 'verifiedAt'>) => Promise<void>;
  updateProjectProof: (
    projectId: string,
    updates: Partial<Omit<ProjectProof, 'id' | 'verificationStatus' | 'verifierUid' | 'verifierName' | 'verifiedAt'>>
  ) => Promise<void>;
  deleteProjectProof: (proofId: string) => Promise<void>;
  addExperienceItem: (exp: Omit<ExperienceItem, 'id' | 'verificationStatus'>) => Promise<void>;
  deleteExperienceItem: (expId: string) => Promise<void>;
  addEducationItem: (edu: Omit<EducationItem, 'id' | 'verificationStatus'>) => Promise<void>;
  deleteEducationItem: (eduId: string) => Promise<void>;
  addCertificationItem: (cert: Omit<CertificationItem, 'id' | 'verificationStatus'>) => Promise<void>;
  deleteCertificationItem: (certId: string) => Promise<void>;
  updateSocialLinks: (links: SocialLinks) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [passport, setPassport] = useState<TrustPassport | null>(null);
  const [activeRole, setActiveRole] = useState<GigLinkRole>('talent');
  const [activePersona, setActivePersona] = useState<UserPersona>('learner');
  const [loading, setLoading] = useState(true);
  const [firestoreConnected, setFirestoreConnected] = useState(false);
  const [isTokenAdmin, setIsTokenAdmin] = useState(false);

  // Compute dual-read unified profile data whenever user, profile, or passport changes
  const unifiedProfile = user
    ? getUnifiedProfileData(profile, passport, user.emailVerified)
    : null;

  // Canonical platform roles for normal users: talent (learner/partner), creator (client), enterprise (organization_admin)
  const canonicalDefaults: GigLinkRole[] = ['talent', 'creator', 'enterprise'];
  const rawAllowed: string[] = (profile?.allowedRoles as string[]) || canonicalDefaults;
  // Strictly filter 'admin': only permitted if verified token claims explicitly grant it
  const filteredAllowed = rawAllowed.filter((r) => r !== 'admin' || isTokenAdmin);

  const allowedRoles: GigLinkRole[] = Array.from(
    new Set(
      filteredAllowed.map((r) => (r === 'client' ? 'creator' : (r as GigLinkRole)))
    )
  );
  if (
    (profile?.activePersona === 'client' || profile?.availablePersonas?.includes('client')) &&
    !allowedRoles.includes('creator')
  ) {
    allowedRoles.push('creator');
  }
  if (isTokenAdmin && !allowedRoles.includes('admin')) {
    allowedRoles.push('admin');
  }

  // Test initial connection to Firestore backend per Firebase Integration guidelines
  useEffect(() => {
    let isMounted = true;
    async function testConnection() {
      try {
        await getDoc(doc(db, 'publicTrustPassports', 'connection-probe'));
        if (isMounted) setFirestoreConnected(true);
      } catch (error: any) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          if (isMounted) setFirestoreConnected(false);
        } else {
          // Other responses indicate server reached or permission checked
          if (isMounted) setFirestoreConnected(true);
        }
      }
    }
    testConnection();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync Auth State & Firestore Profile
  useEffect(() => {
    let unsubUser: (() => void) | null = null;
    let unsubPassport: (() => void) | null = null;

    const cleanupListeners = () => {
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }
      if (unsubPassport) {
        unsubPassport();
        unsubPassport = null;
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      cleanupListeners();

      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        setPassport(null);
        setIsTokenAdmin(false);
        setLoading(false);
        return;
      }

      // Check for cryptographic admin claim in token
      currentUser
        .getIdTokenResult()
        .then((tokenResult) => {
          const claims = (tokenResult?.claims as any) || {};
          const hasAdminClaim = Boolean(claims.admin === true || claims.role === 'admin');
          setIsTokenAdmin(hasAdminClaim);
        })
        .catch((err) => {
          console.warn('[AuthContext] Could not inspect ID token claims:', err);
          setIsTokenAdmin(false);
        });

      const userRef = doc(db, 'users', currentUser.uid);
      const passportRef = doc(db, 'trustPassports', currentUser.uid);

      // Listen to User Profile updates
      unsubUser = onSnapshot(
        userRef,
        async (docSnap) => {
          if (!auth.currentUser || auth.currentUser.uid !== currentUser.uid) return;
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
            const rawRole = (data.activeRole as string) === 'client' ? 'creator' : data.activeRole;
            const derivedRole = rawRole || mapPersonaToRole(data.activePersona);
            setActiveRole(derivedRole);
            setActivePersona(data.activePersona || mapRoleToPersona(derivedRole));
          } else {
            // Initialize default profile for new user - strictly canonical roles only
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'New User',
              photoURL: currentUser.photoURL || '',
              activeRole: 'talent',
              allowedRoles: ['talent', 'creator', 'enterprise'],
              activePersona: 'learner',
              availablePersonas: ['learner', 'partner', 'client', 'organization_admin'],
              onboardingCompleted: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            const defaultPassport: TrustPassport = {
              id: currentUser.uid,
              userId: currentUser.uid,
              headline: 'Aspiring Professional on GigLink',
              bio: 'Building skills, verifying credentials, and creating verifiable proof of capabilities.',
              location: '',
              locationVerificationStatus: 'self_declared',
              identityVerified: false,
              isPublic: false, // Default to private for new users
              skills: [],
              projects: [],
              certificates: [],
              education: [],
              workHistory: [],
              reviews: [],
              metrics: {
                verificationScore: 0,
                completedProjectsCount: 0,
                verifiedSkillsCount: 0,
                endorsementsCount: 0,
                activeStreakDays: 1,
              },
              updatedAt: new Date().toISOString(),
            };

            try {
              await setDoc(userRef, newProfile);
              await setDoc(passportRef, defaultPassport);
            } catch (err) {
              if (auth.currentUser && auth.currentUser.uid === currentUser.uid) {
                handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
              }
            }
          }
          setLoading(false);
        },
        (error) => {
          // If auth state has changed or user signed out, gracefully ignore stale listener callbacks
          if (auth.currentUser && auth.currentUser.uid === currentUser.uid) {
            const errMsg = error?.message || String(error);
            if (
              errMsg.includes('the client is offline') ||
              errMsg.includes('backend') ||
              errMsg.includes('closing') ||
              errMsg.includes('hidden') ||
              errMsg.includes('Database is closing') ||
              error?.code === 'unavailable'
            ) {
              console.warn(`[AuthContext] Firestore listener offline/reconnecting for users/${currentUser.uid}:`, errMsg);
              setLoading(false);
              return;
            }
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          }
        }
      );

      // Listen to Trust Passport updates and mirror to sanitized publicTrustPassports if isPublic
      unsubPassport = onSnapshot(
        passportRef,
        async (docSnap) => {
          if (!auth.currentUser || auth.currentUser.uid !== currentUser.uid) return;
          if (docSnap.exists()) {
            const currentPass = docSnap.data() as TrustPassport;
            setPassport(currentPass);

            // Synchronize public projection via server-authoritative endpoint
            const publicPassportRef = doc(db, 'publicTrustPassports', currentUser.uid);
            if (currentPass.isPublic === true) {
              try {
                // Authoritative recalculation and public projection write strictly managed by server
                const serverSync = await requestAuthoritativeTrustRecalculation(currentUser.uid);
                if (!serverSync.success) {
                  console.warn(
                    '[TrustSync] Authoritative public passport synchronization deferred/failed:',
                    serverSync.error
                  );
                }
              } catch (syncErr) {
                console.error('Failed to sync public passport projection:', syncErr);
              }
            } else {
              // If private, ensure public document is deleted
              try {
                await deleteDoc(publicPassportRef);
              } catch (delErr) {
                // Ignore if not present
              }
            }
          }
        },
        (error) => {
          // If auth state has changed or user signed out, gracefully ignore stale listener callbacks
          if (auth.currentUser && auth.currentUser.uid === currentUser.uid) {
            const errMsg = error?.message || String(error);
            if (
              errMsg.includes('the client is offline') ||
              errMsg.includes('backend') ||
              errMsg.includes('closing') ||
              errMsg.includes('hidden') ||
              errMsg.includes('Database is closing') ||
              error?.code === 'unavailable'
            ) {
              console.warn(`[AuthContext] Firestore listener offline/reconnecting for trustPassports/${currentUser.uid}:`, errMsg);
              return;
            }
            handleFirestoreError(error, OperationType.GET, `trustPassports/${currentUser.uid}`);
          }
        }
      );
    });

    const handleWindowFocus = async () => {
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        try {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            setUser({ ...auth.currentUser });
          }
        } catch {
          // Gracefully ignore focus reload failures
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      cleanupListeners();
      unsubscribe();
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        console.info('Google sign-in popup was dismissed by the user.');
      } else {
        console.error('Sign in with Google failed:', error);
      }
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, displayName: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (cred.user) {
        await updateProfile(cred.user, { displayName });
        try {
          await sendEmailVerification(cred.user);
        } catch (e) {
          console.warn('Initial verification email failed to send:', e);
        }
      }
    } catch (error: any) {
      if (error?.code !== 'auth/email-already-in-use') {
        console.error('Sign up failed:', error);
      } else {
        console.warn('Sign up attempt with already registered email:', email);
      }
      throw error;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      if (
        error?.code === 'auth/invalid-credential' ||
        error?.code === 'auth/user-not-found' ||
        error?.code === 'auth/wrong-password' ||
        error?.code === 'auth/invalid-email'
      ) {
        console.warn('[AuthContext] Sign in rejected invalid credentials:', error?.code);
      } else {
        console.error('Sign in failed:', error);
      }
      throw error;
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  };

  const confirmResetPassword = async (oobCode: string, newPass: string) => {
    try {
      await confirmPasswordReset(auth, oobCode, newPass);
    } catch (error) {
      console.error('Confirm reset password failed:', error);
      throw error;
    }
  };

  const reloadUser = async (): Promise<FirebaseUser | null> => {
    if (!auth.currentUser) return null;
    try {
      await auth.currentUser.reload();
      const updatedUser = auth.currentUser;
      setUser({ ...updatedUser });
      return updatedUser;
    } catch (error) {
      console.warn('Failed to reload current user auth state:', error);
      return auth.currentUser;
    }
  };

  const checkEmailVerified = async (): Promise<boolean> => {
    const updated = await reloadUser();
    return !!updated?.emailVerified;
  };

  const verifyEmailCode = async (oobCode: string) => {
    try {
      await applyActionCode(auth, oobCode);
      await reloadUser();
    } catch (error) {
      console.error('Verify email code failed:', error);
      throw error;
    }
  };

  const sendOtpCode = async (
    targetEmail?: string,
    force?: boolean
  ): Promise<{ success: boolean; cooldownRemaining: number; devCode?: string }> => {
    const email = targetEmail || auth.currentUser?.email || profile?.email;
    const userId = auth.currentUser?.uid || profile?.uid;
    if (!email) throw new Error('No email address provided.');

    let idToken: string | undefined;
    if (auth.currentUser) {
      try {
        idToken = await auth.currentUser.getIdToken();
      } catch (e) {
        console.warn('Could not fetch idToken for OTP dispatch:', e);
      }
    }

    try {
      const data = await postApi(
        '/api/auth/otp/send',
        { email, userId, force },
        idToken ? { Authorization: `Bearer ${idToken}` } : undefined
      );

      return {
        success: true,
        cooldownRemaining: data.cooldownRemaining || 60,
        devCode: data.devCode,
      };
    } catch (error: any) {
      if (error?.status === 429) {
        error.code = 'auth/too-many-requests';
      }
      throw error;
    }
  };

  const verifyOtpCode = async (otp: string, targetEmail?: string): Promise<boolean> => {
    const email = targetEmail || auth.currentUser?.email || profile?.email;
    const userId = auth.currentUser?.uid || profile?.uid;
    if (!email) throw new Error('No email address provided.');

    let idToken: string | undefined;
    if (auth.currentUser) {
      try {
        idToken = await auth.currentUser.getIdToken();
      } catch (e) {
        console.warn('Could not fetch idToken for OTP verification:', e);
      }
    }

    const data = await postApi(
      '/api/auth/otp/verify',
      { otp, email, userId },
      idToken ? { Authorization: `Bearer ${idToken}` } : undefined
    );

    // If server returned oobCode and user is in browser, apply action code locally as backup
    if (data.oobCode) {
      try {
        await applyActionCode(auth, data.oobCode);
      } catch {
        // Ignored if already applied server-side
      }
    }

    // Reload auth state and update context
    await reloadUser();
    return true;
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('No user is currently signed in.');
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (error: any) {
      if (error?.code === 'auth/too-many-requests') {
        const enhancedError = new Error('Too many verification requests. Please wait a minute before requesting another email.');
        (enhancedError as any).code = 'auth/too-many-requests';
        throw enhancedError;
      }
      console.error('Resend verification email failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const switchRole = async (newRole: GigLinkRole) => {
    if (!user) return;
    if (newRole === 'admin' && !isTokenAdmin) {
      console.warn('Blocked unauthorized attempt to switch to admin without token claim.');
      return;
    }
    const currentAllowed = allowedRoles;
    if (!currentAllowed.includes(newRole)) {
      console.warn(`Role ${newRole} is not in allowedRoles:`, currentAllowed);
      return;
    }
    setActiveRole(newRole);
    const mappedPersona = mapRoleToPersona(newRole);
    setActivePersona(mappedPersona);
    const userRef = doc(db, 'users', user.uid);
    try {
      await setDoc(
        userRef,
        {
          activeRole: newRole,
          activePersona: mappedPersona,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const switchPersona = async (newPersona: UserPersona) => {
    if (!user) return;
    const mappedRole = mapPersonaToRole(newPersona);
    setActivePersona(newPersona);
    setActiveRole(mappedRole);
    const userRef = doc(db, 'users', user.uid);
    try {
      await setDoc(
        userRef,
        {
          activePersona: newPersona,
          activeRole: mappedRole,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const completeIndividualOnboarding = async (data: {
    persona: UserPersona;
    displayName: string;
    headline: string;
    bio: string;
    location?: string;
    structuredLocation?: StructuredLocation | null;
    skills?: string[];
    portfolioUrl?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    twitterUrl?: string;
    initialProjectProof?: Omit<ProjectProof, 'id' | 'verificationStatus' | 'verifierUid' | 'verifierName' | 'verifiedAt'>;
    initialExperience?: Omit<ExperienceItem, 'id'>;
    hiringInterests?: string[];
    talentTypes?: string[];
    customHiringNeed?: string;
    publishHiringFocus?: boolean;
  }) => {
    if (!user) throw new Error('User must be authenticated to complete onboarding.');
    const userRef = doc(db, 'users', user.uid);
    const passportRef = doc(db, 'trustPassports', user.uid);

    const now = new Date().toISOString();

    // Map skill names to canonical SkillItem objects
    const mappedSkills: SkillItem[] = (data.skills || []).map((skillName, idx) => {
      const canonical = getSkillByName(skillName);
      return {
        id: `skill_${idx}_${Date.now()}`,
        name: canonical?.name || skillName,
        category: canonical?.category || 'General',
        proficiency: 'intermediate',
        verifiedCount: 0,
      };
    });

    // Optional initial project proof
    const initialProofs: ProjectProof[] = data.initialProjectProof
      ? [
          {
            id: `proof_init_${Date.now()}`,
            ...data.initialProjectProof,
            verificationStatus: 'unverified',
          },
        ]
      : [];

    // Optional initial experience
    const initialExp: ExperienceItem[] = data.initialExperience
      ? [
          {
            id: `exp_init_${Date.now()}`,
            ...data.initialExperience,
          },
        ]
      : [];

    try {
      await setDoc(
        userRef,
        {
          activePersona: data.persona,
          displayName: data.displayName,
          onboardingCompleted: true,
          updatedAt: now,
          ...(data.hiringInterests ? { hiringInterests: data.hiringInterests } : {}),
          ...(data.talentTypes ? { talentTypes: data.talentTypes } : {}),
          ...(data.customHiringNeed ? { customHiringNeed: data.customHiringNeed } : {}),
        },
        { merge: true }
      );

      const sanitizedLoc = sanitizeStructuredLocation(data.structuredLocation);

      await setDoc(
        passportRef,
        {
          id: user.uid,
          userId: user.uid,
          headline: data.headline,
          bio: data.bio,
          location: data.location || (sanitizedLoc ? sanitizedLoc.formattedAddress : ''),
          structuredLocation: sanitizedLoc,
          skills: mappedSkills,
          portfolioUrl: data.portfolioUrl || '',
          socialLinks: {
            github: data.githubUrl || '',
            linkedin: data.linkedinUrl || '',
            twitter: data.twitterUrl || '',
          },
          ...(initialProofs.length > 0 ? { projectProofs: initialProofs } : {}),
          ...(initialExp.length > 0 ? { experience: initialExp } : {}),
          ...(data.hiringInterests ? { hiringInterests: data.hiringInterests } : {}),
          ...(data.talentTypes ? { talentTypes: data.talentTypes } : {}),
          ...(data.customHiringNeed ? { customHiringNeed: data.customHiringNeed } : {}),
          publishHiringFocus: data.publishHiringFocus === true,
          identityVerified: false,
          updatedAt: now,
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const completeOrganizationOnboarding = async (data: {
    persona: UserPersona;
    orgName: string;
    orgType: 'company' | 'institution';
    description: string;
    website?: string;
    hqLocation?: string;
    industry?: string;
    companySize?: string;
    hiringScope?: string[];
    adminTitle?: string;
    institutionType?: string;
    officialEmailDomain?: string;
    accreditationDetails?: string;
    issuedCredentialTypes?: string[];
  }) => {
    if (!user) throw new Error('User must be authenticated to complete onboarding.');
    const orgId = `org_${user.uid}`;
    const userRef = doc(db, 'users', user.uid);
    const orgRef = doc(db, 'organizations', orgId);

    const now = new Date().toISOString();

    const orgDoc: OrganizationProfile & {
      hqLocation?: string;
      industry?: string;
      companySize?: string;
      hiringScope?: string[];
      adminTitle?: string;
      institutionType?: string;
      officialEmailDomain?: string;
      accreditationDetails?: string;
      issuedCredentialTypes?: string[];
    } = {
      id: orgId,
      name: data.orgName,
      type: data.orgType,
      description: data.description,
      website: data.website || '',
      adminUserIds: [user.uid],
      memberUserIds: [user.uid],
      verifiedStatus: false,
      createdAt: now,
      hqLocation: data.hqLocation,
      industry: data.industry,
      companySize: data.companySize,
      hiringScope: data.hiringScope,
      adminTitle: data.adminTitle,
      institutionType: data.institutionType,
      officialEmailDomain: data.officialEmailDomain,
      accreditationDetails: data.accreditationDetails,
      issuedCredentialTypes: data.issuedCredentialTypes,
    };

    try {
      await setDoc(orgRef, orgDoc);

      await setDoc(
        userRef,
        {
          activePersona: data.persona,
          organizationId: orgId,
          onboardingCompleted: true,
          updatedAt: now,
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `organizations/${orgId}`);
    }
  };

  const updatePassportVisibility = async (isPublic: boolean) => {
    if (!user) throw new Error('User must be authenticated.');
    const passportRef = doc(db, 'trustPassports', user.uid);
    try {
      await setDoc(
        passportRef,
        {
          isPublic,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trustPassports/${user.uid}`);
    }
  };

  const updatePassportDetails = async (
    data: Partial<
      Pick<
        TrustPassport,
        | 'headline'
        | 'bio'
        | 'location'
        | 'structuredLocation'
        | 'skills'
        | 'experience'
        | 'workHistory'
        | 'education'
        | 'certifications'
        | 'certificates'
        | 'socialLinks'
        | 'portfolioUrl'
        | 'availability'
        | 'partnerServices'
        | 'hiringInterests'
        | 'talentTypes'
        | 'customHiringNeed'
        | 'publishHiringFocus'
      >
    >
  ) => {
    if (!user) throw new Error('User must be authenticated.');
    const passportRef = doc(db, 'trustPassports', user.uid);
    try {
      const payload = buildPassportUpdatePayload(passport, data);
      await setDoc(passportRef, payload, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trustPassports/${user.uid}`);
    }
  };

  const updateProfilePicture = async (newPhotoURL: string) => {
    if (!auth.currentUser || !user) {
      throw new Error('User must be authenticated to update profile picture.');
    }

    const validation = validateProfileImageUrl(newPhotoURL, { allowEmpty: true });
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid profile picture URL.');
    }

    const sanitized = validation.sanitizedUrl || '';
    const now = new Date().toISOString();
    const userRef = doc(db, 'users', user.uid);

    try {
      // 1. Authoritative write to users/{uid}
      await setDoc(userRef, { photoURL: sanitized, updatedAt: now }, { merge: true });

      // 2. Synchronize Firebase Auth currentUser profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: sanitized || '' });
      }

      // 3. Synchronize publicTrustPassports projection if public
      if (passport?.isPublic === true) {
        try {
          await requestAuthoritativeTrustRecalculation(user.uid);
        } catch (syncErr) {
          console.warn('[TrustSync] Public passport recalculation deferred after photoURL update:', syncErr);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const submitIdentityVerification = async (
    documentType: IdentityDocumentType,
    documentNumberMasked: string,
    evidenceNotes?: string
  ) => {
    if (!user) throw new Error('User must be authenticated.');
    const verifId = `verif_id_${user.uid}_${Date.now()}`;
    const verifRef = doc(db, 'verifications', verifId);

    const submission: IdentityVerificationSubmission = {
      verificationId: verifId,
      userId: user.uid,
      userDisplayName: profile?.displayName || user.displayName || 'Applicant',
      userEmail: user.email || '',
      documentType,
      documentNumberMasked,
      evidenceNotes: evidenceNotes || '',
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };

    try {
      await setDoc(verifRef, submission);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `verifications/${verifId}`);
    }
  };

  const reviewIdentityVerification = async (
    verificationId: string,
    subjectUserId: string,
    status: 'verified' | 'rejected',
    rejectionReason?: string
  ) => {
    if (!user) throw new Error('User must be authenticated to review.');
    if (user.uid === subjectUserId) {
      throw new Error('Unauthorized: You cannot review your own verification submission.');
    }

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/verifications/review-identity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          verificationId,
          subjectUserId,
          status,
          rejectionReason: rejectionReason || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Server verification review failed with status ${response.status}`
        );
      }
    } catch (err: any) {
      console.error('[reviewIdentityVerification] Failed:', err);
      handleFirestoreError(err, OperationType.WRITE, `verifications/${verificationId}`);
      throw err;
    }
  };

  const addProjectProof = async (
    proof: Omit<ProjectProof, 'id' | 'verificationStatus' | 'verifierUid' | 'verifierName' | 'verifiedAt'>
  ) => {
    if (!user || !passport) throw new Error('User must be authenticated.');
    const passportRef = doc(db, 'trustPassports', user.uid);

    const newProject: ProjectProof = {
      ...proof,
      id: `proj_${Date.now()}`,
      status: proof.status || 'published',
      isFeatured: proof.isFeatured || false,
      // For initial unverified submissions, set verificationStatus to pending/unverified
      verificationStatus: 'pending',
    };

    const currentProjects = passport.projects || [];
    const updatedProjects = [...currentProjects, newProject];

    try {
      await setDoc(
        passportRef,
        {
          projects: updatedProjects,
          metrics: {
            ...passport.metrics,
            completedProjectsCount: updatedProjects.length,
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trustPassports/${user.uid}`);
    }
  };

  const updateProjectProof = async (
    projectId: string,
    updates: Partial<Omit<ProjectProof, 'id' | 'verificationStatus' | 'verifierUid' | 'verifierName' | 'verifiedAt'>>
  ) => {
    if (!user || !passport) throw new Error('User must be authenticated.');
    const passportRef = doc(db, 'trustPassports', user.uid);

    const currentProjects = passport.projects || [];
    const updatedProjects = currentProjects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          ...updates,
          // Preserved authoritative fields - strictly protected from tampering
          id: p.id,
          verificationStatus: p.verificationStatus,
          verifierUid: p.verifierUid,
          verifierName: p.verifierName,
          verifiedAt: p.verifiedAt,
        };
      }
      return p;
    });

    try {
      await setDoc(
        passportRef,
        {
          projects: updatedProjects,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trustPassports/${user.uid}`);
    }
  };

  const deleteProjectProof = async (proofId: string) => {
    if (!user || !passport) throw new Error('User must be authenticated.');
    const passportRef = doc(db, 'trustPassports', user.uid);

    const currentProjects = passport.projects || [];
    const updatedProjects = currentProjects.filter((p) => p.id !== proofId);

    try {
      await setDoc(
        passportRef,
        {
          projects: updatedProjects,
          metrics: {
            ...passport.metrics,
            completedProjectsCount: updatedProjects.length,
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trustPassports/${user.uid}`);
    }
  };

  const addExperienceItem = async (exp: Omit<ExperienceItem, 'id' | 'verificationStatus'>) => {
    if (!user || !passport) throw new Error('User must be authenticated.');
    const passportRef = doc(db, 'trustPassports', user.uid);

    const newExp: ExperienceItem = {
      ...exp,
      id: `exp_${Date.now()}`,
      verificationStatus: 'unverified',
    };

    const currentExp = passport.experience || passport.workHistory || [];
    const updatedExp = [...currentExp, newExp];

    try {
      await setDoc(
        passportRef,
        {
          experience: updatedExp,
          workHistory: updatedExp,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trustPassports/${user.uid}`);
    }
  };

  const deleteExperienceItem = async (expId: string) => {
    if (!user || !passport) throw new Error('User must be authenticated.');
    const passportRef = doc(db, 'trustPassports', user.uid);

    const currentExp = passport.experience || passport.workHistory || [];
    const updatedExp = currentExp.filter((e) => e.id !== expId);

    try {
      await setDoc(
        passportRef,
        {
          experience: updatedExp,
          workHistory: updatedExp,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trustPassports/${user.uid}`);
    }
  };

  const addEducationItem = async (edu: Omit<EducationItem, 'id' | 'verificationStatus'>) => {
    if (!user || !passport) throw new Error('User must be authenticated.');
    const passportRef = doc(db, 'trustPassports', user.uid);

    const newEdu: EducationItem = {
      ...edu,
      id: `edu_${Date.now()}`,
      verificationStatus: 'unverified',
    };

    const currentEdu = passport.education || [];
    const updatedEdu = [...currentEdu, newEdu];

    try {
      await setDoc(
        passportRef,
        {
          education: updatedEdu,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trustPassports/${user.uid}`);
    }
  };

  const deleteEducationItem = async (eduId: string) => {
    if (!user || !passport) throw new Error('User must be authenticated.');
    const passportRef = doc(db, 'trustPassports', user.uid);

    const currentEdu = passport.education || [];
    const updatedEdu = currentEdu.filter((e) => e.id !== eduId);

    try {
      await setDoc(
        passportRef,
        {
          education: updatedEdu,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trustPassports/${user.uid}`);
    }
  };

  const addCertificationItem = async (cert: Omit<CertificationItem, 'id' | 'verificationStatus'>) => {
    if (!user || !passport) throw new Error('User must be authenticated.');
    const passportRef = doc(db, 'trustPassports', user.uid);

    const newCert: CertificationItem = {
      ...cert,
      id: `cert_${Date.now()}`,
      verificationStatus: cert.credentialUrl ? 'verified' : 'unverified',
    };

    const currentCerts = passport.certifications || passport.certificates || [];
    const updatedCerts = [...currentCerts, newCert];

    try {
      await setDoc(
        passportRef,
        {
          certifications: updatedCerts,
          certificates: updatedCerts,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trustPassports/${user.uid}`);
    }
  };

  const deleteCertificationItem = async (certId: string) => {
    if (!user || !passport) throw new Error('User must be authenticated.');
    const passportRef = doc(db, 'trustPassports', user.uid);

    const currentCerts = passport.certifications || passport.certificates || [];
    const updatedCerts = currentCerts.filter((c) => c.id !== certId);

    try {
      await setDoc(
        passportRef,
        {
          certifications: updatedCerts,
          certificates: updatedCerts,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trustPassports/${user.uid}`);
    }
  };

  const updateSocialLinks = async (links: SocialLinks) => {
    if (!user) throw new Error('User must be authenticated.');
    const passportRef = doc(db, 'trustPassports', user.uid);
    try {
      await setDoc(
        passportRef,
        {
          socialLinks: links,
          portfolioUrl: links.portfolio || '',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trustPassports/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        passport,
        unifiedProfile,
        activeRole,
        allowedRoles,
        activePersona,
        loading,
        firestoreConnected,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        sendPasswordReset,
        confirmResetPassword,
        verifyEmailCode,
        resendVerificationEmail,
        sendOtpCode,
        verifyOtpCode,
        reloadUser,
        checkEmailVerified,
        signOut,
        switchRole,
        switchPersona,
        completeIndividualOnboarding,
        completeOrganizationOnboarding,
        updatePassportVisibility,
        updatePassportDetails,
        updateProfilePicture,
        submitIdentityVerification,
        reviewIdentityVerification,
        addProjectProof,
        updateProjectProof,
        deleteProjectProof,
        addExperienceItem,
        deleteExperienceItem,
        addEducationItem,
        deleteEducationItem,
        addCertificationItem,
        deleteCertificationItem,
        updateSocialLinks,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

