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
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              background-color: #f3f4f6;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              margin-bottom: 8px;
            }
            .header h1 {
              font-size: 24px;
              font-weight: 600;
              margin: 0;
            }
            .content {
              padding: 40px 30px;
              background: white;
            }
            .greeting {
              font-size: 20px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 16px;
            }
            .text {
              font-size: 16px;
              color: #4b5563;
              margin-bottom: 24px;
            }
            .button-container {
              text-align: center;
              margin: 32px 0;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white !important;
              padding: 14px 40px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
              transition: transform 0.2s;
            }
            .button:hover {
              transform: translateY(-2px);
            }
            .link-container {
              margin: 24px 0;
            }
            .link-label {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 8px;
            }
            .link-box {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              padding: 12px;
              border-radius: 6px;
              word-break: break-all;
              font-size: 13px;
              color: #3b82f6;
            }
            .info-box {
              background: #dbeafe;
              border-left: 4px solid #3b82f6;
              padding: 16px;
              margin: 24px 0;
              border-radius: 6px;
            }
            .info-box strong {
              display: block;
              color: #1e3a8a;
              margin-bottom: 4px;
              font-size: 15px;
            }
            .info-box p {
              color: #1e40af;
              font-size: 14px;
              margin: 0;
            }
            .footer {
              text-align: center;
              padding: 24px 30px;
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              color: #6b7280;
              font-size: 13px;
              margin: 4px 0;
            }
            @media only screen and (max-width: 600px) {
              .container {
                border-radius: 0;
              }
              .content {
                padding: 24px 20px;
              }
              .header {
                padding: 30px 20px;
              }
              .button {
                padding: 12px 30px;
                font-size: 15px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🎓 CTU Daanbantayan</div>
              <h1>Email Verification</h1>
            </div>
            
            <div class="content">
              <div class="greeting">Welcome, ${firstName}!</div>
              
              <p class="text">
                Thank you for creating an account with CTU Daanbantayan Smart Timetabling System. To complete your registration and verify your email address, please click the button below:
              </p>
              
              <div class="button-container">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <div class="link-container">
                <p class="link-label">Or copy and paste this link into your browser:</p>
                <div class="link-box">${verificationUrl}</div>
              </div>
              
              <div class="info-box">
                <strong>⏱️ Important</strong>
                <p>This link will expire in 24 hours. If you didn't create this account, please ignore this email.</p>
              </div>
            </div>
            
            <div class="footer">
              <p><strong>Cebu Technological University</strong></p>
              <p>Daanbantayan Campus</p>
              <p style="margin-top: 12px;">© 2026 CTU Daanbantayan. All rights reserved.</p>
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
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              background-color: #f3f4f6;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              margin-bottom: 8px;
            }
            .header h1 {
              font-size: 24px;
              font-weight: 600;
              margin: 0;
            }
            .content {
              padding: 40px 30px;
              background: white;
            }
            .greeting {
              font-size: 20px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 16px;
            }
            .text {
              font-size: 16px;
              color: #4b5563;
              margin-bottom: 24px;
            }
            .button-container {
              text-align: center;
              margin: 32px 0;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white !important;
              padding: 14px 40px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
              transition: transform 0.2s;
            }
            .button:hover {
              transform: translateY(-2px);
            }
            .link-container {
              margin: 24px 0;
            }
            .link-label {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 8px;
            }
            .link-box {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              padding: 12px;
              border-radius: 6px;
              word-break: break-all;
              font-size: 13px;
              color: #3b82f6;
            }
            .warning {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 16px;
              margin: 24px 0;
              border-radius: 6px;
            }
            .warning strong {
              display: block;
              color: #92400e;
              margin-bottom: 4px;
              font-size: 15px;
            }
            .warning p {
              color: #78350f;
              font-size: 14px;
              margin: 0;
            }
            .footer {
              text-align: center;
              padding: 24px 30px;
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              color: #6b7280;
              font-size: 13px;
              margin: 4px 0;
            }
            @media only screen and (max-width: 600px) {
              .container {
                border-radius: 0;
              }
              .content {
                padding: 24px 20px;
              }
              .header {
                padding: 30px 20px;
              }
              .button {
                padding: 12px 30px;
                font-size: 15px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🎓 CTU Daanbantayan</div>
              <h1>Password Reset Request</h1>
            </div>
            
            <div class="content">
              <div class="greeting">Hello, ${firstName}!</div>
              
              <p class="text">
                We received a request to reset your password for your CTU Daanbantayan Smart Timetabling System account.
              </p>
              
              <div class="button-container">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <div class="link-container">
                <p class="link-label">Or copy and paste this link into your browser:</p>
                <div class="link-box">${resetUrl}</div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Security Notice</strong>
                <p>This link will expire in 10 minutes. If you didn't request a password reset, please ignore this email and ensure your account is secure.</p>
              </div>
            </div>
            
            <div class="footer">
              <p><strong>Cebu Technological University</strong></p>
              <p>Daanbantayan Campus</p>
              <p style="margin-top: 12px;">© 2026 CTU Daanbantayan. All rights reserved.</p>
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
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              background-color: #f3f4f6;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              margin-bottom: 8px;
            }
            .header h1 {
              font-size: 24px;
              font-weight: 600;
              margin: 0;
            }
            .content {
              padding: 40px 30px;
              background: white;
            }
            .greeting {
              font-size: 20px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 16px;
            }
            .text {
              font-size: 16px;
              color: #4b5563;
              margin-bottom: 24px;
            }
            .features {
              margin: 24px 0;
            }
            .feature {
              background: #f0fdf4;
              border-left: 4px solid #10b981;
              padding: 16px;
              margin: 12px 0;
              border-radius: 6px;
            }
            .feature strong {
              display: block;
              color: #065f46;
              margin-bottom: 4px;
              font-size: 15px;
            }
            .feature p {
              color: #047857;
              font-size: 14px;
              margin: 0;
            }
            .footer {
              text-align: center;
              padding: 24px 30px;
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              color: #6b7280;
              font-size: 13px;
              margin: 4px 0;
            }
            @media only screen and (max-width: 600px) {
              .container {
                border-radius: 0;
              }
              .content {
                padding: 24px 20px;
              }
              .header {
                padding: 30px 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🎓 CTU Daanbantayan</div>
              <h1>Welcome Aboard! 🎉</h1>
            </div>
            
            <div class="content">
              <div class="greeting">Hi ${firstName},</div>
              
              <p class="text">
                Your email has been verified successfully! Welcome to CTU Daanbantayan Smart Timetabling System. We're excited to have you on board.
              </p>
              
              <h3 style="color: #1f2937; margin-bottom: 16px;">What's Next?</h3>
              
              <div class="features">
                <div class="feature">
                  <strong>📅 View Your Schedule</strong>
                  <p>Access your personalized class schedule anytime, anywhere</p>
                </div>
                <div class="feature">
                  <strong>🔔 Get Notifications</strong>
                  <p>Receive instant updates about schedule changes and announcements</p>
                </div>
                <div class="feature">
                  <strong>👥 Stay Connected</strong>
                  <p>Connect with your classmates and instructors seamlessly</p>
                </div>
              </div>
              
              <p class="text">
                If you have any questions or need assistance, feel free to contact our support team.
              </p>
              
              <p style="font-size: 16px; color: #1f2937; font-weight: 500;">
                Happy scheduling! 📚
              </p>
            </div>
            
            <div class="footer">
              <p><strong>Cebu Technological University</strong></p>
              <p>Daanbantayan Campus</p>
              <p style="margin-top: 12px;">© 2026 CTU Daanbantayan. All rights reserved.</p>
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
