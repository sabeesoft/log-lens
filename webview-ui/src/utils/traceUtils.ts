import { LogEntry } from '../types';

// Common container prefixes where trace fields might be nested (e.g., AWS CloudWatch uses @message)
export const CONTAINER_PREFIXES = ['@message', 'message', 'data', 'body', 'payload', 'log', 'record'];

// Field name candidates for auto-detection
export const TRACE_ID_CANDIDATES = ['traceId', 'trace_id', 'traceID', 'trace-id', 'x-trace-id', 'requestId', 'request_id', 'correlationId', 'correlation_id'];
export const SPAN_ID_CANDIDATES = ['spanId', 'span_id', 'spanID', 'span-id'];
export const PARENT_SPAN_CANDIDATES = ['parentSpanId', 'parent_span_id', 'parentId', 'parent_id', 'parentSpanID'];
export const SERVICE_NAME_CANDIDATES = ['serviceName', 'service', 'service.name', 'service_name', 'app', 'application'];

// Types for service graph
export interface ServiceNode {
  id: string;
  label: string;
  logCount: number;
  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface ServiceEdge {
  id: string;
  source: string;
  target: string;
  requestCount: number;
}

export interface TraceGraph {
  nodes: ServiceNode[];
  edges: ServiceEdge[];
}

export interface TraceConfig {
  traceIdField: string;
  spanIdField: string;
  parentSpanIdField: string;
  serviceNameField: string;
}

// Helper to get nested value from object
// Handles both literal keys with dots (e.g., "service.name" as a key) and nested paths
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || typeof obj !== 'object') return undefined;

  // First, try as a literal key at top level (e.g., obj["service.name"])
  if (path in obj) {
    return obj[path];
  }

  // Try different split points to handle mixed cases
  // e.g., for "@message.service.name", try:
  //   - obj["@message"]["service.name"] (literal key inside container)
  //   - obj["@message"]["service"]["name"] (fully nested)
  const parts = path.split('.');

  for (let i = 1; i < parts.length; i++) {
    // Try accessing first i parts as nested, then rest as literal key
    const nestedPath = parts.slice(0, i);
    const literalKey = parts.slice(i).join('.');

    let current: any = obj;
    let valid = true;

    // Navigate through nested path
    for (const part of nestedPath) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        valid = false;
        break;
      }
    }

    // Try literal key at this level
    if (valid && current && typeof current === 'object' && literalKey in current) {
      return current[literalKey];
    }
  }

  // Finally, try as fully nested path (e.g., obj["@message"]["service"]["name"])
  return parts.reduce((curr, key) => {
    if (curr && typeof curr === 'object' && key in curr) {
      return curr[key];
    }
    return undefined;
  }, obj);
};

// Extract string value, handling objects with 'name' property
const extractStringValue = (value: any): string | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  // If it's already a string, return it
  if (typeof value === 'string') {
    return value;
  }

  // If it's an object with a 'name' property, extract it
  if (typeof value === 'object' && value !== null) {
    if ('name' in value && typeof value.name === 'string') {
      return value.name;
    }
    // Don't return [Object object]
    return null;
  }

  // For other primitives, convert to string
  return String(value);
};

// Build all possible field paths including nested container paths
function buildFieldCandidates(baseCandidates: string[]): string[] {
  const allCandidates: string[] = [...baseCandidates];

  // Add prefixed versions for each container
  for (const prefix of CONTAINER_PREFIXES) {
    for (const candidate of baseCandidates) {
      allCandidates.push(`${prefix}.${candidate}`);
    }
  }

  return allCandidates;
}

// Auto-detect field from log entries
function detectField(logs: LogEntry[], candidates: string[]): string | null {
  // Build all candidates including nested paths
  const allCandidates = buildFieldCandidates(candidates);

  for (const log of logs) {
    if (typeof log === 'string') continue;
    for (const candidate of allCandidates) {
      const value = getNestedValue(log, candidate);
      if (value !== undefined && value !== null && value !== '') {
        return candidate;
      }
    }
  }
  return null;
}

export function detectTraceIdField(logs: LogEntry[]): string | null {
  return detectField(logs, TRACE_ID_CANDIDATES);
}

export function detectSpanIdField(logs: LogEntry[]): string | null {
  return detectField(logs, SPAN_ID_CANDIDATES);
}

export function detectParentSpanIdField(logs: LogEntry[]): string | null {
  return detectField(logs, PARENT_SPAN_CANDIDATES);
}

export function detectServiceNameField(logs: LogEntry[]): string | null {
  return detectField(logs, SERVICE_NAME_CANDIDATES);
}

// Get trace ID value from a log entry (with fallback to all candidates)
export function getTraceIdValue(log: LogEntry, traceIdField: string): string | null {
  if (typeof log === 'string') return null;

  // First try the provided field
  const value = getNestedValue(log, traceIdField);
  if (value !== undefined && value !== null && value !== '') {
    return String(value);
  }

  // Fallback: try all candidates for this specific log
  const allCandidates = buildFieldCandidates(TRACE_ID_CANDIDATES);
  for (const candidate of allCandidates) {
    const fallbackValue = getNestedValue(log, candidate);
    if (fallbackValue !== undefined && fallbackValue !== null && fallbackValue !== '') {
      return String(fallbackValue);
    }
  }

  return null;
}

// Get service name value from a log entry (with fallback to all candidates)
export function getServiceValue(log: LogEntry, serviceField: string): string | null {
  if (typeof log === 'string') return null;

  // First try the provided field
  const value = getNestedValue(log, serviceField);
  const extracted = extractStringValue(value);
  if (extracted) {
    return extracted;
  }

  // Fallback: try all candidates for this specific log
  const allCandidates = buildFieldCandidates(SERVICE_NAME_CANDIDATES);
  for (const candidate of allCandidates) {
    const fallbackValue = getNestedValue(log, candidate);
    const fallbackExtracted = extractStringValue(fallbackValue);
    if (fallbackExtracted) {
      return fallbackExtracted;
    }
  }

  return null;
}

// Get span ID value from a log entry (with fallback to all candidates)
function getSpanIdValue(log: LogEntry, spanIdField: string): string | null {
  if (typeof log === 'string') return null;

  // First try the provided field
  const value = getNestedValue(log, spanIdField);
  if (value !== undefined && value !== null && value !== '') {
    return String(value);
  }

  // Fallback: try all candidates for this specific log
  const allCandidates = buildFieldCandidates(SPAN_ID_CANDIDATES);
  for (const candidate of allCandidates) {
    const fallbackValue = getNestedValue(log, candidate);
    if (fallbackValue !== undefined && fallbackValue !== null && fallbackValue !== '') {
      return String(fallbackValue);
    }
  }

  return null;
}

// Get parent span ID value from a log entry (with fallback to all candidates)
function getParentSpanIdValue(log: LogEntry, parentSpanIdField: string): string | null {
  if (typeof log === 'string') return null;

  // First try the provided field
  const value = getNestedValue(log, parentSpanIdField);
  if (value !== undefined && value !== null && value !== '') {
    return String(value);
  }

  // Fallback: try all candidates for this specific log
  const allCandidates = buildFieldCandidates(PARENT_SPAN_CANDIDATES);
  for (const candidate of allCandidates) {
    const fallbackValue = getNestedValue(log, candidate);
    if (fallbackValue !== undefined && fallbackValue !== null && fallbackValue !== '') {
      return String(fallbackValue);
    }
  }

  return null;
}

// Get log level from log entry
function getLogLevel(log: LogEntry): string {
  if (typeof log === 'string') return '';
  const levelCandidates = ['level', 'severity', 'logLevel', 'log_level'];
  const allLevelCandidates = buildFieldCandidates(levelCandidates);

  for (const candidate of allLevelCandidates) {
    const value = getNestedValue(log, candidate);
    if (value !== undefined && value !== null) {
      return String(value).toLowerCase();
    }
  }
  return '';
}

// Build service graph from trace logs
export function buildServiceGraph(logs: LogEntry[], config: TraceConfig): TraceGraph {
  const services = new Map<string, ServiceNode>();
  const spanToService = new Map<string, string>();
  const edgeCounts = new Map<string, number>();

  const { serviceNameField, spanIdField, parentSpanIdField } = config;

  // First pass: collect all services and map spans to services
  for (const log of logs) {
    if (typeof log === 'string') continue;

    const serviceName = getServiceValue(log, serviceNameField) || 'unknown';
    const spanId = getSpanIdValue(log, spanIdField);
    const level = getLogLevel(log);

    if (spanId) {
      spanToService.set(String(spanId), serviceName);
    }

    if (!services.has(serviceName)) {
      services.set(serviceName, {
        id: serviceName,
        label: serviceName,
        logCount: 0,
        hasErrors: false,
        hasWarnings: false
      });
    }

    const node = services.get(serviceName)!;
    node.logCount++;
    if (level === 'error' || level === 'fatal' || level === 'err') {
      node.hasErrors = true;
    }
    if (level === 'warn' || level === 'warning') {
      node.hasWarnings = true;
    }
  }

  // Second pass: build edges from parent-child relationships
  for (const log of logs) {
    if (typeof log === 'string') continue;

    const parentSpanId = getParentSpanIdValue(log, parentSpanIdField);
    const serviceName = getServiceValue(log, serviceNameField) || 'unknown';

    if (parentSpanId) {
      const parentService = spanToService.get(parentSpanId);
      if (parentService && parentService !== serviceName) {
        const edgeKey = `${parentService}->${serviceName}`;
        edgeCounts.set(edgeKey, (edgeCounts.get(edgeKey) || 0) + 1);
      }
    }
  }

  // Convert edge counts to edges
  const edges: ServiceEdge[] = [];
  for (const [key, count] of edgeCounts) {
    const [source, target] = key.split('->');
    edges.push({
      id: key,
      source,
      target,
      requestCount: count
    });
  }

  return {
    nodes: Array.from(services.values()),
    edges
  };
}

// Auto-detect trace configuration from logs
export function detectTraceConfig(logs: LogEntry[]): TraceConfig {
  return {
    traceIdField: detectTraceIdField(logs) || 'trace_id',
    spanIdField: detectSpanIdField(logs) || 'span_id',
    parentSpanIdField: detectParentSpanIdField(logs) || 'parent_span_id',
    serviceNameField: detectServiceNameField(logs) || 'service'
  };
}
