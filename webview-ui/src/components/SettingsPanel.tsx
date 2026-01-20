import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import FilterSection from './FilterSection';
import OrderBySection from './OrderBySection';
import FieldVisibilitySection from './FieldVisibilitySection';
import FieldDepthSection from './FieldDepthSection';
import { Filter } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Filter props
  filters: Filter[];
  allFields: string[];
  filteredCount: number;
  totalCount: number;
  hasAppliedFilters: boolean;
  onAddFilter: () => void;
  onUpdateFilter: (filterId: number, updatedFilter: Filter) => void;
  onRemoveFilter: (filterId: number) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  // Order props
  orderByField: string;
  orderByDirection: 'asc' | 'desc';
  onOrderFieldChange: (field: string) => void;
  onOrderDirectionChange: (direction: 'asc' | 'desc') => void;
  // Visibility props
  visibleFields: string[];
  onToggleFieldVisibility: (field: string) => void;
  onClearVisibleFields: () => void;
  // Field depth props
  fieldDepth: number;
  appliedFieldDepth: number;
  onFieldDepthChange: (depth: number) => void;
  onApplyFieldDepth: () => void;
}

const MIN_WIDTH = 350;
const MAX_WIDTH_PERCENT = 75;
const DEFAULT_WIDTH_PERCENT = 40;

const getMaxWidth = () => Math.max(MIN_WIDTH, Math.floor(window.innerWidth * MAX_WIDTH_PERCENT / 100));
const getDefaultWidth = () => Math.max(MIN_WIDTH, Math.floor(window.innerWidth * DEFAULT_WIDTH_PERCENT / 100));

export default function SettingsPanel({
  isOpen,
  onClose,
  filters,
  allFields,
  filteredCount,
  totalCount,
  hasAppliedFilters,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  onApplyFilters,
  onClearFilters,
  orderByField,
  orderByDirection,
  onOrderFieldChange,
  onOrderDirectionChange,
  visibleFields,
  onToggleFieldVisibility,
  onClearVisibleFields,
  fieldDepth,
  appliedFieldDepth,
  onFieldDepthChange,
  onApplyFieldDepth
}: SettingsPanelProps) {
  const [width, setWidth] = useState(getDefaultWidth);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidth = Math.min(getMaxWidth(), Math.max(MIN_WIDTH, startWidth + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [width]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 998
        }}
      />

      {/* Settings panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: `${width}px`,
          maxWidth: '90vw',
          height: '100%',
          backgroundColor: '#0a0a0a',
          borderLeft: '1px solid #222',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 999,
          boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '6px',
            height: '100%',
            cursor: 'ew-resize',
            backgroundColor: isResizing ? '#3b82f6' : 'transparent',
            transition: 'background-color 0.15s',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            if (!isResizing) e.currentTarget.style.backgroundColor = '#333';
          }}
          onMouseLeave={(e) => {
            if (!isResizing) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        />

        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#d4d4d8', fontFamily: 'monospace' }}>
            FILTERS & SETTINGS
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#71717a',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px'
          }}
        >
          <FilterSection
            filters={filters}
            allFields={allFields}
            filteredCount={filteredCount}
            totalCount={totalCount}
            hasAppliedFilters={hasAppliedFilters}
            onAddFilter={onAddFilter}
            onUpdateFilter={onUpdateFilter}
            onRemoveFilter={onRemoveFilter}
            onApply={onApplyFilters}
            onClear={onClearFilters}
          />

          <div style={{ marginTop: '8px' }}>
            <OrderBySection
              allFields={allFields}
              orderByField={orderByField}
              orderByDirection={orderByDirection}
              onFieldChange={onOrderFieldChange}
              onDirectionChange={onOrderDirectionChange}
            />
          </div>

          <div style={{ marginTop: '8px' }}>
            <FieldVisibilitySection
              allFields={allFields}
              visibleFields={visibleFields}
              onToggleField={onToggleFieldVisibility}
              onClear={onClearVisibleFields}
            />
          </div>

          <div style={{ marginTop: '8px' }}>
            <FieldDepthSection
              fieldDepth={fieldDepth}
              appliedFieldDepth={appliedFieldDepth}
              onDepthChange={onFieldDepthChange}
              onApply={onApplyFieldDepth}
            />
          </div>
        </div>
      </div>
    </>
  );
}
