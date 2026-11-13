export interface EmailNotificationPayload {
  recipientName: string;
  recipientEmail: string;
  subject: string;
  heading: string;
  bodyHtml: string;
  referenceCode?: string;
  baseUrl?: string;
}

const UCC_CREST_PUBLIC_PATH = '/assets/aistudio/image_b7db00c2.png';

/**
 * Generates an official UCC VOTE HTML email notification template
 * featuring the exact University of Cape Coast institutional crest.
 */
export function renderUccVoteEmailTemplate(payload: EmailNotificationPayload): string {
  const crestUrl = payload.baseUrl
    ? `${payload.baseUrl.replace(/\/$/, '')}${UCC_CREST_PUBLIC_PATH}`
    : UCC_CREST_PUBLIC_PATH;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${payload.subject}</title>
  </head>
  <body style="margin:0;padding:24px;background-color:#F4F6F9;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background-color:#FFFFFF;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="background-color:#0B1F3A;padding:24px;text-align:center;">
          <div style="display:inline-block;background-color:#FFFFFF;padding:8px;border-radius:12px;margin-bottom:12px;">
            <img src="${crestUrl}" alt="University of Cape Coast Official Crest" width="64" height="64" style="display:block;object-fit:contain;" />
          </div>
          <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#FFFFFF;">
            UCC <span style="color:#C62828;">VOTE</span>
          </div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#cbd5e1;margin-top:4px;">
            University of Cape Coast Electoral Commission
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 24px;">
          <h1 style="margin:0 0 12px 0;font-size:18px;font-weight:800;color:#0B1F3A;">
            ${payload.heading}
          </h1>
          <p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#475569;">
            Dear ${payload.recipientName},
          </p>
          <div style="font-size:13px;line-height:1.65;color:#334155;">
            ${payload.bodyHtml}
          </div>
          ${
            payload.referenceCode
              ? `<div style="margin-top:18px;padding:12px 16px;background-color:#EAF2FA;border:1px solid #bfdbfe;border-radius:10px;font-family:monospace;font-size:12px;font-weight:700;color:#123B70;">
                  Official Reference: ${payload.referenceCode}
                </div>`
              : ''
          }
        </td>
      </tr>
      <tr>
        <td style="background-color:#F8FAFC;border-top:1px solid #e2e8f0;padding:16px 24px;text-align:center;">
          <div style="font-size:10px;font-weight:800;letter-spacing:0.1em;color:#123B70;text-transform:uppercase;margin-bottom:4px;">
            YOUR VOICE. YOUR VOTE. YOUR UCC.
          </div>
          <div style="font-size:11px;color:#64748b;">
            University of Cape Coast, Cape Coast, Ghana · Official Automated Electoral Bulletin
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
