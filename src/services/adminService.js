import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where
} from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/env';
import { db } from '../firebase/firestore';
import { workCategories } from '../utils/constants';

const DIRECTORY_PAGE_SIZE = 18;
const fallbackCategories = workCategories.map((category, index) => ({
  id: `category-${index + 1}`,
  name: category,
  openRequests: 0,
  trending: false
}));

export const getAdminOverview = async () => {
  if (!isFirebaseConfigured || !db) {
    return {
      analytics: {
        userCount: 0,
        labourCount: 0,
        activeBookings: 0,
        pendingVerifications: 0,
        paidEarnings: 0,
        paidBookingCount: 0
      },
      categories: fallbackCategories,
      pendingLabours: [],
      demandByLocation: []
    };
  }

  const pendingLaboursQuery = query(
    collection(db, 'labours'),
    where('verified', '==', false),
    limit(24)
  );
  const paidBookingsQuery = query(
    collection(db, 'bookings'),
    where('paymentStatus', '==', 'paid'),
    limit(500)
  );
  const demandQuery = query(
    collection(db, 'serviceDemandRequests'),
    orderBy('createdAt', 'desc'),
    limit(500)
  );
  const [
    usersCountSnapshot,
    laboursCountSnapshot,
    bookingsCountSnapshot,
    pendingCountSnapshot,
    pendingLaboursSnapshot,
    paidBookingsSnapshot,
    demandSnapshot
  ] = await Promise.all([
    getCountFromServer(collection(db, 'users')),
    getCountFromServer(collection(db, 'labours')),
    getCountFromServer(collection(db, 'bookings')),
    getCountFromServer(query(collection(db, 'labours'), where('verified', '==', false))),
    getDocs(pendingLaboursQuery),
    getDocs(paidBookingsQuery),
    getDocs(demandQuery).catch(() => ({ docs: [] }))
  ]);

  const pendingLabours = pendingLaboursSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const paidEarnings = paidBookingsSnapshot.docs.reduce(
    (sum, item) => sum + Number(item.data().amount || 0),
    0
  );
  const demandByLocation = Array.from(
    demandSnapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .reduce((map, item) => {
        const location = String(item.location || 'Unknown requested address').trim();
        const key = location.toLowerCase();
        const current = map.get(key) || {
          id: key,
          location,
          requestCount: 0,
          services: new Set(),
          latestRequest: item.createdAt
        };

        current.requestCount += 1;
        current.services.add(item.serviceType || 'Any service');
        current.latestRequest = current.latestRequest || item.createdAt;
        map.set(key, current);
        return map;
      }, new Map())
      .values()
  )
    .map((item) => ({
      ...item,
      services: Array.from(item.services).slice(0, 4)
    }))
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, 8);

  return {
    analytics: {
      userCount: usersCountSnapshot.data().count,
      labourCount: laboursCountSnapshot.data().count,
      activeBookings: bookingsCountSnapshot.data().count,
      pendingVerifications: pendingCountSnapshot.data().count,
      paidEarnings,
      paidBookingCount: paidBookingsSnapshot.size
    },
    categories: fallbackCategories,
    pendingLabours,
    demandByLocation
  };
};

export const listAdminProfiles = async ({
  role = 'labour',
  cursor = null,
  pageSize = DIRECTORY_PAGE_SIZE
} = {}) => {
  if (!isFirebaseConfigured || !db) {
    return {
      items: [],
      cursor: null,
      hasMore: false
    };
  }

  const collectionName = role === 'client' ? 'clients' : 'labours';
  const directoryQuery = query(
    collection(db, collectionName),
    orderBy('updatedAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize)
  );
  const snapshot = await getDocs(directoryQuery);

  return {
    items: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
    cursor: snapshot.docs.at(-1) ?? null,
    hasMore: snapshot.docs.length === pageSize
  };
};

export const verifyLabourAccount = async (labourId) => {
  if (!isFirebaseConfigured || !db) {
    return;
  }

  await updateDoc(doc(db, 'labours', labourId), {
    verified: true,
    verifiedAt: serverTimestamp()
  });

  await setDoc(
    doc(db, 'users', labourId),
    {
      verified: true,
      verifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const banUser = async ({ userId, role } = {}) => {
  if (!isFirebaseConfigured || !db) {
    return;
  }

  const payload = {
    accountStatus: 'banned',
    updatedAt: serverTimestamp()
  };

  await Promise.all([
    setDoc(doc(db, 'users', userId), payload, { merge: true }),
    ...(role === 'labour' ? [setDoc(doc(db, 'labours', userId), payload, { merge: true })] : []),
    ...(role === 'client' ? [setDoc(doc(db, 'clients', userId), payload, { merge: true })] : [])
  ]);
};
