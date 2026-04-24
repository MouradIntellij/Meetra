const electronAPI = window.electronAPI;

const electronPlatform = {
    kind: 'electron',
    isElectron: true,
    isDesktop: true,
    async getRuntimeInfo() {
        return electronAPI?.getRuntimeInfo?.() || {
            kind: 'electron',
            platform: 'unknown',
            versions: {},
        };
    },
    async getScreenSources(options) {
        return electronAPI?.getScreenSources?.(options) || [];
    },
    async getShareStream({ sourceId, withAudio = false, optimize = 'detail' }) {
        if (!sourceId) return null;

        const frameRate = optimize === 'motion' ? { ideal: 30, max: 60 } : { ideal: 15, max: 30 };

        return navigator.mediaDevices.getUserMedia({
            audio: withAudio
                ? {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: sourceId,
                    },
                }
                : false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    minWidth: 1280,
                    minHeight: 720,
                    maxWidth: 3840,
                    maxHeight: 2160,
                    minFrameRate: frameRate.ideal,
                    maxFrameRate: frameRate.max,
                },
            },
        });
    },
    showPresenterToolbar(meta) {
        return electronAPI?.showPresenterToolbar?.(meta);
    },
    updatePresenterToolbar(meta) {
        return electronAPI?.updatePresenterToolbar?.(meta);
    },
    hidePresenterToolbar() {
        return electronAPI?.hidePresenterToolbar?.();
    },
    onPresenterCommand(listener) {
        return electronAPI?.onPresenterCommand?.(listener) || (() => {});
    },
    async notify(payload) {
        return electronAPI?.notify?.(payload) || false;
    },
    async openExternal(url) {
        return electronAPI?.openExternal?.(url);
    },
};

export default electronPlatform;
