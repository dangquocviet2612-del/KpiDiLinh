# Import / Export Map

## Libraries

- `xlsx` is used in:
  - `src/lib/kpi.ts`
  - `src/lib/cuoc.ts`
  - `src/app/api/import/route.ts`
  - `src/app/api/cdt/import/route.ts`
  - `src/app/api/nodes/upload/route.ts`
  - `src/app/api/export/route.ts`
  - `src/app/api/template/route.ts`
  - `src/lib/archive.ts`

## Main Flows

### Customers

- UI: `src/app/(dashboard)/customers/page.tsx`
- API import: `src/app/api/import/route.ts`
- Template export: `src/app/api/template/route.ts`
- Full export: `src/app/api/export/route.ts`

### KPI

- UI: `src/app/(dashboard)/prepaid/page.tsx`
- Parser logic: `src/lib/kpi.ts`
- API import: `src/app/api/kpi/import/route.ts`

### Cước

- UI: `src/app/(dashboard)/prepaid/page.tsx`
- Parser logic: `src/lib/cuoc.ts`
- API import: `src/app/api/cuoc/import/route.ts`

### CDT

- UI: `src/app/(dashboard)/prepaid/page.tsx`
- API import: `src/app/api/cdt/import/route.ts`

### Node efficiency

- UI: `src/app/(dashboard)/node-map/NodeMapComponent.tsx`
- API upload/import: `src/app/api/nodes/upload/route.ts`

### Archive export

- UI: `src/app/(dashboard)/archive/page.tsx`
- Export logic: `src/lib/archive.ts`
- Route: `src/app/api/archive/export/route.ts`

## Frequent Risk Points

- column names differ by case or spacing
- Excel dates arrive as serial numbers
- CTV / manager / secondary code mapping fails
- totals are recomputed from paged rows instead of full results
- archive-locked months are overwritten by import

## Good Import Changes

- add normalization helpers once
- keep column mapping visible and easy to audit
- fail with actionable messages
- keep performance in mind for large sheets
