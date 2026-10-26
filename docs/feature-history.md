# Feature History

> Phạm vi: toàn bộ lịch sử Git reachable qua `--all` tại snapshot `21cf430`. Repository có 203 commit, một root commit, không shallow, không tag, không merge commit, không Git notes và không có PR/MR reference trong commit message.

## 1. Cách đọc timeline

| Nhãn | Ý nghĩa |
|---|---|
| **Added** | Capability hoặc entry point mới xuất hiện. |
| **Materially changed** | Capability vẫn tồn tại nhưng quyền, flow, dữ liệu hoặc UX thay đổi đáng kể. |
| **Replaced** | Entry/implementation cũ bị một flow mới thay thế; capability có thể vẫn còn theo hình thức khác. |
| **Hidden** | Code/page còn nhưng không còn được expose qua navigation hoặc bị proxy/config chặn. |
| **Removed** | Code/entry point đã bị xóa khỏi HEAD. |
| **Reverted** | Thay đổi được đảo ngược trong lịch sử. |

Ngày là author date trong Git. Không gán PR number vì repository không có bằng chứng đó.

## 2. Timeline capability

### 2026-02-27 đến 2026-03-02: Nền tảng CRM đầu tiên

| Ngày | Commit | Thay đổi | Trạng thái hiện tại / evidence |
|---|---|---|---|
| 2026-02-27 | `f676241` — Initial commit from Create Next App | Khởi tạo Next.js scaffold. | Không có CRM feature ở root commit. Các SVG scaffold vẫn còn nhưng không được source tham chiếu. |
| 2026-03-01 | `334a36c` — Initialize project and prepare for Vercel deployment | Thêm nền CRM: credentials auth, Customer/CTV, dashboard, logs, customer map, node map, import/export và Prisma. Xóa landing page scaffold. | **Materially changed.** Phần lớn domain còn tồn tại; dashboard sau đó bị xóa. |
| 2026-03-01 | `a17571c` — Add `/api/setup` route | Thêm API khởi tạo Turso/database. | **Hidden/disabled.** Route file còn nhưng `src/proxy.ts` trả 404. |
| 2026-03-02 | `a59139d` — Add password change feature... | Thêm đổi mật khẩu, export khách hàng sắp hết hạn và quyền GPS CTV (`canUseGps`). | **Active.** `src/app/(dashboard)/change-password`, customers export, Prisma `User.canUseGps`. |
| 2026-03-02 | `0d96782` — map/mobile/dark/edit diff changes | Mở rộng marker map, mobile UI, dark theme và diff history. | **Active**, ngoại trừ các implementation map/UI sau này đã được refactor. |
| 2026-03-02 | `ea9c6a1` — add prepaid customers page and navigation | `/prepaid` ban đầu là danh sách khách hàng đóng trước hết hạn trong tháng. | **Replaced** bởi KPI tại `1d7ac95`; lọc/export hết hạn chuyển về Customers. |

### 2026-03-05 đến 2026-03-10: Khách hàng, node, PWA, KPI và role Manager

| Ngày | Commit | Thay đổi | Trạng thái hiện tại / evidence |
|---|---|---|---|
| 2026-03-05 | `c3647f2` — implement customer notes... | Thêm ghi chú khách hàng, API notes và model `CustomerNote`. | **Active.** `src/app/api/customers/[id]/notes`, refined notes component. |
| 2026-03-07 | `8a2a118` — Add Customer Status... | Thêm trạng thái khách hàng và file lỗi import. | **Active.** Customer schema/UI/import. |
| 2026-03-07 | `f31b476` — Detailed Excel Import... | Import Excel hỗ trợ partial update và phản hồi chi tiết. | **Active.** `src/app/api/import/route.ts`. |
| 2026-03-07 | `0c8a310` — Zalo integration | Thêm liên hệ Zalo trong customer flows. | **Active.** Chỉ là link, không có OpenAPI. |
| 2026-03-08 | `bed402f`, `63162e3`, `432e508` | Thêm dữ liệu node, tìm tọa độ, node gần nhất và gán node. | **Active.** Node map, customer-node assignment và runtime mapping. |
| 2026-03-08 | `63162e3` → `1431051` | Thêm marker đỏ/các node gần tọa độ rồi ẩn danh sách gợi ý node gần, vẫn giữ thông tin node gần nhất. | **Materially changed/partially hidden.** Kết quả tọa độ hiện vẫn có nearest-node trong `NodeMapComponent.tsx`. |
| 2026-03-08 | `1868d8f` → `2f8e425` | Thêm Customer Drawer trên map rồi thay lại bằng Leaflet Popup trong cùng ngày. | **Replaced.** Current customer map dùng popup. |
| 2026-03-08 | `88f7d4a` → `a8dd487` | Đặt dark map làm mặc định rồi trả lại light. | **Reverted.** Người dùng vẫn đổi layer. |
| 2026-03-08 | `43fdbda` — Add PWA support... | Thêm `next-pwa`, manifest và icons. | **Partial/experimental.** Config còn; chưa có test install/offline. |
| 2026-03-08 | `e029d2c` — pull to refresh | Thêm pull-to-refresh và mobile interactions. | **Active.** `src/hooks/usePullToRefresh.ts`. |
| 2026-03-10 | `18aaf65` — schema enhancements... | Thêm role `MANAGER`, `managerCode`, `secondaryCode` và API scope. | **Active.** `src/lib/scope.ts`, Prisma `User`. |
| 2026-03-10 | `1d7ac95` — add KPI and CTV features... | Biến `/prepaid` thành KPI cá nhân/tổng hợp; thay dedicated prepaid customer page. | **Active/Replaced.** KPI còn; capability customer expiry ở `/customers`. |
| 2026-03-10 | `88457c1` — add billing (cuoc)... | Thêm cấu hình, import và report Cước. | **Active.** Cước panel/APIs/runtime tables. |

### 2026-03-12 đến 2026-03-21: Security, archive, công văn, CDT, tools và bỏ dashboard

| Ngày | Commit | Thay đổi | Trạng thái hiện tại / evidence |
|---|---|---|---|
| 2026-03-12 | `ebee837` — Implement security fixes... | Thêm rate limit, API protection và hardening setup/seed. | **Materially changed.** Proxy hiện vẫn rate-limit login/password/một số import và chặn setup/seed. |
| 2026-03-12 | `de995e8` — remove getToken auth from middleware... | Xóa central `getToken` gate khỏi middleware. | **Removed một phần.** Route-level session/role checks vẫn tồn tại; proxy không bảo vệ auth toàn cục. |
| 2026-03-12 | `7db6446` — monthly KPI/Cước data archive... | Thêm export, confirm, cancel, purge và status archive theo tháng. | **Active.** Cron scheduling chỉ ở mức endpoint, chưa có scheduler config. |
| 2026-03-12 | `bdcd63a` — Add official documents... | Thêm công văn và upload API. | **Active.** Sau đó mở rộng asset/revision ở `49404d4`. |
| 2026-03-12 | `a580e80` — Update node efficiency... | Thêm import hiệu suất node và cột dữ liệu runtime. | **Active.** `src/lib/node-efficiency-db.ts`. |
| 2026-03-13 | `17ec5bf`, `6dbca80` | Thêm CDT import/report/summary. | **Active.** CDT routes/panels. |
| 2026-03-14 | `7305bef` — Replace CustomerTable/Modal... | Rename `CustomerTable.tsx` thành `CustomerTableRefined.tsx`, chuyển screens sang refined modal/table. | **Replaced.** Legacy modal/notes còn nhưng không có current caller chính. |
| 2026-03-14 | `e819edc` — Move middleware.ts to proxy.ts | Rename `src/middleware.ts` thành `src/proxy.ts` với similarity 86%. | **Renamed infrastructure**, không phải xóa security capability. |
| 2026-03-16 | `420f94e` — add tools section | Thêm tool chia/lọc Excel và sửa ảnh từ static assets. | **Active/Hidden.** Photo còn menu; Excel sau này bị ẩn. |
| 2026-03-18 | `5eaa537` → `6fc08a5` | Xóa tạm node upload route rồi thêm lại cùng ngày với mapping KML/KMZ/Excel và customer-node mapping. | **Restored/Active.** Không coi node upload là feature đã remove. |
| 2026-03-21 | `a92f46c` — redirect dashboard to customers... | Xóa `DashboardCharts.tsx`, dashboard CSS, `/api/dashboard`; root redirect `/customers`. | **Removed/Replaced.** Đây là removal rõ ràng nhất trong history. |

### 2026-03-26 đến 2026-04-17: Tách UI, business tools, KPI calculator và rời mạng

| Ngày | Commit | Thay đổi | Trạng thái hiện tại / evidence |
|---|---|---|---|
| 2026-03-26 | `6bf58a5` | Tách KPI thành panels/hooks và các tools thành route riêng. | **Materially changed.** Các component `*Clean` hiện được dùng; một số component cũ orphaned. |
| 2026-03-26–27 | `49404d4` | Mở rộng công văn với revision và rendering/asset. | **Active.** Runtime document revision/assets tables. |
| 2026-03-27 | `1fd60b5` | Mở rộng tools với Phiếu thu/Excel/Sửa ảnh/QR và CDT tồn. | **Active/Hidden.** QR/photo có menu; receipt/excel hidden từ tháng 9. |
| 2026-03-29 | `fd857ec` — implement KPI calculator... | Thêm mô phỏng/tính KPI và report calculation. | **Active.** Calculator không persistence. |
| 2026-04-02 | `74707e1` — Add disconnect processing... | Thêm import/report/template rời mạng, panel/hook và tests. | **Active.** `disconnect-ui.test.ts`, `disconnect-ctv-map.test.ts`. |
| 2026-04-17 | `29b7adb` — photo-editor zoom... | Thêm zoom, bỏ góc bo và cải thiện tương thích browser. | **Active.** Static photo editor asset. |

### 2026-05-04 đến 2026-06-18: Churn, quyền CTV và KPI quản lý

| Ngày | Commit | Thay đổi | Trạng thái hiện tại / evidence |
|---|---|---|---|
| 2026-05-04 | `0f462a3` — Add Churn Risk feature... | Thêm import Excel, list responsive và role-based visibility cho nguy cơ rời mạng. | **Active.** Churn table chưa có trong backup. |
| 2026-05-05 | `011f55a` — Add Customer at Current Location | Cho phép tạo khách hàng tại vị trí hiện tại trên map. | **Active.** Browser geolocation + customer create. |
| 2026-05-14 | `e0777f9` — coordinate search node | Tìm node bằng tọa độ. | **Active.** `/api/node-search-map`. |
| 2026-05-30 | `8434605` → `5402c5c` | Cho CTV xem Cước của mình, sau đó ẩn riêng filter/control bar và summary row với CTV. | **Active với UI hạn chế.** Current `CuocPanelClean.tsx`. |
| 2026-06-01 | `1359305` — Allow CTV to calculate/simulate KPI | Mở KPI calculator cho CTV. | **Active.** Làm spec cũ “Admin/Manager only” trở nên lỗi thời. |
| 2026-06-06 | `07b3549` — Enhance node subscriber map import... | Thêm alias matching, header scan và lỗi import chi tiết. | **Active.** Node mapping import. |
| 2026-06-16 | `a6780ef` | Thêm KPI tổng hợp quản lý. | **Active.** Manager KPI runtime table/report. |
| 2026-06-16 | `12d222b` | Tách tổng hợp toàn quản lý thành route/menu riêng. | **Replaced** tại commit tiếp theo. |
| 2026-06-16 | `151f429` | Thay route/menu all-manager bằng tab `__all__` trong KPI quản lý. | **Active/Replaced.** Current `ManagerSummaryKpiPanelClean.tsx`. |
| 2026-06-18 | `df6b428`, `37aa6ad` | Thêm visual map selector, link node gần nhất và template hiệu suất node. | **Active.** Customer/node map và nodes template API. |

### 2026-07-28 đến 2026-09-06: Billing mở rộng, Node0TB và thu gọn Tools

| Ngày | Commit | Thay đổi | Trạng thái hiện tại / evidence |
|---|---|---|---|
| 2026-07-28 | `b53767f` — Cước target 97.3 | Điều chỉnh target Cước mặc định thành 97,3%. | **Active.** Cuoc config/runtime default. |
| 2026-07-30 | `31da55a` — Add Cuoc CD management... | Thêm Cước CĐ, target config và lọc CTV. | **Active.** Cước CĐ panel/APIs/runtime tables. |
| 2026-08-20 | `a0ff517` — them phan he Ban do Node 0TB... | Thêm page/API/template/upload Node0TB. | **Active với local-file fallback.** `src/lib/node-0tb-db.ts`. |
| 2026-09-06 | `bf805e3` — loai bo... Phieu thu va Excel khoi menu | Gỡ Phiếu thu/Excel khỏi menu và đổi `/tools` mặc định sang Sửa ảnh cho role nâng cao. | **Hidden/Deprecated**, không removed; direct routes vẫn còn và guard Admin/Manager. |
| 2026-09-06 | `21cf430` — node-map lazy popup/export/radius/CRM | Thêm lazy popup, export Excel, lọc bán kính và link CRM từ node map. | **Active.** Đây là HEAD audit. |

## 3. Feature removed, replaced hoặc hidden

| Capability | Loại thay đổi | Commit quyết định | Bằng chứng tại HEAD |
|---|---|---|---|
| Dashboard analytics | **Removed/Replaced** | `a92f46c` | Không còn `DashboardCharts` hoặc `/api/dashboard`; root page redirect `/customers`. |
| Dedicated prepaid-expiry page | **Replaced** | `1d7ac95` | `/prepaid` là KPI hub; filter/export expiry ở customers. |
| Customer map drawer | **Replaced** | `2f8e425` | `CustomerMap.tsx` dùng popup. |
| Dark map mặc định | **Reverted** | `a8dd487` | Light default; layer alternatives còn. |
| All-manager route/menu riêng | **Replaced** | `151f429` | Tab `__all__` trong manager KPI. |
| Phiếu thu/Excel trong menu | **Hidden/Deprecated** | `bf805e3` | Pages `/tools/receipt`, `/tools/excel` vẫn tồn tại. |
| Central middleware token gate | **Removed một phần** | `de995e8` | `src/proxy.ts` chỉ rate limit/block; route handlers tự auth. |
| Setup/seed public operational route | **Hidden/Disabled** | `ebee837` và trạng thái hiện tại | Route files còn, proxy trả 404. |

## 4. File deletion và rename đáng chú ý

| Loại | Commit | File/path | Kết luận |
|---|---|---|---|
| Deleted | `334a36c` | `src/app/page.tsx`, `src/app/page.module.css` | Xóa boilerplate Next.js, không phải product feature. |
| Deleted tạm | `5eaa537` | `src/app/api/nodes/upload/route.ts` | Được restore/mở rộng tại `6fc08a5`; feature hiện active. |
| Deleted | `a92f46c` | `DashboardCharts.tsx`, dashboard CSS, `src/app/api/dashboard/route.ts` | Dashboard analytics bị remove. |
| Renamed/Replaced | `7305bef` | `CustomerTable.tsx` → `CustomerTableRefined.tsx` | UI customer chuyển sang refined variant. |
| Renamed | `e819edc` | `src/middleware.ts` → `src/proxy.ts` | Next.js infrastructure rename, không phải feature removal. |

## 5. Branches và mức độ truy vết

- Refs hiện có: `main` và `feat/disconnect-ui-redesign`; không có tag.
- Hai nhánh tách tại `ea8ab10`; `main` đi trước 30 commit và branch feature có 12 commit riêng.
- Không có merge commit. Ba patch đầu của branch có patch-equivalent trên main; blob cuối của disconnect panel/library/test giống main và CSS main là superset. Đây là bằng chứng nội dung đã được tích hợp bằng cherry-pick/squash hoặc cách tương đương, không phải merge.
- Commit `eb931ab` có subject “restore KPI Qly”, nhưng trước commit đã có một link `summary-manager`; commit này thêm link thứ hai cùng route. Sidebar hiện vẫn có hai link. Vì vậy không có đủ bằng chứng nói feature đã từng biến mất.
- Không có Prisma model/field nào bị xóa trong history được kiểm tra; lịch sử schema chủ yếu thêm GPS, notes, status, manager codes và indexes.
- Không có dependency bị xóa khỏi `package.json` trong lịch sử được kiểm tra; `recharts` hiện không còn caller sau khi dashboard bị xóa.

## 6. Giới hạn lịch sử chưa xác minh

1. Không có tag/release notes nên timeline dựa trên commit author date và diff, không phải release date production.
2. Không thể gắn commit với PR cụ thể do không có PR refs, merge commit hoặc PR number.
3. Lịch sử local đầy đủ từ root và không shallow, nhưng branch/ref đã xóa trên remote hoặc metadata chỉ có trên hosting không thể suy ra.
4. Không có deployment markers nên không thể kết luận từng commit đã thực sự được deploy.
5. Commit message đôi lúc mô tả rộng hơn diff; trạng thái trong tài liệu này ưu tiên diff và code tại HEAD.
