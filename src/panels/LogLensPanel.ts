import { Disposable, Webview, WebviewPanel, window, workspace, Uri, ViewColumn } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import { logLensStatusBar } from "./LogLensStatusBar";
import * as path from "path";

/**
 * This class manages the state and behavior of LogLens webview panels.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering LogLens webview panels
 * - Properly cleaning up and disposing of webview resources when the panel is closed
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 * - Setting message listeners so data can be passed between the webview and extension
 */
export interface LogMeta {
  format: string;
  errors: string[];
}

export class LogLensPanel {
  // Map of file paths to their panels (allows multiple panels for different files)
  private static panels: Map<string, LogLensPanel> = new Map();
  // The panel whose tab is currently focused, if any.
  private static activePanel: LogLensPanel | undefined;

  private readonly _panel: WebviewPanel;
  private readonly _filePath: string;
  private _disposables: Disposable[] = [];
  private _logs: any[] = [];
  private _fileName: string;
  private _format = "JSON";
  private _errors: string[] = [];
  private _matched = 0;

  /**
   * The LogLensPanel class private constructor (called only from the render method).
   *
   * @param panel A reference to the webview panel
   * @param extensionUri The URI of the directory containing the extension
   * @param filePath The path of the file being viewed
   */
  private constructor(panel: WebviewPanel, extensionUri: Uri, filePath: string) {
    this._panel = panel;
    this._filePath = filePath;
    this._fileName = path.basename(filePath);

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Track focus so the status bar item shows only for the active Log Lens tab.
    this._panel.onDidChangeViewState(
      () => {
        if (this._panel.active) {
          LogLensPanel.activePanel = this;
          this._updateStatusBar();
        } else if (LogLensPanel.activePanel === this) {
          LogLensPanel.activePanel = undefined;
          logLensStatusBar.update(null);
        }
      },
      null,
      this._disposables
    );

    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel.webview);
  }

  /**
   * Renders a webview panel for a specific file. If a panel for that file exists,
   * it will be revealed. Otherwise, a new panel will be created.
   *
   * @param extensionUri The URI of the directory containing the extension.
   * @param filePath The path of the file being viewed.
   */
  public static render(extensionUri: Uri, filePath: string = "untitled") {
    const existingPanel = LogLensPanel.panels.get(filePath);

    if (existingPanel) {
      // If panel for this file exists, reveal it
      existingPanel._panel.reveal(ViewColumn.One);
      LogLensPanel.activePanel = existingPanel;
      existingPanel._updateStatusBar();
    } else {
      // Create a new panel for this file
      const fileName = path.basename(filePath);
      const panel = window.createWebviewPanel(
        // Panel view type
        "logLens",
        // Panel title - include filename
        `Log Lens: ${fileName}`,
        // The editor column the panel should be displayed in
        ViewColumn.One,
        // Extra panel configurations
        {
          // Enable JavaScript in the webview
          enableScripts: true,
          // Retain content when hidden (preserves filters and state)
          retainContextWhenHidden: true,
          // Restrict the webview to only load resources from the `out` and `webview-ui/build` directories
          localResourceRoots: [Uri.joinPath(extensionUri, "out"), Uri.joinPath(extensionUri, "webview-ui/build")],
        }
      );

      const newPanel = new LogLensPanel(panel, extensionUri, filePath);
      LogLensPanel.panels.set(filePath, newPanel);
      LogLensPanel.activePanel = newPanel;
    }
  }

  /**
   * Sends logs to the webview for a specific file
   *
   * @param filePath The file path to send logs to
   * @param logs Array of log entries (strings or objects)
   * @param fileName The name of the file being viewed
   */
  public static sendLogsToWebview(filePath: string, logs: any[], fileName: string, meta?: LogMeta) {
    const panel = LogLensPanel.panels.get(filePath);
    if (panel) {
      panel._logs = logs;
      panel._fileName = fileName;
      if (meta) {
        panel._format = meta.format;
        panel._errors = meta.errors;
      }
      // Until the webview reports a filtered count, everything matches.
      panel._matched = logs.length;
      panel._panel.webview.postMessage({
        type: "updateLogs",
        logs: logs,
        fileName: fileName
      });
      if (LogLensPanel.activePanel === panel) {
        panel._updateStatusBar();
      }
    }
  }

  /** Reveal the parse errors (if any) for the active panel. */
  public static showActiveErrors() {
    const panel = LogLensPanel.activePanel;
    if (!panel || panel._errors.length === 0) {
      window.showInformationMessage("Log Lens: no parse errors in the current file.");
      return;
    }
    const channel = window.createOutputChannel("Log Lens");
    channel.clear();
    channel.appendLine(`${panel._errors.length} parse error(s) in ${panel._fileName}:`);
    channel.appendLine("");
    panel._errors.forEach((e) => channel.appendLine(e));
    channel.show(true);
  }

  private _updateStatusBar() {
    logLensStatusBar.update({
      matched: this._matched,
      total: this._logs.length,
      errorCount: this._errors.length,
      format: this._format,
    });
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    // Remove from panels map
    LogLensPanel.panels.delete(this._filePath);

    // Hide the status bar if this was the focused panel
    if (LogLensPanel.activePanel === this) {
      LogLensPanel.activePanel = undefined;
      logLensStatusBar.update(null);
    }

    // Dispose of the current webview panel
    this._panel.dispose();

    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Defines and returns the HTML that should be rendered within the webview panel.
   *
   * @remarks This is also the place where references to the React webview build files
   * are created and inserted into the webview HTML.
   *
   * @param webview A reference to the extension webview
   * @param extensionUri The URI of the directory containing the extension
   * @returns A template string literal containing the HTML that should be
   * rendered within the webview panel
   */
  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    // The CSS file from the React build output
    const stylesUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.css"]);
    // The JS file from the React build output
    const scriptUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.js"]);

    const nonce = getNonce();

    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Log Lens</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is recieved.
   *
   * @param webview A reference to the extension webview
   * @param context A reference to the extension context
   */
  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.type || message.command;

        switch (command) {
          case "requestLogs":
            // Send the logs to the webview when requested
            if (this._logs.length > 0) {
              webview.postMessage({
                type: "updateLogs",
                logs: this._logs,
                fileName: this._fileName
              });
            }
            return;
          case "stats":
            // The webview reports how many entries match the current query.
            if (typeof message.matched === "number") {
              this._matched = message.matched;
              if (LogLensPanel.activePanel === this) {
                this._updateStatusBar();
              }
            }
            return;
          case "openAsJson":
            // Open the full record in a normal JSON editor for folding & search.
            if (typeof message.content === "string") {
              workspace
                .openTextDocument({ content: message.content, language: "json" })
                .then((doc) => window.showTextDocument(doc, ViewColumn.Beside));
            }
            return;
        }
      },
      undefined,
      this._disposables
    );
  }
}
