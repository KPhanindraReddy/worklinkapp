import { isCapacitorNative } from './capacitor';

const isProductionBuild = import.meta.env.PROD;

export const registerServiceWorker = () => {
  if (
    !isProductionBuild ||
    isCapacitorNative() ||
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('Slivz service worker registration skipped:', error);
      });
    },
    { once: true }
  );
};
