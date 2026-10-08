import { useMemo } from 'react';
import { Play, AlertCircle, Settings, FileText, Loader2, Network } from 'lucide-react';
import { useLogStore } from '../store/logStore';
import { useLogFields } from '../hooks/useLogFields';
import { autoDetectLevelField, autoDetectTimestampField } from '../utils/fieldMapping';
import { detectServiceNameField } from '../utils/traceUtils';
import { LogEntry } from '../types';
import QueryEditor from './QueryEditor';

function formatOf(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return 'JSON';
  if (lower.endsWith('.log') || lower.endsWith('.ndjson')) return 'NDJSON';
  if (lower.endsWith('.csv')) return 'CSV';
  return '';
}

function firstObject(logs: LogEntry[]): Record<string, any> | null {
  for (const log of logs) {
    if (log && typeof log === 'object') return log as Record<string, any>;
  }
  return null;
}

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
  const openTraceModal = useLogStore((s) => s.openTraceModal);

  const hasErrors = !!queryErrors && queryErrors.length > 0;
  const isActive = !!appliedQuery;
  // Single line: center the editor with the buttons. Multi-line: align to the top.
  const multiline = queryText.includes('\n');

  // Auto-detected field mapping (shown in the toolbar for transparency)
  const detected = useMemo(() => {
    const sample = firstObject(logs);
    return {
      timestamp: sample ? autoDetectTimestampField(sample) : null,
      level: sample ? autoDetectLevelField(sample) : null,
      service: detectServiceNameField(logs),
    };
  }, [logs]);

  const format = formatOf(fileName);

  return (
    <div
      style={{
        padding: '8px 12px',
        backgroundColor: '#0d0d0d',
        borderBottom: '1px solid #222',
        flexShrink: 0,
      }}
    >
      {/* Meta row: file info · detected mapping · count · service map */}
      {totalCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#52525b',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#a1a1aa' }}>
            <FileText size={12} />
            <span title={fileName} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName || 'logs'}
            </span>
            <span style={{ color: '#52525b' }}>
              · {totalCount.toLocaleString()} entries{format ? ` · ${format}` : ''}
            </span>
          </span>

          {(detected.timestamp || detected.level || detected.service) && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#3f3f46', fontWeight: 600, letterSpacing: '0.5px' }}>DETECTED</span>
              {detected.timestamp && <Mapping label="ts" value={detected.timestamp} />}
              {detected.level && <Mapping label="level" value={detected.level} />}
              {detected.service && <Mapping label="service" value={detected.service} />}
            </span>
          )}

          <span style={{ flex: 1 }} />

          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {isFiltering ? (
              <>
                <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Filtering…</span>
              </>
            ) : (
              <>
                <span style={{ color: '#a1a1aa', fontWeight: 600 }}>{filteredCount.toLocaleString()}</span>
                <span>/ {totalCount.toLocaleString()}</span>
              </>
            )}
          </span>

          {detected.service && (
            <button
              onClick={() => openTraceModal('all', logs)}
              title="Open service map for all logs"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                backgroundColor: 'transparent',
                color: '#a1a1aa',
                borderRadius: '5px',
                border: '1px solid #333',
                cursor: 'pointer',
                fontSize: '11px',
                fontFamily: 'monospace',
              }}
            >
              <Network size={12} />
              SERVICE MAP
            </button>
          )}
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Editor row */}
      <div style={{ display: 'flex', gap: '8px', alignItems: multiline ? 'flex-start' : 'center' }}>
        <QueryEditor
          value={queryText}
          onChange={setQueryText}
          onRun={() => runQuery()}
          onClear={clearQuery}
          availableFields={availableFields}
          active={isActive}
          hasErrors={hasErrors}
        />

        <button
          onClick={() => runQuery()}
          title="Run query (Ctrl/Cmd + Enter)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 13px',
            height: '34px',
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

        <button
          onClick={toggleSettingsPanel}
          title="Filters & settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 13px',
            height: '34px',
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
    </div>
  );
}

function Mapping({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ color: '#52525b' }}>{label}</span>
      <span style={{ color: '#3f3f46' }}>←</span>
      <span style={{ color: '#9cdcfe' }}>{value}</span>
    </span>
  );
}
