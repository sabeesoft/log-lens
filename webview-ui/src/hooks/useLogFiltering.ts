import { useMemo } from 'react';
import { Filter, LogEntry } from '../types';

const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
};

export function useLogFiltering(
  logs: LogEntry[],
  appliedFilters: Filter[],
  orderByField: string,
  orderByDirection: 'asc' | 'desc'
) {
  const filteredLogs = useMemo(() => {
    let result = logs;

    // Apply filters
    if (appliedFilters.length > 0) {
      result = logs.filter(log => {
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

        return groups.some(group => {
          return group.every(filter => {
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
  }, [logs, appliedFilters, orderByField, orderByDirection]);

  const activeSearchTerms = useMemo(() => {
    return appliedFilters
      .filter(f => f.field === 'message' && f.value && f.operator === 'contains')
      .map(f => f.value);
  }, [appliedFilters]);

  return { filteredLogs, activeSearchTerms };
}
