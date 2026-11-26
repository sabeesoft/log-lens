import { memo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { LogEntry } from '../types';
import { getLogLevel, getLogTimestamp, autoDetectLevelField } from '../utils/fieldMapping';

interface LogRowProps {
  log: LogEntry;
  isSelected: boolean;
  expanded: boolean;
  onClick: () => void;
  onToggleExpand: () => void;
  activeSearchTerms: string[];
  getLevelBorderColor: (level: string) => string;
  visibleFields: string[];
  levelField: string;
  timestampField: string;
}

const highlightText = (text: string, searchTerms: string[]) => {
  if (!searchTerms.length) return text;

  const parts: any[] = [];
  let lastIndex = 0;

  searchTerms.forEach(term => {
    if (!term) return;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index >= lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
        parts.push(
          <span key={match.index} style={{ backgroundColor: 'var(--vscode-editor-findMatchHighlightBackground, #facc15)', color: 'var(--vscode-editor-foreground, #000)', padding: '0 2px' }}>
            {match[0]}
          </span>
        );
        lastIndex = match.index + match[0].length;
      }
    }
  });
  parts.push(text.slice(lastIndex));

  return parts;
};

const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
};

const chevronStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '16px',
  height: '16px',
  color: 'var(--vscode-descriptionForeground, #71717a)',
  cursor: 'pointer',
};

const stringify = (v: unknown): string =>
  v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

const getSummaryText = (log: LogEntry, visibleFields: string[]): string => {
  if (typeof log === 'string') return log;
  if (!log || typeof log !== 'object') return String(log);

  const showAllFields = visibleFields.length === 0 || visibleFields.includes('all');

  if (!showAllFields) {
    return visibleFields
      .map((field) => {
        const value = getNestedValue(log, field);
        if (value === undefined || value === null) return null;
        return `${field}: ${stringify(value)}`;
      })
      .filter(Boolean)
      .join(' | ');
  }

  const msg = log.message ?? log.msg ?? log['@message'];
  if (msg !== undefined && msg !== null) return stringify(msg);

  const keys = Object.keys(log);
  const preview: string[] = [];
  for (const key of keys) {
    if (['level', 'severity', 'timestamp', 'time', 'date', '@timestamp'].includes(key)) continue;
    const v = log[key];
    const s = stringify(v);
    preview.push(`${key}=${s.length > 60 ? s.slice(0, 60) + '…' : s}`);
    if (preview.join(' ').length > 200) break;
  }
  return preview.join(' ');
};

const renderExpandedJson = (obj: any, indent: number = 0): React.ReactNode[] => {
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
  const entries = isArray ? obj.map((v: any, i: number) => [String(i), v]) : Object.entries(obj);
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  elements.push(
    <span key="open" style={{ color: 'var(--vscode-descriptionForeground, #71717a)' }}>{openBracket}</span>
  );

  if (entries.length > 0) {
    elements.push(<br key="open-br" />);

    (entries as [string, any][]).forEach(([key, value], idx) => {
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
          {renderExpandedJson(value, indent + 1)}
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

const LogRow = memo(({ log, isSelected, expanded, onClick, onToggleExpand, activeSearchTerms, getLevelBorderColor, visibleFields, levelField, timestampField }: LogRowProps) => {
  const isString = typeof log === 'string';
  const logLevel = isString ? 'info' : getLogLevel(log, levelField || (autoDetectLevelField(log) ?? ''));
  const logTimestamp = isString ? null : getLogTimestamp(log, timestampField);
  const summaryText = getSummaryText(log, visibleFields);
  const borderColor = isString ? 'var(--vscode-descriptionForeground, #71717a)' : getLevelBorderColor(logLevel);

  return (
    <div
      style={{
        backgroundColor: isSelected ? 'var(--vscode-editorWidget-background, #1a1a2e)' : 'var(--vscode-editor-background, #0f0f0f)',
        border: '1px solid var(--vscode-editorWidget-background, #1a1a1a)',
        borderLeft: `3px solid ${borderColor}`,
        marginBottom: '1px',
      }}
    >
      {/* Collapsed header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 6px',
          minHeight: '26px',
          cursor: 'pointer',
        }}
      >
        <div
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          style={chevronStyle}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>

        {logTimestamp && (
          <span style={{ fontSize: '10px', color: 'var(--vscode-disabledForeground, #52525b)', fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {logTimestamp}
          </span>
        )}

        <div
          onClick={onClick}
          style={{
            fontSize: '11px',
            color: 'var(--vscode-foreground, #d4d4d8)',
            flex: 1,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            cursor: 'pointer',
          }}
          title="Click to open details"
        >
          {highlightText(summaryText, activeSearchTerms)}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            padding: '4px 6px 8px 28px',
            borderTop: '1px solid var(--vscode-editorWidget-background, #1a1a1a)',
            backgroundColor: 'var(--vscode-editor-background, #0a0a0a)',
          }}
        >
          <pre
            style={{
              fontSize: '11px',
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              margin: 0,
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--vscode-foreground, #d4d4d8)',
            }}
          >
            {isString ? (
              <span style={{ color: 'var(--vscode-charts-green, #34d399)' }}>{log}</span>
            ) : (
              renderExpandedJson(log)
            )}
          </pre>
        </div>
      )}
    </div>
  );
});

LogRow.displayName = 'LogRow';

export default LogRow;
