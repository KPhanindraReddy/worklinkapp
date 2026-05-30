import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/env';
import { db } from '../firebase/firestore';
import { normalizeCoordinates } from '../utils/location';

export const getUserProfile = async (uid) => {
  if (!uid || !isFirebaseConfigured || !db) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(db, 'users', uid));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch (error) {
    if (error?.code === 'permission-denied') {
      return null;
    }

    throw error;
  }
};

export const updateUserSettings = async (uid, settings) => {
  if (!uid || !isFirebaseConfigured || !db) {
    throw new Error('Firebase must be configured before updating settings.');
  }

  await setDoc(
    doc(db, 'users', uid),
    {
      settings,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const updateLiveUserLocation = async ({ uid, role, coordinates }) => {
  const normalizedCoordinates = normalizeCoordinates(coordinates);

  if (!uid || !role || !normalizedCoordinates || !isFirebaseConfigured || !db) {
    return;
  }

  const basePayload = {
    coordinates: normalizedCoordinates,
    liveCoordinates: normalizedCoordinates,
    liveLocationUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(
    doc(db, 'users', uid),
    basePayload,
    { merge: true }
  );

  if (role === 'labour') {
    await setDoc(
      doc(db, 'labours', uid),
      basePayload,
      { merge: true }
    );
  }

  if (role === 'client') {
    await setDoc(
      doc(db, 'clients', uid),
      basePayload,
      { merge: true }
    );
  }
};

export const subscribeUserProfile = (uid, onNext, onError) => {
  if (!uid || !isFirebaseConfigured || !db) {
    onNext(null);
    return () => {};
  }

  return onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => {
      onNext(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    },
    (error) => {
      if (error?.code === 'permission-denied') {
        onNext(null);
        return;
      }

      onError?.(error);
    }
  );
};
