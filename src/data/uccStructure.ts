import {
  AdminRoleType,
  DepartmentUnit,
  DomainId,
  DomainRegistryItem,
  ElectionCategory,
  FacultyUnit,
  HallUnit,
} from '../types';

export const CATEGORY_TO_DOMAIN_ID: Record<ElectionCategory, DomainId> = {
  SRC: 'src',
  'JCR / Hall': 'jcrc_hall',
  GRASAG: 'grasag',
  'Local NUGS': 'local_nugs',
  Departmental: 'departmental',
  'Faculty / School': 'faculty_school',
  Other: 'src',
};

export const DOMAIN_ID_TO_CATEGORY: Record<string, ElectionCategory> = {
  src: 'SRC',
  jcrc_hall: 'JCR / Hall',
  grasag: 'GRASAG',
  local_nugs: 'Local NUGS',
  departmental: 'Departmental',
  faculty_school: 'Faculty / School',
};

export function categoryToDomainId(category: ElectionCategory): DomainId {
  return CATEGORY_TO_DOMAIN_ID[category] || 'src';
}

export function domainIdToCategory(domainId: DomainId): ElectionCategory {
  return DOMAIN_ID_TO_CATEGORY[domainId] || 'Other';
}

export function getPermissionsForRole(role: AdminRoleType): string[] {
  switch (role) {
    case 'Super Administrator':
      return ['*'];
    case 'Electoral Commissioner':
      return [
        'manage_elections',
        'approve_elections',
        'certify_results',
        'publish_results',
        'manage_domains',
        'manage_candidates',
        'view_audit_logs',
        'manage_admins',
      ];
    case 'Returning Officer':
      return [
        'manage_elections',
        'verify_results',
        'certify_results',
        'manage_candidates',
        'view_audit_logs',
      ];
    case 'Results Auditor':
      return ['audit_results', 'view_audit_logs', 'export_reports'];
    default:
      return [
        'manage_domain_elections',
        'manage_domain_positions',
        'manage_domain_candidates',
        'view_domain_results',
      ];
  }
}

export const DOMAIN_REGISTRY: DomainRegistryItem[] = [
  {
    id: 'src',
    name: 'Students’ Representative Council (SRC)',
    shortName: 'SRC',
    category: 'SRC',
    description:
      'University-wide general elections for the UCC Students’ Representative Council executive leadership.',
    governanceScope: 'All accredited undergraduate students across the University of Cape Coast.',
    eligibilityRuleSummary: 'Verified active UCC undergraduate students.',
    positionsPolicyNote: 'Standard executive portfolio structure governed by the UCC SRC Constitution.',
    adminRole: 'SRC Election Administrator',
    supportsSubdomains: false,
    subdomainType: 'none',
    isBuiltIn: true,
    displayOrder: 1,
  },
  {
    id: 'jcrc_hall',
    name: 'Junior Common Room / Hall Elections (JCR)',
    shortName: 'JCR / Hall',
    category: 'JCR / Hall',
    description:
      'Hall-level Junior Common Room (JCR) executive elections scoped by residential hall affiliation.',
    governanceScope: 'Resident and affiliated students of each official UCC Hall of Residence.',
    eligibilityRuleSummary: 'Students affiliated with the specific hall of residence.',
    positionsPolicyNote: 'Scoped per Hall of Residence.',
    adminRole: 'Hall Election Administrator',
    supportsSubdomains: true,
    subdomainType: 'hall',
    isBuiltIn: true,
    displayOrder: 2,
  },
  {
    id: 'grasag',
    name: 'Graduate Students’ Association of Ghana (GRASAG–UCC)',
    shortName: 'GRASAG',
    category: 'GRASAG',
    description:
      'Postgraduate student executive elections administered under the School of Graduate Studies.',
    governanceScope: 'All enrolled UCC Master’s, MPhil, and PhD postgraduate students.',
    eligibilityRuleSummary: 'Verified Postgraduate level students only.',
    positionsPolicyNote: 'Governed by the GRASAG-UCC Constitution.',
    adminRole: 'GRASAG Election Administrator',
    supportsSubdomains: false,
    subdomainType: 'none',
    isBuiltIn: true,
    displayOrder: 3,
  },
  {
    id: 'local_nugs',
    name: 'Local National Union of Ghana Students (Local NUGS–UCC)',
    shortName: 'Local NUGS',
    category: 'Local NUGS',
    description:
      'UCC Local Secretariat elections representing students in national and international student affairs.',
    governanceScope: 'All accredited UCC students.',
    eligibilityRuleSummary: 'Verified active UCC students.',
    positionsPolicyNote: 'Local Secretariat executive portfolios.',
    adminRole: 'Local NUGS Election Administrator',
    supportsSubdomains: false,
    subdomainType: 'none',
    isBuiltIn: true,
    displayOrder: 4,
  },
  {
    id: 'departmental',
    name: 'Departmental Association Elections',
    shortName: 'Departmental',
    category: 'Departmental',
    description:
      'Academic department society elections scoped to students enrolled in the respective department.',
    governanceScope: 'Students enrolled in programmes hosted by the respective academic department.',
    eligibilityRuleSummary: 'Students enrolled in the target academic department.',
    positionsPolicyNote: 'Departmental executive portfolios.',
    adminRole: 'Departmental Election Administrator',
    supportsSubdomains: true,
    subdomainType: 'department',
    isBuiltIn: true,
    displayOrder: 5,
  },
  {
    id: 'faculty_school',
    name: 'Faculty / School Association Elections',
    shortName: 'Faculty / School',
    category: 'Faculty / School',
    description:
      'Faculty and School student governance elections across all constituent departments.',
    governanceScope: 'All students enrolled within the target Faculty or School.',
    eligibilityRuleSummary: 'Students enrolled in the target Faculty or School.',
    positionsPolicyNote: 'Faculty and School student association portfolios.',
    adminRole: 'Faculty/School Election Administrator',
    supportsSubdomains: true,
    subdomainType: 'faculty',
    isBuiltIn: true,
    displayOrder: 6,
  },
];

export const UCC_HALLS: HallUnit[] = [
  { id: 'hall-casford', code: 'CHF', name: 'Casely Hayford Hall', shortName: 'Casford' },
  { id: 'hall-valco', code: 'VLC', name: 'Valco Hall', shortName: 'Valco' },
  { id: 'hall-oguaa', code: 'OGU', name: 'Oguaa Hall', shortName: 'Oguaa' },
  { id: 'hall-nkrumah', code: 'KNH', name: 'Kwame Nkrumah Hall', shortName: 'KNH' },
  { id: 'hall-atlantic', code: 'ATL', name: 'Atlantic Hall', shortName: 'ATL' },
  { id: 'hall-adehye', code: 'ADH', name: 'Adehye Hall', shortName: 'Adehye' },
  { id: 'hall-superannuation', code: 'SUP', name: 'Superannuation Hall', shortName: 'Superannuation' },
  { id: 'hall-psi', code: 'PSI', name: 'PSI Hall', shortName: 'PSI' },
];

export const UCC_FACULTIES: FacultyUnit[] = [
  {
    id: 'fac-physical-sci',
    name: 'School of Physical Sciences',
    code: 'SPS',
    college: 'College of Agriculture and Natural Sciences',
  },
  {
    id: 'fac-business',
    name: 'School of Business',
    code: 'USB',
    college: 'College of Humanities and Legal Studies',
  },
  {
    id: 'fac-arts',
    name: 'Faculty of Arts',
    code: 'FOA',
    college: 'College of Humanities and Legal Studies',
  },
  {
    id: 'fac-social-sci',
    name: 'Faculty of Social Sciences',
    code: 'FSS',
    college: 'College of Humanities and Legal Studies',
  },
  {
    id: 'fac-education',
    name: 'Faculty of Science and Technology Education',
    code: 'FSTE',
    college: 'College of Education Studies',
  },
  {
    id: 'fac-biological-sci',
    name: 'School of Biological Sciences',
    code: 'SBS',
    college: 'College of Agriculture and Natural Sciences',
  },
  {
    id: 'fac-health',
    name: 'School of Allied Health Sciences',
    code: 'SAHS',
    college: 'College of Health and Allied Sciences',
  },
  {
    id: 'fac-graduate',
    name: 'School of Graduate Studies',
    code: 'SGS',
    college: 'University-Wide Postgraduate',
  },
];

export const UCC_DEPARTMENTS: DepartmentUnit[] = [
  {
    id: 'dept-csc',
    name: 'Computer Science and Information Technology',
    code: 'CSC',
    facultyId: 'fac-physical-sci',
    facultyName: 'School of Physical Sciences',
    programmes: ['B.Sc. Computer Science', 'B.Sc. Information Technology'],
  },
  {
    id: 'dept-math',
    name: 'Mathematics',
    code: 'MAT',
    facultyId: 'fac-physical-sci',
    facultyName: 'School of Physical Sciences',
    programmes: ['B.Sc. Mathematics', 'B.Sc. Actuarial Science'],
  },
  {
    id: 'dept-mkt',
    name: 'Marketing and Supply Chain Management',
    code: 'MKT',
    facultyId: 'fac-business',
    facultyName: 'School of Business',
    programmes: ['B.Com. Marketing', 'B.Com. Procurement & Supply Chain Management'],
  },
  {
    id: 'dept-acc',
    name: 'Accounting',
    code: 'ACC',
    facultyId: 'fac-business',
    facultyName: 'School of Business',
    programmes: ['B.Com. Accounting'],
  },
  {
    id: 'dept-his',
    name: 'History',
    code: 'HIS',
    facultyId: 'fac-arts',
    facultyName: 'Faculty of Arts',
    programmes: ['B.A. History'],
  },
  {
    id: 'dept-eco',
    name: 'Economic Studies',
    code: 'ECO',
    facultyId: 'fac-social-sci',
    facultyName: 'Faculty of Social Sciences',
    programmes: ['B.Sc. Economics'],
  },
  {
    id: 'dept-edu',
    name: 'Mathematics and ICT Education',
    code: 'MIE',
    facultyId: 'fac-education',
    facultyName: 'Faculty of Science and Technology Education',
    programmes: ['B.Ed. Computer Science', 'B.Ed. Mathematics'],
  },
  {
    id: 'dept-nurs',
    name: 'School of Nursing and Midwifery',
    code: 'NRS',
    facultyId: 'fac-health',
    facultyName: 'School of Allied Health Sciences',
    programmes: ['B.Sc. Nursing', 'B.Sc. Midwifery'],
  },
];
