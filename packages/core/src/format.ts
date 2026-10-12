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
  if (ext === '.log' || ext === '.ndjson') {
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

/** Parse file content into log entries according to the detected format. */
export function parseContent(content: string, format: LogFormat): ParseResult {
  if (format === 'CSV') {
    const result = parseCsvContent(content);
    return { logs: result.logs, errors: result.errors, format };
  }
  if (format === 'NDJSON') {
    return parseNdjson(content);
  }
  // JSON: an array (the common case) or a single object; fall back to NDJSON
  // when a `.json` file turns out to be line-delimited.
  try {
    const parsed = JSON.parse(content.trim());
    if (Array.isArray(parsed)) {
      return { logs: parsed, errors: [], format };
    }
    return { logs: [parsed], errors: [], format };
  } catch {
    return parseNdjson(content);
  }
}
