import { normalizeCoordinates } from './location';

export const getMapboxAccessToken = () =>
  [
    import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
    import.meta.env.VITE_MAPBOX_TOKEN,
    import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN,
    import.meta.env.REACT_APP_MAPBOX_ACCESS_TOKEN
  ]
    .map((value) => String(value ?? '').trim())
    .find(Boolean) ?? '';

export const buildMapboxReverseGeocodeUrl = (coordinates) => {
  const normalizedCoordinates = normalizeCoordinates(coordinates);
  const mapboxToken = getMapboxAccessToken();

  if (!normalizedCoordinates || !mapboxToken) {
    return '';
  }

  const longitude = normalizedCoordinates.longitude.toFixed(5);
  const latitude = normalizedCoordinates.latitude.toFixed(5);
  const query = new URLSearchParams({
    access_token: mapboxToken,
    limit: '1',
    types: 'address,neighborhood,locality,place,district'
  });

  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?${query.toString()}`;
};

export const fetchMapboxLocationName = async (coordinates) => {
  const reverseGeocodeUrl = buildMapboxReverseGeocodeUrl(coordinates);

  if (!reverseGeocodeUrl) {
    return '';
  }

  const response = await fetch(reverseGeocodeUrl);

  if (!response.ok) {
    return '';
  }

  const payload = await response.json();
  return String(payload?.features?.[0]?.place_name ?? '').trim();
};
