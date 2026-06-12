import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/env';
import { db } from '../firebase/firestore';
import { listPendingCustomServiceRequests } from './customServiceService';
import { workCategories } from '../utils/constants';

const DIRECTORY_PAGE_SIZE = 18;
const DIAGNOSTICS_LIMIT = 300;
const NOTIFICATION_CLEANUP_LIMIT = 2000;
const NOTIFICATION_CLEANUP_BATCH_SIZE = 450;
const fallbackCategories = workCategories.map((category, index) => ({
  id: `category-${index + 1}`,
  name: category,
  peopleCount: 0,
  clickCount: 0,
  searchCount: 0
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

const mergeFilledProfileData = (base = {}, override = {}) => {
  const merged = { ...base, ...override };

  ['fullName', 'phoneNumber', 'email', 'location', 'currentLocation', 'accountStatus'].forEach((key) => {
    if ((override[key] === undefined || override[key] === null || override[key] === '') && base[key]) {
      merged[key] = base[key];
    }
  });

  return merged;
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
        clientCount: 0,
        activeBookings: 0,
        pendingVerifications: 0,
        paidEarnings: 0,
        paidBookingCount: 0
      },
      categories: fallbackCategories,
      pendingLabours: [],
      customServices: [],
      demandByLocation: [],
      demandByService: [],
      recentActivity: []
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
  const interactionsQuery = query(
    collection(db, 'serviceInteractions'),
    orderBy('createdAt', 'desc'),
    limit(1000)
  );
  const recentBookingsQuery = query(
    collection(db, 'bookings'),
    orderBy('createdAt', 'desc'),
    limit(30)
  );
  const recentUsersQuery = query(
    collection(db, 'users'),
    orderBy('createdAt', 'desc'),
    limit(30)
  );
  const recentTicketsQuery = query(
    collection(db, 'supportTickets'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const serviceCountQueries = workCategories.map((category) =>
    getCountFromServer(query(collection(db, 'labours'), where('category', '==', category))).catch(() => null)
  );
  const [
    usersCountSnapshot,
    laboursCountSnapshot,
    clientsCountSnapshot,
    bookingsCountSnapshot,
    pendingCountSnapshot,
    pendingLaboursSnapshot,
    paidBookingsSnapshot,
    demandSnapshot,
    interactionsSnapshot,
    recentBookingsSnapshot,
    recentUsersSnapshot,
    recentTicketsSnapshot,
    serviceCountSnapshots
  ] = await Promise.all([
    getCountFromServer(collection(db, 'users')),
    getCountFromServer(collection(db, 'labours')),
    getCountFromServer(collection(db, 'clients')),
    getCountFromServer(collection(db, 'bookings')),
    getCountFromServer(query(collection(db, 'labours'), where('verified', '==', false))),
    getDocs(pendingLaboursQuery),
    getDocs(paidBookingsQuery),
    getDocs(demandQuery).catch(() => ({ docs: [] })),
    getDocs(interactionsQuery).catch(() => ({ docs: [] })),
    getDocs(recentBookingsQuery).catch(() => ({ docs: [] })),
    getDocs(recentUsersQuery).catch(() => ({ docs: [] })),
    getDocs(recentTicketsQuery).catch(() => ({ docs: [] })),
    Promise.all(serviceCountQueries)
  ]);

  const pendingLabours = pendingLaboursSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const paidEarnings = paidBookingsSnapshot.docs.reduce(
    (sum, item) => sum + Number(item.data().amount || 0),
    0
  );
  const demandItems = demandSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const demandByLocation = Array.from(
    demandItems
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
  const demandByService = Array.from(
    demandItems
      .reduce((map, item) => {
        const serviceType = String(item.serviceType || 'Any service').trim();
        const key = serviceType.toLowerCase();
        const current = map.get(key) || {
          id: key,
          serviceType,
          requestCount: 0,
          locations: new Set(),
          latestRequest: item.createdAt
        };

        current.requestCount += 1;
        current.locations.add(String(item.location || 'Unknown address').trim());
        current.latestRequest =
          toMillis(item.createdAt) > toMillis(current.latestRequest) ? item.createdAt : current.latestRequest;
        map.set(key, current);
        return map;
      }, new Map())
      .values()
  )
    .map((item) => ({
      ...item,
      locations: Array.from(item.locations).slice(0, 4)
    }))
    .sort((a, b) => b.requestCount - a.requestCount || a.serviceType.localeCompare(b.serviceType))
    .slice(0, 10);
  const serviceInteractions = interactionsSnapshot.docs
    .map((item) => item.data())
    .reduce((map, item) => {
      const serviceType = String(item.serviceType || 'Any service').trim();
      const key = serviceType.toLowerCase();
      const current = map.get(key) || {
        clicks: 0,
        searches: 0
      };

      if (item.type === 'click') {
        current.clicks += 1;
      } else {
        current.searches += 1;
      }

      map.set(key, current);
      return map;
    }, new Map());
  const customServices = await listPendingCustomServiceRequests().catch(() => []);
  const recentActivity = [
    ...recentUsersSnapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: `user-${item.id}`,
        type: 'New signup',
        title: data.fullName || data.email || 'User',
        detail: data.role || 'account',
        createdAt: data.createdAt || data.updatedAt || null
      };
    }),
    ...recentBookingsSnapshot.docs.map((item) => {
      const data = item.data();
      const isCompleted = data.status === 'completed' || data.paymentStatus === 'paid';
      return {
        id: `booking-${item.id}`,
        type: isCompleted ? 'Completed service' : 'New booking',
        title: data.serviceType || 'Service booking',
        detail: [data.clientName, data.labourName].filter(Boolean).join(' to ') || data.status || 'booking',
        createdAt: (isCompleted ? data.completedAt || data.updatedAt : data.createdAt) || null
      };
    }),
    ...recentTicketsSnapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: `ticket-${item.id}`,
        type: 'Support ticket',
        title: data.subject || data.ticketNumber || 'Support request',
        detail: data.fullName || data.role || 'user',
        createdAt: data.createdAt || null
      };
    })
  ]
    .filter((item) => item.createdAt)
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    .slice(0, 12);

  return {
    analytics: {
      userCount: usersCountSnapshot.data().count,
      labourCount: laboursCountSnapshot.data().count,
      clientCount: clientsCountSnapshot.data().count,
      activeBookings: bookingsCountSnapshot.data().count,
      pendingVerifications: pendingCountSnapshot.data().count,
      paidEarnings,
      paidBookingCount: paidBookingsSnapshot.size
    },
    categories: workCategories
      .map((category, index) => ({
        id: `category-${index + 1}`,
        name: category,
        peopleCount: serviceCountSnapshots[index]?.data().count ?? 0,
        clickCount: serviceInteractions.get(category.toLowerCase())?.clicks ?? 0,
        searchCount: serviceInteractions.get(category.toLowerCase())?.searches ?? 0
      }))
      .sort(
        (a, b) =>
          b.peopleCount - a.peopleCount ||
          b.clickCount + b.searchCount - (a.clickCount + a.searchCount) ||
          a.name.localeCompare(b.name)
      ),
    pendingLabours,
    customServices,
    demandByLocation,
    demandByService,
    recentActivity
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
  const userProfiles = await Promise.all(
    snapshot.docs.map((item) =>
      getDoc(doc(db, 'users', item.id))
        .then((userSnapshot) => (userSnapshot.exists() ? userSnapshot.data() : {}))
        .catch(() => ({}))
    )
  );

  return {
    items: snapshot.docs.map((item, index) => ({
      id: item.id,
      ...mergeFilledProfileData(userProfiles[index], item.data())
    })),
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
  return updateUserAccountStatus({ userId, role, accountStatus: 'banned' });
};

export const updateUserAccountStatus = async ({ userId, role, accountStatus = 'active' } = {}) => {
  if (!isFirebaseConfigured || !db) {
    return;
  }

  const payload = {
    accountStatus,
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
    gender: String(payload.gender ?? '').trim(),
    age:
      payload.age === '' || payload.age === null || payload.age === undefined
        ? null
        : Number(payload.age),
    accountStatus: String(payload.accountStatus ?? 'active').trim() || 'active',
    updatedAt: serverTimestamp()
  };

  if (role === 'labour') {
    normalizedPayload.category = String(payload.category ?? '').trim();
    normalizedPayload.availability = String(payload.availability ?? '').trim() || 'Available';
    normalizedPayload.about = String(payload.about ?? '').trim();
    normalizedPayload.experienceYears = Number(payload.experienceYears || 0);
    normalizedPayload.education = String(payload.education ?? '').trim();
    normalizedPayload.dailyWage = Number(payload.dailyWage || 0);
    normalizedPayload.skills = Array.isArray(payload.skills)
      ? payload.skills
      : String(payload.skills ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
    normalizedPayload.languages = Array.isArray(payload.languages)
      ? payload.languages
      : String(payload.languages ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
    normalizedPayload.previousWorkHistory = Array.isArray(payload.previousWorkHistory)
      ? payload.previousWorkHistory
      : String(payload.previousWorkHistory ?? '')
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
      messageFailures: [],
      repeatedCancellations: []
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

  const repeatedCancellations = Array.from(
    bookings
      .filter((booking) => ['cancelled', 'canceled', 'rejected'].includes(String(booking.status || '').toLowerCase()))
      .reduce((map, booking) => {
        [
          {
            id: booking.clientId || booking.userId,
            role: 'client',
            name: booking.clientName || 'Client'
          },
          {
            id: booking.labourId,
            role: 'labour',
            name: booking.labourName || 'Labour'
          }
        ]
          .filter((account) => account.id)
          .forEach((account) => {
            const key = `${account.role}-${account.id}`;
            const current = map.get(key) || {
              id: key,
              userId: account.id,
              role: account.role,
              name: account.name,
              count: 0,
              latestAt: booking.updatedAt || booking.createdAt || null,
              services: new Set()
            };

            current.count += 1;
            current.name = account.name || current.name;
            current.latestAt =
              toMillis(booking.updatedAt || booking.createdAt) > toMillis(current.latestAt)
                ? booking.updatedAt || booking.createdAt
                : current.latestAt;
            current.services.add(booking.serviceType || 'Service');
            map.set(key, current);
          });

        return map;
      }, new Map())
      .values()
  )
    .filter((item) => item.count >= 3)
    .map((item) => ({
      ...item,
      services: Array.from(item.services).slice(0, 3)
    }))
    .sort((a, b) => b.count - a.count || toMillis(b.latestAt) - toMillis(a.latestAt))
    .slice(0, 18);

  return {
    failedNotifications,
    functionErrors,
    stuckBookings,
    messageFailures,
    repeatedCancellations
  };
};

export const listSupportTickets = async ({ pageSize = 50 } = {}) => {
  if (!isFirebaseConfigured || !db) {
    return [];
  }

  const ticketsQuery = query(
    collection(db, 'supportTickets'),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );
  const snapshot = await getDocs(ticketsQuery);

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

export const updateSupportTicketStatus = async (ticketId, status = 'open') => {
  if (!isFirebaseConfigured || !db || !ticketId) {
    return;
  }

  await updateDoc(doc(db, 'supportTickets', ticketId), {
    status,
    updatedAt: serverTimestamp()
  });
};

export const cleanupOverflowNotifications = async ({ role = 'all', keepLatest = 10 } = {}) => {
  if (!isFirebaseConfigured || !db) {
    return {
      deletedCount: 0,
      affectedUsers: 0
    };
  }

  const normalizedRole = ['client', 'labour'].includes(role) ? role : 'all';
  let allowedUserIds = null;

  if (normalizedRole !== 'all') {
    const usersSnapshot = await getDocs(
      query(collection(db, 'users'), where('role', '==', normalizedRole), limit(1000))
    );
    allowedUserIds = new Set(usersSnapshot.docs.map((item) => item.id));
  }

  const notificationsSnapshot = await getDocs(
    query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(NOTIFICATION_CLEANUP_LIMIT))
  );
  const notificationsByUser = notificationsSnapshot.docs.reduce((map, item) => {
    const data = item.data();
    const userId = data.userId;

    if (!userId || (allowedUserIds && !allowedUserIds.has(userId))) {
      return map;
    }

    const current = map.get(userId) || [];
    current.push({
      ref: item.ref,
      createdAt: data.createdAt
    });
    map.set(userId, current);
    return map;
  }, new Map());
  const deleteRefs = Array.from(notificationsByUser.values()).flatMap((items) =>
    [...items]
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .slice(Number(keepLatest) || 10)
      .map((item) => item.ref)
  );

  for (let index = 0; index < deleteRefs.length; index += NOTIFICATION_CLEANUP_BATCH_SIZE) {
    const batch = writeBatch(db);
    deleteRefs.slice(index, index + NOTIFICATION_CLEANUP_BATCH_SIZE).forEach((reference) => {
      batch.delete(reference);
    });
    await batch.commit();
  }

  return {
    deletedCount: deleteRefs.length,
    affectedUsers: Array.from(notificationsByUser.values()).filter((items) => items.length > keepLatest).length
  };
};
