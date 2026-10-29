/**
 * Terms of Use and Privacy Notice shown on first login and at /terms.
 *
 * DRAFT for review by the campus Data Protection Officer / legal office.
 * When the meaning changes, bump TERMS_VERSION in backend/config/terms.js
 * (and `version` below) so every user is asked to accept again.
 */

export const TERMS = {
  version: '2026-10-30',
  updated: 'October 30, 2026',
  owner: 'Cebu Technological University – Daanbantayan Campus',
  system: 'CoTE Smart Timetabling System',
  sections: [
    {
      id: 'about',
      title: '1. About these terms',
      body: [
        'These terms explain how you may use the CoTE Smart Timetabling System ("the System") of Cebu Technological University – Daanbantayan Campus ("the University", "we"), and how we handle your personal information in it.',
        'By selecting "I agree" you confirm that you have read and understood these terms and the privacy notice below. If you do not agree, please sign out and contact your program office.',
      ],
    },
    {
      id: 'use',
      title: '2. Your account and acceptable use',
      list: [
        'Your account is for you only. Keep your password private and do not let others sign in as you.',
        'Use the System only for University scheduling, classes and related academic work.',
        'Do not try to access records, classes or functions that are not meant for your role, or to disrupt the System.',
        'Post only appropriate content in class spaces. Announcements and files must follow the University’s student and employee codes of conduct.',
        'Report any mistake in your schedule or record, or any suspected misuse of an account, to your program office or the scheduling office.',
      ],
    },
    {
      id: 'schedules',
      title: '3. Schedules and notifications',
      body: [
        'Timetables may be generated or changed by the scheduling office and program managers, including with the help of automated scheduling tools. Draft schedules can change until they are published.',
        'The System sends in-app notifications, and may send email, when your classes, section or account change. Always check the latest timetable in the System; announcements from your instructors and program office take precedence over earlier notices.',
      ],
    },
    {
      id: 'ai',
      title: '4. The AI assistant',
      body: [
        'The B-LO assistant answers questions using a third-party AI service (Google Gemini). Questions you type, and relevant scheduling information such as class, room and faculty load details, are sent to that service to produce an answer.',
        'Do not enter sensitive personal information (for example health, financial or government ID details) in the assistant. Its answers can be wrong; confirm anything important with the scheduling office.',
      ],
    },
    {
      id: 'privacy',
      title: '5. Privacy notice',
      body: [
        'The University processes personal information in line with the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and issuances of the National Privacy Commission.',
      ],
      subsections: [
        {
          title: 'What we collect',
          list: [
            'Account details: name, email address, password (stored encrypted), role and profile photo.',
            'Students: student ID, program, year level, section, enrolled subjects, enrollment status, contact number, address, guardian and emergency contact details, and grade information if recorded.',
            'Faculty: employee ID, position, employment type, department, programs, qualifications, specializations, teaching history and ratings, availability and teaching load.',
            'Class activity: class memberships, announcements, materials, and notifications.',
            'System records: sign-in times and an activity log of changes made in the System.',
          ],
        },
        {
          title: 'Why we use it',
          list: [
            'To create and manage class schedules, sections, rooms and teaching loads.',
            'To give students and faculty access to their classes, timetables and class spaces.',
            'To send notices about schedule, enrollment and account changes.',
            'To keep the System secure, investigate problems and keep an audit trail of changes.',
            'To produce summary reports for academic planning.',
          ],
        },
        {
          title: 'Who can see it',
          list: [
            'Authorized University personnel according to their role: the scheduling office, administrators, and program managers for their own program.',
            'Your instructors and classmates see only what classes need, such as your name in a class roster.',
            'Service providers that host or run the System for us (cloud hosting, database and email delivery, and the AI service described above), only to provide those services.',
            'Government authorities when the law requires it.',
          ],
        },
        {
          title: 'How long we keep it',
          body: [
            'We keep records for as long as you are enrolled or employed and afterwards for the period required by University records policies and applicable law. Notifications are deleted automatically after 30 days.',
          ],
        },
        {
          title: 'How we protect it',
          body: [
            'Access is limited by role, passwords are encrypted, and connections to the System are protected. No system is perfectly secure; tell us right away if you think your account was misused.',
          ],
        },
        {
          title: 'Your rights',
          body: [
            'Under the Data Privacy Act you have the right to be informed, to access your personal information, to object, to have it corrected, to have it erased or blocked where allowed, to data portability, to claim damages, and to file a complaint with the National Privacy Commission.',
            'To exercise these rights or ask about this notice, contact the campus Data Protection Officer through your program office or the Campus Registrar.',
          ],
        },
      ],
    },
    {
      id: 'changes',
      title: '6. Changes to these terms',
      body: [
        'We may update these terms. When we make a significant change, the System will ask you to review and accept the new version the next time you sign in.',
      ],
    },
  ],
};

export default TERMS;
