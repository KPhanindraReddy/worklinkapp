import { CalendarDays, Clock3 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Card } from '../common/Card';

const timeSlots = [
  '08:00 AM',
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM',
  '07:00 PM',
  '08:00 PM'
];

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const isPastSlot = (selectedDate, slot) => {
  if (!selectedDate || selectedDate !== getTodayKey()) {
    return false;
  }

  const match = /^(\d{1,2}):00\s*(AM|PM)$/i.exec(slot);
  if (!match) {
    return false;
  }

  let hour = Number(match[1]);
  hour %= 12;

  if (match[2].toUpperCase() === 'PM') {
    hour += 12;
  }

  return hour <= new Date().getHours();
};

export const BookingCalendar = ({
  selectedDate,
  selectedSlot,
  onDateChange,
  onSlotChange
}) => {
  const availableSlots = useMemo(
    () => timeSlots.filter((slot) => !isPastSlot(selectedDate, slot)),
    [selectedDate]
  );

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    if (!availableSlots.includes(selectedSlot)) {
      onSlotChange(availableSlots[0] || '');
    }
  }, [availableSlots, onSlotChange, selectedDate, selectedSlot]);

  const handleDateChange = (event) => {
    onDateChange(event.target.value);
    onSlotChange('');
  };

  return (
    <Card className="grid gap-4 sm:gap-6 lg:grid-cols-[0.82fr_1.18fr]">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-brand-600">
          <CalendarDays size={18} />
          <p className="font-semibold">Pick date</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          min={getTodayKey()}
          onChange={handleDateChange}
          className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:ring-brand-500/20"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-brand-600">
          <Clock3 size={18} />
          <p className="font-semibold">Pick 1 hour slot</p>
        </div>
        {selectedDate ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {availableSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                className={`min-h-11 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                  selectedSlot === slot
                    ? 'border-brand-500 bg-brand-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50'
                }`}
                onClick={() => onSlotChange(slot)}
              >
                {slot}
              </button>
            ))}
            {!availableSlots.length ? (
              <div className="col-span-full rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                No slots left today. Pick another date.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
            Pick a date first.
          </div>
        )}
      </div>
    </Card>
  );
};
