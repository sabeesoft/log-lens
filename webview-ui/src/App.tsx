import React, { useEffect } from "react";
import LogViewer from "./LogViewer";
import { useLogStore } from "./store/logStore";

declare global {
  interface Window {
    acquireVsCodeApi?: () => any;
  }
}

const vscode = window.acquireVsCodeApi?.();

// Test data - Mix of Pino JSON logs, plain strings, and objects with varying fields
const testLogs = [
  "Plain string log: Application started successfully",
  { level: "info", timestamp: "2024-01-18T10:23:45.123Z", message: JSON.stringify({ action: "user.login", userId: "usr_789abc", ip: "192.168.1.100", userAgent: "Mozilla/5.0" }), pid: 12345, hostname: "app-server-01", service: "auth-service", trace_id: "tr_001" },
  { level: "error", timestamp: "2024-01-18T10:24:12.456Z", message: JSON.stringify({ error: "Database connection failed", code: "CONN_TIMEOUT", database: "postgres-primary", retry: 3, timeout: 5000 }), pid: 12345, hostname: "app-server-01", service: "db-connector", trace_id: "tr_002" },
  "ERROR: Connection timeout after 30 seconds",
  { level: "warn", timestamp: "2024-01-18T10:24:45.789Z", message: JSON.stringify({ warning: "High memory usage detected", usage: "87%", threshold: "80%", process: "worker-3" }), pid: 12346, hostname: "app-server-02", service: "monitor", trace_id: "tr_003" },
  { timestamp: "2024-01-18T10:24:50.000Z", msg: "Custom log format without level field", requestId: "req_123", userId: "user_456" },
  { level: "info", timestamp: "2024-01-18T10:25:01.234Z", message: JSON.stringify({ action: "api.request", method: "POST", endpoint: "/api/v1/orders", status: 201, duration: 145 }), pid: 12345, hostname: "app-server-01", service: "api-gateway", trace_id: "tr_004" },
  "[2024-01-18 10:25:10] INFO: Cache warmed up with 1000 entries",
  { level: "debug", timestamp: "2024-01-18T10:25:15.567Z", message: JSON.stringify({ debug: "Cache lookup", key: "user:profile:123", hit: true, ttl: 3600 }), pid: 12347, hostname: "cache-server-01", service: "redis-cache", trace_id: "tr_005" },
  { time: "2024-01-18T10:25:20.000Z", severity: "info", text: "Different field names - no standard message/level", correlationId: "cor_789" },
  { level: "info", timestamp: "2024-01-18T10:25:30.890Z", message: JSON.stringify({ action: "payment.processed", orderId: "ord_456def", amount: 99.99, currency: "USD", gateway: "stripe" }), pid: 12345, hostname: "app-server-01", service: "payment-service", trace_id: "tr_006" },
  { level: "error", timestamp: "2024-01-18T10:26:05.123Z", message: JSON.stringify({ error: "Validation failed", field: "email", value: "invalid@", constraint: "format", code: "VALIDATION_ERROR" }), pid: 12345, hostname: "app-server-01", service: "validator", trace_id: "tr_007" },
  { level: "info", timestamp: "2024-01-18T10:26:22.456Z", message: JSON.stringify({ action: "email.sent", recipient: "user@example.com", template: "order-confirmation", provider: "sendgrid" }), pid: 12348, hostname: "worker-server-01", service: "email-worker", trace_id: "tr_008" },
  { level: "warn", timestamp: "2024-01-18T10:26:45.789Z", message: JSON.stringify({ warning: "Rate limit approaching", userId: "usr_789abc", current: 95, limit: 100, window: "1h" }), pid: 12345, hostname: "app-server-01", service: "rate-limiter", trace_id: "tr_009" },
  { level: "info", timestamp: "2024-01-18T10:27:10.012Z", message: JSON.stringify({ action: "file.uploaded", filename: "document.pdf", size: 2048576, bucket: "user-uploads", contentType: "application/pdf" }), pid: 12349, hostname: "storage-server-01", service: "s3-uploader", trace_id: "tr_010" },
  { level: "debug", timestamp: "2024-01-18T10:27:35.345Z", message: JSON.stringify({ debug: "Query executed", sql: "SELECT * FROM users WHERE id = $1", params: [123], duration: 12 }), pid: 12345, hostname: "app-server-01", service: "db-query", trace_id: "tr_011" },
  { level: "error", timestamp: "2024-01-18T10:28:00.678Z", message: JSON.stringify({ error: "Third-party API failed", service: "weather-api", endpoint: "/forecast", statusCode: 503, retryAfter: 60 }), pid: 12345, hostname: "app-server-01", service: "external-client", trace_id: "tr_012" },
  { level: "info", timestamp: "2024-01-18T10:28:25.901Z", message: JSON.stringify({ action: "user.logout", userId: "usr_789abc", sessionDuration: 1200, reason: "user_initiated" }), pid: 12345, hostname: "app-server-01", service: "auth-service", trace_id: "tr_013" },
  { level: "warn", timestamp: "2024-01-18T10:28:50.234Z", message: JSON.stringify({ warning: "Slow query detected", query: "complex_aggregation", duration: 5000, threshold: 3000 }), pid: 12345, hostname: "app-server-01", service: "performance-monitor", trace_id: "tr_014" },
  { level: "info", timestamp: "2024-01-18T10:29:15.567Z", message: JSON.stringify({ action: "webhook.received", source: "github", event: "push", repository: "acme/api", branch: "main" }), pid: 12350, hostname: "webhook-server-01", service: "webhook-handler", trace_id: "tr_015" },
  { level: "error", timestamp: "2024-01-18T10:29:40.890Z", message: JSON.stringify({ error: "Authentication failed", userId: "usr_invalid", reason: "invalid_token", attempts: 3 }), pid: 12345, hostname: "app-server-01", service: "auth-middleware", trace_id: "tr_016" },
  { level: "debug", timestamp: "2024-01-18T10:30:05.123Z", message: JSON.stringify({ debug: "Message published", topic: "orders.created", partition: 2, offset: 98765 }), pid: 12351, hostname: "kafka-producer-01", service: "event-bus", trace_id: "tr_017" },
  { level: "info", timestamp: "2024-01-18T10:30:30.456Z", message: JSON.stringify({ action: "backup.completed", database: "production", size: "15GB", duration: 1800, destination: "s3://backups" }), pid: 12352, hostname: "backup-server-01", service: "backup-manager", trace_id: "tr_018" },
  { level: "warn", timestamp: "2024-01-18T10:30:55.789Z", message: JSON.stringify({ warning: "Certificate expiring soon", domain: "api.example.com", expiresIn: "15 days", issuer: "Let's Encrypt" }), pid: 12353, hostname: "cert-monitor-01", service: "ssl-checker", trace_id: "tr_019" },
  { level: "info", timestamp: "2024-01-18T10:31:20.012Z", message: JSON.stringify({ action: "job.scheduled", jobId: "job_123", type: "data_sync", scheduledAt: "2024-01-18T12:00:00Z" }), pid: 12354, hostname: "scheduler-01", service: "cron-scheduler", trace_id: "tr_020" },
  { level: "error", timestamp: "2024-01-18T10:31:45.345Z", message: JSON.stringify({ error: "Disk space critical", mount: "/data", usage: "95%", available: "2GB", threshold: "90%" }), pid: 12355, hostname: "app-server-02", service: "disk-monitor", trace_id: "tr_021" },
  { level: "debug", timestamp: "2024-01-18T10:32:10.678Z", message: JSON.stringify({ debug: "WebSocket connection", clientId: "ws_abc123", ip: "10.0.1.50", protocol: "ws" }), pid: 12345, hostname: "app-server-01", service: "websocket-server", trace_id: "tr_022" },
  { level: "info", timestamp: "2024-01-18T10:32:35.901Z", message: JSON.stringify({ action: "image.processed", imageId: "img_789", operations: ["resize", "compress", "watermark"], outputSize: 512000 }), pid: 12356, hostname: "media-server-01", service: "image-processor", trace_id: "tr_023" },
  { level: "warn", timestamp: "2024-01-18T10:33:00.234Z", message: JSON.stringify({ warning: "API deprecated", endpoint: "/v1/users", deprecatedSince: "2024-01-01", removeDate: "2024-06-01", migration: "/v2/users" }), pid: 12345, hostname: "app-server-01", service: "api-gateway", trace_id: "tr_024" },
  { level: "info", timestamp: "2024-01-18T10:33:25.567Z", message: JSON.stringify({ action: "deployment.success", version: "v2.5.0", environment: "production", deployTime: 120, rollback: false }), pid: 12357, hostname: "deploy-server-01", service: "ci-cd", trace_id: "tr_025" }
];

export default function App() {
  const setLogs = useLogStore((state) => state.setLogs);

  useEffect(() => {
    // Initialize with test data
    setLogs(testLogs);

    // Listen for messages from the extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case "updateLogs":
          setLogs(message.logs);
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    // Request initial logs
    vscode?.postMessage({ type: "requestLogs" });

    return () => window.removeEventListener("message", handleMessage);
  }, [setLogs]);

  return <LogViewer />;
}
