import { useMemo } from 'react';
import { LogEntry } from '../types';

export function useLogFields(logs: LogEntry[]) {
  const allFields = useMemo(() => {
    const fields = new Set<string>();
    const addFields = (obj: any, prefix = '') => {
      Object.keys(obj).forEach(key => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        fields.add(fullKey);
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          addFields(obj[key], fullKey);
        }
      });
    };
    logs.forEach(log => {
      // Skip plain string logs
      if (typeof log === 'string') return;
      addFields(log);
    });
    return Array.from(fields).sort();
  }, [logs]);

  return allFields;
}
