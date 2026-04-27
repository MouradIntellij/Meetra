# VideoConf Step 7 — Guide Complet

## 🗂 Structure finale (54 fichiers)

```
videoconf-step7/
├── package.json                          # root workspaces
├── .env.example
├── .gitignore
│
├── server/
│   ├── package.json
│   └── src/
│       ├── index.js                      # bootstrap HTTP + Socket.IO
│       ├── app.js                        # Express + REST /api/rooms
│       ├── config/
│       │   ├── env.js                    # PORT, NODE_ENV, CLIENT_URL
│       │   └── cors.js                   # allowed origins DEV/PROD
│       ├── constants/
│       │   └── events.js                 # tous les noms d'événements
│       ├── rooms/
│       │   ├── roomStore.js              # in-memory Map (rooms, users)
│       │   └── roomService.js            # business logic
│       ├── socket/
│       │   ├── index.js                  # io init + register handlers
│       │   └── handlers/
│       │       ├── roomHandler.js        # join/leave/host reassign
│       │       ├── mediaHandler.js       # offer/answer/ICE/screen/audio
│       │       ├── chatHandler.js        # chat-message broadcast
│       │       ├── hostHandler.js        # mute-all/kick/lock/assign-host
│       │       ├── reactionHandler.js    # emoji + raise-hand
│       │       ├── recordingHandler.js   # recording start/stop signal
│       │       └── breakoutHandler.js    # breakout create/join/end
│       └── utils/
│           ├── logger.js                 # couleurs + timestamps
│           └── uuid.js                   # generateId / generateShortId
│
└── client/
    ├── package.json
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── app/
        │   └── _App.jsx                   # router: home → lobby → room
        ├── pages/
        │   ├── Home.jsx                  # create / join form
        │   ├── Lobby.jsx                 # camera preview pré-join
        │   └── Room.jsx                  # salle principale
        ├── context/
        │   ├── SocketContext.jsx         # socket.io instance
        │   ├── RoomContext.jsx           # participants, hostId, locked, breakouts
        │   ├── UIContext.jsx             # layout, panels, reactions
        │   └── MediaContext.jsx          # streams, WebRTC, recording
        ├── hooks/
        │   ├── useWebRTC.js             # orchestrate join + socket events
        │   ├── useScreenShare.js
        │   ├── useRecording.js
        │   └── useActiveSpeaker.js
        ├── components/
        │   ├── video/
        │   │   ├── VideoTile.jsx         # tuile unique (stream + overlay)
        │   │   ├── VideoGrid.jsx         # grille auto + spotlight mode
        │   │   └── ScreenShareView.jsx   # plein écran partage
        │   ├── chat/
        │   │   └── ChatSidebar.jsx       # sidebar droite
        │   ├── participants/
        │   │   └── ParticipantsPanel.jsx # liste + contrôles hôte par user
        │   ├── controls/
        │   │   ├── ControlBar.jsx        # barre du bas (micro/cam/share/rec...)
        │   │   ├── HostControls.jsx      # bouton 👑 + panel hôte
        │   │   └── ReactionBar.jsx       # 8 emojis rapides
        │   └── layout/
        │       ├── Whiteboard.jsx        # canvas collaboratif modal
        │       ├── BreakoutPanel.jsx     # création/join salles de groupes
        │       └── ReactionsOverlay.jsx  # emojis flottants animés
        └── utils/
            ├── events.js                 # constantes socket (mirror server)
            ├── audioLevel.js             # Web Audio API analyser
            └── peer.js                   # RTCPeerConnection factory
```

---

## ⚠️  IMPORTANTS avant déploiement

### 1. server/src/config/cors.js

Vérifiez que `cors.js` contient votre vraie URL Vercel **sans** `\n` :

```js
// server/src/config/cors.js  — déjà corrigé dans le zip
const ALLOWED_ORIGINS_PROD = [
  'https://videoconference-server-delta.vercel.app',
  ENV.CLIENT_URL,
].filter(Boolean);
```

### 2. Variables d'environnement

**Render (server)** — Settings → Environment Variables :
```
NODE_ENV=production
CLIENT_URL=https://videoconference-server-delta.vercel.app
```
> PORT est injecté automatiquement par Render, ne pas le définir manuellement.

**Vercel (client)** — Settings → Environment Variables :
```
VITE_API_URL=https://videoconference-owz3.onrender.com
```
 

### 3. Vercel — vercel.json (à créer dans /client)

Pour que Vercel serve correctement le SPA React :

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### 4. Render — Build & Start commands

Dans votre service Render :
- **Root Directory** : `server`
- **Build Command** : `npm install`
- **Start Command** : `npm start`

---

## 🚀 Installation locale

```bash
# 1. Cloner / extraire le zip
cd videoconf-step7

# 2. Installer toutes les dépendances (client + server)
npm install

# 3. Créer les fichiers .env
# client/.env.local
echo "VITE_API_URL=http://localhost:4000" > client/.env.local

# server/.env  (optionnel en local, defaults suffisent)
echo "NODE_ENV=development" > server/.env

# 4. Lancer
npm run dev
# → Backend  : http://localhost:4000
# → Frontend : http://localhost:5173
```

---

## 🧪 Test complet des fonctionnalités

| Fonctionnalité | Comment tester |
|---|---|
| Créer salle | Accueil → "Créer une nouvelle salle" |
| Rejoindre | Copier l'ID → ouvrir onglet privé |
| Lobby preview | Caméra visible avant d'entrer |
| Chat | Icône 💬 → taper un message |
| Couper micro | Bouton 🎤 dans la barre |
| Couper caméra | Bouton 📹 |
| Partage écran | Bouton 🖥️ |
| Enregistrement | Bouton ⏺️ → télécharge .webm |
| Lever main | Bouton ✋ → badge jaune sur la tuile |
| Réactions | Bouton 😀 → 8 emojis flottants |
| Grille/Spotlight | Bouton 🔲 / 📌 |
| Tableau blanc | Bouton 🎨 → canvas collaboratif |
| Hôte — Mute all | Bouton 👑 → "Couper tous les micros" |
| Hôte — Kick | Panel participants → 🚫 au survol |
| Hôte — Lock | Bouton 👑 → "Verrouiller la salle" |
| Hôte — Transfer | Panel participants → 👑 au survol |
| Salles de groupes | Bouton 👑 → "Salles de groupes" |
| Active speaker | Bordure verte sur le locuteur actif |

---

## 🏗 Architecture des flux WebRTC

```
User A ouvre la salle
  └─→ socket.emit(JOIN_ROOM)
        └─→ server: store participant, emit ROOM_PARTICIPANTS à A
        └─→ server: emit USER_JOINED à tous les autres

User B reçoit USER_JOINED
  └─→ createPeerConnection(A.socketId)
  └─→ pc.createOffer() → emit OFFER
        └─→ server: forward OFFER à A

User A reçoit OFFER
  └─→ createPeerConnection(B.socketId)
  └─→ pc.setRemoteDescription(offer)
  └─→ pc.createAnswer() → emit ANSWER
        └─→ server: forward ANSWER à B

ICE candidates échangés → P2P établi
Media streams coulent directement A ↔ B
```

---

## 🔧 Points d'extension futurs

### TURN Server (réseaux restrictifs)
```js
// Dans client/src/utils/peer.js — remplacer iceServers par :
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls:       'turn:votre-turn-server.com:3478',
    username:   'user',
    credential: 'password',
  }
]
```

### SFU (Selective Forwarding Unit) — pour 10+ participants
Remplacer le mesh P2P par **mediasoup** ou **LiveKit** :
- Chaque client envoie 1 flux → SFU
- SFU redistribue à tous
- Supprime la limite ~6 participants du mesh

### Persistance des salles (Redis)
```js
// Remplacer roomStore.js Map() par :
import { createClient } from 'redis';
const redis = createClient({ url: process.env.REDIS_URL });
```

### Authentification
Ajouter JWT avant `JOIN_ROOM` :
```js
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // verify JWT → next() ou next(new Error('Unauthorized'))
});
```

---

## 📋 Variables d'env complètes

### client/.env.local (développement)
```
VITE_API_URL=http://localhost:4000
```

### client (Vercel — production)
```
VITE_API_URL=https://videoconference-owz3.onrender.com
```

### server/.env (développement)
```
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

### server (Render — production)
```
NODE_ENV=production
CLIENT_URL=https://videoconference-server-delta.vercel.app
OPENAI_TRANSLATION_MODEL=gpt-4.1-mini
HOST_ALERT_EMAIL_WEBHOOK_URL=
HOST_ALERT_SMS_WEBHOOK_URL=
HOST_ALERT_WEBHOOK_SECRET=
```

### Alertes hôte par webhook

Quand un invité arrive dans la salle d'attente, Meetra peut envoyer un `POST` JSON à un webhook email et/ou SMS.

Exemple de configuration côté serveur Render:

```
HOST_ALERT_EMAIL_WEBHOOK_URL=https://votre-service-webhook.onrender.com/meetra-email
HOST_ALERT_SMS_WEBHOOK_URL=https://votre-service-webhook.onrender.com/meetra-sms
HOST_ALERT_WEBHOOK_SECRET=change-me
```

Un exemple prêt à déployer existe dans:

```text
examples/host-alert-webhook
```

Ce mini-service:
- accepte le JSON Meetra
- vérifie l'en-tête `x-meetra-webhook-secret`
- peut journaliser simplement les alertes
- peut envoyer un email via Brevo ou Resend
- laisse le SMS en stub tant qu'aucun fournisseur payant n'est branché

---

## ✅ Checklist déploiement

- [ ] Variables d'env Render configurées
- [ ] Variables d'env Vercel configurées + Redeploy
- [ ] `client/vercel.json` créé avec rewrite SPA
- [ ] Tester CORS : ouvrir Network tab → aucune erreur CORS
- [ ] Tester WebRTC : 2 onglets → flux vidéo visible
- [ ] Tester chat : message apparaît des deux côtés
- [ ] Tester hôte : 👑 visible, mute-all fonctionne
- [ ] Tester breakout : créer 2 salles, rejoindre

---

Mourad Sehboub — TT4 Winter 2026 — LaSalle College
