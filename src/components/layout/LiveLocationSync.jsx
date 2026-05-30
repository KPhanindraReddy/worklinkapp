import { useEffect, useRef } from 'react';
import { useGeolocation } from '../../hooks/useGeolocation';
import { updateLiveUserLocation } from '../../services/userService';
import {
  hasMovedBeyondThreshold,
  normalizeCoordinates
} from '../../utils/location';

const SYNC_INTERVAL_MS = 2 * 60 * 1000;
const MIN_SYNC_INTERVAL_MS = 20000;

export const LiveLocationSync = ({ currentUser, userProfile }) => {
  const geolocation = useGeolocation();
  const lastSyncedCoordinatesRef = useRef(null);
  const lastSyncAtRef = useRef(0);

  useEffect(() => {
    if (!currentUser?.uid || !['client', 'labour'].includes(userProfile?.role)) {
      return undefined;
    }

    let isActive = true;
    let intervalId = null;

    const syncLocation = async ({ force = false } = {}) => {
      const now = Date.now();

      if (!force && now - lastSyncAtRef.current < MIN_SYNC_INTERVAL_MS) {
        return;
      }

      const coordinates = await geolocation.requestLocation({ force: true });

      if (!isActive || !coordinates) {
        return;
      }

      const normalizedCoordinates = normalizeCoordinates(coordinates);
      const previousCoordinates =
        lastSyncedCoordinatesRef.current || normalizeCoordinates(userProfile?.coordinates);

      if (
        !force &&
        previousCoordinates &&
        !hasMovedBeyondThreshold(previousCoordinates, normalizedCoordinates, 25)
      ) {
        return;
      }

      try {
        await updateLiveUserLocation({
          uid: currentUser.uid,
          role: userProfile.role,
          coordinates: normalizedCoordinates
        });
        lastSyncedCoordinatesRef.current = normalizedCoordinates;
        lastSyncAtRef.current = Date.now();
      } catch (error) {
        console.warn('WorkLink live location sync skipped:', error?.code ?? error?.message ?? error);
      }
    };

    syncLocation({ force: true });
    intervalId = window.setInterval(() => syncLocation(), SYNC_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncLocation({ force: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.uid, geolocation.requestLocation, userProfile?.role]);

  return null;
};
