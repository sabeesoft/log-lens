import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { tokenize } from '../lib/logql';
import type { Token, TokenType } from '../lib/logql';

// VS Code-dark-ish token colors
const TOKEN_COLORS: Partial<Record<TokenType, string>> = {
  string: '#ce9178',
  regex: '#d16969',
  number: '#b5cea8',
  bool: '#569cd6',
  op: '#d4d4d4',
  pipe: '#6b7280',
  ident: '#9cdcfe',
  lparen: '#d4d4d4',
  rparen: '#d4d4d4',
  lbracket: '#d4d4d4',
  rbracket: '#d4d4d4',
  comma: '#d4d4d4',
};
const COMMAND_KW = new Set(['fields', 'filter', 'sort', 'limit']);
const keywordColor = (value: string) => (COMMAND_KW.has(value) ? '#569cd6' : '#c586c0');

const FONT = "13px 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";
const LINE_HEIGHT = 20;
const PAD = 8;

const ALL_KEYWORDS = [
  'fields',
  'filter',
  'sort',
  'limit',
  'and',
  'or',
  'not',
  'in',
  'like',
  'asc',
  'desc',
];

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onClear: () => void;
  availableFields: string[];
  active: boolean;
  hasErrors: boolean;
}

interface Suggestion {
  label: string;
  kind: 'keyword' | 'field';
}

export default function QueryEditor({
  value,
  onChange,
  onRun,
  onClear,
  availableFields,
  active,
  hasErrors,
}: QueryEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const charRef = useRef<HTMLSpanElement>(null);
  const activeLiRef = useRef<HTMLLIElement>(null);

  const [charWidth, setCharWidth] = useState(7.8);
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [caret, setCaret] = useState({ top: 0, left: 0 });

  const lines = value.length === 0 ? 1 : value.split('\n').length;
  const gutterWidth = Math.max(28, String(lines).length * 8 + 16);

  // Measure character width (monospace)
  useLayoutEffect(() => {
    if (charRef.current) {
      const w = charRef.current.getBoundingClientRect().width / 10;
      if (w > 0) setCharWidth(w);
    }
  }, []);

  // Build highlighted segments from the shared lib tokenizer
  const segments = useMemo(() => buildSegments(value), [value]);

  // Keep the highlight layer scroll in sync with the textarea
  const syncScroll = () => {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop;
      preRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  const currentWord = (pos: number): { word: string; start: number } => {
    let start = pos;
    while (start > 0 && /[A-Za-z0-9_@.]/.test(value[start - 1])) start--;
    return { word: value.slice(start, pos), start };
  };

  const updateSuggestions = () => {
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const { word, start } = currentWord(pos);

    if (word.length === 0) {
      setSuggestions([]);
      return;
    }
    const lower = word.toLowerCase();
    const kw: Suggestion[] = ALL_KEYWORDS.filter((k) => k.startsWith(lower)).map((label) => ({
      label,
      kind: 'keyword',
    }));
    const fields: Suggestion[] = availableFields
      .filter((f) => f.toLowerCase().includes(lower) && f.toLowerCase() !== lower)
      .slice(0, 8)
      .map((label) => ({ label, kind: 'field' }));
    const next = [...fields, ...kw].slice(0, 10);

    setSuggestions(next);
    setActiveIdx(0);

    // Caret position in viewport coords (monospace: column * charWidth).
    // Fixed positioning so the popup is never clipped by an overflow:hidden ancestor.
    const before = value.slice(0, start);
    const rows = before.split('\n');
    const row = rows.length - 1;
    const col = rows[rows.length - 1].length;
    const rect = ta.getBoundingClientRect();
    setCaret({
      top: rect.top + PAD + (row + 1) * LINE_HEIGHT - ta.scrollTop,
      left: rect.left + PAD + col * charWidth - ta.scrollLeft,
    });
  };

  // Debounce suggestions while typing so the popup doesn't flicker on every keypress
  useEffect(() => {
    const id = window.setTimeout(() => updateSuggestions(), 180);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Keep the highlighted suggestion in view while navigating with arrows
  useEffect(() => {
    activeLiRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const acceptSuggestion = (s: Suggestion) => {
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const { start } = currentWord(pos);
    const insert = s.label + ' ';
    const next = value.slice(0, start) + insert + value.slice(pos);
    onChange(next);
    setSuggestions([]);
    requestAnimationFrame(() => {
      const newPos = start + insert.length;
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const popupOpen = suggestions.length > 0;

    if (popupOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        acceptSuggestion(suggestions[activeIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuggestions([]);
        return;
      }
      // Moving the caret horizontally dismisses the popup (avoids stale state)
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        setSuggestions([]);
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      setSuggestions([]);
      onRun();
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      e.currentTarget.blur();
    }
  };

  const borderColor = hasErrors ? '#ef4444' : active ? '#3b82f6' : focused ? '#3f3f46' : '#2a2a2a';

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      {/* hidden ruler to measure monospace char width */}
      <span
        ref={charRef}
        aria-hidden
        style={{ position: 'absolute', visibility: 'hidden', font: FONT, whiteSpace: 'pre' }}
      >
        MMMMMMMMMM
      </span>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          backgroundColor: '#1a1a1a',
          border: `1px solid ${borderColor}`,
          borderRadius: '6px',
          overflow: 'hidden',
          transition: 'border-color 0.15s ease',
        }}
      >
        {/* Gutter */}
        <div
          aria-hidden
          style={{
            width: gutterWidth,
            flexShrink: 0,
            padding: `${PAD}px 0`,
            backgroundColor: '#161616',
            borderRight: '1px solid #262626',
            font: FONT,
            lineHeight: `${LINE_HEIGHT}px`,
            color: '#52525b',
            textAlign: 'right',
            userSelect: 'none',
          }}
        >
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} style={{ padding: '0 8px' }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Editor area */}
        <div style={{ position: 'relative', flex: 1, minHeight: LINE_HEIGHT + PAD * 2 }}>
          {/* Highlight layer */}
          <pre
            ref={preRef}
            aria-hidden
            style={{
              margin: 0,
              padding: `${PAD}px ${PAD}px`,
              font: FONT,
              lineHeight: `${LINE_HEIGHT}px`,
              whiteSpace: 'pre',
              overflow: 'hidden',
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              color: '#d4d4d8',
            }}
          >
            {value.length === 0 ? (
              <span style={{ color: '#4b4b53' }}>
                {'fields @timestamp, level, message | filter level = "error" | sort @timestamp desc'}
              </span>
            ) : (
              segments.map((seg, i) => (
                <span key={i} style={{ color: seg.color }}>
                  {seg.text}
                </span>
              ))
            )}
            {/* trailing newline so the last empty line keeps height */}
            {value.endsWith('\n') ? '​' : ''}
          </pre>

          {/* Textarea (transparent text, visible caret) */}
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            onBlur={() => {
              setFocused(false);
              // delay so clicks on the popup register
              setTimeout(() => setSuggestions([]), 120);
            }}
            onClick={updateSuggestions}
            onFocus={() => {
              setFocused(true);
              updateSuggestions();
            }}
            spellCheck={false}
            rows={Math.min(Math.max(lines, 1), 8)}
            style={{
              display: 'block',
              position: 'relative',
              width: '100%',
              minHeight: LINE_HEIGHT + PAD * 2,
              // auto-grow by content (rows); no manual drag-resize (kept layers in sync)
              resize: 'none',
              padding: `${PAD}px ${PAD}px`,
              margin: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              font: FONT,
              lineHeight: `${LINE_HEIGHT}px`,
              whiteSpace: 'pre',
              overflow: 'auto',
              color: 'transparent',
              caretColor: '#e4e4e7',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {value && (
          <button
            onClick={onClear}
            title="Clear query (show all)"
            style={{
              position: 'absolute',
              right: '6px',
              top: '6px',
              background: 'rgba(26,26,26,0.8)',
              border: 'none',
              cursor: 'pointer',
              padding: '3px',
              color: '#71717a',
              display: 'flex',
              borderRadius: '4px',
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>×</span>
          </button>
        )}
      </div>

      {/* Autocomplete popup */}
      {suggestions.length > 0 && (
        <ul
          style={{
            position: 'fixed',
            top: caret.top,
            left: caret.left,
            zIndex: 1000,
            margin: 0,
            padding: '4px',
            listStyle: 'none',
            minWidth: '200px',
            maxHeight: '240px',
            overflowY: 'auto',
            backgroundColor: '#1f1f1f',
            border: '1px solid #3a3a3a',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            font: FONT,
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={s.kind + s.label}
              ref={i === activeIdx ? activeLiRef : null}
              onMouseDown={(e) => {
                e.preventDefault();
                acceptSuggestion(s);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: i === activeIdx ? '#2d3f5f' : 'transparent',
                color: '#e4e4e7',
              }}
            >
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: s.kind === 'keyword' ? '#569cd6' : '#9cdcfe',
                  width: '14px',
                }}
              >
                {s.kind === 'keyword' ? 'K' : 'ƒ'}
              </span>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Segment {
  text: string;
  color: string;
}

function buildSegments(input: string): Segment[] {
  if (!input) return [];
  const { tokens } = tokenize(input);
  const segments: Segment[] = [];
  let last = 0;

  for (const tok of tokens as Token[]) {
    if (tok.type === 'eof') break;
    if (tok.start > last) {
      segments.push({ text: input.slice(last, tok.start), color: '#d4d4d8' });
    }
    const raw = input.slice(tok.start, tok.end);
    const color =
      tok.type === 'keyword' ? keywordColor(tok.value) : TOKEN_COLORS[tok.type] ?? '#d4d4d8';
    segments.push({ text: raw, color });
    last = tok.end;
  }
  if (last < input.length) {
    segments.push({ text: input.slice(last), color: '#d4d4d8' });
  }
  return segments;
}
