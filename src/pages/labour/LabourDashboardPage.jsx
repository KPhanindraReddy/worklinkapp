import {
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  House,
  IndianRupee,
  CalendarClock,
  MessageCircle,
  Navigation,
  Phone,
  UserRound,
  WalletCards
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { InputField } from '../../components/common/InputField';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';
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
import { syncLabourCompletedJobs } from '../../services/labourSyncService';
import { formatCurrency, formatDate, parseDateValue } from '../../utils/formatters';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import { getDisplayLocationText, getLocationLabel } from '../../utils/location';
import { buildProfileAvatarDataUrl } from '../../utils/profileAvatar';

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
    profilePhoto: userProfile?.profilePhoto || buildProfileAvatarDataUrl(fullName),
    phoneNumber: userProfile?.phoneNumber || currentUser?.phoneNumber || '',
    availability: userProfile?.availability || 'Available',
    rating: Number(userProfile?.rating) || 0,
    reviewsCount: Number(userProfile?.reviewsCount) || 0,
    dailyWage: Number(userProfile?.dailyWage) || 0,
    completedJobs: Number(userProfile?.completedJobs) || 0,
    reviews: []
  };
};

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
    <div className="rounded-[18px] border border-slate-200 bg-white p-3.5 sm:p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">{label}</p>
      <p className={`mt-2 text-3xl font-bold leading-none sm:mt-2.5 sm:text-3xl ${toneClass}`}>{value}</p>
    </div>
  );
};

const EmptyDashed = ({ children }) => (
  <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm font-medium text-slate-300 sm:py-8 sm:text-base">
    {children}
  </div>
);

const actionButtonClass = 'bg-slate-950 text-white shadow-sm hover:bg-slate-800';

const LabourDashboardPage = () => {
  const { currentUser, userProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [otpValues, setOtpValues] = useState({});
  const [startingBookingId, setStartingBookingId] = useState('');
  const [completingBookingId, setCompletingBookingId] = useState('');
  const completedJobsSyncInFlight = useRef(false);

  const ownProfile = useMemo(
    () => buildOwnLabourProfile({ currentUser, userProfile }),
    [
      currentUser?.displayName,
      currentUser?.phoneNumber,
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
      resolvedDashboardLocationName ||
      getLocationLabel(dashboardProfile, {
        preferCurrent: true,
        fallback: 'Location not set'
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
  const paidBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'completed' && booking.paymentStatus === 'paid'),
    [bookings]
  );
  const completedJobs = paidBookings.length;

  useEffect(() => {
    if (
      !currentUser?.uid ||
      userProfile?.role !== 'labour' ||
      !profile ||
      completedJobsSyncInFlight.current
    ) {
      return undefined;
    }

    const profileCompletedJobs = Number(profile.completedJobs) || 0;
    if (profileCompletedJobs === completedJobs) {
      return undefined;
    }

    completedJobsSyncInFlight.current = true;

    syncLabourCompletedJobs(currentUser.uid)
      .catch((error) => {
        console.warn('Slivz completed jobs sync skipped:', error);
      })
      .finally(() => {
        completedJobsSyncInFlight.current = false;
      });

    return undefined;
  }, [completedJobs, currentUser?.uid, profile, userProfile?.role]);

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
          bookingId: booking.id,
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
            title: status === 'accepted' ? 'Accepted' : 'Rejected',
            body: booking.serviceType,
            type: 'booking',
            bookingId: booking.id
          });
        } catch (notificationError) {
          notificationDelivered = false;
          console.warn('Slivz notification delivery skipped:', notificationError);
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
            body: booking.serviceType,
            type: 'booking',
            bookingId: booking.id
          });
        } catch (notificationError) {
          notificationDelivered = false;
          console.warn('Slivz notification delivery skipped:', notificationError);
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
            body: booking.serviceType,
            type: 'booking',
            bookingId: booking.id
          });
        } catch (notificationError) {
          notificationDelivered = false;
          console.warn('Slivz notification delivery skipped:', notificationError);
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

  const pendingRequests = bookings.filter((item) => item.status === 'pending').length;
  const todaySummary = financialSummary.find((item) => item.label === 'Today earned')?.value ?? formatCurrency(0);
  const paidSummary = financialSummary.find((item) => item.label === 'Paid earnings')?.value ?? formatCurrency(0);
  const totalSummary = financialSummary.find((item) => item.label === 'Total completed')?.value ?? formatCurrency(0);
  const paymentBookings = bookings.filter((item) => ['awaiting_payment', 'completed'].includes(item.status));

  return (
    <AppShell hideFooter>
      <PageSEO title="Labour Dashboard" description="Manage your labour profile, availability, bookings, work history, and earnings." />

      <section className="bg-slate-100/80 pb-5 pt-4 sm:py-6">
        <div className="page-shell max-w-4xl space-y-3.5 sm:space-y-4">
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

          <LightPanel id="labour-home" className="p-3.5 sm:p-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <img
                src={dashboardProfile.profilePhoto}
                alt={dashboardProfile.fullName}
                width="72"
                height="72"
                loading="eager"
                decoding="sync"
                className="h-16 w-16 flex-none rounded-[18px] object-cover sm:h-[4.5rem] sm:w-[4.5rem] sm:rounded-[20px]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-bold text-slate-950 sm:text-2xl">
                      {dashboardProfile.fullName}
                    </h1>
                  </div>
                  <Badge tone={dashboardProfile.availability === 'Available' ? 'emerald' : 'amber'} className="mt-1">
                    {updatingAvailability ? 'Updating' : dashboardProfile.availability}
                  </Badge>
                </div>
                <p className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 sm:mt-4 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm">
                  <span className="flex-none text-rose-500" aria-hidden="true">📍</span>
                  <span className="truncate">{dashboardLocationLabel}</span>
                </p>
              </div>
            </div>
          </LightPanel>

          <div className="grid grid-cols-2 gap-3">
            <DashboardMetric label="Completed jobs" value={completedJobs} tone="emerald" />
            <DashboardMetric label="Pending" value={pendingRequests} tone="blue" />
          </div>

          <LightPanel>
            <h2 className="text-xl font-bold text-slate-950 sm:text-[1.35rem]">Availability</h2>
            <div className="mt-4 sm:mt-5">
              <AvailabilityToggle value={dashboardProfile.availability} onChange={handleAvailabilityChange} />
            </div>
          </LightPanel>

          <LightPanel id="labour-requests">
            <h2 className="text-xl font-bold text-slate-950 sm:text-[1.35rem]">Scheduled clients</h2>
            <div className="mt-5 space-y-3">
              {scheduledClientBookings.length ? (
                scheduledClientBookings.map((booking) => {
                  const routeUnlocked = ['accepted', 'in_progress'].includes(booking.status);
                  const contactUnlocked = ['accepted', 'in_progress', 'awaiting_payment'].includes(booking.status);

                  return (
                    <div key={booking.id} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <ProfileAvatar
                            src={booking.clientProfilePhoto}
                            name={booking.clientName}
                            className="h-12 w-12 rounded-xl"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-base font-bold text-slate-950 sm:text-lg">{booking.clientName}</p>
                            <p className="mt-1 text-sm font-medium text-slate-500">{booking.serviceType}</p>
                            <p className="mt-2 text-sm text-slate-500">{formatDate(booking.appointmentAt)}</p>
                          </div>
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
                            <Button size="sm" className={`w-full sm:w-auto ${actionButtonClass}`} disabled={Boolean(inProgressBooking)} onClick={() => handleBookingDecision(booking, 'accepted')}>
                              Accept
                            </Button>
                            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => handleBookingDecision(booking, 'rejected')}>
                              Reject
                            </Button>
                          </>
                        )}
                        <Button as="a" href={contactUnlocked && booking.clientPhoneNumber ? `tel:${booking.clientPhoneNumber}` : undefined} size="sm" variant="outline" className={`w-full sm:w-auto ${!contactUnlocked || !booking.clientPhoneNumber ? 'pointer-events-none opacity-60' : ''}`}>
                          <Phone size={15} />
                          Call
                        </Button>
                        <Button as={contactUnlocked ? Link : 'button'} to={contactUnlocked ? `/chat?target=${encodeURIComponent(booking.clientId)}&booking=${encodeURIComponent(booking.id)}` : undefined} type={contactUnlocked ? undefined : 'button'} size="sm" variant="outline" className={`w-full sm:w-auto ${!contactUnlocked ? 'pointer-events-none opacity-60' : ''}`} onClick={() => contactUnlocked && handleOpenClientChat(booking)}>
                          <MessageCircle size={15} />
                          Chat
                        </Button>
                      </div>
                      {booking.status === 'accepted' ? (
                        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <InputField
                            label="Client start OTP"
                            inputMode="numeric"
                            maxLength="6"
                            value={otpValues[booking.id] ?? ''}
                            onChange={(event) => handleOtpChange(booking.id, event.target.value)}
                            placeholder="6-digit OTP"
                            inputClassName="border-2 border-brand-300 bg-white font-bold tracking-[0.18em] text-brand-950 focus:border-brand-500 focus:ring-brand-100"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className={`h-11 w-full border-2 border-brand-500 sm:w-auto ${actionButtonClass}`}
                            disabled={startingBookingId === booking.id}
                            onClick={() => handleStartWork(booking)}
                          >
                            {startingBookingId === booking.id ? 'Verifying...' : 'Start work'}
                          </Button>
                        </div>
                      ) : null}
                      {booking.status === 'in_progress' ? (
                        <Button
                          type="button"
                          size="sm"
                          className={`mt-4 h-11 w-full ${actionButtonClass}`}
                          disabled={completingBookingId === booking.id}
                          onClick={() => handleCompleteWork(booking)}
                        >
                          {completingBookingId === booking.id ? 'Updating...' : 'Work finished'}
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <EmptyDashed>No schedule yet</EmptyDashed>
              )}
            </div>
          </LightPanel>

          <LightPanel id="labour-earnings">
            <h2 className="text-xl font-bold text-slate-950 sm:text-[1.35rem]">Financial overview</h2>
            <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-4">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Today</p>
                <p className="mt-3 text-lg font-bold text-emerald-600 sm:text-2xl">{todaySummary}</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Paid</p>
                <p className="mt-3 text-lg font-bold text-slate-950 sm:text-2xl">{paidSummary}</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Total</p>
                <p className="mt-3 text-lg font-bold text-slate-950 sm:text-2xl">{totalSummary}</p>
              </div>
            </div>
          </LightPanel>

          <LightPanel>
            <h2 className="text-xl font-bold text-slate-950 sm:text-[1.35rem]">Active work</h2>
            <div className="mt-4 divide-y divide-slate-100 sm:mt-5">
              {paymentBookings.length || activeWorkBookings.length ? (
                [...activeWorkBookings, ...paymentBookings]
                  .filter((booking, index, items) => items.findIndex((item) => item.id === booking.id) === index)
                  .slice(0, 6)
                  .map((booking) => (
                    <div key={booking.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0 sm:py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProfileAvatar
                          src={booking.clientProfilePhoto}
                          name={booking.clientName}
                          className="h-11 w-11 rounded-xl sm:h-14 sm:w-14 sm:rounded-2xl"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-base font-bold text-slate-950 sm:text-lg">{booking.clientName || 'Client'}</span>
                          <span className="mt-0.5 block truncate text-sm text-slate-500 sm:mt-1 sm:text-base">{booking.serviceType}</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-slate-950 sm:text-lg">
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
                            inputClassName="border-2 border-brand-300 bg-white font-bold tracking-[0.18em] text-brand-950 focus:border-brand-500 focus:ring-brand-100"
                          />
                          <Button type="button" size="sm" className={`h-11 border-2 border-brand-500 ${actionButtonClass}`} disabled={startingBookingId === booking.id} onClick={() => handleStartWork(booking)}>
                            {startingBookingId === booking.id ? 'Verifying...' : 'Start work'}
                          </Button>
                        </div>
                      ) : booking.status === 'in_progress' ? (
                        <Button type="button" size="sm" className={`col-span-2 h-11 ${actionButtonClass}`} disabled={completingBookingId === booking.id} onClick={() => handleCompleteWork(booking)}>
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

        </div>
      </section>
    </AppShell>
  );

};

export default LabourDashboardPage;
