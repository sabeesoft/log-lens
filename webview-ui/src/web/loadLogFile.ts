import { detectFormat, parseContent } from '@sabeesoft/loglens-core';
import type { LogsPayload } from '../host';

export interface LoadResult extends LogsPayload {
  errors: string[];
  format: string;
}

/**
 * Read a browser File entirely in-memory and parse it with the shared core.
 * Nothing touches the network — `File.text()` reads straight from the user's
 * disk into this page.
 */
export async function loadLogFile(file: File): Promise<LoadResult> {
  const content = await file.text();
  const format = detectFormat(file.name);
  const { logs, errors } = parseContent(content, format);
  return { logs: logs as LogsPayload['logs'], fileName: file.name, errors, format };
}

const ACCEPT_EXTENSIONS = ['.json', '.ndjson', '.log', '.csv'];

/** A chosen file, plus its File System Access handle when the platform gave one. */
export interface PickedFile {
  file: File;
  /** Present only with the File System Access API — lets us reopen it from Recent. */
  handle?: FileSystemFileHandle;
}

/**
 * Open a file. Prefers the File System Access API when available (a real native
 * picker that also yields a reusable handle), falling back to a classic hidden
 * `<input>` elsewhere. Returns null when the user cancels.
 */
export async function pickLogFile(): Promise<PickedFile | null> {
  const anyWindow = window as unknown as {
    showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
  };

  if (typeof anyWindow.showOpenFilePicker === 'function') {
    try {
      const [handle] = await anyWindow.showOpenFilePicker({
        types: [
          {
            description: 'Log files',
            accept: {
              'application/json': ['.json', '.ndjson'],
              'text/csv': ['.csv'],
              'text/plain': ['.log'],
            },
          },
        ],
        excludeAcceptAllOption: false,
        multiple: false,
      });
      return handle ? { file: await handle.getFile(), handle } : null;
    } catch (err) {
      // AbortError = user cancelled; anything else → fall through to the input.
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
    }
  }

  const file = await pickViaInput();
  return file ? { file } : null;
}

function pickViaInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT_EXTENSIONS.join(',');
    input.onchange = () => resolve(input.files?.[0] ?? null);
    // If the dialog is dismissed, `change` never fires — that's fine, the
    // promise simply stays pending and is garbage-collected with the element.
    input.click();
  });
}
