import { History, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { InputField } from '../../components/common/InputField';
import { PageSEO } from '../../components/common/PageSEO';
import { Skeleton } from '../../components/common/Skeleton';
import { TextAreaField } from '../../components/common/TextAreaField';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import {
  completeClientPayment,
  subscribeBookingsForUser,
  updateBookingStatus
} from '../../services/bookingService';
import { submitServiceReview } from '../../services/reviewService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import { getDisplayLocationText } from '../../utils/location';

const getStatusTone = (status) => {
  if (['accepted', 'in_progress'].includes(status)) {
    return 'emerald';
  }

  if (status === 'awaiting_payment') {
    return 'amber';
  }

  if (status === 'completed') {
    return 'blue';
  }

  if (['rejected', 'cancelled'].includes(status)) {
    return 'rose';
  }

  if (status === 'timed_out') {
    return 'slate';
  }

  return 'amber';
};

const formatStatusLabel = (status) =>
  String(status || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

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
        label: 'New requests',
        value: bookings.filter((item) => item.status === 'pending').length
      },
      {
        label: 'Active',
        value: bookings.filter((item) => ['accepted', 'in_progress'].includes(item.status)).length
      },
      {
        label: 'Completed',
        value: bookings.filter((item) => item.status === 'completed').length
      },
      {
        label: 'Declined',
        value: bookings.filter((item) => ['rejected', 'cancelled', 'timed_out'].includes(item.status)).length
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
      toast.error('Choose a star rating before submitting.');
      return;
    }

    setSubmittingReviewId(booking.id);

    try {
      await submitServiceReview({
        bookingId: booking.id,
        clientId: currentUser.uid,
        clientName: userProfile?.fullName,
        rating: draft.rating,
        comment: draft.comment
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

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {summaryItems.map((item) => (
              <Card key={item.label} className="rounded-[20px] px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                {bookingsLoading ? (
                  <Skeleton className="mt-2 h-7 w-14" />
                ) : (
                  <p className="mt-2 font-display text-xl font-bold text-slate-950">{item.value}</p>
                )}
              </Card>
            ))}
          </div>

          {bookingsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : bookings.length ? (
            <div className="space-y-2.5">
              {bookings.map((booking) => {
                const subjectName = role === 'labour' ? booking.clientName : booking.labourName;
                const hasCompletedPayment = booking.status === 'completed' && Number(booking.amount) > 0;
                const reviewSelected = Number(reviewDrafts[booking.id]?.rating ?? 0);

                return (
                  <Card key={booking.id} className="rounded-[20px] px-3 py-3">
                    <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_0.8fr_auto] lg:items-start">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Service
                        </p>
                        <h2 className="truncate text-sm font-semibold text-slate-950">{booking.serviceType}</h2>
                        <p className="mt-1 truncate text-[12px] text-slate-500">By {subjectName}</p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Location
                        </p>
                        <p className="mt-1 truncate text-[12px] text-slate-600">
                          {getDisplayLocationText(booking.location, 'Location shared after confirmation')}
                        </p>
                        <p className="mt-1 text-[12px] text-slate-500">{formatDate(booking.appointmentAt)}</p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Payment
                        </p>
                        <p className="mt-1 text-[12px] font-semibold text-slate-900">
                          {hasCompletedPayment
                            ? formatCurrency(booking.amount)
                            : booking.status === 'awaiting_payment'
                              ? 'Enter paid amount'
                              : 'Charge pending'}
                        </p>
                        <Badge tone={getStatusTone(booking.status)} className="mt-2">
                          {formatStatusLabel(booking.status)}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {role === 'client' && ['pending', 'accepted'].includes(booking.status) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                            disabled={cancellingBookingId === booking.id}
                            onClick={() => handleCancelBooking(booking)}
                          >
                            {cancellingBookingId === booking.id ? 'Cancelling...' : 'Cancel'}
                          </Button>
                        ) : null}
                        {booking.status === 'accepted' && booking.startOtp ? <Badge tone="emerald">OTP ready</Badge> : null}
                        {role === 'client' && booking.status === 'completed' && !booking.reviewRating ? (
                          <Badge tone="blue">Rate now</Badge>
                        ) : null}
                      </div>
                    </div>

                    {role === 'client' && booking.status === 'awaiting_payment' ? (
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <InputField
                          label="Amount paid"
                          type="number"
                          min="1"
                          inputMode="decimal"
                          value={paymentAmounts[booking.id] ?? ''}
                          onChange={(event) => handlePaymentAmountChange(booking.id, event.target.value)}
                          placeholder="Enter amount"
                          className="min-w-[180px] flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-11 bg-slate-950 text-white shadow-sm hover:bg-slate-800"
                          disabled={completingPaymentId === booking.id}
                          onClick={() => handleCompleteClientPayment(booking)}
                        >
                          {completingPaymentId === booking.id ? 'Completing...' : 'Complete'}
                        </Button>
                      </div>
                    ) : null}

                    {booking.serviceDetails ? (
                      <p className="mt-2 text-[12px] leading-6 text-slate-600">{booking.serviceDetails}</p>
                    ) : null}

                    {booking.status === 'accepted' && booking.startOtp ? (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                          Start OTP
                        </p>
                        <p className="font-display text-lg font-bold tracking-[0.22em] text-slate-950">
                          {booking.startOtp}
                        </p>
                      </div>
                    ) : null}

                    {role === 'client' && booking.status === 'completed' ? (
                      booking.reviewRating ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star
                              key={index}
                              size={15}
                              fill={index < Number(booking.reviewRating) ? 'currentColor' : 'none'}
                            />
                          ))}
                          <span>Rated {booking.reviewRating}/5</span>
                          {booking.reviewComment ? (
                            <span className="w-full text-[12px] font-medium text-amber-950">
                              {booking.reviewComment}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-950">Rate this service</span>
                            <div className="flex flex-wrap gap-1">
                              {Array.from({ length: 5 }).map((_, index) => {
                                const value = index + 1;
                                const selected = reviewSelected >= value;

                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => updateReviewDraft(booking.id, 'rating', value)}
                                    className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
                                      selected
                                        ? 'border-amber-300 bg-amber-100 text-amber-600'
                                        : 'border-slate-200 bg-white text-slate-400 hover:border-amber-200 hover:text-amber-500'
                                    }`}
                                    aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
                                  >
                                    <Star size={16} fill={selected ? 'currentColor' : 'none'} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <TextAreaField
                              label="Review"
                              value={reviewDrafts[booking.id]?.comment ?? ''}
                              onChange={(event) =>
                                updateReviewDraft(booking.id, 'comment', event.target.value)
                              }
                              placeholder="Share a short note."
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              size="sm"
                              className="h-11 self-end"
                              disabled={submittingReviewId === booking.id}
                              onClick={() => handleSubmitReview(booking)}
                            >
                              {submittingReviewId === booking.id ? 'Submitting...' : 'Submit'}
                            </Button>
                          </div>
                        </div>
                      )
                    ) : null}
                  </Card>
                );
              })}
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
