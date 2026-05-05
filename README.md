# Meetra - Plateforme de visioconference Zoom-like

Meetra est une application de visioconference complete inspiree de Zoom, Google Meet et Microsoft Teams. Le projet permet de creer, planifier et rejoindre des reunions video en temps reel avec salle d'attente, controle hote, chat, partage d'ecran, reactions, tableau blanc, transcription, resumes IA, invitations et mode desktop Electron.

Ce projet a ete realise dans le cadre de TT4 Winter 2026 au LaSalle College. Il sert a demontrer une architecture web temps reel moderne autour de React, Node.js, Socket.IO, WebRTC, persistance hybride, deploiement cloud, TURN/STUN et integration IA.

## Objectif du projet

L'objectif est de construire une solution de visioconference utilisable de bout en bout, pas seulement une maquette d'interface. Meetra couvre le cycle complet d'une reunion:

- creer un compte et ouvrir une session Meetra;
- creer une reunion instantanee ou planifiee;
- inviter des participants avec un lien public, email ou fichier calendrier `.ics`;
- passer par un lobby audio/video avant l'entree;
- gerer une salle d'attente avec admission par l'hote;
- communiquer en video/audio WebRTC;
- utiliser les outils collaboratifs: chat, reactions, main levee, tableau blanc, salles de groupe;
- partager son ecran et enregistrer la session;
- generer des transcriptions, traductions et resumes;
- conserver les donnees localement en developpement ou dans Postgres en production;
- deployer le client, le serveur et le TURN sur des environnements separes.

## Pitch de presentation

Meetra est une application de visioconference moderne qui reproduit les fonctionnalites essentielles d'une plateforme Zoom-like. Le frontend React propose une experience complete: accueil, tableau de bord, creation de reunion, lobby, salle d'attente et interface de reunion. Le backend Node/Express expose des API REST pour l'authentification, les reunions, les invitations, le hub et les transcriptions. Socket.IO assure la communication temps reel et la signalisation WebRTC. Une fois la connexion etablie, les flux audio/video passent directement entre navigateurs en peer-to-peer. Le projet integre aussi Electron pour une version desktop, coturn pour les reseaux restrictifs, OpenAI pour l'IA de reunion, et Postgres pour la persistance production.

## Fonctionnalites principales

| Domaine | Fonctionnalites |
|---|---|
| Accueil et compte | connexion, inscription, profil, contacts rapides, historique, recherche |
| Reunions | creation instantanee, planification, lien public, invitation email, export calendrier `.ics` |
| Lobby | previsualisation camera/micro, entree comme hote ou invite |
| Salle d'attente | attente invite, admission/refus par l'hote, alertes webhook email/SMS possibles |
| Video temps reel | audio/video WebRTC, grille automatique, mode spotlight, indicateur reseau |
| Controle media | micro, camera, partage d'ecran, selection de source, arriere-plan virtuel |
| Collaboration | chat, panneau participants, reactions, main levee, tableau blanc collaboratif |
| Controle hote | verrouillage de salle, mute all, expulsion, transfert d'hote, co-animation selon contexte |
| Salles de groupe | creation, rejoindre une salle, fin des breakout rooms |
| Enregistrement | capture locale via MediaRecorder et telechargement `.webm` |
| Transcription | sous-titres, panneau transcript, stockage, audit, retention |
| IA | transcription OpenAI optionnelle, resume de reunion, extraction decisions/actions/risques, traduction |
| Campus Hub | profils, presence, activite, conversations et messages |
| Desktop | application Electron avec preload securise et configuration runtime |
| Deploiement | Vercel pour le client, Render pour le serveur, Neon Postgres, coturn, Docker Compose |

## Parcours utilisateur

1. L'utilisateur ouvre Meetra et se connecte.
2. Il cree une reunion instantanee ou planifie une reunion avec titre, duree, horaire et invites.
3. Meetra genere un identifiant de salle et un lien public `/room/:roomId`.
4. L'hote entre dans le lobby, verifie sa camera et son micro, puis rejoint la salle.
5. Les invites ouvrent le lien, entrent leur nom, passent par le lobby puis arrivent en salle d'attente.
6. L'hote accepte ou refuse les invites.
7. Dans la reunion, les participants utilisent la video, le micro, le chat, le partage d'ecran, les reactions, la main levee et le tableau blanc.
8. L'hote peut verrouiller la salle, couper tous les micros, expulser un participant ou creer des salles de groupe.
9. Les transcriptions et resumes peuvent etre consultes et sauvegardes selon la configuration.

## Architecture generale

Meetra est organise en monorepo npm avec deux workspaces principaux:

```text
videoconf-step7/
├── client/                  # Frontend React + Vite + Tailwind
├── server/                  # Backend Node.js + Express + Socket.IO
├── electron/                # Shell desktop Electron
├── coturn/                  # Configuration TURN/STUN
├── examples/                # Exemple de webhook d'alerte hote
├── scripts/                 # Scripts de developpement
├── docker-compose.coturn.yml
├── render.yaml
├── vercel.json
└── package.json             # Workspaces et scripts racine
```

### Client React

Le client contient l'experience utilisateur:

- `client/src/App.jsx`: orchestration des ecrans accueil, lobby, salle d'attente et room;
- `client/src/pages/Home.jsx`: tableau de bord, creation, rejoindre, planification, contacts;
- `client/src/pages/Lobby.jsx`: previsualisation audio/video avant entree;
- `client/src/pages/WaitingRoom.jsx`: ecran d'attente pour les invites;
- `client/src/pages/Room.jsx`: interface principale de visioconference;
- `client/src/context/*`: etats globaux Socket, Room, Media, UI et Transcription;
- `client/src/hooks/useWebRTC.js`: orchestration WebRTC et evenements Socket.IO;
- `client/src/components/*`: video grid, control bar, chat, participants, tableau blanc, transcription, reactions.

### Serveur Node.js

Le serveur joue trois roles:

- API REST avec Express: authentification, reunions, invitations, hub, transcriptions;
- serveur Socket.IO: signalisation WebRTC et evenements temps reel;
- couche services: persistance, notifications, IA, transcription, resume, hub et auth.

Fichiers importants:

- `server/src/index.js`: demarrage HTTP + Socket.IO;
- `server/src/app.js`: routes REST;
- `server/src/socket/index.js`: initialisation Socket.IO;
- `server/src/socket/handlers/*`: logique temps reel par domaine;
- `server/src/rooms/roomService.js`: logique metier des salles;
- `server/src/services/auth/*`: utilisateurs, sessions et mots de passe;
- `server/src/services/meetings/*`: stockage des reunions;
- `server/src/services/transcription/*`: stockage, audit, IA, resume, traduction;
- `server/src/services/hub/*`: Campus Hub, presence, activite, messages.

## Flux technique WebRTC

Meetra utilise WebRTC en mode mesh peer-to-peer. Le serveur ne transporte pas les flux audio/video; il sert surtout a mettre les participants en relation.

```text
Participant A rejoint la salle
  -> Socket.IO: join-room
  -> serveur: ajoute A a la room
  -> serveur: informe les autres participants

Participant B rejoint la salle
  -> A et B creent chacun une RTCPeerConnection
  -> B envoie une offer via Socket.IO
  -> A repond avec une answer via Socket.IO
  -> A et B echangent les ICE candidates
  -> la connexion WebRTC est etablie
  -> audio/video passent directement entre les navigateurs
```

Technologies WebRTC utilisees:

- `navigator.mediaDevices.getUserMedia`: recuperation camera/micro;
- `navigator.mediaDevices.getDisplayMedia`: partage d'ecran;
- `RTCPeerConnection`: connexion peer-to-peer;
- `RTCSessionDescription`: offer/answer;
- `RTCIceCandidate`: negociation reseau;
- STUN/TURN: decouverte d'adresse et relais en reseau restrictif;
- `MediaRecorder`: enregistrement local;
- Web Audio API: niveau audio et detection du locuteur actif;
- Canvas API: rendu video transforme et tableau blanc.

## Signalisation Socket.IO

Socket.IO est utilise pour tous les evenements temps reel qui ne sont pas les flux audio/video eux-memes:

| Categorie | Evenements |
|---|---|
| Salle | `join-room`, `leave-room`, `room-joined`, `room-participants`, `user-joined`, `user-left` |
| WebRTC | `offer`, `answer`, `ice-candidate` |
| Media | `screen-share-start`, `screen-share-stop`, `audio-level`, `recording-start`, `recording-stop` |
| Chat | `chat-message` |
| Interactions | `reaction`, `raise-hand` |
| Hote | `mute-all`, `kick-user`, `lock-room`, `assign-host` |
| Breakout | `breakout-create`, `breakout-join`, `breakout-end` |
| Salle d'attente | `waiting-room-guest`, `admit-guest`, `deny-guest`, `guest-admitted`, `guest-denied` |

## API REST principale

| Route | Role |
|---|---|
| `GET /health` | verifier que le serveur fonctionne |
| `POST /api/auth/register` | creer un compte Meetra |
| `POST /api/auth/login` | ouvrir une session |
| `POST /api/rooms` | creer une reunion |
| `GET /api/rooms/:roomId` | lire les informations d'une reunion |
| `PATCH /api/rooms/:roomId` | modifier une reunion |
| `GET /api/meetings` | lister les reunions du compte |
| `GET /api/rooms/:roomId/participants` | voir les participants connectes |
| `GET /api/rooms/:roomId/waiting` | voir la file d'attente |
| `POST /api/rooms/:roomId/invitations` | envoyer des invitations |
| `/api/hub/*` | profils, presence, activite, messages |
| `/api/transcriptions/*` | segments, resumes, acces transcript |

## Technologies et notions etudiees

| Technologie | Utilisation dans Meetra | Notions etudiees |
|---|---|---|
| React 18 | interface utilisateur SPA | composants, props, state, hooks, rendu conditionnel |
| Vite | serveur dev et build frontend | bundling moderne, variables `import.meta.env` |
| Tailwind CSS | styles rapides et responsive | classes utilitaires, layout, theming |
| Context API | etat global client | separation Socket, Media, Room, UI, Transcription |
| Custom Hooks | logique reutilisable | `useWebRTC`, `useScreenShare`, `useRecording`, `useActiveSpeaker` |
| WebRTC | audio/video peer-to-peer | offer/answer, ICE, STUN/TURN, tracks media |
| Socket.IO | temps reel et signalisation | rooms, broadcast, evenements client/serveur |
| Node.js | runtime backend | modules ES, services, configuration |
| Express | API REST | routes, middleware, JSON, CORS |
| PostgreSQL / Neon | persistance production | stockage utilisateurs, reunions, hub, transcripts |
| Fichiers JSON | persistance locale dev | fallback sans base de donnees |
| `pg` | client Postgres Node | connexion DB et requetes serveur |
| `dotenv` | configuration | variables d'environnement locales et production |
| CORS | securite API | origines autorisees client/serveur |
| Crypto Node | auth locale | hash `scrypt`, HMAC, token de session |
| OpenAI API | IA de reunion | transcription, resume structure, traduction |
| MediaRecorder | enregistrement | capture et telechargement `.webm` |
| Web Audio API | audio level | detection volume et locuteur actif |
| Canvas API | tableau blanc et video | dessin collaboratif, capture stream |
| TensorFlow.js + BodyPix | fond virtuel | segmentation personne, blur, image, couleur |
| Electron | application desktop | main process, preload, IPC, runtime config |
| coturn | serveur TURN/STUN | relais media pour reseaux restrictifs |
| Docker Compose | infra locale TURN | service coturn reproductible |
| Vercel | deploiement client | SPA React, rewrites |
| Render | deploiement serveur | Node service, variables d'environnement |
| Neon | base Postgres managée | stockage persistant separe du serveur Render |
| Webhooks | notifications | alertes hote email/SMS, exemple Brevo/Resend |
| LocalStorage | session client | token, profil, contacts |
| ICS / mailto | invitations | calendrier et email depuis le navigateur |

## Persistance des donnees

Meetra utilise un modele hybride:

- en developpement, le projet peut fonctionner sans Postgres avec des fichiers JSON;
- en production, Postgres est attendu pour l'authentification, le hub, les reunions et les transcriptions;
- si une fonctionnalite critique a besoin de base de donnees en production et que `DATABASE_URL` manque, le serveur renvoie une erreur au lieu d'ecrire silencieusement sur le disque.

Fichiers de donnees locaux en developpement:

```text
server/server/data/auth/users.json
server/server/data/hub/hub.json
server/server/data/meetings/*.json
server/server/data/transcripts/*.json
```

## IA, transcription et resume

Le module de transcription est configurable:

- `TRANSCRIPTION_PROVIDER=browser`: transcription geree cote navigateur quand disponible;
- `TRANSCRIPTION_PROVIDER=openai`: envoi de chunks audio a l'API OpenAI;
- `SUMMARY_PROVIDER=heuristic`: resume local heuristique;
- `SUMMARY_PROVIDER=openai`: resume structure avec modele OpenAI.

Le resume IA produit une structure orientee reunion:

- vue d'ensemble;
- intervenants;
- decisions;
- actions a faire;
- risques;
- moments importants.

Les transcriptions ont aussi une logique de retention et d'audit via les services `transcriptPersistenceService`, `transcriptStore`, `transcriptAuditService` et `transcriptAccessService`.

## Securite et controle d'acces

Meetra inclut plusieurs couches de securite applicative:

- mots de passe hashes avec `crypto.scryptSync`;
- tokens de session signes par HMAC;
- routes protegees par Bearer token;
- verification du proprietaire ou de l'hote avant modification d'une reunion;
- CORS configure selon l'environnement;
- salle d'attente pour controler l'entree;
- verrouillage de salle;
- expulsion participant;
- webhook protege par secret `x-meetra-webhook-secret`;
- configuration separee dev/prod avec `.env`.

## Installation locale

Prerquis:

- Node.js 18 ou plus;
- npm;
- un navigateur moderne avec support WebRTC;
- optionnel: PostgreSQL pour tester la persistance production;
- optionnel: Docker pour lancer coturn.

Installation:

```bash
npm install
```

Lancer le client et le serveur:

```bash
npm run dev
```

URLs locales:

```text
Backend  : http://localhost:4000
Frontend : http://localhost:5173
```

Build client:

```bash
npm run build
```

Lancer le serveur seul:

```bash
npm start
```

Lancer le mode desktop Electron:

```bash
npm run dev:desktop
```

Construire l'application desktop:

```bash
npm run build:desktop
```

## Variables d'environnement

### Client local

`client/.env.local`

```env
VITE_API_URL=http://localhost:4000
VITE_PUBLIC_JOIN_BASE_URL=http://localhost:5173
```

### Serveur local

`server/.env` ou `.env.local`

```env
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
SESSION_SECRET=meetra-dev-session-secret
```

### Production serveur

```env
NODE_ENV=production
CLIENT_URL=https://votre-client.vercel.app
CORS_ALLOWED_ORIGINS=https://votre-client.vercel.app
DATABASE_URL=postgresql://user:password@ep-example.us-east-1.aws.neon.tech/dbname?sslmode=require
DATABASE_SSL=require
SESSION_SECRET=change-me

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_TRANSLATION_MODEL=gpt-4.1-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
TRANSCRIPTION_PROVIDER=browser
SUMMARY_PROVIDER=heuristic

HOST_ALERT_EMAIL_WEBHOOK_URL=
HOST_ALERT_SMS_WEBHOOK_URL=
HOST_ALERT_WEBHOOK_SECRET=
NOTIFICATION_EMAIL_WEBHOOK_URL=
NOTIFICATION_WEBHOOK_SECRET=
```

### Production client

```env
VITE_API_URL=https://votre-serveur.onrender.com
VITE_PUBLIC_JOIN_BASE_URL=https://votre-client.vercel.app
```

## Deploiement

### Client sur Vercel

Configurer le projet Vercel sur le dossier `client` et ajouter:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Variables Vercel:

```env
VITE_API_URL=https://votre-serveur.onrender.com
VITE_PUBLIC_JOIN_BASE_URL=https://votre-client.vercel.app
```

### Serveur sur Render

Configuration Render:

```text
Root Directory : server
Build Command  : npm install
Start Command  : npm start
```

Variables Render minimales:

```env
NODE_ENV=production
CLIENT_URL=https://votre-client.vercel.app
DATABASE_URL=postgresql://user:password@ep-example.us-east-1.aws.neon.tech/dbname?sslmode=require
DATABASE_SSL=require
SESSION_SECRET=change-me
```

### Base de donnees Neon

Pour Meetra, Neon est le remplacement recommande a Render Postgres: le backend reste sur Render, mais la persistance est deplacee vers une base Postgres managée externe.

Le code utilise uniquement `DATABASE_URL`, donc il n'y a pas de changement fonctionnel dans l'application:

- comptes utilisateurs;
- reunions et planning;
- invitations;
- historique;
- transcriptions et resumes;
- Hub, messages et activites.

Configuration:

1. Creer un projet Neon.
2. Copier l'URL de connexion Postgres, de preference l'URL pooled si disponible.
3. Verifier que l'URL contient `sslmode=require`.
4. Dans Render, remplacer l'ancien `DATABASE_URL` par l'URL Neon.
5. Ajouter `DATABASE_SSL=require`.
6. Redeployer le backend.
7. Tester: inscription, connexion, creation de reunion, historique, Hub et transcription.

Les tables Meetra sont creees automatiquement au premier acces par le serveur Node. Si des donnees existent deja dans Render Postgres, il faut les exporter avant suppression puis les importer dans Neon.

### TURN avec coturn

Un TURN est utile quand les participants sont derriere des NAT, pare-feu ou reseaux d'entreprise qui bloquent la connexion directe WebRTC.

```bash
docker compose -f docker-compose.coturn.yml up -d
```

La configuration se trouve dans:

```text
coturn/turnserver.conf
coturn/users.txt
```

Dans le client, la configuration ICE se branche dans `client/src/utils/peer.js`.

## Demo conseillee pour une presentation

1. Presenter l'objectif: "Meetra est une plateforme de visioconference Zoom-like construite avec React, Node, Socket.IO et WebRTC."
2. Ouvrir l'accueil et montrer le tableau de bord.
3. Creer un compte ou se connecter.
4. Creer une reunion instantanee.
5. Copier le lien et l'ouvrir dans un deuxieme navigateur ou onglet prive.
6. Montrer le lobby camera/micro.
7. Faire entrer l'invite en salle d'attente.
8. Depuis l'hote, admettre l'invite.
9. Montrer la video, le chat, la main levee, les reactions et le panneau participants.
10. Tester le partage d'ecran.
11. Tester le tableau blanc.
12. Montrer un controle hote: mute all, lock room ou kick.
13. Ouvrir le panneau transcript/resume si la configuration IA est active.
14. Expliquer le flux WebRTC: Socket.IO signale, WebRTC transporte les medias.
15. Terminer avec le deploiement: Vercel, Render, Postgres, coturn et Electron.

## Tests manuels des fonctionnalites

| Fonctionnalite | Comment tester |
|---|---|
| Creer une reunion | Accueil -> Nouvelle reunion |
| Rejoindre une reunion | Copier le lien puis ouvrir un autre navigateur |
| Lobby | Verifier camera et micro avant entree |
| Salle d'attente | Inviter un participant sans acces hote |
| Admission | Hote accepte l'invite dans le panneau salle d'attente |
| Audio/video | Deux onglets ou deux appareils sur la meme salle |
| Chat | Envoyer un message depuis un participant |
| Micro/camera | Utiliser les boutons de la barre de controle |
| Partage ecran | Cliquer sur partager l'ecran |
| Enregistrement | Demarrer puis arreter l'enregistrement |
| Reactions | Envoyer une reaction et verifier l'overlay |
| Main levee | Lever la main et verifier le badge hote |
| Participants | Ouvrir le panneau participants |
| Controle hote | Verrouiller, mute all ou expulser |
| Breakout rooms | Creer une salle de groupe et y rejoindre |
| Tableau blanc | Dessiner depuis un participant et observer la synchro |
| Transcription | Activer la transcription selon la configuration |
| Invitation email | Ajouter un destinataire dans le panneau invitation |
| Fichier calendrier | Telecharger l'invitation `.ics` |
| Desktop | Lancer `npm run dev:desktop` |

## Limites actuelles et ameliorations possibles

Le mode WebRTC actuel est un mesh peer-to-peer. Il est simple, pedagogique et efficace pour un petit groupe, mais il devient couteux quand le nombre de participants augmente, car chaque navigateur doit envoyer son flux a plusieurs autres navigateurs.

Ameliorations possibles:

- remplacer le mesh par une SFU comme mediasoup ou LiveKit pour supporter de grandes reunions;
- ajouter Redis pour partager l'etat temps reel entre plusieurs instances serveur;
- ajouter une vraie politique de roles avancee: hote, co-hote, participant, invite;
- ajouter un systeme de moderation et de rapports;
- ajouter des tests automatises frontend/backend;
- renforcer la gestion des erreurs WebRTC;
- ajouter un pipeline CI/CD complet;
- ajouter stockage cloud des enregistrements;
- ajouter sous-titres multi-langues plus avances.

## Depannage rapide

| Probleme | Cause probable | Solution |
|---|---|---|
| Erreur CORS | `CLIENT_URL` ou `CORS_ALLOWED_ORIGINS` incorrect | verifier les URLs sans slash final |
| Le client ne rejoint pas le serveur | `VITE_API_URL` incorrect | pointer vers le backend Render ou localhost |
| Camera/micro bloques | permission navigateur refusee | autoriser camera/micro et recharger |
| Video absente entre deux reseaux | NAT ou pare-feu restrictif | configurer un serveur TURN |
| Creation reunion refusee | utilisateur non connecte | se connecter avant de creer |
| Production sans donnees | `DATABASE_URL` absent | configurer Neon Postgres dans Render |
| IA inactive | cle OpenAI absente ou provider heuristic/browser | configurer `OPENAI_API_KEY` et les providers |

## Resume technique final

Meetra demontre une architecture complete de visioconference:

- React/Vite pour l'interface;
- Context API et hooks pour l'etat applicatif;
- Express pour les API;
- Socket.IO pour le temps reel;
- WebRTC pour les flux media;
- Neon/Postgres ou JSON local pour la persistance;
- OpenAI pour les fonctions IA;
- Electron pour le desktop;
- coturn pour les connexions reseau difficiles;
- Vercel et Render pour le deploiement cloud.

Le point central du projet est la separation des responsabilites: le serveur coordonne, authentifie, stocke et signale; le navigateur capture et transporte les medias; WebRTC assure la communication audio/video; les services annexes ajoutent l'IA, les notifications, le hub et la persistence.

---

Mourad Sehboub - TT4 Winter 2026 - LaSalle College
