import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, formatFirestorePermissionError, OperationType } from '../lib/firebase';
import { AdminProfile, StudentProfile } from '../types';

export const PENDING_EMAIL_KEY = 'ucc_vote_pending_email';
export const PENDING_ACTIVATION_KEY = 'ucc_vote_pending_activation';
export const AUTH_INTENT_KEY = 'ucc_vote_auth_intent';

export interface PendingActivationDraft {
  studentId: string;
  indexNumber: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  faculty: string;
  programme: string;
  level: '100' | '200' | '300' | '400' | 'Postgraduate';
  hall: string;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function requireOnline(actionLabel: string): string | null {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return `An active internet connection is required for ${actionLabel}. Please reconnect and try again.`;
  }
  return null;
}

function savePendingAuthState(
  email: string,
  intent: 'activate' | 'login',
  draft?: PendingActivationDraft
) {
  const cleanEmail = email.trim().toLowerCase();
  try {
    window.localStorage.setItem(PENDING_EMAIL_KEY, cleanEmail);
    window.sessionStorage.setItem(PENDING_EMAIL_KEY, cleanEmail);
    window.localStorage.setItem(AUTH_INTENT_KEY, intent);
    if (draft) {
      const serialized = JSON.stringify({ ...draft, email: cleanEmail });
      window.localStorage.setItem(PENDING_ACTIVATION_KEY, serialized);
      window.sessionStorage.setItem(PENDING_ACTIVATION_KEY, serialized);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function getPendingEmail(): string | null {
  try {
    return (
      window.sessionStorage.getItem(PENDING_EMAIL_KEY) ||
      window.localStorage.getItem(PENDING_EMAIL_KEY)
    );
  } catch {
    return null;
  }
}

export function getPendingActivationDraft(): PendingActivationDraft | null {
  try {
    const raw =
      window.sessionStorage.getItem(PENDING_ACTIVATION_KEY) ||
      window.localStorage.getItem(PENDING_ACTIVATION_KEY);
    return raw ? (JSON.parse(raw) as PendingActivationDraft) : null;
  } catch {
    return null;
  }
}

export function clearPendingAuthState(): void {
  try {
    window.localStorage.removeItem(PENDING_EMAIL_KEY);
    window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
    window.localStorage.removeItem(PENDING_ACTIVATION_KEY);
    window.sessionStorage.removeItem(PENDING_ACTIVATION_KEY);
    window.localStorage.removeItem(AUTH_INTENT_KEY);
  } catch {
    // Ignore
  }
}

export async function sendStudentEmailLink(
  email: string,
  intent: 'activate' | 'login',
  activationDraft?: PendingActivationDraft
): Promise<{ success: boolean; email?: string; message?: string; error?: string }> {
  const offlineError = requireOnline('sending a Firebase verification link');
  if (offlineError) {
    return { success: false, error: offlineError };
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    return {
      success: false,
      error: 'Please enter a valid email address (such as @stu.ucc.edu.gh, Gmail, or another valid email).',
    };
  }

  if (intent === 'activate' && activationDraft) {
    if (
      !activationDraft.studentId.trim() ||
      !activationDraft.indexNumber.trim() ||
      !activationDraft.fullName.trim() ||
      !activationDraft.department.trim() ||
      !activationDraft.faculty.trim() ||
      !activationDraft.hall.trim()
    ) {
      return {
        success: false,
        error: 'All UCC student institutional identification fields are required before sending the verification link.',
      };
    }
  }

  savePendingAuthState(cleanEmail, intent, activationDraft);

  const actionCodeSettings = {
    url: `${window.location.origin}/?authMode=student_email_link`,
    handleCodeInApp: true,
  };

  try {
    await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);
    return {
      success: true,
      email: cleanEmail,
      message:
        intent === 'activate'
          ? `Verification sign-in link sent to ${cleanEmail}. Open the link in your inbox to verify your email address and activate your UCC VOTE profile.`
          : `Sign-in link sent to ${cleanEmail}. Open the link in your email inbox to access your UCC VOTE account.`,
    };
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'auth/too-many-requests') {
      return {
        success: false,
        error: 'Too many sign-in link requests. Please wait a minute before trying again.',
      };
    }
    if (code === 'auth/operation-not-allowed') {
      return {
        success: false,
        error:
          'Email link (passwordless) sign-in is not yet enabled in Firebase Console for project ucc-vote.',
      };
    }
    if (code === 'auth/unauthorized-continue-uri' || code === 'auth/invalid-continue-uri') {
      return {
        success: false,
        error: `Current domain (${window.location.origin}) must be added to Authorized Domains in Firebase Authentication settings.`,
      };
    }
    return {
      success: false,
      error: err?.message || 'Unable to send Firebase sign-in link.',
    };
  }
}

export function isIncomingEmailSignInLink(url?: string): boolean {
  try {
    return isSignInWithEmailLink(auth, url || window.location.href);
  } catch {
    return false;
  }
}

export async function createOrLoadStudentProfile(
  user: User,
  draft?: PendingActivationDraft | null
): Promise<{
  student?: StudentProfile;
  needsProfileActivation?: boolean;
  error?: string;
}> {
  const studentRef = doc(db, 'students', user.uid);
  let snap;
  try {
    snap = await getDoc(studentRef);
  } catch (err) {
    return {
      error: formatFirestorePermissionError(err, OperationType.GET, `students/${user.uid}`),
    };
  }

  if (snap.exists()) {
    const data = snap.data() as StudentProfile;
    if (user.emailVerified && !data.emailVerified) {
      try {
        await updateDoc(studentRef, {
          emailVerified: true,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Non-blocking sync
      }
    }
    clearPendingAuthState();
    return {
      student: {
        ...data,
        id: snap.id,
        uid: user.uid,
        emailVerified: user.emailVerified,
      },
    };
  }

  if (!draft) {
    return {
      needsProfileActivation: true,
    };
  }

  const normalizedStudentId = draft.studentId.trim().toUpperCase();

  // Check if Student ID is already claimed by another UID to prevent duplicate accounts
  try {
    const existingQ = query(
      collection(db, 'students'),
      where('studentId', '==', normalizedStudentId),
      limit(1)
    );
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty && existingSnap.docs[0].id !== user.uid) {
      return {
        error: `Student ID ${normalizedStudentId} is already linked to another registered account. Please sign in with your registered email address.`,
      };
    }
  } catch {
    // Firestore rules may block cross-user queries; proceed with UID-keyed document creation
  }

  const cleanEmail = (user.email || draft.email).trim().toLowerCase();
  const nowIso = new Date().toISOString();

  const resolvedProvider = user.providerData?.some((p) => p.providerId === 'password')
    ? 'password'
    : user.providerData?.some((p) => p.providerId === 'google.com')
    ? 'google'
    : 'email_link';

  // Important: Email verification confirms email ownership ONLY.
  // Voter eligibility (isEligible) remains pending_verification until approved/verified in voter_eligibility.
  const newProfile: Omit<StudentProfile, 'id'> = {
    uid: user.uid,
    studentId: normalizedStudentId,
    indexNumber: draft.indexNumber.trim(),
    fullName: draft.fullName.trim(),
    email: cleanEmail,
    emailVerified: user.emailVerified,
    photoUrl: user.photoURL || '',
    avatarUrl: user.photoURL || '',
    authProvider: resolvedProvider,
    phone: draft.phone.trim(),
    department: draft.department.trim(),
    faculty: draft.faculty.trim(),
    programme: draft.programme.trim(),
    level: draft.level,
    hall: draft.hall.trim(),
    isEligible: false,
    eligibilityStatus: 'pending_verification',
    eligibilityNotes:
      'Email inbox verified. Awaiting UCC Electoral Commission voter roll verification.',
    status: 'active',
    hasVotedElections: [],
    notificationPreferences: {
      emailAlerts: true,
      smsBulletins: false,
      resultsAnnouncements: true,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
    lastLoginAt: nowIso,
  };

  try {
    await setDoc(studentRef, {
      ...newProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    return {
      error: formatFirestorePermissionError(err, OperationType.CREATE, `students/${user.uid}`),
    };
  }

  // Also create pending voter_eligibility record if rules permit
  try {
    await setDoc(
      doc(db, 'voter_eligibility', user.uid),
      {
        uid: user.uid,
        studentId: normalizedStudentId,
        fullName: draft.fullName.trim(),
        email: cleanEmail,
        faculty: draft.faculty.trim(),
        department: draft.department.trim(),
        programme: draft.programme.trim(),
        level: draft.level,
        hall: draft.hall.trim(),
        isEligible: false,
        status: 'pending_verification',
        reason: 'Email address verified; awaiting Electoral Commission roll confirmation.',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // Admin may verify or Cloud Function may manage voter_eligibility
  }

  clearPendingAuthState();

  return {
    student: {
      id: user.uid,
      ...newProfile,
    },
  };
}

export async function completeEmailSignInLink(
  providedEmail?: string,
  linkUrl?: string
): Promise<{
  success: boolean;
  needsEmailPrompt?: boolean;
  needsProfileActivation?: boolean;
  student?: StudentProfile;
  email?: string;
  error?: string;
}> {
  const href = linkUrl || window.location.href;
  if (!isIncomingEmailSignInLink(href)) {
    return { success: false, error: 'Invalid or expired sign-in link.' };
  }

  const email = (providedEmail || getPendingEmail() || '').trim().toLowerCase();
  if (!email) {
    return {
      success: false,
      needsEmailPrompt: true,
      error: 'Please enter the email address you used to request this sign-in link.',
    };
  }

  try {
    const credential = await signInWithEmailLink(auth, email, href);
    // Clean URL query params so reload does not retry consumed link
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const draft = getPendingActivationDraft();
    const profileRes = await createOrLoadStudentProfile(credential.user, draft);

    if (profileRes.error) {
      return { success: false, error: profileRes.error };
    }

    return {
      success: true,
      student: profileRes.student,
      needsProfileActivation: profileRes.needsProfileActivation,
      email: credential.user.email || email,
    };
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
      return {
        success: false,
        error: 'This email sign-in link has expired or was already used. Please request a fresh link.',
      };
    }
    if (code === 'auth/invalid-email') {
      return {
        success: false,
        needsEmailPrompt: true,
        error: 'The email entered does not match the sign-in link. Please verify and try again.',
      };
    }
    return {
      success: false,
      error: err?.message || 'Failed to complete email-link authentication.',
    };
  }
}

export async function loginStudentWithPassword(
  email: string,
  password: string
): Promise<{
  success: boolean;
  student?: StudentProfile;
  needsProfileActivation?: boolean;
  error?: string;
}> {
  const offlineError = requireOnline('Firebase Authentication');
  if (offlineError) {
    return { success: false, error: offlineError };
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const res = await createOrLoadStudentProfile(cred.user, null);
    if (res.error) return { success: false, error: res.error };
    return {
      success: true,
      student: res.student,
      needsProfileActivation: res.needsProfileActivation,
    };
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return { success: false, error: 'Invalid email or password.' };
    }
    if (code === 'auth/too-many-requests') {
      return { success: false, error: 'Too many failed attempts. Please try again later or use Email Link Sign-In.' };
    }
    return { success: false, error: err?.message || 'Authentication failed.' };
  }
}

export async function sendFirebasePasswordReset(
  email: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const offlineError = requireOnline('sending a password reset email');
  if (offlineError) {
    return { success: false, error: offlineError };
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail, {
      url: `${window.location.origin}/`,
    });
    return {
      success: true,
      message: `If an account exists for ${cleanEmail}, a Firebase password reset link has been sent to your inbox.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unable to send password reset email.',
    };
  }
}

export async function loginAdminWithFirebase(
  email: string,
  password: string
): Promise<{
  success: boolean;
  admin?: AdminProfile;
  error?: string;
}> {
  const offlineError = requireOnline('administrator authentication');
  if (offlineError) {
    return { success: false, error: offlineError };
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!isValidEmail(cleanEmail) || !password) {
    return { success: false, error: 'Please enter your administrator email and password.' };
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const tokenResult = await cred.user.getIdTokenResult(true);
    const hasAdminClaim = tokenResult.claims?.admin === true;

    const adminRef = doc(db, 'admins', cred.user.uid);
    const adminSnap = await getDoc(adminRef);

    if (!adminSnap.exists() && !hasAdminClaim) {
      await signOut(auth);
      return {
        success: false,
        error:
          'Access Denied: This account is not authorized as a UCC Electoral Commission administrator.',
      };
    }

    const adminData = adminSnap.exists() ? (adminSnap.data() as AdminProfile) : null;
    if (adminData && adminData.isActive === false) {
      await signOut(auth);
      return {
        success: false,
        error: 'This administrator account has been deactivated.',
      };
    }

    const resolvedAdmin: AdminProfile = adminData
      ? { ...adminData, id: cred.user.uid, uid: cred.user.uid }
      : {
          id: cred.user.uid,
          uid: cred.user.uid,
          staffId: (tokenResult.claims?.staffId as string) || 'ADMIN',
          fullName: cred.user.displayName || cleanEmail,
          email: cleanEmail,
          role: ((tokenResult.claims?.role as any) || 'Electoral Commissioner'),
          department: 'UCC Electoral Commission',
          permissions: ['*'],
          isActive: true,
        };

    return {
      success: true,
      admin: resolvedAdmin,
    };
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return { success: false, error: 'Invalid administrator credentials.' };
    }
    if (code === 'auth/too-many-requests') {
      return { success: false, error: 'Too many failed login attempts. Please wait and try again.' };
    }
    return { success: false, error: err?.message || 'Administrator sign-in failed.' };
  }
}

export async function updateFirebaseUserPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    return { success: false, error: 'No authenticated user session found.' };
  }
  try {
    const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
    if (hasPasswordProvider && currentPassword) {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
    }
    await updatePassword(user, newPassword);
    return {
      success: true,
      message: 'Your Firebase Authentication password has been updated.',
    };
  } catch (err: any) {
    if (err?.code === 'auth/requires-recent-login') {
      return {
        success: false,
        error: 'For security, please sign out and sign back in before updating your password.',
      };
    }
    if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
      return { success: false, error: 'Current password is incorrect.' };
    }
    return { success: false, error: err?.message || 'Failed to update password.' };
  }
}

export interface GoogleAuthResult {
  success: boolean;
  isNewUser?: boolean;
  redirected?: boolean;
  student?: StudentProfile;
  message?: string;
  error?: string;
  cancelled?: boolean;
}

function buildGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
}

function mapGoogleAuthError(err: any): {
  message: string;
  cancelled?: boolean;
  popupBlocked?: boolean;
} {
  const code = err?.code || '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      cancelled: true,
      message: 'Google sign-in was cancelled. Click Continue with Google whenever you are ready.',
    };
  }
  if (code === 'auth/popup-blocked') {
    return {
      popupBlocked: true,
      message: 'Pop-up was blocked by your browser. Redirecting to Google Sign-In...',
    };
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return {
      message:
        'An account already exists with this email using another sign-in method. Please sign in using your email link or password.',
    };
  }
  if (code === 'auth/network-request-failed') {
    return {
      message:
        'Network error while connecting to Google. Please check your internet connection and try again.',
    };
  }
  if (code === 'auth/operation-not-allowed') {
    return {
      message:
        'Google Sign-In is not yet enabled in Firebase Authentication for project ucc-vote.',
    };
  }
  if (code === 'auth/unauthorized-domain') {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'this domain';
    return {
      message: `Current domain (${origin}) must be added to Authorized Domains in Firebase Authentication settings.`,
    };
  }
  if (code === 'auth/user-disabled') {
    return {
      message: 'This account has been disabled in Firebase Authentication.',
    };
  }
  return {
    message: 'Unable to sign in. Please try again.',
  };
}

export async function ensureGoogleStudentProfile(
  user: User,
  isNewFromProvider?: boolean
): Promise<GoogleAuthResult> {
  const studentRef = doc(db, 'students', user.uid);
  let snap;

  try {
    snap = await getDoc(studentRef);
  } catch (err) {
    return {
      success: false,
      error: formatFirestorePermissionError(err, OperationType.GET, `students/${user.uid}`),
    };
  }

  const cleanEmail = (user.email || '').trim().toLowerCase();
  const googlePhoto = user.photoURL || '';
  const nowIso = new Date().toISOString();

  if (snap.exists()) {
    const data = snap.data() as StudentProfile;
    const patch: Record<string, any> = {
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (user.emailVerified && !data.emailVerified) {
      patch.emailVerified = true;
    }
    if (!data.authProvider) {
      patch.authProvider = 'google';
    }
    if (googlePhoto && !data.photoUrl) {
      patch.photoUrl = googlePhoto;
    }
    if (googlePhoto && !data.avatarUrl) {
      patch.avatarUrl = googlePhoto;
    }
    if (user.displayName && !data.fullName) {
      patch.fullName = user.displayName.trim();
    }

    try {
      await updateDoc(studentRef, patch);
    } catch {
      // Non-blocking login metadata sync
    }

    clearPendingAuthState();

    return {
      success: true,
      isNewUser: false,
      message: 'Google sign-in successful',
      student: {
        ...data,
        id: snap.id,
        uid: user.uid,
        email: data.email || cleanEmail,
        emailVerified: Boolean(user.emailVerified || data.emailVerified),
        photoUrl: data.photoUrl || googlePhoto,
        avatarUrl: data.avatarUrl || data.photoUrl || googlePhoto,
        authProvider: data.authProvider || 'google',
        lastLoginAt: nowIso,
      },
    };
  }

  // First-time Google sign-in: automatically create Firestore profile keyed by Firebase UID
  const resolvedName =
    user.displayName?.trim() ||
    (cleanEmail ? cleanEmail.split('@')[0] : 'UCC Student');

  const newProfile: Omit<StudentProfile, 'id'> = {
    uid: user.uid,
    studentId: '',
    indexNumber: '',
    fullName: resolvedName,
    email: cleanEmail,
    emailVerified: Boolean(user.emailVerified),
    photoUrl: googlePhoto,
    avatarUrl: googlePhoto,
    authProvider: 'google',
    phone: user.phoneNumber || '',
    department: '',
    faculty: '',
    programme: '',
    level: '100',
    hall: '',
    isEligible: false,
    eligibilityStatus: 'pending_verification',
    eligibilityNotes:
      'Signed in with Google. Complete your UCC student details and await Electoral Commission voter roll confirmation.',
    status: 'active',
    hasVotedElections: [],
    notificationPreferences: {
      emailAlerts: true,
      smsBulletins: false,
      resultsAnnouncements: true,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
    lastLoginAt: nowIso,
  };

  try {
    await setDoc(studentRef, {
      ...newProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  } catch (err) {
    return {
      success: false,
      error: formatFirestorePermissionError(err, OperationType.CREATE, `students/${user.uid}`),
    };
  }

  // Best-effort pending eligibility record if rules permit
  try {
    await setDoc(
      doc(db, 'voter_eligibility', user.uid),
      {
        uid: user.uid,
        studentId: '',
        fullName: resolvedName,
        email: cleanEmail,
        faculty: '',
        department: '',
        programme: '',
        level: '100',
        hall: '',
        isEligible: false,
        status: 'pending_verification',
        reason: 'Google account verified; awaiting UCC student details and Electoral Commission roll confirmation.',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // Admin manages voter_eligibility under strict Firestore rules
  }

  clearPendingAuthState();

  return {
    success: true,
    isNewUser: isNewFromProvider ?? true,
    message: 'Google sign-in successful',
    student: {
      id: user.uid,
      ...newProfile,
    },
  };
}

export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  const offlineError = requireOnline('Google Sign-In');
  if (offlineError) {
    return { success: false, error: offlineError };
  }
  const provider = buildGoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const additionalInfo = getAdditionalUserInfo(result);
    return await ensureGoogleStudentProfile(result.user, additionalInfo?.isNewUser);
  } catch (err: any) {
    const mapped = mapGoogleAuthError(err);
    if (mapped.popupBlocked) {
      try {
        await signInWithRedirect(auth, provider);
        return {
          success: true,
          redirected: true,
          message: 'Redirecting to Google Sign-In...',
        };
      } catch (redirectErr: any) {
        const redirectMapped = mapGoogleAuthError(redirectErr);
        return {
          success: false,
          error: redirectMapped.message,
        };
      }
    }
    return {
      success: false,
      cancelled: mapped.cancelled,
      error: mapped.message,
    };
  }
}

export async function completeGoogleRedirectResult(): Promise<
  (GoogleAuthResult & { hasResult: boolean })
> {
  try {
    const result = await getRedirectResult(auth);
    if (!result) {
      return { hasResult: false, success: true };
    }
    const additionalInfo = getAdditionalUserInfo(result);
    const profileRes = await ensureGoogleStudentProfile(result.user, additionalInfo?.isNewUser);
    return {
      hasResult: true,
      ...profileRes,
    };
  } catch (err: any) {
    const mapped = mapGoogleAuthError(err);
    return {
      hasResult: true,
      success: false,
      cancelled: mapped.cancelled,
      error: mapped.message,
    };
  }
}

export async function signOutFirebase(): Promise<void> {
  clearPendingAuthState();
  await signOut(auth);
}
