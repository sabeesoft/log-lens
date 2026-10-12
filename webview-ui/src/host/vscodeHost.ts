import { getVsCodeApi } from '../utils/vscodeApi';
import type { HostAdapter, LogsPayload } from './types';

/**
 * Host adapter backed by the VS Code webview messaging bridge. This preserves
 * the extension's original protocol exactly:
 *   outgoing: { type: 'requestLogs' } · { type: 'stats', matched, total } ·
 *             { type: 'openAsJson', content, fileName }
 *   incoming: { type: 'updateLogs', logs, fileName }
 */
export function createVscodeHost(): HostAdapter {
  const vscode = getVsCodeApi();

  return {
    kind: 'vscode',

    requestInitialLogs() {
      vscode?.postMessage({ type: 'requestLogs' });
    },

    onLogs(handler: (payload: LogsPayload) => void) {
      const listener = (event: MessageEvent) => {
        const message = event.data;
        if (message?.type === 'updateLogs') {
          handler({ logs: message.logs, fileName: message.fileName });
        }
      };
      window.addEventListener('message', listener);
      return () => window.removeEventListener('message', listener);
    },

    reportStats(matched: number, total: number) {
      vscode?.postMessage({ type: 'stats', matched, total });
    },

    openAsJson(content: string, fileName?: string) {
      vscode?.postMessage({ type: 'openAsJson', content, fileName });
    },
  };
}
