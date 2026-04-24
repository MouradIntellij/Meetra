import browserPlatform from './browserPlatform.js';
import electronPlatform from './electronPlatform.js';

const hasElectronBridge = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);

export const platform = hasElectronBridge ? electronPlatform : browserPlatform;

export function isElectronRuntime() {
    return platform.isElectron;
}
