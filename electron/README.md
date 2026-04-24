# Electron Desktop Shell

Ce dossier contient le socle desktop pour `VideoConferencePro`.

## Fichiers

- `main/main.cjs` : processus principal Electron, création de fenêtre et handlers IPC.
- `preload/preload.cjs` : API sécurisée exposée au frontend React via `window.electronAPI`.

## Scripts

- `npm run dev:desktop` : lance Vite puis ouvre Electron en mode développement.
- `npm run build:desktop` : build du client puis packaging Electron.

## Prochaine étape

Brancher `client/src/services/platform/index.js` dans le sélecteur de partage pour utiliser
`desktopCapturer` et ses miniatures quand l'application tourne dans Electron.
