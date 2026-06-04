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
  const [inputValue, setInputValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const selectedLabel = value
    ? (options.find(opt => (typeof opt === 'string' ? opt : opt.value) === value)?.label ?? value)
    : '';

  const isShowingSelectedValue = Boolean(value && inputValue === selectedLabel);
  const filteredOptions = inputValue
    ? options.filter(opt => {
        const label = typeof opt === 'string' ? opt : opt.label;
        return label.toLowerCase().startsWith(inputValue.toLowerCase());
      })
    : options;

  const handleSelect = (option) => {
    const val = typeof option === 'string' ? option : option.value;
    const label = typeof option === 'string' ? option : option.label;
    onChange?.({ target: { value: val } });
    setInputValue(label ?? val);
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
        setInputValue(selectedLabel);
        break;
      default:
        break;
    }
  };

  const handleInputChange = (e) => {
    const nextValue = e.target.value;
    setInputValue(nextValue);
    setHighlightedIndex(0);
    setIsOpen(true);

    if (value && nextValue !== selectedLabel) {
      onChange?.({ target: { value: '' } });
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setInputValue('');
    onChange?.({ target: { value: '' } });
    setIsOpen(true);
    inputRef.current?.focus();
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

  useEffect(() => {
    if (value) {
      setInputValue(selectedLabel);
      return;
    }

    if (document.activeElement !== inputRef.current) {
      setInputValue('');
    }
  }, [selectedLabel, value]);

  return (
    <label className={`block min-w-0 max-w-full space-y-1.5 ${className}`} ref={containerRef}>
      {label ? (
        <span className="text-[12px] font-semibold tracking-[0.03em] text-slate-500 sm:text-[13px]">
          {label}
        </span>
      ) : null}

      <div className="relative">
        <div className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100 max-sm:min-h-12 max-sm:rounded-2xl">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsOpen(!isShowingSelectedValue)}
            placeholder={placeholder}
            className="min-h-6 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:text-[13px] max-sm:text-base"
            autoComplete="off"
          />
          {inputValue && (
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

        {isOpen && !isShowingSelectedValue && filteredOptions.length > 0 && (
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

        {isOpen && !isShowingSelectedValue && filteredOptions.length === 0 && inputValue && (
          <div className="absolute top-full z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm text-slate-500 shadow-lg">
            No matches for "{inputValue}"
          </div>
        )}
      </div>
    </label>
  );
};
