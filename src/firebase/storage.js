import { getStorage } from 'firebase/storage';
import { app } from './app';
import { firebaseConfig, isFirebaseStorageConfigured } from './env';

export const storage = app && isFirebaseStorageConfigured ? getStorage(app, firebaseConfig.storageBucket) : null;
