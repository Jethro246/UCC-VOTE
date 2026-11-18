export interface WorkerEnv {
  FIREBASE_PROJECT_ID?: string;
  FIRESTORE_DATABASE_ID?: string;
  ALLOWED_ORIGINS?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
}

type FetchFn = typeof fetch;

const DEFAULT_PROJECT_ID = 'ucc-vote';
const DEFAULT_DATABASE_ID = 'ai-studio-uccvote-84fbbe19-57dc-4b9d-8017-7c3fcf81fe8c';
const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

interface CachedJwks {
  keysByKid: Map<string, JsonWebKey>;
  expiresAt: number;
}

let jwksCache: CachedJwks | null = null;
const verifiedPublicKeyCache = new Map<string, CryptoKey>();
const signingPrivateKeyCache = new Map<string, CryptoKey>();
const oauthTokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

export function resetWorkerCachesForTests() {
  jwksCache = null;
  verifiedPublicKeyCache.clear();
  signingPrivateKeyCache.clear();
  oauthTokenCache.clear();
}

export class HttpStatusError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getCorsHeaders(request: Request, env: WorkerEnv): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const configured = (env.ALLOWED_ORIGINS || '*').trim();
  let allowOrigin = '*';

  if (configured !== '*') {
    const allowedList = configured
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (origin && allowedList.includes(origin)) {
      allowOrigin = origin;
    } else if (allowedList.length > 0) {
      allowOrigin = allowedList[0];
    }
  } else if (origin) {
    allowOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders,
    },
  });
}

function base64UrlToUint8Array(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeJsonBase64Url(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  return uint8ArrayToBase64Url(bytes);
}

function decodeJsonBase64Url<T>(segment: string): T {
  const bytes = base64UrlToUint8Array(segment);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n').trim();
  const base64Body = normalized
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64Body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function parseServiceAccount(env: WorkerEnv): { clientEmail: string; privateKeyPem: string } {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as Record<string, unknown>;
      const clientEmail = String(parsed.client_email || '').trim();
      const privateKeyPem = String(parsed.private_key || '').trim();
      if (clientEmail && privateKeyPem) {
        return { clientEmail, privateKeyPem };
      }
    } catch {
      throw new HttpStatusError(
        500,
        'SERVER_MISCONFIGURED',
        'Invalid FIREBASE_SERVICE_ACCOUNT_JSON secret configuration.'
      );
    }
  }

  const clientEmail = String(env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKeyPem = String(env.FIREBASE_PRIVATE_KEY || '').trim();
  if (!clientEmail || !privateKeyPem) {
    throw new HttpStatusError(
      503,
      'SERVER_MISCONFIGURED',
      'Ballot worker service account credentials are not configured.'
    );
  }
  return { clientEmail, privateKeyPem };
}

async function fetchJwksKeys(
  fetchImpl: FetchFn,
  forceRefresh = false
): Promise<Map<string, JsonWebKey>> {
  const now = Date.now();
  if (!forceRefresh && jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.keysByKid;
  }

  const res = await fetchImpl(GOOGLE_JWKS_URL);
  if (!res.ok) {
    throw new HttpStatusError(
      503,
      'AUTH_KEY_FETCH_FAILED',
      'Unable to fetch Firebase public signing keys.'
    );
  }

  const data = (await res.json()) as { keys?: Array<JsonWebKey & { kid?: string }> };
  const keysByKid = new Map<string, JsonWebKey>();
  for (const key of data.keys || []) {
    if (key.kid) {
      keysByKid.set(key.kid, key);
    }
  }

  const cacheControl = res.headers.get('Cache-Control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Math.min(86400, Math.max(60, Number(maxAgeMatch[1]))) : 3600;

  jwksCache = {
    keysByKid,
    expiresAt: now + maxAgeSec * 1000,
  };
  return keysByKid;
}

async function getVerificationKey(kid: string, fetchImpl: FetchFn): Promise<CryptoKey> {
  const cached = verifiedPublicKeyCache.get(kid);
  if (cached) return cached;

  let keys = await fetchJwksKeys(fetchImpl, false);
  let jwk = keys.get(kid);
  if (!jwk) {
    keys = await fetchJwksKeys(fetchImpl, true);
    jwk = keys.get(kid);
  }
  if (!jwk) {
    throw new HttpStatusError(401, 'INVALID_TOKEN', 'Unrecognized Firebase ID token key ID.');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  verifiedPublicKeyCache.set(kid, cryptoKey);
  return cryptoKey;
}

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  claims: Record<string, unknown>;
}

export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string,
  fetchImpl: FetchFn = fetch
): Promise<VerifiedFirebaseToken> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new HttpStatusError(401, 'INVALID_TOKEN', 'Malformed Firebase ID token.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = decodeJsonBase64Url<{ alg?: string; kid?: string }>(headerB64);
    payload = decodeJsonBase64Url<Record<string, unknown>>(payloadB64);
  } catch {
    throw new HttpStatusError(401, 'INVALID_TOKEN', 'Invalid Firebase ID token encoding.');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new HttpStatusError(401, 'INVALID_TOKEN', 'Unsupported Firebase ID token signature header.');
  }

  const key = await getVerificationKey(header.kid, fetchImpl);
  const signedBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signatureBytes = base64UrlToUint8Array(signatureB64);

  const validSig = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signatureBytes as BufferSource,
    signedBytes as BufferSource
  );
  if (!validSig) {
    throw new HttpStatusError(401, 'INVALID_TOKEN', 'Firebase ID token signature verification failed.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const exp = Number(payload.exp || 0);
  const iat = Number(payload.iat || 0);
  const authTime = Number(payload.auth_time || 0);
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';

  if (payload.aud !== projectId) {
    throw new HttpStatusError(401, 'INVALID_TOKEN', 'Firebase ID token audience mismatch.');
  }
  if (payload.iss !== expectedIssuer) {
    throw new HttpStatusError(401, 'INVALID_TOKEN', 'Firebase ID token issuer mismatch.');
  }
  if (!sub || sub.length > 128) {
    throw new HttpStatusError(401, 'INVALID_TOKEN', 'Firebase ID token missing valid subject UID.');
  }
  if (!Number.isFinite(exp) || exp <= nowSec) {
    throw new HttpStatusError(401, 'TOKEN_EXPIRED', 'Your authentication session has expired. Sign in again.');
  }
  if (!Number.isFinite(iat) || iat > nowSec + 300 || (authTime && authTime > nowSec + 300)) {
    throw new HttpStatusError(401, 'INVALID_TOKEN', 'Firebase ID token timestamp is invalid.');
  }

  return {
    uid: sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
    claims: payload,
  };
}

async function getSigningKey(clientEmail: string, privateKeyPem: string): Promise<CryptoKey> {
  const cacheKey = `${clientEmail}:${privateKeyPem.length}`;
  const cached = signingPrivateKeyCache.get(cacheKey);
  if (cached) return cached;

  const pkcs8 = pemToArrayBuffer(privateKeyPem);
  const imported = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  signingPrivateKeyCache.set(cacheKey, imported);
  return imported;
}

async function getFirestoreAccessToken(
  env: WorkerEnv,
  fetchImpl: FetchFn
): Promise<string> {
  const { clientEmail, privateKeyPem } = parseServiceAccount(env);
  const now = Date.now();
  const cached = oauthTokenCache.get(clientEmail);
  if (cached && cached.expiresAt - 120_000 > now) {
    return cached.accessToken;
  }

  const nowSec = Math.floor(now / 1000);
  const header = encodeJsonBase64Url({ alg: 'RS256', typ: 'JWT' });
  const claimSet = encodeJsonBase64Url({
    iss: clientEmail,
    sub: clientEmail,
    aud: GOOGLE_TOKEN_URL,
    scope: FIRESTORE_SCOPE,
    iat: nowSec,
    exp: nowSec + 3600,
  });

  const signingInput = `${header}.${claimSet}`;
  const key = await getSigningKey(clientEmail, privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );
  const assertion = `${signingInput}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`;

  const tokenRes = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!tokenRes.ok) {
    throw new HttpStatusError(
      503,
      'FIRESTORE_AUTH_FAILED',
      'Unable to authenticate voting worker with Cloud Firestore.'
    );
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!tokenJson.access_token) {
    throw new HttpStatusError(
      503,
      'FIRESTORE_AUTH_FAILED',
      'OAuth token endpoint returned an empty access token.'
    );
  }

  const expiresInMs = (Number(tokenJson.expires_in) || 3600) * 1000;
  oauthTokenCache.set(clientEmail, {
    accessToken: tokenJson.access_token,
    expiresAt: now + expiresInMs,
  });
  return tokenJson.access_token;
}

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function toFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function encodeFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

function fromFirestoreValue(val: FirestoreValue | undefined): unknown {
  if (!val) return undefined;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('stringValue' in val) return val.stringValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map((item) => fromFirestoreValue(item));
  }
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return undefined;
}

interface FirestoreRestDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
}

function decodeFirestoreDoc(doc: FirestoreRestDocument): Record<string, any> {
  const id = doc.name.split('/').pop() || '';
  const data: Record<string, any> = { id };
  for (const [k, v] of Object.entries(doc.fields || {})) {
    data[k] = fromFirestoreValue(v);
  }
  return data;
}

function evaluateEligibilityAgainstCriteria(
  student: Record<string, any>,
  criteria: Record<string, any> = {},
  electionCategory?: string
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (student.status === 'suspended') {
    reasons.push('Student account is currently suspended.');
  }
  if (student.status === 'unverified') {
    reasons.push('Student account is unverified.');
  }

  const normalize = (val?: unknown) => String(val || '').trim().toLowerCase();

  if (electionCategory === 'GRASAG' && normalize(student.level) !== 'postgraduate') {
    reasons.push('GRASAG elections require Postgraduate enrolment.');
  }

  if (Array.isArray(criteria.faculties) && criteria.faculties.length > 0) {
    const studFac = normalize(student.faculty);
    const matches = criteria.faculties.some(
      (f: string) => studFac.includes(normalize(f)) || normalize(f).includes(studFac)
    );
    if (!matches) reasons.push(`Restricted to faculties: ${criteria.faculties.join(', ')}.`);
  }

  if (Array.isArray(criteria.departments) && criteria.departments.length > 0) {
    const studDept = normalize(student.department);
    const matches = criteria.departments.some(
      (d: string) => studDept.includes(normalize(d)) || normalize(d).includes(studDept)
    );
    if (!matches) reasons.push(`Restricted to departments: ${criteria.departments.join(', ')}.`);
  }

  if (Array.isArray(criteria.halls) && criteria.halls.length > 0) {
    const studHall = normalize(student.hall);
    const matches = criteria.halls.some((h: string) => {
      const target = normalize(h);
      return (
        studHall.includes(target) ||
        target.includes(studHall) ||
        (studHall.includes('casford') && target.includes('casely')) ||
        (studHall.includes('casely') && target.includes('casford'))
      );
    });
    if (!matches) reasons.push(`Restricted to hall(s): ${criteria.halls.join(', ')}.`);
  }

  if (Array.isArray(criteria.levels) && criteria.levels.length > 0) {
    const studLevel = normalize(student.level);
    const matches = criteria.levels.some((l: string) => normalize(l) === studLevel);
    if (!matches) reasons.push(`Restricted to academic level(s): ${criteria.levels.join(', ')}.`);
  }

  return { eligible: reasons.length === 0, reasons };
}

async function firestoreRequest<T>(
  url: string,
  accessToken: string,
  body: unknown,
  fetchImpl: FetchFn
): Promise<T> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let errObj: any = null;
    try {
      errObj = errText ? JSON.parse(errText) : null;
    } catch {
      errObj = null;
    }
    const firestoreStatus = String(errObj?.error?.status || '');
    const message = String(errObj?.error?.message || res.statusText || 'Firestore request failed.');
    const error = new Error(message) as Error & {
      httpStatus?: number;
      firestoreStatus?: string;
    };
    error.httpStatus = res.status;
    error.firestoreStatus = firestoreStatus;
    throw error;
  }

  return (await res.json()) as T;
}

async function rollbackTransactionQuietly(
  baseUrl: string,
  accessToken: string,
  transaction: string,
  fetchImpl: FetchFn
) {
  await fetchImpl(`${baseUrl}:rollback`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transaction }),
  }).catch(() => undefined);
}

async function runEqualityQuery(
  baseUrl: string,
  accessToken: string,
  collectionId: string,
  filters: Array<{ field: string; value: string }>,
  fetchImpl: FetchFn
): Promise<Record<string, any>[]> {
  const whereClause =
    filters.length === 1
      ? {
          fieldFilter: {
            field: { fieldPath: filters[0].field },
            op: 'EQUAL',
            value: { stringValue: filters[0].value },
          },
        }
      : {
          compositeFilter: {
            op: 'AND',
            filters: filters.map((f) => ({
              fieldFilter: {
                field: { fieldPath: f.field },
                op: 'EQUAL',
                value: { stringValue: f.value },
              },
            })),
          },
        };

  const rows = await firestoreRequest<Array<{ document?: FirestoreRestDocument }>>(
    `${baseUrl}:runQuery`,
    accessToken,
    {
      structuredQuery: {
        from: [{ collectionId }],
        where: whereClause,
      },
    },
    fetchImpl
  );

  return rows
    .filter((r) => Boolean(r.document))
    .map((r) => decodeFirestoreDoc(r.document!));
}

export async function handleSubmitBallotRequest(
  request: Request,
  env: WorkerEnv,
  fetchImpl: FetchFn = fetch
): Promise<Response> {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      405,
      { success: false, code: 'METHOD_NOT_ALLOWED', error: 'Only POST requests are permitted.' },
      corsHeaders
    );
  }

  const projectId = (env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID).trim();
  const databaseId = (env.FIRESTORE_DATABASE_ID || DEFAULT_DATABASE_ID).trim();

  try {
    const authHeader = request.headers.get('Authorization') || '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch || !tokenMatch[1]) {
      throw new HttpStatusError(
        401,
        'UNAUTHENTICATED',
        'Authentication is required to cast a ballot.'
      );
    }

    const verifiedToken = await verifyFirebaseIdToken(tokenMatch[1].trim(), projectId, fetchImpl);
    if (verifiedToken.claims.admin === true) {
      throw new HttpStatusError(
        403,
        'ADMIN_VOTING_FORBIDDEN',
        'Electoral Commission administrators are prohibited from casting voter ballots.'
      );
    }
    const uid = verifiedToken.uid;

    let body: any;
    try {
      body = await request.json();
    } catch {
      throw new HttpStatusError(400, 'INVALID_ARGUMENT', 'Request body must be valid JSON.');
    }

    const electionId = String(body?.electionId || '').trim();
    const rawSelections = body?.selections as Record<string, unknown> | undefined;

    if (!electionId || !ID_PATTERN.test(electionId)) {
      throw new HttpStatusError(400, 'INVALID_ARGUMENT', 'Valid electionId is required.');
    }
    if (!rawSelections || typeof rawSelections !== 'object' || Array.isArray(rawSelections)) {
      throw new HttpStatusError(
        400,
        'INVALID_ARGUMENT',
        'Valid electionId and selections map are required.'
      );
    }

    const accessToken = await getFirestoreAccessToken(env, fetchImpl);
    const docRoot = `projects/${projectId}/databases/${databaseId}/documents`;
    const baseUrl = `https://firestore.googleapis.com/v1/${docRoot}`;

    // Pre-load positions and approved candidates for the target election
    const [positions, approvedCandidates] = await Promise.all([
      runEqualityQuery(
        baseUrl,
        accessToken,
        'positions',
        [{ field: 'electionId', value: electionId }],
        fetchImpl
      ),
      runEqualityQuery(
        baseUrl,
        accessToken,
        'candidates',
        [
          { field: 'electionId', value: electionId },
          { field: 'applicationStatus', value: 'Approved' },
        ],
        fetchImpl
      ),
    ]);

    const positionMap = new Map<string, Record<string, any>>();
    for (const pos of positions) {
      positionMap.set(pos.id, pos);
    }

    const candidateMap = new Map<string, Record<string, any>>();
    const approvedCountByPosition = new Map<string, number>();
    for (const cand of approvedCandidates) {
      candidateMap.set(cand.id, cand);
      const pid = String(cand.positionId || '');
      approvedCountByPosition.set(pid, (approvedCountByPosition.get(pid) || 0) + 1);
    }

    const sanitizedSelections: Record<string, string[]> = {};
    const selectedCandidateIds: string[] = [];

    for (const [posId, candIds] of Object.entries(rawSelections)) {
      if (!Array.isArray(candIds) || candIds.length === 0) continue;
      if (!ID_PATTERN.test(posId)) {
        throw new HttpStatusError(400, 'INVALID_ARGUMENT', `Invalid position identifier: ${posId}.`);
      }
      const pos = positionMap.get(posId);
      if (!pos) {
        throw new HttpStatusError(
          400,
          'INVALID_ARGUMENT',
          `Invalid position ${posId} for election ${electionId}.`
        );
      }

      const maxSel = Number(pos.maxSelections) || 1;
      const uniqueCands = Array.from(new Set(candIds.map((c) => String(c).trim()).filter(Boolean)));
      if (uniqueCands.length > maxSel) {
        throw new HttpStatusError(
          400,
          'INVALID_ARGUMENT',
          `Too many selections for ${pos.title || posId} (maximum ${maxSel}).`
        );
      }

      for (const cid of uniqueCands) {
        if (!ID_PATTERN.test(cid)) {
          throw new HttpStatusError(400, 'INVALID_ARGUMENT', `Invalid candidate identifier: ${cid}.`);
        }
        const cand = candidateMap.get(cid);
        if (!cand || cand.positionId !== posId) {
          throw new HttpStatusError(
            400,
            'INVALID_ARGUMENT',
            `Candidate ${cid} is not valid or not approved for position ${posId}.`
          );
        }
        selectedCandidateIds.push(cid);
      }

      sanitizedSelections[posId] = uniqueCands;
    }

    // Check required (non-skippable) positions that have approved candidates
    for (const pos of positions) {
      const hasApprovedCandidates = (approvedCountByPosition.get(pos.id) || 0) > 0;
      if (
        hasApprovedCandidates &&
        pos.allowsSkip !== true &&
        (!sanitizedSelections[pos.id] || sanitizedSelections[pos.id].length === 0)
      ) {
        throw new HttpStatusError(
          400,
          'INVALID_ARGUMENT',
          `Selection required for ${pos.title || pos.id}.`
        );
      }
    }

    const electionDocPath = `${docRoot}/elections/${electionId}`;
    const studentDocPath = `${docRoot}/students/${uid}`;
    const eligDocPath = `${docRoot}/voter_eligibility/${uid}`;
    const authLockDocPath = `${docRoot}/voter_authorisations/${electionId}_${uid}`;
    const receiptDocPath = `${docRoot}/vote_confirmations/${electionId}_${uid}`;
    const adminDocPath = `${docRoot}/admins/${uid}`;

    const MAX_CONTENTION_RETRIES = 3;
    let receiptPayload: Record<string, unknown> | null = null;
    let updatedTurnout = 0;

    for (let attempt = 0; attempt < MAX_CONTENTION_RETRIES; attempt += 1) {
      const txResp = await firestoreRequest<{ transaction?: string }>(
        `${baseUrl}:beginTransaction`,
        accessToken,
        { options: { readWrite: {} } },
        fetchImpl
      );
      const transaction = txResp.transaction;
      if (!transaction) {
        throw new HttpStatusError(
          503,
          'TRANSACTION_FAILED',
          'Firestore did not return a transaction handle.'
        );
      }

      try {
        const batchRes = await firestoreRequest<
          Array<{ found?: FirestoreRestDocument; missing?: string }>
        >(
          `${baseUrl}:batchGet`,
          accessToken,
          {
            transaction,
            documents: [
              electionDocPath,
              studentDocPath,
              eligDocPath,
              authLockDocPath,
              adminDocPath,
            ],
          },
          fetchImpl
        );

        const foundByPath = new Map<string, Record<string, any>>();
        for (const entry of batchRes) {
          if (entry.found) {
            foundByPath.set(entry.found.name, decodeFirestoreDoc(entry.found));
          }
        }

        const adminDoc = foundByPath.get(adminDocPath);
        if (adminDoc && adminDoc.isActive !== false) {
          throw new HttpStatusError(
            403,
            'ADMIN_VOTING_FORBIDDEN',
            'Electoral Commission administrators are prohibited from casting voter ballots.'
          );
        }

        const election = foundByPath.get(electionDocPath);
        if (!election) {
          throw new HttpStatusError(404, 'NOT_FOUND', 'Election does not exist.');
        }
        if (election.status !== 'live') {
          throw new HttpStatusError(
            403,
            'ELECTION_NOT_LIVE',
            'Voting is not currently open for this election.'
          );
        }

        if (selectedCandidateIds.length === 0 && election.allowsEmptyBallot !== true) {
          throw new HttpStatusError(
            400,
            'EMPTY_BALLOT_FORBIDDEN',
            'Empty ballots are not permitted under the rules of this election.'
          );
        }

        const authLockDoc = foundByPath.get(authLockDocPath);
        if (authLockDoc) {
          throw new HttpStatusError(
            409,
            'ALREADY_VOTED',
            'You have already cast your ballot in this election.'
          );
        }

        const student = foundByPath.get(studentDocPath);
        if (!student) {
          throw new HttpStatusError(
            403,
            'STUDENT_NOT_FOUND',
            'Student voter profile not found.'
          );
        }

        const eligRecord = foundByPath.get(eligDocPath) || null;
        const isGlobalEligible = eligRecord
          ? eligRecord.isEligible === true && eligRecord.status === 'eligible'
          : student.isEligible === true && student.eligibilityStatus === 'eligible';

        if (!isGlobalEligible) {
          throw new HttpStatusError(
            403,
            'INELIGIBLE_VOTER',
            'Account is not cleared on the official UCC voter eligibility roll.'
          );
        }

        const criteriaEval = evaluateEligibilityAgainstCriteria(
          student,
          (election.eligibilityCriteria as Record<string, any>) || {},
          typeof election.category === 'string' ? election.category : undefined
        );
        if (!criteriaEval.eligible) {
          throw new HttpStatusError(403, 'INELIGIBLE_VOTER', criteriaEval.reasons.join(' '));
        }

        const nowIso = new Date().toISOString();
        const receiptNumber = `UCC-${electionId.slice(0, 6).toUpperCase()}-${randomHex(3).toUpperCase()}`;
        const cryptographicToken = randomHex(16);
        const ballotId = crypto.randomUUID();
        const ballotDocPath = `${docRoot}/ballots/${ballotId}`;

        const nextVotesCast = (Number(election.totalVotesCast) || 0) + 1;
        const eligibleTotal = Number(election.totalEligibleVoters) || 0;
        const nextTurnout =
          eligibleTotal > 0
            ? Math.min(100, Math.round((nextVotesCast / eligibleTotal) * 1000) / 10)
            : 0;
        updatedTurnout = nextTurnout;

        const receiptDocFields = {
          uid,
          electionId,
          electionTitle: String(election.title || ''),
          electionCode: String(election.code || electionId),
          receiptNumber,
          cryptographicToken,
          positionsCount: Object.keys(sanitizedSelections).length,
          submittedAt: nowIso,
        };

        const writes: Array<Record<string, unknown>> = [
          // 1. Duplicate-vote authorisation lock (identity only, zero candidate selections)
          {
            update: {
              name: authLockDocPath,
              fields: encodeFirestoreFields({
                uid,
                electionId,
                studentId: String(student.studentId || ''),
              }),
            },
            updateTransforms: [
              { fieldPath: 'authorisedAt', setToServerValue: 'REQUEST_TIME' },
            ],
            currentDocument: { exists: false },
          },
          // 2. Anonymized ballot record (selections only, zero identity fields)
          {
            update: {
              name: ballotDocPath,
              fields: encodeFirestoreFields({
                electionId,
                selections: sanitizedSelections,
              }),
            },
            updateTransforms: [
              { fieldPath: 'castAt', setToServerValue: 'REQUEST_TIME' },
            ],
            currentDocument: { exists: false },
          },
          // 3. Voter confirmation receipt (zero candidate selections)
          {
            update: {
              name: receiptDocPath,
              fields: encodeFirestoreFields(receiptDocFields),
            },
            updateTransforms: [
              { fieldPath: 'timestamp', setToServerValue: 'REQUEST_TIME' },
            ],
            currentDocument: { exists: false },
          },
          // 4. Atomic election turnout update
          {
            update: {
              name: electionDocPath,
              fields: encodeFirestoreFields({
                turnoutPercentage: nextTurnout,
              }),
            },
            updateMask: { fieldPaths: ['turnoutPercentage'] },
            updateTransforms: [
              { fieldPath: 'totalVotesCast', increment: { integerValue: '1' } },
              { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
            ],
            currentDocument: { exists: true },
          },
        ];

        // 5. Atomic candidate tally increment for each chosen candidate
        for (const cid of selectedCandidateIds) {
          writes.push({
            transform: {
              document: `${docRoot}/candidates/${cid}`,
              fieldTransforms: [
                { fieldPath: 'votesReceived', increment: { integerValue: '1' } },
              ],
            },
            currentDocument: { exists: true },
          });
        }

        await firestoreRequest(
          `${baseUrl}:commit`,
          accessToken,
          { transaction, writes },
          fetchImpl
        );

        receiptPayload = {
          ...receiptDocFields,
          id: `${electionId}_${uid}`,
          studentId: String(student.studentId || ''),
        };
        break;
      } catch (err: any) {
        await rollbackTransactionQuietly(baseUrl, accessToken, transaction, fetchImpl);

        if (err instanceof HttpStatusError) {
          throw err;
        }

        const fStatus = String(err?.firestoreStatus || '');
        const msg = String(err?.message || '').toLowerCase();

        // Precondition failure or ALREADY_EXISTS on voter_authorisations means duplicate/concurrent vote
        if (
          fStatus === 'ALREADY_EXISTS' ||
          fStatus === 'FAILED_PRECONDITION' ||
          msg.includes('already exists') ||
          msg.includes('stored version')
        ) {
          // Verify whether authLock was created concurrently by another request for this same uid
          const lockCheck = await firestoreRequest<
            Array<{ found?: FirestoreRestDocument }>
          >(
            `${baseUrl}:batchGet`,
            accessToken,
            { documents: [authLockDocPath] },
            fetchImpl
          ).catch(() => []);
          if (lockCheck.some((entry) => entry.found)) {
            throw new HttpStatusError(
              409,
              'ALREADY_VOTED',
              'You have already cast your ballot in this election.'
            );
          }
        }

        if (
          (fStatus === 'ABORTED' || err?.httpStatus === 409) &&
          attempt < MAX_CONTENTION_RETRIES - 1
        ) {
          // Retry transient transaction contention (e.g. concurrent voters updating election totalVotesCast)
          continue;
        }

        if (fStatus === 'ABORTED' || err?.httpStatus === 409) {
          throw new HttpStatusError(
            409,
            'CONCURRENT_SUBMISSION_BLOCKED',
            'Your ballot encountered high simultaneous traffic or a duplicate lock. Please verify your participation status before retrying.'
          );
        }

        throw new HttpStatusError(
          500,
          'TRANSACTION_FAILED',
          err?.message || 'Unable to record ballot transaction cleanly.'
        );
      }
    }

    if (!receiptPayload) {
      throw new HttpStatusError(
        500,
        'TRANSACTION_FAILED',
        'Ballot transaction did not complete.'
      );
    }

    return jsonResponse(
      200,
      {
        success: true,
        message: 'Ballot recorded securely in Firebase.',
        receipt: receiptPayload,
        updatedTurnout,
      },
      corsHeaders
    );
  } catch (err: any) {
    if (err instanceof HttpStatusError) {
      return jsonResponse(
        err.status,
        {
          success: false,
          code: err.code,
          error: err.message,
        },
        corsHeaders
      );
    }

    return jsonResponse(
      500,
      {
        success: false,
        code: 'INTERNAL_ERROR',
        error: err?.message || 'Unexpected error while submitting ballot.',
      },
      corsHeaders
    );
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleSubmitBallotRequest(request, env, fetch);
  },
};
