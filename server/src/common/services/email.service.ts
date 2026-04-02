import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';

export interface SendInvitationEmailParams {
  to: string;
  workspaceName: string;
  inviterName: string;
  invitationToken: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: AppConfig) {}

  async sendInvitationEmail(params: SendInvitationEmailParams): Promise<boolean> {
    const { to, workspaceName, inviterName, invitationToken } = params;

    const apiKey = this.config.resendApiKey;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured. Skipping invitation email.');
      return false;
    }

    const invitationUrl = `${this.config.docflowWebBaseUrl}/invite?token=${invitationToken}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to DocFlow</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0f0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 40px auto; background-color: #111811; border-radius: 12px; border: 1px solid #1a251a;">
    <tr>
      <td style="padding: 40px 40px 32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-bottom: 32px; border-bottom: 1px solid #1a251a;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff;">DocFlow</h1>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 32px 0;">
          <tr>
            <td>
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #ffffff; line-height: 1.3;">
                You've been invited to join ${workspaceName}
              </h1>
              <p style="margin: 0 0 24px; font-size: 15px; color: #8a9a8a; line-height: 1.6;">
                ${inviterName} has invited you to join their DocFlow workspace. DocFlow helps teams capture workflows and generate documentation automatically.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-radius: 8px; background-color: #22c55e;">
                    <a href="${invitationUrl}" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #0a0f0a; text-decoration: none;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-top: 24px; border-top: 1px solid #1a251a;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #4a5a4a;">
                This invitation expires in 7 days.
              </p>
              <p style="margin: 0; font-size: 12px; color: #3a4a3a;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const text = `
You've been invited to join ${workspaceName}

${inviterName} has invited you to join their DocFlow workspace.

Accept your invitation:
${invitationUrl}

This invitation expires in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
`;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: 'DocFlow <onboarding@resend.dev>',
          to: [to],
          subject: `You've been invited to join ${workspaceName}`,
          html,
          text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Failed to send invitation email: ${response.status} - ${errorText}`);
        return false;
      }

      const result = (await response.json()) as { id?: string };
      this.logger.log(`Invitation email sent to ${to} (${result.id || 'ok'})`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending invitation email: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
