# Customer query feedback implementation plan

> Continue approved Task11 locally with TDD and scoped review checkpoints. No commit/branch/push/deploy, real env/auth/database, dependency/config/pool/timeout changes or full native reruns.

**Goal:** Giữ kết quả khách hàng trước đó khi đổi bộ lọc/trang hoặc refresh; phân biệt tải lần đầu, cập nhật và lỗi, không báo rỗng sai.

**Architecture:** `useCustomers` giữ request key, debounce500/300ms, SWRoptions/cache/mutate/selection/paging/permissions. Chỉ derive hasData, pending filter comparison và refreshing; loading chỉ khi chưa có data. Customer page dùng status strip khi chờ (cả debounce), AsyncState error/retry có sẵn, regionbusy ở list riêng để không nuốt live feedback. Retry manual có ref guard, consume rejection vì hookerror là nguồn hiển thị; không toast thành công/tự retry mới hoặc xóa filters.

**Tech Stack:** Existing React/SWR2.4.1/CSSmodules/AsyncState, RTL với SWR thật + fetch deferred giả; Chrome SSR isolated với query/session props giả. Không Next build/hydration/real API/DB/device/actualzoom hoặc speed acceptance.

## Bằng chứng và lựa chọn thiết kế

- Installed SWR index giữ laggyDataRef khi key mới chưa có cache, nhưng isLoading vẫn true nếu cache key đó chưa có data. Hook hiện `isLoading || (isValidating && !data)` nên page thay rows bằng skeleton dù data cũ vẫn có. Page bỏ qua error hook nên initialerror có thể hiện Chưa có khách hàng; refreshfail có thể im lặng.
- Cách chọn: giữ data+nhãn chờ/lỗi rõ, reuse existing components. Không chọn xóa rows mỗi request; không URL hóa/tái kiến trúc cache trong cùng batch.
- Chỉ một production caller. Không suy dữ liệu cũ khớp filter/page mới: strip và stale-error copy nhắc rõ khả năng chưa khớp. Không thêm live-success theo pageprop.
- Có khoảng debounce trước request: so sánh đủ7raw/debounced filters để báo chờ ngay. Không thay delay hoặc request sequence khi resetpage có thể tạo intermediate key như cũ.
- Cachedempty cũng là hasData; pending/error không được hiện empty-state khẳng định kết quả mới. Initialsuccess-empty vẫn giữ copy/actions hiện có.

## Files

- Modify `src/hooks/useCustomers.ts`, `src/app/(dashboard)/customers/page.tsx`, `src/app/(dashboard)/customers/customers.module.css` (chỉ selector strip mới và scopederror retry44px).
- Create `tests/ui/customer-query-feedback.test.tsx` (SWR/page thật, chỉ mock auth/router/currentuser/fetch).
- Docs `docs/customer-query-feedback.md`, plan này, roadmap Task11 và append55 `tiendokpi.md`.

## Checklist

- [x] Rà source/callers/AGENTS/installedSWR, snapshot483paths/356source-config-test paths/163dirty/1396oldartifacts; reuse WT.
- [x] RED từ tests mới trước app:22tests RED21fail1pass→GREEN22. Bổ sung race đổi filter khi retry cũ pending RED1fail22pass→GREEN23. RealSWR/fetch giả, không sửa tests cũ.
- [x] Minimal hook/page/CSS, GREEN. Retry guard theo page/limit/filteridentity và attempt identity; filter/page/limit/data không mutate. Browserv1 setup0case do aliasrouter; giữ lỗi riêng, không gọi appRED. Browserv2 chạy96case lộ24retryheightfail(font100%,40.796875px ở390). Giữ v1candidate/QA/review/hashes; v2candidate chỉ thêm queryErrorclass và2scopedmin44declarations, không nới phép đo, globals hay dependencies.
- [x] ChromeSSR6states/6width/lightdark/rootfont200: V4 mỗi root96/96,48mobile/48desktop-tablet; containment/44px/text/state/rows/busy/no falseempty/backenddetail/pageoverflow đạt. V3 đo geometry đạt nhưng ảnh mờ giữa slideUp350ms có sẵn; V4 chờ finite animation kết thúc và assert opacity1/transformnone, không sửa app/sleep tùy ý hoặc nới đo. Giữ V1–V3. RowDOM/lifecycle preservation từ RTL, oldCSS/row/pagination source preservation từ exact-scope, không claim browser before-after geometry hay fullapp/device/zoom/speed acceptance.
- [x] Freeze4hashv2, spec trước quality review độc lập APPROVE; fresh scoped WT/primary mỗi root50file842test +22policy/TypeScript nonincremental/lint0error3warning cũ. Không dùng focused/reviewer/SSR thay primary.
- [x] Backup/whitespace/defaultscan/source/docs guards, progress append-only; kiểm483snapshot paths/356source-config-test paths,163dirty/1396oldartifacts/HEAD/index/oldBUILD_ID và8ownedpaths. Historical auth/native/Node0TB/Task10/Task11/release gates giữ mở, releaseReadyfalse; chưa publish.

## Kết luận giới hạn

Hoàn tất implementation và kiểm thử phạm vi local của feedback/retry, không phải toàn Task11 hoặc nghiệm thu tốc độ production. Query/debounce/mutate/cache options/công thức/quyền không đổi. Tránh false-empty và giữ dữ liệu cũ không đồng nghĩa data luôn khớp filter mới; copy cảnh báo nói rõ. Status/error xuất hiện vẫn có thể đổi chiều cao trang; chưa CLS/RUM/apphydration/auth/device/screenreader acceptance. Bước sau URLwhitelist/back-forward là scope riêng.
