---
name: crm-frontend-design
description: Use when redesigning or polishing UI in this CRM repo, especially dashboard screens, mobile/desktop responsive behavior, map overlays, tables, cards, modals, filters, and shared action consistency.
---

# CRM Frontend Design

Repo-local UI design guidance for this CRM project.

If this skill conflicts with system, developer, or repo-root `AGENTS.md` instructions, follow those higher-priority instructions.

## Use This Skill For

- redesigning dashboard pages
- improving mobile layouts
- refining tables, cards, filters, and modals
- aligning UI across `customers`, `map`, `node-map`, `prepaid`, `ctv`, and `tools`
- reducing visual clutter while preserving workflow speed

## Design Goals For This Repo

- Keep UI direct and operational, not decorative.
- Favor simple hierarchy over more components.
- Make desktop dense but readable.
- Make mobile compact without hiding core actions.
- Keep modules visually related across the app.

## Workflow

1. Identify the main job of the screen.
   - list management
   - map interaction
   - reporting/dashboard
   - editing form
   - utility tool
2. Decide the primary visual focus.
   - table/list
   - map canvas
   - summary cards
   - form body
3. Remove competing emphasis.
   - too many pills
   - too many stacked cards
   - repeated toolbars
   - oversized headers
4. Reuse existing shared UI patterns first.
5. Check both desktop and mobile structure before fine styling.
6. Verify no overflow, clipped text, or broken action hierarchy.

## Repo-Specific UI Rules

- Reuse shared action styles from `globals.css` before inventing screen-specific buttons.
- Keep map overlays light. The map itself should remain the main canvas.
- For admin/data screens, prefer:
  - one clear header
  - one main toolbar
  - one main data region
- On mobile:
  - collapse filters before hiding data
  - avoid tall stacked control blocks
  - prefer one summary row over multiple large cards when possible
- For tables:
  - reduce row height before reducing information value
  - use chips sparingly
  - keep the most important column visually strongest
- For modals:
  - sections should reflect task logic, not database shape
  - footer actions should be obvious and stable

## What Good Looks Like In This Repo

- `customers`: operational and compact
- `map` / `node-map`: Google Maps-like simplicity
- `prepaid`: dense but clean reporting hierarchy
- `ctv`: simple admin layout with compact cards/tables
- `tools`: full-workspace utility feel, not dashboard clutter

## Verification

- visually inspect desktop and mobile logic in the affected module
- run:
  - `npm.cmd run -s lint -- --ignore-pattern tmp/edge-review/**`

## References

- Read `references/ui-patterns.md` when choosing screen structure or visual hierarchy.
