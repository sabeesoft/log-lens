/**
 * @sabeesoft/loglens-core — framework-agnostic log parsing for Log Lens.
 *
 * Takes file *content* (a string) and produces plain `LogEntry[]` records.
 * Byte→string decoding and all host/IO concerns stay in the shell (VS Code
 * extension, web app, …). No DOM, no Node built-ins, no host-app imports —
 * runs identically in the browser and in Node.
 */
export { detectFormat, parseContent } from './format';
export { parseCsvContent } from './csv';
export { parseJavaNotation } from './javaNotation';
export { isTimestampColumn, normalizeTimestamp } from './timestamp';

export type { LogEntry, LogFormat, ParseResult, CsvParseResult, Filter } from './types';
