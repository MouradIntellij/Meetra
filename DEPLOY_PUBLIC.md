# Déploiement Public Meetra

Objectif: permettre à un testeur distant de créer une salle, inviter des personnes et utiliser la logique actuelle de Meetra sans Docker local.

## Architecture cible

- `Frontend web`: Vercel
- `API + Socket.IO`: Render
- `Base de données`: Postgres Render
- `TURN public`: VPS Ubuntu avec coturn
- `Electron`: optionnel, en mode hybride seulement

## Ce qui reste identique dans l'application

- création de salle par un hôte authentifié
- lien public d'invitation
- invités dirigés vers la salle d'attente
- admission manuelle par l'hôte
- affichage type Teams/Zoom
- partage d'écran et caméra via WebRTC

## OpenAI

Pour la visio, l'admission et le partage d'écran, aucune clé OpenAI n'est nécessaire.

Réglages recommandés côté serveur:

```env
TRANSCRIPTION_PROVIDER=browser
SUMMARY_PROVIDER=heuristic
OPENAI_API_KEY=
```

Cela désactive proprement les fonctions cloud tout en gardant la réunion fonctionnelle.

## Variables Vercel

Projet frontend:

```env
VITE_API_URL=https://your-render-backend.onrender.com
VITE_PUBLIC_JOIN_BASE_URL=https://your-vercel-frontend.vercel.app
VITE_TURN_URL=turn:turn.example.com:3478
VITE_TURN_USERNAME=videoconf
VITE_TURN_CREDENTIAL=replace-with-your-turn-password
```

Notes:

- `VITE_API_URL` doit pointer vers Render
- `VITE_PUBLIC_JOIN_BASE_URL` doit correspondre au domaine public du frontend
- `VITE_TURN_*` est indispensable pour les médias entre réseaux différents

## Variables Render

Service API:

```env
NODE_ENV=production
CLIENT_URL=https://your-vercel-frontend.vercel.app
CORS_ALLOWED_ORIGINS=https://your-vercel-frontend.vercel.app,https://your-preview.vercel.app
SESSION_SECRET=replace-with-a-long-random-secret
MEETING_STORE_BACKEND=postgres
TRANSCRIPT_STORE_BACKEND=postgres
TRANSCRIPTION_PROVIDER=browser
SUMMARY_PROVIDER=heuristic
OPENAI_API_KEY=
HOST_ALERT_EMAIL_WEBHOOK_URL=
HOST_ALERT_SMS_WEBHOOK_URL=
HOST_ALERT_WEBHOOK_SECRET=
NOTIFICATION_EMAIL_WEBHOOK_URL=
NOTIFICATION_WEBHOOK_SECRET=
NOTIFICATION_FROM_NAME=Meetra
NOTIFICATION_FROM_EMAIL=
DATABASE_URL=postgres://...
```

Notes:

- `DATABASE_URL` est requis pour l'authentification hôte en production
- sans `DATABASE_URL`, l'inscription et la connexion hôte ne seront pas fiables en public
- `NOTIFICATION_EMAIL_WEBHOOK_URL` est optionnel; sans lui, les invitations sont journalisées localement mais pas réellement envoyées

## TURN public avec coturn

Le plus simple est un VPS Ubuntu avec IP publique.

Pré-requis:

- 1 VPS Linux public
- ports ouverts: `3478/tcp`, `3478/udp`, `49152-65535/udp`
- un domaine optionnel, par exemple `turn.example.com`

Installation rapide:

```bash
sudo apt update
sudo apt install -y coturn
```

Activer le service:

```bash
sudo sed -i 's/^#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
```

Fichier `/etc/turnserver.conf` minimal:

```conf
listening-port=3478
fingerprint
use-auth-secret=no
lt-cred-mech
realm=meetra.app
user=videoconf:replace-with-your-turn-password
external-ip=YOUR_PUBLIC_IP
no-multicast-peers
no-cli
```

Démarrer coturn:

```bash
sudo systemctl enable coturn
sudo systemctl restart coturn
sudo systemctl status coturn
```

Firewall Ubuntu:

```bash
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49152:65535/udp
```

Variables à reporter dans Vercel et Electron:

```env
VITE_TURN_URL=turn:turn.example.com:3478
VITE_TURN_USERNAME=videoconf
VITE_TURN_CREDENTIAL=replace-with-your-turn-password

APP_TURN_URL=turn:turn.example.com:3478
APP_TURN_USERNAME=videoconf
APP_TURN_CREDENTIAL=replace-with-your-turn-password
```

## Déploiement conseillé

### 1. Backend Render

- créer un service web sur le dossier `server`
- build command: `npm install`
- start command: `npm start`
- rattacher une base Postgres
- injecter les variables Render ci-dessus

### 2. Frontend Vercel

- déployer le dossier `client`
- garder `client/vercel.json`
- injecter les variables Vercel ci-dessus

### 3. TURN

- déployer `coturn` sur un VPS public
- reporter les variables `TURN` sur Vercel
- reporter aussi `APP_TURN_*` si vous gardez Electron

## Petites règles produit à conserver

- l'hôte doit créer la salle depuis un compte authentifié
- les invités n'ont pas besoin de compte pour rejoindre
- le lien d'invitation doit toujours pointer vers `/room/:roomId`
- l'admission reste obligatoire via la salle d'attente
- le partage d'écran reste géré comme un track vidéo WebRTC, pas comme un flux séparé applicatif

## Limites connues

- sans webhook email, l'invitation “envoyer par email” ne fait pas un envoi réel
- sans TURN public, caméra et partage peuvent échouer entre deux réseaux
- en mode mesh, beaucoup de participants dégraderont la qualité; pour un petit test utilisateur, c'est acceptable

## Test inter-réseaux

Scénario recommandé:

1. hôte A sur réseau 1 ouvre le frontend public
2. crée un compte puis une salle
3. copie le lien d'invitation
4. invité B sur réseau 2 ouvre le lien
5. B arrive en salle d'attente
6. A admet B
7. vérifier:
   - caméra A visible chez B
   - caméra B visible chez A
   - partage d'écran A visible chez B
   - partage d'écran B visible chez A
   - invitation par lien toujours fonctionnelle

## Sécurité

Si vous avez déjà mis des clés OpenAI réelles dans des fichiers `.env` locaux du projet, il faut les révoquer et en générer de nouvelles avant toute publication.
