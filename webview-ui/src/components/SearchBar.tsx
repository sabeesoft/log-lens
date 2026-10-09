import { useEffect, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useLogStore } from '../store/logStore';
import { autoDetectLevelField, getLogLevel } from '../utils/fieldMapping';
import { getLevelBorderColor } from '../utils/logUtils';
import { LogEntry } from '../types';

// Standard levels in severity order; only those present are shown as chips.
const LEVEL_ORDER = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
const SCAN_CAP = 50000;

function detectLevels(logs: LogEntry[]): string[] {
  const sample = logs.find((l) => l && typeof l === 'object') as LogEntry | undefined;
  const field = sample ? autoDetectLevelField(sample) : null;
  if (!field) {
    return [];
  }
  const found = new Set<string>();
  const limit = Math.min(logs.length, SCAN_CAP);
  for (let i = 0; i < limit && found.size < LEVEL_ORDER.length; i++) {
    const log = logs[i];
    if (log && typeof log === 'object') {
      const lvl = getLogLevel(log, field);
      if (LEVEL_ORDER.includes(lvl)) {
        found.add(lvl);
      }
    }
  }
  return LEVEL_ORDER.filter((l) => found.has(l));
}

export default function SearchBar() {
  const searchTerm = useLogStore((s) => s.searchTerm);
  const setSearchTerm = useLogStore((s) => s.setSearchTerm);
  const triggerSearch = useLogStore((s) => s.triggerSearch);
  const activeLevels = useLogStore((s) => s.activeLevels);
  const toggleLevel = useLogStore((s) => s.toggleLevel);
  const logs = useLogStore((s) => s.logs);

  const levels = useMemo(() => detectLevels(logs), [logs]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Live, debounced search as the user types.
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const onChange = (value: string) => {
    setSearchTerm(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => triggerSearch(), 250);
  };

  const runNow = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    triggerSearch();
  };

  const clear = () => {
    setSearchTerm('');
    runNow();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: 1,
          minWidth: 0,
          height: '34px',
          padding: '0 10px',
          backgroundColor: 'var(--vscode-input-background, #1f1f1f)',
          border: '1px solid var(--vscode-input-border, var(--vscode-panel-border, #333))',
          borderRadius: '6px',
        }}
      >
        <Search size={14} style={{ color: 'var(--vscode-descriptionForeground, #a1a1aa)', flexShrink: 0 }} />
        <input
          value={searchTerm}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              runNow();
            }
          }}
          placeholder="Search message and all fields…"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--vscode-input-foreground, var(--vscode-foreground, #f3f4f6))',
            fontSize: '13px',
            fontFamily: 'monospace',
          }}
        />
        {searchTerm && (
          <button
            onClick={clear}
            title="Clear search"
            style={{
              display: 'flex',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--vscode-descriptionForeground, #a1a1aa)',
              flexShrink: 0,
              padding: 0,
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {levels.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {levels.map((level) => {
            const active = activeLevels.includes(level);
            const color = getLevelBorderColor(level);
            return (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                title={`Filter to ${level}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '26px',
                  padding: '0 9px',
                  backgroundColor: active ? color : 'transparent',
                  color: active ? 'var(--vscode-editor-background, #0a0a0a)' : color,
                  border: `1px solid ${color}`,
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                {level}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
