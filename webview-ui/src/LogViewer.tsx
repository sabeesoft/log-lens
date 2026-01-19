import React from 'react';
import FilterSection from './components/FilterSection';
import OrderBySection from './components/OrderBySection';
import FieldVisibilitySection from './components/FieldVisibilitySection';
import LogList from './components/LogList';
import Sidebar from './components/Sidebar';
import { useLogFields } from './hooks/useLogFields';
import { getLevelBorderColor } from './utils/logUtils';
import { useLogStore } from './store/logStore';

export default function LogViewer() {
  // Zustand store
  const logs = useLogStore((state) => state.logs);
  const filters = useLogStore((state) => state.filters);
  const appliedFilters = useLogStore((state) => state.appliedFilters);
  const orderByField = useLogStore((state) => state.orderByField);
  const orderByDirection = useLogStore((state) => state.orderByDirection);
  const selectedLogIndex = useLogStore((state) => state.selectedLogIndex);
  const visibleFields = useLogStore((state) => state.visibleFields);

  const addFilter = useLogStore((state) => state.addFilter);
  const updateFilter = useLogStore((state) => state.updateFilter);
  const removeFilter = useLogStore((state) => state.removeFilter);
  const applyFilters = useLogStore((state) => state.applyFilters);
  const clearFilters = useLogStore((state) => state.clearFilters);
  const setOrderByField = useLogStore((state) => state.setOrderByField);
  const setOrderByDirection = useLogStore((state) => state.setOrderByDirection);
  const selectLog = useLogStore((state) => state.selectLog);
  const toggleFieldVisibility = useLogStore((state) => state.toggleFieldVisibility);
  const getFilteredLogs = useLogStore((state) => state.getFilteredLogs);
  const getActiveSearchTerms = useLogStore((state) => state.getActiveSearchTerms);

  const allFields = useLogFields(logs);
  const filteredLogs = getFilteredLogs();
  const activeSearchTerms = getActiveSearchTerms();
  const selectedLog = selectedLogIndex !== null ? filteredLogs[selectedLogIndex] : null;

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      backgroundColor: '#0a0a0a',
      color: '#f3f4f6',
      padding: '8px',
      display: 'flex',
      flexDirection: 'row',
      gap: '0',
      overflow: 'hidden'
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <FilterSection
          filters={filters}
          allFields={allFields}
          filteredCount={filteredLogs.length}
          totalCount={logs.length}
          hasAppliedFilters={appliedFilters.length > 0}
          onAddFilter={addFilter}
          onUpdateFilter={updateFilter}
          onRemoveFilter={removeFilter}
          onApply={applyFilters}
          onClear={clearFilters}
        />

        <OrderBySection
          allFields={allFields}
          orderByField={orderByField}
          orderByDirection={orderByDirection}
          onFieldChange={setOrderByField}
          onDirectionChange={setOrderByDirection}
        />

        <FieldVisibilitySection
          allFields={allFields}
          visibleFields={visibleFields}
          onToggleField={toggleFieldVisibility}
        />

        <LogList
          logs={filteredLogs}
          selectedLogIndex={selectedLogIndex}
          onSelectLog={selectLog}
          activeSearchTerms={activeSearchTerms}
          getLevelBorderColor={getLevelBorderColor}
          visibleFields={visibleFields}
          levelField=""
          timestampField=""
        />
      </div>

      {selectedLog && <Sidebar log={selectedLog} onClose={() => selectLog(null)} />}
    </div>
  );
}
