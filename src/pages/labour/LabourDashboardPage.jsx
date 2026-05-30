import {
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  House,
  IndianRupee,
  CalendarClock,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  UserRound,
  WalletCards
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { InputField } from '../../components/common/InputField';
import { PageSEO } from '../../components/common/PageSEO';
import { Skeleton } from '../../components/common/Skeleton';
import { AppShell } from '../../components/layout/AppShell';
import { AvailabilityToggle } from '../../components/dashboard/AvailabilityToggle';
import { ServiceRequestMap } from '../../components/map/ServiceRequestMap';
import { useAuth } from '../../context/AuthContext';
import { useLocationName } from '../../hooks/useLocationName';
import {
  completeBookingWork,
  startBookingWork,
  subscribeBookingsForUser,
  updateBookingStatus
} from '../../services/bookingService';
import { ensureConversation } from '../../services/chatService';
import { subscribeLabourById, updateAvailability } from '../../services/labourService';
import { createNotification } from '../../services/notificationService';
import { formatCurrency, formatDate, parseDateValue } from '../../utils/formatters';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import { getDisplayLocationText, getLocationLabel } from '../../utils/location';

const buildAvatarUrl = (fullName) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'WorkLink Labour')}&background=1d4ed8&color=ffffff`;

const labourDashboardNavItems = [
  { label: 'Home', href: '#labour-home', icon: House },
  { label: 'Services', href: '#labour-requests', icon: ClipboardList },
  { label: 'Earnings', href: '#labour-earnings', icon: IndianRupee },
  { label: 'Profile', href: '#labour-profile', icon: UserRound }
];

const getDateKey = (value) => {
  const date = parseDateValue(value);

  if (!date) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
};

const buildOwnLabourProfile = ({ currentUser, userProfile }) => {
  const fullName = userProfile?.fullName || currentUser?.displayName || 'Your labour profile';
  const currentLocation = getLocationLabel(userProfile, {
    preferCurrent: true,
    fallback: 'Location not set'
  });

  return {
    id: currentUser?.uid ?? '',
    uid: currentUser?.uid ?? '',
    fullName,
    category: userProfile?.category || 'Labour professional',
    currentLocation,
    coordinates: userProfile?.coordinates || null,
    profilePhoto: userProfile?.profilePhoto || currentUser?.photoURL || buildAvatarUrl(fullName),
    phoneNumber: userProfile?.phoneNumber || currentUser?.phoneNumber || '',
    availability: userProfile?.availability || 'Available',
    rating: Number(userProfile?.rating) || 0,
    reviewsCount: Number(userProfile?.reviewsCount) || 0,
    dailyWage: Number(userProfile?.dailyWage) || 0,
    completedJobs: Number(userProfile?.completedJobs) || 0,
    reviews: []
  };
};

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
    className={`scroll-mt-28 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.03)] sm:p-6 ${className}`}
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
    <div className="rounded-[18px] border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-3 text-4xl font-bold leading-none ${toneClass}`}>{value}</p>
    </div>
  );
};

const EmptyDashed = ({ children }) => (
  <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-base font-medium text-slate-300">
    {children}
  </div>
);

const LabourDashboardPage = () => {
  const { currentUser, userProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [otpValues, setOtpValues] = useState({});
  const [startingBookingId, setStartingBookingId] = useState('');
  const [completingBookingId, setCompletingBookingId] = useState('');

  const ownProfile = useMemo(
    () => buildOwnLabourProfile({ currentUser, userProfile }),
    [
      currentUser?.displayName,
      currentUser?.phoneNumber,
      currentUser?.photoURL,
      currentUser?.uid,
      userProfile?.availability,
      userProfile?.category,
      userProfile?.completedJobs,
      userProfile?.currentLocation,
      userProfile?.dailyWage,
      userProfile?.fullName,
      userProfile?.location,
      userProfile?.phoneNumber,
      userProfile?.profilePhoto,
      userProfile?.coordinates,
      userProfile?.rating,
      userProfile?.reviewsCount
    ]
  );
  const dashboardProfile = profile ?? ownProfile;
  const resolvedDashboardLocationName = useLocationName(dashboardProfile.coordinates);
  const dashboardLocationLabel = useMemo(
    () =>
      getLocationLabel(dashboardProfile, {
        preferCurrent: true,
        fallback: resolvedDashboardLocationName || 'Location not set'
      }),
    [dashboardProfile, resolvedDashboardLocationName]
  );
  const getBookingDestinationDetails = (booking) => {
    const areaLabel = getDisplayLocationText(booking?.location, '');
    const hasCoordinates =
      booking?.coordinates?.latitude != null && booking?.coordinates?.longitude != null;

    return {
      primary: areaLabel || (hasCoordinates ? 'Client live location' : 'Location unavailable'),
      secondary: ''
    };
  };
  const isProfileMissing = !dashboardLoading && !profile;
  const activeWorkBookings = useMemo(
    () => bookings.filter((booking) => ['accepted', 'in_progress'].includes(booking.status)),
    [bookings]
  );
  const scheduledClientBookings = useMemo(
    () =>
      bookings
        .filter((booking) => ['pending', 'accepted', 'in_progress'].includes(booking.status))
        .sort((a, b) => {
          const dateA = parseDateValue(a.appointmentAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const dateB = parseDateValue(b.appointmentAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;

          return dateA - dateB;
        }),
    [bookings]
  );
  const inProgressBooking = useMemo(
    () => bookings.find((booking) => booking.status === 'in_progress') ?? null,
    [bookings]
  );

  useEffect(() => {
    if (!currentUser?.uid) {
      setProfile(null);
      setBookings([]);
      setDashboardLoading(false);
      return undefined;
    }

    let isActive = true;
    let profileLoaded = false;
    let bookingsLoaded = false;

    const markLoaded = () => {
      if (isActive && profileLoaded && bookingsLoaded) {
        setDashboardLoading(false);
      }
    };

    setDashboardLoading(true);
    setProfile(null);
    setBookings([]);

    const unsubscribeProfile = subscribeLabourById(
      currentUser.uid,
      (nextProfile) => {
        if (!isActive) {
          return;
        }

        profileLoaded = true;
        setProfile(nextProfile);
        markLoaded();
      },
      (error) => {
        if (!isActive) {
          return;
        }

        profileLoaded = true;
        toast.error(getFirebaseErrorMessage(error));
        markLoaded();
      }
    );

    const unsubscribeBookings = subscribeBookingsForUser(
      { userId: currentUser.uid, role: 'labour' },
      (nextBookings) => {
        if (!isActive) {
          return;
        }

        bookingsLoaded = true;
        setBookings(nextBookings);
        markLoaded();
      },
      (error) => {
        if (!isActive) {
          return;
        }

        bookingsLoaded = true;
        toast.error(getFirebaseErrorMessage(error));
        markLoaded();
      }
    );

    return () => {
      isActive = false;
      unsubscribeProfile();
      unsubscribeBookings();
    };
  }, [currentUser?.uid]);

  const metrics = useMemo(() => {
    const completedJobs =
      bookings.filter((item) => item.status === 'completed').length || dashboardProfile.completedJobs;
    const pendingRequests = bookings.filter((item) => item.status === 'pending').length;
    const activeWork = bookings.filter((item) => ['accepted', 'in_progress'].includes(item.status)).length;
    const earnings = bookings
      .filter((item) => item.status === 'completed')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return [
      { label: 'Completed jobs', value: completedJobs },
      { label: 'Pending requests', value: pendingRequests },
      { label: 'Active work', value: activeWork },
      { label: 'Tracked earnings', value: formatCurrency(earnings) }
    ];
  }, [bookings, dashboardProfile.completedJobs]);

  const financialSummary = useMemo(() => {
    const awaitingPaymentCount = bookings.filter((item) => item.status === 'awaiting_payment').length;
    const paidAmount = bookings
      .filter((item) => item.status === 'completed' && item.paymentStatus === 'paid')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const completedAmount = bookings
      .filter((item) => item.status === 'completed')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const todayKey = getDateKey(new Date());
    const todayAmount = bookings
      .filter((item) => {
        const paidDateKey = getDateKey(item.paidAt || item.clientCompletedAt || item.completedAt || item.appointmentAt);
        return item.status === 'completed' && item.paymentStatus === 'paid' && paidDateKey === todayKey;
      })
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return [
      {
        label: 'Awaiting client amount',
        value: `${awaitingPaymentCount} job${awaitingPaymentCount === 1 ? '' : 's'}`
      },
      {
        label: 'Paid earnings',
        value: formatCurrency(paidAmount)
      },
      {
        label: 'Today earned',
        value: formatCurrency(todayAmount)
      },
      {
        label: 'Total completed',
        value: formatCurrency(completedAmount)
      }
    ];
  }, [bookings]);

  const handleAvailabilityChange = async (nextAvailability) => {
    if (!currentUser) {
      return;
    }

    if (inProgressBooking && nextAvailability !== 'Busy') {
      toast.error('Complete the active job before changing availability.');
      return;
    }

    if (!profile) {
      toast.error('Complete your labour profile before changing availability.');
      return;
    }

    setProfile((prev) => ({ ...(prev ?? ownProfile), availability: nextAvailability }));
    setUpdatingAvailability(true);

    try {
      await updateAvailability(currentUser.uid, nextAvailability);
      toast.success('Availability updated.');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const buildDirectionsUrl = (booking) => {
    const coordinates = booking.coordinates;

    if (coordinates?.latitude != null && coordinates?.longitude != null) {
      return `https://www.google.com/maps/dir/?api=1&destination=${coordinates.latitude},${coordinates.longitude}&travelmode=driving`;
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.location || '')}`;
  };

  const handleOpenClientChat = async (booking) => {
    if (!currentUser || !booking?.clientId) {
      return;
    }

    try {
      await ensureConversation({
        currentUserId: currentUser.uid,
        otherUserId: booking.clientId,
        metadata: {
          currentUserProfile: {
            fullName: dashboardProfile.fullName,
            role: 'labour',
            phoneNumber: dashboardProfile.phoneNumber
          },
          otherUserProfile: {
            fullName: booking.clientName,
            role: 'client',
            phoneNumber: booking.clientPhoneNumber
          }
        }
      });
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    }
  };

  const handleBookingDecision = async (booking, status) => {
    if (!currentUser || booking.labourId !== currentUser.uid) {
      toast.error('This booking does not belong to your labour account.');
      return;
    }

    if (status === 'accepted' && inProgressBooking) {
      toast.error('Complete your current in-progress work before accepting another job.');
      return;
    }

    if (status === 'accepted') {
      const requestedDateKey = getDateKey(booking.appointmentAt);
      const alreadyBookedForDay = bookings.some(
        (item) =>
          item.id !== booking.id &&
          ['accepted', 'in_progress'].includes(item.status) &&
          getDateKey(item.appointmentAt) === requestedDateKey
      );

      if (requestedDateKey && alreadyBookedForDay) {
        toast.error('You already have an accepted client scheduled for this day.');
        return;
      }
    }

    try {
      await updateBookingStatus(booking.id, status);
      let notificationDelivered = true;

      if (booking.clientId) {
        try {
          await createNotification({
            userId: booking.clientId,
            senderId: currentUser.uid,
            title: status === 'accepted' ? 'Service request accepted' : 'Service request rejected',
            body:
              status === 'accepted'
                ? `${dashboardProfile.fullName} accepted your ${booking.serviceType} request.`
                : `${dashboardProfile.fullName} rejected your ${booking.serviceType} request.`,
            type: 'booking',
            bookingId: booking.id
          });
        } catch (notificationError) {
          notificationDelivered = false;
          console.warn('WorkLink notification delivery skipped:', notificationError);
        }
      }

      toast.success(notificationDelivered ? `Booking ${status}.` : `Booking ${status}. Client alert will appear after Firestore rules are deployed.`);
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    }
  };

  const handleOtpChange = (bookingId, value) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setOtpValues((prev) => ({ ...prev, [bookingId]: numericValue }));
  };

  const handleStartWork = async (booking) => {
    if (!currentUser || booking.labourId !== currentUser.uid) {
      toast.error('This booking does not belong to your labour account.');
      return;
    }

    const otp = otpValues[booking.id]?.trim();

    if (!/^\d{6}$/.test(otp || '')) {
      toast.error('Enter the 6-digit OTP from the client.');
      return;
    }

    setStartingBookingId(booking.id);

    try {
      await startBookingWork({ bookingId: booking.id, labourId: currentUser.uid, otp });
      setProfile((prev) => (prev ? { ...prev, availability: 'Busy', activeBookingId: booking.id } : prev));
      setOtpValues((prev) => ({ ...prev, [booking.id]: '' }));
      let notificationDelivered = true;

      if (booking.clientId) {
        try {
          await createNotification({
            userId: booking.clientId,
            senderId: currentUser.uid,
            title: 'Work started',
            body: `${dashboardProfile.fullName} started your ${booking.serviceType} work after OTP verification.`,
            type: 'booking',
            bookingId: booking.id
          });
        } catch (notificationError) {
          notificationDelivered = false;
          console.warn('WorkLink notification delivery skipped:', notificationError);
        }
      }

      toast.success(
        notificationDelivered
          ? 'OTP verified. You are marked Busy until this job is completed.'
          : 'OTP verified and work started. Client alert will appear after Firestore rules are deployed.'
      );
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setStartingBookingId('');
    }
  };

  const handleCompleteWork = async (booking) => {
    if (!currentUser || booking.labourId !== currentUser.uid) {
      toast.error('This booking does not belong to your labour account.');
      return;
    }

    setCompletingBookingId(booking.id);

    try {
      await completeBookingWork({ bookingId: booking.id, labourId: currentUser.uid });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              availability: 'Available',
              activeBookingId: ''
            }
          : prev
      );

      let notificationDelivered = true;

      if (booking.clientId) {
        try {
          await createNotification({
            userId: booking.clientId,
            senderId: currentUser.uid,
            title: 'Work finished',
            body: `${dashboardProfile.fullName} finished your ${booking.serviceType}. Enter the paid amount to complete the service.`,
            type: 'booking',
            bookingId: booking.id
          });
        } catch (notificationError) {
          notificationDelivered = false;
          console.warn('WorkLink notification delivery skipped:', notificationError);
        }
      }

      toast.success(
        notificationDelivered
          ? 'Work marked finished. The client will enter the paid amount and complete it.'
          : 'Work marked finished. Client alert will appear after Firestore rules are deployed.'
      );
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setCompletingBookingId('');
    }
  };

  if (dashboardLoading) {
    return (
      <AppShell>
        <PageSEO title="Labour Dashboard" description="Manage your labour profile, availability, bookings, work history, and earnings." />

        <section className="section-space">
          <div className="page-shell">
            <div className="space-y-6">
              <Card className="overflow-hidden rounded-[28px]">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="mt-5 h-12 w-72 max-w-full" />
                <Skeleton className="mt-4 h-20 w-full" />
              </Card>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {['completed', 'pending', 'active', 'earnings'].map((item) => (
                  <Card key={item}>
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="mt-3 h-8 w-20" />
                    <Skeleton className="mt-3 h-4 w-36" />
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  const completedJobs =
    bookings.filter((item) => item.status === 'completed').length || dashboardProfile.completedJobs;
  const pendingRequests = bookings.filter((item) => item.status === 'pending').length;
  const todaySummary = financialSummary.find((item) => item.label === 'Today earned')?.value ?? formatCurrency(0);
  const paidSummary = financialSummary.find((item) => item.label === 'Paid earnings')?.value ?? formatCurrency(0);
  const totalSummary = financialSummary.find((item) => item.label === 'Total completed')?.value ?? formatCurrency(0);
  const paymentBookings = bookings.filter((item) => ['awaiting_payment', 'completed'].includes(item.status));

  return (
    <AppShell hideFooter>
      <PageSEO title="Labour Dashboard" description="Manage your labour profile, availability, bookings, work history, and earnings." />

      <section className="bg-slate-100/80 pb-5 pt-4 sm:py-6">
        <div className="page-shell max-w-5xl space-y-5">
          {isProfileMissing ? (
            <Card className="border-amber-200 bg-amber-50">
              <h2 className="text-lg font-semibold text-amber-950">Labour profile needs completion</h2>
              <p className="mt-2 text-sm text-amber-800">
                Your dashboard is using only your signed-in account details because no labour profile document was found for this UID.
              </p>
              <Button as={Link} to="/complete-profile?role=labour" size="sm" className="mt-4">
                Complete labour profile
              </Button>
            </Card>
          ) : null}

          <LightPanel id="labour-home" className="p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <img
                src={dashboardProfile.profilePhoto}
                alt={dashboardProfile.fullName}
                className="h-20 w-20 flex-none rounded-[22px] object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="truncate text-2xl font-bold text-slate-950 sm:text-3xl">
                      {dashboardProfile.fullName}
                    </h1>
                    <p className="mt-2 truncate text-base font-medium text-slate-500">
                      Field worker · {dashboardProfile.category}
                    </p>
                  </div>
                  <Badge tone={dashboardProfile.availability === 'Available' ? 'emerald' : 'amber'} className="mt-1">
                    {updatingAvailability ? 'Updating' : dashboardProfile.availability}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700">
                    {dashboardProfile.category}
                  </span>
                  <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700">
                    <MapPin size={15} className="flex-none text-rose-500" />
                    <span className="truncate">{dashboardLocationLabel}</span>
                  </span>
                </div>
              </div>
            </div>
          </LightPanel>

          <div className="grid grid-cols-2 gap-3">
            <DashboardMetric label="Completed jobs" value={completedJobs} tone="emerald" />
            <DashboardMetric label="Pending" value={pendingRequests} tone="blue" />
          </div>

          <LightPanel>
            <h2 className="text-2xl font-bold text-slate-950">Availability</h2>
            <div className="mt-5">
              <AvailabilityToggle value={dashboardProfile.availability} onChange={handleAvailabilityChange} />
            </div>
          </LightPanel>

          <LightPanel id="labour-requests">
            <h2 className="text-2xl font-bold text-slate-950">Scheduled clients</h2>
            <div className="mt-5 space-y-3">
              {scheduledClientBookings.length ? (
                scheduledClientBookings.map((booking) => {
                  const routeUnlocked = ['accepted', 'in_progress'].includes(booking.status);

                  return (
                    <div key={booking.id} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-slate-950">{booking.clientName}</p>
                          <p className="mt-1 text-sm font-medium text-slate-500">{booking.serviceType}</p>
                          <p className="mt-2 text-sm text-slate-500">{formatDate(booking.appointmentAt)}</p>
                        </div>
                        <Badge tone={booking.status === 'pending' ? 'amber' : 'emerald'}>{booking.status}</Badge>
                      </div>
                      <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                        {routeUnlocked ? (
                          <Button as="a" href={buildDirectionsUrl(booking)} target="_blank" rel="noreferrer" size="sm" className="w-full sm:w-auto">
                            <Navigation size={15} />
                            Directions
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" className="w-full sm:w-auto" disabled={Boolean(inProgressBooking)} onClick={() => handleBookingDecision(booking, 'accepted')}>
                              Accept
                            </Button>
                            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => handleBookingDecision(booking, 'rejected')}>
                              Reject
                            </Button>
                          </>
                        )}
                        <Button as="a" href={booking.clientPhoneNumber ? `tel:${booking.clientPhoneNumber}` : undefined} size="sm" variant="outline" className={`w-full sm:w-auto ${!booking.clientPhoneNumber ? 'pointer-events-none opacity-60' : ''}`}>
                          <Phone size={15} />
                          Call
                        </Button>
                        <Button as={Link} to="/chat" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => handleOpenClientChat(booking)}>
                          <MessageCircle size={15} />
                          Chat
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyDashed>No schedule yet</EmptyDashed>
              )}
            </div>
          </LightPanel>

          <LightPanel id="labour-earnings">
            <h2 className="text-2xl font-bold text-slate-950">Financial overview</h2>
            <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-4">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-3 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Today</p>
                <p className="mt-4 text-xl font-bold text-emerald-600 sm:text-3xl">{todaySummary}</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-3 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Paid</p>
                <p className="mt-4 text-xl font-bold text-slate-950 sm:text-3xl">{paidSummary}</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-3 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Total</p>
                <p className="mt-4 text-xl font-bold text-slate-950 sm:text-3xl">{totalSummary}</p>
              </div>
            </div>
          </LightPanel>

          <LightPanel>
            <h2 className="text-2xl font-bold text-slate-950">Active work</h2>
            <div className="mt-5 divide-y divide-slate-100">
              {paymentBookings.length || activeWorkBookings.length ? (
                [...activeWorkBookings, ...paymentBookings]
                  .filter((booking, index, items) => items.findIndex((item) => item.id === booking.id) === index)
                  .slice(0, 6)
                  .map((booking) => (
                    <div key={booking.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4 first:pt-0 last:pb-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-brand-50 text-base font-bold text-brand-700">
                          {getInitials(booking.clientName)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xl font-bold text-slate-950">{booking.clientName || 'Client'}</span>
                          <span className="mt-1 block truncate text-base text-slate-500">{booking.serviceType}</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-950">
                          {Number(booking.amount) > 0 ? formatCurrency(booking.amount) : ''}
                        </p>
                        <Badge tone={booking.paymentStatus === 'paid' ? 'emerald' : 'amber'}>
                          {booking.paymentStatus === 'paid' ? 'Paid' : booking.status === 'in_progress' ? 'In work' : 'Awaiting'}
                        </Badge>
                      </div>
                      {booking.status === 'accepted' ? (
                        <div className="col-span-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                          <InputField
                            label="Client start OTP"
                            inputMode="numeric"
                            maxLength="6"
                            value={otpValues[booking.id] ?? ''}
                            onChange={(event) => handleOtpChange(booking.id, event.target.value)}
                            placeholder="6-digit OTP"
                          />
                          <Button type="button" size="sm" className="h-11" disabled={startingBookingId === booking.id} onClick={() => handleStartWork(booking)}>
                            {startingBookingId === booking.id ? 'Verifying...' : 'Start work'}
                          </Button>
                        </div>
                      ) : booking.status === 'in_progress' ? (
                        <Button type="button" size="sm" className="col-span-2 h-11" disabled={completingBookingId === booking.id} onClick={() => handleCompleteWork(booking)}>
                          {completingBookingId === booking.id ? 'Updating...' : 'Work finished'}
                        </Button>
                      ) : null}
                    </div>
                  ))
              ) : (
                <EmptyDashed>No active work yet</EmptyDashed>
              )}
            </div>
          </LightPanel>

          <LightPanel id="labour-profile">
            <h2 className="text-2xl font-bold text-slate-950">Reviews & work proof</h2>
            <div className="mt-5 space-y-3">
              {(dashboardProfile.reviews ?? []).length ? (
                dashboardProfile.reviews.map((review) => (
                  <div key={review.id} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-950">{review.clientName}</p>
                    <p className="mt-2 text-sm text-slate-600">{review.comment}</p>
                  </div>
                ))
              ) : (
                <EmptyDashed>No reviews yet</EmptyDashed>
              )}
            </div>
          </LightPanel>
        </div>
      </section>
    </AppShell>
  );

  return (
    <AppShell>
      <PageSEO title="Labour Dashboard" description="Manage your labour profile, availability, bookings, work history, and earnings." />

      <section className="section-space">
        <div className="page-shell">
          <div className="space-y-6">
            {dashboardLoading ? (
              <Card className="overflow-hidden rounded-[28px]">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="mt-5 h-12 w-72 max-w-full" />
                <Skeleton className="mt-4 h-20 w-full" />
              </Card>
            ) : null}

            {isProfileMissing ? (
              <Card className="border-amber-200 bg-amber-50">
                <h2 className="text-lg font-semibold text-amber-950">Labour profile needs completion</h2>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  Your dashboard is using only your signed-in account details because no labour profile document was found for this UID.
                </p>
                <Button as={Link} to="/complete-profile?role=labour" size="sm" className="mt-4">
                  Complete labour profile
                </Button>
              </Card>
            ) : null}

            <Card id="labour-home" className="scroll-mt-28 overflow-hidden rounded-[28px] sm:rounded-[36px]">
              <div className="grid gap-5 p-4 sm:p-5 md:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="blue">{dashboardProfile.category}</Badge>
                    <Badge tone="slate">{dashboardLocationLabel}</Badge>
                  </div>
                  <h1 className="mt-4 break-words font-display text-2xl font-bold text-slate-950 sm:text-3xl md:text-4xl">
                    {dashboardProfile.fullName}
                  </h1>
                </div>
                <img
                  src={dashboardProfile.profilePhoto}
                  alt={dashboardProfile.fullName}
                  className="h-24 w-24 rounded-[24px] object-cover md:h-28 md:w-28 md:rounded-[28px]"
                />
              </div>
            </Card>

            <MetricsGrid items={metrics} />

            <Card>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Availability</h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                    Keep this updated so clients only see workers who can take requests.
                  </p>
                </div>
                <Badge tone={dashboardProfile.availability === 'Available' ? 'emerald' : 'amber'}>
                  {updatingAvailability ? 'Updating...' : dashboardProfile.availability}
                </Badge>
              </div>
              <div className="mt-5">
                <AvailabilityToggle value={dashboardProfile.availability} onChange={handleAvailabilityChange} />
              </div>
            </Card>

            <Card id="labour-requests" className="scroll-mt-28">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Scheduled clients</h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                    Client time, service details, contact actions, and map directions stay together here.
                  </p>
                </div>
                <Badge tone={scheduledClientBookings.length ? 'emerald' : 'slate'}>
                  {scheduledClientBookings.length ? `${scheduledClientBookings.length} open` : 'No schedule'}
                </Badge>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {scheduledClientBookings.length ? (
                  scheduledClientBookings.map((booking) => {
                    const destinationDetails = getBookingDestinationDetails(booking);
                    const routeUnlocked = ['accepted', 'in_progress'].includes(booking.status);

                    return (
                      <div key={booking.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-slate-950 dark:text-white">{booking.clientName}</h3>
                            <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">
                              {booking.serviceType} - {getDisplayLocationText(booking.location, 'Location shared after accept')}
                            </p>
                          </div>
                          <Badge tone={routeUnlocked ? 'emerald' : 'amber'}>
                            {booking.status === 'in_progress' ? 'In progress' : booking.status}
                          </Badge>
                        </div>

                        <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center gap-2">
                            <CalendarClock size={15} />
                            {formatDate(booking.appointmentAt)}
                          </span>
                          {booking.status === 'completed' && Number(booking.amount) > 0 ? (
                            <span className="inline-flex items-center gap-2 font-semibold text-brand-700 dark:text-brand-200">
                              <WalletCards size={15} />
                              {formatCurrency(booking.amount)}
                            </span>
                          ) : null}
                        </div>

                        {booking.serviceDetails ? (
                          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {booking.serviceDetails}
                          </p>
                        ) : null}

                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-950">
                            {routeUnlocked ? 'Client route ready' : 'Accept to unlock route'}
                          </p>
                          <p className="mt-2 break-words text-slate-500">
                            {routeUnlocked
                              ? destinationDetails.primary
                              : 'Directions appear after you accept this client request.'}
                          </p>
                        </div>

                        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                          {routeUnlocked ? (
                            <Button
                              as="a"
                              href={buildDirectionsUrl(booking)}
                              target="_blank"
                              rel="noreferrer"
                              size="sm"
                              className="w-full sm:w-auto"
                            >
                              <Navigation size={15} />
                              Directions
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                className="w-full sm:w-auto"
                                disabled={Boolean(inProgressBooking)}
                                onClick={() => handleBookingDecision(booking, 'accepted')}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto"
                                onClick={() => handleBookingDecision(booking, 'rejected')}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          <Button
                            as="a"
                            href={booking.clientPhoneNumber ? `tel:${booking.clientPhoneNumber}` : undefined}
                            size="sm"
                            variant="outline"
                            className={`w-full sm:w-auto ${
                              !booking.clientPhoneNumber ? 'pointer-events-none opacity-60' : ''
                            }`}
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
                            onClick={() => handleOpenClientChat(booking)}
                          >
                            <MessageCircle size={15} />
                            Chat
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                    Accepted and pending client work will appear here with time and route details.
                  </p>
                )}
              </div>
            </Card>

            {activeWorkBookings.length ? (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Accepted and active work</h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                      Directions and OTP stay here.
                    </p>
                  </div>
                  <Badge tone={inProgressBooking ? 'amber' : 'emerald'}>
                    {inProgressBooking ? 'Busy' : 'Awaiting OTP'}
                  </Badge>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {activeWorkBookings.map((booking) => {
                    const destinationDetails = getBookingDestinationDetails(booking);

                    return (
                      <div key={booking.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-950 dark:text-white">{booking.serviceType}</h3>
                          <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">
                            {booking.clientName} - {getDisplayLocationText(booking.location, 'Live location shared')}
                          </p>
                        </div>
                        <Badge tone={booking.status === 'in_progress' ? 'amber' : 'emerald'}>
                          {booking.status === 'in_progress' ? 'In progress' : 'Accepted'}
                        </Badge>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-2">
                          <CalendarClock size={15} />
                          {formatDate(booking.appointmentAt)}
                        </span>
                        <span className="inline-flex items-center gap-2 font-semibold text-brand-700 dark:text-brand-200">
                          <WalletCards size={15} />
                          {booking.status === 'completed' && Number(booking.amount) > 0
                            ? formatCurrency(booking.amount)
                            : 'Final charge pending'}
                        </span>
                      </div>

                      <ServiceRequestMap
                        center={booking.coordinates}
                        title="Client destination"
                        subtitle={destinationDetails.secondary || destinationDetails.primary}
                        centerLabel="Client location"
                        directionsUrl={buildDirectionsUrl(booking)}
                        className="mt-4 !min-h-[280px] rounded-[24px] sm:!min-h-[320px]"
                      />

                      <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                        <Button
                          as="a"
                          href={buildDirectionsUrl(booking)}
                          target="_blank"
                          rel="noreferrer"
                          size="sm"
                          className="w-full sm:w-auto"
                        >
                          <Navigation size={15} />
                          Open directions
                        </Button>
                        <Button
                          as="a"
                          href={booking.clientPhoneNumber ? `tel:${booking.clientPhoneNumber}` : undefined}
                          size="sm"
                          variant="outline"
                          className={`w-full sm:w-auto ${
                            !booking.clientPhoneNumber ? 'pointer-events-none opacity-60' : ''
                          }`}
                        >
                          <Phone size={15} />
                          Call client
                        </Button>
                        <Button
                          as={Link}
                          to="/chat"
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => handleOpenClientChat(booking)}
                        >
                          <MessageCircle size={15} />
                          Chat
                        </Button>
                      </div>

                      {booking.status === 'accepted' ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                          <InputField
                            label="Client start OTP"
                            inputMode="numeric"
                            maxLength="6"
                            value={otpValues[booking.id] ?? ''}
                            onChange={(event) => handleOtpChange(booking.id, event.target.value)}
                            placeholder="6-digit OTP"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-11"
                            disabled={startingBookingId === booking.id}
                            onClick={() => handleStartWork(booking)}
                          >
                            {startingBookingId === booking.id ? 'Verifying...' : 'Start work'}
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                            <div>
                              <p className="text-sm font-semibold text-amber-950">Labour marked busy</p>
                              <p className="mt-1 text-xs font-medium leading-5 text-amber-900">
                                Tap work finished after the job is done. The client will enter the paid amount and close the service.
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              disabled={completingBookingId === booking.id}
                              className="h-11 w-full lg:w-auto"
                              onClick={() => handleCompleteWork(booking)}
                            >
                              {completingBookingId === booking.id ? 'Updating...' : 'Work finished'}
                            </Button>
                          </div>
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <Card>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Incoming job requests</h2>
                <div className="mt-5 space-y-4">
                  {bookings.filter((item) => item.status === 'pending').length ? (
                    bookings
                      .filter((item) => item.status === 'pending')
                      .map((booking) => (
                        <div key={booking.id} className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800/50">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                              <h3 className="font-semibold text-slate-950 dark:text-white">
                                {booking.serviceType}
                              </h3>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {booking.clientName}
                              </p>
                            </div>
                            <Badge tone="amber">Pending</Badge>
                          </div>
                          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                            {formatDate(booking.appointmentAt)}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-brand-700 dark:text-brand-200">
                            Client adds the paid amount after you finish the work.
                          </p>
                          {booking.serviceDetails ? (
                            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                              {booking.serviceDetails}
                            </p>
                          ) : null}
                          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                            <p className="font-semibold text-slate-950">Location unlocks after acceptance</p>
                            <p className="mt-2 text-slate-500">
                              Accept to view the route and start OTP.
                            </p>
                          </div>
                          <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap">
                            <Button
                              size="sm"
                              className="w-full sm:w-auto"
                              disabled={Boolean(inProgressBooking)}
                              onClick={() => handleBookingDecision(booking, 'accepted')}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto"
                              onClick={() => handleBookingDecision(booking, 'rejected')}
                            >
                              Reject
                            </Button>
                            <Button
                              as="a"
                              href={booking.clientPhoneNumber ? `tel:${booking.clientPhoneNumber}` : undefined}
                              size="sm"
                              variant="outline"
                              className={`w-full sm:w-auto ${
                                !booking.clientPhoneNumber ? 'pointer-events-none opacity-60' : ''
                              }`}
                            >
                              <Phone size={15} />
                              Call client
                            </Button>
                            <Button
                              as={Link}
                              to="/chat"
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto"
                              onClick={() => handleOpenClientChat(booking)}
                            >
                              <MessageCircle size={15} />
                              Chat
                            </Button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      New client requests will show up here in real time.
                    </p>
                  )}
                </div>
              </Card>

              <Card id="labour-earnings" className="scroll-mt-28">
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Financial overview</h2>
                <div className="mt-5 space-y-4">
                  {financialSummary.map((item) => (
                    <div key={item.label} className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800/50">
                      <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  {bookings.filter((item) => ['awaiting_payment', 'completed'].includes(item.status)).length ? (
                    bookings
                      .filter((item) => ['awaiting_payment', 'completed'].includes(item.status))
                      .slice(0, 6)
                      .map((booking) => (
                        <div key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-950">{booking.clientName || 'Client'}</p>
                              <p className="mt-1 text-sm text-slate-600">{booking.serviceType}</p>
                            </div>
                            <Badge tone={booking.paymentStatus === 'paid' ? 'emerald' : 'amber'}>
                              {booking.paymentStatus === 'paid' ? 'Paid' : 'Awaiting client'}
                            </Badge>
                          </div>
                          <p className="mt-3 text-lg font-bold text-slate-950">
                            {Number(booking.amount) > 0 ? formatCurrency(booking.amount) : 'Amount pending'}
                          </p>
                        </div>
                      ))
                  ) : (
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      Completed work earnings will appear here with client names and payment status.
                    </p>
                  )}
                </div>
              </Card>
            </div>

            <Card id="labour-profile" className="scroll-mt-28">
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Reviews & work proof</h2>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {(dashboardProfile.reviews ?? []).map((review) => (
                  <div key={review.id} className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800/50">
                    <p className="font-semibold text-slate-950 dark:text-white">{review.clientName}</p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{review.comment}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>
    </AppShell>
  );
};

export default LabourDashboardPage;
