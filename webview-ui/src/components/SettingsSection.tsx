import React from 'react';
import { Settings } from 'lucide-react';

interface SettingsSectionProps {
  allFields: string[];
  levelField: string;
  timestampField: string;
  onLevelFieldChange: (field: string) => void;
  onTimestampFieldChange: (field: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function SettingsSection({
  allFields,
  levelField,
  timestampField,
  onLevelFieldChange,
  onTimestampFieldChange,
  isOpen,
  onToggle
}: SettingsSectionProps) {
  return (
    <div
      style={{
        backgroundColor: '#111',
        borderRadius: '6px',
        border: '1px solid #222',
        padding: '12px',
        marginBottom: '8px'
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          marginBottom: isOpen ? '8px' : '0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Settings size={12} color="#f59e0b" />
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#a1a1aa', fontFamily: 'monospace' }}>
            FIELD MAPPING
          </span>
        </div>
        <span style={{ fontSize: '10px', color: '#71717a', fontFamily: 'monospace' }}>
          {isOpen ? '▼' : '▶'}
        </span>
      </div>

      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '9px', color: '#71717a', fontFamily: 'monospace', marginBottom: '4px' }}>
            Configure which fields represent level and timestamp in your logs
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', color: '#a1a1aa', fontFamily: 'monospace', fontWeight: 600 }}>
              LEVEL FIELD
            </label>
            <select
              value={levelField}
              onChange={(e) => onLevelFieldChange(e.target.value)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '3px',
                fontSize: '11px',
                color: '#d4d4d8',
                fontFamily: 'monospace'
              }}
            >
              <option value="">auto-detect</option>
              {allFields.map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>
            <span style={{ fontSize: '8px', color: '#52525b', fontFamily: 'monospace' }}>
              Used for color coding (info, warn, error, debug)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', color: '#a1a1aa', fontFamily: 'monospace', fontWeight: 600 }}>
              TIMESTAMP FIELD
            </label>
            <select
              value={timestampField}
              onChange={(e) => onTimestampFieldChange(e.target.value)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '3px',
                fontSize: '11px',
                color: '#d4d4d8',
                fontFamily: 'monospace'
              }}
            >
              <option value="">auto-detect</option>
              {allFields.map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>
            <span style={{ fontSize: '8px', color: '#52525b', fontFamily: 'monospace' }}>
              Used for displaying time in log rows
            </span>
          </div>

          <div style={{
            marginTop: '4px',
            padding: '6px',
            backgroundColor: '#0a0a0a',
            borderRadius: '3px',
            border: '1px solid #1a1a1a'
          }}>
            <div style={{ fontSize: '8px', color: '#71717a', fontFamily: 'monospace' }}>
              <div style={{ marginBottom: '2px', color: '#a1a1aa', fontWeight: 600 }}>AUTO-DETECT</div>
              <div>• Level: checks for 'level', 'severity', 'priority'</div>
              <div>• Timestamp: checks for 'timestamp', 'time', 'date', '@timestamp'</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
