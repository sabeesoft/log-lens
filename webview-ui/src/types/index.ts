export type LogEntry = string | {
  timestamp?: string;
  level?: string;
  message?: string;
  [key: string]: any;
};

export interface Filter {
  id: number;
  field: string;
  operator: 'contains' | 'not_contains' | 'equals';
  value: string;
  relation: 'AND' | 'OR';
}
