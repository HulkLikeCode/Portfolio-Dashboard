# Changelog

All notable project specification and repository-workflow changes are recorded here.

## [2.3-phase-3b] - 2026-07-13

- Added explicit-save holding and multi-lot CRUD backed by the accepted Phase 3A model, validation, and calculations.
- Added accessible validation announcements, destructive confirmations, focus restoration, and an iPhone 13 mini responsive editor layout.
- Added manual corporate-action adjustment with a required audit note and before/after preview; no corporate action is detected or applied automatically.
- Added corporate-action responsibility notices to Holdings, Settings, and Help.
- Added portfolio revision tracking and stale invalidation for dependent analytics and simulations.
- Added deterministic adapter tests, a browser UI harness, and a physical-device manual test checklist.

## [2.3] - 2026-07-12

### Changed

- Replaced requirements and roadmap Version 2.2 with Version 2.3.
- Adopted private GitHub Enterprise Cloud source control for `KCs IRA Dash - Monte Carlo/Portfolio-Dashboard`.
- Standardized VS Code 1.106.3, the Codex extension connected to ChatGPT Plus,
  the integrated terminal and Source Control view, and Git over SSH for repository operations.
- Defined `main` as accepted source, phase branches and pull requests for development, Actions checks, accepted tags, and milestone releases.
- Changed the Finnhub key policy to the predefined editable value maintained in
  `requirements.md`.
- Permitted the key in source, repository history, documentation, fixtures, logs, diagnostics, URLs, exports, backups, screenshots, and releases.
- Permitted the eight Stooq production files, backups, exports, and diagnostics in the private repository.
- Made browser test pages the primary acceptance tests and CI/Node checks supplemental.
- Required Codex to edit and validate the authorized workspace directly while preserving unrelated changes.
- Added phase-by-phase VS Code, Codex, Git, and GitHub execution instructions from Phase 3B through Phase 10B.

### Status

- Phase 3A: accepted baseline.
- Version 2.3 key migration: implemented for the consolidated baseline.
- Phase 3B: next roadmap phase; it has not started, and its implementation and
  tests are not present in this baseline.
- Phase 1D: deferred until target home Wi-Fi is available.

## [2.3-baseline] - 2026-07-13

- Centralized the predefined Finnhub key and added editable/resettable setup behavior.
- Persisted the active key and enabled its use in diagnostics and future backups/exports.
- Added Finnhub-client default-key behavior while preserving user overrides.
- Updated setup, storage, diagnostics, and data-service regression expectations.
- Removed the obsolete Finnhub candle-policy source artifact.
- Consolidated authoritative documentation and adopted the VS Code/Codex/SSH workflow.
- Repaired Local Storage JSON migration, the IndexedDB regression harness, and
  the baseline test index; recorded passing Firefox evidence through Phase 3A.

## [2.2] - 2026-07-11

- Rescoped historical data from Finnhub candles to private Stooq files.
- Established private Mac-hosted, same-home-Wi-Fi PWA scope.
- Completed Phase 1A through 2F and built the Phase 3A portfolio engine.
