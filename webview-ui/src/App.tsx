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

    return () => window.removeEventListener("message", handleMessage);
  }, [setLogs, setFileName]);

  return <LogViewer />;
}
