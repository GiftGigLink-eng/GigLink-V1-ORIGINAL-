import React, { useState } from 'react';
import { Award, CheckCircle2, Plus, Trash2, ExternalLink, Calendar, Clock, ShieldCheck } from 'lucide-react';
import { CertificationItem } from '../../types';
import { RequestItemVerificationModal } from './RequestItemVerificationModal';

interface CertificationsSectionProps {
  certifications: CertificationItem[];
  onAddCertification?: () => void;
  onDeleteCertification?: (id: string) => void;
  readOnly?: boolean;
}

export const CertificationsSection: React.FC<CertificationsSectionProps> = ({
  certifications,
  onAddCertification,
  onDeleteCertification,
  readOnly = false,
}) => {
  const [selectedCert, setSelectedCert] = useState<CertificationItem | null>(null);

  return (
    <div
      id="profile-certifications-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Certifications & Professional Credentials
            </h2>
            <span className="text-xs text-slate-400">({certifications.length})</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Industry badges, licenses, and verified certifications.
          </p>
        </div>

        {!readOnly && onAddCertification && (
          <button
            id="add-certification-btn"
            onClick={onAddCertification}
            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Certification</span>
          </button>
        )}
      </div>

      {certifications && certifications.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {certifications.map((item) => (
            <div
              key={item.id}
              className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {item.issuer}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.verificationStatus === 'verified' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full flex items-center gap-1 border border-emerald-200 dark:border-emerald-900">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Verified Credential</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Self-Reported</span>
                        </span>
                        {!readOnly && (
                          <button
                            onClick={() => setSelectedCert(item)}
                            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 p-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded cursor-pointer transition-colors"
                            title="Request attestation for this certification"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {!readOnly && onDeleteCertification && (
                      <button
                        onClick={() => onDeleteCertification(item.id)}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-md transition-colors cursor-pointer"
                        title="Delete certification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Issued: {item.issueDate}</span>
                  {item.expiryDate && <span>• Expires: {item.expiryDate}</span>}
                </div>

                {item.credentialId && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    ID: {item.credentialId}
                  </p>
                )}
              </div>

              {item.credentialUrl && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60">
                  <a
                    href={item.credentialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Verify Credential Certificate</span>
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <Award className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            No Certifications Added
          </p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Attach credential identifiers or certificates issued by recognized institutions.
          </p>
          {!readOnly && onAddCertification && (
            <button
              onClick={onAddCertification}
              className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Add a certificate or license
            </button>
          )}
        </div>
      )}

      {selectedCert && (
        <RequestItemVerificationModal
          isOpen={Boolean(selectedCert)}
          onClose={() => setSelectedCert(null)}
          itemType="certification"
          itemName={selectedCert.title}
          itemId={selectedCert.id}
        />
      )}
    </div>
  );
};
