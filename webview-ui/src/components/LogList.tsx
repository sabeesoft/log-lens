import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const listRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      // Only update if dimensions actually changed to avoid unnecessary re-renders
      setDimensions(prev => {
        if (prev.width !== width || prev.height !== height) {
          return { width, height };
        }
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    // Initial dimension calculation with a small delay to ensure DOM is ready
    const initialUpdate = () => {
      updateDimensions();
      // Double-check after a frame to catch any layout shifts
      requestAnimationFrame(() => {
        updateDimensions();
      });
    };

    initialUpdate();

    // Use ResizeObserver for more reliable resize detection
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Also listen to window resize as fallback
    window.addEventListener('resize', updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [updateDimensions]);

  if (logs.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a'
        }}
      >
        <Search size={32} color="#333" style={{ marginBottom: '12px' }} />
        <p style={{ color: '#71717a', fontSize: '13px', margin: 0, fontFamily: 'monospace' }}>
          No logs found
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      {dimensions.height > 0 && (
        <List
          ref={listRef}
          height={dimensions.height}
          itemCount={logs.length}
          itemSize={28}
          width={dimensions.width || '100%'}
        >
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
      )}
    </div>
  );
}
