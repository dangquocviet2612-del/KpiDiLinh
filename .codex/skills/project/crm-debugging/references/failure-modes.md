# Common Failure Modes In This Repo

## Encoding

- Symptoms:
  - broken Vietnamese like `KhÃ´ng`, `Äang`
- Typical fix:
  - rewrite the file cleanly in UTF-8 instead of patching random substrings

## Mobile UI

- Symptoms:
  - overflow, wrapped chips, clipped titles, header covering content
- Typical fix:
  - inspect mobile-only media queries
  - ensure desktop table/layout is not merely hidden while still affecting flow

## Importers

- Symptoms:
  - valid Excel file yields no rows or partial matches
- Typical fix:
  - normalize headers and values
  - compare exact expected column names
  - check role/code mapping before DB writes

## Summary Totals

- Symptoms:
  - totals change after pagination/filtering
- Typical fix:
  - use API-provided totals, not current-page row sums

## Module Not Found

- Symptoms:
  - aliased component missing after refactor
- Typical fix:
  - confirm file exists, casing matches, export is default/named as expected

## Deploy/Vercel

- Symptoms:
  - build passes locally but runtime breaks on Vercel
- Typical fix:
  - inspect env vars
  - inspect local filesystem writes
  - inspect route runtime assumptions
