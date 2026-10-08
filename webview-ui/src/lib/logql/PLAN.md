# LogQL — CloudWatch-style query lib

Önálló, app-független query-nyelv a Log Lens-hez. Cél: később kiemelhető legyen
egy külön npm csomagba. **Semmilyen app-import** (nincs React/zustand/LogEntry).

## Szintaxis (CloudWatch Logs Insights részhalmaz)

```
fields @timestamp, level, service, message
| filter level = "error" and service in ["payments-svc","auth-gateway"]
| sort @timestamp desc
| limit 20
```

### Nyelvtan (EBNF)
```
query      ::= command ('|' command)*
command    ::= 'fields' fieldList
             | 'filter' orExpr
             | 'sort'   sortItem (',' sortItem)*
             | 'limit'  INT
orExpr     ::= andExpr ('or'  andExpr)*
andExpr    ::= notExpr ('and' notExpr)*
notExpr    ::= 'not'? primary
primary    ::= '(' orExpr ')' | comparison | bareTerm
comparison ::= field op value | field 'in' '[' value (',' value)* ']'
op         ::= '=' | '!=' | '<' | '<=' | '>' | '>=' | 'like'
value      ::= STRING | NUMBER | BOOL
bareTerm   ::= STRING          // szabadszavas keresés az egész rekordban
field      ::= IDENT | '@'IDENT | dotted.path | "quoted"
sortItem   ::= field ('asc' | 'desc')?
```
Kulcsszavak kis/nagybetű-függetlenek.

## Architektúra

| Fájl | Felelősség | OOP? |
|---|---|---|
| `types.ts` | Token, AST (Query/Condition/SortItem), ParseResult, ParseError, EvalOptions | adat |
| `errors.ts` | ParseError + segédek | adat |
| `tokenizer.ts` | string → Token[] pozíciókkal | **class Tokenizer** (stateful) |
| `parser.ts` | Token[] → Query; hibát gyűjt | **class Parser** (stateful) |
| `evaluator.ts` | matches / comparator / run — tiszta fv-ek | fv |
| `index.ts` | publikus barrel (csak ezt importálja az app) | — |
| `README.md` | nyelvtan + példák | — |
| `__tests__/` | futtatható unit tesztek (node, app nélkül) | — |

## Publikus API
```ts
parse(input: string): ParseResult
run<T>(records: T[], q: Query, opts?: EvalOptions): { rows: T[]; fields: string[] | null }
matches(q: Query, rec: unknown, opts?: EvalOptions): boolean
comparator(q: Query, opts?: EvalOptions): ((a, b) => number) | null
// EvalOptions = { getValue?, caseInsensitive?, now? }
```
Beágyazott/pontos-kulcs logika az appé marad: `opts.getValue = getNestedValue`.

## App-integráció (külön a libtől)
- Query-sáv UI (CloudWatch-érzet) a Header környékén.
- Store: `runQuery(input)` → parse → `fields` a field-visibilityt, `filter/sort/limit`
  a filteredLogs-ot hajtja a lib `run()`-ján keresztül.
- A meglévő struktúrált szűrő változatlanul megmarad mellette.

---

## Haladás (checklist)

### Lib
- [x] `types.ts`
- [x] `errors.ts`
- [x] `tokenizer.ts` (+ teszt)
- [x] `parser.ts` (+ teszt)
- [x] `evaluator.ts` (+ teszt)
- [x] `index.ts` (barrel)
- [x] `README.md`
- [x] teszt-futtató zöld (27/27, esbuild-bundle + node)

### App-integráció
- [x] store `runQuery` / `setQueryText` / `clearQuery` action + `appliedQuery`/`queryErrors` state
- [x] query-sáv UI komponens (`QueryBar.tsx`, Ctrl/Cmd+Enter futtat)
- [x] fields → field-visibility bekötés (runQuery állítja a visibleFields-et)
- [x] hibajelzés az inputban (piros doboz, pozícióval)
- [x] build + lint + integrációs teszt minta-adaton (8/8)

### Vizuális editor (QueryEditor)
- [x] regex-literál támogatás a libben (`/pattern/`) + teszt
- [x] szintaxis-kiemelés a lib tokenizeréből (gutter + színezett rétegek)
- [x] autocomplete popup (kulcsszavak + mezőnevek, Tab/Enter beszúr)
- [x] vizuális ellenőrzés headless screenshottal (megfelel a cél-designnak)

### Lezárás
- [x] README/PLAN frissítés
- [ ] commit

### Ismert követő feladatok (MVP után)
- Amíg egy query aktív, a Header-keresés és a struktúrált szűrők figyelmen kívül
  maradnak (a query veszi át). Érdemes lehet kölcsönösen kizáróvá tenni / jelezni.
- Hibaspan vizuális kiemelése az inputban (most csak `pos N` szám).
- `stats`/`parse`/`dedup` parancsok, `>`/`<` dátum-literálokra.
```
