import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/env';
import { db } from '../firebase/firestore';
import { parseDateValue } from '../utils/formatters';

const debugNotifications = (message, payload = {}) => {
  console.debug(`[Slivz notifications] ${message}`, payload);
};

const sortNotificationsByCreatedAtDesc = (items) =>
  [...items].sort((a, b) => {
    const dateA = parseDateValue(a.createdAt)?.getTime() ?? 0;
    const dateB = parseDateValue(b.createdAt)?.getTime() ?? 0;

    return dateB - dateA;
  });

export const subscribeNotifications = (userId, onNext, onError) => {
  if (!userId) {
    onNext([]);
    return () => {};
  }

  if (!isFirebaseConfigured || !db) {
    onNext([]);
    return () => {};
  }

  const notificationsQuery = query(
    collection(db, 'notifications'),
    where('userId', '==', userId)
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      onNext(
        sortNotificationsByCreatedAtDesc(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
      );
    },
    onError
  );
};

export const createNotification = async (payload) => {
  if (!isFirebaseConfigured || !db) {
    debugNotifications('skipped create because Firebase is not configured', {
      userId: payload?.userId,
      bookingId: payload?.bookingId
    });
    return null;
  }

  debugNotifications('create requested', {
    userId: payload.userId,
    senderId: payload.senderId,
    bookingId: payload.bookingId,
    type: payload.type
  });

  const reference = await addDoc(collection(db, 'notifications'), {
    ...payload,
    createdAt: serverTimestamp(),
    read: false
  });

  debugNotifications('create completed', {
    id: reference.id,
    userId: payload.userId,
    bookingId: payload.bookingId
  });

  return reference.id;
};

export const markNotificationRead = async (notificationId) => {
  if (!notificationId || !isFirebaseConfigured || !db) {
    return;
  }

  await updateDoc(doc(db, 'notifications', notificationId), {
    read: true
  });
};

export const markAllNotificationsRead = async (notifications = []) => {
  if (!isFirebaseConfigured || !db) {
    return;
  }

  const unreadNotifications = notifications.filter((notification) => notification?.id && !notification.read);

  await Promise.all(
    unreadNotifications.map((notification) =>
      updateDoc(doc(db, 'notifications', notification.id), {
        read: true
      })
    )
  );
};
