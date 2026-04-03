import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AppConfig } from '../../config/app-config';

export interface SendInvitationEmailParams {
  to: string;
  workspaceName: string;
  inviterName: string;
  invitationToken: string;
}

export interface SendVerificationEmailParams {
  to: string;
  displayName: string;
  verificationUrl: string;
}

const BRAND_GREEN = '#22c55e';
const BRAND_GREEN_HOVER = '#16a34a';
const BG_DARK = '#0a0f0a';
const BG_CARD = '#111811';
const BG_SECTION = '#0d140d';
const BORDER_SUBTLE = '#1a251a';
const BORDER_LIGHTER = '#243324';
const TEXT_PRIMARY = '#f0f0f0';
const TEXT_SECONDARY = '#a3b5a3';
const TEXT_MUTED = '#5a6e5a';
const TEXT_LINK = '#4ade80';

const cssReset = `
  body, table, td, p { margin: 0; padding: 0; }
  img { border: 0; display: block; outline: none; }
  a { text-decoration: none; }
`;

const headerBlock = `
  <tr>
    <td style="padding: 40px 40px 28px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding-bottom: 24px; border-bottom: 1px solid ${BORDER_SUBTLE};">
            <h1 style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 22px; font-weight: 700; color: ${TEXT_PRIMARY}; letter-spacing: -0.3px;">
              Doc<span style="color: ${BRAND_GREEN};">Flow</span>
            </h1>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;

const footerBlock = (text1: string, text2: string) => `
  <tr>
    <td style="padding: 0 40px 40px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding-top: 28px; border-top: 1px solid ${BORDER_SUBTLE};">
            <p style="margin: 0 0 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: ${TEXT_MUTED}; line-height: 1.5;">
              ${text1}
            </p>
            <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: ${TEXT_MUTED}; line-height: 1.5;">
              ${text2}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;

function wrapper(bodyContent: string): string {
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>DocFlow</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">${cssReset}</style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BG_DARK}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <!--[if mso]>
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" align="center" style="width:600px;">
  <tr><td>
  <![endif]-->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto;">
    <tr>
      <td style="padding: 20px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${BG_CARD}; border-radius: 16px; border: 1px solid ${BORDER_SUBTLE}; overflow: hidden;">
          ${bodyContent}
        </table>
      </td>
    </tr>
  </table>
  <!--[if mso]>
  </td></tr>
  </table>
  <![endif]-->
</body>
</html>
`;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: AppConfig) {}

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const host = this.config.smtpHost;
    const port = this.config.smtpPort;
    const secure = this.config.smtpSecure;
    const user = this.config.smtpUser;
    const pass = this.config.smtpPass;

    if (!host || !user || !pass) {
      this.logger.warn('SMTP not configured (missing SMTP_HOST, SMTP_USER, or SMTP_PASS). Skipping invitation email.');
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: port || 587,
      secure,
      auth: { user, pass },
    });

    return this.transporter;
  }

  // ─── Invitation Email ──────────────────────────────────────────

  async sendInvitationEmail(params: SendInvitationEmailParams): Promise<boolean> {
    const { to, workspaceName, inviterName, invitationToken } = params;
    const transporter = this.getTransporter();
    if (!transporter) return false;

    const invitationUrl = `${this.config.docflowWebBaseUrl}/invite?token=${invitationToken}`;
    const from = this.config.smtpFrom || `DocFlow <${this.config.smtpUser}>`;

    const body = `
      ${headerBlock}
      <tr>
        <td style="padding: 0 40px 8px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td>
                <p style="margin: 0 0 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: ${BRAND_GREEN}; line-height: 1;">
                  Workspace invitation
                </p>
                <h2 style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 26px; font-weight: 700; color: ${TEXT_PRIMARY}; line-height: 1.25; letter-spacing: -0.4px;">
                  You've been invited to<br />
                  <span style="color: ${BRAND_GREEN};">${workspaceName}</span>
                </h2>
                <p style="margin: 0 0 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; color: ${TEXT_SECONDARY}; line-height: 1.65;">
                  <strong style="color: ${TEXT_PRIMARY}; font-weight: 600;">${inviterName}</strong> has invited you to join their DocFlow workspace. DocFlow helps teams capture workflows and generate documentation automatically.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 0 40px 32px;">
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td style="border-radius: 10px; background: linear-gradient(135deg, ${BRAND_GREEN}, ${BRAND_GREEN_HOVER});">
                <a href="${invitationUrl}" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #0a0f0a; text-decoration: none; letter-spacing: 0.01em;">
                  Accept Invitation
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 0 40px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${BG_SECTION}; border-radius: 10px; border: 1px solid ${BORDER_LIGHTER};">
            <tr>
              <td style="padding: 16px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width: 36px; vertical-align: top;">
                      <span style="display: inline-block; width: 36px; height: 36px; line-height: 36px; text-align: center; border-radius: 8px; background-color: rgba(34, 197, 94, 0.1); font-size: 16px;">👥</span>
                    </td>
                    <td style="padding-left: 12px; vertical-align: top;">
                      <p style="margin: 0 0 2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; font-weight: 600; color: ${TEXT_PRIMARY};">What happens next?</p>
                      <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: ${TEXT_SECONDARY}; line-height: 1.5;">
                        Create or sign in to your account to join the workspace and start collaborating.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${footerBlock(
        'This invitation expires in 7 days.',
        `Sent to ${to} · If you didn't expect this invitation, you can safely ignore it.`,
      )}
    `;

    const html = wrapper(body);
    const text = [
      'DocFlow — Workspace Invitation',
      '',
      `${inviterName} has invited you to join "${workspaceName}" on DocFlow.`,
      '',
      `Accept your invitation: ${invitationUrl}`,
      '',
      'This invitation expires in 7 days.',
      '',
      `Sent to ${to}`,
    ].join('\n');

    try {
      await transporter.sendMail({ from, to, subject: `${inviterName} invited you to ${workspaceName} on DocFlow`, html, text });
      this.logger.log(`Invitation email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending invitation email: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  // ─── Verification Email ────────────────────────────────────────

  async sendVerificationEmail(params: SendVerificationEmailParams): Promise<boolean> {
    const { to, displayName, verificationUrl } = params;
    const transporter = this.getTransporter();
    if (!transporter) return false;

    const from = this.config.smtpFrom || `DocFlow <${this.config.smtpUser}>`;

    const body = `
      ${headerBlock}
      <tr>
        <td style="padding: 0 40px 8px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td>
                <p style="margin: 0 0 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: ${BRAND_GREEN}; line-height: 1;">
                  Account verification
                </p>
                <h2 style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 26px; font-weight: 700; color: ${TEXT_PRIMARY}; line-height: 1.25; letter-spacing: -0.4px;">
                  Welcome to DocFlow,<br />
                  <span style="color: ${BRAND_GREEN};">${displayName}</span>
                </h2>
                <p style="margin: 0 0 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; color: ${TEXT_SECONDARY}; line-height: 1.65;">
                  Thanks for signing up! Please verify your email address by clicking the button below. This confirms your identity and secures your account.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 0 40px 32px;">
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td style="border-radius: 10px; background: linear-gradient(135deg, ${BRAND_GREEN}, ${BRAND_GREEN_HOVER});">
                <a href="${verificationUrl}" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #0a0f0a; text-decoration: none; letter-spacing: 0.01em;">
                  Verify Email Address
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 0 40px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${BG_SECTION}; border-radius: 10px; border: 1px solid ${BORDER_LIGHTER};">
            <tr>
              <td style="padding: 16px 20px;">
                <p style="margin: 0 0 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; font-weight: 600; color: ${TEXT_PRIMARY};">Security note</p>
                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: ${TEXT_SECONDARY}; line-height: 1.5;">
                  This link expires in 24 hours. If you didn't create a DocFlow account, ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${footerBlock(
        'Verification link expires in 24 hours.',
        `Sent to ${to} · © ${new Date().getFullYear()} DocFlow`,
      )}
    `;

    const html = wrapper(body);
    const text = [
      'DocFlow — Email Verification',
      '',
      `Hi ${displayName}, thanks for signing up!`,
      '',
      'Please verify your email address by clicking the link below:',
      verificationUrl,
      '',
      'This link expires in 24 hours.',
      '',
      `Sent to ${to}`,
    ].join('\n');

    try {
      await transporter.sendMail({ from, to, subject: 'Verify your email — DocFlow', html, text });
      this.logger.log(`Verification email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending verification email: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
