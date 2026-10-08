import type {
  Condition,
  ComparisonCondition,
  EvalOptions,
  InCondition,
  Query,
  ScalarValue,
  SortItem,
} from './types';

// Default dot-path accessor. The host app may inject a smarter one
// (e.g. one that also resolves literal dotted keys).
const defaultGetValue = (record: unknown, path: string): unknown =>
  path.split('.').reduce<any>((curr, key) => (curr == null ? undefined : curr[key]), record);

interface ResolvedOptions {
  getValue: (record: unknown, path: string) => unknown;
  caseInsensitive: boolean;
}

function resolve(opts?: EvalOptions): ResolvedOptions {
  return {
    getValue: opts?.getValue ?? defaultGetValue,
    caseInsensitive: opts?.caseInsensitive ?? true,
  };
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export function matches(query: Query, record: unknown, opts?: EvalOptions): boolean {
  if (!query.filter) return true;
  return evalCondition(query.filter, record, resolve(opts));
}

function evalCondition(cond: Condition, record: unknown, opts: ResolvedOptions): boolean {
  switch (cond.kind) {
    case 'and':
      return cond.operands.every((c) => evalCondition(c, record, opts));
    case 'or':
      return cond.operands.some((c) => evalCondition(c, record, opts));
    case 'not':
      return !evalCondition(cond.operand, record, opts);
    case 'term':
      return evalTerm(cond.value, record, opts);
    case 'comparison':
      return evalComparison(cond, record, opts);
    case 'in':
      return evalIn(cond, record, opts);
  }
}

function evalTerm(term: string, record: unknown, opts: ResolvedOptions): boolean {
  const haystack = stringifyRecord(record);
  const needle = term;
  if (opts.caseInsensitive) {
    return haystack.toLowerCase().includes(needle.toLowerCase());
  }
  return haystack.includes(needle);
}

function evalComparison(
  cond: ComparisonCondition,
  record: unknown,
  opts: ResolvedOptions,
): boolean {
  const actual = opts.getValue(record, cond.field);

  if (cond.operator === 'like') {
    return like(actual, String(cond.value), opts.caseInsensitive);
  }

  const cmp = compareValues(actual, cond.value, opts.caseInsensitive);
  if (cmp === null) {
    // Incomparable (e.g. field missing) — only '!=' can be true.
    return cond.operator === '!=';
  }
  switch (cond.operator) {
    case '=':
      return cmp === 0;
    case '!=':
      return cmp !== 0;
    case '<':
      return cmp < 0;
    case '<=':
      return cmp <= 0;
    case '>':
      return cmp > 0;
    case '>=':
      return cmp >= 0;
  }
}

function evalIn(cond: InCondition, record: unknown, opts: ResolvedOptions): boolean {
  const actual = opts.getValue(record, cond.field);
  return cond.values.some((v) => compareValues(actual, v, opts.caseInsensitive) === 0);
}

// ---------------------------------------------------------------------------
// Comparison primitives
// ---------------------------------------------------------------------------

/**
 * Three-way compare of a record value against a query scalar.
 * Returns -1 / 0 / 1, or null when incomparable (missing/undefined actual).
 */
function compareValues(
  actual: unknown,
  expected: ScalarValue,
  caseInsensitive: boolean,
): number | null {
  if (actual === undefined || actual === null) return null;

  if (typeof expected === 'boolean') {
    const a = toBool(actual);
    if (a === null) return null;
    return a === expected ? 0 : a ? 1 : -1;
  }

  if (typeof expected === 'number') {
    const a = Number(actual);
    if (!Number.isFinite(a)) return null;
    return a < expected ? -1 : a > expected ? 1 : 0;
  }

  // expected is a string — but if both look numeric, compare numerically
  const aNum = Number(actual);
  const eNum = Number(expected);
  if (
    typeof actual !== 'boolean' &&
    actual !== '' &&
    expected !== '' &&
    Number.isFinite(aNum) &&
    Number.isFinite(eNum)
  ) {
    return aNum < eNum ? -1 : aNum > eNum ? 1 : 0;
  }

  let a = String(actual);
  let e = String(expected);
  if (caseInsensitive) {
    a = a.toLowerCase();
    e = e.toLowerCase();
  }
  return a < e ? -1 : a > e ? 1 : 0;
}

function toBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

function like(actual: unknown, pattern: string, caseInsensitive: boolean): boolean {
  if (actual === undefined || actual === null) return false;
  const text = String(actual);

  // /regex/ form
  if (pattern.length >= 2 && pattern.startsWith('/') && pattern.endsWith('/')) {
    try {
      return new RegExp(pattern.slice(1, -1), caseInsensitive ? 'i' : '').test(text);
    } catch {
      return false;
    }
  }

  if (caseInsensitive) {
    return text.toLowerCase().includes(pattern.toLowerCase());
  }
  return text.includes(pattern);
}

function stringifyRecord(record: unknown): string {
  if (typeof record === 'string') return record;
  try {
    return JSON.stringify(record) ?? String(record);
  } catch {
    return String(record);
  }
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export function comparator(
  query: Query,
  opts?: EvalOptions,
): ((a: unknown, b: unknown) => number) | null {
  if (query.sort.length === 0) return null;
  const resolved = resolve(opts);
  const items = query.sort;

  return (a: unknown, b: unknown): number => {
    for (const item of items) {
      const diff = compareForSort(a, b, item, resolved);
      if (diff !== 0) return diff;
    }
    return 0;
  };
}

function compareForSort(
  a: unknown,
  b: unknown,
  item: SortItem,
  opts: ResolvedOptions,
): number {
  const av = opts.getValue(a, item.field);
  const bv = opts.getValue(b, item.field);
  const dir = item.direction === 'desc' ? -1 : 1;

  const aMissing = av === undefined || av === null;
  const bMissing = bv === undefined || bv === null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1; // missing values sort last regardless of direction
  if (bMissing) return -1;

  const aNum = Number(av);
  const bNum = Number(bv);
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
    return (aNum < bNum ? -1 : aNum > bNum ? 1 : 0) * dir;
  }

  const cmp = String(av).localeCompare(String(bv), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  return cmp * dir;
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

export function run<T>(
  records: T[],
  query: Query,
  opts?: EvalOptions,
): { rows: T[]; fields: string[] | null } {
  let rows = query.filter ? records.filter((r) => matches(query, r, opts)) : [...records];

  const cmp = comparator(query, opts);
  if (cmp) rows = [...rows].sort(cmp);

  if (query.limit !== null) rows = rows.slice(0, query.limit);

  return { rows, fields: query.fields };
}
