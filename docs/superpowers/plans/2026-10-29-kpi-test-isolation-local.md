# Kế hoạch local: điều tra timeout và cách ly observation của KPI test

> Thực hiện tiếp roadmap Task 8/13 sau mục 37. User dừng push/deploy. Không đổi application code hoặc truy cập database/env thật.

## Mục tiêu và giới hạn

Tìm bằng chứng trước khi sửa timeout; không tăng budget, đổi pool/isolation, bỏ test/assertion hoặc chuyển chi phí import vào hook để che lỗi. Chỉ sửa lỗi fixture có thể tái hiện độc lập. Dùng Next dynamic thật và fetch giả; env discovery bị chặn bằng guard và runner `envDir:false`.

## Checklist

- [x] Snapshot 427 union paths, 331 source/config/test paths, 93 dirty paths và hash 348 artifact cũ; primary và worktree có cùng source tại lúc bắt đầu.
- [x] Baseline hai file một lần: 76/76 đạt. Trace hai file một lần: 76/76, nhưng reporter không xuất console của test đạt; ghi rõ không có phase evidence từ cell này.
- [x] Đăng ký trước một broader trace 34 file, giữ nguyên body/deadline/assertions. Thu 207 events và restore chính xác file gốc. Kết quả 571/572; KPI đạt, GET-users schema-auth timeout. Không sửa lỗi không thuộc phạm vi hoặc gọi selection này xanh.
- [x] Không thấy cross-epoch trong trace; root cause timeout cũ chưa chứng minh. Independent audit không xác định lỗi cần sửa trong current-user test, giữ file đó nguyên trạng.
- [x] Hai regression gọi chính registered factory, chủ động đổi observation owner. RED hai semantic fail/20 testcase cũ đạt, rồi capture array/map/set tại registration và truyền set vào effect cleanup. GREEN hai file 78/78.
- [x] Freeze đúng test SHA-256 trong guide; kiểm tra toàn bộ 20 testcase cũ không đổi sau chuẩn hóa line ending. Không sửa app/config/dependencies.
- [x] Hai broader cell sau sửa đúng ngân sách: worktree một lần rồi primary một lần; mỗi nơi 34 file/574 test +22 policy đạt, TypeScript nonincremental đạt, ESLint src + test 0 error/3 warning có sẵn. Giữ mọi failure trước sửa, không retry đến khi xanh.
- [x] Spec rồi quality APPROVE exact hash; test có backup/preimage, whitespace và default secret scan trước primary integration. Manifest docs xác nhận kiểm tra tương tự cho 4 tài liệu, inventories, 93 thay đổi cũ và 348 artifact cũ.
- [x] Cập nhật mục 38 và roadmap theo kết quả thật; tổng phạm vi 1 test + 4 tài liệu, chỉ local. `integrated-files.json` là bằng chứng tích hợp cuối; không commit/push/deploy hoặc đóng reliability/native/visual/performance/release gate.

## Điểm dừng

Hoàn tất lát cắt fixture không đồng nghĩa hoàn tất điều tra timeout hoặc roadmap. Nếu test rộng vẫn timeout, giữ artifact và báo đúng trạng thái thay vì thêm thử nghiệm tùy ý. Không chạy full-native Windows suite, app build/browser, dependency upgrade/audit mạng hoặc thực nghiệm với dữ liệu thật.

Tham khảo `docs/kpi-test-isolation.md`, mục 38 `tiendokpi.md`. Evidence private `.local/performance/kpi-test-isolation-20261029/` giữ cả failed attempts và original restoration.
