import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
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
import { getHistoricalElectionById } from '../data/historical2026Elections';

function mapDoc<T>(id: string, data: Record<string, any>): T {
  const out: Record<string, any> = { id };
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v?.toDate === 'function' ? convertTimestamp(v) : v;
  }
  return out as T;
}

class FirebaseVotingService {
  async getBallot(electionId: string) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        success: false,
        httpStatus: 503,
        code: 'OFFLINE_BLOCKED',
        error:
          'An active internet connection is required to verify voter eligibility and load your official ballot. Offline ballot queuing is disabled for electoral security.',
      };
    }

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
        const hist = getHistoricalElectionById(electionId);
        if (hist) {
          return {
            success: false,
            httpStatus: 403,
            election: hist,
            error: `Voting is not permitted for historical archive elections (status: ${hist.status}).`,
          };
        }
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
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        success: false,
        httpStatus: 503,
        code: 'OFFLINE_BLOCKED',
        error:
          'An active internet connection is required to submit your ballot. Offline ballot queuing is disabled for electoral security.',
      };
    }

    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        httpStatus: 401,
        error: 'Authentication required to submit your ballot.',
      };
    }

    try {
      const endpoint = (
        (import.meta.env ? import.meta.env.VITE_SUBMIT_BALLOT_URL : undefined) || ''
      ).trim();
      if (!endpoint) {
        return {
          success: false,
          httpStatus: 503,
          code: 'BALLOT_WORKER_NOT_CONFIGURED',
          error:
            'Ballot submission endpoint (VITE_SUBMIT_BALLOT_URL) is not configured. Deploy workers/submit-ballot and set VITE_SUBMIT_BALLOT_URL to enable ballot casting without Firebase Blaze.',
        };
      }

      const idToken = await user.getIdToken();
      const httpRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          electionId,
          selections,
          idempotencyKey: idempotencyKey || `${electionId}_${user.uid}_${Date.now()}`,
        }),
      });

      let data: any = null;
      try {
        data = await httpRes.json();
      } catch {
        data = null;
      }

      if (!httpRes.ok || !data?.success) {
        const errCode = String(data?.code || '');
        const errMsg = String(
          data?.error || 'Ballot submission was rejected by the voting server.'
        );

        if (httpRes.status === 409 || errCode === 'ALREADY_VOTED') {
          return {
            success: false,
            httpStatus: 409,
            code: errCode === 'CONCURRENT_SUBMISSION_BLOCKED' ? errCode : 'ALREADY_VOTED',
            error:
              errCode === 'CONCURRENT_SUBMISSION_BLOCKED'
                ? errMsg
                : 'Duplicate vote prevented: You have already voted in this election.',
          };
        }
        if (httpRes.status === 401 || httpRes.status === 403 || httpRes.status === 400) {
          return {
            success: false,
            httpStatus: httpRes.status,
            code: errCode || undefined,
            error: errMsg,
          };
        }
        if (httpRes.status === 503 || httpRes.status === 502 || httpRes.status === 504) {
          return {
            success: false,
            httpStatus: 503,
            code: errCode || 'BALLOT_WORKER_UNAVAILABLE',
            error: errMsg,
          };
        }
        return {
          success: false,
          httpStatus: httpRes.status || 500,
          code: errCode || undefined,
          error: errMsg,
        };
      }

      if (!data?.receipt) {
        return {
          success: false,
          httpStatus: 502,
          code: 'INVALID_SERVER_RESPONSE',
          error: 'Voting server did not return an official vote confirmation receipt.',
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
      return {
        success: false,
        httpStatus: 503,
        code: 'NETWORK_ERROR',
        error:
          err?.message && !String(err.message).toLowerCase().includes('failed to fetch')
            ? err.message
            : 'Unable to reach the UCC VOTE ballot submission worker. Check your internet connection and VITE_SUBMIT_BALLOT_URL.',
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
