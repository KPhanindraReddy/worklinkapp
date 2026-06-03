import {
  CalendarClock,
  ClipboardList,
  Clock3,
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
import { MetricsGrid } from '../../components/dashboard/MetricsGrid';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import {
  completeBookingWork,
  startBookingWork,
  subscribeBookingsForUser,
  updateBookingStatus
} from '../../services/bookingService';
import { ensureConversation } from '../../services/chatService';
import { createNotification } from '../../services/notificationService';
import { formatDate, parseDateValue } from '../../utils/formatters';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import { getDisplayLocationText } from '../../utils/location';

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

    setLoading(true);
    return subscribeBookingsForUser(
      { userId: currentUser.uid, role: 'labour' },
      (nextBookings) => {
        setBookings(nextBookings);
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
      { label: 'Pending now', value: pendingBookings.length },
      { label: 'Scheduled', value: scheduledBookings.filter((item) => item.status === 'accepted').length },
      { label: 'In progress', value: scheduledBookings.filter((item) => item.status === 'in_progress').length },
      { label: 'Awaiting payment', value: scheduledBookings.filter((item) => item.status === 'awaiting_payment').length }
    ],
    [pendingBookings.length, scheduledBookings]
  );

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
            title: status === 'accepted' ? 'Service request accepted' : 'Service request rejected',
            body:
              status === 'accepted'
                ? `${profileName} accepted your ${booking.serviceType} request.`
                : `${profileName} rejected your ${booking.serviceType} request.`,
            type: 'booking',
            bookingId: booking.id
          });
        } catch (notificationError) {
          console.warn('WorkLink notification delivery skipped:', notificationError);
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
            body: `${profileName} finished your ${booking.serviceType}. Enter the paid amount to complete the service.`,
            type: 'booking',
            bookingId: booking.id
          });
        } catch (notificationError) {
          console.warn('WorkLink notification delivery skipped:', notificationError);
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
      <PageSEO title="Labour Services" description="Manage pending and scheduled WorkLink service requests." />

      <section className="section-space">
        <div className="page-shell space-y-5">
          <Card className="rounded-[28px] p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="blue">Labour</Badge>
                  <Badge tone={dateFilter ? 'emerald' : 'slate'}>
                    {dateFilter ? `Filtered: ${dateFilter}` : 'All dates'}
                  </Badge>
                </div>
                <h1 className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">
                  Services
                </h1>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  Pending requests and scheduled jobs are managed here.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end lg:min-w-[24rem]">
                <InputField
                  label="Filter by date"
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-11"
                  onClick={() => setDateFilter('')}
                  disabled={!dateFilter}
                >
                  Clear
                </Button>
              </div>
            </div>
          </Card>

          <MetricsGrid items={metrics} loading={loading} />

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <Card className="rounded-[24px] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Pending now</h2>
                  <p className="mt-1 text-sm text-slate-600">Accept or reject new client requests.</p>
                </div>
                <Badge tone={pendingBookings.length ? 'amber' : 'slate'}>
                  {pendingBookings.length} pending
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <>
                    <Skeleton className="h-28 w-full rounded-2xl" />
                    <Skeleton className="h-28 w-full rounded-2xl" />
                  </>
                ) : pendingBookings.length ? (
                  pendingBookings.map((booking) => (
                    <div key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-950">{booking.serviceType}</h3>
                          <p className="mt-1 break-words text-sm text-slate-600">
                            {booking.clientName || 'Client'}
                          </p>
                        </div>
                        <Badge tone="amber">Pending</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-2">
                          <CalendarClock size={15} />
                          {formatDate(booking.appointmentAt)}
                        </span>
                        <span className="inline-flex items-center gap-2 font-semibold text-brand-700">
                          <WalletCards size={15} />
                          Client enters paid amount after work
                        </span>
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
                      </div>
                    </div>
                  ))
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
                  <p className="mt-1 text-sm text-slate-600">Directions, OTP, and finish action stay here.</p>
                </div>
                <Badge tone={scheduledBookings.length ? 'emerald' : 'slate'}>
                  {scheduledBookings.length} scheduled
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <>
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                  </>
                ) : scheduledBookings.length ? (
                  scheduledBookings.map((booking) => (
                    <div key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-950">{booking.clientName || 'Client'}</h3>
                          <p className="mt-1 break-words text-sm text-slate-600">
                            {booking.serviceType} - {getDisplayLocationText(booking.location, 'Live location shared')}
                          </p>
                        </div>
                        <Badge tone={getStatusTone(booking.status)}>
                          {formatStatusLabel(booking.status)}
                        </Badge>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-2">
                          <Clock3 size={15} />
                          {formatDate(booking.appointmentAt)}
                        </span>
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
                          to={`/chat?target=${encodeURIComponent(booking.clientId)}&booking=${encodeURIComponent(booking.id)}`}
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
                        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
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
                            className={`h-11 w-full sm:w-auto ${actionButtonClass}`}
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
                  ))
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
