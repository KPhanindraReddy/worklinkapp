import { Search } from 'lucide-react';
import { Button } from '../common/Button';

export const HeroSearch = ({
  query,
  onQueryChange,
  onSearch,
  placeholder
}) => (
  <form
    onSubmit={onSearch}
    className="w-full max-w-xl"
  >
    <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <label className="flex min-w-0 flex-1 items-center gap-2 px-2">
        <Search size={17} className="flex-none text-slate-400" />
        <input
          aria-label="Search labour"
          value={query}
          placeholder={placeholder}
          className="h-10 w-full min-w-0 border-0 bg-transparent p-0 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <Button type="submit" className="h-10 w-10 rounded-xl p-0" aria-label="Search">
        <Search size={17} />
      </Button>
    </div>
  </form>
);
