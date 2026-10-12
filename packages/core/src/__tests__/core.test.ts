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
