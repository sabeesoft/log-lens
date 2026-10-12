import type { HostAdapter, LogsPayload } from './types';

/**
 * Host adapter for the standalone web app / PWA. Everything stays in the
 * browser — no server, no network. Logs are fed in locally (drag & drop, file
 * picker) by calling `pushLogs`; the file-loading UI wiring lands in a later
 * phase. `openAsJson` opens a client-side blob in a new tab.
 */
/** 'replace' opens a file as a fresh dataset; 'append' adds it to the current logs. */
export type OpenMode = 'replace' | 'append';

export interface WebHost extends HostAdapter {
  kind: 'web';
  /** Deliver a freshly parsed batch of logs to the app. */
  pushLogs(payload: LogsPayload): void;
  /** Register the file-open action (WebShell owns the picker). */
  setOpenHandler(fn: (mode: OpenMode) => void): void;
  /** Trigger the file-open action from anywhere in the UI (e.g. the toolbar). */
  requestOpen(mode: OpenMode): void;
}

export function createWebHost(): WebHost {
  const handlers = new Set<(payload: LogsPayload) => void>();
  let last: LogsPayload | null = null;
  let openHandler: ((mode: OpenMode) => void) | null = null;

  return {
    kind: 'web',

    pushLogs(payload: LogsPayload) {
      last = payload;
      handlers.forEach((h) => h(payload));
    },

    setOpenHandler(fn: (mode: OpenMode) => void) {
      openHandler = fn;
    },

    requestOpen(mode: OpenMode) {
      openHandler?.(mode);
    },

    requestInitialLogs() {
      // Nothing to pull from — the browser delivers logs via pushLogs. Replay
      // the last batch if a late subscriber asks after logs were already loaded.
      if (last) {
        const snapshot = last;
        handlers.forEach((h) => h(snapshot));
      }
    },

    onLogs(handler: (payload: LogsPayload) => void) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },

    reportStats() {
      // No status bar in the browser. Intentionally a no-op; nothing leaves the page.
    },

    openAsJson(content: string) {
      if (typeof window === 'undefined') {
        return;
      }
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // Revoke on the next tick so the new tab has time to load it.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
  };
}
