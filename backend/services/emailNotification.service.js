/**
 * Email Notification Service
 * 
 * Handles sending email notifications for schedule updates
 * to students and faculty members
 */

const Student = require('../models/Student.model');
const Faculty = require('../models/Faculty.model');
const Schedule = require('../models/Schedule.model');

// Create reusable transporter
const { getTransport, envelope, inlineAssets } = require('./mailer');

/**
 * Whether this address wants the email: its owner can turn email off
 * altogether (emailNotifications) or one kind of notice (`preference`).
 * Addresses without an account get it.
 */
const wantsEmail = async (to, preference) => {
  const User = require('../models/User.model');
  const user = await User.findOne({ email: String(to).toLowerCase() }).select('settings.notifications').lean();
  const prefs = user?.settings?.notifications || {};
  if (prefs.emailNotifications === false) return false;
  return !(preference && prefs[preference] === false);
};

/**
 * Send email notification
 * @param {object} [options]  { preference } - the Settings switch that covers it
 */
const sendEmail = async (to, subject, html, { preference, text } = {}) => {
  // Also accepts sendEmail(to, renderEmail(...), null, options)
  if (subject && typeof subject === 'object') {
    ({ subject, html, text } = { ...subject, text: text || subject.text });
  }
  try {
    if (!(await wantsEmail(to, preference))) {
      return { success: true, skipped: 'recipient turned these emails off' };
    }

    const consoleMode = process.env.EMAIL_CONSOLE_MODE === 'true';

    if (consoleMode) {
      console.log('\n📧 ===== EMAIL NOTIFICATION =====');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(text || html);
      console.log('================================\n');
      return { success: true, mode: 'console' };
    }

    const mailOptions = {
      ...envelope(),
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...inlineAssets(html),
    };

    const info = await getTransport().sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
};

const T = require('./emailTemplates');
const { loadRoomsByRawValues, labelFor, looksLikeObjectId } = require('../utils/roomLabel');

/** Same link format as the in-app notifications: /classes/cc317-bsit-3a-d */
const classPath = (subjectCode, sectionCode) => `/classes/${[subjectCode || 'class', sectionCode || '']
  .filter(Boolean).join('-').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;

const personName = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '') || null;
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';
const SPACER = '<div style="height:18px;line-height:18px;">&nbsp;</div>';

/** Schedule with subject, teacher and a readable room label. */
const loadScheduleForEmail = async (scheduleId) => {
  const schedule = await Schedule.findById(scheduleId)
    .populate('subject', 'subjectCode subjectName')
    .populate({ path: 'faculty', populate: { path: 'user', select: 'firstName lastName email' } })
    .lean();
  if (!schedule) return null;
  const raw = schedule.room ? String(schedule.room) : null;
  if (raw && looksLikeObjectId(raw)) {
    const rooms = await loadRoomsByRawValues([raw]);
    schedule.roomLabel = labelFor(rooms.get(raw)) || null;
  } else {
    schedule.roomLabel = raw;
  }
  return schedule;
};

/**
 * Schedule published / updated.
 * @param {'published'|'updated'} type
 * @param {'student'|'faculty'} audience
 * @returns {{ subject, html, text }}
 */
const scheduleEmail = (type, schedule, recipientName, audience = 'student') => {
  const published = type === 'published';
  const code = schedule.subject?.subjectCode || 'Your class';
  const name = schedule.subject?.subjectName || '';
  const section = schedule.sectionCode || '';
  const teacher = personName(schedule.faculty?.user);
  const term = T.termLabel(schedule.academicYear, schedule.semester);
  const slots = T.sortSlots(schedule.timeSlots || []);
  const tone = published ? 'success' : 'warning';
  const forFaculty = audience === 'faculty';

  const lead = forFaculty
    ? (published
      ? `Your teaching schedule for <strong>${T.esc(code)}</strong>${section ? ` with <strong>${T.esc(section)}</strong>` : ''} is now published. Your students can see it too.`
      : `Something changed in your teaching schedule for <strong>${T.esc(code)}</strong>. Please check the times and room below.`)
    : (published
      ? `Your class schedule for <strong>${T.esc(code)}</strong> is now published. Here’s when and where you’ll meet.`
      : `Your schedule for <strong>${T.esc(code)}</strong> changed. Please check the times and room below.`);

  const body = [
    T.paragraph(lead),
    T.sectionTitle('When you meet'),
    T.meetings(slots, tone),
    T.sectionTitle('Class details'),
    T.details([
      ['Subject', name ? `${code} – ${name}` : code],
      ['Section', section],
      forFaculty ? null : ['Teacher', teacher],
      ['Room', schedule.roomLabel],
      ['Term', term],
    ].filter(Boolean)),
    published ? '' : `${SPACER}${T.callout('Double-check before your next class', 'The time or room may differ from what you saved or printed earlier.', 'warning')}`,
  ].join('');

  const textBody = [
    forFaculty
      ? (published ? `Your teaching schedule for ${code}${section ? ` (${section})` : ''} is now published.` : `Your teaching schedule for ${code} changed.`)
      : (published ? `Your class schedule for ${code} is now published.` : `Your schedule for ${code} changed.`),
    '',
    'When you meet:',
    ...(slots.length ? slots.map((sl) => `  ${sl.day}  ${T.fmtTime(sl.startTime)} – ${T.fmtTime(sl.endTime)}`) : ['  No meeting times set yet.']),
    '',
    `Subject: ${name ? `${code} – ${name}` : code}`,
    section ? `Section: ${section}` : null,
    !forFaculty && teacher ? `Teacher: ${teacher}` : null,
    schedule.roomLabel ? `Room: ${schedule.roomLabel}` : null,
    term ? `Term: ${term}` : null,
  ].filter((l) => l !== null).join('\n');

  return T.renderEmail({
    subject: `${published ? 'Schedule published' : 'Schedule changed'}: ${code}${section ? ` · ${section}` : ''}`,
    preheader: slots.length
      ? `${slots.map((sl) => `${sl.day.slice(0, 3)} ${T.fmtTime(sl.startTime)}`).join(', ')}${schedule.roomLabel ? ` · ${schedule.roomLabel}` : ''}`
      : `${code} schedule ${published ? 'published' : 'updated'}`,
    tone,
    eyebrow: published ? 'Schedule published' : 'Schedule changed',
    title: name ? `${code} · ${name}` : code,
    greeting: `Hi ${firstName(recipientName)},`,
    body,
    textBody,
    cta: { label: published ? 'Open my class' : 'See the new schedule', url: T.url(classPath(code, section)) },
    reason: forFaculty
      ? 'You’re getting this because “Teaching assignments” is on in your notification settings.'
      : 'You’re getting this because “Schedule changes” is on in your notification settings.',
    manageLink: true,
  });
};

/** New announcement in a class. */
const announcementEmail = (announcement, classData, recipientName) => {
  const { subjectCode, subjectName, sectionCode } = classData;
  const author = personName(announcement.postedBy) || 'Your teacher';
  const title = announcement.title || `New announcement in ${subjectCode}`;
  const content = String(announcement.content || '');
  const excerpt = content.replace(/\s+/g, ' ').trim();

  const body = [
    T.paragraph(`<strong>${T.esc(author)}</strong> posted in <strong>${T.esc(subjectCode)}</strong>${sectionCode ? ` · ${T.esc(sectionCode)}` : ''}.`),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td bgcolor="#f9fafb" style="background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid #2563eb;border-radius:10px;padding:18px 20px;font-family:${T.FONT};">
          <p style="margin:0;font-size:15px;line-height:1.65;color:#374151;">${T.paragraphs(content) || '<em>No message.</em>'}</p>
        </td>
      </tr>
    </table>`,
    T.sectionTitle('Class'),
    T.details([
      ['Subject', subjectName ? `${subjectCode} – ${subjectName}` : subjectCode],
      ['Section', sectionCode],
      ['Posted by', author],
    ]),
  ].join('');

  return T.renderEmail({
    subject: `${subjectCode}: ${title}`,
    preheader: `${author}: ${excerpt.slice(0, 110)}${excerpt.length > 110 ? '…' : ''}`,
    tone: 'info',
    eyebrow: `New announcement · ${subjectCode}`,
    title,
    greeting: `Hi ${firstName(recipientName)},`,
    body,
    textBody: [`${author} posted in ${subjectCode}${sectionCode ? ` (${sectionCode})` : ''}:`, '', content.trim()].join('\n'),
    cta: { label: 'Open the class', url: T.url(classPath(subjectCode, sectionCode)) },
    reason: 'You’re getting this because “Announcements & materials” is on in your notification settings.',
    manageLink: true,
  });
};

const FILE_KINDS = [
  ['PDF', /\.pdf$/i], ['DOC', /\.(docx?|odt|rtf|txt)$/i], ['PPT', /\.(pptx?|odp|key)$/i],
  ['XLS', /\.(xlsx?|csv|ods)$/i], ['IMG', /\.(png|jpe?g|gif|webp|svg|bmp)$/i],
  ['ZIP', /\.(zip|rar|7z|tar|gz)$/i], ['VID', /\.(mp4|mov|avi|mkv|webm)$/i],
];
const fileKindOf = (name) => (FILE_KINDS.find(([, re]) => re.test(name || '')) || ['FILE'])[0];
const fmtSize = (bytes) => {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/** New material in a class. */
const materialEmail = (material, classData, recipientName) => {
  const { subjectCode, subjectName, sectionCode } = classData;
  const author = personName(material.uploadedBy) || 'Your teacher';
  const kind = fileKindOf(material.fileName || material.fileUrl);
  const size = fmtSize(material.fileSize);
  const title = material.title || material.fileName || 'New material';

  const body = [
    T.paragraph(`<strong>${T.esc(author)}</strong> shared a file in <strong>${T.esc(subjectCode)}</strong>${sectionCode ? ` · ${T.esc(sectionCode)}` : ''}.`),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate;">
      <tr>
        <td width="64" style="padding:16px 0 16px 16px;vertical-align:top;">
          <div style="width:48px;height:56px;line-height:56px;border-radius:8px;background:#475569;color:#ffffff;text-align:center;font-family:${T.FONT};font-size:12px;font-weight:800;letter-spacing:.04em;">${T.esc(kind)}</div>
        </td>
        <td style="padding:16px;vertical-align:top;font-family:${T.FONT};">
          <p style="margin:0;font-size:16px;font-weight:700;color:#111827;">${T.esc(title)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;word-break:break-all;">${T.esc(material.fileName || '')}${size ? ` · ${T.esc(size)}` : ''}</p>
          ${material.description ? `<p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#374151;">${T.paragraphs(material.description)}</p>` : ''}
        </td>
      </tr>
    </table>`,
    T.sectionTitle('Class'),
    T.details([
      ['Subject', subjectName ? `${subjectCode} – ${subjectName}` : subjectCode],
      ['Section', sectionCode],
      ['Shared by', author],
    ]),
  ].join('');

  return T.renderEmail({
    subject: `${subjectCode}: new material – ${title}`,
    preheader: `${author} shared ${material.fileName || 'a file'}${size ? ` (${size})` : ''}`,
    tone: 'info',
    eyebrow: `New material · ${subjectCode}`,
    title,
    greeting: `Hi ${firstName(recipientName)},`,
    body,
    textBody: [
      `${author} shared a file in ${subjectCode}${sectionCode ? ` (${sectionCode})` : ''}:`,
      `${title}${material.fileName ? ` – ${material.fileName}` : ''}${size ? ` (${size})` : ''}`,
      material.description ? `\n${material.description}` : null,
    ].filter(Boolean).join('\n'),
    cta: { label: 'Open the class to download', url: T.url(classPath(subjectCode, sectionCode)) },
    reason: 'You’re getting this because “Announcements & materials” is on in your notification settings.',
    manageLink: true,
  });
};

/**
 * Get students for a specific section
 */
const getStudentsForSection = async (sectionCode, program, yearLevel, semester, academicYear) => {
  try {
    const query = {
      isActive: true,
      sectionCode
    };
    
    if (program) query.program = program;
    if (yearLevel) query.yearLevel = yearLevel;
    if (semester) query.semester = semester;
    if (academicYear) query.academicYear = academicYear;

    const students = await Student.find(query)
      .populate('user', 'email firstName lastName')
      .lean();

    return students.filter(s => s.user && s.user.email);
  } catch (error) {
    console.error('Error fetching students:', error);
    return [];
  }
};

/**
 * Notify students about schedule changes
 */
const notifyStudents = async (scheduleId, type = 'published') => {
  try {
    const schedule = await loadScheduleForEmail(scheduleId);

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    // Get students for this section
    const students = await getStudentsForSection(
      schedule.sectionCode,
      schedule.program,
      schedule.yearLevel,
      schedule.semester,
      schedule.academicYear
    );

    if (students.length === 0) {
      console.log('⚠️  No students found for this schedule');
      return { sent: 0, failed: 0 };
    }

    console.log(`📧 Sending notifications to ${students.length} students...`);

    const results = await Promise.allSettled(
      students.map((student) => sendEmail(
        student.user.email,
        scheduleEmail(type, schedule, personName(student.user), 'student'),
        null,
        { preference: 'scheduleUpdates' }
      ))
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;

    console.log(`✅ Notifications sent: ${sent} successful, ${failed} failed`);

    return { sent, failed, total: students.length };
  } catch (error) {
    console.error('Error notifying students:', error);
    throw error;
  }
};

/**
 * Notify the teacher about schedule changes
 */
const notifyFaculty = async (scheduleId, type = 'published') => {
  try {
    const schedule = await loadScheduleForEmail(scheduleId);

    if (!schedule || !schedule.faculty || !schedule.faculty.user || !schedule.faculty.user.email) {
      console.log('⚠️  No faculty email found for this schedule');
      return { sent: 0, failed: 0 };
    }

    console.log(`📧 Sending notification to faculty: ${schedule.faculty.user.email}`);

    const result = await sendEmail(
      schedule.faculty.user.email,
      scheduleEmail(type, schedule, personName(schedule.faculty.user), 'faculty'),
      null,
      { preference: 'facultyAssignments' }
    );

    return {
      sent: result.success ? 1 : 0,
      failed: result.success ? 0 : 1,
      total: 1
    };
  } catch (error) {
    console.error('Error notifying faculty:', error);
    throw error;
  }
};

/**
 * Notify both students and faculty about schedule changes
 */
const notifyScheduleChange = async (scheduleId, type = 'published') => {
  try {
    console.log(`\n📬 Starting ${type} notifications for schedule ${scheduleId}...`);

    const [studentResults, facultyResults] = await Promise.allSettled([
      notifyStudents(scheduleId, type),
      notifyFaculty(scheduleId, type)
    ]);

    const studentStats = studentResults.status === 'fulfilled' 
      ? studentResults.value 
      : { sent: 0, failed: 0, total: 0 };
    
    const facultyStats = facultyResults.status === 'fulfilled' 
      ? facultyResults.value 
      : { sent: 0, failed: 0, total: 0 };

    const summary = {
      students: studentStats,
      faculty: facultyStats,
      total: {
        sent: studentStats.sent + facultyStats.sent,
        failed: studentStats.failed + facultyStats.failed,
        recipients: studentStats.total + facultyStats.total
      }
    };

    console.log('\n📊 Notification Summary:');
    console.log(`  Students: ${studentStats.sent}/${studentStats.total} sent`);
    console.log(`  Faculty: ${facultyStats.sent}/${facultyStats.total} sent`);
    console.log(`  Total: ${summary.total.sent}/${summary.total.recipients} notifications sent\n`);

    return summary;
  } catch (error) {
    console.error('Error in notifyScheduleChange:', error);
    throw error;
  }
};

/**
 * Get enrolled students for a class space
 */
const getEnrolledStudents = async (classSpaceId) => {
  try {
    const ClassSpace = require('../models/ClassSpace.model');
    
    console.log(`🔍 Fetching enrolled students for classSpace: ${classSpaceId}`);
    
    const classSpace = await ClassSpace.findById(classSpaceId)
      .populate({
        path: 'enrolledStudents.student',
        populate: { path: 'user', select: 'email firstName lastName' }
      })
      .lean();

    if (!classSpace) {
      console.log('❌ ClassSpace not found');
      return [];
    }

    if (!classSpace.enrolledStudents || classSpace.enrolledStudents.length === 0) {
      console.log('⚠️  No enrolledStudents array or empty array');
      return [];
    }

    console.log(`📝 Found ${classSpace.enrolledStudents.length} enrolled student entries`);

    const validStudents = classSpace.enrolledStudents
      .filter(entry => {
        if (!entry.student) {
          console.log('⚠️  Entry has no student reference');
          return false;
        }
        if (!entry.student.user) {
          console.log('⚠️  Student has no user reference');
          return false;
        }
        if (!entry.student.user.email) {
          console.log(`⚠️  User has no email: ${entry.student.user.firstName} ${entry.student.user.lastName}`);
          return false;
        }
        return true;
      })
      .map(entry => ({
        user: entry.student.user,
        studentType: entry.studentType
      }));

    console.log(`✅ ${validStudents.length} students with valid emails found`);
    
    return validStudents;
  } catch (error) {
    console.error('❌ Error fetching enrolled students:', error);
    return [];
  }
};

/**
 * Notify students about new announcement
 */
const notifyAnnouncement = async (classSpaceId, announcementId) => {
  try {
    const ClassSpace = require('../models/ClassSpace.model');
    
    const classSpace = await ClassSpace.findById(classSpaceId)
      .populate('subject', 'subjectCode subjectName')
      .populate('announcements.postedBy', 'firstName lastName')
      .populate('materials.uploadedBy', 'firstName lastName')
      .lean();

    if (!classSpace) {
      throw new Error('Class space not found');
    }

    const announcement = classSpace.announcements.find(a => 
      a._id.toString() === announcementId.toString()
    );

    if (!announcement) {
      throw new Error('Announcement not found');
    }

    // Get enrolled students
    const students = await getEnrolledStudents(classSpaceId);

    if (students.length === 0) {
      console.log('⚠️  No enrolled students found for this class');
      return { sent: 0, failed: 0, total: 0 };
    }

    console.log(`📧 Sending announcement notifications to ${students.length} students...`);

    const classData = {
      subjectCode: classSpace.subject?.subjectCode || classSpace.subjectCode || 'N/A',
      subjectName: classSpace.subject?.subjectName || '',
      sectionCode: classSpace.sectionCode || 'N/A'
    };

    const results = await Promise.allSettled(
      students.map((student) => sendEmail(
        student.user.email,
        announcementEmail(announcement, classData, personName(student.user)),
        null,
        { preference: 'classPosts' }
      ))
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;

    console.log(`✅ Announcement notifications: ${sent} sent, ${failed} failed`);

    return { sent, failed, total: students.length };
  } catch (error) {
    console.error('Error notifying announcement:', error);
    throw error;
  }
};

/**
 * Notify students about new material
 */
const notifyMaterial = async (classSpaceId, materialId) => {
  try {
    const ClassSpace = require('../models/ClassSpace.model');
    
    const classSpace = await ClassSpace.findById(classSpaceId)
      .populate('subject', 'subjectCode subjectName')
      .populate('announcements.postedBy', 'firstName lastName')
      .populate('materials.uploadedBy', 'firstName lastName')
      .lean();

    if (!classSpace) {
      throw new Error('Class space not found');
    }

    const material = classSpace.materials.find(m => 
      m._id.toString() === materialId.toString()
    );

    if (!material) {
      throw new Error('Material not found');
    }

    // Get enrolled students
    const students = await getEnrolledStudents(classSpaceId);

    if (students.length === 0) {
      console.log('⚠️  No enrolled students found for this class');
      return { sent: 0, failed: 0, total: 0 };
    }

    console.log(`📧 Sending material notifications to ${students.length} students...`);

    const classData = {
      subjectCode: classSpace.subject?.subjectCode || classSpace.subjectCode || 'N/A',
      subjectName: classSpace.subject?.subjectName || '',
      sectionCode: classSpace.sectionCode || 'N/A'
    };

    const results = await Promise.allSettled(
      students.map((student) => sendEmail(
        student.user.email,
        materialEmail(material, classData, personName(student.user)),
        null,
        { preference: 'classPosts' }
      ))
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;

    console.log(`✅ Material notifications: ${sent} sent, ${failed} failed`);

    return { sent, failed, total: students.length };
  } catch (error) {
    console.error('Error notifying material:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  notifyStudents,
  notifyFaculty,
  notifyScheduleChange,
  notifyAnnouncement,
  notifyMaterial,
  // For previews and tests
  scheduleEmail,
  announcementEmail,
  materialEmail,
};
