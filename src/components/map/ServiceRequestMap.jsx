import clsx from 'clsx';
import { MapPin, Minus, Navigation, Plus, RadioTower, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { formatDistanceKm } from '../../utils/formatters';
import { normalizeCoordinates } from '../../utils/location';
import { getMapboxAccessToken } from '../../utils/mapbox';

const fallbackPinPositions = [
  { left: '22%', top: '26%' },
  { left: '76%', top: '30%' },
  { left: '64%', top: '62%' },
  { left: '29%', top: '70%' },
  { left: '83%', top: '54%' },
  { left: '43%', top: '22%' }
];

const MAPBOX_STATIC_SIZE = 1280;
const MAP_TILE_SIZE = 512;

const clampNumber = (value, min, max) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.min(Math.max(numericValue, min), max) : min;
};
const clampPercent = (value, min = 9, max = 91) => Math.min(Math.max(value, min), max);

const getMapboxStaticUrl = (center, zoomLevel) => {
  const mapboxToken = getMapboxAccessToken();
  const normalizedCenter = normalizeCoordinates(center);

  if (!mapboxToken || !normalizedCenter) {
    return '';
  }

  const longitude = normalizedCenter.longitude.toFixed(5);
  const latitude = normalizedCenter.latitude.toFixed(5);
  const zoom = clampNumber(zoomLevel, 3, 18).toFixed(2);

  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${longitude},${latitude},${zoom},0/${MAPBOX_STATIC_SIZE}x${MAPBOX_STATIC_SIZE}?logo=false&attribution=false&access_token=${encodeURIComponent(mapboxToken)}`;
};

const getGoogleEmbedMapUrl = (center, zoomLevel) => {
  const normalizedCenter = normalizeCoordinates(center);

  if (!normalizedCenter) {
    return '';
  }

  const latitude = normalizedCenter.latitude.toFixed(6);
  const longitude = normalizedCenter.longitude.toFixed(6);
  const zoom = Math.round(clampNumber(zoomLevel, 3, 18));

  return `https://www.google.com/maps?q=${latitude},${longitude}&ll=${latitude},${longitude}&z=${zoom}&output=embed`;
};

const getWorldPoint = (coordinates, zoomLevel) => {
  const latitude = clampNumber(coordinates.latitude, -85.05113, 85.05113);
  const longitude = clampNumber(coordinates.longitude, -180, 180);
  const sinLatitude = Math.sin((latitude * Math.PI) / 180);
  const scale = MAP_TILE_SIZE * 2 ** zoomLevel;

  return {
    x: ((longitude + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) *
      scale
  };
};

const getProjectedPinPosition = ({ center, target, zoomLevel }) => {
  const centerPoint = getWorldPoint(center, zoomLevel);
  const targetPoint = getWorldPoint(target, zoomLevel);
  const left = 50 + ((targetPoint.x - centerPoint.x) / MAPBOX_STATIC_SIZE) * 100;
  const top = 48 + ((targetPoint.y - centerPoint.y) / MAPBOX_STATIC_SIZE) * 100;

  return {
    left: `${clampPercent(left, 8, 92)}%`,
    top: `${clampPercent(top, 14, 68)}%`
  };
};

const getPinPosition = ({ labour, index, center, zoomLevel }) => {
  const mapCenter = normalizeCoordinates(center);
  const workerCoordinates = normalizeCoordinates(labour?.liveCoordinates || labour?.coordinates);

  if (mapCenter && workerCoordinates) {
    return getProjectedPinPosition({
      center: mapCenter,
      target: workerCoordinates,
      zoomLevel
    });
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
  subtitle = 'Live location',
  centerLabel = 'Your live location',
  showCenterLabel = true,
  emptyLabel = 'Choose a service to show nearby labour',
  directionsUrl = '',
  className,
  sheetClassName,
  showRoutePreview = false,
  showZoomControls = true,
  showInteractiveMap = true,
  initialZoom = 14,
  minZoom = 9,
  maxZoom = 17,
  children
}) => {
  const normalizedCenter = normalizeCoordinates(center);
  const [zoomLevel, setZoomLevel] = useState(() => clampNumber(initialZoom, minZoom, maxZoom));
  const mapboxStaticUrl = useMemo(
    () => getMapboxStaticUrl(normalizedCenter, zoomLevel),
    [normalizedCenter, zoomLevel]
  );
  const [mapImageFailed, setMapImageFailed] = useState(false);
  const interactiveMapUrl = useMemo(
    () => (showInteractiveMap ? getGoogleEmbedMapUrl(normalizedCenter, zoomLevel) : ''),
    [normalizedCenter, showInteractiveMap, zoomLevel]
  );
  const showMapboxImage = Boolean(!interactiveMapUrl && mapboxStaticUrl && !mapImageFailed);
  const selectedLabourIndex = useMemo(
    () => labours.findIndex((labour) => labour.id === selectedLabourId),
    [labours, selectedLabourId]
  );
  const selectedLabour = selectedLabourIndex >= 0 ? labours[selectedLabourIndex] : null;
  const selectedLabourPosition = selectedLabour
    ? getPinPosition({
        labour: selectedLabour,
        index: selectedLabourIndex,
        center: normalizedCenter,
        zoomLevel
      })
    : null;

  useEffect(() => {
    setMapImageFailed(false);
  }, [mapboxStaticUrl]);

  useEffect(() => {
    setZoomLevel(clampNumber(initialZoom, minZoom, maxZoom));
  }, [initialZoom, maxZoom, minZoom]);

  const updateZoom = (amount) => {
    setZoomLevel((currentZoom) => clampNumber(currentZoom + amount, minZoom, maxZoom));
  };

  return (
    <div
      className={clsx(
        'relative min-h-[520px] overflow-hidden rounded-[28px] border border-slate-300 bg-[#eef3f1] shadow-soft sm:min-h-[560px]',
        className
      )}
    >
      {interactiveMapUrl ? (
        <iframe
          title={title ? `${title} map` : 'Interactive location map'}
          src={interactiveMapUrl}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : showMapboxImage ? (
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

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-white/50" />

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

      {showRoutePreview && selectedLabourPosition ? (
        <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true">
          <line
            x1="50%"
            y1="48%"
            x2={selectedLabourPosition.left}
            y2={selectedLabourPosition.top}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <line
            x1="50%"
            y1="48%"
            x2={selectedLabourPosition.left}
            y2={selectedLabourPosition.top}
            stroke="rgba(15,23,42,0.82)"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      ) : null}

      <div className="pointer-events-none absolute left-1/2 top-[48%] z-30 -translate-x-1/2 -translate-y-1/2">
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
        const pinStyle = getPinPosition({ labour, index, center: normalizedCenter, zoomLevel });
        const PinElement = onSelectLabour ? 'button' : 'div';

        return (
          <PinElement
            key={labour.id}
            type={onSelectLabour ? 'button' : undefined}
            onClick={onSelectLabour ? () => onSelectLabour(labour) : undefined}
            className="absolute z-40 -translate-x-1/2 -translate-y-1/2 text-left"
            style={pinStyle}
            aria-label={onSelectLabour ? `Select ${labour.fullName}` : undefined}
            aria-pressed={onSelectLabour ? selected : undefined}
          >
            <div
              className={clsx(
                'grid h-12 w-12 place-items-center rounded-full border-4 bg-white shadow-soft transition',
                selected ? 'scale-110 border-brand-600 text-brand-700' : 'border-emerald-500 text-emerald-700'
              )}
            >
              <UserCheck size={19} />
            </div>
            <div className="mt-2 max-w-[120px] rounded-xl border border-slate-200 bg-white/95 px-2 py-1.5 shadow-soft sm:max-w-[150px] sm:rounded-2xl sm:px-3 sm:py-2">
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
        {interactiveMapUrl ? (
          <Badge tone="slate" className="bg-white/95">
            Movable map
          </Badge>
        ) : showMapboxImage ? (
          <Badge tone="slate" className="bg-white/95">
            Mapbox
          </Badge>
        ) : null}
      </div>

      {showZoomControls ? (
        <div className="absolute right-4 top-4 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-soft backdrop-blur">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center text-slate-900 transition hover:bg-slate-100 disabled:text-slate-300"
            onClick={() => updateZoom(1)}
            disabled={zoomLevel >= maxZoom}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Plus size={17} />
          </button>
          <div className="h-px bg-slate-200" />
          <button
            type="button"
            className="grid h-10 w-10 place-items-center text-slate-900 transition hover:bg-slate-100 disabled:text-slate-300"
            onClick={() => updateZoom(-1)}
            disabled={zoomLevel <= minZoom}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <Minus size={17} />
          </button>
        </div>
      ) : null}

      <div
        className={clsx(
          'absolute bottom-4 left-4 right-4 z-50 rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-soft backdrop-blur',
          sheetClassName
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{title}</p>
            <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-600">
              {subtitle || emptyLabel}
            </p>
            {labours.length ? (
              <p className="mt-1 text-xs font-semibold text-brand-700">
                {labours.length} nearby workers in this service
              </p>
            ) : null}
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
