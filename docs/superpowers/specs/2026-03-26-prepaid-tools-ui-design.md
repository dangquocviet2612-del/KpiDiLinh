# Prepaid And Tools UI Refactor Design

**Goal:** Reduce UI fragility by splitting `prepaid/page.tsx` into view-sized components and replacing the mobile tabbed `Tiện ích` experience with separate tool screens.

**Scope**
- Refactor `src/app/(dashboard)/prepaid/page.tsx` so each major mode renders through its own component.
- Clean visible mojibake and UI text in the prepaid module while extracting views.
- Replace the single `/tools` iframe shell with a launcher page plus separate routes for:
  - `/tools/receipt`
  - `/tools/excel`
  - `/tools/photo`
- Reuse existing tool assets instead of rebuilding the tools in React.

**Non-goals**
- No API shape changes for KPI/CDT/Cước/Official Docs.
- No business logic changes in the tools beyond view selection and mobile layout.
- No full rewrite of the tool assets.

## Approach

### Prepaid
- Keep state, fetch orchestration, and mutations in `page.tsx`.
- Extract major render branches into dedicated components under `src/app/(dashboard)/prepaid/views/`.
- Move visible strings into new UTF-8-clean components as part of the extraction.
- Start with the highest-weight views:
  - personal KPI
  - tổng hợp KPI
  - KPI quản lý
  - cước
  - CDT report
  - CDT detail
  - công văn

### Tools
- Turn `/tools` into a launcher screen with 3 cards.
- Add dedicated route pages for each tool that embed only the required tool surface.
- Extend the tool asset entrypoint to read query params:
  - `view=receipt|excel|photo`
  - `single=1`
  - `embedded=1`
- In single-view mode:
  - hide shared tab chrome
  - render only one tool surface
  - apply mobile-first layout for that surface

## Expected Outcome
- `prepaid/page.tsx` becomes a coordinator instead of a giant render file.
- Mobile `Tiện ích` stops fighting iframe tabs and double-layout problems.
- Text quality in prepaid becomes stable because visible strings move into clean UTF-8 files.

## Verification
- `npm.cmd run -s lint -- --ignore-pattern tmp/edge-review/**`
- `npm.cmd run -s build`
- Manual sanity checks:
  - `/prepaid`
  - `/prepaid?view=summary`
  - `/prepaid?view=summary-manager`
  - `/prepaid?view=cuoc`
  - `/prepaid?view=cdt`
  - `/prepaid?view=cdt-report`
  - `/prepaid?view=official-docs`
  - `/tools`
  - `/tools/receipt`
  - `/tools/excel`
  - `/tools/photo`
