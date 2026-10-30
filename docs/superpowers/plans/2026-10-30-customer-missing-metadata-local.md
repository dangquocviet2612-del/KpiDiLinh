# Customer missing metadata — local implementation plan

> Continue approved Task11 with TDD, frozen review and guarded integration. Local only, no branch/commit/push/deploy or real DB/env/accounts. Original auth timeout remains unexplained, not retried unchanged to force green.

**Goal:** Thông tin gói cước/CTV còn thiếu rõ nghĩa, không dùng `---` như dữ liệu thật; giữ giá0đ và toàn bộ dữ liệu/thao tác hiện có.

**Architecture:** Chỉ JSX trong CustomerMobileCard: label package có tên vẫn Gói cước, chỉ có price thì label Chưa có tên gói và không render name `---`; CTV fallback Chưa có/title Chưa có mã CTV, chỉ fallback này có inline whiteSpace normal/overflowWrap anywhere. Không sửa fileCSS/helper/logic/request/data/formula/guard. Không trim whitespace hoặc coi literal `---` là sentinel; price null/zero/negative vẫn theo formatter và điều kiện cũ.

**Tech Stack:** React/CSS modules sẵn có, RTL/user-event và installed Chrome actual SSR/synthetic props. Không Next server/build/hydration/auth/API/DB.

## Thiết kế trong phạm vi đã duyệt

- Không giấu missing-name: báo rõ ngay label strip thay vì bỏ thông tin hoặc thêm dòng giải thích/badge/nút. Không thay layout/palette/hit-area.
- CTV trống chỉ báo chưa có mã, không suy luận đã/chưa phân công hoặc tình trạng hoạt động.
- Package có tên, codeCTV có dữ liệu và desktop table giữ DOM/geometry; API/scope/phone-account hints của mục50, role/flags/copy/actions giữ nguyên.
- Package+price cùng rỗng vẫn không render strip như trước. Không tự thay null thành0, normalize khoảng trắng hoặc chỉnh validation/data-cleanup.

## Files

- Modify `src/components/CustomerTableRefined.tsx` only application file.
- Create `tests/fixtures/customer-missing-metadata.ts`, `tests/ui/customer-missing-metadata.test.tsx`.
- Create `docs/customer-missing-metadata.md`, plan này; update roadmap `2026-10-26-web-ux-performance.md`, append52 `tiendokpi.md`.

## Checklist

- [x] Rà source/AGENTS/plan, reuse worktree; snapshot/preimage/evidence cũ bất biến.
- [x] Viết tests trước app: missing names/codes, null/empty/whitespace/literalplaceholder, zero/negative/price-only/name-only, populated/verbatim/actions/role/flags/rerender/desktop.
- [x] RED đúng placeholder hiện tại, minimal JSX fix, GREEN; không sửa app/test sau freeze nếu không review lại.
- [x] Browser96case:6variant×6width360/390/768/769/1024/1440×2theme=72 +24rootfont200%390/1440. Actual CSS/global/SSR, fakeADMIN loaded props; missingtext fit, controls44px/horizontalcontainment, full-data/desktop rawDOM+geometry exact, stylesheet hash unchanged. Không appE2E/zoom/device/speed claim.
- [x] Freeze3files/review; scoped QA riêng WT/primary cùng46file/763selection cộng test mới,22policy/types nonincremental/lint. Đây là current batch validation sau source change, không chứng minh root cause hoặc sửa original auth timeout.
- [x] Guarded source/docs integration, scan/whitespace/backup/hash/inventory, tiendokpi52; preserve original pending gate50/trace51. ReleaseReadyfalse vì các gate lịch sử/fullnative/visual/timing/browser/Production còn riêng.

## Measured refinement

Initial RTL RED13fail/10pass→GREEN23; ChromeV1after metadata đúng nhưng6case root-font200%390 bị cắt fallbackCTV. Diagnostic computed nowrap/hidden/ellipsis, box69.97px nhưng range99.23px. Thêm regressionwrap RED1fail/23pass và conditional inline2property chỉ khi CTVfalsy; không đổi CSSfiles hoặc provided codes. GREEN-V2 còn1assert sai vì React clear styles nhưng giữ style="" sau rerender; archive app/testV2 và đối chiếu React installed setValueForStyles. Chỉ sửa assertion thành hai style properties rỗng, không sửa app, matcher layout hoặc tolerance. Final GREEN-V3 **24/24**. Giữ mọi RED/GREEN/V1/Png/source/harness và wrapdiagnostic; browserV2 cùngfinalfixture/test, baselinepreimages.

**Kết quả:** WT và primary fresh run riêng mỗi root47file/787test+22policy/types/lint0error3warning cũ, ChromeV2after96/96; không dùng traced51PASS thay QA. Review APPROVE3hash, exact-scope/source/docs integration/scans và final guards giữ471snapshot paths/150dirty/1117old artifacts; chỉ7ownedfiles. One dark390/rootfont200 extra sample text2lines/7controls fits bothaxes, không mở rộng toànmatrix. CurrentBatchPrimaryScopedPassedtrue, historicalAuthTimeoutRootCauseProvenfalse/releaseReadyfalse; original failed gate50/trace51 vẫn nguyên, không authfix/publication hoặc hoàn tất toànTask11.
