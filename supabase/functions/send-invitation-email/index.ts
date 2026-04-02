import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@3.2.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const INVITATION_EMAIL_HTML = `
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
              <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDgyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImRvY2Zsb3dUaWxlTGlnaHQiIHgxPSIxOCIgeTE9IjE2IiB4Mj0iMTU2IiB5Mj0iMTU2IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CiAgICAgIDxzdG9wIHN0b3AtY29sb3I9IiM3NEY1QjAiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIwLjQyIiBzdG9wLWNvbG9yPSIjMTZCMzY0Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzA3MTEwQyIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZG9jZmxvd0Zsb3dMaWdodCIgeDE9IjQ4IiB5MT0iNDgiIHgyPSIxMjIiIHkyPSIxMTIiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHN0b3Agc3RvcC1jb2xvcj0iI0Y3RkZGOSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNDN0Y3RDgiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8ZmlsdGVyIGlkPSJkb2NmbG93V29yZG1hcmtTaGFkb3dMaWdodCIgeD0iLTIwJSIgeT0iLTYwJSIgd2lkdGg9IjE0MCUiIGhlaWdodD0iMjIwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSI0IiBzdGREZXZpYXRpb249IjYiIGZsb29kLWNvbG9yPSIjMDIwNzA1IiBmbG9vZC1vcGFjaXR5PSIwLjM0Ii8+CiAgICA8L2ZpbHRlcj4KICA8L2RlZnM+CiAgPHJlY3QgeD0iMTIiIHk9IjEyIiB3aWR0aD0iMTQ4IiBoZWlnaHQ9IjE0OCIgcng9IjQwIiBmaWxsPSJ1cmwoI2RvY2Zsb3dUaWxlTGlnaHQpIi8+CiAgPHJlY3QgeD0iMTIuNzUiIHk9IjEyLjc1IiB3aWR0aD0iMTQ2LjUiIGhlaWdodD0iMTQ2LjUiIHJ4PSIzOS4yNSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMTYiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgPHBhdGggZD0iTTQ2IDQ4QzQ2IDQ0LjY4NjMgNDguNjg2MyA0MiA1MiA0Mkg4MEMxMDEuNTM5IDQyIDExOSA1OS40NjA5IDExOSA4MVY5MUMxMTkgMTEyLjUzOSAxMDEuNTM5IDEzMCA4MCAxMzBINTJDNDguNjg2MyAxMzAgNDYgMTI3LjMxNCA0NiAxMjRWNDhaIiBzdHJva2U9InVybCgjZG9jZmxvd0Zsb3dMaWdodCkiIHN0cm9rZS13aWR0aD0iMTAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik04NCA1N0gxMTgiIHN0cm9rZT0iI0UzRkZFQSIgc3Ryb2tlLXdpZHRoPSIxMCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTTg0IDgxSDEwOCIgc3Ryb2tlPSIjRTNGRkVBIiBzdHJva2Utd2lkdGg9IjEwIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8cGF0aCBkPSJNODQgMTA1SDk3IiBzdHJva2U9IiNFM0ZGRUEiIHN0cm9rZS13aWR0aD0iMTAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxnIGZpbHRlcj0idXJsKCNkb2NmbG93V29yZG1hcmtTaGFkb3dMaWdodCkiPgogICAgPHRleHQgeD0iMTk0IiB5PSIxMTgiIGZpbGw9IiNGRkZGRkYiIGZvbnQtc2l6ZT0iNzYiIGZvbnQtd2VpZ2h0PSI4MDAiIGxldHRlci1zcGFjaW5nPSI1LjQiIGZvbnQtZmFtaWx5PSJPcmJpdHJvbiwgRXVyb3N0aWxlLCBCYW5rIEdvdGhpYywgQXJpYWwsIHNhbnMtc2VyaWYiPkRPQ0ZMT1c8L3RleHQ+CiAgPC9nPgo8L3N2Zz4K" alt="DocFlow" height="32" style="display: block;">
            </td>
          </tr>
        </table>
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 32px 0;">
          <tr>
            <td>
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #ffffff; line-height: 1.3;">
                You've been invited to join {{workspaceName}}
              </h1>
              
              <p style="margin: 0 0 24px; font-size: 15px; color: #8a9a8a; line-height: 1.6;">
                {{inviterName}} has invited you to join their DocFlow workspace. DocFlow helps teams capture workflows and generate documentation automatically.
              </p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f1610; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px; font-size: 12px; font-weight: 500; color: #5a6a5a; text-transform: uppercase; letter-spacing: 0.05em;">
                      Your role
                    </p>
                    <p style="margin: 0; font-size: 16px; font-weight: 500; color: #4ade80;">
                      {{role}}
                    </p>
                  </td>
                </tr>
              </table>
              
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-radius: 8px; background-color: #22c55e;">
                    <a href="{{invitationUrl}}" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #0a0f0a; text-decoration: none;">
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

const INVITATION_EMAIL_TEXT = `
You've been invited to join {{workspaceName}}

{{inviterName}} has invited you to join their DocFlow workspace.

Your role: {{role}}

Accept your invitation:
{{invitationUrl}}

This invitation expires in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
`;

serve(async (req) => {
  try {
    const { to, workspaceName, inviterName, role, invitationUrl } = await req.json();

    if (!to || !workspaceName || !invitationUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, workspaceName, invitationUrl" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const html = INVITATION_EMAIL_HTML
      .replace(/\{\{workspaceName\}\}/g, workspaceName)
      .replace(/\{\{inviterName\}\}/g, inviterName || "A team member")
      .replace(/\{\{role\}\}/g, role || "Viewer")
      .replace(/\{\{invitationUrl\}\}/g, invitationUrl);

    const text = INVITATION_EMAIL_TEXT
      .replace(/\{\{workspaceName\}\}/g, workspaceName)
      .replace(/\{\{inviterName\}\}/g, inviterName || "A team member")
      .replace(/\{\{role\}\}/g, role || "Viewer")
      .replace(/\{\{invitationUrl\}\}/g, invitationUrl);

    const { data, error } = await resend.emails.send({
      from: "DocFlow <onboarding@resend.dev>",
      to: [to],
      subject: `You've been invited to join ${workspaceName}`,
      html,
      text,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data?.id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
