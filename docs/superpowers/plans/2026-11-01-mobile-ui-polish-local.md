# Mobile UI polish — local implementation plan

**Approved scope:** Separate unsaved CD/FTTH rate state from filters, compact mobile KPI summary filters, flatten mobile customer sections and put ADMIN deletion in the existing ActionMenu. Preserve desktop, APIs, permissions, formulas and callbacks; no map changes, provider, database, push or deployment.

1. Snapshot the primary source and its three existing documentation changes; use a credential-free source copy under ignored `.local/` for candidate tests/build. Do not promote candidate68 or create a branch.
2. Add failing state/disclosure/menu regressions before implementation. Adapt four existing customer suites only for the intentionally changed mobile delete entry, preserving permission and callback assertions.
3. Modify exactly five TSX/CSS files listed in `docs/mobile-ui-polish.md`. Keep dates/indicators/incomplete/counts outside the mobile disclosure; secondary DOM follows its trigger, while desktop order and keyboard behavior stay natural.
4. Run focused and broad unit/UI, types/lint, isolated Next build and Chrome synthetic fixtures. Reject desktop visual differences, wrong focus order, context loss, leaked admin controls, menu targets below 44px or unexpected external/API requests. Preserve failed evidence and fix root causes; do not relax thresholds or test budgets.
5. Independent review by hash, then integrate only reviewed source/tests/docs with preimage guards. Run primary focused/static verification and compare all non-owned public paths, original docs, HEAD/index and map files. Append progress without rewriting historical results.

**Candidate evidence:** Focused 97, broad 1.671 unit/UI, types/lint and isolated build passed; 24 screenshots/26 browser checks passed after DOM/CSS fixes. See `docs/mobile-ui-polish.md`; these numbers do not include native Windows or authenticated staging acceptance.

**Integration gate:** `.local/performance/ui-polish-20261101/final-scope.json` must exist and confirm exact reviewed hashes and primary validation. This document is not a substitute for that manifest. No commit/push/deploy in this batch.
