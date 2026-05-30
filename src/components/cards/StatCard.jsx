import { Card } from '../common/Card';
import { Skeleton } from '../common/Skeleton';

export const StatCard = ({ label, value, hint, loading = false }) => (
  <Card className="rounded-2xl p-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
    {loading ? (
      <Skeleton className="mt-2 h-7 w-20" />
    ) : (
      <h3 className="mt-1.5 font-display text-xl font-bold text-slate-950 dark:text-white">{value}</h3>
    )}
    {hint ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{hint}</p> : null}
  </Card>
);
