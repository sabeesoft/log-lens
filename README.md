![Log Lens](assets/hero.png)

# Log Lens

A lightweight log viewer for reading and querying log files. Open any **JSON**,
**NDJSON** or **CSV** log, search it, filter by level, find the spike. One engine
runs three ways — a **VS Code extension**, a **web app**, and an installable
**PWA** — and **your logs never leave your machine**: no upload, no server, no
telemetry. In the editor it follows your VS Code color theme (dark, light and
high contrast).

> **Private by design.** Log files often carry production data — tokens, emails,
> customer records. Log Lens parses and queries everything locally, so there is
> nothing to leak. See [Private by design](#private-by-design) below.

## Demo

![Log Lens in action](assets/demo.gif)

## Private by design

Log Lens is built so there is **nothing to send and nothing to collect** — and
so you can verify that yourself:

- 🔒 **100% local.** Parsing and querying run in the editor or your browser. Your
  log files are read straight from disk into the page; they are never uploaded.
- 📡 **Zero network calls.** The web app ships a strict Content-Security-Policy
  with `connect-src 'none'` — the browser itself forbids it from making any
  network request. Pull your network cable and it still works.
- 🧪 **Enforced in CI.** A build check (`npm run check:no-network`) fails the
  build if any network API sneaks into the source. The guarantee is tested, not
  promised.
- 🙈 **No telemetry, no accounts, no cookies, no third parties.** No analytics,
  no remote fonts, no CDNs at runtime — the app can't phone home because it has
  nowhere to call.
- 📖 **Open source (Apache-2.0).** Don't trust us — [read the code](https://github.com/sabeesoft/log-lens).

The same engine powers all three surfaces, so the privacy guarantee is identical
whether you use the extension, the web app or the PWA.

## Opening logs

Log Lens never needs an active editor:

- **Activity Bar** → the **Log Lens** view → **Open Log File…**, plus your **recent** files
- **Explorer** → right-click a `.json`, `.log`, `.ndjson` or `.csv` file → **Open with Log Lens**
- **Command Palette** → `Log Lens: Open Log File…`, or load the file in the current
  editor with `Load Current JSON File`, `Load Log File (NDJSON)` or `Load CSV File`

While a Log Lens tab is focused, a **status bar** item shows the match count,
the number of parse errors (click to view them) and the detected format.

## In the browser — web app & PWA

The same UI runs as a standalone web app, with nothing but static files behind
it. Load a log by any of:

- **Drag & drop** a file anywhere onto the page
- **Open file** — the toolbar button, or the big button on the welcome screen
  (uses the File System Access API where available, a file picker elsewhere)
- **Paste** log text straight from the clipboard (⌘/Ctrl + V)
- **Recent** — one-click reopen of files you've opened before (stored locally)
- **Open with Log Lens** from your OS, once installed (see below)

The toolbar's **Open file** menu can either replace the current logs or **add a
file to them**, so you can merge several logs into one view.

**Install it (PWA).** In a Chromium browser, use the install icon in the address
bar to install Log Lens as a desktop app. It then works **fully offline** and
registers as a handler for `.json` / `.ndjson` / `.log` / `.csv` files, so you
can double-click a log or choose **Open with → Log Lens** — just like the editor
integration, but as its own app. Nothing about the files is cached or sent.

## Search and Query

Log Lens has two modes, toggled in the toolbar. The query text is the state:
level chips and column headers rewrite it.

### Search (default)

One input that matches the **message and every field** (nested values included).
Press **Enter** to run. **Level chips** (error / warn / info / debug / …) filter by
level and understand **numeric Pino/Bunyan levels** (`30` ≡ `info`).

### Query

A CloudWatch Logs Insights–style pipeline, prefilled from your current search so
nothing is lost:

```
fields @timestamp, level, message
| filter level = "error" and status >= 500
| sort @timestamp desc
| limit 100
```

- **`fields`** picks the columns (omit it, or `fields *`, to see the full raw rows).
  Clicking a **column header** sorts and rewrites the `| sort` line.
- **`filter`** supports `= != < <= > >=`, `like` (substring, or a `/regex/`), `in (...)`,
  `and` / `or` / `not`, grouping with `( )`, and bare terms for free-text search.
  `like` on an object field (e.g. a CloudWatch `@message` container) matches its
  JSON text, like a free-text search.
- In Query mode **Enter inserts a newline**; apply with **⌘/Ctrl + Enter** or **Run**.
  Typing never re-filters — it only applies when you run it.
- **Errors** are reported on Run with a **line/column**, a red squiggle under the
  offending token, and quick fixes: **“did you mean …?”** and **“comment out line N”**
  (`#` starts a line comment). Run is disabled while the query has errors.
- **Autocomplete** suggests fields (ranked so `level` surfaces `@message.level`) and
  keywords as you type.

## Volume histogram

A level-stacked histogram sits under the toolbar, bucketed from the detected
timestamp field — red for errors, yellow for warnings, blue for the rest — with
start / middle / end time labels, so you can see when things broke at a glance.

## The log table

- **Rows never wrap.** Object/array values render as a compact `{…} N keys` or
  `{…} N.N KB` badge (full value in the tooltip).
- **Level columns** are colour-coded and normalise numeric levels to names.
- Click a row to open the **details panel**.

## Details panel

- **Raw**, **Pretty** (syntax-highlighted) and **Tree** views.
- The tree collapses large values behind a single ▸ caret: objects/arrays show
  `{…} N keys`, long strings and stack traces truncate and expand in place — one
  affordance for everything.
- **↑ / ↓** step through rows while the panel is open.
- **Copy** the record, or **JSON TAB** to open the full record in a normal JSON
  editor for folding and search.
- Resizable, and overlays the list instead of pushing the layout.

## Filters panel

The **Filters** button opens a side panel with the structured controls:

- **Add filter** rows (contains / equals / > / < / regex / exists) combined with **AND / OR**
- **Order by** a field, ascending or descending
- **Visible fields** toggles and a **field depth** control for how deep nested keys are flattened

## Distributed traces

When trace fields are detected, a **SERVICE MAP** action opens a service graph:

- Service-to-service graph (React Flow + dagre) with healthy / warning / error nodes
- Click a node to filter logs by that service
- A resizable split between the graph and the trace’s logs
- Auto-detects `trace_id` / `traceId`, `span_id`, `parent_span_id`, `service` /
  `serviceName` / `service.name`, including when nested inside containers like
  `@message`, `message`, `data`, `body` or `payload` (AWS CloudWatch compatible)

## Supported formats

Log Lens reads three input formats and auto-detects the level and timestamp
fields from common shapes.

**JSON array** — a `.json` file containing an array of entries (objects or strings).

**NDJSON** — a `.log` / `.ndjson` file with one JSON object per line; malformed
lines are skipped and reported.

**CSV** — including AWS Athena / data-lake exports. Columns are auto-detected from
the header row, Unix epoch timestamps (seconds or milliseconds) are converted to
ISO 8601, and Java-style `{key=value, nested={…}}` notation is parsed into
structured objects (nested objects, arrays, booleans, nulls and numbers).

Common JSON shapes it handles:

```json
// Pino / Bunyan (numeric levels, epoch time)
{ "level": 30, "time": 1234567890, "msg": "Request received" }

// Winston
{ "level": "info", "message": "Server started", "timestamp": "2024-01-15T10:30:00.000Z" }

// AWS CloudWatch (nested @message container)
{
  "@timestamp": "2024-01-15T10:30:00.000Z",
  "@message": { "level": "info", "message": "Processing request", "service": "api-gateway" }
}
```

## Installation (from source)

```bash
git clone https://github.com/sabeesoft/log-lens.git
cd log-lens
npm run install:all     # install extension + webview deps
npm run build:webview   # build the React UI
```

Then open the folder in VS Code and press **F5** to launch the Extension
Development Host.

## Development

```
log-lens/
├── packages/core/              # @sabeesoft/loglens-core — framework-agnostic
│                               # parsing (JSON/NDJSON/CSV, Java notation, …),
│                               # runs in the browser and Node, zero host deps
├── src/                        # VS Code extension host (Node) — a thin shell
│   ├── extension.ts            # Commands, Activity Bar view, status bar
│   ├── fileLoader.ts           # Reads a file, parses via loglens-core, displays
│   ├── panels/                 # Webview panel manager + status bar item
│   ├── views/recentFiles.ts    # Recent-files tree view (globalState)
│   └── utilities/              # getNonce, getUri
├── webview-ui/                 # Shared React UI (Vite)
│   ├── public-web/             # PWA manifest, service worker, icon, _headers
│   ├── web.html                # Web/PWA entry (vite.config.web.ts)
│   └── src/
│       ├── host/               # HostAdapter seam: vscodeHost / webHost
│       ├── web/                # Web app shell: file loading, PWA, theme
│       ├── components/         # QueryBar, QueryEditor, SearchBar, Histogram,
│       │                       # LogTable/LogList/LogRow, Sidebar, TraceModal, …
│       ├── store/              # Zustand store
│       └── hooks/ utils/ types # field discovery, mapping, helpers
└── assets/                     # icon + hero + logo sources
```

The query language lives in its own package, [`@sabeesoft/insightql`](https://www.npmjs.com/package/@sabeesoft/insightql).

Scripts:

```bash
npm run install:all      # install all dependencies
npm run start:webview    # Vite dev server for the webview
npm run build:webview    # production build of the webview
npm run compile          # compile the extension TypeScript
npm run watch            # compile in watch mode
npm run lint             # lint the extension sources
```

Inside `webview-ui/` (the web app / PWA):

```bash
npm run dev:web          # dev server for the standalone web app (open the root)
npm run build:web        # production build → webview-ui/build-web/
npm run preview:web      # preview the production build
npm run check:no-network # fail if any network API is used in the source
```

Built with the VS Code Extension API, React 19, TypeScript, Zustand,
react-window, @xyflow/react + @dagrejs/dagre (service map), Vite and Lucide
icons. Parsing is [`@sabeesoft/loglens-core`](packages/core); the query language
is [`@sabeesoft/insightql`](https://www.npmjs.com/package/@sabeesoft/insightql) —
both self-contained and dependency-free.

## Deploying the web app

The web app is a folder of static files — host it anywhere, no backend required.

```bash
cd webview-ui && npm run build:web   # outputs build-web/
```

Serve `build-web/` from any static host (GitHub Pages, Netlify, Cloudflare Pages,
or `npx serve build-web`). The build bakes a strict CSP (`connect-src 'none'`)
into `index.html`, so the core privacy guarantee holds on any host.

For defense in depth, set the security headers that can only be delivered over
HTTP (not via `<meta>`) at the hosting layer: `public-web/_headers` does this
automatically on **Netlify** and **Cloudflare Pages** (frame-ancestors,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, …). **GitHub Pages**
can't set custom headers, but the CSP `<meta>` still enforces the no-network
promise there.

## Contributing

Contributions are welcome — please open an issue or a pull request.

## License

Licensed under the [Apache-2.0 License](LICENSE).

## Support

For bugs and feature requests, open an issue on the
[GitHub repository](https://github.com/sabeesoft/log-lens).
