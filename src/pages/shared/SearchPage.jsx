import { LocateFixed, LoaderCircle, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
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
import { LocationPermissionPrompt, isLocationPermissionDenied } from '../../components/location/LocationPermissionPrompt';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLocationName } from '../../hooks/useLocationName';
import { searchLabours } from '../../services/labourService';
import { resolvePostAuthPath } from '../../utils/authFlow';
import { DEFAULT_LABOUR_RADIUS_KM, labourRadiusOptions, workCategories } from '../../utils/constants';
import { getLocationLabel, normalizeCoordinates } from '../../utils/location';

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const { currentUser, userProfile } = useAuth();
  const [filters, setFilters] = useState({
    query: searchParams.get('query') ?? '',
    category: searchParams.get('category') ?? ''
  });
  const [radiusKm, setRadiusKm] = useState(DEFAULT_LABOUR_RADIUS_KM);
  const [results, setResults] = useState([]);
  const [quickBookState, setQuickBookState] = useState(null);
  const [searching, setSearching] = useState(false);
  const debouncedFilters = useDebounce(filters, 300);
  const geolocation = useGeolocation();
  const shouldRedirectRole = currentUser && userProfile?.role && userProfile.role !== 'client';
  const selectedService = (filters.category || filters.query).trim();
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
  const locationPermissionDenied = isLocationPermissionDenied(geolocation);
  const radiusSelectOptions = useMemo(
    () => labourRadiusOptions.map((km) => ({ label: `${km} km`, value: String(km) })),
    []
  );
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

    const serviceSearch = (debouncedFilters.category || debouncedFilters.query).trim();

    if (!serviceSearch) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    let isActive = true;
    setSearching(true);

    searchLabours(
      {
        skill: serviceSearch,
        category: debouncedFilters.category,
        availability: 'Available',
        maxDistanceKm: radiusKm
      },
      searchOrigin
    )
      .then((items) => {
        if (isActive) {
          setResults(items);
        }
      })
      .catch(() => {
        if (isActive) {
          setResults([]);
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
  }, [debouncedFilters, radiusKm, searchOrigin, shouldRedirectRole]);

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
  const defaultQuickBookService = useMemo(
    () => selectedService || quickBookState?.labour?.category || '',
    [quickBookState?.labour?.category, selectedService]
  );

  const handleRefreshLocation = async () => {
    return geolocation.requestLocation({ force: true });
  };

  const handleQuickBook = (labour) => {
    setQuickBookState({
      labour,
      defaultService: selectedService || labour.category || '',
    });
  };

  const handleServiceChange = (event) => {
    const service = event.target.value;
    setFilters({ category: service, query: service });
  };

  if (shouldRedirectRole) {
    return <Navigate to={resolvePostAuthPath({ profile: userProfile })} replace />;
  }

  return (
    <AppShell>
      <PageSEO
        title="Search labour"
        description="Find available labour professionals near your location by service and distance."
      />

      <section className="section-space">
        <div className="page-shell max-w-5xl">
          <Card className="space-y-4 rounded-[18px] p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem_auto] lg:items-end">
              <AutocompleteSelect
                label="Search service"
                placeholder="Type or choose service"
                options={workCategories}
                value={selectedService}
                onChange={handleServiceChange}
                allowCustom
                customOptionLabel="Search"
              />
              <SelectField
                label="Distance"
                options={radiusSelectOptions}
                value={String(radiusKm)}
                onChange={(event) => setRadiusKm(Number(event.target.value) || DEFAULT_LABOUR_RADIUS_KM)}
              />
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full lg:w-auto"
                onClick={handleRefreshLocation}
                disabled={geolocation.loading}
              >
                {geolocation.loading ? <LoaderCircle size={17} className="animate-spin" /> : <LocateFixed size={17} />}
                {searchOrigin ? 'Update location' : 'Allow location'}
              </Button>
            </div>

            <div className="rounded-2xl bg-brand-50 p-3 text-sm font-medium text-brand-900 dark:bg-brand-500/10 dark:text-brand-100">
              <div className="flex items-center gap-2">
                <MapPin size={16} />
                Labour within {radiusKm} km
              </div>
              <p className="mt-2">
                {searchOrigin
                  ? `Using location${activeLocationLabel ? `: ${activeLocationLabel}` : ''}.`
                  : currentUser
                    ? 'Allow live location or save your area in profile to show nearby workers.'
                    : 'Sign in or allow live location to show nearby workers.'}
              </p>
              {locationPermissionDenied ? (
                <LocationPermissionPrompt
                  geolocation={geolocation}
                  onRequest={handleRefreshLocation}
                  className="mt-3"
                  compact
                />
              ) : null}
            </div>
          </Card>

          <div className="mt-5 space-y-5 sm:mt-6">
            <Card className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] p-4 sm:p-5">
              <div>
                <h1 className="text-xl font-semibold text-slate-950 dark:text-white">
                  {selectedService ? `${selectedService} labour` : 'Choose a service'}
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {selectedService
                    ? `Available workers within ${radiusKm} km are shown below.`
                    : 'Search a service to see available labour near you.'}
                </p>
              </div>
              <Badge tone={availableResults.length ? 'emerald' : 'slate'}>
                {searching ? 'Checking' : `${availableResults.length} available`}
              </Badge>
            </Card>

            {availableResults.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {availableResults.map((labour) => (
                  <LabourCard
                    key={labour.id}
                    labour={labour}
                    compact
                    showMatchScore
                    onQuickBook={handleQuickBook}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title={selectedService ? 'No available labour found' : 'Search a service'}
                description={
                  selectedService
                    ? `${selectedService} is not available within ${radiusKm} km right now. Try another distance or update location.`
                    : 'Type or choose a service, then the available labour will appear here.'
                }
              />
            )}
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
