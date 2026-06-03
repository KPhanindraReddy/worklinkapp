import { BrandLogo } from '../layout/BrandLogo';

export const AppLoadingState = ({ title = 'Loading WorkLink', description = 'Preparing your workspace...' }) => (
  <div className="grid min-h-[calc(100dvh-4rem)] place-items-center bg-slate-50 px-4 py-12">
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-[0_16px_42px_rgba(15,23,42,0.08)]">
      <div className="flex justify-center">
        <BrandLogo showTagline={false} />
      </div>
      <div className="mx-auto mt-5 h-10 w-10 animate-spin rounded-full border-4 border-slate-100 border-t-brand-600" />
      <h1 className="mt-5 text-base font-bold text-slate-950">{title}</h1>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  </div>
);
