/**
 * A single parse/lex error with a source span so the UI can highlight it.
 * `start` is inclusive, `end` is exclusive (character offsets into the input).
 */
export interface ParseError {
  message: string;
  start: number;
  end: number;
}

export function makeError(message: string, start: number, end: number): ParseError {
  return { message, start, end: Math.max(end, start + 1) };
}
