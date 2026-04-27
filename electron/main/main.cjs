const path = require('node:path');
const { app, BrowserWindow, ipcMain, nativeImage, Notification, shell, desktopCapturer } = require('electron');

app.commandLine.appendSwitch(
    'disable-features',
    'WebRtcAllowWgcScreenCapturer,WebRtcAllowWgcWindowCapturer'
);

const isDev = !app.isPackaged;
let mainWindow = null;
let presenterWindow = null;
let reactionWindow = null;
let presenterState = null;

function getRendererEntryUrl() {
    const configuredRemoteUrl =
        process.env.APP_CLIENT_URL ||
        process.env.APP_PUBLIC_JOIN_BASE_URL ||
        '';

    if (configuredRemoteUrl) {
        return configuredRemoteUrl.replace(/\/+$/, '');
    }

    return 'http://localhost:5173';
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 1200,
        minHeight: 760,
        backgroundColor: '#030712',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload', 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    if (isDev) {
        mainWindow.loadURL(getRendererEntryUrl());
        mainWindow.webContents.openDevTools({ mode: 'detach' });
        return mainWindow;
    }

    mainWindow.loadFile(path.join(__dirname, '..', '..', 'client', 'dist', 'index.html'));
    return mainWindow;
}

async function handleGetScreenSources(_event, options = {}) {
    const { types = ['screen', 'window'], thumbnailSize = { width: 320, height: 180 } } = options;

    const sources = await desktopCapturer.getSources({
        types,
        thumbnailSize,
        fetchWindowIcons: true,
    });

    return sources.map((source) => ({
        id: source.id,
        name: source.name,
        displayId: source.display_id || null,
        thumbnailDataUrl: source.thumbnail && !source.thumbnail.isEmpty() ? source.thumbnail.toDataURL() : null,
        appIconDataUrl: source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : null,
    }));
}

function createPresenterWindow() {
    if (presenterWindow && !presenterWindow.isDestroyed()) {
        presenterWindow.show();
        presenterWindow.focus();
        return presenterWindow;
    }

    presenterWindow = new BrowserWindow({
        width: 420,
        height: 88,
        resizable: false,
        maximizable: false,
        minimizable: false,
        movable: true,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        backgroundColor: '#00000000',
        hasShadow: true,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload', 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    presenterWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    presenterWindow.loadFile(path.join(__dirname, '..', 'presenter', 'toolbar.html'));

    presenterWindow.on('closed', () => {
        presenterWindow = null;
    });

    presenterWindow.webContents.once('did-finish-load', () => {
        if (presenterState) {
            presenterWindow.webContents.send('presenter:state', presenterState);
        }
    });

    return presenterWindow;
}

function createReactionWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return null;

    if (reactionWindow && !reactionWindow.isDestroyed()) {
        return reactionWindow;
    }

    reactionWindow = new BrowserWindow({
        x: mainWindow.getBounds().x,
        y: mainWindow.getBounds().y,
        width: mainWindow.getBounds().width,
        height: mainWindow.getBounds().height,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        focusable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        hasShadow: false,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload', 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    reactionWindow.setIgnoreMouseEvents(true, { forward: true });
    reactionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    reactionWindow.loadFile(path.join(__dirname, '..', 'reactions', 'overlay.html'));
    reactionWindow.on('closed', () => {
        reactionWindow = null;
    });

    return reactionWindow;
}

function syncReactionWindowBounds() {
    if (!mainWindow || mainWindow.isDestroyed() || !reactionWindow || reactionWindow.isDestroyed()) return;
    const bounds = mainWindow.getBounds();
    reactionWindow.setBounds(bounds, false);
  }

function syncPresenterWindow() {
    if (!presenterState) {
        if (presenterWindow && !presenterWindow.isDestroyed()) {
            presenterWindow.close();
        }
        presenterWindow = null;
        return;
    }

    const win = createPresenterWindow();
    win.webContents.send('presenter:state', presenterState);
}

app.whenReady().then(() => {
    ipcMain.handle('platform:get-runtime-info', () => ({
        kind: 'electron',
        platform: process.platform,
        versions: {
            electron: process.versions.electron,
            chrome: process.versions.chrome,
            node: process.versions.node,
        },
    }));

    ipcMain.handle('screen:get-sources', handleGetScreenSources);
    ipcMain.handle('presenter:show', (_event, meta = {}) => {
        presenterState = { visible: true, ...meta };
        syncPresenterWindow();
        return true;
    });
    ipcMain.handle('presenter:update', (_event, meta = {}) => {
        presenterState = { ...(presenterState || { visible: true }), ...meta };
        syncPresenterWindow();
        return true;
    });
    ipcMain.handle('presenter:hide', () => {
        presenterState = null;
        syncPresenterWindow();
        return true;
    });
    ipcMain.handle('presenter:command', (_event, command) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('presenter:command', command);
        }
        return true;
    });

    ipcMain.handle('shell:open-external', (_event, url) => shell.openExternal(url));
    ipcMain.handle('reaction:show', (_event, payload = {}) => {
        if (!mainWindow || mainWindow.isDestroyed()) return false;
        const win = createReactionWindow();
        if (!win || win.isDestroyed()) return false;
        syncReactionWindowBounds();
        win.showInactive();
        win.webContents.send('reaction:show', payload);
        return true;
    });
    ipcMain.handle('window:minimize-main', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.minimize();
            if (reactionWindow && !reactionWindow.isDestroyed()) {
                reactionWindow.hide();
            }
            return true;
        }
        return false;
    });
    ipcMain.handle('window:restore-main', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();
            if (reactionWindow && !reactionWindow.isDestroyed()) {
                syncReactionWindowBounds();
                reactionWindow.showInactive();
            }
            return true;
        }
        return false;
    });

    ipcMain.handle('system:notify', (_event, payload = {}) => {
        if (!Notification.isSupported()) return false;

        const notification = new Notification({
            title: payload.title || 'VideoConferencePro',
            body: payload.body || '',
            icon: payload.icon ? nativeImage.createFromDataURL(payload.icon) : undefined,
        });

        notification.show();
        return true;
    });

    createMainWindow();
    mainWindow.on('move', syncReactionWindowBounds);
    mainWindow.on('resize', syncReactionWindowBounds);
    mainWindow.on('maximize', syncReactionWindowBounds);
    mainWindow.on('unmaximize', syncReactionWindowBounds);
    mainWindow.on('enter-full-screen', syncReactionWindowBounds);
    mainWindow.on('leave-full-screen', syncReactionWindowBounds);
    mainWindow.on('show', () => {
        if (reactionWindow && !reactionWindow.isDestroyed()) {
            syncReactionWindowBounds();
            reactionWindow.showInactive();
        }
    });
    mainWindow.on('hide', () => {
        if (reactionWindow && !reactionWindow.isDestroyed()) {
            reactionWindow.hide();
        }
    });
    mainWindow.on('closed', () => {
        if (reactionWindow && !reactionWindow.isDestroyed()) {
            reactionWindow.close();
        }
        reactionWindow = null;
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
