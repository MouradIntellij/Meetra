import { upsertHubProfile, appendHubActivity } from '../hub/hubStore.js';
import { deliverEmailNotification } from './emailNotificationService.js';

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
  if (hostEmail) {
    tasks.push(deliverEmailNotification({
      type: payload.type,
      to: hostEmail,
      subject: `Meetra · ${guestName} attend votre admission`,
      text: [
        `Bonjour ${hostName || 'hôte'},`,
        '',
        `${guestName} attend dans la salle d'attente de "${title}".`,
        `Lien de réunion: ${joinUrl}`,
        scheduledFor ? `Horaire prévu: ${new Intl.DateTimeFormat('fr-CA', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone || undefined }).format(new Date(scheduledFor))}` : null,
        '',
        'Ouvrez Meetra pour admettre ce participant.',
      ].filter(Boolean).join('\n'),
      meta: payload,
    }));
  }

  if (hostEmail) {
    tasks.push((async () => {
      try {
        await upsertHubProfile({ email: hostEmail, name: hostName || hostEmail });
        await appendHubActivity({
          type: 'meeting_waiting_guest',
          title: 'Participant en attente',
          body: `${guestName} attend votre admission dans "${title}".`,
          targetEmail: hostEmail,
          actorEmail: '',
          actorName: guestName,
          meta: { roomId, joinUrl, scheduledFor },
        });
        return true;
      } catch {
        return false;
      }
    })());
  }

  if (!tasks.length) return false;
  const results = await Promise.allSettled(tasks);
  return results.some((result) => result.status === 'fulfilled' && (
    result.value === true || result.value?.delivered || result.value?.simulated
  ));
}
