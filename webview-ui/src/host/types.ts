import type { LogEntry } from '../types';

/** A batch of logs handed to the app, with an optional source file name. */
export interface LogsPayload {
  logs: LogEntry[];
  fileName?: string;
}

/**
 * The seam between the shared UI and whatever is hosting it. The VS Code
 * webview, the browser web app and (later) a native desktop shell each provide
 * their own implementation; the UI only ever talks to this interface.
 */
export interface HostAdapter {
  /** Which host this is — handy for small UI affordances (e.g. web-only buttons). */
  readonly kind: 'vscode' | 'web';

  /** Called once on startup. The host may deliver logs now or later via `onLogs`. */
  requestInitialLogs(): void;

  /** Subscribe to logs pushed by the host. Returns an unsubscribe function. */
  onLogs(handler: (payload: LogsPayload) => void): () => void;

  /** Report current match / total counts (VS Code shows these in the status bar). */
  reportStats(matched: number, total: number): void;

  /** Open a single entry's JSON — a new editor tab in VS Code, a new tab in the browser. */
  openAsJson(content: string, fileName?: string): void;
}
