const isProductionBuild = import.meta.env.PROD;

export const registerServiceWorker = () => {
  if (!isProductionBuild || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('WorkLink service worker registration skipped:', error);
      });
    },
    { once: true }
  );
};
