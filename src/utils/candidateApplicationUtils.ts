import {
  Candidate,
  Election,
  HallUnit,
  Position,
} from '../types';
import { categoryToDomainId } from '../data/uccStructure';
import {
  findMatchingHallUnit,
  getHallDisplayName,
  matchesHallAffiliation,
  resolveElectionHallUnit,
} from './hallUtils';
import {
  evaluateElectionCandidateActionAllowed,
  normalizeStudentId,
} from './contestantUtils';
import { OperationType } from '../lib/firebase';

export type CandidateFieldKey =
  | 'fullName'
  | 'studentId'
  | 'email'
  | 'faculty'
  | 'department'
  | 'programme'
  | 'level'
  | 'hall'
  | 'selectedElectionId'
  | 'selectedPositionId'
  | 'photoUrl'
  | 'electionPhotoUrl'
  | 'videoUrl'
  | 'manifestoSummary'
  | 'fullManifestoText'
  | 'confirmPermanentSync';

export type CandidateFieldErrors = Partial<Record<CandidateFieldKey, string>>;

export interface CandidateFormValues {
  fullName: string;
  studentId: string;
  nickname?: string;
  email: string;
  faculty: string;
  department: string;
  programme: string;
  level: string;
  hall: string;
  selectedElectionId: string;
  selectedPositionId: string;
  photoUrl: string;
  electionPhotoUrl?: string;
  photoStoragePath?: string;
  biography: string;
  campaignStatement?: string;
  manifestoSummary: string;
  fullManifestoText: string;
  keyPromisesText: string;
  leadershipExpText: string;
  videoUrl?: string;
  confirmPermanentSync?: boolean;
  historicalRole?: '' | 'Winner' | 'Contestant' | 'Elected' | 'Elected Unopposed';
  historicalOutcomeNote?: string;
}

export interface ValidateCandidateFormOptions {
  isDraft: boolean;
  uploadingPhoto: boolean;
  candidateToEdit?: Candidate | null;
  elections: Election[];
  availablePositions: Position[];
  halls: HallUnit[];
  contestants?: { fullName: string; studentId: string }[];
  isAdmin?: boolean;
}

export interface CandidateValidationResult {
  valid: boolean;
  fieldErrors: CandidateFieldErrors;
  errorMessage?: string;
  firstErrorField?: CandidateFieldKey;
}

const UNVERIFIED_VALUES = new Set(['', 'not verified', 'unverified', 'unknown', 'none', 'n/a', '-']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isUnverifiedOrEmpty(value?: string | null): boolean {
  return UNVERIFIED_VALUES.has(String(value || '').trim().toLowerCase());
}

export function generateCandidateDocId(): string {
  return `cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function validateCandidateApplicationForm(
  values: CandidateFormValues,
  options: ValidateCandidateFormOptions
): CandidateValidationResult {
  const {
    isDraft,
    uploadingPhoto,
    candidateToEdit,
    elections,
    availablePositions,
    halls,
    contestants = [],
    isAdmin = false,
  } = options;

  if (uploadingPhoto) {
    return {
      valid: false,
      fieldErrors: { photoUrl: 'Photograph upload is still in progress.' },
      errorMessage:
        'Photograph upload is still in progress. Please wait until it finishes or cancel the upload before submitting.',
      firstErrorField: 'photoUrl',
    };
  }

  const fieldErrors: CandidateFieldErrors = {};

  if (!values.fullName.trim() || values.fullName.trim().length < 2) {
    fieldErrors.fullName = 'Full name is required.';
  }

  if (!normalizeStudentId(values.studentId)) {
    fieldErrors.studentId = 'A valid UCC Student ID is required (e.g. ED/EPS/21/0034).';
  }

  if (!values.selectedElectionId.trim()) {
    fieldErrors.selectedElectionId = 'Please select a target election.';
  }

  if (!values.selectedPositionId.trim()) {
    fieldErrors.selectedPositionId =
      availablePositions.length === 0
        ? 'No positions are configured for the selected election.'
        : 'Please select the position being contested.';
  } else if (
    availablePositions.length > 0 &&
    !availablePositions.some((p) => p.id === values.selectedPositionId)
  ) {
    fieldErrors.selectedPositionId = 'Selected position does not belong to this election.';
  }

  const isHistoricalEdit = Boolean(candidateToEdit?.isHistoricalRecord);

  // Additional required profile & manifesto fields for official submission
  if (!isDraft) {
    const cleanEmail = values.email.trim();
    if (!cleanEmail) {
      fieldErrors.email = 'University email address is required.';
    } else if (!EMAIL_REGEX.test(cleanEmail)) {
      fieldErrors.email = 'Enter a valid university email address (e.g. name@st.ucc.edu.gh).';
    }

    if (isUnverifiedOrEmpty(values.faculty)) {
      fieldErrors.faculty = 'Please select your Faculty or School.';
    }
    if (isUnverifiedOrEmpty(values.department)) {
      fieldErrors.department = 'Academic department is required.';
    }
    if (isUnverifiedOrEmpty(values.programme)) {
      fieldErrors.programme = 'Programme of study is required.';
    }
    if (isUnverifiedOrEmpty(values.level)) {
      fieldErrors.level = 'Please select your academic level.';
    }
    if (isUnverifiedOrEmpty(values.hall)) {
      fieldErrors.hall = 'Please select your hall of residence (or Non-Resident / Diaspora).';
    }

    if (!isHistoricalEdit) {
      if (!values.manifestoSummary.trim()) {
        fieldErrors.manifestoSummary = 'Manifesto elevator summary is required for submission.';
      }
      const manifestoLines = values.fullManifestoText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (manifestoLines.length === 0) {
        fieldErrors.fullManifestoText = 'Provide at least one manifesto pillar or policy proposal.';
      }
    }
  } else if (values.email.trim() && !EMAIL_REGEX.test(values.email.trim())) {
    fieldErrors.email = 'Enter a valid email address.';
  }

  // Optional media URL validation
  const cleanPhotoUrl = values.photoUrl.trim();
  if (cleanPhotoUrl.startsWith('blob:')) {
    fieldErrors.photoUrl =
      'Photograph upload did not finish. Please retry uploading or paste a valid https:// image URL.';
  } else if (cleanPhotoUrl && !isValidHttpUrl(cleanPhotoUrl)) {
    fieldErrors.photoUrl = 'Candidate photo URL must start with https:// or http://.';
  }

  const cleanElectionPhotoUrl = (values.electionPhotoUrl || '').trim();
  if (cleanElectionPhotoUrl && !isValidHttpUrl(cleanElectionPhotoUrl)) {
    fieldErrors.electionPhotoUrl = 'Election photo URL must start with https:// or http://.';
  }

  const cleanVideoUrl = (values.videoUrl || '').trim();
  if (cleanVideoUrl && !isValidHttpUrl(cleanVideoUrl)) {
    fieldErrors.videoUrl = 'Campaign video URL must start with https:// or http://.';
  }

  const selectedElection = elections.find((e) => e.id === values.selectedElectionId);
  const electionDomainId = selectedElection
    ? selectedElection.domainId || categoryToDomainId(selectedElection.category)
    : undefined;
  const electionHallUnit = selectedElection
    ? resolveElectionHallUnit(selectedElection, halls)
    : undefined;

  if (
    !isDraft &&
    !fieldErrors.hall &&
    selectedElection &&
    (electionDomainId === 'jcrc_hall' || selectedElection.category === 'JCR / Hall') &&
    electionHallUnit &&
    !matchesHallAffiliation(values.hall, electionHallUnit.name, electionHallUnit)
  ) {
    fieldErrors.hall = `This hall election is restricted to ${getHallDisplayName(electionHallUnit)}. Candidate hall affiliation ("${values.hall || 'None'}") must match ${electionHallUnit.name}.`;
  }

  if (!candidateToEdit && isAdmin && normalizeStudentId(values.studentId)) {
    const matchedExistingContestant = contestants.find(
      (c) => normalizeStudentId(c.studentId) === normalizeStudentId(values.studentId)
    );
    if (matchedExistingContestant) {
      fieldErrors.studentId = `Student ID ${normalizeStudentId(values.studentId)} already belongs to permanent contestant "${matchedExistingContestant.fullName}". Use "Add Existing Contestant" instead.`;
    }
  }

  const permanentChangedWhenEditing =
    Boolean(candidateToEdit) &&
    (values.fullName.trim() !== (candidateToEdit?.fullName || '').trim() ||
      normalizeStudentId(values.studentId) !== normalizeStudentId(candidateToEdit?.studentId) ||
      values.department.trim() !== (candidateToEdit?.department || '').trim() ||
      values.faculty.trim() !== (candidateToEdit?.faculty || '').trim() ||
      values.programme.trim() !== (candidateToEdit?.programme || '').trim() ||
      values.level !== (candidateToEdit?.level || '') ||
      values.hall !== (candidateToEdit?.hall || ''));

  if (isAdmin && candidateToEdit?.contestantId && permanentChangedWhenEditing && !values.confirmPermanentSync) {
    fieldErrors.confirmPermanentSync =
      'Tick the permanent profile confirmation checkbox below before saving changes to identity fields.';
  }

  if (isAdmin && candidateToEdit && values.selectedPositionId !== candidateToEdit.positionId) {
    const posGuard = evaluateElectionCandidateActionAllowed(
      selectedElection,
      'change_position',
      candidateToEdit
    );
    if (!posGuard.allowed) {
      fieldErrors.selectedPositionId =
        posGuard.reason || 'Position reassignment is blocked for this election.';
    }
  }

  const errorKeys = Object.keys(fieldErrors) as CandidateFieldKey[];
  if (errorKeys.length > 0) {
    const firstKey = errorKeys[0];
    const firstMsg = fieldErrors[firstKey]!;
    return {
      valid: false,
      fieldErrors,
      firstErrorField: firstKey,
      errorMessage:
        errorKeys.length === 1
          ? firstMsg
          : `${firstMsg} (${errorKeys.length - 1} other field${errorKeys.length > 2 ? 's' : ''} also need attention.)`,
    };
  }

  return { valid: true, fieldErrors: {} };
}

export function stripUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean as Partial<T>;
}

export function buildCandidateSubmissionPayload(
  values: CandidateFormValues,
  options: {
    id?: string;
    isDraft: boolean;
    candidateToEdit?: Candidate | null;
    elections: Election[];
    halls: HallUnit[];
  }
): Partial<Candidate> & { isDraft: boolean } {
  const { id, isDraft, candidateToEdit, elections, halls } = options;

  const selectedElection = elections.find((e) => e.id === values.selectedElectionId);
  const electionDomainId = selectedElection
    ? selectedElection.domainId || categoryToDomainId(selectedElection.category)
    : undefined;
  const electionHallUnit = selectedElection
    ? resolveElectionHallUnit(selectedElection, halls)
    : undefined;
  const matchedCandidateHall = findMatchingHallUnit(values.hall, halls);

  const fullManifesto = values.fullManifestoText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const keyPromises = values.keyPromisesText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const leadershipExperience = values.leadershipExpText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const cleanPhotoUrl = values.photoUrl.trim();
  const cleanElectionPhotoUrl = (values.electionPhotoUrl || '').trim();
  const cleanVideoUrl = (values.videoUrl || '').trim();

  const raw: Partial<Candidate> & { isDraft: boolean } = {
    ...(id && !candidateToEdit ? { id } : {}),
    fullName: values.fullName.trim(),
    studentId: values.studentId.trim().toUpperCase(),
    nickname: values.nickname?.trim() || undefined,
    email: values.email.trim(),
    department: values.department.trim(),
    faculty: values.faculty.trim(),
    programme: values.programme.trim(),
    level: values.level,
    hall: values.hall.trim(),
    electionId: values.selectedElectionId,
    positionId: values.selectedPositionId,
    domainId: electionDomainId,
    hallId: electionHallUnit?.id || selectedElection?.hallId || matchedCandidateHall?.id,
    facultyId: selectedElection?.facultyId,
    departmentId: selectedElection?.departmentId,
    photoUrl: cleanPhotoUrl,
    electionPhotoUrl: cleanElectionPhotoUrl || undefined,
    photoStoragePath:
      cleanPhotoUrl && values.photoStoragePath ? values.photoStoragePath : undefined,
    biography: values.biography.trim(),
    campaignStatement: values.campaignStatement?.trim() || undefined,
    manifestoSummary: values.manifestoSummary.trim(),
    fullManifesto,
    keyPromises,
    leadershipExperience,
    videoUrl: cleanVideoUrl || undefined,
    ...(!candidateToEdit
      ? {
          applicationStatus: isDraft ? 'Draft' : 'Submitted',
          eligibilityVerified: false,
        }
      : {}),
    ...(candidateToEdit?.isHistoricalRecord
      ? {
          isHistoricalRecord: true,
          historicalRole: values.historicalRole || undefined,
          historicalOutcomeNote: values.historicalOutcomeNote?.trim() || undefined,
          profileDataStatus:
            values.biography.trim() ||
            values.manifestoSummary.trim() ||
            fullManifesto.length > 0
              ? ('complete' as const)
              : ('incomplete_historical' as const),
        }
      : {}),
    isDraft,
  };

  return stripUndefinedFields(raw) as Partial<Candidate> & { isDraft: boolean };
}

export function formatCandidateSubmissionError(
  error: unknown,
  operationType: OperationType,
  path: string
): string {
  const code = String((error as any)?.code || '').toLowerCase();
  const raw = error instanceof Error ? error.message : String(error || '');
  const lower = raw.toLowerCase();

  if (
    code === 'unauthenticated' ||
    code === 'auth/unauthenticated' ||
    lower.includes('must be signed in')
  ) {
    return 'You must be signed in before submitting your application. Sign in and retry—your form entries are preserved.';
  }

  if (
    code === 'permission-denied' ||
    lower.includes('missing or insufficient permissions') ||
    lower.includes('permission denied')
  ) {
    return `Permission denied (${operationType} ${path}): You do not have permission to write this candidate record. Verify you are signed in with the correct account and retry; your entered data has been preserved.`;
  }

  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'network-request-failed' ||
    lower.includes('offline') ||
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('client is offline')
  ) {
    return 'Network error: Unable to reach Cloud Firestore. Check your internet connection and click Submit Application to retry—your form data has been preserved.';
  }

  return raw || 'Unable to save candidate application. Please review your details and try again.';
}

export async function runGuardedSubmission<T>(
  lockRef: { current: boolean },
  task: () => Promise<T>
): Promise<{ ignored: true } | { ignored: false; result: T }> {
  if (lockRef.current) {
    return { ignored: true };
  }
  lockRef.current = true;
  try {
    const result = await task();
    return { ignored: false, result };
  } finally {
    lockRef.current = false;
  }
}
