import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  ShieldCheck,
  Search,
  Filter,
  Sparkles,
  Award,
  ExternalLink,
  Mail,
  UserCheck,
  Building2,
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

interface VettedTalent {
  id: string;
  name: string;
  title: string;
  trustScore: number;
  skills: string[];
  proofCount: number;
  hourlyRate: string;
  location: string;
  avatarBg: string;
  verifiedIdentity: boolean;
}

export const EnterpriseBenchPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string>('all');

  const talentBench: VettedTalent[] = [
    {
      id: 'bench-1',
      name: 'Elena Rostova',
      title: 'Senior Distributed Systems & Blockchain Engineer',
      trustScore: 94,
      skills: ['Rust', 'Solidity', 'Go', 'Zero-Knowledge', 'TypeScript'],
      proofCount: 8,
      hourlyRate: '$140/hr',
      location: 'London, UK (UTC+0)',
      avatarBg: 'from-amber-500 to-amber-700',
      verifiedIdentity: true,
    },
    {
      id: 'bench-2',
      name: 'Marcus Vance',
      title: 'Lead Full-Stack Architect & AI Systems Specialist',
      trustScore: 88,
      skills: ['React', 'Next.js', 'Python', 'LLM Fine-Tuning', 'FastAPI'],
      proofCount: 6,
      hourlyRate: '$125/hr',
      location: 'San Francisco, USA (PST)',
      avatarBg: 'from-indigo-500 to-indigo-700',
      verifiedIdentity: true,
    },
    {
      id: 'bench-3',
      name: 'Dr. Amina Diallo',
      title: 'Principal Smart Contract Auditor & Cryptographer',
      trustScore: 96,
      skills: ['Solidity', 'Formal Verification', 'Foundry', 'Slither', 'Security'],
      proofCount: 12,
      hourlyRate: '$175/hr',
      location: 'Zurich, Switzerland (CET)',
      avatarBg: 'from-purple-500 to-purple-700',
      verifiedIdentity: true,
    },
    {
      id: 'bench-4',
      name: 'Kenji Takahashi',
      title: 'Staff UI/UX Design System Specialist',
      trustScore: 85,
      skills: ['Figma', 'Design Systems', 'Tailwind CSS', 'React', 'Accessibility'],
      proofCount: 5,
      hourlyRate: '$95/hr',
      location: 'Tokyo, Japan (JST)',
      avatarBg: 'from-sky-500 to-sky-700',
      verifiedIdentity: true,
    },
  ];

  const filteredTalent = talentBench.filter((talent) => {
    const matchesSearch =
      talent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      talent.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      talent.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSkill =
      selectedSkill === 'all' || talent.skills.includes(selectedSkill);

    return matchesSearch && matchesSkill;
  });

  const handleDirectEngage = (talent: VettedTalent) => {
    showSuccess(`Engagement request drafted for ${talent.name}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
              Enterprise Workspace
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              Trust Score 80+ Pre-Vetted
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            Enterprise Talent Bench
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Directly contract elite talent with cryptographic proof-verified histories and identity attestations.
          </p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by skill, name, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['all', 'Rust', 'Solidity', 'React', 'Python', 'Security'].map((skill) => (
            <button
              key={skill}
              onClick={() => setSelectedSkill(skill)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-colors ${
                selectedSkill === skill
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {skill}
            </button>
          ))}
        </div>
      </div>

      {/* Talent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTalent.map((talent) => (
          <div
            key={talent.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${talent.avatarBg} text-white font-black text-sm flex items-center justify-center shadow-md`}>
                    {talent.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{talent.name}</h3>
                      {talent.verifiedIdentity && (
                        <span title="Identity Cryptographically Verified">
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{talent.title}</p>
                    <p className="text-[11px] text-slate-400">{talent.location}</p>
                  </div>
                </div>

                {/* Score Pill */}
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-center border border-purple-200/60 dark:border-purple-800/60">
                  <div className="text-base font-black text-purple-600 dark:text-purple-400">{talent.trustScore}</div>
                  <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Trust Score</div>
                </div>
              </div>

              {/* Skills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {talent.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {talent.hourlyRate} <span className="text-[10px] text-slate-400 font-normal">• {talent.proofCount} Verified Proofs</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDirectEngage(talent)}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Direct Engage</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
