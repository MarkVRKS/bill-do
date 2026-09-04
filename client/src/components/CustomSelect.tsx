import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './CustomSelect.css';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
  id?: string;
}

export function CustomSelect({ options, value, onChange, placeholder = 'Выберите...', className = '', searchable = false, id }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = searchable && search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  // Position dropdown relative to trigger
  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
      });
    }
  }, [open]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      // Also check if click is on the portal dropdown
      const dropdown = document.querySelector('.custom-select-dropdown-portal');
      if (dropdown && dropdown.contains(e.target as Node)) return;
      setOpen(false);
      setSearch('');
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    if (open && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open, searchable]);

  const dropdown = open && createPortal(
    <div className="custom-select-dropdown custom-select-dropdown-portal" style={dropdownStyle}>
      {searchable && (
        <div className="custom-select-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <div className="custom-select-options">
        {filtered.length === 0 && (
          <div className="custom-select-empty">Ничего не найдено</div>
        )}
        {filtered.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`custom-select-option ${opt.value === value ? 'selected' : ''}`}
            onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
          >
            {opt.icon && <span className="custom-select-option-icon">{opt.icon}</span>}
            <span>{opt.label}</span>
            {opt.value === value && (
              <svg className="custom-select-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );

  return (
    <div ref={ref} className={`custom-select ${open ? 'open' : ''} ${className}`} id={id}>
      <button
        type="button"
        className={`custom-select-trigger ${!selected ? 'placeholder' : ''}`}
        onClick={() => { setOpen(!open); setSearch(''); }}
      >
        <span className="custom-select-value">
          {selected ? selected.label : placeholder}
        </span>
        <svg className="custom-select-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}
