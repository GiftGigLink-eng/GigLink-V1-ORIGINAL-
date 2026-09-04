import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Award,
  Building2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Upload,
  User,
  Mail,
  FileText,
  Layers,
  Calendar,
  AlertCircle,
  Clock,
  Plus,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  VerifiableCredentialType,
  CredentialIssuanceInput,
  CredentialIssuerProfile,
} from '../../types/credential';
import {
  issueVerifiableCredential,
  bulkIssueVerifiableCredentials,
  calculateCredentialTrustImpact,
} from '../../lib/credentialIssuanceService';
import { useToast } from '../../context/ToastContext';

export const InstitutionCredentialIssuancePage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [issuing, setIssuing] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [credentialType, setCredentialType] = useState<VerifiableCredentialType>('course_certificate');
  const [description, setDescription] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [achievementGrade, setAchievementGrade] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [criteria, setCriteria] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  
  // Skills tags
  const [skills, setSkills] = useState<string[]>(['TypeScript', 'Distributed Systems']);
  const [skillInput, setSkillInput] = useState('');

  // Bulk CSV input state
  const [bulkCsv, setBulkCsv] = useState('');
  const [batchName, setBatchName] = useState('');

  const orgName = profile?.organization?.name || 'Accredited Academic Authority';
  const orgId = profile?.organizationId || `org_${user?.uid || 'inst'}`;
  const orgType = profile?.organization?.type || 'institution';

  const issuerProfile: CredentialIssuerProfile = {
    orgId,
    orgName,
    orgType,
    officialEmailDomain: orgName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.edu',
    accreditationDetails: 'Accredited Institutional Verifier Member',
    issuerAdminUid: user?.uid || 'admin_uid',
    issuerAdminName: profile?.displayName || 'Academic Registrar',
    issuerAdminTitle: 'Dean / Academic Director',
    isVerifiedIssuer: true,
    website: profile?.organization?.website || 'https://institution.edu',
  };

  const handleAddSkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') return;
    if (e.type === 'keydown') e.preventDefault();

    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSingleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !recipientEmail.trim() || !recipientName.trim()) {
      addToast('Please fill in the title, recipient name, and recipient email.', 'error');
      return;
    }

    setIssuing(true);
    try {
      const input: CredentialIssuanceInput = {
        title: title.trim(),
        credentialType,
        description: description.trim() || `Issued by ${orgName} upon satisfactory completion of verification criteria.`,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim().toLowerCase(),
        skills,
        criteria: criteria.trim() || 'Verified completion of theoretical assessment, milestone deliveries, and practical examination.',
        achievementGrade: achievementGrade.trim() || undefined,
        expiresAt: expiresAt || undefined,
        evidenceUrl: evidenceUrl.trim() || undefined,
      };

      const cred = await issueVerifiableCredential(issuerProfile, input);
      addToast(`Verifiable Credential successfully minted for ${recipientName}!`, 'success');
      navigate(`/verify/credential/${cred.id}`);
    } catch (err: any) {
      console.error('Issuance error:', err);
      addToast(err.message || 'Failed to mint credential.', 'error');
    } finally {
      setIssuing(false);
    }
  };

  const handleBulkIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkCsv.trim()) {
      addToast('Please paste CSV lines with recipient data.', 'error');
      return;
    }

    setIssuing(true);
    try {
      // Parse CSV: Name, Email, Grade (optional), Skills (optional, comma-separated in quotes)
      const lines = bulkCsv.split('\n').filter((l) => l.trim().length > 0);
      const inputs: CredentialIssuanceInput[] = [];

      for (const line of lines) {
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length >= 2) {
          const [name, email, grade, ...skillParts] = parts;
          inputs.push({
            title: title.trim() || 'Verifiable Certificate of Competency',
            credentialType,
            description: description.trim() || `Issued to cohort member by ${orgName}.`,
            recipientName: name,
            recipientEmail: email,
            skills: skillParts.length > 0 ? skillParts : skills,
            criteria: criteria.trim() || 'Accredited institutional course completion.',
            achievementGrade: grade || undefined,
          });
        }
      }

      if (inputs.length === 0) {
        throw new Error('No valid CSV rows parsed. Format: Recipient Name, recipient@email.com, Grade');
      }

      const res = await bulkIssueVerifiableCredentials(issuerProfile, inputs, batchName);
      addToast(`Cohort batch minted! ${res.totalIssued} credentials cryptographically signed.`, 'success');
      navigate('/institution/credentials');
    } catch (err: any) {
      console.error('Bulk issuance error:', err);
      addToast(err.message || 'Failed to process bulk cohort issuance.', 'error');
    } finally {
      setIssuing(false);
    }
  };

  const trustImpact = calculateCredentialTrustImpact(credentialType);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
              Phase 9B
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Institutional Credential Issuance Studio
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Issue cryptographically signed diplomas, course certificates, and skill attestations directly to student or talent Trust Passports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/institution/credentials"
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
          >
            Manage Issued Records
          </Link>
        </div>
      </div>

      {/* Mode Switcher: Single vs Cohort Bulk */}
      <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl w-fit border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setMode('single')}
          id="mode-single-btn"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            mode === 'single'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Single Recipient Issuance
        </button>
        <button
          onClick={() => setMode('bulk')}
          id="mode-bulk-btn"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            mode === 'bulk'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Cohort CSV Batch Issuance
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-500" />
              <span>Credential Metadata & Recipient Information</span>
            </h2>

            {mode === 'single' ? (
              <form onSubmit={handleSingleIssue} className="space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Credential / Degree Title *
                  </label>
                  <input
                    type="text"
                    id="cred-title-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Master of Computer Science or Full-Stack Engineering Certification"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    required
                  />
                </div>

                {/* Type & Grade Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Credential Type
                    </label>
                    <select
                      id="cred-type-select"
                      value={credentialType}
                      onChange={(e) => setCredentialType(e.target.value as VerifiableCredentialType)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="course_certificate">Course Certificate</option>
                      <option value="degree">Academic Degree / Diploma</option>
                      <option value="enterprise_accreditation">Enterprise Accreditation</option>
                      <option value="skill_badge">Competency Skill Badge</option>
                      <option value="license">Professional License</option>
                      <option value="assessment">Technical Assessment</option>
                      <option value="award">Honors & Award</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Honors / Grade (Optional)
                    </label>
                    <input
                      type="text"
                      id="cred-grade-input"
                      value={achievementGrade}
                      onChange={(e) => setAchievementGrade(e.target.value)}
                      placeholder="e.g. Distinction, 96/100, Top 5%"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Recipient Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Recipient Full Name *
                    </label>
                    <input
                      type="text"
                      id="cred-recipient-name-input"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Maya Lin"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Recipient Email *
                    </label>
                    <input
                      type="email"
                      id="cred-recipient-email-input"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="e.g. maya@example.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Credential Scope & Curriculum Summary
                  </label>
                  <textarea
                    id="cred-desc-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Describe the learning objectives, course modules, or engineering standards verified."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Skills Multi-Tag */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Verified Competencies & Skills
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={handleAddSkill}
                      placeholder="Type skill & press Enter (e.g. Rust, Solidity)"
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900"
                      >
                        <span>{skill}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="hover:text-rose-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Criteria & Evidence */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Verification Criteria
                    </label>
                    <input
                      type="text"
                      id="cred-criteria-input"
                      value={criteria}
                      onChange={(e) => setCriteria(e.target.value)}
                      placeholder="e.g. Passed final capstone review with 90%+ score"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Evidence / Syllabus URL (Optional)
                    </label>
                    <input
                      type="url"
                      id="cred-evidence-input"
                      value={evidenceUrl}
                      onChange={(e) => setEvidenceUrl(e.target.value)}
                      placeholder="https://institution.edu/programs/cs101"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    id="mint-credential-btn"
                    disabled={issuing}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-colors disabled:opacity-60"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{issuing ? 'Minting Cryptographic Attestation...' : 'Mint & Dispatch Verifiable Credential'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Bulk Cohort CSV Form */
              <form onSubmit={handleBulkIssue} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Cohort Batch Name *
                  </label>
                  <input
                    type="text"
                    id="bulk-batch-name-input"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="e.g. Spring 2026 Distributed Systems Cohort"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Cohort Credential Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Applied Web3 Architecture Certificate"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Credential Type
                    </label>
                    <select
                      value={credentialType}
                      onChange={(e) => setCredentialType(e.target.value as VerifiableCredentialType)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                    >
                      <option value="course_certificate">Course Certificate</option>
                      <option value="degree">Academic Degree / Diploma</option>
                      <option value="enterprise_accreditation">Enterprise Accreditation</option>
                      <option value="skill_badge">Skill Badge</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Paste CSV Data (Format: Full Name, email@example.com, Grade)
                  </label>
                  <textarea
                    id="bulk-csv-textarea"
                    value={bulkCsv}
                    onChange={(e) => setBulkCsv(e.target.value)}
                    rows={6}
                    placeholder={"Alice Smith, alice@example.com, Distinction\nBob Jones, bob@example.com, Grade A\nCarol Danvers, carol@example.com, Top 5%"}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Each row will be independently signed with a canonical SHA-256 payload digest.
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                  <button
                    type="submit"
                    id="mint-batch-btn"
                    disabled={issuing}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-colors disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{issuing ? 'Minting Batch...' : 'Mint Cohort Batch'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Live Credential Certificate Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Live Cryptographic Attestation Preview
            </h3>

            {/* Certificate Preview Card */}
            <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md relative overflow-hidden space-y-6">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 to-sky-500" />

              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold text-sm">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {orgName}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {issuerProfile.accreditationDetails}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase">
                  {credentialType.replace('_', ' ')}
                </span>
              </div>

              <div className="text-center space-y-2 py-1">
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                  Verifiable Attestation Conferred To
                </p>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {recipientName || 'Recipient Full Name'}
                </h3>
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                  {title || 'Credential Title'}
                </p>
                {achievementGrade && (
                  <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                    Honors: {achievementGrade}
                  </span>
                )}
              </div>

              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl text-[11px] border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between text-slate-500">
                  <span>Trust Passport Boost:</span>
                  <strong className="text-emerald-600 font-bold">+{trustImpact} Pts</strong>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Protocol Standard:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono">W3C VC 1.1 / GigLink</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Canonical Digest:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono text-[9px] truncate max-w-[140px]">
                    sha256_canonical_live
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <span>Signatory: {issuerProfile.issuerAdminName}</span>
                <span>Status: Mint on Demand</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
