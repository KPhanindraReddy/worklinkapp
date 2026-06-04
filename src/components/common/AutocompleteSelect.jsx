import { ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export const AutocompleteSelect = ({
  label,
  options = [],
  value = '',
  onChange,
  placeholder = 'Type to search...',
  className = '',
  getAvailability = null,
  allowCustom = false,
  customOptionLabel = 'Use',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const getOptionLabel = (option) => (typeof option === 'string' ? option : option.label);
  const getOptionValue = (option) => (typeof option === 'string' ? option : option.value);
  const normalizeText = (text) => String(text ?? '').trim().toLowerCase();

  const filteredOptions = search
    ? options.filter(opt => {
        const label = getOptionLabel(opt);
        return label.toLowerCase().includes(search.toLowerCase());
      })
    : options;
  const customValue = search.trim();
  const hasExactMatch = options.some((option) => normalizeText(getOptionLabel(option)) === normalizeText(customValue));
  const displayOptions =
    allowCustom && customValue && !hasExactMatch
      ? [...filteredOptions, { label: `${customOptionLabel} "${customValue}"`, value: customValue, isCustom: true }]
      : filteredOptions;

  const selectedLabel = value
    ? (options.find(opt => getOptionValue(opt) === value)?.label ?? value)
    : '';
  const shouldShowOptions = isOpen && (!selectedLabel || search);

  const handleSelect = (option) => {
    const val = getOptionValue(option);
    onChange?.({ target: { value: val } });
    setSearch('');
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if ((e.key === 'ArrowDown' || e.key === ' ') && !selectedLabel) {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (displayOptions.length) {
          setHighlightedIndex(prev => (prev + 1) % displayOptions.length);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (displayOptions.length) {
          setHighlightedIndex(prev => (prev - 1 + displayOptions.length) % displayOptions.length);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (displayOptions[highlightedIndex]) {
          handleSelect(displayOptions[highlightedIndex]);
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
    const nextSearch = e.target.value;
    if (value && nextSearch !== selectedLabel) {
      onChange?.({ target: { value: '' } });
    }
    setSearch(nextSearch);
    setHighlightedIndex(0);
    setIsOpen(true);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSearch('');
    onChange?.({ target: { value: '' } });
  };

  const commitTypedValue = () => {
    const typedValue = search.trim();

    if (!allowCustom || !typedValue) {
      return;
    }

    onChange?.({ target: { value: typedValue } });
    setSearch('');
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
        <div className="flex items-center gap-2 rounded-2xl border-[3px] border-brand-500 bg-brand-50/40 px-3.5 py-2.5 shadow-[0_0_0_4px_rgba(37,99,235,0.10),0_10px_26px_rgba(37,99,235,0.14),inset_0_1px_0_rgba(255,255,255,0.9)] transition focus-within:border-brand-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100">
          <input
            ref={inputRef}
            type="text"
            value={search || selectedLabel}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => !disabled && !selectedLabel && setIsOpen(true)}
            onBlur={() => window.setTimeout(commitTypedValue, 0)}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-7 min-w-0 flex-1 bg-transparent text-base font-extrabold text-brand-950 outline-none placeholder:font-bold placeholder:text-brand-500 sm:text-sm"
            autoComplete="off"
          />
          {(search || selectedLabel) && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="flex-none text-slate-400 hover:text-slate-600"
              aria-label="Clear selection"
            >
              <X size={16} />
            </button>
          )}
          <ChevronDown size={16} className="flex-none text-slate-400" />
        </div>

        {shouldShowOptions && displayOptions.length > 0 && !disabled && (
          <div className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {displayOptions.map((option, index) => {
              const optLabel = getOptionLabel(option);
              const optValue = getOptionValue(option);
              const availability = getAvailability?.(optValue);

              return (
                <button
                  key={optValue}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelect(option);
                  }}
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

        {shouldShowOptions && displayOptions.length === 0 && search && !disabled && (
          <div className="absolute top-full z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm text-slate-500 shadow-lg">
            No matches for "{search}"
          </div>
        )}
      </div>
    </label>
  );
};
