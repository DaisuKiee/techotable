const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { sendError, AppError, sendValidationErrors } = require('../middleware/error.middleware');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const { email, password, role, firstName, lastName, middleName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Validate role
    const validRoles = ['admin', 'scheduling_officer', 'faculty', 'student'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      role: role || 'student',
      firstName,
      lastName,
      middleName
    });

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    sendError(res, error, 'Error registering user');
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const { email, password } = req.body;

    // Check if user exists and include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('facultyProfile');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact administration.'
      });
    }

    // Check if email is verified (only for students)
    if (user.role === 'student' && !user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in. Check your inbox for the verification link.'
      });
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    sendError(res, error, 'Error logging in');
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('facultyProfile')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    sendError(res, error, 'Error fetching user data');
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, middleName, profilePicture, shift } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (middleName !== undefined) user.middleName = middleName;
    if (profilePicture) user.profilePicture = profilePicture;
    if (shift !== undefined) user.shift = shift;

    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });

  } catch (error) {
    sendError(res, error, 'Error updating profile');
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordMatch = await user.comparePassword(currentPassword);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    sendError(res, error, 'Error changing password');
  }
};

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    sendError(res, error, 'Error logging out');
  }
};

// @desc    Update user settings
// @route   PUT /api/auth/settings
// @access  Private
exports.updateSettings = async (req, res) => {
  try {
    const { notifications, appearance, privacy } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize settings if not exists
    if (!user.settings) {
      user.settings = {
        notifications: {},
        appearance: {},
        privacy: {}
      };
    }

    // Update notifications settings
    if (notifications) {
      user.settings.notifications = {
        ...user.settings.notifications,
        ...notifications
      };
    }

    // Update appearance settings
    if (appearance) {
      user.settings.appearance = {
        ...user.settings.appearance,
        ...appearance
      };
    }

    // Update privacy settings
    if (privacy) {
      user.settings.privacy = {
        ...user.settings.privacy,
        ...privacy
      };
    }

    user.markModified('settings');
    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: updatedUser
    });

  } catch (error) {
    sendError(res, error, 'Error updating settings');
  }
};

// @desc    Get user settings
// @route   GET /api/auth/settings
// @access  Private
exports.getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('settings');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return default settings if not set
    const defaultSettings = {
      notifications: {
        emailNotifications: true,
        scheduleUpdates: true,
        facultyAssignments: true,
        systemAlerts: true,
        weeklyDigest: false
      },
      appearance: {
        theme: 'light',
        language: 'en',
        timezone: 'Asia/Manila'
      },
      privacy: {
        profileVisibility: 'public',
        showEmail: false,
        showPhone: false,
        allowMessages: true
      }
    };

    const settings = user.settings || defaultSettings;

    res.status(200).json({
      success: true,
      data: settings
    });

  } catch (error) {
    sendError(res, error, 'Error fetching settings');
  }
};


// @desc    Register student with email verification
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      studentId,
      program
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Check if student ID already exists
    if (studentId) {
      const existingStudentId = await User.findOne({ studentId });
      if (existingStudentId) {
        return res.status(400).json({
          success: false,
          message: 'This student ID is already registered'
        });
      }
    }

    // Generate verification token
    const { generateVerificationToken, sendVerificationEmail } = require('../services/emailService');
    const verificationToken = generateVerificationToken();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user (unverified)
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      role: 'student',
      firstName,
      lastName,
      studentId,
      program,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: tokenExpiry
    });

    // Create corresponding Student record for Student Management page
    // Student will be assigned to section later by program manager
    const Student = require('../models/Student.model');
    await Student.create({
      user: user._id,
      studentId: studentId,
      program: program,
      studentType: null, // Will be determined when student enrolls (regular=section, irregular=subjects)
      academicYear: '2024-2025',
      semester: 1,
      enrollmentStatus: 'not_enrolled', // Changed from 'enrolled' - will be enrolled when assigned to section
      sectionCode: null, // Will be assigned by program manager
      subjectCodes: [] // Empty for regular students, filled for irregular students
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(
      user.email,
      verificationToken,
      user.firstName
    );

    if (!emailResult.success) {
      // Still create account but notify about email failure
      console.error('Failed to send verification email:', emailResult.error);
    }

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Please check your email to verify your account.',
      data: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailSent: emailResult.success
      }
    });

  } catch (error) {
    sendError(res, error, 'Error creating account');
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    // Find user with valid token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Update user
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    // Send welcome email
    const { sendWelcomeEmail } = require('../services/emailService');
    await sendWelcomeEmail(user.email, user.firstName);

    // Generate JWT token for automatic login
    const jwtToken = generateToken(user._id);

    res.json({
      success: true,
      message: 'Email verified successfully! Welcome to CTU Daanbantayan.',
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      }
    });

  } catch (error) {
    sendError(res, error, 'Error verifying email');
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new token
    const { generateVerificationToken, sendVerificationEmail } = require('../services/emailService');
    const verificationToken = generateVerificationToken();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = tokenExpiry;
    await user.save();

    // Send email
    const emailResult = await sendVerificationEmail(
      user.email,
      verificationToken,
      user.firstName
    );

    if (!emailResult.success) {
      return sendError(res, new AppError('We could not send the verification email. Please try again in a few minutes.', 502));
    }

    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });

  } catch (error) {
    sendError(res, error, 'Error resending verification email');
  }
};

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success message for security (don't reveal if email exists)
    // But only send email if user exists
    if (user) {
      // Generate reset token
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Hash token before saving
      const hashedToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
      
      // Set token and expiry (10 minutes)
      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      // Send email with original (unhashed) token
      const { sendPasswordResetEmail } = require('../services/emailService');
      const emailResult = await sendPasswordResetEmail(
        user.email,
        resetToken, // Send unhashed token in email
        user.firstName
      );

      if (!emailResult.success) {
        // Clear the token if email fails
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        await user.save();
        
        console.error('Failed to send password reset email:', emailResult.error);
        return sendError(res, new AppError('We could not send the password reset email. Please try again in a few minutes.', 502));
      }
    }

    // Always return success for security
    res.json({
      success: true,
      message: 'If a matching account was found, a password reset link has been sent to your email.'
    });

  } catch (error) {
    sendError(res, error, 'Error processing password reset request');
  }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a new password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Hash the token from URL to compare with database
    const crypto = require('crypto');
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token'
      });
    }

    // Update password and clear reset fields
    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });

  } catch (error) {
    sendError(res, error, 'Error resetting password');
  }
};

// @desc    Faculty Signup (Public - Pending Approval)
// @route   POST /api/auth/faculty-signup
// @access  Public
/*
 * Faculty invite links.
 *
 * Faculty sign-up used to be a public page: anyone who found /faculty-signup
 * could register, and the "expires in 48 hours" shown next to the link was
 * only a label. Now the scheduling office issues a signed, expiring invite
 * token, and faculty sign-up is refused without a valid one.
 *
 * Signed with JWT_SECRET but tagged with a purpose, so a login token can't be
 * passed off as an invite (or the other way round - login tokens carry `id`).
 */
const FACULTY_INVITE = 'faculty-invite';
const MAX_INVITE_HOURS = 24 * 14;

const readFacultyInvite = (token) => {
  if (!token) return { ok: false, reason: 'missing' };
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.purpose === FACULTY_INVITE
      ? { ok: true, expiresAt: new Date(payload.exp * 1000) }
      : { ok: false, reason: 'invalid' };
  } catch (err) {
    return { ok: false, reason: err.name === 'TokenExpiredError' ? 'expired' : 'invalid' };
  }
};

const INVITE_MESSAGES = {
  missing: 'Faculty accounts can only be created from an invite link. Ask your scheduling office for one.',
  invalid: 'This invite link is not valid. Ask your scheduling office for a new one.',
  expired: 'This invite link has expired. Ask your scheduling office for a new one.',
};

// @desc    Create a faculty invite link token
// @route   POST /api/auth/faculty-invite
// @access  Private (admin, scheduling officer)
exports.createFacultyInvite = async (req, res) => {
  const hours = Math.min(MAX_INVITE_HOURS, Math.max(1, parseInt(req.body?.hours, 10) || 48));
  const token = jwt.sign(
    { purpose: FACULTY_INVITE, by: String(req.user._id) },
    process.env.JWT_SECRET,
    { expiresIn: `${hours}h` }
  );
  res.status(201).json({
    success: true,
    data: { token, hours, expiresAt: new Date(jwt.decode(token).exp * 1000) },
  });
};

// @desc    Check an invite before showing the faculty sign-up form
// @route   GET /api/auth/faculty-invite/:token
// @access  Public
exports.checkFacultyInvite = async (req, res) => {
  const invite = readFacultyInvite(req.params.token);
  if (!invite.ok) {
    return res.status(400).json({ success: false, reason: invite.reason, message: INVITE_MESSAGES[invite.reason] });
  }
  res.json({ success: true, data: { expiresAt: invite.expiresAt } });
};

exports.facultySignup = async (req, res) => {
  try {
    const { name, email, password, department, qualification, specialization, invite } = req.body;

    const access = readFacultyInvite(invite);
    if (!access.ok) {
      return res.status(403).json({ success: false, reason: access.reason, message: INVITE_MESSAGES[access.reason] });
    }

    // Validate required fields
    if (!name || !email || !password || !department || !qualification) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, password, department, and qualification'
      });
    }

    // Faculty.department is an enum; free text used to fail validation
    const FACULTY_DEPARTMENTS = ['CoTE', 'Other'];
    if (!FACULTY_DEPARTMENTS.includes(department)) {
      return res.status(400).json({
        success: false,
        message: `Department must be one of: ${FACULTY_DEPARTMENTS.join(', ')}`
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Split name into firstName, middleName, lastName
    const nameParts = name.trim().split(' ');
    let firstName, middleName, lastName;
    
    if (nameParts.length === 1) {
      firstName = nameParts[0];
      lastName = nameParts[0]; // Use same as first name if only one name provided
    } else if (nameParts.length === 2) {
      firstName = nameParts[0];
      lastName = nameParts[1];
    } else {
      firstName = nameParts[0];
      lastName = nameParts[nameParts.length - 1];
      middleName = nameParts.slice(1, -1).join(' ');
    }

    // Create pending faculty user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      role: 'faculty',
      firstName,
      lastName,
      middleName,
      isPending: true,
      pendingApprovalDate: new Date(),
      isActive: false // Inactive until approved
    });

    /*
     * The profile used to be created with fields this schema doesn't have
     * (userId, name, qualification) and without the ones it requires (user,
     * employeeId, position), so EVERY faculty sign-up failed validation here -
     * after the login above had been created. The applicant saw an error, and
     * retrying said "email already exists".
     */
    const Faculty = require('../models/Faculty.model');
    // "MS in Information Technology" -> degree "MS", field "Information Technology"
    const [degreePart, ...fieldParts] = String(qualification).trim().split(/\s+in\s+/i);
    let facultyProfile;
    try {
      facultyProfile = await Faculty.create({
        user: user._id,
        // Placeholder until the scheduling office sets the real one (editable)
        employeeId: `PENDING-${user._id.toString().slice(-6).toUpperCase()}`,
        department,
        position: 'Instructor',
        qualifications: [{
          degree: degreePart || String(qualification).trim(),
          field: fieldParts.join(' in ') || 'Not specified',
        }],
        specializations: String(specialization || '')
          .split(',').map((x) => x.trim()).filter(Boolean),
        isActive: false // Inactive until approved
      });
    } catch (profileError) {
      // Don't leave a login behind that blocks the applicant from retrying
      await User.deleteOne({ _id: user._id });
      throw profileError;
    }

    // Link faculty profile to user
    user.facultyProfile = facultyProfile._id;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Faculty registration successful! Your account is pending approval. You will receive an email once approved.',
      data: {
        userId: user._id,
        email: user.email,
        name: user.fullName,
        isPending: true
      }
    });

  } catch (error) {
    sendError(res, error, 'Error registering faculty account');
  }
};
