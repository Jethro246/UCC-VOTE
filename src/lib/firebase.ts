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
  apiKey:
    (import.meta.env ? import.meta.env.VITE_FIREBASE_API_KEY : undefined) ||
    'AIzaSyDylk64tRY1GhVEfN2UWBTqSIseSOaozug',
  authDomain: 'ucc-vote.firebaseapp.com',
  projectId: 'ucc-vote',
  storageBucket: 'ucc-vote.firebasestorage.app',
  messagingSenderId: '81600235294',
  appId: '1:81600235294:web:1ec432df156ad61d24eb0f',
  measurementId: 'G-HWNFXDRLKE',
};

export const FIREBASE_PROJECT_ID = 'ucc-vote';
export const FIREBASE_STORAGE_BUCKET = firebaseConfig.storageBucket;
export const FIRESTORE_DATABASE_ID = 'ai-studio-uccvote-84fbbe19-57dc-4b9d-8017-7c3fcf81fe8c';

// Initialize Firebase only once across HMR / module evaluations
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    },
    FIRESTORE_DATABASE_ID
  );
} catch {
  dbInstance = getFirestore(app, FIRESTORE_DATABASE_ID);
}
export const db: Firestore = dbInstance;

export const storage: FirebaseStorage = getStorage(app);
try {
  storage.maxUploadRetryTime = 25000;
  storage.maxOperationRetryTime = 15000;
} catch {
  // Ignore if running in a mock harness
}
export const FIREBASE_FUNCTIONS_REGION =
  (import.meta.env ? import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION : undefined) || 'us-central1';
export const functions: Functions = getFunctions(app, FIREBASE_FUNCTIONS_REGION);

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

export function formatFirestorePermissionError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): string {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.warn('Firestore operation failed:', JSON.stringify(errInfo));
  const raw = errInfo.error || '';
  const code = (error as any)?.code || '';
  if (code === 'permission-denied' || raw.includes('Missing or insufficient permissions')) {
    return `Permission denied on Firestore database "${FIRESTORE_DATABASE_ID}" (${operationType} ${path || ''}). Publish the security rules from firestore.rules to database "${FIRESTORE_DATABASE_ID}" in Firebase Console.`;
  }
  return raw || 'Cloud Firestore operation failed.';
}

export async function testFirestoreConnection(): Promise<{
  connected: boolean;
  offline: boolean;
  databaseMissing?: boolean;
  rulesLocked?: boolean;
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
    // Probe Firestore REST API against the existing named database
    const probeRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/elections?pageSize=1`
    );
    if (probeRes.status === 404) {
      const body = await probeRes.json().catch(() => null);
      const message = String(body?.error?.message || '');
      if (message.includes('does not exist')) {
        return {
          connected: false,
          offline: false,
          databaseMissing: true,
          error: `Cloud Firestore database "${FIRESTORE_DATABASE_ID}" was not found in Firebase project "${FIREBASE_PROJECT_ID}".`,
        };
      }
    }

    if (probeRes.status === 403) {
      return {
        connected: true,
        offline: false,
        rulesLocked: true,
        error: `Connected to Cloud Firestore "${FIRESTORE_DATABASE_ID}", but its security rules currently block access. Publish firestore.rules to this database in Firebase Console → Firestore → Rules.`,
      };
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
