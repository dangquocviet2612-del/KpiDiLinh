# Repo Patterns

## App Structure

- Dashboard routes live under `src/app/(dashboard)/...`
- Shared components live under `src/components`
- Feature CSS usually sits beside the page/client component as `*.module.css`

## Common Conventions

- Use `lucide-react` for icons
- Reuse shared button/action styles from `src/app/globals.css`
- Prefer feature-local client components for heavy interactivity
- Keep `page.tsx` lean when a view becomes large; move client logic into `*Client.tsx`

## Route Handlers

- If Prisma or filesystem is used, prefer:
  - `export const runtime = "nodejs"`
  - `export const dynamic = "force-dynamic"` only when needed
- Keep route handlers explicit about auth and role checks

## Sensitive Areas

- Upload and backup code can be hostile to Vercel filesystem constraints
- Archive/backup/restore changes must be treated as operational changes, not only UI changes
- Importers often depend on exact Excel column mapping and Vietnamese labels

## Verification

- Default check:
  - `npm.cmd run -s lint -- --ignore-pattern tmp/edge-review/**`
- Also run build when changing:
  - route boundaries
  - dynamic imports
  - layout/page composition
  - metadata or server/client splits
