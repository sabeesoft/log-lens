import type { ParseError } from './errors';

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export type TokenType =
  | 'pipe' // |
  | 'lparen' // (
  | 'rparen' // )
  | 'lbracket' // [
  | 'rbracket' // ]
  | 'comma' // ,
  | 'op' // = != < <= > >=
  | 'keyword' // fields filter sort limit and or not in like asc desc
  | 'ident' // field name, bare word, @field, dotted.path
  | 'string' // "quoted" or 'quoted'
  | 'regex' // /pattern/  (value includes the slashes)
  | 'number' // 123 or 1.5 or -4
  | 'bool' // true / false
  | 'eof';

export interface Token {
  type: TokenType;
  /** Raw lexeme (for ident/string this is the decoded value). */
  value: string;
  start: number;
  end: number;
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export type ComparisonOperator = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'like';

export type ScalarValue = string | number | boolean;

/** field <op> value */
export interface ComparisonCondition {
  kind: 'comparison';
  field: string;
  operator: ComparisonOperator;
  value: ScalarValue;
}

/** field in [v1, v2, ...] */
export interface InCondition {
  kind: 'in';
  field: string;
  values: ScalarValue[];
}

/** bare free-text term: substring match across the whole record */
export interface TermCondition {
  kind: 'term';
  value: string;
}

export interface NotCondition {
  kind: 'not';
  operand: Condition;
}

export interface AndCondition {
  kind: 'and';
  operands: Condition[];
}

export interface OrCondition {
  kind: 'or';
  operands: Condition[];
}

export type Condition =
  | ComparisonCondition
  | InCondition
  | TermCondition
  | NotCondition
  | AndCondition
  | OrCondition;

export interface SortItem {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * A parsed query. Every clause is optional — an empty query matches everything
 * and imposes no ordering/limit.
 */
export interface Query {
  /** Columns requested via `fields`; null = no projection (show defaults). */
  fields: string[] | null;
  /** Combined `filter` clauses (AND-ed together); null = match all. */
  filter: Condition | null;
  /** `sort` items in priority order. */
  sort: SortItem[];
  /** `limit` N; null = no limit. */
  limit: number | null;
}

// ---------------------------------------------------------------------------
// Public results / options
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; query: Query }
  | { ok: false; errors: ParseError[] };

export interface EvalOptions {
  /**
   * Resolve a field path against a record. Defaults to a dot-path accessor.
   * The host app injects its own (e.g. one that also handles literal dotted keys).
   */
  getValue?: (record: unknown, path: string) => unknown;
  /** Case-insensitive string comparison/`like`/`term`. Default: true. */
  caseInsensitive?: boolean;
}

export type { ParseError };
