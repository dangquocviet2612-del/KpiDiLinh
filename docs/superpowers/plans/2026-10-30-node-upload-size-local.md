# Node upload file-size — Implementation Plan, checkpoint 62

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Keep all changes local; do not commit, push or deploy.

**Goal:** Tiếp validation theo giới hạn hosting trong Task 12 cho ba chức năng nhập dữ liệu của bản đồ Node, giữ nguyên giao diện và nghiệp vụ.

**Architecture:** Áp dụng cùng policy 4.000.000 byte của checkpoint61 nhưng có helper/public key riêng cho Node. `VERCEL=1` chọn server cap; Next config phát numeric public cap 4000000 hoặc0 tại build. Client chặn File.size trước busy/FormData/POST; server kiểm lại sau ADMIN auth/formData/File check và trước buffer/XLSX/ZIP/XML/DDL hoặc dữ liệu nghiệp vụ. Local/non-Vercel giữ hành vi trước đây. Không đổi customer-import helper/config key đã làm ở61.

**Tech Stack:** Next/React/TypeScript, Vitest/RTL, bộ dependencies hiện có.

## Phạm vi

- Sửa `next.config.ts`, `src/app/api/nodes/upload/route.ts`, `src/app/(dashboard)/node-map/NodeMapComponent.tsx`.
- Thêm `src/lib/node-upload-limits.ts`, `tests/unit/node-upload-size.test.ts`, `tests/ui/node-upload-size.test.tsx`.
- Tạo `docs/node-upload-size.md`, plan này; cập nhật roadmap và nối mục62 trong `tiendokpi.md`.
- KML/KMZ vị trí, Excel hiệu suất và Excel node thuê bao dùng cùng endpoint `/api/nodes/upload`; chỉ ADMIN như trước. Không sửa parser, SQL/batches/schema/cache, lời xác nhận thành công, report, CSS/menu, dependencies hoặc tests/config/pool/deadline cũ.
- Không thêm storage/job, chi phí, migrations hay đọc/ghi dữ liệu/env thật. Không tăng proxy/timeout. Không tự khắc phục các historical auth/native failures bằng đổi tests hoặc chạy lại tới xanh.

## Checklist

- [x] Snapshot501publicpaths/364source-config-test, HEAD/index/build id,13primarydirty/249WTdirty và1818old artifacts; kiểm instructions, reuse worktree hiện có.
- [x] Thêm20API+36UI cases: RED25fail31pass/56 trước sửa, đúng thiếu size gate; fake auth/ORM/transport, real XML/ZIP goldens, metadata boundaries và input reset.
- [x] Helper/numeric config/ba UI preflight/API gate nhỏ nhất; GREEN56/56. V1 scoped1004/policy/lint đạt, types phát hiện fixture Buffer inference; giữ V1, chỉ thêm annotation Uint8Array ở test mới, không đổi app/assertions/oldtests.
- [x] Spec rồi quality APPROVE đúng6hash V2; worktree V2 và repo chính mỗi nơi fresh56file1004scoped+22policy/types/lint0warning và actual Next config/staticEnv probes4000000/0 đạt. Giữ V1 typefailure/candidate riêng, không suy native/browser/release acceptance.
- [x] Quét secret mặc định/redacted, whitespace/inventory/backups làm cổng tích hợp4docs/append62; chỉ xác nhận khi final integrated manifest đạt. Ghi rõ các gate còn mở; không commit/push/deploy.

## Kiểm tra và giới hạn

Run focused: `npm.cmd test -- tests/unit/node-upload-size.test.ts tests/ui/node-upload-size.test.tsx` trong synthetic environment; parent runner tắt discovery .env thật, không đổi Vitest config. Broad gate giữ selection61 và thêm unit mới, UI folder tự lấy test mới; chạy22 policy tests, TypeScript nonincremental, ESLint src+nextconfig+newtests max-warnings0. Next loader probes phải giữ customer key4000000/0, thêm node key4000000/0, đúng hai numeric public keys, proxy vẫn64mb (normalized67108864).

Đây là file-byte preflight, không phải cap toàn multipart/ZIP expansion/số dòng/SQLtime. `formData()` vẫn đọc body trước API gate; platform có thể reject trước handler. Không hướng dẫn chia KMZ thủ công như thể luôn hợp lệ; thông báo chia file chỉ là hướng dẫn chung, cần xuất tập dữ liệu nhỏ hơn bằng công cụ nguồn khi phù hợp. Prebuilt client config cần rebuild đúng platform; runtime gate độc lập. Full Next build/browser/3role, full native Windows/libSQL và Node0TB visual/timing chưa được nghiệm thu trong slice này.

Tham chiếu policy61: `docs/customer-import-size.md`. [Vercel Function limits](https://vercel.com/docs/functions/limitations), [Next config env](https://nextjs.org/docs/app/api-reference/config/next-config-js/env).
