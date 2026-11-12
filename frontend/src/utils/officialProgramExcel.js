import toast from 'react-hot-toast';
import ctuLogo from '../assets/images/logos/ctulogo.png';
import bagongPilipinas from '../assets/images/logos/Bagong_Pilipinas_Logo.svg.webp';
import {
  DAYS, HOURS, buildGrid, uniqueSubjects, weeklyHours, facultyName,
  subjectCode, subjectName, subjectUnits, sectionLabel, studentCount, termLine,
} from './officialProgramExport';

/**
 * The same campus form as officialProgramExport, written as a real .xlsx.
 *
 * The printable version is for handing in; this one is for editing - the
 * registrar fills in the adviser, the chairman's name or a room change without
 * regenerating anything. Both are built from the same helpers so the grid, the
 * summary of subjects and the totals can never drift apart.
 *
 * One worksheet per teacher or per section, each set up for A4 landscape on a
 * single page. ExcelJS is ~1MB, so it is imported only when an export runs.
 */

// Columns: A time, B..H the week, I a gutter, J..S the details panel.
const COL_WIDTHS = [9, 13, 13, 13, 13, 13, 13, 13, 2, 13, 13, 10, 10, 11, 11, 11, 11, 11, 9];
const GRID_FIRST = 1;   // A
const PANEL_FIRST = 10; // J
const PANEL_LAST = 19;  // S
const HEAD_ROWS = 10;   // letterhead, rule, title, subtitle, spacer
const GRID_HEAD = HEAD_ROWS + 1;
const BODY_FIRST = GRID_HEAD + 1;

const THIN = { style: 'thin', color: { argb: 'FF000000' } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const CENTER = { horizontal: 'center', vertical: 'middle', wrapText: true };

/**
 * ExcelJS only embeds png/jpeg/gif, and the Bagong Pilipinas mark ships as
 * webp. Both marks are redrawn through a canvas so either source format ends
 * up as a png the workbook accepts.
 */
const MARK_PX = 240; // printed at ~60px, so this stays sharp without bloating the file

const asPngBase64 = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    try {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const scale = Math.min(1, MARK_PX / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    } catch {
      resolve(''); // write the sheet without that mark rather than not at all
    }
  };
  img.onerror = () => resolve('');
  img.src = src;
});

let marks = null;
const loadMarks = async () => {
  if (!marks) {
    const [seal, bagong] = await Promise.all([asPngBase64(ctuLogo), asPngBase64(bagongPilipinas)]);
    marks = { seal, bagong };
  }
  return marks;
};

const to12 = (h) => (h % 12 === 0 ? 12 : h % 12);
const hourLabel = (hour) => `${to12(hour)}:00-${to12(hour + 1)}:00`;

/** Excel rejects []:*?/\ in a sheet name and caps it at 31 characters. */
const sheetName = (label, index) => {
  const clean = String(label || '').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31);
  return clean || `Sheet ${index + 1}`;
};

const put = (ws, row, col, value, style = {}) => {
  const cell = ws.getCell(row, col);
  cell.value = value === '' || value === undefined || value === null ? null : value;
  if (style.font) cell.font = style.font;
  if (style.alignment) cell.alignment = style.alignment;
  if (style.border) cell.border = style.border;
  return cell;
};

/**
 * The details panel sits on the same rows as the timetable grid, so a row's
 * height may only ever grow - setting it outright would clip the grid's
 * three-line cells.
 */
const atLeast = (ws, row, height) => {
  const r = ws.getRow(row);
  if (!r.height || r.height < height) r.height = height;
};

/**
 * Merge, then draw the outline on the edge cells only. Excel still renders
 * each hidden cell's own borders, so copying the full box onto all of them
 * would rule lines through the middle of a three-hour class.
 */
const mergeBox = (ws, r1, c1, r2, c2, border) => {
  ws.mergeCells(r1, c1, r2, c2);
  if (!border) return;
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).border = {
        ...(r === r1 && border.top ? { top: border.top } : {}),
        ...(r === r2 && border.bottom ? { bottom: border.bottom } : {}),
        ...(c === c1 && border.left ? { left: border.left } : {}),
        ...(c === c2 && border.right ? { right: border.right } : {}),
      };
    }
  }
};

/**
 * Register both marks on the workbook once. Adding them per sheet would embed
 * the same two pngs again for every teacher or section.
 */
const registerMarks = (wb, logos) => ({
  seal: logos.seal ? wb.addImage({ base64: logos.seal, extension: 'png' }) : null,
  bagong: logos.bagong ? wb.addImage({ base64: logos.bagong, extension: 'png' }) : null,
});

const letterhead = (ws, marksIds, title, subtitle) => {
  const lines = [
    ['Republic of the Philippines', { size: 9 }],
    ['CEBU TECHNOLOGICAL UNIVERSITY', { size: 14, bold: true }],
    ['DAANBANTAYAN CAMPUS', { size: 11 }],
    ['Agujo, Daanbantayan, Cebu, Philippines', { size: 8 }],
    ['Website: http://www.ctu.edu.ph   E-mail: info-daanbantayan@ctu.edu.ph', { size: 7 }],
    ['Phone: +6332 239-6549', { size: 7 }],
  ];
  lines.forEach(([text, font], i) => {
    const row = i + 1;
    ws.mergeCells(row, GRID_FIRST, row, PANEL_LAST);
    put(ws, row, GRID_FIRST, text, { font, alignment: { horizontal: 'center', vertical: 'middle' } });
    ws.getRow(row).height = font.size >= 14 ? 20 : 13;
  });

  // The rule under the letterhead is a thin row with a bottom border.
  ws.getRow(7).height = 4;
  for (let c = GRID_FIRST; c <= PANEL_LAST; c++) ws.getCell(7, c).border = { bottom: THIN };

  ws.mergeCells(8, GRID_FIRST, 8, PANEL_LAST);
  put(ws, 8, GRID_FIRST, title, { font: { size: 12, bold: true }, alignment: { horizontal: 'center' } });
  ws.mergeCells(9, GRID_FIRST, 9, PANEL_LAST);
  put(ws, 9, GRID_FIRST, subtitle, { font: { size: 10, bold: true }, alignment: { horizontal: 'center' } });
  ws.getRow(10).height = 6;

  if (marksIds.seal !== null) {
    ws.addImage(marksIds.seal, { tl: { col: 4.5, row: 0.2 }, ext: { width: 58, height: 58 } });
  }
  if (marksIds.bagong !== null) {
    ws.addImage(marksIds.bagong, { tl: { col: 11.9, row: 0.2 }, ext: { width: 72, height: 58 } });
  }
};

/** TIME column plus Monday..Sunday, one row an hour, multi-hour classes merged. */
const writeGrid = (ws, schedules, secondLine) => {
  put(ws, GRID_HEAD, GRID_FIRST, 'TIME',
    { font: { size: 8 }, alignment: CENTER, border: BOX });
  DAYS.forEach((day, i) => put(ws, GRID_HEAD, GRID_FIRST + 1 + i, day,
    { font: { size: 8 }, alignment: CENTER, border: BOX }));
  ws.getRow(GRID_HEAD).height = 16;

  // Every cell gets its border first, so a merge never leaves a gap.
  HOURS.forEach((hour, i) => {
    const row = BODY_FIRST + i;
    ws.getRow(row).height = 34;
    put(ws, row, GRID_FIRST, hourLabel(hour), { font: { size: 7 }, alignment: CENTER, border: BOX });
    for (let c = 0; c < DAYS.length; c++) {
      put(ws, row, GRID_FIRST + 1 + c, null, { alignment: CENTER, border: BOX });
    }
  });

  const { cells, covered } = buildGrid(schedules, secondLine);
  HOURS.forEach((hour, i) => {
    const row = BODY_FIRST + i;
    DAYS.forEach((day, d) => {
      if (covered.has(`${day}-${hour}`)) return;
      const cell = cells[`${day}-${hour}`];
      if (!cell) return;
      const col = GRID_FIRST + 1 + d;
      const text = [cell.code, cell.line2, cell.room].filter(Boolean).join('\n');
      put(ws, row, col, text, { font: { size: 8 }, alignment: CENTER, border: BOX });
      if (cell.span > 1) mergeBox(ws, row, col, row + cell.span - 1, col, BOX);
    });
  });
};

/** "Label: ______" - the value sits on an underlined merge, as on the form. */
const field = (ws, row, labelCol, label, valueFrom, valueTo, value) => {
  put(ws, row, labelCol, label, { font: { size: 8 }, alignment: { vertical: 'bottom' } });
  mergeBox(ws, row, valueFrom, row, valueTo);
  for (let c = valueFrom; c <= valueTo; c++) ws.getCell(row, c).border = { bottom: THIN };
  // Left-aligned explicitly: a numeric value such as the year level would
  // otherwise sit at the far right of a wide merge.
  put(ws, row, valueFrom, value || null,
    { font: { size: 8 }, alignment: { horizontal: 'left', vertical: 'bottom', wrapText: true } });
  atLeast(ws, row, 15);
};

/**
 * The boxed SUMMARY OF SUBJECTS table. `columns` names the four headings and
 * `rightOf` produces the last column for a subject. Returns the row after it.
 */
const summaryBlock = (ws, startRow, subjects, lastHeading, rightOf) => {
  const headings = ['Units', 'Subject code', 'Descriptive Title', lastHeading];
  const spans = [[10, 10], [11, 12], [13, 16], [17, 19]]; // J, K-L, M-P, Q-S

  ws.mergeCells(startRow, PANEL_FIRST, startRow, PANEL_LAST);
  put(ws, startRow, PANEL_FIRST, 'SUMMARY OF SUBJECTS',
    { font: { size: 8 }, alignment: { horizontal: 'center' } });

  const headRow = startRow + 1;
  headings.forEach((heading, i) => {
    const [from, to] = spans[i];
    if (to > from) ws.mergeCells(headRow, from, headRow, to);
    put(ws, headRow, from, heading, {
      font: { size: 7 },
      alignment: { horizontal: i === 0 ? 'center' : 'left', vertical: 'middle' },
    });
  });

  subjects.forEach((s, i) => {
    const row = headRow + 1 + i;
    const values = [subjectUnits(s) || '', subjectCode(s), subjectName(s), rightOf(s)];
    values.forEach((value, c) => {
      const [from, to] = spans[c];
      if (to > from) ws.mergeCells(row, from, row, to);
      put(ws, row, from, value === '' ? null : value, {
        font: { size: 8 },
        alignment: { horizontal: c === 0 ? 'center' : 'left', vertical: 'top', wrapText: true },
      });
    });
    atLeast(ws, row, 13);
  });

  // The form leaves room under the list; keep the box a stable minimum size.
  const lastRow = Math.max(headRow + subjects.length + 2, headRow + 6);
  for (let r = startRow; r <= lastRow; r++) {
    ws.getCell(r, PANEL_FIRST).border = {
      ...(ws.getCell(r, PANEL_FIRST).border || {}),
      left: THIN,
      ...(r === startRow ? { top: THIN } : {}),
      ...(r === lastRow ? { bottom: THIN } : {}),
    };
    ws.getCell(r, PANEL_LAST).border = {
      ...(ws.getCell(r, PANEL_LAST).border || {}),
      right: THIN,
      ...(r === startRow ? { top: THIN } : {}),
      ...(r === lastRow ? { bottom: THIN } : {}),
    };
    for (let c = PANEL_FIRST + 1; c < PANEL_LAST; c++) {
      if (r === startRow) ws.getCell(r, c).border = { ...(ws.getCell(r, c).border || {}), top: THIN };
      if (r === lastRow) ws.getCell(r, c).border = { ...(ws.getCell(r, c).border || {}), bottom: THIN };
    }
  }
  return lastRow + 1;
};

/** Prepared by / Reviewed & Certified / Approved, as printed on the form. */
const signatories = (ws, startRow, {
  chairman = '', dean = 'LOVELLA CHRISTIANNE A. GULLE', director = 'ROWENA P. DATO-ON',
} = {}) => {
  const left = PANEL_FIRST;
  const right = 15; // O
  const small = { size: 7.5 };

  put(ws, startRow, left, 'Prepared by:', { font: small });
  put(ws, startRow, right, 'Reviewed & Certified True & Correct:', { font: small });

  const nameRow = startRow + 2;
  put(ws, nameRow, left, chairman || null, { font: { size: 8 } });
  put(ws, nameRow, right, dean, { font: { size: 8, bold: true } });
  put(ws, nameRow + 1, left, 'Chairman,', { font: { size: 7 } });
  put(ws, nameRow + 1, right, 'Dean, College of Technology & Engineering', { font: { size: 7 } });

  const approvedRow = nameRow + 3;
  ws.mergeCells(approvedRow, PANEL_FIRST, approvedRow, PANEL_LAST);
  put(ws, approvedRow, PANEL_FIRST, 'Approved:',
    { font: small, alignment: { horizontal: 'center' } });
  ws.mergeCells(approvedRow + 2, PANEL_FIRST, approvedRow + 2, PANEL_LAST);
  put(ws, approvedRow + 2, PANEL_FIRST, director,
    { font: { size: 8, bold: true }, alignment: { horizontal: 'center' } });
  ws.mergeCells(approvedRow + 3, PANEL_FIRST, approvedRow + 3, PANEL_LAST);
  put(ws, approvedRow + 3, PANEL_FIRST, 'Campus Director',
    { font: { size: 7 }, alignment: { horizontal: 'center' } });
};

const newSheet = (wb, name) => {
  const ws = wb.addWorksheet(name, {
    pageSetup: {
      paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: false }],
  });
  COL_WIDTHS.forEach((width, i) => { ws.getColumn(i + 1).width = width; });
  return ws;
};

const createWorkbook = async () => {
  const mod = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS = mod.default || mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CTU Daanbantayan Timetabling System';
  wb.created = new Date();
  return wb;
};

const download = async (wb, filename) => {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/** PROGRAM BY TEACHER as .xlsx - one worksheet per faculty member. */
export const exportFacultyProgramExcel = async (schedules, filters = {}, facultyDetails = {}) => {
  const rows = (schedules || []).filter((s) => s.faculty);
  if (rows.length === 0) {
    toast('No schedules with an assigned teacher to export.');
    return;
  }

  const notify = toast.loading('Building the Excel workbook...');
  try {
    const [wb, logos] = await Promise.all([createWorkbook(), loadMarks()]);
    const marksIds = registerMarks(wb, logos);

    const byFaculty = new Map();
    rows.forEach((s) => {
      const id = String(s.faculty?._id || s.faculty);
      if (!byFaculty.has(id)) byFaculty.set(id, []);
      byFaculty.get(id).push(s);
    });

    [...byFaculty.entries()]
      .sort((a, b) => facultyName(a[1][0]).localeCompare(facultyName(b[1][0])))
      .forEach(([id, list], index) => {
        const first = list[0];
        const details = facultyDetails[id] || first.faculty || {};
        const subjects = uniqueSubjects(list);
        const ws = newSheet(wb, sheetName(facultyName(first), index));

        letterhead(ws, marksIds, 'PROGRAM BY TEACHER',
          termLine(first.shift, first.semester, first.academicYear));
        writeGrid(ws, list, sectionLabel);

        let row = GRID_HEAD;
        field(ws, row, PANEL_FIRST, 'NAME:', 11, 14, facultyName(first));
        field(ws, row, 15, 'Status:', 16, PANEL_LAST, details.employmentType || '');

        const degree = (label, d = {}) => {
          row += 1;
          field(ws, row, PANEL_FIRST, label, 11, 12, d.degree || '');
          field(ws, row, 13, 'Major:', 14, 15, d.major || '');
          field(ws, row, 16, 'Minor:', 17, PANEL_LAST, d.minor || '');
        };
        degree('Bachelor Degree:', details.bachelorsDegree);
        degree('Masteral Degree:', details.mastersDegree);
        degree('Doctoral Degree:', details.doctoralDegree);

        row += 1;
        field(ws, row, PANEL_FIRST, 'Special Training:', 12, PANEL_LAST, details.specialTraining || '');

        row = summaryBlock(ws, row + 2, subjects, 'Students, Course/Yr/Sec',
          (s) => [studentCount(s), sectionLabel(s)].filter(Boolean).join(', '));

        const totalUnits = subjects.reduce((sum, s) => sum + subjectUnits(s), 0);
        row += 1;
        put(ws, row, PANEL_FIRST, `Total Units: ${totalUnits}`, { font: { size: 8 } });
        put(ws, row, 13, `Preparations: ${subjects.length}`, { font: { size: 8 } });
        put(ws, row, 16, `Hours/Week: ${weeklyHours(list)}`, { font: { size: 8 } });

        [
          `Administrative Designation: ${details.administrativeDesignation || ''}`,
          `Production: ${details.productionInvolvement || ''}`,
          `Extension: ${details.extensionInvolvement || ''}`,
          `Research: ${details.researchInvolvement || ''}`,
        ].forEach((line) => {
          row += 1;
          ws.mergeCells(row, PANEL_FIRST, row, PANEL_LAST);
          put(ws, row, PANEL_FIRST, line, { font: { size: 8 } });
        });

        signatories(ws, row + 2, filters);
      });

    await download(wb, 'Program by Teacher - CTU Daanbantayan.xlsx');
    toast.success(`Excel workbook ready (${byFaculty.size} teacher${byFaculty.size === 1 ? '' : 's'}).`, { id: notify });
  } catch (err) {
    console.error('Faculty Excel export failed:', err);
    toast.error('Could not build the Excel file.', { id: notify });
  }
};

/** PROGRAM BY SECTION as .xlsx - one worksheet per section. */
export const exportSectionProgramExcel = async (schedules, filters = {}) => {
  const rows = schedules || [];
  if (rows.length === 0) {
    toast('No schedules to export. Adjust the filters first.');
    return;
  }

  const notify = toast.loading('Building the Excel workbook...');
  try {
    const [wb, logos] = await Promise.all([createWorkbook(), loadMarks()]);
    const marksIds = registerMarks(wb, logos);

    const bySection = new Map();
    rows.forEach((s) => {
      const key = sectionLabel(s) || 'Unassigned';
      if (!bySection.has(key)) bySection.set(key, []);
      bySection.get(key).push(s);
    });

    [...bySection.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([section, list], index) => {
        const first = list[0];
        const subjects = uniqueSubjects(list);
        const ws = newSheet(wb, sheetName(section, index));

        letterhead(ws, marksIds, 'PROGRAM BY SECTION',
          termLine(first.shift, first.semester, first.academicYear));
        writeGrid(ws, list, facultyName);

        let row = GRID_HEAD;
        field(ws, row, PANEL_FIRST, 'SECTION:', 11, 14, section);
        field(ws, row, 15, 'Shift:', 16, PANEL_LAST, first.shift || 'Day');
        row += 1;
        field(ws, row, PANEL_FIRST, 'Program:', 11, 14, first.program || '');
        field(ws, row, 15, 'Year Level:', 16, PANEL_LAST, first.yearLevel || '');
        row += 1;
        field(ws, row, PANEL_FIRST, 'Academic Year:', 12, 14, first.academicYear || '');
        field(ws, row, 15, 'No. of Students:', 17, PANEL_LAST, studentCount(first) || '');
        row += 1;
        field(ws, row, PANEL_FIRST, 'Adviser:', 11, PANEL_LAST, filters.adviser || '');

        row = summaryBlock(ws, row + 2, subjects, 'Instructor', facultyName);

        const totalUnits = subjects.reduce((sum, s) => sum + subjectUnits(s), 0);
        row += 1;
        put(ws, row, PANEL_FIRST, `Total Units: ${totalUnits}`, { font: { size: 8 } });
        put(ws, row, 13, `Subjects: ${subjects.length}`, { font: { size: 8 } });
        put(ws, row, 16, `Hours/Week: ${weeklyHours(list)}`, { font: { size: 8 } });

        signatories(ws, row + 3, filters);
      });

    await download(wb, 'Program by Section - CTU Daanbantayan.xlsx');
    toast.success(`Excel workbook ready (${bySection.size} section${bySection.size === 1 ? '' : 's'}).`, { id: notify });
  } catch (err) {
    console.error('Section Excel export failed:', err);
    toast.error('Could not build the Excel file.', { id: notify });
  }
};

const officialProgramExcel = { exportFacultyProgramExcel, exportSectionProgramExcel };
export default officialProgramExcel;
