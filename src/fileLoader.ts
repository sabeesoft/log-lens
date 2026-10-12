import { ExtensionContext, Uri, window, workspace } from "vscode";
import * as path from "path";
import { detectFormat, parseContent } from "@sabeesoft/loglens-core";
import type { LogFormat, ParseResult } from "@sabeesoft/loglens-core";
import { LogLensPanel } from "./panels/LogLensPanel";
import { addRecentFile } from "./views/recentFiles";

// Format detection and parsing live in the framework-agnostic core so the web
// app and PWA share the exact same implementation. Re-exported here so the rest
// of the extension keeps importing them from a single module.
export { detectFormat, parseContent };
export type { LogFormat, ParseResult };

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
