import { CalendarClock, IndianRupee, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { InputField } from '../../components/common/InputField';
import { PageSEO } from '../../components/common/PageSEO';
import { Skeleton } from '../../components/common/Skeleton';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { subscribeBookingsForUser } from '../../services/bookingService';
import { formatCurrency, formatDate, parseDateValue } from '../../utils/formatters';
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

const getPaymentDate = (booking) =>
  booking.paidAt || booking.clientCompletedAt || booking.completedAt || booking.appointmentAt;

const LabourEarningsPage = () => {
  const { currentUser } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');

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

  const paidBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'completed' && booking.paymentStatus === 'paid'),
    [bookings]
  );
  const filteredPaidBookings = useMemo(
    () =>
      dateFilter
        ? paidBookings.filter((booking) => getDateKey(getPaymentDate(booking)) === dateFilter)
        : paidBookings,
    [dateFilter, paidBookings]
  );
  const todayKey = getDateKey(new Date());
  const todayPaidBookings = useMemo(
    () => paidBookings.filter((booking) => getDateKey(getPaymentDate(booking)) === todayKey),
    [paidBookings, todayKey]
  );
  const totalEarned = useMemo(
    () => paidBookings.reduce((sum, booking) => sum + Number(booking.amount || 0), 0),
    [paidBookings]
  );
  const todayEarned = useMemo(
    () => todayPaidBookings.reduce((sum, booking) => sum + Number(booking.amount || 0), 0),
    [todayPaidBookings]
  );
  const selectedEarned = useMemo(
    () => filteredPaidBookings.reduce((sum, booking) => sum + Number(booking.amount || 0), 0),
    [filteredPaidBookings]
  );
  const awaitingPaymentBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'awaiting_payment'),
    [bookings]
  );
  const metrics = useMemo(
    () => [
      { label: 'Today earned', value: formatCurrency(todayEarned) },
      { label: dateFilter ? 'Filtered total' : 'Total earned', value: formatCurrency(dateFilter ? selectedEarned : totalEarned) },
      { label: 'Paid jobs', value: paidBookings.length },
      { label: 'Awaiting client amount', value: awaitingPaymentBookings.length }
    ],
    [awaitingPaymentBookings.length, dateFilter, paidBookings.length, selectedEarned, todayEarned, totalEarned]
  );

  return (
    <AppShell>
      <PageSEO title="Labour Earnings" description="Track paid Slivz services and daily labour earnings." />

      <section className="section-space">
        <div className="page-shell space-y-5">
          <Card className="rounded-[28px] p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="emerald">Paid earnings</Badge>
                  <Badge tone={dateFilter ? 'emerald' : 'slate'}>
                    {dateFilter ? `Filtered: ${dateFilter}` : 'All payments'}
                  </Badge>
                </div>
                <h1 className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">
                  Earnings
                </h1>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  See who paid, how much they paid, and today&apos;s total income.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end lg:min-w-[24rem]">
                <InputField
                  label="Filter by payment date"
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

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {metrics.map((item) => (
              <Card key={item.label} className="rounded-[16px] p-3 sm:p-4">
                {loading ? (
                  <Skeleton className="h-12 w-full rounded-xl" />
                ) : (
                  <>
                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 truncate text-xl font-extrabold leading-none text-slate-950 sm:text-2xl">
                      {item.value}
                    </p>
                  </>
                )}
              </Card>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
            <Card className="rounded-[24px] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Paid services</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Client names, paid amount, and payment date.
                  </p>
                </div>
                <Badge tone={filteredPaidBookings.length ? 'emerald' : 'slate'}>
                  {filteredPaidBookings.length} paid
                </Badge>
              </div>

              <div className="mt-4 space-y-2">
                {loading ? (
                  <>
                    <Skeleton className="h-24 w-full rounded-2xl" />
                    <Skeleton className="h-24 w-full rounded-2xl" />
                  </>
                ) : filteredPaidBookings.length ? (
                  <>
                    <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 md:grid md:grid-cols-[1fr_1fr_0.85fr_0.85fr_0.55fr] md:gap-3">
                      <span>Client</span>
                      <span>Service</span>
                      <span>Date</span>
                      <span>Amount</span>
                      <span>Status</span>
                    </div>
                    {filteredPaidBookings.map((booking) => (
                      <div key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_0.85fr_0.85fr_0.55fr] md:items-center">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Client</p>
                            <h3 className="truncate font-semibold text-slate-950">{booking.clientName || 'Client'}</h3>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Service</p>
                            <p className="truncate text-sm font-semibold text-slate-800">{booking.serviceType}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {getDisplayLocationText(booking.location, 'Live location shared')}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Date</p>
                            <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                              <CalendarClock size={15} />
                              {formatDate(getPaymentDate(booking))}
                            </span>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Amount</p>
                            <span className="inline-flex items-center gap-2 font-semibold text-brand-700">
                              <IndianRupee size={15} />
                              {formatCurrency(booking.amount)}
                            </span>
                          </div>
                          <div className="flex justify-start md:justify-end">
                            <Badge tone="emerald">Paid</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                    No paid services for this date.
                  </p>
                )}
              </div>
            </Card>

            <Card className="rounded-[24px] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <WalletCards size={18} className="text-amber-600" />
                <h2 className="text-lg font-semibold text-slate-950">Waiting for client</h2>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                These jobs are finished by you, but the client still needs to enter the paid amount.
              </p>
              <div className="mt-4 space-y-2">
                {loading ? (
                  <Skeleton className="h-24 w-full rounded-2xl" />
                ) : awaitingPaymentBookings.length ? (
                  <>
                    <div className="hidden rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-amber-700 md:grid md:grid-cols-[1fr_1fr_0.9fr_0.75fr] md:gap-3">
                      <span>Client</span>
                      <span>Service</span>
                      <span>Finished</span>
                      <span>Status</span>
                    </div>
                    {awaitingPaymentBookings.slice(0, 6).map((booking) => (
                      <div key={booking.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_0.9fr_0.75fr] md:items-center">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700 md:hidden">Client</p>
                            <p className="truncate font-semibold text-amber-950">{booking.clientName || 'Client'}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700 md:hidden">Service</p>
                            <p className="truncate text-sm font-semibold text-amber-900">{booking.serviceType}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700 md:hidden">Finished</p>
                            <p className="text-sm text-amber-900">{formatDate(booking.workFinishedAt || booking.appointmentAt)}</p>
                          </div>
                          <div className="flex justify-start md:justify-end">
                            <Badge tone="amber">Amount pending</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                    No finished jobs waiting for client payment.
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

export default LabourEarningsPage;
