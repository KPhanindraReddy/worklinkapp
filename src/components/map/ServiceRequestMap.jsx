import clsx from 'clsx';
import { LocateFixed, MapPin, Navigation, RadioTower, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { formatDistanceKm } from '../../utils/formatters';
import { normalizeCoordinates } from '../../utils/location';

const fallbackPinPositions = [
  { left: '22%', top: '26%' },
  { left: '76%', top: '30%' },
  { left: '64%', top: '62%' },
  { left: '29%', top: '70%' },
  { left: '83%', top: '54%' },
  { left: '43%', top: '22%' }
];

const clampPercent = (value, min = 9, max = 91) => Math.min(Math.max(value, min), max);

const getMapboxStaticUrl = (center) => {
  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  const normalizedCenter = normalizeCoordinates(center);

  if (!mapboxToken || !normalizedCenter) {
    return '';
  }

  const longitude = normalizedCenter.longitude.toFixed(5);
  const latitude = normalizedCenter.latitude.toFixed(5);

  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${longitude},${latitude},14,0/960x540?logo=false&attribution=false&access_token=${encodeURIComponent(mapboxToken)}`;
};

const getPinPosition = ({ labour, index, center }) => {
  const mapCenter = normalizeCoordinates(center);
  const workerCoordinates = normalizeCoordinates(labour?.coordinates);

  if (mapCenter && workerCoordinates) {
    const latitudeDelta = workerCoordinates.latitude - mapCenter.latitude;
    const longitudeDelta = workerCoordinates.longitude - mapCenter.longitude;

    return {
      left: `${clampPercent(50 + longitudeDelta * 3600)}%`,
      top: `${clampPercent(50 - latitudeDelta * 3600, 14, 74)}%`
    };
  }

  return fallbackPinPositions[index % fallbackPinPositions.length];
};

export const ServiceRequestMap = ({
  center,
  labours = [],
  selectedLabourId = '',
  onSelectLabour,
  searching = false,
  title = 'Your current location',
  subtitle = 'Live GPS location',
  centerLabel = 'Your live location',
  emptyLabel = 'Choose a service to show nearby labour',
  directionsUrl = '',
  className,
  children
}) => {
  const normalizedCenter = normalizeCoordinates(center);
  const mapboxStaticUrl = useMemo(() => getMapboxStaticUrl(normalizedCenter), [normalizedCenter]);
  const [mapImageFailed, setMapImageFailed] = useState(false);
  const showMapboxImage = Boolean(mapboxStaticUrl && !mapImageFailed);

  useEffect(() => {
    setMapImageFailed(false);
  }, [mapboxStaticUrl]);

  return (
    <div
      className={clsx(
        'relative min-h-[420px] overflow-hidden rounded-[28px] border border-slate-300 bg-[#eef3f1] shadow-soft sm:min-h-[500px]',
        className
      )}
    >
      {showMapboxImage ? (
        <img
          src={mapboxStaticUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setMapImageFailed(true)}
        />
      ) : (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.32)_1px,transparent_1px),linear-gradient(rgba(148,163,184,0.32)_1px,transparent_1px)] bg-[length:58px_58px]" />
          <div className="absolute inset-0">
            <div className="absolute left-[-16%] top-[18%] h-12 w-[134%] rotate-[-9deg] bg-white shadow-sm" />
            <div className="absolute left-[-12%] top-[58%] h-14 w-[126%] rotate-[11deg] bg-white shadow-sm" />
            <div className="absolute left-[44%] top-[-14%] h-[132%] w-12 rotate-[6deg] bg-white shadow-sm" />
            <div className="absolute left-[9%] top-[-12%] h-[128%] w-10 rotate-[-18deg] bg-white/95 shadow-sm" />
            <div className="absolute left-[14%] top-[14%] h-16 w-28 rounded-xl bg-emerald-200/80" />
            <div className="absolute right-[9%] top-[39%] h-20 w-36 rounded-xl bg-sky-200/75" />
            <div className="absolute left-[53%] top-[72%] h-14 w-28 rounded-xl bg-emerald-200/70" />
          </div>
        </>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-white/50" />

      {searching ? (
        <div className="absolute inset-0 z-20 bg-white/20 backdrop-blur-[1px]">
          <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-400/40" />
          <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border border-brand-500/30" />
          <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-4 border-transparent border-t-brand-600" />
          <div className="absolute left-1/2 top-[calc(50%+4.8rem)] -translate-x-1/2 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white shadow-soft">
            Searching nearby labour
          </div>
        </div>
      ) : null}

      <div className="absolute left-1/2 top-[42%] z-30 -translate-x-1/2 -translate-y-1/2">
        <div className="relative grid h-16 w-16 place-items-center rounded-full border-[5px] border-white bg-brand-600 text-white shadow-glow">
          <LocateFixed size={25} />
          <span className="absolute inset-[-12px] rounded-full border border-brand-500/35" />
          <span className="absolute inset-[-24px] rounded-full border border-brand-500/20" />
        </div>
        <div className="mt-2 rounded-full bg-slate-950 px-3 py-1 text-center text-xs font-semibold text-white shadow-soft">
          {normalizedCenter ? centerLabel : 'Set location'}
        </div>
      </div>

      {labours.slice(0, 6).map((labour, index) => {
        const selected = selectedLabourId === labour.id;
        const pinStyle = getPinPosition({ labour, index, center: normalizedCenter });
        const PinElement = onSelectLabour ? 'button' : 'div';

        return (
          <PinElement
            key={labour.id}
            type={onSelectLabour ? 'button' : undefined}
            onClick={onSelectLabour ? () => onSelectLabour(labour) : undefined}
            className="absolute z-40 -translate-x-1/2 -translate-y-1/2 text-left"
            style={pinStyle}
            aria-label={onSelectLabour ? `Select ${labour.fullName}` : undefined}
          >
            <div
              className={clsx(
                'grid h-12 w-12 place-items-center rounded-full border-4 bg-white shadow-soft transition',
                selected ? 'scale-110 border-brand-600 text-brand-700' : 'border-emerald-500 text-emerald-700'
              )}
            >
              <UserCheck size={19} />
            </div>
            <div className="mt-2 max-w-[150px] rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-soft">
              <p className="truncate text-xs font-bold text-slate-950">{labour.fullName}</p>
              <p className="truncate text-[11px] font-medium text-slate-600">
                {formatDistanceKm(labour.distanceKm)}
              </p>
            </div>
          </PinElement>
        );
      })}

      <div className="absolute left-4 top-4 z-40 flex flex-wrap gap-2">
        <Badge tone={normalizedCenter ? 'emerald' : 'amber'} className="bg-white/95">
          <RadioTower size={12} />
          {normalizedCenter ? 'GPS active' : 'GPS pending'}
        </Badge>
        {showMapboxImage ? (
          <Badge tone="slate" className="bg-white/95">
            Mapbox
          </Badge>
        ) : null}
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-50 rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-soft backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{title}</p>
            <p className="mt-1 truncate text-xs font-medium text-slate-600">
              {labours.length ? `${labours.length} nearby workers for this view` : subtitle || emptyLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {directionsUrl ? (
              <Button as="a" href={directionsUrl} target="_blank" rel="noreferrer" size="sm" variant="outline">
                <Navigation size={15} />
                Directions
              </Button>
            ) : (
              <Badge tone="blue" className="gap-1">
                <MapPin size={12} />
                Live map
              </Badge>
            )}
          </div>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  );
};
