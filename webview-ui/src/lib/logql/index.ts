/**
 * LogQL — a tiny CloudWatch Logs Insights-style query language.
 *
 * Self-contained and framework-agnostic: no imports from the host app.
 * This barrel is the ONLY entry point the app should import from, so the
 * folder can later be lifted into a standalone package with no code changes
 * beyond the import path.
 */
export { parse } from './parser';
export { serialize } from './serializer';
export { matches, comparator, run } from './evaluator';
export { tokenize, Tokenizer } from './tokenizer';
export type { TokenizeResult } from './tokenizer';

export type {
  Query,
  Condition,
  ComparisonCondition,
  InCondition,
  TermCondition,
  NotCondition,
  AndCondition,
  OrCondition,
  ComparisonOperator,
  ScalarValue,
  SortItem,
  ParseResult,
  ParseError,
  EvalOptions,
  Token,
  TokenType,
} from './types';
