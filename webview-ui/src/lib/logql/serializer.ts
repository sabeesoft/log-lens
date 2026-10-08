import type { Condition, Query, ScalarValue } from './types';

const BARE = /^[A-Za-z0-9_@.]+$/;

function quote(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function field(name: string): string {
  return name === '*' || BARE.test(name) ? name : quote(name);
}

function value(v: ScalarValue): string {
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  // Regex literals round-trip verbatim
  if (v.length >= 2 && v.startsWith('/') && v.endsWith('/')) return v;
  return quote(v);
}

// Precedence for parenthesising: or < and < not/leaf
function prec(c: Condition): number {
  if (c.kind === 'or') return 1;
  if (c.kind === 'and') return 2;
  return 3;
}

function wrap(child: Condition, parentPrec: number): string {
  const s = condition(child);
  return prec(child) < parentPrec ? `(${s})` : s;
}

function condition(c: Condition): string {
  switch (c.kind) {
    case 'comparison':
      return `${field(c.field)} ${c.operator} ${value(c.value)}`;
    case 'in':
      return `${field(c.field)} in [${c.values.map(value).join(', ')}]`;
    case 'term':
      return BARE.test(c.value) ? c.value : quote(c.value);
    case 'not':
      return `not ${wrap(c.operand, 3)}`;
    case 'and':
      return c.operands.map((o) => wrap(o, 2)).join(' and ');
    case 'or':
      return c.operands.map((o) => wrap(o, 1)).join(' or ');
  }
}

/**
 * Serialize a Query back into canonical LogQL text. The result re-parses to an
 * equivalent Query, so UI widgets (column headers, facets) can rewrite the query
 * by editing the AST and serializing it.
 */
export function serialize(query: Query): string {
  const commands: string[] = [];

  if (query.fields && query.fields.length > 0) {
    commands.push(`fields ${query.fields.map(field).join(', ')}`);
  }
  if (query.filter) {
    commands.push(`filter ${condition(query.filter)}`);
  }
  if (query.sort.length > 0) {
    commands.push(`sort ${query.sort.map((s) => `${field(s.field)} ${s.direction}`).join(', ')}`);
  }
  if (query.limit !== null) {
    commands.push(`limit ${query.limit}`);
  }

  return commands
    .map((cmd, i) => (i === 0 ? cmd : `| ${cmd}`))
    .join('\n');
}
