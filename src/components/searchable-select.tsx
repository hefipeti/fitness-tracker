'use client';

import { useEffect, useRef, useState } from 'react';

interface Option {
  value: string | number;
  label: string;
}

interface BaseProps {
  options: Option[];
  placeholder?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

interface FormProps extends BaseProps {
  name: string;
  required?: boolean;
  defaultValue?: string | number;
  value?: undefined;
  onChange?: undefined;
}

interface ControlledProps extends BaseProps {
  name?: undefined;
  required?: undefined;
  defaultValue?: undefined;
  value: string;
  onChange: (value: string) => void;
}

type Props = FormProps | ControlledProps;

export function SearchableSelect({ options, placeholder = 'Select…', style, ariaLabel, ...rest }: Props) {
  const isControlled = rest.value !== undefined;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [internalValue, setInternalValue] = useState(
    !isControlled ? String((rest as FormProps).defaultValue ?? '') : '',
  );

  const currentValue = isControlled ? (rest as ControlledProps).value : internalValue;
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase().trim()))
    : options;

  const selectedOption = options.find((o) => String(o.value) === currentValue);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function select(v: string) {
    if (isControlled) {
      (rest as ControlledProps).onChange(v);
    } else {
      setInternalValue(v);
    }
    setOpen(false);
    setQuery('');
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  }

  return (
    <div ref={containerRef} className="ss-wrap" style={style} onKeyDown={onKeyDown}>
      {!isControlled && (
        <input type="hidden" name={(rest as FormProps).name} value={currentValue} />
      )}

      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`ss-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selectedOption ? '' : 'ss-ph'}>{selectedOption?.label ?? placeholder}</span>
        <svg className="ss-arrow" viewBox="0 0 10 6" fill="none" aria-hidden>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="ss-drop" role="listbox" aria-label={ariaLabel}>
          <div className="ss-search-wrap">
            <input
              ref={searchRef}
              type="search"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ss-search"
              aria-label="Search options"
            />
          </div>
          <div className="ss-list">
            {filtered.length === 0 ? (
              <div className="ss-empty">No matches</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={String(o.value) === currentValue}
                  className={`ss-opt${String(o.value) === currentValue ? ' on' : ''}`}
                  onClick={() => select(String(o.value))}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
