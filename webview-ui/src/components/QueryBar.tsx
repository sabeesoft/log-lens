import { Play, AlertCircle, Settings, FileText, Loader2 } from 'lucide-react';
import { useLogStore } from '../store/logStore';
import { useLogFields } from '../hooks/useLogFields';
import QueryEditor from './QueryEditor';

export default function QueryBar() {
  const queryText = useLogStore((s) => s.queryText);
  const queryErrors = useLogStore((s) => s.queryErrors);
  const appliedQuery = useLogStore((s) => s.appliedQuery);
  const setQueryText = useLogStore((s) => s.setQueryText);
  const runQuery = useLogStore((s) => s.runQuery);
  const clearQuery = useLogStore((s) => s.clearQuery);

  const logs = useLogStore((s) => s.logs);
  const appliedFieldDepth = useLogStore((s) => s.appliedFieldDepth);
  const availableFields = useLogFields(logs, appliedFieldDepth);

  const filteredCount = useLogStore((s) => s.filteredLogs.length);
  const totalCount = useLogStore((s) => s.logs.length);
  const fileName = useLogStore((s) => s.fileName);
  const isFiltering = useLogStore((s) => s.isFiltering);
  const settingsOpen = useLogStore((s) => s.settingsPanelOpen);
  const toggleSettingsPanel = useLogStore((s) => s.toggleSettingsPanel);

  const hasErrors = !!queryErrors && queryErrors.length > 0;
  const isActive = !!appliedQuery;

  return (
    <div
      style={{
        padding: '8px 12px',
        backgroundColor: '#0d0d0d',
        borderBottom: '1px solid #222',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <QueryEditor
          value={queryText}
          onChange={setQueryText}
          onRun={() => runQuery()}
          onClear={clearQuery}
          availableFields={availableFields}
          active={isActive}
          hasErrors={hasErrors}
        />

        {/* Run */}
        <button
          onClick={() => runQuery()}
          title="Run query (Ctrl/Cmd + Enter)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 14px',
            height: '36px',
            backgroundColor: '#3b82f6',
            color: '#fff',
            borderRadius: '6px',
            border: '1px solid #3b82f6',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Play size={13} />
          Run
        </button>

        {/* Filters */}
        <button
          onClick={toggleSettingsPanel}
          title="Filters & settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 14px',
            height: '36px',
            backgroundColor: settingsOpen ? '#3b82f6' : '#222',
            color: settingsOpen ? '#fff' : '#a1a1aa',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: settingsOpen ? '#3b82f6' : '#333',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Settings size={14} />
          Filters
        </button>
      </div>

      {/* Error messages */}
      {hasErrors && (
        <div
          style={{
            marginTop: '6px',
            padding: '6px 10px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {queryErrors!.map((err, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11.5px',
                color: '#fca5a5',
                fontFamily: 'monospace',
              }}
            >
              <AlertCircle size={12} style={{ flexShrink: 0 }} />
              <span>{err.message}</span>
              <span style={{ color: '#7f1d1d' }}>(pos {err.start})</span>
            </div>
          ))}
        </div>
      )}

      {/* Compact meta line: filename (left) + result count (right) */}
      {totalCount > 0 && (
        <div
          style={{
            marginTop: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#52525b',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
            {fileName && (
              <>
                <FileText size={11} style={{ flexShrink: 0 }} />
                <span
                  title={fileName}
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '280px',
                  }}
                >
                  {fileName}
                </span>
              </>
            )}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            {isFiltering ? (
              <>
                <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Filtering…</span>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </>
            ) : (
              <>
                <span style={{ color: '#a1a1aa', fontWeight: 600 }}>{filteredCount}</span>
                <span>/ {totalCount}</span>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
