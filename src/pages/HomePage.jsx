import {
  ArrowRight,
  BriefcaseBusiness,
  Boxes,
  Brush,
  Hammer,
  Home,
  MapPin,
  Paintbrush,
  PlugZap,
  Search as SearchIcon,
  Sparkles,
  Truck,
  Wrench
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { PageSEO } from '../components/common/PageSEO';
import { HeroSearch } from '../components/home/HeroSearch';
import { AppShell } from '../components/layout/AppShell';
import { LocationPermissionPrompt } from '../components/location/LocationPermissionPrompt';
import { useAuth } from '../context/AuthContext';
import { heroStats } from '../data/mockData';
import { useGeolocation } from '../hooks/useGeolocation';
import { useVoiceSearch } from '../hooks/useVoiceSearch';
import { resolvePostAuthPath } from '../utils/authFlow';

const statLabels = ['Workers', 'Bookings', 'Response'];

const serviceVisuals = {
  Electrician: { icon: PlugZap, accent: 'bg-amber-500', tint: 'bg-amber-50 text-amber-700' },
  Plumbing: { icon: Wrench, accent: 'bg-sky-500', tint: 'bg-sky-50 text-sky-700' },
  Carpenter: { icon: Hammer, accent: 'bg-orange-500', tint: 'bg-orange-50 text-orange-700' },
  Painting: { icon: Paintbrush, accent: 'bg-rose-500', tint: 'bg-rose-50 text-rose-700' },
  'AC repair': { icon: Sparkles, accent: 'bg-cyan-500', tint: 'bg-cyan-50 text-cyan-700' },
  Cleaning: { icon: Brush, accent: 'bg-emerald-500', tint: 'bg-emerald-50 text-emerald-700' },
  'Home shifting': { icon: Boxes, accent: 'bg-indigo-500', tint: 'bg-indigo-50 text-indigo-700' },
  'Lorry loading': { icon: Truck, accent: 'bg-violet-500', tint: 'bg-violet-50 text-violet-700' }
};

const homepageCategories = [
  { id: 'service-electrician', name: 'Electrician', openRequests: 14 },
  { id: 'service-plumbing', name: 'Plumbing', openRequests: 15 },
  { id: 'service-home-shifting', name: 'Home shifting', openRequests: 9 },
  { id: 'service-lorry-loading', name: 'Lorry loading', openRequests: 7 },
  { id: 'service-cleaning', name: 'Cleaning', openRequests: 20 },
  { id: 'service-ac-repair', name: 'AC repair', openRequests: 12 }
];

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, userProfile, loading } = useAuth();
  const geolocation = useGeolocation();
  const [query, setQuery] = useState('');
  const { isListening, startListening } = useVoiceSearch({
    lang: 'en-IN',
    onResult: setQuery
  });
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
        <div className="page-shell grid min-h-[calc(100dvh-5rem)] gap-6 py-5 sm:py-8 lg:min-h-[590px] lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div className="min-w-0">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <MapPin size={14} />
              <span className="truncate">Local labour, simple booking</span>
            </div>
            <h1 className="mt-4 max-w-3xl break-words font-display text-[2rem] font-bold leading-[1.08] text-slate-950 sm:text-4xl lg:text-5xl">
              Find trusted workers near you.
            </h1>
            <p className="mt-3 max-w-xl break-words text-sm leading-6 text-slate-600 sm:text-base">
              Search a service, choose nearby labour, and send a clear booking request.
            </p>

            <div className="mt-5 max-w-2xl rounded-[18px] border border-slate-200 bg-white p-2 shadow-[0_16px_44px_rgba(15,23,42,0.08)]">
              <HeroSearch
                query={query}
                onQueryChange={setQuery}
                onSearch={(event) => {
                  event.preventDefault();
                  navigate(`/search?query=${encodeURIComponent(query)}`);
                }}
                onVoiceSearch={startListening}
                isListening={isListening}
                placeholder={t('home.searchPlaceholder')}
              />
            </div>
            <LocationPermissionPrompt
              geolocation={geolocation}
              onRequest={handleRefreshLocation}
              className="mt-3 max-w-2xl"
            />

            <div className="mt-5 flex flex-wrap gap-2">
              <Button as={Link} to="/auth?role=client&mode=signup">
                Book a service
                <ArrowRight size={16} />
              </Button>
              <Button as={Link} to="/auth?role=labour&mode=signup" variant="outline">
                Join as labour
              </Button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-xl">
              {heroStats.map((item, index) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center">
                  <p className="font-display text-sm font-bold text-slate-950 sm:text-lg">{item.value}</p>
                  <p className="mt-1 text-[11px] font-medium text-slate-500 sm:text-xs">{statLabels[index]}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="grid gap-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-950 p-3 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)] sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-normal text-emerald-300">Popular now</p>
                  <h2 className="mt-1 text-lg font-bold">Nearby services</h2>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-950">
                  <SearchIcon size={18} />
                </span>
              </div>
              <div className="mt-3 grid gap-2">
                {homepageCategories.slice(0, 4).map((category) => {
                  const visual = serviceVisuals[category.name] ?? serviceVisuals.Cleaning;
                  const Icon = visual.icon;

                  return (
                    <Link
                      key={category.id}
                      to={`/search?query=${encodeURIComponent(category.name)}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2 transition hover:bg-white/15"
                    >
                      <span className="inline-flex min-w-0 items-center gap-3">
                        <span className={`grid h-9 w-9 flex-none place-items-center rounded-lg ${visual.tint}`}>
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-white">{category.name}</span>
                          <span className="block text-xs text-slate-300">{category.openRequests}+ active</span>
                        </span>
                      </span>
                      <ArrowRight size={16} className="flex-none text-slate-300" />
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {quickPaths.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.title}
                    to={item.to}
                    className={`rounded-[18px] border p-3.5 transition hover:-translate-y-0.5 hover:shadow-soft ${item.className}`}
                  >
                    <Icon size={23} />
                    <h2 className="mt-3 text-sm font-bold">{item.title}</h2>
                    <p className="mt-1 line-clamp-3 text-xs leading-5 opacity-80">{item.description}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold">
                      {item.action}
                      <ArrowRight size={13} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>
      </section>

      <section className="py-5 sm:py-7">
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

      <section className="pb-6 sm:pb-8">
        <div className="page-shell">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Popular services</h2>
              <p className="mt-1 text-sm text-slate-500">Start with what people book most.</p>
            </div>
            <Button as={Link} to="/search" variant="outline" size="sm">
              View all
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {homepageCategories.map((category) => {
              const visual = serviceVisuals[category.name] ?? serviceVisuals.Cleaning;
              const Icon = visual.icon;

              return (
                <Link
                  key={category.id}
                  to={`/search?query=${encodeURIComponent(category.name)}`}
                  className="group relative overflow-hidden rounded-[16px] border border-slate-200 bg-white p-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft"
                >
                  <span className={`absolute inset-x-0 top-0 h-1 ${visual.accent}`} />
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${visual.tint}`}>
                    <Icon size={21} />
                  </span>
                  <span className="mt-3 block truncate text-sm font-bold text-slate-950">{category.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">{category.openRequests}+ active workers</span>
                  <span className="mt-3 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-950 text-white transition group-hover:bg-brand-600">
                    <ArrowRight size={14} />
                  </span>
                </Link>
              );
            })}
          </div>
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
