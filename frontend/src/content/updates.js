/*
 * Release notes for the public /updates page.
 *
 * Newest first - the page takes the first entry as the current release. Each
 * entry is written for the people who use the system, not for developers, so
 * describe what changed for them rather than which files moved.
 *
 * kind: 'new'      - something that was not there before
 *       'improved' - something that already worked, done better
 *       'fixed'    - something that was broken
 */

export const UPDATES = [
  {
    id: '2026-11-19',
    date: '2026-11-19',
    title: 'Clearer ownership of records',
    summary:
      'Faculty credentials and student records now belong to the administrator, and timetables are created through the builder and the generator rather than a form.',
    changes: [
      {
        kind: 'improved',
        text:
          "A faculty member's educational background and subject expertise are read-only for program managers and the scheduling office. The administrator maintains them.",
      },
      {
        kind: 'improved',
        text:
          'Faculty records are added and edited by the administrator. Scheduling staff still send invite links, and teachers fill in their own profile when they sign up.',
      },
      {
        kind: 'improved',
        text: 'Students are added by the administrator. Scheduling staff keep the CSV import, template and export.',
      },
      {
        kind: 'improved',
        text:
          'The "Add Schedule" form is gone. A timetable is generated or placed by hand in the builder, and both check for clashes as you go.',
      },
      { kind: 'improved', text: 'Schedule Management now has a page heading that says which program and term you are looking at.' },
    ],
  },
  {
    id: '2026-11-18',
    date: '2026-11-18',
    title: 'Night-shift exports and class-space posting',
    summary:
      'Evening sections export on a grid that actually fits their hours, and only the teacher of a class can post to its class space.',
    changes: [
      {
        kind: 'fixed',
        text:
          'Night-shift timetables exported on a daytime grid, so evening classes fell outside it. The export now runs to the hours those sections are taught.',
      },
      {
        kind: 'improved',
        text:
          'Announcements and materials in a class space are posted by the teacher of that class. Scheduling staff and program managers read them.',
      },
      { kind: 'new', text: 'The CTU footer banner appears on exported program forms, in both the PDF and the Excel file.' },
      { kind: 'new', text: 'A verification test suite covering conflict detection, faculty ranking, sign-in and file uploads.' },
    ],
  },
  {
    id: '2026-11-15',
    date: '2026-11-15',
    title: 'Preparation gaps everywhere, and a faster first look',
    summary:
      'The preparation gap between a teacher’s classes is now enforced when you place a class by hand, not only when the solver places it.',
    changes: [
      { kind: 'improved', text: 'Dragging a class into the builder respects each teacher’s preparation gap, the same as generated timetables.' },
      { kind: 'new', text: 'An opening showreel and hero video on the public page.' },
      { kind: 'improved', text: 'The site describes itself properly to search engines and AI assistants.' },
    ],
  },
  {
    id: '2026-11-13',
    date: '2026-11-13',
    title: 'Two-step verification and passkeys',
    summary: 'Accounts can be protected with a second step, including a fingerprint or face unlock on a supported device.',
    changes: [
      { kind: 'new', text: 'Two-step verification by email code, with recovery codes.' },
      { kind: 'new', text: 'Passkeys: sign in with a fingerprint, face or device PIN instead of a password.' },
      { kind: 'new', text: 'Teachers keep a preparation gap between classes, one hour by default, enforced by the solver.' },
      { kind: 'fixed', text: 'Closed gaps where data from one program could be read by another.' },
    ],
  },
  {
    id: '2026-11-12',
    date: '2026-11-12',
    title: 'The official CTU program forms',
    summary: 'A finished timetable exports straight onto the form the campus already uses, as a printable PDF or an Excel file.',
    changes: [
      { kind: 'new', text: 'Export a program’s timetable to the official CTU form as PDF, ready to print.' },
      { kind: 'new', text: 'The same form as an Excel file, for anyone who needs to edit it afterwards.' },
    ],
  },
  {
    id: '2026-11-11',
    date: '2026-11-11',
    title: 'The schedule builder',
    summary:
      'A weekly grid you can drag classes onto, with B-LO beside it to answer questions about the section you are working on.',
    changes: [
      { kind: 'new', text: 'Drag-and-drop weekly builder with live conflict feedback as you place each class.' },
      { kind: 'new', text: 'B-LO, the builder assistant: ask why a slot is blocked or who else could teach a subject.' },
      { kind: 'new', text: 'Borrowed teachers: approve a teacher from another department for a specific subject.' },
      { kind: 'new', text: 'Section join links, so students enrol themselves instead of being added one by one.' },
      { kind: 'new', text: 'A notification panel, and reminders to faculty about the classes they teach.' },
      { kind: 'fixed', text: 'Gmail addresses containing dots could never sign in.' },
    ],
  },
  {
    id: '2026-11-09',
    date: '2026-11-09',
    title: 'Rooms, home rooms, and draft before publish',
    summary:
      'Timetables are drafted privately and published when they are ready, so students and faculty only ever see a finished schedule.',
    changes: [
      { kind: 'new', text: 'Room management, with a dedicated home room per section.' },
      { kind: 'new', text: 'Draft and publish: a timetable is only visible to students and faculty once published.' },
      { kind: 'improved', text: 'A colour system that means something: green for success, orange for warnings, red for failures.' },
      { kind: 'improved', text: 'Class Spaces and Subject Management redesigned.' },
    ],
  },
  {
    id: '2026-11-08',
    date: '2026-11-08',
    title: 'Per-program semesters and data isolation',
    summary: 'Each program runs its own academic calendar, and sees only its own data.',
    changes: [
      { kind: 'new', text: 'Each program sets its own active semester and academic year.' },
      { kind: 'improved', text: 'A program manager sees their own program and nothing else.' },
      { kind: 'new', text: 'Faculty onboarding by invite link.' },
    ],
  },
  {
    id: '2026-10-30',
    date: '2026-10-30',
    title: 'Notifications and dashboards',
    summary: 'Live notifications, a dashboard for every role, and terms of use acceptance on first sign-in.',
    changes: [
      { kind: 'new', text: 'Real-time notifications.' },
      { kind: 'new', text: 'A dashboard for each role, showing what that person actually needs.' },
      { kind: 'new', text: 'Terms of use and privacy notice, accepted on first sign-in.' },
    ],
  },
  {
    id: '2026-10-21',
    date: '2026-10-21',
    title: 'The constraint solver',
    summary:
      'Timetables are built by Google OR-Tools CP-SAT, which places a whole section at once instead of one class at a time.',
    changes: [
      { kind: 'new', text: 'Schedule generation by constraint solver, with an equivalent fallback engine.' },
      { kind: 'new', text: 'Faculty ranked by their experience with the subject.' },
      { kind: 'fixed', text: 'NSTP was placed outside the hours first-year sections can attend it.' },
      { kind: 'new', text: 'Lecture and laboratory hours tracked separately per subject.' },
    ],
  },
];

export const KIND_LABEL = {
  new: 'New',
  improved: 'Improved',
  fixed: 'Fixed',
};

export default UPDATES;
