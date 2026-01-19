import React from 'react';
import { Eye } from 'lucide-react';

interface FieldVisibilitySectionProps {
  allFields: string[];
  visibleFields: string[];
  onToggleField: (field: string) => void;
}

export default function FieldVisibilitySection({
  allFields,
  visibleFields,
  onToggleField
}: FieldVisibilitySectionProps) {
  return (
    <div
      style={{
        backgroundColor: '#111',
        borderRadius: '6px',
        border: '1px solid #222',
        padding: '12px',
        marginBottom: '8px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <Eye size={12} color="#10b981" />
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#a1a1aa', fontFamily: 'monospace' }}>
          VISIBLE FIELDS
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {/* "All" button */}
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

        {allFields.map((field) => {
          const isVisible = visibleFields.includes(field);
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
      </div>

      <div style={{ marginTop: '8px', fontSize: '10px', color: '#71717a', fontFamily: 'monospace' }}>
        <span style={{ color: '#d4d4d8' }}>{visibleFields.length}</span> field{visibleFields.length !== 1 ? 's' : ''} visible
      </div>
    </div>
  );
}
