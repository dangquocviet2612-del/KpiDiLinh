# Schema auth timeout — local investigation plan

> Continue pending gate from progress50 using systematic-debugging and verification-before-completion. Local diagnostics only; no speculative auth/test changes or publication.

**Goal:** Xác định timeout xảy ra trong nạp module hay handler, không gọi một lượt test xanh là đã sửa lỗi.

**Architecture:** Private Vite pre-transform đúng2vị trí trong `invoke` của test `schema-auth-order.test.ts`, thêm timestamp start/end quanh route.load và handler promise. Public files/config không thay đổi. Fixed test-name/pid/sequence capture đầu mỗi invocation tránh attribution sai khi kết quả về muộn; mỗi run ghi artifact riêng, envDir:false và env-file guard. Không ghi request body/session/token hoặc gọi auth/database thật.

**Tech Stack:** Installed Vitest/Vite, synthetic mocks sẵn có, Node process stdout/performance timestamps; không Next server/build/browser hoặc dependency mới.

## Checklist

- [x] Snapshot469paths,148dirty và artifacts cũ; lưu preimages/source/config và original pending primary failure.
- [x] Đối chiếu test hooks/resetModules/route.load và import graph; tách các giả thuyết import delay/handler delay/scheduling, chưa coi giả thuyết là kết luận.
- [x] Focused trace61case với212events; instrumentation match chính xác1file/2marker, không thay assertion/mock/reset/deadline/pool/project config.
- [x] Một broad diagnostic có trace cùng46file/763test để quan sát, không là uninstrumented acceptance rerun.
- [ ] Nếu tái hiện: đối chiếu complete spans/late events/test identity, trace deeper import/handler và event-loop scheduling trước sửa root cause. Nếu không tái hiện, lưu trạng thái unknown/pending, không ép repro bằng sleep hoặc tăng timeout.
- [x] Review độc lập phạm vi instrument và tính trung thực của kết luận; kiểm preservation/hash/docs/secret scan, cập nhật mục51.

## Kết quả quan sát

V1focused61/61, GETusers import109.11ms /handler1.60ms; V1broad46file/763test, import262.09ms /handler3.40ms;212events mỗi lượt, không tái hiện timeout5000ms. Không so thời gian này với Production hoặc khẳng định nguyên nhân lượt lỗi cũ. Broad trace còn observer effect; giữ original primary762/763 fail và pending manifest mục50 nguyên vẹn.

V2stable-context focused đã đạt61/61,212events53sequence; GETusers import96.82ms/handler1.55ms. Không có timeout để sửa; bước repro/root-cause giữ unchecked, không chạy lại bộ rộng chỉ để lấy xanh. Toàn app/test/fixtures/config/runtime/dependencies và3menu ẩn giữ nguyên. Chỉ4tài liệu public: guide mới `docs/schema-auth-timeout-investigation.md`, plan này, roadmap `2026-10-26-web-ux-performance.md`, append51 `tiendokpi.md`. Không branch/commit/push/deploy, native suite/libsql/Node0TB/build/real DB/env hoặc tài khoản thật. Consistency checks của recorded successful runs không kiểm chứng mọi failure path của tracer; driver vẫn lưu raw artifacts khi fail để điều tra riêng.

Review static độc lập APPROVE2runner/driver hash; preservation/backup/scan/whitespace kiểm riêng, không suy từ review. Scope-only completion của điều tra không đóng original failed gate: `primaryScopedAcceptancePassed:false`, `releaseReady:false`, original root cause unknown. Chỉ4docs tích hợp, không runtime/CI feature mới.
