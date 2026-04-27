const browserPlatform = {
    kind: 'browser',
    isElectron: false,
    isDesktop: false,
    async getRuntimeInfo() {
        return {
            kind: 'browser',
            platform: navigator.platform || 'web',
            userAgent: navigator.userAgent,
        };
    },
    async getScreenSources() {
        return [];
    },
    async getShareStream() {
        return null;
    },
    showPresenterToolbar() {},
    updatePresenterToolbar() {},
    hidePresenterToolbar() {},
    onPresenterCommand() {
        return () => {};
    },
    async notify({ title, body }) {
        if (!('Notification' in window)) return false;
        if (Notification.permission !== 'granted') return false;

        new Notification(title, { body });
        return true;
    },
    async openExternal(url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    },
    showReaction() {},
};

export default browserPlatform;
