import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { tokenize } from '../lib/logql';
import type { Token, TokenType, ParseError } from '../lib/logql';

// The base text uses the input foreground so it is always legible; only a few
// token kinds get an accent, with high-contrast fallbacks.
const BASE_TEXT = 'var(--vscode-input-foreground, var(--vscode-editor-foreground, #e6edf3))';
const TOKEN_COLORS: Partial<Record<TokenType, string>> = {
  string: 'var(--vscode-debugTokenExpression-string, #ce9178)',
  regex: 'var(--vscode-debugTokenExpression-error, #ce9178)',
  number: 'var(--vscode-debugTokenExpression-number, #b5cea8)',
  bool: 'var(--vscode-charts-blue, #4fc1ff)',
  op: BASE_TEXT,
  pipe: 'var(--vscode-descriptionForeground, #9db2c4)',
  ident: BASE_TEXT,
  lparen: BASE_TEXT,
  rparen: BASE_TEXT,
  lbracket: BASE_TEXT,
  rbracket: BASE_TEXT,
  comma: BASE_TEXT,
};
const COMMAND_KW = new Set(['fields', 'filter', 'sort', 'limit']);
const keywordColor = (value: string) =>
  COMMAND_KW.has(value)
    ? 'var(--vscode-charts-blue, #4fc1ff)'
    : 'var(--vscode-charts-purple, #c586c0)';

const FONT = "13px 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";
const LINE_HEIGHT = 20;
// PAD is tuned so a single-line editor (20 + 2*7 = 34, +2 border) is 36px tall,
// matching the 34px + border controls — the Search/Query toggle doesn't jump.
const PAD = 7;

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
  errors: ParseError[];
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
  errors,
}: QueryEditorProps) {
  const hasErrors = errors.length > 0;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const charRef = useRef<HTMLSpanElement>(null);
  const activeLiRef = useRef<HTMLLIElement>(null);

  const [charWidth, setCharWidth] = useState(7.8);
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [caret, setCaret] = useState({ top: 0, left: 0 });
  // Cap the editor at 30% of the viewport; it scrolls internally beyond that.
  const [maxPx, setMaxPx] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.3) : 300
  );

  const lines = value.length === 0 ? 1 : value.split('\n').length;
  const gutterWidth = Math.max(28, String(lines).length * 8 + 16);
  const contentPx = lines * LINE_HEIGHT + PAD * 2;
  const editorPx = Math.min(contentPx, maxPx);

  useEffect(() => {
    const onResize = () => setMaxPx(Math.round(window.innerHeight * 0.3));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // When the editor height changes, nudge the virtualized list to re-measure so
  // its bottom rows aren't left hidden behind the taller editor.
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [editorPx]);

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
    if (gutterRef.current && taRef.current) {
      gutterRef.current.scrollTop = taRef.current.scrollTop;
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
    // Rank fields so a match on the leaf name (e.g. `level` → `@message.level`)
    // beats a match buried in the path; otherwise alphabetical slicing hides the
    // fields the user actually typed behind dozens of sibling `@message.*` keys.
    const scoreField = (f: string): number => {
      const fl = f.toLowerCase();
      const leaf = fl.split('.').pop() ?? fl;
      if (leaf === lower) return 0;
      if (leaf.startsWith(lower)) return 1;
      if (fl.startsWith(lower)) return 2;
      if (leaf.includes(lower)) return 3;
      if (fl.includes(lower)) return 4;
      return -1;
    };
    const fields: Suggestion[] = availableFields
      .filter((f) => f.toLowerCase() !== lower)
      .map((f) => ({ f, s: scoreField(f) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => a.s - b.s || a.f.length - b.f.length || a.f.localeCompare(b.f))
      .slice(0, 8)
      .map((x) => ({ label: x.f, kind: 'field' as const }));
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

  const borderColor = hasErrors ? 'var(--vscode-charts-red, #ef4444)' : active ? 'var(--vscode-charts-blue, #3b82f6)' : focused ? 'var(--vscode-panel-border, #3f3f46)' : 'var(--vscode-input-background, #2a2a2a)';

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
          height: editorPx,
          backgroundColor: 'var(--vscode-editorWidget-background, #1a1a1a)',
          border: `1px solid ${borderColor}`,
          borderRadius: '6px',
          overflow: 'hidden',
          transition: 'border-color 0.15s ease',
        }}
      >
        {/* Gutter */}
        <div
          ref={gutterRef}
          aria-hidden
          style={{
            width: gutterWidth,
            flexShrink: 0,
            height: '100%',
            overflow: 'hidden',
            padding: `${PAD}px 0`,
            boxSizing: 'border-box',
            backgroundColor: 'var(--vscode-sideBar-background, #161616)',
            borderRight: '1px solid var(--vscode-input-background, #262626)',
            font: FONT,
            lineHeight: `${LINE_HEIGHT}px`,
            color: 'var(--vscode-disabledForeground, #52525b)',
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
        <div style={{ position: 'relative', flex: 1, height: '100%' }}>
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
              color: BASE_TEXT,
            }}
          >
            {value.length === 0 ? (
              <span style={{ color: 'var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground, #8a8a8a))' }}>
                {'fields @timestamp, level, message | filter level = "error" | sort @timestamp desc'}
              </span>
            ) : (
              segments.map((seg, i) => {
                const segEnd = seg.start + seg.text.length;
                const errored = errors.some((e) => seg.start < e.end && segEnd > e.start);
                return (
                  <span
                    key={i}
                    style={{
                      color: seg.color,
                      textDecoration: errored ? 'underline wavy' : undefined,
                      textDecorationColor: errored ? 'var(--vscode-editorError-foreground, #f14c4c)' : undefined,
                      textDecorationSkipInk: 'none',
                    }}
                  >
                    {seg.text}
                  </span>
                );
              })
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
            style={{
              display: 'block',
              position: 'relative',
              width: '100%',
              height: '100%',
              // height is driven by the container (dynamic, capped at 30vh); the
              // textarea scrolls internally and the gutter/highlight sync to it
              resize: 'none',
              padding: `${PAD}px ${PAD}px`,
              margin: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              font: FONT,
              lineHeight: `${LINE_HEIGHT}px`,
              whiteSpace: 'pre',
              // Only show a scrollbar once we hit the height cap, not while the
              // editor is still free to grow.
              overflowX: 'auto',
              overflowY: contentPx > maxPx ? 'auto' : 'hidden',
              color: 'transparent',
              caretColor: 'var(--vscode-foreground, #e4e4e7)',
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
              // clear the scrollbar gutter when the editor is scrolling
              right: contentPx > maxPx ? '14px' : '7px',
              top: '7px',
              width: '18px',
              height: '18px',
              background: 'var(--vscode-editorWidget-background, #252526)',
              border: '1px solid var(--vscode-panel-border, #3a3a3a)',
              cursor: 'pointer',
              padding: 0,
              color: 'var(--vscode-descriptionForeground, #9db2c4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>×</span>
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
            backgroundColor: 'var(--vscode-input-background, #1f1f1f)',
            border: '1px solid var(--vscode-panel-border, #3a3a3a)',
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
                backgroundColor: i === activeIdx ? 'var(--vscode-panel-border, #2d3f5f)' : 'transparent',
                color: 'var(--vscode-foreground, #e4e4e7)',
              }}
            >
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: s.kind === 'keyword'
                    ? 'var(--vscode-debugTokenExpression-boolean, #569cd6)'
                    : 'var(--vscode-debugTokenExpression-name, #9cdcfe)',
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
  start: number;
}

const DEFAULT_COLOR = BASE_TEXT;
const COMMENT_COLOR = 'var(--vscode-descriptionForeground, #6a9955)';

// Gaps between tokens may contain whitespace and `#` line comments; color the
// comment part so commented-out lines read as disabled.
function pushGap(segments: Segment[], text: string, offset: number): void {
  if (!text) return;
  const hash = text.indexOf('#');
  if (hash === -1) {
    segments.push({ text, color: DEFAULT_COLOR, start: offset });
    return;
  }
  const eol = text.indexOf('\n', hash);
  const end = eol === -1 ? text.length : eol;
  if (hash > 0) segments.push({ text: text.slice(0, hash), color: DEFAULT_COLOR, start: offset });
  segments.push({ text: text.slice(hash, end), color: COMMENT_COLOR, start: offset + hash });
  pushGap(segments, text.slice(end), offset + end);
}

function buildSegments(input: string): Segment[] {
  if (!input) return [];
  const { tokens } = tokenize(input);
  const segments: Segment[] = [];
  let last = 0;

  for (const tok of tokens as Token[]) {
    if (tok.type === 'eof') break;
    if (tok.start > last) {
      pushGap(segments, input.slice(last, tok.start), last);
    }
    const raw = input.slice(tok.start, tok.end);
    const color =
      tok.type === 'keyword' ? keywordColor(tok.value) : TOKEN_COLORS[tok.type] ?? DEFAULT_COLOR;
    segments.push({ text: raw, color, start: tok.start });
    last = tok.end;
  }
  if (last < input.length) {
    pushGap(segments, input.slice(last), last);
  }
  return segments;
}
