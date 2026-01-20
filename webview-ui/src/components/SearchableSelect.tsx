import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface SearchableSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  style
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '3px',
          fontSize: '11px',
          color: value ? '#d4d4d8' : '#71717a',
          fontFamily: 'monospace',
          cursor: 'pointer',
          minHeight: '26px'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder}
        </span>
        <ChevronDown size={12} style={{ flexShrink: 0, marginLeft: '4px', color: '#71717a' }} />
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '2px',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '4px',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            maxHeight: '200px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ padding: '6px', borderBottom: '1px solid #333' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={12}
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#71717a'
                }}
              />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fields..."
                style={{
                  width: '100%',
                  padding: '6px 8px 6px 28px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '3px',
                  fontSize: '11px',
                  color: '#d4d4d8',
                  fontFamily: 'monospace',
                  outline: 'none'
                }}
              />
            </div>
          </div>
          <div style={{ overflow: 'auto', maxHeight: '150px' }}>
            <div
              onClick={() => handleSelect('')}
              style={{
                padding: '6px 10px',
                fontSize: '11px',
                color: !value ? '#60a5fa' : '#71717a',
                fontFamily: 'monospace',
                cursor: 'pointer',
                backgroundColor: !value ? 'rgba(96, 165, 250, 0.1)' : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (value) e.currentTarget.style.backgroundColor = '#222';
              }}
              onMouseLeave={(e) => {
                if (value) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {placeholder}
            </div>
            {filteredOptions.map((opt) => (
              <div
                key={opt}
                onClick={() => handleSelect(opt)}
                style={{
                  padding: '6px 10px',
                  fontSize: '11px',
                  color: value === opt ? '#60a5fa' : '#d4d4d8',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  backgroundColor: value === opt ? 'rgba(96, 165, 250, 0.1)' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (value !== opt) e.currentTarget.style.backgroundColor = '#222';
                }}
                onMouseLeave={(e) => {
                  if (value !== opt) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {opt}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div style={{ padding: '10px', fontSize: '11px', color: '#71717a', fontFamily: 'monospace', textAlign: 'center' }}>
                No fields found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
