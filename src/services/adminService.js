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
const DIAGNOSTICS_LIMIT = 300;
const fallbackCategories = workCategories.map((category, index) => ({
  id: `category-${index + 1}`,
  name: category,
  openRequests: 0,
  trending: false
}));

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

const safeGetDocs = async (queryBuilder) => {
  try {
    return await getDocs(queryBuilder());
  } catch {
    return { docs: [] };
  }
};

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

export const updateAdminUserProfile = async ({ userId, role = 'client', payload = {} } = {}) => {
  if (!isFirebaseConfigured || !db || !userId) {
    return;
  }

  const normalizedPayload = {
    fullName: String(payload.fullName ?? '').trim(),
    phoneNumber: String(payload.phoneNumber ?? '').trim(),
    email: String(payload.email ?? '').trim(),
    location: String(payload.location ?? '').trim(),
    currentLocation: String(payload.currentLocation ?? '').trim(),
    accountStatus: String(payload.accountStatus ?? 'active').trim() || 'active',
    updatedAt: serverTimestamp()
  };

  if (role === 'labour') {
    normalizedPayload.category = String(payload.category ?? '').trim();
    normalizedPayload.availability = String(payload.availability ?? '').trim() || 'Available';
    normalizedPayload.about = String(payload.about ?? '').trim();
    normalizedPayload.experienceYears = Number(payload.experienceYears || 0);
    normalizedPayload.skills = Array.isArray(payload.skills)
      ? payload.skills
      : String(payload.skills ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
  }

  await Promise.all([
    setDoc(doc(db, 'users', userId), normalizedPayload, { merge: true }),
    ...(role === 'labour' ? [setDoc(doc(db, 'labours', userId), normalizedPayload, { merge: true })] : []),
    ...(role === 'client' ? [setDoc(doc(db, 'clients', userId), normalizedPayload, { merge: true })] : [])
  ]);
};

export const getAdminDiagnostics = async () => {
  if (!isFirebaseConfigured || !db) {
    return {
      failedNotifications: [],
      functionErrors: [],
      stuckBookings: [],
      messageFailures: []
    };
  }

  const [bookingsSnapshot, logsSnapshot] = await Promise.all([
    safeGetDocs(() => query(collection(db, 'bookings'), limit(DIAGNOSTICS_LIMIT * 2))),
    safeGetDocs(() => query(collection(db, 'whatsappLogs'), orderBy('createdAt', 'desc'), limit(DIAGNOSTICS_LIMIT)))
  ]);

  const now = Date.now();
  const bookings = bookingsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const logs = logsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

  const failedNotifications = bookings
    .map((booking) => {
      const whatsapp = booking.whatsapp || {};
      const errorFields = Object.entries(whatsapp).filter(
        ([field, value]) =>
          field.endsWith('ErrorMessage') ||
          field.endsWith('ErrorCode') ||
          field.endsWith('ErrorStatus')
            ? Boolean(value)
            : false
      );

      if (!errorFields.length) {
        return null;
      }

      const failureTypes = Array.from(
        new Set(errorFields.map(([field]) => field.replace(/Error(Message|Code|Status)$/i, '')))
      );

      return {
        id: booking.id,
        bookingId: booking.id,
        labourName: booking.labourName || '',
        clientName: booking.clientName || '',
        serviceType: booking.serviceType || '',
        status: booking.status || '',
        failureTypes,
        lastErrorMessage: whatsapp[`${failureTypes.at(-1)}ErrorMessage`] || 'WhatsApp send failed',
        updatedAt: whatsapp.updatedAt || booking.updatedAt || booking.createdAt || null
      };
    })
    .filter(Boolean)
    .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt))
    .slice(0, 18);

  const functionErrors = logs
    .filter((item) => item.ok === false || Number(item.status) >= 400)
    .map((item) => ({
      id: item.id,
      bookingId: item.bookingId || '',
      kind: item.kind || 'unknown',
      audience: item.audience || '',
      to: item.to || '',
      status: item.status || 0,
      createdAt: item.createdAt || null,
      errorMessage: item.response?.error?.message || 'Function delivery failed'
    }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    .slice(0, 18);

  const stuckBookings = bookings
    .map((booking) => {
      const status = String(booking.status || '');
      const statusStartedAt = booking.updatedAt || booking.createdAt || booking.appointmentAt;
      const ageMs = now - toMillis(statusStartedAt);

      const isPendingStuck = status === 'pending' && ageMs > 20 * 60 * 1000;
      const isAcceptedStuck = status === 'accepted' && ageMs > 3 * 60 * 60 * 1000;
      const isInProgressStuck = status === 'in_progress' && ageMs > 8 * 60 * 60 * 1000;
      const isAwaitingPaymentStuck = status === 'awaiting_payment' && ageMs > 24 * 60 * 60 * 1000;

      if (!(isPendingStuck || isAcceptedStuck || isInProgressStuck || isAwaitingPaymentStuck)) {
        return null;
      }

      return {
        id: booking.id,
        bookingId: booking.id,
        labourName: booking.labourName || '',
        clientName: booking.clientName || '',
        serviceType: booking.serviceType || '',
        status,
        ageMs,
        updatedAt: statusStartedAt || null
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.ageMs - a.ageMs)
    .slice(0, 18);

  const messageFailures = logs
    .filter((item) => item.ok === false || Number(item.status) >= 400)
    .filter((item) => String(item.kind || '').includes('job_') || String(item.kind || '').includes('booking'))
    .map((item) => ({
      id: item.id,
      bookingId: item.bookingId || '',
      kind: item.kind || '',
      to: item.to || '',
      status: item.status || 0,
      createdAt: item.createdAt || null,
      errorMessage: item.response?.error?.message || 'Message send failed'
    }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    .slice(0, 18);

  return {
    failedNotifications,
    functionErrors,
    stuckBookings,
    messageFailures
  };
};
