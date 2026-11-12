import type { ElectionResultsPayload } from '../types/index.ts';

export type ReportType = 'full' | 'results' | 'turnout' | 'candidates' | 'positions';

function sanitizePdfText(str: string): string {
  // Replace non-ASCII characters (like cedi symbol or smart quotes) with clean ASCII equivalents
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/₵/g, 'GHS ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines.length > 0 ? lines : [''];
}

interface PdfLine {
  text: string;
  bold?: boolean;
  size?: number;
  colorRgb?: [number, number, number];
}

/**
 * Generates a valid multi-page A4 PDF 1.4 binary Buffer containing official UCC VOTE election reports
 */
export function generateElectionReportPdf(
  results: ElectionResultsPayload,
  reportType: ReportType = 'full'
): Buffer {
  const lines: PdfLine[] = [];

  const addTitle = (text: string) => {
    lines.push({ text, bold: true, size: 14, colorRgb: [0.043, 0.122, 0.227] });
  };
  const addSection = (text: string) => {
    lines.push({ text: '' });
    lines.push({ text, bold: true, size: 11, colorRgb: [0.071, 0.231, 0.439] });
    lines.push({ text: '------------------------------------------------------------------------------------', size: 8, colorRgb: [0.6, 0.6, 0.65] });
  };
  const addLine = (text: string, bold = false, size = 9, colorRgb: [number, number, number] = [0.15, 0.18, 0.22]) => {
    const wrapped = wrapText(text, 88);
    wrapped.forEach((w) => lines.push({ text: w, bold, size, colorRgb }));
  };

  // Report Header
  addTitle('UNIVERSITY OF CAPE COAST - UCC VOTE ELECTORAL COMMISSION');
  addLine(`Report Classification: Official ${reportType.toUpperCase()} Election Report`, true, 10, [0.776, 0.157, 0.157]);
  addLine(`Election Title: ${results.electionTitle}`);
  addLine(`Code: ${results.electionCode}  |  Category: ${results.category}  |  Academic Year: ${results.academicYear}`);
  addLine(`Organizing Body: ${results.organizingBody}`);
  addLine(`Workflow Stage: ${results.workflowStage.toUpperCase()}  |  Status: ${results.isPublished ? 'OFFICIALLY PUBLISHED' : 'UNPUBLISHED / INTERNAL'}`);
  if (results.publishedAt) {
    addLine(`Official Publication Date: ${new Date(results.publishedAt).toUTCString()}`);
  }
  addLine(`Generated On: ${new Date().toUTCString()}`);

  // Ballot Accounting Summary (Included in all reports)
  const bs = results.ballotSummary;
  addSection('1. AUTHORITATIVE BALLOT ACCOUNTING & VOTER PARTICIPATION');
  addLine(`Total Eligible Voters:   ${bs.totalEligibleVoters.toLocaleString()}`, true);
  addLine(`Total Ballots Cast:      ${bs.totalBallotsCast.toLocaleString()} (${bs.turnoutPercentage}% Turnout)`, true);
  addLine(`Valid Ballots Cast:      ${bs.validBallots.toLocaleString()} (${bs.validBallotRate}% of cast ballots)`);
  addLine(`Invalid / Spoilt Votes:  ${bs.invalidBallots.toLocaleString()} (${bs.invalidBallotRate}% of cast ballots)`);
  addLine(`Blank / Abstained Votes: ${bs.blankBallots.toLocaleString()} (${bs.blankBallotRate}% of cast ballots)`);
  addLine(`Uncast Eligible Ballots: ${bs.uncastBallots.toLocaleString()}`);

  // Candidate & Position Breakdowns
  if (reportType === 'full' || reportType === 'results' || reportType === 'candidates' || reportType === 'positions') {
    addSection('2. POSITION-BY-POSITION TALLIES & CANDIDATE PERFORMANCE');
    if (results.positions.length === 0) {
      addLine('No candidate tallies are publicly disclosed for this election at its current stage.');
    } else {
      results.positions.forEach((pos) => {
        lines.push({ text: '' });
        addLine(`PORTFOLIO ${pos.order}: ${pos.title.toUpperCase()}`, true, 10, [0.043, 0.122, 0.227]);
        addLine(
          `Valid Votes: ${pos.totalValidVotes.toLocaleString()}  |  Blank: ${pos.blankVotes.toLocaleString()}  |  Invalid: ${pos.invalidVotes.toLocaleString()}  |  Status: ${
            pos.isTie ? 'EXACT TIE DETECTED' : pos.winnerCandidateIds.length > 0 ? 'WINNER DECLARED' : 'TALLY STANDING'
          }`,
          false,
          8,
          [0.3, 0.35, 0.42]
        );
        pos.candidates.forEach((c) => {
          const badge = c.isTied ? '[TIED]' : c.isWinner ? '[WINNER]' : c.isLeading ? '[LEADING]' : '';
          addLine(
            `  #${c.rank}  ${c.fullName.padEnd(32, ' ')}  (${c.studentId})  ${String(c.votesReceived).padStart(7, ' ')} votes  (${c.percentageOfValidVotes.toFixed(1)}% valid)  ${badge}`,
            c.isWinner || c.isTied,
            9
          );
        });
      });
    }
  }

  // Voter Turnout Analytics (Privacy-Preserving)
  if (reportType === 'full' || reportType === 'turnout') {
    addSection(`3. PRIVACY-PRESERVING VOTER TURNOUT ANALYTICS (MIN COHORT: ${results.turnoutAnalytics.privacyThreshold})`);
    const renderCohortGroup = (heading: string, rows: typeof results.turnoutAnalytics.byFaculty) => {
      if (rows.length === 0) return;
      lines.push({ text: '' });
      addLine(heading, true, 9.5, [0.071, 0.231, 0.439]);
      rows.forEach((r) => {
        if (r.suppressed) {
          addLine(`  - ${r.label} (Eligible: ${r.eligibleVoters}): [SUPPRESSED - PRIVACY THRESHOLD < ${results.turnoutAnalytics.privacyThreshold}]`, false, 8.5, [0.5, 0.35, 0.1]);
        } else {
          addLine(`  - ${r.label}: ${r.ballotsCast?.toLocaleString()} / ${r.eligibleVoters.toLocaleString()} (${r.turnoutPercentage}%)`, false, 8.5);
        }
      });
    };

    renderCohortGroup('Turnout by Faculty / School:', results.turnoutAnalytics.byFaculty);
    renderCohortGroup('Turnout by Department:', results.turnoutAnalytics.byDepartment);
    renderCohortGroup('Turnout by Academic Level:', results.turnoutAnalytics.byLevel);
    renderCohortGroup('Turnout by Hall of Residence:', results.turnoutAnalytics.byHall);
  }

  // Certification & Sign-off
  addSection('4. ELECTORAL COMMISSION CERTIFICATION & AUDIT RECORD');
  addLine(`Certified By: ${results.certifiedBy || 'Pending Senior Commission Sign-Off'}`);
  addLine(`Digital Seal Hash: ${results.certificationHash || 'NOT_YET_CERTIFIED'}`);
  results.workflowHistory.slice(-4).forEach((h) => {
    addLine(`  [${h.stage.toUpperCase()}] ${h.timestamp} - ${h.actorName} (${h.actorRole}): ${h.notes}`, false, 8);
  });

  // Paginate lines across A4 pages (top Y = 790, bottom Y = 55, line height = 13.5)
  const linesPerPage = 52;
  const pages: PdfLine[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([{ text: 'Empty Report' }]);

  // Build PDF Objects
  const objects: string[] = [];
  // Obj 1: Catalog
  // Obj 2: Pages
  // Obj 3: Font Regular (Helvetica)
  // Obj 4: Font Bold (Helvetica-Bold)
  // Followed by Page + Content pairs

  const pageObjNumbers: number[] = [];
  let nextObjNum = 5;

  const pagePairs: { pageObj: number; contentObj: number; stream: string }[] = pages.map((pageLines, pageIdx) => {
    const pageObj = nextObjNum++;
    const contentObj = nextObjNum++;
    pageObjNumbers.push(pageObj);

    const streamParts: string[] = [];
    // Header accent stripe (UCC Blue & Red)
    streamParts.push('0.071 0.231 0.439 rg 40 818 515 6 re f');
    streamParts.push('0.776 0.157 0.157 rg 40 814 140 3 re f');

    let y = 790;
    pageLines.forEach((line) => {
      const size = line.size || 9;
      const font = line.bold ? '/F2' : '/F1';
      const [r, g, b] = line.colorRgb || [0.15, 0.18, 0.22];
      const safeText = sanitizePdfText(line.text);
      streamParts.push(`BT ${font} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg 42 ${y.toFixed(1)} Td (${safeText}) Tj ET`);
      y -= size > 11 ? 18 : 13.5;
    });

    // Footer
    streamParts.push(`BT /F1 8 Tf 0.45 0.48 0.52 rg 42 32 Td (University of Cape Coast Electoral Commission - Official Report | Page ${pageIdx + 1} of ${pages.length}) Tj ET`);

    return {
      pageObj,
      contentObj,
      stream: streamParts.join('\n')
    };
  });

  objects[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNumbers.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNumbers.length} >>\nendobj\n`;
  objects[3] = '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
  objects[4] = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n';

  pagePairs.forEach((pair) => {
    objects[pair.pageObj] = `${pair.pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pair.contentObj} 0 R >>\nendobj\n`;
    const byteLen = Buffer.byteLength(pair.stream, 'utf8');
    objects[pair.contentObj] = `${pair.contentObj} 0 obj\n<< /Length ${byteLen} >>\nstream\n${pair.stream}\nendstream\nendobj\n`;
  });

  let pdfStr = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (let i = 1; i < nextObjNum; i++) {
    offsets[i] = Buffer.byteLength(pdfStr, 'utf8');
    pdfStr += objects[i];
  }

  const xrefStart = Buffer.byteLength(pdfStr, 'utf8');
  pdfStr += `xref\n0 ${nextObjNum}\n0000000000 65535 f \n`;
  for (let i = 1; i < nextObjNum; i++) {
    pdfStr += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfStr += `trailer\n<< /Size ${nextObjNum} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdfStr, 'utf8');
}

/**
 * Generates RFC 4180 CSV report string with UTF-8 BOM for Excel compatibility
 */
export function generateElectionReportCsv(
  results: ElectionResultsPayload,
  reportType: ReportType = 'results'
): string {
  const esc = (val: string | number | boolean | null | undefined) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [];

  if (reportType === 'turnout') {
    rows.push(['Cohort Category', 'Cohort Name', 'Eligible Voters', 'Ballots Cast', 'Turnout (%)', 'Privacy Status'].map(esc).join(','));
    const appendGroup = (groupName: string, list: typeof results.turnoutAnalytics.byFaculty) => {
      list.forEach((r) => {
        rows.push([
          groupName,
          r.label,
          r.eligibleVoters,
          r.suppressed ? 'SUPPRESSED' : r.ballotsCast,
          r.suppressed ? 'SUPPRESSED' : `${r.turnoutPercentage}%`,
          r.suppressed ? r.suppressionReason : 'Disclosed'
        ].map(esc).join(','));
      });
    };
    appendGroup('Faculty', results.turnoutAnalytics.byFaculty);
    appendGroup('Department', results.turnoutAnalytics.byDepartment);
    appendGroup('Academic Level', results.turnoutAnalytics.byLevel);
    appendGroup('Hall of Residence', results.turnoutAnalytics.byHall);
  } else if (reportType === 'positions') {
    rows.push(['Order', 'Position Title', 'Valid Votes', 'Blank Votes', 'Invalid Votes', 'Total Ballots Processed', 'Outcome Status'].map(esc).join(','));
    results.positions.forEach((p) => {
      const outcome = p.isTie ? 'TIE DETECTED' : p.winnerCandidateIds.length > 0 ? 'WINNER CERTIFIED' : 'PROVISIONAL';
      rows.push([
        p.order,
        p.title,
        p.totalValidVotes,
        p.blankVotes,
        p.invalidVotes,
        p.totalBallotsProcessed,
        outcome
      ].map(esc).join(','));
    });
  } else if (reportType === 'candidates') {
    rows.push(['Position', 'Rank', 'Candidate Name', 'Student ID', 'Faculty', 'Department', 'Hall', 'Votes Received', '% of Valid Votes', '% of Total Ballots', 'Standing'].map(esc).join(','));
    results.positions.forEach((p) => {
      p.candidates.forEach((c) => {
        const standing = c.isTied ? 'TIED FOR LEAD' : c.isWinner ? 'WINNER ELECT' : c.isLeading ? 'LEADING' : 'CONTESTANT';
        rows.push([
          p.title,
          c.rank,
          c.fullName,
          c.studentId,
          c.faculty,
          c.department,
          c.hall,
          c.votesReceived,
          c.percentageOfValidVotes.toFixed(1),
          c.percentageOfTotalBallots.toFixed(1),
          standing
        ].map(esc).join(','));
      });
    });
  } else {
    // Default 'results' or 'full' comprehensive CSV
    rows.push(['Election', results.electionTitle, 'Code', results.electionCode, 'Stage', results.workflowStage.toUpperCase()].map(esc).join(','));
    rows.push(['Eligible Voters', results.ballotSummary.totalEligibleVoters, 'Ballots Cast', results.ballotSummary.totalBallotsCast, 'Turnout %', results.ballotSummary.turnoutPercentage].map(esc).join(','));
    rows.push(['Valid Ballots', results.ballotSummary.validBallots, 'Invalid Ballots', results.ballotSummary.invalidBallots, 'Blank Ballots', results.ballotSummary.blankBallots, 'Uncast Ballots', results.ballotSummary.uncastBallots].map(esc).join(','));
    rows.push('');
    rows.push(['Position Order', 'Position Title', 'Rank', 'Candidate Name', 'Student ID', 'Department', 'Hall', 'Votes Received', '% Valid Votes', 'Status'].map(esc).join(','));
    results.positions.forEach((p) => {
      p.candidates.forEach((c) => {
        const status = c.isTied ? 'TIE' : c.isWinner ? 'WINNER' : c.isLeading ? 'LEADING' : 'CONTESTED';
        rows.push([
          p.order,
          p.title,
          c.rank,
          c.fullName,
          c.studentId,
          c.department,
          c.hall,
          c.votesReceived,
          `${c.percentageOfValidVotes.toFixed(1)}%`,
          status
        ].map(esc).join(','));
      });
    });
  }

  return '\uFEFF' + rows.join('\r\n');
}
