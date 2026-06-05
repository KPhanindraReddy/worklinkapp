import { Link } from 'react-router-dom';
import clsx from 'clsx';

export const BrandLogo = ({ className, onClick, to = '/', showTagline = false }) => {
  const content = (
    <span className="min-w-0">
      <img
        src="/slivz-logo-512.png"
        alt="Slivz"
        width="40"
        height="40"
        loading="eager"
        decoding="sync"
        fetchPriority="high"
        className="h-9 w-9 rounded-2xl object-cover shadow-glow sm:h-10 sm:w-10"
      />
      {showTagline ? (
        <span className="hidden truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:block">
          Trusted local work
        </span>
      ) : null}
    </span>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={clsx('flex min-w-0 items-center gap-2 sm:gap-3', className)}
        onClick={onClick}
        aria-label="Slivz home"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={clsx('flex min-w-0 items-center gap-2 sm:gap-3', className)}>
      {content}
    </div>
  );
};
