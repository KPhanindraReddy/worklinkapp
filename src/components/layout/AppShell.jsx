import { Suspense, lazy } from 'react';
import clsx from 'clsx';
import { Footer } from './Footer';
import { BottomDockNav } from './BottomDockNav';
import { Navbar } from './Navbar';
import { useAuth } from '../../context/AuthContext';
import { LiveLocationSync } from './LiveLocationSync';

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

export const AppShell = ({ children, contentClassName, hideBottomDock = false, hideFooter = false }) => (
  <div className="min-h-screen">
    <Navbar />
    <AppLiveLocationSync />
    <LazyRequestRoutingController />
    <div className={clsx(!hideBottomDock && 'app-shell-content', contentClassName)}>
      <main>{children}</main>
      {hideFooter ? null : <Footer />}
    </div>
    {hideBottomDock ? null : <BottomDockNav />}
  </div>
);
