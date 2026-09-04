/**
 * GigLink V1 Core Data Contracts & Type Definitions
 */

import { ContractDisputeStatus, ContractDisputeRecord, MutualCancellationProposal } from './dispute';

export * from './financial';
export * from './dispute';

export type GigLinkRole = 'talent' | 'creator' | 'enterprise' | 'admin';

export type UserPersona = 'learner' | 'partner' | 'client' | 'organization_admin' | 'talent' | 'creator' | 'enterprise' | 'admin';

export interface RoleDefinition {
  key: GigLinkRole;
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
  homeRoute: string;
  accentColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

export const GIGLINK_ROLES: Record<GigLinkRole, RoleDefinition> = {
  talent: {
    key: 'talent',
    label: 'Independent Talent',
    shortLabel: 'Talent',
    badge: 'Talent Workspace',
    description: 'Verifiable career identity, Trust Passport, and matching opportunities',
    homeRoute: '/talent/dashboard',
    accentColor: 'indigo',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/60',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
  },
  creator: {
    key: 'creator',
    label: 'Client',
    shortLabel: 'Client',
    badge: 'Client Workspace',
    description: 'Post verified listings, evaluate applicants, and manage contract handoffs',
    homeRoute: '/creator/dashboard',
    accentColor: 'sky',
    textColor: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-950/60',
    borderColor: 'border-sky-200 dark:border-sky-800',
  },
  enterprise: {
    key: 'enterprise',
    label: 'Enterprise / Agency',
    shortLabel: 'Enterprise',
    badge: 'Org Console',
    description: 'Multi-seat hiring, team management, and aggregate talent bench oversight',
    homeRoute: '/enterprise/dashboard',
    accentColor: 'purple',
    textColor: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/60',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  admin: {
    key: 'admin',
    label: 'Platform Verifier / Admin',
    shortLabel: 'Verifier',
    badge: 'Integrity Hub',
    description: 'KYC identity adjudication, project proof audits, and protocol security monitoring',
    homeRoute: '/admin/dashboard',
    accentColor: 'amber',
    textColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/60',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
};

export const ROLE_DEFINITIONS = GIGLINK_ROLES;

export function mapPersonaToRole(persona?: string | null): GigLinkRole {
  if (!persona) return 'talent';
  const p = persona.toLowerCase();
  if (p === 'admin' || p === 'verifier' || p === 'platform_admin') return 'admin';
  if (p === 'enterprise' || p === 'agency' || p === 'organization' || p === 'organization_admin') return 'enterprise';
  if (p === 'creator' || p === 'client') return 'creator';
  if (p === 'partner' || p === 'learner' || p === 'talent') return 'talent';
  return 'talent';
}

export function mapRoleToPersona(role: GigLinkRole): UserPersona {
  switch (role) {
    case 'admin':
      return 'organization_admin';
    case 'enterprise':
      return 'organization_admin';
    case 'creator':
      return 'client';
    case 'talent':
    default:
      return 'learner';
  }
}

export type OrganizationType = 'company' | 'institution';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  activeRole?: GigLinkRole;
  allowedRoles?: GigLinkRole[];
  activePersona: UserPersona;
  availablePersonas: UserPersona[];
  organizationId?: string; // If associated with a company or institution
  onboardingCompleted?: boolean;
  identityVerified?: boolean;
  role?: string;
  createdAt: string; // ISO String
  updatedAt: string;
  // Legacy / fallback fields preserved for zero-downtime migration
  bio?: string;
  headline?: string;
  location?: string;
  structuredLocation?: StructuredLocation;
  skills?: (string | SkillItem)[];
  portfolioUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  organization?: {
    name?: string;
    type?: OrganizationType;
    description?: string;
    website?: string;
  };
}

export interface SkillItem {
  id: string;
  name: string;
  category: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  verifiedCount: number;
  lastAssessedAt?: string;
}

export type ProjectStatus = 'draft' | 'published' | 'completed' | 'in_progress';

export interface ProjectProof {
  id: string;
  title: string;
  summary?: string;
  description: string;
  projectUrl?: string;
  repositoryUrl?: string;
  externalUrl?: string;
  skillsUsed: string[];
  role: string;
  completedAt: string;
  status?: ProjectStatus;
  isFeatured?: boolean;
  mediaUrls?: string[];
  previewImage?: string;
  deliverables?: string[];
  caseStudy?: string;
  collaboratorIds?: string[];
  verificationStatus: VerificationStatus;
  verifierName?: string;
  verifierUid?: string;
  verifiedAt?: string;
}

export interface CertificationItem {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  verificationStatus: VerificationStatus;
  verifierName?: string;
  verifierUid?: string;
  verifiedAt?: string;
}

// Backward compatibility alias for CertificateItem
export type CertificateItem = CertificationItem;

export interface EducationItem {
  id: string;
  institutionName: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  gradeOrGpa?: string;
  description?: string;
  verificationStatus: VerificationStatus;
  verifierName?: string;
  verifierUid?: string;
  verifiedAt?: string;
}

export interface ExperienceItem {
  id: string;
  organizationName: string;
  roleTitle: string;
  type: 'internship' | 'employment' | 'contract' | 'apprenticeship' | 'freelance';
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  description: string;
  skillsUsed?: string[];
  location?: string;
  verificationStatus: VerificationStatus;
  verifierName?: string;
  verifierUid?: string;
  verifiedAt?: string;
}

// Backward compatibility alias for InternshipOrWorkHistory
export type InternshipOrWorkHistory = ExperienceItem;

export interface SocialLinks {
  github?: string;
  linkedin?: string;
  twitter?: string;
  portfolio?: string;
  other?: string;
}

export interface WorkReview {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: 'client' | 'organization' | 'mentor';
  rating: number; // 1 - 5
  feedback: string;
  projectTitle: string;
  createdAt: string;
}

export interface StructuredLocation {
  country: string;
  state: string;
  city?: string;
  formattedAddress: string;
}

export type AvailabilityStatus = 'available' | 'partially_available' | 'busy' | 'not_available';
export type EngagementTypePreference = 'full_time' | 'part_time' | 'contract' | 'apprenticeship' | 'flexible';

export interface WorkAvailability {
  status: AvailabilityStatus;
  preferredEngagement: EngagementTypePreference;
  availableFrom?: string | null; // ISO Date YYYY-MM-DD or null
  hoursPerWeek?: number | null; // Optional integer e.g. 20, 40
  workLocationPreference?: 'remote' | 'hybrid' | 'onsite' | 'flexible';
}

export interface PartnerServiceOffering {
  id: string;
  title: string;
  description: string;
  category: string;
  deliveryType?: 'fixed_milestone' | 'hourly_retainer' | 'advisory' | 'turnkey_project';
  targetDeliverables?: string[];
  skillsOffered?: string[];
  isActive?: boolean;
}

export interface PotentialTrajectoryIndicator {
  verifiedMilestoneMomenta: number; // Count of verified accomplishments/milestones
  skillTrajectoryTier: 'Emerging Builder' | 'Accelerating Specialist' | 'High-Impact Contributor' | 'Master Practitioner';
  primaryDomain: string;
  momentumScore: number; // 0 - 100 derived from verified deliverables, skills & recency
  trajectorySummary: string;
  nextGrowthMilestone: string;
}

export interface TrustMetrics {
  verificationScore: number; // 0 - 100
  completedProjectsCount: number;
  verifiedSkillsCount: number;
  endorsementsCount: number;
  activeStreakDays: number;
}

export interface TrustPassport {
  id: string; // Same as userId
  userId: string;
  headline: string;
  bio: string;
  location?: string;
  structuredLocation?: StructuredLocation;
  locationVerificationStatus?: 'self_declared' | 'verified';
  identityVerified: boolean;
  isPublic?: boolean; // Controls public visibility on /p/:uid (default: false)
  skills: SkillItem[];
  projects: ProjectProof[];
  certificates?: CertificationItem[];
  certifications?: CertificationItem[];
  education: EducationItem[];
  workHistory?: ExperienceItem[];
  experience?: ExperienceItem[];
  socialLinks?: SocialLinks;
  portfolioUrl?: string;
  availability?: WorkAvailability;
  partnerServices?: PartnerServiceOffering[];
  potentialTrajectory?: PotentialTrajectoryIndicator;
  reviews: WorkReview[];
  metrics: TrustMetrics;
  trustMetrics?: TrustMetrics;
  createdAt?: string;
  updatedAt: string;
}

export interface PublicTrustPassport {
  userId: string;
  uid?: string;
  organizationId?: string;
  isPublic?: boolean;
  displayName: string;
  photoURL?: string;
  headline: string;
  bio: string;
  location: string;
  structuredLocation?: StructuredLocation;
  locationVerificationStatus: 'self_declared' | 'verified';
  identityVerified: boolean;
  trustScore: number;
  trustTier: string;
  skills: SkillItem[];
  projects: ProjectProof[];
  certificates?: CertificationItem[];
  certifications?: CertificationItem[];
  education: EducationItem[];
  workHistory?: ExperienceItem[];
  experience?: ExperienceItem[];
  socialLinks?: SocialLinks;
  portfolioUrl?: string;
  availability?: WorkAvailability;
  partnerServices?: PartnerServiceOffering[];
  potentialTrajectory?: PotentialTrajectoryIndicator;
  reviews: WorkReview[];
  metrics: TrustMetrics;
  updatedAt: string;
}

export interface UnifiedProfileData {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  activePersona: UserPersona;
  headline: string;
  bio: string;
  location: string;
  structuredLocation: StructuredLocation | null;
  skills: SkillItem[];
  projects: ProjectProof[];
  experience: ExperienceItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  socialLinks: SocialLinks;
  availability?: WorkAvailability;
  partnerServices?: PartnerServiceOffering[];
  potentialTrajectory?: PotentialTrajectoryIndicator;
  isPublic: boolean;
  identityVerified: boolean;
  trustScore: number;
  trustTier: string;
  profileCompleteness: number;
  onboardingCompleted: boolean;
  organizationId?: string;
  updatedAt: string;
}

export type IdentityDocumentType = 'national_id' | 'passport' | 'drivers_license' | 'voter_card';

export interface IdentityVerificationSubmission {
  verificationId: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  documentType: IdentityDocumentType;
  documentNumberMasked: string;
  evidenceNotes?: string;
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  verifierId?: string;
  rejectionReason?: string;
}

export interface OrganizationProfile {
  id: string;
  name: string;
  type: OrganizationType;
  description: string;
  website?: string;
  logoUrl?: string;
  adminUserIds: string[];
  memberUserIds: string[];
  verifiedStatus: boolean;
  createdAt: string;
}

export interface Opportunity {
  id: string;
  title: string;
  creatorId: string;
  creatorName: string;
  creatorTrustScore?: number;
  creatorTrustTier?: string;
  organizationId?: string | null;
  type: 'gig' | 'contract' | 'apprenticeship' | 'bounty';
  category: string;
  description: string;
  deliverablesOverview?: string[];
  requiredSkills: string[];
  experienceLevel: 'entry' | 'intermediate' | 'expert' | 'all_levels';
  locationType: 'remote' | 'hybrid' | 'onsite';
  locationString?: string | null;
  budgetType?: 'fixed_price' | 'milestone_budget' | 'hourly';
  compensationType: 'fixed' | 'hourly' | 'stipend' | 'competitive';
  compensationMin?: number | null;
  compensationMax?: number | null;
  targetMilestoneCount?: number; // 1 to 10
  minTrustScoreRequired?: number; // 0 to 100
  currency: string;
  recommendedTrustTier?: string;
  screeningQuestions?: string[];
  status: 'draft' | 'open' | 'published' | 'in_review' | 'in_progress' | 'awarded' | 'closed' | 'cancelled';
  proposalsCount?: number;
  selectedProposalId?: string | null;
  contractId?: string | null;
  createdAt: string;
  updatedAt: string;
  deadline?: string | null;
  deadlineDate?: string | null;
  milestones?: OpportunityMilestone[];
  kickoffNotes?: string;
}

export interface ProposedMilestoneItem {
  id: string;
  title: string;
  description: string;
  deliverables?: string[];
  amountUSD: number; // Positive integer/minor units
  estimatedDays: number; // Positive integer > 0
}

export type ProposalStatus =
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'revision_requested'
  | 'rejected'
  | 'accepted'
  | 'withdrawn';

export interface OpportunityProposal {
  id: string; // `prop_${opportunityId}_${talentId}`
  opportunityId: string;
  opportunityTitle: string;
  creatorId: string;
  talentId: string;
  talentDisplayName: string;
  talentEmail: string;
  talentTrustScore: number;
  talentTrustTier: string;
  talentVolumeTier?: string;
  talentIdentityVerified: boolean;
  coverLetter: string;
  proposedTotalUSD: number;
  proposedDeliveryDays: number;
  proposedMilestones: ProposedMilestoneItem[];
  status: ProposalStatus;
  clientFeedback?: string | null;
  contractId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityApplication {
  id: string; // `${opportunityId}_${applicantId}`
  opportunityId: string;
  opportunityTitle: string;
  opportunityCreatorId: string;
  organizationId?: string | null;
  applicantId: string;
  applicantDisplayName: string;
  applicantEmail: string;
  applicantTrustTier: string;
  applicantTrustScore: number;
  applicantIdentityVerified: boolean;
  coverNote: string;
  proposedRate?: number | null;
  proposedRateType?: string;
  availabilityDate?: string | null;
  portfolioLinks?: string[];
  screeningAnswers?: Record<string, string>;
  status: 'submitted' | 'under_review' | 'shortlisted' | 'accepted' | 'declined' | 'withdrawn';
  creatorFeedback?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  updatedAt: string;
}

export type Application = OpportunityApplication;

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
export type MilestoneResponsibleParty = 'applicant' | 'creator' | 'collaborative';

export type ContractStatus = 'draft' | 'pending_acceptance' | 'active' | 'completed' | 'cancelled' | 'disputed';
export type ContractMilestoneReviewState = 'pending_submission' | 'submitted' | 'in_review' | 'revision_requested' | 'approved';
export type ContractMilestonePaymentState = 'unfunded' | 'held' | 'released' | 'refunded';
export type EscrowDisputeStatus = 'none' | 'disputed' | 'resolved_released' | 'resolved_refunded';

export interface ContractScopeLock {
  title: string;
  description: string;
  inclusions: string[];
  exclusions: string[];
  deliverables: string[];
  totalAmount: number;
  currency: string;
  deadline?: string | null;
  revisionAllowance: number;
  lockedAt?: string | null;
}

export interface ContractMilestoneDelivery {
  submittedBy: string;
  submittedAt: string;
  deliveryNote: string;
  demoUrl?: string;
  repoUrl?: string;
  figmaUrl?: string;
  links?: string[];
  evidenceFiles?: string[];
}

export interface ContractMilestoneReview {
  id: string;
  revisionNumber: number;
  reviewedBy: string;
  reviewerName?: string;
  reviewedAt: string;
  feedback?: string;
  decision: 'approved' | 'revision_requested';
  previousSubmissionNote?: string;
}

export interface ContractFinalHandover {
  finalProjectUrl?: string;
  repoUrl?: string;
  documentationUrl?: string;
  credentialsHandoverConfirmed: boolean;
  finalNotes: string;
  assetLinks?: string[];
  submittedBy?: string | null;
  submittedAt?: string | null;
  acceptedBy?: string | null;
  acceptedAt?: string | null;
  status: 'pending' | 'submitted' | 'accepted';
}

export interface ContractMilestone {
  id: string;
  contractId: string;
  title: string;
  description: string;
  deliverables: string[];
  amount: number;
  currency: string;
  dueDate?: string | null;
  status: MilestoneStatus;
  reviewState: ContractMilestoneReviewState;
  revisionAllowance: number;
  revisionCount: number;
  paymentState: ContractMilestonePaymentState;
  fundedAt?: string | null;
  releasedAt?: string | null;
  refundedAt?: string | null;
  payerId?: string | null;
  payerName?: string | null;
  recipientId?: string | null;
  recipientName?: string | null;
  paymentIntentId?: string | null;
  transferId?: string | null;
  refundId?: string | null;
  disputeStatus?: EscrowDisputeStatus;
  disputeReason?: string | null;
  disputedAt?: string | null;
  fundedAmount?: number;
  requiredFundingAmount?: number;
  submission?: ContractMilestoneDelivery | null;
  reviewHistory?: ContractMilestoneReview[];
  submittedAt?: string | null;
  reviewedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractPartyAcceptance {
  accepted: boolean;
  acceptedAt?: string | null;
  acceptedByUserId?: string | null;
  signedName?: string | null;
}

export type ChangeRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'withdrawn';

export type MilestoneChangeType = 'add' | 'modify' | 'remove';

export interface ContractMilestoneChange {
  type: MilestoneChangeType;
  milestoneId?: string; // required for modify / remove
  title?: string;
  description?: string;
  amount?: number;
  currency?: string;
  dueDate?: string | null;
  deliverables?: string[];
  revisionAllowance?: number;
}

export interface ContractProposedChanges {
  title?: string;
  description?: string;
  priceDelta?: number; // e.g. +250 or -100
  newTotalAmount?: number; // calculated total amount
  currency?: string;
  proposedDeadline?: string | null;
  deadlineDeltaDays?: number; // e.g. +7
  revisionAllowanceDelta?: number; // e.g. +1
  newRevisionAllowance?: number;
  inclusionsToAdd?: string[];
  inclusionsToRemove?: string[];
  exclusionsToAdd?: string[];
  exclusionsToRemove?: string[];
  deliverablesToAdd?: string[];
  deliverablesToRemove?: string[];
  milestoneChanges?: ContractMilestoneChange[];
}

export interface ContractChangeRequest {
  id: string;
  contractId: string;
  contractVersion: number; // contract version when request was created
  requestedBy: string; // userId
  requestedByRole: 'creator' | 'talent';
  requestedByName?: string;
  title: string;
  reason: string;
  description?: string;
  proposedChanges: ContractProposedChanges;
  status: ChangeRequestStatus;
  createdAt: string;
  updatedAt: string;
  respondedAt?: string | null;
  respondedBy?: string | null;
  respondedByName?: string | null;
  responseNote?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  withdrawnAt?: string | null;
}

export interface ContractAmendmentDiffItem {
  field: string;
  label: string;
  previousValue: any;
  newValue: any;
  changeDescription?: string;
}

export interface ContractAmendmentRecord {
  id: string;
  changeRequestId: string;
  versionBefore: number;
  versionAfter: number;
  title: string;
  reason: string;
  summary: string;
  diff: ContractAmendmentDiffItem[];
  requestedBy: string;
  requestedByName?: string;
  approvedBy: string;
  approvedByName?: string;
  timestamp: string;
}

export interface GigLinkContract {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  applicationId: string;
  proposalId?: string | null;
  creatorId: string;
  creatorName?: string;
  talentId: string;
  talentName?: string;
  talentEmail?: string;
  organizationId?: string | null;
  status: ContractStatus;
  version: number;
  scopeLock: ContractScopeLock;
  originalScope?: ContractScopeLock;
  milestones: ContractMilestone[];
  changeRequests?: ContractChangeRequest[];
  amendmentHistory?: ContractAmendmentRecord[];
  creatorAcceptance: ContractPartyAcceptance;
  talentAcceptance: ContractPartyAcceptance;
  conversationId: string;
  finalHandover?: ContractFinalHandover | null;
  disputeStatus?: ContractDisputeStatus;
  disputes?: ContractDisputeRecord[];
  cancellationProposals?: MutualCancellationProposal[];
  activatedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityMilestone {
  id: string;
  title: string;
  description: string;
  responsibleParty: MilestoneResponsibleParty;
  status: MilestoneStatus;
  targetDate?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface ApplicationHandoffData {
  applicationId: string;
  opportunityId: string;
  opportunityTitle: string;
  opportunityCreatorId: string;
  organizationId?: string | null;
  applicantId: string;
  applicantDisplayName: string;
  applicantEmail: string;
  applicantTrustTier: string;
  applicantTrustScore: number;
  applicantIdentityVerified: boolean;
  creatorName: string;
  creatorEmail?: string;
  status: 'accepted';
  acceptedAt: string;
  proposedRate?: number | null;
  proposedRateType?: string;
  availabilityDate?: string | null;
  coverNote?: string;
  creatorFeedback?: string | null;
  kickoffNotes?: string;
  contactChannels?: {
    preferredMethod?: string;
    email?: string;
    slackOrDiscord?: string;
    meetingLink?: string;
    externalRepository?: string;
  };
  milestones: OpportunityMilestone[];
}

export interface VerificationRequest {
  verificationId: string;
  subjectUserId: string;
  verifierOrganizationId?: string;
  verifierUserId?: string;
  verificationType: 'skill' | 'project' | 'certificate' | 'education' | 'work_history';
  targetItemId: string;
  status: VerificationStatus;
  requestedAt: string;
  reviewedAt?: string;
  evidenceOrReference?: string;
  auditMetadata?: {
    reviewNote?: string;
  };
}

export interface AIAdvisoryRequest {
  type: 'career_recommendation' | 'skill_gap_analysis' | 'readiness_assessment' | 'opportunity_guidance';
  context: {
    persona: UserPersona;
    skills: string[];
    targetRole?: string;
    trustScore?: number;
    opportunityTitle?: string;
  };
}

export interface AIAdvisoryResponse {
  summary: string;
  suggestions: string[];
  recommendedSkillsToAcquire: string[];
  readinessScore?: number;
  explanation: string;
}

export interface MatchedSkillItem {
  name: string;
  verified: boolean;
}

export interface OpportunityMatchBreakdown {
  verifiedSkillPoints: number; // Max 40
  selfDeclaredSkillPoints: number; // Max 10
  trustTierPoints: number; // Max 30
  experiencePoints: number; // Max 20
  totalScore: number; // Max 100
}

export interface OpportunityMatchExplanation {
  matchPercentage: number; // 0 - 100
  matchedSkills: MatchedSkillItem[];
  missingSkills: string[];
  trustTierFit: 'exceeds' | 'meets' | 'below';
  experienceFit: boolean;
  explanation: string;
  summary: string;
  breakdown: OpportunityMatchBreakdown;
}

export interface CandidateMatchProfile {
  skills?: (string | SkillItem)[];
  trustTier?: string;
  trustScore?: number;
  experienceLevel?: 'entry' | 'intermediate' | 'expert' | string;
  experienceCount?: number;
  verifiedProjectsCount?: number;
}

export type NotificationType =
  | 'application_submitted'
  | 'application_under_review'
  | 'application_shortlisted'
  | 'application_accepted'
  | 'application_declined'
  | 'application_withdrawn'
  | 'verification_verified'
  | 'verification_rejected'
  | 'contract_activated'
  | 'milestone_submitted'
  | 'milestone_in_review'
  | 'milestone_revision_requested'
  | 'milestone_approved'
  | 'final_handover_submitted'
  | 'final_handover_accepted'
  | 'project_completed'
  | 'change_request_created'
  | 'change_request_approved'
  | 'change_request_rejected'
  | 'change_request_withdrawn'
  | 'contract_amended'
  | 'milestone_funded'
  | 'milestone_payment_held'
  | 'milestone_payment_released'
  | 'payout_initiated'
  | 'payout_completed'
  | 'refund_initiated'
  | 'refund_completed'
  | 'payment_failed'
  | 'additional_funding_required'
  | 'new_project_message';

export type NotificationCategory = 'application' | 'verification' | 'contract' | 'financial' | 'messaging' | 'system';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  linkUrl: string;
  createdAt: string;
  read: boolean;
  relatedEntityId?: string;
  actorName?: string;
}

// ==========================================
// Phase 5: Project-Linked Messaging Types
// ==========================================

export type ConversationStatus = 'pending_initiation' | 'active' | 'archived';

export type MessageContextType =
  | 'general'
  | 'milestone'
  | 'deliverable'
  | 'revision'
  | 'change_request'
  | 'final_handover';

export interface ProjectLinkAttachment {
  type: 'github' | 'figma' | 'demo' | 'doc' | 'custom';
  url: string;
  label?: string;
}

export interface ProjectConversation {
  id: string; // conv_${contractId}
  contractId: string;
  opportunityId: string;
  applicationId: string;
  creatorId: string;
  creatorName?: string;
  talentId: string;
  talentName?: string;
  status: ConversationStatus;
  contractStatus: ContractStatus;
  createdBy: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  lastMessageSenderId?: string | null;
  lastMessageSenderRole?: 'creator' | 'talent' | 'admin' | null;
  unreadCountCreator: number;
  unreadCountTalent: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMessage {
  id: string;
  conversationId: string;
  contractId: string;
  senderId: string;
  senderRole: 'creator' | 'talent' | 'admin';
  senderName: string;
  body: string;
  contextType?: MessageContextType;
  milestoneId?: string | null;
  milestoneTitle?: string | null;
  changeRequestId?: string | null;
  attachments?: ProjectLinkAttachment[];
  readBy: string[]; // List of user IDs who have read this message
  readAt?: Record<string, string>; // Map of userId -> ISO timestamp
  createdAt: string;
}


