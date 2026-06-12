import { PushNotifications } from '@capacitor/push-notifications';
import { arrayUnion, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firestore';
import { isFirebaseConfigured } from '../firebase/env';
import { isCapacitorNative } from '../utils/capacitor';

const getDeviceLabel = () => {
  if (!isCapacitorNative()) {
    return 'web';
  }

  return window.Capacitor?.getPlatform?.() || 'native';
};

const persistPushToken = async ({ uid, token }) => {
  if (!uid || !token || !isFirebaseConfigured || !db) {
    return;
  }

  const deviceLabel = getDeviceLabel();

  await setDoc(
    doc(db, 'users', uid),
    {
      pushTokens: {
        [token]: {
          platform: deviceLabel,
          updatedAt: serverTimestamp()
        }
      },
      pushTokenList: arrayUnion(token),
      lastPushToken: token,
      pushNotificationsEnabled: true,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const registerNativePushNotifications = async ({ uid } = {}) => {
  if (!uid || !isCapacitorNative()) {
    return null;
  }

  const registrationHandle = await PushNotifications.addListener('registration', (token) => {
    persistPushToken({ uid, token: token.value }).catch((error) => {
      console.warn('Slivz push token save skipped:', error?.code ?? error?.message ?? error);
    });
  });

  const registrationErrorHandle = await PushNotifications.addListener('registrationError', (error) => {
    console.warn('Slivz push registration failed:', error?.error ?? error);
  });

  const notificationHandle = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.info('Slivz push notification received:', notification);
  });

  const actionHandle = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const targetUrl = action.notification?.data?.url;

    if (targetUrl && typeof window !== 'undefined') {
      window.location.assign(targetUrl);
    }
  });

  const permissionStatus = await PushNotifications.requestPermissions();

  if (permissionStatus.receive !== 'granted') {
    registrationHandle.remove();
    registrationErrorHandle.remove();
    notificationHandle.remove();
    actionHandle.remove();
    return null;
  }

  await PushNotifications.register();

  return () => {
    registrationHandle.remove();
    registrationErrorHandle.remove();
    notificationHandle.remove();
    actionHandle.remove();
  };
};
