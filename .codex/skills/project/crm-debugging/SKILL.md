---
name: crm-debugging
description: Use when debugging regressions or unstable behavior in this CRM repo, especially import flows, mobile UI breakage, role-based access, encoding issues, map screens, KPI/CDT logic, and module-not-found or build failures.
---

# CRM Debugging

Repo-local debugging workflow for this project.

If this skill conflicts with system, developer, or repo-root `AGENTS.md` instructions, follow those higher-priority instructions.

## Use This Skill For

- broken builds or imports
- mobile UI regressions
- encoding issues in Vietnamese text
- role/permission bugs
- Excel import mismatches
- map popup/filter/render problems
- KPI/CDT summary mismatches

## Workflow

1. Reproduce the exact symptom.
   - Capture the failing route, file, filter state, role, screen size, or input file shape.
2. Classify the failure before editing:
   - import/path
   - auth/permission
   - data mapping
   - mobile layout/CSS
   - encoding/text
   - cache/re-fetch
   - build/runtime boundary
3. Search the narrowest affected area first with `rg`.
4. Fix the smallest root cause.
   - Do not rewrite the whole module unless the structure is already broken.
5. Verify at the same layer where it failed.
   - lint for compile/import issues
   - build for route boundary issues
   - targeted runtime/path checks for UI/data issues

## Repo-Specific Heuristics

- If text looks like `KhÃ´ng...`, treat it as encoding, not typography.
- If mobile looks wrong, inspect container width, overflow, wrapping, and hidden desktop structures first.
- If totals are wrong after pagination, check whether UI is summing visible rows instead of API totals.
- If import says no valid rows, verify exact column mapping and normalization before changing DB logic.
- If Vercel/deploy breaks, inspect filesystem assumptions before touching unrelated code.

## Verification

- Default:
  - `npm.cmd run -s lint -- --ignore-pattern tmp/edge-review/**`
- Add build when the issue touches routing, imports, or server/client boundaries.

## References

- Read `references/failure-modes.md` when the bug is not obvious after the first search pass.
