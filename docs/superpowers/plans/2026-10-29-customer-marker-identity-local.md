# Customer marker identity — Implementation Plan

> **For agentic workers:** Use TDD and independent spec/quality reviews. Local only; owner đã dừng publish. Không branch/commit/push/deploy/Turso setup hoặc real env/database access.

**Goal:** Chọn đúng khách khi trùng/gần tọa độ/spiderfy, giữ popup sau flyTo và không dùng ref của group bị tháo; không thay UI/API/permission/write contracts.

**Architecture:** Memoized ID index/current filtered array, marker customerId/public sourceTarget; one-shot moveend sau stopoldmotion, pending request/position identity và cancellation, group-owned ref cleanup/current-entry guard. Giữ motion durations/retry bounds, không thêm request/global cache/per-marker listener/coordinate fallback.

**Tech Stack:** Existing React/Leaflet/markercluster, Vitest/jsdom, isolated manual worktree; synthetic-only verification.

## Phạm vi và căn cứ

- App: `src/app/(dashboard)/map/MapComponent.tsx`.
- Test: `tests/ui/customer-map-node-projection.test.tsx`.
- Docs: guide này/`docs/customer-marker-identity.md`, roadmap và `tiendokpi.md`.
- Source cũ dùng coordinate epsilon và first match; ID không được bảo toàn khi trùng/gần điểm. Installed markercluster thay LatLng khi spiderfy; installed Leaflet Events/Popup giữ nguồn marker qua sourceTarget. Không sử dụng API getSource không có trong bản cài hoặc private `_source`.
- All14 customer fields và10node-map fields đang dùng: không cắt dữ liệu/search/popup/form cho một cosmetic projection. Payload/detail-loading là subproject riêng.

## Các bước

- [x] Snapshot hai checkout theo inventory riêng:425 union paths/331source paths/91dirty paths; primary425, WT423. Giữ HEAD/build identity và209artifact hashes cũ. Không giả định union là inventory riêng từng root.
- [x] Viết regression trước app, observed RED6fail/13pass. Hai co-location cases, displaced popup, ba invalid-source cases; test thứ bảy dùng actual nested Leaflet FeatureGroups. Giữ12case cũ và assertion không fetch/write thêm.
- [x] Sửa tối thiểu: current filtered-array index, marker metadata, popup sourceTarget lookup, ba ID lookups/dependency arrays. Focused GREEN19/19.
- [x] Sửa TS2348 ở type mock, giữ failed log/hash v1; không thay assertion/runtime hoặc source app. Full TypeScript hiện tại đạt.
- [x] Spec review APPROVE current2hashes; không gộp với quality/QA/release acceptance.
- [x] Identity/motion spec reviews và quality review; quality P2 yêu cầu xử lý refs của group bị tháo. Không dùng approval pair cũ thay final review.
- [x] Motion RED6fail/19pass →GREEN25; lifetime RED2fail/25pass →GREEN27. Giữ intermediate missing-import/type/mock-setup failures, không tính chúng là semantic RED. Native FeatureGroup mock bus giữ once/off/fire semantics; original12case bodies không đổi.
- [x] Final WT10file/256map-domain +22policy/types/lint0error/2warning cũ/build, fake DB/hash unchanged. Không gọi selection này là34-file broad hoặc full-suite PASS.
- [x] Baseline control331source/twofiles đạt76/76, sau đó phục hồi exact candidate. Candidate diagnostic74/76/broad561/564/broadmotion569/570 failures giữ nguyên; cause/reliability gate OPEN, không thay timeout/pool/skip.
- [x] Chrome V1 failed persistent-popup; source motion fix không thêm delay. V2 failed optional CSS-class gate; same-build probe chứng minh ba physical legs/marker boxes. V3 đòi đúng3legs +visible/distinctA/B và mọi assertion khác của sáu cases giữ nguyên;6/6 đạt trên finalbuild, V1/V2/probe fail vẫn giữ riêng.
- [x] Final quality/lifetime spec approval exact pair và bounded protocol V3 review; source P2 đóng, không waive broader/native/strictvisual/performance/release.
- [x] Source pair tích hợp sau backup/hash/default secret scan; primary map-domain/policy/types/lint có log/manifest riêng. Chỉ hoàn tất6file khi docs integration guard xác minh lại primary; không dùng WT PASS thay primary.
- [x] Final docs integration guard giữ source ngoài6file và209artifacts cũ không đổi, preserve91dirty paths; không branch/commit/push/deploy. Gate này phải có `integrated-files.json`, không suy từ checklist này.

## Điều kiện / reporting

Broad v1 đạt564/34+22policy nhưng type fixture fail; broad v2 sau type fix có561pass/3fail và standalone diagnostic74pass/2fail ở current-user-query/prepaid-view-loading. Giữ mọi kết quả; một isolated PASS không miễn broad-failure gate. Không sửa nghiệp vụ KPI ngoài scope, không đổi timeout, skip, retry hoặc pool để ép xanh.

Source pair cuối: MapComponent SHA-256 `066ab426ec007acb55879f5d498e926d47c94c122ece93afa1fa184e674aa1b3`; test `b06d0589c6842c7c7ba254040043250d925dbcc17a1806ff6abdd2ba457b298a`. Build `GSevXO8cImpsugMzfsFK1`. Sau source edit phải đóng băng/review/verify lại, không dùng kết quả hash cũ. Private protocol/lifetime artifacts có version riêng, không ghi đè failures.

App functionality/local integration và broad/native/visual/performance/release là các gate khác nhau. Không đánh dấu toàn Task9 hoặc release hoàn tất; chưa đo actual page-load/p95/production payload/SQL/render speed. Chi tiết trạng thái cuối tại guide và tiến độ mục37, evidence private `.local/performance/customer-marker-identity-20261029/`.
