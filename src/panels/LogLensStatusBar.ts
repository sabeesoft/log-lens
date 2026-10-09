import { StatusBarAlignment, StatusBarItem, ThemeColor, window } from "vscode";

export interface LogLensStats {
  matched: number;
  total: number;
  errorCount: number;
  format: string;
}

/**
 * A single status bar item shown only while a Log Lens panel is focused.
 * Displays "matched / total", a parse-error count and the detected format.
 * Clicking it runs `log-lens.showErrors`.
 */
class LogLensStatusBar {
  private item: StatusBarItem | undefined;

  init(): StatusBarItem {
    this.item = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    this.item.command = "log-lens.showErrors";
    return this.item;
  }

  update(stats: LogLensStats | null): void {
    if (!this.item) {
      return;
    }
    if (!stats) {
      this.item.hide();
      return;
    }
    const matched = stats.matched.toLocaleString();
    const total = stats.total.toLocaleString();
    const warn = stats.errorCount > 0 ? `  $(warning) ${stats.errorCount}` : "";
    this.item.text = `$(search) ${matched} / ${total}${warn}  ·  ${stats.format}`;
    this.item.tooltip =
      stats.errorCount > 0
        ? `${stats.errorCount} parse error(s) — click to view`
        : `${matched} of ${total} entries match`;
    this.item.backgroundColor =
      stats.errorCount > 0 ? new ThemeColor("statusBarItem.warningBackground") : undefined;
    this.item.show();
  }

  dispose(): void {
    this.item?.dispose();
    this.item = undefined;
  }
}

export const logLensStatusBar = new LogLensStatusBar();
