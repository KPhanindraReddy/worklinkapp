import { LocateFixed, LoaderCircle, MapPin, Mic, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { LabourCard } from '../../components/cards/LabourCard';
import { QuickBookingDialog } from '../../components/booking/QuickBookingDialog';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { InputField } from '../../components/common/InputField';
import { PageSEO } from '../../components/common/PageSEO';
import { SelectField } from '../../components/common/SelectField';
import { SectionHeading } from '../../components/common/SectionHeading';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLocationName } from '../../hooks/useLocationName';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import { searchLabours } from '../../services/labourService';
import { resolvePostAuthPath } from '../../utils/authFlow';
import { formatDistanceKm } from '../../utils/formatters';
import { getLocationLabel, normalizeCoordinates } from '../../utils/location';
import { availabilityOptions, NEARBY_LABOUR_RADIUS_KM, workCategories } from '../../utils/constants';

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const { currentUser, userProfile } = useAuth();
  const [filters, setFilters] = useState({
    query: searchParams.get('query') ?? '',
    category: searchParams.get('category') ?? '',
    availability: 'Available',
    minRating: '',
    minExperience: ''
  });
  const [results, setResults] = useState([]);
  const [selectedLabour, setSelectedLabour] = useState(null);
  const [quickBookState, setQuickBookState] = useState(null);
  const [searching, setSearching] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedFilters = useDebounce(filters, 300);
  const geolocation = useGeolocation();
  const { isListening, startListening } = useVoiceSearch({
    lang: 'en-IN',
    onResult: (value) => setFilters((prev) => ({ ...prev, query: value }))
  });
  const shouldRedirectRole = currentUser && userProfile?.role && userProfile.role !== 'client';
  const savedOrigin = useMemo(
    () => normalizeCoordinates(userProfile?.coordinates) || null,
    [userProfile?.coordinates]
  );
  const savedLocationLabel = useMemo(
    () =>
      getLocationLabel(userProfile, {
        fallback: ''
      }),
    [userProfile]
  );
  const liveOrigin = useMemo(
    () =>
      normalizeCoordinates({
        latitude: geolocation.latitude,
        longitude: geolocation.longitude
      }) || null,
    [geolocation.latitude, geolocation.longitude]
  );
  const searchOrigin = useMemo(() => liveOrigin || savedOrigin, [liveOrigin, savedOrigin]);
  const resolvedLocationName = useLocationName(searchOrigin);
  const activeLocationLabel = useMemo(() => {
    if (searchOrigin) {
      return savedLocationLabel || resolvedLocationName || 'Live location captured';
    }

    if (geolocation.loading) {
      return 'Finding your live location';
    }

    return geolocation.error || '';
  }, [geolocation.error, geolocation.loading, resolvedLocationName, savedLocationLabel, searchOrigin]);

  useEffect(() => {
    if (shouldRedirectRole) {
      return undefined;
    }

    let isActive = true;
    setSearching(true);

    searchLabours(
      {
        skill: debouncedFilters.query,
        category: debouncedFilters.category,
        availability: debouncedFilters.availability,
        minRating: debouncedFilters.minRating,
        minExperience: debouncedFilters.minExperience,
        maxDistanceKm: NEARBY_LABOUR_RADIUS_KM
      },
      searchOrigin
    )
      .then((items) => {
        if (!isActive) {
          return;
        }

        setResults(items);
        setSelectedLabour(
          (prev) =>
            items.find((item) => item.id === prev?.id) ??
            items.find((item) => item.availability === 'Available') ??
            items[0] ??
            null
        );
      })
      .catch(() => {
        if (isActive) {
          setResults([]);
          setSelectedLabour(null);
        }
      })
      .finally(() => {
        if (isActive) {
          setSearching(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [debouncedFilters, searchOrigin, shouldRedirectRole]);

  const availableResults = useMemo(
    () =>
      results
        .filter((labour) => labour.availability === 'Available')
        .sort((a, b) => {
          if (a.distanceKm == null && b.distanceKm == null) {
            return b.rating - a.rating;
          }

          if (a.distanceKm == null) {
            return 1;
          }

          if (b.distanceKm == null) {
            return -1;
          }

          return a.distanceKm - b.distanceKm;
        }),
    [results]
  );
  const availableServiceOptions = useMemo(
    () =>
      Array.from(
        new Set(availableResults.map((labour) => labour.category).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [availableResults]
  );
  const defaultQuickBookService = useMemo(
    () => filters.query.trim() || filters.category || selectedLabour?.category || '',
    [filters.category, filters.query, selectedLabour?.category]
  );

  const handleRefreshLocation = async () => {
    await geolocation.requestLocation({ force: true });
  };

  const handleQuickBook = (labour) => {
    setQuickBookState({
      labour,
      defaultService: filters.query.trim() || filters.category || labour.category || '',
    });
  };

  if (shouldRedirectRole) {
    return <Navigate to={resolvePostAuthPath({ profile: userProfile })} replace />;
  }

  return (
    <AppShell>
      <PageSEO
        title="Search labour"
        description="Find skilled labour professionals by category, distance, rating, and live availability."
      />

      <section className="section-space">
        <div className="page-shell">
          <SectionHeading
            eyebrow="Discovery"
            title="Search, filter, and shortlist labour in real time"
            description="Choose a service, confirm what is available near your saved location, and book a worker."
          />

          <div className="mt-5 grid gap-4 sm:mt-8 lg:grid-cols-[320px_1fr] lg:gap-6">
            <Card className="h-fit space-y-4 lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-3 text-slate-950 dark:text-white">
                <div className="flex min-w-0 items-center gap-2">
                  <SlidersHorizontal size={18} className="flex-none" />
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">Filters</h3>
                    <p className="text-xs text-slate-500 lg:hidden">
                      {filters.query || filters.category
                        ? 'Your filters are active'
                        : 'Tap to narrow results'}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  aria-expanded={filtersOpen}
                >
                  {filtersOpen ? 'Hide filters' : 'Show filters'}
                </Button>
              </div>

              <div className={filtersOpen ? 'space-y-4 lg:block' : 'hidden space-y-4 lg:block'}>
                <InputField
                  label="Search by service or skill"
                  value={filters.query}
                  placeholder="Electrician, painter, plumbing..."
                  onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
                />
                <Button type="button" variant="outline" className="w-full" onClick={startListening}>
                  <Mic size={16} />
                  {isListening ? 'Listening...' : 'Voice search'}
                </Button>
                <SelectField
                  label="Service"
                  placeholder="Choose a service"
                  options={workCategories}
                  value={filters.category}
                  onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
                />
                <SelectField
                  label="Availability"
                  placeholder="Any status"
                  options={availabilityOptions}
                  value={filters.availability}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, availability: event.target.value }))
                  }
                />
                <InputField
                  label="Minimum rating"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={filters.minRating}
                  onChange={(event) => setFilters((prev) => ({ ...prev, minRating: event.target.value }))}
                />
                <InputField
                  label="Minimum experience"
                  type="number"
                  min="0"
                  value={filters.minExperience}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, minExperience: event.target.value }))
                  }
                />
                <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900 dark:bg-brand-500/10 dark:text-brand-100">
                  <div className="flex items-center gap-2 font-semibold">
                    <MapPin size={16} />
                    Nearby labour within {NEARBY_LABOUR_RADIUS_KM} km
                  </div>
                  <p className="mt-2">
                    {searchOrigin
                      ? `Using live location${activeLocationLabel ? `: ${activeLocationLabel}` : ''}. Only nearby workers are shown.`
                      : currentUser
                        ? 'Use live location or save your area in profile to show nearby workers.'
                        : 'Sign in or allow live location to show nearby workers.'}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full border-brand-200 bg-white text-brand-800 hover:bg-brand-50"
                    onClick={handleRefreshLocation}
                    disabled={geolocation.loading}
                  >
                    {geolocation.loading ? <LoaderCircle size={15} className="animate-spin" /> : <LocateFixed size={15} />}
                    {searchOrigin ? 'Update live location' : 'Use live location'}
                  </Button>
                </div>
              </div>
            </Card>

            <div className="space-y-5 sm:space-y-8">
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-950 dark:text-white">
                      Services within {NEARBY_LABOUR_RADIUS_KM} km
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Choose a service to see only matching available labour near your live location.
                    </p>
                  </div>
                  <Badge tone={availableServiceOptions.length ? 'emerald' : 'slate'}>
                    {searching ? 'Checking' : `${availableServiceOptions.length} available`}
                  </Badge>
                </div>

                {availableServiceOptions.length ? (
                  <SelectField
                    label="Available service"
                    placeholder="All available services"
                    options={availableServiceOptions}
                    value={filters.category}
                    className="mt-5"
                    onChange={(event) => {
                      const service = event.target.value;
                      setFilters((prev) => ({ ...prev, category: service, query: service }));
                      setSelectedLabour(null);
                    }}
                  />
                ) : (
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-600">
                    No service available within {NEARBY_LABOUR_RADIUS_KM} km right now.
                  </div>
                )}
              </Card>

              {selectedLabour ? (
                <Card className="border-brand-200 bg-brand-50/60">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
                        Selected labour
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                        {selectedLabour.fullName}
                      </h3>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-700">
                        <Badge tone="emerald">{selectedLabour.availability}</Badge>
                        <Badge tone="slate">{formatDistanceKm(selectedLabour.distanceKm)}</Badge>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:flex sm:flex-wrap">
                      <Button type="button" className="w-full sm:w-auto" onClick={() => handleQuickBook(selectedLabour)}>
                        Send request
                      </Button>
                      <Button as={Link} to={`/labour/${selectedLabour.id}`} variant="outline" className="w-full sm:w-auto">
                        View full profile
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : null}

              <div>
                <h3 className="text-xl font-semibold text-slate-950 dark:text-white">Selected labour</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  We keep one clear match on screen so the client can book quickly without a long nearby list.
                </p>
                <div className="mt-4">
                  {selectedLabour ? (
                    <LabourCard
                      labour={selectedLabour}
                      compact
                      showMatchScore
                      onQuickBook={handleQuickBook}
                    />
                  ) : (
                    <EmptyState
                      title="No labour selected yet"
                      description="Type a service name or choose a category to load the best match."
                    />
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      <QuickBookingDialog
        isOpen={Boolean(quickBookState?.labour)}
        labour={quickBookState?.labour ?? null}
        candidateLabours={availableResults}
        defaultService={quickBookState?.defaultService ?? defaultQuickBookService}
        onClose={() => setQuickBookState(null)}
      />
    </AppShell>
  );
};

export default SearchPage;
