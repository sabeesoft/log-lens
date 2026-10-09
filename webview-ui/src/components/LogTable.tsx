import { useRef, useState, useEffect, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { LogEntry } from '../types';
import { normalizeLogLevel } from '../utils/fieldMapping';
import { getLevelBorderColor } from '../utils/logUtils';

interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

interface LogTableProps {
  logs: LogEntry[];
  columns: string[];
  selectedLogIndex: number | null;
  onSelectLog: (index: number) => void;
  sort: SortState | null;
  onSort: (field: string) => void;
}

const ROW_HEIGHT = 30;

// Robust accessor: literal dotted key first, then nested path
const getValue = (obj: any, path: string): any => {
  if (!obj || typeof obj !== 'object') return undefined;
  if (path in obj) return obj[path];
  return path.split('.').reduce((curr, key) => (curr == null ? undefined : curr[key]), obj);
};

function colFlex(col: string): React.CSSProperties {
  const name = col.toLowerCase();
  // Keep the (uppercase) header plus the sort arrow from being truncated
  const headerPx = col.length * 7 + 34;
  if (name.includes('timestamp') || name === 'time' || name === '@timestamp' || name.includes('date')) {
    return { flex: `0 0 ${Math.max(180, headerPx)}px` };
  }
  if (name === 'level' || name.includes('severity') || name.endsWith('.level')) {
    return { flex: `0 0 ${Math.max(70, headerPx)}px` };
  }
  if (name.includes('message') || name.endsWith('msg') || name === '@message') {
    return { flex: `3 1 ${Math.max(240, headerPx)}px` };
  }
  return { flex: `1 1 ${Math.max(110, headerPx)}px` };
}

function renderCell(log: LogEntry, col: string, isLevel: boolean): React.ReactNode {
  if (typeof log === 'string') {
    return col.includes('message') ? log : '';
  }
  const raw = getValue(log, col);
  if (raw === undefined || raw === null) {
    return <span style={{ color: 'var(--vscode-panel-border, #3f3f46)' }}>–</span>;
  }
  // Colour a level column by its OWN value (nested-aware), normalising numeric
  // (Pino/Bunyan) levels to names — not an auto-detected field
  if (isLevel && typeof raw !== 'object') {
    const level = normalizeLogLevel(raw);
    return (
      <span style={{ color: getLevelBorderColor(level), fontWeight: 600, textTransform: 'uppercase' }}>
        {level}
      </span>
    );
  }
  if (typeof raw === 'object') {
    // Show the raw JSON value (truncated by the cell), not just the keys
    const json = JSON.stringify(raw);
    return <span style={{ color: 'var(--vscode-disabledForeground, #8b8b94)' }} title={json}>{json}</span>;
  }
  return String(raw);
}

function cellTitle(log: LogEntry, col: string): string | undefined {
  if (typeof log === 'string') return log;
  const raw = getValue(log, col);
  if (raw === undefined || raw === null) return undefined;
  return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
}

const CELL_BASE: React.CSSProperties = {
  padding: '0 10px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '11px',
  fontFamily: 'monospace',
};

export default function LogTable({
  logs,
  columns,
  selectedLogIndex,
  onSelectLog,
  sort,
  onSort,
}: LogTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(400);

  const updateHeight = useCallback(() => {
    if (containerRef.current) {
      setHeight(containerRef.current.getBoundingClientRect().height);
    }
  }, []);

  useEffect(() => {
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateHeight]);

  const isLevelCol = (col: string) => {
    const n = col.toLowerCase();
    return n === 'level' || n.includes('severity') || n.endsWith('.level');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--vscode-editor-background, #0a0a0a)' }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '30px',
          backgroundColor: 'var(--vscode-sideBar-background, #111)',
          borderBottom: '1px solid var(--vscode-input-background, #262626)',
          flexShrink: 0,
        }}
      >
        {columns.map((col) => {
          const active = sort?.field === col;
          return (
            <div
              key={col}
              onClick={() => onSort(col)}
              title={`Sort by ${col}`}
              style={{
                ...CELL_BASE,
                ...colFlex(col),
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                color: active ? 'var(--vscode-foreground, #d4d4d8)' : 'var(--vscode-descriptionForeground, #71717a)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                userSelect: 'none',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{col}</span>
              {active &&
                (sort!.direction === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
        <List height={height} itemCount={logs.length} itemSize={ROW_HEIGHT} width="100%">
          {({ index, style }: { index: number; style: React.CSSProperties }) => {
            const log = logs[index];
            const selected = selectedLogIndex === index;
            return (
              <div
                style={{
                  ...style,
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: selected ? 'var(--vscode-editorWidget-background, #1a1a2e)' : index % 2 ? 'var(--vscode-editor-background, #0c0c0c)' : 'var(--vscode-editor-background, #0a0a0a)',
                  borderBottom: '1px solid var(--vscode-panel-border, #141414)',
                }}
                onClick={() => onSelectLog(index)}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground, #141420)';
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.backgroundColor = index % 2 ? 'var(--vscode-editor-background, #0c0c0c)' : 'var(--vscode-editor-background, #0a0a0a)';
                }}
              >
                {columns.map((col) => (
                  <div
                    key={col}
                    style={{ ...CELL_BASE, ...colFlex(col), color: 'var(--vscode-foreground, #d4d4d8)' }}
                    title={cellTitle(log, col)}
                  >
                    {renderCell(log, col, isLevelCol(col))}
                  </div>
                ))}
              </div>
            );
          }}
        </List>
      </div>
    </div>
  );
}
