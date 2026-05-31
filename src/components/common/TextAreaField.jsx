export const TextAreaField = ({ label, className = '', ...props }) => (
  <label className={`block min-w-0 max-w-full space-y-1.5 ${className}`}>
    {label ? <span className="text-[12px] font-semibold tracking-[0.03em] text-slate-500 sm:text-[13px]">{label}</span> : null}
    <textarea
      className="min-h-24 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500 disabled:shadow-none sm:min-h-28 sm:px-3.5 sm:text-[13px]"
      {...props}
    />
  </label>
);
