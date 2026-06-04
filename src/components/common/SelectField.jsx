export const SelectField = ({ label, options = [], className = '', ...props }) => (
  <label className={`block min-w-0 max-w-full space-y-1.5 ${className}`}>
    {label ? <span className="text-[12px] font-semibold tracking-[0.03em] text-slate-500 sm:text-[13px]">{label}</span> : null}
    <select
      className="min-h-10 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500 disabled:shadow-none sm:min-h-11 sm:px-3.5 sm:text-[13px] max-sm:min-h-12 max-sm:rounded-2xl max-sm:text-base"
      {...props}
    >
      {props.placeholder ? <option value="">{props.placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value ?? option} value={option.value ?? option}>
          {option.label ?? option}
        </option>
      ))}
    </select>
  </label>
);
