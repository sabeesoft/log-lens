import React from 'react';
import { X } from 'lucide-react';
import { Filter } from '../types';
import SearchableSelect from './SearchableSelect';

interface FilterRowProps {
  filter: Filter;
  index: number;
  allFields: string[];
  onUpdate: (filter: Filter) => void;
  onRemove: () => void;
  showRelation: boolean;
  showRemove: boolean;
  onSearch: () => void;
}

export default function FilterRow({
  filter,
  index,
  allFields,
  onUpdate,
  onRemove,
  showRelation,
  showRemove,
  onSearch
}: FilterRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px',
        backgroundColor: '#1a1a1a',
        borderRadius: '4px',
        border: '1px solid #222',
        flexWrap: 'wrap'
      }}
    >
      {showRelation && (
        <div style={{ display: 'flex', backgroundColor: '#222', borderRadius: '3px', padding: '1px', minWidth: '60px' }}>
          <button
            onClick={() => onUpdate({ ...filter, relation: 'AND' })}
            style={{
              padding: '2px 6px',
              borderRadius: '2px',
              fontSize: '10px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: filter.relation === 'AND' ? '#3b82f6' : 'transparent',
              color: filter.relation === 'AND' ? '#fff' : '#71717a',
              fontFamily: 'monospace'
            }}
          >
            AND
          </button>
          <button
            onClick={() => onUpdate({ ...filter, relation: 'OR' })}
            style={{
              padding: '2px 6px',
              borderRadius: '2px',
              fontSize: '10px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: filter.relation === 'OR' ? '#8b5cf6' : 'transparent',
              color: filter.relation === 'OR' ? '#fff' : '#71717a',
              fontFamily: 'monospace'
            }}
          >
            OR
          </button>
        </div>
      )}

      <SearchableSelect
        value={filter.field}
        options={allFields}
        onChange={(field) => onUpdate({ ...filter, field })}
        placeholder="field"
        style={{ minWidth: '100px', flex: '1 1 120px', maxWidth: '180px' }}
      />

      <select
        value={filter.operator}
        onChange={(e) => onUpdate({ ...filter, operator: e.target.value as any })}
        style={{
          minWidth: '70px',
          flex: '0 1 90px',
          padding: '4px 8px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '3px',
          fontSize: '11px',
          color: '#d4d4d8',
          fontFamily: 'monospace'
        }}
      >
        <option value="contains">~</option>
        <option value="not_contains">!~</option>
        <option value="equals">==</option>
      </select>

      <input
        type="text"
        value={filter.value}
        onChange={(e) => onUpdate({ ...filter, value: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        placeholder="value"
        style={{
          flex: '1 1 150px',
          minWidth: '100px',
          padding: '4px 8px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '3px',
          fontSize: '11px',
          color: '#d4d4d8',
          fontFamily: 'monospace'
        }}
      />

      {showRemove && (
        <button
          onClick={onRemove}
          style={{
            padding: '4px',
            color: '#ef4444',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
