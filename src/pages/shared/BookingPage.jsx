import {
  CheckCircle2,
  Clock3,
  LocateFixed,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  RotateCcw,
  Search,
  Send,
  UserCheck
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import { BookingCalendar } from '../../components/booking/BookingCalendar';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { InputField } from '../../components/common/InputField';
import { PageSEO } from '../../components/common/PageSEO';
import { SelectField } from '../../components/common/SelectField';
import { TextAreaField } from '../../components/common/TextAreaField';
import { LocationPermissionPrompt } from '../../components/location/LocationPermissionPrompt';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLocationName } from '../../hooks/useLocationName';
import {
  completeClientPayment,
  createBooking,
  subscribeBookingsForUser,
  updateBookingStatus
} from '../../services/bookingService';
import { ensureConversation } from '../../services/chatService';
import { getLabourById, searchLabours } from '../../services/labourService';
import { createNotification } from '../../services/notificationService';
import { NEARBY_LABOUR_RADIUS_KM, workCategories } from '../../utils/constants';
import {
  buildAppointmentDateTime,
  formatCurrency,
  formatDate,
  formatDistanceKm
} from '../../utils/formatters';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import { getDisplayLocationText, getLocationLabel, normalizeCoordinates } from '../../utils/location';
import { fetchMapboxLocationName } from '../../utils/mapbox';
import { buildProfileAvatarDataUrl } from '../../utils/profileAvatar';
import { createRouteGroupId } from '../../utils/requestRouting';

const activeWorkStatuses = ['accepted', 'in_progress'];
const generateStartOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const debugBooking = (message, payload = {}) => {
  if (import.meta.env.DEV) {
    console.debug(`[Slivz booking] ${message}`, payload);
  }
};

const getBookingTime = (booking) =>
  booking.appointmentAt
    ? formatDate(booking.appointmentAt, 'dd MMM yyyy - hh:mm a')
    : 'Time not selected';

const BookingPage = () => {
  const [searchParams] = useSearchParams();
  const labourId = searchParams.get('labourId');
  const initialService = searchParams.get('service') ?? '';
  const initialCategory = searchParams.get('category') ?? '';
  const { currentUser, userProfile } = useAuth();
  const geolocation = useGeolocation();
  const [availableLabours, setAvailableLabours] = useState([]);
  const [selectedLabour, setSelectedLabour] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [requestTiming, setRequestTiming] = useState('instant');
  const [bookings, setBookings] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoRetriedRejectionId, setAutoRetriedRejectionId] = useState('');
  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [completingPaymentId, setCompletingPaymentId] = useState('');
  const [cancellingBookingId, setCancellingBookingId] = useState('');
  const [formValues, setFormValues] = useState({
    serviceName: initialService,
    serviceDetails: '',
    address: getDisplayLocationText(userProfile?.location, '')
  });
  const [requestCoordinates, setRequestCoordinates] = useState(
    () => normalizeCoordinates(userProfile?.coordinates) || null
  );
  const clientLocation = requestCoordinates;
  const savedProfileLocation = useMemo(
    () => getLocationLabel(userProfile, { fallback: '' }),
    [userProfile]
  );
  const resolvedLocationName = useLocationName(clientLocation);
  const locationStatusLabel = clientLocation
    ? getDisplayLocationText(savedProfileLocation || resolvedLocationName, 'Live location captured')
    : 'Manual address only';

  useEffect(() => {
    if (!labourId) {
      return;
    }

    getLabourById(labourId).then((labour) => {
      if (labour) {
        setSelectedLabour(labour);
        setAvailableLabours((prev) =>
          prev.some((item) => item.id === labour.id) ? prev : [labour, ...prev]
        );
        setSearched(true);
      }
    });
  }, [labourId]);

  useEffect(() => {
    if (!currentUser || !userProfile?.role) {
      setBookings([]);
      return undefined;
    }

    return subscribeBookingsForUser(
      { userId: currentUser.uid, role: userProfile.role },
      setBookings,
      (error) => toast.error(getFirebaseErrorMessage(error))
    );
  }, [currentUser?.uid, userProfile?.role]);

  useEffect(() => {
    if (userProfile?.location) {
      setFormValues((prev) => ({
        ...prev,
        address: prev.address || getDisplayLocationText(userProfile.location, '')
      }));
    }
  }, [userProfile?.location]);

  useEffect(() => {
    const savedCoordinates = normalizeCoordinates(userProfile?.coordinates) || null;

    setRequestCoordinates((prev) => prev || savedCoordinates);
  }, [userProfile?.coordinates]);

  useEffect(() => {
    if (!initialCategory || formValues.serviceName.trim()) {
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      serviceName: initialCategory
    }));
  }, [formValues.serviceName, initialCategory]);

  const activeBookings = useMemo(
    () => bookings.filter((booking) => activeWorkStatuses.includes(booking.status)),
    [bookings]
  );
  const pendingBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'pending'),
    [bookings]
  );
  const awaitingPaymentBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'awaiting_payment'),
    [bookings]
  );
  const rejectedBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'rejected'),
    [bookings]
  );
  const inProgressBooking = useMemo(
    () => bookings.find((booking) => booking.status === 'in_progress') ?? null,
    [bookings]
  );
  const clientIsBusy = Boolean(inProgressBooking);
  const currentService = formValues.serviceName.trim();
  const serviceBookingIds = useMemo(
    () =>
      new Set(
        bookings
          .filter((booking) => booking.serviceType?.toLowerCase() === currentService.toLowerCase())
          .map((booking) => booking.labourId)
      ),
    [bookings, currentService]
  );
  const sortedAvailableLabours = useMemo(
    () =>
      [...availableLabours].sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) {
          return b.rating - a.rating;
        }

        if (a.distanceKm == null) {
          return 1;
        }

        if (b.distanceKm == null) {
          return -1;
        }

        return a.distanceKm - b.distanceKm;
      }),
    [availableLabours]
  );
  const alternativeLabours = useMemo(
    () => sortedAvailableLabours.filter((labour) => !serviceBookingIds.has(labour.id)),
    [serviceBookingIds, sortedAvailableLabours]
  );
  const hasOpenRequest = pendingBookings.length > 0 || activeBookings.length > 0 || awaitingPaymentBookings.length > 0;

  const canSearch = Boolean(formValues.serviceName.trim() && formValues.address.trim() && clientLocation);
  const canRequest = Boolean(
    !clientIsBusy &&
      !hasOpenRequest &&
      selectedLabour &&
      selectedLabour.availability === 'Available' &&
      formValues.serviceName.trim() &&
      formValues.address.trim() &&
      (requestTiming === 'instant' || (selectedDate && selectedSlot))
  );

  const updateFormValue = (key, value) =>
    setFormValues((prev) => ({
      ...prev,
      [key]: value
    }));

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    debugBooking('client bookings updated', {
      userId: currentUser.uid,
      pending: pendingBookings.length,
      active: activeBookings.length,
      awaitingPayment: awaitingPaymentBookings.length,
      rejected: rejectedBookings.length,
      total: bookings.length
    });
  }, [
    activeBookings.length,
    awaitingPaymentBookings.length,
    bookings.length,
    currentUser,
    pendingBookings.length,
    rejectedBookings.length
  ]);

  const handleServiceSelect = async (service) => {
    setSelectedLabour(null);
    setAvailableLabours([]);
    setSearched(false);
    updateFormValue('serviceName', service);

    if (!formValues.address.trim()) {
      toast.error('Add your address before checking labour availability.');
      return;
    }

    await handleSearchLabour(service);
  };

  const handleSearchLabour = async (serviceOverride) => {
    if (hasOpenRequest) {
      toast.error('Complete or cancel your current request before searching another labour.');
      return;
    }

    const serviceName = serviceOverride || formValues.serviceName;

    if (!serviceName.trim() || !formValues.address.trim()) {
      toast.error('Add service name and address before searching labour.');
      return;
    }

    if (!clientLocation) {
      toast.error(`Use live location before checking labour within ${NEARBY_LABOUR_RADIUS_KM} km.`);
      return;
    }

    setSearching(true);
    setSearched(true);
    debugBooking('search started', {
      serviceName,
      address: formValues.address,
      clientLocation
    });

    try {
      const results = await searchLabours(
        {
          skill: serviceName,
          category: workCategories.includes(serviceName) ? serviceName : initialCategory,
          availability: 'Available',
          maxDistanceKm: NEARBY_LABOUR_RADIUS_KM
        },
        clientLocation
      );

      setAvailableLabours(results);
      setSelectedLabour((prev) => {
        const previousStillAvailable = results.find(
          (item) => item.id === prev?.id && !serviceBookingIds.has(item.id)
        );
        const nearestUntried = results.find((item) => !serviceBookingIds.has(item.id));

        return previousStillAvailable ?? nearestUntried ?? results[0] ?? null;
      });
      debugBooking('search completed', {
        serviceName,
        resultCount: results.length,
        nearestLabour: results[0]?.fullName ?? null
      });

      if (!results.length) {
        toast.error(`${serviceName} is not available within ${NEARBY_LABOUR_RADIUS_KM} km right now.`);
      }
    } catch (error) {
      console.error('[Slivz booking] search failed', error);
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const latestRejected = rejectedBookings.find(
      (booking) => booking.serviceType?.toLowerCase() === currentService.toLowerCase()
    );

    if (
      !latestRejected ||
      latestRejected.id === autoRetriedRejectionId ||
      hasOpenRequest ||
      searching ||
      !formValues.address.trim()
    ) {
      return;
    }

    setAutoRetriedRejectionId(latestRejected.id);
    debugBooking('labour rejected request, checking next available labour', {
      rejectedBookingId: latestRejected.id,
      rejectedLabourId: latestRejected.labourId,
      serviceType: latestRejected.serviceType
    });
    handleSearchLabour(latestRejected.serviceType);
  }, [
    autoRetriedRejectionId,
    currentService,
    formValues.address,
    hasOpenRequest,
    rejectedBookings,
    searching
  ]);

  const handleOpenChat = async (labour) => {
    if (!currentUser || !labour?.id) {
      return;
    }

    try {
      await ensureConversation({
        currentUserId: currentUser.uid,
        otherUserId: labour.id,
        metadata: {
          currentUserProfile: {
            fullName: userProfile?.fullName,
            role: 'client',
            phoneNumber: userProfile?.phoneNumber || currentUser.phoneNumber || ''
          },
          otherUserProfile: {
            fullName: labour.fullName,
            role: labour.category || 'labour',
            phoneNumber: labour.phoneNumber || '',
            whatsAppLink: labour.phoneNumber
              ? `https://wa.me/${labour.phoneNumber.replace(/\D/g, '')}`
              : ''
          }
        }
      });
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    }
  };

  const handleRefreshLocation = async () => {
    const coordinates = await geolocation.requestLocation({ force: true });

    if (!coordinates) {
      toast.error(geolocation.error || 'Allow browser location to update this request.');
      return null;
    }

    setRequestCoordinates(coordinates);
    const resolvedLocationName = await fetchMapboxLocationName(coordinates);
    if (resolvedLocationName) {
      setFormValues((prev) => ({
        ...prev,
        address: getDisplayLocationText(prev.address, '') || resolvedLocationName
      }));
    }
    toast.success('Location updated for this request.');
    return coordinates;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!currentUser || userProfile?.role !== 'client') {
      toast.error('Sign in as a client to confirm a service request.');
      return;
    }

    if (!canRequest) {
      toast.error(
        requestTiming === 'instant'
          ? 'Choose service, address, and an available labour before sending.'
          : 'Choose service, address, date, time, and an available labour before sending.'
      );
      return;
    }

    setSubmitting(true);
    debugBooking('request submit started', {
      labourId: selectedLabour.id,
      labourName: selectedLabour.fullName,
      serviceType: formValues.serviceName,
      location: formValues.address,
      clientLocation
    });

    try {
      const appointmentAt =
        requestTiming === 'instant'
          ? new Date().toISOString()
          : buildAppointmentDateTime(selectedDate, selectedSlot);
      const routeGroupId = createRouteGroupId(currentUser.uid);
      const bookingId = await createBooking({
        clientId: currentUser.uid,
        clientName: userProfile.fullName,
        clientProfilePhoto:
          userProfile.profilePhoto ||
          buildProfileAvatarDataUrl(userProfile.fullName || currentUser.displayName || 'Client'),
        clientPhoneNumber: userProfile.phoneNumber || currentUser.phoneNumber || '',
        clientEmail: userProfile.email || currentUser.email || '',
        labourId: selectedLabour.id,
        labourName: selectedLabour.fullName,
        labourProfilePhoto:
          selectedLabour.profilePhoto || buildProfileAvatarDataUrl(selectedLabour.fullName || 'Labour'),
        labourPhoneNumber: selectedLabour.phoneNumber || '',
        serviceType: formValues.serviceName,
        serviceDetails: formValues.serviceDetails,
        location: formValues.address,
        coordinates: clientLocation,
        notes: formValues.serviceDetails,
        amount: 0,
        paymentStatus: 'not_requested',
        appointmentAt,
        requestMode: requestTiming,
        startOtp: generateStartOtp(),
        requestFlow: 'client_service_map',
        routeGroupId,
        previousLabourIds: []
      });

      let notificationDelivered = true;

      try {
        await createNotification({
          userId: selectedLabour.id,
          senderId: currentUser.uid,
          title: 'New service request',
          body:
            requestTiming === 'instant'
              ? `${userProfile.fullName} requested ${formValues.serviceName} instantly at ${formValues.address}.`
              : `${userProfile.fullName} requested ${formValues.serviceName} at ${formValues.address}.`,
          type: 'booking',
          bookingId
        });
      } catch (notificationError) {
        notificationDelivered = false;
        console.warn('Slivz notification delivery skipped:', notificationError);
      }

      debugBooking('request submitted', {
        bookingId,
        labourId: selectedLabour.id,
        notificationDelivered
      });

      toast.success(
        notificationDelivered
          ? 'Request submitted. Wait a few seconds for the labour response.'
          : 'Request submitted. Open the labour dashboard and notifications after Firestore rules are deployed.'
      );
    } catch (error) {
      console.error('[Slivz booking] request submit failed', error);
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentAmountChange = (bookingId, value) => {
    const normalizedValue = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    setPaymentAmounts((prev) => ({ ...prev, [bookingId]: normalizedValue }));
  };

  const handleCompleteClientPayment = async (booking) => {
    if (!currentUser?.uid) {
      return;
    }

    const paidAmount = Number(paymentAmounts[booking.id]);

    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      toast.error('Enter the amount you paid to complete this service.');
      return;
    }

    setCompletingPaymentId(booking.id);

    try {
      await completeClientPayment({ bookingId: booking.id, clientId: currentUser.uid, paidAmount });
      setPaymentAmounts((prev) => ({ ...prev, [booking.id]: '' }));
      toast.success('Service completed with paid amount.');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setCompletingPaymentId('');
    }
  };

  const handleCancelBooking = async (booking) => {
    if (booking.clientId !== currentUser?.uid) {
      toast.error('This request does not belong to your client account.');
      return;
    }

    setCancellingBookingId(booking.id);

    try {
      await updateBookingStatus(booking.id, 'cancelled');
      toast.success('Service request cancelled.');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setCancellingBookingId('');
    }
  };

  return (
    <AppShell>
      <PageSEO
        title="Request Service"
        description="Request nearby labour with location, service details, and acceptance-based contact access."
      />

      <section className="section-space">
        <div className="page-shell space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <Card className="rounded-[28px] border-slate-300 p-4 shadow-sm sm:p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.25em] text-brand-700">
                      Client request
                    </p>
                    <h1 className="mt-3 break-words font-display text-3xl font-bold text-slate-950 sm:text-4xl">
                      Request service
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-700">
                      Share the work, set the address, find available labour within {NEARBY_LABOUR_RADIUS_KM} km, and send one clear request.
                    </p>
                  </div>
                    <Badge tone={clientLocation ? 'emerald' : 'amber'} className="justify-center">
                      {geolocation.loading
                        ? 'Updating location'
                        : clientLocation
                        ? 'Saved location ready'
                        : 'Manual location ready'}
                  </Badge>
                </div>

                <SelectField
                  label="Service"
                  placeholder="Choose a service"
                  options={workCategories}
                  value={workCategories.includes(formValues.serviceName) ? formValues.serviceName : ''}
                  className="mt-6"
                  onChange={(event) => handleServiceSelect(event.target.value)}
                />
              </Card>

              {pendingBookings.length ? (
                <Card className="rounded-[28px] border-brand-200 bg-brand-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
                        Requesting
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                        Waiting for labour response
                      </h2>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                        {pendingBookings[0].labourName} received your {pendingBookings[0].serviceType} request.
                      </p>
                    </div>
                    <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-brand-600 text-white shadow-glow">
                      <LoaderCircle size={30} className="animate-spin" />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      as="a"
                      href={(pendingBookings[0].labourPhoneNumber || pendingBookings[0].privateLabourPhoneNumber) ? `tel:${pendingBookings[0].labourPhoneNumber || pendingBookings[0].privateLabourPhoneNumber}` : undefined}
                      size="sm"
                      className={`w-full sm:w-auto ${!(pendingBookings[0].labourPhoneNumber || pendingBookings[0].privateLabourPhoneNumber) ? 'pointer-events-none opacity-60' : ''}`}
                    >
                      <Phone size={15} />
                      Call
                    </Button>
                    <Button
                      as={Link}
                      to={`/chat?target=${encodeURIComponent(pendingBookings[0].labourId)}&booking=${encodeURIComponent(pendingBookings[0].id)}`}
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      <MessageCircle size={15} />
                      Chat
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      className="w-full sm:w-auto"
                      disabled={cancellingBookingId === pendingBookings[0].id}
                      onClick={() => handleCancelBooking(pendingBookings[0])}
                    >
                      {cancellingBookingId === pendingBookings[0].id ? 'Cancelling...' : 'Cancel request'}
                    </Button>
                  </div>
                </Card>
              ) : null}

              {rejectedBookings.length && alternativeLabours.length ? (
                <Card className="rounded-[28px] border-amber-200 bg-amber-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-amber-950">Previous labour rejected</h2>
                      <p className="mt-2 text-sm font-medium leading-6 text-amber-900">
                        Pick the next nearest available worker for this service.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => setSelectedLabour(alternativeLabours[0])}
                    >
                      <RotateCcw size={15} />
                      Try next labour
                    </Button>
                  </div>
                </Card>
              ) : null}

              {selectedLabour ? (
                <Card className="rounded-[28px] border-brand-200 bg-brand-50/60 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
                        Selected labour
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                        {selectedLabour.fullName}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-700">
                        <Badge tone="emerald">{selectedLabour.availability}</Badge>
                        <Badge tone="slate">{formatDistanceKm(selectedLabour.distanceKm)}</Badge>
                      </div>
                    </div>
                    <Button as={Link} to={`/labour/${selectedLabour.id}`} variant="outline" className="w-full sm:w-auto">
                      View profile
                    </Button>
                  </div>
                </Card>
              ) : null}

              {clientIsBusy ? (
                <Card className="rounded-[28px] border-amber-200 bg-amber-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-amber-950">Work in progress</h2>
                      <p className="mt-2 text-sm font-medium leading-6 text-amber-900">
                        {inProgressBooking.labourName} is working on {inProgressBooking.serviceType}. New
                        requests unlock after this job is completed.
                      </p>
                    </div>
                    <Badge tone="amber">Client busy</Badge>
                  </div>
                </Card>
              ) : null}

              {awaitingPaymentBookings.length ? (
                <Card className="rounded-[28px] border-amber-200 bg-amber-50 p-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div>
                      <h2 className="text-lg font-semibold text-amber-950">Work finished</h2>
                      <p className="mt-2 text-sm font-medium leading-6 text-amber-900">
                        Enter the amount you paid to complete {awaitingPaymentBookings[0].serviceType}.
                      </p>
                      <InputField
                        label="Amount paid"
                        type="number"
                        min="1"
                        inputMode="decimal"
                        value={paymentAmounts[awaitingPaymentBookings[0].id] ?? ''}
                        onChange={(event) =>
                          handlePaymentAmountChange(awaitingPaymentBookings[0].id, event.target.value)
                        }
                        placeholder="Enter amount"
                        className="mt-4 max-w-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-11 w-full bg-slate-950 text-white shadow-sm hover:bg-slate-800 lg:w-auto"
                      disabled={completingPaymentId === awaitingPaymentBookings[0].id}
                      onClick={() => handleCompleteClientPayment(awaitingPaymentBookings[0])}
                    >
                      {completingPaymentId === awaitingPaymentBookings[0].id ? 'Completing...' : 'Complete service'}
                    </Button>
                  </div>
                </Card>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-6">
                <Card className="rounded-[28px] border-slate-300 p-4 shadow-sm sm:p-6 md:p-8">
                  <div className="grid gap-4">
                    <SelectField
                      label="Service name"
                      placeholder="Choose a service"
                      options={workCategories}
                      value={workCategories.includes(formValues.serviceName) ? formValues.serviceName : ''}
                      onChange={(event) => updateFormValue('serviceName', event.target.value)}
                    />
                    <div className="md:col-span-2">
                      <InputField
                        label="Address"
                        value={formValues.address}
                        onChange={(event) => updateFormValue('address', event.target.value)}
                        placeholder="House no, street, area, city"
                      />
                      <div className="mt-3 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={handleRefreshLocation}
                          disabled={geolocation.loading}
                        >
                          <LocateFixed size={15} />
                          {clientLocation ? 'Update live location' : 'Use live location'}
                        </Button>
                        <p className="text-xs font-medium text-slate-600">
                          {clientLocation
                            ? locationStatusLabel
                            : `Use live location to search labour within ${NEARBY_LABOUR_RADIUS_KM} km.`}
                        </p>
                      </div>
                      <LocationPermissionPrompt
                        geolocation={geolocation}
                        onRequest={handleRefreshLocation}
                        className="mt-3"
                        compact
                      />
                    </div>
                    <TextAreaField
                      label="What is the service?"
                      value={formValues.serviceDetails}
                      onChange={(event) => updateFormValue('serviceDetails', event.target.value)}
                      placeholder="Describe the issue, tools needed, access notes, urgency, and anything the labour should know."
                      className="md:col-span-2"
                    />
                  </div>

                  <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
                    <Button type="button" className="w-full sm:w-auto" onClick={() => handleSearchLabour()} disabled={searching || !canSearch || hasOpenRequest}>
                      <Search size={16} />
                      {searching ? 'Checking...' : `Check labour within ${NEARBY_LABOUR_RADIUS_KM} km`}
                    </Button>
                    {selectedLabour ? (
                      <Badge tone="blue" className="px-4 py-2">
                        Selected: {selectedLabour.fullName}
                      </Badge>
                    ) : null}
                  </div>
                </Card>

                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                  {[
                    ['instant', 'Instant now'],
                    ['scheduled', 'Schedule time']
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRequestTiming(value)}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        requestTiming === value
                          ? 'bg-white text-brand-700 shadow-sm'
                          : 'text-slate-600 hover:bg-white/70'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {requestTiming === 'scheduled' ? (
                  <BookingCalendar
                    selectedDate={selectedDate}
                    selectedSlot={selectedSlot}
                    onDateChange={setSelectedDate}
                    onSlotChange={setSelectedSlot}
                  />
                ) : (
                  <Card className="rounded-[24px] border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-medium leading-6 text-emerald-950">
                      Instant requests go to the nearest available labour first. If there is no response in 30 seconds, Slivz tries the next available labour. If only one labour is available, the request stays open for 5 minutes.
                    </p>
                  </Card>
                )}

                <Button type="submit" size="lg" className="w-full" disabled={submitting || !canRequest}>
                  <Send size={17} />
                  {submitting ? 'Sending request...' : hasOpenRequest ? 'Finish current request first' : 'Send request to selected labour'}
                </Button>
              </form>
            </div>

            <div className="space-y-6">
              <Card className="rounded-[28px] border-slate-300 p-4 shadow-sm sm:p-6 md:p-8">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">Available labour</h2>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      Pick one worker after search.
                    </p>
                  </div>
                  <Badge tone="emerald">{sortedAvailableLabours.length} found</Badge>
                </div>

                <div className="mt-5 space-y-4">
                  {sortedAvailableLabours.length ? (
                    sortedAvailableLabours.map((labour) => (
                      <button
                        key={labour.id}
                        type="button"
                        onClick={() => setSelectedLabour(labour)}
                        disabled={hasOpenRequest}
                        className={`w-full rounded-3xl border p-4 text-left transition ${
                          selectedLabour?.id === labour.id
                            ? 'border-brand-500 bg-brand-50'
                            : serviceBookingIds.has(labour.id)
                              ? 'border-amber-200 bg-amber-50'
                              : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex gap-4">
                          <img
                            src={labour.profilePhoto}
                            alt={labour.fullName}
                            width="56"
                            height="56"
                            loading="lazy"
                            decoding="async"
                            className="h-14 w-14 rounded-2xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold text-slate-950">{labour.fullName}</p>
                              <Badge tone={serviceBookingIds.has(labour.id) ? 'amber' : 'emerald'}>
                                {serviceBookingIds.has(labour.id) ? 'Tried' : labour.availability}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm font-medium text-slate-700">{labour.category}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                              <span>{formatDistanceKm(labour.distanceKm)}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium leading-7 text-slate-700">
                      {searched
                        ? `${formValues.serviceName || 'This service'} is not available within ${NEARBY_LABOUR_RADIUS_KM} km right now.`
                        : 'Search labour after adding service, address, and live location.'}
                    </div>
                  )}
                </div>
              </Card>

              <Card className="rounded-[28px] border-slate-300 p-4 shadow-sm sm:p-6 md:p-8">
                <div className="flex items-center gap-2">
                  <UserCheck size={18} className="text-emerald-600" />
                  <h2 className="text-xl font-semibold text-slate-950">Accepted labour</h2>
                </div>

                <div className="mt-5 space-y-4">
                  {activeBookings.length ? (
                    activeBookings.map((booking) => (
                      <div key={booking.id} className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <img
                              src={
                                booking.labourProfilePhoto ||
                                buildProfileAvatarDataUrl(booking.labourName || 'Labour')
                              }
                              alt={booking.labourName}
                              width="48"
                              height="48"
                              loading="lazy"
                              decoding="async"
                              className="h-12 w-12 flex-none rounded-2xl object-cover"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-950">{booking.labourName}</p>
                              <p className="mt-1 text-sm font-medium text-slate-700">{booking.serviceType}</p>
                            </div>
                          </div>
                          <Badge tone={booking.status === 'in_progress' ? 'blue' : 'emerald'}>
                            {booking.status === 'in_progress' ? 'Working' : 'Accepted'}
                          </Badge>
                        </div>
                        <div className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
                          <span className="inline-flex items-center gap-2">
                            <Clock3 size={15} />
                            {getBookingTime(booking)}
                          </span>
                          <span className="inline-flex min-w-0 items-start gap-2 break-words">
                            <MapPin size={15} className="mt-0.5 flex-none" />
                            <span className="min-w-0">
                              {getDisplayLocationText(booking.location, 'Live location shared')}
                            </span>
                          </span>
                        </div>
                        {booking.status === 'accepted' && booking.startOtp ? (
                          <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
                            <p className="text-xs font-bold uppercase text-emerald-700">Start OTP</p>
                            <p className="mt-2 font-display text-2xl font-bold tracking-[0.2em] text-slate-950 sm:text-3xl sm:tracking-[0.28em]">
                              {booking.startOtp}
                            </p>
                            <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
                              Share this OTP only after the labour reaches your location.
                            </p>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-brand-100 bg-white p-4 text-sm font-semibold text-brand-800">
                            OTP verified. This job is in progress and your account is marked busy.
                          </div>
                        )}
                        <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap">
                          <Button
                            as="a"
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.location || '')}`}
                            target="_blank"
                            rel="noreferrer"
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                          >
                            <Navigation size={15} />
                            View route
                          </Button>
                          <Button
                            as="a"
                            href={(booking.labourPhoneNumber || booking.privateLabourPhoneNumber) ? `tel:${booking.labourPhoneNumber || booking.privateLabourPhoneNumber}` : undefined}
                            size="sm"
                            className={`w-full sm:w-auto ${!(booking.labourPhoneNumber || booking.privateLabourPhoneNumber) ? 'pointer-events-none opacity-60' : ''}`}
                          >
                            <Phone size={15} />
                            Call
                          </Button>
                          <Button
                            as={Link}
                            to="/chat"
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() =>
                              handleOpenChat({
                                id: booking.labourId,
                                fullName: booking.labourName,
                                category: booking.serviceType
                              })
                            }
                          >
                            <MessageCircle size={15} />
                            Chat
                          </Button>
                          {booking.status === 'accepted' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              className="w-full sm:w-auto"
                              disabled={cancellingBookingId === booking.id}
                              onClick={() => handleCancelBooking(booking)}
                            >
                              {cancellingBookingId === booking.id ? 'Cancelling...' : 'Cancel'}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium leading-7 text-slate-700">
                      Labour phone and chat actions appear here after a worker accepts your request.
                    </p>
                  )}
                </div>
              </Card>

              <Card className="rounded-[28px] border-slate-300 p-4 shadow-sm sm:p-6 md:p-8">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-brand-600" />
                  <h2 className="text-xl font-semibold text-slate-950">Request history</h2>
                </div>
                <div className="mt-5 space-y-4">
                  {bookings.length ? (
                    bookings.map((booking) => (
                    <div key={booking.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <img
                            src={
                              booking.labourProfilePhoto ||
                              buildProfileAvatarDataUrl(booking.labourName || 'Labour')
                            }
                            alt={booking.labourName}
                            width="44"
                            height="44"
                            loading="lazy"
                            decoding="async"
                            className="h-11 w-11 flex-none rounded-2xl object-cover"
                          />
                          <div className="min-w-0">
                            <h3 className="font-semibold text-slate-950">{booking.serviceType}</h3>
                            <p className="break-words text-sm font-medium text-slate-600">
                              {booking.labourName} - {getDisplayLocationText(booking.location, 'Live location shared')}
                            </p>
                          </div>
                        </div>
                        <Badge tone={booking.status === 'accepted' ? 'emerald' : booking.status === 'completed' ? 'blue' : booking.status === 'rejected' ? 'rose' : booking.status === 'timed_out' ? 'slate' : 'amber'}>
                          {booking.status}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm font-medium text-slate-700">{getBookingTime(booking)}</p>
                        {booking.status === 'completed' && Number(booking.amount) > 0 ? (
                          <p className="mt-2 text-sm font-semibold text-brand-700">
                            Final charge: {formatCurrency(booking.amount)}
                          </p>
                        ) : booking.status === 'awaiting_payment' ? (
                          <p className="mt-2 text-sm font-semibold text-amber-700">
                            Enter the paid amount above to complete this service.
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm font-medium text-slate-600">
                      Your requests will appear here after sending.
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
};

export default BookingPage;

