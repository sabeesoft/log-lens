import { create } from 'zustand';
import { Filter, LogEntry } from '../types';

interface LogState {
  // Data
  logs: LogEntry[];
  fileName: string;
  filteredLogs: LogEntry[];

  // Filter state
  filters: Filter[];
  appliedFilters: Filter[];

  // Order state
  orderByField: string;
  orderByDirection: 'asc' | 'desc';

  // UI state
  selectedLogIndex: number | null;
  visibleFields: string[];
  settingsPanelOpen: boolean;
  searchTerm: string;
  appliedSearchTerm: string;
  isFiltering: boolean;

  // Field depth settings
  fieldDepth: number;
  appliedFieldDepth: number;

  // Actions
  setLogs: (logs: LogEntry[]) => void;
  setFileName: (fileName: string) => void;

  // Filter actions
  addFilter: () => void;
  updateFilter: (filterId: number, updatedFilter: Filter) => void;
  removeFilter: (filterId: number) => void;
  applyFilters: () => void;
  clearFilters: () => void;

  // Order actions
  setOrderByField: (field: string) => void;
  setOrderByDirection: (direction: 'asc' | 'desc') => void;

  // UI actions
  selectLog: (index: number | null) => void;
  setVisibleFields: (fields: string[]) => void;
  toggleFieldVisibility: (field: string) => void;
  toggleSettingsPanel: () => void;
  setSettingsPanelOpen: (open: boolean) => void;
  setSearchTerm: (term: string) => void;
  triggerSearch: () => void;

  // Field depth actions
  setFieldDepth: (depth: number) => void;
  applyFieldDepth: () => void;

  // Internal filter computation
  computeFilteredLogs: () => void;

  // Computed/derived state
  getActiveSearchTerms: () => string[];
}

const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
};

// Convert value to string for filtering - handles objects by stringifying them
const valueToFilterString = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value).toLowerCase();
  }
  return String(value).toLowerCase();
};

// Cache for stringified logs to avoid repeated JSON.stringify calls
let stringifyCache = new WeakMap<object, string>();

const getStringified = (log: LogEntry): string => {
  if (typeof log === 'string') return log;
  let cached = stringifyCache.get(log as object);
  if (!cached) {
    cached = JSON.stringify(log).toLowerCase();
    stringifyCache.set(log as object, cached);
  }
  return cached;
};

export const useLogStore = create<LogState>((set, get) => ({
  // Initial state
  logs: [],
  fileName: '',
  filteredLogs: [],
  filters: [{ id: Date.now(), field: '', operator: 'contains', value: '', relation: 'AND' }],
  appliedFilters: [],
  orderByField: '',
  orderByDirection: 'asc',
  selectedLogIndex: null,
  visibleFields: ['all'],
  settingsPanelOpen: false,
  searchTerm: '',
  appliedSearchTerm: '',
  isFiltering: false,
  fieldDepth: 2,
  appliedFieldDepth: 2,

  // Actions
  setLogs: (logs) => {
    // Clear stringify cache when logs change
    stringifyCache = new WeakMap();
    set({ logs });
    get().computeFilteredLogs();
  },

  setFileName: (fileName) => set({ fileName }),

  // Filter actions
  addFilter: () =>
    set((state) => ({
      filters: [...state.filters, { id: Date.now(), field: '', operator: 'contains', value: '', relation: 'AND' }]
    })),

  updateFilter: (filterId, updatedFilter) =>
    set((state) => ({
      filters: state.filters.map((f) => (f.id === filterId ? updatedFilter : f))
    })),

  removeFilter: (filterId) =>
    set((state) => ({
      filters: state.filters.filter((f) => f.id !== filterId)
    })),

  applyFilters: () => {
    set((state) => ({
      appliedFilters: [...state.filters],
      appliedSearchTerm: state.searchTerm,
      isFiltering: true
    }));
    get().computeFilteredLogs();
  },

  clearFilters: () => {
    set({
      filters: [{ id: Date.now(), field: '', operator: 'contains', value: '', relation: 'AND' }],
      appliedFilters: [],
      searchTerm: '',
      appliedSearchTerm: '',
      isFiltering: true
    });
    get().computeFilteredLogs();
  },

  // Order actions
  setOrderByField: (field) => {
    set({ orderByField: field });
    get().computeFilteredLogs();
  },

  setOrderByDirection: (direction) => {
    set({ orderByDirection: direction });
    get().computeFilteredLogs();
  },

  // UI actions
  selectLog: (index) => set({ selectedLogIndex: index }),

  setVisibleFields: (fields) => set({ visibleFields: fields }),

  toggleSettingsPanel: () => set((state) => ({ settingsPanelOpen: !state.settingsPanelOpen })),

  setSettingsPanelOpen: (open) => set({ settingsPanelOpen: open }),

  setSearchTerm: (term) => {
    set({ searchTerm: term });
  },

  triggerSearch: () => {
    set((state) => ({
      appliedSearchTerm: state.searchTerm,
      isFiltering: true
    }));
    get().computeFilteredLogs();
  },

  setFieldDepth: (depth) => set({ fieldDepth: depth }),

  applyFieldDepth: () => set((state) => ({ appliedFieldDepth: state.fieldDepth })),

  toggleFieldVisibility: (field) =>
    set((state) => {
      let visibleFields = [...state.visibleFields];

      if (field === 'all') {
        if (visibleFields.includes('all')) {
          visibleFields = [];
        } else {
          visibleFields = ['all'];
        }
      } else {
        const allIndex = visibleFields.indexOf('all');
        if (allIndex > -1) {
          visibleFields.splice(allIndex, 1);
        }

        const index = visibleFields.indexOf(field);
        if (index > -1) {
          if (visibleFields.length > 1 || visibleFields.includes('all')) {
            visibleFields.splice(index, 1);
          }
        } else {
          visibleFields.push(field);
        }
      }

      return { visibleFields };
    }),

  // Compute filtered logs - called when filters/search/sort changes
  computeFilteredLogs: () => {
    const { logs, appliedFilters, orderByField, orderByDirection, appliedSearchTerm } = get();

    // Use requestAnimationFrame for smoother UI
    requestAnimationFrame(() => {
      let result = logs;

      // Apply search term first (searches across all text content)
      if (appliedSearchTerm.trim()) {
        const searchLower = appliedSearchTerm.toLowerCase();
        result = result.filter((log) => {
          const stringified = getStringified(log);
          return stringified.includes(searchLower);
        });
      }

      // Apply filters
      if (appliedFilters.length > 0) {
        const validFilters = appliedFilters.filter(f => f.field && f.value);

        if (validFilters.length > 0) {
          // Pre-process filter groups once
          const groups: Filter[][] = [];
          let currentGroup: Filter[] = [];

          validFilters.forEach((filter, index) => {
            currentGroup.push(filter);
            if (index === validFilters.length - 1 || validFilters[index + 1]?.relation === 'OR') {
              if (currentGroup.length > 0) {
                groups.push([...currentGroup]);
                currentGroup = [];
              }
            }
          });

          // Pre-lowercase filter values
          const processedGroups = groups.map(group =>
            group.map(f => ({ ...f, valueLower: f.value.toLowerCase() }))
          );

          result = result.filter((log) => {
            if (typeof log === 'string') {
              const logLower = log.toLowerCase();
              return processedGroups.some(group =>
                group.every(filter => {
                  switch (filter.operator) {
                    case 'contains':
                      return logLower.includes(filter.valueLower);
                    case 'not_contains':
                      return !logLower.includes(filter.valueLower);
                    case 'equals':
                      return logLower === filter.valueLower;
                    default:
                      return true;
                  }
                })
              );
            }

            return processedGroups.some((group) => {
              return group.every((filter) => {
                const rawValue = getNestedValue(log, filter.field);
                const logValue = valueToFilterString(rawValue);
                switch (filter.operator) {
                  case 'contains':
                    return logValue.includes(filter.valueLower);
                  case 'not_contains':
                    return !logValue.includes(filter.valueLower);
                  case 'equals':
                    return logValue === filter.valueLower;
                  default:
                    return true;
                }
              });
            });
          });
        }
      }

      // Apply sorting
      if (orderByField) {
        result = [...result].sort((a, b) => {
          if (typeof a === 'string' && typeof b === 'string') {
            const comparison = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
            return orderByDirection === 'asc' ? comparison : -comparison;
          }

          if (typeof a === 'string') return orderByDirection === 'asc' ? -1 : 1;
          if (typeof b === 'string') return orderByDirection === 'asc' ? 1 : -1;

          const aValue = getNestedValue(a, orderByField);
          const bValue = getNestedValue(b, orderByField);

          const aStr = String(aValue || '');
          const bStr = String(bValue || '');

          const comparison = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
          return orderByDirection === 'asc' ? comparison : -comparison;
        });
      }

      set({ filteredLogs: result, isFiltering: false });
    });
  },

  getActiveSearchTerms: () => {
    const { appliedFilters, appliedSearchTerm } = get();
    const terms = appliedFilters
      .filter((f) => f.field === 'message' && f.value && f.operator === 'contains')
      .map((f) => f.value);
    if (appliedSearchTerm.trim()) {
      terms.push(appliedSearchTerm.trim());
    }
    return terms;
  }
}));
