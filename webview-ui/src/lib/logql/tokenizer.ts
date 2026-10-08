import type { Token, TokenType } from './types';
import { makeError, type ParseError } from './errors';

const KEYWORDS = new Set([
  'fields',
  'filter',
  'sort',
  'limit',
  'and',
  'or',
  'not',
  'in',
  'like',
  'asc',
  'desc',
]);

const isDigit = (ch: string) => ch >= '0' && ch <= '9';
const isIdentStart = (ch: string) =>
  (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '@';
const isIdentPart = (ch: string) =>
  isIdentStart(ch) || isDigit(ch) || ch === '.' || ch === '-';

export interface TokenizeResult {
  tokens: Token[];
  errors: ParseError[];
}

/**
 * Converts a query string into a flat list of tokens.
 * Lexing errors are collected (not thrown) so the parser can report all at once.
 */
export class Tokenizer {
  private pos = 0;
  private readonly tokens: Token[] = [];
  private readonly errors: ParseError[] = [];

  constructor(private readonly input: string) {}

  tokenize(): TokenizeResult {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];

      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        this.pos++;
        continue;
      }

      if (this.readSingleChar(ch)) continue;
      if (ch === '=' || ch === '!' || ch === '<' || ch === '>') {
        this.readOperator();
        continue;
      }
      if (ch === '"' || ch === "'") {
        this.readString(ch);
        continue;
      }
      if (ch === '/') {
        this.readRegex();
        continue;
      }
      if (isDigit(ch) || (ch === '-' && isDigit(this.input[this.pos + 1] ?? ''))) {
        this.readNumber();
        continue;
      }
      if (isIdentStart(ch)) {
        this.readIdentOrKeyword();
        continue;
      }

      // Unknown character
      this.errors.push(makeError(`Unexpected character '${ch}'`, this.pos, this.pos + 1));
      this.pos++;
    }

    this.push('eof', '', this.pos, this.pos);
    return { tokens: this.tokens, errors: this.errors };
  }

  private readSingleChar(ch: string): boolean {
    const map: Record<string, TokenType> = {
      '|': 'pipe',
      '(': 'lparen',
      ')': 'rparen',
      '[': 'lbracket',
      ']': 'rbracket',
      ',': 'comma',
    };
    const type = map[ch];
    if (!type) return false;
    this.push(type, ch, this.pos, this.pos + 1);
    this.pos++;
    return true;
  }

  private readOperator(): void {
    const start = this.pos;
    const ch = this.input[this.pos];
    const next = this.input[this.pos + 1];

    if (ch === '=') {
      this.pos++;
      this.push('op', '=', start, this.pos);
      return;
    }
    if (ch === '!' && next === '=') {
      this.pos += 2;
      this.push('op', '!=', start, this.pos);
      return;
    }
    if (ch === '<' || ch === '>') {
      if (next === '=') {
        this.pos += 2;
        this.push('op', ch + '=', start, this.pos);
      } else {
        this.pos++;
        this.push('op', ch, start, this.pos);
      }
      return;
    }

    // Lone '!'
    this.errors.push(makeError(`Expected '=' after '!'`, start, start + 1));
    this.pos++;
  }

  private readString(quote: string): void {
    const start = this.pos;
    this.pos++; // opening quote
    let value = '';
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === '\\') {
        const esc = this.input[this.pos + 1];
        value += esc ?? '';
        this.pos += 2;
        continue;
      }
      if (ch === quote) {
        this.pos++; // closing quote
        this.push('string', value, start, this.pos);
        return;
      }
      value += ch;
      this.pos++;
    }
    this.errors.push(makeError('Unterminated string', start, this.pos));
    this.push('string', value, start, this.pos);
  }

  private readRegex(): void {
    const start = this.pos;
    this.pos++; // opening slash
    let value = '/';
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === '\\') {
        value += ch + (this.input[this.pos + 1] ?? '');
        this.pos += 2;
        continue;
      }
      if (ch === '/') {
        value += '/';
        this.pos++;
        this.push('regex', value, start, this.pos);
        return;
      }
      value += ch;
      this.pos++;
    }
    this.errors.push(makeError('Unterminated regex', start, this.pos));
    this.push('regex', value, start, this.pos);
  }

  private readNumber(): void {
    const start = this.pos;
    if (this.input[this.pos] === '-') this.pos++;
    while (this.pos < this.input.length && isDigit(this.input[this.pos])) this.pos++;
    if (this.input[this.pos] === '.') {
      this.pos++;
      while (this.pos < this.input.length && isDigit(this.input[this.pos])) this.pos++;
    }
    this.push('number', this.input.slice(start, this.pos), start, this.pos);
  }

  private readIdentOrKeyword(): void {
    const start = this.pos;
    while (this.pos < this.input.length && isIdentPart(this.input[this.pos])) this.pos++;
    const raw = this.input.slice(start, this.pos);
    const lower = raw.toLowerCase();

    if (lower === 'true' || lower === 'false') {
      this.push('bool', lower, start, this.pos);
    } else if (KEYWORDS.has(lower)) {
      this.push('keyword', lower, start, this.pos);
    } else {
      this.push('ident', raw, start, this.pos);
    }
  }

  private push(type: TokenType, value: string, start: number, end: number): void {
    this.tokens.push({ type, value, start, end });
  }
}

export function tokenize(input: string): TokenizeResult {
  return new Tokenizer(input).tokenize();
}
