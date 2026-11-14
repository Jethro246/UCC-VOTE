import type {
  DomainId,
  DomainRegistryItem,
  Election,
  ElectionCategory,
  FacultyUnit,
  DepartmentUnit,
  HallUnit,
  Position,
  Candidate
} from '../types/index.ts';

export const DOMAINS_STORE: Map<DomainId, DomainRegistryItem> = new Map([
  [
    'src',
    {
      id: 'src',
      name: 'SRC General Elections',
      shortName: 'SRC',
      category: 'SRC',
      description:
        "Central Students' Representative Council elections governing all undergraduate student welfare, campus transit, and academic board representation.",
      governanceScope: 'University-wide undergraduate student body',
      eligibilityRuleSummary: 'Registered undergraduate students (Levels 100 – 400) in good standing',
      positionsPolicyNote:
        'Standard executive portfolios include SRC President & Vice President, General Secretary, Treasurer, Coordinating Secretary, and Public Relations Officer (admin-extensible).',
      adminRole: 'SRC Election Administrator',
      supportsSubdomains: false,
      subdomainType: 'none',
      isBuiltIn: true,
      displayOrder: 1
    }
  ],
  [
    'jcrc_hall',
    {
      id: 'jcrc_hall',
      name: 'JCRC / Hall Elections',
      shortName: 'Halls / JCRC',
      category: 'JCR / Hall',
      description:
        'Independent residential hall elections across participating UCC halls. Each hall manages its own constitution-defined positions, contestants, ballots, and results.',
      governanceScope: 'Individual UCC Halls of Residence (hall-by-hall subdomain isolation)',
      eligibilityRuleSummary:
        'Verified residents and affiliated members of the specific participating Hall only',
      positionsPolicyNote:
        'Hall-constitution specific: different halls may configure distinct JCRC offices (e.g., President, Welfare & Sanitation, Financial Controller, Organizing Secretary).',
      adminRole: 'Hall Election Administrator',
      supportsSubdomains: true,
      subdomainType: 'hall',
      isBuiltIn: true,
      displayOrder: 2
    }
  ],
  [
    'grasag',
    {
      id: 'grasag',
      name: 'GRASAG Elections',
      shortName: 'GRASAG',
      category: 'GRASAG',
      description:
        'Graduate Students Association of Ghana (UCC Chapter) elections exclusively for Masters (M.Phil./M.Sc./M.A./MBA) and Ph.D. students under the School of Graduate Studies.',
      governanceScope: 'School of Graduate Studies (Postgraduate community)',
      eligibilityRuleSummary:
        'Strictly restricted to accredited Postgraduate students (strictly separated from SRC/undergraduate voting)',
      positionsPolicyNote:
        'GRASAG-UCC constitutional portfolios configurable by the GRASAG Electoral Board.',
      adminRole: 'GRASAG Election Administrator',
      supportsSubdomains: false,
      subdomainType: 'none',
      isBuiltIn: true,
      displayOrder: 3
    }
  ],
  [
    'local_nugs',
    {
      id: 'local_nugs',
      name: 'Local NUGS Elections',
      shortName: 'Local NUGS',
      category: 'Local NUGS',
      description:
        'University of Cape Coast Local National Union of Ghana Students (Local NUGS) executive elections representing UCC students on national student policy and bursaries.',
      governanceScope: 'UCC Local NUGS Chapter',
      eligibilityRuleSummary: 'Active registered UCC students matching Local NUGS chapter criteria',
      positionsPolicyNote:
        'Dynamic & constitutional: Local NUGS portfolios are not rigidly fixed and can be added, updated, or removed per UCC Local NUGS constitutional approvals.',
      adminRole: 'Local NUGS Election Administrator',
      supportsSubdomains: false,
      subdomainType: 'none',
      isBuiltIn: true,
      displayOrder: 4
    }
  ],
  [
    'departmental',
    {
      id: 'departmental',
      name: 'Departmental Elections',
      shortName: 'Departmental',
      category: 'Departmental',
      description:
        'Department-level student association elections (e.g., NACOS, ChemSA, EduSA, Accounting Society) organized cleanly under UCC Colleges, Schools, Departments, and Academic Programmes.',
      governanceScope: 'Faculty / School -> Department -> Academic Programme',
      eligibilityRuleSummary:
        'Strictly restricted to enrolled students in the sponsoring Department (and Programme where specified)',
      positionsPolicyNote:
        'Configured per departmental student association constitution.',
      adminRole: 'Departmental Election Administrator',
      supportsSubdomains: true,
      subdomainType: 'department',
      isBuiltIn: true,
      displayOrder: 5
    }
  ],
  [
    'faculty_school',
    {
      id: 'faculty_school',
      name: 'Faculty / School Elections',
      shortName: 'Faculty / School',
      category: 'Faculty / School',
      description:
        'Faculty- and School-wide student association governance elections (e.g., SPS-ESA, BUSA-UCC, EdSA, SoLSA) restricted to enrolled students within each School or Faculty.',
      governanceScope: 'Academic Faculties and Schools across UCC Colleges',
      eligibilityRuleSummary:
        'Strictly restricted to enrolled students belonging to the participating Faculty or School',
      positionsPolicyNote:
        'Configured per Faculty/School association bye-laws.',
      adminRole: 'Faculty/School Election Administrator',
      supportsSubdomains: true,
      subdomainType: 'faculty',
      isBuiltIn: true,
      displayOrder: 6
    }
  ]
]);

export const OFFICIAL_UCC_HALLS: HallUnit[] = [
  {
    id: 'hall-adehye',
    code: 'HALL-ADE',
    name: 'Adehye Hall',
    shortName: 'Adehye',
    displayName: 'Adehye Hall',
    affiliationNote: 'University of Cape Coast Residential Hall'
  },
  {
    id: 'hall-atlantic',
    code: 'HALL-ATL',
    name: 'Atlantic Hall',
    shortName: 'ATL',
    displayName: 'Atlantic Hall',
    affiliationNote: 'University of Cape Coast Residential Hall'
  },
  {
    id: 'hall-casford',
    code: 'HALL-CAS',
    name: 'Casely Hayford Hall',
    shortName: 'Casford',
    displayName: 'Casely Hayford Hall (Casford)',
    affiliationNote: 'University of Cape Coast Residential Hall'
  },
  {
    id: 'hall-knh',
    code: 'HALL-KNH',
    name: 'Kwame Nkrumah Hall',
    shortName: 'KNH',
    displayName: 'Kwame Nkrumah Hall (KNH)',
    affiliationNote: 'University of Cape Coast Residential Hall'
  },
  {
    id: 'hall-oguaa',
    code: 'HALL-OGU',
    name: 'Oguaa Hall',
    shortName: 'Oguaa',
    displayName: 'Oguaa Hall',
    affiliationNote: 'University of Cape Coast Residential Hall'
  },
  {
    id: 'hall-valco',
    code: 'HALL-VAL',
    name: 'Valco Hall',
    shortName: 'Valco',
    displayName: 'Valco Hall',
    affiliationNote: 'University of Cape Coast Residential Hall'
  },
  {
    id: 'hall-src',
    code: 'HALL-SRC',
    name: 'SRC Hall',
    shortName: 'SRC Hall',
    displayName: 'SRC Hall',
    affiliationNote: 'University of Cape Coast Residential Hall'
  },
  {
    id: 'hall-super',
    code: 'HALL-SUP',
    name: 'Superannuation Hall',
    shortName: 'Super Hall',
    displayName: 'Superannuation Hall (Super Hall)',
    affiliationNote: 'University of Cape Coast Residential Hall'
  }
];

export const HALLS_STORE: HallUnit[] = OFFICIAL_UCC_HALLS.map((h) => ({ ...h }));

/**
 * Ensures all 8 official UCC halls are present in HALLS_STORE after state hydration,
 * strips any legacy invented mottos, and preserves admin-uploaded verified branding URLs.
 */
export function ensureOfficialHallsPresent(): void {
  const existingById = new Map<string, HallUnit>();
  const customHalls: HallUnit[] = [];

  for (const h of HALLS_STORE) {
    const clean = { ...h };
    delete clean.motto;
    if (OFFICIAL_UCC_HALLS.some((o) => o.id === clean.id)) {
      existingById.set(clean.id, clean);
    } else {
      customHalls.push(clean);
    }
  }

  const merged: HallUnit[] = OFFICIAL_UCC_HALLS.map((official) => {
    const prev = existingById.get(official.id);
    return {
      ...official,
      ...(prev?.brandingLogoUrl
        ? {
            brandingLogoUrl: prev.brandingLogoUrl,
            brandingUpdatedAt: prev.brandingUpdatedAt,
            brandingUpdatedBy: prev.brandingUpdatedBy
          }
        : {})
    };
  });

  HALLS_STORE.splice(0, HALLS_STORE.length, ...merged, ...customHalls);
}

export const FACULTIES_STORE: FacultyUnit[] = [
  {
    id: 'fac-sps',
    name: 'School of Physical Sciences',
    code: 'SPS',
    college: 'College of Agriculture and Natural Sciences'
  },
  {
    id: 'fac-sbs',
    name: 'School of Biological Sciences',
    code: 'SBS',
    college: 'College of Agriculture and Natural Sciences'
  },
  {
    id: 'fac-bus',
    name: 'School of Business',
    code: 'SoB',
    college: 'College of Humanities and Legal Studies'
  },
  {
    id: 'fac-arts',
    name: 'Faculty of Arts',
    code: 'FoA',
    college: 'College of Humanities and Legal Studies'
  },
  {
    id: 'fac-soc',
    name: 'Faculty of Social Sciences',
    code: 'FSS',
    college: 'College of Humanities and Legal Studies'
  },
  {
    id: 'fac-law',
    name: 'Faculty of Law',
    code: 'FoL',
    college: 'College of Humanities and Legal Studies'
  },
  {
    id: 'fac-edu',
    name: 'Faculty of Educational Foundations',
    code: 'FEF',
    college: 'College of Education Studies'
  },
  {
    id: 'fac-sms',
    name: 'School of Medical Sciences',
    code: 'SMS',
    college: 'College of Health and Allied Sciences'
  }
];

export const DEPARTMENTS_STORE: DepartmentUnit[] = [
  {
    id: 'dept-csit',
    name: 'Computer Science & Information Technology',
    code: 'DCIT',
    facultyId: 'fac-sps',
    facultyName: 'School of Physical Sciences',
    programmes: ['B.Sc. Computer Science', 'B.Sc. Information Technology', 'Ph.D. Computer Science']
  },
  {
    id: 'dept-chem',
    name: 'Chemistry',
    code: 'CHEM',
    facultyId: 'fac-sps',
    facultyName: 'School of Physical Sciences',
    programmes: ['B.Sc. Chemistry', 'B.Sc. Industrial Chemistry']
  },
  {
    id: 'dept-math',
    name: 'Mathematics',
    code: 'MATH',
    facultyId: 'fac-sps',
    facultyName: 'School of Physical Sciences',
    programmes: ['B.Sc. Mathematics', 'M.Sc. Applied Mathematics']
  },
  {
    id: 'dept-phys',
    name: 'Physics',
    code: 'PHYS',
    facultyId: 'fac-sps',
    facultyName: 'School of Physical Sciences',
    programmes: ['B.Sc. Physics', 'B.Sc. Engineering Physics']
  },
  {
    id: 'dept-stat',
    name: 'Statistics',
    code: 'STAT',
    facultyId: 'fac-sps',
    facultyName: 'School of Physical Sciences',
    programmes: ['B.Sc. Statistics', 'B.Sc. Actuarial Science']
  },
  {
    id: 'dept-acc',
    name: 'Accounting',
    code: 'ACC',
    facultyId: 'fac-bus',
    facultyName: 'School of Business',
    programmes: ['B.Com. Accounting', 'M.Phil. Accounting']
  },
  {
    id: 'dept-fin',
    name: 'Finance',
    code: 'FIN',
    facultyId: 'fac-bus',
    facultyName: 'School of Business',
    programmes: ['B.Com. Finance', 'M.Sc. Finance']
  },
  {
    id: 'dept-mkt',
    name: 'Marketing & Supply Chain',
    code: 'MKT',
    facultyId: 'fac-bus',
    facultyName: 'School of Business',
    programmes: ['B.Com. Marketing', 'B.Com. Procurement & Supply Chain']
  },
  {
    id: 'dept-mgt',
    name: 'Management',
    code: 'MGT',
    facultyId: 'fac-bus',
    facultyName: 'School of Business',
    programmes: ['B.Com. Human Resource Management', 'M.Phil. Management']
  },
  {
    id: 'dept-edu-found',
    name: 'Educational Foundations',
    code: 'EFD',
    facultyId: 'fac-edu',
    facultyName: 'Faculty of Educational Foundations',
    programmes: [
      'B.Ed. Psychology & Foundations',
      'B.Ed. Early Childhood Education',
      'M.Phil. Educational Psychology'
    ]
  },
  {
    id: 'dept-asse',
    name: 'Arts and Social Sciences Education',
    code: 'DASSE',
    facultyId: 'fac-edu',
    facultyName: 'Faculty of Educational Foundations',
    programmes: ['B.Ed. Social Studies', 'B.Ed. Arts', 'B.Ed. Social Sciences']
  },
  {
    id: 'dept-comm',
    name: 'Communication Studies',
    code: 'COMM',
    facultyId: 'fac-arts',
    facultyName: 'Faculty of Arts',
    programmes: ['B.A. Communication Studies', 'B.A. Communication and Public Relations']
  },
  {
    id: 'dept-hist',
    name: 'History',
    code: 'HIST',
    facultyId: 'fac-arts',
    facultyName: 'Faculty of Arts',
    programmes: ['B.A. History', 'B.A. History and Political Studies']
  },
  {
    id: 'dept-econ',
    name: 'Economics',
    code: 'ECON',
    facultyId: 'fac-soc',
    facultyName: 'Faculty of Social Sciences',
    programmes: ['B.A. Economics', 'B.Sc. Economics']
  },
  {
    id: 'dept-pol',
    name: 'Political Studies',
    code: 'POL',
    facultyId: 'fac-soc',
    facultyName: 'Faculty of Social Sciences',
    programmes: ['B.A. Political Science']
  },
  {
    id: 'dept-law',
    name: 'Law',
    code: 'LAW',
    facultyId: 'fac-law',
    facultyName: 'Faculty of Law',
    programmes: ['LL.B. Bachelor of Laws']
  },
  {
    id: 'dept-sms',
    name: 'School of Medical Sciences',
    code: 'SMS',
    facultyId: 'fac-sms',
    facultyName: 'School of Medical Sciences',
    programmes: ['MB ChB Medicine & Surgery']
  },
  {
    id: 'dept-bch',
    name: 'Biochemistry',
    code: 'BCH',
    facultyId: 'fac-sbs',
    facultyName: 'School of Biological Sciences',
    programmes: ['B.Sc. Biochemistry']
  }
];

export function normalizeText(value?: string): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function categoryToDomainId(category?: ElectionCategory | string): DomainId {
  switch (category) {
    case 'SRC':
      return 'src';
    case 'JCR / Hall':
      return 'jcrc_hall';
    case 'GRASAG':
      return 'grasag';
    case 'Local NUGS':
      return 'local_nugs';
    case 'Departmental':
      return 'departmental';
    case 'Faculty / School':
      return 'faculty_school';
    default:
      if (category) {
        const lower = category.toLowerCase();
        for (const dom of DOMAINS_STORE.values()) {
          if (dom.category.toLowerCase() === lower || dom.id.toLowerCase() === lower) {
            return dom.id;
          }
        }
      }
      return 'src';
  }
}

export function domainIdToCategory(domainId?: DomainId): ElectionCategory {
  if (!domainId) return 'SRC';
  const dom = DOMAINS_STORE.get(domainId);
  if (dom) return dom.category;
  switch (domainId) {
    case 'src':
      return 'SRC';
    case 'jcrc_hall':
      return 'JCR / Hall';
    case 'grasag':
      return 'GRASAG';
    case 'local_nugs':
      return 'Local NUGS';
    case 'departmental':
      return 'Departmental';
    case 'faculty_school':
      return 'Faculty / School';
    default:
      return 'Other';
  }
}

export function matchesHallName(studentHall: string | undefined, targetHall: string | undefined): boolean {
  const s = normalizeText(studentHall);
  const t = normalizeText(targetHall);
  if (!s || !t) return false;
  if (s === t) return true;

  const sClean = s.replace(/\bhall\b/g, '').trim();
  const tClean = t.replace(/\bhall\b/g, '').trim();
  if (sClean && tClean && sClean === tClean) return true;

  if (
    (s.includes('casford') || s.includes('casely hayford') || s === 'hall-casford' || s === 'hall-cas') &&
    (t.includes('casford') || t.includes('casely hayford') || t === 'hall-casford' || t === 'hall-cas')
  ) {
    return true;
  }
  if (
    (s.includes('kwame nkrumah') || s === 'knh' || s === 'hall-knh') &&
    (t.includes('kwame nkrumah') || t === 'knh' || t === 'hall-knh')
  ) {
    return true;
  }
  if (
    (s.includes('atlantic') || s === 'atl' || s === 'hall-atlantic' || s === 'hall-atl') &&
    (t.includes('atlantic') || t === 'atl' || t === 'hall-atlantic' || t === 'hall-atl')
  ) {
    return true;
  }
  if (
    (s.includes('adehye') || s === 'hall-adehye' || s === 'hall-ade') &&
    (t.includes('adehye') || t === 'hall-adehye' || t === 'hall-ade')
  ) {
    return true;
  }
  if (
    (s.includes('oguaa') || s === 'hall-oguaa' || s === 'hall-ogu') &&
    (t.includes('oguaa') || t === 'hall-oguaa' || t === 'hall-ogu')
  ) {
    return true;
  }
  if (
    (s.includes('valco') || s === 'hall-valco' || s === 'hall-val') &&
    (t.includes('valco') || t === 'hall-valco' || t === 'hall-val')
  ) {
    return true;
  }
  const isSrcHall = (val: string) =>
    val === 'src hall' || val === 'src hostel' || val === 'hall-src' || val === 'hall_src';
  if (isSrcHall(s) && isSrcHall(t)) {
    return true;
  }
  const isSuperHall = (val: string) =>
    val.includes('superannuation') ||
    val === 'super hall' ||
    val === 'super' ||
    val === 'hall-super' ||
    val === 'hall-sup';
  if (isSuperHall(s) && isSuperHall(t)) {
    return true;
  }

  return false;
}

export function resolveHallUnit(hallNameOrId?: string): HallUnit | undefined {
  if (!hallNameOrId || !hallNameOrId.trim()) return undefined;
  const q = normalizeText(hallNameOrId);
  return HALLS_STORE.find(
    (h) =>
      normalizeText(h.id) === q ||
      (h.code && normalizeText(h.code) === q) ||
      (h.displayName && normalizeText(h.displayName) === q) ||
      matchesHallName(h.name, hallNameOrId) ||
      matchesHallName(h.shortName, hallNameOrId)
  );
}

export function resolveFacultyUnit(facultyNameOrId?: string): FacultyUnit | undefined {
  if (!facultyNameOrId) return undefined;
  const q = normalizeText(facultyNameOrId);
  return FACULTIES_STORE.find(
    (f) => f.id === facultyNameOrId || normalizeText(f.name) === q || normalizeText(f.code) === q || normalizeText(f.name).includes(q)
  );
}

export function resolveDepartmentUnit(deptNameOrId?: string): DepartmentUnit | undefined {
  if (!deptNameOrId) return undefined;
  const q = normalizeText(deptNameOrId);
  return DEPARTMENTS_STORE.find(
    (d) =>
      d.id === deptNameOrId ||
      normalizeText(d.name) === q ||
      normalizeText(d.code) === q ||
      normalizeText(d.name).includes(q)
  );
}

/**
 * Attaches relational domainId, hallId, facultyId, departmentId, and subdomainLabel
 * to an Election record cleanly without overwriting existing attributes.
 */
export function enrichElectionDomainRelations(election: Election): Election {
  const domainId = election.domainId || categoryToDomainId(election.category);
  const category = domainIdToCategory(domainId) || election.category;
  const crit = election.eligibilityCriteria || {};

  let hallId = election.hallId;
  let facultyId = election.facultyId;
  let departmentId = election.departmentId;
  let subdomainLabel = election.subdomainLabel;

  if (domainId === 'jcrc_hall') {
    const unit = resolveHallUnit(hallId || crit.halls?.[0] || subdomainLabel);
    if (unit) {
      hallId = unit.id;
      subdomainLabel = unit.name;
    } else if (crit.halls && crit.halls.length > 0 && !subdomainLabel) {
      subdomainLabel = crit.halls[0];
    }
  } else if (domainId === 'departmental' && crit.departments && crit.departments.length > 0) {
    const dept = resolveDepartmentUnit(crit.departments[0]);
    if (dept) {
      if (!departmentId) departmentId = dept.id;
      if (!facultyId) facultyId = dept.facultyId;
      if (!subdomainLabel) subdomainLabel = dept.name;
    } else if (!subdomainLabel) {
      subdomainLabel = crit.departments[0];
    }
  } else if (domainId === 'faculty_school' && crit.faculties && crit.faculties.length > 0) {
    const fac = resolveFacultyUnit(crit.faculties[0]);
    if (fac) {
      if (!facultyId) facultyId = fac.id;
      if (!subdomainLabel) subdomainLabel = fac.name;
    } else if (!subdomainLabel) {
      subdomainLabel = crit.faculties[0];
    }
  } else if (!subdomainLabel) {
    const dom = DOMAINS_STORE.get(domainId);
    subdomainLabel = dom?.governanceScope || election.organizingBody;
  }

  return {
    ...election,
    category,
    domainId,
    hallId,
    facultyId,
    departmentId,
    subdomainLabel
  };
}

/**
 * Idempotent relational migration for pre-existing in-memory elections, positions, and candidates.
 * Preserves 100% of existing IDs, tallies, and statuses while guaranteeing foreign-key consistency.
 */
export function runRelationalDomainMigration(stores: {
  elections: Map<string, Election>;
  positions: Map<string, Position[]>;
  candidates: Map<string, Candidate>;
}): void {
  for (const [id, rawElection] of stores.elections.entries()) {
    const enriched = enrichElectionDomainRelations(rawElection);
    stores.elections.set(id, enriched);

    const posList = stores.positions.get(id) || [];
    const updatedPositions = posList.map((pos) => ({
      ...pos,
      domainId: pos.domainId || enriched.domainId,
      hallId: pos.hallId || enriched.hallId,
      facultyId: pos.facultyId || enriched.facultyId,
      departmentId: pos.departmentId || enriched.departmentId
    }));
    stores.positions.set(id, updatedPositions);
  }

  for (const [cid, cand] of stores.candidates.entries()) {
    const parentElection = stores.elections.get(cand.electionId);
    if (parentElection) {
      stores.candidates.set(cid, {
        ...cand,
        domainId: cand.domainId || parentElection.domainId,
        hallId: cand.hallId || parentElection.hallId,
        facultyId: cand.facultyId || parentElection.facultyId,
        departmentId: cand.departmentId || parentElection.departmentId
      });
    }
  }
}
