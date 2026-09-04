import React, { useState } from 'react';
import { Star, MessageSquare, ShieldCheck, X, AlertCircle } from 'lucide-react';
import { GigLinkContract } from '../../types';
import { submitContractFeedback } from '../../lib/feedbackService';

interface ContractFeedbackModalProps {
  contract: GigLinkContract;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ContractFeedbackModal: React.FC<ContractFeedbackModalProps> = ({
  contract,
  currentUserId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [ratingOverall, setRatingOverall] = useState(5);
  const [ratingCommunication, setRatingCommunication] = useState(5);
  const [ratingQuality, setRatingQuality] = useState(5);
  const [ratingTimeliness, setRatingTimeliness] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isCreator = contract.creatorId === currentUserId;
  const targetRoleName = isCreator ? 'Talent' : 'Client';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim().length < 5) {
      setError('Please provide at least 5 characters of feedback.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await submitContractFeedback({
        contract,
        authorId: currentUserId,
        ratingOverall,
        ratingCommunication,
        ratingQuality,
        ratingTimeliness,
        comment,
        isPublic: true,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStarSelector = (
    label: string,
    value: number,
    setter: (val: number) => void
  ) => (
    <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setter(star)}
            className="p-1 text-amber-400 hover:scale-110 transition-transform focus:outline-none"
          >
            <Star
              className={`w-5 h-5 ${
                star <= value ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 dark:text-zinc-600'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div
      id="feedback-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
    >
      <div
        id="contract-feedback-modal-card"
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Star className="w-5 h-5 fill-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Peer Review & Trust Feedback
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Rate your collaboration on &ldquo;{contract.opportunityTitle || contract.scopeLock?.title || 'Contract'}&rdquo;
              </p>
            </div>
          </div>
          <button
            id="close-feedback-modal-btn"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            {renderStarSelector('Overall Experience', ratingOverall, setRatingOverall)}
            {renderStarSelector('Communication', ratingCommunication, setRatingCommunication)}
            {renderStarSelector('Quality of Work', ratingQuality, setRatingQuality)}
            {renderStarSelector('Timeliness & Milestones', ratingTimeliness, setRatingTimeliness)}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Collaboration Review
            </label>
            <textarea
              id="feedback-comment-textarea"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`Share your experience working with this ${targetRoleName.toLowerCase()}...`}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              required
            />
            <div className="flex justify-between text-xs text-zinc-400 mt-1">
              <span>Publicly verifiable endorsement</span>
              <span>{comment.length} / 1000</span>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              id="cancel-feedback-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-feedback-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSubmitting ? 'Recording Proof...' : 'Publish Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
