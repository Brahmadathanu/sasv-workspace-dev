// public/shared/js/platform.js
export const Platform = {
  get isElectron() {
    return !!(window.electronAPI || navigator.userAgent.includes("Electron"));
  },
  get isIframe() {
    try {
      return window.top !== window.self;
    } catch {
      return true;
    }
  },
  get isPWA() {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone ||
      false
    );
  },
  goHome() {
    if (this.isElectron) {
      window.location.href = "../../index.html";
    } else {
      // Always go to /utilities-hub/index.html from web root
      window.location.href = "/utilities-hub/index.html";
    }
  },
};
