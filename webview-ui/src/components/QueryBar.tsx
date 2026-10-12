import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, AlertCircle, Settings, FileText, Loader2, Network, Search, Terminal, FolderOpen, Plus, ChevronDown } from 'lucide-react';
import { getHost, getWebHost } from '../host';
import type { OpenMode } from '../host/webHost';
import { useLogStore } from '../store/logStore';
import { useLogFields } from '../hooks/useLogFields';
import { autoDetectLevelField, autoDetectTimestampField } from '../utils/fieldMapping';
import { detectServiceNameField } from '../utils/traceUtils';
import { LogEntry } from '../types';
import type { ViewMode } from '../store/logStore';
import QueryEditor from './QueryEditor';
import SearchBar from './SearchBar';

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

const LOGQL_KEYWORDS = [
  'fields', 'filter', 'sort', 'limit', 'and', 'or', 'not', 'in', 'like', 'asc', 'desc',
];

// 1-based line/column for a character offset into the text.
function lineCol(text: string, offset: number): { line: number; col: number } {
  const before = text.slice(0, Math.max(0, offset));
  const rows = before.split('\n');
  return { line: rows.length, col: rows[rows.length - 1].length + 1 };
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Suggest the closest keyword or field for an unrecognized identifier-like token.
function suggestFix(token: string, fields: string[]): string | null {
  const t = token.trim();
  if (!t || !/^[\w@.-]+$/.test(t)) return null;
  const lower = t.toLowerCase();
  const candidates = [...LOGQL_KEYWORDS, ...fields];
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (c.toLowerCase() === lower) return null; // already valid
    const d = levenshtein(lower, c.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  // Only suggest a close match (scaled to token length).
  return best && bestDist <= Math.max(1, Math.floor(t.length / 3)) ? best : null;
}

// Prefix the line containing `offset` with `# ` to disable it.
function commentOutLine(text: string, offset: number): string {
  const lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  return text.slice(0, lineStart) + '# ' + text.slice(lineStart);
}

function QuickFix({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '1px 8px',
        backgroundColor: 'transparent',
        color: 'var(--vscode-textLink-foreground, #60a5fa)',
        border: '1px solid var(--vscode-panel-border, #3f3f46)',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '11px',
        fontFamily: 'monospace',
      }}
    >
      {label}
    </button>
  );
}

export default function QueryBar() {
  const mode = useLogStore((s) => s.mode);
  const setMode = useLogStore((s) => s.setMode);
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
        backgroundColor: 'var(--vscode-editor-background, #0d0d0d)',
        borderBottom: '1px solid var(--vscode-editorWidget-background, #222)',
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
            color: 'var(--vscode-disabledForeground, #52525b)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--vscode-descriptionForeground, #a1a1aa)' }}>
            <FileText size={12} />
            <span title={fileName} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName || 'logs'}
            </span>
            <span style={{ color: 'var(--vscode-disabledForeground, #52525b)' }}>
              · {totalCount.toLocaleString()} entries{format ? ` · ${format}` : ''}
            </span>
          </span>

          {(detected.timestamp || detected.level || detected.service) && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--vscode-panel-border, #3f3f46)', fontWeight: 600, letterSpacing: '0.5px' }}>DETECTED</span>
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
                <span style={{ color: 'var(--vscode-descriptionForeground, #a1a1aa)', fontWeight: 600 }}>{filteredCount.toLocaleString()}</span>
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
                color: 'var(--vscode-descriptionForeground, #a1a1aa)',
                borderRadius: '5px',
                border: '1px solid var(--vscode-panel-border, #333)',
                cursor: 'pointer',
                fontSize: '11px',
                fontFamily: 'monospace',
              }}
            >
              <Network size={12} />
              SERVICE MAP
            </button>
          )}

          <OpenFileButton />
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Editor row */}
      <div style={{ display: 'flex', gap: '8px', alignItems: mode === 'query' && multiline ? 'flex-start' : 'center' }}>
        <ModeToggle mode={mode} setMode={setMode} />

        {mode === 'search' ? (
          <SearchBar />
        ) : (
          <>
            <QueryEditor
              value={queryText}
              onChange={setQueryText}
              onRun={() => runQuery()}
              onClear={clearQuery}
              availableFields={availableFields}
              active={isActive}
              errors={queryErrors ?? []}
            />

            <button
              onClick={() => !hasErrors && runQuery()}
              disabled={hasErrors}
              title={hasErrors ? 'Fix the query errors to run' : 'Run query (Ctrl/Cmd + Enter)'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 13px',
                height: '34px',
                backgroundColor: hasErrors ? 'var(--vscode-editorWidget-background, #222)' : 'var(--vscode-charts-blue, #3b82f6)',
                color: hasErrors ? 'var(--vscode-disabledForeground, #52525b)' : 'var(--vscode-foreground, #fff)',
                borderRadius: '6px',
                border: `1px solid ${hasErrors ? 'var(--vscode-panel-border, #333)' : 'var(--vscode-charts-blue, #3b82f6)'}`,
                cursor: hasErrors ? 'not-allowed' : 'pointer',
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
          </>
        )}

        <button
          onClick={toggleSettingsPanel}
          title="Filters & settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 13px',
            height: '34px',
            backgroundColor: settingsOpen ? 'var(--vscode-charts-blue, #3b82f6)' : 'var(--vscode-editorWidget-background, #222)',
            color: settingsOpen ? 'var(--vscode-foreground, #fff)' : 'var(--vscode-descriptionForeground, #a1a1aa)',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: settingsOpen ? 'var(--vscode-charts-blue, #3b82f6)' : 'var(--vscode-panel-border, #333)',
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
          {queryErrors!.map((err, i) => {
            const { line, col } = lineCol(queryText, err.start);
            const token = queryText.slice(err.start, err.end);
            const suggestion = suggestFix(token, availableFields);
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                  fontSize: '11.5px',
                  color: 'var(--vscode-charts-red, #fca5a5)',
                  fontFamily: 'monospace',
                }}
              >
                <AlertCircle size={12} style={{ flexShrink: 0 }} />
                <span style={{ color: 'var(--vscode-descriptionForeground, #a1a1aa)' }}>
                  line {line}, col {col}
                </span>
                <span>· {err.message}</span>
                {suggestion && (
                  <QuickFix
                    label={`Did you mean "${suggestion}"?`}
                    onClick={() => {
                      const next = queryText.slice(0, err.start) + suggestion + queryText.slice(err.end);
                      runQuery(next);
                    }}
                  />
                )}
                <QuickFix
                  label={`Comment out line ${line}`}
                  onClick={() => runQuery(commentOutLine(queryText, err.start))}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: ViewMode; setMode: (m: ViewMode) => void }) {
  const options: { key: ViewMode; label: string; Icon: typeof Search }[] = [
    { key: 'search', label: 'Search', Icon: Search },
    { key: 'query', label: 'Query', Icon: Terminal },
  ];
  return (
    <div
      style={{
        display: 'flex',
        height: '34px',
        padding: '3px',
        gap: '2px',
        backgroundColor: 'var(--vscode-editorWidget-background, #222)',
        border: '1px solid var(--vscode-panel-border, #333)',
        borderRadius: '6px',
        flexShrink: 0,
      }}
    >
      {options.map(({ key, label, Icon }) => {
        const active = mode === key;
        return (
          <button
            key={key}
            onClick={() => setMode(key)}
            title={`${label} mode`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 11px',
              backgroundColor: active ? 'var(--vscode-charts-blue, #3b82f6)' : 'transparent',
              color: active
                ? 'var(--vscode-foreground, #fff)'
                : 'var(--vscode-descriptionForeground, #a1a1aa)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'monospace',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Web/PWA only: a discoverable "Open file" action in the toolbar, offering two
// choices — open a fresh file, or append one to the current logs. In VS Code
// files are opened through the editor, so this is hidden there.
function OpenFileButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (getHost().kind !== 'web') {
    return null;
  }

  const choose = (mode: OpenMode) => {
    setOpen(false);
    getWebHost()?.requestOpen(mode);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Open a log file — everything stays in your browser"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 8px',
          backgroundColor: open ? 'var(--vscode-charts-blue, #3b82f6)' : 'transparent',
          color: open ? 'var(--vscode-foreground, #fff)' : 'var(--vscode-textLink-foreground, #60a5fa)',
          borderRadius: '5px',
          border: '1px solid var(--vscode-textLink-foreground, #60a5fa)',
          cursor: 'pointer',
          fontSize: '11px',
          fontFamily: 'monospace',
        }}
      >
        <FolderOpen size={12} />
        OPEN FILE
        <ChevronDown size={12} style={{ opacity: 0.8 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            zIndex: 50,
            minWidth: '220px',
            padding: '4px',
            backgroundColor: 'var(--vscode-editorWidget-background, #1e1e1e)',
            border: '1px solid var(--vscode-panel-border, #3f3f46)',
            borderRadius: '6px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          }}
        >
          <OpenMenuItem
            Icon={FolderOpen}
            label="Open file"
            sub="Replace the current logs"
            onClick={() => choose('replace')}
          />
          <OpenMenuItem
            Icon={Plus}
            label="Add to current logs"
            sub="Append this file's entries"
            onClick={() => choose('append')}
          />
        </div>
      )}
    </div>
  );
}

function OpenMenuItem({
  Icon,
  label,
  sub,
  onClick,
}: {
  Icon: typeof FolderOpen;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        width: '100%',
        padding: '7px 9px',
        backgroundColor: 'transparent',
        color: 'var(--vscode-foreground, #e4e4e7)',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'monospace',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, rgba(255,255,255,0.06))')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <Icon size={14} style={{ marginTop: '1px', color: 'var(--vscode-charts-blue, #3b82f6)', flexShrink: 0 }} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '10.5px', color: 'var(--vscode-descriptionForeground, #a1a1aa)' }}>{sub}</span>
      </span>
    </button>
  );
}

function Mapping({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ color: 'var(--vscode-disabledForeground, #52525b)' }}>{label}</span>
      <span style={{ color: 'var(--vscode-panel-border, #3f3f46)' }}>←</span>
      <span style={{ color: 'var(--vscode-debugTokenExpression-name, #9cdcfe)' }}>{value}</span>
    </span>
  );
}
