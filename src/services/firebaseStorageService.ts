import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTask,
} from 'firebase/storage';
import { auth, storage, FIREBASE_STORAGE_BUCKET } from '../lib/firebase';

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
export const MAX_CANDIDATE_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB
const STALL_TIMEOUT_MS = 25000;

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'photo.jpg';
}

function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'general';
}

export function resolveCandidateImageContentType(file: File): string | null {
  const mime = (file.type || '').toLowerCase().trim();
  if (ALLOWED_IMAGE_MIME_TYPES.includes(mime)) {
    return mime === 'image/jpg' ? 'image/jpeg' : mime;
  }
  const lowerName = (file.name || '').toLowerCase();
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  return null;
}

export async function validateCandidateImageFile(
  file: File
): Promise<{ valid: true; contentType: string } | { valid: false; error: string }> {
  if (!file) {
    return { valid: false, error: 'Please select an image file.' };
  }
  if (file.size <= 0) {
    return {
      valid: false,
      error: 'The selected file is empty (0 bytes) or corrupted. Please choose a valid image.',
    };
  }

  const contentType = resolveCandidateImageContentType(file);
  if (!contentType) {
    return {
      valid: false,
      error: 'Unsupported image format. Please choose a JPEG (.jpg/.jpeg), PNG (.png), or WebP (.webp) photograph.',
    };
  }

  if (file.size > MAX_CANDIDATE_IMAGE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Selected image is ${sizeMb} MB, which exceeds the 5 MB maximum limit.`,
    };
  }

  // In browser environments, verify image headers/pixels can actually decode
  if (
    typeof window !== 'undefined' &&
    typeof Image !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    const objectUrl = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            resolve();
          } else {
            reject(new Error('Image has invalid dimensions.'));
          }
        };
        img.onerror = () => reject(new Error('File could not be decoded as a valid image.'));
        img.src = objectUrl;
      });
    } catch {
      return {
        valid: false,
        error: 'The selected file appears corrupted or is not a valid readable JPEG, PNG, or WebP image.',
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return { valid: true, contentType };
}

export function mapFirebaseStorageError(error: any): string {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  const serverResponse = String(error?.serverResponse || '');
  const combined = `${message} ${serverResponse}`.toLowerCase();

  if (code === 'storage/unauthenticated') {
    return 'Authentication required: Please sign in as an authorised administrator or electoral officer and retry.';
  }
  if (code === 'storage/unauthorized') {
    return 'Upload permission denied (storage/unauthorized): Verify your account has administrator privileges (admin: true) and Firebase Storage security rules permit writes to /candidates/.';
  }
  if (
    code === 'storage/bucket-not-found' ||
    combined.includes('specified bucket does not exist') ||
    (code === 'storage/unknown' && (combined.includes('404') || combined.includes('not found')))
  ) {
    return `Firebase Storage bucket "${FIREBASE_STORAGE_BUCKET}" was not found. Enable Cloud Storage for this Firebase project and deploy storage.rules before uploading.`;
  }
  if (code === 'storage/quota-exceeded') {
    return 'Firebase Storage quota exceeded (storage/quota-exceeded). Contact the system administrator to expand storage capacity.';
  }
  if (code === 'storage/retry-limit-exceeded') {
    return 'Upload timed out after multiple retries (storage/retry-limit-exceeded). Check your internet connection and Firebase Storage service status, then retry.';
  }
  if (code === 'storage/canceled') {
    return 'Upload was canceled. Click Retry or choose another photograph to upload again.';
  }
  if (
    combined.includes('network') ||
    combined.includes('offline') ||
    combined.includes('failed to fetch') ||
    combined.includes('cors')
  ) {
    return 'Network or connection error while uploading to Firebase Storage. Check your internet connection and Storage configuration, then retry.';
  }

  return message || 'Firebase Storage upload failed. Please check your connection and try again.';
}

export interface UploadTaskHandle {
  promise: Promise<{ url: string; path: string }>;
  cancel: () => void;
}

function startResumableUpload(
  path: string,
  file: File,
  contentType: string,
  onProgress?: (pct: number) => void
): UploadTaskHandle {
  let task: UploadTask | null = null;
  let canceledByCaller = false;

  const promise = new Promise<{ url: string; path: string }>((resolve, reject) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      reject(
        new Error('You appear to be offline. Reconnect to the internet and retry uploading.')
      );
      return;
    }

    if (!auth.currentUser) {
      reject(
        new Error(
          mapFirebaseStorageError({ code: 'storage/unauthenticated' })
        )
      );
      return;
    }

    const bucketConfigured =
      storage?.app?.options?.storageBucket || FIREBASE_STORAGE_BUCKET;
    if (!bucketConfigured) {
      reject(
        new Error(
          mapFirebaseStorageError({ code: 'storage/bucket-not-found' })
        )
      );
      return;
    }

    let settled = false;
    let lastBytesTransferred = -1;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;

    const clearWatchdog = () => {
      if (stallTimer !== null) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    };

    const armWatchdog = () => {
      clearWatchdog();
      stallTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        canceledByCaller = true;
        try {
          task?.cancel();
        } catch {
          // Ignore cancel error
        }
        reject(
          new Error(
            'Upload stalled at 0% (connection timed out or Firebase Storage bucket unreachable). Verify Firebase Storage is enabled and retry.'
          )
        );
      }, STALL_TIMEOUT_MS);
    };

    try {
      const storageRef = ref(storage, path);
      task = uploadBytesResumable(storageRef, file, {
        contentType,
        cacheControl: 'public,max-age=3600',
      });
    } catch (initErr: any) {
      reject(new Error(mapFirebaseStorageError(initErr)));
      return;
    }

    armWatchdog();

    task.on(
      'state_changed',
      (snapshot) => {
        if (settled) return;
        if (snapshot.bytesTransferred > lastBytesTransferred) {
          lastBytesTransferred = snapshot.bytesTransferred;
          armWatchdog();
        }
        if (onProgress && snapshot.totalBytes > 0) {
          // Reserve 100% exclusively for when getDownloadURL() completes
          const rawPct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(Math.min(99, Math.max(0, rawPct)));
        }
      },
      (error) => {
        clearWatchdog();
        if (settled) return;
        settled = true;
        if (canceledByCaller && error?.code === 'storage/canceled') {
          reject(new Error(mapFirebaseStorageError({ code: 'storage/canceled' })));
          return;
        }
        reject(new Error(mapFirebaseStorageError(error)));
      },
      async () => {
        clearWatchdog();
        if (settled) return;
        try {
          const url = await getDownloadURL(task!.snapshot.ref);
          if (!url || !url.startsWith('http')) {
            throw new Error('Firebase Storage returned an invalid download URL.');
          }
          settled = true;
          if (onProgress) onProgress(100);
          resolve({ url, path });
        } catch (err: any) {
          settled = true;
          reject(new Error(mapFirebaseStorageError(err)));
        }
      }
    );
  });

  return {
    promise,
    cancel: () => {
      canceledByCaller = true;
      try {
        task?.cancel();
      } catch {
        // Ignore
      }
    },
  };
}

export function startCandidatePhotoUpload(
  file: File,
  candidateKey: string,
  onProgress?: (pct: number) => void
): UploadTaskHandle {
  let innerHandle: UploadTaskHandle | null = null;
  let canceledBeforeStart = false;

  const promise = (async () => {
    const validation = await validateCandidateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    if (canceledBeforeStart) {
      throw new Error(mapFirebaseStorageError({ code: 'storage/canceled' }));
    }

    const safeKey = sanitizePathSegment(candidateKey);
    const uniqueSuffix = Math.random().toString(36).slice(2, 7);
    const path = `candidates/${safeKey}/${Date.now()}_${uniqueSuffix}_${sanitizeFilename(file.name)}`;

    innerHandle = startResumableUpload(path, file, validation.contentType, onProgress);
    if (canceledBeforeStart) {
      innerHandle.cancel();
    }
    return innerHandle.promise;
  })();

  return {
    promise,
    cancel: () => {
      canceledBeforeStart = true;
      innerHandle?.cancel();
    },
  };
}

export async function uploadCandidatePhoto(
  file: File,
  candidateKey: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; path: string }> {
  return startCandidatePhotoUpload(file, candidateKey, onProgress).promise;
}

export async function uploadElectionDocument(
  file: File,
  electionId: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; path: string }> {
  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_DOC_TYPES.includes(mime)) {
    throw new Error('Election document must be a PDF or image (JPEG, PNG, WebP).');
  }
  if (file.size <= 0 || file.size > MAX_DOC_BYTES) {
    throw new Error('Election document must be between 1 byte and 10 MB.');
  }
  const safeId = sanitizePathSegment(electionId);
  const path = `elections/${safeId}/documents/${Date.now()}_${sanitizeFilename(file.name)}`;
  return startResumableUpload(path, file, mime, onProgress).promise;
}

export async function uploadComplaintAttachment(
  file: File,
  uid: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; path: string }> {
  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_DOC_TYPES.includes(mime)) {
    throw new Error('Attachment must be a PDF or image (JPEG, PNG, WebP).');
  }
  if (file.size <= 0 || file.size > MAX_DOC_BYTES) {
    throw new Error('Attachment must be between 1 byte and 10 MB.');
  }
  const safeUid = sanitizePathSegment(uid);
  const path = `complaints/${safeUid}/${Date.now()}_${sanitizeFilename(file.name)}`;
  return startResumableUpload(path, file, mime, onProgress).promise;
}

export async function deleteStorageFileByUrl(url?: string): Promise<void> {
  if (!url || !url.includes('firebasestorage.googleapis.com')) {
    return;
  }
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch {
    // Ignore already-deleted or non-owned references during cleanup
  }
}
