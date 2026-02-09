const TIMESTAMP_COLUMN_NAMES = [
  "timestamp",
  "time",
  "date",
  "@timestamp",
  "datetime",
  "created_at",
  "createdat",
  "updated_at",
  "updatedat",
];

export function isTimestampColumn(columnName: string): boolean {
  return TIMESTAMP_COLUMN_NAMES.includes(columnName.toLowerCase());
}

/**
 * Converts unix epoch timestamps (seconds or milliseconds) to ISO 8601 strings.
 * Returns the original value unchanged if it doesn't look like an epoch.
 */
export function normalizeTimestamp(value: string): string {
  // Already ISO 8601
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return value;
  }

  // 10-digit: epoch seconds (approx 2001–2286)
  if (num >= 1e9 && num < 1e10) {
    return new Date(num * 1000).toISOString();
  }

  // 13-digit: epoch milliseconds (approx 2001–2286)
  if (num >= 1e12 && num < 1e14) {
    return new Date(num).toISOString();
  }

  return value;
}
