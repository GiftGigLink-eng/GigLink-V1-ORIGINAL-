import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Layers,
  Sparkles,
  X,
  Target,
} from 'lucide-react';
import { PartnerServiceOffering } from '../../types';

interface ServicesSectionProps {
  services?: PartnerServiceOffering[];
  isEditable?: boolean;
  onSaveServices?: (services: PartnerServiceOffering[]) => Promise<void>;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({
  services = [],
  isEditable = false,
  onSaveServices,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Full-Stack Development');
  const [deliveryType, setDeliveryType] = useState<PartnerServiceOffering['deliveryType']>('fixed_milestone');
  const [deliverablesInput, setDeliverablesInput] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [saving, setSaving] = useState(false);

  const openAddModal = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setCategory('Full-Stack Development');
    setDeliveryType('fixed_milestone');
    setDeliverablesInput('');
    setSkillsInput('');
    setModalOpen(true);
  };

  const openEditModal = (svc: PartnerServiceOffering) => {
    setEditingId(svc.id);
    setTitle(svc.title);
    setDescription(svc.description);
    setCategory(svc.category);
    setDeliveryType(svc.deliveryType || 'fixed_milestone');
    setDeliverablesInput((svc.targetDeliverables || []).join(', '));
    setSkillsInput((svc.skillsOffered || []).join(', '));
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!onSaveServices) return;
    const next = services.filter((s) => s.id !== id);
    await onSaveServices(next);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveServices || !title.trim()) return;

    setSaving(true);
    try {
      const parsedDeliverables = deliverablesInput
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      const parsedSkills = skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      let nextServices: PartnerServiceOffering[];

      if (editingId) {
        nextServices = services.map((s) =>
          s.id === editingId
            ? {
                ...s,
                title: title.trim(),
                description: description.trim(),
                category,
                deliveryType,
                targetDeliverables: parsedDeliverables,
                skillsOffered: parsedSkills,
              }
            : s
        );
      } else {
        const newOffering: PartnerServiceOffering = {
          id: `svc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: title.trim(),
          description: description.trim(),
          category,
          deliveryType,
          targetDeliverables: parsedDeliverables,
          skillsOffered: parsedSkills,
          isActive: true,
        };
        nextServices = [...services, newOffering];
      }

      await onSaveServices(nextServices);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const getDeliveryTypeBadge = (dt?: PartnerServiceOffering['deliveryType']) => {
    switch (dt) {
      case 'turnkey_project':
        return 'Turnkey Delivery';
      case 'hourly_retainer':
        return 'Advisory / Retainer';
      case 'advisory':
        return 'Strategic Advisory';
      case 'fixed_milestone':
      default:
        return 'Milestone-Based';
    }
  };

  return (
    <div
      id="partner-services-offering-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Partner Services & Offerings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Structured scopes and delivery capabilities offered to clients
            </p>
          </div>
        </div>

        {isEditable && onSaveServices && (
          <button
            id="add-service-offering-btn"
            onClick={openAddModal}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Service</span>
          </button>
        )}
      </div>

      {/* Services Grid */}
      {services.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <Layers className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            No partner services listed yet
          </p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
            Define structured service scopes with deliverable commitments for client engagements.
          </p>
          {isEditable && onSaveServices && (
            <button
              onClick={openAddModal}
              className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-xl border border-purple-200 dark:border-purple-800"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Service Offering</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {services.map((svc) => (
            <div
              key={svc.id}
              className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 inline-block mb-1">
                      {getDeliveryTypeBadge(svc.deliveryType)}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {svc.title}
                    </h3>
                  </div>

                  {isEditable && onSaveServices && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(svc)}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors"
                        title="Edit Service"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(svc.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md transition-colors"
                        title="Delete Service"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {svc.description}
                </p>

                {/* Deliverables */}
                {svc.targetDeliverables && svc.targetDeliverables.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Target Deliverables
                    </span>
                    <ul className="space-y-1">
                      {svc.targetDeliverables.map((deliv, idx) => (
                        <li key={idx} className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>{deliv}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Skills Tags */}
              {svc.skillsOffered && svc.skillsOffered.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                  {svc.skillsOffered.map((sk, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingId ? 'Edit Service Offering' : 'Add Partner Service'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Service Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Smart Contract Security Audit & Hardening"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="Full-Stack Development">Full-Stack Development</option>
                    <option value="AI & Machine Learning">AI & Machine Learning</option>
                    <option value="Blockchain & Cryptography">Blockchain & Cryptography</option>
                    <option value="Product Design & UI/UX">Product Design & UI/UX</option>
                    <option value="Cloud Architecture">Cloud Architecture</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Delivery Scope
                  </label>
                  <select
                    value={deliveryType}
                    onChange={(e) => setDeliveryType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="fixed_milestone">Fixed Milestone Scope</option>
                    <option value="turnkey_project">Turnkey End-to-End Project</option>
                    <option value="hourly_retainer">Advisory / Retainer</option>
                    <option value="advisory">Strategic Advisory</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Outline the scope, technical approach, and what clients receive."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Deliverables (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Audit Report, Automated Test Suite, Remediation PR"
                  value={deliverablesInput}
                  onChange={(e) => setDeliverablesInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Technologies / Skills Used (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Solidity, Hardhat, Slither, Rust"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Service' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
