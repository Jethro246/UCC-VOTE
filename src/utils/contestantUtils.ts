import { Candidate, ContestantProfile, Election, Position } from '../types';

export interface ContestantDirectoryEntry extends ContestantProfile {
  sourceType: 'contestants_collection' | 'derived_from_candidates';
  participations: {
    candidateId: string;
    electionId: string;
    electionTitle: string;
    positionId: string;
    positionTitle: string;
    applicationStatus: Candidate['applicationStatus'];
    votesReceived?: number;
  }[];
}

const UNVERIFIED_MARKERS = new Set([
  '',
  'NOT VERIFIED',
  'UNVERIFIED',
  'UNKNOWN',
  'N/A',
  'NA',
  'NONE',
  '-',
]);

export function normalizeStudentId(studentId?: string | null): string {
  const cleaned = String(studentId || '').trim().toUpperCase();
  if (UNVERIFIED_MARKERS.has(cleaned)) return '';
  return cleaned;
}

export function slugifyContestantSegment(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export function buildContestantId(studentId?: string, fullName?: string): string {
  const normId = normalizeStudentId(studentId);
  if (normId) {
    const safeSid = normId.replace(/[^A-Z0-9_-]/g, '_').replace(/_+/g, '_');
    return `cont_sid_${safeSid}`.slice(0, 120);
  }
  const slug = slugifyContestantSegment(fullName || '');
  if (slug) {
    return `cont_name_${slug}`.slice(0, 120);
  }
  return `cont_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function buildAssignmentUniquenessKey(
  electionId: string,
  positionId: string,
  contestantIdOrStudentKey: string
): string {
  const e = electionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36);
  const p = positionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36);
  const c = contestantIdOrStudentKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 44);
  return `${e}__${p}__${c}`.slice(0, 124);
}

export function resolveCandidatePhotoUrl(cand: Partial<Candidate> | null | undefined): string {
  if (!cand) return '';
  return (cand.electionPhotoUrl || cand.photoUrl || '').trim();
}

export function mergeContestantDirectory(
  storedContestants: ContestantProfile[],
  candidates: Candidate[],
  elections: Election[] = [],
  positionsByElection: Record<string, Position[]> = {}
): ContestantDirectoryEntry[] {
  const electionTitleMap = new Map<string, string>();
  elections.forEach((e) => electionTitleMap.set(e.id, e.title));

  const positionTitleMap = new Map<string, string>();
  Object.values(positionsByElection).forEach((list) => {
    list.forEach((p) => positionTitleMap.set(p.id, p.title));
  });

  const directoryMap = new Map<string, ContestantDirectoryEntry>();
  const studentIdIndex = new Map<string, string>();
  const nameFallbackIndex = new Map<string, string>();

  const registerKeys = (entry: ContestantDirectoryEntry) => {
    const normSid = normalizeStudentId(entry.studentId);
    if (normSid) studentIdIndex.set(normSid, entry.id);
    const normName = slugifyContestantSegment(entry.fullName);
    if (normName && !normSid) {
      nameFallbackIndex.set(normName, entry.id);
    }
  };

  // 1. Persisted contestants take authoritative priority
  for (const c of storedContestants) {
    const entry: ContestantDirectoryEntry = {
      ...c,
      studentId: normalizeStudentId(c.studentId) || c.studentId || '',
      leadershipExperience: Array.isArray(c.leadershipExperience) ? c.leadershipExperience : [],
      sourceType: 'contestants_collection',
      participations: [],
    };
    directoryMap.set(entry.id, entry);
    registerKeys(entry);
  }

  // 2. Link participations from candidates and backfill any legacy/historical contestants
  for (const cand of candidates) {
    const normSid = normalizeStudentId(cand.studentId);
    const normName = slugifyContestantSegment(cand.fullName);

    let targetId =
      (cand.contestantId && directoryMap.has(cand.contestantId) ? cand.contestantId : undefined) ||
      (normSid ? studentIdIndex.get(normSid) : undefined) ||
      (!normSid && normName ? nameFallbackIndex.get(normName) : undefined);

    if (!targetId) {
      targetId = cand.contestantId || buildContestantId(cand.studentId, cand.fullName);
      if (!directoryMap.has(targetId)) {
        const derived: ContestantDirectoryEntry = {
          id: targetId,
          fullName: cand.fullName,
          studentId: normSid || cand.studentId || 'Not verified',
          nickname: cand.nickname,
          email: cand.email,
          phone: cand.phone,
          department: cand.department || 'Not verified',
          faculty: cand.faculty || 'Not verified',
          programme: cand.programme || '',
          level: cand.level || 'Not verified',
          hall: cand.hall || 'Not verified',
          photoUrl: cand.photoUrl || cand.electionPhotoUrl || '',
          photoStoragePath: cand.photoStoragePath,
          biography: cand.biography || '',
          leadershipExperience: Array.isArray(cand.leadershipExperience)
            ? cand.leadershipExperience
            : [],
          createdAt: cand.createdAt || cand.submittedAt,
          updatedAt: cand.updatedAt,
          sourceType: 'derived_from_candidates',
          participations: [],
        };
        directoryMap.set(targetId, derived);
        registerKeys(derived);
      }
    }

    const entry = directoryMap.get(targetId);
    if (entry) {
      // Enrich derived entry if persisted fields were blank
      if (entry.sourceType === 'derived_from_candidates') {
        if (!entry.photoUrl && cand.photoUrl) entry.photoUrl = cand.photoUrl;
        if (!entry.biography && cand.biography) entry.biography = cand.biography;
        if (!entry.programme && cand.programme) entry.programme = cand.programme;
        if (entry.department === 'Not verified' && cand.department && cand.department !== 'Not verified') {
          entry.department = cand.department;
        }
        if (entry.faculty === 'Not verified' && cand.faculty && cand.faculty !== 'Not verified') {
          entry.faculty = cand.faculty;
        }
        if (entry.hall === 'Not verified' && cand.hall && cand.hall !== 'Not verified') {
          entry.hall = cand.hall;
        }
        if (entry.leadershipExperience.length === 0 && cand.leadershipExperience?.length) {
          entry.leadershipExperience = cand.leadershipExperience;
        }
      }

      if (
        !entry.participations.some(
          (p) => p.candidateId === cand.id || (p.electionId === cand.electionId && p.positionId === cand.positionId)
        )
      ) {
        entry.participations.push({
          candidateId: cand.id,
          electionId: cand.electionId,
          electionTitle: electionTitleMap.get(cand.electionId) || cand.electionId,
          positionId: cand.positionId,
          positionTitle: positionTitleMap.get(cand.positionId) || cand.positionId,
          applicationStatus: cand.applicationStatus,
          votesReceived: cand.votesReceived,
        });
      }
    }
  }

  return Array.from(directoryMap.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName)
  );
}

export function searchContestants(
  contestants: ContestantDirectoryEntry[],
  searchTerm: string
): ContestantDirectoryEntry[] {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return contestants;
  return contestants.filter((c) => {
    const fields = [
      c.fullName,
      c.nickname,
      c.studentId,
      c.department,
      c.programme,
      c.faculty,
      c.hall,
      c.email,
      c.phone,
      c.level,
      ...(c.participations || []).flatMap((p) => [p.electionTitle, p.positionTitle]),
    ];
    return fields.some((f) => String(f || '').toLowerCase().includes(q));
  });
}

export function findDuplicateAssignment(
  existingCandidates: Candidate[],
  params: {
    electionId: string;
    positionId: string;
    contestantId?: string;
    studentId?: string;
    ignoreCandidateId?: string;
  }
): Candidate | null {
  const normSid = normalizeStudentId(params.studentId);
  return (
    existingCandidates.find((c) => {
      if (params.ignoreCandidateId && c.id === params.ignoreCandidateId) return false;
      if (c.electionId !== params.electionId || c.positionId !== params.positionId) return false;
      if (params.contestantId && c.contestantId && c.contestantId === params.contestantId) {
        return true;
      }
      const existingNormSid = normalizeStudentId(c.studentId);
      if (normSid && existingNormSid && normSid === existingNormSid) {
        return true;
      }
      return false;
    }) || null
  );
}

export function evaluateElectionCandidateActionAllowed(
  election: Election | null | undefined,
  action: 'add' | 'edit_info' | 'change_position' | 'remove',
  candidate?: Candidate | null
): { allowed: boolean; warning?: string; reason?: string } {
  if (!election) {
    return { allowed: true };
  }

  const lockedStatuses: Election['status'][] = [
    'closed',
    'results_pending_certification',
    'results_published',
    'archived',
  ];

  if (lockedStatuses.includes(election.status)) {
    if (action === 'edit_info') {
      return {
        allowed: true,
        warning: `Election is ${election.status.replace(/_/g, ' ')}. Descriptive text updates are audited and never alter vote counts.`,
      };
    }
    return {
      allowed: false,
      reason: `Cannot ${action === 'add' ? 'add candidates' : action === 'change_position' ? 'change positions' : 'remove candidates'} because this election is "${election.status.replace(/_/g, ' ')}". Historical and tallied election records are protected.`,
    };
  }

  const candidateVotes = Number(candidate?.votesReceived || 0);
  if (candidateVotes > 0 && (action === 'change_position' || action === 'remove')) {
    return {
      allowed: false,
      reason: `This candidate already has ${candidateVotes} recorded vote(s). Reassigning position or removing the candidate is blocked to protect vote integrity.`,
    };
  }

  if (election.status === 'live') {
    if (action === 'change_position' || action === 'remove') {
      return {
        allowed: true,
        warning:
          'Election voting is currently LIVE. Only perform this change if zero votes have been cast for this candidate.',
      };
    }
    return {
      allowed: true,
      warning: 'Election voting is currently LIVE. Updates take effect on ballots immediately and are recorded in the audit log.',
    };
  }

  return { allowed: true };
}
