import { parseCsvContent } from './csv';
import type { LogEntry, LogFormat, ParseResult } from './types';

/** Lower-cased file extension including the leading dot, or '' when none. */
function extname(fileName: string): string {
  const match = /\.[^./\\]+$/.exec(fileName);
  return match ? match[0].toLowerCase() : '';
}

/** Pick a format from the file name / path extension. */
export function detectFormat(fileName: string): LogFormat {
  const ext = extname(fileName);
  if (ext === '.csv') {
    return 'CSV';
  }
  if (ext === '.log' || ext === '.ndjson' || ext === '.jsonl') {
    return 'NDJSON';
  }
  return 'JSON';
}

/** Parse NDJSON, collecting per-line errors instead of failing the whole file. */
function parseNdjson(content: string): ParseResult {
  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  const logs: LogEntry[] = [];
  const errors: string[] = [];
  lines.forEach((line, index) => {
    try {
      logs.push(JSON.parse(line));
    } catch (error) {
      errors.push(`Line ${index + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
    }
  });
  return { logs, errors, format: 'NDJSON' };
}

/** Strip UTF-8 BOM if present. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

/** Try to extract a log array from a wrapper object (e.g. { "logs": [...] }). */
function unwrapObject(obj: Record<string, unknown>): LogEntry[] | null {
  const values = Object.values(obj);
  for (const v of values) {
    if (Array.isArray(v) && v.length > 0) {
      return v as LogEntry[];
    }
  }
  return null;
}

/** Remove trailing commas before `]` or `}` — a common hand-edit artifact. */
function stripTrailingCommas(text: string): string {
  return text.replace(/,\s*([\]}])/g, '$1');
}

/** Parse file content into log entries according to the detected format. */
export function parseContent(content: string, format: LogFormat): ParseResult {
  const cleaned = stripBom(content);

  if (format === 'CSV') {
    const result = parseCsvContent(cleaned);
    return { logs: result.logs, errors: result.errors, format };
  }
  if (format === 'NDJSON') {
    return parseNdjson(cleaned);
  }

  // JSON: an array (the common case) or a single object; fall back to NDJSON
  // when a `.json` file turns out to be line-delimited.
  const tryParse = (text: string): ParseResult | null => {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return { logs: parsed, errors: [], format };
      }
      if (parsed && typeof parsed === 'object') {
        const unwrapped = unwrapObject(parsed as Record<string, unknown>);
        if (unwrapped) {
          return { logs: unwrapped, errors: [], format };
        }
      }
      return { logs: [parsed], errors: [], format };
    } catch {
      return null;
    }
  };

  const trimmed = cleaned.trim();
  const result = tryParse(trimmed) ?? tryParse(stripTrailingCommas(trimmed));
  if (result) {
    return result;
  }

  return parseNdjson(cleaned);
}
