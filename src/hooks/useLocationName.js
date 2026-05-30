import { useEffect, useState } from 'react';
import { fetchMapboxLocationName } from '../utils/mapbox';
import { normalizeCoordinates } from '../utils/location';

export const useLocationName = (coordinates) => {
  const [locationName, setLocationName] = useState('');
  const normalizedCoordinates = normalizeCoordinates(coordinates);
  const latitude = normalizedCoordinates?.latitude ?? null;
  const longitude = normalizedCoordinates?.longitude ?? null;

  useEffect(() => {
    const normalizedLookup = normalizeCoordinates({ latitude, longitude });

    if (!normalizedLookup) {
      setLocationName('');
      return undefined;
    }

    let isActive = true;

    fetchMapboxLocationName(normalizedLookup)
      .then((placeName) => {
        if (!isActive) {
          return;
        }

        setLocationName(placeName || '');
      })
      .catch(() => {
        if (isActive) {
          setLocationName('');
        }
      });

    return () => {
      isActive = false;
    };
  }, [latitude, longitude]);

  return locationName;
};
