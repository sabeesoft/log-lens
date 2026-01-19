import { commands, ExtensionContext, window } from "vscode";
import { LogLensPanel } from "./panels/LogLensPanel";

export function activate(context: ExtensionContext) {
  // Create the show log lens command
  const showLogLensCommand = commands.registerCommand("log-lens.show", () => {
    LogLensPanel.render(context.extensionUri);
  });

  // Create the load current file command
  const loadCurrentFileCommand = commands.registerCommand("log-lens.loadCurrentFile", () => {
    const editor = window.activeTextEditor;
    if (!editor) {
      window.showWarningMessage("No active editor found. Please open a JSON file.");
      return;
    }

    const document = editor.document;

    // Check if file is JSON
    if (document.languageId !== "json" && !document.fileName.endsWith('.json')) {
      window.showWarningMessage("Please open a JSON file containing log data.");
      return;
    }

    try {
      const content = document.getText();
      const logs = JSON.parse(content);

      // Validate it's an array
      if (!Array.isArray(logs)) {
        window.showErrorMessage("JSON file must contain an array of log entries.");
        return;
      }

      // Open the panel and send logs
      LogLensPanel.render(context.extensionUri);
      LogLensPanel.sendLogsToWebview(logs);

    } catch (error) {
      window.showErrorMessage(`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Create the load log file command (for newline-delimited JSON)
  const loadLogFileCommand = commands.registerCommand("log-lens.loadLogFile", () => {
    const editor = window.activeTextEditor;
    if (!editor) {
      window.showWarningMessage("No active editor found. Please open a .log file.");
      return;
    }

    const document = editor.document;

    try {
      const content = document.getText();
      const lines = content.split('\n').filter(line => line.trim().length > 0);

      const logs: any[] = [];
      const errors: string[] = [];

      lines.forEach((line, index) => {
        try {
          const log = JSON.parse(line);
          logs.push(log);
        } catch (error) {
          errors.push(`Line ${index + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
        }
      });

      if (logs.length === 0) {
        window.showErrorMessage("No valid JSON log entries found in the file.");
        return;
      }

      // Show warning if there were parsing errors
      if (errors.length > 0) {
        window.showWarningMessage(
          `Loaded ${logs.length} logs, but ${errors.length} line(s) had parsing errors. Check the console for details.`
        );
        console.warn("Log parsing errors:", errors);
      }

      // Open the panel and send logs
      LogLensPanel.render(context.extensionUri);
      LogLensPanel.sendLogsToWebview(logs);

    } catch (error) {
      window.showErrorMessage(`Failed to load log file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Add commands to the extension context
  context.subscriptions.push(showLogLensCommand, loadCurrentFileCommand, loadLogFileCommand);
}
