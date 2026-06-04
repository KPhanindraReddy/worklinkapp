import { CalendarClock, History, MapPin, Star, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
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
    return 'border-emerald-200 bg-emerald-50/80';
  }

  if (['rejected', 'timed_out'].includes(status)) {
    return 'border-rose-200 bg-rose-50/80';
  }

  if (['cancelled', 'awaiting_payment', 'pending'].includes(status)) {
    return 'border-amber-200 bg-amber-50/80';
  }

  if (['accepted', 'in_progress'].includes(status)) {
    return 'border-sky-200 bg-sky-50/80';
  }

  return 'border-slate-200 bg-white';
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
  const role = userProfile?.role === 'labour' ? 'labour' : 'client';
  const subjectLabel = role === 'labour' ? 'Client' : 'Worker';

  useEffect(() => {
    if (!currentUser?.uid) {
      setBookings([]);
      setBookingsLoading(false);
      return undefined;
    }

    setBookingsLoading(true);
    return subscribeBookingsForUser(
      { userId: currentUser.uid, role },
      (nextBookings) => {
        setBookings(nextBookings);
        setBookingsLoading(false);
      },
      (error) => {
        setBookingsLoading(false);
        toast.error(getFirebaseErrorMessage(error));
      }
    );
  }, [currentUser?.uid, role]);

  const summaryItems = useMemo(
    () => [
      {
        label: 'New services',
        value: bookings.filter((item) => item.status === 'pending').length
      },
      {
        label: 'Active',
        value: bookings.filter((item) => ['accepted', 'in_progress'].includes(item.status)).length
      },
      {
        label: 'Completed',
        value: bookings.filter((item) => item.status === 'completed').length
      }
    ],
    [bookings]
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
        <div className="page-shell space-y-5">
          <Card className="rounded-[28px]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                  <History size={18} />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-950">Recent services</h1>
                  <p className="text-[13px] text-slate-500">
                    Track service requests and completed work.
                  </p>
                </div>
              </div>
              {bookingsLoading ? <Skeleton className="h-7 w-20" /> : <Badge tone="slate">{bookings.length} total</Badge>}
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-2">
            {summaryItems.map((item, index) => {
              const toneClass = [
                'border-amber-300 bg-amber-50 text-amber-800',
                'border-sky-300 bg-sky-50 text-sky-800',
                'border-emerald-300 bg-emerald-50 text-emerald-800'
              ][index];

              return (
              <div key={item.label} className={`rounded-xl border-2 p-2.5 text-center shadow-sm sm:p-3 ${toneClass}`}>
                <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.08em]">{item.label}</p>
                {bookingsLoading ? (
                  <Skeleton className="mx-auto mt-2 h-7 w-12" />
                ) : (
                  <p className="mt-1 font-display text-2xl font-black leading-none sm:text-3xl">{item.value}</p>
                )}
              </div>
              );
            })}
          </div>

          {bookingsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : bookings.length ? (
            <div className="space-y-2 sm:overflow-x-auto sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-white">
              <div className="hidden min-w-[680px] grid-cols-[1.1fr_1fr_0.85fr_0.85fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 sm:grid">
                <span>Name</span>
                <span>Service</span>
                <span>Time</span>
                <span>Money</span>
              </div>
              {bookings.map((booking) => (
                <Card
                  key={booking.id}
                  className={clsx(
                    'rounded-2xl p-3 shadow-sm sm:min-w-[680px] sm:rounded-none sm:border-x-0 sm:border-t-0 sm:p-4 sm:shadow-none sm:last:border-b-0',
                    getBookingRowTone(booking.status)
                  )}
                >
                  <div className="grid gap-2 sm:grid-cols-[1.1fr_1fr_0.85fr_0.85fr] sm:gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-slate-950">
                        {role === 'labour' ? booking.clientName || 'Client' : booking.labourName || 'Worker'}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">{subjectLabel}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{booking.serviceType}</p>
                      <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                        <MapPin size={13} className="flex-none" />
                        <span className="truncate">
                          <LocationText
                            location={booking.location}
                            coordinates={booking.coordinates}
                            fallback="Location shared after confirmation"
                          />
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 sm:text-sm sm:text-slate-600">
                        <CalendarClock size={14} />
                        {formatDate(booking.appointmentAt)}
                      </p>
                    </div>
                    <div>
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 sm:text-sm">
                        <WalletCards size={14} />
                        {booking.status === 'completed' && Number(booking.amount) > 0
                          ? formatCurrency(booking.amount)
                          : booking.status === 'awaiting_payment'
                            ? 'Enter paid amount'
                            : 'Charge pending'}
                      </p>
                    </div>
                  </div>

                  {role === 'client' && booking.status === 'awaiting_payment' ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-950">Complete this service</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-amber-900">
                        Enter the amount you paid after the labour finished the work.
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
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
                          className="h-11 w-full bg-slate-950 text-white shadow-sm hover:bg-slate-800 sm:w-auto"
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
                      variant="outline"
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
                        <select
                          value={reviewDrafts[booking.id]?.rating ?? ''}
                          onChange={(event) => updateReviewDraft(booking.id, 'rating', event.target.value)}
                          className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100 max-sm:text-base sm:max-w-xs"
                        >
                          <option value="">Choose rating</option>
                          <option value="5">5 - Excellent</option>
                          <option value="4">4 - Good</option>
                          <option value="3">3 - Okay</option>
                          <option value="2">2 - Poor</option>
                          <option value="1">1 - Bad</option>
                        </select>
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
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recent services yet"
              description="Your latest service requests and completed work will appear here."
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
