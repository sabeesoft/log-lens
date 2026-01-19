import React from 'react';
import { ArrowUpDown } from 'lucide-react';

interface OrderBySectionProps {
  allFields: string[];
  orderByField: string;
  orderByDirection: 'asc' | 'desc';
  onFieldChange: (field: string) => void;
  onDirectionChange: (direction: 'asc' | 'desc') => void;
}

export default function OrderBySection({
  allFields,
  orderByField,
  orderByDirection,
  onFieldChange,
  onDirectionChange
}: OrderBySectionProps) {
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
        <ArrowUpDown size={12} color="#a78bfa" />
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#a1a1aa', fontFamily: 'monospace' }}>
          ORDER BY
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        <select
          value={orderByField}
          onChange={(e) => onFieldChange(e.target.value)}
          style={{
            flex: '1 1 200px',
            minWidth: '150px',
            padding: '4px 8px',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '3px',
            fontSize: '11px',
            color: '#d4d4d8',
            fontFamily: 'monospace'
          }}
        >
          <option value="">none</option>
          {allFields.map(field => (
            <option key={field} value={field}>{field}</option>
          ))}
        </select>

        {orderByField && (
          <div style={{ display: 'flex', backgroundColor: '#222', borderRadius: '3px', padding: '1px' }}>
            <button
              onClick={() => onDirectionChange('asc')}
              style={{
                padding: '2px 8px',
                borderRadius: '2px',
                fontSize: '10px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: orderByDirection === 'asc' ? '#3b82f6' : 'transparent',
                color: orderByDirection === 'asc' ? '#fff' : '#71717a',
                fontFamily: 'monospace'
              }}
            >
              ASC
            </button>
            <button
              onClick={() => onDirectionChange('desc')}
              style={{
                padding: '2px 8px',
                borderRadius: '2px',
                fontSize: '10px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: orderByDirection === 'desc' ? '#3b82f6' : 'transparent',
                color: orderByDirection === 'desc' ? '#fff' : '#71717a',
                fontFamily: 'monospace'
              }}
            >
              DESC
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
