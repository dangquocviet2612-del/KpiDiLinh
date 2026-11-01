# Official document upload limit — Implementation Plan, checkpoint63

> **For agentic workers:** Use executing-plans/subagent-driven-development with TDD and separate spec/quality review. All work stays local; no commit, push, deploy, new branch or database/env changes.

**Goal:** Hoàn thiện phần validation hosting của Task12 cho tệp đính kèm công văn, không đổi UI/storage/nghiệp vụ.

**Architecture:** Dùng policy4.000.000byte/file trên Vercel (`VERCEL === "1"`), helper/key riêng `NEXT_PUBLIC_OFFICIAL_DOC_UPLOAD_MAX_BYTES`. Client nhận4000000 hoặc0 tại build; missing/invalid fallback4MB. Hook snapshot toàn FileList và kiểm tất cả file trước busy/FormData/POST, không upload dở vì biết trước có file quá lớn. Accepted files vẫn POST từng file tuần tự như cũ. API giữ auth401/role403/File400, thêm413 trước asset service/Buffer/base64/DDL/DB, giữ guard20MiB/200MiB cũ ở local/non-Vercel. Picker reset trong finally sau await để chọn lại cùng file; không sửa giao diện, link video hoặc lưu công văn.

**Files:** `next.config.ts`, `src/app/api/official-documents/upload/route.ts`, `src/app/(dashboard)/prepaid/useOfficialDocsPanel.ts`, `src/app/(dashboard)/prepaid/OfficialDocsPanel.tsx`; new `src/lib/official-doc-upload-limits.ts`, `tests/unit/official-doc-upload-size.test.ts`, `tests/ui/official-doc-upload-size.test.tsx`. Four docs: this plan, `docs/official-doc-upload-size.md`, roadmap and append63 in `tiendokpi.md`.

## Checklist
- [x] Snapshot506publicpaths/367source-config-test,20primarydirty/255WTdirty,1882old artifacts; HEAD/index/oldBUILD_ID, scoped instructions and reused worktree checked.
- [x] Add27API+20UI cases. RED16fail31pass/47 before source, correct missing size gate/picker reset; fake service/transport/auth and metadata files, no DB/oldtest changes.
- [x] Add minimal helper/config/API/hook/picker changes; GREEN47/47. Exact-scope four old files ignores CRLF only; previous keys/local legacy/asset service/storage/old tests unchanged. Default source secret scan passed.
- [x] Spec then quality APPROVE exact7hashes. Worktree/primary each fresh58files1051scoped+22policy/types/lint0warning and actual Next config/staticEnv probes all3keys4000000/0 PASS. No retry or oldtest/config/deadline/pool change; historical gates remain separate.
- [x] Default redacted secret scans, whitespace/backups/hash-inventory are final integration gates for four docs/append63; only confirmed when integrated manifest passes. No publication or full native/browser/release claim.

## Commands and boundaries

Run focused `npm.cmd test -- tests/unit/official-doc-upload-size.test.ts tests/ui/official-doc-upload-size.test.tsx` in synthetic QA process with env discovery guarded. Broad selection inherits62 and adds new unit file; UI directory includes new UI file. Keep policy22, TypeScript `--noEmit --incremental false`, ESLint src/config/newtests `--max-warnings 0`. Next loader/staticEnv must show exactly3nonsecret numeric config keys (customer/node/doc), all4000000 hosted and0 local; proxy remains67108864 normalized bytes, no full build or emitted-bundle claim.

Whole-selection rejection avoids **known size-invalid** partial uploads only; it is not transactional upload, rollback, cleanup or retry. Mid-batch network/asset failures and existing response validation remain separate. File-byte cap is not whole multipart/DB-base64/response/download/sum-of-files/decompression limit. formData still reads body first. No directstorage/job/backup/restore activation or costs; full native/auth/Node0TB/Next/browser/3role gates remain open. Systemflag required; prebuilt clientcap needs matching build/rebuild. No manual env edits or Production verification.

Policy follows61/62. References: [Vercel limits](https://vercel.com/docs/functions/limitations), [Next config env](https://nextjs.org/docs/app/api-reference/config/next-config-js/env).
