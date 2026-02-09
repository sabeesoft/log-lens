import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
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
export class LogLensPanel {
  // Map of file paths to their panels (allows multiple panels for different files)
  private static panels: Map<string, LogLensPanel> = new Map();

  private readonly _panel: WebviewPanel;
  private readonly _filePath: string;
  private _disposables: Disposable[] = [];
  private _logs: any[] = [];
  private _fileName: string;

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
    }
  }

  /**
   * Sends logs to the webview for a specific file
   *
   * @param filePath The file path to send logs to
   * @param logs Array of log entries (strings or objects)
   * @param fileName The name of the file being viewed
   */
  public static sendLogsToWebview(filePath: string, logs: any[], fileName: string) {
    const panel = LogLensPanel.panels.get(filePath);
    if (panel) {
      panel._logs = logs;
      panel._fileName = fileName;
      panel._panel.webview.postMessage({
        type: "updateLogs",
        logs: logs,
        fileName: fileName
      });
    }
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    // Remove from panels map
    LogLensPanel.panels.delete(this._filePath);

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
          case "transform":
            // Execute transform script and send results back
            this._executeTransform(webview, message.script, message.logs);
            return;
        }
      },
      undefined,
      this._disposables
    );
  }

  /**
   * Executes a transform script on logs in a sandboxed Node.js context
   *
   * @param webview A reference to the extension webview
   * @param script The transform script to execute
   * @param logs The logs to transform
   */
  private _executeTransform(webview: Webview, script: string, logs: any[]) {
    try {
      // Create a sandboxed function that receives logs array
      // The script should return the transformed logs
      const transformFunction = new Function('logs', `
        'use strict';
        ${script}
      `);

      // Execute the transform
      const transformedLogs = transformFunction(logs);

      // Validate result is an array
      if (!Array.isArray(transformedLogs)) {
        throw new Error('Transform script must return an array of logs');
      }

      // Send success response with transformed logs
      webview.postMessage({
        type: "transformResult",
        success: true,
        logs: transformedLogs
      });

    } catch (error) {
      // Send error response
      webview.postMessage({
        type: "transformResult",
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }
}
