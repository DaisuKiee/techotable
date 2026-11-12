import toast from 'react-hot-toast';
import ctuLogo from '../assets/images/logos/ctulogo.png';
import bagongPilipinas from '../assets/images/logos/Bagong_Pilipinas_Logo.svg.webp';

/**
 * The campus's own "PROGRAM BY TEACHER" / "PROGRAM BY SECTION" form
 * (Template.pdf), rebuilt as printable HTML.
 *
 * Layout, left to right:
 *   - the weekly grid: a TIME column then Monday..Sunday, one row per hour,
 *     each filled cell showing subject code / section (or teacher) / room;
 *   - a details panel: who the program belongs to, a SUMMARY OF SUBJECTS
 *     table, the unit/preparation/hour totals, and the signatory blocks.
 *
 * Printed as A4 landscape. There is no PDF library in the app, so this opens
 * a window the user prints or saves as PDF, the same way the other exports
 * work. One page per teacher or per section, each starting on a fresh sheet.
 */

// The bundler gives a path like /static/media/ctulogo.hash.png. The printable
// window is written into about:blank, which doesn't reliably fetch that, and a
// linked image can be missing from the print. The seal is read once and
// embedded in the page instead, so it always appears and survives saving.
const absolute = (src) => (/^(data:|https?:)/.test(src) ? src : `${window.location.origin}${src}`);

const asDataUrl = async (src) => {
  try {
    const blob = await (await fetch(absolute(src))).blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return ''; // print the form without that mark rather than not at all
  }
};

/** Both letterhead marks: the CTU seal (left) and Bagong Pilipinas (right). */
let marks = null;
export const loadMarks = async () => {
  if (marks) return marks;
  const [seal, bagong] = await Promise.all([asDataUrl(ctuLogo), asDataUrl(bagongPilipinas)]);
  marks = { seal, bagong };
  return marks;
};

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** 7:00 AM to 5:00 PM, as on the form. */
export const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const toMinutes = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return Number.isNaN(h) ? null : h * 60 + (m || 0);
};

/** "7:00-8:00" the way the form labels its rows. */
const rowLabel = (hour) => {
  const to12 = (h) => (h % 12 === 0 ? 12 : h % 12);
  return `${to12(hour)}:00-<br>${to12(hour + 1)}:00`;
};

export const facultyName = (schedule) => {
  const u = schedule?.faculty?.user || schedule?.faculty;
  const first = u?.firstName || '';
  const last = u?.lastName || '';
  const full = `${last}${last && first ? ', ' : ''}${first ? `${first[0]}` : ''}`.trim();
  return full || schedule?.metadata?.facultyName || '';
};

export const subjectCode = (s) => s?.subject?.subjectCode || s?.metadata?.subjectCode || '';
export const subjectName = (s) => s?.subject?.subjectName || s?.metadata?.subjectName || '';
export const subjectUnits = (s) => Number(s?.subject?.units ?? s?.metadata?.units) || 0;
export const roomLabel = (s) => s?.roomLabel || s?.metadata?.roomName || s?.room?.roomCode || '';
export const sectionLabel = (s) => s?.sectionCode || [s?.program, `${s?.yearLevel || ''}${s?.section || ''}`].filter(Boolean).join(' ');

/** Students in a class: the enrolled list when present, else the cap. */
export const studentCount = (s) => (Array.isArray(s?.enrolledStudents) ? s.enrolledStudents.length : null)
  ?? (Number(s?.maxStudents) || null);

/**
 * Lay the meetings onto the hourly grid.
 * Returns { 'Monday-7': { code, line2, room, span } }, where a class covering
 * several hours is drawn once with a rowspan and the hours it covers are
 * marked so they aren't drawn again.
 */
export const buildGrid = (schedules, secondLine) => {
  const cells = {};
  const covered = new Set();

  schedules.forEach((s) => {
    (s.timeSlots || []).forEach((slot) => {
      const start = toMinutes(slot.startTime);
      const end = toMinutes(slot.endTime);
      if (start === null || end === null || !DAYS.includes(slot.day)) return;

      const startHour = Math.floor(start / 60);
      const endHour = Math.ceil(end / 60);
      const first = HOURS.indexOf(startHour);
      if (first === -1) return;

      const span = Math.max(1, Math.min(endHour, HOURS[HOURS.length - 1] + 1) - startHour);
      cells[`${slot.day}-${startHour}`] = {
        code: subjectCode(s),
        line2: secondLine(s),
        room: roomLabel(s),
        span,
      };
      for (let h = startHour + 1; h < startHour + span; h++) covered.add(`${slot.day}-${h}`);
    });
  });

  return { cells, covered };
};

const gridHtml = (schedules, secondLine) => {
  const { cells, covered } = buildGrid(schedules, secondLine);

  const rows = HOURS.map((hour) => {
    const tds = DAYS.map((day) => {
      if (covered.has(`${day}-${hour}`)) return '';           // spanned from above
      const cell = cells[`${day}-${hour}`];
      if (!cell) return '<td class="slot"></td>';
      return `<td class="slot filled" rowspan="${cell.span}">
        <div class="code">${esc(cell.code)}</div>
        <div class="who">${esc(cell.line2)}</div>
        <div class="room">${esc(cell.room)}</div>
      </td>`;
    }).join('');
    return `<tr><td class="time">${rowLabel(hour)}</td>${tds}</tr>`;
  }).join('');

  return `<table class="grid">
    <thead><tr><th class="time">TIME</th>${DAYS.map((d) => `<th>${d}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
};

/** One row per subject offering, not per meeting. */
export const uniqueSubjects = (schedules) => {
  const seen = new Map();
  schedules.forEach((s) => {
    const key = `${subjectCode(s)}|${sectionLabel(s)}`;
    if (!seen.has(key)) seen.set(key, s);
  });
  return [...seen.values()];
};

/** Hours a week across every meeting. */
export const weeklyHours = (schedules) => {
  const total = schedules.reduce((sum, s) => sum + (s.timeSlots || []).reduce((t, slot) => {
    const start = toMinutes(slot.startTime);
    const end = toMinutes(slot.endTime);
    return t + (start !== null && end !== null && end > start ? end - start : 0);
  }, 0), 0);
  return Math.round((total / 60) * 10) / 10;
};

const summaryRows = (subjects, rightColumn) => subjects.map((s) => `
  <tr>
    <td class="u">${esc(subjectUnits(s) || '')}</td>
    <td class="sc">${esc(subjectCode(s))}</td>
    <td>${esc(subjectName(s))}</td>
    <td class="st">${esc(rightColumn(s))}</td>
  </tr>`).join('');

/** Chairman / Dean / Campus Director, as printed on the form. */
const signatories = ({ chairman = '', dean = 'LOVELLA CHRISTIANNE A. GULLE', director = 'ROWENA P. DATO-ON' } = {}) => `
  <div class="signoff">
    <div class="sign-row">
      <div class="sign-col">
        <div class="label">Prepared by:</div>
        <div class="name">${esc(chairman)}</div>
        <div class="role">Chairman,</div>
      </div>
      <div class="sign-col center">
        <div class="label">Reviewed &amp; Certified True &amp; Correct:</div>
        <div class="name strong">${esc(dean)}</div>
        <div class="role">Dean, College of Technology &amp; Engineering</div>
      </div>
    </div>
    <div class="sign-row approved">
      <div class="sign-col center">
        <div class="label">Approved:</div>
        <div class="name strong">${esc(director)}</div>
        <div class="role">Campus Director</div>
      </div>
    </div>
  </div>`;

const letterhead = (title, subtitle, logos = {}) => `
  <div class="head">
    ${logos.seal ? `<img class="seal" src="${logos.seal}" alt="" />` : ''}
    <div class="head-text">
      <div>Republic of the Philippines</div>
      <div class="uni">CEBU TECHNOLOGICAL UNIVERSITY</div>
      <div class="campus">DAANBANTAYAN CAMPUS</div>
      <div class="addr">Agujo, Daanbantayan, Cebu, Philippines</div>
      <div class="addr small">Website: http://www.ctu.edu.ph &nbsp; E-mail: info-daanbantayan@ctu.edu.ph</div>
      <div class="addr small">Phone: +6332 239-6549</div>
    </div>
    ${logos.bagong ? `<img class="bagong" src="${logos.bagong}" alt="" />` : ''}
  </div>
  <hr class="rule" />
  <div class="doc-title">${esc(title)}</div>
  <div class="doc-sub">${esc(subtitle)}</div>`;

const PAGE_CSS = `
  @page { size: A4 landscape; margin: 1cm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; margin: 0; padding: 12px; background: #f1f5f9; }
  .sheet { background: #fff; padding: 14px 18px; margin: 0 auto 16px; max-width: 1180px; }
  .head { display: flex; align-items: center; justify-content: center; gap: 14px; }
  .seal { width: 58px; height: 58px; object-fit: contain; }
  .bagong { width: 72px; height: 58px; object-fit: contain; }
  .head-text { text-align: center; line-height: 1.25; }
  .uni { font-weight: bold; font-size: 11pt; letter-spacing: .3px; }
  .campus { font-size: 9pt; }
  .addr { font-size: 6.5pt; }
  .addr.small { font-size: 5.5pt; }
  .rule { border: none; border-top: 1px solid #000; margin: 6px 0 8px; }
  .doc-title { text-align: center; font-weight: bold; font-size: 10pt; }
  .doc-sub { text-align: center; font-weight: bold; font-size: 8.5pt; margin-bottom: 8px; }

  .body { display: flex; gap: 10px; align-items: flex-start; }
  .grid-wrap { flex: 0 0 52%; }
  .panel { flex: 1; }

  table.grid { border-collapse: collapse; width: 100%; table-layout: fixed; }
  table.grid th, table.grid td { border: 1px solid #000; text-align: center; vertical-align: middle; }
  table.grid th { font-size: 7.5pt; font-weight: normal; padding: 3px 1px; }
  table.grid th.time, table.grid td.time { width: 46px; font-size: 7pt; }
  td.slot { height: 34px; padding: 1px; }
  td.filled .code { font-size: 7pt; }
  td.filled .who { font-size: 7pt; }
  td.filled .room { font-size: 6.5pt; }

  .field { display: flex; gap: 6px; align-items: baseline; margin-bottom: 4px; }
  .field .k { white-space: nowrap; }
  .field .v { flex: 1; border-bottom: 1px solid #000; min-height: 11px; padding-left: 6px; }
  .cols { display: flex; gap: 10px; }
  .cols > * { flex: 1; }

  .summary { border: 1px solid #000; margin-top: 4px; }
  .summary-title { text-align: center; font-size: 8pt; padding: 2px; }
  table.subjects { border-collapse: collapse; width: 100%; }
  table.subjects th { font-size: 7pt; font-weight: normal; padding: 1px 3px; }
  table.subjects td { font-size: 7.5pt; padding: 1px 3px; vertical-align: top; }
  table.subjects td.u, table.subjects th.u { width: 32px; text-align: center; }
  table.subjects td.sc, table.subjects th.sc { width: 78px; }
  table.subjects td.st, table.subjects th.st { width: 118px; }
  .summary-pad { height: 90px; }

  .totals { display: flex; gap: 18px; margin: 4px 0 2px; }
  .meta div { margin-bottom: 1px; }

  .signoff { margin-top: 10px; }
  .sign-row { display: flex; gap: 20px; }
  .sign-row.approved { margin-top: 10px; justify-content: center; }
  .sign-col { flex: 1; }
  .sign-col.center { text-align: center; }
  .sign-col .label { font-size: 7.5pt; }
  .sign-col .name { margin-top: 16px; font-size: 8pt; }
  .sign-col .name.strong { font-weight: bold; }
  .sign-col .role { font-size: 7pt; }

  .toolbar { text-align: center; margin-bottom: 12px; }
  .toolbar button { padding: 9px 20px; font-size: 13px; font-weight: 600; color: #fff; background: #2563eb; border: none; border-radius: 6px; cursor: pointer; }
  .toolbar span { display: block; margin-top: 6px; font-size: 12px; color: #475569; }

  @media print {
    body { background: #fff; padding: 0; }
    .toolbar { display: none; }
    .sheet { margin: 0; padding: 0; max-width: none; page-break-after: always; }
    .sheet:last-child { page-break-after: auto; }
  }`;

/** Opened during the click, before any await, so pop-up blockers allow it. */
const openWindow = () => {
  const win = window.open('', '_blank');
  if (!win) toast.error('Allow pop-ups for this site to open the printable schedule.');
  return win;
};

const writeSheets = (win, title, sheets, count, noun) => {
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${PAGE_CSS}</style></head>
    <body>
      <div class="toolbar">
        <button onclick="window.print()">Print / Save as PDF</button>
        <span>${count} ${noun}${count === 1 ? '' : 's'} &middot; one page each &middot; A4 landscape</span>
      </div>
      ${sheets}
    </body></html>`);
  win.document.close();
};

/** "1st Semester 2026-2027", the way the form writes it. */
export const termLine = (shift, semester, academicYear) => {
  const sem = Number(semester) === 2 ? '2nd' : Number(semester) === 3 ? 'Summer' : '1st';
  const programShift = String(shift || 'Day').toUpperCase();
  return `${programShift} PROGRAM, ${sem} Semester ${academicYear || ''}`.trim();
};

/**
 * PROGRAM BY TEACHER: one sheet per faculty member.
 * `facultyDetails` (optional) maps a faculty id to the record holding their
 * degrees, special training and designation, so those fields are filled in
 * rather than left blank.
 */
export const exportFacultyProgram = async (schedules, filters = {}, facultyDetails = {}) => {
  const rows = (schedules || []).filter((s) => s.faculty);
  if (rows.length === 0) {
    toast('No schedules with an assigned teacher to export.');
    return;
  }

  const win = openWindow();
  if (!win) return;
  const logos = await loadMarks();

  const byFaculty = new Map();
  rows.forEach((s) => {
    const id = String(s.faculty?._id || s.faculty);
    if (!byFaculty.has(id)) byFaculty.set(id, []);
    byFaculty.get(id).push(s);
  });

  const sheets = [...byFaculty.entries()]
    .sort((a, b) => facultyName(a[1][0]).localeCompare(facultyName(b[1][0])))
    .map(([id, list]) => {
      const first = list[0];
      const details = facultyDetails[id] || first.faculty || {};
      const subjects = uniqueSubjects(list);
      const totalUnits = subjects.reduce((sum, s) => sum + subjectUnits(s), 0);
      const degree = (d) => `
        <div class="field"><span class="k">${d.label}</span><span class="v">${esc(d.degree)}</span>
          <span class="k">Major:</span><span class="v">${esc(d.major)}</span>
          <span class="k">Minor:</span><span class="v">${esc(d.minor)}</span></div>`;

      return `<div class="sheet">
        ${letterhead('PROGRAM BY TEACHER', termLine(first.shift, first.semester, first.academicYear), logos)}
        <div class="body">
          <div class="grid-wrap">${gridHtml(list, sectionLabel)}</div>
          <div class="panel">
            <div class="field"><span class="k">NAME:</span><span class="v">${esc(facultyName(first))}</span>
              <span class="k">Status:</span><span class="v">${esc(details.employmentType || '')}</span></div>
            ${degree({ label: 'Bachelor Degree:', ...(details.bachelorsDegree || {}) })}
            ${degree({ label: 'Masteral Degree:', ...(details.mastersDegree || {}) })}
            ${degree({ label: 'Doctoral Degree:', ...(details.doctoralDegree || {}) })}
            <div class="field"><span class="k">Special Training:</span><span class="v">${esc(details.specialTraining || '')}</span></div>

            <div class="summary">
              <div class="summary-title">SUMMARY OF SUBJECTS</div>
              <table class="subjects">
                <thead><tr><th class="u">Units</th><th class="sc">Subject code</th><th>Descriptive Title</th><th class="st">Students, Course/Yr/Sec</th></tr></thead>
                <tbody>${summaryRows(subjects, (s) => [studentCount(s), sectionLabel(s)].filter(Boolean).join(', '))}</tbody>
              </table>
              <div class="summary-pad"></div>
            </div>

            <div class="totals">
              <span>Total Units: ${totalUnits}</span>
              <span>Preparations: ${subjects.length}</span>
              <span>Hours/Week: ${weeklyHours(list)}</span>
            </div>
            <div class="meta">
              <div>Administrative Designation: ${esc(details.administrativeDesignation || '')}</div>
              <div>Production: ${esc(details.productionInvolvement || '')}</div>
              <div>Extension: ${esc(details.extensionInvolvement || '')}</div>
              <div>Research: ${esc(details.researchInvolvement || '')}</div>
            </div>
            ${signatories(filters)}
          </div>
        </div>
      </div>`;
    }).join('');

  writeSheets(win, 'Program by Teacher - CTU Daanbantayan', sheets, byFaculty.size, 'teacher');
};

/**
 * PROGRAM BY SECTION: the same form, one sheet per section. The grid's second
 * line names the teacher instead of the section, and the summary lists who
 * teaches each subject.
 */
export const exportSectionProgram = async (schedules, filters = {}) => {
  const rows = schedules || [];
  if (rows.length === 0) {
    toast('No schedules to export. Adjust the filters first.');
    return;
  }

  const win = openWindow();
  if (!win) return;
  const logos = await loadMarks();

  const bySection = new Map();
  rows.forEach((s) => {
    const key = sectionLabel(s) || 'Unassigned';
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(s);
  });

  const sheets = [...bySection.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([section, list]) => {
      const first = list[0];
      const subjects = uniqueSubjects(list);
      const totalUnits = subjects.reduce((sum, s) => sum + subjectUnits(s), 0);
      const students = studentCount(first);

      return `<div class="sheet">
        ${letterhead('PROGRAM BY SECTION', termLine(first.shift, first.semester, first.academicYear), logos)}
        <div class="body">
          <div class="grid-wrap">${gridHtml(list, facultyName)}</div>
          <div class="panel">
            <div class="field"><span class="k">SECTION:</span><span class="v">${esc(section)}</span>
              <span class="k">Shift:</span><span class="v">${esc(first.shift || 'Day')}</span></div>
            <div class="cols">
              <div class="field"><span class="k">Program:</span><span class="v">${esc(first.program || '')}</span></div>
              <div class="field"><span class="k">Year Level:</span><span class="v">${esc(first.yearLevel || '')}</span></div>
            </div>
            <div class="cols">
              <div class="field"><span class="k">Academic Year:</span><span class="v">${esc(first.academicYear || '')}</span></div>
              <div class="field"><span class="k">No. of Students:</span><span class="v">${esc(students || '')}</span></div>
            </div>
            <div class="field"><span class="k">Adviser:</span><span class="v">${esc(filters.adviser || '')}</span></div>

            <div class="summary">
              <div class="summary-title">SUMMARY OF SUBJECTS</div>
              <table class="subjects">
                <thead><tr><th class="u">Units</th><th class="sc">Subject code</th><th>Descriptive Title</th><th class="st">Instructor</th></tr></thead>
                <tbody>${summaryRows(subjects, facultyName)}</tbody>
              </table>
              <div class="summary-pad"></div>
            </div>

            <div class="totals">
              <span>Total Units: ${totalUnits}</span>
              <span>Subjects: ${subjects.length}</span>
              <span>Hours/Week: ${weeklyHours(list)}</span>
            </div>
            ${signatories(filters)}
          </div>
        </div>
      </div>`;
    }).join('');

  writeSheets(win, 'Program by Section - CTU Daanbantayan', sheets, bySection.size, 'section');
};

const officialProgramExport = { exportFacultyProgram, exportSectionProgram };
export default officialProgramExport;
