const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const { defineSecret, defineString } = require('firebase-functions/params');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');

admin.initializeApp();

const db = admin.firestore();

const whatsappAccessToken = defineSecret('WHATSAPP_ACCESS_TOKEN');
const whatsappPhoneNumberId = defineString('WHATSAPP_PHONE_NUMBER_ID');
const whatsappLanguageCode = defineString('WHATSAPP_LANGUAGE_CODE', { default: 'en' });
const appUrl = defineString('APP_URL', { default: 'https://worklink-gold.vercel.app' });

const templateNewServiceRequest = defineString('WHATSAPP_TEMPLATE_NEW_SERVICE_REQUEST', {
  default: 'new_booking_request'
});
const templateNewScheduledRequest = defineString('WHATSAPP_TEMPLATE_NEW_SCHEDULED_REQUEST', {
  default: 'new_scheduled_request'
});
const templateJobAcceptedClient = defineString('WHATSAPP_TEMPLATE_JOB_ACCEPTED_CLIENT', {
  default: 'job_accepted_client'
});
const templateScheduledJobReminder = defineString('WHATSAPP_TEMPLATE_SCHEDULED_JOB_REMINDER', {
  default: 'scheduled_job_reminder'
});
const templateJobCompletedClient = defineString('WHATSAPP_TEMPLATE_JOB_COMPLETED_CLIENT', {
  default: 'job_completed_client'
});
const templateJobCompletedLabour = defineString('WHATSAPP_TEMPLATE_JOB_COMPLETED_LABOUR', {
  default: 'job_completed_labour'
});

const functionOptions = {
  region: 'asia-south1',
  secrets: [whatsappAccessToken]
};

const eventFunctionOptions = {
  ...functionOptions,
  minInstances: 1,
  maxInstances: 20
};

const scheduledFunctionOptions = {
  ...functionOptions,
  maxInstances: 1
};

const phoneProfileFunctionOptions = {
  region: 'asia-south1'
};

const pushFunctionOptions = {
  region: 'asia-south1'
};

const toText = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const normalizePhoneNumber = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
};

const normalizeFirebasePhoneNumber = (value) => {
  const phoneNumber = normalizePhoneNumber(value);
  return phoneNumber ? `+${phoneNumber}` : '';
};

const getPhoneLookupValues = (value) => {
  const phoneNumber = normalizePhoneNumber(value);
  const values = [phoneNumber];

  if (phoneNumber) {
    values.push(`+${phoneNumber}`);
  }

  if (phoneNumber.startsWith('91') && phoneNumber.length === 12) {
    values.push(phoneNumber.slice(2));
  }

  return [...new Set(values.filter(Boolean))];
};

const parseDate = (value) => {
  if (!value) {
    return null;
  }

  if (value.toDate) {
    return value.toDate();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = parseDate(value);

  if (!date) {
    return 'the scheduled date';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  }).format(date);
};

const formatTime = (value) => {
  const date = parseDate(value);

  if (!date) {
    return 'the scheduled time';
  }

  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  }).format(date);
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number.isFinite(amount) ? amount : 0);
};

const getBookingLocation = (booking) =>
  toText(
    booking.requestedAddress || booking.location || booking.address,
    booking.coordinates ? 'client live location' : 'the client location'
  );

const getBookingUrl = (booking, audience) => {
  const baseUrl = appUrl.value().replace(/\/$/, '');

  if (audience === 'labour') {
    return `${baseUrl}/labour/services`;
  }

  if (audience === 'earnings') {
    return `${baseUrl}/labour/earnings`;
  }

  return `${baseUrl}/client`;
};

const getNotificationRoute = () => '/';

const getNotificationUrl = (notification) => {
  const baseUrl = appUrl.value().replace(/\/$/, '');
  return `${baseUrl}${getNotificationRoute(notification)}`;
};

const getUserPushTokens = async (userId) => {
  if (!userId) {
    return [];
  }

  const userSnapshot = await db.collection('users').doc(userId).get();
  const user = userSnapshot.data() || {};
  const pushTokens = user.pushTokens || {};
  const pushTokenList = Array.isArray(user.pushTokenList) ? user.pushTokenList : [];

  return [...new Set([...Object.keys(pushTokens), ...pushTokenList].filter(Boolean))];
};

const sendPushToUser = async ({ userId, title, body, data = {} }) => {
  const tokens = await getUserPushTokens(userId);

  if (!tokens.length) {
    logger.info('Push notification skipped: no registered tokens.', { userId });
    return;
  }

  const result = await admin.messaging().sendEachForMulticast({
    tokens: tokens.slice(0, 500),
    notification: {
      title: toText(title, 'Slivz'),
      body: toText(body, 'You have a new update.')
    },
    data: Object.entries(data).reduce((payload, [key, value]) => {
      if (value !== undefined && value !== null) {
        payload[key] = String(value);
      }

      return payload;
    }, {})
  });

  logger.info('Push notification send completed.', {
    userId,
    successCount: result.successCount,
    failureCount: result.failureCount
  });
};

const bodyComponent = (values) => ({
  type: 'body',
  parameters: values.map((value) => ({
    type: 'text',
    text: toText(value, '-')
  }))
});

const sendWhatsAppTemplate = async ({ to, templateName, bodyValues, meta = {} }) => {
  const phoneNumber = normalizePhoneNumber(to);
  const phoneNumberId = whatsappPhoneNumberId.value();
  const token = whatsappAccessToken.value();

  if (!phoneNumber || !phoneNumberId || !token || !templateName) {
    logger.warn('WhatsApp send skipped: missing phone, phone number id, token, or template.', {
      ...meta,
      hasPhone: Boolean(phoneNumber),
      hasPhoneNumberId: Boolean(phoneNumberId),
      hasToken: Boolean(token),
      hasTemplate: Boolean(templateName)
    });
    return { skipped: true };
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: whatsappLanguageCode.value()
        },
        components: [bodyComponent(bodyValues)]
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  await db.collection('whatsappLogs').add({
    ...meta,
    to: phoneNumber,
    templateName,
    ok: response.ok,
    status: response.status,
    response: payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (!response.ok) {
    logger.error('WhatsApp template send failed.', {
      ...meta,
      templateName,
      status: response.status,
      payload
    });
    return { ok: false, status: response.status, payload };
  }

  logger.info('WhatsApp template sent.', {
    ...meta,
    templateName,
    messageId: payload.messages?.[0]?.id
  });

  return { ok: true, payload };
};

const markBooking = (bookingId, payload) =>
  db.collection('bookings').doc(bookingId).set(
    {
      whatsapp: {
        ...payload,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

const incrementLabourCompletedJobs = async (labourId) => {
  if (!labourId) {
    return;
  }

  const updates = {
    completedJobs: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await Promise.all([
    db.collection('labours').doc(labourId).set(updates, { merge: true }),
    db.collection('users').doc(labourId).set(updates, { merge: true })
  ]);
};

const syncLabourCompletedJobs = async (uid) => {
  if (!uid) {
    throw new HttpsError('invalid-argument', 'A valid user id is required.');
  }

  const [userSnapshot, labourSnapshot, bookingsSnapshot] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('labours').doc(uid).get(),
    db.collection('bookings').where('labourId', '==', uid).get()
  ]);

  if (!userSnapshot.exists) {
    throw new HttpsError('not-found', 'User profile not found.');
  }

  const completedJobs = bookingsSnapshot.docs.filter((bookingDoc) => {
    const booking = bookingDoc.data() || {};
    return booking.status === 'completed' && booking.paymentStatus === 'paid';
  }).length;

  const resolvedCompletedJobs = Number(completedJobs) || 0;

  const updates = {
    completedJobs: resolvedCompletedJobs,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await Promise.all([
    db.collection('users').doc(uid).set(updates, { merge: true }),
    db.collection('labours').doc(uid).set(updates, { merge: true })
  ]);

  return {
    completedJobs: resolvedCompletedJobs
  };
};

const syncLabourReviewStats = async (labourId) => {
  if (!labourId) {
    return;
  }

  const reviewsSnapshot = await db.collection('reviews').where('labourId', '==', labourId).get();
  const reviews = reviewsSnapshot.docs
    .map((reviewDoc) => Number(reviewDoc.data()?.rating || 0))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  const reviewsCount = reviews.length;
  const rating = reviewsCount
    ? Number((reviews.reduce((sum, value) => sum + value, 0) / reviewsCount).toFixed(2))
    : 0;
  const updates = {
    rating,
    reviewsCount,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await Promise.all([
    db.collection('labours').doc(labourId).set(updates, { merge: true }),
    db.collection('users').doc(labourId).set(updates, { merge: true })
  ]);
};

const getWhatsAppFailureFields = (prefix, result) => {
  const error = result?.payload?.error || {};

  return {
    [`${prefix}FailedAt`]: admin.firestore.FieldValue.serverTimestamp(),
    [`${prefix}ErrorStatus`]: result?.status || null,
    [`${prefix}ErrorCode`]: error.code || null,
    [`${prefix}ErrorMessage`]: error.message || 'WhatsApp send failed'
  };
};

const sendNewBookingMessage = async (bookingId, booking) => {
  const isScheduled = booking.requestMode === 'scheduled';
  const templateName = isScheduled
    ? templateNewScheduledRequest.value()
    : templateNewServiceRequest.value();
  const bodyValues = isScheduled
    ? [
        booking.labourName || 'Worker',
        booking.clientName || 'Customer',
        booking.serviceType || 'service',
        getBookingLocation(booking),
        formatDate(booking.appointmentAt),
        formatTime(booking.appointmentAt)
      ]
    : [
        booking.labourName || 'Worker',
        booking.clientName || 'Customer',
        booking.serviceType || 'service',
        getBookingLocation(booking)
      ];

  const result = await sendWhatsAppTemplate({
    to: booking.labourPhoneNumber,
    templateName,
    bodyValues,
    meta: {
      bookingId,
      kind: isScheduled ? 'new_scheduled_request' : 'new_booking_request',
      audience: 'labour',
      url: getBookingUrl(booking, 'labour')
    }
  });

  if (result.ok) {
    await markBooking(bookingId, {
      requestTemplateSentAt: admin.firestore.FieldValue.serverTimestamp(),
      requestTemplateName: templateName
    });
    return;
  }

  await markBooking(bookingId, {
    ...getWhatsAppFailureFields('requestTemplate', result),
    requestTemplateName: templateName
  });
};

exports.sendBookingRequestWhatsApp = onDocumentCreated(
  {
    ...eventFunctionOptions,
    document: 'bookings/{bookingId}'
  },
  async (event) => {
    const booking = event.data?.data();

    if (!booking || booking.whatsapp?.requestTemplateSentAt) {
      return;
    }

    await sendNewBookingMessage(event.params.bookingId, booking);
  }
);

exports.sendAppPushNotification = onDocumentCreated(
  {
    ...pushFunctionOptions,
    document: 'notifications/{notificationId}'
  },
  async (event) => {
    const notification = event.data?.data();

    if (!notification?.userId) {
      logger.warn('Push notification skipped: missing user id.', {
        notificationId: event.params.notificationId
      });
      return;
    }

    await sendPushToUser({
      userId: notification.userId,
      title: notification.title,
      body: notification.body,
      data: {
        notificationId: event.params.notificationId,
        type: notification.type || '',
        bookingId: notification.bookingId || '',
        conversationId: notification.conversationId || '',
        route: getNotificationRoute(notification),
        url: getNotificationUrl(notification)
      }
    });
  }
);

exports.syncLabourReviewStatsOnReviewCreate = onDocumentCreated(
  {
    ...eventFunctionOptions,
    document: 'reviews/{reviewId}'
  },
  async (event) => {
    const review = event.data?.data();

    if (!review?.labourId) {
      logger.warn('Review stats sync skipped: missing labourId.', {
        reviewId: event.params.reviewId
      });
      return;
    }

    await syncLabourReviewStats(review.labourId);
  }
);

exports.syncLabourProfileCompletedJobs = onCall(
  {
    ...functionOptions
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in to sync your profile.');
    }

    const requestedUid = String(request.data?.uid || '').trim();
    if (!requestedUid) {
      throw new HttpsError('invalid-argument', 'A valid user id is required.');
    }

    if (requestedUid !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'You can only sync your own labour profile.');
    }

    return syncLabourCompletedJobs(requestedUid);
  }
);

exports.resolvePhoneProfileLogin = onCall(
  {
    ...phoneProfileFunctionOptions
  },
  async (request) => {
    try {
      const authUid = request.auth?.uid;
      const verifiedAuthPhone = normalizeFirebasePhoneNumber(request.auth?.token?.phone_number);
      const requestedPhone = normalizeFirebasePhoneNumber(request.data?.phoneNumber);

      if (!authUid) {
        throw new HttpsError('unauthenticated', 'You must verify your phone before logging in.');
      }

      if (!verifiedAuthPhone || !requestedPhone || verifiedAuthPhone !== requestedPhone) {
        throw new HttpsError('permission-denied', 'The verified phone number does not match this request.');
      }

      const phoneLookupValues = getPhoneLookupValues(verifiedAuthPhone);
      const profileSnapshot = await db
        .collection('users')
        .where('phoneNumber', 'in', phoneLookupValues)
        .limit(5)
        .get();

      if (profileSnapshot.empty) {
        return { matched: false };
      }

      const matchingProfile =
        profileSnapshot.docs.find((profileDoc) => profileDoc.id !== authUid) ||
        profileSnapshot.docs.find((profileDoc) => profileDoc.id === authUid);

      if (!matchingProfile || matchingProfile.id === authUid) {
        return { matched: true, uid: authUid };
      }

      try {
        await admin.auth().getUser(matchingProfile.id);
      } catch (error) {
        logger.error('Phone profile match has no Firebase Auth user.', {
          authUid,
          matchedUid: matchingProfile.id,
          phoneLookupValues,
          error: error?.message
        });
        throw new HttpsError(
          'failed-precondition',
          'This phone matches a Slivz profile, but its Firebase Auth account was not found.'
        );
      }

      const customToken = await admin.auth().createCustomToken(matchingProfile.id);

      return {
        customToken,
        matched: true,
        uid: matchingProfile.id
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error('Phone profile login resolver failed.', {
        authUid: request.auth?.uid,
        phoneNumber: request.auth?.token?.phone_number,
        errorCode: error?.code,
        errorMessage: error?.message
      });
      throw new HttpsError(
        'internal',
        'Phone profile login failed on the server. Check Firebase Functions logs.'
      );
    }
  }
);

exports.sendBookingStatusWhatsApp = onDocumentUpdated(
  {
    ...eventFunctionOptions,
    document: 'bookings/{bookingId}'
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const bookingId = event.params.bookingId;

    if (!before || !after) {
      return;
    }

    const updates = {};

    if (
      before.status !== 'accepted' &&
      after.status === 'accepted' &&
      !after.whatsapp?.acceptedClientSentAt
    ) {
      const result = await sendWhatsAppTemplate({
        to: after.clientPhoneNumber,
        templateName: templateJobAcceptedClient.value(),
        bodyValues: [
          after.clientName || 'Customer',
          after.labourName || 'Worker',
          after.serviceType || 'service'
        ],
        meta: {
          bookingId,
          kind: 'job_accepted_client',
          audience: 'client',
          url: getBookingUrl(after, 'client')
        }
      });
      updates.acceptedClientTemplateName = templateJobAcceptedClient.value();
      if (result.ok) {
        updates.acceptedClientSentAt = admin.firestore.FieldValue.serverTimestamp();
      } else {
        Object.assign(updates, getWhatsAppFailureFields('acceptedClient', result));
      }
    }

    if (
      after.status === 'completed' &&
      after.paymentStatus === 'paid' &&
      before.paymentStatus !== 'paid'
    ) {
      if (!after.whatsapp?.completedClientSentAt) {
        const result = await sendWhatsAppTemplate({
          to: after.clientPhoneNumber,
          templateName: templateJobCompletedClient.value(),
          bodyValues: [
            after.clientName || 'Customer',
            after.labourName || 'Worker',
            after.serviceType || 'service',
            formatCurrency(after.amount || after.finalAmount)
          ],
          meta: {
            bookingId,
            kind: 'job_completed_client',
            audience: 'client',
            url: getBookingUrl(after, 'client')
          }
        });
        updates.completedClientTemplateName = templateJobCompletedClient.value();
        if (result.ok) {
          updates.completedClientSentAt = admin.firestore.FieldValue.serverTimestamp();
        } else {
          Object.assign(updates, getWhatsAppFailureFields('completedClient', result));
        }
      }

      if (!after.whatsapp?.completedLabourSentAt) {
        const result = await sendWhatsAppTemplate({
          to: after.labourPhoneNumber,
          templateName: templateJobCompletedLabour.value(),
          bodyValues: [
            after.labourName || 'Worker',
            after.clientName || 'Customer',
            after.serviceType || 'service',
            formatCurrency(after.amount || after.finalAmount)
          ],
          meta: {
            bookingId,
            kind: 'job_completed_labour',
            audience: 'labour',
            url: getBookingUrl(after, 'earnings')
          }
        });
        updates.completedLabourTemplateName = templateJobCompletedLabour.value();
        if (result.ok) {
          updates.completedLabourSentAt = admin.firestore.FieldValue.serverTimestamp();
        } else {
          Object.assign(updates, getWhatsAppFailureFields('completedLabour', result));
        }
      }

      await incrementLabourCompletedJobs(after.labourId);
    }

    if (Object.keys(updates).length) {
      await markBooking(bookingId, updates);
    }
  }
);

exports.sendScheduledJobReminders = onSchedule(
  {
    ...scheduledFunctionOptions,
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Kolkata'
  },
  async () => {
    const now = Date.now();
    const startsAfter = new Date(now + 45 * 60 * 1000);
    const startsBefore = new Date(now + 75 * 60 * 1000);
    const snapshot = await db
      .collection('bookings')
      .where('requestMode', '==', 'scheduled')
      .where('status', '==', 'accepted')
      .get();

    const jobs = snapshot.docs.map(async (docSnapshot) => {
      const booking = docSnapshot.data();
      const appointmentAt = parseDate(booking.appointmentAt);

      if (
        !appointmentAt ||
        appointmentAt < startsAfter ||
        appointmentAt > startsBefore ||
        booking.whatsapp?.scheduledReminderSentAt
      ) {
        return;
      }

      const result = await sendWhatsAppTemplate({
        to: booking.labourPhoneNumber,
        templateName: templateScheduledJobReminder.value(),
        bodyValues: [
          booking.labourName || 'Worker',
          booking.clientName || 'Customer',
          booking.serviceType || 'service',
          getBookingLocation(booking)
        ],
        meta: {
          bookingId: docSnapshot.id,
          kind: 'scheduled_job_reminder',
          audience: 'labour',
          url: getBookingUrl(booking, 'labour')
        }
      });

      if (result.ok) {
        await markBooking(docSnapshot.id, {
          scheduledReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
          scheduledReminderTemplateName: templateScheduledJobReminder.value()
        });
        return;
      }

      await markBooking(docSnapshot.id, {
        ...getWhatsAppFailureFields('scheduledReminder', result),
        scheduledReminderTemplateName: templateScheduledJobReminder.value()
      });
    });

    await Promise.all(jobs);
  }
);
