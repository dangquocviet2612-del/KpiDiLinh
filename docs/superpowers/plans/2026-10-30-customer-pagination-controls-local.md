# Customer pagination controls — local implementation plan

> Continue approved Task11 with TDD, scoped browser measurement and frozen independent review. Local only; no commit/branch/push/deploy, real DB/env/accounts or speculative auth changes.

**Goal:** Phân trang khách hàng rõ tên điều khiển, không submit form ngoài ý muốn và dễ chạm trên mobile/phóng chữ.

**Architecture:** PaginationControls giữ props/callbacks/labels/options/boundaries, root đổi thành named nav, select có explicit aria-label, buttons có typebutton/accessible names. Chỉ mobile CSS≤768: rowwrap, select widthauto/minwidth0/flex1 1 8rem (4 declarations). Shared styles đã cho controls ≥44px; giữ nguyên, không thêm min-height trùng. Dùng focus indication hiện có, không đổi global CSS/fonts/palette/desktop geometry hoặc logic hooks/API.

**Tech Stack:** Existing React/CSS modules, RTL/user-event và installed Chrome SSR/globalCSS/synthetic props. Native form/Tab probes riêng, không React hydration/auth/API/DB/Next build.

## Boundaries đã đối chiếu

- Chỉ customer page gọi PaginationControls, ngoài form và chỉ khi customers.length>0; useCustomers normalize totalPages tối thiểu1. Form-submit repro là defensive component contract, không claim production hiện đang submit nhầm.
- Giữ page±1, disabled equality,10/20/50/100, Number(value), setPage/setLimit/reset/filter/SWR behavior. Không tự sửa empty/out-of-range/NaN business state.
- useCustomers keepPreviousData:true nên không thêm aria-live/success-status để khẳng định request/trang dữ liệu đã hoàn tất khi chỉ props.page đổi. Refreshing badge/URL filter context là scope kế tiếp, không gộp backend/state vào batch này.
- Select đã có title fallback accessible name; explicit name mới làm rõ ngữ cảnh, không gọi nó nameless trước sửa. Focus global đang có: giữ/recheck, không thêm CSS trùng.
- Baseline Chrome80case: targetFailures0, keyboardFailures0 (đã đạt); layoutFailures10 khi390/rootfont200%, semanticFailures80 theo contract tên mới, nativeFormFailures64 trong synthetic form. Vì vậy chỉ sửa wrap/width và semantics; không claim lỗi vùng chạm hay focus đã được sửa, cũng không gọi native form probe là lỗi caller production.
- Đồng tên class ở Logs/Churn/Disconnect dùng CSSmodule riêng, không sửa/bật3menu đã bỏ. Không sửa caller/hook/global styles hoặc pagination rules domain khác.

## Files

- Modify `src/components/PaginationControls.tsx`, `src/app/(dashboard)/customers/customers.module.css`.
- Create `tests/fixtures/customer-pagination-controls.ts`, `tests/ui/customer-pagination-controls.test.tsx`.
- Docs `docs/customer-pagination-controls.md`, plan này, roadmap `2026-10-26-web-ux-performance.md`, append54 `tiendokpi.md`.

## Checklist

- [x] Rà source/AGENTS/callers/hooks/focus rules và snapshot/preimages, reuse WT; preserve all old dirty/evidence.
- [x] RTL RED trước app: named landmark/labels/typebutton/native mouse+keyboard form safety và preservation options/callbacks/boundaries/controlled values/info. RED5fail14pass→GREEN19/19.
- [x] Browser baseline80case:5variant first/middle/last/single/largecounts×6width360/390/768/769/1024/1440×2theme=60 +20rootfont200%390/1440. Đo mobile targets44/containment/nonoverlap/infofit; desktop geometry exact. Native Tab/focus và submit probes không gọi callbacks React, chỉ unitRTL kiểm callback. Before10layoutfail→WTafter0all, desktop40geometry/80valuecontracts unchanged.
- [x] Minimal JSX/mobileCSS fix, GREEN; no aria-live/new loading contract, no config/deadline/dependency changes. Chỉ4CSSdeclarations, exact-scope/frozen4hash đạt; WT49file819test+22policy/types/lint0error3warning cũ.
- [x] Freeze4hash/review static độc lập spec trước quality APPROVE; fresh currentbatch scoped WT/primary mỗi root49file819test +22policy/types nonincremental/lint0error3warning cũ, Chrome80/80 mỗi root; không dùng focused/browser/reviewer thay primary.
- [x] Source/docs guards/backups/scan/whitespace/progress54; historical authfailure50/trace51/native/Node0TB gates vẫn mở, releaseReadyfalse. Finalguard kiểm479snapshot paths/158dirty/1312old artifacts, owned8paths và progress append-only.

## Kết luận giới hạn

Implementation/kiểm thử phạm vi local hoàn tất, không đồng nghĩa toàn Task11 hoặc release hoàn tất. Không thay bất kỳ timeout, pool, assertion/mocks cũ, dependency hay config. Originalauthfailure/pending gate giữ nguyên dù current-batch uninstrumented QA đạt; chưa chứng minh nguyên nhân timeout. Không build/apphydration/authE2E/device/actualzoom/speed acceptance, branch/commit/push/deploy. Bước sau: xác minh loading/refresh/filter context riêng.
