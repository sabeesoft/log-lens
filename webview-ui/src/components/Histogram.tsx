import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LogEntry } from '../types';
import { autoDetectTimestampField, autoDetectLevelField, getLogLevel } from '../utils/fieldMapping';

const MAX_BUCKETS = 120;
const BAR_PX = 28;
// Cap each bar's width so a genuinely tiny time span doesn't blow up into blocks.
const BAR_MAX_W = 10;
// Target width of one bar + its gap. The bucket count is derived from the panel
// width / this, so bars stay a consistent width and fill the strip (the way
// CloudWatch/Grafana choose a period to fit the panel) instead of a fixed count
// being stretched, clustered, or scattered.
const SLOT_PX = 7;

// Parse a raw timestamp value to epoch milliseconds.
function toMs(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw < 1e12 ? raw * 1000 : raw;
  const s = String(raw).trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isNaN(n)) return n < 1e12 ? n * 1000 : n;
  const p = Date.parse(s);
  return Number.isNaN(p) ? null : p;
}

// "Nice" bucket widths in milliseconds, the way CloudWatch Logs picks a period:
// seconds → minutes → hours → days, so buckets land on round boundaries.
const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;
const NICE_INTERVALS = [
  S, 2 * S, 5 * S, 10 * S, 15 * S, 30 * S,
  M, 2 * M, 5 * M, 10 * M, 15 * M, 30 * M,
  H, 2 * H, 3 * H, 6 * H, 12 * H,
  D, 2 * D, 7 * D, 14 * D, 30 * D,
];

// Smallest nice interval that keeps the bucket count at or below the target.
function pickInterval(span: number, targetBuckets: number): number {
  const ideal = span / targetBuckets;
  for (const step of NICE_INTERVALS) {
    if (step >= ideal) return step;
  }
  // Span is huge: round up from the coarsest interval to whole multiples.
  const coarsest = NICE_INTERVALS[NICE_INTERVALS.length - 1];
  return Math.ceil(ideal / coarsest) * coarsest;
}

function fmtTime(ms: number, interval: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const iso = d.toISOString();
  if (interval >= D) return iso.slice(0, 10); // YYYY-MM-DD
  if (interval >= M) return iso.slice(11, 16); // HH:MM
  return iso.slice(11, 19); // HH:MM:SS (seconds-level buckets)
}

interface Bucket {
  n: number;
  e: number;
  w: number;
}

export default function Histogram({ logs }: { logs: LogEntry[] }) {
  const barsRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  // Track the chart's rendered width so the bucket count follows the panel.
  useLayoutEffect(() => {
    const el = barsRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const sample = logs.find((l) => l && typeof l === 'object') as LogEntry | undefined;
    const tsField = sample ? autoDetectTimestampField(sample) : null;
    const lvlField = sample ? autoDetectLevelField(sample) : null;
    if (!tsField) return null;

    const times: { t: number; lvl: string }[] = [];
    let min = Infinity;
    let max = -Infinity;
    for (const log of logs) {
      if (!log || typeof log !== 'object') continue;
      const t = toMs((log as Record<string, unknown>)[tsField]);
      if (t === null) continue;
      const lvl = lvlField ? getLogLevel(log, lvlField) : 'info';
      times.push({ t, lvl });
      if (t < min) min = t;
      if (t > max) max = t;
    }
    if (times.length < 2 || max <= min) return null;

    // Target bucket count from the panel width (not a fixed number): enough bars
    // to fill the strip at ~SLOT_PX each. The bucket WIDTH is then snapped to a
    // nice interval (CloudWatch-style), so a few-minute span buckets by seconds
    // and a multi-hour span by minutes/hours.
    const fit = Math.max(1, Math.floor(width / SLOT_PX));
    const target = Math.max(8, Math.min(MAX_BUCKETS, fit));
    const interval = pickInterval(max - min, target);
    // Align the range to whole multiples of the interval → round boundaries.
    const start = Math.floor(min / interval) * interval;
    const end = Math.ceil((max + 1) / interval) * interval;
    const count = Math.max(1, Math.min(MAX_BUCKETS, Math.round((end - start) / interval)));

    const buckets: Bucket[] = Array.from({ length: count }, () => ({ n: 0, e: 0, w: 0 }));
    for (const { t, lvl } of times) {
      const idx = Math.min(count - 1, Math.floor((t - start) / interval));
      const b = buckets[idx];
      b.n++;
      if (lvl === 'error' || lvl === 'fatal') b.e++;
      else if (lvl === 'warn') b.w++;
    }
    const mx = Math.max(1, ...buckets.map((b) => b.n));
    return { buckets, mx, interval, start, mid: start + (end - start) / 2, end };
  }, [logs, width]);

  if (!data) return null;

  const h = (v: number) => Math.round((v / data.mx) * BAR_PX);

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '6px 12px',
        borderTop: '1px solid var(--vscode-panel-border, #2b2b2b)',
        borderBottom: '1px solid var(--vscode-panel-border, #2b2b2b)',
        // A distinct widget surface so the chart stands apart from the editor/list
        backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
      }}
    >
      {/* Bars sit on a baseline so the strip reads as a chart */}
      <div
        ref={barsRef}
        style={{
          height: BAR_PX,
          display: 'flex',
          alignItems: 'flex-end',
          // The bucket count is derived from this element's width, so bars fill
          // the strip at a consistent width with small 1px gaps. Centering only
          // matters in the rare case the data spans so little time that even the
          // finest interval yields fewer bars than fit — then a small, balanced
          // cluster reads better than fat blocks or a scattered row.
          justifyContent: 'center',
          gap: '1px',
          borderBottom: '1px solid var(--vscode-descriptionForeground, #5a5a5a)',
        }}
      >
        {data.buckets.map((b, i) => {
          const total = b.n ? Math.max(2, h(b.n)) : 0;
          const errH = b.e ? Math.max(1, h(b.e)) : 0;
          const warnH = b.w ? Math.max(1, h(b.w)) : 0;
          const restH = Math.max(0, total - errH - warnH);
          const at = fmtTime(data.start + i * data.interval, data.interval);
          const label = `${at} — ${b.n} log${b.n === 1 ? '' : 's'}${b.e ? ` · ${b.e} error` : ''}${b.w ? ` · ${b.w} warn` : ''}`;
          return (
            <div
              key={i}
              title={label}
              style={{ flex: 1, maxWidth: BAR_MAX_W, display: 'flex', flexDirection: 'column-reverse', height: BAR_PX, minWidth: 0 }}
            >
              <div style={{ height: errH, background: 'var(--vscode-charts-red, #f14c4c)' }} />
              <div style={{ height: warnH, background: 'var(--vscode-charts-yellow, #cca700)' }} />
              <div style={{ height: restH, background: 'var(--vscode-charts-blue, #4a9eff)' }} />
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: 'var(--vscode-descriptionForeground, #9db2c4)',
          fontFamily: 'monospace',
        }}
      >
        <span>{fmtTime(data.start, data.interval)}</span>
        <span>{fmtTime(data.mid, data.interval)}</span>
        <span>{fmtTime(data.end, data.interval)}</span>
      </div>
    </div>
  );
}
