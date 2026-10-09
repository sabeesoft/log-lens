import { commands, ExtensionContext, Uri, window } from "vscode";
import { LogLensPanel } from "./panels/LogLensPanel";
import { logLensStatusBar } from "./panels/LogLensStatusBar";
import { displayResult, openLogByPath, parseContent, LogFormat } from "./fileLoader";
import {
  clearRecentFiles,
  RecentFilesProvider,
  registerRecentFilesProvider,
} from "./views/recentFiles";

/**
 * Load the active editor's document into Log Lens using the given format.
 * Shared by the three editor-based commands.
 */
function loadActiveEditor(context: ExtensionContext, format: LogFormat, requireExt?: string) {
  const editor = window.activeTextEditor;
  if (!editor) {
    window.showWarningMessage("No active editor found. Please open a file first.");
    return;
  }

  const document = editor.document;
  const filePath = document.fileName;

  if (format === "JSON" && document.languageId !== "json" && !filePath.endsWith(".json")) {
    window.showWarningMessage("Please open a JSON file containing log data.");
    return;
  }
  if (requireExt && !filePath.endsWith(requireExt)) {
    window.showWarningMessage(`Please open a ${requireExt} file.`);
    return;
  }

  try {
    const result = parseContent(document.getText(), format);
    displayResult(context, filePath, result);
  } catch (error) {
    window.showErrorMessage(
      `Failed to parse file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export function activate(context: ExtensionContext) {
  // --- Activity Bar: Recent files view ---
  const recentProvider = new RecentFilesProvider(context);
  registerRecentFilesProvider(recentProvider);
  context.subscriptions.push(
    window.registerTreeDataProvider("logLens.recent", recentProvider)
  );

  // --- Status bar ---
  context.subscriptions.push(logLensStatusBar.init());

  // --- Editor-based commands (load the file in the active editor) ---
  context.subscriptions.push(
    commands.registerCommand("log-lens.loadCurrentFile", () =>
      loadActiveEditor(context, "JSON")
    ),
    commands.registerCommand("log-lens.loadLogFile", () =>
      loadActiveEditor(context, "NDJSON")
    ),
    commands.registerCommand("log-lens.loadCsvFile", () =>
      loadActiveEditor(context, "CSV", ".csv")
    )
  );

  // --- Open Log File… (file picker, no active editor needed) ---
  context.subscriptions.push(
    commands.registerCommand("log-lens.openLogFile", async () => {
      const picked = await window.showOpenDialog({
        canSelectMany: false,
        openLabel: "Open with Log Lens",
        filters: {
          "Log files": ["json", "log", "ndjson", "csv"],
          "All files": ["*"],
        },
      });
      if (picked && picked[0]) {
        await openLogByPath(context, picked[0]);
      }
    })
  );

  // --- Explorer context menu: Open with Log Lens ---
  context.subscriptions.push(
    commands.registerCommand("log-lens.openFromExplorer", async (uri: Uri) => {
      if (uri) {
        await openLogByPath(context, uri);
      }
    })
  );

  // --- Recent list: reopen / clear ---
  context.subscriptions.push(
    commands.registerCommand("log-lens.openRecent", async (filePath: string) => {
      if (filePath) {
        await openLogByPath(context, Uri.file(filePath));
      }
    }),
    commands.registerCommand("log-lens.clearRecent", () => clearRecentFiles(context))
  );

  // --- Status bar click: show parse errors ---
  context.subscriptions.push(
    commands.registerCommand("log-lens.showErrors", () => LogLensPanel.showActiveErrors())
  );
}
