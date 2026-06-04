import {
  addDoc,
  collection,
  serverTimestamp
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
