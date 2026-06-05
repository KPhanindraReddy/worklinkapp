import { LocateFixed } from 'lucide-react';
import { Button } from '../common/Button';

export const isLocationPermissionDenied = (geolocation = {}) =>
  geolocation.permission === 'denied' ||
  /permission denied/i.test(String(geolocation.error || ''));

export const LocationPermissionPrompt = ({
  geolocation,
  onRequest,
  className = '',
  compact = false
}) => {
  if (!isLocationPermissionDenied(geolocation)) {
    return null;
  }

  const handleRequest = async () => {
    await onRequest?.();
  };

  return (
    <div className={`rounded-[14px] border border-amber-200 bg-amber-50 p-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold text-amber-950">
          {geolocation?.error ||
            (compact
              ? 'Location permission is blocked.'
              : 'Location permission is blocked. Allow location for this site, then try again.')}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full border-amber-300 bg-white sm:w-auto"
          onClick={handleRequest}
          disabled={geolocation?.loading}
        >
          <LocateFixed size={15} />
          {geolocation?.loading ? 'Requesting...' : 'Try again'}
        </Button>
      </div>
      <div className="mt-3 rounded-xl border border-amber-200 bg-white/80 p-3 text-xs font-semibold leading-5 text-amber-950">
        <p>Allow location, then tap Try again.</p>
        <ul className="mt-2 space-y-1">
          <li>Android Chrome - lock icon - Site settings - Location - Allow</li>
          <li>iPhone Safari - Settings - Privacy & Security - Location Services - Safari Websites - While Using</li>
          <li>Edge/Chrome desktop - lock icon - Site settings - Location - Allow</li>
          <li>Firefox - lock icon - Permissions - Location - Allow</li>
        </ul>
      </div>
    </div>
  );
};
