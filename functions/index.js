const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const { defineSecret, defineString } = require('firebase-functions/params');
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
