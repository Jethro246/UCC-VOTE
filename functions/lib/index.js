"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeAllElections = exports.cancelElection = exports.restoreArchivedElection = exports.archiveElection = exports.removeElection = exports.reviewCandidateApplication = exports.verifyAdminAccess = exports.revokeAdminRole = exports.updateAdminScope = exports.setAdminRole = exports.certifyAndPublishResults = exports.submitBallot = exports.checkVoterEligibility = exports.FUNCTIONS_REGION = exports.FIRESTORE_DATABASE_ID = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const crypto = __importStar(require("crypto"));
const adminApp = admin.initializeApp();
exports.FIRESTORE_DATABASE_ID = 'ai-studio-uccvote-84fbbe19-57dc-4b9d-8017-7c3fcf81fe8c';
exports.FUNCTIONS_REGION = 'us-central1';
const db = (0, firestore_1.getFirestore)(adminApp, exports.FIRESTORE_DATABASE_ID);
const ALLOWED_ADMIN_ROLES = new Set([
    'Super Administrator',
    'Electoral Commissioner',
    'SRC Election Administrator',
    'Hall Election Administrator',
    'GRASAG Election Administrator',
    'Local NUGS Election Administrator',
    'Departmental Election Administrator',
    'Faculty/School Election Administrator',
    'Returning Officer',
    'Results Auditor',
]);
const UNSCOPED_ELECTION_GOVERNANCE_ROLES = new Set([
    'Super Administrator',
    'Electoral Commissioner',
    'Returning Officer',
]);
async function assertAdmin(uid, tokenClaims) {
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    if (tokenClaims?.admin !== true) {
        throw new https_1.HttpsError('permission-denied', 'Administrator custom claims are required.');
    }
    const adminSnap = await db.collection('admins').doc(uid).get();
    if (!adminSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Active administrator profile record (/admins/{uid}) is required.');
    }
    const adminData = adminSnap.data() || {};
    if (adminData.isActive !== true) {
        throw new https_1.HttpsError('permission-denied', 'Administrator account is inactive or deactivated.');
    }
    const role = typeof adminData.role === 'string' ? adminData.role.trim() : '';
    if (!role || !ALLOWED_ADMIN_ROLES.has(role)) {
        throw new https_1.HttpsError('permission-denied', 'Administrator account does not hold a valid governance role.');
    }
    return {
        ...adminData,
        uid,
        role,
    };
}
function assertGlobalGovernanceAdminServer(actor) {
    const role = String(actor?.role || '');
    const managedDomains = Array.isArray(actor?.managedDomainIds) ? actor.managedDomainIds : [];
    const managedHalls = Array.isArray(actor?.managedHalls) ? actor.managedHalls : [];
    if ((role !== 'Super Administrator' && role !== 'Electoral Commissioner') ||
        managedDomains.length > 0 ||
        managedHalls.length > 0) {
        throw new https_1.HttpsError('permission-denied', 'Only unrestricted Super Administrators or Electoral Commissioners can perform platform-wide governance actions.');
    }
}
const UNVERIFIED_HALL_MESSAGE = 'Your hall affiliation could not be verified. Please contact the appropriate administrator.';
const OFFICIAL_UCC_HALLS = [
    { id: 'hall-adehye', code: 'ADH', name: 'Adehye Hall', shortName: 'Adehye' },
    { id: 'hall-atlantic', code: 'ATL', name: 'Atlantic Hall', shortName: 'ATL' },
    { id: 'hall-casford', code: 'CHF', name: 'Casely Hayford Hall', shortName: 'Casford' },
    { id: 'hall-nkrumah', code: 'KNH', name: 'Kwame Nkrumah Hall', shortName: 'KNH' },
    { id: 'hall-oguaa', code: 'OGU', name: 'Oguaa Hall', shortName: 'Oguaa' },
    { id: 'hall-valco', code: 'VLC', name: 'Valco Hall', shortName: 'Valco' },
    { id: 'hall-src', code: 'SRH', name: 'SRC Hall', shortName: 'SRC Hall' },
    { id: 'hall-superannuation', code: 'SUP', name: 'Superannuation Hall', shortName: 'Super Hall' },
];
function normHall(val) {
    return String(val || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function matchesHallServer(studentHall, targetHall) {
    const s = normHall(studentHall);
    const t = normHall(targetHall);
    if (!s || !t)
        return false;
    if (s === t)
        return true;
    const sClean = s.replace(/\bhall\b/g, '').trim();
    const tClean = t.replace(/\bhall\b/g, '').trim();
    if (sClean && tClean && sClean === tClean && sClean !== 'src' && sClean !== 'non-resident / off-campus') {
        return true;
    }
    const isAdehye = (v) => v.includes('adehye') || v === 'adh' || v === 'hall-adehye' || v === 'hall-ade';
    if (isAdehye(s) && isAdehye(t))
        return true;
    const isAtlantic = (v) => v.includes('atlantic') || v === 'atl' || v === 'hall-atlantic' || v === 'hall-atl';
    if (isAtlantic(s) && isAtlantic(t))
        return true;
    const isCasford = (v) => v.includes('casford') ||
        v.includes('casely hayford') ||
        v === 'chf' ||
        v === 'hall-casford' ||
        v === 'hall-cas';
    if (isCasford(s) && isCasford(t))
        return true;
    const isNkrumah = (v) => v.includes('kwame nkrumah') || v === 'knh' || v === 'hall-knh' || v === 'hall-nkrumah';
    if (isNkrumah(s) && isNkrumah(t))
        return true;
    const isOguaa = (v) => v.includes('oguaa') || v === 'ogu' || v === 'hall-oguaa' || v === 'hall-ogu';
    if (isOguaa(s) && isOguaa(t))
        return true;
    const isValco = (v) => v.includes('valco') || v === 'vlc' || v === 'hall-valco' || v === 'hall-val';
    if (isValco(s) && isValco(t))
        return true;
    const isSrcHall = (v) => v === 'src hall' || v === 'src hostel' || v === 'srh' || v === 'hall-src' || v === 'hall_src';
    if (isSrcHall(s) && isSrcHall(t))
        return true;
    const isSuperHall = (v) => v.includes('superannuation') ||
        v === 'super hall' ||
        v === 'super' ||
        v === 'sup' ||
        v === 'hall-superannuation' ||
        v === 'hall-super' ||
        v === 'hall-sup';
    if (isSuperHall(s) && isSuperHall(t))
        return true;
    return false;
}
function findOfficialHallServer(val) {
    const q = normHall(val);
    if (!q)
        return undefined;
    return OFFICIAL_UCC_HALLS.find((h) => normHall(h.id) === q ||
        normHall(h.code) === q ||
        matchesHallServer(val, h.name) ||
        matchesHallServer(val, h.shortName));
}
function isOfficialHallServer(val) {
    const q = normHall(val);
    if (!q || q === 'non-resident / off-campus' || q === 'non-resident' || q === 'off-campus') {
        return false;
    }
    return Boolean(findOfficialHallServer(val));
}
function resolveElectionTargetHalls(election) {
    const criteriaHalls = Array.isArray(election.eligibilityCriteria?.halls)
        ? election.eligibilityCriteria.halls.filter((h) => typeof h === 'string' && h.trim())
        : [];
    if (criteriaHalls.length > 0)
        return criteriaHalls;
    if (typeof election.hallId === 'string' && election.hallId.trim()) {
        const matched = findOfficialHallServer(election.hallId);
        return [matched ? matched.name : election.hallId.trim()];
    }
    if (typeof election.subdomainLabel === 'string' && election.subdomainLabel.trim()) {
        const matched = findOfficialHallServer(election.subdomainLabel);
        if (matched)
            return [matched.name];
    }
    return [];
}
function evaluateEligibilityAgainstCriteria(student, election, eligRecord, authTokenEmailVerified) {
    const reasons = [];
    const criteria = election.eligibilityCriteria || {};
    if (student.status === 'suspended' || student.status === 'unverified') {
        reasons.push('Your student account is suspended or unverified.');
    }
    const isEmailVerified = Boolean(student.emailVerified) || authTokenEmailVerified === true;
    if (!isEmailVerified) {
        reasons.push('Please verify your university email address before voting.');
    }
    const normalize = (val) => (val || '').trim().toLowerCase();
    const resolvedFaculty = String(eligRecord?.faculty || student.faculty || '');
    const resolvedDepartment = String(eligRecord?.department || student.department || '');
    const resolvedLevel = String(eligRecord?.level || student.level || '');
    const resolvedHall = String(eligRecord?.hall || student.hall || '');
    if (Array.isArray(criteria.faculties) && criteria.faculties.length > 0) {
        const studFac = normalize(resolvedFaculty);
        const matches = criteria.faculties.some((f) => studFac === normalize(f) || studFac.includes(normalize(f)) || normalize(f).includes(studFac));
        if (!matches)
            reasons.push(`Restricted to faculty: ${criteria.faculties.join(', ')}.`);
    }
    if (Array.isArray(criteria.departments) && criteria.departments.length > 0) {
        const studDept = normalize(resolvedDepartment);
        const matches = criteria.departments.some((d) => studDept === normalize(d) || studDept.includes(normalize(d)) || normalize(d).includes(studDept));
        if (!matches)
            reasons.push(`Restricted to department: ${criteria.departments.join(', ')}.`);
    }
    const isHallElection = election.domainId === 'jcrc_hall' ||
        election.category === 'JCR / Hall' ||
        Boolean(election.hallId) ||
        (Array.isArray(criteria.halls) && criteria.halls.length > 0);
    if (isHallElection) {
        const targetHalls = resolveElectionTargetHalls(election);
        if (!isOfficialHallServer(resolvedHall)) {
            reasons.push(UNVERIFIED_HALL_MESSAGE);
        }
        else if (targetHalls.length > 0) {
            const matches = targetHalls.some((h) => matchesHallServer(resolvedHall, h));
            if (!matches) {
                reasons.push(`Restricted to hall: ${targetHalls.join(', ')}.`);
            }
        }
    }
    if (election.category === 'GRASAG' && resolvedLevel !== 'Postgraduate') {
        reasons.push('GRASAG elections require Postgraduate enrolment.');
    }
    else if (Array.isArray(criteria.levels) && criteria.levels.length > 0) {
        const studLevel = normalize(resolvedLevel);
        const matches = criteria.levels.some((l) => normalize(String(l)) === studLevel);
        if (!matches)
            reasons.push(`Restricted to level(s): ${criteria.levels.join(', ')}.`);
    }
    return { eligible: reasons.length === 0, reasons };
}
function isStudentOnApprovedVoterRoll(student, eligRecord) {
    if (eligRecord) {
        return eligRecord.isEligible === true && eligRecord.status === 'eligible';
    }
    return (student.isEligible === true &&
        student.eligibilityStatus !== 'suspended' &&
        student.eligibilityStatus !== 'pending_verification');
}
exports.checkVoterEligibility = (0, https_1.onCall)({ region: exports.FUNCTIONS_REGION }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Please sign in first.');
    }
    const uid = request.auth.uid;
    const electionId = String(request.data?.electionId || '').trim();
    if (!electionId) {
        throw new https_1.HttpsError('invalid-argument', 'electionId is required.');
    }
    const [studentSnap, eligSnap, electionSnap, authSnap] = await Promise.all([
        db.collection('students').doc(uid).get(),
        db.collection('voter_eligibility').doc(uid).get(),
        db.collection('elections').doc(electionId).get(),
        db.collection('voter_authorisations').doc(`${electionId}_${uid}`).get(),
    ]);
    if (!electionSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Election not found.');
    }
    if (!studentSnap.exists) {
        return {
            isEligible: false,
            eligible: false,
            alreadyVoted: false,
            reason: 'No UCC student profile activated for this account.',
            reasons: ['No UCC student profile activated for this account.'],
        };
    }
    const student = studentSnap.data();
    const eligRecord = eligSnap.exists ? eligSnap.data() : null;
    const election = electionSnap.data();
    const reasons = [];
    if (!isStudentOnApprovedVoterRoll(student, eligRecord)) {
        reasons.push(eligRecord?.reason ||
            student.eligibilityNotes ||
            'Your email is verified, but your student record has not yet been confirmed on the UCC Electoral Commission voter roll.');
    }
    const criteriaEval = evaluateEligibilityAgainstCriteria(student, election, eligRecord, request.auth.token?.email_verified === true);
    reasons.push(...criteriaEval.reasons);
    const isEligible = reasons.length === 0;
    return {
        isEligible,
        eligible: isEligible,
        alreadyVoted: authSnap.exists,
        reason: isEligible ? 'Verified eligible UCC voter for this election.' : reasons.join(' '),
        reasons,
        electionTitle: election.title,
        studentId: student.studentId || '',
        studentName: student.fullName || '',
    };
});
exports.submitBallot = (0, https_1.onCall)({ region: exports.FUNCTIONS_REGION }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication is required to cast a ballot.');
    }
    const uid = request.auth.uid;
    const electionId = String(request.data?.electionId || '').trim();
    const rawSelections = request.data?.selections;
    const rawIdempotencyKey = request.data?.idempotencyKey;
    const idempotencyKey = typeof rawIdempotencyKey === 'string' ? rawIdempotencyKey.trim().slice(0, 128) : '';
    if (!electionId ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(electionId) ||
        !rawSelections ||
        typeof rawSelections !== 'object' ||
        Array.isArray(rawSelections)) {
        throw new https_1.HttpsError('invalid-argument', 'Valid electionId and selections map are required.');
    }
    const electionRef = db.collection('elections').doc(electionId);
    const studentRef = db.collection('students').doc(uid);
    const eligRef = db.collection('voter_eligibility').doc(uid);
    const authLockRef = db.collection('voter_authorisations').doc(`${electionId}_${uid}`);
    const receiptRef = db.collection('vote_confirmations').doc(`${electionId}_${uid}`);
    // Pre-load positions & approved candidates for this election
    const [posSnap, candSnap] = await Promise.all([
        db.collection('positions').where('electionId', '==', electionId).get(),
        db
            .collection('candidates')
            .where('electionId', '==', electionId)
            .where('applicationStatus', '==', 'Approved')
            .get(),
    ]);
    const sortedPositions = posSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    const positionMap = new Map();
    sortedPositions.forEach((p) => positionMap.set(p.id, p));
    const candidateMap = new Map();
    const approvedCountByPosition = new Map();
    candSnap.docs.forEach((d) => {
        const data = d.data();
        candidateMap.set(d.id, data);
        if (data.positionId) {
            approvedCountByPosition.set(data.positionId, (approvedCountByPosition.get(data.positionId) || 0) + 1);
        }
    });
    // Validate selections structure against election positions and approved candidates
    const sanitizedSelections = {};
    const selectedCandidateIds = [];
    for (const [posId, candIds] of Object.entries(rawSelections)) {
        if (!Array.isArray(candIds)) {
            throw new https_1.HttpsError('invalid-argument', `Selections for position ${posId} must be an array.`);
        }
        if (candIds.length === 0)
            continue;
        const pos = positionMap.get(posId);
        if (!pos) {
            throw new https_1.HttpsError('invalid-argument', `Invalid position ${posId} for election ${electionId}.`);
        }
        const maxSel = Number(pos.maxSelections) || 1;
        const normalizedIds = candIds.map((cid) => {
            if (typeof cid !== 'string' || !cid.trim()) {
                throw new https_1.HttpsError('invalid-argument', `Invalid candidate identifier in position ${posId}.`);
            }
            return cid.trim();
        });
        const uniqueCands = Array.from(new Set(normalizedIds));
        if (uniqueCands.length > maxSel) {
            throw new https_1.HttpsError('invalid-argument', `Too many selections for ${pos.title || posId} (maximum ${maxSel}).`);
        }
        for (const cid of uniqueCands) {
            const cand = candidateMap.get(cid);
            if (!cand || cand.positionId !== posId) {
                throw new https_1.HttpsError('invalid-argument', `Candidate ${cid} is not approved or valid for position ${pos.title || posId}.`);
            }
            selectedCandidateIds.push(cid);
        }
        sanitizedSelections[posId] = uniqueCands;
    }
    const nowIso = new Date().toISOString();
    const confirmationRef = `UCC-${electionId.slice(0, 6).toUpperCase()}-${crypto
        .randomBytes(3)
        .toString('hex')
        .toUpperCase()}`;
    const receiptHash = crypto
        .createHash('sha256')
        .update(`${electionId}:${confirmationRef}:${nowIso}:${crypto.randomBytes(16).toString('hex')}`)
        .digest('hex');
    const positionsCompleted = sortedPositions.map((pos) => ({
        id: pos.id,
        title: String(pos.title || pos.id),
        status: (sanitizedSelections[pos.id]?.length || 0) > 0 ? 'VOTED' : 'ABSTAINED',
    }));
    const txResult = await db.runTransaction(async (tx) => {
        const [electionDoc, studentDoc, eligDoc, authLockDoc, receiptDoc] = await Promise.all([
            tx.get(electionRef),
            tx.get(studentRef),
            tx.get(eligRef),
            tx.get(authLockRef),
            tx.get(receiptRef),
        ]);
        if (!electionDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Election record does not exist.');
        }
        const election = electionDoc.data();
        // Idempotent retry support for exact same idempotencyKey before treating as duplicate vote
        if (authLockDoc.exists) {
            const lockData = authLockDoc.data();
            if (idempotencyKey && lockData?.idempotencyKey === idempotencyKey && receiptDoc.exists) {
                return {
                    receipt: {
                        id: receiptDoc.id,
                        ...receiptDoc.data(),
                    },
                    updatedTurnout: Number(election.turnoutPercentage) || 0,
                };
            }
            throw new https_1.HttpsError('already-exists', 'You have already cast your ballot in this election.');
        }
        if (election.status !== 'live') {
            throw new https_1.HttpsError('failed-precondition', `Voting is not currently open for this election (status: ${String(election.status || 'unknown')}).`);
        }
        // Validate mandatory positions & non-empty ballot requirements
        for (const pos of sortedPositions) {
            const hasApprovedCandidates = (approvedCountByPosition.get(pos.id) || 0) > 0;
            if (hasApprovedCandidates && !pos.allowsSkip && (sanitizedSelections[pos.id]?.length || 0) === 0) {
                throw new https_1.HttpsError('invalid-argument', `A candidate selection is required for mandatory position: ${pos.title || pos.id}.`);
            }
        }
        if (selectedCandidateIds.length === 0 && !election.allowsEmptyBallot) {
            throw new https_1.HttpsError('invalid-argument', 'Please select at least one candidate before submitting your ballot.');
        }
        if (!studentDoc.exists) {
            throw new https_1.HttpsError('failed-precondition', 'Student voter profile not found. Complete your account activation first.');
        }
        const student = studentDoc.data();
        const eligRecord = eligDoc.exists ? eligDoc.data() : null;
        if (!isStudentOnApprovedVoterRoll(student, eligRecord)) {
            throw new https_1.HttpsError('permission-denied', eligRecord?.reason ||
                'Account is not cleared on the official UCC voter eligibility roll.');
        }
        const criteriaEval = evaluateEligibilityAgainstCriteria(student, election, eligRecord, request.auth.token?.email_verified === true);
        if (!criteriaEval.eligible) {
            throw new https_1.HttpsError('permission-denied', criteriaEval.reasons.join(' '));
        }
        // Validate selected candidates belong to the same hall when voting in a hall election
        const electionTargetHalls = resolveElectionTargetHalls(election);
        if ((election.domainId === 'jcrc_hall' || election.category === 'JCR / Hall') &&
            electionTargetHalls.length > 0) {
            for (const cid of selectedCandidateIds) {
                const cand = candidateMap.get(cid);
                const candHallRef = cand?.hallId || cand?.hall;
                if (candHallRef && !electionTargetHalls.some((h) => matchesHallServer(candHallRef, h))) {
                    throw new https_1.HttpsError('invalid-argument', `Candidate ${cand?.fullName || cid} is not affiliated with the target hall for this election.`);
                }
            }
        }
        // 1. Write duplicate-vote authorisation lock (identity only, zero ballot choices)
        tx.set(authLockRef, {
            uid,
            electionId,
            studentId: student.studentId || '',
            idempotencyKey,
            authorisedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 2. Write anonymized ballot record (selections only, zero identity fields)
        const anonymousBallotRef = db.collection('ballots').doc();
        tx.set(anonymousBallotRef, {
            electionId,
            selections: sanitizedSelections,
            castAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 3. Write voter confirmation receipt (zero candidate choices)
        const receiptMessage = 'Your official ballot has been verified, anonymized, and permanently recorded.';
        const receipt = {
            uid,
            confirmationRef,
            receiptHash,
            electionId,
            electionTitle: String(election.title || ''),
            electionCategory: election.category || 'Other',
            domainId: election.domainId || '',
            electionCode: election.code || electionId,
            positionsCount: Object.keys(sanitizedSelections).length,
            positionsCompleted,
            submittedAt: nowIso,
            message: receiptMessage,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        };
        tx.set(receiptRef, receipt);
        // 4. Increment election totalVotesCast & turnoutPercentage
        const nextVotesCast = (Number(election.totalVotesCast) || 0) + 1;
        const eligibleTotal = Number(election.totalEligibleVoters) || 0;
        const nextTurnout = eligibleTotal > 0 ? Math.min(100, Math.round((nextVotesCast / eligibleTotal) * 1000) / 10) : 0;
        tx.update(electionRef, {
            totalVotesCast: admin.firestore.FieldValue.increment(1),
            turnoutPercentage: nextTurnout,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 5. Mark election voted on student profile for quick UI sync
        tx.update(studentRef, {
            hasVotedElections: admin.firestore.FieldValue.arrayUnion(electionId),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 6. Increment each chosen candidate's tally
        for (const cid of selectedCandidateIds) {
            tx.update(db.collection('candidates').doc(cid), {
                votesReceived: admin.firestore.FieldValue.increment(1),
            });
        }
        return {
            receipt: {
                ...receipt,
                id: receiptRef.id,
            },
            updatedTurnout: nextTurnout,
        };
    });
    return {
        success: true,
        message: 'Ballot recorded securely in Firebase.',
        receipt: txResult.receipt,
        updatedTurnout: txResult.updatedTurnout,
    };
});
exports.certifyAndPublishResults = (0, https_1.onCall)({ region: exports.FUNCTIONS_REGION }, async (request) => {
    const actor = await assertAdmin(request.auth?.uid, request.auth?.token);
    const electionId = String(request.data?.electionId || '').trim();
    const targetStage = String(request.data?.targetStage || 'certified').trim();
    const notes = String(request.data?.notes || '').trim();
    if (!electionId) {
        throw new https_1.HttpsError('invalid-argument', 'electionId is required.');
    }
    const [electionSnap, positionsSnap, candidatesSnap, ballotsSnap, existingResultsSnap] = await Promise.all([
        db.collection('elections').doc(electionId).get(),
        db.collection('positions').where('electionId', '==', electionId).get(),
        db
            .collection('candidates')
            .where('electionId', '==', electionId)
            .where('applicationStatus', '==', 'Approved')
            .get(),
        db.collection('ballots').where('electionId', '==', electionId).get(),
        db.collection('election_results').doc(electionId).get(),
    ]);
    if (!electionSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Election not found.');
    }
    const election = electionSnap.data();
    assertAdminDomainScopeServer(actor, election);
    const positions = positionsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    const candidates = candidatesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    }));
    // Authoritative recount directly from anonymous ballots collection
    const voteCounts = new Map();
    ballotsSnap.docs.forEach((bDoc) => {
        const selections = bDoc.data().selections || {};
        Object.values(selections).forEach((candIds) => {
            if (Array.isArray(candIds)) {
                candIds.forEach((cid) => {
                    voteCounts.set(String(cid), (voteCounts.get(String(cid)) || 0) + 1);
                });
            }
        });
    });
    const totalBallotsCast = ballotsSnap.size;
    const totalEligibleVoters = Number(election.totalEligibleVoters) || 0;
    const isPublished = targetStage === 'published';
    const isCertified = targetStage === 'certified' || isPublished;
    const positionSummaries = positions.map((pos) => {
        const posCands = candidates.filter((c) => c.positionId === pos.id);
        const totalValidVotes = posCands.reduce((sum, c) => sum + (voteCounts.get(c.id) ?? Number(c.votesReceived) ?? 0), 0);
        const sorted = [...posCands].sort((a, b) => {
            const va = voteCounts.get(a.id) ?? Number(a.votesReceived) ?? 0;
            const vb = voteCounts.get(b.id) ?? Number(b.votesReceived) ?? 0;
            return vb - va;
        });
        const topVotes = sorted.length > 0 ? voteCounts.get(sorted[0].id) ?? Number(sorted[0].votesReceived) ?? 0 : 0;
        const leaders = topVotes > 0
            ? sorted.filter((c) => (voteCounts.get(c.id) ?? Number(c.votesReceived) ?? 0) === topVotes)
            : [];
        const isTie = leaders.length > 1;
        return {
            positionId: pos.id,
            title: pos.title,
            description: pos.description || '',
            order: pos.order || 0,
            totalValidVotes,
            blankVotes: Math.max(0, totalBallotsCast - totalValidVotes),
            invalidVotes: 0,
            totalBallotsProcessed: totalBallotsCast,
            isTie,
            tiedCandidateIds: isTie ? leaders.map((l) => l.id) : [],
            winnerCandidateIds: !isTie ? leaders.map((l) => l.id) : [],
            candidates: sorted.map((c, idx) => {
                const votes = voteCounts.get(c.id) ?? Number(c.votesReceived) ?? 0;
                const pctValid = totalValidVotes > 0 ? Math.round((votes / totalValidVotes) * 1000) / 10 : 0;
                const pctTotal = totalBallotsCast > 0 ? Math.round((votes / totalBallotsCast) * 1000) / 10 : 0;
                const isTop = topVotes > 0 && votes === topVotes;
                return {
                    candidateId: c.id,
                    fullName: c.fullName,
                    nickname: c.nickname || '',
                    studentId: c.studentId,
                    photoUrl: c.photoUrl || '',
                    department: c.department || '',
                    faculty: c.faculty || '',
                    hall: c.hall || '',
                    votesReceived: votes,
                    percentageOfValidVotes: pctValid,
                    percentageOfTotalBallots: pctTotal,
                    rank: idx + 1,
                    isLeading: isTop && !isTie,
                    isWinner: isTop && !isTie && isCertified,
                    isTied: isTop && isTie,
                };
            }),
        };
    });
    const existingHistory = existingResultsSnap.exists
        ? existingResultsSnap.data()?.workflowHistory || []
        : [];
    const actorName = actor?.fullName || 'Electoral Commissioner';
    const nextAction = {
        stage: targetStage,
        actorId: request.auth.uid,
        actorName,
        actorRole: actor?.role || 'Administrator',
        timestamp: new Date().toISOString(),
        notes: notes || `Results workflow transitioned to ${targetStage}`,
    };
    const resultsPayload = {
        electionId,
        electionTitle: election.title,
        electionCode: election.code || electionId,
        category: election.category,
        domainId: election.domainId,
        subdomainLabel: election.subdomainLabel || '',
        status: isPublished ? 'results_published' : 'results_pending_certification',
        academicYear: election.academicYear || '',
        organizingBody: election.organizingBody || 'UCC Electoral Commission',
        startDate: election.startDate,
        endDate: election.endDate,
        workflowStage: targetStage,
        workflowHistory: [...existingHistory, nextAction],
        isPublished,
        resultsCertified: isCertified,
        certifiedBy: isCertified ? actorName : existingResultsSnap.data()?.certifiedBy || '',
        publishedAt: isPublished ? new Date().toISOString() : existingResultsSnap.data()?.publishedAt || '',
        ballotSummary: {
            totalEligibleVoters,
            totalBallotsCast,
            validBallots: totalBallotsCast,
            invalidBallots: 0,
            blankBallots: 0,
            uncastBallots: Math.max(0, totalEligibleVoters - totalBallotsCast),
            turnoutPercentage: totalEligibleVoters > 0
                ? Math.round((totalBallotsCast / totalEligibleVoters) * 1000) / 10
                : 0,
            validBallotRate: totalBallotsCast > 0 ? 100 : 0,
            invalidBallotRate: 0,
            blankBallotRate: 0,
        },
        positions: positionSummaries,
        turnoutAnalytics: {
            privacyThreshold: 5,
            byFaculty: [],
            byDepartment: [],
            byLevel: [],
            byHall: [],
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await Promise.all([
        db.collection('election_results').doc(electionId).set(resultsPayload, { merge: true }),
        db
            .collection('elections')
            .doc(electionId)
            .update({
            status: isPublished ? 'results_published' : 'results_pending_certification',
            resultsCertified: isCertified,
            provisionalResultsReady: true,
            totalVotesCast: totalBallotsCast,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
        db.collection('audit_logs').add({
            adminName: actorName,
            adminRole: actor?.role || 'Administrator',
            action: `Certified/Updated Election Results (${targetStage})`,
            target: `${election.title} (${totalBallotsCast} ballots tallied)`,
            ipAddress: 'cloud-functions',
            status: 'success',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }),
    ]);
    return {
        success: true,
        results: resultsPayload,
        message: `Results ${isPublished ? 'certified and published' : `updated to ${targetStage}`}.`,
    };
});
exports.setAdminRole = (0, https_1.onCall)({ region: exports.FUNCTIONS_REGION }, async (request) => {
    const actor = await assertAdmin(request.auth?.uid, request.auth?.token);
    assertGlobalGovernanceAdminServer(actor);
    const targetUidInput = String(request.data?.uid || '').trim();
    const email = String(request.data?.email || '').trim().toLowerCase();
    const fullName = String(request.data?.fullName || '').trim();
    const staffId = String(request.data?.staffId || '').trim();
    const requestedRole = String(request.data?.role || 'Electoral Commissioner').trim();
    const department = String(request.data?.department || 'UCC Electoral Commission').trim();
    if (requestedRole === 'Super Administrator' && request.auth?.token?.role !== 'Super Administrator') {
        throw new https_1.HttpsError('permission-denied', 'Only an existing Super Administrator can assign Super Administrator privileges.');
    }
    const role = requestedRole === 'Super Administrator' || ALLOWED_ADMIN_ROLES.has(requestedRole)
        ? requestedRole
        : 'Electoral Commissioner';
    if (!targetUidInput && !email) {
        throw new https_1.HttpsError('invalid-argument', 'Either uid or email is required.');
    }
    let userRecord;
    try {
        userRecord = targetUidInput
            ? await admin.auth().getUser(targetUidInput)
            : await admin.auth().getUserByEmail(email);
    }
    catch (err) {
        if (err?.code === 'auth/user-not-found') {
            throw new https_1.HttpsError('not-found', `Firebase Authentication account not found for ${email || targetUidInput}. The user must register first before administrator privileges can be assigned.`);
        }
        throw new https_1.HttpsError('internal', err?.message || 'Unable to look up Firebase Auth user.');
    }
    const existingClaims = { ...(userRecord.customClaims || {}) };
    delete existingClaims.superAdmin;
    await admin.auth().setCustomUserClaims(userRecord.uid, {
        ...existingClaims,
        admin: true,
        role,
    });
    const permissions = Array.isArray(request.data?.permissions)
        ? request.data.permissions
        : [
            'manage_elections',
            'approve_elections',
            'certify_results',
            'publish_results',
            'manage_domains',
            'manage_candidates',
            'view_audit_logs',
            'manage_admins',
        ];
    const adminProfile = {
        uid: userRecord.uid,
        staffId: staffId || `UCC/EC/${userRecord.uid.slice(0, 6).toUpperCase()}`,
        fullName: fullName || userRecord.displayName || userRecord.email || 'Electoral Administrator',
        email: (userRecord.email || email).toLowerCase(),
        role,
        department,
        permissions,
        isActive: true,
        managedDomainIds: Array.isArray(request.data?.managedDomainIds)
            ? request.data.managedDomainIds
            : [],
        managedHalls: Array.isArray(request.data?.managedHalls) ? request.data.managedHalls : [],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await Promise.all([
        db.collection('admins').doc(userRecord.uid).set(adminProfile, { merge: true }),
        db.collection('audit_logs').add({
            adminName: actor?.fullName || request.auth?.token?.email || 'Electoral Administrator',
            adminRole: actor?.role || 'Electoral Commissioner',
            action: 'Assigned Administrator Custom Claims & Role',
            target: `${adminProfile.email} (${role})`,
            ipAddress: 'cloud-functions',
            status: 'success',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }),
    ]);
    return {
        success: true,
        admin: { id: userRecord.uid, ...adminProfile },
        message: 'Administrator custom claims and Firestore role configured.',
    };
});
exports.updateAdminScope = (0, https_1.onCall)({ region: exports.FUNCTIONS_REGION }, async (request) => {
    const actor = await assertAdmin(request.auth?.uid, request.auth?.token);
    assertGlobalGovernanceAdminServer(actor);
    const targetUid = String(request.data?.uid || request.data?.id || '').trim();
    if (!targetUid) {
        throw new https_1.HttpsError('invalid-argument', 'Target administrator uid is required.');
    }
    const targetRef = db.collection('admins').doc(targetUid);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Administrator record not found.');
    }
    const updateFields = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (typeof request.data?.role === 'string' && ALLOWED_ADMIN_ROLES.has(request.data.role.trim())) {
        updateFields.role = request.data.role.trim();
    }
    if (Array.isArray(request.data?.managedDomainIds)) {
        updateFields.managedDomainIds = request.data.managedDomainIds;
    }
    if (Array.isArray(request.data?.managedHalls)) {
        updateFields.managedHalls = request.data.managedHalls;
    }
    if (Array.isArray(request.data?.managedFaculties)) {
        updateFields.managedFaculties = request.data.managedFaculties;
    }
    if (Array.isArray(request.data?.managedDepartments)) {
        updateFields.managedDepartments = request.data.managedDepartments;
    }
    if (Array.isArray(request.data?.permissions)) {
        updateFields.permissions = request.data.permissions;
    }
    await targetRef.update(updateFields);
    if (updateFields.role) {
        const userRecord = await admin.auth().getUser(targetUid);
        await admin.auth().setCustomUserClaims(targetUid, {
            ...(userRecord.customClaims || {}),
            admin: true,
            role: updateFields.role,
        });
    }
    const updated = await targetRef.get();
    await db.collection('audit_logs').add({
        adminName: actor?.fullName || 'Electoral Administrator',
        adminRole: actor?.role || 'Electoral Commissioner',
        action: 'Updated Administrator Scope',
        target: targetUid,
        ipAddress: 'cloud-functions',
        status: 'success',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
        success: true,
        admin: { id: updated.id, ...updated.data() },
        message: 'Administrator governance scope updated securely.',
    };
});
exports.revokeAdminRole = (0, https_1.onCall)({ region: exports.FUNCTIONS_REGION }, async (request) => {
    const actor = await assertAdmin(request.auth?.uid, request.auth?.token);
    assertGlobalGovernanceAdminServer(actor);
    const targetUid = String(request.data?.uid || '').trim();
    if (!targetUid) {
        throw new https_1.HttpsError('invalid-argument', 'Target uid is required.');
    }
    if (targetUid === request.auth?.uid) {
        throw new https_1.HttpsError('failed-precondition', 'Administrators cannot revoke their own active access.');
    }
    const userRecord = await admin.auth().getUser(targetUid);
    const claims = { ...(userRecord.customClaims || {}) };
    delete claims.admin;
    delete claims.role;
    delete claims.superAdmin;
    await admin.auth().setCustomUserClaims(targetUid, claims);
    await Promise.all([
        db.collection('admins').doc(targetUid).set({
            isActive: false,
            revokedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }),
        db.collection('audit_logs').add({
            adminName: actor?.fullName || 'Electoral Administrator',
            adminRole: actor?.role || 'Electoral Commissioner',
            action: 'Revoked Administrator Access',
            target: userRecord.email || targetUid,
            ipAddress: 'cloud-functions',
            status: 'warning',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }),
    ]);
    return { success: true, message: 'Administrator custom claims and access revoked.' };
});
exports.verifyAdminAccess = (0, https_1.onCall)({ region: exports.FUNCTIONS_REGION }, async (request) => {
    const actor = await assertAdmin(request.auth?.uid, request.auth?.token);
    return {
        authorized: true,
        uid: request.auth.uid,
        email: request.auth.token.email || actor?.email || '',
        role: actor?.role || request.auth.token.role || 'Electoral Commissioner',
        claimsAdmin: request.auth.token.admin === true,
    };
});
exports.reviewCandidateApplication = (0, https_1.onCall)({ region: exports.FUNCTIONS_REGION }, async (request) => {
    const actor = await assertAdmin(request.auth?.uid, request.auth?.token);
    const candidateId = String(request.data?.candidateId || '').trim();
    const decision = String(request.data?.decision || '').trim();
    const notes = String(request.data?.notes || '').trim();
    if (!candidateId || !['Approved', 'Rejected', 'Under review', 'Withdrawn'].includes(decision)) {
        throw new https_1.HttpsError('invalid-argument', 'Valid candidateId and decision are required.');
    }
    const candRef = db.collection('candidates').doc(candidateId);
    const candSnap = await candRef.get();
    if (!candSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Candidate nomination not found.');
    }
    const cand = candSnap.data();
    const actorName = actor?.fullName || 'Electoral Commissioner';
    await candRef.update({
        applicationStatus: decision,
        eligibilityVerified: decision === 'Approved' ? true : cand.eligibilityVerified || false,
        rejectionReason: decision === 'Rejected' ? notes : cand.rejectionReason || '',
        correctionNotes: decision === 'Under review' ? notes : cand.correctionNotes || '',
        reviewedAt: new Date().toISOString(),
        reviewedBy: actorName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (decision === 'Approved' && cand.positionId) {
        await db
            .collection('positions')
            .doc(cand.positionId)
            .update({
            candidateIds: admin.firestore.FieldValue.arrayUnion(candidateId),
        })
            .catch(() => { });
    }
    await db.collection('audit_logs').add({
        adminName: actorName,
        adminRole: actor?.role || 'Administrator',
        action: `Candidate Application -> ${decision}`,
        target: `${cand.fullName} (${cand.studentId})`,
        ipAddress: 'cloud-functions',
        status: 'success',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, message: `Candidate nomination marked as ${decision}.` };
});
const VALID_ELECTION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
function assertValidElectionIdServer(electionId) {
    if (!electionId || !VALID_ELECTION_ID_PATTERN.test(electionId)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid election ID format. Allowed: 1-128 alphanumeric, underscore, or hyphen characters.');
    }
}
function assertAdminDomainScopeServer(actor, election) {
    const role = String(actor?.role || '');
    if (role === 'Results Auditor') {
        throw new https_1.HttpsError('permission-denied', 'Results Auditors have read-only audit access and cannot modify or remove elections.');
    }
    const managedDomains = Array.isArray(actor?.managedDomainIds) ? actor.managedDomainIds : [];
    const isUnscopedGlobal = UNSCOPED_ELECTION_GOVERNANCE_ROLES.has(role) && managedDomains.length === 0;
    if (isUnscopedGlobal) {
        return;
    }
    if (managedDomains.length === 0 ||
        typeof election.domainId !== 'string' ||
        !managedDomains.includes(election.domainId)) {
        throw new https_1.HttpsError('permission-denied', 'You do not have administrative authority over this election domain.');
    }
}
async function commitDeletesInChunks(refs) {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < refs.length; i += CHUNK_SIZE) {
        const batch = db.batch();
        const slice = refs.slice(i, i + CHUNK_SIZE);
        slice.forEach((ref) => batch.delete(ref));
        await batch.commit();
    }
}
exports.removeElection = (0, https_1.onCall)({ region: exports.FUNCTIONS_REGION }, async (request) => {
    const actor = await assertAdmin(request.auth?.uid, request.auth?.token);
    const uid = request.auth.uid;
    const electionId = String(request.data?.electionId || '').trim();
    const confirmationText = String(request.data?.confirmationText || '').trim();
    const reason = String(request.data?.reason || '').trim();
    assertValidElectionIdServer(electionId);
    const electionRef = db.collection('elections').doc(electionId);
    const electionSnap = await electionRef.get();
    if (!electionSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Election record not found.');
    }
    const election = electionSnap.data();
    assertAdminDomainScopeServer(actor, election);
    if (election.isHistorical === true) {
        throw new https_1.HttpsError('failed-precondition', 'Historical 2026 University of Cape Coast election records cannot be permanently deleted.');
    }
    if (election.status === 'live') {
        throw new https_1.HttpsError('failed-precondition', 'Active (live) elections cannot be removed while polling is open. Close or cancel the election first.');
    }
    const allowedDeleteStatuses = new Set([
        'draft',
        'pending_approval',
        'scheduled',
        'upcoming',
        'suspended',
        'closed',
        'cancelled',
        'archived',
    ]);
    if (!allowedDeleteStatuses.has(String(election.status || ''))) {
        throw new https_1.HttpsError('failed-precondition', `Elections with status "${election.status}" must be closed, cancelled, or reverted to draft before removal.`);
    }
    const expectedTitle = String(election.title || '').trim();
    const expectedPhrase = election.code ? `DELETE ${String(election.code).trim()}` : '';
    const confirmed = Boolean(confirmationText) &&
        ((Boolean(expectedTitle) && confirmationText === expectedTitle) ||
            (Boolean(expectedPhrase) && confirmationText === expectedPhrase));
    if (!confirmed) {
        throw new https_1.HttpsError('invalid-argument', 'Explicit confirmation text did not match the election title or required deletion phrase.');
    }
    const [ballotsSnap, authSnap, confirmSnap, candSnap, posSnap, assignSnap, resSnap] = await Promise.all([
        db.collection('ballots').where('electionId', '==', electionId).limit(1).get(),
        db.collection('voter_authorisations').where('electionId', '==', electionId).limit(1).get(),
        db.collection('vote_confirmations').where('electionId', '==', electionId).limit(1).get(),
        db.collection('candidates').where('electionId', '==', electionId).get(),
        db.collection('positions').where('electionId', '==', electionId).get(),
        db.collection('candidate_assignments').where('electionId', '==', electionId).get(),
        db.collection('election_results').doc(electionId).get(),
    ]);
    const candidateHasVotes = candSnap.docs.some((d) => (Number(d.data()?.votesReceived) || 0) > 0);
    const resultsPublishedOrCertified = resSnap.exists &&
        (resSnap.data()?.isPublished === true || resSnap.data()?.resultsCertified === true);
    if ((Number(election.totalVotesCast) || 0) > 0 ||
        !ballotsSnap.empty ||
        !authSnap.empty ||
        !confirmSnap.empty ||
        candidateHasVotes ||
        Boolean(election.resultsCertified) ||
        resultsPublishedOrCertified) {
        throw new https_1.HttpsError('failed-precondition', 'This election already has votes, voter authorisations, receipts, or certified results and cannot be permanently deleted. Archive the election instead.');
    }
    const refsToDelete = [
        ...posSnap.docs.map((d) => d.ref),
        ...candSnap.docs.map((d) => d.ref),
        ...assignSnap.docs.map((d) => d.ref),
    ];
    if (resSnap.exists && !resultsPublishedOrCertified) {
        refsToDelete.push(resSnap.ref);
    }
    refsToDelete.push(electionRef);
    await commitDeletesInChunks(refsToDelete);
    const actorName = actor?.fullName || request.auth?.token?.email || 'Electoral Commissioner';
    await db.collection('audit_logs').add({
        adminName: actorName,
        adminRole: actor?.role || 'Administrator',
        adminUid: uid,
        electionId,
        reason: reason || 'Draft/unused election permanently removed by administrator',
        action: 'Permanently Removed Election',
        target: `${election.title || electionId} (${election.code || electionId})`,
        ipAddress: 'cloud-functions',
        status: 'warning',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
        success: true,
        mode: 'deleted',
        electionId,
        deletedDocumentsCount: refsToDelete.length,
        message: `Election "${election.title || electionId}" and its associated unpublished records were permanently removed.`,
    };
});
exports.archiveElection = (0, https_1.onCall)({ region: exports.FUNCTIONS_REGION }, async (request) => {
    const actor = await assertAdmin(request.auth?.uid, request.auth?.token);
    const uid = request.auth.uid;
    const electionId = String(request.data?.electionId || '').trim();
    const reason = String(request.data?.reason || '').trim();
    assertValidElectionIdServer(electionId);
    const electionRef = db.collection('elections').doc(electionId);
    const electionSnap = await electionRef.get();
    if (!electionSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Election record not found.');
    }
    const election = electionSnap.data();
    assertAdminDomainScopeServer(actor, election);
    if (election.status === 'live') {
        throw new https_1.HttpsError('failed-precondition', 'Active (live) elections must be closed or cancelled before archiving.');
    }
    if (election.status === 'archived') {
        throw new https_1.HttpsError('failed-precondition', 'This election is already archived.');
    }
    const actorName = actor?.fullName || request.auth?.token?.email || 'Electoral Commissioner';
    const archivedAt = new Date().toISOString();
    await electionRef.update({
        previousStatus: election.status,
        status: 'archived',
        archivedAt,
        archivedBy: actorName,
        archivedByUid: uid,
        archiveReason: reason || 'Archived by Electoral Commission administrator',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('audit_logs').add({
        adminName: actorName,
        adminRole: actor?.role || 'Administrator',
        adminUid: uid,
        electionId,
        reason: reason || 'Archived by Electoral Commission administrator',
        action: 'Archived Election',
        target: `${election.title || electionId} (${election.code || electionId})`,
        ipAddress: 'cloud-functions',
        status: 'success',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    const updated = await electionRef.get();
    return {
        success: true,
        mode: 'archived',
        election: { id: updated.id, ...updated.data() },
        message: `Election "${election.title || electionId}" has been archived. All ballots, confirmations, results, and audit logs were preserved.`,
    };
});
exports.restoreArchivedElection = (0, https_1.onCall)({ region: exports.FUNCTIONS_REGION }, async (request) => {
    const actor = await assertAdmin(request.auth?.uid, request.auth?.token);
    const uid = request.auth.uid;
    const electionId = String(request.data?.electionId || '').trim();
    const reason = String(request.data?.reason || '').trim();
    const requestedStatus = String(request.data?.targetStatus || '').trim();
    assertValidElectionIdServer(electionId);
    const electionRef = db.collection('elections').doc(electionId);
    const electionSnap = await electionRef.get();
    if (!electionSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Election record not found.');
    }
    const election = electionSnap.data();
    assertAdminDomainScopeServer(actor, election);
    if (election.isHistorical === true) {
        throw new https_1.HttpsError('failed-precondition', 'Historical 2026 archives remain permanently archived.');
    }
    if (election.status !== 'archived') {
        throw new https_1.HttpsError('failed-precondition', 'Only archived elections can be restored.');
    }
    const safeRestoreStatuses = new Set([
        'draft',
        'pending_approval',
        'scheduled',
        'suspended',
        'closed',
        'cancelled',
        'results_pending_certification',
        'results_published',
    ]);
    const candidateStatus = requestedStatus || String(election.previousStatus || '');
    const restoredStatus = safeRestoreStatuses.has(candidateStatus) ? candidateStatus : 'closed';
    const actorName = actor?.fullName || request.auth?.token?.email || 'Electoral Commissioner';
    const restoredAt = new Date().toISOString();
    await electionRef.update({
        status: restoredStatus,
        restoredAt,
        restoredBy: actorName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('audit_logs').add({
        adminName: actorName,
        adminRole: actor?.role || 'Administrator',
        adminUid: uid,
        electionId,
        reason: reason || `Restored from archive to ${restoredStatus}`,
        action: `Restored Archived Election -> ${restoredStatus}`,
        target: `${election.title || electionId} (${election.code || electionId})`,
        ipAddress: 'cloud-functions',
        status: 'success',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    const updated = await electionRef.get();
    return {
        success: true,
        election: { id: updated.id, ...updated.data() },
        message: `Election restored from archive to ${restoredStatus.replace(/_/g, ' ')}.`,
    };
});
exports.cancelElection = (0, https_1.onCall)({ region: exports.FUNCTIONS_REGION }, async (request) => {
    const actor = await assertAdmin(request.auth?.uid, request.auth?.token);
    const uid = request.auth.uid;
    const electionId = String(request.data?.electionId || '').trim();
    const reason = String(request.data?.reason || '').trim();
    assertValidElectionIdServer(electionId);
    const electionRef = db.collection('elections').doc(electionId);
    const electionSnap = await electionRef.get();
    if (!electionSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Election record not found.');
    }
    const election = electionSnap.data();
    assertAdminDomainScopeServer(actor, election);
    if (election.isHistorical === true) {
        throw new https_1.HttpsError('failed-precondition', 'Historical 2026 records cannot be cancelled.');
    }
    if (['cancelled', 'archived', 'results_published'].includes(String(election.status || ''))) {
        throw new https_1.HttpsError('failed-precondition', `Elections with status "${election.status}" cannot be cancelled.`);
    }
    const actorName = actor?.fullName || request.auth?.token?.email || 'Electoral Commissioner';
    const cancelledAt = new Date().toISOString();
    await electionRef.update({
        previousStatus: election.status,
        status: 'cancelled',
        cancelledAt,
        cancelledBy: actorName,
        cancellationReason: reason || 'Cancelled by Electoral Commission administrator',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('audit_logs').add({
        adminName: actorName,
        adminRole: actor?.role || 'Administrator',
        adminUid: uid,
        electionId,
        reason: reason || 'Cancelled by Electoral Commission administrator',
        action: 'Cancelled Election',
        target: `${election.title || electionId} (${election.code || electionId})`,
        ipAddress: 'cloud-functions',
        status: 'warning',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    const updated = await electionRef.get();
    return {
        success: true,
        election: { id: updated.id, ...updated.data() },
        message: `Election "${election.title || electionId}" has been cancelled.`,
    };
});
exports.removeAllElections = (0, https_1.onCall)({ region: exports.FUNCTIONS_REGION }, async (request) => {
    const actor = await assertAdmin(request.auth?.uid, request.auth?.token);
    assertGlobalGovernanceAdminServer(actor);
    const uid = request.auth.uid;
    const confirmationText = String(request.data?.confirmationText || '').trim();
    const includeHistorical = Boolean(request.data?.includeHistorical);
    const detachProtectedElections = Boolean(request.data?.detachProtectedElections);
    const reason = String(request.data?.reason || '').trim();
    const builtInIds = Array.isArray(request.data?.builtInElectionIds)
        ? request.data.builtInElectionIds.filter((id) => typeof id === 'string' && VALID_ELECTION_ID_PATTERN.test(id))
        : [];
    if (confirmationText !== 'REMOVE ALL ELECTIONS') {
        throw new https_1.HttpsError('invalid-argument', 'Confirmation text must exactly match "REMOVE ALL ELECTIONS".');
    }
    const electionsSnap = await db.collection('elections').get();
    const elections = electionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const liveBlockers = elections.filter((e) => e.status === 'live');
    if (liveBlockers.length > 0) {
        throw new https_1.HttpsError('failed-precondition', `${liveBlockers.length} LIVE election(s) prevent bulk removal. Close or cancel live voting first.`);
    }
    const allowedDeleteStatuses = new Set([
        'draft',
        'pending_approval',
        'scheduled',
        'upcoming',
        'suspended',
        'closed',
        'cancelled',
        'archived',
    ]);
    let removedElectionsCount = 0;
    let removedRelatedDocsCount = 0;
    let archivedDetachedCount = 0;
    let preservedHistoricalCount = 0;
    const hiddenBuiltInIdsToAdd = new Set(builtInIds);
    const actorName = actor?.fullName || request.auth?.token?.email || 'Electoral Commissioner';
    const inspected = [];
    for (const election of elections) {
        assertValidElectionIdServer(election.id);
        if (election.isHistorical === true && !includeHistorical) {
            preservedHistoricalCount++;
            inspected.push({
                election,
                disposition: 'skip_historical',
                posRefs: [],
                candRefs: [],
                assignRefs: [],
                resRef: null,
            });
            continue;
        }
        const [ballotsSnap, authSnap, confirmSnap, candSnap, posSnap, assignSnap, resSnap] = await Promise.all([
            db.collection('ballots').where('electionId', '==', election.id).limit(1).get(),
            db.collection('voter_authorisations').where('electionId', '==', election.id).limit(1).get(),
            db.collection('vote_confirmations').where('electionId', '==', election.id).limit(1).get(),
            db.collection('candidates').where('electionId', '==', election.id).get(),
            db.collection('positions').where('electionId', '==', election.id).get(),
            db.collection('candidate_assignments').where('electionId', '==', election.id).get(),
            db.collection('election_results').doc(election.id).get(),
        ]);
        const candHasVotes = candSnap.docs.some((d) => (Number(d.data()?.votesReceived) || 0) > 0);
        const resPublishedOrCertified = resSnap.exists && (resSnap.data()?.isPublished === true || resSnap.data()?.resultsCertified === true);
        const hasVotingActivity = (Number(election.totalVotesCast) || 0) > 0 ||
            !ballotsSnap.empty ||
            !authSnap.empty ||
            !confirmSnap.empty ||
            candHasVotes ||
            Boolean(election.resultsCertified) ||
            resPublishedOrCertified;
        if (election.isHistorical === true ||
            hasVotingActivity ||
            !allowedDeleteStatuses.has(String(election.status || ''))) {
            inspected.push({
                election,
                disposition: 'detach_archive',
                posRefs: [],
                candRefs: [],
                assignRefs: [],
                resRef: null,
            });
        }
        else {
            inspected.push({
                election,
                disposition: 'delete',
                posRefs: posSnap.docs.map((d) => d.ref),
                candRefs: candSnap.docs.map((d) => d.ref),
                assignRefs: assignSnap.docs.map((d) => d.ref),
                resRef: resSnap.exists && !resPublishedOrCertified ? resSnap.ref : null,
            });
        }
    }
    const detachTargets = inspected.filter((item) => item.disposition === 'detach_archive');
    if (!detachProtectedElections && detachTargets.length > 0) {
        throw new https_1.HttpsError('failed-precondition', 'Protected voting, result, or historical records exist. Approve archival & detachment to clear those elections from the active directory while preserving all protected records.');
    }
    for (const item of inspected) {
        if (item.disposition === 'skip_historical') {
            continue;
        }
        if (item.disposition === 'delete') {
            const refs = [
                ...item.posRefs,
                ...item.candRefs,
                ...item.assignRefs,
            ];
            if (item.resRef)
                refs.push(item.resRef);
            refs.push(db.collection('elections').doc(item.election.id));
            await commitDeletesInChunks(refs);
            hiddenBuiltInIdsToAdd.add(item.election.id);
            removedElectionsCount++;
            removedRelatedDocsCount += Math.max(0, refs.length - 1);
        }
        else {
            await db.collection('elections').doc(item.election.id).update({
                previousStatus: item.election.status,
                status: 'archived',
                isPublished: false,
                hiddenFromDirectory: true,
                archivedAt: item.election.archivedAt || new Date().toISOString(),
                archivedBy: item.election.archivedBy || actorName,
                archivedByUid: item.election.archivedByUid || uid,
                archiveReason: reason ||
                    item.election.archiveReason ||
                    'Archived & detached from active directory while preserving ballots, receipts, and results',
                detachedAt: new Date().toISOString(),
                detachedBy: actorName,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            hiddenBuiltInIdsToAdd.add(item.election.id);
            archivedDetachedCount++;
        }
    }
    if (hiddenBuiltInIdsToAdd.size > 0) {
        await db
            .collection('domains')
            .doc('__directory_config')
            .set({
            hiddenBuiltInElectionIds: admin.firestore.FieldValue.arrayUnion(...Array.from(hiddenBuiltInIdsToAdd)),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: actorName,
        }, { merge: true });
    }
    const preservedCollections = [
        'ballots',
        'voter_authorisations',
        'vote_confirmations',
        'election_results (certified / published)',
        'audit_logs',
        'students',
        'voter_eligibility',
        'admins',
        'contestants',
    ];
    await db.collection('audit_logs').add({
        adminName: actorName,
        adminRole: actor?.role || 'Administrator',
        adminUid: uid,
        reason: reason || 'Bulk election directory clearance executed',
        action: 'REMOVE ALL ELECTIONS Executed',
        target: `Removed ${removedElectionsCount} election(s) (+${removedRelatedDocsCount} related docs); Archived/Detached ${archivedDetachedCount}; Preserved Historical ${preservedHistoricalCount}`,
        ipAddress: 'cloud-functions',
        status: 'warning',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
        success: true,
        removedElectionsCount,
        removedRelatedDocsCount,
        archivedDetachedCount,
        preservedHistoricalCount,
        preservedCollections,
        message: `Cleared active directory: permanently removed ${removedElectionsCount} election(s) and archived/detached ${archivedDetachedCount} protected election(s).`,
    };
});
//# sourceMappingURL=index.js.map