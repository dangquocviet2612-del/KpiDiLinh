# Node 0TB — payload bản đồ rút gọn

Ngày: **28/10/2026**. Slice đầu Task9, chỉ local, không thiết kế lại giao diện hoặc đổi nghiệp vụ.

## Contract

- Bản đồ gọi `GET /api/node-0tb?projection=map`. Response vẫn gồm `nodes`, `stats`, `categories`.
- Mỗi marker chỉ giữ tám field thực sự dùng: `id`, `nodeCode`, `dateKdFormatted`, `totalPort`, `categoryKd`, `latitude`, `longitude`, `hasCoordinates`.
- Không gửi `dateKd`, `usedPort`, `note`, `nodeDescription`, `createdAt`, `updatedAt` xuống bản đồ. Không xóa chúng khỏi database hoặc API mặc định.
- Không có projection, rỗng/khác giá trị hoặc sai case đều giữ nguyên legacy response. Chỉ nhận giá trị chính xác `map`; không thay DELETE, template hoặc upload.
- Auth và getNode0TbList chạy như trước rồi mới project. Server search theo description vẫn làm trước khi bỏ description khỏi wire. Matching exact/base/prefix, thứ tự, fallback ngày/port/category, node thiếu tọa độ và thống kê toàn bộ trước filter không đổi.
- Các role ADMIN/MANAGER/CTV giữ quyền đọc hiện tại; thao tác quản trị UI vẫn ADMIN-only. Đây không phải thay đổi scope/phân quyền hoặc vá rủi ro auth/PWA.

## Triển khai

- `src/types/index.ts`: thêm Node0TbMapItem/Node0TbMapResponse; original models giữ nguyên.
- `src/lib/node-0tb-map.ts`: pure allowlist mapper, không import DB/auth, không mutate input.
- `src/app/api/node-0tb/route.ts`: opt-in projection sau kết quả legacy; mặc định giữ object cũ.
- `src/app/(dashboard)/node-0tb/Node0TbMap.tsx`: chỉ thay type names và URL. Đảo hai thay đổi đó tái tạo đúng component cũ; không đổi JSX/CSS/hooks/state/popup/handlers.
- `src/lib/node-0tb-db.ts` không đổi byte: vẫn đọc full data và thực hiện lookup cũ. Không thêm per-marker request/query/cache hoặc đổi schema/dependency.

## Kiểm chứng

- Semantic RED12fail/41pass (9 payload,3 URL), sau sửa GREEN53/53:26 unit mới,11 UI mới,15 readonly và1 tile regression cũ.20 UI files cũ/assertions giữ nguyên.
- Route tests dùng real getNode0TbList và mapper, chỉ mock auth/Prisma/readiness boundaries. Bao gồm zero/null/escaped values, future-field exclusion, frozen-input purity, order, exact/base/prefix, missing coords, global stats trước filter, description search, legacy/unknown modes, ba role, auth-before-readiness, errors/empty, một SELECT+findMany và không write/N queries.
- UI tests dùng component thật, mock Leaflet/session/fetch/browser boundaries; bao gồm popup/list/search/filter/fit/zoom/clipboard/GPS/admin menu/template/upload callback/retry và projection URL sau refresh.
- Parent WT: **26 file/387 scoped test +22 policy**, TypeScript/build đạt, login static; lint0error/2warning cũ ở hai upload routes không sửa. Env-file discovery bị chặn cho root/child; fake database/source hash giữ nguyên.
- Baseline build được dựng lại từ source đã phục hồi sau thử nghiệm CSS thất bại, không dùng stale candidate build trước. Fixture riêng16node/12có tọa độ/4thiếu, copy từ SQLite giả cũ; không sửa original fake DB hoặc dữ liệu thật.
- API thật trên cùng fixture qua12case: **6.166→3.203byte (-48,05%)**, legacy responsehash không đổi.72tóm tắt UI (text/button/disabled/overflow) khớp; **không phải complete DOM equivalence**. Retry sau500 inject trả lại đúng data/URL, không ghi nghiệp vụ/JS error/network failure bất thường.
- **Strict visual gate vẫn FAILED:** controlled lượt2 có45/48PNG khớp,3ảnh khác tại CTV missing-list/popup và2geometry/style hash khác ở error states. Chưa xác minh nguyên nhân; không gọi là vô hại/raster flake và không sửa/nới strict assertions hoặc tạo strict-success artifact.
- Review riêng cho phép **checkpoint functional local có thể hoàn nguyên**, không phải miễn/đóng image gate, hoàn tất Task9 hoặc nghiệm thu release. Primary scoped QA/source-byte gate sau tích hợp được ghi chính xác tại mục32 tiến độ.

## Số liệu

Size-only benchmark dùng chính mapper frozen, giữ cùng input/values/order/stats/categories mỗi bên:

| Profile | 1k row | 10k row | 50k row |
|---|---:|---:|---:|
| Metadata tối thiểu | -44,57% | -44,45% | -44,32% |
| Metadata thông thường, note/description ngắn | -51,44% | -51,32% | -51,21% |

Đây là JSON UTF-8/decoded bytes, không phải compressed transfer/latency/p95. Benchmark50k không query database, chạy lookup/matching hoặc render50k marker trong browser. Không dùng note dài giả tạo để đạt mục tiêu; fixture thực tế của browser được báo riêng ở mục32 tiến độ.

## Giới hạn

- Chỉ Node0TB map projection; customer map, general node map, reuse/lookup optimization, bbox/server clustering và toàn Task9 chưa hoàn tất.
- Không giảm SQL/readiness workload hoặc sửa thuật toán prefix matching; không claim backend nhanh hơn. Trường hợp ít metadata có thể không đạt mục tiêu50% dù payload vẫn giảm.
- Browser dùng API thật trên SQLite giả, nhưng tile images được fulfill tổng hợp, service worker tắt, GPS denial được inject. Không kiểm chứng provider/network thật, clipboard hệ điều hành, upload/ghi dữ liệu Production, PWA lifecycle, điện thoại thật hoặc50k-render.
- Native Windows/libsql warning và full primary failure801/815 từ mục30 vẫn mở; không chạy lại full native suite, skip/retry/pool/upgrade hoặc báo đã sửa. Các scoped checks không thay cho nghiệm thu release.
- QA ảnh/geometry vẫn chưa đạt, nên chưa nghiệm thu toàn slice; `browser-functional-after.json` là báo cáo riêng với strictGatePassed=false, không thay thế thất bại của `browser.cjs`. Strict integration/finalize helpers giữ nguyên, không dùng chúng để công bố candidate.
- Chưa commit/push/deploy. Release đã xác minh gần nhất vẫn `9d0365e`.

Plan: `docs/superpowers/plans/2026-10-28-node0tb-projection-local.md`; tiến độ mục32. Evidence private `.local/performance/node0tb-projection-20261028/`: snapshots/preimages/frozen delta, worker RED/GREEN, scoped QA/build, browser before/after, payload benchmark và manifests. Không commit SQLite/env/log/cookie/credentials hoặc business rows.
