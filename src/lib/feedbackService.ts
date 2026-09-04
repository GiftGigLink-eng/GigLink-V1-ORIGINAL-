import { ContractFeedback } from '../types/passport';
import { GigLinkContract } from '../types';
import { doc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const inMemoryFeedback = new Map<string, ContractFeedback>();

export interface SubmitFeedbackInput {
  contract: GigLinkContract;
  authorId: string;
  ratingOverall: number;
  ratingCommunication: number;
  ratingQuality: number;
  ratingTimeliness: number;
  comment: string;
  isPublic?: boolean;
}

export async function submitContractFeedback(input: SubmitFeedbackInput): Promise<ContractFeedback> {
  const { contract, authorId, ratingOverall, ratingCommunication, ratingQuality, ratingTimeliness, comment, isPublic = true } = input;

  // 1. Invariant: Contract must exist and be terminal completed
  if (contract.status !== 'completed') {
    throw new Error(`Cannot submit feedback: Contract ${contract.id} is in status '${contract.status}', must be 'completed'.`);
  }

  // 2. Invariant: Author must be a genuine contract party
  const isCreator = contract.creatorId === authorId;
  const isTalent = contract.talentId === authorId;
  if (!isCreator && !isTalent) {
    throw new Error(`Unauthorized: User ${authorId} is not a participant in contract ${contract.id}.`);
  }

  // 3. Derive authoritative role and target user ID
  const authorRole: 'creator' | 'talent' = isCreator ? 'creator' : 'talent';
  const targetUserId: string = isCreator ? contract.talentId : contract.creatorId;

  // 4. Invariant: No self-reviews
  if (authorId === targetUserId) {
    throw new Error(`Invalid feedback: Author and target user cannot be the same.`);
  }

  // 5. Invariant: Rating boundaries (1 to 5 integer)
  const ratings = [ratingOverall, ratingCommunication, ratingQuality, ratingTimeliness];
  for (const r of ratings) {
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      throw new Error(`Invalid rating: All ratings must be integers between 1 and 5.`);
    }
  }

  // 6. Invariant: Comment length
  const trimmedComment = comment.trim();
  if (trimmedComment.length < 5 || trimmedComment.length > 1000) {
    throw new Error(`Invalid comment: Comment must be between 5 and 1000 characters.`);
  }

  // 7. Deterministic Feedback ID (Prevents duplicate reviews / replay attacks)
  const feedbackId = `feedback_${contract.id}_${authorId}`;

  // Check in-memory store
  if (inMemoryFeedback.has(feedbackId)) {
    throw new Error(`Duplicate review: User ${authorId} has already submitted feedback for contract ${contract.id}.`);
  }

  const feedbackRecord: ContractFeedback = {
    id: feedbackId,
    contractId: contract.id,
    authorId,
    authorRole,
    targetUserId,
    ratingOverall,
    ratingCommunication,
    ratingQuality,
    ratingTimeliness,
    comment: trimmedComment,
    isPublic,
    createdAt: new Date().toISOString(),
  };

  inMemoryFeedback.set(feedbackId, feedbackRecord);

  // Persist to Firestore
  try {
    const feedbackRef = doc(db, 'contractFeedback', feedbackId);
    await setDoc(feedbackRef, feedbackRecord);
  } catch (err) {
    console.warn(`[FeedbackService] Notice: Could not write feedback to Firestore, stored in-memory:`, err);
  }

  return feedbackRecord;
}

export async function getReceivedFeedbackForUser(userId: string): Promise<ContractFeedback[]> {
  const results: ContractFeedback[] = [];

  // 1. In-memory
  inMemoryFeedback.forEach((f) => {
    if (f.targetUserId === userId) {
      results.push(f);
    }
  });

  // 2. Firestore query
  try {
    const q = query(collection(db, 'contractFeedback'), where('targetUserId', '==', userId));
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const data = docSnap.data() as ContractFeedback;
      if (!results.some((r) => r.id === data.id)) {
        results.push(data);
        inMemoryFeedback.set(data.id, data);
      }
    });
  } catch (err) {
    console.warn(`[FeedbackService] Query warning:`, err);
  }

  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
