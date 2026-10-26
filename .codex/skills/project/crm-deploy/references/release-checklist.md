# Release Checklist

## Pre-Deploy

- `npm.cmd run -s lint -- --ignore-pattern tmp/edge-review/**`
- `npm.cmd run -s build`
- confirm new env vars are documented
- identify whether any route still depends on local filesystem writes

## High-Risk Areas

- backup / restore
- archive / purge / cron
- official document uploads and assets
- Excel imports for KPI, CDT, node efficiency
- auth / role gating

## Vercel Notes

- local filesystem writes are not durable
- verify storage assumptions for uploads and generated assets
- verify `DATABASE_URL`, auth secrets, and any setup/deploy secrets

## Post-Deploy Smoke Checks

- login and role-based navigation
- customers
- map and node-map
- prepaid / KPI / CDT / official-docs
- tools
- backup / archive screens if touched by the release

## Rollback Trigger Examples

- login broken for any role
- core route fails to render
- importer cannot read a previously valid file
- mobile layout breaks on a main workflow
