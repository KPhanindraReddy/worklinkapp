import { useEffect } from 'react';
import { registerNativePushNotifications } from '../../services/pushNotificationService';

export const NativePushNotifications = ({ currentUser }) => {
  useEffect(() => {
    let cleanup = null;
    let isActive = true;

    registerNativePushNotifications({ uid: currentUser?.uid })
      .then((removeListeners) => {
        if (!isActive) {
          removeListeners?.();
          return;
        }

        cleanup = removeListeners;
      })
      .catch((error) => {
        console.warn('Slivz push setup skipped:', error?.code ?? error?.message ?? error);
      });

    return () => {
      isActive = false;
      cleanup?.();
    };
  }, [currentUser?.uid]);

  return null;
};
