import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '../lib/firebase';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'general';
}

function uploadWithProgress(
  path: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ url: string; path: string }> {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    task.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(pct);
        }
      },
      (error) => {
        reject(new Error(error.message || 'Firebase Storage upload failed.'));
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({ url, path });
        } catch (err: any) {
          reject(new Error(err?.message || 'Unable to retrieve uploaded file URL.'));
        }
      }
    );
  });
}

export async function uploadCandidatePhoto(
  file: File,
  candidateKey: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; path: string }> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Candidate photograph must be JPEG, PNG, or WebP.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Candidate photograph must be 5 MB or smaller.');
  }
  const safeKey = sanitizePathSegment(candidateKey);
  const path = `candidates/${safeKey}/${Date.now()}_${sanitizeFilename(file.name)}`;
  return uploadWithProgress(path, file, onProgress);
}

export async function uploadElectionDocument(
  file: File,
  electionId: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; path: string }> {
  if (!ALLOWED_DOC_TYPES.includes(file.type)) {
    throw new Error('Election document must be a PDF or image (JPEG, PNG, WebP).');
  }
  if (file.size > MAX_DOC_BYTES) {
    throw new Error('Election document must be 10 MB or smaller.');
  }
  const safeId = sanitizePathSegment(electionId);
  const path = `elections/${safeId}/documents/${Date.now()}_${sanitizeFilename(file.name)}`;
  return uploadWithProgress(path, file, onProgress);
}

export async function uploadComplaintAttachment(
  file: File,
  uid: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; path: string }> {
  if (!ALLOWED_DOC_TYPES.includes(file.type)) {
    throw new Error('Attachment must be a PDF or image (JPEG, PNG, WebP).');
  }
  if (file.size > MAX_DOC_BYTES) {
    throw new Error('Attachment must be 10 MB or smaller.');
  }
  const safeUid = sanitizePathSegment(uid);
  const path = `complaints/${safeUid}/${Date.now()}_${sanitizeFilename(file.name)}`;
  return uploadWithProgress(path, file, onProgress);
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
