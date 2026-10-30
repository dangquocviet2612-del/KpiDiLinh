# Phản hồi tải công cụ nhúng

## Phạm vi

Lát cắt Task 11, mục tiến độ 45, ngày 29/10/2026. Chỉ hoàn thiện wrapper cho **Phiếu thu**, **Excel** và **Sửa ảnh**. Không đổi giao diện/nội dung bên trong công cụ, routes, query parameters, kích thước iframe hoặc quyền sử dụng.

Trước đây wrapper chỉ trả iframe với title không dấu, không có phản hồi khi khung chờ lâu. Nay giữ async server wrapper, chỉ chuyển phần theo dõi tải sang client riêng. Không thêm dependency, network probe, polling, cache-buster hoặc tự tải lại.

## Hành vi

| Tình huống | Phản hồi | Tác động đến iframe |
| --- | --- | --- |
| Vừa mở | `Đang tải công cụ …`, role status, aria-busy | Khung vẫn có cùng src/class/kích thước và không bị ẩn/inert |
| Chưa nhận load sau 15 giây | Cảnh báo tải lâu hơn dự kiến, không khẳng định mất mạng | Không hủy request, không tự tải lại; vẫn nhận late load |
| Nhận error event tại khung | Thông báo trung tính và nút tải lại | Không log/lộ exception hoặc đổi URL |
| Nhận load, kể cả sau cảnh báo | Bỏ notice/description, đặt aria-busy=false và dọn timer | Không thay iframe hoặc tuyên bố tác vụ bên trong đã thành công |
| Bấm `Tải lại công cụ` sau slow/error | Có cảnh báo mất tệp/chỉnh sửa chưa lưu trước nút | Thay iframe cùng src/query, reset attempt/timer và đưa focus vào khung mới |
| Đổi công cụ/src hoặc unmount | Dọn state/timer attempt trước | Không để timer/event của DOM cũ thay trạng thái attempt mới |

Ngưỡng 15 giây là **cảnh báo của UI**, không phải request timeout hoặc performance budget. Callback timer không chuyển trạng thái đã load thành slow. Reload chỉ chủ động từ người dùng; không tự khôi phục tệp hoặc dữ liệu chưa lưu.

## Truy cập và cấu trúc

- Server `ToolPageFrameClean.tsx` vẫn `await ensureToolsAccess()` trước khi tạo client element. `ADMIN`/`MANAGER` được vào; role khác về `/`; thiếu session về `/login` như trước.
- `_lib.ts`, asset GET route, auth/backend và ba page truyền src không sửa. Không đưa tool-assets ra public hoặc nới quyền; test guard dùng auth/redirect giả, không kiểm tra session thật.
- `ToolFrameClient.tsx` dùng keyed attempts. Mỗi attempt có state, timer, frame ref và ids riêng. Thay src/reload remount đúng attempt; rerender cùng props không tải lại khung đang dùng.
- React 19 cài tại repo đăng ký non-delegated load cho iframe, không gắn error listener target tương tự ảnh. Handler dùng `onErrorCapture` để nhận non-bubbling error nếu event được phát; không suy diễn browser luôn phát event này.
- CSS module riêng chỉ thêm notice và wrapper position tương đối, giữ `page.module.css`/iframe100dvh cũ. Dùng theme tokens hiện có, chữ wrap, nút tối thiểu44px và focus-visible; không animation mới hoặc thay palette/toolbar.
- Notice nằm đè trong khung, không thêm hàng phía trên đẩy iframe xuống. Chưa đo CLS, pixel/contrast/mobile/browser thật; overlay có thể che một phần nội dung nếu cảnh báo vẫn hiện. Không bảo đảm nội dung bên trong responsive hoặc tải xong scripts.

## Bằng chứng kiểm thử

Test mới `tests/ui/tool-frame-feedback.test.tsx`: 25 case với React DOM thật, fake timers và auth/router giả, không render/fetch tài nguyên thực bên trong iframe.

- RED trên wrapper cũ: **11 fail / 14 pass**, lỗi do thiếu title có dấu/feedback/aria/reload, không import/setup error.
- Implementation đầu: 2 fail vì React iframe `onError` không nhận non-bubbling event. Đối chiếu React cài sẵn, đổi app sang capture; còn1fail vì assertion đếm timer.
- Diagnostic giữ riêng: timer15giây thuộc app; timer0ms phát sinh từ jsdom `SelectionImpl._associateRange` khi focus iframe mới. Test chỉ flush0ms trước assertion lifecycle, không tăng deadline, mock focus, xóa assertion, đổi timer config hoặc suppress failure. Final focused **25/25 pass**; các lần lỗi/log cũ giữ nguyên.
- Bao phủ3tool titles/src/attrs; allowed/forbidden/missing/pending auth; load/slow/error/late-load; reload/unchanged src/focus; detached old events; src change, same-props render và unmount từ4state.
- **Worktree và primary chạy riêng đều đạt41file/692scoped test +22policy**, TypeScript nonincremental đạt, ESLint0error/3warning cũ. Không cộng hai lượt hoặc gọi selection là full suite. Không retry unchanged code để ép xanh, tăng timeout, skip, dependency/config changes.
- Static review độc lập đối chiếu plan trước quality review, APPROVE đúng4file/hashes; không thay code sau freeze. Reviewer không chạy tests/browser hoặc xác nhận Production. Parent chạy QA/integration riêng, không dùng lời review thay kiểm thử.
- Source integration có preimage/backup, whitespace/default secret scan không finding; source/docs manifests và final-check kiểm snapshot443paths, inventories,114thay đổi cũ và639artifact cũ. Chỉ8ownedfile:4source/test và4docs; mọi file API/guard/asset/menu và tests có sẵn ngoài phạm vi giữ nguyên. Không branch/commit/push/deploy.

### Source identity đã kiểm thử và review

| File | SHA256 |
| --- | --- |
| `src/app/(dashboard)/tools/ToolPageFrameClean.tsx` | `97184a539c56b9e8c3c1191299e43e119c762bee6f4a19fb6da5923a5b5b1dd6` |
| `src/app/(dashboard)/tools/ToolFrameClient.tsx` | `0a4387d801da3cd09408d246b21fee8e6d6c6a0bdf4958e903cb851210bf4d1c` |
| `src/app/(dashboard)/tools/ToolFrameClient.module.css` | `90c39d904083deb81eb5d1201d9b6eedd0bc7388d8f969da2cacc0058b1c5bce` |
| `tests/ui/tool-frame-feedback.test.tsx` | `78dbdd30ca96cc8d791adbca84062fe62b54b864e7535f370ed42c4a43d347b8` |

Evidence private `.local/performance/tool-frame-feedback-20261029/`: snapshot/preimage, RED và mọi lần GREEN/diagnostic, frozen source hashes, review, QA, scans/backups và manifests. Không commit evidence, env, DB, token hoặc dữ liệu kinh doanh.

## Giới hạn còn mở

1. Iframe `load` **không xác nhận HTTP200, session còn hiệu lực hoặc app-ready**: HTTP401/403/404/HTML tải xong nhưng JS lỗi vẫn có thể phát load. Không thêm status probe/postMessage hoặc sửa internals để suy luận kết quả.
2. Browser không bảo đảm phát iframe error. Slow notice chỉ xuất hiện nếu chưa nhận load; không bắt được mọi lỗi CDN/camera/file processing trong công cụ. Điều hướng nội bộ của iframe không có load-start protocol riêng.
3. Hydration/JavaScript, browser timer throttling/tab nền và network scheduling có thể làm thời điểm cảnh báo khác15giây thực. Đây không phải no-JS recovery hoặc cancel/retry guarantee.
4. Tải lại thực sự bỏ state trong iframe; chỉ cảnh báo trước thao tác, không backup/restore file, auto retry hoặc recovery transaction. Focus/ARIA có test DOM, chưa nghiệm thu keyboard/screen-reader/browser thật.
5. Không real auth/asset HTTP/browser/mobile/full native Windows/libsql, fresh build hoặc Production benchmark. Native crash/KPI timeout/ảnh và timing Node0TB cùng release gates cũ vẫn mở. Không dependency upgrade, commit/push/deploy hoặc hoàn tất toàn Task11.

## Files liên quan

- Server: `src/app/(dashboard)/tools/ToolPageFrameClean.tsx`.
- Client/style: `src/app/(dashboard)/tools/ToolFrameClient.tsx`, `ToolFrameClient.module.css`.
- Boundary giữ nguyên: `src/app/(dashboard)/tools/_lib.ts`, `chia-file-son/[[...path]]/route.ts`, `page.module.css` và3page receipt/excel/photo.
- Plan: `docs/superpowers/plans/2026-10-29-tool-frame-feedback-local.md`.
