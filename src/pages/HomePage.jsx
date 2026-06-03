import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Hammer,
  Home,
  MapPin,
  Paintbrush,
  PlugZap,
  ShieldCheck,
  Search as SearchIcon,
  Sparkles,
  Star,
  Wrench
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LabourCard } from '../components/cards/LabourCard';
import { AppLoadingState } from '../components/common/AppLoadingState';
import { Button } from '../components/common/Button';
import { PageSEO } from '../components/common/PageSEO';
import { SectionHeading } from '../components/common/SectionHeading';
import { HeroSearch } from '../components/home/HeroSearch';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../context/AuthContext';
import { heroStats, serviceCategories } from '../data/mockData';
import { useVoiceSearch } from '../hooks/useVoiceSearch';
import { resolvePostAuthPath } from '../utils/authFlow';

const featuredCategoryNames = [
  'Electrician',
  'Plumbing',
  'Carpenter',
  'Painting',
  'AC repair',
  'Cleaner'
];

const statLabels = ['Workers', 'Bookings', 'Response'];

const serviceVisuals = {
  Electrician: { icon: PlugZap, accent: 'bg-amber-500', tint: 'bg-amber-50 text-amber-700' },
  Plumbing: { icon: Wrench, accent: 'bg-sky-500', tint: 'bg-sky-50 text-sky-700' },
  Carpenter: { icon: Hammer, accent: 'bg-orange-500', tint: 'bg-orange-50 text-orange-700' },
  Painting: { icon: Paintbrush, accent: 'bg-rose-500', tint: 'bg-rose-50 text-rose-700' },
  'AC repair': { icon: Sparkles, accent: 'bg-cyan-500', tint: 'bg-cyan-50 text-cyan-700' },
  Cleaner: { icon: ShieldCheck, accent: 'bg-emerald-500', tint: 'bg-emerald-50 text-emerald-700' }
};

const quickPaths = [
  {
    title: 'I need help',
    description: 'Book nearby workers for repairs, shifting, loading, cleaning, and daily jobs.',
    to: '/auth?role=client&mode=signup',
    icon: Home,
    className: 'border-sky-200 bg-sky-50 text-sky-900',
    action: 'Hire workers'
  },
  {
    title: 'I want to earn',
    description: 'Create a labour profile, list your skills, and accept local work requests.',
    to: '/auth?role=labour&mode=signup',
    icon: BriefcaseBusiness,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    action: 'Join free'
  }
];

const steps = [
  {
    title: 'Post your need',
    description: 'Share the task, location, and best time for the work.',
    color: 'bg-sky-600'
  },
  {
    title: 'Match nearby',
    description: 'Find available workers with skills, ratings, and profiles.',
    color: 'bg-emerald-600'
  },
  {
    title: 'Book and finish',
    description: 'Chat, confirm the booking, pay fairly, and leave a review.',
    color: 'bg-orange-500'
  }
];

const HomePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, userProfile, loading } = useAuth();
  const [query, setQuery] = useState('');
  const [featuredLabours, setFeaturedLabours] = useState([]);
  const { isListening, startListening } = useVoiceSearch({
    lang: 'en-IN',
    onResult: setQuery
  });
  const homepageCategories = featuredCategoryNames
    .map((name) => serviceCategories.find((category) => category.name === name))
    .filter(Boolean);

  useEffect(() => {
    if (currentUser) {
      return undefined;
    }

    let isActive = true;

    import('../services/labourService')
      .then(({ fetchFeaturedLabours }) => fetchFeaturedLabours())
      .then((labours) => {
        if (isActive) {
          setFeaturedLabours(labours);
        }
      })
      .catch((error) => {
        console.warn('WorkLink featured labour load skipped:', error?.code ?? error?.message ?? error);

        if (isActive) {
          setFeaturedLabours([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [currentUser]);

  if (currentUser) {
    if (loading) {
      return (
        <AppShell>
          <AppLoadingState title="Opening your dashboard" description="Checking your WorkLink profile..." />
        </AppShell>
      );
    }

    return <Navigate to={resolvePostAuthPath({ profile: userProfile })} replace />;
  }

  return (
    <AppShell contentClassName="bg-white">
      <PageSEO />

      <section className="bg-slate-950 text-white">
        <div className="page-shell grid min-h-[calc(100dvh-4rem)] gap-6 py-5 sm:py-8 lg:min-h-[620px] lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:py-10">
          <div className="min-w-0">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">
              <MapPin size={14} />
              <span className="truncate">Workers available near you right now</span>
            </div>
            <h1 className="mt-4 max-w-3xl break-words font-display text-[2rem] font-bold leading-[1.08] sm:text-5xl lg:text-6xl">
              {t('home.title')}
              <span className="block text-sky-300">Hire local. Pay fair.</span>
            </h1>
            <p className="mt-4 max-w-2xl break-words text-sm leading-6 text-slate-300 sm:text-base">
              {t('home.subtitle')}
            </p>

            <div className="mt-5 max-w-3xl">
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

            <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-2xl sm:gap-3">
              {heroStats.map((item, index) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-white/10 p-3 text-center">
                  <p className="font-display text-base font-bold text-white sm:text-xl">{item.value}</p>
                  <p className="mt-1 text-[11px] font-medium text-slate-400 sm:text-xs">{statLabels[index]}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="grid gap-3 lg:gap-4">
            <div className="rounded-2xl border border-white/10 bg-white p-3 text-slate-950 shadow-soft sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">Live preview</p>
                  <h2 className="mt-1 text-lg font-bold">Popular nearby</h2>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white">
                  <SearchIcon size={18} />
                </span>
              </div>
              <div className="mt-4 grid gap-2">
                {homepageCategories.slice(0, 4).map((category) => {
                  const visual = serviceVisuals[category.name] ?? serviceVisuals.Cleaner;
                  const Icon = visual.icon;

                  return (
                    <Link
                      key={category.id}
                      to={`/search?query=${encodeURIComponent(category.name)}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 transition hover:border-brand-200 hover:bg-brand-50"
                    >
                      <span className="inline-flex min-w-0 items-center gap-3">
                        <span className={`grid h-9 w-9 flex-none place-items-center rounded-lg ${visual.tint}`}>
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{category.name}</span>
                          <span className="block text-xs text-slate-500">{category.openRequests}+ active</span>
                        </span>
                      </span>
                      <ArrowRight size={16} className="flex-none text-slate-400" />
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
                    className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-soft ${item.className}`}
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

      <section className="section-space">
        <div className="page-shell grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
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

      <section className="section-space pt-2">
        <div className="page-shell">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeading eyebrow="Services" title="Popular services" />
            <Button as={Link} to="/search" variant="outline" size="sm">
              View all
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {homepageCategories.map((category) => {
              const visual = serviceVisuals[category.name] ?? serviceVisuals.Cleaner;
              const Icon = visual.icon;

              return (
                <Link
                  key={category.id}
                  to={`/search?query=${encodeURIComponent(category.name)}`}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft"
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

      <section className="section-space pt-2">
        <div className="page-shell">
          <SectionHeading eyebrow="Labour" title="Top rated workers" />
          {featuredLabours.length ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {featuredLabours.slice(0, 4).map((labour) => (
                <LabourCard key={labour.id} labour={labour} compact />
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { name: 'Ravi Kumar', skill: 'Electrician', loc: 'Hyderabad', rating: '4.8' },
                  { name: 'Suresh', skill: 'Plumbing', loc: 'Chennai', rating: '4.7' },
                  { name: 'Phani', skill: 'Welding', loc: 'Bengaluru', rating: '4.9' }
                ].map((worker) => (
                  <div key={worker.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-base font-bold text-white">
                        {worker.name.charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 text-sm font-bold text-slate-950">
                          {worker.name}
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        </span>
                        <span className="block text-xs text-slate-500">{worker.skill} in {worker.loc}</span>
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                        <Star size={14} fill="currentColor" />
                        {worker.rating}
                      </span>
                      <Button as={Link} to="/search" size="sm">Book</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section-space pt-2">
        <div className="page-shell">
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">Ready for hiring and work</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
                One place for clients to find labour and workers to earn from local jobs.
              </p>
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
