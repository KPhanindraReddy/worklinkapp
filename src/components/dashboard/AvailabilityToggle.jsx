import { availabilityOptions } from '../../utils/constants';

export const AvailabilityToggle = ({ value, onChange }) => (
  <div className="grid grid-cols-3 gap-1 rounded-[14px] border border-slate-200 bg-slate-50 p-1">
    {availabilityOptions.map((option) => (
      <button
        key={option}
        type="button"
        className={`min-h-10 w-full rounded-xl px-2 text-sm font-semibold transition sm:min-h-11 ${
          value === option
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'text-slate-500 hover:bg-white hover:text-slate-900'
        }`}
        onClick={() => onChange(option)}
      >
        {option}
      </button>
    ))}
  </div>
);
