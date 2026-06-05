import {
  ArrowRight,
  BriefcaseBusiness,
  Home,
  MapPin,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { PageSEO } from '../components/common/PageSEO';
import { ServiceAnimations } from '../components/home/ServiceAnimations';
import { AppShell } from '../components/layout/AppShell';
import { LocationPermissionPrompt } from '../components/location/LocationPermissionPrompt';
import { useAuth } from '../context/AuthContext';
import { heroStats } from '../data/mockData';
import { useGeolocation } from '../hooks/useGeolocation';
import { resolvePostAuthPath } from '../utils/authFlow';

const statLabels = ['Workers', 'Service', 'Response'];

const quickPaths = [
  {
    title: 'I need help',
    description: 'Find nearby workers and book quickly.',
    to: '/auth?role=client&mode=signup',
    icon: Home,
    className: 'border-sky-200 bg-sky-50 text-sky-900',
    action: 'Hire workers'
  },
  {
    title: 'I want to earn',
    description: 'Create your profile and accept local jobs.',
    to: '/auth?role=labour&mode=signup',
    icon: BriefcaseBusiness,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    action: 'Join free'
  }
];

const steps = [
  {
    title: 'Search',
    description: 'Choose the service you need.',
    color: 'bg-sky-600'
  },
  {
    title: 'Book',
    description: 'Pick an available worker.',
    color: 'bg-emerald-600'
  },
  {
    title: 'Finish',
    description: 'Complete work and review.',
    color: 'bg-orange-500'
  }
];

const HomePage = () => {
  const { currentUser, userProfile, loading } = useAuth();
  const geolocation = useGeolocation();
  const handleRefreshLocation = () => {
    return geolocation.requestLocation({ force: true });
  };

  if (currentUser) {
    if (loading) {
      return null;
    }

    return <Navigate to={resolvePostAuthPath({ profile: userProfile })} replace />;
  }

  return (
    <AppShell contentClassName="bg-slate-50">
      <PageSEO />

      <section className="border-b border-slate-200 bg-white">
        <div className="page-shell grid gap-4 py-5 sm:py-7 lg:py-9">
          <div className="min-w-0">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <MapPin size={14} />
              <span className="truncate">Local labour, simple booking</span>
            </div>
            <h1 className="mt-4 max-w-3xl break-words font-display text-[2rem] font-bold leading-[1.08] text-slate-950 sm:text-4xl lg:text-5xl">
              Find trusted workers near you.
            </h1>
            <p className="mt-3 max-w-xl break-words text-sm leading-6 text-slate-600 sm:text-base">
              Service persons are available for instant time service near you.
            </p>

            <p className="mt-3 text-sm font-semibold text-slate-950">Search service name from below services.</p>
            <LocationPermissionPrompt
              geolocation={geolocation}
              onRequest={handleRefreshLocation}
              className="mt-3 max-w-2xl"
            />

            <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl">
              {heroStats.map((item, index) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center">
                  <p className="font-display text-sm font-bold text-slate-950 sm:text-lg">{item.value}</p>
                  <p className="mt-1 text-[11px] font-medium text-slate-500 sm:text-xs">{statLabels[index]}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      <section className="py-2.5 sm:py-4">
        <div className="page-shell">
          <div className="grid grid-cols-2 gap-2">
            {quickPaths.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.title}
                  to={item.to}
                  className={`rounded-xl border p-2 transition hover:-translate-y-0.5 hover:shadow-soft ${item.className}`}
                >
                  <Icon size={17} />
                  <h2 className="mt-1.5 text-[13px] font-bold leading-tight">{item.title}</h2>
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-3.5 opacity-80">{item.description}</p>
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold">
                    {item.action}
                    <ArrowRight size={11} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pb-6 sm:pb-8">
        <div className="page-shell">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-brand-700">Popular now</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Nearby services</h2>
              <p className="mt-1 text-sm text-slate-500">Below services are provided. Tap to contact or register.</p>
            </div>
          </div>
          <ServiceAnimations />
        </div>
      </section>

      <section className="pb-5 sm:pb-7">
        <div className="page-shell grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="flex gap-3 rounded-[16px] border border-slate-200 bg-white p-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
              <span className={`grid h-8 w-8 flex-none place-items-center rounded-full text-sm font-bold text-white ${step.color}`}>
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-950">{step.title}</span>
                <span className="mt-1 block text-sm leading-5 text-slate-600">{step.description}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-8">
        <div className="page-shell">
          <div className="flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-white p-5 text-slate-950 shadow-[0_16px_44px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">Ready to start?</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Choose your account and continue.</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-none">
              <Button as={Link} to="/auth?role=client&mode=signup" variant="secondary">
                Client register
              </Button>
              <Button as={Link} to="/auth?role=labour&mode=signup">
                Labour register
              </Button>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
};

export default HomePage;
