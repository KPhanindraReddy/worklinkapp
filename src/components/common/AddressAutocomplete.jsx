import { Loader, MapPin, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export const AddressAutocomplete = ({
  label,
  value = '',
  onSelect,
  placeholder = 'Enter address...',
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchSuggestions = async (query) => {
    if (!query || query.length < 2 || !MAPBOX_TOKEN) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=8`
      );
      const data = await response.json();

      if (data.features) {
        setSuggestions(
          data.features.map(feature => ({
            id: feature.id,
            label: feature.place_name,
            coordinates: {
              latitude: feature.center[1],
              longitude: feature.center[0]
            }
          }))
        );
        setHighlightedIndex(0);
      }
    } catch (error) {
      console.error('Address search error:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (suggestion) => {
    onSelect?.(suggestion);
    setSearch(suggestion.label);
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (suggestions[highlightedIndex]) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    setIsOpen(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 300);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSearch('');
    setSuggestions([]);
    onSelect?.(null);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <label className={`block min-w-0 max-w-full space-y-1.5 ${className}`} ref={containerRef}>
      {label ? (
        <span className="text-[12px] font-semibold tracking-[0.03em] text-slate-500 sm:text-[13px]">
          {label}
        </span>
      ) : null}

      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500">
          <MapPin size={16} className="flex-none text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => search && setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-6 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:text-slate-500 sm:text-[13px]"
            autoComplete="off"
          />
          {loading && <Loader size={16} className="flex-none animate-spin text-slate-400" />}
          {search && !loading && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="flex-none text-slate-400 hover:text-slate-600 disabled:opacity-50"
              aria-label="Clear selection"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {isOpen && suggestions.length > 0 && (
          <div className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSelect(suggestion)}
                className={`w-full px-3 py-3 text-left text-sm transition ${
                  index === highlightedIndex
                    ? 'bg-brand-50'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="mt-1 flex-none text-slate-400" />
                  <span className="min-w-0 flex-1 font-medium text-slate-900">{suggestion.label}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {isOpen && search && !loading && suggestions.length === 0 && (
          <div className="absolute top-full z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm text-slate-500 shadow-lg">
            No addresses found. Try a different search.
          </div>
        )}
      </div>
    </label>
  );
};
