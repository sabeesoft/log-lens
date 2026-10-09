import { memo } from 'react';
import { LogEntry } from '../types';
import { getLogLevel, getLogTimestamp } from '../utils/fieldMapping';

interface LogRowProps {
  log: LogEntry;
  isSelected: boolean;
  onClick: () => void;
  activeSearchTerms: string[];
  getLevelBorderColor: (level: string) => string;
  visibleFields: string[];
  levelField: string;
  timestampField: string;
}

const LogRow = memo(({ log, isSelected, onClick, activeSearchTerms, getLevelBorderColor, visibleFields, levelField, timestampField }: LogRowProps) => {
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

  // Handle plain string logs
  if (typeof log === 'string') {
    return (
      <div
        onClick={onClick}
        style={{
          backgroundColor: isSelected ? 'var(--vscode-editorWidget-background, #1a1a2e)' : 'var(--vscode-editor-background, #0f0f0f)',
          border: '1px solid var(--vscode-editorWidget-background, #1a1a1a)',
          borderLeft: '3px solid var(--vscode-descriptionForeground, #71717a)',
          marginBottom: '1px',
          cursor: 'pointer',
          padding: '4px 6px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
          minHeight: '26px'
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: 'var(--vscode-foreground, #d4d4d8)',
            flex: 1,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {highlightText(log, activeSearchTerms)}
        </div>
      </div>
    );
  }

  // Handle object logs
  const logLevel = getLogLevel(log, levelField);
  const logTimestamp = getLogTimestamp(log, timestampField);
  const showAllFields = visibleFields.length === 0 || visibleFields.includes('all');

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: isSelected ? 'var(--vscode-editorWidget-background, #1a1a2e)' : 'var(--vscode-editor-background, #0f0f0f)',
        border: '1px solid var(--vscode-editorWidget-background, #1a1a1a)',
        borderLeft: `3px solid ${getLevelBorderColor(logLevel)}`,
        marginBottom: '1px',
        cursor: 'pointer',
        padding: '4px 6px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '6px',
        minHeight: '26px'
      }}
    >
      {logTimestamp && (
        <span style={{ fontSize: '10px', color: 'var(--vscode-disabledForeground, #52525b)', fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0, paddingTop: '1px' }}>
          {logTimestamp}
        </span>
      )}
      <div
        style={{
          fontSize: '11px',
          color: 'var(--vscode-foreground, #d4d4d8)',
          flex: 1,
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {showAllFields ? (
          highlightText(JSON.stringify(log), activeSearchTerms)
        ) : (
          <span>
            {visibleFields.map((field, index) => {
              const value = getNestedValue(log, field);
              if (value === undefined || value === null) return null;
              const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
              return (
                <span key={field}>
                  <span style={{ color: 'var(--vscode-descriptionForeground, #71717a)' }}>{field}:</span>
                  <span> {highlightText(valueStr, activeSearchTerms)}</span>
                  {index < visibleFields.length - 1 && <span style={{ color: 'var(--vscode-panel-border, #3f3f46)' }}> | </span>}
                </span>
              );
            })}
          </span>
        )}
      </div>
    </div>
  );
});

LogRow.displayName = 'LogRow';

export default LogRow;
