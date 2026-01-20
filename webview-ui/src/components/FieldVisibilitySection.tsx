import React, { useState, useMemo } from 'react';
import { Eye, Search, X, RotateCcw } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';

interface FieldVisibilitySectionProps {
  allFields: string[];
  visibleFields: string[];
  onToggleField: (field: string) => void;
  onClear?: () => void;
}

export default function FieldVisibilitySection({
  allFields,
  visibleFields,
  onToggleField,
  onClear
}: FieldVisibilitySectionProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return allFields;
    return allFields.filter(field =>
      field.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allFields, searchQuery]);

  const visibleCount = visibleFields.includes('all') ? allFields.length : visibleFields.length;
  const hasCustomSelection = !visibleFields.includes('all') && visibleFields.length > 0;

  return (
    <CollapsibleSection
      title="VISIBLE FIELDS"
      icon={<Eye size={12} />}
      iconColor="#10b981"
      defaultExpanded={false}
      headerRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasCustomSelection && onClear && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 6px',
                backgroundColor: 'transparent',
                color: '#71717a',
                borderRadius: '3px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '9px',
                fontWeight: 500,
                fontFamily: 'monospace'
              }}
              title="Reset to show all fields"
            >
              <RotateCcw size={10} />
              reset
            </button>
          )}
          <span style={{ fontSize: '10px', color: '#71717a', fontFamily: 'monospace' }}>
            <span style={{ color: '#10b981' }}>{visibleCount}</span>/{allFields.length}
          </span>
        </div>
      }
    >
      {/* Search input */}
      {allFields.length > 10 && (
        <div style={{ position: 'relative', marginBottom: '8px' }}>
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
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search fields..."
            style={{
              width: '100%',
              padding: '6px 28px 6px 28px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#d4d4d8',
              fontFamily: 'monospace',
              outline: 'none'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: '#71717a',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '150px', overflow: 'auto' }}>
        {/* "All" button - only show when not searching */}
        {!searchQuery && (
          <button
            onClick={() => onToggleField('all')}
            style={{
              padding: '2px 6px',
              fontSize: '9px',
              fontWeight: 600,
              fontFamily: 'monospace',
              border: '1px solid',
              borderColor: visibleFields.includes('all') ? '#10b981' : '#333',
              borderRadius: '3px',
              cursor: 'pointer',
              backgroundColor: visibleFields.includes('all') ? 'rgba(16, 185, 129, 0.15)' : '#1a1a1a',
              color: visibleFields.includes('all') ? '#10b981' : '#71717a',
              transition: 'all 0.15s ease'
            }}
          >
            ALL
          </button>
        )}

        {filteredFields.map((field) => {
          const isVisible = visibleFields.includes('all') || visibleFields.includes(field);
          return (
            <button
              key={field}
              onClick={() => onToggleField(field)}
              style={{
                padding: '2px 6px',
                fontSize: '9px',
                fontWeight: 600,
                fontFamily: 'monospace',
                border: '1px solid',
                borderColor: isVisible ? '#10b981' : '#333',
                borderRadius: '3px',
                cursor: 'pointer',
                backgroundColor: isVisible ? 'rgba(16, 185, 129, 0.15)' : '#1a1a1a',
                color: isVisible ? '#10b981' : '#71717a',
                transition: 'all 0.15s ease'
              }}
            >
              {field}
            </button>
          );
        })}

        {filteredFields.length === 0 && searchQuery && (
          <div style={{ fontSize: '11px', color: '#71717a', fontFamily: 'monospace', padding: '8px' }}>
            No fields match "{searchQuery}"
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
