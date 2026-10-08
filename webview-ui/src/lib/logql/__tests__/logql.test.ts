import { parse, run, matches, serialize } from '../index';
import type { Query } from '../index';

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log('  ok   -', name);
  } else {
    failed++;
    console.error('  FAIL -', name);
  }
}

function parseOk(input: string): Query {
  const r = parse(input);
  if (!r.ok) {
    throw new Error(`expected parse ok for "${input}", got errors: ${JSON.stringify(r.errors)}`);
  }
  return r.query;
}

// ---------------------------------------------------------------------------
console.log('tokenizer / parser:');
{
  const q = parseOk(
    'fields @timestamp, level, service, message | filter level = "error" and service in ["payments-svc","auth-gateway"] | sort @timestamp desc | limit 20',
  );
  ok('fields parsed', JSON.stringify(q.fields) === JSON.stringify(['@timestamp', 'level', 'service', 'message']));
  ok('limit parsed', q.limit === 20);
  ok('sort parsed', q.sort.length === 1 && q.sort[0].field === '@timestamp' && q.sort[0].direction === 'desc');
  ok('filter is AND', q.filter?.kind === 'and');

  const implicit = parseOk('level = "error"');
  ok('implicit filter (no command keyword)', implicit.filter?.kind === 'comparison');

  const star = parseOk('fields *');
  ok('wildcard fields *', JSON.stringify(star.fields) === JSON.stringify(['*']));
  ok('wildcard round-trips', serialize(parseOk('fields * | sort ts desc')) === 'fields *\n| sort ts desc');

  const multiFilter = parseOk('filter a = 1 | filter b = 2');
  ok('multiple filter clauses AND-ed', multiFilter.filter?.kind === 'and');
}

console.log('parse errors (as values, with spans):');
{
  const r = parse('filter level = ');
  ok('missing value -> error', r.ok === false);
  if (!r.ok) {
    ok('error has span', typeof r.errors[0].start === 'number' && r.errors[0].end > r.errors[0].start);
  }

  const r2 = parse('limit abc');
  ok('non-numeric limit -> error', r2.ok === false);

  const r3 = parse('level = "error" extra garbage');
  ok('trailing garbage -> error', r3.ok === false);
}

// ---------------------------------------------------------------------------
console.log('evaluator — matches:');
{
  const records = [
    { level: 'error', service: 'payments-svc', status: 500, msg: 'db timeout' },
    { level: 'info', service: 'auth-gateway', status: 200, msg: 'ok' },
    { level: 'error', service: 'cart-svc', status: 503, msg: 'upstream' },
    { level: 'warn', service: 'payments-svc', status: 429, msg: 'throttled' },
  ];

  const m = (input: string, rec: unknown) => matches(parseOk(input), rec);

  ok('equals string (ci)', m('level = "ERROR"', records[0]));
  ok('not equals', m('level != "info"', records[0]));
  ok('in list', m('service in ["payments-svc","auth-gateway"]', records[1]));
  ok('in list negative', !m('service in ["payments-svc","auth-gateway"]', records[2]));
  ok('numeric >=', m('status >= 500', records[0]));
  ok('numeric >= negative', !m('status >= 500', records[1]));
  ok('and', m('level = "error" and status >= 500', records[0]));
  ok('or', m('level = "warn" or status >= 500', records[0]));
  ok('not', m('not level = "info"', records[0]));
  ok('like substring', m('msg like "timeout"', records[0]));
  ok('like regex (quoted)', m('msg like "/^db/"', records[0]));
  ok('like regex (literal)', m('msg like /^db/', records[0]));
  ok('like regex literal negative', !m('msg like /^xyz/', records[0]));
  ok('bare term full-text', m('throttled', records[3]));
  ok('missing field only != true', m('nope != "x"', records[0]) && !m('nope = "x"', records[0]));
  ok('paren grouping', m('(level = "warn" or level = "error") and service = "payments-svc"', records[3]));
}

// ---------------------------------------------------------------------------
console.log('evaluator — run (filter + sort + limit):');
{
  const records = [
    { level: 'error', service: 'payments-svc', ts: 3 },
    { level: 'info', service: 'auth-gateway', ts: 1 },
    { level: 'error', service: 'payments-svc', ts: 5 },
    { level: 'error', service: 'cart-svc', ts: 4 },
  ];
  const q = parseOk(
    'filter level = "error" and service in ["payments-svc","auth-gateway"] | sort ts desc | limit 1',
  );
  const { rows } = run(records, q);
  ok('run filters + sorts + limits', rows.length === 1 && (rows[0] as any).ts === 5);

  const q2 = parseOk('sort ts asc');
  const { rows: rows2 } = run(records, q2);
  ok('run sort asc', (rows2[0] as any).ts === 1 && (rows2[3] as any).ts === 5);
}

console.log('custom getValue (nested):');
{
  const rec = { '@message': { service: { name: 'api' } } };
  const getValue = (obj: any, path: string): unknown => {
    if (obj && typeof obj === 'object' && path in obj) return obj[path];
    return path.split('.').reduce((c: any, k) => (c == null ? undefined : c[k]), obj);
  };
  ok(
    'nested via injected getValue',
    matches(parseOk('@message.service.name = "api"'), rec, { getValue }),
  );
}

console.log('serializer round-trips:');
{
  const roundtrip = (input: string) => {
    const q1 = parseOk(input);
    const text = serialize(q1);
    const q2 = parseOk(text);
    return JSON.stringify(q1) === JSON.stringify(q2);
  };
  ok('simple comparison', roundtrip('filter level = "error"'));
  ok('full pipeline', roundtrip('fields @timestamp, level, service | filter level = "error" and status >= 500 | sort @timestamp desc | limit 20'));
  ok('in list', roundtrip('filter service in ["payments-svc","auth-gateway"]'));
  ok('and/or precedence', roundtrip('filter a = 1 or b = 2 and c = 3'));
  ok('not + parens', roundtrip('filter not (a = 1 or b = 2)'));
  ok('regex literal', roundtrip('filter msg like /timeout/'));
  ok('multi sort', roundtrip('sort a desc, b asc'));

  // Spot-check exact canonical output
  const q = parseOk('level="error"|sort ts desc');
  ok('canonical text', serialize(q) === 'filter level = "error"\n| sort ts desc');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
