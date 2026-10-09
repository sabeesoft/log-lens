# Changelog

## 2.0.0

A full UI redesign plus new extension surfaces.

### Added
- **New logo** and Marketplace hero image ("Lens over lines").
- **Theme following** — the whole UI now uses VS Code color variables and works
  in dark, light and high-contrast themes (previously dark-only).
- **Extension surfaces** that no longer require an active editor:
  - Activity Bar **Log Lens** view with **Open Log File…** and a **Recent** list
  - Explorer right-click **Open with Log Lens**
  - Status bar item (match count, parse errors, format) while a tab is focused
- **Search ↔ Query modes.** Search (default) matches the message and every field
  with level chips (numeric Pino/Bunyan levels normalized); Query is a CloudWatch
  Logs Insights–style `fields | filter | sort | limit` pipeline, prefilled from
  the search.
- **Query errors & quick fixes** — validation on Run with line/column, a red
  squiggle, "did you mean…" and "comment out line" fixes, and `#` line comments.
- **Volume histogram** — level-stacked buckets from the detected timestamp field.
- **Details panel** improvements — tree view that collapses large values behind a
  caret, ↑/↓ row stepping, and **Open as JSON tab**.
- One-line table rows with `{…} N keys` / `{…} N.N KB` value badges.

### Changed
- `like` on an object field (e.g. a CloudWatch `@message`) now matches its JSON
  text, like a free-text search.
- Field autocomplete ranks matches by leaf name, so `level` surfaces
  `@message.level` instead of being crowded out by sibling keys.
- The redundant free-text search was removed from the Filters panel (Search mode
  replaces it).
