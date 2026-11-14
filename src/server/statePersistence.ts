import fs from 'fs';
import os from 'os';
import path from 'path';

const STATE_FILE_PATH = path.join(os.tmpdir(), 'ucc-vote-platform-state.json');

type DumpStateFn = () => Record<string, unknown>;
type HydrateStateFn = (snapshot: Record<string, any>) => void;

let dumpProvider: DumpStateFn | null = null;
let hydrateConsumer: HydrateStateFn | null = null;
let isHydrating = false;

export function registerStatePersistence(dumpFn: DumpStateFn, hydrateFn: HydrateStateFn): void {
  dumpProvider = dumpFn;
  hydrateConsumer = hydrateFn;
  loadPersistedPlatformState();
}

export function loadPersistedPlatformState(): boolean {
  if (!hydrateConsumer) return false;
  try {
    if (!fs.existsSync(STATE_FILE_PATH)) {
      return false;
    }
    const raw = fs.readFileSync(STATE_FILE_PATH, 'utf8');
    if (!raw.trim()) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return false;

    isHydrating = true;
    try {
      hydrateConsumer(parsed);
    } finally {
      isHydrating = false;
    }
    return true;
  } catch (err) {
    console.warn('[UCC VOTE] Unable to load persisted platform state:', err);
    return false;
  }
}

export function persistPlatformState(): void {
  if (isHydrating || !dumpProvider) return;
  try {
    const snapshot = dumpProvider();
    const tempFile = `${STATE_FILE_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(snapshot), 'utf8');
    fs.renameSync(tempFile, STATE_FILE_PATH);
  } catch (err) {
    console.warn('[UCC VOTE] Unable to persist platform state:', err);
  }
}

export function getPlatformStateFilePath(): string {
  return STATE_FILE_PATH;
}
