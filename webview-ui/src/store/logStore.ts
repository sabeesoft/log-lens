import { create } from 'zustand';
import { Filter, LogEntry } from '../types';

interface LogState {
  // Data
  logs: LogEntry[];

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

  // Actions
  setLogs: (logs: LogEntry[]) => void;

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

  // Computed/derived state
  getFilteredLogs: () => LogEntry[];
  getActiveSearchTerms: () => string[];
}

const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
};

export const useLogStore = create<LogState>((set, get) => ({
  // Initial state
  logs: [],
  filters: [{ id: Date.now(), field: '', operator: 'contains', value: '', relation: 'AND' }],
  appliedFilters: [],
  orderByField: '',
  orderByDirection: 'asc',
  selectedLogIndex: null,
  visibleFields: ['all'], // Default to showing all fields
  settingsPanelOpen: false,
  searchTerm: '',

  // Actions
  setLogs: (logs) => set({ logs }),

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

  applyFilters: () =>
    set((state) => ({
      appliedFilters: [...state.filters]
    })),

  clearFilters: () =>
    set({
      filters: [{ id: Date.now(), field: '', operator: 'contains', value: '', relation: 'AND' }],
      appliedFilters: []
    }),

  // Order actions
  setOrderByField: (field) => set({ orderByField: field }),
  setOrderByDirection: (direction) => set({ orderByDirection: direction }),

  // UI actions
  selectLog: (index) => set({ selectedLogIndex: index }),

  setVisibleFields: (fields) => set({ visibleFields: fields }),

  toggleSettingsPanel: () => set((state) => ({ settingsPanelOpen: !state.settingsPanelOpen })),

  setSettingsPanelOpen: (open) => set({ settingsPanelOpen: open }),

  setSearchTerm: (term) => set({ searchTerm: term }),

  toggleFieldVisibility: (field) =>
    set((state) => {
      let visibleFields = [...state.visibleFields];

      if (field === 'all') {
        // Toggle "all" - if already has "all", remove it, otherwise set to just "all"
        if (visibleFields.includes('all')) {
          visibleFields = [];
        } else {
          visibleFields = ['all'];
        }
      } else {
        // Remove "all" if present when selecting specific field
        const allIndex = visibleFields.indexOf('all');
        if (allIndex > -1) {
          visibleFields.splice(allIndex, 1);
        }

        const index = visibleFields.indexOf(field);
        if (index > -1) {
          // Remove if already visible (but keep at least one field)
          if (visibleFields.length > 1 || visibleFields.includes('all')) {
            visibleFields.splice(index, 1);
          }
        } else {
          // Add if not visible
          visibleFields.push(field);
        }
      }

      return { visibleFields };
    }),

  // Computed state
  getFilteredLogs: () => {
    const { logs, appliedFilters, orderByField, orderByDirection, searchTerm } = get();
    let result = logs;

    // Apply quick search term first (searches across all text content)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter((log) => {
        if (typeof log === 'string') {
          return log.toLowerCase().includes(searchLower);
        }
        // For objects, search in the JSON stringified version
        return JSON.stringify(log).toLowerCase().includes(searchLower);
      });
    }

    // Apply filters
    if (appliedFilters.length > 0) {
      result = result.filter((log) => {
        // For string logs, match against the entire string
        if (typeof log === 'string') {
          return appliedFilters.some((filter) => {
            if (!filter.value) return true;
            const logValue = log.toLowerCase();
            const filterValue = filter.value.toLowerCase();
            switch (filter.operator) {
              case 'contains':
                return logValue.includes(filterValue);
              case 'not_contains':
                return !logValue.includes(filterValue);
              case 'equals':
                return logValue === filterValue;
              default:
                return true;
            }
          });
        }

        // For object logs, use field-based filtering
        const groups: Filter[][] = [];
        let currentGroup: Filter[] = [];

        appliedFilters.forEach((filter, index) => {
          if (!filter.field || !filter.value) return;
          currentGroup.push(filter);
          if (index === appliedFilters.length - 1 || appliedFilters[index + 1]?.relation === 'OR') {
            if (currentGroup.length > 0) {
              groups.push([...currentGroup]);
              currentGroup = [];
            }
          }
        });

        return groups.some((group) => {
          return group.every((filter) => {
            const logValue = String(getNestedValue(log, filter.field) || '').toLowerCase();
            const filterValue = filter.value.toLowerCase();
            switch (filter.operator) {
              case 'contains':
                return logValue.includes(filterValue);
              case 'not_contains':
                return !logValue.includes(filterValue);
              case 'equals':
                return logValue === filterValue;
              default:
                return true;
            }
          });
        });
      });
    }

    // Apply sorting
    if (orderByField) {
      result = [...result].sort((a, b) => {
        // Handle string logs - sort alphabetically
        if (typeof a === 'string' && typeof b === 'string') {
          const comparison = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
          return orderByDirection === 'asc' ? comparison : -comparison;
        }

        // If one is string and other is object, put strings first
        if (typeof a === 'string') return orderByDirection === 'asc' ? -1 : 1;
        if (typeof b === 'string') return orderByDirection === 'asc' ? 1 : -1;

        // Both are objects
        const aValue = getNestedValue(a, orderByField);
        const bValue = getNestedValue(b, orderByField);

        const aStr = String(aValue || '');
        const bStr = String(bValue || '');

        const comparison = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
        return orderByDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  },

  getActiveSearchTerms: () => {
    const { appliedFilters, searchTerm } = get();
    const terms = appliedFilters
      .filter((f) => f.field === 'message' && f.value && f.operator === 'contains')
      .map((f) => f.value);
    // Include the quick search term for highlighting
    if (searchTerm.trim()) {
      terms.push(searchTerm.trim());
    }
    return terms;
  }
}));
