import { useMemo } from 'react';
import { LogEntry } from '../types';

export function useLogFields(logs: LogEntry[], maxDepth: number = 2) {
  const allFields = useMemo(() => {
    const fields = new Set<string>();
    const addFields = (obj: any, prefix = '', currentDepth = 1) => {
      Object.keys(obj).forEach(key => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        fields.add(fullKey);
        // Only recurse if we haven't reached max depth
        if (currentDepth < maxDepth && typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          addFields(obj[key], fullKey, currentDepth + 1);
        }
      });
    };
    logs.forEach(log => {
      // Skip plain string logs
      if (typeof log === 'string') return;
      addFields(log);
    });
    return Array.from(fields).sort();
  }, [logs, maxDepth]);

  return allFields;
}
