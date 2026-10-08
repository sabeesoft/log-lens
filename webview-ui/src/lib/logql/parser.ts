import type {
  Condition,
  ComparisonOperator,
  ParseResult,
  Query,
  ScalarValue,
  SortItem,
  Token,
} from './types';
import { makeError, type ParseError } from './errors';
import { tokenize } from './tokenizer';

const COMMAND_KEYWORDS = new Set(['fields', 'filter', 'sort', 'limit']);
const COMPARISON_OPS = new Set(['=', '!=', '<', '<=', '>', '>=']);

/** Thrown internally to unwind to the nearest recovery point (a pipe boundary). */
class ParseAbort extends Error {}

/**
 * Recursive-descent parser: tokens -> Query AST.
 * Errors are collected; after a failed command the parser recovers at the next '|'.
 */
export class Parser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly errors: ParseError[],
  ) {}

  parse(): Query {
    const query: Query = { fields: null, filter: null, sort: [], limit: null };
    const filters: Condition[] = [];

    while (!this.isAtEnd()) {
      try {
        this.parseCommand(query, filters);
      } catch (e) {
        if (!(e instanceof ParseAbort)) throw e;
        this.recoverToPipe();
      }

      if (this.check('pipe')) {
        this.advance();
      } else if (!this.isAtEnd()) {
        const tok = this.peek();
        this.errors.push(makeError('Expected "|" between commands', tok.start, tok.end));
        this.recoverToPipe();
        if (this.check('pipe')) this.advance();
      }
    }

    if (filters.length === 1) query.filter = filters[0];
    else if (filters.length > 1) query.filter = { kind: 'and', operands: filters };

    return query;
  }

  // --- commands -----------------------------------------------------------

  private parseCommand(query: Query, filters: Condition[]): void {
    const tok = this.peek();

    if (tok.type === 'keyword' && COMMAND_KEYWORDS.has(tok.value)) {
      this.advance();
      switch (tok.value) {
        case 'fields':
          query.fields = [...(query.fields ?? []), ...this.parseFieldList()];
          return;
        case 'filter':
          filters.push(this.parseOr());
          return;
        case 'sort':
          query.sort.push(...this.parseSortItems());
          return;
        case 'limit':
          query.limit = this.parseLimit();
          return;
      }
    }

    // Implicit filter: a bare expression with no leading command keyword.
    filters.push(this.parseOr());
  }

  private parseFieldList(): string[] {
    const fields = [this.parseField()];
    while (this.check('comma')) {
      this.advance();
      fields.push(this.parseField());
    }
    return fields;
  }

  private parseSortItems(): SortItem[] {
    const items = [this.parseSortItem()];
    while (this.check('comma')) {
      this.advance();
      items.push(this.parseSortItem());
    }
    return items;
  }

  private parseSortItem(): SortItem {
    const field = this.parseField();
    let direction: 'asc' | 'desc' = 'asc';
    if (this.check('keyword', 'asc') || this.check('keyword', 'desc')) {
      direction = this.advance().value as 'asc' | 'desc';
    }
    return { field, direction };
  }

  private parseLimit(): number {
    const tok = this.expect('number', 'Expected a number after "limit"');
    const n = Number(tok.value);
    if (!Number.isInteger(n) || n < 0) {
      this.fail('"limit" must be a non-negative integer', tok);
    }
    return n;
  }

  // --- boolean expression -------------------------------------------------

  private parseOr(): Condition {
    let left = this.parseAnd();
    const operands = [left];
    while (this.check('keyword', 'or')) {
      this.advance();
      operands.push(this.parseAnd());
    }
    if (operands.length === 1) return left;
    return { kind: 'or', operands };
  }

  private parseAnd(): Condition {
    const operands = [this.parseNot()];
    while (this.check('keyword', 'and')) {
      this.advance();
      operands.push(this.parseNot());
    }
    if (operands.length === 1) return operands[0];
    return { kind: 'and', operands };
  }

  private parseNot(): Condition {
    if (this.check('keyword', 'not')) {
      this.advance();
      return { kind: 'not', operand: this.parseNot() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Condition {
    if (this.check('lparen')) {
      this.advance();
      const inner = this.parseOr();
      this.expect('rparen', 'Expected ")"');
      return inner;
    }

    const tok = this.peek();
    if (tok.type !== 'ident' && tok.type !== 'string') {
      this.fail(`Unexpected ${this.describe(tok)}`, tok);
    }
    this.advance();
    const name = tok.value;

    // in [...]
    if (this.check('keyword', 'in')) {
      this.advance();
      return this.parseInList(name);
    }

    // field <op> value  /  field like value
    if (this.check('op') || this.check('keyword', 'like')) {
      const opTok = this.advance();
      const operator = (opTok.type === 'keyword' ? 'like' : opTok.value) as ComparisonOperator;
      if (opTok.type === 'op' && !COMPARISON_OPS.has(opTok.value)) {
        this.fail(`Unknown operator "${opTok.value}"`, opTok);
      }
      const value = this.parseValue();
      return { kind: 'comparison', field: name, operator, value };
    }

    // bare term → free-text search
    return { kind: 'term', value: name };
  }

  private parseInList(field: string): Condition {
    this.expect('lbracket', 'Expected "[" after "in"');
    const values: ScalarValue[] = [];
    if (!this.check('rbracket')) {
      values.push(this.parseValue());
      while (this.check('comma')) {
        this.advance();
        values.push(this.parseValue());
      }
    }
    this.expect('rbracket', 'Expected "]" to close "in" list');
    return { kind: 'in', field, values };
  }

  private parseValue(): ScalarValue {
    const tok = this.peek();
    switch (tok.type) {
      case 'string':
        this.advance();
        return tok.value;
      case 'regex':
        // Keep the slashes so the evaluator treats it as a regex pattern
        this.advance();
        return tok.value;
      case 'number':
        this.advance();
        return Number(tok.value);
      case 'bool':
        this.advance();
        return tok.value === 'true';
      case 'ident':
        // Unquoted word used as a value, e.g. level = error
        this.advance();
        return tok.value;
      default:
        this.fail(`Expected a value, got ${this.describe(tok)}`, tok);
        return ''; // unreachable (fail throws)
    }
  }

  private parseField(): string {
    const tok = this.peek();
    if (tok.type === 'ident' || tok.type === 'string') {
      this.advance();
      return tok.value;
    }
    this.fail(`Expected a field name, got ${this.describe(tok)}`, tok);
    return ''; // unreachable
  }

  // --- token helpers ------------------------------------------------------

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'eof';
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    if (!this.isAtEnd()) this.pos++;
    return tok;
  }

  private check(type: Token['type'], value?: string): boolean {
    const tok = this.peek();
    if (tok.type !== type) return false;
    return value === undefined || tok.value === value;
  }

  private expect(type: Token['type'], message: string): Token {
    if (this.check(type)) return this.advance();
    this.fail(message, this.peek());
    return this.peek(); // unreachable
  }

  private recoverToPipe(): void {
    while (!this.isAtEnd() && !this.check('pipe')) this.advance();
  }

  private fail(message: string, tok: Token): never {
    this.errors.push(makeError(message, tok.start, tok.end));
    throw new ParseAbort(message);
  }

  private describe(tok: Token): string {
    if (tok.type === 'eof') return 'end of query';
    return `"${tok.value}"`;
  }
}

export function parse(input: string): ParseResult {
  const { tokens, errors } = tokenize(input);
  const parser = new Parser(tokens, errors);
  const query = parser.parse();
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, query };
}
