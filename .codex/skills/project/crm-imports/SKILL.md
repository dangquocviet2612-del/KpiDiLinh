---
name: crm-imports
description: Use when adding, debugging, or refactoring Excel/file import and export flows in this CRM repo, including customers, KPI, Cước, CDT, node efficiency, archive export, and related mapping/validation logic.
---

# CRM Imports

Repo-local guidance for import/export flows in this CRM project.

If this skill conflicts with system, developer, or repo-root `AGENTS.md` instructions, follow those higher-priority instructions.

## Use This Skill For

- adding a new Excel importer
- changing column mapping
- debugging import failures
- optimizing slow imports
- protecting imports from overwriting archived/locked data
- export flows tied to archive or operational backups

## Workflow

1. Identify the exact flow:
   - customer import
   - KPI import
   - Cước import
   - CDT import
   - node efficiency import
   - archive export
2. Confirm the real source of truth:
   - expected Excel columns
   - matching key
   - target table/fields
   - role/permission constraints
3. Normalize before matching.
   - trim whitespace
   - normalize header/value case when appropriate
   - handle Excel date parsing explicitly
4. Validate before writing.
   - reject empty/invalid files early
   - report skipped/invalid rows clearly
5. Keep writes safe.
   - check archive locks where relevant
   - avoid deleting data before validation is complete
6. Verify with a representative file shape, not only ideal data.

## Repo-Specific Rules

- This repo uses `xlsx` heavily; keep parsing logic explicit.
- Import bugs are often caused by:
  - wrong column names
  - casing differences
  - date parsing
  - user/code mapping
  - summary UI reading wrong totals after import
- For CDT and KPI-related flows, respect role and manager mappings.
- For archive-related flows, treat export/confirm/purge as operationally sensitive.
- Prefer small normalization helpers over duplicated ad-hoc string handling.

## Verification

- `npm.cmd run -s lint -- --ignore-pattern tmp/edge-review/**`
- if route or shared parser changed, run build too
- for importer changes, verify one realistic sample file path and expected mapped fields

## References

- Read `references/import-map.md` before editing an existing importer.
