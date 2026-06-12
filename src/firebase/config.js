import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth
} from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from './env';
import { app } from './app';

const createAuth = () => {
  if (!app) {
    return null;
  }

  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence]
    });
  } catch (error) {
    return getAuth(app);
  }
};

export const auth = createAuth();

export { app, firebaseConfig, isFirebaseConfigured };
