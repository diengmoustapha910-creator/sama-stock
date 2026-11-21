import nodemailer from 'nodemailer';

export interface PasswordResetEmailParams {
  toEmail: string;
  userName?: string;
  resetUrl: string;
  expiresMinutes: number;
}

export interface EmailTransportStatus {
  configured: boolean;
  provider: 'brevo' | 'resend' | 'smtp' | 'none';
  from: string;
  fromName: string;
  fromEmail: string;
  missingVars: string[];
}

function parseFromAddress(rawFrom: string): {
  formatted: string;
  name: string;
  email: string;
} {
  const clean = String(rawFrom || '').trim() || 'SAMA STOCK <support@sama-stock.com>';
  const match = clean.match(/^(.+?)\s*<([^<>@\s]+@[^<>@\s]+)>$/);
  if (match) {
    return {
      formatted: `${match[1].trim()} <${match[2].trim()}>`,
      name: match[1].trim().replace(/^["']|["']$/g, ''),
      email: match[2].trim(),
    };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return {
      formatted: `SAMA STOCK <${clean}>`,
      name: 'SAMA STOCK',
      email: clean,
    };
  }
  return {
    formatted: 'SAMA STOCK <support@sama-stock.com>',
    name: 'SAMA STOCK',
    email: 'support@sama-stock.com',
  };
}

export function getEmailTransportStatus(): EmailTransportStatus {
  const fromParsed = parseFromAddress(process.env.EMAIL_FROM || '');
  const brevoKey = (process.env.BREVO_API_KEY || '').trim();
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const smtpPort = Number(process.env.SMTP_PORT || 0);
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();

  if (brevoKey) {
    return {
      configured: true,
      provider: 'brevo',
      from: fromParsed.formatted,
      fromName: fromParsed.name,
      fromEmail: fromParsed.email,
      missingVars: [],
    };
  }

  if (resendKey) {
    return {
      configured: true,
      provider: 'resend',
      from: fromParsed.formatted,
      fromName: fromParsed.name,
      fromEmail: fromParsed.email,
      missingVars: [],
    };
  }

  if (smtpHost && smtpPort > 0) {
    const isLocalHost = smtpHost === '127.0.0.1' || smtpHost === 'localhost';
    if (isLocalHost || (smtpUser && smtpPass)) {
      return {
        configured: true,
        provider: 'smtp',
        from: fromParsed.formatted,
        fromName: fromParsed.name,
        fromEmail: fromParsed.email,
        missingVars: [],
      };
    }
    return {
      configured: false,
      provider: 'none',
      from: fromParsed.formatted,
      fromName: fromParsed.name,
      fromEmail: fromParsed.email,
      missingVars: [
        ...(!smtpUser ? ['SMTP_USER'] : []),
        ...(!smtpPass ? ['SMTP_PASS'] : []),
      ],
    };
  }

  return {
    configured: false,
    provider: 'none',
    from: fromParsed.formatted,
    fromName: fromParsed.name,
    fromEmail: fromParsed.email,
    missingVars: ['BREVO_API_KEY | RESEND_API_KEY | SMTP_HOST + SMTP_PORT + SMTP_USER + SMTP_PASS'],
  };
}

export function isEmailTransportConfigured(): boolean {
  return getEmailTransportStatus().configured;
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildResetEmailContent(params: PasswordResetEmailParams): {
  subject: string;
  text: string;
  html: string;
} {
  const safeUrl = escapeHtml(params.resetUrl);
  const mins = Math.max(1, Math.round(params.expiresMinutes));

  const subject = 'Réinitialisation de votre mot de passe – SAMA STOCK';

  const text = [
    'Bonjour,',
    '',
    'Vous avez demandé la réinitialisation du mot de passe de votre compte SAMA STOCK.',
    '',
    'Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe :',
    params.resetUrl,
    '',
    `Ce lien est valable pendant ${mins} minutes et ne peut être utilisé qu'une seule fois.`,
    '',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    '',
    "L'équipe SAMA STOCK",
    'Gérez votre stock. Développez votre business.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1E293B;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 8px 24px rgba(18,59,103,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#123B67 0%,#0C2744 100%);padding:28px 32px;text-align:center;">
                <div style="font-size:22px;font-weight:800;letter-spacing:0.5px;color:#FFFFFF;">
                  SAMA <span style="color:#F58220;">STOCK</span>
                </div>
                <div style="font-size:12px;color:#CBD5E1;margin-top:6px;">
                  Gérez votre stock. Développez votre business.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
                  Bonjour,
                </p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
                  Vous avez demandé la réinitialisation du mot de passe de votre compte <strong>SAMA STOCK</strong>.
                </p>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
                  Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                  <tr>
                    <td align="center" style="border-radius:10px;background-color:#F58220;">
                      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 26px;font-size:13px;font-weight:700;letter-spacing:0.4px;color:#FFFFFF;text-decoration:none;border-radius:10px;">
                        RÉINITIALISER MON MOT DE PASSE
                      </a>
                    </td>
                  </tr>
                </table>
                <div style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;margin:0 0 20px;font-size:13px;line-height:1.6;color:#334155;">
                  Ce lien est valable pendant <strong>${mins} minutes</strong> et ne peut être utilisé qu’<strong>une seule fois</strong>.
                </div>
                <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#475569;">
                  Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.
                </p>
                <p style="margin:0 0 18px;font-size:11px;line-height:1.5;word-break:break-all;color:#64748B;">
                  Lien direct : <a href="${safeUrl}" style="color:#123B67;">${safeUrl}</a>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#0F172A;border-top:1px solid #E2E8F0;padding-top:16px;">
                  <strong>L’équipe SAMA STOCK</strong><br />
                  <span style="color:#F58220;font-size:12px;">Gérez votre stock. Développez votre business.</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#F8FAFC;padding:14px 32px;text-align:center;font-size:11px;color:#94A3B8;border-top:1px solid #E2E8F0;">
                SAMA STOCK · support@sama-stock.com
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export async function sendPasswordResetEmail(
  params: PasswordResetEmailParams
): Promise<{ provider: 'brevo' | 'resend' | 'smtp'; messageId: string }> {
  const status = getEmailTransportStatus();
  if (!status.configured) {
    const err: any = new Error(
      "Le service d'envoi d'e-mails transactionnels n'est pas configuré sur le serveur."
    );
    err.code = 'EMAIL_TRANSPORT_NOT_CONFIGURED';
    throw err;
  }

  const { subject, text, html } = buildResetEmailContent(params);
  const replyToEmail = (process.env.EMAIL_REPLY_TO || status.fromEmail || 'support@sama-stock.com').trim();

  // 1. Brevo HTTP API v3 (https://api.brevo.com/v3/smtp/email)
  if (status.provider === 'brevo') {
    const brevoKey = (process.env.BREVO_API_KEY || '').trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'api-key': brevoKey,
        },
        body: JSON.stringify({
          sender: {
            name: status.fromName,
            email: status.fromEmail,
          },
          to: [
            {
              email: params.toEmail,
              ...(params.userName ? { name: params.userName } : {}),
            },
          ],
          replyTo: {
            email: replyToEmail,
            name: status.fromName,
          },
          subject,
          htmlContent: html,
          textContent: text,
        }),
        signal: controller.signal,
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const err: any = new Error(
          body?.message || `Erreur fournisseur e-mail Brevo (HTTP ${resp.status})`
        );
        err.code = 'EMAIL_PROVIDER_ERROR';
        err.status = resp.status;
        throw err;
      }
      return {
        provider: 'brevo',
        messageId: String(body?.messageId || 'brevo-sent'),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // 2. Resend HTTP REST API (https://api.resend.com/emails)
  if (status.provider === 'resend') {
    const resendKey = (process.env.RESEND_API_KEY || '').trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: status.from,
          to: [params.toEmail],
          reply_to: replyToEmail,
          subject,
          text,
          html,
        }),
        signal: controller.signal,
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const err: any = new Error(
          body?.message || `Erreur fournisseur e-mail Resend (HTTP ${resp.status})`
        );
        err.code = 'EMAIL_PROVIDER_ERROR';
        err.status = resp.status;
        throw err;
      }
      return {
        provider: 'resend',
        messageId: String(body?.id || 'resend-sent'),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // 3. Standard SMTP via Nodemailer
  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secureEnv = (process.env.SMTP_SECURE || '').trim().toLowerCase();
  const secure = secureEnv ? secureEnv === 'true' : port === 465;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const rejectUnauthorizedEnv = (process.env.SMTP_TLS_REJECT_UNAUTHORIZED || 'true')
    .trim()
    .toLowerCase();

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user ? { auth: { user, pass } } : {}),
    tls: {
      rejectUnauthorized: rejectUnauthorizedEnv !== 'false',
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  const info = await transporter.sendMail({
    from: status.from,
    to: params.toEmail,
    replyTo: replyToEmail,
    subject,
    text,
    html,
  });

  return {
    provider: 'smtp',
    messageId: String(info.messageId || 'smtp-sent'),
  };
}
