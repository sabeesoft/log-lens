import { useMemo } from 'react';
import { LogEntry } from '../types';
import { autoDetectTimestampField, autoDetectLevelField, getLogLevel } from '../utils/fieldMapping';

const BUCKETS = 90;
const BAR_PX = 28;

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

function fmtTime(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(11, 19); // HH:MM:SS (UTC)
}

interface Bucket {
  n: number;
  e: number;
  w: number;
}

export default function Histogram({ logs }: { logs: LogEntry[] }) {
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

    const span = max - min;
    const buckets: Bucket[] = Array.from({ length: BUCKETS }, () => ({ n: 0, e: 0, w: 0 }));
    for (const { t, lvl } of times) {
      const idx = Math.min(BUCKETS - 1, Math.floor(((t - min) / span) * BUCKETS));
      const b = buckets[idx];
      b.n++;
      if (lvl === 'error' || lvl === 'fatal') b.e++;
      else if (lvl === 'warn') b.w++;
    }
    const mx = Math.max(1, ...buckets.map((b) => b.n));
    return { buckets, mx, min, mid: min + span / 2, max };
  }, [logs]);

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
        borderBottom: '1px solid var(--vscode-panel-border, #2b2b2b)',
        backgroundColor: 'var(--vscode-sideBar-background, #121a24)',
      }}
    >
      {/* Bars sit on a baseline so the strip reads as a chart */}
      <div
        style={{
          height: BAR_PX,
          display: 'flex',
          alignItems: 'flex-end',
          gap: '1px',
          borderBottom: '1px solid var(--vscode-panel-border, #3a4a5a)',
        }}
      >
        {data.buckets.map((b, i) => {
          const total = b.n ? Math.max(2, h(b.n)) : 0;
          const errH = b.e ? Math.max(1, h(b.e)) : 0;
          const warnH = b.w ? Math.max(1, h(b.w)) : 0;
          const restH = Math.max(0, total - errH - warnH);
          const label = `${b.n} log${b.n === 1 ? '' : 's'}${b.e ? ` · ${b.e} error` : ''}${b.w ? ` · ${b.w} warn` : ''}`;
          return (
            <div
              key={i}
              title={label}
              style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', height: BAR_PX, minWidth: 0 }}
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
        <span>{fmtTime(data.min)}</span>
        <span>{fmtTime(data.mid)}</span>
        <span>{fmtTime(data.max)}</span>
      </div>
    </div>
  );
}
