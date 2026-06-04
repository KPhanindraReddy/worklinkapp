import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/env';
import { db } from '../firebase/firestore';

export const createSupportTicket = async ({
  userId = '',
  role = '',
  fullName = '',
  phoneNumber = '',
  email = '',
  subject = '',
  description = ''
} = {}) => {
  if (!isFirebaseConfigured || !db || !userId) {
    return null;
  }

  const trimmedSubject = String(subject || '').trim();
  const trimmedDescription = String(description || '').trim();

  if (!trimmedSubject || !trimmedDescription) {
    throw new Error('Add a subject and description before raising a ticket.');
  }

  const ticketNumber = `SLV-${Date.now().toString(36).toUpperCase()}`;
  const reference = await addDoc(collection(db, 'supportTickets'), {
    ticketNumber,
    userId,
    role,
    fullName,
    phoneNumber,
    email,
    subject: trimmedSubject,
    description: trimmedDescription,
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return {
    id: reference.id,
    ticketNumber
  };
};

const toMillis = (value) => {
  if (!value) {
    return 0;
  }

  if (typeof value?.toMillis === 'function') {
    return value.toMillis();
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime();
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

export const listUserSupportTickets = async (userId) => {
  if (!isFirebaseConfigured || !db || !userId) {
    return [];
  }

  const ticketsQuery = query(
    collection(db, 'supportTickets'),
    where('userId', '==', userId)
  );
  const snapshot = await getDocs(ticketsQuery);

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};
