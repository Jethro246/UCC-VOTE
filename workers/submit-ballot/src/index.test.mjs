import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerEntry = path.resolve(__dirname, 'index.ts');
const votingServiceEntry = path.resolve(__dirname, '../../../src/services/votingService.ts');

async function loadWorkerModule() {
  const built = await esbuild.build({
    entryPoints: [workerEntry],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
  });
  const url =
    'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64');
  return import(url);
}

async function loadVotingServiceWithFetchMock(workerHandler, env, mockUserState) {
  const mockPlugin = {
    name: 'mock-firebase-client',
    setup(build) {
      build.onResolve({ filter: /^firebase\/(firestore|auth|functions|storage|app)$/ }, (args) => ({
        path: args.path,
        namespace: 'mock-client',
      }));
      build.onLoad({ filter: /^firebase\/app$/, namespace: 'mock-client' }, () => ({
        contents: `
          export const initializeApp = (c) => ({ options: c });
          export const getApps = () => [{ options: { projectId: 'ucc-vote' } }];
          export const getApp = () => ({ options: { projectId: 'ucc-vote' } });
        `,
        loader: 'js',
      }));
      build.onLoad({ filter: /^firebase\/auth$/, namespace: 'mock-client' }, () => ({
        contents: `
          export const getAuth = () => ({
            get currentUser() { return globalThis.__TEST_CURRENT_USER; }
          });
        `,
        loader: 'js',
      }));
      build.onLoad({ filter: /^firebase\/firestore$/, namespace: 'mock-client' }, () => ({
        contents: `
          export const initializeFirestore = () => ({});
          export const getFirestore = () => ({});
          export const getDocFromServer = async () => ({ exists: () => false });
          export const collection = () => ({});
          export const doc = () => ({});
          export const getDoc = async () => ({ exists: () => false });
          export const getDocs = async () => ({ docs: [] });
          export const query = () => ({});
          export const where = () => ({});
          export const or = () => ({});
          export const orderBy = () => ({});
          export const limit = () => ({});
          export const onSnapshot = () => () => {};
          export const addDoc = async () => ({});
          export const setDoc = async () => ({});
          export const updateDoc = async () => ({});
          export const serverTimestamp = () => 'SERVER_TS';
          export const deleteDoc = async () => {};
          export const Timestamp = class {};
        `,
        loader: 'js',
      }));
      build.onLoad({ filter: /^firebase\/storage$/, namespace: 'mock-client' }, () => ({
        contents: `export const getStorage = () => ({});`,
        loader: 'js',
      }));
      build.onLoad({ filter: /^firebase\/functions$/, namespace: 'mock-client' }, () => ({
        contents: `
          export const getFunctions = () => ({});
          export const httpsCallable = () => async () => ({ data: {} });
        `,
        loader: 'js',
      }));
    },
  };

  const built = await esbuild.build({
    entryPoints: [votingServiceEntry],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    define: {
      'import.meta.env': JSON.stringify({
        VITE_SUBMIT_BALLOT_URL: 'https://ucc-vote-submit-ballot.test.workers.dev/',
      }),
    },
    plugins: [mockPlugin],
  });

  globalThis.__TEST_CURRENT_USER = mockUserState;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const req = new Request(String(input), init);
    return workerHandler(req, env);
  };

  const mod = await import(
    'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
  );
  return {
    votingService: mod.votingService,
    restore: () => {
      globalThis.fetch = origFetch;
      delete globalThis.__TEST_CURRENT_USER;
    },
  };
}

function createRsaKeyMaterial() {
  const authPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const saPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = authPair.publicKey.export({ format: 'jwk' });
  publicJwk.kid = 'test-firebase-kid-1';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  const servicePrivatePem = saPair.privateKey.export({ format: 'pem', type: 'pkcs8' });
  return {
    authPrivateKey: authPair.privateKey,
    authPublicJwk: publicJwk,
    serviceEmail: 'firebase-adminsdk-test@ucc-vote.iam.gserviceaccount.com',
    servicePrivatePem,
  };
}

function signFirebaseIdToken(privateKey, kid, payloadOverrides = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid })).toString(
    'base64url'
  );
  const payload = Buffer.from(
    JSON.stringify({
      iss: 'https://securetoken.google.com/ucc-vote',
      aud: 'ucc-vote',
      sub: 'student_uid_1',
      email: 'student1@st.ucc.edu.gh',
      email_verified: true,
      iat: nowSec - 10,
      auth_time: nowSec - 10,
      exp: nowSec + 3600,
      ...payloadOverrides,
    })
  ).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');
  return `${signingInput}.${sig}`;
}

function toFsVal(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsVal) } };
  const fields = {};
  for (const [k, val] of Object.entries(v)) {
    if (val !== undefined) fields[k] = toFsVal(val);
  }
  return { mapValue: { fields } };
}

function fromFsVal(val) {
  if (!val) return undefined;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('stringValue' in val) return val.stringValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFsVal);
  if ('mapValue' in val) {
    const out = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) out[k] = fromFsVal(v);
    return out;
  }
  return undefined;
}

function createTransactionalFirestoreSimulator(keys) {
  const docRoot =
    'projects/ucc-vote/databases/ai-studio-uccvote-84fbbe19-57dc-4b9d-8017-7c3fcf81fe8c/documents';
  const db = new Map();
  const activeTransactions = new Map();
  let txSeq = 0;

  const seedDoc = (relPath, data) => {
    db.set(`${docRoot}/${relPath}`, structuredClone(data));
  };

  seedDoc('elections/elec_src_2026', {
    title: 'UCC SRC General Election 2026',
    code: 'SRC-2026',
    category: 'SRC',
    status: 'live',
    allowsEmptyBallot: false,
    totalVotesCast: 0,
    totalEligibleVoters: 10,
    eligibilityCriteria: {},
  });
  seedDoc('positions/pos_pres', {
    electionId: 'elec_src_2026',
    title: 'SRC President',
    maxSelections: 1,
    allowsSkip: false,
    order: 1,
  });
  seedDoc('positions/pos_sec', {
    electionId: 'elec_src_2026',
    title: 'SRC General Secretary',
    maxSelections: 1,
    allowsSkip: true,
    order: 2,
  });
  seedDoc('candidates/cand_1', {
    electionId: 'elec_src_2026',
    positionId: 'pos_pres',
    fullName: 'Kwame Mensah',
    applicationStatus: 'Approved',
    votesReceived: 0,
  });
  seedDoc('candidates/cand_2', {
    electionId: 'elec_src_2026',
    positionId: 'pos_pres',
    fullName: 'Ama Boateng',
    applicationStatus: 'Approved',
    votesReceived: 0,
  });
  seedDoc('candidates/cand_pending', {
    electionId: 'elec_src_2026',
    positionId: 'pos_pres',
    fullName: 'Pending Candidate',
    applicationStatus: 'Submitted',
    votesReceived: 0,
  });
  seedDoc('candidates/cand_sec_1', {
    electionId: 'elec_src_2026',
    positionId: 'pos_sec',
    fullName: 'Kofi Owusu',
    applicationStatus: 'Approved',
    votesReceived: 0,
  });

  seedDoc('students/student_uid_1', {
    uid: 'student_uid_1',
    studentId: 'PS/CSC/21/0001',
    faculty: 'School of Physical Sciences',
    department: 'Computer Science',
    hall: 'Valco Hall',
    level: '300',
    status: 'active',
    isEligible: true,
    eligibilityStatus: 'eligible',
  });
  seedDoc('voter_eligibility/student_uid_1', {
    isEligible: true,
    status: 'eligible',
  });

  seedDoc('students/student_uid_2', {
    uid: 'student_uid_2',
    studentId: 'PS/CSC/21/0002',
    faculty: 'School of Physical Sciences',
    department: 'Computer Science',
    hall: 'Oguaa Hall',
    level: '300',
    status: 'active',
    isEligible: true,
    eligibilityStatus: 'eligible',
  });

  seedDoc('students/ineligible_uid', {
    uid: 'ineligible_uid',
    studentId: 'BS/MGT/21/0099',
    faculty: 'School of Business',
    department: 'Management',
    hall: 'Adehye Hall',
    level: '200',
    status: 'active',
    isEligible: false,
    eligibilityStatus: 'pending_verification',
  });

  const encodeDoc = (fullPath, data) => {
    const fields = {};
    for (const [k, v] of Object.entries(data)) fields[k] = toFsVal(v);
    return { name: fullPath, fields };
  };

  const fetchMock = async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith('https://www.googleapis.com/service_accounts/v1/jwk/')) {
      return new Response(JSON.stringify({ keys: [keys.authPublicJwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' },
      });
    }
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'mock-gcp-access-token', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const authHdr = init.headers?.Authorization || init.headers?.authorization;
    if (authHdr !== 'Bearer mock-gcp-access-token') {
      return new Response(JSON.stringify({ error: { status: 'UNAUTHENTICATED', message: 'Bad token' } }), {
        status: 401,
      });
    }

    const body = init.body ? JSON.parse(String(init.body)) : {};

    if (url.endsWith(':runQuery')) {
      const col = body.structuredQuery.from[0].collectionId;
      const where = body.structuredQuery.where;
      const filters = where.compositeFilter ? where.compositeFilter.filters : [where];
      const matches = [];
      for (const [fullPath, docData] of db.entries()) {
        if (!fullPath.startsWith(`${docRoot}/${col}/`)) continue;
        const ok = filters.every(
          (f) => String(docData[f.fieldFilter.field.fieldPath]) === f.fieldFilter.value.stringValue
        );
        if (ok) matches.push({ document: encodeDoc(fullPath, docData) });
      }
      return new Response(JSON.stringify(matches), { status: 200 });
    }

    if (url.endsWith(':beginTransaction')) {
      const txId = `tx_${++txSeq}`;
      activeTransactions.set(txId, {
        snapshotKeys: new Map(),
      });
      return new Response(JSON.stringify({ transaction: txId }), { status: 200 });
    }

    if (url.endsWith(':rollback')) {
      activeTransactions.delete(body.transaction);
      return new Response('{}', { status: 200 });
    }

    if (url.endsWith(':batchGet')) {
      const tx = body.transaction ? activeTransactions.get(body.transaction) : null;
      const out = [];
      for (const docPath of body.documents) {
        const existing = db.get(docPath);
        if (tx) {
          tx.snapshotKeys.set(docPath, existing ? JSON.stringify(existing) : null);
        }
        if (existing) {
          out.push({ found: encodeDoc(docPath, existing) });
        } else {
          out.push({ missing: docPath });
        }
      }
      return new Response(JSON.stringify(out), { status: 200 });
    }

    if (url.endsWith(':commit')) {
      const tx = activeTransactions.get(body.transaction);
      if (!tx) {
        return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT', message: 'No tx' } }), {
          status: 400,
        });
      }
      activeTransactions.delete(body.transaction);

      // Check optimistic concurrency & preconditions atomically before applying any writes
      for (const w of body.writes) {
        const target = w.update?.name || w.transform?.document;
        const currentExists = db.has(target);
        if (w.currentDocument?.exists === false && currentExists) {
          return new Response(
            JSON.stringify({ error: { status: 'ALREADY_EXISTS', message: 'Document already exists' } }),
            { status: 409 }
          );
        }
        if (w.currentDocument?.exists === true && !currentExists) {
          return new Response(
            JSON.stringify({ error: { status: 'FAILED_PRECONDITION', message: 'Missing doc' } }),
            { status: 400 }
          );
        }
        if (tx.snapshotKeys.has(target)) {
          const snapVal = tx.snapshotKeys.get(target);
          const liveVal = currentExists ? JSON.stringify(db.get(target)) : null;
          if (snapVal !== liveVal) {
            return new Response(
              JSON.stringify({ error: { status: 'ABORTED', message: 'Concurrent modification' } }),
              { status: 409 }
            );
          }
        }
      }

      // Apply all writes atomically
      const nowIso = new Date().toISOString();
      for (const w of body.writes) {
        if (w.update) {
          const target = w.update.name;
          const prev = w.updateMask && db.has(target) ? structuredClone(db.get(target)) : {};
          const incoming = {};
          for (const [k, v] of Object.entries(w.update.fields || {})) {
            incoming[k] = fromFsVal(v);
          }
          const next = { ...prev, ...incoming };
          for (const tr of w.updateTransforms || []) {
            if (tr.setToServerValue) next[tr.fieldPath] = nowIso;
            if (tr.increment) {
              next[tr.fieldPath] = (Number(next[tr.fieldPath]) || 0) + Number(tr.increment.integerValue);
            }
          }
          db.set(target, next);
        } else if (w.transform) {
          const target = w.transform.document;
          const next = structuredClone(db.get(target) || {});
          for (const tr of w.transform.fieldTransforms || []) {
            if (tr.increment) {
              next[tr.fieldPath] = (Number(next[tr.fieldPath]) || 0) + Number(tr.increment.integerValue);
            }
          }
          db.set(target, next);
        }
      }

      return new Response(JSON.stringify({ commitTime: nowIso }), { status: 200 });
    }

    throw new Error(`Unhandled URL in simulator: ${url}`);
  };

  return { db, docRoot, seedDoc, fetchMock };
}

test('Cloudflare Worker submitBallot replacement - full security, secrecy, concurrency, and frontend compatibility suite', async () => {
  const workerMod = await loadWorkerModule();
  const keys = createRsaKeyMaterial();
  const env = {
    FIREBASE_PROJECT_ID: 'ucc-vote',
    FIRESTORE_DATABASE_ID: 'ai-studio-uccvote-84fbbe19-57dc-4b9d-8017-7c3fcf81fe8c',
    ALLOWED_ORIGINS: '*',
    FIREBASE_CLIENT_EMAIL: keys.serviceEmail,
    FIREBASE_PRIVATE_KEY: keys.servicePrivatePem,
  };

  const sim = createTransactionalFirestoreSimulator(keys);
  workerMod.resetWorkerCachesForTests();

  const callWorker = (token, payload) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return workerMod.handleSubmitBallotRequest(
      new Request('https://ucc-vote-submit-ballot.test.workers.dev/', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }),
      env,
      sim.fetchMock
    );
  };

  // 1. Reject unauthenticated, forged, expired, or admin tokens
  const noAuthRes = await callWorker(null, { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1'] } });
  assert.equal(noAuthRes.status, 401);

  const badAudToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { aud: 'wrong-proj' });
  const badAudRes = await callWorker(badAudToken, { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1'] } });
  assert.equal(badAudRes.status, 401);

  const expiredToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', {
    exp: Math.floor(Date.now() / 1000) - 60,
  });
  const expiredRes = await callWorker(expiredToken, { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1'] } });
  assert.equal(expiredRes.status, 401);

  const adminToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', {
    sub: 'admin_uid_1',
    admin: true,
  });
  const adminRes = await callWorker(adminToken, { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1'] } });
  assert.equal(adminRes.status, 403);

  // 2. Reject ineligible voter
  const ineligToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'ineligible_uid' });
  const ineligRes = await callWorker(ineligToken, { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1'] } });
  assert.equal(ineligRes.status, 403);

  // 3. Reject invalid/unapproved candidates, over-selections, and missing required positions
  const student1Token = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'student_uid_1' });
  const pendingCandRes = await callWorker(student1Token, {
    electionId: 'elec_src_2026',
    selections: { pos_pres: ['cand_pending'] },
  });
  assert.equal(pendingCandRes.status, 400);

  const overSelectRes = await callWorker(student1Token, {
    electionId: 'elec_src_2026',
    selections: { pos_pres: ['cand_1', 'cand_2'] },
  });
  assert.equal(overSelectRes.status, 400);

  const missingReqRes = await callWorker(student1Token, {
    electionId: 'elec_src_2026',
    selections: { pos_sec: ['cand_sec_1'] },
  });
  assert.equal(missingReqRes.status, 400);

  // 4. Simultaneous duplicate submission race test (5 parallel submissions from same student)
  const raceResponses = await Promise.all(
    Array.from({ length: 5 }, () =>
      callWorker(student1Token, {
        electionId: 'elec_src_2026',
        selections: { pos_pres: ['cand_1'], pos_sec: ['cand_sec_1'] },
      })
    )
  );
  const raceStatuses = raceResponses.map((r) => r.status).sort();
  assert.deepEqual(raceStatuses, [200, 409, 409, 409, 409]);

  const successBody = await raceResponses.find((r) => r.status === 200).json();
  assert.equal(successBody.success, true);
  assert.ok(successBody.receipt.receiptNumber.startsWith('UCC-ELEC_S-'));
  assert.equal(successBody.receipt.uid, 'student_uid_1');
  assert.equal(successBody.updatedTurnout, 10); // 1 / 10 = 10%

  // 5. Explicit duplicate submission test after successful vote
  const dupRes = await callWorker(student1Token, {
    electionId: 'elec_src_2026',
    selections: { pos_pres: ['cand_2'] },
  });
  assert.equal(dupRes.status, 409);
  const dupJson = await dupRes.json();
  assert.equal(dupJson.code, 'ALREADY_VOTED');

  // 6. Second distinct eligible student votes for cand_2 (result tally & turnout verification)
  const student2Token = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'student_uid_2' });
  const s2Res = await callWorker(student2Token, {
    electionId: 'elec_src_2026',
    selections: { pos_pres: ['cand_2'] },
  });
  assert.equal(s2Res.status, 200);
  const s2Body = await s2Res.json();
  assert.equal(s2Body.updatedTurnout, 20); // 2 / 10 = 20%

  // Verify election & candidate counters
  const electionDoc = sim.db.get(`${sim.docRoot}/elections/elec_src_2026`);
  assert.equal(electionDoc.totalVotesCast, 2);
  assert.equal(electionDoc.turnoutPercentage, 20);
  assert.equal(sim.db.get(`${sim.docRoot}/candidates/cand_1`).votesReceived, 1);
  assert.equal(sim.db.get(`${sim.docRoot}/candidates/cand_2`).votesReceived, 1);
  assert.equal(sim.db.get(`${sim.docRoot}/candidates/cand_sec_1`).votesReceived, 1);

  // 7. Ballot Secrecy verification
  const ballotEntries = Array.from(sim.db.entries()).filter(([k]) =>
    k.startsWith(`${sim.docRoot}/ballots/`)
  );
  assert.equal(ballotEntries.length, 2);
  for (const [, bDoc] of ballotEntries) {
    assert.deepEqual(Object.keys(bDoc).sort(), ['castAt', 'electionId', 'selections']);
    assert.equal(bDoc.uid, undefined);
    assert.equal(bDoc.studentId, undefined);
    assert.equal(bDoc.receiptNumber, undefined);
  }
  const authLock1 = sim.db.get(`${sim.docRoot}/voter_authorisations/elec_src_2026_student_uid_1`);
  assert.equal(authLock1.selections, undefined);
  const receipt1 = sim.db.get(`${sim.docRoot}/vote_confirmations/elec_src_2026_student_uid_1`);
  assert.equal(receipt1.selections, undefined);

  // 8. Inactive/closed election rejection
  sim.seedDoc('elections/elec_closed', {
    title: 'Closed Poll',
    code: 'CLOSED',
    category: 'SRC',
    status: 'closed',
    totalVotesCast: 0,
    totalEligibleVoters: 10,
  });
  sim.seedDoc('positions/pos_closed', {
    electionId: 'elec_closed',
    title: 'President',
    maxSelections: 1,
    allowsSkip: false,
  });
  sim.seedDoc('candidates/cand_closed', {
    electionId: 'elec_closed',
    positionId: 'pos_closed',
    applicationStatus: 'Approved',
  });
  const closedRes = await callWorker(student1Token, {
    electionId: 'elec_closed',
    selections: { pos_closed: ['cand_closed'] },
  });
  assert.equal(closedRes.status, 403);

  // 9. Frontend compatibility test with src/services/votingService.ts
  sim.seedDoc('students/student_uid_3', {
    uid: 'student_uid_3',
    studentId: 'PS/CSC/21/0003',
    faculty: 'School of Physical Sciences',
    department: 'Computer Science',
    hall: 'Valco Hall',
    level: '400',
    status: 'active',
    isEligible: true,
    eligibilityStatus: 'eligible',
  });
  const student3Token = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'student_uid_3' });
  const frontendHarness = await loadVotingServiceWithFetchMock(
    (req, wEnv) => workerMod.handleSubmitBallotRequest(req, wEnv, sim.fetchMock),
    env,
    { uid: 'student_uid_3', getIdToken: async () => student3Token }
  );

  try {
    const feRes1 = await frontendHarness.votingService.submitBallot('elec_src_2026', {
      pos_pres: ['cand_1'],
    });
    assert.equal(feRes1.success, true);
    assert.equal(feRes1.httpStatus, 200);
    assert.equal(feRes1.updatedTurnout, 30);
    assert.ok(feRes1.receipt.receiptNumber);

    const feDup = await frontendHarness.votingService.submitBallot('elec_src_2026', {
      pos_pres: ['cand_2'],
    });
    assert.equal(feDup.success, false);
    assert.equal(feDup.httpStatus, 409);
    assert.equal(feDup.code, 'ALREADY_VOTED');
  } finally {
    frontendHarness.restore();
  }
});
