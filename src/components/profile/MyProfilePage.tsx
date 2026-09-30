import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ProfileHeader } from './ProfileHeader';
import { AboutSection } from './AboutSection';
import { SkillsSection } from './SkillsSection';
import { ProjectsSection } from './ProjectsSection';
import { ExperienceSection } from './ExperienceSection';
import { EducationSection } from './EducationSection';
import { CertificationsSection } from './CertificationsSection';
import { SocialLinksSection } from './SocialLinksSection';
import { AvailabilitySection } from './AvailabilitySection';
import { ServicesSection } from './ServicesSection';
import { PotentialTrajectoryCard } from './PotentialTrajectoryCard';
import { getOrderedProfileSections } from './profileSectionRegistry';
import { ClientOpportunitiesSection } from './ClientOpportunitiesSection';
import { ClientHiringFocusSection } from './ClientHiringFocusSection';

// Modals
import { EditProfileModal } from './EditProfileModal';
import { ManageSkillsModal } from './ManageSkillsModal';
import { ProjectFormModal } from './ProjectFormModal';
import { AddExperienceModal } from './AddExperienceModal';
import { AddEducationModal } from './AddEducationModal';
import { AddCertificationModal } from './AddCertificationModal';
import { TrustScoreBreakdownModal } from '../passport/TrustScoreBreakdownModal';
import { calculateTrustScore } from '../../lib/trustScore';
import { SkillItem, ProjectProof, ExperienceItem, EducationItem, CertificationItem } from '../../types';
import {
  Loader2,
  AlertCircle,
  Sparkles,
  GraduationCap,
  Briefcase,
  Compass,
  Building2,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

export const MyProfilePage: React.FC = () => {
  const {
    user,
    profile,
    passport,
    unifiedProfile,
    activeRole,
    activePersona,
    loading,
    updatePassportVisibility,
    updatePassportDetails,
    updateProfilePicture,
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
  } = useAuth();

  const { showToast } = useToast();

  // Modal State Triggers
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showManageSkillsModal, setShowManageSkillsModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedProjectForEdit, setSelectedProjectForEdit] = useState<ProjectProof | null>(null);
  const [showAddExperienceModal, setShowAddExperienceModal] = useState(false);
  const [showAddEducationModal, setShowAddEducationModal] = useState(false);
  const [showAddCertificationModal, setShowAddCertificationModal] = useState(false);
  const [showTrustBreakdownModal, setShowTrustBreakdownModal] = useState(false);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading your profile identity...</p>
      </div>
    );
  }

  // Isolation Guard: Incomplete onboarding cannot view profile
  if (profile && profile.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!user || !unifiedProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-amber-600 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Profile Unavailable</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          We could not load your profile records. Please sign in or complete your profile initialization.
        </p>
      </div>
    );
  }

  const trustScoreResult = calculateTrustScore(passport, profile, user.emailVerified);

  // Handlers for Profile Modifications
  const handleEditProfileSubmit = async (updates: {
    headline: string;
    bio: string;
    structuredLocation: any;
    socialLinks: any;
    isPublic: boolean;
    photoURL?: string;
    hiringInterests?: string[];
    talentTypes?: string[];
    customHiringNeed?: string;
    publishHiringFocus?: boolean;
  }) => {
    try {
      await updatePassportDetails({
        headline: updates.headline,
        bio: updates.bio,
        structuredLocation: updates.structuredLocation,
        socialLinks: updates.socialLinks,
        ...(updates.hiringInterests !== undefined ? { hiringInterests: updates.hiringInterests } : {}),
        ...(updates.talentTypes !== undefined ? { talentTypes: updates.talentTypes } : {}),
        ...(updates.customHiringNeed !== undefined ? { customHiringNeed: updates.customHiringNeed } : {}),
        ...(updates.publishHiringFocus !== undefined ? { publishHiringFocus: updates.publishHiringFocus } : {}),
      });

      if (typeof updates.photoURL === 'string' && updates.photoURL !== (profile?.photoURL || '')) {
        await updateProfilePicture(updates.photoURL);
      }

      if (typeof updates.isPublic === 'boolean' && updates.isPublic !== passport?.isPublic) {
        await updatePassportVisibility(updates.isPublic);
      }
      showToast('Profile updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile.', 'error');
      throw err;
    }
  };

  const handleManageSkillsSubmit = async (skills: SkillItem[]) => {
    try {
      await updatePassportDetails({ skills });
      showToast('Skills updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update skills.', 'error');
      throw err;
    }
  };

  const handleAddOrEditProjectSubmit = async (
    proof: Omit<ProjectProof, 'id' | 'verificationStatus' | 'verifierUid' | 'verifierName' | 'verifiedAt'>
  ) => {
    try {
      if (selectedProjectForEdit) {
        await updateProjectProof(selectedProjectForEdit.id, proof);
        showToast('Deliverable updated successfully!', 'success');
      } else {
        await addProjectProof(proof);
        showToast('Verifiable deliverable added!', 'success');
      }
      setSelectedProjectForEdit(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to save deliverable proof.', 'error');
      throw err;
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProjectProof(projectId);
      showToast('Deliverable removed from portfolio.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove deliverable.', 'error');
    }
  };

  const handleAddExperienceSubmit = async (item: Omit<ExperienceItem, 'id'>) => {
    try {
      await addExperienceItem(item);
      showToast('Experience added to profile!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add experience.', 'error');
      throw err;
    }
  };

  const handleDeleteExperience = async (id: string) => {
    try {
      await deleteExperienceItem(id);
      showToast('Experience record removed.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove experience.', 'error');
    }
  };

  const handleAddEducationSubmit = async (item: Omit<EducationItem, 'id'>) => {
    try {
      await addEducationItem(item);
      showToast('Education added to profile!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add education.', 'error');
      throw err;
    }
  };

  const handleDeleteEducation = async (id: string) => {
    try {
      await deleteEducationItem(id);
      showToast('Education record removed.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove education.', 'error');
    }
  };

  const handleAddCertificationSubmit = async (
    item: Omit<CertificationItem, 'id' | 'verificationStatus' | 'verifiedAt' | 'verifierUid' | 'verifierName'>
  ) => {
    try {
      await addCertificationItem(item);
      showToast('Certification added!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add certification.', 'error');
      throw err;
    }
  };

  const handleDeleteCertification = async (id: string) => {
    try {
      await deleteCertificationItem(id);
      showToast('Certification record removed.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove certification.', 'error');
    }
  };

  const handleSocialLinksSubmit = async (links: any) => {
    try {
      await updateSocialLinks(links);
      showToast('Online links updated!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update links.', 'error');
      throw err;
    }
  };

  const handleSaveAvailability = async (availabilityData: any) => {
    try {
      await updatePassportDetails({ availability: availabilityData });
      showToast('Availability & work preferences saved!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update availability.', 'error');
      throw err;
    }
  };

  const handleSaveServices = async (servicesData: any) => {
    try {
      await updatePassportDetails({ partnerServices: servicesData });
      showToast('Partner services updated!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update services.', 'error');
      throw err;
    }
  };

  // Section Components
  const trajectoryComp = unifiedProfile.potentialTrajectory ? (
    <PotentialTrajectoryCard
      key="trajectory"
      trajectory={unifiedProfile.potentialTrajectory}
      verifiedProjectsCount={(unifiedProfile.projects || []).filter((p) => p.verificationStatus === 'verified').length}
      verifiedSkillsCount={(unifiedProfile.skills || []).filter((s) => s.verifiedCount > 0).length}
    />
  ) : null;

  const availabilityComp = (
    <AvailabilitySection
      key="availability"
      availability={unifiedProfile.availability}
      isEditable={true}
      onSaveAvailability={handleSaveAvailability}
    />
  );

  const partnerServicesComp = (
    <ServicesSection
      key="partner_services"
      services={unifiedProfile.partnerServices || []}
      isEditable={true}
      onSaveServices={handleSaveServices}
    />
  );

  const aboutComp = (
    <AboutSection
      key="about"
      bio={unifiedProfile.bio}
      onEdit={() => setShowEditProfileModal(true)}
    />
  );

  const skillsComp = (
    <SkillsSection
      key="skills"
      skills={unifiedProfile.skills || []}
      onManageSkills={() => setShowManageSkillsModal(true)}
    />
  );

  const projectsComp = (
    <ProjectsSection
      key="projects"
      projects={unifiedProfile.projects || []}
      onAddProject={() => {
        setSelectedProjectForEdit(null);
        setShowProjectModal(true);
      }}
      onEditProject={(project) => {
        setSelectedProjectForEdit(project);
        setShowProjectModal(true);
      }}
      onDeleteProject={handleDeleteProject}
    />
  );

  const experienceComp = (
    <ExperienceSection
      key="experience"
      experience={unifiedProfile.experience || []}
      onAddExperience={() => setShowAddExperienceModal(true)}
      onDeleteExperience={handleDeleteExperience}
    />
  );

  const educationComp = (
    <EducationSection
      key="education"
      education={unifiedProfile.education || []}
      onAddEducation={() => setShowAddEducationModal(true)}
      onDeleteEducation={handleDeleteEducation}
    />
  );

  const certificationsComp = (
    <CertificationsSection
      key="certifications"
      certifications={unifiedProfile.certifications || []}
      onAddCertification={() => setShowAddCertificationModal(true)}
      onDeleteCertification={handleDeleteCertification}
    />
  );

  const socialLinksComp = (
    <SocialLinksSection
      key="social_links"
      socialLinks={unifiedProfile.socialLinks}
      onEdit={() => setShowEditProfileModal(true)}
    />
  );

  const clientOpportunitiesComp = (
    <ClientOpportunitiesSection
      key="client_opportunities"
      userId={user?.uid}
    />
  );

  const clientHiringFocusComp = (
    <ClientHiringFocusSection
      key="client_hiring_focus"
      hiringInterests={unifiedProfile.hiringInterests}
      talentTypes={unifiedProfile.talentTypes}
      customHiringNeed={unifiedProfile.customHiringNeed}
      isEditable={true}
      onEdit={() => setShowEditProfileModal(true)}
    />
  );

  // Declarative persona-ordered layout resolution
  const renderPersonaOrderedSections = () => {
    const sectionsMap = {
      trajectory: trajectoryComp,
      availability: availabilityComp,
      partner_services: partnerServicesComp,
      about: aboutComp,
      skills: skillsComp,
      projects: projectsComp,
      experience: experienceComp,
      education: educationComp,
      certifications: certificationsComp,
      social_links: socialLinksComp,
      client_opportunities: clientOpportunitiesComp,
      client_hiring_focus: clientHiringFocusComp,
    };

    return getOrderedProfileSections(activePersona, sectionsMap);
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Primary Profile Header - Unified across all personas */}
      <ProfileHeader
        profileData={unifiedProfile}
        onOpenEditModal={() => setShowEditProfileModal(true)}
        onOpenBreakdownModal={() => setShowTrustBreakdownModal(true)}
      />

      {/* Persona Context Banners */}
      {activePersona === 'learner' && (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                Learner Profile Lens Active
              </h3>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                Prioritizing skill mastery, coursework milestones, and early verifiable project proofs.
              </p>
            </div>
          </div>
          <Link
            to="/opportunities"
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
          >
            <span>Explore Entry Gigs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {activePersona === 'partner' && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                Professional Partner Lens Active
              </h3>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Emphasizing verified client deliverables, repositories, live demos, and demonstrated work history.
              </p>
            </div>
          </div>
          <Link
            to="/opportunities"
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
          >
            <span>Browse Opportunities</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {activePersona === 'client' && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-950 dark:text-amber-200">
                Client Profile Lens Active
              </h3>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Highlighting studio identity, posted opportunities, and collaboration requirements for verified talent.
              </p>
            </div>
          </div>
          <Link
            to="/opportunities/create"
            className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline shrink-0"
          >
            <span>Post New Opportunity</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {activePersona === 'organization_admin' && (
        <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-purple-950 dark:text-purple-200">
                Organization Administrator Active
              </h3>
              <p className="text-[11px] text-purple-700 dark:text-purple-300">
                Managing institutional identity, company verifications, and verified team members.
              </p>
            </div>
          </div>
          {unifiedProfile.organizationId && (
            <Link
              to={`/org/${unifiedProfile.organizationId}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline shrink-0"
            >
              <span>View Organization</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* Persona-Ordered Modular Sections */}
      <div className="space-y-6">{renderPersonaOrderedSections()}</div>

      {/* Modals */}
      <EditProfileModal
        isOpen={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        initialData={unifiedProfile}
        onSubmit={handleEditProfileSubmit}
      />

      <ManageSkillsModal
        isOpen={showManageSkillsModal}
        onClose={() => setShowManageSkillsModal(false)}
        initialSkills={unifiedProfile.skills || []}
        onSubmit={handleManageSkillsSubmit}
      />

      <ProjectFormModal
        isOpen={showProjectModal}
        onClose={() => {
          setShowProjectModal(false);
          setSelectedProjectForEdit(null);
        }}
        initialProject={selectedProjectForEdit}
        mode={selectedProjectForEdit ? 'edit' : 'create'}
        onSubmit={handleAddOrEditProjectSubmit}
      />

      <AddExperienceModal
        isOpen={showAddExperienceModal}
        onClose={() => setShowAddExperienceModal(false)}
        onSubmit={handleAddExperienceSubmit}
      />

      <AddEducationModal
        isOpen={showAddEducationModal}
        onClose={() => setShowAddEducationModal(false)}
        onSubmit={handleAddEducationSubmit}
      />

      <AddCertificationModal
        isOpen={showAddCertificationModal}
        onClose={() => setShowAddCertificationModal(false)}
        onSubmit={handleAddCertificationSubmit}
      />

      <TrustScoreBreakdownModal
        isOpen={showTrustBreakdownModal}
        onClose={() => setShowTrustBreakdownModal(false)}
        breakdown={trustScoreResult}
      />
    </main>
  );
};
