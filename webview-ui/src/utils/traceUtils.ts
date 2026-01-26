import { LogEntry } from '../types';

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
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
};

// Auto-detect field from log entries
function detectField(logs: LogEntry[], candidates: string[]): string | null {
  for (const log of logs) {
    if (typeof log === 'string') continue;
    for (const candidate of candidates) {
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

// Get trace ID value from a log entry
export function getTraceIdValue(log: LogEntry, traceIdField: string): string | null {
  if (typeof log === 'string') return null;
  const value = getNestedValue(log, traceIdField);
  if (value !== undefined && value !== null) {
    return String(value);
  }
  return null;
}

// Get log level from log entry
function getLogLevel(log: LogEntry): string {
  if (typeof log === 'string') return '';
  const levelCandidates = ['level', 'severity', 'logLevel', 'log_level'];
  for (const candidate of levelCandidates) {
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

    const serviceName = String(getNestedValue(log, serviceNameField) || 'unknown');
    const spanId = getNestedValue(log, spanIdField);
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

    const parentSpanId = getNestedValue(log, parentSpanIdField);
    const serviceName = String(getNestedValue(log, serviceNameField) || 'unknown');

    if (parentSpanId) {
      const parentService = spanToService.get(String(parentSpanId));
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
