# Node0TB — điều tra chênh lệch timing

> Task9, local 29/10/2026, tiếp mục35. Chỉ diagnostic và tài liệu; không sửa application/test/config/dependency, không dùng dữ liệu thật, không commit/push/deploy.

## Kết luận ngắn

- Tám process mới, đúng thứ tự đã đăng ký, không retry/thay mẫu: cả96 tổ hợp process/dataset giữ cùng input/full-response hashes; query/readiness và lượt quét ở các call có observer đúng kỳ vọng.
- **Có bằng chứng timing nhạy với observer history trong protocol này.** Ở unique50k, history G chậm hơn U ở cả trước/sau memo và cả hai repetitions: ratio1,547–1,716 cho source trước và1,659–1,679 cho source sau. Timer không trực tiếp bọc observer; restore function reference không đủ để đảm bảo workload sau không chịu ảnh hưởng lịch sử.
- **Chưa giải thích được mức chậm sau/trước khoảng2,5× ở matrix cũ.** Trong matrix mới, source ratios unique50k là0,940/1,023 ở U và1,020/0,989 ở G; interaction1,086 rồi0,967, không nhất quán theo hướng cũ. Một shared history shift không giải thích được after/before gap cũ. Không gán cơ chế JIT/GC hay gọi kết quả cũ là flake/vô hại.
- Grouped workloads vẫn giảm số lần quét trong dữ liệu giả. Tuy nhiên secondary unique138 có median sau cao hơn ở cả bốn so sánh, exact50k ở U cao hơn trong cả hai repetitions. **Không kết luận mọi request nhanh hơn hoặc không có regression.** Không đổi application code vì chưa có đủ bằng chứng cho một bản sửa cụ thể.
- Giữ `uniqueTimingUncertaintyRemainsOpen=true`, `performanceAcceptancePassed=false`, `allTask9Complete=false`. Native/strictvisual/release không được đóng bởi thí nghiệm này.

## Vì sao cần thí nghiệm này

Matrix mục35 đo unique50k trước614,184ms → sau1.526,097ms, median ba mẫu trong hai process riêng; grouped50k647,665 →17,925ms. Một paired diagnostic khác không có prototype observer đo unique417,133 →423,051ms nhưng thay cả thứ tự workload, warmup, số calls và process-sharing. Không thể dùng hai protocol khác nhau để quy kết nguyên nhân.

Harness matrix cũ cài counting generator vào `Map.prototype.entries` ở lượt thứ năm mỗi dataset rồi restore. Timed calls của dataset đó đã kết thúc, nhưng timed calls của dataset tiếp theo có lịch sử thực thi khác. Đây là giả thuyết có thể kiểm tra; không phải bằng chứng sẵn có về JIT/GC hoặc production.

## Thiết kế đã chốt trước khi thấy kết quả

- **B/A:** service trước/sau memo. B lấy từ preimage, không lấy primary hiện tại đã chứa memo. **U:** lượt thứ năm không gán prototype; **G:** lượt thứ năm dùng đúng sentinel-filtered counting generator rồi restore trong `finally`.
- Hai versions × hai histories × hai repetitions = tám process mới, tuần tự: B_U1, A_G1, A_U1, B_G1, B_G2, A_U2, A_G2, B_U2. Thứ tự đối xứng, không loại hết host drift/load/thermal effects.
- Mỗi process chạy12 datasets theo cùng thứ tự: grouped-fallback, exact-only, distinct-misses ×138/1.000/10.000/50.000 dòng. Giữ fixture algorithm, row sort, fields/nulls, node insertion order và common normalizer của matrix cũ. Prefix profiles có1.000 nodes; exact profile có số dòng+1 nodes.
- Mỗi dataset một warmup, ba timed calls, một untimed call:60 calls/process,480 calls toàn thí nghiệm. Chạy service/import-utils thật; Prisma/readiness boundary giả, không import adapter database. Query/select giữ nguyên, hai backend reads và một readiness/call.
- Timer chỉ bọc `await getNode0TbList()`. Giữ final timed response, so fifth-response equality và JSON hash ngoài timer, không serialize sau từng timed sample. CPU/memory probes và assertion vẫn có thể ảnh hưởng call tiếp theo: đây là protocol mới, không phải replay tuyệt đối matrix cũ.
- G thực hiện24 prototype writes/process, U bằng0. Khi bắt đầu unique50k, G đã có22 writes từ11 workloads trước đó; observer riêng của unique50k chỉ chạy sau ba timing samples của chính nó. Không diễn giải như wrapper đang trực tiếp đếm trong timer.
- Endpoint chính là `distinct-misses/50000`. Đơn vị phân tích là median ba raw samples trong **một fresh process**, hai repetitions mỗi arm, không pool thành sáu independent replicates. Báo11 workload còn lại như contextual, không đổi endpoint để chọn kết quả thuận lợi.
- Chốt hash plan/child/driver/analyzer/env guard trước child đầu. Không expose-gc/forced GC, trace, optional ablation, retry hoặc cell thay thế. Ordinary caught error giữ partial raw samples rồi dừng nonzero; tám cell thực tế đều exit0, không dùng partial để kết luận.

## Endpoint chính: toàn bộ samples

Đơn vị ms; bảng làm tròn ba chữ số, artifact giữ số gốc không làm tròn. Thứ tự samples là thứ tự thực thi trong từng child.

| Repetition | Arm | Ba timed samples | Median |
| --- | --- | --- | ---: |
| 1 | B_U | 416.730;393.071;407.499 | 407.499 |
| 1 | A_U | 382.930;381.923;386.837 | 382.930 |
| 1 | B_G | 630.280;624.345;666.437 | 630.280 |
| 1 | A_G | 643.773;634.753;643.071 | 643.071 |
| 2 | B_U | 366.641;367.782;357.422 | 366.641 |
| 2 | A_U | 381.437;371.075;375.106 | 375.106 |
| 2 | B_G | 628.595;629.041;634.246 | 629.041 |
| 2 | A_G | 622.430;609.672;634.758 | 622.430 |

R_U=A_U/B_U; R_G=A_G/B_G; interaction I=R_G/R_U. Hướng phù hợp với mức chậm after/before cũ là I>1, không phải chỉ I>0.

| Repetition | B_G/B_U | A_G/A_U | R_U | R_G | I |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 1.547 | 1.679 | 0.940 | 1.020 | 1.086 |
| 2 | 1.716 | 1.659 | 1.023 | 0.989 | 0.967 |

| Repetition | B_G−B_U (ms) | A_G−A_U (ms) | A_U−B_U (ms) | A_G−B_G (ms) |
| --- | ---: | ---: | ---: | ---: |
| 1 | +222.781 | +260.141 | −24.569 | +12.791 |
| 2 | +262.400 | +247.323 | +8.465 | −6.611 |

Cả hai source có shared history shift cùng hướng ở cả hai repetitions. Source ratios và interaction đổi hướng giữa repetitions; **không đủ giải thích anomaly2,5× hoặc nghiệm thu no-regression**. Hai repetitions không cho phép suy precise effect size/significance. Dừng đúng tám cell; không thêm identity/trace run để tìm câu trả lời thuận lợi.

## Đủ12 workloads, không chỉ chọn endpoint thuận lợi

Mỗi ô là median trước → sau (ms), mỗi median thuộc một process riêng. U/G không phải role/người dùng. Raw samples của cả96 process/dataset observations ở `matrix-result.json` và tám cell artifacts.

| Workload | U1 trước → sau | U2 trước → sau | G1 trước → sau | G2 trước → sau |
| --- | ---: | ---: | ---: | ---: |
| grouped-fallback / 138 | 5.810 → 2.632 | 4.748 → 1.936 | 4.899 → 1.462 | 4.964 → 1.806 |
| grouped-fallback / 1000 | 8.330 → 1.010 | 7.704 → 1.365 | 14.256 → 2.931 | 12.164 → 2.892 |
| grouped-fallback / 10000 | 90.033 → 4.214 | 80.879 → 3.605 | 133.868 → 4.317 | 126.569 → 3.949 |
| grouped-fallback / 50000 | 405.588 → 16.787 | 417.917 → 12.573 | 661.874 → 14.491 | 669.124 → 14.341 |
| exact-only / 138 | 0.028 → 0.036 | 0.028 → 0.036 | 0.028 → 0.032 | 0.031 → 0.041 |
| exact-only / 1000 | 0.201 → 0.232 | 0.182 → 0.226 | 0.180 → 0.264 | 0.184 → 0.327 |
| exact-only / 10000 | 2.489 → 2.930 | 2.066 → 2.867 | 3.082 → 1.928 | 2.905 → 2.923 |
| exact-only / 50000 | 26.265 → 28.471 | 15.551 → 22.785 | 14.272 → 11.162 | 13.353 → 21.328 |
| distinct-misses / 138 | 1.044 → 3.702 | 1.110 → 6.853 | 1.736 → 3.261 | 2.523 → 3.789 |
| distinct-misses / 1000 | 7.074 → 7.929 | 7.414 → 7.633 | 12.319 → 12.721 | 12.301 → 11.734 |
| distinct-misses / 10000 | 74.155 → 74.611 | 70.751 → 78.209 | 122.223 → 120.293 | 126.091 → 123.335 |
| distinct-misses / 50000 | 407.499 → 382.930 | 366.641 → 375.106 | 630.280 → 643.071 | 629.041 → 622.430 |

Không bỏ secondary chậm hơn: unique138 sau cao hơn ở cả bốn so sánh, exact50k U sau cao hơn cả hai repetitions; exact-only không có prefix scan để giảm. Với hai repetitions và workload order cố định, chưa xác minh mức overhead/cơ chế hoặc tác động thực tế của từng pattern. Không gọi đây là production regression đã chứng minh, cũng không lấy grouped gain để miễn kiểm tra chúng.

Các G fifth-call counters giữ nguyên kết quả mục35: grouped138138→20 scans/134.925→19.555 pairs; grouped50k50.000→100 scans/49.387.500→98.775 pairs; exact0 scans; distinct-misses một scan/dòng, unique50k50triệu pairs ở cả hai versions. U counters là `null`, không phải0, vì không instrument. Không giảm SQL/payload hoặc đo production request latency.

## Identity, evidence và giới hạn xác minh

- Node `v24.13.1`, V8 `13.6.233.17-node.40`, Windows x64; cùng executable/loader, không native database execution, không đọc `.env`/token/database thật. Process metadata không dump toàn bộ environment.
- Before source SHA-256: `45b9b9bb7190bbd8459a70930798e69680bb01a4d3e7cbe03e1cb5f9cddb034b`.
- After source SHA-256: `2208df34ad9c84a7c52ea82b798cac923a2e98aca4f27728ee79cc43cd9bbe07`.
- Common normalizer SHA-256: `f52d4e26b7811f7155b090ae2698ef7d5a8045da2813b17ec32ee26b5a70496e`. Hai roots hiện tại khớp nhau; không dựng lại identity normalizer lịch sử chỉ từ JSON timing cũ.
- `matrix-result.json` SHA-256: `944642cc82f9350ee7d51a39d00126cc60d9d2841abcdca94e25ae3b3443df69`.
- Evidence riêng: `.local/performance/node0tb-timing-rca-20261029/`: snapshot, preregistered hashes, tám cells/logs, matrix/progress/analysis, all-workloads, reviews, backup/integration manifest. Harness/preregistered plan nguyên bản giữ tại staging visualization, không dùng bản checklist sau execution để giả làm preregistration.
- Giữ nguyên161 artifacts mục35, bao gồm benchmark, paired report và V1 failure/V2 UI evidence.89 dirty paths có sẵn và331 source/config/test files không đổi trong checkpoint này; build ID `uHuPDrGeI3CACKtH0ZyOi` không rebuild. Chỉ tích hợp5 tài liệu, không package/test/application edits.
- Không rerun scoped/unit/full-native/build/browser ở checkpoint docs-only.557 scoped/22policy và browser/build ở mục35 là bằng chứng cũ, không kết quả chạy mới. Native Windows full-suite801/815 rồi exit3221225477 vẫn OPEN; strictvisual cũ3PNG/2geometry vẫn OPEN.
- Chưa giải thích anomaly cũ, exact/unique overhead, JIT/GC, host-load drift; chưa đo database/cloud/API/page load/render/p95/RUM. Không chứng minh full DOM/pixel parity hoặc điện thoại/provider thật. Không đóng auth/revocation/snapshot-consistency và các backlog khác.

## Quyết định tiếp theo

Không sửa memo hoặc công bố tốc độ toàn web từ kết quả này. Functional acceptance mục35 giữ nguyên LOCAL ONLY. Đánh giá overhead exact/unique và workload đại diện thực tế cần thiết kế riêng; marker/detail DTO, node map thường và viewport/clustering chưa hoàn tất. Mọi lần đo performance tiếp theo phải tách lifetime observer khỏi timed process và giữ control tương xứng, không sửa bằng việc xóa kết quả bất lợi. Native, strictvisual và release cần bằng chứng riêng trước khi publish.

Tham chiếu: `docs/node0tb-prefix-memo.md`, plan `docs/superpowers/plans/2026-10-29-node0tb-timing-investigation-local.md`, roadmap Task9 và tiến độ mục36.
