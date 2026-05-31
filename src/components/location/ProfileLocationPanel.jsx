import { LoaderCircle, LocateFixed, MapPin, Navigation } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '../common/Button';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLocationName } from '../../hooks/useLocationName';
import {
  buildMapsUrl,
  getDisplayLocationText,
  hasCoordinates,
  normalizeCoordinates
} from '../../utils/location';
import { fetchMapboxLocationName } from '../../utils/mapbox';

export const ProfileLocationPanel = ({
  roleLabel = 'user',
  locationValue = '',
  savedCoordinates = null,
  disabled = false,
  onApplyLocation
}) => {
  const geolocation = useGeolocation();
  const liveCoordinates = useMemo(
    () =>
      hasCoordinates({
        latitude: geolocation.latitude,
        longitude: geolocation.longitude
      })
        ? normalizeCoordinates({
            latitude: geolocation.latitude,
            longitude: geolocation.longitude
          })
        : null,
    [geolocation.latitude, geolocation.longitude]
  );
  const liveLocationName = useLocationName(liveCoordinates);
  const savedLocationName = useLocationName(savedCoordinates);
  const savedMapsUrl = buildMapsUrl(savedCoordinates, locationValue);
  const savedLabel = getDisplayLocationText(
    locationValue,
    hasCoordinates(savedCoordinates) ? savedLocationName || 'Live location captured' : ''
  );

  const handleApplyLiveLocation = async () => {
    const coordinates = await geolocation.requestLocation({ force: true });

    if (!coordinates) {
      return;
    }

    const resolvedLocationName = await fetchMapboxLocationName(coordinates);

    onApplyLocation?.({
      label: getDisplayLocationText(
        locationValue,
        resolvedLocationName || liveLocationName || 'Live location captured'
      ),
      coordinates
    });
  };

  return (
    <div className="rounded-[14px] border border-emerald-200 bg-emerald-50/70 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
            <MapPin size={15} className="text-emerald-600" />
            Live location active
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-emerald-900/80">
            {liveCoordinates
              ? liveLocationName || `Live location ready for ${roleLabel}`
              : geolocation.loading
                ? 'Updating your live location.'
                : savedLabel
                  ? savedLabel
                  : geolocation.error || 'Save location once, then update it only when you move.'}
          </p>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={disabled || geolocation.loading}
            onClick={handleApplyLiveLocation}
          >
            {geolocation.loading ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <LocateFixed size={15} />
            )}
            {savedCoordinates ? 'Update live location' : 'Use live location'}
          </Button>
          {savedMapsUrl ? (
            <Button
              as="a"
              href={savedMapsUrl}
              target="_blank"
              rel="noreferrer"
              size="sm"
              variant="outline"
              className="w-full"
            >
              <Navigation size={15} />
              Open map
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
