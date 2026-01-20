# Log Lens

A powerful VS Code extension for viewing, filtering, and analyzing JSON log files with real-time search, field visibility controls, and sorting capabilities.

## Demo

![Log Lens Demo](https://github.com/sabeesoft/log-lens/blob/main/assets/log-lens.gif)

## Features

### 📊 Log Visualization
- **Virtualized rendering** - Handle thousands of log entries with smooth scrolling performance using react-window
- **Expandable log rows** - Click any log entry to see the full JSON structure with syntax highlighting
- **Level-based color coding** - Visual distinction between info, warn, error, and debug levels
- **Field auto-detection** - Automatically identifies level and timestamp fields from common log formats

### 🔍 Advanced Filtering
- **Multi-field filtering** - Create multiple filters across different log fields
- **Flexible operators** - Support for contains, equals, greater than, less than, regex, and exists checks
- **Real-time search** - Instant highlighting of matching terms in log messages
- **AND/OR logic** - Combine filters with logical operators for complex queries
- **Filter management** - Save, modify, and clear filter configurations


### 📋 Field Management
- **Visible fields control** - Show or hide specific fields in log entries
- **Auto-discovery** - Automatically detects all fields present in your logs
- **Persistent selections** - Field visibility preferences are maintained across sessions

### 🔀 Sorting
- **Multi-field sorting** - Sort logs by any field (timestamp, level, custom fields)
- **Ascending/descending** - Toggle sort direction with a single click
- **Type-aware sorting** - Intelligent sorting for strings, numbers, and dates

### 🎨 User Interface
- **Dark theme** - Developer-friendly dark interface with monospace fonts
- **Compact design** - Space-efficient UI with collapsible sections
- **Responsive layout** - Adapts to different window sizes
- **Keyboard shortcuts** - Efficient navigation and interaction

## Installation

### From Source

1. Clone the repository:
```bash
git clone <repository-url>
cd log-lens
```

2. Install dependencies:
```bash
npm run install:all
```

3. Build the webview UI:
```bash
npm run build:webview
```

4. Open in VS Code and press `F5` to launch the Extension Development Host

## Usage

### Opening Log Lens

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac)
2. Type and select one of:
   - **`Log Lens: Load Current JSON File`** - Loads the currently open JSON file (array format) into Log Lens
   - **`Log Lens: Load Log File (NDJSON)`** - Loads newline-delimited JSON logs from a `.log` file

### Loading Logs

**Option 1: Load from JSON array file**
- Open a JSON file containing an array of log entries
- Run command: `Log Lens: Load Current JSON File`

**Option 2: Load from newline-delimited JSON (.log file)**
- Open a `.log` file where each line is a separate JSON object
- Run command: `Log Lens: Load Log File (NDJSON)`
- Example format:
  ```
  {"level":"error","message":"Database connection failed","timestamp":"2024-01-15T10:30:00.000Z"}
  {"level":"info","message":"Server started","timestamp":"2024-01-15T10:30:01.000Z"}
  ```

### Filtering Logs

1. Click **"ADD FILTER"** in the Filters section
2. Select a field from the dropdown
3. Choose an operator (contains, equals, >, <, regex, exists)
4. Enter a value (if applicable)
5. Click **"APPLY"** to activate filters
6. Add multiple filters and choose AND/OR logic

### Sorting Logs

1. Open the **"ORDER BY"** section
2. Select a field to sort by
3. Choose **ASC** (ascending) or **DESC** (descending)

### Managing Field Visibility

1. Open the **"VISIBLE FIELDS"** section
2. Click field badges to toggle visibility
3. Green = visible, Gray = hidden

## Supported Log Formats

Log Lens works with any JSON log format. Common formats include:

**Pino logs:**
```json
{
  "level": 30,
  "time": 1234567890,
  "msg": "Request received",
  "req": { "method": "GET", "url": "/" }
}
```

**Winston logs:**
```json
{
  "level": "info",
  "message": "Server started",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Bunyan logs:**
```json
{
  "name": "myapp",
  "hostname": "server01",
  "level": 30,
  "msg": "Application started",
  "time": "2024-01-15T10:30:00.000Z"
}
```

**Custom formats:**
Log Lens automatically detects common field names and patterns.

## Development

### Project Structure

```
log-lens/
├── src/                        # Extension source code
│   ├── extension.ts           # Extension entry point
│   └── panels/
│       └── LogLensPanel.ts    # Webview panel manager
├── webview-ui/                # React webview UI
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── store/            # Zustand state management
│   │   ├── hooks/            # Custom React hooks
│   │   ├── utils/            # Utility functions
│   │   └── types.ts          # TypeScript types
│   └── package.json
└── package.json
```

### Technologies Used

- **VS Code Extension API** - Extension host integration
- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Zustand** - Lightweight state management
- **react-window** - Virtualized list rendering for performance
- **Vite** - Fast development and build tooling
- **Lucide React** - Icon library

### Available Scripts

```bash
# Install all dependencies
npm run install:all

# Start development server for webview UI
npm run start:webview

# Build webview UI for production
npm run build:webview

# Compile TypeScript for extension
npm run compile

# Watch mode for development
npm run watch

# Lint and format code
npm run lint
npm run format
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is licensed under the [Apache-2.0 License](LICENSE).

## Support

For bugs and feature requests, please create an issue on the [GitHub repository](https://github.com/sabeesoft/log-lens).
