# Thống kê tài khoản CTV gọn trên mobile

## Phạm vi và hành vi

Mục tiến độ49, ngày29/10/2026, tiếp Task11; local, chưa commit/push/deploy. Màn Danh sách CTV giữ đủ4chỉ số, nhãn và chú thích nhưng chuyển từ4hàng thành lưới2×2 khi viewport≤640px. Không thêm nút thu gọn, bản DOM thứ hai, state theo viewport hoặc thư viện.

- Region có tên `Thống kê tài khoản CTV`; ô tìm kiếm có tên `Tìm tài khoản CTV`, placeholder và handler cũ giữ nguyên.
- CSS giảm padding/min-height/gap trong scope tài khoản; không giảm font/line-height, ẩn chữ, thay theme tokens/palette hoặc đổi thứ tự4chỉ số. Số dùng tabular-nums/overflow-wrap trong scope mobile.
- SearchField có `flex: 1 1 380px` cho layout ngang. Dưới640px, toolbar chuyển sang column làm basis380px trở thành chiều cao, để trống336px bên dưới input44px và đẩy icon xuống giữa wrapper. Reset `flex-basis: auto` riêng searchField trong mobile listToolbar sửa đúng nguyên nhân; không sửa global input hay padding/width của nó.
- Trên641px và màn Cấu hình KPI không nhận layout compact. CSS statsGrid dùng chung không bị đổi toàn cục.
- Không đổi request `/api/users`, filter loại ADMIN, phép đếm role/GPS, search username không phân biệt case, API/guard server, dữ liệu, modal hoặc quyền. Counts vẫn theo toàn bộ users đã tải, không theo search. Hint cũ “CTV đang hoạt động” không phải bằng chứng implementation kiểm trạng thái active: hiện vẫn chỉ đếm roleCTV.
- Ba menu Tồn CDT/Rời mạng/Nguy cơ rời mạng tiếp tục ẩn; không tối ưu/bật lại module không dùng.

## Đo hình học trước/sau

Chrome cài sẵn render actual CtvClient qua React SSR, ConfirmDialogProvider thật, CSS modules/global/child CSS thật và adapter Next link/router riêng harness. **Chỉ initial state0counts/loading**, không giả state nội bộ React. Không Next server/build, hydration, auth/API/DB hoặc dashboard shell. Dữ liệu sau tải được kiểm bằng RTL riêng, không suy rộng ảnh SSR thành E2E.

Matrix32case:7width360/390/640/641/768/1024/1440 ×2theme ×2view(users/config)=28, cộng4case root-font200% trên desktop1440. Đây không phải browser zoom hay điện thoại thật. Before V5 dùng đúng preimages đã lưu, fixture/test không đổi. Theme/font được đặt trong HTML trước layout đầu, không đo trong lúc transition đang chạy.

| Viewport | Chiều cao stats trước → sau | Search lên sớm hơn | SearchField trước → sau | Khối nội dung sau toolbar lên sớm hơn |
| --- | --- | --- | --- | --- |
| 360px | 479.17 →253.44px | 225.73px | 380 →44px | 561.73px |
| 390px | 479.17 →235.72px | 243.45px | 380 →44px | 579.45px |
| 640px | 479.17 →200.28px | 278.89px | 380 →44px | 614.89px |

Số đo từ fixture initial-state light; dark cùng kết quả compact. Khối nội dung là loading-state dưới toolbar, **không phải phép đo vị trí row đã tải hoặc tốc độ API**. Trước sửa6mobilecase không đạt compaction/searchField/icon và16case thiếu accessible names; sau sửa32/32case đạt. Toàn bộ text ranges trong cards, icon nằm giữa input;26case noncompact/config geometry không đổi chính xác. Không dùng pageOverflow diagnostic để kết luận cả app đạt responsive.

Parent xem PNG before/after390px. Các PNG là component cô lập, chưa nghiệm thu cả trang hay design mới.

## Tests và giới hạn bằng chứng

- `tests/fixtures/ctv-user-stats.ts`: tài khoản/KPI giả, không thông tin kinh doanh. `tests/ui/ctv-user-stats.test.tsx`:10case React DOM, auth/router/fetch giả; named region/search/scope, totals loạiADMIN,4hints, search/clear/no-match không refetch, empty/loading/error/retry và nhánh KPI config.
- TDD trước app: RED2fail/8pass vì thiếu region/search name; sau app GREEN10/10. Không dùng jsdom làm bằng chứng layout.
- **Worktree và primary chạy riêng đều đạt45file/749scoped test +22policy**, TypeScript toàn project nonincremental đạt; ESLintsrc+test/fixture mới0error/3warning cũ. Mỗi root ChromeV5after32/32case,26noncompact geometry unchanged. Không cộng hai lượt thành testcase khác nhau, dùng focused/reviewer thay primary gate, sửa/skip/suppress tests có sẵn, tăng deadline, thay dependencies/config hoặc chạy full native suite.
- Source integration có backup/preimage, whitespace/default secret scan không finding; docs có gate tương tự. Tổng8ownedfile gồm2app/2fixture-test/4docs; manifests/final-check đối chiếu461snapshot paths, inventories,138thay đổi local cũ/887artifact cũ. Mọi application/test khác giữ nguyên, HEAD/index/buildId cũ không đổi. Không branch/commit/push/deploy hoặc dùng build cũ để nghiệm thu candidate.
- Exact-scope chứng minh toàn bộ component chỉ đổi2vị trí thuộc tính JSX; CSS chỉ một insertion trong media640. Các hooks/handler/strings/request/filter/serverguard giữ nguyên so preimage. Freeze4hash trước review/QA; fixtures giống nhau before/after browser.
- Review static độc lập đã APPROVE spec trước quality cho đúng4hash; không finding critical/important, không thay QA/integration gate. Không sửa app/test sau freeze.

## Harness corrections được giữ lại

- V1 không tạo case vì Next router context; sửa private adapters, không coi đây là regression ứng dụng.
- V2 có32case nhưng chưa nhập child CSS nên không dùng làm visual baseline cuối; V3 bổ sung child CSS, xác nhận khoảng trống search, V4 mở rộng phép đo wrapper/icon/list-start.
- V4after các target mobile đã đạt nhưng comparison root-font200%desktop lệch subpixel. Diagnostic chứng minh root font đổi sau render kích hoạt `transition: all 0.25s` của input: height37.1875px trong lúc chuyển, settled72.375px. V5 đặt font/theme trước layout thay vì nới tolerance/tắt animation/thêm sleep hoặc sửa app; baseline lấy preimages nên không cần revert candidate.
- Lần đầu exact-scope verifier sai thứ tự thuộc tính search mong đợi. Sửa expected string của private verifier (aria-label thực tế sau placeholder), không đổi application/tests hoặc browser assertions. Các failed logs/diagnostic/sources trước đó giữ nguyên.

## Chưa được nghiệm thu

- Mobile font200%, loaded cards với nhiều chữ/số thực, screen reader, keyboard toàn trang, IME, điện thoại thật, Next navigation/hydration/modal/CRUD/role/session hoặc mạng chậm/offline.
- CLS, RUM, request latency/payload hay Production speed. Đợt này giảm không gian dọc, không tuyên bố tăng tốc load.
- Full native Windows/libsql và timeout KPI cũ chưa xác định nguyên nhân; old Node0TB visual/timing, Task10 SQL scope/identity mapping và release gates vẫn mở. Không dùng build Next cũ để nghiệm thu candidate, không build/deploy hoặc truy cập database thật.
- Mixed checkbox Task11 tách phần CTV đã làm khỏi card/account rỗng chưa làm; toàn Task11 chưa hoàn tất.

Evidence private `.local/performance/ctv-user-stats-compact-20261029/`: snapshots/preimages, RED/GREEN, browserV1–V5/PNG/SSRHTML, font diagnostic, frozen hashes, exact-scope, review, QA, scans, integration manifests/final-check. Các file này local/ignored, không đưa env/DB/log/token hay thông tin tài khoản thật vào Git.
