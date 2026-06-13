import { Suspense, lazy, useEffect } from 'react';
import clsx from 'clsx';
import { useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import { BottomDockNav } from './BottomDockNav';
import { Navbar } from './Navbar';
import { useAuth } from '../../context/AuthContext';
import { LiveLocationSync } from './LiveLocationSync';
import { NotificationToaster } from './NotificationToaster';
import { NativePushNotifications } from './NativePushNotifications';

const RequestRoutingController = lazy(() =>
  import('../booking/RequestRoutingController').then((module) => ({
    default: module.RequestRoutingController
  }))
);

const LazyRequestRoutingController = () => {
  const { currentUser, userProfile } = useAuth();

  if (!currentUser || !userProfile?.role) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <RequestRoutingController />
    </Suspense>
  );
};

const AppLiveLocationSync = () => {
  const { currentUser, userProfile } = useAuth();

  if (!currentUser || !userProfile?.role) {
    return null;
  }

  return <LiveLocationSync currentUser={currentUser} userProfile={userProfile} />;
};

const useVisualViewportHeight = () => {
  useEffect(() => {
    const updateViewportHeight = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--app-visual-height', `${height}px`);
    };

    updateViewportHeight();
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('scroll', updateViewportHeight);
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('scroll', updateViewportHeight);
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
    };
  }, []);
};

export const AppShell = ({
  children,
  contentClassName,
  hideBottomDock = false,
  hideFooter = false,
  hideNavbar = false
}) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  useVisualViewportHeight();

  return (
    <div className="app-root">
      {hideNavbar ? null : <Navbar />}
      <NotificationToaster currentUser={currentUser} />
      <NativePushNotifications currentUser={currentUser} />
      <AppLiveLocationSync />
      <LazyRequestRoutingController />
      <div className={clsx('app-shell-content', !hideBottomDock && 'app-shell-content--dock', contentClassName)}>
        <main key={location.pathname} className="app-page-swap">{children}</main>
        {hideFooter ? null : <Footer />}
      </div>
      {hideBottomDock ? null : <BottomDockNav />}
    </div>
  );
};
