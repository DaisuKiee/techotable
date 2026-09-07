const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Send verification email
const sendVerificationEmail = async (email, token, firstName) => {
  // Development mode: Log to console instead of sending email
  if (process.env.NODE_ENV === 'development' && process.env.EMAIL_CONSOLE_MODE === 'true') {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${token}`;
    
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  📧 EMAIL VERIFICATION LINK (Development Mode)                ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  To: ${email.padEnd(53)}║`);
    console.log(`║  Name: ${firstName.padEnd(51)}║`);
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║  VERIFICATION LINK:                                           ║');
    console.log(`║  ${verificationUrl.padEnd(59)}║`);
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║  👉 Copy the link above and paste it in your browser          ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    
    return { success: true, messageId: 'console-dev-mode' };
  }
  
  // Production mode: Send actual email
  try {
    const transporter = createTransporter();
    
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${token}`;
    
    const mailOptions = {
      from: `"CTU Daanbantayan Timetabling" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - CTU Daanbantayan',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 8px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #6b7280;
              font-size: 12px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🎓 CTU Daanbantayan</div>
              <h2>Smart Timetabling System</h2>
            </div>
            <div class="content">
              <h2>Welcome, ${firstName}!</h2>
              <p>Thank you for creating an account with CTU Daanbantayan Smart Timetabling System.</p>
              <p>To complete your registration and verify your email address, please click the button below:</p>
              
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="background: white; padding: 10px; border-radius: 5px; word-break: break-all;">
                ${verificationUrl}
              </p>
              
              <p><strong>This link will expire in 24 hours.</strong></p>
              
              <p>If you didn't create this account, please ignore this email.</p>
              
              <div class="footer">
                <p>© 2026 Cebu Technological University - Daanbantayan Campus</p>
                <p>Smart Timetabling System</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, token, firstName) => {
  // Development mode: Log to console instead of sending email
  if (process.env.NODE_ENV === 'development' && process.env.EMAIL_CONSOLE_MODE === 'true') {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;
    
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  🔒 PASSWORD RESET LINK (Development Mode)                   ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  To: ${email.padEnd(53)}║`);
    console.log(`║  Name: ${firstName.padEnd(51)}║`);
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║  RESET LINK (expires in 10 minutes):                         ║');
    console.log(`║  ${resetUrl.padEnd(59)}║`);
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║  👉 Copy the link above and paste it in your browser          ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    
    return { success: true, messageId: 'console-dev-mode' };
  }

  // Production mode: Send actual email
  try {
    const transporter = createTransporter();
    
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;
    
    const mailOptions = {
      from: `"CTU Daanbantayan Timetabling" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request - CTU Daanbantayan',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 8px;
              margin: 20px 0;
              font-weight: bold;
            }
            .warning {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 5px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">🎓 CTU Daanbantayan</div>
              <h2>Password Reset Request</h2>
            </div>
            <div class="content">
              <h2>Hello, ${firstName}</h2>
              <p>We received a request to reset your password for your CTU Daanbantayan account.</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="background: white; padding: 10px; border-radius: 5px; word-break: break-all;">
                ${resetUrl}
              </p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong><br>
                This link will expire in 10 minutes. If you didn't request a password reset, please ignore this email and ensure your account is secure.
              </div>
              
              <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
                © 2026 Cebu Technological University - Daanbantayan Campus
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

// Send welcome email after verification
const sendWelcomeEmail = async (email, firstName) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"CTU Daanbantayan Timetabling" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to CTU Daanbantayan! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #3b82f6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div style="font-size: 24px; font-weight: bold;">🎓 CTU Daanbantayan</div>
              <h2>Welcome Aboard!</h2>
            </div>
            <div class="content">
              <h2>Hi ${firstName},</h2>
              <p>🎉 Your email has been verified successfully! Welcome to CTU Daanbantayan Smart Timetabling System.</p>
              
              <h3>What's Next?</h3>
              <div class="feature">
                <strong>📅 View Your Schedule</strong><br>
                Access your personalized class schedule anytime, anywhere.
              </div>
              <div class="feature">
                <strong>🔔 Get Notifications</strong><br>
                Receive instant updates about schedule changes.
              </div>
              <div class="feature">
                <strong>👥 Connect</strong><br>
                Stay connected with your classmates and instructors.
              </div>
              
              <p>If you have any questions, feel free to contact our support team.</p>
              <p>Happy scheduling!</p>
              
              <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
                © 2026 Cebu Technological University - Daanbantayan Campus
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
};
