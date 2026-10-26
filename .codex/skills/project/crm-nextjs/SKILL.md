---
name: crm-nextjs
description: Use when changing Next.js App Router code in this CRM repo: pages, layouts, route handlers, auth-gated dashboard modules, shared UI patterns, or client/server component boundaries.
---

# CRM Next.js

Repo-local guidance for Next.js work in this project.

If this skill conflicts with system, developer, or repo-root `AGENTS.md` instructions, follow those higher-priority instructions.

## Use This Skill For

- `src/app/**` pages, layouts, and route handlers
- auth-gated dashboard modules
- App Router client/server boundary decisions
- refactors that touch Prisma, auth, uploads, or shared dashboard UI

## Workflow

1. Identify the boundary first:
   - `page.tsx` / `layout.tsx`
   - route handler
   - client component
   - shared component
2. Default to Server Components.
   - Add `"use client"` only for state, effects, browser APIs, or direct event handlers.
3. Keep route handlers thin.
   - Parse input, validate, call DB/service logic, return concise JSON.
   - If Prisma or filesystem is used, prefer `runtime = "nodejs"`.
4. Match repo patterns instead of inventing new ones.
   - CSS modules for feature styling
   - Lucide icons
   - shared action classes from `globals.css`
   - dashboard pages under `src/app/(dashboard)/...`
5. For UI changes, check both desktop and mobile structure before editing CSS.
6. Verify with the smallest useful check:
   - `npm.cmd run -s lint -- --ignore-pattern tmp/edge-review/**`
   - if route or build boundary changed, run `npm.cmd run -s build`

## Repo Rules

- Preserve existing route shapes and query params unless the task requires a breaking change.
- Do not move data-affecting logic into client components.
- Be careful with routes that write local files; this repo has Vercel-sensitive filesystem code.
- Prefer small, local fixes over broad framework-style rewrites.

## References

- Read `references/repo-patterns.md` when touching routing, auth, Prisma, uploads, or shared UI structure.
