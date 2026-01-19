import { LogEntry } from '../types';

const LEVEL_FIELD_CANDIDATES = ['level', 'severity', 'priority', 'logLevel', 'log_level'];
const TIMESTAMP_FIELD_CANDIDATES = ['timestamp', 'time', 'date', '@timestamp', 'datetime', 'created_at', 'createdAt'];

/**
 * Auto-detects the level field from a log entry
 */
export function autoDetectLevelField(log: LogEntry): string | null {
  if (typeof log === 'string') return null;

  for (const candidate of LEVEL_FIELD_CANDIDATES) {
    if (candidate in log) return candidate;
  }

  return null;
}

/**
 * Auto-detects the timestamp field from a log entry
 */
export function autoDetectTimestampField(log: LogEntry): string | null {
  if (typeof log === 'string') return null;

  for (const candidate of TIMESTAMP_FIELD_CANDIDATES) {
    if (candidate in log) return candidate;
  }

  return null;
}

/**
 * Gets the level value from a log entry using configured or auto-detected field
 */
export function getLogLevel(log: LogEntry, configuredField: string): string {
  if (typeof log === 'string') return 'info';

  // Use configured field if provided
  if (configuredField && configuredField in log) {
    return String(log[configuredField]).toLowerCase();
  }

  // Auto-detect
  const autoField = autoDetectLevelField(log);
  if (autoField) {
    return String(log[autoField]).toLowerCase();
  }

  // Default to 'info' if not found
  return 'info';
}

/**
 * Gets the timestamp value from a log entry using configured or auto-detected field
 */
export function getLogTimestamp(log: LogEntry, configuredField: string): string | null {
  if (typeof log === 'string') return null;

  // Use configured field if provided
  if (configuredField && configuredField in log) {
    return String(log[configuredField]);
  }

  // Auto-detect
  const autoField = autoDetectTimestampField(log);
  if (autoField) {
    return String(log[autoField]);
  }

  return null;
}
