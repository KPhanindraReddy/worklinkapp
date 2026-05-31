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

export const fetchMapboxCoordinatesForAddress = async (address) => {
  const mapboxToken = getMapboxAccessToken();
  const trimmedAddress = String(address ?? '').trim();

  if (!trimmedAddress || !mapboxToken) {
    return null;
  }

  const query = new URLSearchParams({
    access_token: mapboxToken,
    limit: '1',
    country: 'in',
    types: 'address,neighborhood,locality,place,district'
  });
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmedAddress)}.json?${query.toString()}`
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const feature = payload?.features?.[0];
  const longitude = Number(feature?.center?.[0]);
  const latitude = Number(feature?.center?.[1]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    coordinates: { latitude, longitude },
    label: String(feature?.place_name ?? trimmedAddress).trim()
  };
};
