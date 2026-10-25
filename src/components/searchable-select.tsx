'use client';

import { useState } from 'react';

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
  const [query, setQuery] = useState('');
  const [internalValue, setInternalValue] = useState(() =>
    !isControlled ? String((rest as FormProps).defaultValue ?? '') : '',
  );

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase().trim()))
    : options;

  const currentValue = isControlled ? (rest as ControlledProps).value : internalValue;
  const valueInFiltered = filtered.some((o) => String(o.value) === currentValue);

  function handleChange(v: string) {
    if (isControlled) {
      (rest as ControlledProps).onChange(v);
    } else {
      setInternalValue(v);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <input
        type="search"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={ariaLabel ? `Search ${ariaLabel}` : 'Search options'}
      />
      <select
        name={(rest as FormProps).name}
        required={(rest as FormProps).required}
        value={valueInFiltered ? currentValue : ''}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="" disabled={!!(rest as FormProps).required}>
          {filtered.length === 0 ? 'No matches' : placeholder}
        </option>
        {filtered.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
