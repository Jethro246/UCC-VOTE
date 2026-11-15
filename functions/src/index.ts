import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as crypto from 'crypto';

const adminApp = admin.initializeApp();
const db = getFirestore(adminApp, 'ai-studio-uccvote-84fbbe19-57dc-4b9d-8017-7c3fcf81fe8c');

async function assertAdmin(uid: string | undefined, tokenClaims: Record<string, any> | undefined) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  if (tokenClaims?.admin === true) {
    const adminSnap = await db.collection('admins').doc(uid).get();
    return adminSnap.exists ? adminSnap.data() : { uid, role: 'Administrator', fullName: 'EC Administrator' };
  }
  const adminSnap = await db.collection('admins').doc(uid).get();
  if (adminSnap.exists && adminSnap.data()?.isActive !== false) {
    return adminSnap.data();
  }
  throw new HttpsError('permission-denied', 'Administrator privileges are required.');
}

function evaluateEligibilityAgainstCriteria(
  student: Record<string, any>,
  criteria: Record<string, any> = {}
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (student.status === 'suspended') {
    reasons.push('Student account is currently suspended.');
  }

  const normalize = (val?: string) => (val || '').trim().toLowerCase();

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

export const checkVoterEligibility = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Please sign in first.');
  }
  const uid = request.auth.uid;
  const electionId = String(request.data?.electionId || '').trim();
  if (!electionId) {
    throw new HttpsError('invalid-argument', 'electionId is required.');
  }

  const [studentSnap, eligSnap, electionSnap, authSnap] = await Promise.all([
    db.collection('students').doc(uid).get(),
    db.collection('voter_eligibility').doc(uid).get(),
    db.collection('elections').doc(electionId).get(),
    db.collection('voter_authorisations').doc(`${electionId}_${uid}`).get(),
  ]);

  if (!electionSnap.exists) {
    throw new HttpsError('not-found', 'Election not found.');
  }
  if (!studentSnap.exists) {
    return {
      eligible: false,
      alreadyVoted: false,
      reasons: ['No UCC student profile activated for this account.'],
    };
  }

  const student = studentSnap.data()!;
  const eligRecord = eligSnap.exists ? eligSnap.data() : null;
  const election = electionSnap.data()!;
  const reasons: string[] = [];

  const isGlobalEligible = eligRecord
    ? eligRecord.isEligible === true && eligRecord.status === 'eligible'
    : student.isEligible === true && student.eligibilityStatus === 'eligible';

  if (!isGlobalEligible) {
    reasons.push(
      'Your student account has not yet been approved by the Electoral Commission on the official UCC voter roll.'
    );
  }

  const criteriaEval = evaluateEligibilityAgainstCriteria(student, election.eligibilityCriteria || {});
  reasons.push(...criteriaEval.reasons);

  return {
    eligible: reasons.length === 0,
    alreadyVoted: authSnap.exists,
    reasons,
    electionTitle: election.title,
  };
});

export const submitBallot = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication is required to cast a ballot.');
  }

  const uid = request.auth.uid;
  const electionId = String(request.data?.electionId || '').trim();
  const rawSelections = request.data?.selections as Record<string, string[]> | undefined;

  if (!electionId || !rawSelections || typeof rawSelections !== 'object') {
    throw new HttpsError('invalid-argument', 'Valid electionId and selections map are required.');
  }

  const electionRef = db.collection('elections').doc(electionId);
  const studentRef = db.collection('students').doc(uid);
  const eligRef = db.collection('voter_eligibility').doc(uid);
  const authLockRef = db.collection('voter_authorisations').doc(`${electionId}_${uid}`);
  const receiptRef = db.collection('vote_confirmations').doc(`${electionId}_${uid}`);

  // Pre-load positions & approved candidates for validation
  const [posSnap, candSnap] = await Promise.all([
    db.collection('positions').where('electionId', '==', electionId).get(),
    db
      .collection('candidates')
      .where('electionId', '==', electionId)
      .where('applicationStatus', '==', 'Approved')
      .get(),
  ]);

  const positionMap = new Map<string, Record<string, any>>();
  posSnap.docs.forEach((d) => positionMap.set(d.id, d.data()));

  const candidateMap = new Map<string, Record<string, any>>();
  candSnap.docs.forEach((d) => candidateMap.set(d.id, d.data()));

  // Validate selections structure against election positions and candidates
  const sanitizedSelections: Record<string, string[]> = {};
  const selectedCandidateIds: string[] = [];

  for (const [posId, candIds] of Object.entries(rawSelections)) {
    if (!Array.isArray(candIds) || candIds.length === 0) continue;
    const pos = positionMap.get(posId);
    if (!pos) {
      throw new HttpsError('invalid-argument', `Invalid position ${posId} for election ${electionId}.`);
    }
    const maxSel = Number(pos.maxSelections) || 1;
    const uniqueCands = Array.from(new Set(candIds.map(String)));
    if (uniqueCands.length > maxSel) {
      throw new HttpsError(
        'invalid-argument',
        `Too many selections for ${pos.title} (maximum ${maxSel}).`
      );
    }
    for (const cid of uniqueCands) {
      const cand = candidateMap.get(cid);
      if (!cand || cand.positionId !== posId) {
        throw new HttpsError('invalid-argument', `Candidate ${cid} is not valid for position ${posId}.`);
      }
      selectedCandidateIds.push(cid);
    }
    sanitizedSelections[posId] = uniqueCands;
  }

  const nowIso = new Date().toISOString();
  const receiptNumber = `UCC-${electionId.slice(0, 6).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
  const cryptographicToken = crypto.randomBytes(16).toString('hex');

  const receiptPayload = await db.runTransaction(async (tx) => {
    const [electionDoc, studentDoc, eligDoc, authLockDoc] = await Promise.all([
      tx.get(electionRef),
      tx.get(studentRef),
      tx.get(eligRef),
      tx.get(authLockRef),
    ]);

    if (!electionDoc.exists) {
      throw new HttpsError('not-found', 'Election does not exist.');
    }
    const election = electionDoc.data()!;
    if (election.status !== 'live') {
      throw new HttpsError('failed-precondition', 'Voting is not currently open for this election.');
    }

    if (authLockDoc.exists) {
      throw new HttpsError('already-exists', 'You have already cast your ballot in this election.');
    }

    if (!studentDoc.exists) {
      throw new HttpsError('failed-precondition', 'Student profile not found.');
    }
    const student = studentDoc.data()!;
    const eligRecord = eligDoc.exists ? eligDoc.data() : null;
    const isGlobalEligible = eligRecord
      ? eligRecord.isEligible === true && eligRecord.status === 'eligible'
      : student.isEligible === true && student.eligibilityStatus === 'eligible';

    if (!isGlobalEligible) {
      throw new HttpsError(
        'permission-denied',
        'Account is not cleared on the official UCC voter eligibility roll.'
      );
    }

    const criteriaEval = evaluateEligibilityAgainstCriteria(
      student,
      election.eligibilityCriteria || {}
    );
    if (!criteriaEval.eligible) {
      throw new HttpsError('permission-denied', criteriaEval.reasons.join(' '));
    }

    // 1. Write duplicate-vote authorisation lock (identity only, zero ballot choices)
    tx.set(authLockRef, {
      uid,
      electionId,
      studentId: student.studentId || '',
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
    const receipt = {
      uid,
      electionId,
      electionTitle: election.title,
      electionCode: election.code || electionId,
      receiptNumber,
      cryptographicToken,
      positionsCount: Object.keys(sanitizedSelections).length,
      submittedAt: nowIso,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };
    tx.set(receiptRef, receipt);

    // 4. Increment election totalVotesCast
    const nextVotesCast = (Number(election.totalVotesCast) || 0) + 1;
    const eligibleTotal = Number(election.totalEligibleVoters) || 0;
    const nextTurnout =
      eligibleTotal > 0 ? Math.min(100, Math.round((nextVotesCast / eligibleTotal) * 1000) / 10) : 0;

    tx.update(electionRef, {
      totalVotesCast: admin.firestore.FieldValue.increment(1),
      turnoutPercentage: nextTurnout,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 5. Increment each chosen candidate's tally
    for (const cid of selectedCandidateIds) {
      tx.update(db.collection('candidates').doc(cid), {
        votesReceived: admin.firestore.FieldValue.increment(1),
      });
    }

    return {
      ...receipt,
      id: receiptRef.id,
      studentId: student.studentId || '',
    };
  });

  return {
    success: true,
    message: 'Ballot recorded securely in Firebase.',
    receipt: receiptPayload,
  };
});

export const certifyAndPublishResults = onCall(async (request) => {
  const actor = await assertAdmin(request.auth?.uid, request.auth?.token);
  const electionId = String(request.data?.electionId || '').trim();
  const targetStage = String(request.data?.targetStage || 'certified').trim();
  const notes = String(request.data?.notes || '').trim();

  if (!electionId) {
    throw new HttpsError('invalid-argument', 'electionId is required.');
  }

  const [electionSnap, positionsSnap, candidatesSnap, ballotsSnap, existingResultsSnap] =
    await Promise.all([
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
    throw new HttpsError('not-found', 'Election not found.');
  }

  const election = electionSnap.data()!;
  const positions = positionsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const candidates = candidatesSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, any>),
  }));

  // Authoritative recount directly from anonymous ballots collection
  const voteCounts = new Map<string, number>();
  ballotsSnap.docs.forEach((bDoc) => {
    const selections = bDoc.data().selections || {};
    Object.values(selections).forEach((candIds: any) => {
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
    const totalValidVotes = posCands.reduce(
      (sum, c) => sum + (voteCounts.get(c.id) ?? Number(c.votesReceived) ?? 0),
      0
    );

    const sorted = [...posCands].sort((a, b) => {
      const va = voteCounts.get(a.id) ?? Number(a.votesReceived) ?? 0;
      const vb = voteCounts.get(b.id) ?? Number(b.votesReceived) ?? 0;
      return vb - va;
    });

    const topVotes =
      sorted.length > 0 ? voteCounts.get(sorted[0].id) ?? Number(sorted[0].votesReceived) ?? 0 : 0;
    const leaders =
      topVotes > 0
        ? sorted.filter(
            (c) => (voteCounts.get(c.id) ?? Number(c.votesReceived) ?? 0) === topVotes
          )
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
    actorId: request.auth!.uid,
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
      turnoutPercentage:
        totalEligibleVoters > 0
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

export const setAdminRole = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  // Allow existing admin OR initial bootstrap when zero admin documents exist
  const adminsCheck = await db.collection('admins').limit(1).get();
  if (!adminsCheck.empty) {
    await assertAdmin(request.auth.uid, request.auth.token);
  }

  const targetUidInput = String(request.data?.uid || '').trim();
  const email = String(request.data?.email || '').trim().toLowerCase();
  const fullName = String(request.data?.fullName || '').trim();
  const staffId = String(request.data?.staffId || '').trim();
  const role = String(request.data?.role || 'Electoral Commissioner').trim();
  const department = String(request.data?.department || 'Electoral Administration').trim();

  if (!targetUidInput && !email) {
    throw new HttpsError('invalid-argument', 'Either uid or email is required.');
  }

  const userRecord = targetUidInput
    ? await admin.auth().getUser(targetUidInput)
    : await admin.auth().getUserByEmail(email);

  await admin.auth().setCustomUserClaims(userRecord.uid, {
    ...(userRecord.customClaims || {}),
    admin: true,
    role,
  });

  const adminProfile = {
    uid: userRecord.uid,
    staffId: staffId || `UCC/EC/${userRecord.uid.slice(0, 6).toUpperCase()}`,
    fullName: fullName || userRecord.displayName || userRecord.email || 'Administrator',
    email: userRecord.email || email,
    role,
    department,
    isActive: true,
    managedDomainIds: Array.isArray(request.data?.managedDomainIds)
      ? request.data.managedDomainIds
      : [],
    managedHalls: Array.isArray(request.data?.managedHalls) ? request.data.managedHalls : [],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('admins').doc(userRecord.uid).set(adminProfile, { merge: true });

  return {
    success: true,
    admin: { id: userRecord.uid, ...adminProfile },
    message: 'Administrator custom claims and Firestore role configured.',
  };
});

export const reviewCandidateApplication = onCall(async (request) => {
  const actor = await assertAdmin(request.auth?.uid, request.auth?.token);
  const candidateId = String(request.data?.candidateId || '').trim();
  const decision = String(request.data?.decision || '').trim();
  const notes = String(request.data?.notes || '').trim();

  if (!candidateId || !['Approved', 'Rejected', 'Under review', 'Withdrawn'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'Valid candidateId and decision are required.');
  }

  const candRef = db.collection('candidates').doc(candidateId);
  const candSnap = await candRef.get();
  if (!candSnap.exists) {
    throw new HttpsError('not-found', 'Candidate nomination not found.');
  }
  const cand = candSnap.data()!;
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
      .catch(() => {});
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
