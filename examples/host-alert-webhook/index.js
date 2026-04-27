import express from 'express';

const app = express();
app.use(express.json({ limit: '256kb' }));

const PORT = Number(process.env.PORT || 3005);
const WEBHOOK_SECRET = process.env.MEETRA_WEBHOOK_SECRET || '';
const PROVIDER = String(process.env.EMAIL_PROVIDER || 'log').trim().toLowerCase();
const DEFAULT_TARGET_EMAIL = process.env.HOST_ALERT_TARGET_EMAIL || '';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || '';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Meetra';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';

function maskSecret(value) {
  if (!value) return '(none)';
  if (value.length <= 6) return '*'.repeat(value.length);
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-2)}`;
}

function verifySecret(req, res, next) {
  if (!WEBHOOK_SECRET) return next();

  const incoming = req.get('x-meetra-webhook-secret') || '';
  if (incoming !== WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false, error: 'INVALID_WEBHOOK_SECRET' });
  }

  return next();
}

function buildEmailText(payload) {
  const when = payload?.scheduledFor
    ? `Prévue pour ${new Date(payload.scheduledFor).toLocaleString('fr-CA', {
        timeZone: payload.timezone || 'America/Toronto',
      })}${payload.timezone ? ` (${payload.timezone})` : ''}`
    : 'Réunion sans date planifiée';

  return [
    `Bonjour${payload?.hostName ? ` ${payload.hostName}` : ''},`,
    '',
    payload?.message || 'Un participant attend dans Meetra.',
    when,
    payload?.joinUrl ? `Lien de réunion: ${payload.joinUrl}` : null,
    payload?.roomId ? `Salle: ${payload.roomId}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function sendWithBrevo({ toEmail, subject, text }) {
  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
    throw new Error('BREVO_NOT_CONFIGURED');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        email: BREVO_SENDER_EMAIL,
        name: BREVO_SENDER_NAME,
      },
      to: [{ email: toEmail }],
      subject,
      textContent: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`BREVO_SEND_FAILED_${response.status}`);
  }
}

async function sendWithResend({ toEmail, subject, text }) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    throw new Error('RESEND_NOT_CONFIGURED');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [toEmail],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`RESEND_SEND_FAILED_${response.status}`);
  }
}

async function sendEmail(payload) {
  const toEmail = payload?.hostEmail || DEFAULT_TARGET_EMAIL;
  if (!toEmail) {
    return {
      delivered: false,
      provider: PROVIDER,
      reason: 'NO_TARGET_EMAIL',
    };
  }

  const subject = `Meetra: ${payload?.guestName || 'Un invité'} attend dans "${payload?.title || 'Réunion Meetra'}"`;
  const text = buildEmailText(payload);

  if (PROVIDER === 'brevo') {
    await sendWithBrevo({ toEmail, subject, text });
    return { delivered: true, provider: 'brevo', toEmail };
  }

  if (PROVIDER === 'resend') {
    await sendWithResend({ toEmail, subject, text });
    return { delivered: true, provider: 'resend', toEmail };
  }

  console.log('[Meetra webhook][email][log-only]', {
    toEmail,
    subject,
    text,
    roomId: payload?.roomId || null,
  });

  return { delivered: true, provider: 'log', toEmail };
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    provider: PROVIDER,
    secretConfigured: Boolean(WEBHOOK_SECRET),
  });
});

app.post('/meetra-email', verifySecret, async (req, res) => {
  try {
    const result = await sendEmail(req.body || {});
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[Meetra webhook][email] send failed:', error?.message || error);
    res.status(502).json({
      ok: false,
      error: error?.message || 'EMAIL_SEND_FAILED',
    });
  }
});

app.post('/meetra-sms', verifySecret, async (req, res) => {
  const payload = req.body || {};
  console.log('[Meetra webhook][sms][stub]', {
    hostPhone: payload?.hostPhone || null,
    guestName: payload?.guestName || null,
    joinUrl: payload?.joinUrl || null,
  });

  res.status(202).json({
    ok: true,
    delivered: false,
    provider: 'stub',
    reason: 'SMS_PROVIDER_NOT_CONFIGURED',
  });
});

app.listen(PORT, () => {
  console.log(`[Meetra webhook] listening on http://localhost:${PORT}`);
  console.log(`[Meetra webhook] provider=${PROVIDER}`);
  console.log(`[Meetra webhook] secret=${maskSecret(WEBHOOK_SECRET)}`);
});
