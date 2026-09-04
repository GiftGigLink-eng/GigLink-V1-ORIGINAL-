import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ProjectProof, PublicTrustPassport } from '../../types';
import { ProjectFormModal } from './ProjectFormModal';
import { MediaLightboxModal } from './MediaLightboxModal';
import {
  FileCheck,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Github,
  ExternalLink,
  Calendar,
  Sparkles,
  Layers,
  Award,
  Trash2,
  Edit3,
  Share2,
  Check,
  Shield,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  ZoomIn,
} from 'lucide-react';

export const ProjectDetailPage: React.FC = () => {
  const { projectId, uid } = useParams<{ projectId: string; uid?: string }>();
  const navigate = useNavigate();
  const { user, passport, unifiedProfile, updateProjectProof, deleteProjectProof, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [project, setProject] = useState<ProjectProof | null>(null);
  const [publicOwner, setPublicOwner] = useState<PublicTrustPassport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Lightbox State
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Determine if this is viewed in authenticated owner mode or public visitor mode
  const isOwnerMode = !uid && Boolean(user);

  useEffect(() => {
    if (authLoading) return;

    const loadProject = async () => {
      setLoading(true);
      try {
        if (isOwnerMode) {
          // Owner mode: Read from authenticated user's passport
          if (!passport) {
            setNotFound(true);
            setLoading(false);
            return;
          }
          const found = (passport.projects || []).find((p) => p.id === projectId);
          if (found) {
            setProject(found);
            setNotFound(false);
          } else {
            setNotFound(true);
          }
        } else if (uid) {
          // Public visitor mode: Read strictly from isolated publicTrustPassports projection
          const publicRef = doc(db, 'publicTrustPassports', uid);
          const snap = await getDoc(publicRef);

          if (snap.exists()) {
            const data = snap.data() as PublicTrustPassport;
            setPublicOwner(data);
            const found = (data.projects || []).find(
              (p) => p.id === projectId && p.status !== 'draft'
            );
            if (found) {
              setProject(found);
              setNotFound(false);
            } else {
              setNotFound(true);
            }
          } else {
            setNotFound(true);
          }
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error('Error loading project details:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, uid, passport, authLoading, isOwnerMode]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditSubmit = async (
    updates: Omit<ProjectProof, 'id' | 'verificationStatus' | 'verifierUid' | 'verifierName' | 'verifiedAt'>
  ) => {
    if (!project) return;
    try {
      await updateProjectProof(project.id, updates);
      showToast('Project updated successfully!', 'success');
      // Update local state
      setProject({
        ...project,
        ...updates,
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to update project.', 'error');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    if (window.confirm(`Are you sure you want to delete "${project.title}" from your portfolio?`)) {
      try {
        await deleteProjectProof(project.id);
        showToast('Project removed from portfolio.', 'info');
        navigate('/profile');
      } catch (err: any) {
        showToast(err.message || 'Failed to delete project.', 'error');
      }
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Resolving project proof...</p>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-amber-600 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Deliverable Not Found or Private
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
          The requested portfolio project does not exist, has been removed, or is currently held in private draft status.
        </p>
        <div className="pt-2">
          <Link
            to={isOwnerMode ? '/profile' : uid ? `/p/${uid}` : '/'}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Profile</span>
          </Link>
        </div>
      </div>
    );
  }

  const isVerified = project.verificationStatus === 'verified';
  const isDraft = project.status === 'draft';
  const mediaList = project.mediaUrls || (project.previewImage ? [project.previewImage] : []);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-200">
      {/* Navigation and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to={isOwnerMode ? '/profile' : uid ? `/p/${uid}` : '/'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isOwnerMode ? 'Back to My Profile' : 'Back to Public Profile'}</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? 'Link Copied' : 'Share Proof'}</span>
          </button>

          {isOwnerMode && (
            <>
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Case Study</span>
              </button>

              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                title="Delete deliverable"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {project.isFeatured && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span>Featured Project</span>
                </span>
              )}

              {isVerified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Verified Proof</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <Shield className="w-3 h-3 text-slate-400" />
                  <span>Self-Declared Proof</span>
                </span>
              )}

              {isDraft && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  <Lock className="w-3 h-3" />
                  <span>Private Draft</span>
                </span>
              )}

              {project.status && project.status !== 'draft' && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                  {project.status.replace('_', ' ')}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {project.title}
            </h1>

            {project.summary && (
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                {project.summary}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Role: {project.role}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Completed: {project.completedAt}</span>
              </div>
            </div>
          </div>

          {/* Verifier Attribution Card (if verified) */}
          {isVerified && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Authoritative Proof Verification</span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                This project deliverable was audited and verified by{' '}
                <strong>{project.verifierName || 'Authorized Verifier'}</strong>
                {project.verifiedAt && ` on ${project.verifiedAt}`}. It contributes to the earner's Trust Score and Proof of Work tier.
              </p>
            </div>
          )}

          {/* Quick Evidence Links Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {project.repositoryUrl && (
              <a
                href={project.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="p-3 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-slate-900 dark:text-white" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Source Repository
                    </p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[140px]">
                      View code on GitHub
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </a>
            )}

            {project.projectUrl && (
              <a
                href={project.projectUrl}
                target="_blank"
                rel="noreferrer"
                className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/70 rounded-xl flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      Live Deployed App
                    </p>
                    <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400 truncate max-w-[140px]">
                      Launch production demo
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
              </a>
            )}

            {project.externalUrl && (
              <a
                href={project.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="p-3 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Case Study / Article
                    </p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[140px]">
                      External documentation
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Media Screenshot Gallery (if available) */}
      {mediaList.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Media & Screenshots ({mediaList.length})</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {mediaList.map((imgUrl, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setLightboxIndex(idx);
                  setShowLightbox(true);
                }}
                className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-video bg-slate-100 dark:bg-slate-800 cursor-pointer shadow-xs"
              >
                <img
                  src={imgUrl}
                  alt={`${project.title} screenshot ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="p-2 rounded-full bg-white/90 text-slate-900 shadow-md">
                    <ZoomIn className="w-4 h-4" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout: Description & Skills/Deliverables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Detailed Overview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Detailed Description */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Project Overview & Implementation</span>
            </h2>
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {project.description}
            </div>
          </div>

          {/* Key Deliverables (if any) */}
          {project.deliverables && project.deliverables.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Shipped Deliverables & Features ({project.deliverables.length})
              </h2>
              <ul className="space-y-2.5">
                {project.deliverables.map((item, idx) => (
                  <li
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Column (1 span): Skills & Author Identity */}
        <div className="space-y-6">
          {/* Skills Applied */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Skills Used ({project.skillsUsed?.length || 0})</span>
            </h2>

            {project.skillsUsed && project.skillsUsed.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {project.skillsUsed.map((skill, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-semibold px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No skills attached to this project.</p>
            )}
          </div>

          {/* Author Profile Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Creator Identity
            </h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                {(isOwnerMode
                  ? unifiedProfile?.displayName
                  : publicOwner?.displayName
                )?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {isOwnerMode ? unifiedProfile?.displayName : publicOwner?.displayName}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {isOwnerMode ? unifiedProfile?.headline : publicOwner?.headline}
                </p>
              </div>
            </div>

            <Link
              to={isOwnerMode ? '/profile' : `/p/${uid}`}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <span>View Full Profile</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Edit Modal (Owner Mode) */}
      {isOwnerMode && (
        <ProjectFormModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
          initialProject={project}
          mode="edit"
        />
      )}

      {/* Media Lightbox */}
      <MediaLightboxModal
        isOpen={showLightbox}
        onClose={() => setShowLightbox(false)}
        images={mediaList}
        initialIndex={lightboxIndex}
        title={project.title}
      />
    </main>
  );
};
