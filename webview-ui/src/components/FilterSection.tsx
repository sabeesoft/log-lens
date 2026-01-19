import React from 'react';
import { Search, Plus } from 'lucide-react';
import FilterRow from './FilterRow';
import { Filter } from '../types';

interface FilterSectionProps {
  filters: Filter[];
  allFields: string[];
  filteredCount: number;
  totalCount: number;
  hasAppliedFilters: boolean;
  onAddFilter: () => void;
  onUpdateFilter: (filterId: number, updatedFilter: Filter) => void;
  onRemoveFilter: (filterId: number) => void;
  onApply: () => void;
  onClear: () => void;
}

export default function FilterSection({
  filters,
  allFields,
  filteredCount,
  totalCount,
  hasAppliedFilters,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  onApply,
  onClear
}: FilterSectionProps) {
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Search size={12} color="#60a5fa" />
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#a1a1aa', fontFamily: 'monospace' }}>
            FILTERS
          </span>
        </div>
        <button
          onClick={onAddFilter}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: '#222',
            color: '#a1a1aa',
            borderRadius: '4px',
            border: '1px solid #333',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 500,
            fontFamily: 'monospace'
          }}
        >
          <Plus size={12} />
          ADD
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {filters.map((filter, index) => (
          <FilterRow
            key={filter.id}
            filter={filter}
            index={index}
            allFields={allFields}
            onUpdate={(updatedFilter) => onUpdateFilter(filter.id, updatedFilter)}
            onRemove={() => onRemoveFilter(filter.id)}
            showRelation={index > 0}
            showRemove={filters.length > 1}
            onSearch={onApply}
          />
        ))}
      </div>

      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '11px', color: '#71717a', fontFamily: 'monospace' }}>
          <span style={{ color: '#d4d4d8', fontWeight: 600 }}>{filteredCount}</span>/{totalCount}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {hasAppliedFilters && (
            <button
              onClick={onClear}
              style={{
                fontSize: '10px',
                color: '#71717a',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'monospace',
                textDecoration: 'underline'
              }}
            >
              clear
            </button>
          )}
          <button
            onClick={onApply}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 12px',
              backgroundColor: '#3b82f6',
              color: '#fff',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'monospace'
            }}
          >
            <Search size={12} />
            APPLY
          </button>
        </div>
      </div>
    </div>
  );
}
