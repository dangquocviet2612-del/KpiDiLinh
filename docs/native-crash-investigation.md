# Điều tra native test crash trên Windows — 28/10/2026

## Kết luận có bằng chứng

Đã tái hiện access violation **độc lập mã app, Prisma và Vitest**, trong tiến trình chỉ nạp `libsql` và tạo database `:memory:`. Điều này xác nhận binding native/finalization có thể gây cùng loại crash; **chưa có native stack của lần full-suite gốc**, nên chưa kết luận chính xác frame C/Rust hoặc mọi crash đều cùng cơ chế. Không ghi “đã sửa” chỉ vì test chạy lại đạt.

Giữ nguyên application code, package manifests/lockfile, database/env thật và 21 thay đổi local batch6–8. Không đổi pool, skip test, retry tự động, suppress exit code, ép GC làm workaround, nâng dependency hoặc cài WSL/Docker.

## Runtime và đối chứng

| Thành phần | Quan sát |
|---|---|
| Runtime | Node 24.13.1, Windows x64, N-API 10 |
| Installed | `@libsql/client 0.17.0`, `libsql/@libsql/win32-x64-msvc 0.5.22`, Prisma client/adapter 7.4.1, Vitest 5.0.1 |
| Native artifact | Primary và checkout cùng SHA256 `3c21711f7f23f7d4f088e5cf581098cf753fb93ebcd22cb4200a1f05d36a178f`; binary có chuỗi `libsql-0.9.23` |
| Metadata npm public | Stable latest quan sát là `libsql 0.5.29`; chỉ đọc metadata, không cài. Chưa kiểm chứng bản đó sửa đúng crash của máy này. |
| Linux local | Không tìm thấy Docker CLI hoặc distro WSL đã đăng ký trong kiểm tra; chưa chạy nghiệm thu Linux. |

## Các thí nghiệm

| Thí nghiệm cố định | Kết quả | Có thể kết luận |
|---|---|---|
| Direct Node, hai client/file, 60 vòng, 480 Prisma SELECT song song rồi disconnect/close | Đạt | Chưa tái hiện trên shape này; không chứng minh lifecycle nói chung an toàn. |
| File `tests/integration/kpi-report-equivalence.test.ts` với trace testcase và đúng cwd | 60/60 đạt | Các assertion golden giữ nguyên; pass một lượt không sửa được lỗi gián đoạn. |
| Matrix đầu 18 child process, concurrency 2, mỗi mode 6 process × 300 DB trống; GC chỉ phục vụ kích hoạt lỗi | Xem ba dòng dưới | Không cần app/ORM/test runner, không dùng URL/env database. |
| `libsql`, đóng DB tường minh | 6/6 exit 0 | Chưa crash trong mẫu nhỏ này, **không** chứng minh close() là workaround chắc chắn. |
| `libsql`, để GC/finalizer xử lý | **4/6 exit 3221225477 (0xC0000005)** | Một child đã ghi JavaScript complete và exit handler code 0 trước khi parent thấy native crash. |
| Control `node:sqlite`, DB in-memory, đóng tường minh | 6/6 exit 0 | Control không tái hiện trong cùng mẫu; không suy ra đây là so sánh benchmark/độ ổn định dài hạn. |
| Control bổ sung `node:sqlite` **không close**, cùng GC workload (6 child riêng, không chạy lại matrix cũ) | 6/6 exit 0 | Đối chứng khớp điều kiện native-unclosed; tổng hai thí nghiệm là 24 child. |
| Một full run có reporter trace, cùng app/config, env discovery tắt | **59/59 file, 696/696 test đạt**, không unhandled error | Full hiện tại đạt trong lượt này; **native risk vẫn mở** vì bare-binding matrix còn tái hiện lỗi. |

Lượt instrumented file đầu chạy sai cwd của helper gây lỗi migration path và cleanup “no such table”. Giữ riêng `native-file-harness-cwd-error*`; đó là lỗi harness, **không tính** làm bằng chứng lỗi app hoặc native. Không có thay đổi source/assertion giữa lượt full fail cũ và lượt full có trace.

Launcher matrix đầu kết thúc code 0 vì đã thu thập xong báo cáo, nhưng JSON lưu nguyên bốn child exit 3221225477; **không dùng parent code 0 làm native pass**. Harness cuối đã bổ sung trả nonzero khi bất kỳ child lỗi. Không chạy lại matrix cũ để thay các kết quả đã ghi.

## Đối chiếu upstream

- Maintainer mô tả hai cơ chế native: unload addon khi worker kết thúc và double `sqlite3_close_v2` khi connection bị drop, tại [libsql-js PR235](https://github.com/tursodatabase/libsql-js/pull/235).
- Core fix làm disconnect idempotent được merge tại [libsql PR2261](https://github.com/tursodatabase/libsql/pull/2261). Merge core không tự chứng minh npm binding đang cài chứa fix.
- [Issue231](https://github.com/tursodatabase/libsql-js/issues/231) có báo cáo cùng mã exit với Windows/Node/Vitest forks. Đây là đối chiếu cơ chế, **không thay cho native stack của repo này** và không chấp nhận workaround retry trong comment.

## Những gì chưa xác minh

- Frame native chính xác của crash full-suite gốc; không có matching Application fault event đọc được trong khung giờ kiểm tra, không mở dump bộ nhớ có thể chứa dữ liệu nhạy cảm.
- Bản npm binding đã phát hành nào chứa fix và qua regression trên đúng Windows/runtime này. Không tự thay database library hoặc dùng prerelease.
- Nghiệm thu Linux/WSL/CI: chưa có môi trường Linux local đã xác minh, không tự cài môi trường toàn máy hoặc push để kích hoạt CI.
- Có các cleanup gap khi setup/disconnect thất bại trong fixture, nhưng **không có bằng chứng chúng gây crash gốc**; không sửa các gap đó rồi tuyên bố hết native crash.

## Tái lập an toàn và gate

Chỉ dùng script chẩn đoán trong child process với DB trống in-memory, không chạy với DB thật. Trong thư mục repo, snippet tối giản sau có thể kích hoạt native finalizer; một lần pass không phủ nhận lỗi:

```powershell
node --expose-gc -e "const Database=require('libsql'); for(let iteration=0;iteration<300;iteration++){new Database(':memory:'); if(iteration%25===0)global.gc()}global.gc()"
$LASTEXITCODE
```

Không dùng `global.gc()` hoặc bỏ close() làm code vận hành. Harness đã chạy có phase logs, parent thu actual exit codes, số lượt cố định và control. Giữ nguyên `.local/performance/batch8/primary-tests.log`/status fail. Bằng chứng mới ở `.local/performance/native-crash-20261028/`; không đưa artifacts/SQLite/env/credentials vào Git.

**Gate tin cậy native Windows chưa đóng.** Có thể ghi full-run ngày 28/10 đạt, nhưng không đổi trạng thái “native crash fixed” hoặc chứng nhận release hoàn tất. Đóng gate Windows cần binding được vá và regression kiểm chứng; có native stack chỉ hỗ trợ chẩn đoán. Nghiệm thu Linux nếu được duyệt là gate runtime riêng, không chứng minh Windows đã sửa. Các phần giảm bundle/UI vẫn là roadmap riêng.

## Kiểm tra bản stable sau crash mục 30 — 28/10/2026

Primary vừa gặp worker exit3221225477 trong `tests/integration/cache-invalidation.test.ts`: 801/815 test hoàn tất, 62/63 file; giữ nguyên log và kết quả fail. Lần kiểm tra tiếp theo này chỉ đọc metadata/source public, **không chạy lại suite hoặc stress matrix**, không cài package hay sửa dependency/app/test để cố lấy kết quả xanh.

| Kiểm tra | Bằng chứng | Kết luận giới hạn |
|---|---|---|
| npm stable | Metadata public `libsql/latest`: 0.5.29, gitHead `55bee86d1c284f1ddf2b9e280e870d2b6cef884a`, optional Windows package0.5.29 | Mới hơn installed0.5.22 không đồng nghĩa đã chứa fix |
| Core được release khai báo | [Cargo.toml v0.5.29](https://github.com/tursodatabase/libsql-js/blob/v0.5.29/Cargo.toml), [Cargo.lock v0.5.29](https://github.com/tursodatabase/libsql-js/blob/v0.5.29/Cargo.lock): libsql0.9.30 | Đối chiếu core tag cụ thể, không chỉ nhìn version JS |
| Core disconnect | [libsql-0.9.30 connection.rs](https://github.com/tursodatabase/libsql/blob/libsql-0.9.30/libsql/src/local/connection.rs): gọi close, không gán null cho raw handle sau đó | Source core tag chưa có thay đổi idempotent disconnect của PR2261 |
| Pin addon | [src/lib.rs v0.5.29](https://github.com/tursodatabase/libsql-js/blob/v0.5.29/src/lib.rs) thiếu hàm pin_module_in_memory/GetModuleHandleExW mà [PR235](https://github.com/tursodatabase/libsql-js/pull/235) bổ sung | Không tìm thấy fix pin đó trong source release này; không suy ra mọi crash cùng cơ chế |

**Quyết định:** Chưa thiết lập được một stable binding candidate đã có fix để nâng thử trong repo. Giữ package/lockfile/native artifact hiện có, không dùng prerelease/custom binary, sửa JS quanh native hoặc đổi pool làm workaround. Các đối chiếu là bằng chứng **source/metadata**; chưa tải/kiểm tra/chạy binary npm0.5.29, không chứng nhận binary build provenance hoặc dùng source absence làm native stack của lần crash mới.

Trước khi sửa thật cần chọn một trong hai đường riêng:

- Tiếp tục các tối ưu web độc lập trong roadmap, giữ cảnh báo native/Windows release gate mở và ghi đúng kết quả từng kiểm tra. Hạng mục đề xuất kế tiếp là Task9 payload bản đồ, chưa được triển khai trong audit này.
- Thống nhất môi trường Linux để nghiệm thu riêng nếu owner muốn ưu tiên hướng đó; chưa cài WSL/Docker, chạy CI cloud hoặc push branch. Linux pass cũng không chứng minh Windows đã hết lỗi. Không hứa kết quả trước khi chạy.

Snapshot lần này **407file/323source**, giữ67 thay đổi local trước. Evidence private `.local/performance/native-stable-audit-20261028/`: metadata/raw source URL+hash, `audit.json`, `starting-files.json` và manifest tích hợp tài liệu. Helper v1 giả định sai upstream dùng module pin; patch thực tế thêm hàm pin_module_in_memory trong lib.rs. Giữ helper/lỗi cũ, sửa riêng phép kiểm tra trên response đã lưu, không fetch/test lại để thay kết quả native fail.

Chi tiết mục31 của `tiendokpi.md`. Không commit/push/deploy; không thay kết luận lịch sử ở mục26/30 thành đã sửa.
