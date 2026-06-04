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
        <p>Browser has blocked the popup. Allow location in browser settings, then tap Try again.</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>iPhone Safari: open iPhone Settings, Privacy & Security, Location Services, Safari Websites, then choose While Using.</li>
          <li>Chrome or Edge: tap the lock or site icon near the address bar, open Site settings, set Location to Allow.</li>
          <li>Firefox: tap the lock icon, remove the blocked location permission, then try again.</li>
          <li>Android phone: open browser settings, Site settings, Location, then allow slivz.com.</li>
        </ul>
      </div>
    </div>
  );
};
