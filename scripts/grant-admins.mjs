import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const requireFromFunctions = createRequire(path.resolve(__dirname, '../functions/package.json'));
const admin = requireFromFunctions('firebase-admin');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');

const PROJECT_ID = 'ucc-vote';
const FIRESTORE_DATABASE_ID = 'ai-studio-uccvote-84fbbe19-57dc-4b9d-8017-7c3fcf81fe8c';

// Target accounts kept verbatim as requested
const TARGET_ADMIN_EMAILS = [
  'fynnjethro7@gmail.com',
  'fynnjethro63@gmil.com',
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
  console.log(`Mode                    : ${isVerifyOnly ? 'VERIFY ONLY' : 'ASSIGN ADMIN CUSTOM CLAIMS & FIRESTORE PROFILE'}\n`);

  const report = [];

  for (const email of TARGET_ADMIN_EMAILS) {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (err) {
      if (err?.code === 'auth/user-not-found') {
        console.warn(`[NOT REGISTERED] ${email} — No Firebase Authentication account exists. Must register first; no duplicate/synthetic account created.`);
        report.push({ email, existsInAuth: false, adminAssigned: false });
        continue;
      }
      throw err;
    }

    if (!isVerifyOnly) {
      const existingClaims = { ...(userRecord.customClaims || {}) };
      delete existingClaims.superAdmin;

      await auth.setCustomUserClaims(userRecord.uid, {
        ...existingClaims,
        admin: true,
        role: ADMIN_ROLE,
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
            role: ADMIN_ROLE,
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

    const ok =
      claims.admin === true &&
      claims.role === ADMIN_ROLE &&
      claims.superAdmin !== true &&
      adminDoc.exists &&
      docData?.isActive === true &&
      docData?.role === ADMIN_ROLE;

    console.log(
      `[${ok ? 'VERIFIED ADMIN' : 'INCOMPLETE'}] ${email} (uid: ${userRecord.uid}) | customClaims=${JSON.stringify(
        claims
      )} | adminsDocExists=${adminDoc.exists} | isActive=${docData?.isActive}`
    );

    report.push({
      email,
      uid: userRecord.uid,
      existsInAuth: true,
      customClaims: claims,
      adminsDocExists: adminDoc.exists,
      isActive: docData?.isActive ?? false,
      adminAssigned: ok,
    });
  }

  console.log('\nSummary JSON:');
  console.log(JSON.stringify(report, null, 2));

  const missingOrFailed = report.filter((r) => !r.adminAssigned);
  if (missingOrFailed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('\nFailed to run Firebase Admin provisioning:', err?.message || err);
  console.error(
    'Ensure GOOGLE_APPLICATION_CREDENTIALS points to a Firebase service account JSON for project "ucc-vote" (or Application Default Credentials are active via gcloud).'
  );
  process.exit(1);
});
