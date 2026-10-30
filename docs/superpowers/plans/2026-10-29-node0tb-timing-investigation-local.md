# Task9 — Điều tra timing Node0TB, local 29/10/2026

## Mục tiêu và phạm vi

Tiếp mục35, kiểm tra giả thuyết instrumentation ở lượt đếm có thể ảnh hưởng timing workload sau. Không sửa app/test/config/dependency, không thao tác dữ liệu thật, không commit/push/deploy. Đây là diagnostic bổ sung, không nghiệm thu tốc độ hoặc đóng toàn Task9.

Giữ nguyên hai source đã đóng băng: trước memo từ preimage `45b9b9bb7190bbd8459a70930798e69680bb01a4d3e7cbe03e1cb5f9cddb034b`, sau memo `2208df34ad9c84a7c52ea82b798cac923a2e98aca4f27728ee79cc43cd9bbe07`. Primary đã chứa memo, không được dùng làm baseline trước memo.

## Thiết kế chốt trước khi chạy

- Hai version × hai history × hai process độc lập = tám cell, chạy tuần tự. History U không gán prototype; G dùng counting generator cũ ở lượt thứ năm rồi restore trong `finally`. Timer của cả hai không bọc observer.
- Mỗi cell dùng service/import-utils thật, chỉ giả lập Prisma/readiness boundary. Giữ generator fixture và thứ tự `grouped-fallback`, `exact-only`, `distinct-misses`, mỗi profile138/1.000/10.000/50.000 dòng.
- Một warmup, ba timed calls, một untimed call cho mỗi dataset: 60 calls/process, 480 calls toàn experiment. Hai reads và một readiness/call, cùng query/select/input và complete response hashes. Không thêm call để validation.
- Thứ tự: B_U1, A_G1, A_U1, B_G1, B_G2, A_U2, A_G2, B_U2. Không chạy đồng thời, thay cell, retry/chọn mẫu hoặc đổi endpoint sau khi thấy số liệu.
- Endpoint chính: `distinct-misses/50000`. Mỗi process cung cấp median ba mẫu thô, không pool thành sáu mẫu độc lập. Báo cả raw samples, chênh lệch ms, history ratios B_G/B_U và A_G/A_U, source ratios R_U=A_U/B_U và R_G=A_G/B_G, interaction I=R_G/R_U cho từng repetition.
- Mười một workload còn lại là contextual, không được thay endpoint chính. Không đặt threshold PASS tốc độ hoặc significance test với hai repetitions.
- Chốt hash plan/child/driver/analyzer/env guard trước child đầu. Ordinary caught error phải lưu partial rõ `failed:true`, raw samples đã đo và vị trí lỗi, rồi dừng nonzero; không phân tích partial như factorial hoàn chỉnh.
- **Tắt toàn bộ optional identity-wrapper/trace branch trước khi chạy.** Dừng ở tám cell dù kết quả theo hướng nào. Không suy cơ chế JIT/GC từ timing hay CPU/heap diagnostics.

## Hàng rào / giới hạn

Snapshot423 paths,331 source/config/test cùng candidate build `uHuPDrGeI3CACKtH0ZyOi`,89 dirty paths và161 artifacts cũ. Không sửa/xóa benchmark cũ, paired report hoặc failure evidence/UI/native. Giữ process/runtime/loader/normalizer giống nhau, không expose-gc/forced GC, cài package hay thay worker/pool để ép xanh.

CPU/memory probes và deep equality ở lượt thứ năm nằm ngoài timer nhưng vẫn có thể ảnh hưởng lịch sử thực thi. Đây không phải replay hoàn toàn protocol cũ. Process mới không loại trừ host load/thermal/scheduling/natural GC. Chỉ thay trọn gói observer history, không tách từng thao tác trong wrapper. Không đo database/cloud/API/page load/render/p95.

## Checklist và bằng chứng

- [x] Snapshot, kiểm source baseline/candidate, giữ 89 thay đổi và hash161 artifact cũ.
- [x] Review phương pháp; chốt endpoint/contrasts, bỏ optional branch và giữ failed-cell samples trước execution.
- [x] Tám cell đã đăng ký, so toàn bộ input/output/read/counter invariants, giữ tất cả raw samples; không retries/optional run.
- [x] Phân tích đủ12 workloads và hai repetitions, review độc lập mức độ kết luận.
- [x] Tích hợp đúng5 tài liệu sau backup/hash/whitespace/default secret scan; source/config/test và artifacts cũ không đổi. Gate này có integration manifest riêng, không suy từ timing result.

Kết quả và raw medians: `docs/node0tb-timing-investigation.md`. Tiến độ mục36 tại `tiendokpi.md`. Evidence riêng, không commit: `.local/performance/node0tb-timing-rca-20261029/`, gồm `starting-files.json`, `preregistered-hashes.json`, tám `cell-*.json`/logs, `matrix-result.json`, `analysis.json`, `all-workloads.md`, review và integration manifest. Plan preregistration nguyên bản/harness giữ tại staging visualization; hash trước execution có trong evidence, không thay bằng bản checklist sau execution này.

`uniqueTimingUncertaintyRemainsOpen=true`, `performanceAcceptancePassed=false`, `allTask9Complete=false`. Native full-suite crash, strictvisual, release và những mục khác không thuộc phạm vi checkpoint này. Không dùng kết quả test/build mục35 làm kết quả chạy mới của mục36.
