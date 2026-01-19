import { useState, useEffect } from 'react';
import { Code, ChevronDown, ChevronUp, Play } from 'lucide-react';

interface TransformPanelProps {
  isOpen: boolean;
  script: string;
  enabled: boolean;
  onToggle: () => void;
  onScriptChange: (script: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onApply: () => void;
}

const exampleConfigs = [
  {
    name: 'Pino Logs',
    config: {
      level: { from: 'level' },
      timestamp: { from: 'time' },
      message: { from: 'msg' },
      copyFields: 'all'
    }
  },
  {
    name: 'Bunyan Logs',
    config: {
      level: { from: 'level' },
      timestamp: { from: 'time' },
      message: { from: 'msg' },
      copyFields: ['name', 'hostname', 'pid']
    }
  },
  {
    name: 'Custom Format',
    config: {
      level: { from: 'severity' },
      timestamp: { from: '@timestamp' },
      message: { from: '@message' },
      copyFields: 'all'
    }
  }
];

export default function TransformPanel({
  isOpen,
  script,
  enabled,
  onToggle,
  onScriptChange,
  onEnabledChange,
  onApply
}: TransformPanelProps) {
  const [localScript, setLocalScript] = useState(script);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setLocalScript(script);
  }, [script]);

  const handleApply = () => {
    // Validate JSON
    if (localScript.trim()) {
      try {
        JSON.parse(localScript);
        setError('');
        onScriptChange(localScript);
        onApply();
      } catch (e) {
        setError('Invalid JSON: ' + (e instanceof Error ? e.message : 'Unknown error'));
      }
    } else {
      setError('');
      onScriptChange(localScript);
      onApply();
    }
  };

  const handleSelectExample = (config: any) => {
    setLocalScript(JSON.stringify(config, null, 2));
    setError('');
  };

  return (
    <div
      style={{
        backgroundColor: '#0f0f0f',
        border: '1px solid #222',
        borderRadius: '4px',
        marginBottom: '8px',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          backgroundColor: '#1a1a1a',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Code size={14} color="#10b981" />
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#e5e7eb', fontFamily: 'monospace' }}>
            TRANSFORM
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEnabledChange(!enabled);
            }}
            style={{
              padding: '2px 8px',
              fontSize: '9px',
              fontWeight: 600,
              fontFamily: 'monospace',
              backgroundColor: enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: `1px solid ${enabled ? '#10b981' : '#ef4444'}`,
              borderRadius: '3px',
              color: enabled ? '#10b981' : '#ef4444',
              cursor: 'pointer'
            }}
          >
            {enabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <div style={{ color: '#71717a' }}>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Content */}
      {isOpen && (
        <div style={{ padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#a1a1aa', marginBottom: '8px', fontFamily: 'monospace', lineHeight: '1.5' }}>
            Configure field mapping to normalize logs from different formats
          </div>

          {/* Example Configs */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '9px', color: '#71717a', marginBottom: '6px', fontFamily: 'monospace' }}>
              EXAMPLE CONFIGS:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {exampleConfigs.map((example) => (
                <button
                  key={example.name}
                  onClick={() => handleSelectExample(example.config)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '9px',
                    fontFamily: 'monospace',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '3px',
                    color: '#a1a1aa',
                    cursor: 'pointer'
                  }}
                >
                  {example.name}
                </button>
              ))}
            </div>
          </div>

          {/* JSON Config Input */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '9px', color: '#71717a', marginBottom: '4px', fontFamily: 'monospace' }}>
              JSON CONFIGURATION:
            </div>
            <textarea
              value={localScript}
              onChange={(e) => {
                setLocalScript(e.target.value);
                setError('');
              }}
              placeholder={`{\n  "level": { "from": "lvl" },\n  "timestamp": { "from": "time" },\n  "message": { "from": "msg" },\n  "copyFields": "all"\n}`}
              rows={8}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '10px',
                fontFamily: 'monospace',
                backgroundColor: '#0a0a0a',
                color: '#e5e7eb',
                border: error ? '1px solid #ef4444' : '1px solid #333',
                borderRadius: '4px',
                outline: 'none',
                resize: 'vertical'
              }}
            />
            {error && (
              <div style={{ fontSize: '9px', color: '#ef4444', marginTop: '4px', fontFamily: 'monospace' }}>
                {error}
              </div>
            )}
          </div>

          {/* Apply Button */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={handleApply}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                fontSize: '10px',
                fontWeight: 600,
                fontFamily: 'monospace',
                backgroundColor: '#10b981',
                border: 'none',
                borderRadius: '3px',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              <Play size={12} />
              APPLY
            </button>
          </div>

          {/* Instructions */}
          <div
            style={{
              marginTop: '12px',
              padding: '8px',
              backgroundColor: '#0a0a0a',
              border: '1px solid #1a1a1a',
              borderRadius: '3px',
              fontSize: '8px',
              color: '#71717a',
              fontFamily: 'monospace',
              lineHeight: '1.5'
            }}
          >
            <div style={{ color: '#a1a1aa', fontWeight: 600, marginBottom: '4px' }}>CONFIGURATION FORMAT:</div>
            <div>• <code style={{ color: '#60a5fa' }}>level.from</code> - Source field for level (auto-converts numbers to strings)</div>
            <div>• <code style={{ color: '#60a5fa' }}>timestamp.from</code> - Source field for timestamp (auto-converts unix timestamps)</div>
            <div>• <code style={{ color: '#60a5fa' }}>message.from</code> - Source field for message</div>
            <div>• <code style={{ color: '#60a5fa' }}>copyFields</code> - "all" or ["field1", "field2"] to copy specific fields</div>
            <div>• <code style={{ color: '#60a5fa' }}>addFields</code> - Object with custom fields to add</div>
            <div>• <code style={{ color: '#60a5fa' }}>keepStrings</code> - true/false to keep plain string logs (default: true)</div>
            <div style={{ marginTop: '6px', color: '#a1a1aa' }}>
              Supports nested fields with dot notation: <code style={{ color: '#60a5fa' }}>user.profile.name</code>
            </div>
            <div style={{ marginTop: '4px', color: '#a1a1aa' }}>
              Leave blank to use auto-detection for common log formats
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
