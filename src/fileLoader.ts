import { ExtensionContext, Uri, window, workspace } from "vscode";
import * as path from "path";
import { parseCsvContent } from "./parsers/csvParser";
import { LogLensPanel } from "./panels/LogLensPanel";
import { addRecentFile } from "./views/recentFiles";

export type LogFormat = "JSON" | "NDJSON" | "CSV";

export interface ParseResult {
  logs: any[];
  errors: string[];
  format: LogFormat;
}

/** Pick a format from the file extension. */
export function detectFormat(filePath: string): LogFormat {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv") {
    return "CSV";
  }
  if (ext === ".log" || ext === ".ndjson") {
    return "NDJSON";
  }
  return "JSON";
}

/** Parse NDJSON, collecting per-line errors instead of failing the whole file. */
function parseNdjson(content: string): ParseResult {
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  const logs: any[] = [];
  const errors: string[] = [];
  lines.forEach((line, index) => {
    try {
      logs.push(JSON.parse(line));
    } catch (error) {
      errors.push(`Line ${index + 1}: ${error instanceof Error ? error.message : "Parse error"}`);
    }
  });
  return { logs, errors, format: "NDJSON" };
}

/** Parse file content into log entries according to the detected format. */
export function parseContent(content: string, format: LogFormat): ParseResult {
  if (format === "CSV") {
    const result = parseCsvContent(content);
    return { logs: result.logs, errors: result.errors, format };
  }
  if (format === "NDJSON") {
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

/**
 * Open a Log Lens panel for an already-parsed result and record it in Recent.
 * Returns false (with a message shown) when there is nothing to display.
 */
export function displayResult(
  context: ExtensionContext,
  filePath: string,
  result: ParseResult
): boolean {
  const fileName = path.basename(filePath);

  if (result.logs.length === 0) {
    window.showErrorMessage(`No valid log entries found in ${fileName}.`);
    return false;
  }

  if (result.errors.length > 0) {
    window.showWarningMessage(
      `Loaded ${result.logs.length} entries from ${fileName}, but ${result.errors.length} line(s) had parse errors.`
    );
    console.warn("Log Lens parse errors:", result.errors);
  }

  LogLensPanel.render(context.extensionUri, filePath);
  LogLensPanel.sendLogsToWebview(filePath, result.logs, fileName, {
    format: result.format,
    errors: result.errors,
  });

  addRecentFile(context, { path: filePath, name: fileName, format: result.format });
  return true;
}

/**
 * Read, parse and display a log file in a Log Lens panel. Works without an
 * active editor — the single entry point behind the Open dialog, the Explorer
 * context menu and the Recent list.
 */
export async function openLogByPath(context: ExtensionContext, uri: Uri): Promise<void> {
  const filePath = uri.fsPath;
  const fileName = path.basename(filePath);
  const format = detectFormat(filePath);

  let content: string;
  try {
    const bytes = await workspace.fs.readFile(uri);
    content = Buffer.from(bytes).toString("utf8");
  } catch (error) {
    window.showErrorMessage(
      `Failed to read ${fileName}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return;
  }

  let result: ParseResult;
  try {
    result = parseContent(content, format);
  } catch (error) {
    window.showErrorMessage(
      `Failed to parse ${fileName}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return;
  }

  displayResult(context, filePath, result);
}
