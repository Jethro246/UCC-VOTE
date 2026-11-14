import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateToken } from './authRoutes.ts';
import { requireAdminRole } from './adminRoutes.ts';
import { logAuditEvent } from './authStore.ts';
import type { SessionData } from './authStore.ts';
import {
  DOMAINS_STORE,
  HALLS_STORE,
  FACULTIES_STORE,
  DEPARTMENTS_STORE,
  categoryToDomainId
} from './domainStore.ts';
import { ELECTIONS_STORE, POSITIONS_STORE, CANDIDATES_STORE } from './electionStore.ts';
import { MOCK_CALENDAR_EVENTS, MOCK_NOTIFICATIONS } from '../data/mockData.ts';
import type { AdminRoleType, DomainId, DomainRegistryItem } from '../types/index.ts';

export const domainRouter = Router();

/**
 * GET /api/domains
 * Returns all university election domains with live stats, institutional units, and position dictionaries
 */
domainRouter.get('/', (_req: Request, res: Response) => {
  const elections = Array.from(ELECTIONS_STORE.values());
  const candidates = Array.from(CANDIDATES_STORE.values());

  const domains = Array.from(DOMAINS_STORE.values())
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((dom) => {
      const domElections = elections.filter(
        (e) => (e.domainId || categoryToDomainId(e.category)) === dom.id
      );
      const activeCount = domElections.filter((e) => e.status === 'live').length;
      const upcomingCount = domElections.filter(
        (e) => e.status === 'upcoming' || e.status === 'scheduled'
      ).length;
      const completedCount = domElections.filter(
        (e) => e.status === 'results_published' || e.status === 'closed'
      ).length;
      const pendingCertCount = domElections.filter(
        (e) => e.status === 'results_pending_certification'
      ).length;
      const totalVotes = domElections.reduce((sum, e) => sum + (e.totalVotesCast || 0), 0);

      return {
        ...dom,
        stats: {
          totalElections: domElections.length,
          activeElections: activeCount,
          upcomingElections: upcomingCount,
          completedElections: completedCount,
          pendingCertification: pendingCertCount,
          totalVotesCast: totalVotes,
          approvedCandidatesCount: candidates.filter(
            (c) =>
              (c.domainId || categoryToDomainId(ELECTIONS_STORE.get(c.electionId)?.category)) ===
                dom.id && c.applicationStatus === 'Approved'
          ).length
        }
      };
    });

  // Flat dictionary of all positions by electionId and id -> position for frontend consistency
  const positionsByElection: Record<string, any[]> = {};
  for (const [elId, posList] of POSITIONS_STORE.entries()) {
    positionsByElection[elId] = [...posList].sort((a, b) => a.order - b.order);
  }

  return res.json({
    success: true,
    domains,
    halls: HALLS_STORE,
    faculties: FACULTIES_STORE,
    departments: DEPARTMENTS_STORE,
    positionsByElection
  });
});

/**
 * GET /api/domains/:domainId
 * Returns detailed elections, subdomains, positions, and candidates strictly scoped to a single domain
 */
domainRouter.get('/:domainId', (req: Request, res: Response) => {
  const { domainId } = req.params;
  const { hallId, facultyId, departmentId, status } = req.query;

  const domain = DOMAINS_STORE.get(domainId as DomainId);
  if (!domain) {
    return res.status(404).json({
      success: false,
      error: `Election domain '${domainId}' not found.`
    });
  }

  let elections = Array.from(ELECTIONS_STORE.values()).filter(
    (e) => (e.domainId || categoryToDomainId(e.category)) === domain.id
  );

  if (hallId && typeof hallId === 'string' && hallId !== 'All') {
    elections = elections.filter(
      (e) =>
        e.hallId === hallId ||
        e.eligibilityCriteria?.halls?.some((h) => h.toLowerCase().includes(hallId.toLowerCase()))
    );
  }

  if (facultyId && typeof facultyId === 'string' && facultyId !== 'All') {
    elections = elections.filter(
      (e) =>
        e.facultyId === facultyId ||
        e.eligibilityCriteria?.faculties?.some((f) =>
          f.toLowerCase().includes(facultyId.toLowerCase())
        )
    );
  }

  if (departmentId && typeof departmentId === 'string' && departmentId !== 'All') {
    elections = elections.filter(
      (e) =>
        e.departmentId === departmentId ||
        e.eligibilityCriteria?.departments?.some((d) =>
          d.toLowerCase().includes(departmentId.toLowerCase())
        )
    );
  }

  if (status && typeof status === 'string' && status !== 'All') {
    elections = elections.filter((e) => e.status === status);
  }

  const electionIds = new Set(elections.map((e) => e.id));
  const positionsByElection: Record<string, any[]> = {};
  for (const el of elections) {
    positionsByElection[el.id] = [...(POSITIONS_STORE.get(el.id) || [])].sort(
      (a, b) => a.order - b.order
    );
  }

  const domainCandidates = Array.from(CANDIDATES_STORE.values()).filter((c) =>
    electionIds.has(c.electionId)
  );

  const notifications = MOCK_NOTIFICATIONS.filter(
    (n) => !n.domainId || n.domainId === domain.id
  );
  const calendarEvents = MOCK_CALENDAR_EVENTS.filter((ev) => ev.domainId === domain.id);

  return res.json({
    success: true,
    domain,
    elections,
    positionsByElection,
    candidates: domainCandidates,
    subdomains: {
      halls: domain.id === 'jcrc_hall' ? HALLS_STORE : [],
      faculties:
        domain.id === 'faculty_school' || domain.id === 'departmental' ? FACULTIES_STORE : [],
      departments: domain.id === 'departmental' ? DEPARTMENTS_STORE : []
    },
    notifications,
    calendarEvents
  });
});

/**
 * POST /api/domains
 * Super Administrator creates a new university election domain dynamically
 */
domainRouter.post(
  '/',
  authenticateToken,
  requireAdminRole(['Super Administrator']),
  (req: Request, res: Response) => {
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const {
      id,
      name,
      shortName,
      category,
      description,
      governanceScope,
      eligibilityRuleSummary,
      positionsPolicyNote,
      supportsSubdomains,
      subdomainType
    } = req.body || {};

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Domain name and description are required.'
      });
    }

    const generatedId: DomainId = (
      id ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
    ) as DomainId;

    if (DOMAINS_STORE.has(generatedId)) {
      return res.status(409).json({
        success: false,
        error: `A domain with ID '${generatedId}' already exists.`
      });
    }

    const newDomain: DomainRegistryItem = {
      id: generatedId,
      name: name.trim(),
      shortName: (shortName || name).trim(),
      category: category || 'Other',
      description: description.trim(),
      governanceScope: (governanceScope || 'Configured UCC Constituency').trim(),
      eligibilityRuleSummary: (
        eligibilityRuleSummary || 'Configured per official UCC Electoral Board bye-laws'
      ).trim(),
      positionsPolicyNote: (
        positionsPolicyNote || 'Positions dynamically managed by authorized domain administrators.'
      ).trim(),
      adminRole: 'Super Administrator' as AdminRoleType,
      supportsSubdomains: Boolean(supportsSubdomains),
      subdomainType: subdomainType || 'none',
      isBuiltIn: false,
      displayOrder: DOMAINS_STORE.size + 1
    };

    DOMAINS_STORE.set(generatedId, newDomain);

    logAuditEvent({
      eventType: 'CREATE_DOMAIN',
      userId: session.userId,
      identifier: generatedId,
      role: session.role,
      ipAddress,
      status: 'SUCCESS',
      details: `Super Administrator created new election domain "${newDomain.name}" (ID: ${generatedId}).`
    });

    return res.status(201).json({
      success: true,
      message: `Election domain '${newDomain.name}' created successfully.`,
      domain: newDomain
    });
  }
);

/**
 * POST /api/domains/:domainId/subdomains
 * Registers a new Hall, Faculty/School, or Department subdomain under an existing domain
 */
domainRouter.post(
  '/:domainId/subdomains',
  authenticateToken,
  requireAdminRole(['Super Administrator', 'Electoral Commissioner']),
  (req: Request, res: Response) => {
    const { domainId } = req.params;
    const session = (req as any).session as SessionData;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const domain = DOMAINS_STORE.get(domainId as DomainId);
    if (!domain) {
      return res.status(404).json({ success: false, error: 'Target domain not found.' });
    }

    const { type, name, shortName, code, college, facultyId, facultyName, programmes } =
      req.body || {};

    if (!name) {
      return res.status(400).json({ success: false, error: 'Subdomain unit name is required.' });
    }

    const unitType = type || domain.subdomainType;
    if (unitType === 'hall') {
      const id = `hall-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      if (HALLS_STORE.some((h) => h.id === id || h.name.toLowerCase() === name.trim().toLowerCase())) {
        return res.status(409).json({ success: false, error: `Hall '${name}' already exists.` });
      }
      const hall = {
        id,
        name: name.trim(),
        shortName: (shortName || name).trim(),
        affiliationNote: 'Participating UCC Residential Hall'
      };
      HALLS_STORE.push(hall);
      logAuditEvent({
        eventType: 'CREATE_SUBDOMAIN',
        userId: session.userId,
        identifier: id,
        role: session.role,
        ipAddress,
        status: 'SUCCESS',
        details: `Registered new JCRC Hall subdomain "${hall.name}".`
      });
      return res.status(201).json({ success: true, subdomain: hall, halls: HALLS_STORE });
    }

    if (unitType === 'faculty') {
      const id = `fac-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 14)}`;
      const fac = {
        id,
        name: name.trim(),
        code: (code || name.slice(0, 4)).toUpperCase(),
        college: (college || 'University of Cape Coast').trim()
      };
      FACULTIES_STORE.push(fac);
      logAuditEvent({
        eventType: 'CREATE_SUBDOMAIN',
        userId: session.userId,
        identifier: id,
        role: session.role,
        ipAddress,
        status: 'SUCCESS',
        details: `Registered new Faculty/School subdomain "${fac.name}".`
      });
      return res.status(201).json({ success: true, subdomain: fac, faculties: FACULTIES_STORE });
    }

    if (unitType === 'department') {
      const id = `dept-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 14)}`;
      const matchedFac =
        FACULTIES_STORE.find((f) => f.id === facultyId || f.name === facultyName) ||
        FACULTIES_STORE[0];
      const dept = {
        id,
        name: name.trim(),
        code: (code || name.slice(0, 4)).toUpperCase(),
        facultyId: matchedFac.id,
        facultyName: matchedFac.name,
        programmes: Array.isArray(programmes) && programmes.length > 0 ? programmes : [`B.Sc. ${name.trim()}`]
      };
      DEPARTMENTS_STORE.push(dept);
      logAuditEvent({
        eventType: 'CREATE_SUBDOMAIN',
        userId: session.userId,
        identifier: id,
        role: session.role,
        ipAddress,
        status: 'SUCCESS',
        details: `Registered new Departmental subdomain "${dept.name}" under ${dept.facultyName}.`
      });
      return res.status(201).json({ success: true, subdomain: dept, departments: DEPARTMENTS_STORE });
    }

    return res.status(400).json({
      success: false,
      error: `Domain '${domain.name}' does not support subdomain creation of type '${unitType}'.`
    });
  }
);
