import { getVsCodeApi } from '../utils/vscodeApi';
import { createVscodeHost } from './vscodeHost';
import { createWebHost, type WebHost } from './webHost';
import type { HostAdapter } from './types';

export type { HostAdapter, LogsPayload } from './types';
export type { WebHost } from './webHost';

let host: HostAdapter | undefined;

/**
 * The single host adapter for this session. Picks the VS Code bridge when
 * running inside a webview (`acquireVsCodeApi` is present), otherwise the
 * browser web host. Acquired once and shared.
 */
export function getHost(): HostAdapter {
  if (!host) {
    host = getVsCodeApi() ? createVscodeHost() : createWebHost();
  }
  return host;
}

/** The web host, when running in the browser — for the file-loading UI to push logs. */
export function getWebHost(): WebHost | undefined {
  const h = getHost();
  return h.kind === 'web' ? (h as WebHost) : undefined;
}
