import { useEffect } from "react";
import LogViewer from "./LogViewer";
import { useLogStore } from "./store/logStore";

declare global {
  interface Window {
    acquireVsCodeApi?: () => any;
  }
}

const vscode = window.acquireVsCodeApi?.();

export default function App() {
  const setLogs = useLogStore((state) => state.setLogs);
  const setFileName = useLogStore((state) => state.setFileName);

  useEffect(() => {
    // Listen for messages from the extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case "updateLogs":
          setLogs(message.logs);
          if (message.fileName) {
            setFileName(message.fileName);
          }
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    // Request initial logs
    vscode?.postMessage({ type: "requestLogs" });

    // Report match/total counts to the extension for the status bar item.
    let lastMatched = -1;
    let lastTotal = -1;
    const unsubscribe = useLogStore.subscribe((state) => {
      const matched = state.filteredLogs.length;
      const total = state.logs.length;
      if (matched !== lastMatched || total !== lastTotal) {
        lastMatched = matched;
        lastTotal = total;
        vscode?.postMessage({ type: "stats", matched, total });
      }
    });

    return () => {
      window.removeEventListener("message", handleMessage);
      unsubscribe();
    };
  }, [setLogs, setFileName]);

  return <LogViewer />;
}
