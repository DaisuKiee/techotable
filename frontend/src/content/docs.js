/*
 * Content for the public /docs page.
 *
 * Kept as data rather than markup so the wording can be changed without
 * touching the layout, and so the page can build its own contents list and
 * search index from it.
 *
 * Block types:
 *   { type: 'p', text }                        - a paragraph
 *   { type: 'list', items: [] }                - unordered points
 *   { type: 'steps', items: [] }               - a numbered sequence
 *   { type: 'note', tone: 'info'|'warn', text } - a callout
 *   { type: 'table', head: [], rows: [[]] }    - a comparison
 */

export const DOCS = [
  {
    id: 'overview',
    title: 'What this system is',
    icon: 'BookOpen',
    blocks: [
      {
        type: 'p',
        text:
          'The Smart Timetabling System builds clash-free class timetables for the College of Technology Education at Cebu Technological University, Daanbantayan Campus. A constraint solver places every class for a section in one pass, and you fine-tune the result by dragging classes around a weekly grid.',
      },
      {
        type: 'p',
        text:
          'It also carries the schedule forward: once a timetable is published, every class gets a class space where the teacher posts announcements and materials, and students see the week ahead on their own dashboard.',
      },
      {
        type: 'list',
        items: [
          'Seven programs: BSIT, BSHM, BIT-ET, BIT-CT, BIT-AT, BSFI and BSIE.',
          'Day and night shifts, including Saturday classes for evening sections.',
          'English, Filipino and Cebuano, in light or dark theme.',
          'Free for the campus community; most features need a signed-in account.',
        ],
      },
    ],
  },
  {
    id: 'roles',
    title: 'Who can do what',
    icon: 'Users',
    blocks: [
      {
        type: 'p',
        text:
          'Every account has one role, and the role decides what appears on screen. Records that describe a person — a teacher’s degrees and expertise, a student’s enrolment — belong to the administrator. Scheduling staff work with timetables.',
      },
      {
        type: 'table',
        head: ['Role', 'What they do'],
        rows: [
          ['Administrator', 'Manages every program, all accounts and approvals. Adds and edits faculty and student records.'],
          ['Scheduling Officer', 'Generates, adjusts and publishes timetables across programs.'],
          ['Program Manager', 'Runs scheduling for one program, and sees only that program’s data.'],
          ['Faculty', 'Sees their teaching load, and posts announcements and materials to the classes they teach.'],
          ['Student', 'Joins a section, follows their weekly schedule, and reads their class spaces.'],
        ],
      },
      {
        type: 'note',
        tone: 'info',
        text:
          'Scheduling staff send invite links rather than creating faculty accounts by hand. A teacher who signs up through an invite fills in their own degrees and subject expertise.',
      },
    ],
  },
  {
    id: 'getting-started',
    title: 'Getting started',
    icon: 'LogIn',
    blocks: [
      {
        type: 'steps',
        items: [
          'Sign in with your CTU account, or create one. Student accounts are verified by email.',
          'Accept the terms of use and privacy notice the first time you sign in.',
          'Set up two-step verification from Settings. It is recommended, not required.',
          'Students: join your section with the code or link your program gives you.',
        ],
      },
      {
        type: 'p',
        text:
          'Your dashboard is built for your role. A student sees the next class and any new announcements; a teacher sees today’s teaching and their load for the term; scheduling staff see what still needs placing and what is ready to publish.',
      },
    ],
  },
  {
    id: 'scheduling',
    title: 'How a timetable is built',
    icon: 'Wand2',
    blocks: [
      {
        type: 'p',
        text:
          'Generation is a constraint-optimisation problem, not a series of guesses. The solver considers a whole section at once and returns a timetable in which every hard rule holds, or tells you it cannot be done.',
      },
      { type: 'p', text: 'These rules are never broken:' },
      {
        type: 'list',
        items: [
          'A section, a teacher and a room are each in one place at a time.',
          'Teaching load stays within each teacher’s cap for the term.',
          'Every teacher keeps a preparation gap between classes — one hour by default.',
          'A subject meets at most once a day.',
          'A section with a home room takes every class there; laboratory classes otherwise need a laboratory room.',
          'Classes already saved for a section are never generated a second time.',
        ],
      },
      {
        type: 'p',
        text:
          'Among the timetables that satisfy all of that, the solver optimises for the priority you choose: balanced, teaching experience, even workload, or compact days. Preferences — an 8 AM start over a 7 AM one, for instance — are weighed rather than enforced, so a preference never makes a timetable impossible.',
      },
      {
        type: 'note',
        tone: 'info',
        text:
          'The engine is Google OR-Tools CP-SAT. Where it is unavailable, an equivalent JavaScript solver runs instead and produces the same kind of result, so the system behaves the same on any host.',
      },
      {
        type: 'p',
        text:
          'After a run, the preview explains what the chosen weighting gave up — classes outside a teacher’s specialisation, teachers close to their cap, meetings before 8 AM, the longest wait between a section’s classes — and offers near-equal alternative teachers you can swap in before saving.',
      },
    ],
  },
  {
    id: 'builder',
    title: 'The drag-and-drop builder',
    icon: 'Move',
    blocks: [
      {
        type: 'p',
        text:
          'The builder is a weekly grid for one section. Drag a subject onto a slot and it is placed; the grid refuses slots that would clash, and tells you which rule stands in the way.',
      },
      {
        type: 'list',
        items: [
          'The same conflict checks as generation, including the preparation gap.',
          'Ask the builder to suggest placements for what is still missing, then accept or ignore them.',
          'B-LO, the assistant beside the grid, answers questions about the section you are on and remembers what you tell it.',
          'Nothing is placed without you clicking Add.',
        ],
      },
      {
        type: 'note',
        tone: 'warn',
        text:
          'A timetable that looks wrong is usually the data behind it: a teacher’s cap, a declared unavailable window, a missing laboratory room, or a home room too small for the section.',
      },
    ],
  },
  {
    id: 'shifts',
    title: 'Day and night shifts',
    icon: 'Clock',
    blocks: [
      {
        type: 'p',
        text:
          'Day sections are taught from the morning through the afternoon. Night sections are taught on weekday evenings and for a full day on Saturday, and the system keeps classes inside those windows on every screen — the builder grid, the generator and the exported form.',
      },
      {
        type: 'table',
        head: ['Shift', 'When classes may be placed'],
        rows: [
          ['Day', 'Monday to Saturday, through the daytime hours.'],
          ['Night', 'Monday to Friday, 4 PM to 10 PM, and Saturday, 7 AM to 7 PM.'],
        ],
      },
      {
        type: 'p',
        text:
          'First-year NSTP is treated separately: the solver prefers to place it on Saturday morning, where it does not compete with the rest of the week. This is a strong preference rather than a rule, because forcing it made some terms impossible to schedule at all.',
      },
    ],
  },
  {
    id: 'faculty',
    title: 'Faculty, experience and borrowing',
    icon: 'GraduationCap',
    blocks: [
      {
        type: 'p',
        text:
          'Each teacher has a teaching cap for the term, the subjects they have taught before, and the subject expertise recorded on their profile. The system ranks candidates for a subject by how recently and how often they have taught it, and by whether it matches their expertise.',
      },
      {
        type: 'p',
        text:
          'When nobody in a program can take a subject, a teacher from another department can be approved for that specific subject. They are then offered only for it, their load still counts across every program, and they appear in the borrowing program’s faculty list marked "Cross Referenced".',
      },
      {
        type: 'note',
        tone: 'info',
        text:
          'The same course under another department’s subject code still counts as experience, so a teacher is not penalised for the code a program happens to use.',
      },
    ],
  },
  {
    id: 'class-spaces',
    title: 'Class spaces',
    icon: 'MessageSquare',
    blocks: [
      {
        type: 'p',
        text:
          'Publishing a timetable creates a class space for each class. The teacher of that class posts announcements and uploads materials; the students enrolled in the section read them and get a notification when something new arrives.',
      },
      {
        type: 'list',
        items: [
          'Only the teacher of a class posts to it. Scheduling staff and program managers can read it and manage its enrolment code.',
          'Students join with an enrolment code or a join link, which expires.',
          'Materials accept documents and images up to the size limit shown on the upload form.',
        ],
      },
    ],
  },
  {
    id: 'data',
    title: 'Importing and exporting',
    icon: 'FileSpreadsheet',
    blocks: [
      {
        type: 'p',
        text:
          'Students, faculty and subjects can be brought in from a spreadsheet rather than typed in one at a time. Download the template first — it has the columns in the order the importer expects — and it will tell you which rows it could not read before anything is saved.',
      },
      {
        type: 'p',
        text:
          'A finished timetable exports onto the official CTU program form, as a PDF ready to print or as an Excel file if it still needs editing. Night sections export on their own time grid.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Accounts and privacy',
    icon: 'ShieldCheck',
    blocks: [
      {
        type: 'list',
        items: [
          'Two-step verification by email code, with recovery codes to fall back on.',
          'Passkeys: sign in with a fingerprint, face or device PIN instead of a password.',
          'A program manager sees their own program only — not other programs’ students, faculty or timetables.',
          'Terms of use and a privacy notice, accepted on first sign-in and again when they change.',
        ],
      },
      {
        type: 'note',
        tone: 'warn',
        text:
          'Recovery codes are shown once, when you turn two-step verification on. Keep them somewhere you can reach without this system.',
      },
    ],
  },
  {
    id: 'faq',
    title: 'Common questions',
    icon: 'HelpCircle',
    blocks: [
      {
        type: 'p',
        text:
          '**Why can I not edit a teacher’s degrees or expertise?** Those belong to the administrator. Scheduling staff read them; the teacher fills them in when they sign up through an invite link.',
      },
      {
        type: 'p',
        text:
          '**The generator says it cannot build a timetable.** Something makes it impossible rather than merely hard — usually too little teaching capacity for the subjects, a section with no room large enough, or laboratory hours with no laboratory room free. The message names the constraint it could not satisfy.',
      },
      {
        type: 'p',
        text:
          '**Why does the same run give a slightly different timetable?** Many timetables satisfy every rule equally well. The solver returns the best one it found in the time it was given, so two runs can differ while both being correct.',
      },
      {
        type: 'p',
        text:
          '**Students cannot see the schedule.** Check that it is published. A draft is visible only to the staff working on it.',
      },
      {
        type: 'p',
        text:
          '**Can a class be placed at 7 AM?** Yes. The solver prefers an 8 AM start and will use 7 AM when it has to.',
      },
    ],
  },
];

export default DOCS;
