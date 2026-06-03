import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CircleHelp,
  ClipboardList,
  ChevronDown,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  UserRound,
  X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Button } from '../common/Button';
import { ProfileAvatar } from '../common/ProfileAvatar';
import { useAuth } from '../../context/AuthContext';
import { subscribeNotifications } from '../../services/notificationService';
import { subscribeConversations } from '../../services/chatService';
import { routeByRole } from '../../utils/authFlow';
import { matchesRoutePath } from '../../utils/routeMatching';
import { buildProfileAvatarDataUrl } from '../../utils/profileAvatar';
import { BrandLogo } from './BrandLogo';

const linkClassName = ({ isActive }) =>
  clsx(
    'inline-flex min-h-10 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-brand-50 text-brand-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
  );

const actionButtonClass = (isActive) =>
  clsx(
    'relative grid h-10 w-10 touch-manipulation place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-brand-200 hover:text-brand-700',
    isActive && 'border-brand-200 bg-brand-50 text-brand-700'
  );

const unreadBadgeClass =
  'absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white shadow-sm';

const ProfileMenu = ({
  compact = false,
  isActive,
  onDashboard,
  onLogout,
  onSettings,
  profilePhoto,
  profileLabel,
  profileName,
  role
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const avatarSrc = profilePhoto || buildProfileAvatarDataUrl(profileName || profileLabel || 'Profile');
  const dashboardLabel =
    role === 'client' ? 'Dashboard' : role === 'labour' ? 'Dashboard' : role === 'admin' ? 'Dashboard' : 'Dashboard';

  return (
    <div className="relative">
      <button
        type="button"
        className={clsx(
          compact
            ? 'grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white p-0 shadow-sm transition hover:border-brand-200'
            : 'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 pr-3 shadow-sm transition hover:border-brand-200',
          isActive && (compact ? 'ring-2 ring-brand-200 ring-offset-2' : 'border-brand-200 bg-brand-50')
        )}
        onClick={() => setIsProfileOpen((prev) => !prev)}
        aria-label={`Open ${profileLabel.toLowerCase()} menu`}
        aria-expanded={isProfileOpen}
      >
        <ProfileAvatar
          src={avatarSrc}
          name={profileName || profileLabel}
          className={compact ? 'h-10 w-10 rounded-full' : 'h-8 w-8 rounded-full'}
          loading="eager"
          decoding="sync"
        />
        {!compact ? (
          <span className="hidden max-w-[104px] truncate text-sm font-semibold text-slate-700 xl:block">
            {profileName || profileLabel}
          </span>
        ) : null}
        <ChevronDown size={14} className={clsx('hidden text-slate-400 xl:block', compact ? 'ml-0' : 'ml-0.5')} />
      </button>

      {isProfileOpen ? (
        <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-soft">
          <div className="border-b border-slate-100 px-3 py-3">
            <div className="flex items-center gap-3">
              <ProfileAvatar
                src={avatarSrc}
                name={profileName || profileLabel}
                className="h-10 w-10 rounded-full"
                loading="eager"
                decoding="sync"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">{profileName || profileLabel}</div>
                <div className="truncate text-xs text-slate-500">{role ? role.charAt(0).toUpperCase() + role.slice(1) : ''}</div>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
            onClick={() => {
              setIsProfileOpen(false);
              onDashboard?.();
            }}
          >
            <LayoutDashboard size={16} />
            {dashboardLabel}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
            onClick={() => {
              setIsProfileOpen(false);
              onSettings?.();
            }}
          >
            <UserRound size={16} />
            Settings
          </button>
          {role === 'labour' ? (
            <Link
              to="/labour/earnings"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
              onClick={() => setIsProfileOpen(false)}
            >
              <IndianRupee size={16} />
              Earnings
            </Link>
          ) : null}
          {role === 'client' ? (
            <Link
              to="/recent-services"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
              onClick={() => setIsProfileOpen(false)}
            >
              <ClipboardList size={16} />
              Recent services
            </Link>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
            onClick={async () => {
              setIsProfileOpen(false);
              await onLogout();
            }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
};

export const Navbar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { currentUser, userProfile, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const primaryPath = currentUser ? routeByRole(userProfile?.role) : '/';
  const profileLabel = userProfile?.role === 'admin' ? 'Admin profile' : 'Profile';
  const profilePhoto = userProfile?.profilePhoto || currentUser?.photoURL || '';
  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    navigate('/auth', { replace: true });
  };
  const handleDashboard = () => {
    if (userProfile?.role === 'labour') {
      navigate('/labour/dashboard');
      return;
    }

    if (userProfile?.role === 'client') {
      navigate('/client/dashboard');
      return;
    }

    if (userProfile?.role === 'admin') {
      navigate('/admin');
    }
  };
  const handleSettings = () => {
    navigate('/settings');
  };

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setUnreadNotifications(0);
      return undefined;
    }

    return subscribeNotifications(
      currentUser.uid,
      (items) => {
        setUnreadNotifications(items.filter((item) => !item.read).length);
      },
      () => setUnreadNotifications(0)
    );
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setUnreadChats(0);
      return undefined;
    }

    return subscribeConversations(
      currentUser.uid,
      (items) => {
        setUnreadChats(
          items.filter(
            (item) => item.lastMessage && item.readBy?.[currentUser.uid] === false
          ).length
        );
      },
      () => setUnreadChats(0)
    );
  }, [currentUser?.uid]);

  const baseLinks = currentUser
    ? [
        ...(userProfile?.role === 'client'
          ? [
              {
                to: '/client/dashboard',
                label: 'Overview',
                icon: LayoutDashboard,
                matchers: ['/client/dashboard']
              }
            ]
          : []),
        ...(userProfile?.role === 'labour'
          ? [
              {
                to: '/labour/dashboard',
                label: 'Overview',
                icon: LayoutDashboard,
                matchers: ['/labour/dashboard']
              },
              {
                to: '/labour/services',
                label: 'Services',
                icon: ClipboardList,
                matchers: ['/labour/services']
              },
              {
                to: '/labour/earnings',
                label: 'Earnings',
                icon: IndianRupee,
                matchers: ['/labour/earnings']
              }
            ]
          : []),
        ...(userProfile?.role === 'admin'
          ? [{ to: '/admin', label: 'Overview', icon: LayoutDashboard, matchers: ['/admin'] }]
          : []),
        ...(userProfile?.role === 'client'
          ? [
              {
                to: '/search',
                label: 'Search Service',
                icon: Search,
                matchers: [
                  '/search',
                  '/booking*',
                  (nextPathname) =>
                    nextPathname.startsWith('/labour/') && nextPathname !== '/labour/dashboard'
                ]
              }
            ]
          : []),
        { to: '/about', label: 'About', icon: CircleHelp, matchers: ['/about'] }
      ]
    : [
        { to: '/', label: 'Home', icon: LayoutDashboard, matchers: ['/'] },
        {
          to: '/search',
          label: 'Search Service',
          icon: Search,
          matchers: [
            '/search',
            '/booking*',
            (nextPathname) =>
              nextPathname.startsWith('/labour/') && nextPathname !== '/labour/dashboard'
          ]
        },
        { to: '/about', label: 'About', icon: CircleHelp, matchers: ['/about'] }
      ];

  const quickLinks = currentUser
    ? [
        { to: '/notifications', label: 'Notifications', icon: Bell, matchers: ['/notifications'] },
        { to: '/chat', label: 'Chat', icon: MessageCircle, matchers: ['/chat'] }
      ]
    : [];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
      <div className="page-shell relative flex items-center justify-between gap-2 py-2.5 sm:gap-3 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 lg:flex-none lg:justify-start sm:gap-3">
          <BrandLogo
            to={primaryPath}
            onClick={() => setIsOpen(false)}
            showTagline
            className="max-w-[9rem] sm:max-w-none"
          />
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:hidden">
            {currentUser ? (
              <>
                {quickLinks.map((link) => {
                  const Icon = link.icon;

                return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={actionButtonClass(matchesRoutePath(pathname, link.matchers))}
                      aria-label={link.label}
                      title={link.label}
                      onClick={() => setIsOpen(false)}
                    >
                      <Icon size={16} />
                      {link.label === 'Notifications' && unreadNotifications ? (
                        <span className={unreadBadgeClass}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>
                      ) : null}
                      {link.label === 'Chat' && unreadChats ? (
                        <span className={unreadBadgeClass}>{unreadChats > 99 ? '99+' : unreadChats}</span>
                      ) : null}
                    </Link>
                  );
                })}
              <ProfileMenu
                compact
                isActive={matchesRoutePath(pathname, ['/settings', '/complete-profile*'])}
                onDashboard={handleDashboard}
                onSettings={handleSettings}
                onLogout={handleLogout}
                profileLabel={profileLabel}
                profilePhoto={profilePhoto}
                profileName={userProfile?.fullName}
                role={userProfile?.role}
              />
              </>
            ) : (
              <Button
                as={Link}
                to="/auth?role=client&mode=login"
                size="sm"
                className="hidden px-2.5 sm:inline-flex"
                onClick={() => setIsOpen(false)}
              >
                Login
              </Button>
            )}
          </div>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {baseLinks.map((link) => {
            const Icon = link.icon;

            return (
              <Link
                key={link.to}
                to={link.to}
                className={linkClassName({ isActive: matchesRoutePath(pathname, link.matchers) })}
              >
                <Icon size={15} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {currentUser ? (
            <>
              {quickLinks.map((link) => {
                const Icon = link.icon;

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={actionButtonClass(matchesRoutePath(pathname, link.matchers))}
                    aria-label={link.label}
                    title={link.label}
                  >
                    <Icon size={16} />
                    {link.label === 'Notifications' && unreadNotifications ? (
                      <span className={unreadBadgeClass}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>
                    ) : null}
                    {link.label === 'Chat' && unreadChats ? (
                      <span className={unreadBadgeClass}>{unreadChats > 99 ? '99+' : unreadChats}</span>
                    ) : null}
                  </Link>
                );
              })}
              <ProfileMenu
                isActive={matchesRoutePath(pathname, ['/settings', '/complete-profile*'])}
                onDashboard={handleDashboard}
                onSettings={handleSettings}
                onLogout={handleLogout}
                profileLabel={profileLabel}
                profilePhoto={profilePhoto}
                profileName={userProfile?.fullName}
                role={userProfile?.role}
              />
            </>
          ) : (
            <Button as={Link} to="/auth?role=client&mode=login" variant="primary">
              Sign in
            </Button>
          )}
        </div>

      </div>

      {isOpen ? (
        <div className="page-shell max-h-[calc(100dvh-4.25rem)] space-y-3 overflow-y-auto border-t border-slate-200 pb-4 pt-3 lg:hidden">
          <div className="flex flex-col gap-1">
            {baseLinks.map((link) => {
              const Icon = link.icon;

              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={clsx(
                    linkClassName({ isActive: matchesRoutePath(pathname, link.matchers) }),
                    'w-full justify-start'
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon size={15} />
                  {link.label}
                </Link>
              );
            })}
          </div>
          {currentUser ? (
            <Link
              to="/settings"
              className="inline-flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2"
              onClick={() => setIsOpen(false)}
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {profileInitial}
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-950">
                  {userProfile?.fullName || profileLabel}
                </span>
                <span className="block text-xs text-slate-500">
                  {userProfile?.role === 'admin' ? 'Admin profile & settings' : 'Profile & settings'}
                </span>
              </span>
            </Link>
          ) : (
            <Button
              as={Link}
              to="/auth?role=client&mode=login"
              className="w-full"
              onClick={() => setIsOpen(false)}
            >
              Sign in
            </Button>
          )}
        </div>
      ) : null}
    </header>
  );
};
