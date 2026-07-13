const formData = require('form-data');
const Mailgun = require('mailgun.js');
const logger = require('../config/logger');

class EmailService {
    constructor() {
        // Initialize Mailgun
        this.mailgun = null;
        this.domain = process.env.MAILGUN_DOMAIN;

        if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
            const mg = new Mailgun(formData);
            this.mailgun = mg.client({
                username: 'api',
                key: process.env.MAILGUN_API_KEY,
                // EU-region accounts/domains MUST use the EU endpoint, otherwise
                // every request fails with 401. Set MAILGUN_API_URL=https://api.eu.mailgun.net
                // in your env if your domain lives in the EU region.
                url: process.env.MAILGUN_API_URL || 'https://api.mailgun.net',
            });
            logger.info(`Mailgun email service initialized (domain: ${this.domain})`);
        } else {
            logger.warn('Mailgun credentials not found. Email functionality will be limited.');
        }
    }

    /**
     * Log the real Mailgun error. The mailgun.js SDK surfaces failures on
     * error.status / error.details (NOT error.response), so those must be
     * read explicitly or the underlying cause is silently swallowed.
     */
    logMailgunError(context, error) {
        logger.error(`${context}:`, error?.message || error);
        if (error?.status) {
            logger.error('Mailgun status code:', error.status);
        }
        if (error?.details) {
            logger.error('Mailgun error details:', error.details);
        }
    }

    /**
     * Send password reset email with reset link
     * @param {string} email - Recipient email address
     * @param {string} resetToken - Password reset token
     * @param {string} userName - User's name for personalization
     */
    async sendPasswordResetEmail(email, resetToken, userName) {
        try {
            if (!this.mailgun) {
                throw new Error('Mailgun is not configured. Please check your environment variables.');
            }

            // Construct reset URL - update this with your frontend URL
            const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

            const messageData = {
                from: `${process.env.MAILGUN_FROM_NAME || 'Scribo Notes'} <${process.env.MAILGUN_FROM_EMAIL || `noreply@${this.domain}`}>`,
                to: email,
                subject: 'Password Reset Request - Scribo',
                text: this.getPasswordResetTextTemplate(userName, resetUrl),
                html: this.getPasswordResetHtmlTemplate(userName, resetUrl),
            };

            const response = await this.mailgun.messages.create(this.domain, messageData);

            logger.info(`Password reset email sent to: ${email}`, { messageId: response.id });
            return { success: true, message: 'Password reset email sent successfully' };
        } catch (error) {
            this.logMailgunError('Mailgun password reset email error', error);
            throw new Error('Failed to send password reset email. Please try again later.');
        }
    }

    /**
     * Plain text template for password reset email
     */
    getPasswordResetTextTemplate(userName, resetUrl) {
        return `
Hello ${userName},

You recently requested to reset your password for your Scribo account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you did not request a password reset, please ignore this email or contact support if you have concerns.

Best regards,
The Scribo Team

---
This is an automated message, please do not reply to this email.
        `.trim();
    }

    /**
     * HTML template for password reset email
     */
    getPasswordResetHtmlTemplate(userName, resetUrl) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                    <!-- Header with gradient -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; text-align: center;">
                                🔐 Password Reset
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                Hello <strong>${userName}</strong>,
                            </p>
                            
                            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                You recently requested to reset your password for your <strong>Scribo</strong> account. Click the button below to reset it:
                            </p>
                            
                            <!-- Reset Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${resetUrl}" 
                                           style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(20, 184, 166, 0.25);">
                                            Reset Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                Or copy and paste this URL into your browser:
                            </p>
                            <p style="margin: 0 0 20px 0; padding: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; color: #14b8a6; font-size: 13px; word-break: break-all;">
                                ${resetUrl}
                            </p>
                            
                            <!-- Warning Box -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                <tr>
                                    <td style="padding: 16px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                                        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                                            ⚠️ <strong>Security Notice:</strong> This link will expire in <strong>1 hour</strong> for your security.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                If you did not request a password reset, please ignore this email or <a href="mailto:support@scribo.com" style="color: #14b8a6; text-decoration: none;">contact support</a> if you have concerns.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px; text-align: center;">
                                Best regards,<br>
                                <strong style="color: #14b8a6;">The Scribo Team</strong>
                            </p>
                            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                                This is an automated message, please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Footer Text -->
                <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                    © ${new Date().getFullYear()} Scribo. All rights reserved.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
        `.trim();
    }

    /**
     * Send password reset confirmation email
     * @param {string} email - Recipient email address
     * @param {string} userName - User's name
     */
    async sendPasswordResetConfirmation(email, userName) {
        try {
            if (!this.mailgun) {
                logger.warn('Mailgun not configured, skipping confirmation email');
                return { success: false };
            }

            const messageData = {
                from: `${process.env.MAILGUN_FROM_NAME || 'Scribo Notes'} <${process.env.MAILGUN_FROM_EMAIL || `noreply@${this.domain}`}>`,
                to: email,
                subject: 'Password Successfully Reset - Scribo',
                text: `
Hello ${userName},

Your password has been successfully reset.

If you did not make this change, please contact our support team immediately.

Best regards,
The Scribo Team
                `.trim(),
                html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; text-align: center;">
                                ✅ Password Reset Successful
                            </h1>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                Hello <strong>${userName}</strong>,
                            </p>
                            
                            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                Your password has been successfully reset. You can now log in to your account with your new password.
                            </p>
                            
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 16px; background-color: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 4px;">
                                        <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6;">
                                            ℹ️ If you did not make this change, please <a href="mailto:support@scribo.com" style="color: #14b8a6; text-decoration: none;">contact our support team</a> immediately.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center;">
                                Best regards,<br>
                                <strong style="color: #14b8a6;">The Scribo Team</strong>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
                `.trim(),
            };

            const response = await this.mailgun.messages.create(this.domain, messageData);
            logger.info(`Password reset confirmation email sent to: ${email}`, { messageId: response.id });
            return { success: true };
        } catch (error) {
            this.logMailgunError('Failed to send confirmation email', error);
            // Don't throw error for confirmation email - it's not critical
            return { success: false };
        }
    }

    /**
     * Send email verification email with verification link
     * @param {string} email - Recipient email address
     * @param {string} verificationToken - Email verification token
     * @param {string} userName - User's name for personalization
     */
    async sendVerificationEmail(email, verificationToken, userName) {
        try {
            if (!this.mailgun) {
                throw new Error('Mailgun is not configured. Please check your environment variables.');
            }

            // Construct verification URL
            const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

            const messageData = {
                from: `${process.env.MAILGUN_FROM_NAME || 'Scribo Notes'} <${process.env.MAILGUN_FROM_EMAIL || `noreply@${this.domain}`}>`,
                to: email,
                subject: 'Verify Your Email Address - Scribo',
                text: this.getVerificationEmailTextTemplate(userName, verificationUrl),
                html: this.getVerificationEmailHtmlTemplate(userName, verificationUrl),
            };

            const response = await this.mailgun.messages.create(this.domain, messageData);

            logger.info(`Email verification sent to: ${email}`, { messageId: response.id });
            return { success: true, message: 'Verification email sent successfully' };
        } catch (error) {
            this.logMailgunError('Mailgun verification email error', error);
            throw new Error('Failed to send verification email. Please try again later.');
        }
    }

    /**
     * Plain text template for email verification
     */
    getVerificationEmailTextTemplate(userName, verificationUrl) {
        return `
Hello ${userName},

Thank you for signing up with Scribo! We're excited to have you on board.

To complete your registration and get the verified badge on your account, please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours for security reasons.

If you did not create an account with Scribo, please ignore this email.

Best regards,
The Scribo Team

---
This is an automated message, please do not reply to this email.
        `.trim();
    }

    /**
     * HTML template for email verification
     */
    getVerificationEmailHtmlTemplate(userName, verificationUrl) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                    <!-- Header with gradient -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; text-align: center;">
                                ✉️ Verify Your Email
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                Hello <strong>${userName}</strong>,
                            </p>
                            
                            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                Thank you for signing up with <strong>Scribo</strong>! We're excited to have you on board. 🎉
                            </p>
                            
                            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                To complete your registration and get the <strong style="color: #14b8a6;">✓ Verified</strong> badge on your account, please verify your email address by clicking the button below:
                            </p>
                            
                            <!-- Verification Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${verificationUrl}" 
                                           style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(20, 184, 166, 0.25);">
                                            Verify Email Address
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                Or copy and paste this URL into your browser:
                            </p>
                            <p style="margin: 0 0 20px 0; padding: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; color: #14b8a6; font-size: 13px; word-break: break-all;">
                                ${verificationUrl}
                            </p>
                            
                            <!-- Info Box -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                <tr>
                                    <td style="padding: 16px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                                        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                                            ⏰ <strong>Note:</strong> This verification link will expire in <strong>24 hours</strong> for security reasons.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                If you did not create an account with Scribo, please ignore this email.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px; text-align: center;">
                                Best regards,<br>
                                <strong style="color: #14b8a6;">The Scribo Team</strong>
                            </p>
                            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                                This is an automated message, please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Footer Text -->
                <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                    © ${new Date().getFullYear()} Scribo. All rights reserved.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
        `.trim();
    }

    /**
     * Send welcome email after successful verification
     * @param {string} email - Recipient email address
     * @param {string} userName - User's name
     */
    async sendWelcomeEmail(email, userName) {
        try {
            if (!this.mailgun) {
                logger.warn('Mailgun not configured, skipping welcome email');
                return { success: false };
            }

            const messageData = {
                from: `${process.env.MAILGUN_FROM_NAME || 'Scribo Notes'} <${process.env.MAILGUN_FROM_EMAIL || `noreply@${this.domain}`}>`,
                to: email,
                subject: 'Welcome to Scribo - Email Verified! ✓',
                text: `
Hello ${userName},

Congratulations! Your email has been successfully verified. 🎉

You now have the verified badge on your account, which helps build trust and security.

Start exploring Scribo and create your first note today!

Best regards,
The Scribo Team
                `.trim(),
                html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Scribo</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; text-align: center;">
                                🎉 Welcome to Scribo!
                            </h1>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                Hello <strong>${userName}</strong>,
                            </p>
                            
                            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                Congratulations! Your email has been successfully verified. 🎉
                            </p>
                            
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 20px; background-color: #ccfbf1; border-left: 4px solid #14b8a6; border-radius: 4px; text-align: center;">
                                        <p style="margin: 0; color: #0f766e; font-size: 18px; line-height: 1.6; font-weight: 600;">
                                            ✓ You now have the <span style="color: #14b8a6;">Verified</span> badge!
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                This badge helps build trust and security for your account. You're all set to explore Scribo and create your first note today!
                            </p>
                            
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" 
                                           style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(20, 184, 166, 0.25);">
                                            Go to Dashboard
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center;">
                                Best regards,<br>
                                <strong style="color: #14b8a6;">The Scribo Team</strong>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
                `.trim(),
            };

            const response = await this.mailgun.messages.create(this.domain, messageData);
            logger.info(`Welcome email sent to: ${email}`, { messageId: response.id });
            return { success: true };
        } catch (error) {
            this.logMailgunError('Failed to send welcome email', error);
            // Don't throw error for welcome email - it's not critical
            return { success: false };
        }
    }
}

module.exports = new EmailService();
