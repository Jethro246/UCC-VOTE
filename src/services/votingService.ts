import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../lib/firebase';
import {
  BallotSelectionMap,
  Candidate,
  Election,
  Position,
  StudentProfile,
  VoteConfirmationReceipt,
  VoterEligibilityRecord,
} from '../types';
import { evaluateStudentEligibilityLocal } from './electionClient';
import { convertTimestamp } from './firebaseDbService';

function mapDoc<T>(id: string, data: Record<string, any>): T {
  const out: Record<string, any> = { id };
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v?.toDate === 'function' ? convertTimestamp(v) : v;
  }
  return out as T;
}

class FirebaseVotingService {
  async getBallot(electionId: string) {
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        httpStatus: 401,
        error: 'Authentication required. Please sign in to open an election ballot.',
      };
    }

    try {
      const [eSnap, pSnap, cSnap, sSnap, eligSnap, authSnap, confSnap] = await Promise.all([
        getDoc(doc(db, 'elections', electionId)),
        getDocs(query(collection(db, 'positions'), where('electionId', '==', electionId))),
        getDocs(
          query(
            collection(db, 'candidates'),
            where('electionId', '==', electionId),
            where('applicationStatus', '==', 'Approved')
          )
        ),
        getDoc(doc(db, 'students', user.uid)),
        getDoc(doc(db, 'voter_eligibility', user.uid)).catch(() => null),
        getDoc(doc(db, 'voter_authorisations', `${electionId}_${user.uid}`)).catch(() => null),
        getDoc(doc(db, 'vote_confirmations', `${electionId}_${user.uid}`)).catch(() => null),
      ]);

      if (!eSnap.exists()) {
        return { success: false, httpStatus: 404, error: 'Election not found in Firestore.' };
      }

      const election = mapDoc<Election>(eSnap.id, eSnap.data());
      const positionsList = pSnap.docs
        .map((d) => mapDoc<Position>(d.id, d.data()))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const approvedCandidates = cSnap.docs.map((d) => mapDoc<Candidate>(d.id, d.data()));

      const positions = positionsList.map((pos) => ({
        position: pos,
        candidates: approvedCandidates.filter((c) => c.positionId === pos.id),
      }));

      if (authSnap?.exists() || confSnap?.exists()) {
        const receipt = confSnap?.exists()
          ? mapDoc<VoteConfirmationReceipt>(confSnap.id, confSnap.data())
          : undefined;
        return {
          success: false,
          httpStatus: 409,
          alreadyVoted: true,
          election,
          positions,
          receipt,
          error: 'You have already cast your ballot in this election.',
        };
      }

      if (!sSnap.exists()) {
        return {
          success: false,
          httpStatus: 403,
          election,
          error: 'Student voter profile not found. Complete your account activation first.',
        };
      }

      const student = mapDoc<StudentProfile>(sSnap.id, sSnap.data());
      const eligRecord = eligSnap?.exists()
        ? mapDoc<VoterEligibilityRecord>(eligSnap.id, eligSnap.data())
        : null;

      const eligibility = evaluateStudentEligibilityLocal(student, election, eligRecord);
      if (!eligibility.isEligible) {
        return {
          success: false,
          httpStatus: 403,
          election,
          eligibility,
          error: eligibility.reason || 'You are not eligible to vote in this election.',
        };
      }

      if (election.status !== 'live') {
        return {
          success: false,
          httpStatus: 403,
          election,
          eligibility,
          opensAt: `${election.startDate} ${election.startTime || '08:00'}`,
          closesAt: `${election.endDate} ${election.endTime || '17:00'}`,
          error: `Voting is not currently open (Election status: ${election.status.replace(/_/g, ' ')}).`,
        };
      }

      return {
        success: true,
        httpStatus: 200,
        election,
        eligibility,
        positions,
        alreadyVoted: false,
      };
    } catch (err: any) {
      return {
        success: false,
        httpStatus: 500,
        error: err?.message || 'Unable to load digital ballot from Firestore.',
      };
    }
  }

  async submitBallot(
    electionId: string,
    selections: BallotSelectionMap,
    idempotencyKey?: string
  ) {
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        httpStatus: 401,
        error: 'Authentication required to submit your ballot.',
      };
    }

    try {
      const submitFn = httpsCallable(functions, 'submitBallot');
      const response = await submitFn({
        electionId,
        selections,
        idempotencyKey: idempotencyKey || `${electionId}_${user.uid}_${Date.now()}`,
      });
      const data = response.data as any;
      if (!data?.success) {
        return {
          success: false,
          httpStatus: 400,
          error: data?.error || 'Ballot submission was rejected by the voting server.',
        };
      }

      return {
        success: true,
        httpStatus: 200,
        message: data.message || 'Your ballot has been verified and recorded.',
        receipt: data.receipt as VoteConfirmationReceipt,
        updatedTurnout: data.updatedTurnout,
      };
    } catch (err: any) {
      const code = err?.code || '';
      const message = err?.message || 'Unable to submit ballot.';
      if (code === 'functions/already-exists') {
        return {
          success: false,
          httpStatus: 409,
          code: 'ALREADY_VOTED',
          error: 'Duplicate vote prevented: You have already voted in this election.',
        };
      }
      if (code === 'functions/permission-denied' || code === 'functions/failed-precondition') {
        return {
          success: false,
          httpStatus: 403,
          error: message,
        };
      }
      if (
        code === 'functions/unavailable' ||
        code === 'functions/not-found' ||
        code === 'functions/internal'
      ) {
        return {
          success: false,
          httpStatus: 503,
          code: 'CLOUD_FUNCTION_UNAVAILABLE',
          error:
            'Server-side ballot processing (Cloud Function submitBallot) is not yet deployed or reachable on ucc-vote. Deploy functions/ to enable secure server-side ballot casting.',
        };
      }
      return {
        success: false,
        httpStatus: 500,
        error: message,
      };
    }
  }

  async getVoteConfirmation(electionId: string) {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Authentication required.' };
    try {
      const snap = await getDoc(doc(db, 'vote_confirmations', `${electionId}_${user.uid}`));
      if (!snap.exists()) {
        return { success: false, error: 'No vote confirmation found for this election.' };
      }
      return {
        success: true,
        receipt: mapDoc<VoteConfirmationReceipt>(snap.id, snap.data()),
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to load confirmation.' };
    }
  }

  async getMyConfirmations() {
    const user = auth.currentUser;
    if (!user) return { success: true, receipts: [] };
    try {
      const snap = await getDocs(
        query(collection(db, 'vote_confirmations'), where('uid', '==', user.uid))
      );
      const receipts = snap.docs
        .map((d) => mapDoc<VoteConfirmationReceipt>(d.id, d.data()))
        .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      return { success: true, receipts };
    } catch (err: any) {
      return { success: false, receipts: [], error: err?.message };
    }
  }
}

export const votingService = new FirebaseVotingService();
