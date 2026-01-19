import React, { useRef, useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Search } from 'lucide-react';
import LogRow from './LogRow';
import { LogEntry } from '../types';

interface LogListProps {
  logs: LogEntry[];
  selectedLogIndex: number | null;
  onSelectLog: (index: number) => void;
  activeSearchTerms: string[];
  getLevelBorderColor: (level: string) => string;
  visibleFields: string[];
  levelField: string;
  timestampField: string;
}

export default function LogList({
  logs,
  selectedLogIndex,
  onSelectLog,
  activeSearchTerms,
  getLevelBorderColor,
  visibleFields,
  levelField,
  timestampField
}: LogListProps) {
  const [listHeight, setListHeight] = useState<number>(600);
  const listRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top - 20;
        setListHeight(Math.max(400, availableHeight));
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  if (logs.length === 0) {
    return (
      <div
        style={{
          backgroundColor: '#111',
          border: '1px solid #222',
          padding: '24px',
          textAlign: 'center',
          borderRadius: '6px'
        }}
      >
        <Search size={24} color="#333" style={{ margin: '0 auto 8px' }} />
        <p style={{ color: '#71717a', fontSize: '12px', margin: 0, fontFamily: 'monospace' }}>no matches</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ paddingBottom: '16px' }}>
      <List ref={listRef} height={listHeight} itemCount={logs.length} itemSize={28} width="100%">
        {({ index, style }: any) => (
          <div style={style}>
            <LogRow
              log={logs[index]}
              isSelected={selectedLogIndex === index}
              onClick={() => onSelectLog(index)}
              activeSearchTerms={activeSearchTerms}
              getLevelBorderColor={getLevelBorderColor}
              visibleFields={visibleFields}
              levelField={levelField}
              timestampField={timestampField}
            />
          </div>
        )}
      </List>
    </div>
  );
}
