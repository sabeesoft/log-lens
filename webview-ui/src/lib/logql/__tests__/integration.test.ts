// Integration-style check: mimic the store's data path (run + injected getValue)
// against realistic mixed logs (objects + plain strings), like the app's samples.
import { parse, run } from '../index';
import type { EvalOptions } from '../index';

// Mirror of the store's getNestedValue (literal dotted key + nested fallback)
const getValue: NonNullable<EvalOptions['getValue']> = (obj: any, path: string) => {
  if (!obj || typeof obj !== 'object') return undefined;
  if (path in obj) return obj[path];
  const parts = path.split('.');
  for (let i = 1; i < parts.length; i++) {
    let current: any = obj;
    let valid = true;
    for (const part of parts.slice(0, i)) {
      if (current && typeof current === 'object' && part in current) current = current[part];
      else { valid = false; break; }
    }
    const literalKey = parts.slice(i).join('.');
    if (valid && current && typeof current === 'object' && literalKey in current) return current[literalKey];
  }
  return parts.reduce((c: any, k) => (c == null ? undefined : c[k]), obj);
};

const logs: unknown[] = [
  'Application started successfully on port 3000', // plain string log
  { '@timestamp': '2026-02-01T10:00:05Z', level: 'error', service: 'payments-svc', status: 500, latency: 820, msg: 'db timeout' },
  { '@timestamp': '2026-02-01T10:00:01Z', level: 'info', service: 'auth-gateway', status: 200, latency: 40, msg: 'login ok' },
  { '@timestamp': '2026-02-01T10:00:09Z', level: 'error', service: 'payments-svc', status: 503, latency: 1200, msg: 'upstream' },
  { '@timestamp': '2026-02-01T10:00:03Z', level: 'warn', service: 'cart-svc', status: 429, latency: 95, msg: 'throttled' },
  { '@timestamp': '2026-02-01T10:00:07Z', level: 'error', service: 'auth-gateway', status: 401, latency: 30, msg: 'bad token' },
  { '@timestamp': '2026-02-01T10:00:02Z', nested: { service: { name: 'payments-svc' } }, level: 'error', status: 500 },
];

let passed = 0, failed = 0;
const ok = (n: string, c: boolean) => { c ? (passed++, console.log('  ok   -', n)) : (failed++, console.error('  FAIL -', n)); };
const q = (s: string) => { const r = parse(s); if (!r.ok) throw new Error(s + ' -> ' + JSON.stringify(r.errors)); return r.query; };

console.log('full pipeline on mixed logs:');
{
  const query = q('fields @timestamp, level, service | filter level = "error" and service in ["payments-svc","auth-gateway"] | sort @timestamp desc | limit 10');
  const { rows, fields } = run(logs, query, { getValue });
  ok('fields projected', JSON.stringify(fields) === JSON.stringify(['@timestamp', 'level', 'service']));
  ok('error+in filtered (3 matches)', rows.length === 3);
  ok('sorted desc by @timestamp', (rows[0] as any)['@timestamp'] === '2026-02-01T10:00:09Z');
  ok('string log excluded by field filter', !rows.includes(logs[0] as any));
}

console.log('numeric comparison + limit:');
{
  const { rows } = run(logs, q('filter latency > 500 | sort latency desc | limit 1'), { getValue });
  ok('latency>500 top is 1200', rows.length === 1 && (rows[0] as any).latency === 1200);
}

console.log('nested field via injected getValue:');
{
  const { rows } = run(logs, q('filter nested.service.name = "payments-svc"'), { getValue });
  ok('nested path matched 1', rows.length === 1 && (rows[0] as any).status === 500);
}

console.log('bare term across whole record (incl. string logs):');
{
  const { rows } = run(logs, q('port'), { getValue });
  ok('free-text "port" hits the string log', rows.includes(logs[0] as any));
}

console.log('empty-ish / no filter keeps all, no sort:');
{
  const { rows } = run(logs, q('limit 3'), { getValue });
  ok('limit only keeps first 3 in original order', rows.length === 3 && rows[0] === logs[0]);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
