# Déploiement Public Meetra

Objectif: permettre à un testeur distant de créer une salle, inviter des personnes et utiliser la logique actuelle de Meetra sans Docker local.

## Architecture cible

- `Frontend web`: Vercel
- `API + Socket.IO`: Render
- `Base de données`: Neon Postgres
- `Redis temps réel`: Upstash Redis, Redis Cloud ou Render Key Value
- `SFU optionnelle`: LiveKit Cloud ou LiveKit self-hosted
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
VITE_MEDIA_BACKEND=p2p
```

Notes:

- `VITE_API_URL` doit pointer vers Render
- `VITE_PUBLIC_JOIN_BASE_URL` doit correspondre au domaine public du frontend
- `VITE_TURN_*` est indispensable pour les médias entre réseaux différents
- `VITE_MEDIA_BACKEND=p2p` garde le mode actuel; `livekit` préparera le client au mode SFU quand l'intégration UI sera activée

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
DATABASE_URL=postgresql://user:password@ep-example.us-east-1.aws.neon.tech/dbname?sslmode=require
DATABASE_SSL=require
REDIS_URL=redis://default:password@your-redis-host:6379
REDIS_SOCKET_ADAPTER=auto
LIVEKIT_ENABLED=false
LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_TOKEN_TTL_SECONDS=3600
```

Notes:

- `DATABASE_URL` est requis pour l'authentification hôte en production
- utilisez l'URL Neon avec `sslmode=require`, par exemple `postgresql://...neon.tech/...?...sslmode=require`
- `DATABASE_SSL=require` force SSL si l'URL fournie ne contient pas explicitement `sslmode=require`
- `REDIS_URL` active le Redis adapter Socket.IO; sans cette variable, Meetra garde l'adapter mémoire local
- `REDIS_SOCKET_ADAPTER=auto` active Redis seulement quand `REDIS_URL` existe; utilisez `disabled` pour forcer le mode mémoire
- `LIVEKIT_ENABLED=false` garde la vidéo P2P actuelle; passez à `true` seulement quand le projet LiveKit est prêt
- `LIVEKIT_URL`, `LIVEKIT_API_KEY` et `LIVEKIT_API_SECRET` viennent de LiveKit Cloud ou d'un serveur LiveKit self-hosted
- sans `DATABASE_URL`, l'inscription et la connexion hôte ne seront pas fiables en public
- `NOTIFICATION_EMAIL_WEBHOOK_URL` est optionnel; sans lui, les invitations sont journalisées localement mais pas réellement envoyées

## Redis temps réel

Redis sert au temps réel applicatif, pas au stockage permanent. Neon garde les données durables, tandis que Redis permet à Socket.IO de partager ses événements entre plusieurs instances backend.

Ce qui est activé dans cette étape:

- adapter Redis Socket.IO via `@socket.io/redis-adapter`;
- diffusion des événements entre instances Render;
- fallback automatique vers l'adapter mémoire si `REDIS_URL` est absent ou inaccessible.

Ce qui reste en évolution:

- déplacer progressivement la présence live, la waiting room et l'état runtime des rooms vers Redis;
- garder Neon pour les comptes, meetings, hub, transcripts et historiques.

Variables Render:

```env
REDIS_URL=redis://default:password@your-redis-host:6379
REDIS_SOCKET_ADAPTER=auto
```

Fournisseurs possibles:

- Upstash Redis;
- Redis Cloud;
- Render Key Value;
- un Redis managé équivalent.

## SFU LiveKit optionnelle

Le mode vidéo actuel reste WebRTC P2P. LiveKit est ajouté comme fondation SFU optionnelle pour supporter plus de participants plus tard, sans supprimer ce qui fonctionne.

Ce qui est préparé:

- SDK serveur `livekit-server-sdk`;
- route `GET /api/livekit/status`;
- route `POST /api/livekit/token`;
- SDK client `livekit-client`, chargé dynamiquement seulement si demandé;
- vue séparée `LiveKitRoomView` avec fallback vers `VideoGrid` P2P;
- variable frontend `VITE_MEDIA_BACKEND`;
- variables backend LiveKit.

Ce qui reste volontairement inchangé:

- les réunions utilisent encore le mode P2P par défaut;
- le lobby, la waiting room, les contrôles hôte et le chat ne sont pas remplacés;
- `LIVEKIT_ENABLED=false` empêche l'utilisation accidentelle d'une SFU non configurée.

Variables backend Render:

```env
LIVEKIT_ENABLED=false
LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_TOKEN_TTL_SECONDS=3600
```

Variable frontend Vercel:

```env
VITE_MEDIA_BACKEND=p2p
```

Pour activer réellement le mode SFU dans une prochaine étape:

1. créer un projet LiveKit Cloud ou déployer LiveKit;
2. remplir les variables `LIVEKIT_*` dans Render;
3. passer `LIVEKIT_ENABLED=true`;
4. passer `VITE_MEDIA_BACKEND=livekit` dans Vercel;
5. tester la vue LiveKit dédiée; si elle échoue, Meetra revient automatiquement vers P2P.

## Base de données Neon

Neon remplace Render Postgres sans changer le code applicatif: Meetra reste une application Postgres standard via `DATABASE_URL`.

Procédure conseillée:

1. Créer un projet Neon.
2. Créer ou garder la base par défaut.
3. Copier la connection string Node.js depuis Neon, idéalement l'URL pooled si le backend peut ouvrir plusieurs connexions.
4. Vérifier que l'URL contient `sslmode=require`.
5. Dans Render, remplacer l'ancienne variable `DATABASE_URL` Render par l'URL Neon.
6. Ajouter `DATABASE_SSL=require`.
7. Redéployer le backend Render.
8. Tester inscription, connexion, création de réunion, historique, Hub et transcription.

Les tables sont créées automatiquement au premier accès par les stores Postgres du serveur:

- `users`
- `meetings`
- `hub_profiles`
- `hub_messages`
- `hub_activities`
- `meeting_transcripts`
- `transcript_segments`

Si vous aviez déjà des données importantes dans Render Postgres, exportez-les avant suppression avec `pg_dump`, puis importez-les dans Neon avec `psql`.

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
- configurer `DATABASE_URL` avec l'URL Neon
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
