/**
 * A single log entry. Either a plain string (simple text logs) or an object
 * with arbitrary, possibly nested fields. The common fields are optional hints
 * — nothing is required.
 */
export type LogEntry =
  | string
  | {
      timestamp?: string;
      level?: string;
      message?: string;
      [key: string]: any;
    };

/** Supported input formats. */
export type LogFormat = 'JSON' | 'NDJSON' | 'CSV';

/** Result of parsing a whole file's content. */
export interface ParseResult {
  logs: LogEntry[];
  errors: string[];
  format: LogFormat;
}

/** Result of parsing CSV content specifically. */
export interface CsvParseResult {
  logs: Record<string, any>[];
  errors: string[];
  rowCount: number;
}

/** A single filter clause used by the viewer UI. */
export interface Filter {
  id: number;
  field: string;
  operator: 'contains' | 'not_contains' | 'equals';
  value: string;
  relation: 'AND' | 'OR';
}
