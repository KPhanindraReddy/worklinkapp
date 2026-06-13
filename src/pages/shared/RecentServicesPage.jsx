import { CalendarClock, Clock3, MapPin, Star, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { InputField } from '../../components/common/InputField';
import { PageSEO } from '../../components/common/PageSEO';
import { Skeleton } from '../../components/common/Skeleton';
import { AppShell } from '../../components/layout/AppShell';
import { LocationText } from '../../components/location/LocationText';
import { useAuth } from '../../context/AuthContext';
import {
  completeClientPayment,
  subscribeBookingsForUser,
  updateBookingStatus
} from '../../services/bookingService';
import { submitServiceReview } from '../../services/reviewService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';

const getBookingRowTone = (status) => {
  if (status === 'completed') {
    return 'border-emerald-200 bg-emerald-50/70';
  }

  if (['rejected', 'timed_out'].includes(status)) {
    return 'border-rose-200 bg-rose-50/70';
  }

  if (['cancelled', 'awaiting_payment', 'pending'].includes(status)) {
    return 'border-amber-200 bg-amber-50/70';
  }

  if (['accepted', 'in_progress'].includes(status)) {
    return 'border-sky-200 bg-sky-50/70';
  }

  return 'border-slate-200 bg-white';
};

const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Done', value: 'done' }
];

const doneStatuses = ['completed'];
const pendingStatuses = ['pending', 'accepted', 'in_progress', 'awaiting_payment'];

const getStatusLabel = (status) => {
  if (status === 'completed') {
    return 'Done';
  }

  if (status === 'accepted') {
    return 'Accepted';
  }

  if (status === 'in_progress') {
    return 'Working';
  }

  if (status === 'awaiting_payment') {
    return 'Payment';
  }

  if (status === 'rejected') {
    return 'Rejected';
  }

  if (status === 'timed_out') {
    return 'Timed out';
  }

  if (status === 'cancelled') {
    return 'Cancelled';
  }

  return 'Pending';
};

const getStatusPillClass = (status) => {
  if (status === 'completed') {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (['rejected', 'timed_out', 'cancelled'].includes(status)) {
    return 'bg-rose-50 text-rose-700';
  }

  if (['accepted', 'in_progress'].includes(status)) {
    return 'bg-sky-50 text-sky-700';
  }

  return 'bg-amber-50 text-amber-700';
};

const getInitial = (value) =>
  String(value || 'S')
    .trim()
    .charAt(0)
    .toUpperCase() || 'S';

const getAvatarClass = (status) => {
  if (status === 'completed') {
    return 'bg-emerald-600';
  }

  if (['accepted', 'in_progress'].includes(status)) {
    return 'bg-brand-600';
  }

  if (['rejected', 'timed_out', 'cancelled'].includes(status)) {
    return 'bg-rose-600';
  }

  return 'bg-slate-900';
};

const RECENT_SERVICES_CACHE_KEY_PREFIX = 'slivz.recentServices.bookings';

const getRecentServicesCacheKey = (userId, role) =>
  `${RECENT_SERVICES_CACHE_KEY_PREFIX}.${role || 'user'}.${userId || 'guest'}`;

const readCachedRecentServices = (userId, role) => {
  if (typeof window === 'undefined' || !userId) {
    return [];
  }

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(getRecentServicesCacheKey(userId, role)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCachedRecentServices = (userId, role, nextBookings) => {
  if (typeof window === 'undefined' || !userId) {
    return;
  }

  try {
    window.sessionStorage.setItem(getRecentServicesCacheKey(userId, role), JSON.stringify(nextBookings));
  } catch {
    // Session storage can be unavailable in private or restricted browser modes.
  }
};

const StarRatingPicker = ({ value, onChange, disabled = false }) => {
  const selectedRating = Number(value || 0);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Service rating">
      {Array.from({ length: 5 }).map((_, index) => {
        const rating = index + 1;
        const isSelected = rating <= selectedRating;

        return (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={selectedRating === rating}
            aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
            disabled={disabled}
            onClick={() => onChange(String(rating))}
            className={clsx(
              'grid h-11 w-11 touch-manipulation place-items-center rounded-xl border text-amber-500 transition focus:outline-none focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-60',
              isSelected
                ? 'border-amber-300 bg-amber-50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/60'
            )}
          >
            <Star size={22} fill={isSelected ? 'currentColor' : 'none'} />
          </button>
        );
      })}
      {selectedRating ? (
        <span className="ml-1 text-sm font-bold text-amber-700">{selectedRating}/5</span>
      ) : null}
    </div>
  );
};

const RecentServicesPage = () => {
  const { currentUser, userProfile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [submittingReviewId, setSubmittingReviewId] = useState('');
  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [completingPaymentId, setCompletingPaymentId] = useState('');
  const [cancellingBookingId, setCancellingBookingId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const role = userProfile?.role === 'labour' ? 'labour' : 'client';
  const subjectLabel = role === 'labour' ? 'Client' : 'Worker';

  useEffect(() => {
    if (!currentUser?.uid) {
      setBookings([]);
      setBookingsLoading(false);
      return undefined;
    }

    const cachedBookings = readCachedRecentServices(currentUser.uid, role);
    setBookings(cachedBookings);

    setBookingsLoading(true);
    return subscribeBookingsForUser(
      { userId: currentUser.uid, role },
      (nextBookings) => {
        setBookings(nextBookings);
        writeCachedRecentServices(currentUser.uid, role, nextBookings);
        setBookingsLoading(false);
      },
      (error) => {
        setBookingsLoading(false);
        toast.error(getFirebaseErrorMessage(error));
      }
    );
  }, [currentUser?.uid, role]);
  const showLoadingPlaceholders = bookingsLoading && bookings.length === 0;
  const visibleBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        if (statusFilter === 'done') {
          return doneStatuses.includes(booking.status);
        }

        if (statusFilter === 'pending') {
          return pendingStatuses.includes(booking.status);
        }

        return true;
      }),
    [bookings, statusFilter]
  );

  const updateReviewDraft = (bookingId, key, value) =>
    setReviewDrafts((prev) => ({
      ...prev,
      [bookingId]: {
        ...(prev[bookingId] ?? {}),
        [key]: value
      }
    }));

  const handleSubmitReview = async (booking) => {
    const draft = reviewDrafts[booking.id] ?? {};

    if (!draft.rating) {
      toast.error('Choose a rating before submitting.');
      return;
    }

    setSubmittingReviewId(booking.id);

    try {
      await submitServiceReview({
        bookingId: booking.id,
        clientId: currentUser.uid,
        clientName: userProfile?.fullName,
        rating: draft.rating
      });
      setReviewDrafts((prev) => {
        const next = { ...prev };
        delete next[booking.id];
        return next;
      });
      toast.success('Thanks for rating this service.');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSubmittingReviewId('');
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
        title="Recent Services"
        description="View your recent service requests, completed work, and current booking status."
      />

      <section className="section-space">
        <div className="page-shell max-w-[560px] space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={clsx(
                  'h-9 min-w-20 rounded-full border px-4 text-xs font-extrabold transition',
                  statusFilter === option.value
                    ? 'border-slate-950 bg-slate-950 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-700'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {showLoadingPlaceholders ? (
            <div className="space-y-3">
              <Skeleton className="h-36 w-full rounded-2xl" />
              <Skeleton className="h-36 w-full rounded-2xl" />
            </div>
          ) : visibleBookings.length ? (
            <div className="space-y-3">
              {visibleBookings.map((booking) => {
                const subjectName = role === 'labour' ? booking.clientName || 'Client' : booking.labourName || 'Worker';
                const moneyLabel =
                  booking.status === 'completed' && Number(booking.amount) > 0
                    ? formatCurrency(booking.amount)
                    : booking.status === 'awaiting_payment'
                      ? 'Enter paid amount'
                      : 'Charge pending';

                return (
                <article
                  key={booking.id}
                  className={clsx(
                    'rounded-2xl border bg-white p-3 shadow-sm',
                    getBookingRowTone(booking.status)
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={clsx('grid h-10 w-10 flex-none place-items-center rounded-xl text-sm font-black text-white', getAvatarClass(booking.status))}>
                      {getInitial(subjectName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="truncate text-[15px] font-black leading-5 text-slate-950">{subjectName}</h2>
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                            {subjectLabel} · {booking.serviceType || 'Service'}
                          </p>
                        </div>
                        <span className={clsx('flex-none rounded-full px-2.5 py-1 text-[10px] font-extrabold', getStatusPillClass(booking.status))}>
                          {getStatusLabel(booking.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <p className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700">
                      <MapPin size={13} className="flex-none text-slate-400" />
                      <span className="truncate">
                        <LocationText
                          location={booking.location}
                          coordinates={booking.coordinates}
                          fallback="Location shared after confirmation"
                        />
                      </span>
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <CalendarClock size={13} className="flex-none text-slate-400" />
                      {formatDate(booking.appointmentAt)}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <Clock3 size={13} className="flex-none text-slate-400" />
                      {booking.requestMode === 'instant' ? 'Instant request' : 'Scheduled request'}
                    </p>
                  </div>

                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <p className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-slate-400">
                      <WalletCards size={14} />
                      {moneyLabel}
                    </p>
                  </div>

                  {role === 'client' && booking.status === 'awaiting_payment' ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-white/80 p-3">
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <InputField
                          label="Amount paid"
                          type="number"
                          min="1"
                          inputMode="decimal"
                          value={paymentAmounts[booking.id] ?? ''}
                          onChange={(event) => handlePaymentAmountChange(booking.id, event.target.value)}
                          placeholder="Enter amount"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-10 w-full bg-slate-950 text-white shadow-sm hover:bg-slate-800 sm:w-auto"
                          disabled={completingPaymentId === booking.id}
                          onClick={() => handleCompleteClientPayment(booking)}
                        >
                          {completingPaymentId === booking.id ? 'Completing...' : 'Complete service'}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {booking.serviceDetails ? (
                    <p className="mt-3 text-[13px] leading-6 text-slate-600">{booking.serviceDetails}</p>
                  ) : null}

                  {role === 'client' && ['pending', 'accepted'].includes(booking.status) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      className="mt-4 w-full sm:w-auto"
                      disabled={cancellingBookingId === booking.id}
                      onClick={() => handleCancelBooking(booking)}
                    >
                      {cancellingBookingId === booking.id ? 'Cancelling...' : 'Cancel request'}
                    </Button>
                  ) : null}

                  {booking.status === 'accepted' && booking.startOtp ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Start OTP
                      </p>
                      <p className="mt-2 text-lg font-bold text-slate-950">{booking.startOtp}</p>
                    </div>
                  ) : null}

                  {role === 'client' && booking.status === 'completed' ? (
                    booking.reviewRating ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-amber-800">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star
                              key={index}
                              size={16}
                              fill={index < Number(booking.reviewRating) ? 'currentColor' : 'none'}
                            />
                          ))}
                          Rated {booking.reviewRating}/5
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-950">Rate this service</p>
                        <StarRatingPicker
                          value={reviewDrafts[booking.id]?.rating ?? ''}
                          onChange={(rating) => updateReviewDraft(booking.id, 'rating', rating)}
                          disabled={submittingReviewId === booking.id}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="mt-3 min-h-10 w-full sm:w-auto"
                          disabled={submittingReviewId === booking.id}
                          onClick={() => handleSubmitReview(booking)}
                        >
                          {submittingReviewId === booking.id ? 'Submitting...' : 'Submit rating'}
                        </Button>
                      </div>
                    )
                  ) : null}
                </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={bookings.length ? 'No services in this filter' : 'No recent services yet'}
              description={bookings.length ? 'Try another status filter.' : 'Your latest service requests and completed work will appear here.'}
              action={
                role === 'client' ? (
                  <Button as={Link} to="/search" size="sm">
                    Search labour
                  </Button>
                ) : null
              }
            />
          )}
        </div>
      </section>
    </AppShell>
  );
};

export default RecentServicesPage;
