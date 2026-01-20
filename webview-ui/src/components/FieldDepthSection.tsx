import React from 'react';
import { Layers } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';

interface FieldDepthSectionProps {
  fieldDepth: number;
  appliedFieldDepth: number;
  onDepthChange: (depth: number) => void;
  onApply: () => void;
}

export default function FieldDepthSection({
  fieldDepth,
  appliedFieldDepth,
  onDepthChange,
  onApply
}: FieldDepthSectionProps) {
  const hasChanges = fieldDepth !== appliedFieldDepth;

  return (
    <CollapsibleSection
      title="FIELD DEPTH"
      icon={<Layers size={12} />}
      iconColor="#10b981"
      defaultExpanded={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '9px', color: '#71717a', fontFamily: 'monospace' }}>
          Control how deep nested fields are extracted for filtering and display
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="number"
            min={1}
            max={10}
            value={fieldDepth}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!isNaN(value) && value >= 1 && value <= 10) {
                onDepthChange(value);
              }
            }}
            style={{
              width: '60px',
              padding: '4px 8px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '3px',
              fontSize: '11px',
              color: '#d4d4d8',
              fontFamily: 'monospace',
              textAlign: 'center'
            }}
          />

          <div style={{ display: 'flex', gap: '4px' }}>
            {[1, 2, 3, 5].map((depth) => (
              <button
                key={depth}
                onClick={() => onDepthChange(depth)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: fieldDepth === depth ? '#3b82f6' : '#222',
                  color: fieldDepth === depth ? '#fff' : '#71717a',
                  fontFamily: 'monospace'
                }}
              >
                {depth}
              </button>
            ))}
          </div>

          <button
            onClick={onApply}
            disabled={!hasChanges}
            style={{
              marginLeft: 'auto',
              padding: '4px 12px',
              borderRadius: '3px',
              fontSize: '10px',
              fontWeight: 700,
              border: 'none',
              cursor: hasChanges ? 'pointer' : 'not-allowed',
              backgroundColor: hasChanges ? '#10b981' : '#1a1a1a',
              color: hasChanges ? '#fff' : '#52525b',
              fontFamily: 'monospace',
              opacity: hasChanges ? 1 : 0.6
            }}
          >
            APPLY
          </button>
        </div>

        <div style={{
          marginTop: '4px',
          padding: '6px',
          backgroundColor: '#0a0a0a',
          borderRadius: '3px',
          border: '1px solid #1a1a1a'
        }}>
          <div style={{ fontSize: '8px', color: '#71717a', fontFamily: 'monospace' }}>
            <div style={{ marginBottom: '2px', color: '#a1a1aa', fontWeight: 600 }}>DEPTH EXAMPLES</div>
            <div>• Depth 1: only top-level fields (e.g., message, level)</div>
            <div>• Depth 2: one level of nesting (e.g., message.text)</div>
            <div>• Depth 3+: deeper nested fields (e.g., data.user.profile)</div>
          </div>
        </div>

        {hasChanges && (
          <div style={{
            fontSize: '9px',
            color: '#f59e0b',
            fontFamily: 'monospace',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span>Pending: {fieldDepth}</span>
            <span style={{ color: '#52525b' }}>|</span>
            <span style={{ color: '#71717a' }}>Current: {appliedFieldDepth}</span>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
