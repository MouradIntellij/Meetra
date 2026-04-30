import fs from 'node:fs/promises';
import path from 'node:path';
import { ENV } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getNotificationsFilePath() {
  return path.resolve(process.cwd(), ENV.NOTIFICATIONS_STORE_FILE || 'server/data/notifications/email-outbox.json');
}

async function appendLocalOutbox(entry) {
  const filePath = getNotificationsFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  let store = { items: [] };
  try {
    store = JSON.parse(await fs.readFile(filePath, 'utf8'));
    if (!Array.isArray(store.items)) {
      store.items = [];
    }
  } catch {}

  store.items.unshift(entry);
  store.items = store.items.slice(0, 500);
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), 'utf8');
}

async function postEmailWebhook(payload) {
  const webhookUrl = ENV.NOTIFICATION_EMAIL_WEBHOOK_URL || '';
  if (!webhookUrl) return { delivered: false, simulated: true, provider: 'local-outbox' };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ENV.NOTIFICATION_WEBHOOK_SECRET
          ? { 'x-meetra-webhook-secret': ENV.NOTIFICATION_WEBHOOK_SECRET }
          : {}),
        'x-meetra-event': payload.type || 'email',
      },
      body: JSON.stringify(payload),
    });

    return {
      delivered: response.ok,
      simulated: false,
      provider: 'webhook',
      status: response.status,
    };
  } catch (error) {
    logger.warn('Email webhook failed:', error?.message);
    return { delivered: false, simulated: true, provider: 'local-outbox', error: error?.message || 'EMAIL_WEBHOOK_FAILED' };
  }
}

export async function deliverEmailNotification({
  type,
  to,
  subject,
  text,
  meta = {},
}) {
  const recipient = normalizeEmail(to);
  if (!recipient || !subject || !text) {
    return { delivered: false, simulated: false, error: 'INVALID_EMAIL_PAYLOAD' };
  }

  const payload = {
    type,
    to: recipient,
    fromName: ENV.NOTIFICATION_FROM_NAME || 'Meetra',
    fromEmail: ENV.NOTIFICATION_FROM_EMAIL || '',
    subject,
    text,
    meta,
    createdAt: new Date().toISOString(),
  };

  const result = await postEmailWebhook(payload);
  if (!result.delivered || result.simulated) {
    await appendLocalOutbox({
      ...payload,
      delivery: result.delivered ? 'delivered' : 'queued-local',
      provider: result.provider,
      error: result.error || null,
    });
  }

  return result;
}

export async function sendMeetingInvitationEmails({
  meeting,
  roomId,
  joinUrl,
  recipients,
  actorName = '',
  customMessage = '',
}) {
  const title = meeting?.metadata?.title || 'Réunion Meetra';
  const scheduledFor = meeting?.metadata?.scheduledFor || null;
  const timezone = meeting?.metadata?.timezone || null;
  const hostName = meeting?.metadata?.hostName || actorName || 'Meetra';
  const durationMinutes = meeting?.metadata?.durationMinutes || 60;
  const normalizedRecipients = Array.from(new Set((recipients || []).map(normalizeEmail).filter(Boolean)));

  const when = scheduledFor
    ? new Intl.DateTimeFormat('fr-CA', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timezone || undefined,
    }).format(new Date(scheduledFor))
    : 'Dès maintenant';

  const results = await Promise.all(normalizedRecipients.map(async (recipient) => {
    const text = [
      `Bonjour,`,
      '',
      `${hostName} vous invite à rejoindre "${title}".`,
      `Horaire: ${when}`,
      `Durée prévue: ${durationMinutes} minutes`,
      `Lien de réunion: ${joinUrl}`,
      customMessage ? '' : null,
      customMessage || null,
      '',
      'Meetra',
    ].filter(Boolean).join('\n');

    const delivery = await deliverEmailNotification({
      type: 'meeting_invitation',
      to: recipient,
      subject: `Invitation Meetra · ${title}`,
      text,
      meta: {
        roomId,
        joinUrl,
        title,
        scheduledFor,
        timezone,
        hostName,
      },
    });

    return {
      email: recipient,
      delivered: delivery.delivered,
      simulated: delivery.simulated,
      provider: delivery.provider || 'unknown',
    };
  }));

  return {
    total: normalizedRecipients.length,
    delivered: results.filter((item) => item.delivered).length,
    simulated: results.filter((item) => item.simulated).length,
    recipients: results,
  };
}
