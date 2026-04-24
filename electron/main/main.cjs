const path = require('node:path');
const { app, BrowserWindow, ipcMain, nativeImage, Notification, shell, desktopCapturer } = require('electron');

const isDev = !app.isPackaged;
let mainWindow = null;
let presenterWindow = null;
let presenterState = null;

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
        mainWindow.loadURL('http://localhost:5173');
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
        thumbnailDataUrl: source.thumbnail?.isEmpty?.() ? null : source.thumbnail.toDataURL(),
        appIconDataUrl: source.appIcon?.isEmpty?.() ? null : source.appIcon.toDataURL(),
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
