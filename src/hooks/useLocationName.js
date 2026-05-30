import { useEffect, useState } from 'react';
import { buildMapboxReverseGeocodeUrl } from '../utils/mapbox';
import { normalizeCoordinates } from '../utils/location';

export const useLocationName = (coordinates) => {
  const [locationName, setLocationName] = useState('');
  const normalizedCoordinates = normalizeCoordinates(coordinates);
  const latitude = normalizedCoordinates?.latitude ?? null;
  const longitude = normalizedCoordinates?.longitude ?? null;

  useEffect(() => {
    const reverseGeocodeUrl = buildMapboxReverseGeocodeUrl({ latitude, longitude });

    if (!reverseGeocodeUrl) {
      setLocationName('');
      return undefined;
    }

    const controller = new AbortController();

    fetch(reverseGeocodeUrl, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        const placeName = String(payload?.features?.[0]?.place_name ?? '').trim();
        setLocationName(placeName);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          setLocationName('');
        }
      });

    return () => controller.abort();
  }, [latitude, longitude]);

  return locationName;
};
