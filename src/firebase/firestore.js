import { enableIndexedDbPersistence, getFirestore } from 'firebase/firestore';
import { app } from './app';

export const db = app ? getFirestore(app) : null;

if (db && typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((error) => {
    if (error?.code === 'failed-precondition' || error?.code === 'unimplemented') {
      return;
    }

    console.warn('Slivz Firestore offline cache setup skipped:', error);
  });
}
