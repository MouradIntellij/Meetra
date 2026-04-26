const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    config: {
        apiUrl: process.env.APP_API_URL || process.env.VITE_API_URL || '',
        publicJoinBaseUrl: process.env.APP_PUBLIC_JOIN_BASE_URL || process.env.VITE_PUBLIC_JOIN_BASE_URL || '',
    },
    getRuntimeInfo: () => ipcRenderer.invoke('platform:get-runtime-info'),
    getScreenSources: (options) => ipcRenderer.invoke('screen:get-sources', options),
    showPresenterToolbar: (meta) => ipcRenderer.invoke('presenter:show', meta),
    updatePresenterToolbar: (meta) => ipcRenderer.invoke('presenter:update', meta),
    hidePresenterToolbar: () => ipcRenderer.invoke('presenter:hide'),
    presenterCommand: (command) => ipcRenderer.invoke('presenter:command', command),
    onPresenterCommand: (listener) => {
        const handler = (_event, payload) => listener(payload);
        ipcRenderer.on('presenter:command', handler);
        return () => ipcRenderer.removeListener('presenter:command', handler);
    },
    onPresenterState: (listener) => {
        const handler = (_event, payload) => listener(payload);
        ipcRenderer.on('presenter:state', handler);
        return () => ipcRenderer.removeListener('presenter:state', handler);
    },
    notify: (payload) => ipcRenderer.invoke('system:notify', payload),
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
});
