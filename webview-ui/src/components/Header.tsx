import { useState } from 'react';
import { Search, Settings, X, FileText, Loader2 } from 'lucide-react';

interface HeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSearchTrigger: () => void;
  onSettingsToggle: () => void;
  settingsOpen: boolean;
  filteredCount: number;
  totalCount: number;
  fileName?: string;
  isFiltering?: boolean;
}

export default function Header({
  searchTerm,
  onSearchChange,
  onSearchTrigger,
  onSettingsToggle,
  settingsOpen,
  filteredCount,
  totalCount,
  fileName,
  isFiltering = false
}: HeaderProps) {
  const [inputValue, setInputValue] = useState(searchTerm);

  const handleSearch = () => {
    onSearchChange(inputValue);
    onSearchTrigger();
  };

  const handleClear = () => {
    setInputValue('');
    onSearchChange('');
    onSearchTrigger();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      handleClear();
    }
  };

  const hasActiveSearch = searchTerm.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: '#111',
        borderBottom: '1px solid #222',
        flexShrink: 0
      }}
    >
      {/* Search input */}
      <div style={{ flex: 1, position: 'relative', maxWidth: '500px', display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search logs... (Enter to search)"
            style={{
              width: '100%',
              padding: '8px 32px 8px 12px',
              backgroundColor: '#1a1a1a',
              border: '1px solid',
              borderColor: hasActiveSearch ? '#3b82f6' : '#333',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#d4d4d8',
              fontFamily: 'monospace',
              outline: 'none'
            }}
          />
          {inputValue && (
            <button
              onClick={handleClear}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: '#71717a',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={isFiltering}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px',
            backgroundColor: isFiltering ? '#333' : hasActiveSearch ? '#3b82f6' : '#222',
            color: isFiltering ? '#666' : hasActiveSearch ? '#fff' : '#a1a1aa',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: isFiltering ? '#333' : hasActiveSearch ? '#3b82f6' : '#333',
            cursor: isFiltering ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            gap: '6px'
          }}
          title="Search (Enter)"
        >
          {isFiltering ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
        </button>
      </div>

      {/* File name display */}
      {fileName && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: '#1a1a1a',
            borderRadius: '6px',
            border: '1px solid #333'
          }}
        >
          <FileText size={14} color="#71717a" />
          <span
            style={{
              fontSize: '12px',
              color: '#d4d4d8',
              fontFamily: 'monospace',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={fileName}
          >
            {fileName}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Results count */}
      <div style={{ fontSize: '12px', color: '#71717a', fontFamily: 'monospace', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {isFiltering ? (
          <>
            <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Filtering...</span>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </>
        ) : (
          <>
            <span style={{ color: '#d4d4d8', fontWeight: 600 }}>{filteredCount}</span>
            <span> / {totalCount}</span>
          </>
        )}
      </div>

      {/* Settings toggle button */}
      <button
        onClick={onSettingsToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          backgroundColor: settingsOpen ? '#3b82f6' : '#222',
          color: settingsOpen ? '#fff' : '#a1a1aa',
          borderRadius: '6px',
          border: '1px solid',
          borderColor: settingsOpen ? '#3b82f6' : '#333',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: 'monospace',
          transition: 'all 0.15s ease'
        }}
      >
        <Settings size={14} />
        <span>Filters</span>
      </button>
    </div>
  );
}
