import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyDylk64tRY1GhVEfN2UWBTqSIseSOaozug',
  authDomain: 'ucc-vote.firebaseapp.com',
  projectId: 'ucc-vote',
  storageBucket: 'ucc-vote.firebasestorage.app',
  messagingSenderId: '81600235294',
  appId: '1:81600235294:web:1ec432df156ad61d24eb0f',
  measurementId: 'G-HWNFXDRLKE',
};

export const FIREBASE_PROJECT_ID = 'ucc-vote';

// Initialize Firebase only once across HMR / module evaluations
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  dbInstance = getFirestore(app);
}
export const db: Firestore = dbInstance;

export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const user = auth.currentUser;
  return {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      isAnonymous: user?.isAnonymous,
      tenantId: user?.tenantId,
      providerInfo:
        user?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.warn('Firestore operation failed:', JSON.stringify(errInfo));
  throw new Error(errInfo.error);
}

export async function testFirestoreConnection(): Promise<{
  connected: boolean;
  offline: boolean;
  databaseMissing?: boolean;
  error?: string;
}> {
  // Check browser connectivity first
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      connected: false,
      offline: true,
      error: 'Browser is offline. Connect to the internet to sync with Cloud Firestore.',
    };
  }

  try {
    // Probe Firestore REST API to distinguish an uncreated (default) database from network failure
    const probeRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/elections?pageSize=1`
    );
    if (probeRes.status === 404) {
      const body = await probeRes.json().catch(() => null);
      const message = String(body?.error?.message || '');
      if (message.includes('does not exist')) {
        return {
          connected: false,
          offline: false,
          databaseMissing: true,
          error:
            'Cloud Firestore database "(default)" is not yet enabled on Firebase project "ucc-vote". Create it in Firebase Console → Build → Firestore Database.',
        };
      }
    }

    await getDocFromServer(doc(db, 'system', 'connection_check'));
    return { connected: true, offline: false };
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (error?.code === 'permission-denied' || msg.includes('Missing or insufficient permissions')) {
      return { connected: true, offline: false };
    }
    const isOffline =
      msg.includes('the client is offline') ||
      error?.code === 'unavailable';
    if (isOffline) {
      console.warn('Cloud Firestore connection check could not reach server:', msg);
      return { connected: false, offline: true, error: msg };
    }
    return { connected: true, offline: false };
  }
}
