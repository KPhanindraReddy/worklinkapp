import { LocateFixed, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { LabourCard } from '../../components/cards/LabourCard';
import { QuickBookingDialog } from '../../components/booking/QuickBookingDialog';
import { AutocompleteSelect } from '../../components/common/AutocompleteSelect';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { PageSEO } from '../../components/common/PageSEO';
import { SelectField } from '../../components/common/SelectField';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLocationName } from '../../hooks/useLocationName';
import { searchLabours } from '../../services/labourService';
import { resolvePostAuthPath } from '../../utils/authFlow';
import { getLocationLabel, normalizeCoordinates } from '../../utils/location';
import { DEFAULT_LABOUR_RADIUS_KM, labourRadiusOptions, workCategories } from '../../utils/constants';

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
  const [radiusKm, setRadiusKm] = useState(DEFAULT_LABOUR_RADIUS_KM);
  const debouncedFilters = useDebounce(filters, 300);
  const geolocation = useGeolocation();
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
  const locationPermissionDenied =
    geolocation.permission === 'denied' ||
    /permission denied/i.test(String(geolocation.error || ''));
  const activeLocationLabel = useMemo(() => {
    if (searchOrigin) {
      return savedLocationLabel || resolvedLocationName || 'Live location captured';
    }

    if (geolocation.loading) {
      return 'Finding your live location';
    }

    return geolocation.error || '';
  }, [geolocation.error, geolocation.loading, resolvedLocationName, savedLocationLabel, searchOrigin]);
  const selectedService = filters.category || filters.query.trim();
  const radiusSelectOptions = useMemo(
    () => labourRadiusOptions.map((km) => ({ label: `${km} km`, value: String(km) })),
    []
  );

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
        maxDistanceKm: radiusKm
      },
      searchOrigin
    )
      .then((items) => {
        if (!isActive) {
          return;
        }

        setResults(items);
        setSelectedLabour(
          selectedService
            ? (prev) =>
                items.find((item) => item.id === prev?.id) ??
                items.find((item) => item.availability === 'Available') ??
                items[0] ??
                null
            : null
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
  }, [debouncedFilters, radiusKm, searchOrigin, selectedService, shouldRedirectRole]);

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
  const availableServiceSet = useMemo(() => new Set(availableServiceOptions), [availableServiceOptions]);
  const defaultQuickBookService = useMemo(
    () => filters.query.trim() || filters.category || selectedLabour?.category || '',
    [filters.category, filters.query, selectedLabour?.category]
  );

  const getServiceAvailability = (service) => {
    return availableServiceSet.has(service) ? 'Available' : null;
  };

  const handleServiceSearchChange = (service) => {
    setFilters((prev) => ({ ...prev, category: service, query: service }));
    setSelectedLabour(null);

    if (service && !availableServiceSet.has(service) && !searching) {
      toast.error(`${service} is not available within ${radiusKm} km.`);
    }
  };

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
        <div className="page-shell max-w-4xl space-y-5">
          <Card className="border-emerald-200 bg-emerald-50/70">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_8rem_auto] lg:items-end">
              <AutocompleteSelect
                label="Search service"
                placeholder={searching ? 'Checking services nearby' : 'Search service for scheduling'}
                options={workCategories}
                value={filters.category || filters.query}
                onChange={(event) => handleServiceSearchChange(event.target.value)}
                getAvailability={getServiceAvailability}
              />
              <SelectField
                label="Radius"
                options={radiusSelectOptions}
                value={String(radiusKm)}
                onChange={(event) => setRadiusKm(Number(event.target.value) || DEFAULT_LABOUR_RADIUS_KM)}
              />
              <Badge tone={availableServiceOptions.length ? 'emerald' : 'slate'} className="min-h-10 px-4">
                {searching ? 'Checking' : `${availableServiceOptions.length} available`}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-emerald-950">
              <span className="font-medium truncate">
                {searchOrigin ? activeLocationLabel || 'Live location ready' : 'Use location to show nearby labour'}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 sm:w-auto"
                onClick={handleRefreshLocation}
                disabled={geolocation.loading}
              >
                {geolocation.loading ? <LoaderCircle size={15} className="animate-spin" /> : <LocateFixed size={15} />}
                {searchOrigin ? 'Update GPS' : 'Use GPS'}
              </Button>
            </div>
            {locationPermissionDenied ? (
              <p className="mt-2 text-xs font-semibold text-rose-700">
                Location permission denied. Enable location access for this site in browser settings, then try again.
              </p>
            ) : null}
          </Card>

          {selectedService ? (
            selectedLabour ? (
              <Card className="border-brand-200 bg-brand-50/60">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-950">{selectedService}</h2>
                  <Badge tone="emerald">Available</Badge>
                </div>
                <LabourCard
                  labour={selectedLabour}
                  compact
                  showMatchScore
                  onQuickBook={handleQuickBook}
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button type="button" className="w-full" onClick={() => handleQuickBook(selectedLabour)}>
                    Send request
                  </Button>
                  <Button as={Link} to={`/labour/${selectedLabour.id}`} variant="outline" className="w-full">
                    View full profile
                  </Button>
                </div>
              </Card>
            ) : (
              <EmptyState
                title={searching ? 'Checking availability' : `No labour within ${radiusKm} km`}
                description={
                  searching
                    ? `Looking for ${selectedService}.`
                    : 'Try increasing distance.'
                }
              />
            )
          ) : null}
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
