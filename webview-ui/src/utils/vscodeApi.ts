// `acquireVsCodeApi()` may only be called once per webview session, so the
// handle is acquired here and shared across the app.
interface VsCodeApi {
  postMessage: (message: unknown) => void;
  getState?: () => unknown;
  setState?: (state: unknown) => void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

let api: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi | undefined {
  if (api) {
    return api;
  }
  try {
    api = window.acquireVsCodeApi?.();
  } catch {
    // Not running inside a VS Code webview, or already acquired.
  }
  return api;
}

export function postToHost(message: unknown): void {
  getVsCodeApi()?.postMessage(message);
}
