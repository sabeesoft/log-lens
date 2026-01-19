import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { LogEntry } from '../types';

interface SidebarProps {
  log: LogEntry | null;
  onClose: () => void;
}

type TabType = 'raw' | 'pretty' | 'tree';

const TreeNode = ({ value, nodeKey, depth }: { value: any; nodeKey: string | null; depth: number }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const indent = depth * 16;

  if (value === null || value === undefined) {
    return (
      <div style={{ marginLeft: `${indent}px`, fontFamily: 'monospace', fontSize: '11px' }}>
        {nodeKey && <span style={{ color: '#60a5fa' }}>{nodeKey}: </span>}
        <span style={{ color: '#71717a' }}>{String(value)}</span>
      </div>
    );
  }

  if (typeof value !== 'object') {
    const color = typeof value === 'string' ? '#34d399' : typeof value === 'boolean' ? '#f59e0b' : '#a78bfa';
    return (
      <div style={{ marginLeft: `${indent}px`, fontFamily: 'monospace', fontSize: '11px' }}>
        {nodeKey && <span style={{ color: '#60a5fa' }}>{nodeKey}: </span>}
        <span style={{ color }}>{typeof value === 'string' ? `"${value}"` : String(value)}</span>
      </div>
    );
  }

  try {
    const isArray = Array.isArray(value);
    const entries = isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value);
    const bracket = isArray ? ['[', ']'] : ['{', '}'];

    return (
      <div style={{ marginLeft: `${indent}px`, fontFamily: 'monospace', fontSize: '11px' }}>
        <div
          onClick={() => setExpanded(!expanded)}
          style={{ cursor: 'pointer', color: '#d4d4d8', userSelect: 'none' }}
        >
          <span style={{ color: '#71717a', marginRight: '4px' }}>{expanded ? '▼' : '▶'}</span>
          {nodeKey && <span style={{ color: '#60a5fa' }}>{nodeKey}: </span>}
          <span style={{ color: '#71717a' }}>{bracket[0]}</span>
          {!expanded && <span style={{ color: '#71717a' }}>...</span>}
          {!expanded && <span style={{ color: '#71717a' }}>{bracket[1]}</span>}
        </div>
        {expanded && (
          <>
            {entries.map(([k, v]) => (
              <TreeNode key={`${nodeKey || 'root'}-${k}`} value={v} nodeKey={k} depth={depth + 1} />
            ))}
            <div style={{ marginLeft: `${indent}px`, color: '#71717a' }}>{bracket[1]}</div>
          </>
        )}
      </div>
    );
  } catch (error) {
    return (
      <div style={{ marginLeft: `${indent}px`, fontFamily: 'monospace', fontSize: '11px', color: '#ef4444' }}>
        {nodeKey && <span style={{ color: '#60a5fa' }}>{nodeKey}: </span>}
        <span>[Error rendering value]</span>
      </div>
    );
  }
};

export default function Sidebar({ log, onClose }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('pretty');
  const [copied, setCopied] = useState(false);

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

  const syntaxHighlight = (json: string) => {
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = '#d4d4d8'; // default
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = '#60a5fa'; // key (blue)
        } else {
          cls = '#34d399'; // string (green)
        }
      } else if (/true|false/.test(match)) {
        cls = '#f59e0b'; // boolean (orange)
      } else if (/null/.test(match)) {
        cls = '#71717a'; // null (gray)
      } else {
        cls = '#a78bfa'; // number (purple)
      }
      return `<span style="color: ${cls}">${match}</span>`;
    });
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
          width: '500px',
          height: '100%',
          backgroundColor: '#0a0a0a',
          borderLeft: '1px solid #222',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 1000,
          boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px',
            borderBottom: '1px solid #222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', fontFamily: 'monospace' }}>
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
                color: copied ? '#10b981' : '#71717a',
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
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: '#71717a',
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
            borderBottom: '1px solid #222',
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
                borderBottom: activeTab === tab ? '2px solid #60a5fa' : '2px solid transparent',
                cursor: 'pointer',
                padding: '8px 12px',
                color: activeTab === tab ? '#60a5fa' : '#71717a',
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
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {activeTab === 'raw' && (
            <pre
              style={{
                fontSize: '11px',
                color: '#d4d4d8',
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
                wordBreak: 'break-word'
              }}
              dangerouslySetInnerHTML={{ __html: syntaxHighlight(jsonString) }}
            />
          )}

          {activeTab === 'tree' && (
            <div style={{ lineHeight: '1.6' }}>
              {typeof log === 'string' ? (
                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#34d399' }}>"{log}"</div>
              ) : (
                <TreeNode value={log} nodeKey={null} depth={0} />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
