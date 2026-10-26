# Architecture Map

> Snapshot: `main@21cf430`. Tài liệu này mô tả đường đi đã được chứng minh trong source từ frontend đến API, service/helper, database và integration ngoài. Thành phần không có caller hoặc không có đường vận hành được đánh dấu riêng.

## 1. System context

```text
Browser
  -> Next.js App Router pages/client components
  -> Route handlers dưới /api/*
  -> auth()/role checks + scope helpers + domain helpers
  -> Prisma Client dùng PrismaLibSql adapter
  -> SQLite local hoặc Turso/libSQL remote

Browser/route handlers
  -> Tile maps, Google Maps links, Zalo links, VietQR image service,
     browser geolocation, CDN libraries, KML/KMZ/Excel files
```

Các tầng chính:

| Tầng | Vị trí | Vai trò |
|---|---|---|
| Frontend | `src/app/(dashboard)/**`, `src/components/**`, `src/hooks/**` | Pages, panels, tables, maps, forms và client data fetching. |
| API | `src/app/api/**/route.ts` | Auth/role enforcement, validation, import/export, CRUD và report. |
| Domain/helpers | `src/lib/**` | Scope, KPI calculations, runtime DDL, archive, mapping, QR và utilities. |
| Persistence | `src/lib/prisma.ts`, Prisma schema/migration, runtime SQL | Prisma qua libSQL adapter; schema vừa declarative vừa lazy/runtime. |
| External | Tile providers, Google Maps, Zalo, VietQR, CDN, browser APIs | Map, liên hệ, QR, tools và vị trí. |

## 2. Cross-cutting request flow

```text
/login
  -> NextAuth Credentials provider (`src/auth.ts`)
  -> Prisma `User`
  -> bcrypt compare
  -> JWT session chứa username/role

/(dashboard)/*
  -> server layout gọi auth()
  -> thiếu session: redirect /login
  -> có session: Sidebar + page

/api/*
  -> `src/proxy.ts`: rate limit một số endpoint, block /api/seed và /api/setup
  -> route handler tự gọi auth() và tự kiểm tra role/scope
  -> không còn central token gate cho mọi API
```

### 2.1 Role/scope map

| Role | `getAllowedCtvCodes()` | UI chính | Quyền quản trị đặc thù |
|---|---|---|---|
| `ADMIN` | `null` = toàn bộ | Mọi dashboard domain | User/CTV, imports/configs, archive, logs, backup, công văn, node datasets |
| `MANAGER` | Username các `User.role='CTV'` có `managerCode` bằng username manager | Customer/map và reports thuộc đội; KPI tổng hợp/quản lý; tools nâng cao | Một số import như Cước CĐ; không có archive/log/user write |
| `CTV` | Mảng chỉ chứa username bản thân | Customer/map và reports của mình; KPI calculator; QR | Không có admin screens; một số API guard chưa hoàn toàn khớp UI |

Evidence: `src/lib/scope.ts`, `src/components/Sidebar.tsx`, từng route handler. Scope cache in-memory 30 giây.

## 3. Domain flow map

### 3.1 Identity và user administration

| Capability | Frontend | API | Service/helper | Database | External |
|---|---|---|---|---|---|
| Login/logout | `/login`, Sidebar logout | `/api/auth/[...nextauth]` | `src/auth.ts` | `User` | NextAuth Credentials, bcrypt |
| Current user | Dashboard shell/components | `/api/me` | `auth()` | Session/JWT; optional `User` lookup | — |
| Change password | `/change-password` | `POST /api/change-password` | bcrypt verify/hash | `User.password` | — |
| User/CTV admin | `/ctv`, `CtvClient.tsx` | `/api/users`, `/api/users/[id]` | role checks; password hashing | `User` | — |
| Scope | Customer/report screens | Embedded in domain APIs | `src/lib/scope.ts` | `User.username`, `role`, `managerCode` | — |

### 3.2 Customer CRM

```text
/customers
  -> useCustomers / refined table + modal + import UI
  -> /api/customers, /api/customers/[id], /api/customers/bulk
  -> auth + scope + customer-node assignment + history diff
  -> Customer, EditHistory, CustomerNodeMapping, Node

notes UI
  -> /api/customers/[id]/notes
  -> author/admin delete rules
  -> CustomerNote -> User/Customer relations

import/export
  -> /api/import, /api/export, /api/template
  -> XLSX parse/write + validation + node assignment
  -> Customer + CustomerNodeMapping + Node
```

| Capability | Frontend | API | Service/helper | Database | External |
|---|---|---|---|---|---|
| List/search/filter | customers page, `useCustomers` | `GET /api/customers` | scope/filter builders | `Customer`, `User` | — |
| Create/update/delete | `CustomerModalRefined`, table actions | `/api/customers`, `/api/customers/[id]`, `/bulk` | assignment/date/history helpers | `Customer`, `EditHistory`, `CustomerNodeMapping` | — |
| Notes | `CustomerNotesRefined` | `/api/customers/[id]/notes` | auth/author checks | `CustomerNote` | — |
| Excel import | `ImportModal` | `POST /api/import` | parse, validation, partial update | `Customer`, `Node`, mapping | XLSX upload/download |
| Export/template | customers actions | `/api/export`, `/api/template` | query/scope + workbook generation | `Customer` | XLSX |
| Contact | table/modal/map popup | Không qua app API | URL builders | Phone fields | Zalo, `tel:` |

### 3.3 Customer map

```text
/map -> CustomerMap
  -> /api/customers/map-data      -> scoped marker dataset -> Customer
  -> /api/customers/search-map    -> scoped server search -> Customer
  -> /api/customers/[id]          -> detail/update -> Customer + history/mapping
  -> shared useMapSearch          -> debounce + abort + short-lived cache
  -> Leaflet tiles/markercluster + browser geolocation + Google Maps/Zalo links
```

| Frontend behavior | Data/API path | Integration/notes |
|---|---|---|
| Marker cluster, popup và search | map-data/search-map/detail APIs | Leaflet + native markercluster |
| Chọn/cập nhật tọa độ | customer detail update | Browser geolocation/map click |
| Tạo khách hàng tại vị trí hiện tại | customer create | UI tham chiếu `canUseGps`; API không enforce cờ |
| Chỉ đường/liên hệ | URL trực tiếp | Google Maps, Zalo |

`/api/customers/map-detail` tồn tại nhưng không thấy caller hiện tại; flow map dùng ba route nêu trên.

### 3.4 Node map, node import và customer-node mapping

```text
/node-map -> NodeMapComponent
  -> GET /api/nodes                -> Node + runtime efficiency columns
  -> GET /api/node-search-map      -> search name/coordinate/nearest
  -> POST /api/nodes/upload        -> KML/KMZ/Excel dispatcher
       -> geographic nodes         -> Node
       -> efficiency workbook      -> ALTERed Node columns
       -> subscriber mapping       -> CustomerNodeMapping
  -> GET /api/nodes/template       -> XLSX templates
  -> Leaflet tiles + Google Maps links
```

| Capability | Frontend | API/helper | Data | External |
|---|---|---|---|---|
| Map/search/filter/export | `NodeMapComponent.tsx` | `/api/nodes`, `/api/node-search-map` | `Node`, mapping lookup | Leaflet tiles, browser geolocation, Google Maps |
| KML/KMZ import | Node map admin controls | `/api/nodes/upload`; XML/KMZ parsers | `Node` | Uploaded KML/KMZ; AdmZip/XML DOM |
| Efficiency import/template | Node map admin controls | upload/template routes; `node-efficiency-db.ts` | Runtime columns on `Node` | XLSX |
| Subscriber-node mapping | Upload panel + node popup | upload route; `customer-node-mapping-db.ts` | `CustomerNodeMapping`, `Customer`, `Node` | XLSX |

### 3.5 Node 0TB

```text
/node-0tb -> Node0TbClient
  -> GET /api/node0tb             -> search/filter/pagination -> Node0Tb
  -> POST /api/node0tb/upload     -> XLSX parse -> Node0Tb
  -> GET /api/node0tb/template    -> XLSX template
  -> DELETE /api/node0tb          -> clear dataset
  -> ensureNode0TbTable()
       -> CREATE TABLE IF NOT EXISTS Node0Tb
       -> nếu rỗng, thử đọc file tuyệt đối mặc định trên máy phát triển
```

Map UI dùng Leaflet/tiles, browser geolocation và Google Maps links. Đọc dành cho mọi session; upload/delete chỉ Admin.

### 3.6 KPI

```text
/prepaid (personal)
  -> /api/kpi/report
  -> ensureKpiTables + score helpers
  -> KpiDailyResult + KpiMetricConfig

/prepaid?view=summary
  -> /api/kpi/summary
  -> scoped aggregation
  -> KpiDailyResult + KpiMetricConfig + User

/prepaid?view=summary-manager
  -> /api/kpi/manager-summary
  -> ManagerKpiDailyResult + User hierarchy

Admin imports/config
  -> /api/kpi/import, /api/kpi/manager-import, /api/kpi/config
  -> XLSX + runtime tables

/prepaid?view=kpi-calculator
  -> /api/kpi/report for source values
  -> client-side simulation in kpi-calculator helpers
  -> no database write
```

| Capability | Frontend | APIs | Service/helper | Data |
|---|---|---|---|---|
| Personal KPI | `PersonalKpiPanelClean` | report | `kpi-calculation.ts`, `kpi-db.ts` | `KpiDailyResult`, `KpiMetricConfig` |
| Summary | `SummaryKpiPanelClean` | summary | scope + aggregation | KPI tables, `User` |
| Manager KPI | `ManagerSummaryKpiPanelClean` | manager-summary/import | manager hierarchy/aggregation | `ManagerKpiDailyResult`, `User` |
| Config/import | CTV admin/KPI panels | config/import | XLSX parsing, archive lock | KPI config/results |
| Calculator | `KpiCalculatorPanelClean` | report read only | `kpi-calculator.ts` | Không write |

### 3.7 Billing: Cước và Cước CĐ

| Domain | Frontend | API | Service/helper | Database | External |
|---|---|---|---|---|---|
| Cước report | `CuocPanelClean` | `/api/cuoc/report` | scope + summary helpers | `CuocDailyResult`, `CuocConfig` | — |
| Cước import/config | Cước admin controls | `/api/cuoc/import`, `/api/cuoc/config` | XLSX parse, archive-month lock | same tables | XLSX |
| Cước CĐ report | `CuocCdPanelClean` | `/api/cuoc-cd/report` | scope + summary | `CuocCdDailyResult`, `CuocCdConfig` | — |
| Cước CĐ import/config | Cước CĐ controls | `/api/cuoc-cd/import`, `/api/cuoc-cd/config` | XLSX parse; optional hard-coded local file path | same tables | XLSX/local filesystem fallback |

Các bảng billing được tạo trong `src/lib/kpi-db.ts`, không có trong Prisma schema/migration. CTV report đi qua scope nhưng một số controls/summary bị ẩn ở frontend.

### 3.8 CDT và tồn CDT

```text
/prepaid?view=cdt
  -> /api/cdt/report, /api/cdt/summary
  -> scope/filter/aggregation
  -> CdtTransaction

Admin import/export
  -> /api/cdt/import, /api/cdt/export
  -> XLSX <-> CdtTransaction

/prepaid?view=cdt-outstanding
  -> /api/cdt/outstanding/report
  -> joins/matches outstanding account with Customer scope
  -> CdtOutstandingRecord + Customer
  -> admin import/template via sibling routes
```

### 3.9 Disconnect và churn risk

| Domain | Frontend | APIs | Service/helper | Database | External |
|---|---|---|---|---|---|
| Disconnect report | `DisconnectPanelClean` | `/api/disconnect/report` | scope, source/parser, overdue UI helpers | `DisconnectRecord`, `User` mapping | — |
| Disconnect import/template | Admin controls | `/api/disconnect/import`, `/api/disconnect/template` | FTTH/TV workbook parsing | `DisconnectRecord` | XLSX |
| Churn risk report | `/churn-risk` | `/api/churn-risk/report` | scope + month/search/pagination | `ChurnRiskRecord` | — |
| Churn risk import | Churn admin controls | `/api/churn-risk/import` | XLSX parse | `ChurnRiskRecord` | XLSX |

Tests xác nhận một phần mapping `secondaryCode`, parse source, mobile summary/cutoff và KPI calculator change summary; không có API e2e.

### 3.10 Official documents

```text
/prepaid?view=official-docs -> OfficialDocsPanelClean
  -> GET/POST /api/official-docs
  -> GET/PUT/DELETE /api/official-docs/[id]
  -> upload/assets/temp routes
  -> ensureOfficialDocumentTables()
  -> OfficialDocument
     + OfficialDocumentAsset
     + OfficialDocumentTempAsset
     + OfficialDocumentRevision
```

| Flow | Auth/visibility | Storage/integration |
|---|---|---|
| List/read | Session; non-Admin chỉ `PUBLISHED` và chưa hết hạn | SQL runtime tables |
| Create/update/delete/publish | Admin | Document + revision |
| Upload/inline media/files | Admin write; authorized read | External URL hoặc base64 `fileData` trong DB |
| Pinned/order/category/search | Admin config; mọi authorized reader dùng | Document fields/query |

### 3.11 Archive, logs và backup

```text
/archive (Admin)
  -> /api/archive/export  -> XLSX snapshot + ArchiveExportLog
  -> /api/archive/confirm -> validate past month/fresh export -> ArchiveLog + import lock
  -> /api/archive/cancel  -> cancel before purge
  -> /api/archive/purge   -> delete archived month data
  -> /api/archive/status  -> status + fire-and-forget expired purge check
  -> /api/archive/cron    -> secret-protected purge check

/logs (Admin)
  -> /api/logs            -> list/delete EditHistory
  -> /api/admin/backup    -> JSON export/restore selected tables
```

| Capability | Service/data | Limitation |
|---|---|---|
| Archive state/export freshness | `ArchiveLog`, `ArchiveExportLog`, archive helpers | Cron endpoint không chứng minh scheduler. |
| Import locking | KPI/Cước import routes kiểm tra confirmed archive month | Phạm vi lock cần được duy trì thủ công khi thêm domain import mới. |
| Edit log | Prisma `EditHistory` | Admin customer writes không được ghi cùng cách. |
| Backup/restore | Route đọc/ghi Prisma và runtime tables | Thiếu Cước CĐ, churn risk, Node0TB; không phải full database backup. |

### 3.12 Business tools

| Tool | Frontend | API/server role | Data | External |
|---|---|---|---|---|
| Photo editor | `/tools/photo` -> `ToolPageFrameClean` -> static app | `/api/tools/assets/[...path]` đọc allowlisted tool assets | Không persistence app | Geolocation, Leaflet/OSM, html2canvas CDN |
| QR | `/tools/qr` | `/api/tools/qr-image`, `tools-qr.ts` tạo/proxy image URL | Không persistence app | `img.vietqr.io`, BIDV template |
| Receipt | `/tools/receipt` static app | Asset route + Admin/Manager page guard | Client memory/import | XLSX/print/CDN |
| Excel filter/split | `/tools/excel` static app | Asset route; helper có thể gọi `/api/users` | Client workbook | ExcelJS/FileSaver/JSZip/XLSX CDN |

Receipt và Excel không có navigation entry từ commit `bf805e3`, nhưng architecture path vẫn tồn tại.

## 4. Data architecture

### 4.1 Prisma-declared models

| Model | Dùng bởi |
|---|---|
| `User` | Auth, role/scope, CTV/manager hierarchy, ownership display |
| `Customer` | CRM, maps, import/export, CDT outstanding matching, node assignment |
| `EditHistory` | Customer audit log |
| `Node` | Node map, nearest-node assignment, efficiency runtime columns |
| `CustomerNote` | Customer notes |

`prisma/migrations/20260228000000_init/migration.sql` chỉ tạo `User`, `Customer`, `EditHistory`, nên migration không khớp ngay cả toàn bộ Prisma schema hiện tại.

### 4.2 Runtime-created tables/columns

| Helper | Runtime objects |
|---|---|
| `src/lib/kpi-db.ts` | `KpiMetricConfig`, `KpiDailyResult`, `CuocDailyResult`, `CuocCdDailyResult`, `ManagerKpiDailyResult`, `CdtTransaction`, `CdtOutstandingRecord`, `DisconnectRecord`, `ArchiveLog`, `ArchiveExportLog`, `CuocConfig`, `CuocCdConfig`, `ChurnRiskRecord` |
| `src/lib/customer-node-mapping-db.ts` | `CustomerNodeMapping` và `accountAddress` ALTER |
| `src/lib/official-docs-db.ts` | `OfficialDocument`, `OfficialDocumentAsset`, `OfficialDocumentTempAsset`, `OfficialDocumentRevision` và asset ALTERs |
| `src/lib/node-0tb-db.ts` | `Node0Tb` |
| `src/lib/node-efficiency-db.ts` | ALTER `Node`: `totalIntPort`, `usedPort`, `portEfficiency`, `dateKd`, `efficiencyStatus` |

Hệ quả kiến trúc: route đầu tiên của từng domain có thể là nơi tạo/nâng schema; migration-only provisioning không đủ và schema drift khó được Prisma tooling phát hiện.

### 4.3 Backup coverage map

| Được backup | Không thấy trong backup hiện tại |
|---|---|
| Users, customers, nodes, edit history, notes | `CuocCdDailyResult`, `CuocCdConfig` |
| KPI config/results, manager KPI, Cước | `ChurnRiskRecord` |
| CDT transaction/outstanding, disconnect | `Node0Tb` |
| Archive logs, Cước config | Temp official-doc assets (có thể là chủ ý) |
| Official docs/assets/revisions | Bất kỳ bảng runtime mới nào không được route cập nhật thủ công |
| Customer-node mapping | — |

## 5. Background jobs và operational paths

| Path | Trigger | Authentication | Data effect | Trạng thái bằng chứng |
|---|---|---|---|---|
| `/api/archive/cron` | External GET/POST caller | `ARCHIVE_CRON_SECRET` | Purge archive quá hạn | Endpoint có; scheduler không có trong repo. |
| `checkAndPurgeExpired()` | Status/export/confirm/cancel/purge requests | Theo route Admin | Opportunistic purge | Active theo request; fire-and-forget ở một số route. |
| PWA service worker generation | Production build | Build config | Cache/service worker output | Config có; runtime/offline chưa xác minh. |
| Lazy schema initialization | Domain route call | Theo route | `CREATE TABLE`/`ALTER TABLE` | Active và phân tán theo domain. |
| Node0TB default file load | Bảng rỗng và helper chạy | Theo request | Import file local hard-coded nếu tồn tại | Environment-dependent, không portable. |
| Cước CĐ default file load | Import flow/nhánh file mặc định | Theo route | Đọc file local hard-coded nếu tồn tại | Environment-dependent, không portable. |

Không tìm thấy worker queue, message broker, background worker process hoặc cron config khác.

## 6. External dependency boundaries

| Boundary | Caller | Failure impact quan sát được từ kiến trúc |
|---|---|---|
| Turso/libSQL | Toàn bộ persistence | App data unavailable; local fallback chỉ khi URL cấu hình như vậy. |
| Tile providers | Map screens và photo tool | Map nền không tải; dữ liệu app vẫn có thể tồn tại. |
| Google Maps links | Map directions | Không mở được điều hướng ngoài app. |
| Zalo links | Customer contact actions | Không mở được contact flow ngoài app. |
| VietQR image host | QR tool/API | Không preview/download được QR. |
| Browser geolocation | Maps/photo | Không lấy được current position; các flow nhập tay/map click vẫn tùy screen. |
| CDN libraries trong tool assets | Photo/receipt/excel | Tool static có thể không khởi tạo hoặc export nếu CDN bị chặn. |

## 7. Architecture gaps và orphan paths

- Auth không tập trung cho toàn bộ API; mỗi route phải tự enforce. Đã xác minh một số route có mức guard không khớp UI (`GET /api/users`, customer single delete, Cước CĐ config GET, customer template).
- Prisma schema/migration không là source of truth duy nhất; runtime DDL phân tán qua nhiều helper.
- `/api/customers/map-detail` không có caller được tìm thấy; map sử dụng các endpoint khác.
- Legacy customer modal/notes và KPI panels không có import hiện tại; refined/clean variants là đường active.
- Receipt/Excel có architecture path đầy đủ nhưng bị gỡ khỏi navigation; đây là hidden capability, không phải dead implementation.
- Setup/seed handlers có code nhưng bị proxy chặn trước route; flow trong README không còn reachable.
- `recharts` còn dependency nhưng dashboard chart caller đã bị xóa; `react-leaflet-cluster` không có source import hiện tại.
- Không có analytics/event pipeline để nối vào architecture map.
