import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText,
  FolderOpen,
  ShieldCheck,
  WifiOff,
  Upload,
  AlertTriangle,
  X,
  Clock,
  Clipboard,
} from 'lucide-react';
import App from '../App';
import { useLogStore } from '../store/logStore';
import { getWebHost } from '../host';
import type { OpenMode } from '../host/webHost';
import { loadLogFile, pickLogFile } from './loadLogFile';
import { addRecent, getRecents, reopenRecent, removeRecent, type RecentEntry } from './recentFiles';

export default function WebShell() {
  const logsCount = useLogStore((s) => s.logs.length);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const dragDepth = useRef(0);

  const refreshRecents = useCallback(() => {
    getRecents().then(setRecents);
  }, []);

  const handleFile = useCallback(
    async (file: File | null, handle?: FileSystemFileHandle, mode: OpenMode = 'replace') => {
      if (!file) {
        return;
      }
      setError(null);
      try {
        const result = await loadLogFile(file);
        if (result.logs.length === 0) {
          setError(`No valid log entries found in ${file.name}.`);
          return;
        }
        if (result.errors.length > 0) {
          setError(
            `Loaded ${result.logs.length} entries from ${file.name}, but ${result.errors.length} line(s) had parse errors.`
          );
        }
        if (mode === 'append') {
          // Merge into the current dataset instead of replacing it.
          const state = useLogStore.getState();
          getWebHost()?.pushLogs({
            logs: [...state.logs, ...result.logs],
            fileName: state.fileName
              ? `${state.fileName} + ${result.fileName}`
              : result.fileName,
          });
        } else {
          getWebHost()?.pushLogs({ logs: result.logs, fileName: result.fileName });
        }
        if (handle) {
          addRecent(handle).then(refreshRecents);
        }
      } catch (err) {
        setError(
          `Failed to read ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    },
    [refreshRecents]
  );

  const openPicker = useCallback(
    async (mode: OpenMode = 'replace') => {
      const picked = await pickLogFile();
      if (picked) {
        handleFile(picked.file, picked.handle, mode);
      }
    },
    [handleFile]
  );

  const openRecent = useCallback(
    async (entry: RecentEntry) => {
      const file = await reopenRecent(entry);
      if (file) {
        handleFile(file, entry.handle);
      } else {
        setError(`Couldn't reopen ${entry.name} — permission denied or the file has moved.`);
      }
    },
    [handleFile]
  );

  // Load the Recent list once.
  useEffect(() => {
    refreshRecents();
  }, [refreshRecents]);

  // Let the toolbar's "Open" button (in QueryBar) trigger the picker.
  useEffect(() => {
    getWebHost()?.setOpenHandler(openPicker);
  }, [openPicker]);

  // OS "Open with Log Lens" — the PWA file handler delivers launched files here.
  // setConsumer can be called late; the browser queues the launch until it is.
  useEffect(() => {
    const queue = (window as unknown as { launchQueue?: { setConsumer: (cb: (p: { files?: FileSystemFileHandle[] }) => void) => void } }).launchQueue;
    queue?.setConsumer(async (params) => {
      const handle = params.files?.[0];
      if (handle) {
        handleFile(await handle.getFile(), handle);
      }
    });
  }, [handleFile]);

  // Paste log text straight from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return; // let the field handle its own paste
      }
      const text = e.clipboardData?.getData('text');
      if (text && text.trim().length > 0) {
        e.preventDefault();
        handleFile(new File([text], 'pasted.json', { type: 'application/json' }));
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFile]);

  // Drag & drop anywhere on the window.
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      handleFile(e.dataTransfer?.files?.[0] ?? null);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleFile]);

  const hasLogs = logsCount > 0;

  return (
    <>
      {/* LogViewer renders itself as position:fixed inset:0; everything below
          is layered on top of it with fixed positioning and explicit z-index.
          The "Open file" control lives in the toolbar (QueryBar) once logs are
          loaded; see getWebHost().requestOpen(). */}
      <App />

      {error && (
        <div
          className="fixed top-0 left-1/2 -translate-x-1/2 z-[80] mt-2 flex items-center gap-2 px-3 py-1.5 rounded-md text-xs shadow-lg max-w-[90vw]"
          style={{
            background: '#2a1416',
            color: 'var(--vscode-editorError-foreground)',
            border: '1px solid rgba(248,113,113,0.4)',
          }}
        >
          <AlertTriangle size={13} className="shrink-0" />
          <span className="truncate">{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer opacity-70 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      )}

      {!hasLogs && (
        <WelcomeScreen
          onOpen={() => openPicker('replace')}
          recents={recents}
          onOpenRecent={openRecent}
          onRemoveRecent={(id) => removeRecent(id).then(refreshRecents)}
        />
      )}

      {dragging && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(10, 10, 10, 0.85)' }}
        >
          <div
            className="flex flex-col items-center gap-3 px-10 py-8 rounded-xl border-2 border-dashed"
            style={{ borderColor: 'var(--vscode-charts-blue)', color: 'var(--vscode-foreground)' }}
          >
            <Upload size={32} style={{ color: 'var(--vscode-charts-blue)' }} />
            <span className="text-sm font-medium">Drop your log file to open it</span>
          </div>
        </div>
      )}
    </>
  );
}

function WelcomeScreen({
  onOpen,
  recents,
  onOpenRecent,
  onRemoveRecent,
}: {
  onOpen: () => void;
  recents: RecentEntry[];
  onOpenRecent: (entry: RecentEntry) => void;
  onRemoveRecent: (id: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'var(--vscode-editor-background)' }}
    >
      <div className="flex flex-col items-center text-center max-w-lg w-full">
        <div
          className="flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
          style={{ background: 'rgba(59, 130, 246, 0.12)' }}
        >
          <FileText size={30} style={{ color: 'var(--vscode-charts-blue)' }} />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight mb-2">Log Lens</h1>
        <p className="text-sm mb-1" style={{ color: 'var(--vscode-foreground)' }}>
          A fast viewer for JSON, NDJSON and CSV logs.
        </p>
        <p className="text-sm mb-8" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          Drag a file anywhere onto this page, open one, or paste log text.
        </p>

        <button
          onClick={onOpen}
          className="flex items-center justify-center gap-2 cursor-pointer mb-3"
          style={{
            padding: '7px 14px',
            backgroundColor: 'transparent',
            color: 'var(--vscode-textLink-foreground, #60a5fa)',
            border: '1px solid var(--vscode-textLink-foreground, #60a5fa)',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'monospace',
            letterSpacing: '0.3px',
            transition: 'background-color 0.12s, color 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--vscode-textLink-foreground, #60a5fa)';
            e.currentTarget.style.color = 'var(--vscode-editor-background, #0a0a0a)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--vscode-textLink-foreground, #60a5fa)';
          }}
        >
          <FolderOpen size={14} />
          OPEN LOG FILE
        </button>

        <p
          className="flex items-center gap-1.5 text-[11px] mb-8"
          style={{ color: 'var(--vscode-disabledForeground)' }}
        >
          <Clipboard size={12} /> or press ⌘/Ctrl + V to paste
        </p>

        {recents.length > 0 && (
          <div className="w-full max-w-sm mb-8 text-left">
            <div
              className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide mb-2 px-1"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              <Clock size={12} /> Recent
            </div>
            <ul className="flex flex-col gap-0.5">
              {recents.map((entry) => (
                <li key={entry.id} className="group flex items-center">
                  <button
                    onClick={() => onOpenRecent(entry)}
                    className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer text-left truncate"
                    style={{ color: 'var(--vscode-foreground)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <FileText size={13} style={{ color: 'var(--vscode-descriptionForeground)' }} />
                    <span className="truncate">{entry.name}</span>
                  </button>
                  <button
                    onClick={() => onRemoveRecent(entry.id)}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-pointer px-1.5"
                    title="Remove from Recent"
                    style={{ color: 'var(--vscode-descriptionForeground)' }}
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px]"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} style={{ color: 'var(--vscode-charts-green)' }} />
            Your logs never leave your machine
          </span>
          <span className="flex items-center gap-1.5">
            <WifiOff size={14} style={{ color: 'var(--vscode-charts-green)' }} />
            Works fully offline
          </span>
        </div>
        <p className="mt-3 text-[11px]" style={{ color: 'var(--vscode-disabledForeground)' }}>
          No upload · no server · no telemetry · no accounts
        </p>
      </div>
    </div>
  );
}
