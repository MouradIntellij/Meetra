import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

const app = express();
const PORT = Number(process.env.DEV_EMAIL_WEBHOOK_PORT || 4010);
const SECRET = process.env.NOTIFICATION_WEBHOOK_SECRET || process.env.HOST_ALERT_WEBHOOK_SECRET || '';
const OUTBOX_FILE = path.resolve(process.cwd(), 'server/data/notifications/dev-email-webhook.json');

app.use(express.json({ limit: '1mb' }));

async function appendPayload(payload, meta = {}) {
  await fs.mkdir(path.dirname(OUTBOX_FILE), { recursive: true });

  let store = { items: [] };
  try {
    store = JSON.parse(await fs.readFile(OUTBOX_FILE, 'utf8'));
    if (!Array.isArray(store.items)) {
      store.items = [];
    }
  } catch {}

  store.items.unshift({
    receivedAt: new Date().toISOString(),
    ...meta,
    payload,
  });
  store.items = store.items.slice(0, 500);

  await fs.writeFile(OUTBOX_FILE, JSON.stringify(store, null, 2), 'utf8');
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, port: PORT, outbox: OUTBOX_FILE });
});

app.post('/webhooks/email', async (req, res) => {
  const providedSecret = req.get('x-meetra-webhook-secret') || '';
  if (SECRET && providedSecret !== SECRET) {
    return res.status(401).json({ error: 'INVALID_WEBHOOK_SECRET' });
  }

  const payload = req.body || {};
  await appendPayload(payload, {
    eventType: req.get('x-meetra-event') || payload.type || 'unknown',
  });

  console.log('\n[Meetra email webhook]');
  console.log(`Type   : ${payload.type || 'unknown'}`);
  console.log(`To     : ${payload.to || payload.hostEmail || 'n/a'}`);
  console.log(`Subject: ${payload.subject || payload.message || 'n/a'}`);
  console.log(`Stored : ${OUTBOX_FILE}`);

  return res.json({ ok: true, stored: true });
});

app.listen(PORT, () => {
  console.log(`[Meetra] Dev email webhook listening on http://localhost:${PORT}/webhooks/email`);
  console.log(`[Meetra] Outbox file: ${OUTBOX_FILE}`);
});
