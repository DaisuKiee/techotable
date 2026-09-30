/**
 * Email Notification Service
 * 
 * Handles sending email notifications for schedule updates
 * to students and faculty members
 */

const nodemailer = require('nodemailer');
const Student = require('../models/Student.model');
const Faculty = require('../models/Faculty.model');
const Schedule = require('../models/Schedule.model');

// Create reusable transporter
let transporter = null;

const createTransporter = () => {
  if (transporter) return transporter;

  const consoleMode = process.env.EMAIL_CONSOLE_MODE === 'true';

  if (consoleMode) {
    console.log('📧 Email Console Mode: Emails will be logged to console');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  return transporter;
};

/**
 * Send email notification
 */
const sendEmail = async (to, subject, html) => {
  try {
    const consoleMode = process.env.EMAIL_CONSOLE_MODE === 'true';

    if (consoleMode) {
      console.log('\n📧 ===== EMAIL NOTIFICATION =====');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log('HTML Content:');
      console.log(html);
      console.log('================================\n');
      return { success: true, mode: 'console' };
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `CTU Daanbantayan Schedule System <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate HTML template for schedule notification
 */
const generateScheduleEmailHTML = (type, scheduleData, recipientName) => {
  const { subject, section, faculty, timeSlots, room, academicYear, semester } = scheduleData;
  
  const actionText = type === 'published' 
    ? 'has been published' 
    : 'has been updated';
  
  const actionColor = type === 'published' 
    ? '#10b981' 
    : '#f59e0b';

  const timeSlotsHTML = timeSlots && timeSlots.length > 0
    ? timeSlots.map(ts => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
            <strong>${ts.day}</strong>
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
            ${ts.startTime} - ${ts.endTime}
          </td>
        </tr>
      `).join('')
    : '<tr><td colspan="2" style="padding: 8px; text-align: center;">No time slots specified</td></tr>';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Schedule ${type === 'published' ? 'Published' : 'Updated'}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">📅 Schedule ${type === 'published' ? 'Published' : 'Update'}</h1>
      </div>

      <!-- Content -->
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${recipientName}</strong>,</p>
        
        <div style="background: ${actionColor}15; border-left: 4px solid ${actionColor}; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: ${actionColor}; font-weight: bold;">
            📢 A schedule ${actionText}
          </p>
        </div>

        <!-- Schedule Details -->
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #667eea; margin-top: 0; font-size: 20px;">Schedule Details</h2>
          
          <table style="width: 100%; margin-top: 15px;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 40%;"><strong>Subject:</strong></td>
              <td style="padding: 8px 0;">
                <strong style="color: #111827;">${subject?.subjectCode || 'N/A'}</strong><br/>
                <span style="color: #6b7280; font-size: 14px;">${subject?.subjectName || ''}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;"><strong>Section:</strong></td>
              <td style="padding: 8px 0; color: #111827;">${section?.sectionCode || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;"><strong>Faculty:</strong></td>
              <td style="padding: 8px 0; color: #111827;">${faculty?.user?.firstName || ''} ${faculty?.user?.lastName || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;"><strong>Room:</strong></td>
              <td style="padding: 8px 0; color: #111827;">${room?.roomNumber || 'N/A'} ${room?.building ? `(${room.building})` : ''}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;"><strong>Academic Year:</strong></td>
              <td style="padding: 8px 0; color: #111827;">${academicYear || 'N/A'}, Semester ${semester || 'N/A'}</td>
            </tr>
          </table>

          <!-- Time Slots -->
          <h3 style="color: #667eea; margin-top: 20px; margin-bottom: 10px; font-size: 18px;">📅 Schedule Time</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 10px; text-align: left; color: #374151; border-bottom: 2px solid #e5e7eb;">Day</th>
                <th style="padding: 10px; text-align: left; color: #374151; border-bottom: 2px solid #e5e7eb;">Time</th>
              </tr>
            </thead>
            <tbody>
              ${timeSlotsHTML}
            </tbody>
          </table>
        </div>

        <!-- Call to Action -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/schedules" 
             style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            View Full Schedule
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">
          Please check your schedule regularly for any updates.
        </p>

        <p style="font-size: 14px; color: #6b7280;">
          Best regards,<br/>
          <strong>CTU Daanbantayan Scheduling System</strong>
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 20px; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>This is an automated notification. Please do not reply to this email.</p>
        <p>© ${new Date().getFullYear()} CTU Daanbantayan. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate HTML template for announcement notification
 */
const generateAnnouncementEmailHTML = (announcementData, classData, recipientName) => {
  const { title, content, postedBy } = announcementData;
  const { subjectCode, subjectName, sectionCode } = classData;
  const facultyName = `${postedBy?.firstName || ''} ${postedBy?.lastName || 'Faculty'}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Announcement</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">📢 New Announcement</h1>
      </div>

      <!-- Content -->
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${recipientName}</strong>,</p>
        
        <div style="background: #3b82f615; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: #3b82f6; font-weight: bold;">
            📣 New announcement in ${subjectCode}
          </p>
        </div>

        <!-- Class Info -->
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%;">
            <tr>
              <td style="padding: 4px 0; color: #6b7280; width: 30%;"><strong>Class:</strong></td>
              <td style="padding: 4px 0; color: #111827;">
                <strong>${subjectCode}</strong> - ${subjectName}
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;"><strong>Section:</strong></td>
              <td style="padding: 4px 0; color: #111827;">${sectionCode}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;"><strong>Posted by:</strong></td>
              <td style="padding: 4px 0; color: #111827;">${facultyName}</td>
            </tr>
          </table>
        </div>

        <!-- Announcement Content -->
        <div style="background: #ffffff; border: 2px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #1e40af; margin-top: 0; font-size: 20px; margin-bottom: 15px;">${title}</h2>
          <div style="color: #374151; font-size: 15px; line-height: 1.8; white-space: pre-wrap;">${content}</div>
        </div>

        <!-- Call to Action -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/class-spaces" 
             style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            View in Class Space
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="font-size: 14px; color: #6b7280;">
          Best regards,<br/>
          <strong>CTU Daanbantayan Scheduling System</strong>
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 20px; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>This is an automated notification. Please do not reply to this email.</p>
        <p>© ${new Date().getFullYear()} CTU Daanbantayan. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate HTML template for material notification
 */
const generateMaterialEmailHTML = (materialData, classData, recipientName) => {
  const { title, description, fileName, uploadedBy } = materialData;
  const { subjectCode, subjectName, sectionCode } = classData;
  const facultyName = `${uploadedBy?.firstName || ''} ${uploadedBy?.lastName || 'Faculty'}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Material Uploaded</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">📎 New Material Uploaded</h1>
      </div>

      <!-- Content -->
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${recipientName}</strong>,</p>
        
        <div style="background: #10b98115; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: #10b981; font-weight: bold;">
            📚 New material uploaded in ${subjectCode}
          </p>
        </div>

        <!-- Class Info -->
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%;">
            <tr>
              <td style="padding: 4px 0; color: #6b7280; width: 30%;"><strong>Class:</strong></td>
              <td style="padding: 4px 0; color: #111827;">
                <strong>${subjectCode}</strong> - ${subjectName}
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;"><strong>Section:</strong></td>
              <td style="padding: 4px 0; color: #111827;">${sectionCode}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;"><strong>Uploaded by:</strong></td>
              <td style="padding: 4px 0; color: #111827;">${facultyName}</td>
            </tr>
          </table>
        </div>

        <!-- Material Details -->
        <div style="background: #ffffff; border: 2px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
              <span style="color: white; font-size: 24px;">📄</span>
            </div>
            <div>
              <h2 style="color: #047857; margin: 0; font-size: 18px;">${title}</h2>
              <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 13px;">${fileName || 'File'}</p>
            </div>
          </div>
          ${description ? `<p style="color: #374151; font-size: 14px; margin-top: 15px;">${description}</p>` : ''}
        </div>

        <!-- Call to Action -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/class-spaces" 
             style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Download Material
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="font-size: 14px; color: #6b7280;">
          Best regards,<br/>
          <strong>CTU Daanbantayan Scheduling System</strong>
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 20px; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>This is an automated notification. Please do not reply to this email.</p>
        <p>© ${new Date().getFullYear()} CTU Daanbantayan. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
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
    const schedule = await Schedule.findById(scheduleId)
      .populate('subject', 'subjectCode subjectName')
      .populate('section', 'sectionCode')
      .populate('faculty')
      .populate({
        path: 'faculty',
        populate: { path: 'user', select: 'firstName lastName' }
      })
      .populate('room', 'roomNumber building')
      .lean();

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    // Get students for this section
    const students = await getStudentsForSection(
      schedule.section?.sectionCode,
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
      students.map(student => {
        const studentName = `${student.user.firstName} ${student.user.lastName}`;
        const html = generateScheduleEmailHTML(type, schedule, studentName);
        const subject = type === 'published' 
          ? `📅 New Schedule Published - ${schedule.subject?.subjectCode || 'Schedule'}`
          : `🔄 Schedule Updated - ${schedule.subject?.subjectCode || 'Schedule'}`;
        
        return sendEmail(student.user.email, subject, html);
      })
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
 * Notify faculty about schedule changes
 */
const notifyFaculty = async (scheduleId, type = 'published') => {
  try {
    const schedule = await Schedule.findById(scheduleId)
      .populate('subject', 'subjectCode subjectName')
      .populate('section', 'sectionCode')
      .populate('faculty')
      .populate({
        path: 'faculty',
        populate: { path: 'user', select: 'firstName lastName email' }
      })
      .populate('room', 'roomNumber building')
      .lean();

    if (!schedule || !schedule.faculty || !schedule.faculty.user || !schedule.faculty.user.email) {
      console.log('⚠️  No faculty email found for this schedule');
      return { sent: 0, failed: 0 };
    }

    const facultyName = `${schedule.faculty.user.firstName} ${schedule.faculty.user.lastName}`;
    const html = generateScheduleEmailHTML(type, schedule, facultyName);
    const subject = type === 'published' 
      ? `📅 New Schedule Published - ${schedule.subject?.subjectCode || 'Schedule'}`
      : `🔄 Your Schedule Has Been Updated - ${schedule.subject?.subjectCode || 'Schedule'}`;

    console.log(`📧 Sending notification to faculty: ${schedule.faculty.user.email}`);

    const result = await sendEmail(schedule.faculty.user.email, subject, html);

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
      students.map(student => {
        const studentName = `${student.user.firstName} ${student.user.lastName}`;
        const html = generateAnnouncementEmailHTML(announcement, classData, studentName);
        const subject = `📢 New Announcement in ${classData.subjectCode}`;
        
        return sendEmail(student.user.email, subject, html);
      })
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
      students.map(student => {
        const studentName = `${student.user.firstName} ${student.user.lastName}`;
        const html = generateMaterialEmailHTML(material, classData, studentName);
        const subject = `📎 New Material in ${classData.subjectCode}`;
        
        return sendEmail(student.user.email, subject, html);
      })
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
  notifyMaterial
};
