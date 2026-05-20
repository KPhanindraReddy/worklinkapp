import clsx from 'clsx';
import { NavLink } from 'react-router-dom';

export const DashboardSidebar = ({ items }) => (
  <aside className="surface-card h-fit p-2 xl:sticky xl:top-24 xl:p-2.5">
    <nav className="flex min-w-0 flex-wrap gap-2 xl:grid">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className="block"
        >
          {({ isActive }) => {
            const Icon = item.icon;

            return (
              <span
                className={clsx(
                  'flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition sm:whitespace-nowrap',
                  isActive
                    ? 'border-brand-600 bg-brand-600 text-white shadow-glow'
                    : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950'
                )}
              >
                {Icon ? (
                  <span
                    className={clsx(
                      'grid h-8 w-8 place-items-center rounded-xl',
                      isActive ? 'bg-white/14 text-white' : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    <Icon size={16} />
                  </span>
                ) : null}
                <span>{item.label}</span>
              </span>
            );
          }}
        </NavLink>
      ))}
    </nav>
  </aside>
);
