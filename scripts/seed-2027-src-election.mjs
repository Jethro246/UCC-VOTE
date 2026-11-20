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

const isVerifyOnly = process.argv.includes('--verify');

const ELECTION_2027 = {
  id: 'elec_2027_src',
  title: 'UCC SRC General Elections 2027',
  code: 'UCC-SRC-2027',
  description:
    'Official University of Cape Coast Students’ Representative Council (SRC) General Elections for 2027 covering seven executive portfolios and 17 contestants.',
  category: 'SRC',
  domainId: 'src',
  subdomainLabel: 'University-Wide Undergraduate Executive',
  academicYear: '2027',
  status: 'draft',
  isPublished: true,
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  totalEligibleVoters: 0,
  totalVotesCast: 0,
  turnoutPercentage: 0,
  organizingBody: 'UCC Electoral Commission',
  eligibilityCriteria: { levels: ['100', '200', '300', '400'] },
  rules: [
    'One verified UCC undergraduate student, one anonymous electronic ballot.',
    'Voting opens only after polling dates and activation are authorised by the UCC Electoral Commission.',
    'All seven SRC executive portfolios and 17 contestants start with zero votes.',
  ],
  positionsCount: 7,
  resultsCertified: false,
  provisionalResultsReady: false,
  isHistorical: false,
  candidateListStatus: 'complete',
  tallyAvailable: true,
};

const POSITIONS_2027 = [
  {
    id: 'pos_2027_src_president',
    title: 'SRC President',
    description: 'Executive Head and Chief Spokesperson of the UCC Students’ Representative Council.',
    order: 1,
    candidateIds: ['cand_2027_src_emmanuel_acheampong_nana_adjei', 'cand_2027_src_richard_agyemang'],
  },
  {
    id: 'pos_2027_src_vice_president',
    title: 'SRC Vice President',
    description: 'Deputy Executive Officer of the UCC Students’ Representative Council.',
    order: 2,
    candidateIds: ['cand_2027_src_regina_yayra_adenyo'],
  },
  {
    id: 'pos_2027_src_general_secretary',
    title: 'SRC General Secretary',
    description: 'Chief Administrative and Records Officer of the UCC Students’ Representative Council.',
    order: 3,
    candidateIds: ['cand_2027_src_benedicta_tiwaa_danso', 'cand_2027_src_hawawu_abdulai_kiejembu'],
  },
  {
    id: 'pos_2027_src_treasurer',
    title: 'SRC Treasurer',
    description: 'Chief Financial Custodian of the UCC Students’ Representative Council.',
    order: 4,
    candidateIds: ['cand_2027_src_nuhu_dauda', 'cand_2027_src_isaac_aidoo', 'cand_2027_src_emmanuel_wonders_koku'],
  },
  {
    id: 'pos_2027_src_pro',
    title: 'SRC Public Relations Officer',
    description: 'Official Communications and Student Information Officer of the UCC Students’ Representative Council.',
    order: 5,
    candidateIds: ['cand_2027_src_elisha_mensah_kojo_jnr', 'cand_2027_src_gideon_kwadwo_adade', 'cand_2027_src_eric_darlington_anku'],
  },
  {
    id: 'pos_2027_src_coordinating_secretary',
    title: 'SRC Coordinating Secretary',
    description: 'Inter-Hall, Faculty, and Welfare Coordination Executive of the UCC Students’ Representative Council.',
    order: 6,
    candidateIds: ['cand_2027_src_adwoa_asima_agbehiam', 'cand_2027_src_winnifred_cobbinah', 'cand_2027_src_bridget_amoah', 'cand_2027_src_ernestina_netty'],
  },
  {
    id: 'pos_2027_src_sports_secretary',
    title: 'SRC General Sports Secretary',
    description: 'Director of Student Athletics, Sports, and Intramural Competitions of the UCC Students’ Representative Council.',
    order: 7,
    candidateIds: ['cand_2027_src_emmanuel_essel', 'cand_2027_src_felix_kwabla_akpakli'],
  },
].map((p) => ({
  ...p,
  electionId: 'elec_2027_src',
  domainId: 'src',
  maxSelections: 1,
  allowsSkip: true,
}));

const CONTESTANTS_2027 = [
  { id: 'cand_2027_src_emmanuel_acheampong_nana_adjei', positionId: 'pos_2027_src_president', fullName: 'Emmanuel Acheampong Nana Adjei' },
  { id: 'cand_2027_src_richard_agyemang', positionId: 'pos_2027_src_president', fullName: 'Richard Agyemang' },
  { id: 'cand_2027_src_regina_yayra_adenyo', positionId: 'pos_2027_src_vice_president', fullName: 'Regina Yayra Adenyo' },
  { id: 'cand_2027_src_benedicta_tiwaa_danso', positionId: 'pos_2027_src_general_secretary', fullName: 'Benedicta Tiwaa Danso' },
  { id: 'cand_2027_src_hawawu_abdulai_kiejembu', positionId: 'pos_2027_src_general_secretary', fullName: 'Hawawu Abdulai Kiejembu' },
  { id: 'cand_2027_src_nuhu_dauda', positionId: 'pos_2027_src_treasurer', fullName: 'Nuhu Dauda' },
  { id: 'cand_2027_src_isaac_aidoo', positionId: 'pos_2027_src_treasurer', fullName: 'Isaac Aidoo' },
  { id: 'cand_2027_src_emmanuel_wonders_koku', positionId: 'pos_2027_src_treasurer', fullName: 'Emmanuel Wonders Koku' },
  { id: 'cand_2027_src_elisha_mensah_kojo_jnr', positionId: 'pos_2027_src_pro', fullName: 'Elisha Mensah Kojo Jnr' },
  { id: 'cand_2027_src_gideon_kwadwo_adade', positionId: 'pos_2027_src_pro', fullName: 'Gideon Kwadwo Adade' },
  { id: 'cand_2027_src_eric_darlington_anku', positionId: 'pos_2027_src_pro', fullName: 'Eric Darlington Anku' },
  { id: 'cand_2027_src_adwoa_asima_agbehiam', positionId: 'pos_2027_src_coordinating_secretary', fullName: 'Adwoa Asima Agbehiam' },
  { id: 'cand_2027_src_winnifred_cobbinah', positionId: 'pos_2027_src_coordinating_secretary', fullName: 'Winnifred Cobbinah' },
  { id: 'cand_2027_src_bridget_amoah', positionId: 'pos_2027_src_coordinating_secretary', fullName: 'Bridget Amoah' },
  { id: 'cand_2027_src_ernestina_netty', positionId: 'pos_2027_src_coordinating_secretary', fullName: 'Ernestina Netty' },
  { id: 'cand_2027_src_emmanuel_essel', positionId: 'pos_2027_src_sports_secretary', fullName: 'Emmanuel Essel' },
  { id: 'cand_2027_src_felix_kwabla_akpakli', positionId: 'pos_2027_src_sports_secretary', fullName: 'Felix Kwabla Akpakli' },
].map((seed) => ({
  ...seed,
  electionId: 'elec_2027_src',
  domainId: 'src',
  studentId: 'Pending EC Verification',
  department: 'Not verified',
  faculty: 'Not verified',
  programme: '',
  level: 'Not verified',
  hall: 'Not verified',
  photoUrl: '',
  biography: '',
  manifestoSummary: '',
  fullManifesto: [],
  keyPromises: [],
  leadershipExperience: [],
  applicationStatus: 'Approved',
  eligibilityVerified: true,
  votesReceived: 0,
  isHistoricalRecord: false,
  profileDataStatus: 'complete',
}));

function initFirebaseAdmin() {
  if (admin.apps.length > 0) return admin.app();
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    if (!fs.existsSync(credPath)) {
      throw new Error(`GOOGLE_APPLICATION_CREDENTIALS file not found at: ${credPath}`);
    }
    const raw = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    if (raw.project_id && raw.project_id !== PROJECT_ID) {
      throw new Error(`Service account project_id "${raw.project_id}" does not match "${PROJECT_ID}".`);
    }
    return admin.initializeApp({ credential: admin.credential.cert(raw), projectId: PROJECT_ID });
  }
  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

async function run() {
  const app = initFirebaseAdmin();
  const db = getFirestore(app, FIRESTORE_DATABASE_ID);

  if (!isVerifyOnly) {
    const elecRef = db.collection('elections').doc(ELECTION_2027.id);
    if (!(await elecRef.get()).exists) {
      await elecRef.set({
        ...ELECTION_2027,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    for (const pos of POSITIONS_2027) {
      const ref = db.collection('positions').doc(pos.id);
      if (!(await ref.get()).exists) {
        await ref.set(pos);
      }
    }
    for (const cand of CONTESTANTS_2027) {
      const ref = db.collection('candidates').doc(cand.id);
      if (!(await ref.get()).exists) {
        await ref.set({
          ...cand,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }

  const [elec2027Snap, elec2026Snap, pos2027Snap, cand2027Snap] = await Promise.all([
    db.collection('elections').doc('elec_2027_src').get(),
    db.collection('elections').doc('elec_2026_src').get(),
    db.collection('positions').where('electionId', '==', 'elec_2027_src').get(),
    db.collection('candidates').where('electionId', '==', 'elec_2027_src').get(),
  ]);

  console.log(
    JSON.stringify(
      {
        mode: isVerifyOnly ? 'verify' : 'seed+verify',
        elec2027Exists: elec2027Snap.exists,
        elec2027Status: elec2027Snap.data()?.status || null,
        elec2027Code: elec2027Snap.data()?.code || null,
        positions2027Count: pos2027Snap.size,
        candidates2027Count: cand2027Snap.size,
        elec2026Preserved: elec2026Snap.exists ? elec2026Snap.data()?.isHistorical === true : 'not_seeded_in_db',
      },
      null,
      2
    )
  );
}

run().catch((err) => {
  console.error('2027 SRC seed failed:', err?.message || err);
  process.exit(1);
});
