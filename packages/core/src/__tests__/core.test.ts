import { describe, expect, it } from '@jest/globals';
import {
  detectFormat,
  parseContent,
  parseCsvContent,
  parseJavaNotation,
  normalizeTimestamp,
  isTimestampColumn,
} from '../index';

describe('detectFormat', () => {
  it('picks CSV / NDJSON / JSON from the extension', () => {
    expect(detectFormat('export.csv')).toBe('CSV');
    expect(detectFormat('app.log')).toBe('NDJSON');
    expect(detectFormat('stream.ndjson')).toBe('NDJSON');
    expect(detectFormat('data.json')).toBe('JSON');
    expect(detectFormat('/some/path/to/App.LOG')).toBe('NDJSON');
    expect(detectFormat('noextension')).toBe('JSON');
  });
});

describe('parseContent', () => {
  it('parses a JSON array', () => {
    const r = parseContent('[{"a":1},{"a":2}]', 'JSON');
    expect(r.logs).toHaveLength(2);
    expect(r.errors).toHaveLength(0);
  });

  it('wraps a single JSON object in an array', () => {
    const r = parseContent('{"a":1}', 'JSON');
    expect(r.logs).toEqual([{ a: 1 }]);
  });

  it('parses NDJSON and collects per-line errors', () => {
    const r = parseContent('{"a":1}\nnot json\n{"a":2}', 'NDJSON');
    expect(r.logs).toHaveLength(2);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/Line 2/);
  });

  it('falls back to NDJSON when a .json file is line-delimited', () => {
    const r = parseContent('{"a":1}\n{"a":2}', 'JSON');
    expect(r.logs).toHaveLength(2);
  });

  it('detects .jsonl as NDJSON', () => {
    expect(detectFormat('events.jsonl')).toBe('NDJSON');
  });

  it('strips UTF-8 BOM before parsing', () => {
    const r = parseContent('﻿[{"a":1}]', 'JSON');
    expect(r.logs).toHaveLength(1);
    expect(r.errors).toHaveLength(0);
  });

  it('tolerates trailing commas in JSON arrays', () => {
    const r = parseContent('[{"a":1},{"a":2},]', 'JSON');
    expect(r.logs).toHaveLength(2);
    expect(r.errors).toHaveLength(0);
  });

  it('unwraps a wrapper object with a single array field', () => {
    const input = JSON.stringify({
      data: [
        { level: 'info', message: 'boot' },
        { level: 'error', message: 'crash' },
      ],
    });
    const r = parseContent(input, 'JSON');
    expect(r.logs).toHaveLength(2);
    expect(r.logs[0]).toEqual({ level: 'info', message: 'boot' });
  });

  it('unwraps when the array sits among scalar siblings', () => {
    const input = JSON.stringify({
      meta: { exported: '2026-11-26' },
      count: 3,
      logs: [
        { ts: '2026-01-01', level: 'info', msg: 'a' },
        { ts: '2026-01-02', level: 'warn', msg: 'b' },
        { ts: '2026-01-03', level: 'error', msg: 'c' },
      ],
    });
    const r = parseContent(input, 'JSON');
    expect(r.logs).toHaveLength(3);
  });

  it('keeps a single flat object as one log entry (no unwrap)', () => {
    const r = parseContent('{"level":"info","message":"hello"}', 'JSON');
    expect(r.logs).toEqual([{ level: 'info', message: 'hello' }]);
  });

  it('handles logs with deeply nested objects in fields', () => {
    const input = JSON.stringify([
      {
        timestamp: '2026-01-01T00:00:00Z',
        level: 'info',
        message: { text: 'request received', details: { path: '/api/users', method: 'GET' } },
        context: {
          user: { id: 42, roles: ['admin', 'editor'] },
          request: {
            headers: { 'content-type': 'application/json', authorization: 'Bearer ***' },
            query: { page: 1, limit: 50 },
          },
        },
        metadata: {
          traceId: 'abc-123',
          spans: [
            { name: 'db.query', duration: 12 },
            { name: 'cache.get', duration: 2 },
          ],
        },
      },
      {
        timestamp: '2026-01-01T00:00:01Z',
        level: 'error',
        message: 'unhandled exception',
        error: {
          name: 'TypeError',
          message: 'Cannot read properties of undefined',
          stack: 'TypeError: Cannot read properties of undefined\n    at handler (/app/src/handler.ts:42:10)',
        },
        context: { user: null, request: { headers: {}, query: {} } },
      },
    ]);
    const r = parseContent(input, 'JSON');
    expect(r.logs).toHaveLength(2);
    expect(r.errors).toHaveLength(0);
    expect((r.logs[0] as Record<string, any>).context.user.roles).toEqual(['admin', 'editor']);
    expect((r.logs[1] as Record<string, any>).error.name).toBe('TypeError');
  });

  it('handles logs where message field is an object, not a string', () => {
    const input = JSON.stringify([
      { level: 'info', message: { action: 'login', userId: 7 } },
      { level: 'warn', message: { action: 'rate_limit', ip: '10.0.0.1', count: 150 } },
    ]);
    const r = parseContent(input, 'JSON');
    expect(r.logs).toHaveLength(2);
    expect((r.logs[0] as Record<string, any>).message).toEqual({ action: 'login', userId: 7 });
  });

  it('handles mixed-depth NDJSON with large nested payloads', () => {
    const lines = [
      JSON.stringify({ level: 'info', msg: 'simple' }),
      JSON.stringify({
        level: 'debug',
        msg: 'complex',
        payload: {
          items: Array.from({ length: 50 }, (_, i) => ({
            id: i,
            name: `item-${i}`,
            tags: ['a', 'b', 'c'],
            meta: { created: '2026-01-01', nested: { deep: true } },
          })),
        },
      }),
      'not valid json at all',
      JSON.stringify({ level: 'error', msg: 'done', stats: { total: 100, failed: 1, timings: [12, 34, 56] } }),
    ];
    const r = parseContent(lines.join('\n'), 'NDJSON');
    expect(r.logs).toHaveLength(3);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/Line 3/);
    const payload = (r.logs[1] as Record<string, any>).payload;
    expect(payload.items).toHaveLength(50);
    expect(payload.items[49].meta.nested.deep).toBe(true);
  });
});

describe('parseCsvContent', () => {
  it('parses headers and applies smart type detection', () => {
    const csv = 'timestamp,level,count,ok\n1700000000,INFO,42,true';
    const { logs, errors } = parseCsvContent(csv);
    expect(errors).toHaveLength(0);
    expect(logs[0].level).toBe('INFO');
    expect(logs[0].count).toBe(42);
    expect(logs[0].ok).toBe(true);
    // epoch seconds → ISO 8601
    expect(String(logs[0].timestamp)).toMatch(/^20\d\d-\d\d-\d\dT/);
  });
});

describe('parseJavaNotation', () => {
  it('parses nested objects and arrays', () => {
    const out = parseJavaNotation('{id=uuid, flags={isdebtor=true}, history=[{cid=125464}]}');
    expect(out).toEqual({ id: 'uuid', flags: { isdebtor: true }, history: [{ cid: 125464 }] });
  });

  it('returns the raw string on invalid input', () => {
    expect(parseJavaNotation('just text')).toBe('just text');
  });
});

describe('timestamp helpers', () => {
  it('detects timestamp columns case-insensitively', () => {
    expect(isTimestampColumn('Timestamp')).toBe(true);
    expect(isTimestampColumn('created_at')).toBe(true);
    expect(isTimestampColumn('user')).toBe(false);
  });

  it('normalizes epoch seconds and milliseconds, leaves ISO alone', () => {
    expect(normalizeTimestamp('1700000000')).toMatch(/^20\d\d-/);
    expect(normalizeTimestamp('1700000000000')).toMatch(/^20\d\d-/);
    expect(normalizeTimestamp('2024-01-01T00:00:00Z')).toBe('2024-01-01T00:00:00Z');
    expect(normalizeTimestamp('not-a-date')).toBe('not-a-date');
  });
});
