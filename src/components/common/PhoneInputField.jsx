import { getIndianLocalPhoneNumber, normalizeIndianPhoneNumber } from '../../utils/phone';

export const PhoneInputField = ({ label = 'Phone number', hint, className = '', value, onChange, onBlur, ...props }) => {
  const localValue = getIndianLocalPhoneNumber(value);

  const handleChange = (event) => {
    const nextValue = normalizeIndianPhoneNumber(event.target.value);

    onChange?.({
      ...event,
      target: {
        ...event.target,
        value: nextValue
      }
    });
  };

  const handleBlur = (event) => {
    onChange?.({
      ...event,
      target: {
        ...event.target,
        value: normalizeIndianPhoneNumber(event.target.value)
      }
    });
    onBlur?.(event);
  };

  return (
    <label className={`block min-w-0 max-w-full space-y-1.5 ${className}`}>
      {label ? <span className="text-[12px] font-semibold tracking-[0.03em] text-slate-500 sm:text-[13px]">{label}</span> : null}
      <span className="flex min-h-10 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100 sm:min-h-11 sm:text-[13px]">
        <span className="inline-flex flex-none items-center gap-1.5 border-r border-slate-200 bg-white px-2.5 font-bold text-slate-800 sm:px-3">
          <span aria-hidden="true">🇮🇳</span>
          <span>+91</span>
        </span>
        <input
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 sm:px-3.5 sm:text-[13px]"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          placeholder="9876543210"
          {...props}
        />
      </span>
      {hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
};
