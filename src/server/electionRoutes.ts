import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from './authRoutes.ts';
import {
  ALL_MANAGING_ADMIN_ROLES,
  canAdminAccessDomain,
  canAdminManageElection,
  requireAdminRole
} from './adminRoutes.ts';
import {
  ELECTIONS_STORE,
  POSITIONS_STORE,
  isValidTransition,
  VALID_STATUS_TRANSITIONS,
  verifyStudentEligibility,
  calculateEligibleVoterCount
} from './electionStore.ts';
import {
  categoryToDomainId,
  domainIdToCategory,
  enrichElectionDomainRelations,
  matchesHallName,
  normalizeText
} from './domainStore.ts';
import { logAuditEvent, OFFICIAL_UCC_STUDENT_REGISTRY, STUDENT_ACCOUNTS } from './authStore.ts';
import type { SessionData } from './authStore.ts';
import type { DomainId, Election, ElectionCategory, ElectionStatus, Position } from '../types/index.ts';

export const electionRouter = Router();

// ==========================================
// PUBLIC & STUDENT READ ROUTES
// ==========================================

/**
 * GET /api/elections
 * Returns list of elections with optional domainId, subdomain, category, and status filtering
 */
electionRouter.get('/', (req: Request, res: Response) => {
  const { domainId, hallId, facultyId, departmentId, category, status, search } = req.query;
  let list = Array.from(ELECTIONS_STORE.values());

  if (domainId && typeof domainId === 'string' && domainId !== 'All') {
    list = list.filter((e) => (e.domainId || categoryToDomainId(e.category)) === domainId);
  }

  if (hallId && typeof hallId === 'string' && hallId !== 'All') {
    list = list.filter(
      (e) =>
        e.hallId === hallId ||
        e.eligibilityCriteria?.halls?.some((h) => matchesHallName(h, hallId))
    );
  }

  if (facultyId && typeof facultyId === 'string' && facultyId !== 'All') {
    list = list.filter(
      (e) =>
        e.facultyId === facultyId ||
        e.eligibilityCriteria?.faculties?.some((f) => normalizeText(f).includes(normalizeText(facultyId)))
    );
  }

  if (departmentId && typeof departmentId === 'string' && departmentId !== 'All') {
    list = list.filter(
      (e) =>
        e.departmentId === departmentId ||
        e.eligibilityCriteria?.departments?.some((d) =>
          normalizeText(d).includes(normalizeText(departmentId))
        )
    );
  }

  if (category && category !== 'All') {
    list = list.filter((e) => e.category === category);
  }

  if (status && status !== 'All') {
    list = list.filter((e) => e.status === status);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.subdomainLabel && e.subdomainLabel.toLowerCase().includes(q))
    );
  }

  list.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return res.json({
    success: true,
    total: list.length,
    elections: list
  });
});

/**
 * GET /api/elections/:id
 * Returns a single election by ID along with its positions
 */
electionRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const election = ELECTIONS_STORE.get(id);

  if (!election) {
    return res.status(404).json({
      success: false,
      error: `Election with ID '${id}' was not found in the commission registry.`
    });
  }

  const positions = [...(POSITIONS_STORE.get(id) || [])].sort((a, b) => a.order - b.order);

  return res.json({
    success: true,
    election,
    positions
  });
});

/**
 * POST /api/elections/:id/check-eligibility
 * Tests an authenticated student or provided student ID against this election's rules
 */
electionRouter.post('/:id/check-eligibility', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const election = ELECTIONS_STORE.get(id);

  if (!election) {
    return res.status(404).json({ success: false, error: 'Election not found.' });
  }

  const session = (req as any).session as SessionData;
  let targetStudent: any = null;

  if (req.body && req.body.studentId) {
    const rawId = req.body.studentId.trim();
    for (const s of STUDENT_ACCOUNTS.values()) {
      if (s.studentId.toLowerCase() === rawId.toLowerCase() || s.id === rawId) {
        targetStudent = { ...s };
        break;
      }
    }
    if (!targetStudent) {
      targetStudent = STUDENT_ACCOUNTS.get(rawId) || OFFICIAL_UCC_STUDENT_REGISTRY[rawId];
    }
  }

  if (!targetStudent && session && session.userType === 'student') {
    targetStudent = STUDENT_ACCOUNTS.get(session.userId);
    if (!targetStudent) {
      for (const s of STUDENT_ACCOUNTS.values()) {
        if (s.id === session.userId || s.studentId === session.userId) {
          targetStudent = { ...s };
          break;
        }
      }
    }
    if (!targetStudent && session.userId) {
      targetStudent = OFFICIAL_UCC_STUDENT_REGISTRY[session.userId];
    }
  }

  if (!targetStudent && session && session.userType === 'student') {
    targetStudent = STUDENT_ACCOUNTS.get('PS/CSC/22/0089');
  }

  if (!targetStudent) {
    return res.status(400).json({
      success: false,
      error: 'Student profile could not be located for eligibility evaluation.'
    });
  }

  const liveAccount = Array.from(STUDENT_ACCOUNTS.values()).find(
    (s) => s.studentId === targetStudent.studentId || s.id === targetStudent.id
  );
  if (liveAccount && liveAccount.status) {
    targetStudent = { ...targetStudent, status: liveAccount.status };
  }

  const result = verifyStudentEligibility(targetStudent, election);

  return res.json({
    success: true,
    electionId: id,
    studentId: targetStudent.studentId,
    studentName: targetStudent.fullName,
    result
  });
});

// ==========================================
// PROTECTED ADMINISTRATIVE MANAGEMENT ROUTES
// ==========================================

/**
 * POST /api/elections
 * Create a new election (Global admins OR authorized Domain/Subdomain admins for their own scope)
 */
electionRouter.post(
  '/',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const body = req.body || {};

    const {
      title,
      code,
      description,
      category,
      domainId,
      hallId,
      facultyId,
      departmentId,
      subdomainLabel,
      academicYear,
      startDate,
      endDate,
      organizingBody,
      rules,
      eligibilityCriteria,
      positions
    } = body;

    const resolvedDomainId: DomainId = domainId || categoryToDomainId(category);
    const resolvedCategory: ElectionCategory = category || domainIdToCategory(resolvedDomainId);

    if (!title || (!category && !domainId) || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed: Title, domain/category, start date, and end date are mandatory.'
      });
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid start or closing date format. Use ISO timestamp (YYYY-MM-DD).'
      });
    }

    if (end <= start) {
      return res.status(400).json({
        success: false,
        error: 'Invalid schedule: Election closing date/time must be strictly after the opening date/time.'
      });
    }

    const parsedCriteria = {
      faculties: Array.isArray(eligibilityCriteria?.faculties) ? eligibilityCriteria.faculties : [],
      departments: Array.isArray(eligibilityCriteria?.departments)
        ? eligibilityCriteria.departments
        : [],
      programmes: Array.isArray(eligibilityCriteria?.programmes) ? eligibilityCriteria.programmes : [],
      levels: Array.isArray(eligibilityCriteria?.levels) ? eligibilityCriteria.levels : [],
      halls: Array.isArray(eligibilityCriteria?.halls) ? eligibilityCriteria.halls : []
    };

    // Enforce GRASAG Postgraduate-only constitutional isolation
    if (resolvedDomainId === 'grasag') {
      parsedCriteria.levels = ['Postgraduate'];
    }

    // Domain & Subdomain RBAC Guard
    const accessCheck = canAdminAccessDomain(session, resolvedDomainId, {
      hall: parsedCriteria.halls[0] || subdomainLabel,
      faculty: parsedCriteria.faculties[0] || subdomainLabel,
      department: parsedCriteria.departments[0] || subdomainLabel
    });

    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: resolvedDomainId,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked election creation in '${resolvedDomainId}': ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    const electionId =
      body.id ||
      `UCC-${resolvedCategory.replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    if (ELECTIONS_STORE.has(electionId)) {
      return res.status(409).json({
        success: false,
        error: `An election with identifier '${electionId}' already exists.`
      });
    }

    const now = Date.now();
    let initialStatus: ElectionStatus = body.status || 'draft';
    if (!body.status) {
      if (start > now) initialStatus = 'scheduled';
      else if (start <= now && end > now) initialStatus = 'live';
      else initialStatus = 'closed';
    }

    const calculatedEligible = calculateEligibleVoterCount(parsedCriteria);

    const baseElection: Election = {
      id: electionId,
      title: title.trim(),
      code: code
        ? code.trim().toUpperCase()
        : `${resolvedCategory.replace(/[^A-Z]/gi, '').substring(0, 4).toUpperCase()}-${academicYear || '2026'}-${Date.now().toString().slice(-3)}`,
      description: description ? description.trim() : 'Officially sanctioned UCC election.',
      category: resolvedCategory,
      domainId: resolvedDomainId,
      hallId,
      facultyId,
      departmentId,
      subdomainLabel,
      academicYear: academicYear || '2026/2027',
      status: initialStatus,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      startTime: body.startTime || '08:00',
      endTime: body.endTime || '17:00',
      totalEligibleVoters: calculatedEligible,
      totalVotesCast: 0,
      turnoutPercentage: 0,
      organizingBody: organizingBody ? organizingBody.trim() : 'UCC Electoral Commission (EC-UCC)',
      eligibilityCriteria: parsedCriteria,
      rules:
        Array.isArray(rules) && rules.length > 0
          ? rules
          : [
              'One verified vote per accredited student per contested portfolio.',
              'Ballot secrecy is cryptographically preserved; votes are decoupled from voter identities.',
              'Voting closes automatically at official scheduled time.'
            ],
      positionsCount: Array.isArray(positions) ? positions.length : body.positionsCount || 0,
      resultsCertified: false,
      provisionalResultsReady: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedBy: session.userId
    };

    const newElection = enrichElectionDomainRelations(baseElection);
    ELECTIONS_STORE.set(electionId, newElection);

    if (Array.isArray(positions) && positions.length > 0) {
      const formattedPositions: Position[] = positions.map((p: any, idx: number) => ({
        id: p.id || `pos-${electionId}-${idx + 1}`,
        electionId,
        domainId: newElection.domainId,
        hallId: newElection.hallId,
        facultyId: newElection.facultyId,
        departmentId: newElection.departmentId,
        title: p.title,
        description: p.description || `Contested portfolio for ${p.title}`,
        maxSelections: p.maxSelections || 1,
        allowsSkip: p.allowsSkip ?? false,
        order: p.order || idx + 1,
        candidateIds: p.candidateIds || [],
        candidateEligibilityRules:
          p.candidateEligibilityRules || 'Registered student in good standing.',
        votingRules: p.votingRules || 'Single choice vote'
      }));
      POSITIONS_STORE.set(electionId, formattedPositions);
      newElection.positionsCount = formattedPositions.length;
    } else {
      POSITIONS_STORE.set(electionId, []);
    }

    logAuditEvent({
      eventType: 'CREATE_ELECTION',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Created new ${newElection.category} (${newElection.domainId}) election: "${title}" (ID: ${electionId}, Status: ${initialStatus}).`
    });

    return res.status(201).json({
      success: true,
      message: `Election '${title}' created successfully.`,
      election: newElection,
      positions: POSITIONS_STORE.get(electionId) || []
    });
  }
);

/**
 * PUT /api/elections/:id
 * Update election details (Scoped by domain/subdomain RBAC)
 */
electionRouter.put(
  '/:id',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const existing = ELECTIONS_STORE.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Election not found.' });
    }

    const accessCheck = canAdminManageElection(session, existing);
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: id,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked election update for ${id}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    if (existing.status === 'archived') {
      return res.status(400).json({
        success: false,
        error: 'Archived elections are immutable and cannot be modified.'
      });
    }

    const { title, description, startDate, endDate, organizingBody, rules, eligibilityCriteria } =
      req.body || {};

    if (startDate && endDate) {
      const s = new Date(startDate).getTime();
      const e = new Date(endDate).getTime();
      if (e <= s) {
        return res.status(400).json({
          success: false,
          error: 'Closing date must be strictly after opening date.'
        });
      }
    }

    const mergedCriteria = eligibilityCriteria
      ? {
          ...existing.eligibilityCriteria,
          ...eligibilityCriteria
        }
      : existing.eligibilityCriteria;

    if ((existing.domainId || categoryToDomainId(existing.category)) === 'grasag') {
      mergedCriteria.levels = ['Postgraduate'];
    }

    const updated: Election = enrichElectionDomainRelations({
      ...existing,
      title: title !== undefined ? title.trim() : existing.title,
      description: description !== undefined ? description.trim() : existing.description,
      startDate: startDate ? new Date(startDate).toISOString() : existing.startDate,
      endDate: endDate ? new Date(endDate).toISOString() : existing.endDate,
      organizingBody: organizingBody !== undefined ? organizingBody.trim() : existing.organizingBody,
      rules: Array.isArray(rules) ? rules : existing.rules,
      eligibilityCriteria: mergedCriteria,
      updatedAt: new Date().toISOString()
    });

    ELECTIONS_STORE.set(id, updated);

    logAuditEvent({
      eventType: 'UPDATE_ELECTION',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Updated parameters for election ${id} ("${updated.title}").`
    });

    return res.json({
      success: true,
      message: `Election '${updated.title}' updated successfully.`,
      election: updated
    });
  }
);

/**
 * PATCH /api/elections/:id/status
 * Perform state machine transition (Scoped by domain/subdomain RBAC)
 */
electionRouter.patch(
  '/:id/status',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { newStatus, justification } = req.body || {};
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const election = ELECTIONS_STORE.get(id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found.' });
    }

    const accessCheck = canAdminManageElection(session, election);
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: id,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked status transition on ${id}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    if (!newStatus) {
      return res.status(400).json({ success: false, error: 'Target newStatus is required.' });
    }

    const currentStatus = election.status;
    if (!isValidTransition(currentStatus, newStatus as ElectionStatus)) {
      const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
      return res.status(400).json({
        success: false,
        error: `Illegal state transition: Cannot change status from '${currentStatus}' to '${newStatus}'. Allowed transitions from '${currentStatus}': [${allowed.join(', ')}].`
      });
    }

    election.status = newStatus as ElectionStatus;
    election.updatedAt = new Date().toISOString();

    if (newStatus === 'results_published') {
      election.resultsCertified = true;
      election.provisionalResultsReady = true;
    }

    ELECTIONS_STORE.set(id, election);

    logAuditEvent({
      eventType: 'ELECTION_STATUS_CHANGE',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Transitioned election ${id} from '${currentStatus}' to '${newStatus}'. Justification: ${justification || 'Administrative order'}.`
    });

    return res.json({
      success: true,
      message: `Election '${election.title}' is now ${newStatus.toUpperCase()}.`,
      election
    });
  }
);

/**
 * GET /api/elections/:id/positions
 * Return positions for a given election
 */
electionRouter.get('/:id/positions', (req: Request, res: Response) => {
  const { id } = req.params;
  const positions = [...(POSITIONS_STORE.get(id) || [])].sort((a, b) => a.order - b.order);
  return res.json({ success: true, positions });
});

/**
 * POST /api/elections/:id/positions
 * Add a new contested position to an election (Dynamic per hall / Local NUGS / domain rules)
 */
electionRouter.post(
  '/:id/positions',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id } = req.params;
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const election = ELECTIONS_STORE.get(id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found.' });
    }

    const accessCheck = canAdminManageElection(session, election);
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: id,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked creating position on ${id}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    const {
      title,
      description,
      maxSelections,
      allowsSkip,
      candidateEligibilityRules,
      votingRules
    } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Position title is mandatory.' });
    }

    const existingPositions = POSITIONS_STORE.get(id) || [];
    const newPosition: Position = {
      id: `pos-${id}-${Date.now().toString().slice(-4)}-${existingPositions.length + 1}`,
      electionId: id,
      domainId: election.domainId || categoryToDomainId(election.category),
      hallId: election.hallId,
      facultyId: election.facultyId,
      departmentId: election.departmentId,
      title: title.trim(),
      description: description?.trim() || `Portfolio for ${title.trim()}`,
      maxSelections: maxSelections || 1,
      allowsSkip: allowsSkip ?? false,
      order: existingPositions.length + 1,
      candidateIds: [],
      candidateEligibilityRules: candidateEligibilityRules || 'Accredited student in good standing.',
      votingRules: votingRules || 'Single candidate preference'
    };

    existingPositions.push(newPosition);
    POSITIONS_STORE.set(id, existingPositions);

    election.positionsCount = existingPositions.length;
    election.updatedAt = new Date().toISOString();
    ELECTIONS_STORE.set(id, election);

    logAuditEvent({
      eventType: 'CREATE_POSITION',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Added position '${newPosition.title}' to election ${id}.`
    });

    return res.status(201).json({
      success: true,
      message: `Position '${newPosition.title}' added successfully.`,
      position: newPosition,
      allPositions: existingPositions
    });
  }
);

/**
 * PUT /api/elections/:id/positions/:posId
 * Update a position's title, description, or voting parameters dynamically
 */
electionRouter.put(
  '/:id/positions/:posId',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id, posId } = req.params;
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const election = ELECTIONS_STORE.get(id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found.' });
    }

    const accessCheck = canAdminManageElection(session, election);
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: id,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked position update on ${id}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    const positions = POSITIONS_STORE.get(id) || [];
    const target = positions.find((p) => p.id === posId);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Position not found.' });
    }

    const { title, description, maxSelections, allowsSkip, candidateEligibilityRules, votingRules } =
      req.body || {};
    if (title !== undefined && title.trim()) target.title = title.trim();
    if (description !== undefined) target.description = description.trim();
    if (typeof maxSelections === 'number' && maxSelections >= 1) target.maxSelections = maxSelections;
    if (typeof allowsSkip === 'boolean') target.allowsSkip = allowsSkip;
    if (candidateEligibilityRules !== undefined) {
      target.candidateEligibilityRules = candidateEligibilityRules;
    }
    if (votingRules !== undefined) target.votingRules = votingRules;

    POSITIONS_STORE.set(id, positions);
    election.updatedAt = new Date().toISOString();
    ELECTIONS_STORE.set(id, election);

    logAuditEvent({
      eventType: 'UPDATE_POSITION',
      userId: session.userId,
      identifier: posId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Updated position '${target.title}' in election ${id}.`
    });

    return res.json({
      success: true,
      message: `Position '${target.title}' updated successfully.`,
      position: target,
      allPositions: positions
    });
  }
);

/**
 * DELETE /api/elections/:id/positions/:posId
 * Delete a contested position from an election (Scoped by domain RBAC)
 */
electionRouter.delete(
  '/:id/positions/:posId',
  authenticateToken,
  requireAdminRole(ALL_MANAGING_ADMIN_ROLES),
  (req: Request, res: Response) => {
    const { id, posId } = req.params;
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const election = ELECTIONS_STORE.get(id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Election not found.' });
    }

    const accessCheck = canAdminManageElection(session, election);
    if (!accessCheck.allowed) {
      logAuditEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: session.userId,
        identifier: id,
        role: session.role,
        ipAddress,
        status: 'FLAGGED',
        details: `Domain RBAC blocked position deletion on ${id}: ${accessCheck.reason}`
      });
      return res.status(403).json({
        success: false,
        code: 'DOMAIN_RBAC_DENIED',
        error: accessCheck.reason
      });
    }

    if (election.status === 'live' || election.status === 'closed') {
      return res.status(400).json({
        success: false,
        error: `Cannot remove positions from an election with status '${election.status}'. Ballots may have already been rendered or cast.`
      });
    }

    const existingPositions = POSITIONS_STORE.get(id) || [];
    const filtered = existingPositions.filter((p) => p.id !== posId);

    if (filtered.length === existingPositions.length) {
      return res.status(404).json({ success: false, error: 'Position not found.' });
    }

    filtered.forEach((p, idx) => {
      p.order = idx + 1;
    });

    POSITIONS_STORE.set(id, filtered);
    election.positionsCount = filtered.length;
    election.updatedAt = new Date().toISOString();
    ELECTIONS_STORE.set(id, election);

    logAuditEvent({
      eventType: 'DELETE_POSITION',
      userId: session.userId,
      identifier: session.userId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Removed position ${posId} from election ${id}.`
    });

    return res.json({
      success: true,
      message: 'Position deleted successfully.',
      remainingPositions: filtered
    });
  }
);
