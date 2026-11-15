import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  sendStudentEmailLink,
  completeEmailSignInLink,
  loginStudentWithPassword,
  loginAdminWithFirebase,
  sendFirebasePasswordReset,
  updateFirebaseUserPassword,
  signOutFirebase,
  createOrLoadStudentProfile,
  PendingActivationDraft,
} from './firebaseAuthService';
import { AuthResponse } from './interfaces';

class FirebaseAuthClient {
  async sendEmailLink(
    email: string,
    intent: 'activate' | 'login',
    activationDraft?: PendingActivationDraft
  ) {
    return sendStudentEmailLink(email, intent, activationDraft);
  }

  async completeEmailLink(providedEmail?: string, linkUrl?: string) {
    return completeEmailSignInLink(providedEmail, linkUrl);
  }

  async saveActivationProfile(draft: PendingActivationDraft) {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'You must verify your email address first.' };
    }
    const res = await createOrLoadStudentProfile(user, draft);
    if (res.error) return { success: false, error: res.error };
    return { success: true, student: res.student };
  }

  async login(
    email: string,
    password: string,
    _rememberMe = true
  ): Promise<AuthResponse> {
    const res = await loginStudentWithPassword(email, password);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Authentication failed.',
      };
    }
    return {
      success: true,
      userRole: 'student',
      user: res.student,
      message: 'Signed in via Firebase Authentication.',
    };
  }

  async adminLogin(
    email: string,
    password: string,
    _selectedRole?: string
  ): Promise<AuthResponse> {
    const res = await loginAdminWithFirebase(email, password);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Administrator sign-in failed.',
      };
    }
    return {
      success: true,
      userRole: 'admin',
      user: res.admin,
      message: 'Administrator authenticated via Firebase.',
    };
  }

  async forgotPassword(email: string): Promise<AuthResponse> {
    const res = await sendFirebasePasswordReset(email);
    return {
      success: res.success,
      message: res.message,
      error: res.error,
      email,
    };
  }

  async logout(): Promise<void> {
    await signOutFirebase();
  }

  async updateProfile(updates: {
    phone?: string;
    emergencyContact?: string;
    notificationPreferences?: any;
    attemptedIdentityChange?: boolean;
  }): Promise<AuthResponse> {
    if (updates.attemptedIdentityChange) {
      return {
        success: false,
        error:
          'Institutional academic fields (Student ID, Index Number, Faculty, Department, Level, Hall) are locked and require UCC Electoral Commission / Academic Affairs verification to modify.',
      };
    }

    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'Not authenticated.' };
    }

    const safePayload: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.phone !== undefined) safePayload.phone = updates.phone.trim();
    if (updates.emergencyContact !== undefined) {
      safePayload.emergencyContact = updates.emergencyContact.trim();
    }
    if (updates.notificationPreferences !== undefined) {
      safePayload.notificationPreferences = updates.notificationPreferences;
    }

    try {
      await updateDoc(doc(db, 'students', user.uid), safePayload);
      return {
        success: true,
        message: 'Contact and notification preferences updated in Cloud Firestore.',
      };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `students/${user.uid}`);
    }
  }

  async changePassword(passwords: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<AuthResponse> {
    if (passwords.newPassword !== passwords.confirmPassword) {
      return { success: false, error: 'New passwords do not match.' };
    }
    if (passwords.newPassword.length < 8) {
      return {
        success: false,
        error: 'New password must be at least 8 characters long.',
      };
    }
    return updateFirebaseUserPassword(passwords.currentPassword, passwords.newPassword);
  }
}

export const authClient = new FirebaseAuthClient();
