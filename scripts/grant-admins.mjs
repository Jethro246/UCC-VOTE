import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const requireFromFunctions = createRequire(path.resolve(__dirname, '../functions/package.json'));
const admin = requireFromFunctions('firebase-admin');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');

const PROJECT_ID = 'ucc-vote';
const FIRESTORE_DATABASE_ID = 'ai-studio-uccvote-84fbbe19-57dc-4b9d-8017-7c3fcf81fe8c';

// Exact authorized administrator email addresses
const TARGET_ADMIN_EMAILS = [
  'fynnjethro7@gmail.com',
  'fynnjethro63@gmail.com',
];

const ADMIN_ROLE = 'Electoral Commissioner';
const ADMIN_PERMISSIONS = [
  'manage_elections',
  'approve_elections',
  'certify_results',
  'publish_results',
  'manage_domains',
  'manage_candidates',
  'view_audit_logs',
  'manage_admins',
];

const isVerifyOnly = process.argv.includes('--verify');

function initFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    if (!fs.existsSync(credPath)) {
      throw new Error(`GOOGLE_APPLICATION_CREDENTIALS file not found at: ${credPath}`);
    }
    const raw = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    if (raw.project_id && raw.project_id !== PROJECT_ID) {
      throw new Error(
        `Service account project_id "${raw.project_id}" does not match target Firebase project "${PROJECT_ID}".`
      );
    }
    return admin.initializeApp({
      credential: admin.credential.cert(raw),
      projectId: PROJECT_ID,
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

async function run() {
  const app = initFirebaseAdmin();
  const auth = admin.auth(app);
  const db = getFirestore(app, FIRESTORE_DATABASE_ID);

  console.log(`\nTarget Firebase Project : ${PROJECT_ID}`);
  console.log(`Target Firestore DB     : ${FIRESTORE_DATABASE_ID}`);
  console.log(
    `Mode                    : ${
      isVerifyOnly ? 'VERIFY ONLY' : 'ASSIGN ADMIN CUSTOM CLAIMS & FIRESTORE PROFILE'
    }\n`
  );

  const report = [];

  for (const email of TARGET_ADMIN_EMAILS) {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (err) {
      if (err?.code === 'auth/user-not-found') {
        console.error(
          `[FAIL - NOT FOUND] ${email} — No Firebase Authentication account exists in project "${PROJECT_ID}". The user must register first; no duplicate account was created.`
        );
        report.push({
          email,
          foundInAuth: false,
          adminClaim: false,
          verified: false,
        });
        continue;
      }
      throw err;
    }

    if (!isVerifyOnly) {
      // Preserve all unrelated existing custom claims while adding admin: true and role
      const existingClaims = { ...(userRecord.customClaims || {}) };

      await auth.setCustomUserClaims(userRecord.uid, {
        ...existingClaims,
        admin: true,
        role: existingClaims.role || ADMIN_ROLE,
      });

      await db
        .collection('admins')
        .doc(userRecord.uid)
        .set(
          {
            uid: userRecord.uid,
            staffId: `UCC/EC/${userRecord.uid.slice(0, 6).toUpperCase()}`,
            fullName: userRecord.displayName || email,
            email: userRecord.email || email,
            role: existingClaims.role || ADMIN_ROLE,
            department: 'UCC Electoral Commission',
            permissions: ADMIN_PERMISSIONS,
            managedDomainIds: [],
            managedHalls: [],
            isActive: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      await db.collection('audit_logs').add({
        adminName: 'Firebase Admin SDK Provisioning',
        adminRole: 'System Provisioner',
        action: 'Granted Administrator Custom Claims & Profile',
        target: `${email} (uid: ${userRecord.uid})`,
        ipAddress: 'server-script',
        status: 'success',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      userRecord = await auth.getUser(userRecord.uid);
    }

    const adminDoc = await db.collection('admins').doc(userRecord.uid).get();
    const claims = userRecord.customClaims || {};
    const docData = adminDoc.exists ? adminDoc.data() : null;

    const hasAdminClaim = claims.admin === true;
    const isProfileActive = adminDoc.exists && docData?.isActive === true;
    const passed = hasAdminClaim && isProfileActive;

    console.log(
      `[${passed ? 'PASS' : 'FAIL'}] ${email} (uid: ${userRecord.uid}) | foundInAuth=true | claims.admin=${
        claims.admin === true
      } | role=${claims.role || 'unset'} | adminsDocExists=${adminDoc.exists} | isActive=${
        docData?.isActive ?? false
      }`
    );

    report.push({
      email,
      uid: userRecord.uid,
      foundInAuth: true,
      adminClaim: hasAdminClaim,
      role: claims.role || null,
      adminsDocExists: adminDoc.exists,
      isActive: docData?.isActive ?? false,
      verified: passed,
    });
  }

  console.log('\nVerification Report:');
  console.log(JSON.stringify(report, null, 2));

  const failed = report.filter((r) => !r.verified);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  const message = err?.message || String(err);
  console.error('\nFailed to run Firebase Admin provisioning:', message);
  if (
    !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    (message.includes('PERMISSION_DENIED') ||
      message.includes('SERVICE_DISABLED') ||
      message.includes('Could not load the default credentials'))
  ) {
    console.error(
      `No authorized credentials for project "${PROJECT_ID}" were found (ambient runtime credentials belong to a different GCP host or lack IAM access).`
    );
  }
  console.error(
    `Set GOOGLE_APPLICATION_CREDENTIALS to a Firebase Admin service account JSON key downloaded from Firebase Project "${PROJECT_ID}" (Project Settings -> Service accounts -> Generate new private key).`
  );
  process.exit(1);
});
