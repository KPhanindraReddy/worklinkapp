import { ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export const AutocompleteSelect = ({
  label,
  options = [],
  value = '',
  onChange,
  placeholder = 'Type to search...',
  className = '',
  getAvailability = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const filteredOptions = search
    ? options.filter(opt => {
        const label = typeof opt === 'string' ? opt : opt.label;
        return label.toLowerCase().startsWith(search.toLowerCase());
      })
    : options;

  const selectedLabel = value
    ? (options.find(opt => (typeof opt === 'string' ? opt : opt.value) === value)?.label ?? value)
    : '';

  const handleSelect = (option) => {
    const val = typeof option === 'string' ? option : option.value;
    onChange?.({ target: { value: val } });
    setSearch('');
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % filteredOptions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        break;
      default:
        break;
    }
  };

  const handleInputChange = (e) => {
    setSearch(e.target.value);
    setHighlightedIndex(0);
    setIsOpen(true);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSearch('');
    onChange?.({ target: { value: '' } });
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <label className={`block min-w-0 max-w-full space-y-1.5 ${className}`} ref={containerRef}>
      {label ? (
        <span className="text-[12px] font-semibold tracking-[0.03em] text-slate-500 sm:text-[13px]">
          {label}
        </span>
      ) : null}

      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
          <input
            ref={inputRef}
            type="text"
            value={search || selectedLabel}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="min-h-6 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:text-[13px]"
            autoComplete="off"
          />
          {(search || selectedLabel) && (
            <button
              type="button"
              onClick={handleClear}
              className="flex-none text-slate-400 hover:text-slate-600"
              aria-label="Clear selection"
            >
              <X size={16} />
            </button>
          )}
          <ChevronDown size={16} className="flex-none text-slate-400" />
        </div>

        {isOpen && filteredOptions.length > 0 && (
          <div className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {filteredOptions.map((option, index) => {
              const optLabel = typeof option === 'string' ? option : option.label;
              const optValue = typeof option === 'string' ? option : option.value;
              const availability = getAvailability?.(optValue);

              return (
                <button
                  key={optValue}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full px-3 py-2.5 text-left text-sm transition ${
                    index === highlightedIndex
                      ? 'bg-brand-50 text-brand-900'
                      : 'text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{optLabel}</span>
                    {availability && (
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${
                        availability === 'Available'
                          ? 'bg-emerald-100 text-emerald-700'
                          : availability === 'Busy'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-slate-100 text-slate-700'
                      }`}>
                        {availability}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {isOpen && filteredOptions.length === 0 && search && (
          <div className="absolute top-full z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm text-slate-500 shadow-lg">
            No matches for "{search}"
          </div>
        )}
      </div>
    </label>
  );
};
