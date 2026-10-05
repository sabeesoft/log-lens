import { parse } from "csv-parse/sync";
import { parseJavaNotation } from "./javaNotationParser";
import { isTimestampColumn, normalizeTimestamp } from "./timestampUtils";

export interface CsvParseResult {
  logs: Record<string, any>[];
  errors: string[];
  rowCount: number;
}

export function parseCsvContent(content: string): CsvParseResult {
  const records: Record<string, string>[] = parse(content, {
    columns: true,
    // eslint-disable-next-line @typescript-eslint/naming-convention -- csv-parse option names are snake_case
    skip_empty_lines: true,
    trim: true,
    // eslint-disable-next-line @typescript-eslint/naming-convention -- csv-parse option names are snake_case
    relax_column_count: true,
    cast: false,
  });

  const logs: Record<string, any>[] = [];
  const errors: string[] = [];

  records.forEach((row, index) => {
    try {
      const entry = transformRow(row);
      logs.push(entry);
    } catch (error) {
      errors.push(
        `Row ${index + 1}: ${error instanceof Error ? error.message : "Transform error"}`
      );
      // Include the raw row as fallback
      logs.push(row);
    }
  });

  return { logs, errors, rowCount: records.length };
}

function transformRow(row: Record<string, string>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [column, rawValue] of Object.entries(row)) {
    result[column] = transformValue(column, rawValue);
  }

  return result;
}

function transformValue(column: string, value: string): any {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  // Timestamp columns get special treatment
  if (isTimestampColumn(column)) {
    return normalizeTimestamp(value);
  }

  const trimmed = value.trim();

  // Java-style notation: {key=value, ...} or [value, ...]
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    const parsed = parseJavaNotation(trimmed);
    // If parseJavaNotation returned something other than the raw string, it succeeded
    if (parsed !== trimmed) {
      return parsed;
    }
    // Fallback: try JSON.parse in case it's actual JSON
    try {
      return JSON.parse(trimmed);
    } catch {
      // Keep as raw string
      return value;
    }
  }

  // Boolean
  if (trimmed.toLowerCase() === "true") {
    return true;
  }
  if (trimmed.toLowerCase() === "false") {
    return false;
  }

  // Null literal
  if (trimmed.toLowerCase() === "null") {
    return null;
  }

  // Numeric (up to 15 digits to stay within Number.MAX_SAFE_INTEGER and
  // avoid silently corrupting long IDs)
  if (/^-?\d+(\.\d+)?$/.test(trimmed) && trimmed.length <= 15) {
    return Number(trimmed);
  }

  return value;
}
