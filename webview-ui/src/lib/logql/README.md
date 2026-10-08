# LogQL

A tiny, dependency-free query language in the spirit of **CloudWatch Logs
Insights**. Parses a query string into an AST and evaluates it against plain
JavaScript records.

It knows nothing about the host application (no React, no store, no log types),
so it can be extracted into its own package by moving this folder out and
adding a `package.json`. Import everything from the barrel (`index.ts`) only.

## Syntax

Commands are chained with `|`:

```
fields @timestamp, level, service, message
| filter level = "error" and service in ["payments-svc", "auth-gateway"]
| sort @timestamp desc
| limit 20
```

A segment with no leading command keyword is treated as an implicit `filter`,
so this also works:

```
level = "error" and status >= 500 | sort @timestamp desc
```

### Grammar (EBNF)

```
query      ::= command ('|' command)*
command    ::= 'fields' fieldList
             | 'filter' orExpr
             | 'sort'   sortItem (',' sortItem)*
             | 'limit'  INT
             | orExpr                      // implicit filter
orExpr     ::= andExpr ('or'  andExpr)*
andExpr    ::= notExpr ('and' notExpr)*
notExpr    ::= 'not'? primary
primary    ::= '(' orExpr ')' | comparison | bareTerm
comparison ::= field op value | field 'in' '[' value (',' value)* ']'
op         ::= '=' | '!=' | '<' | '<=' | '>' | '>=' | 'like'
value      ::= STRING | NUMBER | BOOL | IDENT
bareTerm   ::= STRING | IDENT              // free-text substring over the record
sortItem   ::= field ('asc' | 'desc')?
field      ::= IDENT | '@'IDENT | dotted.path | "quoted"
```

Keywords (`fields filter sort limit and or not in like asc desc true false`)
are case-insensitive. Strings use single or double quotes with `\` escapes.
`like` does a case-insensitive substring match, or a regex when the pattern is
wrapped in `/.../`.

## API

```ts
import { parse, run, matches, comparator } from './lib/logql';

const result = parse(input);
if (!result.ok) {
  // result.errors: { message, start, end }[]  — spans into the input
} else {
  const { rows, fields } = run(records, result.query, {
    getValue: (rec, path) => /* app's nested accessor */,
    caseInsensitive: true,
  });
}
```

- `parse(input)` → `{ ok: true, query }` or `{ ok: false, errors }`.
- `run(records, query, opts?)` → filtered + sorted + limited `rows`, plus the
  requested `fields` (or `null`).
- `matches(query, record, opts?)` → boolean for one record.
- `comparator(query, opts?)` → a sort comparator, or `null` if no `sort`.

### EvalOptions

| option | default | meaning |
|---|---|---|
| `getValue` | dot-path accessor | resolve a field path against a record |
| `caseInsensitive` | `true` | case handling for `=`, `like`, `in`, bare terms |

## Semantics notes

- Missing fields are incomparable: only `!=` is true against them.
- `=` / comparisons coerce to numbers when both sides look numeric, else compare
  as (optionally case-insensitive) strings.
- In `sort`, missing values always sort last regardless of direction.
