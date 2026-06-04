import { useMemo } from 'react';
import { useLocationName } from '../../hooks/useLocationName';
import {
  getDisplayLocationText,
  isCoordinateLabel,
  normalizeCoordinates
} from '../../utils/location';

export const LocationText = ({
  location = '',
  coordinates = null,
  fallback = 'Live location shared',
  prefix = ''
}) => {
  const normalizedCoordinates = useMemo(() => normalizeCoordinates(coordinates), [coordinates]);
  const resolvedLocationName = useLocationName(normalizedCoordinates);
  const locationText = String(location ?? '').trim();
  const shouldPreferResolvedName = !locationText || isCoordinateLabel(locationText) || /live location/i.test(locationText);
  const displayText = shouldPreferResolvedName
    ? resolvedLocationName || getDisplayLocationText(locationText, fallback)
    : getDisplayLocationText(locationText, resolvedLocationName || fallback);

  return (
    <>
      {prefix}
      {displayText}
    </>
  );
};
