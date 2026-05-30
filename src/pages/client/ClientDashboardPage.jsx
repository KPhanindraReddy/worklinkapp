import {
  CalendarClock,
  Clock3,
  LocateFixed,
  LoaderCircle,
  MessageCircle,
  Navigation,
  Search,
  Send,
  UserCheck,
  WalletCards
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BookingCalendar } from '../../components/booking/BookingCalendar';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { PageSEO } from '../../components/common/PageSEO';
import { SelectField } from '../../components/common/SelectField';
import { Skeleton } from '../../components/common/Skeleton';
import { AppShell } from '../../components/layout/AppShell';
import { ServiceRequestMap } from '../../components/map/ServiceRequestMap';
import { useAuth } from '../../context/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { createBooking, subscribeBookingsForUser } from '../../services/bookingService';
import { searchLabours } from '../../services/labourService';
import { createNotification } from '../../services/notificationService';
import {
  buildAppointmentDateTime,
  formatCurrency,
  formatDate,
  formatDistanceKm,
  parseDateValue
} from '../../utils/formatters';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import {
  buildMapsUrl,
  formatCoordinates,
  normalizeCoordinates
} from '../../utils/location';
import { createRouteGroupId } from '../../utils/requestRouting';

const openRequestStatuses = ['pending', 'accepted', 'in_progress'];
const NEARBY_LABOUR_RADIUS_KM = 50;
const generateStartOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const getBookingTone = (status) => {
  if (status === 'accepted') {
    return 'emerald';
  }

  if (status === 'rejected') {
    return 'rose';
  }

  if (status === 'timed_out') {
    return 'slate';
  }

  if (status === 'completed') {
    return 'blue';
  }

  if (status === 'in_progress') {
    return 'blue';
  }

  return 'amber';
};

const getDateKey = (value) => {
  const date = parseDateValue(value);

  if (!date) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
};

const getFirstAvailableLabour = (items) =>
  items.find((labour) => labour.availability === 'Available') ?? null;
const filterNearbyLabours = (items) =>
  items.filter((labour) => Number.isFinite(Number(labour.distanceKm)) && Number(labour.distanceKm) <= NEARBY_LABOUR_RADIUS_KM);

const ClientDashboardPage = () => {
  const { currentUser, userProfile } = useAuth();
  const geolocation = useGeolocation();
  const [availableLabours, setAvailableLabours] = useState([]);
  const [serviceLabours, setServiceLabours] = useState([]);
  const [laboursLoading, setLaboursLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [selectedService, setSelectedService] = useState('');
  const [requestMode, setRequestMode] = useState('instant');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedLabourId, setSelectedLabourId] = useState('');
  const [submittingInstant, setSubmittingInstant] = useState(false);
  const [scheduleSubmittingId, setScheduleSubmittingId] = useState('');
  const [requestCoordinates, setRequestCoordinates] = useState(
    null
  );

  useEffect(() => {
    let isActive = true;

    geolocation.requestLocation({ force: true }).then((coordinates) => {
      if (isActive && coordinates) {
        setRequestCoordinates(coordinates);
      }
    });

    return () => {
      isActive = false;
    };
  }, [geolocation.requestLocation]);

  useEffect(() => {
    if (geolocation.error) {
      toast.error(`Location error: ${geolocation.error}`);
    }
  }, [geolocation.error]);

  useEffect(() => {
    if (!geolocation.hasLocation) {
      return;
    }

    setRequestCoordinates({
      latitude: geolocation.latitude,
      longitude: geolocation.longitude
    });
  }, [geolocation.hasLocation, geolocation.latitude, geolocation.longitude]);

  const clientOrigin = useMemo(
    () => normalizeCoordinates(requestCoordinates) || null,
    [requestCoordinates]
  );
  const clientLocationLabel = useMemo(
    () => {
      if (clientOrigin) {
        return `Current GPS - ${formatCoordinates(clientOrigin)}`;
      }

      if (geolocation.loading) {
        return 'Finding your current GPS location';
      }

      return geolocation.error || 'Allow location to show nearby services';
    },
    [clientOrigin, geolocation.error, geolocation.loading]
  );
  const bookingAddress =
    clientOrigin
      ? `Current GPS ${formatCoordinates(clientOrigin)}`
      : '';

  useEffect(() => {
    if (!clientOrigin) {
      setAvailableLabours([]);
      setServiceLabours([]);
      setSelectedService('');
      setSelectedLabourId('');
      setLaboursLoading(false);
      return undefined;
    }

    let isActive = true;
    setLaboursLoading(true);

    searchLabours({ availability: 'Available' }, clientOrigin)
      .then((items) => {
        if (!isActive) {
          return;
        }

        const nearbyItems = filterNearbyLabours(items);

        setAvailableLabours(nearbyItems);
        const nextServices = new Set(nearbyItems.map((labour) => labour.category).filter(Boolean));

        setSelectedService((prev) => (prev && !nextServices.has(prev) ? '' : prev));
      })
      .catch((error) => {
        if (isActive) {
          toast.error(getFirebaseErrorMessage(error));
        }
      })
      .finally(() => {
        if (isActive) {
          setLaboursLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [clientOrigin]);

  useEffect(() => {
    const matchingLabours = selectedService
      ? availableLabours.filter((labour) => labour.category === selectedService)
      : [];

    setServiceLabours(matchingLabours);
    setSelectedLabourId(getFirstAvailableLabour(matchingLabours)?.id ?? '');
  }, [availableLabours, selectedService]);

  useEffect(() => {
    if (!currentUser) {
      setBookings([]);
      setBookingsLoading(false);
      return undefined;
    }

    setBookingsLoading(true);
    return subscribeBookingsForUser(
      { userId: currentUser.uid, role: 'client' },
      (nextBookings) => {
        setBookings(nextBookings);
        setBookingsLoading(false);
      },
      (error) => {
        setBookingsLoading(false);
        toast.error(getFirebaseErrorMessage(error));
      }
    );
  }, [currentUser?.uid]);

  const openBookings = useMemo(
    () => bookings.filter((booking) => openRequestStatuses.includes(booking.status)),
    [bookings]
  );
  const pendingBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'pending'),
    [bookings]
  );
  const activeBookings = useMemo(
    () => bookings.filter((booking) => ['accepted', 'in_progress'].includes(booking.status)),
    [bookings]
  );
  const serviceOptions = useMemo(
    () =>
      Array.from(new Set(availableLabours.map((labour) => labour.category).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [availableLabours]
  );
  const trackedBookings = useMemo(() => bookings.slice(0, 5), [bookings]);
  const mapTitle = selectedService ? `${selectedService} near you` : 'Your current location';
  const mapSubtitle = clientOrigin
    ? `${clientLocationLabel} - ${formatCoordinates(clientOrigin)}`
    : clientLocationLabel;
  const visibleMapLabours = selectedService ? serviceLabours : availableLabours.slice(0, 6);
  const metrics = useMemo(() => {
    const completed = bookings.filter((item) => item.status === 'completed').length;
    const scheduled = bookings.filter((item) => item.requestMode === 'scheduled').length;
    const spend = bookings.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return [
      { label: 'Open requests', value: openBookings.length },
      { label: 'Scheduled visits', value: scheduled },
      { label: 'Completed services', value: completed },
      { label: 'Budgeted spend', value: formatCurrency(spend) }
    ];
  }, [bookings, openBookings.length]);
  const metricsLoading = bookingsLoading;

  const getKnownScheduleConflict = (labour) =>
    Boolean(
      selectedDate &&
        bookings.some(
          (booking) =>
            booking.labourId === labour.id &&
            openRequestStatuses.includes(booking.status) &&
            getDateKey(booking.appointmentAt) === selectedDate
        )
    );

  const canCreateRequest = () => {
    if (!currentUser || userProfile?.role !== 'client') {
      toast.error('Sign in as a client before requesting labour.');
      return false;
    }

    if (!selectedService) {
      toast.error('Choose a service first.');
      return false;
    }

    if (!bookingAddress && !clientOrigin) {
      toast.error('Allow GPS or add your address in profile before requesting service.');
      return false;
    }

    if (openBookings.length) {
      toast.error('Finish or wait for your current open request before sending another one.');
      return false;
    }

    return true;
  };

  const handleRefreshLocation = async () => {
    const coordinates = await geolocation.requestLocation({ force: true });

    if (!coordinates) {
      toast.error(geolocation.error || 'Allow browser location to update this request.');
      return;
    }

    setRequestCoordinates(coordinates);
    toast.success('Live GPS location updated.');
  };

  const notifyLabour = async ({ bookingId, labour, requestMode: mode }) => {
    try {
      await createNotification({
        userId: labour.id,
        senderId: currentUser.uid,
        title: mode === 'instant' ? 'Instant service request' : 'Scheduled service request',
        body:
          mode === 'instant'
            ? `${userProfile?.fullName || 'A client'} needs ${selectedService} now.`
            : `${userProfile?.fullName || 'A client'} scheduled ${selectedService} on ${selectedDate} at ${selectedSlot}.`,
        type: 'booking',
        bookingId
      });
      return true;
    } catch (notificationError) {
      console.warn('WorkLink notification delivery skipped:', notificationError);
      return false;
    }
  };

  const createDashboardBooking = async ({ labour, mode }) => {
    const appointmentAt =
      mode === 'instant'
        ? new Date().toISOString()
        : buildAppointmentDateTime(selectedDate, selectedSlot);
    const routeGroupId = createRouteGroupId(currentUser.uid);

    const bookingId = await createBooking({
      clientId: currentUser.uid,
      clientName: userProfile?.fullName || currentUser.displayName || 'Client',
      clientPhoneNumber: userProfile?.phoneNumber || currentUser.phoneNumber || '',
      clientEmail: userProfile?.email || currentUser.email || '',
      labourId: labour.id,
      labourName: labour.fullName,
      labourPhoneNumber: labour.phoneNumber || '',
      serviceType: selectedService,
      serviceDetails:
        mode === 'instant'
          ? 'Instant request from client home.'
          : `Scheduled request for ${selectedDate} ${selectedSlot}.`,
      location: bookingAddress || (clientOrigin ? formatCoordinates(clientOrigin) : ''),
      coordinates: clientOrigin,
      notes:
        mode === 'instant'
          ? 'Client requested immediate service from the dashboard.'
          : `Client scheduled this service for ${selectedDate} at ${selectedSlot}.`,
      amount: Number(labour.dailyWage) || 0,
      appointmentAt,
      requestMode: mode,
      startOtp: generateStartOtp(),
      requestFlow: mode === 'instant' ? 'client_dashboard_instant' : 'client_dashboard_schedule',
      routeGroupId,
      previousLabourIds: []
    });

    const notificationDelivered = await notifyLabour({ bookingId, labour, requestMode: mode });

    return { bookingId, notificationDelivered };
  };

  const loadServiceLabours = async () => {
    if (!clientOrigin) {
      return [];
    }

    if (serviceLabours.length) {
      return serviceLabours;
    }

    setLaboursLoading(true);

    try {
      const items = await searchLabours({ availability: 'Available' }, clientOrigin);
      const nearbyItems = filterNearbyLabours(items);
      const matchingLabours = nearbyItems.filter((labour) => labour.category === selectedService);

      setServiceLabours(matchingLabours);
      setAvailableLabours(nearbyItems);
      setSelectedLabourId(getFirstAvailableLabour(matchingLabours)?.id ?? '');
      return matchingLabours;
    } finally {
      setLaboursLoading(false);
    }
  };

  const handleInstantRequest = async () => {
    setRequestMode('instant');

    if (!canCreateRequest()) {
      return;
    }

    setSubmittingInstant(true);

    try {
      const labours = await loadServiceLabours();
      const targetLabour = getFirstAvailableLabour(labours);

      if (!targetLabour) {
        toast.error(`${selectedService} is not available near your location right now.`);
        return;
      }

      setSelectedLabourId(targetLabour.id);
      const { notificationDelivered } = await createDashboardBooking({
        labour: targetLabour,
        mode: 'instant'
      });

      toast.success(
        notificationDelivered
          ? `Request sent to ${targetLabour.fullName}. If they reject or time out, WorkLink will buzz the next available labour.`
          : `Request sent to ${targetLabour.fullName}. Labour alerts will appear after Firestore rules are deployed.`
      );
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSubmittingInstant(false);
    }
  };

  const handleScheduleMode = async () => {
    setRequestMode('scheduled');

    if (!selectedService) {
      toast.error('Choose a service first.');
      return;
    }

    try {
      await loadServiceLabours();
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    }
  };

  const handleScheduleLabour = async (labour) => {
    if (!canCreateRequest()) {
      return;
    }

    if (!selectedDate || !selectedSlot) {
      toast.error('Pick date and time before scheduling a labour.');
      return;
    }

    if (getKnownScheduleConflict(labour)) {
      toast.error(`${labour.fullName} is not available for your selected day.`);
      return;
    }

    setScheduleSubmittingId(labour.id);
    setSelectedLabourId(labour.id);

    try {
      const { notificationDelivered } = await createDashboardBooking({
        labour,
        mode: 'scheduled'
      });

      toast.success(
        notificationDelivered
          ? `${labour.fullName} received your scheduled request.`
          : `${labour.fullName} was scheduled. Labour alert will appear after Firestore rules are deployed.`
      );
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setScheduleSubmittingId('');
    }
  };

  return (
    <AppShell>
      <PageSEO title="Client Dashboard" description="Request nearby labour instantly or schedule a trusted worker from your live location." />

      <section className="section-space pt-3">
        <div className="page-shell space-y-6">
          <ServiceRequestMap
            center={clientOrigin}
            labours={visibleMapLabours}
            selectedLabourId={selectedLabourId}
            onSelectLabour={(labour) => setSelectedLabourId(labour.id)}
            searching={laboursLoading || submittingInstant}
            title={mapTitle}
            subtitle={mapSubtitle}
            emptyLabel="Choose a service below to check nearby labour"
            showCenterLabel={false}
            showRoutePreview
            className="-mx-[0.625rem] min-h-[calc(100dvh-5.25rem)] rounded-none border-x-0 sm:mx-0 sm:min-h-[640px] sm:rounded-[28px] sm:border"
            sheetClassName="bottom-0 left-0 right-0 rounded-b-none rounded-t-[28px] border-x-0 border-b-0 p-4 sm:bottom-4 sm:left-4 sm:right-4 sm:rounded-[24px] sm:border"
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <SelectField
                  label="Available service"
                  placeholder={
                    laboursLoading
                      ? 'Checking nearby services'
                      : serviceOptions.length
                        ? 'Choose available service'
                        : 'No services available nearby'
                  }
                  options={serviceOptions}
                  value={selectedService}
                  disabled={laboursLoading || !serviceOptions.length}
                  onChange={(event) => {
                    setSelectedService(event.target.value);
                    setRequestMode('instant');
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 w-full sm:w-auto"
                  onClick={handleRefreshLocation}
                  disabled={geolocation.loading}
                >
                  {geolocation.loading ? <LoaderCircle size={15} className="animate-spin" /> : <LocateFixed size={15} />}
                  Update GPS
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:min-w-[21rem]">
                <Button
                  type="button"
                  size="lg"
                  className="w-full bg-slate-950 hover:bg-slate-800"
                  onClick={handleInstantRequest}
                  disabled={submittingInstant || bookingsLoading}
                >
                  {submittingInstant ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                  Instant
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant={requestMode === 'scheduled' ? 'primary' : 'outline'}
                  className="w-full"
                  onClick={handleScheduleMode}
                  disabled={bookingsLoading}
                >
                  <CalendarClock size={16} />
                  Schedule
                </Button>
              </div>
            </div>
          </ServiceRequestMap>

          {pendingBookings.length ? (
            <Card className="rounded-[24px] border-brand-200 bg-brand-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Requesting</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">Waiting for labour response</h2>
                  <p className="mt-2 break-words text-sm font-medium leading-6 text-slate-700">
                    {pendingBookings[0].labourName} received your {pendingBookings[0].serviceType} request.
                    Instant requests will move to the next available labour if this one rejects or times out.
                  </p>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-brand-600 text-white shadow-glow">
                  <LoaderCircle size={26} className="animate-spin" />
                </div>
              </div>
            </Card>
          ) : null}

          {activeBookings.length ? (
            <Card className="rounded-[24px] border-emerald-200 bg-emerald-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    Labour connected
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    {activeBookings[0].labourName} accepted your request
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                    Keep your start OTP ready. Share it only after the labour reaches your location.
                  </p>
                </div>
                <Badge tone="emerald">{activeBookings[0].status}</Badge>
              </div>
              {activeBookings[0].startOtp ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase text-emerald-700">Start OTP</p>
                  <p className="mt-2 font-display text-2xl font-bold tracking-[0.24em] text-slate-950">
                    {activeBookings[0].startOtp}
                  </p>
                </div>
              ) : null}
            </Card>
          ) : null}

          {requestMode === 'scheduled' ? (
            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <BookingCalendar
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
                onDateChange={setSelectedDate}
                onSlotChange={setSelectedSlot}
              />

              <Card className="rounded-[24px] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">Schedule {selectedService || 'service'} labour</h2>
                    <p className="mt-2 text-sm font-medium text-slate-600">
                      Pick a worker for the selected day and time.
                    </p>
                  </div>
                  <Badge tone={serviceLabours.length ? 'emerald' : 'slate'}>
                    {laboursLoading ? 'Checking' : `${serviceLabours.length} found`}
                  </Badge>
                </div>

                <div className="mt-5 space-y-2.5">
                  {laboursLoading ? (
                    <>
                      <Skeleton className="h-20 w-full rounded-2xl" />
                      <Skeleton className="h-20 w-full rounded-2xl" />
                      <Skeleton className="h-20 w-full rounded-2xl" />
                    </>
                  ) : serviceLabours.length ? (
                    serviceLabours.map((labour) => {
                      const notAvailableForDate = getKnownScheduleConflict(labour);
                      const isSubmitting = scheduleSubmittingId === labour.id;

                      return (
                        <button
                          key={labour.id}
                          type="button"
                          className={`w-full rounded-2xl border p-3 text-left transition ${
                            notAvailableForDate
                              ? 'border-amber-200 bg-amber-50'
                              : selectedLabourId === labour.id
                                ? 'border-brand-400 bg-brand-50'
                                : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50'
                          }`}
                          onClick={() => handleScheduleLabour(labour)}
                          disabled={Boolean(scheduleSubmittingId)}
                        >
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                            <div className="flex min-w-0 items-center gap-3">
                              <img
                                src={labour.profilePhoto}
                                alt={labour.fullName}
                                className="h-12 w-12 flex-none rounded-xl object-cover"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-950">{labour.fullName}</p>
                                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium text-slate-600">
                                  <span>{labour.category}</span>
                                  <span>{formatDistanceKm(labour.distanceKm)}</span>
                                  <span>{formatCurrency(labour.dailyWage)}</span>
                                </div>
                              </div>
                            </div>
                            <span className={`inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-xs font-bold ${
                              notAvailableForDate
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-slate-950 text-white'
                            }`}>
                              {isSubmitting
                                ? 'Scheduling...'
                                : notAvailableForDate
                                  ? 'Not available'
                                  : selectedDate && selectedSlot
                                    ? 'Schedule'
                                    : 'Pick time'}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <EmptyState
                      title={selectedService ? 'No labour available for this service' : 'Choose a service'}
                      description={
                        selectedService
                          ? 'Try another time, update GPS, or choose a different service.'
                          : 'Select a service above to show related labour here.'
                      }
                    />
                  )}
                </div>
              </Card>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metricsLoading ? (
              <>
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </>
            ) : (
              metrics.map((item) => (
                <Card key={item.label} className="rounded-2xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{item.value}</p>
                </Card>
              ))
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <Card className="rounded-[24px] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Request tracking</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Pending, accepted, scheduled, and completed requests appear here.
                  </p>
                </div>
                <Button as={Link} to="/chat" variant="outline" size="sm" className="w-full sm:w-auto">
                  <MessageCircle size={16} />
                  Chat
                </Button>
              </div>
              <div className="mt-5 space-y-3">
                {bookingsLoading ? (
                  <>
                    <Skeleton className="h-24 w-full rounded-2xl" />
                    <Skeleton className="h-24 w-full rounded-2xl" />
                  </>
                ) : trackedBookings.length ? (
                  trackedBookings.map((booking) => (
                    <div key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-950">{booking.serviceType}</h3>
                          <p className="mt-1 break-words text-sm text-slate-600">
                            {booking.labourName} - {booking.location || 'Location shared'}
                          </p>
                        </div>
                        <Badge tone={getBookingTone(booking.status)}>{booking.status}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <span className="inline-flex items-center gap-2">
                          <Clock3 size={15} />
                          {formatDate(booking.appointmentAt)}
                        </span>
                        <span className="inline-flex items-center gap-2 font-semibold text-brand-700">
                          <WalletCards size={15} />
                          {formatCurrency(booking.amount)}
                        </span>
                      </div>
                      {['accepted', 'in_progress'].includes(booking.status) ? (
                        <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap">
                          <Button
                            as="a"
                            href={buildMapsUrl(booking.coordinates, booking.location)}
                            target="_blank"
                            rel="noreferrer"
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                          >
                            <Navigation size={15} />
                            View location
                          </Button>
                          <Button as={Link} to="/chat" size="sm" className="w-full sm:w-auto">
                            <MessageCircle size={15} />
                            Chat labour
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-600">
                    Your service requests will show here after you send one.
                  </p>
                )}
              </div>
            </Card>

            <Card className="rounded-[24px] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <UserCheck size={18} className="text-emerald-600" />
                <h2 className="text-xl font-semibold text-slate-950">Related labour</h2>
              </div>
              <div className="mt-5 space-y-2.5">
                {laboursLoading ? (
                  <>
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-16 w-full rounded-2xl" />
                  </>
                ) : serviceLabours.length ? (
                  serviceLabours.slice(0, 4).map((labour) => (
                    <button
                      key={labour.id}
                      type="button"
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        selectedLabourId === labour.id
                          ? 'border-brand-400 bg-brand-50'
                          : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedLabourId(labour.id)}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <img
                          src={labour.profilePhoto}
                          alt={labour.fullName}
                          className="h-11 w-11 flex-none rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-950">{labour.fullName}</p>
                          <p className="mt-1 truncate text-xs font-medium text-slate-600">
                            {formatDistanceKm(labour.distanceKm)} - {formatCurrency(labour.dailyWage)}
                          </p>
                        </div>
                        <Badge tone="emerald">{labour.availability}</Badge>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-600">
                    Choose a service to show free workers near your GPS location.
                  </p>
                )}
              </div>
              <Button as={Link} to="/search" variant="outline" size="sm" className="mt-4 w-full">
                <Search size={15} />
                Full search
              </Button>
            </Card>
          </div>
        </div>
      </section>
    </AppShell>
  );
};

export default ClientDashboardPage;
