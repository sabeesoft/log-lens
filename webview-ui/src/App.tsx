import { useEffect } from "react";
import LogViewer from "./LogViewer";
import { useLogStore } from "./store/logStore";
import { getHost } from "./host";

const host = getHost();

export default function App() {
  const setLogs = useLogStore((state) => state.setLogs);
  const setFileName = useLogStore((state) => state.setFileName);

  useEffect(() => {
    // Receive logs from whatever is hosting the UI (VS Code, the browser, …).
    const unsubscribeLogs = host.onLogs(({ logs, fileName }) => {
      setLogs(logs);
      if (fileName) {
        setFileName(fileName);
      }
    });

    // Ask the host for the initial batch.
    host.requestInitialLogs();

    // Report match/total counts back to the host (VS Code status bar item).
    let lastMatched = -1;
    let lastTotal = -1;
    const unsubscribeStore = useLogStore.subscribe((state) => {
      const matched = state.filteredLogs.length;
      const total = state.logs.length;
      if (matched !== lastMatched || total !== lastTotal) {
        lastMatched = matched;
        lastTotal = total;
        host.reportStats(matched, total);
      }
    });

    return () => {
      unsubscribeLogs();
      unsubscribeStore();
    };
  }, [setLogs, setFileName]);

  return <LogViewer />;
}
