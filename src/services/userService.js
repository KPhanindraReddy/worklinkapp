import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/env';
import { db } from '../firebase/firestore';
import { normalizeCoordinates } from '../utils/location';

const roleProfileCollections = {
  labour: 'labours',
  client: 'clients'
};

const mergeRoleProfile = async (profile) => {
  const roleCollection = roleProfileCollections[profile?.role];

  if (!profile?.id || !roleCollection) {
    return profile;
  }

  const roleSnapshot = await getDoc(doc(db, roleCollection, profile.id));

  if (!roleSnapshot.exists()) {
    return profile;
  }

  return {
    ...profile,
    ...roleSnapshot.data(),
    id: profile.id,
    role: profile.role
  };
};

export const getUserProfile = async (uid) => {
  if (!uid || !isFirebaseConfigured || !db) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(db, 'users', uid));
    return snapshot.exists() ? mergeRoleProfile({ id: snapshot.id, ...snapshot.data() }) : null;
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

export const updateUserProfilePhoto = async (uid, role, profilePhoto) => {
  if (!uid || !isFirebaseConfigured || !db) {
    throw new Error('Firebase must be configured before updating profile photo.');
  }

  const payload = {
    profilePhoto,
    updatedAt: serverTimestamp()
  };

  await Promise.all([
    setDoc(doc(db, 'users', uid), payload, { merge: true }),
    ...(role === 'labour' ? [setDoc(doc(db, 'labours', uid), payload, { merge: true })] : []),
    ...(role === 'client' ? [setDoc(doc(db, 'clients', uid), payload, { merge: true })] : [])
  ]);
};

export const updateLiveUserLocation = async ({ uid, role, coordinates, locationLabel = '' }) => {
  const normalizedCoordinates = normalizeCoordinates(coordinates);
  const normalizedLocationLabel = String(locationLabel ?? '').trim();

  if (!uid || !role || !normalizedCoordinates || !isFirebaseConfigured || !db) {
    return;
  }

  const basePayload = {
    location: normalizedLocationLabel,
    currentLocation: normalizedLocationLabel,
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
      if (!snapshot.exists()) {
        onNext(null);
        return;
      }

      mergeRoleProfile({ id: snapshot.id, ...snapshot.data() })
        .then(onNext)
        .catch((error) => {
          if (error?.code === 'permission-denied') {
            onNext({ id: snapshot.id, ...snapshot.data() });
            return;
          }

          onError?.(error);
        });
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
