import clsx from 'clsx';
import { MapPin, Navigation, RadioTower, UserCheck } from 'lucide-react';
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

  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${longitude},${latitude},16,0/1280x1280?logo=false&attribution=false&access_token=${encodeURIComponent(mapboxToken)}`;
};

const getPinPosition = ({ labour, index, center }) => {
  const mapCenter = normalizeCoordinates(center);
  const workerCoordinates = normalizeCoordinates(labour?.liveCoordinates || labour?.coordinates);

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
  showCenterLabel = true,
  emptyLabel = 'Choose a service to show nearby labour',
  directionsUrl = '',
  className,
  sheetClassName,
  showRoutePreview = false,
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
        'relative min-h-[520px] overflow-hidden rounded-[28px] border border-slate-300 bg-[#eef3f1] shadow-soft sm:min-h-[560px]',
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
            <div className="absolute left-[-16%] top-[16%] h-10 w-[134%] rotate-[-8deg] bg-white shadow-sm" />
            <div className="absolute left-[-14%] top-[55%] h-12 w-[130%] rotate-[9deg] bg-white shadow-sm" />
            <div className="absolute left-[44%] top-[-14%] h-[132%] w-10 rotate-[5deg] bg-white shadow-sm" />
            <div className="absolute left-[10%] top-[-12%] h-[128%] w-9 rotate-[-16deg] bg-white/95 shadow-sm" />
            <div className="absolute left-[13%] top-[13%] h-16 w-28 rounded-sm bg-emerald-200/80" />
            <div className="absolute right-[8%] top-[36%] h-20 w-36 rounded-sm bg-sky-200/75" />
            <div className="absolute left-[52%] top-[72%] h-14 w-28 rounded-sm bg-emerald-200/70" />
            <div className="absolute left-[2%] top-[74%] h-8 w-[72%] rotate-[24deg] bg-white shadow-sm" />
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

      {showRoutePreview ? (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div className="absolute left-[8%] top-[53%] h-[5px] w-[70%] bg-slate-800/75" />
          <div className="absolute right-[20%] top-[31%] h-[22%] w-[5px] bg-slate-800/75" />
          <div className="absolute left-[37%] top-[31%] h-[5px] w-[43%] bg-slate-800/75" />
          <div className="absolute left-[6%] top-[51%] h-8 w-8 rounded-full border-[6px] border-black bg-white" />
          <div className="absolute right-[18.5%] top-[28%] h-8 w-5 rounded-sm bg-black" />
          <div className="absolute left-[34%] top-[22%] max-w-[48%] rounded-sm bg-white px-3 py-2 shadow-soft">
            <p className="truncate text-sm font-bold text-slate-950">{title}</p>
            <p className="truncate text-xs font-medium text-slate-600">{subtitle}</p>
          </div>
        </div>
      ) : null}

      <div className="absolute left-1/2 top-[42%] z-30 -translate-x-1/2 -translate-y-1/2">
        <div className="relative grid h-10 w-10 place-items-center rounded-full bg-sky-500/15">
          <span className="absolute h-20 w-20 animate-ping rounded-full bg-sky-500/20" />
          <span className="grid h-7 w-7 place-items-center rounded-full border-[4px] border-white bg-sky-500 shadow-[0_10px_30px_rgba(14,165,233,0.45)]">
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
          </span>
        </div>
        {showCenterLabel ? (
          <div className="mt-2 rounded-full bg-slate-950 px-3 py-1 text-center text-xs font-semibold text-white shadow-soft">
            {normalizedCenter ? centerLabel : 'Set location'}
          </div>
        ) : null}
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

      <div
        className={clsx(
          'absolute bottom-4 left-4 right-4 z-50 rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-soft backdrop-blur',
          sheetClassName
        )}
      >
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
