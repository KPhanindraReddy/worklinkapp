import { getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { app } from './app';

const createFirestore = () => {
  if (!app) {
    return null;
  }

  if (typeof window === 'undefined') {
    return getFirestore(app);
  }

  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache()
    });
  } catch (error) {
    if (error?.code !== 'failed-precondition') {
      console.warn('Slivz Firestore offline cache setup skipped:', error);
    }

    return getFirestore(app);
  }
};

export const db = createFirestore();
