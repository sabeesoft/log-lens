# Log Lens Architecture

## Overview
A React-based log viewer with advanced filtering, sorting, and virtualization capabilities. Built with TypeScript, Zustand for state management, and react-window for performance.

## Tech Stack
- **React** - UI framework
- **TypeScript** - Type safety
- **Zustand** - State management
- **react-window** - Virtualized list rendering
- **Lucide React** - Icon components

## Project Structure

```
webview-ui/src/
├── components/          # React components
│   ├── FilterRow.tsx    # Individual filter input row
│   ├── FilterSection.tsx # Complete filter panel
│   ├── OrderBySection.tsx # Sorting controls
│   ├── LogRow.tsx       # Individual log entry display
│   └── LogList.tsx      # Virtualized log list container
├── hooks/               # Custom React hooks
│   ├── useLogFields.ts  # Extract fields from logs
│   └── useLogFiltering.ts # (deprecated - logic moved to store)
├── store/               # Zustand state management
│   └── logStore.ts      # Centralized application state
├── types/               # TypeScript type definitions
│   └── index.ts         # Shared types (LogEntry, Filter)
├── utils/               # Utility functions
│   └── logUtils.ts      # Helper functions (colors, etc.)
├── App.tsx              # Root component
└── LogViewer.tsx        # Main viewer component
```

## State Management (Zustand)

### Store Structure (`store/logStore.ts`)

**State:**
- `logs: LogEntry[]` - Raw log data
- `filters: Filter[]` - Current filter configuration (draft)
- `appliedFilters: Filter[]` - Active filters being applied
- `orderByField: string` - Field to sort by
- `orderByDirection: 'asc' | 'desc'` - Sort direction
- `expandedLogs: Set<number>` - Expanded log indices
- `visibleFields: string[]` - Fields to display in log rows (default: ['message'])

**Actions:**
- **Filter Management:** `addFilter()`, `updateFilter()`, `removeFilter()`, `applyFilters()`, `clearFilters()`
- **Order Management:** `setOrderByField()`, `setOrderByDirection()`
- **UI Management:** `toggleLogExpansion()`, `toggleFieldVisibility()`, `setVisibleFields()`
- **Data Management:** `setLogs()`

**Computed State:**
- `getFilteredLogs()` - Returns filtered and sorted logs
- `getActiveSearchTerms()` - Returns search terms for highlighting

### Benefits of Zustand
✅ **Single source of truth** - All state centralized
✅ **No prop drilling** - Components access state directly
✅ **Performance** - Only re-renders affected components
✅ **TypeScript support** - Full type safety
✅ **Minimal boilerplate** - Simple API
✅ **DevTools support** - Can integrate Redux DevTools

## Component Architecture

### Component Hierarchy
```
App
└── LogViewer
    ├── FilterSection
    │   └── FilterRow (multiple)
    ├── OrderBySection
    ├── FieldVisibilitySection
    └── LogList
        └── LogRow (virtualized, multiple)
```

### Component Responsibilities

**App.tsx**
- Entry point
- Manages VSCode extension communication
- Initializes Zustand store with logs

**LogViewer.tsx**
- Main container component
- Connects Zustand store to UI components
- Orchestrates data flow

**FilterSection.tsx**
- Manages multiple filters
- Shows apply/clear actions
- Displays result count

**FilterRow.tsx**
- Single filter input (field, operator, value)
- AND/OR relation toggle
- Remove filter button

**OrderBySection.tsx**
- Field selection for sorting
- ASC/DESC direction toggle

**FieldVisibilitySection.tsx**
- Toggle buttons for each available field
- Shows count of visible fields
- Prevents hiding all fields (minimum 1)

**LogList.tsx**
- Virtualized list rendering (react-window)
- Responsive height calculation
- Empty state display

**LogRow.tsx**
- Individual log entry display
- Displays multiple fields based on visibleFields
- Field labels with separators
- Expand/collapse functionality
- Search term highlighting across all visible fields
- Memoized for performance

## Key Features

### 1. Flexible Log Format Support
- Handles plain string logs (e.g., `"Application started"`)
- Handles structured object logs with any field names
- No required fields - works with varying log structures
- Gracefully displays logs missing standard fields
- Supports mixing different log formats in same dataset
- **CSV support** - Parses CSV files (e.g., AWS Athena exports) with auto-detected headers
- **Java-style notation parser** - Recursively parses `{key=value, nested={...}, array=[...]}` notation from data lake snapshots
- **Smart type detection** - Auto-converts timestamps, numbers, booleans, and nulls from string values

### 2. Advanced Filtering
- Multiple filters with AND/OR logic
- Operators: contains (~), not contains (!~), equals (==)
- Nested field support (e.g., `user.address.city`)
- Real-time search term highlighting
- String logs filtered by entire content
- Object logs filtered by specific fields

### 3. Field Visibility Control
- Toggle any field on/off for display in log rows
- Multiple fields can be shown simultaneously
- Default displays message field only
- Prevents hiding all fields (minimum 1 required)
- Fields display with labels and separators

### 4. Sorting
- Sort by any field
- Ascending/Descending order
- Numeric and string-aware sorting

### 5. Performance Optimizations
- **Virtualization** - Only renders visible logs (react-window)
- **Memoization** - React.memo on LogRow component
- **Computed values** - Filtering/sorting in store
- **Variable item sizes** - Dynamic heights for expanded logs

### 6. Developer-Friendly UI
- Monospace fonts throughout
- Dark theme optimized for readability
- Compact, information-dense layout
- Terminal/IDE aesthetic

## Data Flow

```
VSCode Extension
    ↓ (message)
App.tsx (useEffect)
    ↓ (setLogs)
Zustand Store
    ↓ (useLogStore)
LogViewer
    ↓ (props)
Components
```

### CSV Data Flow (Extension Host Side)
```
CSV file (.csv)
    ↓ csv-parse (auto-detect headers from first row)
Raw row objects (Record<string, string>[])
    ↓ per-column smart detection
    ├── Timestamp column? → normalizeTimestamp() (epoch → ISO 8601)
    ├── Starts with { or [? → parseJavaNotation() (recursive descent parser)
    ├── Numeric? → Number()
    ├── "true"/"false"? → boolean
    ├── "null" or empty? → null
    └── Otherwise → keep as string
    ↓
LogEntry[] → postMessage → webview (format-agnostic, no webview changes needed)
```

### Java-Style Notation Parser
Handles Java `toString()` output commonly found in data lake exports (Kafka snapshots, AWS Athena):
```
Grammar:
  Value       ::= Object | Array | Primitive
  Object      ::= '{' (Key '=' Value (',' Key '=' Value)*)? '}'
  Array       ::= '[' (Value (',' Value)*)? ']'
  Primitive   ::= 'null' | 'true' | 'false' | Number | String

Example:
  Input:  {id=uuid, flags={isdebtor=true}, history=[{cutomerid=125464, displayname=null}]}
  Output: {id: "uuid", flags: {isdebtor: true}, history: [{cutomerid: 125464, displayname: null}]}
```

Disambiguates `{key=value}` (object) vs `{val1, val2}` (Java Set → array) by lookahead for `=`.
On parse failure, gracefully falls back to the raw string.

### Filter Flow
1. User edits filters → Updates `filters` state (draft)
2. User clicks "APPLY" → Copies to `appliedFilters`
3. Store computes `getFilteredLogs()` → Returns filtered results
4. LogList renders filtered logs

### Expand Flow
1. User clicks log row → Calls `toggleLogExpansion(index)`
2. Store updates `expandedLogs` Set
3. LogList recalculates item size → `getItemSize(index)`
4. List updates → Calls `resetAfterIndex(index)`

## Type Definitions

```typescript
type LogEntry = string | {
  timestamp?: string;
  level?: string;
  message?: string;
  [key: string]: any; // Supports nested fields and custom field names
};

interface Filter {
  id: number;
  field: string;
  operator: 'contains' | 'not_contains' | 'equals';
  value: string;
  relation: 'AND' | 'OR';
}
```

**LogEntry Flexibility:**
- Can be a plain string for simple text logs
- Can be an object with any field structure
- Standard fields (timestamp, level, message) are optional
- Supports custom field names (e.g., `time`, `severity`, `text`, `msg`)
- Handles varying log formats in the same dataset

## Styling Approach
- **Inline styles** - All styling done with React inline styles
- **No CSS files** - Keeps components self-contained
- **Monospace fonts** - Developer-friendly aesthetic
- **Dark theme** - Background: #0a0a0a, Cards: #111
- **Accent colors** - Blue (#3b82f6), Purple (#8b5cf6)
- **Level colors** - Error (red), Warn (yellow), Info (blue), Debug (gray)

## Future Enhancements

### Potential Features
- **Persistence** - Save filters to localStorage
- **Export** - Export filtered logs (JSON, CSV)
- **Regex support** - Advanced pattern matching
- **Time range filters** - Filter by timestamp range
- **Column view** - Table-based log display
- **Themes** - Light mode option
- **Live tail** - Auto-scroll for new logs
- **Additional CSV value formats** - Support for more serialization formats beyond Java notation

### Performance Improvements
- **Web Workers** - Offload filtering to background thread
- **Incremental filtering** - Filter as user types
- **Index building** - Pre-index fields for faster filtering

## Development Guidelines

### Best Practices
1. **Keep components small** - Single responsibility principle
2. **Use TypeScript strictly** - No `any` types in production
3. **Memoize expensive components** - Use React.memo
4. **Extract business logic** - Keep it in hooks or store
5. **Test computed values** - Store functions are easy to test

### Adding New Features
1. Update types in `types/index.ts`
2. Add state/actions to `store/logStore.ts`
3. Create/update components
4. Update this documentation

### Performance Monitoring
- Monitor re-renders with React DevTools
- Check store subscriptions with Zustand DevTools
- Profile with Chrome DevTools for large log sets

## VSCode Extension Integration

The webview communicates with the VSCode extension via messages:

**Incoming:**
```typescript
{ type: "updateLogs", logs: LogEntry[], fileName: string }
```

**Outgoing:**
```typescript
{ type: "requestLogs" }
{ type: "transform", script: string, logs: LogEntry[] }
```

### Extension-Side Parsers (`src/parsers/`)

| File | Purpose |
|------|---------|
| `csvParser.ts` | CSV parsing orchestrator using `csv-parse/sync`, applies per-column transforms |
| `javaNotationParser.ts` | Recursive descent parser for Java `toString()` notation (`{key=value}`) |
| `timestampUtils.ts` | Detects timestamp columns by name and converts unix epoch to ISO 8601 |

All parsing happens on the extension host (Node.js) side. The webview receives clean `LogEntry[]` objects and is completely format-agnostic.

## Conclusion

This architecture provides a solid foundation for a professional log viewing tool with:
- Clean separation of concerns
- Scalable state management
- Excellent performance
- Type-safe development
- Easy to extend and maintain
