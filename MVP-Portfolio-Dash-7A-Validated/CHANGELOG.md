# Changelog

All notable project specification and repository-workflow changes are recorded here.

## [2.3-phase-6a] - 2026-07-14

- Implemented the Phase 6A Analytics Engine using only Historical Data Service
  normalized Stooq close history.
- Added split-adjusted, dividend-unadjusted price-return approximation utilities
  for arithmetic and log returns, normalized performance, exact alignment,
  CAGR, alpha, beta, and headline maximum drawdown.
- Preserved fixed shares, floating market-value weights, acquisition dates, and
  contribution-neutral performance; daily rebalancing and raw-account-value
  drawdown are excluded.
- Added deterministic fixtures for exact return intervals, partial-year CAGR,
  configured benchmarks, risk-free-rate periodicity, contribution neutrality,
  invalid requested dates, and unavailable states.
- Completed local automated validation: calculations 51/51, data service 11/11,
  historical data 38/38, Phase 2F Node 19/19, Phase 3B and security regressions,
  plus analytics syntax/import checks.
- No Monte Carlo, direct historical network request, Finnhub candle dependency,
  or replacement project ZIP was added. Accepted through squash merge `a557803`
  and tag `phase-6a-accepted`.

## [2.3-phase-5a] - 2026-07-14

- Accepted Phase 5A through squash merge `b30cc30` and tag
  `phase-5a-accepted`; advanced the active implementation gate to Phase 6A.
- Retained the physical iPhone 13 mini and Home Screen checks as documented
  limitations deferred to the Phase 1D/10A final device gates.
- Added the Phase 5A Chart Manager with comparison, account-value, allocation,
  and drawdown support plus future Monte Carlo fan/band containers.
- Added prepared-series contracts, all seven time filters, explicit series
  toggles, zoom reset, PNG export, bounded responsive resizing, orientation
  handling, safe theme recreation, and chart availability/warning states.
- Added iPhone 13 mini safe-area and overflow protections and swipeable-tab
  gesture isolation.
- Removed CSV export and Print-to-PDF reporting from application deliverables.
- Revised deployment to public GitHub Pages with Mozilla Firefox as the primary
  iPhone browser; remote shared-URL access, optional cloud synchronization, and
  router port forwarding are in scope while use remains personal to the owner.
- Removed the bundled Finnhub credential, made key entry runtime-only, moved
  authentication out of request URLs, and kept credentials out of persisted or
  emitted artifacts.
- Added realized gains from explicit lot disposals to the product requirements;
  no financial calculation was added to chart modules.

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
- Adopted GitHub source control for `KCs IRA Dash - Monte Carlo/Portfolio-Dashboard` (visibility and hosting were revised in Phase 5A).
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
- Phase 1D: originally deferred; superseded by the GitHub Pages deployment packet.

## [2.3-baseline] - 2026-07-13

- Recorded the original baseline credential behavior, now superseded by the
  Phase 5A runtime-only credential-exclusion policy.
- Updated setup, storage, diagnostics, and data-service regression expectations.
- Removed the obsolete Finnhub candle-policy source artifact.
- Consolidated authoritative documentation and adopted the VS Code/Codex/SSH workflow.
- Repaired Local Storage JSON migration, the IndexedDB regression harness, and
  the baseline test index; recorded passing Firefox evidence through Phase 3A.

## [2.2] - 2026-07-11

- Rescoped historical data from Finnhub candles to private Stooq files.
- Established the original Mac-hosted scope, superseded by public GitHub Pages hosting in Phase 5A.
- Completed Phase 1A through 2F and built the Phase 3A portfolio engine.
