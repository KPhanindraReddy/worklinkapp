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
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BookingCalendar } from '../../components/booking/BookingCalendar';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { InputField } from '../../components/common/InputField';
import { PageSEO } from '../../components/common/PageSEO';
import { SelectField } from '../../components/common/SelectField';
import { Skeleton } from '../../components/common/Skeleton';
import { AppShell } from '../../components/layout/AppShell';
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
import { NEARBY_LABOUR_RADIUS_KM } from '../../utils/constants';
import {
  buildMapsUrl,
  getDisplayLocationText,
  getLocationLabel,
  normalizeCoordinates
} from '../../utils/location';
import { fetchMapboxCoordinatesForAddress } from '../../utils/mapbox';
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
const filterNearbyLabours = (items) =>
  items.filter((labour) => Number.isFinite(Number(labour.distanceKm)) && Number(labour.distanceKm) <= NEARBY_LABOUR_RADIUS_KM);

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
  const [serviceLocationMode, setServiceLocationMode] = useState('live');
  const [serviceLocationInput, setServiceLocationInput] = useState('');
  const [manualServiceLocationLabel, setManualServiceLocationLabel] = useState('');
  const [resolvingServiceLocation, setResolvingServiceLocation] = useState(false);
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
    if (serviceLocationMode === 'live') {
      setRequestCoordinates(nextCoordinates);
    }
  }, [geolocation.hasLocation, geolocation.latitude, geolocation.longitude, serviceLocationMode]);

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
        return manualServiceLocationLabel || resolvedLocationName || profileLocationLabel || 'Live location captured';
      }

      if (geolocation.loading) {
        return 'Finding your current GPS location';
      }

      return geolocation.error || 'Allow location to show nearby services';
    },
    [clientOrigin, geolocation.error, geolocation.loading, manualServiceLocationLabel, profileLocationLabel, resolvedLocationName]
  );
  const bookingAddress =
    clientOrigin
      ? getDisplayLocationText(manualServiceLocationLabel || resolvedLocationName || profileLocationLabel, 'Live location shared')
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

    searchLabours({ availability: 'Available', maxDistanceKm: NEARBY_LABOUR_RADIUS_KM }, clientOrigin)
      .then((items) => {
        if (!isActive) {
          return;
        }

        const nearbyItems = filterNearbyLabours(items);

        setAvailableLabours(nearbyItems);
        if (nearbyItems.length) {
          setCoverageMessage('');
        } else {
          const message = `We are currently not available in this location: ${bookingAddress || clientLocationLabel}.`;
          setCoverageMessage(message);
          if (serviceLocationMode === 'manual') {
            toast.error(message);
            recordUnavailableDemand('Any service');
          }
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
  }, [clientOrigin, serviceLocationMode]);

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
  const trackedBookings = useMemo(() => bookings.slice(0, 3), [bookings]);
  const mapTitle = selectedService ? `${selectedService} within ${NEARBY_LABOUR_RADIUS_KM} km` : 'Service location';
  const mapSubtitle = clientOrigin
    ? `${serviceLocationMode === 'manual' ? 'Service address' : 'Live location'}: ${clientLocationLabel}`
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
      return;
    }

    setServiceLocationMode('live');
    setManualServiceLocationLabel('');
    setRequestCoordinates(coordinates);
    setLiveCoordinates(coordinates);
    toast.success('Live location updated.');
  };

  const handleUseLiveServiceLocation = () => {
    const coordinates = liveCoordinates || normalizeCoordinates(userProfile?.coordinates);

    if (!coordinates) {
      toast.error('Allow GPS first, then use live location.');
      return;
    }

    setServiceLocationMode('live');
    setManualServiceLocationLabel('');
    setRequestCoordinates(coordinates);
    toast.success('Service location set to live GPS.');
  };

  const handleApplyServiceAddress = async () => {
    const address = serviceLocationInput.trim();

    if (!address) {
      toast.error('Enter the service address first.');
      return;
    }

    setResolvingServiceLocation(true);

    try {
      const result = await fetchMapboxCoordinatesForAddress(address);

      if (!result?.coordinates) {
        toast.error('Could not find that address. Try adding area, city, and pincode.');
        return;
      }

      setServiceLocationMode('manual');
      setManualServiceLocationLabel(result.label || address);
      setServiceLocationInput(result.label || address);
      setRequestCoordinates(result.coordinates);
      toast.success('Service location updated.');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setResolvingServiceLocation(false);
    }
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
      requestedLocationMode: serviceLocationMode,
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
          maxDistanceKm: NEARBY_LABOUR_RADIUS_KM
        },
        clientOrigin
      );
      const nearbyItems = filterNearbyLabours(items);

      setServiceLabours(nearbyItems);
      setSelectedLabourId(getFirstAvailableLabour(nearbyItems)?.id ?? '');
      if (!nearbyItems.length) {
        const message = `${selectedService} is currently not available in this location: ${bookingAddress || clientLocationLabel}.`;
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
            title: 'Payment completed',
            body: `${userProfile?.fullName || 'Client'} completed ${booking.serviceType} with ${formatCurrency(paidAmount)} paid.`,
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
            title: 'Service request cancelled',
            body: `${userProfile?.fullName || 'Client'} cancelled the ${booking.serviceType} request.`,
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
              emptyLabel={`Choose a service below to show labour within ${NEARBY_LABOUR_RADIUS_KM} km`}
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
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <SelectField
                    label="Available service"
                    placeholder={
                      laboursLoading
                        ? 'Checking nearby services'
                        : serviceOptions.length
                          ? 'Choose available service'
                          : `No services within ${NEARBY_LABOUR_RADIUS_KM} km`
                    }
                    options={serviceOptions}
                    value={selectedService}
                    disabled={laboursLoading || !serviceOptions.length}
                    onChange={(event) => {
                      setSelectedService(event.target.value);
                      setRequestMode('instant');
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" className="h-11 w-full sm:w-auto" onClick={handleRefreshLocation} disabled={geolocation.loading}>
                    {geolocation.loading ? <LoaderCircle size={15} className="animate-spin" /> : <LocateFixed size={15} />}
                    Update GPS
                  </Button>
                </div>
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
                <Badge tone={serviceLocationMode === 'manual' ? 'blue' : 'emerald'}>
                  {serviceLocationMode === 'manual' ? 'Address' : 'Live GPS'}
                </Badge>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                <InputField
                  label="Another address"
                  value={serviceLocationInput}
                  onChange={(event) => setServiceLocationInput(event.target.value)}
                  placeholder="House, area, city, pincode"
                />
                <Button type="button" variant="outline" size="sm" className="h-10 w-full sm:w-auto" onClick={handleApplyServiceAddress} disabled={resolvingServiceLocation}>
                  {resolvingServiceLocation ? <LoaderCircle size={15} className="animate-spin" /> : <Navigation size={15} />}
                  Use address
                </Button>
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
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <SelectField
                  label="Available service"
                  placeholder={
                    laboursLoading
                      ? 'Checking nearby services'
                      : serviceOptions.length
                        ? 'Choose available service'
                        : `No services within ${NEARBY_LABOUR_RADIUS_KM} km`
                  }
                  options={serviceOptions}
                  value={selectedService}
                  disabled={laboursLoading || !serviceOptions.length}
                  onChange={(event) => {
                    setSelectedService(event.target.value);
                    setRequestMode('instant');
                  }}
                />
                <Button type="button" variant="outline" size="sm" className="h-11 w-full sm:w-auto" onClick={handleRefreshLocation} disabled={geolocation.loading}>
                  {geolocation.loading ? <LoaderCircle size={15} className="animate-spin" /> : <LocateFixed size={15} />}
                  Update GPS
                </Button>
              </div>
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
                    <EmptyDashed>{selectedService ? 'No labour available for this service' : 'Choose a service'}</EmptyDashed>
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
                <Button as={Link} to="/chat" variant="outline" size="sm" className="w-full sm:w-auto">
                  <MessageCircle size={16} />
                  Chat
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {bookingsLoading ? (
                  <>
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-16 w-full rounded-2xl" />
                  </>
                ) : trackedBookings.length ? (
                  trackedBookings.map((booking) => (
                    <div key={booking.id} className="rounded-[16px] border border-slate-200 bg-slate-50 p-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-slate-950 sm:text-base">{booking.serviceType}</h3>
                          <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{booking.labourName || 'Labour'} - {formatDate(booking.appointmentAt)}</p>
                        </div>
                        <Badge tone={getBookingTone(booking.status)}>{booking.status}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1.5"><Clock3 size={13} />{booking.requestMode === 'scheduled' ? 'Scheduled' : 'Instant'}</span>
                        <span className="inline-flex items-center gap-1.5 text-brand-700"><WalletCards size={13} />{booking.status === 'completed' && Number(booking.amount) > 0 ? formatCurrency(booking.amount) : booking.status === 'awaiting_payment' ? 'Payment due' : 'Pending'}</span>
                      </div>
                      {booking.labourId ? (
                        <Button
                          as={Link}
                          to={`/chat?target=${encodeURIComponent(booking.labourId)}&booking=${encodeURIComponent(booking.id)}`}
                          size="sm"
                          variant="outline"
                          className="mt-3 w-full sm:w-auto"
                        >
                          <MessageCircle size={15} />
                          Chat labour
                        </Button>
                      ) : null}
                    </div>
                  ))
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
                  <EmptyDashed>Choose a service to show workers within {NEARBY_LABOUR_RADIUS_KM} km</EmptyDashed>
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
                    <EmptyDashed>{selectedService ? 'No labour available for this service' : 'Choose a service'}</EmptyDashed>
                  )}
                </div>
              </LightPanel>
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );

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
            centerLabel={clientLocationLabel || 'Your live location'}
            emptyLabel={`Choose a service below to show labour within ${NEARBY_LABOUR_RADIUS_KM} km`}
            showCenterLabel={false}
            showRoutePreview={Boolean(selectedService && selectedLabourId)}
            initialZoom={12}
            minZoom={9}
            maxZoom={17}
            className="-mx-[0.625rem] min-h-[620px] touch-pan-y rounded-none border-x-0 sm:mx-0 sm:min-h-[640px] sm:rounded-[28px] sm:border"
            sheetClassName="bottom-4 left-4 right-4 rounded-[24px] p-4 sm:rounded-[24px] sm:border"
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
                        : `No services within ${NEARBY_LABOUR_RADIUS_KM} km`
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
              <div className="mt-4">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={cancellingBookingId === pendingBookings[0].id}
                  onClick={() => handleCancelBooking(pendingBookings[0])}
                >
                  {cancellingBookingId === pendingBookings[0].id ? 'Cancelling...' : 'Cancel request'}
                </Button>
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
              <div className="mt-4 flex items-center gap-3">
                <img
                  src={activeBookings[0].labourProfilePhoto || buildProfileAvatarDataUrl(activeBookings[0].labourName || 'Labour')}
                  alt={activeBookings[0].labourName}
                  width="48"
                  height="48"
                  loading="eager"
                  decoding="sync"
                  className="h-12 w-12 rounded-xl object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{activeBookings[0].labourName}</p>
                  <p className="truncate text-xs font-medium text-slate-600">{activeBookings[0].serviceType}</p>
                </div>
              </div>
              {activeBookings[0].startOtp ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase text-emerald-700">Start OTP</p>
                  <p className="mt-2 font-display text-2xl font-bold tracking-[0.24em] text-slate-950">
                    {activeBookings[0].startOtp}
                  </p>
                </div>
              ) : null}
              {activeBookings[0].status === 'accepted' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-4 w-full sm:w-auto"
                  disabled={cancellingBookingId === activeBookings[0].id}
                  onClick={() => handleCancelBooking(activeBookings[0])}
                >
                  {cancellingBookingId === activeBookings[0].id ? 'Cancelling...' : 'Cancel request'}
                </Button>
              ) : null}
            </Card>
          ) : null}

          {awaitingPaymentBookings.length ? (
            <Card className="rounded-[24px] border-amber-200 bg-amber-50 p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
                    Work finished
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    Complete payment for {awaitingPaymentBookings[0].labourName}
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                    Enter the amount you paid after the labour finishes the work. This closes the service for both sides.
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
                  className="h-11 w-full lg:w-auto"
                  disabled={completingPaymentId === awaitingPaymentBookings[0].id}
                  onClick={() => handleCompleteClientPayment(awaitingPaymentBookings[0])}
                >
                  {completingPaymentId === awaitingPaymentBookings[0].id ? 'Completing...' : 'Complete service'}
                </Button>
              </div>
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
                                width="48"
                                height="48"
                                loading="lazy"
                                decoding="async"
                                className="h-12 w-12 flex-none rounded-xl object-cover"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-950">{labour.fullName}</p>
                                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium text-slate-600">
                                  <span>{labour.category}</span>
                                  <span>{formatDistanceKm(labour.distanceKm)}</span>
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
                          ? `Try another time, update GPS, or choose a different service within ${NEARBY_LABOUR_RADIUS_KM} km.`
                          : `Select a service above to show related labour within ${NEARBY_LABOUR_RADIUS_KM} km.`
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
                            className="h-11 w-11 flex-none rounded-xl object-cover"
                          />
                          <div className="min-w-0">
                            <h3 className="font-semibold text-slate-950">{booking.serviceType}</h3>
                            <p className="mt-1 break-words text-sm text-slate-600">
                              {booking.labourName} - {getDisplayLocationText(booking.location, 'Live location shared')}
                            </p>
                          </div>
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
                          {booking.status === 'completed' && Number(booking.amount) > 0
                            ? formatCurrency(booking.amount)
                            : booking.status === 'awaiting_payment'
                              ? 'Enter paid amount'
                            : 'Charge pending'}
                        </span>
                      </div>
                      {booking.status === 'completed' && Number(booking.amount) > 0 ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-950">
                                {booking.paymentStatus === 'paid' ? 'Payment paid' : 'Payment due'}
                              </p>
                              <p className="mt-1 text-xs font-medium text-slate-500">
                                Final charge: {formatCurrency(booking.amount)}
                              </p>
                            </div>
                            <Badge tone={booking.paymentStatus === 'paid' ? 'emerald' : 'amber'}>
                              {booking.paymentStatus === 'paid' ? 'Paid' : 'Waiting'}
                            </Badge>
                          </div>
                        </div>
                      ) : null}
                      {booking.status === 'awaiting_payment' ? (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                          <p className="text-sm font-semibold text-amber-950">Payment amount needed</p>
                          <p className="mt-1 text-xs font-medium leading-5 text-amber-900">
                            Use the work-finished card above to enter the paid amount and complete this request.
                          </p>
                        </div>
                      ) : null}
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
                          {booking.status === 'accepted' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto"
                              disabled={cancellingBookingId === booking.id}
                              onClick={() => handleCancelBooking(booking)}
                            >
                              {cancellingBookingId === booking.id ? 'Cancelling...' : 'Cancel'}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      {booking.status === 'pending' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-4 w-full sm:w-auto"
                          disabled={cancellingBookingId === booking.id}
                          onClick={() => handleCancelBooking(booking)}
                        >
                          {cancellingBookingId === booking.id ? 'Cancelling...' : 'Cancel request'}
                        </Button>
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
                          width="44"
                          height="44"
                          loading="lazy"
                          decoding="async"
                          className="h-11 w-11 flex-none rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-950">{labour.fullName}</p>
                          <p className="mt-1 truncate text-xs font-medium text-slate-600">
                            {formatDistanceKm(labour.distanceKm)}
                          </p>
                        </div>
                        <Badge tone="emerald">{labour.availability}</Badge>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-600">
                    Choose a service to show free workers within {NEARBY_LABOUR_RADIUS_KM} km of your live location.
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
