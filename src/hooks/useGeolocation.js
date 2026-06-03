import { useCallback, useEffect, useState } from 'react';
import { hasCoordinates } from '../utils/location';

const defaultState = {
  latitude: null,
  longitude: null,
  loading: false,
  error: null,
  permission: 'prompt'
};

let sharedState = defaultState;
let requestPromise = null;
const subscribers = new Set();

const mapGeolocationError = (error) => {
  const code = Number(error?.code);

  if (code === 1) {
    return 'Location permission denied. Allow location access in browser settings.';
  }

  if (code === 2) {
    return 'Could not detect your location. Check GPS/network and try again.';
  }

  if (code === 3) {
    return 'Location request timed out. Move to open sky and try again.';
  }

  return error?.message || 'Could not fetch your live location.';
};

const syncPermissionState = async () => {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return;
  }

  try {
    const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
    broadcast({
      ...sharedState,
      permission: permissionStatus.state || 'prompt'
    });

    permissionStatus.onchange = () => {
      broadcast({
        ...sharedState,
        permission: permissionStatus.state || 'prompt'
      });
    };
  } catch {
    // Ignore permission-query failures; geolocation calls still work.
  }
};

const broadcast = (nextState) => {
  sharedState = nextState;
  subscribers.forEach((subscriber) => subscriber(nextState));
};

const requestSharedLocation = ({ force = false } = {}) => {
  if (!force && hasCoordinates(sharedState)) {
    return Promise.resolve({
      latitude: sharedState.latitude,
      longitude: sharedState.longitude
    });
  }

  if (typeof navigator === 'undefined') {
    return Promise.resolve(null);
  }

  if (!navigator.geolocation) {
    broadcast({
      ...defaultState,
      permission: sharedState.permission || 'prompt',
      error: 'Live location is not supported in this browser.'
    });
    return Promise.resolve(null);
  }

  if (sharedState.permission === 'denied') {
    broadcast({
      ...sharedState,
      loading: false,
      error: 'Location permission denied. Allow location access in browser settings.'
    });
    return Promise.resolve(null);
  }

  if (requestPromise) {
    return requestPromise;
  }

  broadcast({
    ...sharedState,
    loading: true,
    error: null
  });

  requestPromise = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextState = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          loading: false,
          error: null,
          permission: 'granted'
        };

        broadcast(nextState);
        requestPromise = null;
        resolve({
          latitude: nextState.latitude,
          longitude: nextState.longitude
        });
      },
      (error) => {
        broadcast({
          ...sharedState,
          loading: false,
          permission: Number(error?.code) === 1 ? 'denied' : sharedState.permission,
          error: mapGeolocationError(error)
        });
        requestPromise = null;
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: force ? 0 : 600000,
        timeout: 15000
      }
    );
  });

  return requestPromise;
};

const clearSharedError = () => {
  if (sharedState.error) {
    broadcast({
      ...sharedState,
      error: null
    });
  }
};

export const useGeolocation = (enabled = false) => {
  const [state, setState] = useState(sharedState);

  const requestLocation = useCallback((options = {}) => requestSharedLocation(options), []);
  const clearError = useCallback(() => clearSharedError(), []);

  useEffect(() => {
    subscribers.add(setState);
    setState(sharedState);
    syncPermissionState();

    return () => {
      subscribers.delete(setState);
    };
  }, []);

  useEffect(() => {
    if (enabled) {
      requestLocation();
    }
  }, [enabled, requestLocation]);

  return {
    ...state,
    requestLocation,
    clearError,
    hasLocation: hasCoordinates(state)
  };
};
