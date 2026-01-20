import React from 'react';
import Header from './components/Header';
import SettingsPanel from './components/SettingsPanel';
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
  const settingsPanelOpen = useLogStore((state) => state.settingsPanelOpen);
  const searchTerm = useLogStore((state) => state.searchTerm);

  const addFilter = useLogStore((state) => state.addFilter);
  const updateFilter = useLogStore((state) => state.updateFilter);
  const removeFilter = useLogStore((state) => state.removeFilter);
  const applyFilters = useLogStore((state) => state.applyFilters);
  const clearFilters = useLogStore((state) => state.clearFilters);
  const setOrderByField = useLogStore((state) => state.setOrderByField);
  const setOrderByDirection = useLogStore((state) => state.setOrderByDirection);
  const selectLog = useLogStore((state) => state.selectLog);
  const toggleFieldVisibility = useLogStore((state) => state.toggleFieldVisibility);
  const setVisibleFields = useLogStore((state) => state.setVisibleFields);
  const toggleSettingsPanel = useLogStore((state) => state.toggleSettingsPanel);
  const setSearchTerm = useLogStore((state) => state.setSearchTerm);
  const getFilteredLogs = useLogStore((state) => state.getFilteredLogs);
  const getActiveSearchTerms = useLogStore((state) => state.getActiveSearchTerms);

  const allFields = useLogFields(logs);
  const filteredLogs = getFilteredLogs();
  const activeSearchTerms = getActiveSearchTerms();
  const selectedLog = selectedLogIndex !== null ? filteredLogs[selectedLogIndex] : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0a0a0a',
        color: '#f3f4f6',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Fixed Header */}
      <Header
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        onSettingsToggle={toggleSettingsPanel}
        settingsOpen={settingsPanelOpen}
        filteredCount={filteredLogs.length}
        totalCount={logs.length}
      />

      {/* Main content area - fills remaining space */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
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

      {/* Settings Panel (slide-out) */}
      <SettingsPanel
        isOpen={settingsPanelOpen}
        onClose={toggleSettingsPanel}
        filters={filters}
        allFields={allFields}
        filteredCount={filteredLogs.length}
        totalCount={logs.length}
        hasAppliedFilters={appliedFilters.length > 0}
        onAddFilter={addFilter}
        onUpdateFilter={updateFilter}
        onRemoveFilter={removeFilter}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
        orderByField={orderByField}
        orderByDirection={orderByDirection}
        onOrderFieldChange={setOrderByField}
        onOrderDirectionChange={setOrderByDirection}
        visibleFields={visibleFields}
        onToggleFieldVisibility={toggleFieldVisibility}
        onClearVisibleFields={() => setVisibleFields(['all'])}
      />

      {/* Log Details Sidebar */}
      {selectedLog && <Sidebar log={selectedLog} onClose={() => selectLog(null)} />}
    </div>
  );
}
