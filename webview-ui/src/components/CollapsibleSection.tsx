import React, { useState, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  iconColor: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  headerRight?: ReactNode;
}

export default function CollapsibleSection({
  title,
  icon,
  iconColor,
  children,
  defaultExpanded = true,
  headerRight
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      style={{
        backgroundColor: '#111',
        borderRadius: '6px',
        border: '1px solid #222',
        marginBottom: '8px',
        overflow: 'visible',
        position: 'relative'
      }}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#71717a', display: 'flex', alignItems: 'center' }}>
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span style={{ color: iconColor, display: 'flex', alignItems: 'center' }}>{icon}</span>
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#a1a1aa', fontFamily: 'monospace' }}>
            {title}
          </span>
        </div>
        {headerRight && (
          <div onClick={(e) => e.stopPropagation()}>
            {headerRight}
          </div>
        )}
      </div>
      {isExpanded && (
        <div style={{ padding: '0 12px 12px 12px' }}>
          {children}
        </div>
      )}
    </div>
  );
}
