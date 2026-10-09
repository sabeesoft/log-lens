import QueryBar from './components/QueryBar';
import SettingsPanel from './components/SettingsPanel';
import LogList from './components/LogList';
import LogTable from './components/LogTable';
import Sidebar from './components/Sidebar';
import LoadingOverlay from './components/LoadingOverlay';
import TraceModal from './components/TraceModal';
import { useLogFields } from './hooks/useLogFields';
import { getLevelBorderColor } from './utils/logUtils';
import { useLogStore } from './store/logStore';

export default function LogViewer() {
  // Zustand store
  const logs = useLogStore((state) => state.logs);
  const filteredLogs = useLogStore((state) => state.filteredLogs);
  const filters = useLogStore((state) => state.filters);
  const appliedFilters = useLogStore((state) => state.appliedFilters);
  const orderByField = useLogStore((state) => state.orderByField);
  const orderByDirection = useLogStore((state) => state.orderByDirection);
  const selectedLogIndex = useLogStore((state) => state.selectedLogIndex);
  const visibleFields = useLogStore((state) => state.visibleFields);
  const settingsPanelOpen = useLogStore((state) => state.settingsPanelOpen);
  const isFiltering = useLogStore((state) => state.isFiltering);
  const fieldDepth = useLogStore((state) => state.fieldDepth);
  const appliedFieldDepth = useLogStore((state) => state.appliedFieldDepth);

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
  const getActiveSearchTerms = useLogStore((state) => state.getActiveSearchTerms);
  const setFieldDepth = useLogStore((state) => state.setFieldDepth);
  const applyFieldDepth = useLogStore((state) => state.applyFieldDepth);
  const traceModalOpen = useLogStore((state) => state.traceModalOpen);
  const activeTraceId = useLogStore((state) => state.activeTraceId);
  const traceLogs = useLogStore((state) => state.traceLogs);
  const closeTraceModal = useLogStore((state) => state.closeTraceModal);
  const appliedQuery = useLogStore((state) => state.appliedQuery);
  const sortByColumn = useLogStore((state) => state.sortByColumn);

  const allFields = useLogFields(logs, appliedFieldDepth);
  const activeSearchTerms = getActiveSearchTerms();
  const selectedLog = selectedLogIndex !== null ? filteredLogs[selectedLogIndex] : null;

  // Columnar table only when explicit fields are listed.
  // No `fields`, or `fields *`, shows the full raw rows (every field, no columns).
  const rawFields = appliedQuery?.fields && appliedQuery.fields.length > 0 ? appliedQuery.fields : null;
  const showAll = rawFields?.includes('*') ?? false;
  const columns = rawFields && !showAll ? rawFields : null;
  const sortState = appliedQuery?.sort[0] ?? null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--vscode-editor-background, #0a0a0a)',
        color: 'var(--vscode-foreground, #f3f4f6)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* CloudWatch-style query bar (top bar: editor + Run + Filters) */}
      <QueryBar />

      {/* Main content area - fills remaining space */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {columns ? (
          <LogTable
            logs={filteredLogs}
            columns={columns}
            selectedLogIndex={selectedLogIndex}
            onSelectLog={selectLog}
            sort={sortState}
            onSort={sortByColumn}
          />
        ) : (
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
        )}

        {/* Loading overlay */}
        <LoadingOverlay visible={isFiltering} />
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
        fieldDepth={fieldDepth}
        appliedFieldDepth={appliedFieldDepth}
        onFieldDepthChange={setFieldDepth}
        onApplyFieldDepth={applyFieldDepth}
      />

      {/* Log Details Sidebar */}
      {selectedLog && <Sidebar log={selectedLog} onClose={() => selectLog(null)} />}

      {/* Trace Modal */}
      {traceModalOpen && activeTraceId && (
        <TraceModal
          traceId={activeTraceId}
          traceLogs={traceLogs}
          onClose={closeTraceModal}
        />
      )}
    </div>
  );
}
