import {
  Command,
  Event,
  EventEmitter,
  ExtensionContext,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from "vscode";

export interface RecentFile {
  path: string;
  name: string;
  format: string;
  openedAt: number;
}

const STATE_KEY = "log-lens.recentFiles";
const MAX_RECENT = 15;

export function getRecentFiles(context: ExtensionContext): RecentFile[] {
  return context.globalState.get<RecentFile[]>(STATE_KEY, []);
}

export function addRecentFile(
  context: ExtensionContext,
  file: Omit<RecentFile, "openedAt">
): void {
  const existing = getRecentFiles(context).filter((f) => f.path !== file.path);
  const updated = [{ ...file, openedAt: Date.now() }, ...existing].slice(0, MAX_RECENT);
  context.globalState.update(STATE_KEY, updated);
  recentFilesProvider?.refresh();
}

export function clearRecentFiles(context: ExtensionContext): void {
  context.globalState.update(STATE_KEY, []);
  recentFilesProvider?.refresh();
}

const FORMAT_ICONS: Record<string, string> = {
  JSON: "json",
  NDJSON: "list-unordered",
  CSV: "table",
};

export class RecentFilesProvider implements TreeDataProvider<RecentFile> {
  private _onDidChangeTreeData = new EventEmitter<void>();
  readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event;

  constructor(private readonly context: ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(file: RecentFile): TreeItem {
    const item = new TreeItem(file.name, TreeItemCollapsibleState.None);
    item.description = file.format;
    item.tooltip = file.path;
    item.resourceUri = undefined;
    item.iconPath = new ThemeIcon(FORMAT_ICONS[file.format] ?? "file");
    item.command = {
      command: "log-lens.openRecent",
      title: "Open",
      arguments: [file.path],
    } as Command;
    return item;
  }

  getChildren(): RecentFile[] {
    return getRecentFiles(this.context);
  }
}

// Module-level handle so loader/commands can trigger a refresh after state changes.
export let recentFilesProvider: RecentFilesProvider | undefined;

export function registerRecentFilesProvider(provider: RecentFilesProvider): void {
  recentFilesProvider = provider;
}
