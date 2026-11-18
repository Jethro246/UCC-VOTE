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
const DEFAULT_ALLOWED_ORIGINS =
  'https://ucc-vote.vercel.app,https://ucc-vote.web.app,https://ucc-vote.firebaseapp.com';
const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

const UNVERIFIED_HALL_MESSAGE =
  'Your hall affiliation could not be verified. Please contact the appropriate administrator.';

interface CanonicalHall {
  id: string;
  code: string;
  name: string;
  shortName: string;
}

const OFFICIAL_UCC_HALLS: CanonicalHall[] = [
  { id: 'hall-adehye', code: 'ADH', name: 'Adehye Hall', shortName: 'Adehye' },
  { id: 'hall-atlantic', code: 'ATL', name: 'Atlantic Hall', shortName: 'ATL' },
  { id: 'hall-casford', code: 'CHF', name: 'Casely Hayford Hall', shortName: 'Casford' },
  { id: 'hall-nkrumah', code: 'KNH', name: 'Kwame Nkrumah Hall', shortName: 'KNH' },
  { id: 'hall-oguaa', code: 'OGU', name: 'Oguaa Hall', shortName: 'Oguaa' },
  { id: 'hall-valco', code: 'VLC', name: 'Valco Hall', shortName: 'Valco' },
  { id: 'hall-src', code: 'SRH', name: 'SRC Hall', shortName: 'SRC Hall' },
  { id: 'hall-superannuation', code: 'SUP', name: 'Superannuation Hall', shortName: 'Super Hall' },
];

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

function resolveCors(
  request: Request,
  env: WorkerEnv
): { allowed: boolean; headers: Record<string, string> } {
  const origin = (request.headers.get('Origin') || '').trim();
  const configured = (env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS).trim();

  const baseHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (!origin) {
    return { allowed: true, headers: baseHeaders };
  }

  if (configured === '*') {
    return {
      allowed: true,
      headers: {
        ...baseHeaders,
        'Access-Control-Allow-Origin': origin,
      },
    };
  }

  const allowedList = configured
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const normalizedOrigin = origin.replace(/\/+$/, '');
  if (allowedList.includes(normalizedOrigin)) {
    return {
      allowed: true,
      headers: {
        ...baseHeaders,
        'Access-Control-Allow-Origin': origin,
      },
    };
  }

  return {
    allowed: false,
    headers: { Vary: 'Origin' },
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

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
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
        'Voting service credentials are improperly configured.'
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
    throw new HttpStatusError(
      401,
      'INVALID_TOKEN',
      'Unsupported Firebase ID token signature header.'
    );
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
    throw new HttpStatusError(
      401,
      'INVALID_TOKEN',
      'Firebase ID token signature verification failed.'
    );
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
  if (!sub || sub.length > 128 || sub.includes('/') || sub === '.' || sub.includes('..')) {
    throw new HttpStatusError(401, 'INVALID_TOKEN', 'Firebase ID token missing valid subject UID.');
  }
  if (typeof payload.user_id === 'string' && payload.user_id.trim() !== sub) {
    throw new HttpStatusError(401, 'INVALID_TOKEN', 'Firebase ID token subject mismatch.');
  }
  if (!Number.isFinite(exp) || exp <= nowSec) {
    throw new HttpStatusError(
      401,
      'TOKEN_EXPIRED',
      'Your authentication session has expired. Sign in again.'
    );
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

async function getFirestoreAccessToken(env: WorkerEnv, fetchImpl: FetchFn): Promise<string> {
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

function normHall(val?: unknown): string {
  return String(val || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchesHallServer(studentHall?: unknown, targetHall?: unknown): boolean {
  const s = normHall(studentHall);
  const t = normHall(targetHall);
  if (!s || !t) return false;
  if (s === t) return true;

  const sClean = s.replace(/\bhall\b/g, '').trim();
  const tClean = t.replace(/\bhall\b/g, '').trim();
  if (
    sClean &&
    tClean &&
    sClean === tClean &&
    sClean !== 'src' &&
    sClean !== 'non-resident / off-campus'
  ) {
    return true;
  }

  const isAdehye = (v: string) =>
    v.includes('adehye') || v === 'adh' || v === 'hall-adehye' || v === 'hall-ade';
  if (isAdehye(s) && isAdehye(t)) return true;

  const isAtlantic = (v: string) =>
    v.includes('atlantic') || v === 'atl' || v === 'hall-atlantic' || v === 'hall-atl';
  if (isAtlantic(s) && isAtlantic(t)) return true;

  const isCasford = (v: string) =>
    v.includes('casford') ||
    v.includes('casely hayford') ||
    v === 'chf' ||
    v === 'hall-casford' ||
    v === 'hall-cas';
  if (isCasford(s) && isCasford(t)) return true;

  const isNkrumah = (v: string) =>
    v.includes('kwame nkrumah') || v === 'knh' || v === 'hall-knh' || v === 'hall-nkrumah';
  if (isNkrumah(s) && isNkrumah(t)) return true;

  const isOguaa = (v: string) =>
    v.includes('oguaa') || v === 'ogu' || v === 'hall-oguaa' || v === 'hall-ogu';
  if (isOguaa(s) && isOguaa(t)) return true;

  const isValco = (v: string) =>
    v.includes('valco') || v === 'vlc' || v === 'hall-valco' || v === 'hall-val';
  if (isValco(s) && isValco(t)) return true;

  const isSrcHall = (v: string) =>
    v === 'src hall' || v === 'src hostel' || v === 'srh' || v === 'hall-src' || v === 'hall_src';
  if (isSrcHall(s) && isSrcHall(t)) return true;

  const isSuperHall = (v: string) =>
    v.includes('superannuation') ||
    v === 'super hall' ||
    v === 'super' ||
    v === 'sup' ||
    v === 'hall-superannuation' ||
    v === 'hall-super' ||
    v === 'hall-sup';
  if (isSuperHall(s) && isSuperHall(t)) return true;

  return false;
}

function findOfficialHallServer(val?: unknown): CanonicalHall | undefined {
  const q = normHall(val);
  if (!q) return undefined;
  return OFFICIAL_UCC_HALLS.find(
    (h) =>
      normHall(h.id) === q ||
      normHall(h.code) === q ||
      matchesHallServer(val, h.name) ||
      matchesHallServer(val, h.shortName)
  );
}

function isOfficialHallServer(val?: unknown): boolean {
  const q = normHall(val);
  if (!q || q === 'non-resident / off-campus' || q === 'non-resident' || q === 'off-campus') {
    return false;
  }
  return Boolean(findOfficialHallServer(val));
}

function resolveElectionTargetHalls(election: Record<string, any>): string[] {
  const criteriaHalls = Array.isArray(election.eligibilityCriteria?.halls)
    ? election.eligibilityCriteria.halls.filter((h: any) => typeof h === 'string' && h.trim())
    : [];
  if (criteriaHalls.length > 0) return criteriaHalls;

  if (typeof election.hallId === 'string' && election.hallId.trim()) {
    const matched = findOfficialHallServer(election.hallId);
    return [matched ? matched.name : election.hallId.trim()];
  }
  if (typeof election.subdomainLabel === 'string' && election.subdomainLabel.trim()) {
    const matched = findOfficialHallServer(election.subdomainLabel);
    if (matched) return [matched.name];
  }
  return [];
}

function evaluateEligibilityAgainstCriteria(
  student: Record<string, any>,
  election: Record<string, any>,
  eligRecord?: Record<string, any> | null,
  authTokenEmailVerified?: boolean
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const criteria: Record<string, any> = election.eligibilityCriteria || {};

  if (student.status === 'suspended' || student.status === 'unverified') {
    reasons.push('Your student account is suspended or unverified.');
  }

  const isEmailVerified = Boolean(student.emailVerified) || authTokenEmailVerified === true;
  if (!isEmailVerified) {
    reasons.push('Please verify your university email address before voting.');
  }

  const normalize = (val?: unknown) => String(val || '').trim().toLowerCase();
  const resolvedFaculty = String(eligRecord?.faculty || student.faculty || '');
  const resolvedDepartment = String(eligRecord?.department || student.department || '');
  const resolvedLevel = String(eligRecord?.level || student.level || '');
  const resolvedHall = String(eligRecord?.hall || student.hall || '');

  if (Array.isArray(criteria.faculties) && criteria.faculties.length > 0) {
    const studFac = normalize(resolvedFaculty);
    const matches =
      Boolean(studFac) &&
      criteria.faculties.some(
        (f: string) =>
          studFac === normalize(f) ||
          studFac.includes(normalize(f)) ||
          normalize(f).includes(studFac)
      );
    if (!matches) reasons.push(`Restricted to faculty: ${criteria.faculties.join(', ')}.`);
  }

  if (Array.isArray(criteria.departments) && criteria.departments.length > 0) {
    const studDept = normalize(resolvedDepartment);
    const matches =
      Boolean(studDept) &&
      criteria.departments.some(
        (d: string) =>
          studDept === normalize(d) ||
          studDept.includes(normalize(d)) ||
          normalize(d).includes(studDept)
      );
    if (!matches) reasons.push(`Restricted to department: ${criteria.departments.join(', ')}.`);
  }

  const isHallElection =
    election.domainId === 'jcrc_hall' ||
    election.category === 'JCR / Hall' ||
    Boolean(election.hallId) ||
    (Array.isArray(criteria.halls) && criteria.halls.length > 0);

  if (isHallElection) {
    const targetHalls = resolveElectionTargetHalls(election);
    if (!isOfficialHallServer(resolvedHall)) {
      reasons.push(UNVERIFIED_HALL_MESSAGE);
    } else if (targetHalls.length > 0) {
      const matches = targetHalls.some((h: string) => matchesHallServer(resolvedHall, h));
      if (!matches) {
        reasons.push(`Restricted to hall: ${targetHalls.join(', ')}.`);
      }
    }
  }

  if (
    (election.category === 'GRASAG' || election.domainId === 'grasag') &&
    normalize(resolvedLevel) !== 'postgraduate'
  ) {
    reasons.push('GRASAG elections require Postgraduate enrolment.');
  } else if (Array.isArray(criteria.levels) && criteria.levels.length > 0) {
    const studLevel = normalize(resolvedLevel);
    const matches =
      Boolean(studLevel) &&
      criteria.levels.some((l: string) => normalize(String(l)) === studLevel);
    if (!matches) reasons.push(`Restricted to level(s): ${criteria.levels.join(', ')}.`);
  }

  return { eligible: reasons.length === 0, reasons };
}

function isStudentOnApprovedVoterRoll(
  student: Record<string, any>,
  eligRecord: Record<string, any> | null | undefined
): boolean {
  if (eligRecord) {
    return eligRecord.isEligible === true && eligRecord.status === 'eligible';
  }
  return (
    student.isEligible === true &&
    student.eligibilityStatus !== 'suspended' &&
    student.eligibilityStatus !== 'pending_verification' &&
    student.eligibilityStatus !== 'ineligible'
  );
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

  return rows.filter((r) => Boolean(r.document)).map((r) => decodeFirestoreDoc(r.document!));
}

export async function handleSubmitBallotRequest(
  request: Request,
  env: WorkerEnv,
  fetchImpl: FetchFn = fetch
): Promise<Response> {
  const cors = resolveCors(request, env);
  const corsHeaders = cors.headers;

  if (!cors.allowed) {
    return jsonResponse(
      403,
      {
        success: false,
        code: 'CORS_ORIGIN_FORBIDDEN',
        error: 'Origin is not authorized to access the UCC VOTE ballot submission endpoint.',
      },
      corsHeaders
    );
  }

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
    const rawIdempotencyKey = body?.idempotencyKey;
    const idempotencyKey =
      typeof rawIdempotencyKey === 'string' ? rawIdempotencyKey.trim().slice(0, 128) : '';

    if (!electionId || !ID_PATTERN.test(electionId)) {
      throw new HttpStatusError(
        400,
        'INVALID_ARGUMENT',
        'Valid electionId and selections map are required.'
      );
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

    const sortedPositions = [...positions].sort(
      (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)
    );
    const positionMap = new Map<string, Record<string, any>>();
    for (const pos of sortedPositions) {
      positionMap.set(pos.id, pos);
    }

    const candidateMap = new Map<string, Record<string, any>>();
    const approvedCountByPosition = new Map<string, number>();
    for (const cand of approvedCandidates) {
      candidateMap.set(cand.id, cand);
      const pid = String(cand.positionId || '');
      if (pid) {
        approvedCountByPosition.set(pid, (approvedCountByPosition.get(pid) || 0) + 1);
      }
    }

    const sanitizedSelections: Record<string, string[]> = {};
    const selectedCandidateIds: string[] = [];

    for (const [posId, candIds] of Object.entries(rawSelections)) {
      if (!Array.isArray(candIds)) {
        throw new HttpStatusError(
          400,
          'INVALID_ARGUMENT',
          `Selections for position ${posId} must be an array.`
        );
      }
      if (candIds.length === 0) continue;

      if (!ID_PATTERN.test(posId)) {
        throw new HttpStatusError(
          400,
          'INVALID_ARGUMENT',
          `Invalid position identifier: ${posId}.`
        );
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
      const normalizedIds = candIds.map((cid) => {
        if (typeof cid !== 'string' || !cid.trim() || !ID_PATTERN.test(cid.trim())) {
          throw new HttpStatusError(
            400,
            'INVALID_ARGUMENT',
            `Invalid candidate identifier in position ${posId}.`
          );
        }
        return cid.trim();
      });
      const uniqueCands = Array.from(new Set(normalizedIds));

      if (uniqueCands.length > maxSel) {
        throw new HttpStatusError(
          400,
          'INVALID_ARGUMENT',
          `Too many selections for ${pos.title || posId} (maximum ${maxSel}).`
        );
      }

      for (const cid of uniqueCands) {
        const cand = candidateMap.get(cid);
        if (!cand || cand.positionId !== posId) {
          throw new HttpStatusError(
            400,
            'INVALID_ARGUMENT',
            `Candidate ${cid} is not approved or valid for position ${pos.title || posId}.`
          );
        }
        selectedCandidateIds.push(cid);
      }

      sanitizedSelections[posId] = uniqueCands;
    }

    const nowIso = new Date().toISOString();
    const confirmationRef = `UCC-${electionId.slice(0, 6).toUpperCase()}-${randomHex(3).toUpperCase()}`;
    const receiptHash = await sha256Hex(`${electionId}:${confirmationRef}:${nowIso}:${randomHex(16)}`);

    const positionsCompleted = sortedPositions.map((pos) => ({
      id: pos.id,
      title: String(pos.title || pos.id),
      status:
        (sanitizedSelections[pos.id]?.length || 0) > 0
          ? ('VOTED' as const)
          : ('ABSTAINED' as const),
    }));

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
              receiptDocPath,
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
          throw new HttpStatusError(404, 'NOT_FOUND', 'Election record does not exist.');
        }

        // Idempotent retry support for exact same idempotencyKey before treating as duplicate vote
        const authLockDoc = foundByPath.get(authLockDocPath);
        if (authLockDoc) {
          const existingReceipt = foundByPath.get(receiptDocPath);
          if (
            idempotencyKey &&
            typeof authLockDoc.idempotencyKey === 'string' &&
            authLockDoc.idempotencyKey === idempotencyKey &&
            existingReceipt
          ) {
            await rollbackTransactionQuietly(baseUrl, accessToken, transaction, fetchImpl);
            receiptPayload = {
              ...existingReceipt,
              id: existingReceipt.id || `${electionId}_${uid}`,
            };
            updatedTurnout = Number(election.turnoutPercentage) || 0;
            break;
          }
          throw new HttpStatusError(
            409,
            'ALREADY_VOTED',
            'You have already cast your ballot in this election.'
          );
        }

        if (election.status !== 'live') {
          throw new HttpStatusError(
            403,
            'ELECTION_NOT_LIVE',
            `Voting is not currently open for this election (status: ${String(election.status || 'unknown')}).`
          );
        }

        // Validate mandatory positions (with approved candidates) & non-empty ballot requirements
        for (const pos of sortedPositions) {
          const hasApprovedCandidates = (approvedCountByPosition.get(pos.id) || 0) > 0;
          if (
            hasApprovedCandidates &&
            pos.allowsSkip !== true &&
            (!sanitizedSelections[pos.id] || sanitizedSelections[pos.id].length === 0)
          ) {
            throw new HttpStatusError(
              400,
              'INVALID_ARGUMENT',
              `A candidate selection is required for mandatory position: ${pos.title || pos.id}.`
            );
          }
        }

        if (selectedCandidateIds.length === 0 && election.allowsEmptyBallot !== true) {
          throw new HttpStatusError(
            400,
            'EMPTY_BALLOT_FORBIDDEN',
            'Please select at least one candidate before submitting your ballot.'
          );
        }

        const student = foundByPath.get(studentDocPath);
        if (!student) {
          throw new HttpStatusError(
            403,
            'STUDENT_NOT_FOUND',
            'Student voter profile not found. Complete your account activation first.'
          );
        }

        const eligRecord = foundByPath.get(eligDocPath) || null;
        if (!isStudentOnApprovedVoterRoll(student, eligRecord)) {
          throw new HttpStatusError(
            403,
            'INELIGIBLE_VOTER',
            eligRecord?.reason ||
              'Account is not cleared on the official UCC voter eligibility roll.'
          );
        }

        const criteriaEval = evaluateEligibilityAgainstCriteria(
          student,
          election,
          eligRecord,
          verifiedToken.emailVerified === true
        );
        if (!criteriaEval.eligible) {
          throw new HttpStatusError(403, 'INELIGIBLE_VOTER', criteriaEval.reasons.join(' '));
        }

        // Validate selected candidates belong to the same hall when voting in a hall election
        const electionTargetHalls = resolveElectionTargetHalls(election);
        if (
          (election.domainId === 'jcrc_hall' || election.category === 'JCR / Hall') &&
          electionTargetHalls.length > 0
        ) {
          for (const cid of selectedCandidateIds) {
            const cand = candidateMap.get(cid);
            const candHallRef = cand?.hallId || cand?.hall;
            if (candHallRef && !electionTargetHalls.some((h) => matchesHallServer(candHallRef, h))) {
              throw new HttpStatusError(
                400,
                'INVALID_ARGUMENT',
                `Candidate ${cand?.fullName || cid} is not affiliated with the target hall for this election.`
              );
            }
          }
        }

        const ballotId = crypto.randomUUID();
        const ballotDocPath = `${docRoot}/ballots/${ballotId}`;

        const nextVotesCast = (Number(election.totalVotesCast) || 0) + 1;
        const eligibleTotal = Number(election.totalEligibleVoters) || 0;
        const nextTurnout =
          eligibleTotal > 0
            ? Math.min(100, Math.round((nextVotesCast / eligibleTotal) * 1000) / 10)
            : 0;
        updatedTurnout = nextTurnout;

        const receiptMessage =
          'Your official ballot has been verified, anonymized, and permanently recorded.';

        const receiptDocFields = {
          uid,
          confirmationRef,
          receiptHash,
          electionId,
          electionTitle: String(election.title || ''),
          electionCategory: String(election.category || 'Other'),
          domainId: String(election.domainId || ''),
          electionCode: String(election.code || electionId),
          positionsCount: Object.keys(sanitizedSelections).length,
          positionsCompleted,
          submittedAt: nowIso,
          message: receiptMessage,
        };

        const writes: Array<Record<string, unknown>> = [
          // 1. Duplicate-vote authorisation lock (identity + idempotencyKey only, zero ballot choices)
          {
            update: {
              name: authLockDocPath,
              fields: encodeFirestoreFields({
                uid,
                electionId,
                studentId: String(student.studentId || ''),
                idempotencyKey,
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
          // 5. Mark election voted on student profile without overwriting unrelated fields
          {
            transform: {
              document: studentDocPath,
              fieldTransforms: [
                {
                  fieldPath: 'hasVotedElections',
                  appendMissingElements: {
                    values: [{ stringValue: electionId }],
                  },
                },
                {
                  fieldPath: 'updatedAt',
                  setToServerValue: 'REQUEST_TIME',
                },
              ],
            },
            currentDocument: { exists: true },
          },
        ];

        // 6. Atomic candidate tally increment for each chosen candidate
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
        };
        break;
      } catch (err: any) {
        await rollbackTransactionQuietly(baseUrl, accessToken, transaction, fetchImpl);

        if (err instanceof HttpStatusError) {
          throw err;
        }

        const fStatus = String(err?.firestoreStatus || '');
        const msg = String(err?.message || '').toLowerCase();

        // Precondition failure or ALREADY_EXISTS on voter_authorisations means duplicate/concurrent vote or concurrent idempotent retry
        if (
          fStatus === 'ALREADY_EXISTS' ||
          fStatus === 'FAILED_PRECONDITION' ||
          msg.includes('already exists') ||
          msg.includes('stored version')
        ) {
          const lockCheck = await firestoreRequest<
            Array<{ found?: FirestoreRestDocument }>
          >(
            `${baseUrl}:batchGet`,
            accessToken,
            { documents: [authLockDocPath, receiptDocPath, electionDocPath] },
            fetchImpl
          ).catch(() => []);

          const foundLock = lockCheck.find((e) => e.found?.name === authLockDocPath)?.found;
          if (foundLock) {
            const lockData = decodeFirestoreDoc(foundLock);
            const foundReceipt = lockCheck.find((e) => e.found?.name === receiptDocPath)?.found;
            const foundElection = lockCheck.find((e) => e.found?.name === electionDocPath)?.found;
            if (
              idempotencyKey &&
              typeof lockData.idempotencyKey === 'string' &&
              lockData.idempotencyKey === idempotencyKey &&
              foundReceipt
            ) {
              const decodedReceipt = decodeFirestoreDoc(foundReceipt);
              receiptPayload = {
                ...decodedReceipt,
                id: decodedReceipt.id || `${electionId}_${uid}`,
              };
              updatedTurnout = foundElection
                ? Number(decodeFirestoreDoc(foundElection).turnoutPercentage) || 0
                : 0;
              break;
            }
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
          'Unable to record ballot transaction cleanly. Please retry.'
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
        error: 'An unexpected voting server error occurred. Please try again.',
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
