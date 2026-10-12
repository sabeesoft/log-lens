# @sabeesoft/loglens-core

Framework-agnostic log parsing core for [Log Lens](https://github.com/sabeesoft/log-lens).

Takes file **content** (a string) and produces plain `LogEntry[]` records. It
detects the format (JSON / NDJSON / CSV), parses it, and applies smart value
detection for CSV columns (timestamps, numbers, booleans, nulls, and Java
`toString()` notation found in data-lake exports).

- **Runs anywhere** — the browser and Node, identical behaviour.
- **No DOM, no Node built-ins, no host-app imports.** Byte→string decoding and
  all IO stay in the shell that consumes it.
- Powers the VS Code extension, the web app, and the installable PWA from one
  implementation.

## Usage

```ts
import { detectFormat, parseContent } from '@sabeesoft/loglens-core';

const format = detectFormat('app.log');        // 'NDJSON'
const { logs, errors } = parseContent(text, format);
```

## API

- `detectFormat(fileName): 'JSON' | 'NDJSON' | 'CSV'`
- `parseContent(content, format): { logs, errors, format }`
- `parseCsvContent(content): { logs, errors, rowCount }`
- `parseJavaNotation(input): unknown`
- `isTimestampColumn(name)`, `normalizeTimestamp(value)`
- types: `LogEntry`, `LogFormat`, `ParseResult`, `CsvParseResult`, `Filter`

## License

Apache-2.0
