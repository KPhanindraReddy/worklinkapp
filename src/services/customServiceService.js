import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/env';
import { db } from '../firebase/firestore';
import { workCategories } from '../utils/constants';

const normalizeName = (name = '') => String(name || '').trim();

const normalizeKey = (name = '') =>
  normalizeName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export const isKnownWorkCategory = (name = '', extraCategories = []) => {
  const normalizedName = normalizeName(name).toLowerCase();

  if (!normalizedName) {
    return true;
  }

  return [...workCategories, ...extraCategories].some(
    (category) => normalizeName(category).toLowerCase() === normalizedName
  );
};

export const submitCustomServiceRequest = async ({
  name = '',
  labourId = '',
  labourName = '',
  source = 'profile'
} = {}) => {
  const serviceName = normalizeName(name);
  const serviceKey = normalizeKey(serviceName);

  if (!isFirebaseConfigured || !db || !serviceName || !serviceKey || isKnownWorkCategory(serviceName)) {
    return;
  }

  await setDoc(
    doc(db, 'customServiceRequests', serviceKey),
    {
      name: serviceName,
      normalizedName: serviceName.toLowerCase(),
      labourId,
      labourName: labourName || 'Labour',
      source,
      status: 'pending',
      requestCount: 1,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const listPendingCustomServiceRequests = async () => {
  if (!isFirebaseConfigured || !db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'customServiceRequests'),
      orderBy('updatedAt', 'desc'),
      limit(100)
    )
  );

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.status === 'pending');
};
