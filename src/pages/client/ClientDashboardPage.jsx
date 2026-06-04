import {
  CalendarClock,
  Clock3,
  LocateFixed,
  LoaderCircle,
  Search,
  Send,
  UserCheck,
  WalletCards
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BookingCalendar } from '../../components/booking/BookingCalendar';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { AutocompleteSelect } from '../../components/common/AutocompleteSelect';
import { EmptyState } from '../../components/common/EmptyState';
import { InputField } from '../../components/common/InputField';
import { PageSEO } from '../../components/common/PageSEO';
import { SelectField } from '../../components/common/SelectField';
import { Skeleton } from '../../components/common/Skeleton';
import { AppShell } from '../../components/layout/AppShell';
import { LocationPermissionPrompt } from '../../components/location/LocationPermissionPrompt';
import { LocationText } from '../../components/location/LocationText';
import { ServiceRequestMap } from '../../components/map/ServiceRequestMap';
import { useAuth } from '../../context/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLocationName } from '../../hooks/useLocationName';
import {
  completeClientPayment,
  createBooking,
  subscribeBookingsForUser,
  updateBookingStatus
} from '../../services/bookingService';
import { searchLabours } from '../../services/labourService';
import { createNotification } from '../../services/notificationService';
import { createServiceDemandRequest } from '../../services/serviceDemandService';
import {
  buildAppointmentDateTime,
  formatCurrency,
  formatDate,
  formatDistanceKm,
  parseDateValue
} from '../../utils/formatters';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import { DEFAULT_LABOUR_RADIUS_KM, labourRadiusOptions, workCategories } from '../../utils/constants';
import {
  buildMapsUrl,
  getDisplayLocationText,
  getLocationLabel,
  normalizeCoordinates
} from '../../utils/location';
import { buildProfileAvatarDataUrl } from '../../utils/profileAvatar';
import { createRouteGroupId } from '../../utils/requestRouting';

const openRequestStatuses = ['pending', 'accepted', 'in_progress', 'awaiting_payment'];
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

  if (status === 'awaiting_payment') {
    return 'amber';
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
const buildDirectionsUrl = ({ origin, destination }) => {
  const normalizedOrigin = normalizeCoordinates(origin);
  const normalizedDestination = normalizeCoordinates(destination);

  if (!normalizedOrigin || !normalizedDestination) {
    return '';
  }

  return `https://www.google.com/maps/dir/?api=1&origin=${normalizedOrigin.latitude},${normalizedOrigin.longitude}&destination=${normalizedDestination.latitude},${normalizedDestination.longitude}&travelmode=driving`;
};
const filterNearbyLabours = (items, radiusKm) =>
  items.filter((labour) => Number.isFinite(Number(labour.distanceKm)) && Number(labour.distanceKm) <= radiusKm);

const getInitials = (value) =>
  String(value || 'WL')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item.charAt(0).toUpperCase())
    .join('') || 'WL';

const LightPanel = ({ id, className = '', children }) => (
  <section
    id={id}
    className={`scroll-mt-28 rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)] sm:rounded-[20px] sm:p-5 ${className}`}
  >
    {children}
  </section>
);

const DashboardMetric = ({ label, value, tone = 'slate' }) => {
  const toneClass = {
    emerald: 'text-emerald-600',
    blue: 'text-brand-600',
    amber: 'text-amber-600',
    slate: 'text-slate-950'
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:px-3 sm:py-2.5">
      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 sm:text-[10px]">{label}</p>
      <p className={`mt-1 text-lg font-bold leading-none sm:text-xl ${toneClass}`}>{value}</p>
    </div>
  );
};

const EmptyDashed = ({ children }) => (
  <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm font-medium text-slate-300 sm:py-8 sm:text-base">
    {children}
  </div>
);

const ClientDashboardPage = () => {
  const { currentUser, userProfile } = useAuth();
  const geolocation = useGeolocation();
  const [availableLabours, setAvailableLabours] = useState([]);
  const [serviceLabours, setServiceLabours] = useState([]);
  const [laboursLoading, setLaboursLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [selectedService, setSelectedService] = useState('');
  const [radiusKm, setRadiusKm] = useState(DEFAULT_LABOUR_RADIUS_KM);
  const [requestMode, setRequestMode] = useState('instant');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedLabourId, setSelectedLabourId] = useState('');
  const [submittingInstant, setSubmittingInstant] = useState(false);
  const [scheduleSubmittingId, setScheduleSubmittingId] = useState('');
  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [completingPaymentId, setCompletingPaymentId] = useState('');
  const [cancellingBookingId, setCancellingBookingId] = useState('');
  const scheduleSectionRef = useRef(null);
  const [liveCoordinates, setLiveCoordinates] = useState(() => normalizeCoordinates(userProfile?.coordinates) || null);
  const [requestCoordinates, setRequestCoordinates] = useState(
    () => normalizeCoordinates(userProfile?.coordinates) || null
  );
  const [coverageMessage, setCoverageMessage] = useState('');
  const lastDemandKeyRef = useRef('');
  const lastLocationErrorRef = useRef('');

  useEffect(() => {
    let isActive = true;

    geolocation.requestLocation({ force: true }).then((coordinates) => {
      if (isActive && coordinates) {
        setLiveCoordinates(coordinates);
        setRequestCoordinates((prev) => prev || coordinates);
      }
    });

    return () => {
      isActive = false;
    };
  }, [geolocation.requestLocation]);

  useEffect(() => {
    if (geolocation.error && geolocation.error !== lastLocationErrorRef.current) {
      lastLocationErrorRef.current = geolocation.error;
      toast.error(`Location error: ${geolocation.error}`);
    }
  }, [geolocation.error]);

  useEffect(() => {
    const savedCoordinates = normalizeCoordinates(userProfile?.coordinates);

    if (savedCoordinates) {
      setLiveCoordinates((prev) => prev || savedCoordinates);
      setRequestCoordinates((prev) => prev || savedCoordinates);
    }
  }, [userProfile?.coordinates]);

  useEffect(() => {
    if (!geolocation.hasLocation) {
      return;
    }

    const nextCoordinates = {
      latitude: geolocation.latitude,
      longitude: geolocation.longitude
    };

    setLiveCoordinates(nextCoordinates);
    setRequestCoordinates(nextCoordinates);
  }, [geolocation.hasLocation, geolocation.latitude, geolocation.longitude]);

  const clientOrigin = useMemo(
    () => normalizeCoordinates(requestCoordinates) || null,
    [requestCoordinates]
  );
  const profileLocationLabel = useMemo(
    () => getLocationLabel(userProfile, { fallback: '' }),
    [userProfile]
  );
  const resolvedLocationName = useLocationName(clientOrigin);
  const clientLocationLabel = useMemo(
    () => {
      if (clientOrigin) {
        return resolvedLocationName || profileLocationLabel || 'Live location captured';
      }

      if (geolocation.loading) {
        return 'Finding your current GPS location';
      }

      return geolocation.error || 'Allow location to show nearby services';
    },
    [clientOrigin, geolocation.error, geolocation.loading, profileLocationLabel, resolvedLocationName]
  );
  const bookingAddress =
    clientOrigin
      ? getDisplayLocationText(resolvedLocationName || profileLocationLabel, 'Live location shared')
      : '';

  const recordUnavailableDemand = async (serviceType = selectedService || 'Any service') => {
    if (!currentUser?.uid || userProfile?.role !== 'client' || !bookingAddress || !clientOrigin) {
      return;
    }

    const demandKey = `${serviceType}|${bookingAddress}|${clientOrigin.latitude.toFixed(3)}|${clientOrigin.longitude.toFixed(3)}`;

    if (lastDemandKeyRef.current === demandKey) {
      return;
    }

    lastDemandKeyRef.current = demandKey;

    try {
      await createServiceDemandRequest({
        clientId: currentUser.uid,
        clientName: userProfile?.fullName || currentUser.displayName || 'Client',
        serviceType,
        location: bookingAddress,
        coordinates: clientOrigin
      });
    } catch (error) {
      console.warn('Slivz service demand recording skipped:', error);
    }
  };

  useEffect(() => {
    if (!clientOrigin) {
      setAvailableLabours([]);
      setServiceLabours([]);
      setSelectedService('');
      setSelectedLabourId('');
      setCoverageMessage('');
      setLaboursLoading(false);
      return undefined;
    }

    let isActive = true;
    setLaboursLoading(true);

    searchLabours({ availability: 'Available', maxDistanceKm: radiusKm }, clientOrigin)
      .then((items) => {
        if (!isActive) {
          return;
        }

        const nearbyItems = filterNearbyLabours(items, radiusKm);

        setAvailableLabours(nearbyItems);
        if (nearbyItems.length) {
          setCoverageMessage('');
        }
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
  }, [clientOrigin, radiusKm]);

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
  const awaitingPaymentBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'awaiting_payment'),
    [bookings]
  );
  const serviceOptions = useMemo(
    () =>
      Array.from(new Set(availableLabours.map((labour) => labour.category).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [availableLabours]
  );
  const availableServiceSet = useMemo(() => new Set(serviceOptions), [serviceOptions]);
  const getServiceAvailability = (service) => (availableServiceSet.has(service) ? 'Available' : null);
  const radiusSelectOptions = useMemo(
    () => labourRadiusOptions.map((km) => ({ label: `${km} km`, value: String(km) })),
    []
  );
  const trackedBookings = useMemo(() => bookings.slice(0, 3), [bookings]);
  const mapTitle = selectedService ? `${selectedService} within ${radiusKm} km` : 'Service location';
  const mapSubtitle = clientOrigin
    ? `Live location: ${clientLocationLabel}`
    : clientLocationLabel;
  const visibleMapLabours = selectedService ? serviceLabours : [];
  const selectedMapLabour = visibleMapLabours.find((labour) => labour.id === selectedLabourId) ?? null;
  const selectedLabourDirectionsUrl = selectedMapLabour
    ? buildDirectionsUrl({
        origin: clientOrigin,
        destination: selectedMapLabour.liveCoordinates || selectedMapLabour.coordinates
      })
    : '';
  const metrics = useMemo(() => {
    const completed = bookings.filter((item) => item.status === 'completed').length;
    const scheduled = bookings.filter((item) => item.requestMode === 'scheduled').length;
    const paymentsDue = bookings.filter((item) => item.status === 'awaiting_payment').length;

    return [
      { label: 'Open requests', value: openBookings.length },
      { label: 'Scheduled visits', value: scheduled },
      { label: 'Completed services', value: completed },
      { label: 'Payments due', value: paymentsDue }
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
      return null;
    }

    setRequestCoordinates(coordinates);
    setLiveCoordinates(coordinates);
    toast.success('Live location updated.');
    return coordinates;
  };

  const handleUseLiveServiceLocation = () => {
    const coordinates = liveCoordinates || normalizeCoordinates(userProfile?.coordinates);

    if (!coordinates) {
      toast.error('Allow GPS first, then use live location.');
      return;
    }

    setRequestCoordinates(coordinates);
    toast.success('Service location set to live GPS.');
  };

  const handleServiceChange = (service) => {
    setSelectedService(service);
    setRequestMode('instant');
    setCoverageMessage('');

    if (service && !availableServiceSet.has(service)) {
      const message = `${service} is not available within ${radiusKm} km. Try increasing distance.`;
      setCoverageMessage(message);
      toast.error(message);
      recordUnavailableDemand(service);
    }
  };

  const notifyLabour = async ({ bookingId, labour, requestMode: mode }) => {
    try {
      await createNotification({
        userId: labour.id,
        senderId: currentUser.uid,
        title: mode === 'instant' ? 'New request' : 'Scheduled request',
        body: selectedService,
        type: 'booking',
        bookingId
      });
      return true;
    } catch (notificationError) {
      console.warn('Slivz notification delivery skipped:', notificationError);
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
      clientProfilePhoto:
        userProfile?.profilePhoto ||
        buildProfileAvatarDataUrl(userProfile?.fullName || currentUser.displayName || 'Client'),
      clientPhoneNumber: userProfile?.phoneNumber || currentUser.phoneNumber || '',
      clientEmail: userProfile?.email || currentUser.email || '',
      labourId: labour.id,
      labourName: labour.fullName,
      labourProfilePhoto:
        labour.profilePhoto || buildProfileAvatarDataUrl(labour.fullName || 'Labour'),
      labourPhoneNumber: labour.phoneNumber || '',
      serviceType: selectedService,
      serviceDetails:
        mode === 'instant'
          ? 'Instant request from client home.'
          : `Scheduled request for ${selectedDate} ${selectedSlot}.`,
      location: bookingAddress || (clientOrigin ? 'Live location shared' : ''),
      requestedAddress: bookingAddress || (clientOrigin ? 'Live location shared' : ''),
      requestedLocationMode: 'live',
      coordinates: clientOrigin,
      notes:
        mode === 'instant'
          ? 'Client requested immediate service from the dashboard.'
          : `Client scheduled this service for ${selectedDate} at ${selectedSlot}.`,
      amount: 0,
      paymentStatus: 'not_requested',
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
      const items = await searchLabours(
        {
          availability: 'Available',
          category: selectedService,
          skill: selectedService,
          maxDistanceKm: radiusKm
        },
        clientOrigin
      );
      const nearbyItems = filterNearbyLabours(items, radiusKm);

      setServiceLabours(nearbyItems);
      setSelectedLabourId(getFirstAvailableLabour(nearbyItems)?.id ?? '');
      if (!nearbyItems.length) {
        const message = `${selectedService} is not available within ${radiusKm} km. Try increasing distance.`;
        setCoverageMessage(message);
        toast.error(message);
        await recordUnavailableDemand(selectedService);
      } else {
        setCoverageMessage('');
      }
      return nearbyItems;
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
      const targetLabour =
        labours.find((labour) => labour.id === selectedLabourId && labour.availability === 'Available') ??
        getFirstAvailableLabour(labours);

      if (!targetLabour) {
        toast.error(`${selectedService} is not available within ${radiusKm} km.`);
        return;
      }

      setSelectedLabourId(targetLabour.id);
      const { notificationDelivered } = await createDashboardBooking({
        labour: targetLabour,
        mode: 'instant'
      });

      toast.success(
        notificationDelivered
          ? `Request sent to ${targetLabour.fullName}. If they reject or time out, Slivz will buzz the next available labour.`
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
      const labours = await loadServiceLabours();
      const targetLabour =
        labours.find((labour) => labour.id === selectedLabourId && labour.availability === 'Available') ??
        getFirstAvailableLabour(labours);

      if (requestMode === 'scheduled' && selectedDate && selectedSlot && targetLabour) {
        await handleScheduleLabour(targetLabour);
        return;
      }

      window.requestAnimationFrame(() => {
        scheduleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      if (!selectedDate || !selectedSlot) {
        toast.success('Pick a date and time, then choose the labour to schedule.');
      }
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

      if (booking.labourId) {
        try {
          await createNotification({
            userId: booking.labourId,
            senderId: currentUser.uid,
            title: 'Paid',
            body: `${booking.serviceType} ${formatCurrency(paidAmount)}`,
            type: 'booking',
            bookingId: booking.id
          });
        } catch (notificationError) {
          console.warn('Slivz notification delivery skipped:', notificationError);
        }
      }

      toast.success('Service completed with paid amount.');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setCompletingPaymentId('');
    }
  };

  const handleCancelBooking = async (booking) => {
    if (!currentUser?.uid || booking.clientId !== currentUser.uid) {
      toast.error('This request does not belong to your client account.');
      return;
    }

    setCancellingBookingId(booking.id);

    try {
      await updateBookingStatus(booking.id, 'cancelled');

      if (booking.labourId) {
        try {
          await createNotification({
            userId: booking.labourId,
            senderId: currentUser.uid,
            title: 'Cancelled',
            body: booking.serviceType,
            type: 'booking',
            bookingId: booking.id
          });
        } catch (notificationError) {
          console.warn('Slivz notification delivery skipped:', notificationError);
        }
      }

      toast.success('Service request cancelled.');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setCancellingBookingId('');
    }
  };

  const completedServices = bookings.filter((item) => item.status === 'completed').length;
  const scheduledVisits = bookings.filter((item) => item.requestMode === 'scheduled').length;
  const paymentsDue = awaitingPaymentBookings.length;
  const clientName = userProfile?.fullName || currentUser?.displayName || 'Client';
  const clientAvatar = userProfile?.profilePhoto || buildProfileAvatarDataUrl(clientName || 'Client');

  return (
    <AppShell hideFooter>
      <PageSEO title="Client Dashboard" description="Request nearby labour instantly or schedule a trusted worker from your live location." />

      <section className="bg-slate-100/80 pb-5 pt-4 sm:py-6">
        <div className="page-shell max-w-5xl space-y-3.5 sm:space-y-4">
          <LightPanel className="p-3.5 sm:p-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <img
                src={clientAvatar}
                alt={clientName}
                width="72"
                height="72"
                loading="eager"
                decoding="sync"
                className="h-16 w-16 flex-none rounded-[18px] object-cover sm:h-[4.5rem] sm:w-[4.5rem] sm:rounded-[20px]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-bold text-slate-950 sm:text-2xl">{clientName}</h1>
                  </div>
                </div>
                <p className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 sm:mt-4 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm">
                  <LocateFixed size={13} className="flex-none text-brand-600 sm:size-[15px]" />
                  <span className="truncate">{clientLocationLabel}</span>
                </p>
                <LocationPermissionPrompt
                  geolocation={geolocation}
                  onRequest={handleRefreshLocation}
                  className="mt-2 max-w-xl"
                  compact
                />
              </div>
            </div>
          </LightPanel>

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            <DashboardMetric label="Open requests" value={openBookings.length} tone="blue" />
            <DashboardMetric label="Scheduling visits" value={scheduledVisits} />
            <DashboardMetric label="Completed" value={completedServices} tone="emerald" />
            <DashboardMetric label="Payments due" value={paymentsDue} tone="amber" />
          </div>

          <LightPanel className="overflow-hidden p-0">
            <ServiceRequestMap
              center={clientOrigin}
              labours={visibleMapLabours}
              selectedLabourId={selectedLabourId}
              onSelectLabour={(labour) => setSelectedLabourId(labour.id)}
              searching={laboursLoading || submittingInstant}
              title={mapTitle}
              subtitle={mapSubtitle}
              centerLabel={clientLocationLabel || 'Your live location'}
              emptyLabel={`Choose a service below to show labour within ${radiusKm} km`}
              directionsUrl={selectedLabourDirectionsUrl}
              showCenterLabel={false}
              showCenterMarker={false}
              showRoutePreview={false}
              showLabourPins={false}
              renderChildrenInSheet={false}
              initialZoom={12}
              minZoom={9}
              maxZoom={17}
              className="min-h-[320px] rounded-[18px] border-0 shadow-none sm:min-h-[340px] lg:min-h-[360px] sm:rounded-[20px]"
              sheetClassName="bottom-2 left-2 right-2 rounded-[14px] p-2.5 sm:rounded-[16px]"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
                  <AutocompleteSelect
                    label="Available service"
                    placeholder={laboursLoading ? 'Checking nearby services' : 'Search service'}
                    options={workCategories}
                    value={selectedService}
                    onChange={(event) => handleServiceChange(event.target.value)}
                    getAvailability={getServiceAvailability}
                    allowCustom
                    customOptionLabel="Search"
                  />
                  <SelectField
                    label="Radius"
                    options={radiusSelectOptions}
                    value={String(radiusKm)}
                    onChange={(event) => setRadiusKm(Number(event.target.value) || DEFAULT_LABOUR_RADIUS_KM)}
                  />
                  <Button type="button" variant="outline" size="sm" className="h-11 w-full sm:w-auto" onClick={handleRefreshLocation} disabled={geolocation.loading}>
                    {geolocation.loading ? <LoaderCircle size={15} className="animate-spin" /> : <LocateFixed size={15} />}
                    Update GPS
                  </Button>
                </div>
                <LocationPermissionPrompt
                  geolocation={geolocation}
                  onRequest={handleRefreshLocation}
                  className="lg:col-span-2"
                  compact
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" size="sm" className="h-10 w-full bg-slate-950 hover:bg-slate-800" onClick={handleInstantRequest} disabled={submittingInstant || bookingsLoading}>
                    {submittingInstant ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                    Instant
                  </Button>
                  <Button type="button" size="sm" variant={requestMode === 'scheduled' ? 'primary' : 'outline'} className="h-10 w-full" onClick={handleScheduleMode} disabled={bookingsLoading || Boolean(scheduleSubmittingId)}>
                    <CalendarClock size={16} />
                    {requestMode === 'scheduled' && selectedDate && selectedSlot ? 'Book' : 'Schedule'}
                  </Button>
                </div>
              </div>
            </ServiceRequestMap>
          </LightPanel>

          <LightPanel className="p-2.5 sm:p-3">
            <div className="mb-3 rounded-[14px] border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Service location</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-800">{clientLocationLabel}</p>
                </div>
                <Badge tone="emerald">Live GPS</Badge>
              </div>
              <div className="mt-2">
                <Button type="button" variant="outline" size="sm" className="h-10 w-full sm:w-auto" onClick={handleUseLiveServiceLocation}>
                  <LocateFixed size={15} />
                  Live GPS
                </Button>
              </div>
            </div>
            {coverageMessage ? (
              <div className="mb-4 rounded-[16px] border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                {coverageMessage}
              </div>
            ) : null}
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
                <AutocompleteSelect
                  label="Available service"
                  placeholder={laboursLoading ? 'Checking nearby services' : 'Search service'}
                  options={workCategories}
                  value={selectedService}
                  onChange={(event) => handleServiceChange(event.target.value)}
                  getAvailability={getServiceAvailability}
                  allowCustom
                  customOptionLabel="Search"
                />
                <SelectField
                  label="Radius"
                  options={radiusSelectOptions}
                  value={String(radiusKm)}
                  onChange={(event) => setRadiusKm(Number(event.target.value) || DEFAULT_LABOUR_RADIUS_KM)}
                />
                <Button type="button" variant="outline" size="sm" className="h-11 w-full sm:w-auto" onClick={handleRefreshLocation} disabled={geolocation.loading}>
                  {geolocation.loading ? <LoaderCircle size={15} className="animate-spin" /> : <LocateFixed size={15} />}
                  Update GPS
                </Button>
              </div>
              <LocationPermissionPrompt
                geolocation={geolocation}
                onRequest={handleRefreshLocation}
                className="mt-3"
                compact
              />
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" className="h-10 w-full bg-slate-950 hover:bg-slate-800" onClick={handleInstantRequest} disabled={submittingInstant || bookingsLoading}>
                  {submittingInstant ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                  Instant
                </Button>
                <Button type="button" size="sm" variant={requestMode === 'scheduled' ? 'primary' : 'outline'} className="h-10 w-full" onClick={handleScheduleMode} disabled={bookingsLoading || Boolean(scheduleSubmittingId)}>
                  <CalendarClock size={16} />
                  {requestMode === 'scheduled' && selectedDate && selectedSlot ? 'Book' : 'Schedule'}
                </Button>
              </div>
            </div>
          </LightPanel>

          {requestMode === 'scheduled' ? (
            <div ref={scheduleSectionRef} className="scroll-mt-24 grid gap-3 xl:grid-cols-[0.85fr_1.15fr]">
              <BookingCalendar selectedDate={selectedDate} selectedSlot={selectedSlot} onDateChange={setSelectedDate} onSlotChange={setSelectedSlot} />
              <LightPanel className="p-3.5 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950 sm:text-xl">Schedule {selectedService || 'service'} labour</h2>
                  <Badge tone={serviceLabours.length ? 'emerald' : 'slate'}>{laboursLoading ? 'Checking' : `${serviceLabours.length} found`}</Badge>
                </div>
                <div className="mt-4 space-y-2">
                  {serviceLabours.length ? (
                    serviceLabours.map((labour) => (
                      <button key={labour.id} type="button" className={`w-full rounded-[16px] border p-3 text-left transition ${selectedLabourId === labour.id ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300'}`} onClick={() => handleScheduleLabour(labour)} disabled={Boolean(scheduleSubmittingId)}>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div className="flex min-w-0 items-center gap-3">
                            <img src={labour.profilePhoto} alt={labour.fullName} width="44" height="44" loading="lazy" decoding="async" className="h-11 w-11 flex-none rounded-xl object-cover" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-950 sm:text-base">{labour.fullName}</p>
                              <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">{labour.category} - {formatDistanceKm(labour.distanceKm)}</p>
                            </div>
                          </div>
                          <span className="inline-flex min-h-9 items-center justify-center rounded-xl bg-slate-950 px-3 text-xs font-bold text-white">
                            {scheduleSubmittingId === labour.id ? 'Scheduling...' : getKnownScheduleConflict(labour) ? 'Not available' : selectedDate && selectedSlot ? 'Schedule' : 'Pick time'}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <EmptyDashed>{selectedService ? `No labour within ${radiusKm} km. Try increasing distance.` : 'Choose a service'}</EmptyDashed>
                  )}
                </div>
              </LightPanel>
            </div>
          ) : null}

          {pendingBookings.length ? (
            <LightPanel className="border-brand-200 bg-brand-50">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Requesting</p>
                  <h2 className="mt-2 text-xl font-bold text-slate-950 sm:text-[1.35rem]">Waiting for labour response</h2>
                  <p className="mt-2 break-words text-sm font-medium leading-6 text-slate-700">
                    {pendingBookings[0].labourName} received your {pendingBookings[0].serviceType} request.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" disabled={cancellingBookingId === pendingBookings[0].id} onClick={() => handleCancelBooking(pendingBookings[0])}>
                  {cancellingBookingId === pendingBookings[0].id ? 'Cancelling...' : 'Cancel request'}
                </Button>
              </div>
            </LightPanel>
          ) : null}

          {activeBookings.length ? (
            <LightPanel className="border-emerald-200 bg-emerald-50">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Labour connected</p>
                  <h2 className="mt-2 text-xl font-bold text-slate-950 sm:text-[1.35rem]">{activeBookings[0].labourName} accepted your request</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                    Keep your start OTP ready. Share it only after the labour reaches your location.
                  </p>
                </div>
                <Badge tone="emerald">{activeBookings[0].status}</Badge>
              </div>
              {activeBookings[0].startOtp ? (
                <div className="mt-4 rounded-[18px] border border-emerald-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase text-emerald-700">Start OTP</p>
                  <p className="mt-2 font-display text-2xl font-bold tracking-[0.2em] text-slate-950 sm:text-[1.65rem] sm:tracking-[0.22em]">{activeBookings[0].startOtp}</p>
                </div>
              ) : null}
              {activeBookings[0].status === 'accepted' ? (
                <Button type="button" size="sm" variant="outline" className="mt-4 w-full sm:w-auto" disabled={cancellingBookingId === activeBookings[0].id} onClick={() => handleCancelBooking(activeBookings[0])}>
                  {cancellingBookingId === activeBookings[0].id ? 'Cancelling...' : 'Cancel request'}
                </Button>
              ) : null}
            </LightPanel>
          ) : null}

          {awaitingPaymentBookings.length ? (
            <LightPanel className="border-amber-200 bg-amber-50">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Work finished</p>
                  <h2 className="mt-2 text-xl font-bold text-slate-950 sm:text-[1.35rem]">Complete payment for {awaitingPaymentBookings[0].labourName}</h2>
                  <div className="mt-3 grid gap-2 rounded-[14px] border border-amber-200 bg-white/70 p-3 text-sm font-semibold text-slate-700 sm:grid-cols-3">
                    <span>{awaitingPaymentBookings[0].serviceType}</span>
                    <span>{formatDate(awaitingPaymentBookings[0].appointmentAt)}</span>
                    <span className="min-w-0 truncate">
                      <LocationText
                        location={awaitingPaymentBookings[0].location}
                        coordinates={awaitingPaymentBookings[0].coordinates}
                        fallback="Live location shared"
                      />
                    </span>
                  </div>
                  <InputField
                    label="Amount paid"
                    type="number"
                    min="1"
                    inputMode="decimal"
                    value={paymentAmounts[awaitingPaymentBookings[0].id] ?? ''}
                    onChange={(event) => handlePaymentAmountChange(awaitingPaymentBookings[0].id, event.target.value)}
                    placeholder="Enter amount"
                    className="mt-4 max-w-sm"
                  />
                </div>
                <Button type="button" size="sm" className="h-11 w-full lg:w-auto" disabled={completingPaymentId === awaitingPaymentBookings[0].id} onClick={() => handleCompleteClientPayment(awaitingPaymentBookings[0])}>
                  {completingPaymentId === awaitingPaymentBookings[0].id ? 'Completing...' : 'Complete service'}
                </Button>
              </div>
            </LightPanel>
          ) : null}

          <div className="grid gap-3 xl:grid-cols-[1fr_0.9fr]">
            <LightPanel className="p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-950 sm:text-xl">Request tracking</h2>
              </div>
              <div className="mt-3 space-y-2">
                {bookingsLoading ? (
                  <>
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-16 w-full rounded-2xl" />
                  </>
                ) : trackedBookings.length ? (
                  <>
                    <div className="hidden rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 md:grid md:grid-cols-[1.05fr_1fr_0.8fr_0.8fr_0.75fr] md:items-center md:gap-3">
                      <span>Worker</span>
                      <span>Service</span>
                      <span>Time</span>
                      <span>Money</span>
                      <span>Status</span>
                    </div>
                    {trackedBookings.map((booking) => (
                      <div key={booking.id} className="rounded-[14px] border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
                        <div className="grid gap-2 md:grid-cols-[1.05fr_1fr_0.8fr_0.8fr_0.75fr] md:items-center md:gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold text-slate-950">{booking.labourName || 'Labour'}</h3>
                            <p className="mt-0.5 text-xs font-medium text-slate-500">{booking.requestMode === 'scheduled' ? 'Scheduled' : 'Instant'}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{booking.serviceType}</p>
                            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500">
                              <span className="flex-none" aria-hidden="true">📍</span>
                              <span className="truncate">
                                <LocationText
                                  location={booking.location}
                                  coordinates={booking.coordinates}
                                  fallback="Live location shared"
                                />
                              </span>
                            </p>
                          </div>
                          <div className="text-xs md:text-sm">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                              <Clock3 size={13} />
                              {formatDate(booking.appointmentAt)}
                            </span>
                          </div>
                          <div className="text-xs md:text-sm">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                              <WalletCards size={13} />
                              {booking.status === 'completed' && Number(booking.amount) > 0
                                ? formatCurrency(booking.amount)
                                : booking.status === 'awaiting_payment'
                                  ? 'Payment due'
                                  : 'Pending'}
                            </span>
                          </div>
                          <div className="flex justify-start md:justify-end">
                            <Badge tone={getBookingTone(booking.status)}>{booking.status}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <EmptyDashed>Your service requests will show here</EmptyDashed>
                )}
              </div>
            </LightPanel>

            <LightPanel>
              <div className="flex items-center gap-2">
                <UserCheck size={20} className="text-emerald-600" />
                <h2 className="text-xl font-bold text-slate-950 sm:text-[1.35rem]">Related labour</h2>
              </div>
              <div className="mt-5 space-y-2.5">
                {laboursLoading ? (
                  <>
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-16 w-full rounded-2xl" />
                  </>
                ) : serviceLabours.length ? (
                  serviceLabours.slice(0, 4).map((labour) => (
                    <button key={labour.id} type="button" className={`w-full rounded-[18px] border p-3 text-left transition ${selectedLabourId === labour.id ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300'}`} onClick={() => setSelectedLabourId(labour.id)}>
                      <div className="flex min-w-0 items-center gap-3">
                        <img src={labour.profilePhoto} alt={labour.fullName} width="48" height="48" loading="lazy" decoding="async" className="h-12 w-12 flex-none rounded-2xl object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-950 sm:text-base">{labour.fullName}</p>
                          <p className="mt-1 truncate text-sm font-medium text-slate-500">{formatDistanceKm(labour.distanceKm)}</p>
                        </div>
                        <Badge tone="emerald">{labour.availability}</Badge>
                      </div>
                    </button>
                  ))
                ) : (
                  <EmptyDashed>Choose a service to show workers within {radiusKm} km</EmptyDashed>
                )}
              </div>
              <Button as={Link} to="/search" variant="outline" size="sm" className="mt-4 w-full">
                <Search size={15} />
                Full search
              </Button>
            </LightPanel>
          </div>

          {false && requestMode === 'scheduled' ? (
            <div ref={scheduleSectionRef} className="scroll-mt-24 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <BookingCalendar selectedDate={selectedDate} selectedSlot={selectedSlot} onDateChange={setSelectedDate} onSlotChange={setSelectedSlot} />
              <LightPanel>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-slate-950 sm:text-[1.35rem]">Schedule {selectedService || 'service'} labour</h2>
                  <Badge tone={serviceLabours.length ? 'emerald' : 'slate'}>{laboursLoading ? 'Checking' : `${serviceLabours.length} found`}</Badge>
                </div>
                <div className="mt-5 space-y-2.5">
                  {serviceLabours.length ? (
                    serviceLabours.map((labour) => (
                      <button key={labour.id} type="button" className={`w-full rounded-[18px] border p-3 text-left transition ${selectedLabourId === labour.id ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300'}`} onClick={() => handleScheduleLabour(labour)} disabled={Boolean(scheduleSubmittingId)}>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div className="flex min-w-0 items-center gap-3">
                            <img src={labour.profilePhoto} alt={labour.fullName} width="48" height="48" loading="lazy" decoding="async" className="h-12 w-12 flex-none rounded-2xl object-cover" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-950 sm:text-base">{labour.fullName}</p>
                              <p className="mt-1 text-sm font-medium text-slate-500">{labour.category} · {formatDistanceKm(labour.distanceKm)}</p>
                            </div>
                          </div>
                          <span className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-3 text-xs font-bold text-white">
                            {scheduleSubmittingId === labour.id ? 'Scheduling...' : getKnownScheduleConflict(labour) ? 'Not available' : selectedDate && selectedSlot ? 'Schedule' : 'Pick time'}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <EmptyDashed>{selectedService ? `No labour within ${radiusKm} km. Try increasing distance.` : 'Choose a service'}</EmptyDashed>
                  )}
                </div>
              </LightPanel>
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );

};

export default ClientDashboardPage;
