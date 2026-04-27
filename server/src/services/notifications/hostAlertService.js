import { ENV } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

async function postWebhook(url, payload) {
  if (!url) return false;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (error) {
    logger.warn('Host alert webhook failed:', error?.message);
    return false;
  }
}

export async function notifyHostWaitingGuest({
  meeting,
  roomId,
  guestName,
  joinUrl,
}) {
  const hostEmail = meeting?.metadata?.hostEmail || '';
  const hostPhone = meeting?.metadata?.hostPhone || '';
  const title = meeting?.metadata?.title || 'Réunion Meetra';
  const scheduledFor = meeting?.metadata?.scheduledFor || null;
  const timezone = meeting?.metadata?.timezone || null;
  const hostName = meeting?.metadata?.hostName || null;

  const payload = {
    type: 'meeting_waiting_guest',
    roomId,
    title,
    scheduledFor,
    timezone,
    guestName,
    joinUrl,
    hostName,
    hostEmail,
    hostPhone,
    message: `${guestName} demande l'accès à la réunion "${title}".`,
  };

  const tasks = [];
  if (hostEmail && ENV.HOST_ALERT_EMAIL_WEBHOOK_URL) {
    tasks.push(postWebhook(ENV.HOST_ALERT_EMAIL_WEBHOOK_URL, payload));
  }
  if (hostPhone && ENV.HOST_ALERT_SMS_WEBHOOK_URL) {
    tasks.push(postWebhook(ENV.HOST_ALERT_SMS_WEBHOOK_URL, payload));
  }

  if (!tasks.length) return false;
  const results = await Promise.allSettled(tasks);
  return results.some((result) => result.status === 'fulfilled' && result.value === true);
}
