# Tool iframe feedback — local implementation plan

> **For agentic workers:** Use superpowers:executing-plans and test-driven-development. Continue the approved Task11 slice; no publication.

**Goal:** Các công cụ Phiếu thu/Excel/Sửa ảnh có phản hồi tải, cảnh báo chờ lâu và phục hồi thủ công, không đổi nội dung hoặc quyền.

**Architecture:** Giữ async server wrapper và `await ensureToolsAccess()` trước khi trả client. Client chỉ theo dõi iframe load/error và một timer cảnh báo 15giây; mỗi lần đổi src/tải lại là một attempt tách state/timer. Không probe/fetch thêm, không sửa assets hoặc coi load là xác nhận HTTP200/khởi tạo ứng dụng thành công.

**Tech Stack:** React state/effect/useId, Next server/client boundary, CSS module với theme tokens hiện có, Vitest/RTL fake timers; không dependency mới.

## Phạm vi và lựa chọn đã chốt trong Task11

- Chỉ Việt hóa metadata/iframe title và bổ sung feedback, không thiết kế lại công cụ. Loading overlay nhỏ không hide/inert iframe, không đổi kích thước khung100dvh hiện có.
- Không polling/reload tự động: có thể làm mất file/chỉnh sửa đang thực hiện. Sau15giây chỉ cảnh báo “tải lâu hơn dự kiến”, vẫn nhận late load; khi error có thông báo trung tính, không lộ chi tiết.
- Nút `Tải lại công cụ` chỉ xuất hiện sau slow/error; kèm cảnh báo mất tệp/thay đổi chưa lưu. Click thay iframe cùng src/query, reset timer/state; không thêm cache-buster hoặc điều hướng top-level.
- Notice dùng status/alert và iframe title/description/busy; nút44px, wrap trên mobile, theme tokens sẵn có. Giữ khung khi load để không kéo nội dung lại từ đầu; không claim CLS/mobile/pixel acceptance khi chưa đo browser thật.
- Guard page/asset vẫn nguyên: ADMIN/MANAGER được vào, STAFF/unknown bị redirect, chưa đăng nhập về login. Không tăng quyền hoặc expose assets public.

## Checklist

- [x] Đối chiếu Task11, wrapper/guard/asset route, theme và snapshot hai checkout; giữ mọi thay đổi/evidence cũ.
- [x] Viết RTL tests trước app; xác nhận RED do thiếu feedback/metadata, không do import/setup error.
- [x] Thêm client attempts và CSS cô lập, nối wrapper sau server guard; chạy GREEN và review độc lập.
- [x] QA scoped tests/policy/types/lint ở worktree rồi primary bằng env giả; không gọi DB/API/auth thật hoặc full native suite.
- [x] Cập nhật guide/roadmap/tiến độ45, kiểm whitespace/secret scan và snapshot/inventories/hash; không branch/commit/push/deploy.

## Files

- Modify `src/app/(dashboard)/tools/ToolPageFrameClean.tsx`.
- Create `src/app/(dashboard)/tools/ToolFrameClient.tsx`, `src/app/(dashboard)/tools/ToolFrameClient.module.css`, `tests/ui/tool-frame-feedback.test.tsx`.
- Docs `docs/tool-frame-feedback.md`, plan này, roadmap `2026-10-26-web-ux-performance.md`, `tiendokpi.md`.

## Verification

Focused run bằng private synthetic runner `run.cjs worktree red` rồi `green`; runner dùng `envDir:false` và chặn env file discovery. QA cùng selection40file/667test của mục44 cộng test mới, policy22, `tsc --noEmit --incremental false`, `eslint src tests/ui/tool-frame-feedback.test.tsx`; chạy riêng hai checkout, không cộng counts.

Kết quả: RED11fail/14pass → implementation đầu2fail do handler non-bubbling → capture còn1fail timer-count → trace jsdom focus timer0ms/flush đúng0ms → final25/25. Giữ tất cả artifacts; không suppress/skip/timeout config changes. WT và primary đều41file/692test+22policy/typesPASS, lint0error/3warning cũ; static review APPROVE exact4hashes. Scope chỉ hoàn tất lát cắt này, không đóng toànTask11 hoặc các release gate.

## Không bao gồm

Browser iframe load có thể xảy ra với HTTP401/403/404 hoặc HTML đã tải nhưng script lỗi, còn onError không được browser bảo đảm. Timer không hủy request, không chứng minh mất mạng; nội dung/camera/CDN/file-processing của tool không nằm trong wrapper acceptance. Không native Windows/libsql full-suite, old visual/Node0TB timing fixes, real browser/mobile/screen-reader/performance acceptance, build, deployment hay thay policy. Các gate cũ vẫn mở.
