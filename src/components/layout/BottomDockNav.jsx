import clsx from 'clsx';
import { Bell, BriefcaseBusiness, ClipboardList, History, House, IndianRupee, Search, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { routeByRole } from '../../utils/authFlow';
import { matchesRoutePath } from '../../utils/routeMatching';

export const buildBottomDockItems = ({ currentUser, userProfile }) => {
  const role = userProfile?.role;
  const homeTarget = currentUser ? routeByRole(role) : '/';

  if (role === 'labour') {
    return [
      {
        label: 'Home',
        to: homeTarget,
        icon: House,
        matchers: [homeTarget]
      },
      {
        label: 'Services',
        to: '/labour/services',
        icon: ClipboardList,
        matchers: ['/labour/services']
      },
      {
        label: 'Earnings',
        to: '/labour/earnings',
        icon: IndianRupee,
        matchers: ['/labour/earnings']
      },
      {
        label: 'Profile',
        to: '/settings',
        icon: UserRound,
        matchers: ['/settings', '/complete-profile*']
      }
    ];
  }

  if (role === 'admin') {
    return [
      {
        label: 'Home',
        to: homeTarget,
        icon: House,
        matchers: [homeTarget]
      },
      {
        label: 'Alerts',
        to: '/notifications',
        icon: Bell,
        matchers: ['/notifications']
      },
      {
        label: 'Profile',
        to: '/settings',
        icon: UserRound,
        matchers: ['/settings', '/complete-profile*']
      }
    ];
  }

  return [
    {
      label: 'Home',
      to: homeTarget,
      icon: House,
      matchers: currentUser ? [homeTarget] : ['/']
    },
    {
      label: 'Search',
      to: '/search',
      icon: Search,
      matchers: [
        '/search',
        '/booking*',
        (pathname) => pathname.startsWith('/labour/') && pathname !== '/labour/dashboard'
      ]
    },
    {
      label: currentUser ? 'Services' : 'Client',
      to: currentUser ? '/recent-services' : '/auth?role=client&mode=login',
      icon: currentUser ? History : UserRound,
      matchers: currentUser ? ['/recent-services'] : ['/auth']
    },
    {
      label: currentUser ? 'Profile' : 'Labour',
      to: currentUser ? '/settings' : '/auth?role=labour&mode=login',
      icon: currentUser ? UserRound : BriefcaseBusiness,
      matchers: currentUser ? ['/settings', '/complete-profile*'] : ['/auth']
    }
  ];
};

export const BottomDockNav = () => {
  const { pathname } = useLocation();
  const { currentUser, userProfile } = useAuth();
  const items = useMemo(
    () => buildBottomDockItems({ currentUser, userProfile }),
    [currentUser, userProfile]
  );

  return (
    <div className="app-bottom-dock pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-2 lg:hidden">
      <nav
        className="pointer-events-auto w-full max-w-[460px] rounded-[26px] border border-slate-200 bg-white/95 px-2 py-1.5 shadow-[0_-10px_32px_rgba(15,23,42,0.12)] backdrop-blur-2xl"
        aria-label="Mobile primary navigation"
      >
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = matchesRoutePath(pathname, item.matchers);

            return (
              <Link
                key={item.label}
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'min-h-[3.25rem] touch-manipulation rounded-2xl border border-transparent px-1 py-1 text-center transition duration-200',
                  isActive
                    ? 'bg-brand-50 text-brand-900'
                    : 'bg-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                )}
              >
                <span
                  className={clsx(
                    'mx-auto grid h-7 w-7 place-items-center rounded-xl transition',
                    isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400'
                  )}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </span>
                <span
                  className={clsx(
                    'mt-0.5 block min-h-[1rem] text-[11px] font-semibold leading-tight',
                    isActive ? 'text-brand-900' : 'text-slate-400'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
