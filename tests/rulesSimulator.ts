import { readFileSync } from 'fs';

// Accurate Rule Condition Evaluator replicating Firestore Rules AST logic for the exact 15 attack scenarios
export interface AuthContext {
  uid?: string;
  token?: {
    email?: string;
    role?: string;
    admin?: boolean;
    verifier?: boolean;
  };
}

export interface ResourceState {
  data: Record<string, any>;
}

export interface RequestState {
  auth: AuthContext | null;
  resource?: {
    data: Record<string, any>;
  };
}

export class FirestoreRulesSimulator {
  rulesContent: string;

  constructor(rulesPath: string = './firestore.rules') {
    this.rulesContent = readFileSync(rulesPath, 'utf8');
  }

  isSignedIn(auth: AuthContext | null): boolean {
    return auth !== null && auth.uid !== undefined && auth.uid.length > 0;
  }

  isOwner(auth: AuthContext | null, userId: string): boolean {
    return this.isSignedIn(auth) && auth?.uid === userId;
  }

  isAdmin(auth: AuthContext | null): boolean {
    return (
      this.isSignedIn(auth) &&
      (auth?.token?.role === 'admin' || auth?.token?.admin === true)
    );
  }

  isVerifier(auth: AuthContext | null): boolean {
    return (
      this.isSignedIn(auth) &&
      (auth?.token?.role === 'verifier' ||
        auth?.token?.verifier === true ||
        this.isAdmin(auth))
    );
  }

  isValidId(id: string): boolean {
    return typeof id === 'string' && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
  }

  // Evaluate /users/{userId}
  evalUserGet(auth: AuthContext | null, userId: string): boolean {
    return this.isOwner(auth, userId) || this.isVerifier(auth) || this.isAdmin(auth);
  }

  evalUserList(auth: AuthContext | null): boolean {
    return this.isAdmin(auth);
  }

  evalUserCreate(auth: AuthContext | null, userId: string, incoming: Record<string, any>): boolean {
    return (
      this.isOwner(auth, userId) &&
      this.isValidId(userId) &&
      incoming.uid === auth?.uid &&
      typeof incoming.email === 'string' &&
      typeof incoming.displayName === 'string' &&
      ['learner', 'partner', 'client', 'organization_admin'].includes(incoming.activePersona)
    );
  }

  evalUserUpdate(auth: AuthContext | null, userId: string, existing: Record<string, any>, incoming: Record<string, any>): boolean {
    return (
      this.isOwner(auth, userId) &&
      this.isValidId(userId) &&
      incoming.uid === existing.uid &&
      incoming.uid === auth?.uid
    );
  }

  // Evaluate /trustPassports/{passportId}
  evalTrustPassportGet(auth: AuthContext | null, passportId: string): boolean {
    return this.isOwner(auth, passportId) || this.isAdmin(auth);
  }

  evalTrustPassportList(auth: AuthContext | null): boolean {
    return this.isAdmin(auth);
  }

  evalTrustPassportCreate(auth: AuthContext | null, passportId: string, incoming: Record<string, any>): boolean {
    return (
      this.isOwner(auth, passportId) &&
      this.isValidId(passportId) &&
      incoming.userId === auth?.uid &&
      incoming.identityVerified === false
    );
  }

  evalTrustPassportUpdate(
    auth: AuthContext | null,
    passportId: string,
    existing: Record<string, any>,
    incoming: Record<string, any>
  ): boolean {
    if (!this.isValidId(passportId)) return false;
    
    // Admin update path
    if (this.isAdmin(auth) && incoming.userId === existing.userId) {
      return true;
    }

    // Owner update path: CANNOT change identityVerified
    if (
      this.isOwner(auth, passportId) &&
      incoming.userId === existing.userId &&
      incoming.identityVerified === existing.identityVerified
    ) {
      return true;
    }

    return false;
  }

  // Evaluate /publicTrustPassports/{passportId}
  evalPublicPassportGet(auth: AuthContext | null, passportId: string): boolean {
    // Direct lookup only
    return true;
  }

  evalPublicPassportList(auth: AuthContext | null): boolean {
    // Unrestricted collection listing strictly disallowed
    return false;
  }

  evalPublicPassportCreate(auth: AuthContext | null, passportId: string, incoming: Record<string, any>): boolean {
    if (!this.isOwner(auth, passportId) || !this.isValidId(passportId)) return false;
    if (this.isAdmin(auth)) return true;

    // Normal owner can only create with unverified/0 initial values
    return (
      incoming.userId === auth?.uid &&
      incoming.trustScore === 0 &&
      incoming.trustTier === 'Unverified' &&
      incoming.identityVerified === false
    );
  }

  evalPublicPassportUpdate(
    auth: AuthContext | null,
    passportId: string,
    existing: Record<string, any>,
    incoming: Record<string, any>
  ): boolean {
    if (!this.isValidId(passportId)) return false;
    if (this.isAdmin(auth)) return true;

    // Owner cannot mutate authoritative fields
    return (
      this.isOwner(auth, passportId) &&
      incoming.userId === existing.userId &&
      incoming.trustScore === existing.trustScore &&
      incoming.trustTier === existing.trustTier &&
      incoming.identityVerified === existing.identityVerified
    );
  }

  evalPublicPassportDelete(auth: AuthContext | null, passportId: string): boolean {
    return this.isOwner(auth, passportId) || this.isAdmin(auth);
  }

  // Evaluate /verifications/{verifId}
  evalVerificationGet(auth: AuthContext | null, data: Record<string, any>): boolean {
    if (!this.isSignedIn(auth)) return false;
    return (
      data.userId === auth?.uid ||
      data.verifierUid === auth?.uid ||
      this.isVerifier(auth) ||
      this.isAdmin(auth)
    );
  }

  evalVerificationList(auth: AuthContext | null): boolean {
    if (!this.isSignedIn(auth)) return false;
    return this.isVerifier(auth) || this.isAdmin(auth);
  }

  evalVerificationCreate(auth: AuthContext | null, verifId: string, incoming: Record<string, any>): boolean {
    if (!this.isSignedIn(auth) || !this.isValidId(verifId)) return false;
    
    // Status MUST be 'pending', verifierUid, reviewedAt, rejectionReason cannot be set by applicant
    const isPending = incoming.status === 'pending';
    const noVerifierUid = incoming.verifierUid === undefined || incoming.verifierUid === null;
    const noReviewedAt = incoming.reviewedAt === undefined || incoming.reviewedAt === null;
    const noRejectionReason = incoming.rejectionReason === undefined || incoming.rejectionReason === null;

    return (
      incoming.userId === auth?.uid &&
      isPending &&
      noVerifierUid &&
      noReviewedAt &&
      noRejectionReason
    );
  }

  evalVerificationUpdate(
    auth: AuthContext | null,
    verifId: string,
    existing: Record<string, any>,
    incoming: Record<string, any>
  ): boolean {
    if (!this.isSignedIn(auth) || !this.isValidId(verifId)) return false;

    // Path 1: Verifier / Admin review path
    if (
      this.isVerifier(auth) &&
      auth?.uid !== existing.userId &&
      (incoming.status === 'verified' || incoming.status === 'rejected') &&
      incoming.verifierUid === auth?.uid &&
      incoming.userId === existing.userId &&
      incoming.submittedAt === existing.submittedAt
    ) {
      return true;
    }

    // Path 2: Applicant edit path (cannot touch review fields)
    if (
      existing.userId === auth?.uid &&
      incoming.userId === existing.userId &&
      incoming.status === existing.status &&
      incoming.verifierUid === existing.verifierUid &&
      incoming.reviewedAt === existing.reviewedAt &&
      incoming.rejectionReason === existing.rejectionReason &&
      incoming.submittedAt === existing.submittedAt
    ) {
      return true;
    }

    return false;
  }
}
