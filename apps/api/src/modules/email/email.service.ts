import { Resend } from "resend";

import { logger } from "../../common/logger";
import { env } from "../../env";

const emailLogger = logger.child().withContext({ module: "email" });

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const FROM_EMAIL = env.EMAIL_FROM;
const FRONTEND_URL = env.FRONTEND_URL;

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const EmailService = {
  async send(options: SendEmailOptions): Promise<boolean> {
    if (!resend) {
      emailLogger
        .withMetadata({
          action: "skip_send",
          subject: options.subject,
          to: options.to,
        })
        .warn("Email service not configured (RESEND_API_KEY missing)");
      return false;
    }

    try {
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        emailLogger
          .withMetadata({
            action: "send_failed",
            to: options.to,
            subject: options.subject,
          })
          .withError(new Error(error.message))
          .error("Email send failed");
        return false;
      }

      emailLogger
        .withMetadata({
          action: "sent",
          to: options.to,
          subject: options.subject,
        })
        .info("Email sent");
      return true;
    } catch (error) {
      emailLogger
        .withMetadata({
          action: "send_error",
          to: options.to,
          subject: options.subject,
        })
        .withError(error instanceof Error ? error : new Error(String(error)))
        .error("Email send error");
      return false;
    }
  },

  async sendVerificationEmail(
    email: string,
    token: string,
    displayName: string
  ): Promise<boolean> {
    const verifyUrl = `${FRONTEND_URL}/auth/verify-email/${token}`;

    return this.send({
      to: email,
      subject: "Verify your email - ft_transcendence",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #3d4663; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #eeeff5;">
            <div style="background-color: #2959aa; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">ft_transcendence</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #c4c7d4; border-top: none;">
              <h2 style="margin-top: 0; color: #3d4663;">Hey ${displayName}!</h2>
              <p>Thanks for signing up. Please verify your email address by clicking the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" style="background-color: #2959aa; color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 500; display: inline-block;">
                  Verify Email
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">
                Or copy and paste this link in your browser:<br>
                <a href="${verifyUrl}" style="color: #2959aa; word-break: break-all;">${verifyUrl}</a>
              </p>
              <p style="color: #6b7280; font-size: 14px;">
                This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
            </div>
          </body>
        </html>
      `,
    });
  },

  async sendPasswordResetEmail(
    email: string,
    token: string,
    displayName: string
  ): Promise<boolean> {
    const resetUrl = `${FRONTEND_URL}/auth/reset-password/${token}`;

    return this.send({
      to: email,
      subject: "Reset your password - ft_transcendence",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #3d4663; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #eeeff5;">
            <div style="background-color: #2959aa; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">ft_transcendence</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #c4c7d4; border-top: none;">
              <h2 style="margin-top: 0; color: #3d4663;">Password Reset</h2>
              <p>Hi ${displayName}, we received a request to reset your password. Click the button below to choose a new one:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #2959aa; color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 500; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">
                Or copy and paste this link in your browser:<br>
                <a href="${resetUrl}" style="color: #2959aa; word-break: break-all;">${resetUrl}</a>
              </p>
              <p style="color: #6b7280; font-size: 14px;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>
            </div>
          </body>
        </html>
      `,
    });
  },

  async sendEmailChangeVerification(
    newEmail: string,
    token: string,
    displayName: string
  ): Promise<boolean> {
    const verifyUrl = `${FRONTEND_URL}/auth/verify-email-change/${token}`;

    return this.send({
      to: newEmail,
      subject: "Verify your new email address - ft_transcendence",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #3d4663; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #eeeff5;">
            <div style="background-color: #2959aa; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">ft_transcendence</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #c4c7d4; border-top: none;">
              <h2 style="margin-top: 0; color: #3d4663;">Email Change Request</h2>
              <p>Hi ${displayName}, you requested to change your email address to this one. Please verify by clicking the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" style="background-color: #2959aa; color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 500; display: inline-block;">
                  Verify New Email
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">
                Or copy and paste this link in your browser:<br>
                <a href="${verifyUrl}" style="color: #2959aa; word-break: break-all;">${verifyUrl}</a>
              </p>
              <p style="color: #6b7280; font-size: 14px;">
                <strong>Important:</strong> Your email will not change until you click this link. This link will expire in 1 hour.
              </p>
              <p style="color: #6b7280; font-size: 14px;">
                If you didn't request this change, please ignore this email and your email will remain unchanged.
              </p>
            </div>
          </body>
        </html>
      `,
    });
  },
};
