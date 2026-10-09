import { useState, useCallback, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, FileJson } from 'lucide-react';
import { LogEntry } from '../types';
import { useLogStore } from '../store/logStore';
import { getTraceIdValue, detectTraceConfig, getServiceValue } from '../utils/traceUtils';
import { postToHost } from '../utils/vscodeApi';

interface SidebarProps {
  log: LogEntry | null;
  onClose: () => void;
}

type TabType = 'raw' | 'pretty' | 'tree' | 'trace';

const MIN_WIDTH = 400;
const MAX_WIDTH_PERCENT = 75;
const DEFAULT_WIDTH_PERCENT = 40;

const getMaxWidth = () => Math.max(MIN_WIDTH, Math.floor(window.innerWidth * MAX_WIDTH_PERCENT / 100));
const getDefaultWidth = () => Math.max(MIN_WIDTH, Math.floor(window.innerWidth * DEFAULT_WIDTH_PERCENT / 100));

// Anything whose text is longer than this collapses behind a caret, so rows
// never blow up — one affordance (the ▸ caret) for objects, arrays and strings.
const LONG_VALUE = 160;

const keyStyle = { color: 'var(--vscode-textLink-foreground, #60a5fa)' };
const muted = { color: 'var(--vscode-descriptionForeground, #71717a)' };
const Caret = ({ open }: { open: boolean }) => (
  <span style={{ ...muted, marginRight: '4px' }}>{open ? '▼' : '▶'}</span>
);

const isLargeObject = (value: any): boolean => {
  const count = Array.isArray(value) ? value.length : Object.keys(value).length;
  if (count > 12) return true;
  try {
    return JSON.stringify(value).length > LONG_VALUE;
  } catch {
    return false;
  }
};

const TreeNode = ({ value, nodeKey, depth }: { value: any; nodeKey: string | null; depth: number }) => {
  const isObject = value !== null && typeof value === 'object';
  const isLongString = typeof value === 'string' && value.length > LONG_VALUE;
  // Collapsed by default when deep or large; strings start collapsed when long.
  const [expanded, setExpanded] = useState(
    isObject ? depth < 2 && !isLargeObject(value) : !isLongString
  );
  const indent = depth * 16;

  if (value === null || value === undefined) {
    return (
      <div style={{ marginLeft: `${indent}px`, fontFamily: 'monospace', fontSize: '11px' }}>
        {nodeKey && <span style={keyStyle}>{nodeKey}: </span>}
        <span style={muted}>{String(value)}</span>
      </div>
    );
  }

  // Long strings and stack traces: same caret affordance as objects.
  if (typeof value === 'string') {
    if (!isLongString) {
      return (
        <div style={{ marginLeft: `${indent}px`, fontFamily: 'monospace', fontSize: '11px' }}>
          {nodeKey && <span style={keyStyle}>{nodeKey}: </span>}
          <span style={{ color: 'var(--vscode-charts-green, #34d399)' }}>"{value}"</span>
        </div>
      );
    }
    return (
      <div style={{ marginLeft: `${indent}px`, fontFamily: 'monospace', fontSize: '11px' }}>
        <div onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer', userSelect: 'none' }}>
          <Caret open={expanded} />
          {nodeKey && <span style={keyStyle}>{nodeKey}: </span>}
          {!expanded && (
            <>
              <span style={{ color: 'var(--vscode-charts-green, #34d399)' }}>
                "{value.slice(0, 80)}…"
              </span>
              <span style={{ ...muted, marginLeft: '6px' }}>{value.length} chars</span>
            </>
          )}
        </div>
        {expanded && (
          <div
            style={{
              marginLeft: '16px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--vscode-charts-green, #34d399)',
              maxHeight: '240px',
              overflow: 'auto',
            }}
          >
            {value}
          </div>
        )}
      </div>
    );
  }

  if (typeof value !== 'object') {
    const color = typeof value === 'boolean' ? 'var(--vscode-charts-yellow, #f59e0b)' : 'var(--vscode-charts-purple, #a78bfa)';
    return (
      <div style={{ marginLeft: `${indent}px`, fontFamily: 'monospace', fontSize: '11px' }}>
        {nodeKey && <span style={keyStyle}>{nodeKey}: </span>}
        <span style={{ color }}>{String(value)}</span>
      </div>
    );
  }

  try {
    const isArray = Array.isArray(value);
    const entries = isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value);
    const bracket = isArray ? ['[', ']'] : ['{', '}'];
    const summary = isArray ? `${entries.length} items` : `${entries.length} keys`;

    return (
      <div style={{ marginLeft: `${indent}px`, fontFamily: 'monospace', fontSize: '11px' }}>
        <div
          onClick={() => setExpanded(!expanded)}
          style={{ cursor: 'pointer', color: 'var(--vscode-foreground, #d4d4d8)', userSelect: 'none' }}
        >
          <Caret open={expanded} />
          {nodeKey && <span style={keyStyle}>{nodeKey}: </span>}
          <span style={muted}>{bracket[0]}</span>
          {!expanded && <span style={{ ...muted, margin: '0 2px' }}>… {summary}</span>}
          {!expanded && <span style={muted}>{bracket[1]}</span>}
        </div>
        {expanded && (
          <>
            {entries.map(([k, v]) => (
              <TreeNode key={`${nodeKey || 'root'}-${k}`} value={v} nodeKey={k} depth={depth + 1} />
            ))}
            <div style={{ marginLeft: `${indent}px`, ...muted }}>{bracket[1]}</div>
          </>
        )}
      </div>
    );
  } catch (error) {
    return (
      <div style={{ marginLeft: `${indent}px`, fontFamily: 'monospace', fontSize: '11px', color: 'var(--vscode-charts-red, #ef4444)' }}>
        {nodeKey && <span style={keyStyle}>{nodeKey}: </span>}
        <span>[Error rendering value]</span>
      </div>
    );
  }
};

export default function Sidebar({ log, onClose }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('pretty');
  const [copied, setCopied] = useState(false);
  const [width, setWidth] = useState(getDefaultWidth);
  const [isResizing, setIsResizing] = useState(false);

  // Get logs and openTraceModal from store
  const logs = useLogStore((state) => state.logs);
  const openTraceModal = useLogStore((state) => state.openTraceModal);
  const stepSelection = useLogStore((state) => state.stepSelection);
  const fileName = useLogStore((state) => state.fileName);

  // ↑/↓ step through rows while the panel is open (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      stepSelection(e.key === 'ArrowDown' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepSelection]);

  const openAsJsonTab = useCallback(() => {
    if (log === null || log === undefined) {
      return;
    }
    const content = typeof log === 'string' ? log : JSON.stringify(log, null, 2);
    postToHost({ type: 'openAsJson', content, fileName });
  }, [log, fileName]);

  // Detect trace config and get value from current log
  const traceConfig = detectTraceConfig(logs);
  const traceIdField = traceConfig.traceIdField;
  const currentTraceId = log ? getTraceIdValue(log, traceIdField) : null;

  // Get related logs with the same trace ID
  const traceLogs = currentTraceId
    ? logs.filter((l) => {
        if (typeof l === 'string') return false;
        const logTraceId = getTraceIdValue(l, traceIdField);
        return logTraceId === currentTraceId;
      })
    : [];

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

  if (!log) return null;

  const jsonString = typeof log === 'string' ? log : JSON.stringify(log, null, 2);
  const rawString = typeof log === 'string' ? log : JSON.stringify(log);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeTab === 'raw' ? rawString : jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Render JSON manually with proper syntax highlighting (avoids VS Code CSP issues with dangerouslySetInnerHTML)
  const renderPrettyJson = (obj: any, indent: number = 0): React.ReactNode[] => {
    const spaces = '  '.repeat(indent);
    const elements: React.ReactNode[] = [];

    if (typeof obj !== 'object' || obj === null) {
      const color = obj === null ? 'var(--vscode-descriptionForeground, #71717a)' :
                    typeof obj === 'string' ? 'var(--vscode-charts-green, #34d399)' :
                    typeof obj === 'boolean' ? 'var(--vscode-charts-yellow, #f59e0b)' : 'var(--vscode-charts-purple, #a78bfa)';
      const display = typeof obj === 'string' ? `"${obj}"` : String(obj);
      return [<span key="value" style={{ color }}>{display}</span>];
    }

    const isArray = Array.isArray(obj);
    const entries = isArray ? obj.map((v, i) => [String(i), v]) : Object.entries(obj);
    const openBracket = isArray ? '[' : '{';
    const closeBracket = isArray ? ']' : '}';

    elements.push(
      <span key="open" style={{ color: 'var(--vscode-descriptionForeground, #71717a)' }}>{openBracket}</span>
    );

    if (entries.length > 0) {
      elements.push(<br key="open-br" />);

      entries.forEach(([key, value], idx) => {
        const childSpaces = '  '.repeat(indent + 1);
        elements.push(
          <span key={`line-${idx}`}>
            {childSpaces}
            {!isArray && (
              <>
                <span style={{ color: 'var(--vscode-textLink-foreground, #60a5fa)' }}>"{key}"</span>
                <span style={{ color: 'var(--vscode-foreground, #d4d4d8)' }}>: </span>
              </>
            )}
            {renderPrettyJson(value, indent + 1)}
            {idx < entries.length - 1 && <span style={{ color: 'var(--vscode-foreground, #d4d4d8)' }}>,</span>}
            <br />
          </span>
        );
      });

      elements.push(<span key="close-spaces">{spaces}</span>);
    }

    elements.push(
      <span key="close" style={{ color: 'var(--vscode-descriptionForeground, #71717a)' }}>{closeBracket}</span>
    );

    return elements;
  };

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
          zIndex: 999
        }}
      />

      {/* Sidebar panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: `${width}px`,
          maxWidth: '90vw',
          height: '100%',
          backgroundColor: 'var(--vscode-editor-background, #0a0a0a)',
          borderLeft: '1px solid var(--vscode-editorWidget-background, #222)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 1000,
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
            backgroundColor: isResizing ? 'var(--vscode-charts-blue, #3b82f6)' : 'transparent',
            transition: 'background-color 0.15s',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            if (!isResizing) e.currentTarget.style.backgroundColor = 'var(--vscode-panel-border, #333)';
          }}
          onMouseLeave={(e) => {
            if (!isResizing) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        />

        {/* Header */}
        <div
          style={{
            padding: '12px',
            borderBottom: '1px solid var(--vscode-editorWidget-background, #222)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vscode-descriptionForeground, #a1a1aa)', fontFamily: 'monospace' }}>
            LOG DETAILS
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleCopy}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                color: copied ? 'var(--vscode-charts-green, #10b981)' : 'var(--vscode-descriptionForeground, #71717a)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontFamily: 'monospace'
              }}
              title="Copy to clipboard"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'COPIED' : 'COPY'}</span>
            </button>
            <button
              onClick={openAsJsonTab}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                color: 'var(--vscode-descriptionForeground, #71717a)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontFamily: 'monospace'
              }}
              title="Open the full record in a JSON editor tab"
            >
              <FileJson size={14} />
              <span>JSON TAB</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: 'var(--vscode-descriptionForeground, #71717a)',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0',
            borderBottom: '1px solid var(--vscode-editorWidget-background, #222)',
            padding: '0 12px'
          }}
        >
          {(['raw', 'pretty', 'tree'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--vscode-textLink-foreground, #60a5fa)' : '2px solid transparent',
                cursor: 'pointer',
                padding: '8px 12px',
                color: activeTab === tab ? 'var(--vscode-textLink-foreground, #60a5fa)' : 'var(--vscode-descriptionForeground, #71717a)',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                transition: 'all 0.2s'
              }}
            >
              {tab}
            </button>
          ))}
          {currentTraceId && (
            <button
              onClick={() => setActiveTab('trace')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'trace' ? '2px solid var(--vscode-textLink-foreground, #60a5fa)' : '2px solid transparent',
                cursor: 'pointer',
                padding: '8px 12px',
                color: activeTab === 'trace' ? 'var(--vscode-textLink-foreground, #60a5fa)' : 'var(--vscode-descriptionForeground, #71717a)',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                transition: 'all 0.2s'
              }}
            >
              trace ({traceLogs.length})
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {activeTab === 'raw' && (
            <pre
              style={{
                fontSize: '11px',
                color: 'var(--vscode-foreground, #d4d4d8)',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                margin: 0,
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {rawString}
            </pre>
          )}

          {activeTab === 'pretty' && (
            <pre
              style={{
                fontSize: '11px',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                margin: 0,
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--vscode-foreground, #d4d4d8)'
              }}
            >
              {typeof log === 'string' ? (
                <span style={{ color: 'var(--vscode-charts-green, #34d399)' }}>"{log}"</span>
              ) : (
                renderPrettyJson(log)
              )}
            </pre>
          )}

          {activeTab === 'tree' && (
            <div style={{ lineHeight: '1.6' }}>
              {typeof log === 'string' ? (
                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--vscode-charts-green, #34d399)' }}>"{log}"</div>
              ) : (
                <TreeNode value={log} nodeKey={null} depth={0} />
              )}
            </div>
          )}

          {activeTab === 'trace' && currentTraceId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Trace ID */}
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--vscode-sideBar-background, #111)',
                  borderRadius: '8px',
                  border: '1px solid var(--vscode-editorWidget-background, #222)'
                }}
              >
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ color: 'var(--vscode-descriptionForeground, #71717a)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase' }}>Trace ID</span>
                </div>
                <div style={{ color: 'var(--vscode-textLink-foreground, #60a5fa)', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {currentTraceId}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div
                  style={{
                    flex: 1,
                    padding: '16px 12px',
                    backgroundColor: 'var(--vscode-sideBar-background, #111)',
                    borderRadius: '8px',
                    border: '1px solid var(--vscode-editorWidget-background, #222)',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ color: 'var(--vscode-foreground, #f3f4f6)', fontSize: '24px', fontWeight: 600, fontFamily: 'monospace' }}>
                    {traceLogs.length}
                  </div>
                  <div style={{ color: 'var(--vscode-descriptionForeground, #71717a)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', marginTop: '4px' }}>
                    Logs
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '16px 12px',
                    backgroundColor: 'var(--vscode-sideBar-background, #111)',
                    borderRadius: '8px',
                    border: '1px solid var(--vscode-editorWidget-background, #222)',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ color: 'var(--vscode-foreground, #f3f4f6)', fontSize: '24px', fontWeight: 600, fontFamily: 'monospace' }}>
                    {new Set(traceLogs.filter(l => typeof l !== 'string').map(l => getServiceValue(l, traceConfig.serviceNameField)).filter(Boolean)).size}
                  </div>
                  <div style={{ color: 'var(--vscode-descriptionForeground, #71717a)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', marginTop: '4px' }}>
                    Services
                  </div>
                </div>
              </div>

              {/* View Trace Button */}
              <button
                onClick={() => openTraceModal(currentTraceId, traceLogs)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '14px 16px',
                  backgroundColor: 'var(--vscode-charts-blue, #3b82f6)',
                  color: 'var(--vscode-foreground, #fff)',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-button-background, #2563eb)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-charts-blue, #3b82f6)'}
              >
                <ExternalLink size={14} />
                VIEW SERVICE MAP
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
