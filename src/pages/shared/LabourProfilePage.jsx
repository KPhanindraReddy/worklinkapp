import { Link, useParams } from 'react-router-dom';
import { CalendarDays, MapPin, Phone, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { QuickBookingDialog } from '../../components/booking/QuickBookingDialog';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { ProfilePhotoUploader } from '../../components/common/ProfilePhotoUploader';
import { PageSEO } from '../../components/common/PageSEO';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useLocationName } from '../../hooks/useLocationName';
import { subscribeBookingsForUser } from '../../services/bookingService';
import { subscribeLabourById } from '../../services/labourService';
import { subscribeReviewsForLabour } from '../../services/reviewService';
import { getDisplayLocationText } from '../../utils/location';

const ProfileStat = ({ value, label, tone = 'slate' }) => {
  const toneClass = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-500',
    brand: 'text-brand-600',
    slate: 'text-slate-950 dark:text-white'
  }[tone];

  return (
    <div className="min-w-0 flex-1 basis-0 px-2 text-center">
      <p className={`truncate text-sm font-extrabold leading-tight sm:text-xl ${toneClass}`}>{value}</p>
      <p className="mt-1 truncate text-[11px] font-medium text-slate-400 sm:text-xs">{label}</p>
    </div>
  );
};

const LabourProfilePage = () => {
  const { labourId } = useParams();
  const { currentUser, userProfile } = useAuth();
  const [labour, setLabour] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedQuickBookLabour, setSelectedQuickBookLabour] = useState(null);
  const resolvedLabourLocationName = useLocationName(labour?.coordinates);

  useEffect(() => {
    return subscribeLabourById(labourId, setLabour, () => setLabour(null));
  }, [labourId]);

  useEffect(() => {
    return subscribeReviewsForLabour(labourId, setReviews, () => setReviews([]));
  }, [labourId]);

  useEffect(() => {
    if (!currentUser?.uid || userProfile?.role !== 'labour' || currentUser.uid !== labourId) {
      setBookings([]);
      return undefined;
    }

    return subscribeBookingsForUser(
      { userId: labourId, role: 'labour' },
      setBookings,
      () => setBookings([])
    );
  }, [currentUser?.uid, labourId, userProfile?.role]);

  const isClient = userProfile?.role === 'client';
  const canRevealContact = Boolean(isClient && labour?.verified);
  const callButtonLabel = canRevealContact
    ? 'Call now'
    : isClient
      ? 'Labour verification required'
      : 'Client account required';
  const profileReviews = reviews.length ? reviews : labour?.reviews ?? [];
  const completedBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'completed'),
    [bookings]
  );
  const completedJobs = Math.max(Number(labour?.completedJobs || 0), completedBookings.length);
  const canEditPhoto = Boolean(currentUser?.uid && labour?.id && currentUser.uid === labour.id);
  const ratingSummary = useMemo(() => {
    if (!profileReviews.length) {
      return {
        rating: Number(labour?.rating || 0).toFixed(1).replace('.0', ''),
        count: labour?.reviewsCount ?? 0
      };
    }

    const average =
      profileReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) /
      profileReviews.length;

    return {
      rating: average.toFixed(1).replace('.0', ''),
      count: profileReviews.length
    };
  }, [labour?.rating, labour?.reviewsCount, profileReviews]);

  if (!labour) {
    return (
      <AppShell>
        <div className="page-shell section-space">
          <EmptyState
            title="Labour profile not found"
            description="The requested profile is unavailable or may have been removed."
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageSEO title={labour.fullName} description={labour.about} />

      <section className="section-space">
        <div className="page-shell grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden rounded-[28px] p-0 sm:rounded-[36px]">
            <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-[144px_1fr] md:p-8">
              {canEditPhoto ? (
                <ProfilePhotoUploader
                  compact
                  persistOnUpload
                  uid={currentUser?.uid}
                  role={labour?.role || 'labour'}
                  value={labour.profilePhoto}
                  fullName={labour.fullName}
                  avatarClassName="h-28 w-28 sm:h-32 sm:w-32 md:h-36 md:w-36"
                  onError={(error) => console.warn('[WorkLink labour photo] upload failed', error)}
                />
              ) : (
                <img
                  src={labour.profilePhoto}
                  alt={labour.fullName}
                  className="h-28 w-28 rounded-2xl object-cover shadow-[0_16px_32px_rgba(15,23,42,0.16)] sm:h-32 sm:w-32 md:h-36 md:w-36"
                />
              )}
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="blue">{labour.category}</Badge>
                  <Badge tone={labour.availability === 'Available' ? 'emerald' : 'amber'}>
                    {labour.availability}
                  </Badge>
                  <VerificationBadge verified={labour.verified} />
                </div>
                <h1 className="mt-5 break-words font-display text-3xl font-bold text-slate-950 sm:text-4xl dark:text-white">
                  {labour.fullName}
                </h1>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <Star size={15} className="text-amber-500" />
                    {ratingSummary.rating} rating
                  </span>
                  <span>{labour.experienceYears} years experience</span>
                  <span>{completedJobs} completed jobs</span>
                </div>
                <p className="mt-6 text-base leading-8 text-slate-600 dark:text-slate-300">
                  {labour.about}
                </p>
                <div className="mt-6 flex min-w-0 items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <MapPin size={16} className="flex-none" />
                  <span className="min-w-0 break-words">
                    {getDisplayLocationText(
                      labour.currentLocation || labour.location,
                      resolvedLabourLocationName || 'Location not added'
                    )}
                  </span>
                </div>
                <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
                  {isClient ? (
                    <Button type="button" className="w-full sm:w-auto" onClick={() => setSelectedQuickBookLabour(labour)}>
                      <CalendarDays size={16} />
                      Send request
                    </Button>
                  ) : currentUser ? (
                    <Button type="button" className="w-full sm:w-auto" disabled>
                      Client account required
                    </Button>
                  ) : (
                    <Button as={Link} to="/auth?role=client&mode=signup" className="w-full sm:w-auto">
                      Sign up as client to book
                    </Button>
                  )}
                  {isClient ? (
                    <Button as={Link} to={`/chat?target=${labour.id}`} variant="outline" className="w-full sm:w-auto">
                      Chat now
                    </Button>
                  ) : currentUser ? (
                    <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
                      Client account required
                    </Button>
                  ) : (
                    <Button as={Link} to="/auth?role=client&mode=login" variant="outline" className="w-full sm:w-auto">
                      Login as client
                    </Button>
                  )}
                  <Button
                    as="a"
                    href={canRevealContact ? `tel:${labour.phoneNumber}` : undefined}
                    variant="outline"
                    className={`w-full sm:w-auto ${!canRevealContact ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <Phone size={16} />
                    {callButtonLabel}
                  </Button>
                </div>
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Direct phone access unlocks after the labour profile is verified.
                </p>
              </div>
            </div>
            <div className="border-t border-slate-100 px-4 py-3 sm:px-6 md:px-8 dark:border-slate-800">
              <div className="flex items-stretch divide-x divide-slate-100 rounded-[16px] border border-slate-200 bg-white px-1 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                <ProfileStat value={completedJobs} label="Jobs done" tone="emerald" />
                <ProfileStat value={ratingSummary.rating || '0'} label="Rating" tone="amber" />
                <ProfileStat value={ratingSummary.count || 0} label="Reviews" tone="brand" />
              </div>
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Skills and languages</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {labour.skills?.map((item) => (
                  <Badge key={item} tone="slate">
                    {item}
                  </Badge>
                ))}
              </div>
              <h3 className="mt-6 font-semibold text-slate-950 dark:text-white">Languages</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {labour.languages?.map((item) => (
                  <Badge key={item} tone="blue">
                    {item}
                  </Badge>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Profile details</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <ProfileStat value={labour.category || 'Service'} label="Service" tone="brand" />
                <ProfileStat value={`${Number(labour.experienceYears || 0)} yrs`} label="Experience" tone="amber" />
                <ProfileStat value={labour.responseTime || 'Fast'} label="Response" tone="slate" />
              </div>
              <div className="mt-5 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                <p>Gender: {labour.gender || 'Not added'}</p>
                <p>Age: {labour.age || 'Not added'}</p>
                <p>Education: {labour.education || 'Not added'}</p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <QuickBookingDialog
        isOpen={Boolean(selectedQuickBookLabour)}
        labour={selectedQuickBookLabour}
        defaultService={selectedQuickBookLabour?.category ?? labour.category}
        onClose={() => setSelectedQuickBookLabour(null)}
      />
    </AppShell>
  );
};

export default LabourProfilePage;
