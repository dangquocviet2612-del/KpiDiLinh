# Bản đồ khách hàng: payload tọa độ node

> Checkpoint functional Task 9, local 29/10/2026. Không phải nghiệm thu toàn Task9/native/visual/release. Không commit/push/deploy, đổi database thật hoặc dependency.

## Mục đích và hợp đồng

Bản đồ khách hàng chỉ dùng ID, tên, vĩ độ và kinh độ của node cho việc tìm node gần nhất, vẽ đường nối và xác nhận gán node. Giữ giao diện/thuật toán hiện tại; không loại metadata khỏi API dùng chung cho các màn hình khác.

| Consumer | Request | Dữ liệu |
| --- | --- | --- |
| Bản đồ khách hàng | `GET /api/nodes?projection=coordinates` | `{ data: [{ id, name, latitude, longitude }] }` |
| Bản đồ node thường và consumer cũ | `GET /api/nodes` | Legacy đầy đủ, gồm description, port, hiệu suất, ngày và trạng thái |
| Projection không đúng chính xác | Empty/unknown/case khác | Legacy đầy đủ, không tự suy ra chế độ rút gọn |
| Mapping/tài khoản/template | Các `view` và `downloadTemplate` cũ | Bỏ qua projection, giữ thứ tự xử lý/quyền/scope/paging/content headers như cũ |

Customer bootstrap vẫn là `/api/customers/map-data?hasCoordinates=true&includeDetails=true&take=10000`. Không thay customer DTO, tìm kiếm, quyền hoặc endpoint cập nhật khách hàng.

## Implementation và cache

- `src/lib/node-coordinates.ts`: pure allowlist mapper `projectNodeCoordinates`; tạo object/array mới, giữ đúng giá trị/thứ tự/số dòng. Không lọc tọa độ zero/null, normalize tên, thêm fallback hay truyền các trường tương lai.
- `src/types/index.ts`: thêm `NodeCoordinateItem`/`NodeCoordinatesResponse`, giữ nguyên các model và Node0TB DTO trước đó.
- `src/app/api/nodes/route.ts`: opt-in chỉ trên nhánh default list, sau auth/các nhánh view/template như trước. Cả cache hit lẫn miss đều project tại response boundary.
- **`nodes:list` luôn lưu full legacy payload**, không lưu slim DTO hoặc tạo key phụ. Giữ TTL 60 giây, generation capture ở route entry trước await, setter generation và invalidation cũ. Coordinate-first rồi legacy-hit và legacy-first rồi coordinate-hit đều phải được kiểm thử với cache/core thật.
- `src/app/(dashboard)/map/MapComponent.tsx`: chỉ đổi import/type state node và URL node request. Không chỉnh JSX/CSS, hooks, tính khoảng cách, thứ tự tie-break, handlers, modal hay request ghi dữ liệu.
- Không đổi query SQL/readiness hoặc thêm per-marker request. Không phải tối ưu database, server clustering, shared cache nhiều instance hay single-flight.

## Kiểm thử bắt buộc

- Unit: route/cache/core/mapper thật, mock auth/Prisma/readiness/mapping/template boundaries. Kiểm tra hai thứ tự cache, purity/field allowlist, auth trước reads, generation stale-fill, lỗi, legacy fallback và các nhánh view/template.
- UI: component thật, mock Leaflet/browser/session/network; kiểm tra node URL/customer URL, chọn/tìm khách hàng, nearest/polyline, confirmation và payload PUT hiện có. Không thêm UI cho event `assignNode` nếu không có entry point sẵn.
- Giữ nguyên tất cả test/assertions cũ, bao gồm 21 file UI trước slice này và Node0TB.
- Scoped regression, 22 policy checks, full TypeScript, lint, build; sau tích hợp chạy scoped checks tại primary và đối chiếu source/config/test với candidate đã build.
- Browser dùng API thật trên bản sao SQLite tổng hợp riêng; ba role ADMIN/MANAGER/CTV, desktop/mobile và app light/dark. Provider images giả, service worker tắt, GPS denial/error inject riêng. Hủy confirmation, chặn mọi business write; database/hash giữ nguyên.
- So decoded node JSON, legacy/customer/scoped-view hashes, một initial node request/một customer request và nearest/polyline/UI summaries trước/sau. Summaries không phải toàn DOM; ảnh chỉ chẩn đoán, không có claim pixel equivalence.

## Kết quả

Semantic RED **11 fail/34 pass → GREEN45/45**, gồm 33 unit và 12 UI mới. RED là response shape/URL mismatch thật, không phải thiếu helper. Original 21 file UI và tất cả test cũ giữ nguyên. Mechanical reversal của route/component và original types byte-prefix đều khớp baseline.

Candidate local đạt **32 file/470 scoped test**, **22 policy test**, full TypeScript và build; login static. Lint 0 error/2 warning cũ ở upload Node0TB (`skippedRows`) và upload node (`readSheetObjectRows`). Không cộng các lượt test chồng nhau hoặc gọi scoped run là full-suite PASS. Spec và quality review độc lập đều APPROVE sáu frozen source hashes, không sửa source trong review. Gate primary/integration ghi riêng ở mục 33 của `tiendokpi.md`.

Browser trước/sau **12 ca** trên cùng SQLite tổng hợp: 3 role × 390/1440px × app light/dark. Actual API node JSON **3.312 → 1.268 byte**, giảm **2.044 byte/61,71%**, giữ 14 node và bốn field đúng nguyên giá trị/thứ tự. Legacy-full node, customer payload và scoped node-account view hashes không đổi; customer scope ADMIN10/MANAGER10/CTV5 giữ nguyên.

Cả hai phía đều có một initial node request/một customer request, nearest confirmation đúng tên/khoảng cách 0m của fixture, polyline giữ nguyên. **48 UI summaries** (text/button/disabled/link/overflow) khớp; GPS-denied/customer500/retry đạt. Không business write, không JS error/network failure ngoài các abort đã phân loại chặt, fake DB/hash giữ nguyên. Không phải toàn DOM/pixel-equivalence; không xác nhận browser PUT trên dữ liệu thật.

Size-only benchmark chạy chính frozen mapper trên cùng input ở hai phía:

| Dataset tổng hợp | Dòng | JSON trước (byte) | JSON sau (byte) | Giảm |
| --- | ---: | ---: | ---: | ---: |
| Metadata tối thiểu | 1.000 | 196.300 | 81.300 | 58,58% |
| Metadata tối thiểu | 10.000 | 1.972.900 | 822.900 | 58,29% |
| Metadata tối thiểu | 50.000 | 9.908.900 | 4.158.900 | 58,03% |
| Metadata thông thường | 1.000 | 242.300 | 81.300 | 66,45% |
| Metadata thông thường | 10.000 | 2.432.900 | 822.900 | 66,18% |
| Metadata thông thường | 50.000 | 12.208.900 | 4.158.900 | 65,94% |

Giữ exact retained values/order/zero và input không mutate. Đây là decoded JSON, không có query DB/browser render/latency ở benchmark này.

## Giới hạn còn mở

- Chỉ giảm response node của bản đồ khách hàng. Customer payload 10.000 dòng, node-map legacy/full metadata, SQL/lookup, viewport/clustering và toàn Task 9 chưa hoàn tất.
- Thứ tự node khi khoảng cách bằng nhau, giá trị zero/null và các guard tọa độ hiện tại được giữ, không coi slice này là sửa mọi lỗi tọa độ.
- Đo decoded JSON không đồng nghĩa giảm cùng tỷ lệ compressed transfer, tổng trang, p95, backend SQL hay thời gian render. Benchmark 50.000 dòng mapper không phải render 50.000 marker.
- Native Windows/libsql reliability/full-suite gate vẫn mở: lần primary trước 801/815 test hoàn tất rồi native worker exit3221225477. Không retry/skip/pool/upgrade để ép xanh, không chạy lại full native trong slice này.
- Gate strict visual Node0TB trước vẫn mở: 3 PNG và 2 error-geometry khác chưa rõ nguyên nhân. Kết quả functional slice này không thay thế hay miễn gate đó.
- JWT revocation/permission version/đa instance, nguyên nhân `/api/me`500 cũ, điện thoại/provider/PWA/slow-network thật và release QA vẫn pending.
- Chưa commit/push/deploy; release đã xác minh gần nhất vẫn `9d0365e`.

## Evidence và rollback

Plan `docs/superpowers/plans/2026-10-29-customer-map-node-projection-local.md`; tiến độ mục 33 của `tiendokpi.md`. Evidence private `.local/performance/customer-map-node-projection-20261028/` lưu snapshot/preimages, RED/GREEN, source review hashes/diff, scoped logs, build, browser, benchmark và integration manifest. Không commit SQLite/env/log/cookie/credentials hoặc business bodies.

Giữ nguyên các thay đổi local trước. Rollback có chủ đích bằng preimages/hash của đúng sáu source/test và tài liệu slice này; không reset toàn checkout hoặc phục hồi file đã được người khác sửa tiếp mà chưa so hash. Để tắt consumer opt-in có thể quay URL node của bản đồ khách hàng về `/api/nodes`; endpoint legacy không thay đổi dữ liệu đã lưu.
