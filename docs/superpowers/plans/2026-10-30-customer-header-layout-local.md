# Customer card header layout — local implementation plan

> Continue approved Task11 with systematic-debugging, browser-first CSS TDD, preservation RTL and frozen review. No branch/commit/push/deploy, real env/DB/accounts or speculative auth fix.

**Goal:** Tên khách hàng không vẽ chồng status/card khi tên dài hoặc phóng chữ; giữ đủ dữ liệu, layout thông thường và desktop.

**Architecture:** Chỉ CSS scoped mobile-card header: flex-wrap cho header, main flex-basis12rem để giữ chỗ đọc tên rồi tự tách badge khi thiếu chiều ngang, overflow-wrap anywhere cho name. Badge có max-width100%/normal white-space/anywhere và margin-leftauto để tự wrap nội dung/giữ canh phải. Không JSX/handler/formatter/data/font/palette/breakpoint/API/role changes; secondary clamp/title hiện có giữ nguyên.

**Tech Stack:** Existing CSS modules/React, RTL/user-event and installed Chrome actual SSR/globalCSS with synthetic props; no Next server/build/auth/API/DB/hydration.

## Root cause đã đo trước sửa

Saved actual SSR fixture390px/rootfont200%: name box59.97px, first glyph range85.14px; name/status intersection5.98×38px. Computed name overflow-wrap normal, header nowrap. Không suy từ ảnh hoặc dùng việc page không overflow để phủ nhận glyph overlap. Status schema là string max50; stress fixture≤50, không thêm trạng thái nghiệp vụ hoặc validation.

## Design boundaries

- Normal-sized card có đủ chiều ngang vẫn giữ một hàng và geometry cũ; flex-basis là space preference, không JS viewport detector hoặc fixed name width. Font scaling đẩy badge sang hàng riêng khi cần.
- Long name giữ full text/title và wrap thay vì thu font/ẩn chữ. Status cũng đọc đủ, không xóa text/color hoặc suy lại active/inactive. Badge vẫn canh phải khi wrap.
- Component DOM/mocks/roles/links/callbacks/44px targets/selection/footer/package/contact và full desktop không đổi. CSS module generated tokens có thể đổi hash; canonical DOM chỉ map exact exported tokens sang logical keys, giữ mọi thứ khác.
- Text ink có thể vượt line box theo font metrics; kiểm horizontal name fit và giao cắt glyph-status thật, không dùng bounding-box vertical ink overshoot nhỏ như một lỗi clipping mới.

## Files

- Modify only `src/app/(dashboard)/customers/customers.module.css` application file.
- Create `tests/fixtures/customer-header-layout.ts`, `tests/ui/customer-header-layout.test.tsx`.
- Docs: guide `docs/customer-header-layout.md`, plan này, roadmap `2026-10-26-web-ux-performance.md`, append53 `tiendokpi.md`.

## Checklist

- [x] Rà source/AGENTS/schema/style và đo overlap trước app; snapshot475paths/352source-config-test,154dirty/1233oldartifacts và reuse WT.
- [x] Preservation RTL13cases trước/sau; đây không là pixel test và không giả làm RED. CSS RED từ actual Chrome matrix trước sửa.
- [x] Browser192cases:4variant normal/longname/longstatus/status-hidden×3fake-role×6width360/390/768/769/1024/1440×2theme=144, thêm48rootfont200%390/1440. Name horizontal fit/no glyph-status overlap/status insidecard/horizontal textfit;44px controls. Actual SSR/CSS props giả, không authE2E/device/browserzoom.
- [x] Patch CSS tối thiểu sau RED; matrix GREEN, canonical DOM mọicase giốngpreimage, desktopgeometry và normalfont100% mobile geometry unchanged. Freeze3hash/exact-scope.
- [x] Independentreview và QA scoped WT/primary, không coi recorded browser/RTL là primary gate.
- [x] Fresh currentbatch scoped47file/787selection cộng13test,22policy/types nonincremental/lint; guards/scans/backups/docs/progress53. Historical authtimeout50/trace51 và native/Node0TB gates giữ nguyên, releaseReadyfalse.

**Kết quả:** Preservation13/13before vàafter; realCSSbefore192case có68name/44overlap/18statusfail (không cộng metric), mỗi root after192/192pass/control0. CanonicalDOM/tablegeometry192unchanged (96tablevisible/96hiddenzero);18normalfont100mobilegeometry unchanged. WT và primary fresh QA riêng mỗi root48file/800test+22policy/types/lint0error3warning cũ; không dùng traced51PASS thay primary. Review APPROVE3hash và exactscope; source/docs backups/scans/finalguards giữ475paths/154oldchanges/1233oldartifacts, chỉ7ownedfiles. Parentxem3PNG; không allapp/device/font200mọiwidth/CLS/performance claim. CurrentBatchPrimaryScopedPassedtrue, historicalAuthTimeoutRootCauseProvenfalse/releaseReadyfalse; originalfailedgate/history byte-equal, không authfix/deploy hoặc hoàn tất toànTask11.
