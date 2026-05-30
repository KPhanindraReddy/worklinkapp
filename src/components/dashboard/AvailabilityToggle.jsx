import { availabilityOptions } from '../../utils/constants';
import { Button } from '../common/Button';

export const AvailabilityToggle = ({ value, onChange }) => (
  <div className="grid grid-cols-3 gap-2 sm:gap-3">
    {availabilityOptions.map((option) => (
      <Button
        key={option}
        type="button"
        variant={value === option ? 'primary' : 'outline'}
        size="sm"
        className={`min-h-14 w-full rounded-[14px] text-base font-semibold sm:min-h-12 ${
          value === option
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-white'
        }`}
        onClick={() => onChange(option)}
      >
        {option}
      </Button>
    ))}
  </div>
);
