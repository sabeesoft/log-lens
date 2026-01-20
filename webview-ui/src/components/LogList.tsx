import { useRef, useState, useEffect, useCallback } from 'react';
import { VariableSizeList as List } from 'react-window';
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
  const [listKey, setListKey] = useState(0);
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowHeights = useRef<Map<number, number>>(new Map());

  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions(prev => {
        if (prev.width !== width || prev.height !== height) {
          return { width, height };
        }
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    // Initial dimension update with delays to catch layout completion
    updateDimensions();
    const timeoutId1 = setTimeout(updateDimensions, 50);
    const timeoutId2 = setTimeout(updateDimensions, 150);

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
      // Reset row heights when container resizes since text wrapping may change
      rowHeights.current.clear();
      listRef.current?.resetAfterIndex(0);
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateDimensions);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [updateDimensions]);

  // Reset row heights and force list re-render when logs or visible fields change
  // Note: activeSearchTerms is intentionally excluded to prevent blinking on every keystroke
  useEffect(() => {
    rowHeights.current.clear();
    setListKey(prev => prev + 1);
  }, [logs, visibleFields]);

  const getItemSize = useCallback((index: number) => {
    return rowHeights.current.get(index) || 28; // Default height
  }, []);

  const setRowHeight = useCallback((index: number, height: number) => {
    if (rowHeights.current.get(index) !== height) {
      rowHeights.current.set(index, height);
      listRef.current?.resetAfterIndex(index);
    }
  }, []);

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

  // Use a fallback height based on window size to ensure list renders even before ResizeObserver fires
  // Subtract approximate header height (50px) for initial render
  const fallbackHeight = typeof window !== 'undefined' ? window.innerHeight - 50 : 400;
  const listHeight = dimensions.height > 0 ? dimensions.height : fallbackHeight;
  const listWidth = dimensions.width > 0 ? dimensions.width : '100%';

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        height: '100%'
      }}
    >
      <List
        key={listKey}
        ref={listRef}
        height={listHeight}
        itemCount={logs.length}
        itemSize={getItemSize}
        width={listWidth}
        estimatedItemSize={28}
      >
        {({ index, style }: { index: number; style: React.CSSProperties }) => (
          <div style={style}>
            <RowWrapper
              index={index}
              setRowHeight={setRowHeight}
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

interface RowWrapperProps {
  index: number;
  setRowHeight: (index: number, height: number) => void;
  log: LogEntry;
  isSelected: boolean;
  onClick: () => void;
  activeSearchTerms: string[];
  getLevelBorderColor: (level: string) => string;
  visibleFields: string[];
  levelField: string;
  timestampField: string;
}

function RowWrapper({
  index,
  setRowHeight,
  log,
  isSelected,
  onClick,
  activeSearchTerms,
  getLevelBorderColor,
  visibleFields,
  levelField,
  timestampField
}: RowWrapperProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rowRef.current) {
      const height = rowRef.current.getBoundingClientRect().height;
      setRowHeight(index, height);
    }
  }, [index, setRowHeight, log, visibleFields]);

  return (
    <div ref={rowRef}>
      <LogRow
        log={log}
        isSelected={isSelected}
        onClick={onClick}
        activeSearchTerms={activeSearchTerms}
        getLevelBorderColor={getLevelBorderColor}
        visibleFields={visibleFields}
        levelField={levelField}
        timestampField={timestampField}
      />
    </div>
  );
}
