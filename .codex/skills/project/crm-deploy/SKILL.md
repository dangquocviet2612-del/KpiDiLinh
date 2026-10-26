---
name: crm-deploy
description: Use when preparing, reviewing, or executing deployment-related work for this CRM repo, including Vercel readiness, env checks, backup/restore safety, archive cron behavior, and post-deploy verification.
---

# CRM Deploy

Repo-local deployment and release checklist for this project.

If this skill conflicts with system, developer, or repo-root `AGENTS.md` instructions, follow those higher-priority instructions.

## Use This Skill For

- pre-deploy reviews
- Vercel readiness checks
- env var verification
- backup/restore safety checks
- archive/cron verification
- release notes and rollback planning

## Workflow

1. Classify the change:
   - UI-only
   - route/build boundary
   - DB/data model
   - import/export logic
   - backup/archive/ops
2. Run minimum preflight checks:
   - `npm.cmd run -s lint -- --ignore-pattern tmp/edge-review/**`
   - `npm.cmd run -s build`
3. Check operational impact:
   - Does this touch backup/restore?
   - Does this touch archive purge or cron behavior?
   - Does this touch upload or local filesystem writes?
   - Does this require new env vars?
4. Produce a concise deploy note:
   - what changed
   - env needed
   - post-deploy checks
   - rollback concern

## Repo-Specific Rules

- Treat backup/restore, archive, importers, and official-doc uploads as high-risk changes.
- For Vercel, be explicit when a feature still assumes local disk.
- Do not say deploy is safe if env vars or storage assumptions are still unresolved.
- For data-affecting changes, recommend a fresh backup before deploy.

## Post-Deploy Checks

- login works for affected roles
- target module route loads
- changed API path returns expected data
- mobile UI does not overflow on the changed screen
- archive/backup/import flows still behave

## References

- Read `references/release-checklist.md` for the project-specific deploy checklist.
