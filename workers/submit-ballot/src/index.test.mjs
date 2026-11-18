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
  let injectedCommitErrorMessage = null;

  const seedDoc = (relPath, data) => {
    db.set(`${docRoot}/${relPath}`, structuredClone(data));
  };

  const setInjectedCommitError = (msg) => {
    injectedCommitErrorMessage = msg;
  };

  seedDoc('elections/elec_src_2026', {
    title: 'UCC SRC General Election 2026',
    code: 'SRC-2026',
    category: 'SRC',
    domainId: 'src',
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
    fullName: 'Esi Mensah',
    faculty: 'School of Physical Sciences',
    department: 'Computer Science',
    hall: 'Valco Hall',
    level: '300',
    status: 'active',
    isEligible: true,
    eligibilityStatus: 'eligible',
    emailVerified: true,
    hasVotedElections: [],
  });
  seedDoc('voter_eligibility/student_uid_1', {
    isEligible: true,
    status: 'eligible',
  });

  seedDoc('students/student_uid_2', {
    uid: 'student_uid_2',
    studentId: 'PS/CSC/21/0002',
    fullName: 'Yaw Boateng',
    faculty: 'School of Physical Sciences',
    department: 'Computer Science',
    hall: 'Oguaa Hall',
    level: '300',
    status: 'active',
    isEligible: true,
    eligibilityStatus: 'eligible',
    emailVerified: true,
    hasVotedElections: [],
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
    emailVerified: true,
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
      if (injectedCommitErrorMessage) {
        activeTransactions.delete(body.transaction);
        const msg = injectedCommitErrorMessage;
        injectedCommitErrorMessage = null;
        return new Response(JSON.stringify({ error: { status: 'INTERNAL', message: msg } }), {
          status: 500,
        });
      }

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
            if (tr.setToServerValue) {
              next[tr.fieldPath] = nowIso;
            }
            if (tr.appendMissingElements) {
              const existingArr = Array.isArray(next[tr.fieldPath]) ? [...next[tr.fieldPath]] : [];
              for (const rawVal of tr.appendMissingElements.values || []) {
                const decoded = fromFsVal(rawVal);
                if (!existingArr.some((item) => JSON.stringify(item) === JSON.stringify(decoded))) {
                  existingArr.push(decoded);
                }
              }
              next[tr.fieldPath] = existingArr;
            }
          }
          db.set(target, next);
        }
      }

      return new Response(JSON.stringify({ commitTime: nowIso }), { status: 200 });
    }

    throw new Error(`Unhandled URL in simulator: ${url}`);
  };

  return { db, docRoot, seedDoc, setInjectedCommitError, fetchMock };
}

test('Cloudflare Worker submitBallot replacement - authentication, security, CORS, and error sanitization', async () => {
  const workerMod = await loadWorkerModule();
  const keys = createRsaKeyMaterial();
  const env = {
    FIREBASE_PROJECT_ID: 'ucc-vote',
    FIRESTORE_DATABASE_ID: 'ai-studio-uccvote-84fbbe19-57dc-4b9d-8017-7c3fcf81fe8c',
    ALLOWED_ORIGINS: 'https://ucc-vote.vercel.app,https://ucc-vote.web.app',
    FIREBASE_CLIENT_EMAIL: keys.serviceEmail,
    FIREBASE_PRIVATE_KEY: keys.servicePrivatePem,
  };

  const sim = createTransactionalFirestoreSimulator(keys);
  workerMod.resetWorkerCachesForTests();

  const callWorker = (token, payload, extraHeaders = {}, method = 'POST') => {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (token) headers.Authorization = `Bearer ${token}`;
    return workerMod.handleSubmitBallotRequest(
      new Request('https://ucc-vote-submit-ballot.test.workers.dev/', {
        method,
        headers,
        body: method === 'POST' ? JSON.stringify(payload) : undefined,
      }),
      env,
      sim.fetchMock
    );
  };

  // 1 & 2. Missing / malformed / wrong-audience / forged signature tokens rejected
  const noAuthRes = await callWorker(null, { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1'] } });
  assert.equal(noAuthRes.status, 401);

  const badAudToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { aud: 'wrong-proj' });
  const badAudRes = await callWorker(badAudToken, { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1'] } });
  assert.equal(badAudRes.status, 401);

  const badIssToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', {
    iss: 'https://evil.example.com/ucc-vote',
  });
  const badIssRes = await callWorker(badIssToken, { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1'] } });
  assert.equal(badIssRes.status, 401);

  const validToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'student_uid_1' });
  const tamperedParts = validToken.split('.');
  tamperedParts[1] = Buffer.from(
    JSON.stringify({
      iss: 'https://securetoken.google.com/ucc-vote',
      aud: 'ucc-vote',
      sub: 'student_uid_2',
      email_verified: true,
      iat: Math.floor(Date.now() / 1000) - 10,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url');
  const forgedRes = await callWorker(tamperedParts.join('.'), {
    electionId: 'elec_src_2026',
    selections: { pos_pres: ['cand_1'] },
  });
  assert.equal(forgedRes.status, 401);

  // 3. Expired token rejected
  const expiredToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', {
    exp: Math.floor(Date.now() / 1000) - 60,
  });
  const expiredRes = await callWorker(expiredToken, { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1'] } });
  assert.equal(expiredRes.status, 401);
  assert.equal((await expiredRes.json()).code, 'TOKEN_EXPIRED');

  // 4. Unverified email rejected (both token email_verified=false and student.emailVerified!=true)
  sim.seedDoc('students/unverified_email_uid', {
    uid: 'unverified_email_uid',
    studentId: 'PS/CSC/21/0088',
    faculty: 'School of Physical Sciences',
    department: 'Computer Science',
    hall: 'Valco Hall',
    level: '300',
    status: 'active',
    isEligible: true,
    eligibilityStatus: 'eligible',
    emailVerified: false,
  });
  const unverifiedToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', {
    sub: 'unverified_email_uid',
    email_verified: false,
  });
  const unverifiedRes = await callWorker(unverifiedToken, {
    electionId: 'elec_src_2026',
    selections: { pos_pres: ['cand_1'] },
  });
  assert.equal(unverifiedRes.status, 403);
  const unverifiedJson = await unverifiedRes.json();
  assert.match(unverifiedJson.error, /verify your university email/i);

  // 5. Administrator voting prohibition (custom claim AND admins/{uid} doc)
  const adminToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', {
    sub: 'admin_uid_1',
    admin: true,
  });
  const adminRes = await callWorker(adminToken, { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1'] } });
  assert.equal(adminRes.status, 403);
  assert.equal((await adminRes.json()).code, 'ADMIN_VOTING_FORBIDDEN');

  sim.seedDoc('admins/admin_doc_uid', { uid: 'admin_doc_uid', isActive: true, role: 'Returning Officer' });
  sim.seedDoc('students/admin_doc_uid', {
    uid: 'admin_doc_uid',
    isEligible: true,
    eligibilityStatus: 'eligible',
    emailVerified: true,
  });
  const adminDocToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'admin_doc_uid' });
  const adminDocRes = await callWorker(adminDocToken, {
    electionId: 'elec_src_2026',
    selections: { pos_pres: ['cand_1'] },
  });
  assert.equal(adminDocRes.status, 403);
  assert.equal((await adminDocRes.json()).code, 'ADMIN_VOTING_FORBIDDEN');

  // 28. CORS rejection of unapproved origins (OPTIONS + POST) & approval of ucc-vote.vercel.app
  const evilPreflight = await callWorker(
    null,
    null,
    { Origin: 'https://evil-phishing.example.com' },
    'OPTIONS'
  );
  assert.equal(evilPreflight.status, 403);
  assert.equal(evilPreflight.headers.get('Access-Control-Allow-Origin'), null);

  const evilPost = await callWorker(
    validToken,
    { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1'] } },
    { Origin: 'https://evil-phishing.example.com' },
    'POST'
  );
  assert.equal(evilPost.status, 403);
  assert.equal((await evilPost.json()).code, 'CORS_ORIGIN_FORBIDDEN');
  assert.equal(evilPost.headers.get('Access-Control-Allow-Origin'), null);

  const goodPreflight = await callWorker(
    null,
    null,
    { Origin: 'https://ucc-vote.vercel.app' },
    'OPTIONS'
  );
  assert.equal(goodPreflight.status, 204);
  assert.equal(goodPreflight.headers.get('Access-Control-Allow-Origin'), 'https://ucc-vote.vercel.app');

  // 27. Sanitized server errors (internal exception details must not leak)
  sim.setInjectedCommitError('INTERNAL_SECRET_DIAGNOSTIC: private-key-path=/etc/sa.json rpc-detail=xyz');
  const errRes = await callWorker(
    validToken,
    { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1'] } },
    { Origin: 'https://ucc-vote.vercel.app' }
  );
  assert.equal(errRes.status, 500);
  const errBody = await errRes.json();
  assert.equal(errBody.code, 'TRANSACTION_FAILED');
  assert.equal(errBody.error.includes('INTERNAL_SECRET_DIAGNOSTIC'), false);
  assert.equal(errBody.error.includes('/etc/sa.json'), false);
  assert.equal(errRes.headers.get('Access-Control-Allow-Origin'), 'https://ucc-vote.vercel.app');
});

test('Cloudflare Worker submitBallot replacement - voter eligibility, 8-hall isolation, eligRecord overrides, and ballot validation', async () => {
  const workerMod = await loadWorkerModule();
  const keys = createRsaKeyMaterial();
  const env = {
    FIREBASE_PROJECT_ID: 'ucc-vote',
    FIRESTORE_DATABASE_ID: 'ai-studio-uccvote-84fbbe19-57dc-4b9d-8017-7c3fcf81fe8c',
    ALLOWED_ORIGINS: 'https://ucc-vote.vercel.app',
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

  // 7. Ineligible voter rejection (pending_verification & suspended)
  const ineligToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'ineligible_uid' });
  const ineligRes = await callWorker(ineligToken, { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1'] } });
  assert.equal(ineligRes.status, 403);

  sim.seedDoc('students/suspended_uid', {
    uid: 'suspended_uid',
    status: 'suspended',
    isEligible: true,
    eligibilityStatus: 'eligible',
    emailVerified: true,
  });
  const suspendedToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'suspended_uid' });
  const suspendedRes = await callWorker(suspendedToken, {
    electionId: 'elec_src_2026',
    selections: { pos_pres: ['cand_1'] },
  });
  assert.equal(suspendedRes.status, 403);

  // 8. Faculty, department, level (GRASAG) eligibility & eligRecord overrides
  sim.seedDoc('elections/elec_sci_300', {
    title: 'Physical Sciences Level 300 Poll',
    code: 'SCI-300',
    category: 'Faculty / School',
    domainId: 'faculty_school',
    status: 'live',
    totalVotesCast: 0,
    totalEligibleVoters: 50,
    eligibilityCriteria: {
      faculties: ['School of Physical Sciences'],
      departments: ['Computer Science'],
      levels: ['300'],
    },
  });
  sim.seedDoc('positions/pos_sci', {
    electionId: 'elec_sci_300',
    title: 'Faculty Rep',
    maxSelections: 1,
    allowsSkip: false,
    order: 1,
  });
  sim.seedDoc('candidates/cand_sci', {
    electionId: 'elec_sci_300',
    positionId: 'pos_sci',
    fullName: 'Abena Sci',
    applicationStatus: 'Approved',
    votesReceived: 0,
  });

  // Student whose student doc says Business/200, but authoritative voter_eligibility overrides to Physical Sciences/CSC/300
  sim.seedDoc('students/override_uid', {
    uid: 'override_uid',
    studentId: 'PS/CSC/21/0111',
    faculty: 'School of Business',
    department: 'Accounting',
    level: '200',
    hall: 'Oguaa Hall',
    status: 'active',
    isEligible: false,
    eligibilityStatus: 'pending_verification',
    emailVerified: true,
  });
  sim.seedDoc('voter_eligibility/override_uid', {
    isEligible: true,
    status: 'eligible',
    faculty: 'School of Physical Sciences',
    department: 'Computer Science',
    level: '300',
    hall: 'Valco Hall',
  });
  const overrideToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'override_uid' });
  const overrideOk = await callWorker(overrideToken, {
    electionId: 'elec_sci_300',
    selections: { pos_sci: ['cand_sci'] },
  });
  assert.equal(overrideOk.status, 200);

  // Student with wrong faculty/department/level rejected
  sim.seedDoc('students/wrong_dept_uid', {
    uid: 'wrong_dept_uid',
    faculty: 'School of Physical Sciences',
    department: 'Mathematics',
    level: '300',
    status: 'active',
    isEligible: true,
    eligibilityStatus: 'eligible',
    emailVerified: true,
  });
  const wrongDeptToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'wrong_dept_uid' });
  assert.equal(
    (await callWorker(wrongDeptToken, { electionId: 'elec_sci_300', selections: { pos_sci: ['cand_sci'] } })).status,
    403
  );

  // GRASAG requires Postgraduate
  sim.seedDoc('elections/elec_grasag', {
    title: 'GRASAG Election',
    code: 'GRASAG-2026',
    category: 'GRASAG',
    domainId: 'grasag',
    status: 'live',
    totalVotesCast: 0,
    totalEligibleVoters: 10,
    eligibilityCriteria: {},
  });
  sim.seedDoc('positions/pos_grasag', {
    electionId: 'elec_grasag',
    title: 'GRASAG President',
    maxSelections: 1,
    allowsSkip: false,
  });
  sim.seedDoc('candidates/cand_grasag', {
    electionId: 'elec_grasag',
    positionId: 'pos_grasag',
    applicationStatus: 'Approved',
  });
  const undergradToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'student_uid_1' });
  assert.equal(
    (await callWorker(undergradToken, { electionId: 'elec_grasag', selections: { pos_grasag: ['cand_grasag'] } })).status,
    403
  );

  // 9, 10, 11, 12, 13. Hall rules: official 8 halls, SRC vs SRC Hall isolation, Off-campus restriction, hallId/subdomainLabel fallback, candidate hall mismatch
  sim.seedDoc('elections/elec_src_hall', {
    title: 'SRC Hall JCRC Election',
    code: 'SRH-2026',
    category: 'JCR / Hall',
    domainId: 'jcrc_hall',
    hallId: 'hall-src',
    status: 'live',
    totalVotesCast: 0,
    totalEligibleVoters: 20,
    eligibilityCriteria: {}, // relies on hallId fallback!
  });
  sim.seedDoc('positions/pos_srh', {
    electionId: 'elec_src_hall',
    title: 'SRC Hall President',
    maxSelections: 1,
    allowsSkip: false,
  });
  sim.seedDoc('candidates/cand_srh_valid', {
    electionId: 'elec_src_hall',
    positionId: 'pos_srh',
    fullName: 'Kojo SRC Hall',
    hall: 'SRC Hall',
    hallId: 'hall-src',
    applicationStatus: 'Approved',
    votesReceived: 0,
  });
  sim.seedDoc('candidates/cand_srh_wrong_hall', {
    electionId: 'elec_src_hall',
    positionId: 'pos_srh',
    fullName: 'Cross Hall Candidate',
    hall: 'Valco Hall',
    hallId: 'hall-valco',
    applicationStatus: 'Approved',
    votesReceived: 0,
  });

  // Student claiming generic "SRC" must NOT match "SRC Hall" (SRC vs SRC Hall isolation)
  sim.seedDoc('students/src_plain_uid', {
    uid: 'src_plain_uid',
    hall: 'SRC',
    status: 'active',
    isEligible: true,
    eligibilityStatus: 'eligible',
    emailVerified: true,
  });
  const srcPlainToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'src_plain_uid' });
  const srcPlainRes = await callWorker(srcPlainToken, {
    electionId: 'elec_src_hall',
    selections: { pos_srh: ['cand_srh_valid'] },
  });
  assert.equal(srcPlainRes.status, 403);
  assert.match((await srcPlainRes.json()).error, /hall affiliation could not be verified/i);

  // Off-campus / non-resident student must be rejected from hall elections
  sim.seedDoc('students/offcampus_uid', {
    uid: 'offcampus_uid',
    hall: 'Non-Resident / Off-Campus',
    status: 'active',
    isEligible: true,
    eligibilityStatus: 'eligible',
    emailVerified: true,
  });
  const offCampusToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'offcampus_uid' });
  assert.equal(
    (await callWorker(offCampusToken, { electionId: 'elec_src_hall', selections: { pos_srh: ['cand_srh_valid'] } })).status,
    403
  );

  // Actual SRC Hall resident fails if picking candidate from Valco Hall (13. candidate-to-hall mismatch)
  sim.seedDoc('students/srh_voter_uid', {
    uid: 'srh_voter_uid',
    hall: 'SRC Hostel',
    status: 'active',
    isEligible: true,
    eligibilityStatus: 'eligible',
    emailVerified: true,
  });
  const srhVoterToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'srh_voter_uid' });
  const crossHallCandRes = await callWorker(srhVoterToken, {
    electionId: 'elec_src_hall',
    selections: { pos_srh: ['cand_srh_wrong_hall'] },
  });
  assert.equal(crossHallCandRes.status, 400);
  assert.match((await crossHallCandRes.json()).error, /not affiliated with the target hall/i);

  // Actual SRC Hall resident succeeds picking valid SRC Hall candidate via hallId fallback
  const srhOkRes = await callWorker(srhVoterToken, {
    electionId: 'elec_src_hall',
    selections: { pos_srh: ['cand_srh_valid'] },
  });
  assert.equal(srhOkRes.status, 200);

  // SubdomainLabel fallback + Casford/Super Hall official alias matching
  sim.seedDoc('elections/elec_casford', {
    title: 'Casford JCRC Election',
    code: 'CAS-2026',
    category: 'JCR / Hall',
    domainId: 'jcrc_hall',
    subdomainLabel: 'Casely Hayford Hall',
    status: 'live',
    totalVotesCast: 0,
    totalEligibleVoters: 10,
    eligibilityCriteria: {},
  });
  sim.seedDoc('positions/pos_cas', {
    electionId: 'elec_casford',
    title: 'Hall President',
    maxSelections: 1,
    allowsSkip: false,
  });
  sim.seedDoc('candidates/cand_cas', {
    electionId: 'elec_casford',
    positionId: 'pos_cas',
    hall: 'Casford',
    applicationStatus: 'Approved',
  });
  sim.seedDoc('students/casford_uid', {
    uid: 'casford_uid',
    hall: 'Casford',
    status: 'active',
    isEligible: true,
    eligibilityStatus: 'eligible',
    emailVerified: true,
  });
  const casfordToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'casford_uid' });
  assert.equal(
    (await callWorker(casfordToken, { electionId: 'elec_casford', selections: { pos_cas: ['cand_cas'] } })).status,
    200
  );
  // Valco student rejected from Casford election via subdomainLabel fallback
  const valcoToken = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'student_uid_1' });
  assert.equal(
    (await callWorker(valcoToken, { electionId: 'elec_casford', selections: { pos_cas: ['cand_cas'] } })).status,
    403
  );

  // 14, 15, 16, 17. Candidate, position, max selection, and empty ballot validation
  const student1Token = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'student_uid_1' });
  assert.equal(
    (await callWorker(student1Token, { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_pending'] } })).status,
    400
  );
  assert.equal(
    (await callWorker(student1Token, { electionId: 'elec_src_2026', selections: { pos_nonexistent: ['cand_1'] } })).status,
    400
  );
  assert.equal(
    (await callWorker(student1Token, { electionId: 'elec_src_2026', selections: { pos_pres: ['cand_1', 'cand_2'] } })).status,
    400
  );
  assert.equal(
    (await callWorker(student1Token, { electionId: 'elec_src_2026', selections: { pos_sec: ['cand_sec_1'] } })).status,
    400
  );
  assert.equal(
    (await callWorker(student1Token, { electionId: 'elec_src_2026', selections: {} })).status,
    400
  );

  // Empty ballot allowed when allowsEmptyBallot === true and positions allow skip
  sim.seedDoc('elections/elec_empty_ok', {
    title: 'Optional Poll',
    code: 'OPT-2026',
    category: 'SRC',
    status: 'live',
    allowsEmptyBallot: true,
    totalVotesCast: 0,
    totalEligibleVoters: 10,
    eligibilityCriteria: {},
  });
  sim.seedDoc('positions/pos_opt', {
    electionId: 'elec_empty_ok',
    title: 'Optional Role',
    maxSelections: 1,
    allowsSkip: true,
    order: 1,
  });
  sim.seedDoc('candidates/cand_opt', {
    electionId: 'elec_empty_ok',
    positionId: 'pos_opt',
    applicationStatus: 'Approved',
  });
  const emptyOkRes = await callWorker(student1Token, { electionId: 'elec_empty_ok', selections: {} });
  assert.equal(emptyOkRes.status, 200);
  const emptyOkBody = await emptyOkRes.json();
  assert.deepEqual(emptyOkBody.receipt.positionsCompleted, [
    { id: 'pos_opt', title: 'Optional Role', status: 'ABSTAINED' },
  ]);
});

test('Cloudflare Worker submitBallot replacement - concurrency, idempotency, student status, receipt schema, secrecy, and frontend integration', async () => {
  const workerMod = await loadWorkerModule();
  const keys = createRsaKeyMaterial();
  const env = {
    FIREBASE_PROJECT_ID: 'ucc-vote',
    FIRESTORE_DATABASE_ID: 'ai-studio-uccvote-84fbbe19-57dc-4b9d-8017-7c3fcf81fe8c',
    ALLOWED_ORIGINS: 'https://ucc-vote.vercel.app',
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

  const student1Token = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'student_uid_1' });

  // 19. Simultaneous duplicate submission race test (5 parallel submissions without shared key)
  const raceResponses = await Promise.all(
    Array.from({ length: 5 }, (_, idx) =>
      callWorker(student1Token, {
        electionId: 'elec_src_2026',
        selections: { pos_pres: ['cand_1'] },
        idempotencyKey: `race-key-${idx}`,
      })
    )
  );
  const raceStatuses = raceResponses.map((r) => r.status).sort();
  assert.deepEqual(raceStatuses, [200, 409, 409, 409, 409]);

  // 25. Receipt schema compatibility check (matches VoteConfirmationReceipt & DigitalBallotPreviewPage)
  const successBody = await raceResponses.find((r) => r.status === 200).json();
  assert.equal(successBody.success, true);
  assert.equal(successBody.updatedTurnout, 10);
  const r1 = successBody.receipt;
  assert.ok(r1.confirmationRef.startsWith('UCC-ELEC_S-'));
  assert.match(r1.receiptHash, /^[a-f0-9]{64}$/);
  assert.equal(r1.electionCategory, 'SRC');
  assert.equal(r1.domainId, 'src');
  assert.equal(r1.electionCode, 'SRC-2026');
  assert.equal(r1.positionsCount, 1);
  assert.equal(typeof r1.message, 'string');
  assert.ok(r1.message.length > 0);
  assert.deepEqual(r1.positionsCompleted, [
    { id: 'pos_pres', title: 'SRC President', status: 'VOTED' },
    { id: 'pos_sec', title: 'SRC General Secretary', status: 'ABSTAINED' },
  ]);
  assert.equal(r1.receiptNumber, undefined);
  assert.equal(r1.cryptographicToken, undefined);

  // 24. Student hasVotedElections updated & unrelated fields preserved
  const s1Doc = sim.db.get(`${sim.docRoot}/students/student_uid_1`);
  assert.deepEqual(s1Doc.hasVotedElections, ['elec_src_2026']);
  assert.equal(s1Doc.fullName, 'Esi Mensah');
  assert.equal(s1Doc.studentId, 'PS/CSC/21/0001');
  assert.ok(typeof s1Doc.updatedAt === 'string');

  // 20 & 21. Idempotent retry with SAME key returns original receipt without double-counting; DIFFERENT key rejected
  const student2Token = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'student_uid_2' });
  const retryKey = 'idem-student2-attempt-1';
  const s2First = await callWorker(student2Token, {
    electionId: 'elec_src_2026',
    selections: { pos_pres: ['cand_2'], pos_sec: ['cand_sec_1'] },
    idempotencyKey: retryKey,
  });
  assert.equal(s2First.status, 200);
  const s2FirstBody = await s2First.json();

  const s2SameKeyRetry = await callWorker(student2Token, {
    electionId: 'elec_src_2026',
    selections: { pos_pres: ['cand_2'], pos_sec: ['cand_sec_1'] },
    idempotencyKey: retryKey,
  });
  assert.equal(s2SameKeyRetry.status, 200);
  const s2RetryBody = await s2SameKeyRetry.json();
  assert.equal(s2RetryBody.receipt.confirmationRef, s2FirstBody.receipt.confirmationRef);
  assert.equal(s2RetryBody.receipt.receiptHash, s2FirstBody.receipt.receiptHash);

  // 18 & 21. Different key or omitted key rejected as duplicate vote
  const s2DiffKey = await callWorker(student2Token, {
    electionId: 'elec_src_2026',
    selections: { pos_pres: ['cand_1'] },
    idempotencyKey: 'idem-student2-different',
  });
  assert.equal(s2DiffKey.status, 409);
  assert.equal((await s2DiffKey.json()).code, 'ALREADY_VOTED');

  // 22 & 23. Election & candidate counters updated exactly once per voter (2 total voters, not 3!)
  const electionDoc = sim.db.get(`${sim.docRoot}/elections/elec_src_2026`);
  assert.equal(electionDoc.totalVotesCast, 2);
  assert.equal(electionDoc.turnoutPercentage, 20);
  assert.equal(sim.db.get(`${sim.docRoot}/candidates/cand_1`).votesReceived, 1);
  assert.equal(sim.db.get(`${sim.docRoot}/candidates/cand_2`).votesReceived, 1);
  assert.equal(sim.db.get(`${sim.docRoot}/candidates/cand_sec_1`).votesReceived, 1);

  // 26. Ballot secrecy verification across ballots, voter_authorisations, and vote_confirmations
  const ballotEntries = Array.from(sim.db.entries()).filter(([k]) =>
    k.startsWith(`${sim.docRoot}/ballots/`)
  );
  assert.equal(ballotEntries.length, 2);
  for (const [, bDoc] of ballotEntries) {
    assert.deepEqual(Object.keys(bDoc).sort(), ['castAt', 'electionId', 'selections']);
    assert.equal(bDoc.uid, undefined);
    assert.equal(bDoc.studentId, undefined);
    assert.equal(bDoc.confirmationRef, undefined);
  }
  const authLock2 = sim.db.get(`${sim.docRoot}/voter_authorisations/elec_src_2026_student_uid_2`);
  assert.equal(authLock2.selections, undefined);
  assert.equal(authLock2.idempotencyKey, retryKey);
  const receipt2 = sim.db.get(`${sim.docRoot}/vote_confirmations/elec_src_2026_student_uid_2`);
  assert.equal(receipt2.selections, undefined);
  assert.ok(typeof receipt2.timestamp === 'string');
  assert.equal(receipt2.confirmationRef, s2FirstBody.receipt.confirmationRef);

  // Frontend votingService.ts compatibility test (verifies DigitalBallotPreviewPage & StudentProfilePage receipt shape)
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
    emailVerified: true,
    hasVotedElections: [],
  });
  const student3Token = signFirebaseIdToken(keys.authPrivateKey, 'test-firebase-kid-1', { sub: 'student_uid_3' });
  const frontendHarness = await loadVotingServiceWithFetchMock(
    (req, wEnv) => workerMod.handleSubmitBallotRequest(req, wEnv, sim.fetchMock),
    env,
    { uid: 'student_uid_3', getIdToken: async () => student3Token }
  );

  try {
    const feKey = 'idem-fe-3';
    const feRes1 = await frontendHarness.votingService.submitBallot(
      'elec_src_2026',
      { pos_pres: ['cand_1'] },
      feKey
    );
    assert.equal(feRes1.success, true);
    assert.equal(feRes1.httpStatus, 200);
    assert.equal(feRes1.updatedTurnout, 30);
    assert.ok(feRes1.receipt.confirmationRef.startsWith('UCC-ELEC_S-'));
    assert.match(feRes1.receipt.receiptHash, /^[a-f0-9]{64}$/);
    assert.equal(feRes1.receipt.electionCategory, 'SRC');
    assert.equal(Array.isArray(feRes1.receipt.positionsCompleted), true);
    assert.equal(feRes1.receipt.positionsCompleted.length, 2);

    // Same idempotency key network retry via frontend service succeeds with original receipt
    const feRetry = await frontendHarness.votingService.submitBallot(
      'elec_src_2026',
      { pos_pres: ['cand_1'] },
      feKey
    );
    assert.equal(feRetry.success, true);
    assert.equal(feRetry.receipt.confirmationRef, feRes1.receipt.confirmationRef);
    assert.equal(sim.db.get(`${sim.docRoot}/elections/elec_src_2026`).totalVotesCast, 3);

    // Subsequent vote with different key fails as ALREADY_VOTED
    const feDup = await frontendHarness.votingService.submitBallot(
      'elec_src_2026',
      { pos_pres: ['cand_2'] },
      'idem-fe-3-second'
    );
    assert.equal(feDup.success, false);
    assert.equal(feDup.httpStatus, 409);
    assert.equal(feDup.code, 'ALREADY_VOTED');
  } finally {
    frontendHarness.restore();
  }
});
