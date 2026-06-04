import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/env';
import { db } from '../firebase/firestore';
import { parseDateValue } from '../utils/formatters';
import { normalizeWhatsAppPhoneNumber } from '../utils/phone';

const debugBookingService = (message, payload = {}) => {
  if (import.meta.env.DEV) {
    console.debug(`[Slivz booking service] ${message}`, payload);
  }
};

const activeClientRequestStatuses = ['pending', 'accepted', 'in_progress', 'awaiting_payment'];

const sortBookingsByAppointmentDesc = (items) =>
  [...items].sort((a, b) => {
    const dateA = parseDateValue(a.appointmentAt)?.getTime() ?? 0;
    const dateB = parseDateValue(b.appointmentAt)?.getTime() ?? 0;

    return dateB - dateA;
  });

const buildUserBookingsQuery = (userId, role) => {
  const key = role === 'labour' ? 'labourId' : 'clientId';

  return query(
    collection(db, 'bookings'),
    where(key, '==', userId)
  );
};

export const subscribeBookingsForUser = ({ userId, role }, onNext, onError) => {
  if (!userId || !role) {
    onNext([]);
    return () => {};
  }

  if (!isFirebaseConfigured || !db) {
    onNext([]);
    return () => {};
  }

  const bookingQuery = buildUserBookingsQuery(userId, role);

  return onSnapshot(
    bookingQuery,
    (snapshot) => {
      onNext(sortBookingsByAppointmentDesc(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))));
    },
    onError
  );
};

export const subscribeBookingById = (bookingId, onNext, onError) => {
  if (!bookingId) {
    onNext(null);
    return () => {};
  }

  if (!isFirebaseConfigured || !db) {
    onNext(null);
    return () => {};
  }

  return onSnapshot(
    doc(db, 'bookings', bookingId),
    (snapshot) => {
      onNext(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    },
    onError
  );
};

export const createBooking = async (payload) => {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase must be configured before creating bookings.');
  }

  if (!payload?.clientId) {
    throw new Error('Sign in as a client before sending a booking request.');
  }

  if (!payload?.labourId) {
    throw new Error('Choose an available labour before sending this request.');
  }

  if (!String(payload?.serviceType || '').trim()) {
    throw new Error('Choose a service before sending this request.');
  }

  if (payload?.requestMode === 'scheduled' && !parseDateValue(payload.appointmentAt)) {
    throw new Error('Pick a valid date and time before scheduling this service.');
  }

  const bookingRef = doc(collection(db, 'bookings'));
  const labourRef = doc(db, 'labours', payload.labourId);
  const activeClientBookingsQuery = query(
    collection(db, 'bookings'),
    where('clientId', '==', payload.clientId),
    where('status', 'in', activeClientRequestStatuses),
    limit(1)
  );
  const privateClientPhoneNumber = normalizeWhatsAppPhoneNumber(payload.clientPhoneNumber);
  const privateLabourPhoneNumber = normalizeWhatsAppPhoneNumber(payload.labourPhoneNumber);
  const normalizedPayload = {
    ...payload,
    clientPhoneNumber: '',
    labourPhoneNumber: '',
    privateClientPhoneNumber,
    privateLabourPhoneNumber
  };

  debugBookingService('create booking transaction started', {
    bookingId: bookingRef.id,
    clientId: normalizedPayload.clientId,
    labourId: normalizedPayload.labourId,
    serviceType: normalizedPayload.serviceType
  });

  await runTransaction(db, async (transaction) => {
    const activeClientBookingsSnapshot = await transaction.get(activeClientBookingsQuery);

    if (!activeClientBookingsSnapshot.empty) {
      throw new Error('Finish or cancel your current request before sending another one.');
    }

    const labourSnapshot = await transaction.get(labourRef);

    if (!labourSnapshot.exists()) {
      throw new Error('Selected labour profile is no longer available.');
    }

    const labour = labourSnapshot.data();

    if (labour.availability !== 'Available') {
      throw new Error(`${labour.fullName || 'Selected labour'} is busy right now. Choose another available worker.`);
    }

    transaction.set(bookingRef, {
      ...normalizedPayload,
      amount: Number(normalizedPayload.amount || 0),
      paymentStatus: normalizedPayload.paymentStatus || 'not_requested',
      status: 'pending',
      otpStatus: 'waiting',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  debugBookingService('create booking transaction completed', {
    bookingId: bookingRef.id,
    labourId: payload.labourId
  });

  return bookingRef.id;
};

export const updateBookingStatus = async (bookingId, status, extra = {}) => {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase must be configured before updating bookings.');
  }

  debugBookingService('update status requested', {
    bookingId,
    status,
    extraKeys: Object.keys(extra)
  });

  const bookingRef = doc(db, 'bookings', bookingId);

  if (status === 'accepted') {
    await runTransaction(db, async (transaction) => {
      const bookingSnapshot = await transaction.get(bookingRef);

      if (!bookingSnapshot.exists()) {
        throw new Error('Booking was not found.');
      }

      const booking = bookingSnapshot.data();

      transaction.update(bookingRef, {
        status,
        clientPhoneNumber: booking.privateClientPhoneNumber || booking.clientPhoneNumber || '',
        labourPhoneNumber: booking.privateLabourPhoneNumber || booking.labourPhoneNumber || '',
        ...extra,
        updatedAt: serverTimestamp()
      });
    });
    return;
  }

  await updateDoc(bookingRef, {
    status,
    ...extra,
    updatedAt: serverTimestamp()
  });
};

export const timeoutPendingBooking = async ({ bookingId, clientId, reason = 'no_response' }) => {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase must be configured before updating bookings.');
  }

  const bookingRef = doc(db, 'bookings', bookingId);
  debugBookingService('timeout requested', { bookingId, clientId, reason });

  await runTransaction(db, async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingRef);

    if (!bookingSnapshot.exists()) {
      throw new Error('Booking was not found.');
    }

    const booking = bookingSnapshot.data();

    if (booking.clientId !== clientId) {
      throw new Error('This booking does not belong to your client account.');
    }

    if (booking.status !== 'pending') {
      return;
    }

    transaction.update(bookingRef, {
      status: 'timed_out',
      timeoutReason: reason,
      timedOutAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
};

export const startBookingWork = async ({ bookingId, labourId, otp }) => {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase must be configured before starting bookings.');
  }

  const normalizedOtp = String(otp ?? '').trim();
  const bookingRef = doc(db, 'bookings', bookingId);
  const labourRef = doc(db, 'labours', labourId);
  const userRef = doc(db, 'users', labourId);
  debugBookingService('start work transaction started', { bookingId, labourId });

  await runTransaction(db, async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingRef);

    if (!bookingSnapshot.exists()) {
      throw new Error('Booking was not found.');
    }

    const booking = bookingSnapshot.data();

    if (booking.labourId !== labourId) {
      throw new Error('This booking does not belong to your labour account.');
    }

    if (booking.status !== 'accepted') {
      throw new Error('Only accepted bookings can be started with OTP.');
    }

    if (!booking.startOtp || booking.startOtp !== normalizedOtp) {
      throw new Error('The OTP does not match. Ask the client for the latest start OTP.');
    }

    transaction.update(bookingRef, {
      status: 'in_progress',
      otpStatus: 'verified',
      startedAt: serverTimestamp(),
      startOtpVerifiedAt: serverTimestamp(),
      workStartedBy: labourId,
      updatedAt: serverTimestamp()
    });

    transaction.set(
      labourRef,
      {
        availability: 'Busy',
        activeBookingId: bookingId,
        busySince: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    transaction.set(
      userRef,
      {
        availability: 'Busy',
        activeBookingId: bookingId,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  });
  debugBookingService('start work transaction completed', { bookingId, labourId });
};

export const completeBookingWork = async ({ bookingId, labourId }) => {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase must be configured before completing bookings.');
  }

  const bookingRef = doc(db, 'bookings', bookingId);
  const labourRef = doc(db, 'labours', labourId);
  const userRef = doc(db, 'users', labourId);
  debugBookingService('complete work transaction started', { bookingId, labourId });

  await runTransaction(db, async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingRef);

    if (!bookingSnapshot.exists()) {
      throw new Error('Booking was not found.');
    }

    const booking = bookingSnapshot.data();

    if (booking.labourId !== labourId) {
      throw new Error('This booking does not belong to your labour account.');
    }

    if (booking.status !== 'in_progress') {
      throw new Error('Only in-progress bookings can be completed.');
    }

    transaction.update(bookingRef, {
      status: 'awaiting_payment',
      paymentStatus: 'client_amount_required',
      workFinishedAt: serverTimestamp(),
      workFinishedBy: labourId,
      updatedAt: serverTimestamp()
    });

    transaction.set(
      labourRef,
      {
        availability: 'Available',
        activeBookingId: '',
        busySince: null,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    transaction.set(
      userRef,
      {
        availability: 'Available',
        activeBookingId: '',
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  });
  debugBookingService('complete work transaction completed', { bookingId, labourId });
};

export const completeClientPayment = async ({ bookingId, clientId, paidAmount }) => {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase must be configured before updating payments.');
  }

  const normalizedPaidAmount = Number(paidAmount);

  if (!Number.isFinite(normalizedPaidAmount) || normalizedPaidAmount <= 0) {
    throw new Error('Enter the amount you paid before completing this service.');
  }

  const bookingRef = doc(db, 'bookings', bookingId);
  debugBookingService('complete client payment transaction started', { bookingId, clientId });

  await runTransaction(db, async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingRef);

    if (!bookingSnapshot.exists()) {
      throw new Error('Booking was not found.');
    }

    const booking = bookingSnapshot.data();

    if (booking.clientId !== clientId) {
      throw new Error('This payment does not belong to your client account.');
    }

    if (!['awaiting_payment', 'completed'].includes(booking.status)) {
      throw new Error('Payment can be completed after the labour finishes the work.');
    }

    if (booking.paymentStatus === 'paid') {
      throw new Error('This service payment is already completed.');
    }

    transaction.update(bookingRef, {
      status: 'completed',
      amount: normalizedPaidAmount,
      finalAmount: normalizedPaidAmount,
      paymentStatus: 'paid',
      paidAt: serverTimestamp(),
      paidBy: clientId,
      completedAt: booking.completedAt || serverTimestamp(),
      clientCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  debugBookingService('complete client payment transaction completed', { bookingId, clientId });
};

export const markBookingPaid = async ({ bookingId, clientId, paidAmount }) => {
  await completeClientPayment({ bookingId, clientId, paidAmount });
};
