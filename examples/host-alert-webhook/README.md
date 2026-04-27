# Meetra Host Alert Webhook

Petit service webhook pour recevoir les alertes `meeting_waiting_guest` envoyées par Meetra quand un invité attend dans la salle d'attente.

## Démarrage

```bash
cd examples/host-alert-webhook
npm install
npm run dev
```

Le service écoute par défaut sur `http://localhost:3005`.

## Endpoints

- `POST /meetra-email`
- `POST /meetra-sms`
- `GET /health`

## Variables d'environnement

Copiez `.env.example` puis configurez au minimum:

```env
PORT=3005
MEETRA_WEBHOOK_SECRET=change-me
EMAIL_PROVIDER=log
```

Modes supportés pour `EMAIL_PROVIDER`:

- `log`: journalise l'alerte sans envoyer d'email
- `brevo`: envoie un email via l'API Brevo
- `resend`: envoie un email via l'API Resend

## Payload reçu

```json
{
  "type": "meeting_waiting_guest",
  "roomId": "ba24c9ed-a429-4b99-b2df-9ee95d136efb",
  "title": "Rencontre de suivi TT4",
  "scheduledFor": "2026-04-28T13:00:00.000Z",
  "timezone": "America/Toronto",
  "guestName": "Alice Tremblay",
  "joinUrl": "https://meetra-client.vercel.app/room/ba24c9ed-a429-4b99-b2df-9ee95d136efb",
  "hostName": "Prof Martin",
  "hostEmail": "prof@college.ca",
  "hostPhone": "+15145551234",
  "message": "Alice Tremblay demande l'accès à la réunion \"Rencontre de suivi TT4\"."
}
```

## Sécurité

Si `MEETRA_WEBHOOK_SECRET` est défini, le service exige l'en-tête:

```text
x-meetra-webhook-secret: <votre secret>
```

## Exemple Render

Dans Meetra:

```env
HOST_ALERT_EMAIL_WEBHOOK_URL=https://votre-webhook.onrender.com/meetra-email
HOST_ALERT_SMS_WEBHOOK_URL=https://votre-webhook.onrender.com/meetra-sms
HOST_ALERT_WEBHOOK_SECRET=change-me
```

Dans le service webhook:

```env
MEETRA_WEBHOOK_SECRET=change-me
EMAIL_PROVIDER=brevo
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=notifications@votredomaine.com
BREVO_SENDER_NAME=Meetra
```

## Note SMS

`/meetra-sms` est volontairement un stub. Il journalise la demande mais n'envoie pas de SMS réel tant qu'un fournisseur payant n'est pas branché.
