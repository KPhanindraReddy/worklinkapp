import {
  CalendarClock,
  ClipboardList,
  Clock3,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
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
import { LocationText } from '../../components/location/LocationText';
import { useAuth } from '../../context/AuthContext';
import {
  completeBookingWork,
  startBookingWork,
  subscribeBookingsForUser,
  updateBookingStatus
} from '../../services/bookingService';
import { ensureConversation } from '../../services/chatService';
import { createNotification } from '../../services/notificationService';
import { formatCurrency, formatDate, parseDateValue } from '../../utils/formatters';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';

const getDateKey = (value) => {
  const date = parseDateValue(value);

  if (!date) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
};

const getStatusTone = (status) => {
  if (status === 'pending') {
    return 'amber';
  }

  if (status === 'accepted') {
    return 'emerald';
  }

  if (status === 'in_progress') {
    return 'blue';
  }

  if (status === 'awaiting_payment') {
    return 'amber';
  }

  return 'slate';
};

const formatStatusLabel = (status) =>
  String(status || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildDirectionsUrl = (booking) => {
  const coordinates = booking.coordinates;

  if (coordinates?.latitude != null && coordinates?.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coordinates.latitude},${coordinates.longitude}&travelmode=driving`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.location || '')}`;
};

const actionButtonClass = 'bg-slate-950 text-white shadow-sm hover:bg-slate-800';
const metricBoxClasses = [
  'border-amber-300 text-amber-800',
  'border-sky-300 text-sky-800',
  'border-blue-300 text-blue-800',
  'border-emerald-300 text-emerald-800'
];
const LABOUR_SERVICES_CACHE_KEY_PREFIX = 'slivz.labourServices.bookings';

const getLabourServicesCacheKey = (userId) => `${LABOUR_SERVICES_CACHE_KEY_PREFIX}.${userId || 'guest'}`;

const readCachedLabourServices = (userId) => {
  if (typeof window === 'undefined' || !userId) {
    return [];
  }

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(getLabourServicesCacheKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCachedLabourServices = (userId, nextBookings) => {
  if (typeof window === 'undefined' || !userId) {
    return;
  }

  try {
    window.sessionStorage.setItem(getLabourServicesCacheKey(userId), JSON.stringify(nextBookings));
  } catch {
    // Session storage can be unavailable in private or restricted browser modes.
  }
};

const LabourServicesPage = () => {
  const { currentUser, userProfile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [otpValues, setOtpValues] = useState({});
  const [decisionBookingId, setDecisionBookingId] = useState('');
  const [startingBookingId, setStartingBookingId] = useState('');
  const [completingBookingId, setCompletingBookingId] = useState('');

  useEffect(() => {
    if (!currentUser?.uid) {
      setBookings([]);
      setLoading(false);
      return undefined;
    }

    const cachedBookings = readCachedLabourServices(currentUser.uid);
    setBookings(cachedBookings);

    setLoading(true);
    return subscribeBookingsForUser(
      { userId: currentUser.uid, role: 'labour' },
      (nextBookings) => {
        setBookings(nextBookings);
        writeCachedLabourServices(currentUser.uid, nextBookings);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        toast.error(getFirebaseErrorMessage(error));
      }
    );
  }, [currentUser?.uid]);

  const filteredBookings = useMemo(
    () =>
      dateFilter
        ? bookings.filter((booking) => getDateKey(booking.appointmentAt) === dateFilter)
        : bookings,
    [bookings, dateFilter]
  );
  const pendingBookings = useMemo(
    () => filteredBookings.filter((booking) => booking.status === 'pending'),
    [filteredBookings]
  );
  const scheduledBookings = useMemo(
    () =>
      filteredBookings
        .filter((booking) => ['accepted', 'in_progress', 'awaiting_payment'].includes(booking.status))
        .sort((a, b) => {
          const dateA = parseDateValue(a.appointmentAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const dateB = parseDateValue(b.appointmentAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;

          return dateA - dateB;
        }),
    [filteredBookings]
  );
  const inProgressBooking = useMemo(
    () => bookings.find((booking) => booking.status === 'in_progress') ?? null,
    [bookings]
  );
  const metrics = useMemo(
    () => [
      { label: 'Pending', value: pendingBookings.length },
      { label: 'Scheduled', value: scheduledBookings.filter((item) => item.status === 'accepted').length },
      { label: 'In progress', value: scheduledBookings.filter((item) => item.status === 'in_progress').length },
      { label: 'Awaiting', value: scheduledBookings.filter((item) => item.status === 'awaiting_payment').length }
    ],
    [pendingBookings.length, scheduledBookings]
  );
  const showLoadingPlaceholders = loading && bookings.length === 0;

  const profileName = userProfile?.fullName || currentUser?.displayName || 'Labour';
  const profilePhone = userProfile?.phoneNumber || currentUser?.phoneNumber || '';

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
            fullName: profileName,
            role: 'labour',
            phoneNumber: profilePhone
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

    setDecisionBookingId(booking.id);

    try {
      await updateBookingStatus(booking.id, status);

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
          console.warn('Slivz notification delivery skipped:', notificationError);
        }
      }

      toast.success(status === 'accepted' ? 'Request accepted.' : 'Request rejected.');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setDecisionBookingId('');
    }
  };

  const handleOtpChange = (bookingId, value) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setOtpValues((prev) => ({ ...prev, [bookingId]: numericValue }));
  };

  const handleStartWork = async (booking) => {
    const otp = otpValues[booking.id]?.trim();

    if (!/^\d{6}$/.test(otp || '')) {
      toast.error('Enter the 6-digit OTP from the client.');
      return;
    }

    setStartingBookingId(booking.id);

    try {
      await startBookingWork({ bookingId: booking.id, labourId: currentUser.uid, otp });
      setOtpValues((prev) => ({ ...prev, [booking.id]: '' }));
      toast.success('OTP verified. Work started.');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setStartingBookingId('');
    }
  };

  const handleCompleteWork = async (booking) => {
    setCompletingBookingId(booking.id);

    try {
      await completeBookingWork({ bookingId: booking.id, labourId: currentUser.uid });

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
          console.warn('Slivz notification delivery skipped:', notificationError);
        }
      }

      toast.success('Work marked finished. Waiting for client amount.');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setCompletingBookingId('');
    }
  };

  return (
    <AppShell>
      <PageSEO title="Labour Services" description="Manage pending and scheduled Slivz service requests." />

      <section className="section-space">
        <div className="page-shell space-y-5">
          <Card className="rounded-[24px] p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Services</h1>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:w-[18rem]">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="min-h-10 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 max-sm:text-base"
                  aria-label="Filter by date"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-10 px-3"
                  onClick={() => setDateFilter('')}
                  disabled={!dateFilter}
                >
                  All
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {metrics.map((item, index) => (
              <div
                key={item.label}
                className={`rounded-xl border-2 bg-white p-2 text-center shadow-sm sm:p-2.5 ${metricBoxClasses[index]}`}
              >
                <p className="truncate text-[9px] font-black uppercase tracking-[0.06em] sm:text-[10px]">{item.label}</p>
                {showLoadingPlaceholders ? (
                  <Skeleton className="mx-auto mt-1.5 h-6 w-8 rounded-lg" />
                ) : (
                  <p className="mt-1 font-display text-xl font-black leading-none sm:text-2xl">{item.value}</p>
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <Card className="rounded-[24px] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Pending now</h2>
                </div>
                <Badge tone={pendingBookings.length ? 'amber' : 'slate'}>
                  {pendingBookings.length} pending
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {showLoadingPlaceholders ? (
                  <>
                    <Skeleton className="h-28 w-full rounded-2xl" />
                    <Skeleton className="h-28 w-full rounded-2xl" />
                  </>
                ) : pendingBookings.length ? (
                  <>
                    <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 md:grid md:grid-cols-[1fr_1fr_0.8fr_0.9fr_0.7fr] md:gap-3">
                      <span>Name</span>
                      <span>Service</span>
                      <span>Time</span>
                      <span>Money</span>
                      <span>Status</span>
                    </div>
                    {pendingBookings.map((booking) => (
                      <div key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_0.8fr_0.9fr_0.7fr] md:items-center">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Name</p>
                            <h3 className="truncate font-semibold text-slate-950">{booking.clientName || 'Client'}</h3>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Service</p>
                            <p className="truncate text-sm font-semibold text-slate-800">{booking.serviceType}</p>
                            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                              <MapPin size={13} className="flex-none" />
                              <span className="truncate">
                                <LocationText
                                  location={booking.location}
                                  coordinates={booking.coordinates}
                                  fallback="Live location shared"
                                />
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Time</p>
                            <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                              <CalendarClock size={15} />
                              {formatDate(booking.appointmentAt)}
                            </span>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Money</p>
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                              <WalletCards size={15} />
                              After work
                            </span>
                          </div>
                          <div className="flex justify-start md:justify-end">
                            <Badge tone="amber">Pending</Badge>
                          </div>
                        </div>
                      {booking.serviceDetails ? (
                        <p className="mt-3 text-sm leading-6 text-slate-600">{booking.serviceDetails}</p>
                      ) : null}
                      <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                        <Button
                          type="button"
                          size="sm"
                          className={`w-full sm:w-auto ${actionButtonClass}`}
                          disabled={decisionBookingId === booking.id || Boolean(inProgressBooking)}
                          onClick={() => handleBookingDecision(booking, 'accepted')}
                        >
                          {decisionBookingId === booking.id ? 'Updating...' : 'Accept'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          disabled={decisionBookingId === booking.id}
                          onClick={() => handleBookingDecision(booking, 'rejected')}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                    ))}
                  </>
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                    No pending requests for this date.
                  </p>
                )}
              </div>
            </Card>

            <Card className="rounded-[24px] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Scheduled services</h2>
                </div>
                <Badge tone={scheduledBookings.length ? 'emerald' : 'slate'}>
                  {scheduledBookings.length} scheduled
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {showLoadingPlaceholders ? (
                  <>
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                  </>
                ) : scheduledBookings.length ? (
                  <>
                    <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 md:grid md:grid-cols-[1fr_1fr_0.8fr_0.9fr_0.8fr] md:gap-3">
                      <span>Name</span>
                      <span>Service</span>
                      <span>Time</span>
                      <span>Money</span>
                      <span>Status</span>
                    </div>
                    {scheduledBookings.map((booking) => {
                      const contactUnlocked = ['accepted', 'in_progress', 'awaiting_payment'].includes(booking.status);

                      return (
                      <div key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_0.8fr_0.9fr_0.8fr] md:items-center">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Name</p>
                            <h3 className="truncate font-semibold text-slate-950">{booking.clientName || 'Client'}</h3>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Service</p>
                            <p className="truncate text-sm font-semibold text-slate-800">{booking.serviceType}</p>
                            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                              <MapPin size={13} className="flex-none" />
                              <span className="truncate">
                                <LocationText
                                  location={booking.location}
                                  coordinates={booking.coordinates}
                                  fallback="Live location shared"
                                />
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Time</p>
                            <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                              <Clock3 size={15} />
                              {formatDate(booking.appointmentAt)}
                            </span>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Money</p>
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                              <WalletCards size={15} />
                              {booking.paymentStatus === 'paid' && Number(booking.amount) > 0
                                ? formatCurrency(booking.amount)
                                : booking.status === 'awaiting_payment'
                                  ? 'Waiting'
                                  : 'After work'}
                            </span>
                          </div>
                          <div className="flex justify-start md:justify-end">
                            <Badge tone={getStatusTone(booking.status)}>
                              {formatStatusLabel(booking.status)}
                            </Badge>
                          </div>
                        </div>

                      <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                        {['accepted', 'in_progress'].includes(booking.status) ? (
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
                        ) : null}
                        <Button
                          as="a"
                          href={contactUnlocked && booking.clientPhoneNumber ? `tel:${booking.clientPhoneNumber}` : undefined}
                          size="sm"
                          variant="outline"
                          className={`w-full sm:w-auto ${
                            !contactUnlocked || !booking.clientPhoneNumber ? 'pointer-events-none opacity-60' : ''
                          }`}
                        >
                          <Phone size={15} />
                          Call
                        </Button>
                        <Button
                          as={contactUnlocked ? Link : 'button'}
                          to={contactUnlocked ? `/chat?target=${encodeURIComponent(booking.clientId)}&booking=${encodeURIComponent(booking.id)}` : undefined}
                          type={contactUnlocked ? undefined : 'button'}
                          size="sm"
                          variant="outline"
                          className={`w-full sm:w-auto ${!contactUnlocked ? 'pointer-events-none opacity-60' : ''}`}
                          onClick={() => contactUnlocked && handleOpenClientChat(booking)}
                        >
                          <MessageCircle size={15} />
                          Chat
                        </Button>
                      </div>

                      {booking.status === 'accepted' ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
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
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                            <p className="text-sm font-semibold text-amber-950">
                              Mark finished only after the work is done.
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              className={`w-full sm:w-auto ${actionButtonClass}`}
                              disabled={completingBookingId === booking.id}
                              onClick={() => handleCompleteWork(booking)}
                            >
                              {completingBookingId === booking.id ? 'Updating...' : 'Work finished'}
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {booking.status === 'awaiting_payment' ? (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
                          Waiting for the client to enter the paid amount.
                        </div>
                      ) : null}
                    </div>
                      );
                    })}
                  </>
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                    No scheduled services for this date.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </section>
    </AppShell>
  );
};

export default LabourServicesPage;
