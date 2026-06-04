import { CalendarDays, Clock3 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Card } from '../common/Card';

const clampNumber = (value, min, max, fallback) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(numericValue), min), max);
};

const parseSelectedSlot = (value) => {
  const match = /^(\d{1,2}):(\d{1,2})\s*(AM|PM)$/i.exec(String(value || '').trim());

  if (!match) {
    return { hour: 9, minute: 0, period: 'AM' };
  }

  return {
    hour: clampNumber(match[1], 1, 12, 9),
    minute: clampNumber(match[2], 0, 59, 0),
    period: match[3].toUpperCase()
  };
};

const formatSlot = ({ hour, minute, period }) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;

export const BookingCalendar = ({
  selectedDate,
  selectedSlot,
  onDateChange,
  onSlotChange
}) => {
  const timeParts = useMemo(() => parseSelectedSlot(selectedSlot), [selectedSlot]);

  useEffect(() => {
    if (!selectedSlot) {
      onSlotChange(formatSlot(timeParts));
    }
  }, [onSlotChange, selectedSlot, timeParts]);

  const updateTimePart = (key, value) => {
    const nextParts = {
      ...timeParts,
      [key]:
        key === 'period'
          ? value
          : clampNumber(value, key === 'hour' ? 1 : 0, key === 'hour' ? 12 : 59, timeParts[key])
    };

    onSlotChange(formatSlot(nextParts));
  };

  return (
    <Card className="grid gap-4 sm:gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-brand-600">
          <CalendarDays size={18} />
          <p className="font-semibold">Pick date</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(event) => onDateChange(event.target.value)}
          className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:ring-brand-500/20"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-brand-600">
          <Clock3 size={18} />
          <p className="font-semibold">Pick time</p>
        </div>
        <div className="grid grid-cols-[1fr_1fr_92px] gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Hour</span>
            <input
              type="number"
              min="1"
              max="12"
              step="1"
              inputMode="numeric"
              value={timeParts.hour}
              onChange={(event) => updateTimePart('hour', event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Min</span>
            <input
              type="number"
              min="0"
              max="59"
              step="5"
              inputMode="numeric"
              value={timeParts.minute}
              onChange={(event) => updateTimePart('minute', event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">AM/PM</span>
            <select
              value={timeParts.period}
              onChange={(event) => updateTimePart('period', event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </label>
        </div>
      </div>
    </Card>
  );
};
