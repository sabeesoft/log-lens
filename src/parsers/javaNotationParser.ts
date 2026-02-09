/**
 * Recursive descent parser for Java-style toString() notation.
 *
 * Handles formats like:
 *   {id=uuid, flags={isdebtor=true}, history=[{cutomerid=125464}], data=[1235]}
 *
 * Grammar:
 *   Value       ::= Object | Array | Primitive
 *   Object      ::= '{' (KeyValue (',' KeyValue)*)? '}'
 *   KeyValue    ::= Key '=' Value
 *   Array       ::= '[' (Value (',' Value)*)? ']'
 *   Primitive   ::= 'null' | 'true' | 'false' | Number | String
 */

const MAX_DEPTH = 50;

export function parseJavaNotation(input: string): any {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return input;
  }

  try {
    const parser = new JavaNotationParser(trimmed);
    const result = parser.parse();

    // Ensure we consumed (nearly) all input
    parser.skipWhitespace();
    if (parser.pos < trimmed.length) {
      // Leftover characters — not a valid Java notation string
      return input;
    }

    return result;
  } catch {
    // On any parse failure, return the raw string
    return input;
  }
}

class JavaNotationParser {
  public pos: number = 0;
  private depth: number = 0;

  constructor(private input: string) {}

  parse(): any {
    return this.parseValue();
  }

  private parseValue(): any {
    this.skipWhitespace();

    if (this.pos >= this.input.length) {
      return "";
    }

    const ch = this.input[this.pos];

    if (ch === "{") {
      return this.parseObjectOrSet();
    }
    if (ch === "[") {
      return this.parseArray();
    }
    return this.parsePrimitive();
  }

  /**
   * Disambiguate between {key=value} (object) and {val1, val2} (Java Set).
   * Look ahead for '=' before the first ',' or '}' at the same brace depth.
   */
  private parseObjectOrSet(): any {
    if (this.isObjectNotation()) {
      return this.parseObject();
    }
    // Treat Java Set toString as an array
    return this.parseSetAsArray();
  }

  private isObjectNotation(): boolean {
    let depth = 0;
    let hasContent = false;
    for (let i = this.pos + 1; i < this.input.length; i++) {
      const ch = this.input[i];
      if (ch === "{" || ch === "[") {
        depth++;
        hasContent = true;
      } else if (ch === "}" || ch === "]") {
        if (depth === 0) {
          // Empty {} → treat as object
          return !hasContent;
        }
        depth--;
      } else if (depth === 0) {
        if (ch !== " ") {
          hasContent = true;
        }
        if (ch === "=") {
          return true;
        }
        if (ch === ",") {
          return false;
        }
      }
    }
    return false;
  }

  private parseObject(): Record<string, any> {
    this.guardDepth();
    this.expect("{");
    this.skipWhitespace();

    const result: Record<string, any> = {};

    if (this.pos < this.input.length && this.input[this.pos] === "}") {
      this.pos++; // empty object
      this.depth--;
      return result;
    }

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      const key = this.readKey();
      this.expect("=");
      const value = this.parseValue();
      result[key] = value;

      this.skipWhitespace();
      if (this.pos < this.input.length && this.input[this.pos] === ",") {
        this.pos++; // consume comma
        this.skipWhitespace();
      } else {
        break;
      }
    }

    this.expect("}");
    this.depth--;
    return result;
  }

  private parseSetAsArray(): any[] {
    this.guardDepth();
    this.expect("{");
    this.skipWhitespace();

    const result: any[] = [];

    if (this.pos < this.input.length && this.input[this.pos] === "}") {
      this.pos++;
      this.depth--;
      return result;
    }

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      const value = this.parseValue();
      result.push(value);

      this.skipWhitespace();
      if (this.pos < this.input.length && this.input[this.pos] === ",") {
        this.pos++;
        this.skipWhitespace();
      } else {
        break;
      }
    }

    this.expect("}");
    this.depth--;
    return result;
  }

  private parseArray(): any[] {
    this.guardDepth();
    this.expect("[");
    this.skipWhitespace();

    const result: any[] = [];

    if (this.pos < this.input.length && this.input[this.pos] === "]") {
      this.pos++; // empty array
      this.depth--;
      return result;
    }

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      const value = this.parseValue();
      result.push(value);

      this.skipWhitespace();
      if (this.pos < this.input.length && this.input[this.pos] === ",") {
        this.pos++; // consume comma
        this.skipWhitespace();
      } else {
        break;
      }
    }

    this.expect("]");
    this.depth--;
    return result;
  }

  private parsePrimitive(): any {
    const raw = this.readUntilDelimiter();
    const trimmed = raw.trim();

    if (trimmed === "null") {
      return null;
    }
    if (trimmed === "true") {
      return true;
    }
    if (trimmed === "false") {
      return false;
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed) && trimmed.length <= 16) {
      return Number(trimmed);
    }
    return trimmed;
  }

  /**
   * Read a key: everything up to '=' that isn't a structural character.
   */
  private readKey(): string {
    const start = this.pos;
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === "=" || ch === "," || ch === "{" || ch === "}" || ch === "[" || ch === "]") {
        break;
      }
      this.pos++;
    }
    const key = this.input.slice(start, this.pos).trim();
    if (key.length === 0) {
      throw new Error(`Empty key at position ${start}`);
    }
    return key;
  }

  /**
   * Read a primitive value: everything up to the next delimiter (, } ]) at depth 0.
   */
  private readUntilDelimiter(): string {
    const start = this.pos;
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === "," || ch === "}" || ch === "]") {
        break;
      }
      this.pos++;
    }
    return this.input.slice(start, this.pos);
  }

  private expect(ch: string): void {
    this.skipWhitespace();
    if (this.pos >= this.input.length || this.input[this.pos] !== ch) {
      throw new Error(
        `Expected '${ch}' at position ${this.pos}, got '${this.input[this.pos] ?? "EOF"}'`
      );
    }
    this.pos++;
  }

  skipWhitespace(): void {
    while (this.pos < this.input.length && this.input[this.pos] === " ") {
      this.pos++;
    }
  }

  private guardDepth(): void {
    this.depth++;
    if (this.depth > MAX_DEPTH) {
      throw new Error("Maximum nesting depth exceeded");
    }
  }
}
