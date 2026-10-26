# KPI Calculator Design

**Goal:** Add a manager/admin-only `Tính KPI` screen under the KPI module so supervisors can simulate personal KPI completion by editing only `TH giả lập`, while reusing the exact scoring logic from the real personal KPI report.

**Scope**
- Add a new `/prepaid?view=kpi-calculator` screen and KPI submenu item.
- Restrict access to `ADMIN` and `MANAGER`; redirect `CTV` back to `/prepaid`.
- Load the same personal KPI source rows used by `KPI cá nhân`.
- Let the user change only `TH giả lập` per row.
- Recalculate row and total scores in-memory only; do not write anything to DB.
- Show clear delta and missing-to-100 summaries.

**Non-goals**
- No new database tables.
- No changes to existing KPI scoring business rules.
- No persistence of simulated values.

## Approach

### Scoring Reuse
- Extract the row/group scoring logic currently embedded in `src/app/api/kpi/report/route.ts` into a reusable helper in `src/lib/`.
- Both the real KPI report route and the calculator will consume that helper so there is only one scoring pipeline.
- The helper must preserve:
  - positive KPI logic
  - negative KPI logic
  - `Cước N1-N3`
  - merge-group behavior
  - total score aggregation

### Data Flow
- Add a small calculator API that returns:
  - selected CTV
  - report date
  - source rows
  - totals
- On the client, initialize `TH giả lập` from `TH hiện tại`.
- Recompute rows and totals locally whenever `TH giả lập` changes.
- Keep a reset action so supervisors can return to source data instantly.

### UI
- New KPI submenu item: `Tính KPI`.
- Desktop: table-first layout.
- Mobile: compact cards.
- Summary cards:
  - `Tổng điểm hiện tại`
  - `Tổng điểm giả lập`
  - `Chênh lệch`
  - `Còn thiếu để đạt 100%`
- Table columns:
  - `Chỉ tiêu`
  - `KH`
  - `TH hiện tại`
  - `TH giả lập`
  - `% HT giả lập`
  - `Điểm chuẩn`
  - `Điểm tối đa`
  - `Điểm đạt giả lập`
  - `Chênh lệch điểm`

## Verification
- Add test coverage for the reusable calculator/scoring helper:
  - positive KPI
  - negative KPI
  - `Cước N1-N3`
  - merge-group aggregation
  - missing-to-100 total
- Run:
  - `npm.cmd run -s lint -- --ignore-pattern tmp/edge-review/**`
  - `npm.cmd run -s build`
