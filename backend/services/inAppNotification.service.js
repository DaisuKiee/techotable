/**
 * In-App Notification Service
 * 
 * Creates in-app notifications for users alongside email notifications
 */

const Notification = require('../models/Notification.model');

/**
 * Create notification for users
 */
const createNotification = async (recipients, notificationData) => {
  try {
    if (!Array.isArray(recipients)) {
      recipients = [recipients];
    }

    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      ...notificationData
    }));

    await Notification.insertMany(notifications);
    console.log(`✅ Created ${notifications.length} in-app notifications`);
    
    return { success: true, count: notifications.length };
  } catch (error) {
    console.error('❌ Error creating notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify about schedule changes
 */
const notifyScheduleChange = async (scheduleId, type) => {
  try {
    const Schedule = require('../models/Schedule.model');
    const Student = require('../models/Student.model');
    const Faculty = require('../models/Faculty.model');
    
    const schedule = await Schedule.findById(scheduleId)
      .populate('subject', 'subjectCode subjectName')
      .populate('faculty', 'user')
      .lean();

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const recipients = [];

    // Get students in the section
    const students = await Student.find({ sectionCode: schedule.sectionCode })
      .populate('user', '_id')
      .lean();
    recipients.push(...students.map(s => s.user._id));

    // Add faculty member
    if (schedule.faculty?.user) {
      recipients.push(schedule.faculty.user);
    }

    const subjectCode = schedule.subject?.subjectCode || 'Subject';
    const actionText = type === 'published' ? 'published' : 'updated';
    
    await createNotification(recipients, {
      type: 'schedule',
      title: `Schedule ${actionText}`,
      message: `${subjectCode} schedule has been ${actionText}`,
      link: '/schedule',
      metadata: {
        icon: '📅',
        color: 'blue',
        subjectCode: subjectCode
      },
      relatedResource: {
        resourceType: 'Schedule',
        resourceId: scheduleId
      }
    });

    return { success: true, recipients: recipients.length };
  } catch (error) {
    console.error('Error notifying schedule change:', error);
    throw error;
  }
};

/**
 * Notify about new announcement
 */
const notifyAnnouncementCreated = async (classSpaceId, announcementId) => {
  try {
    const ClassSpace = require('../models/ClassSpace.model');
    
    const classSpace = await ClassSpace.findById(classSpaceId)
      .populate('subject', 'subjectCode subjectName')
      .populate({
        path: 'enrolledStudents.student',
        populate: { path: 'user', select: '_id' }
      })
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

    const recipients = classSpace.enrolledStudents
      .filter(e => e.student?.user?._id)
      .map(e => e.student.user._id);

    if (recipients.length === 0) {
      console.log('⚠️  No enrolled students to notify');
      return { success: true, recipients: 0 };
    }

    const subjectCode = classSpace.subject?.subjectCode || classSpace.subjectCode || 'Class';
    
    await createNotification(recipients, {
      type: 'announcement',
      title: `New Announcement in ${subjectCode}`,
      message: announcement.title || 'New announcement posted',
      link: `/classes`,
      metadata: {
        icon: '📢',
        color: 'purple',
        subjectCode: subjectCode,
        className: classSpace.subject?.subjectName || ''
      },
      relatedResource: {
        resourceType: 'ClassSpace',
        resourceId: classSpaceId
      }
    });

    return { success: true, recipients: recipients.length };
  } catch (error) {
    console.error('Error notifying announcement:', error);
    throw error;
  }
};

/**
 * Notify about new material
 */
const notifyMaterialUploaded = async (classSpaceId, materialId) => {
  try {
    const ClassSpace = require('../models/ClassSpace.model');
    
    const classSpace = await ClassSpace.findById(classSpaceId)
      .populate('subject', 'subjectCode subjectName')
      .populate({
        path: 'enrolledStudents.student',
        populate: { path: 'user', select: '_id' }
      })
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

    const recipients = classSpace.enrolledStudents
      .filter(e => e.student?.user?._id)
      .map(e => e.student.user._id);

    if (recipients.length === 0) {
      console.log('⚠️  No enrolled students to notify');
      return { success: true, recipients: 0 };
    }

    const subjectCode = classSpace.subject?.subjectCode || classSpace.subjectCode || 'Class';
    
    await createNotification(recipients, {
      type: 'material',
      title: `New Material in ${subjectCode}`,
      message: material.title || 'New material uploaded',
      link: `/classes`,
      metadata: {
        icon: '📎',
        color: 'green',
        subjectCode: subjectCode,
        className: classSpace.subject?.subjectName || ''
      },
      relatedResource: {
        resourceType: 'ClassSpace',
        resourceId: classSpaceId
      }
    });

    return { success: true, recipients: recipients.length };
  } catch (error) {
    console.error('Error notifying material:', error);
    throw error;
  }
};

module.exports = {
  createNotification,
  notifyScheduleChange,
  notifyAnnouncementCreated,
  notifyMaterialUploaded
};
