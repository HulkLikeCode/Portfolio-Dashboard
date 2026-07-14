# MVP Portfolio Dashboard
## Authoritative Implementation Roadmap - Version 2.3

**Status:** Authoritative VS Code, Codex, and GitHub execution roadmap

**Requirements authority:** `requirements.md`, Private Local Multi-Source MVP Requirements Specification, Version 2.3
**Supersedes:** the separate Version 2.1 and Version 2.2 roadmap documents  
**Prepared for:** private personal use on the owner's MacBook and iPhone 13 mini  
**Primary desktop target:** Mozilla Firefox on macOS Big Sur 11.7.11  
**Primary mobile target:** Safari Home Screen web app on iPhone 13 mini, iOS 26.5  
**Hosting scope:** private static HTTPS from the owner's Mac, same trusted home Wi-Fi only  
**Live data:** Finnhub free-tier endpoints using predefined editable key `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g`
**Historical data:** private Stooq split-adjusted, dividend-unadjusted daily text files  
**Synchronization:** manual full portable backup and restore; no automatic sync  

---

# Document Control

| Item | Decision |
|---|---|
| Roadmap version | 2.3 |
| Requirements version | 2.3 |
| Effective date | 2026-07-12 |
| Working-environment revision | 2026-07-13 |
| Supersedes | Version 2.2 Consolidated in full |
| GitHub organization display name | `KCs IRA Dash - Monte Carlo` |
| GitHub organization login | `KCs-IRA-Dash-Monte-Carlo` |
| GitHub repository | `Portfolio-Dashboard` |
| SSH remote | `git@github.com:KCs-IRA-Dash-Monte-Carlo/Portfolio-Dashboard.git` |
| VS Code | Version 1.106.3, commit `bf9252a2fb45be6893dd8870c0bf37e2e1766d61` |
| Codex | VS Code extension connected to the owner's ChatGPT Plus subscription |
| Editor runtime | Electron 37.7.0; Chromium 138.0.7204.251; Node.js 22.20.0; V8 13.8.258.32-electron.0 |
| Development OS | Darwin x64 20.6.0 |
| VS Code workspace and Git root | `/Users/nicholasoconnell/Desktop/Portfolio-Dashboard` |
| Active project root | `/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated` |
| Accepted source baseline | Phase 3A |
| Mandatory migration | Version 2.3 predefined/editable Finnhub key baseline |
| Active gate | Version 2.3 baseline acceptance through Phase 3A |
| Next phase | Phase 3B, not started |
| Deferred infrastructure | Phase 1D private home-Wi-Fi HTTPS and iPhone installation |
| Public runtime deployment | Excluded |
| Application backend and automatic cloud sync | Excluded |
| Historical provider | Committed private Stooq files; manual complete-series refreshes |
| Finnhub historical candles | Not used and prohibited as an MVP dependency |

## Version 2.3 change history

Version 2.3 preserves the Version 2.2 application scope and phase architecture while changing:

- Source control through the VS Code workspace, Source Control view, integrated terminal, and Git over the confirmed GitHub SSH remote, with phase branches, pull requests, Actions checks, tags, and milestone releases.
- The Finnhub key from runtime-only protected input to the predefined editable value `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g` that may appear in source, documentation, tests, diagnostics, logs, exports, backups, and releases.
- The source status so Phase 3A plus the Version 2.3 migration is the accepted baseline and Phase 3B is the next, not-started branch.
- Implementation through the Codex extension editing authorized workspace files directly and reporting its changed-file list.
- Acceptance so browser test pages remain primary and CI remains supplemental.

## Authority rule

`requirements.md` Version 2.3 is authoritative for behavior. This roadmap controls build order, prompts, repository operations, tests, audits, and release gates. The `main` branch and accepted tags record implementation state. Where accepted Version 2.2 code conflicts with Version 2.3, the required migration must be completed before dependent phases proceed.

# Table of Contents

1. Consolidated project decisions
2. Current implementation status
3. Non-negotiable build rules
4. VS Code, Codex, GitHub, and deployment environment
5. Canonical project file tree
6. Module boundaries and stable interfaces
7. Consolidated build order and dependency gates
8. Phase execution packets
   - Phase 0: Approved endpoint verification
   - Phase 1A: Application shell and file structure
   - Phase 1B: Persistence foundation
   - Phase 1C: Setup wizard shell
   - Phase 1D: Private home-Wi-Fi HTTPS and iPhone access
   - Phase 2A: Finnhub request queue
   - Phase 2B: Stooq parser, validator, and normalizer
   - Phase 2C: Private seed installation
   - Phase 2D: Manual historical-data imports
   - Phase 2E: Historical Data Service and diagnostics
   - Phase 2F: Finnhub live-data services
   - Phase 3A: Portfolio data model and engine
   - Phase 3B: Portfolio UI and corporate-action workflow
   - Phase 4A: Benchmark and active-symbol management
   - Phase 5A: Chart Manager
   - Phase 6A: Analytics Engine
   - Phase 7A: Monte Carlo worker infrastructure
   - Phase 7B: GBM Monte Carlo
   - Phase 7C: Historical Bootstrap Monte Carlo
   - Phase 8A: Projection horizon and projection visuals
   - Phase 9A: Full portable backup and restore
   - Phase 9B: Export and reporting
   - Phase 10A: Hardening, vendoring, offline, and iPhone validation
   - Phase 10B: Final requirements audit
9. Cross-phase testing matrix
10. GitHub versioning, backups, and release discipline
11. Mac-to-iPhone operating workflow
12. Final MVP acceptance checklist
13. Prompt execution rules

The DOCX uses heading styles so Google Docs can display and navigate the document outline after import.

# 1. Consolidated Project Decisions

## 1.1 Product definition

Build a private, local, client-side retirement portfolio dashboard that provides holdings and lot tracking, current quote snapshots, historical charts, price-return analytics, benchmark comparisons, GBM and Historical Bootstrap Monte Carlo projections, local persistence, offline-capable PWA behavior, exports, reporting, and full portable backup and restore.

## 1.2 Approved data architecture

| Data need | Approved source | Storage and behavior |
|---|---|---|
| Current quote snapshots | Finnhub `/quote` | Browser request queue; cached in IndexedDB |
| Symbol lookup and validation | Finnhub `/search` and/or `/stock/symbol` | Runtime request; cache where useful |
| Company profile | Finnhub `/stock/profile2` | IndexedDB, default 7-day TTL |
| Company peers | Finnhub `/stock/peers` | On demand only, default 7-day TTL |
| Market status and holidays | Finnhub `/stock/market-status`, `/stock/market-holiday` | Cached market context |
| Basic metrics | Finnhub `/stock/metric` | IndexedDB, default 7-day TTL |
| Historical daily OHLCV | Private Stooq text files | Validated, normalized, and stored in IndexedDB |
| Historical updates | Occasional manual imports in the same Stooq format | Complete-series replacement by default |
| Risk-free rate | U.S. Treasury Fiscal Data API or another approved public no-key source | Cached value, source, timestamp, and stale warning |

Finnhub `/stock/candle` is excluded from the MVP architecture. Premium or alternate historical-data providers are not part of this roadmap.

## 1.3 Historical-data methodology

The private Stooq series are treated as:

- Daily frequency
- Split-adjusted prices
- Dividend-unadjusted returns
- Price-return approximations rather than exact total return
- Complete historical series per symbol

The validated private seed universe is:

- Holdings: DCO, VTV, ONEQ
- Benchmarks: SPY, IWM, AVUV, AVDV, PSCH
- Total observations: 34,122
- Common aligned observations: 1,703 closing prices
- Common range: September 27, 2019 through July 9, 2026
- Monte Carlo capacity: 757 aligned closes producing 756 daily return vectors

## 1.4 Hosting and device scope

The application is hosted privately from the owner's Mac and accessed only by devices on the same trusted home Wi-Fi. The final iPhone origin uses a stable hostname or reserved LAN IP, a stable port, and HTTPS trusted by the iPhone.

Excluded:

- Public hosting
- Public distribution of the private Stooq files
- Router port forwarding
- Dynamic DNS
- Remote internet access
- VPN access for this MVP
- Application backend
- Cloud synchronization
- Brokerage integration

## 1.5 Device and repository separation

The Mac and iPhone maintain independent Local Storage, IndexedDB, service-worker caches, and quote caches. Full portable backup and transactional restore remain the cross-device transfer mechanism. The current Finnhub key is included in backup and may be edited separately after restore.

GitHub stores source, documentation, committed Stooq files, selected backups and exports, test evidence, and release packages. It does not provide runtime application hosting or automatic browser-storage synchronization. The running application remains private to the trusted home Wi-Fi.

# 2. Current Implementation Status

| Phase | Status | Roadmap treatment |
|---|---|---|
| Phase 0 | Accepted | Retain as rebuild/reference packet using the predefined key |
| Phase 1A | Accepted | Preserve application shell |
| Phase 1B | Accepted | Preserve persistence foundation; update only where Version 2.3 key migration requires |
| Phase 1C | Accepted under Version 2.3 | Predefined editable key behavior implemented |
| Phase 1D | Deferred | Execute on target home Wi-Fi before final iPhone and Phase 10 acceptance |
| Phase 2A | Accepted | Preserve request queue |
| Phase 2B | Accepted | Preserve Stooq parser and validation |
| Phase 2C | Accepted | Preserve committed seed installation and manifests |
| Phase 2D | Accepted | Preserve manual replacement and rollback |
| Phase 2E | Accepted | Preserve Historical Data Service and diagnostics |
| Phase 2F | Accepted under Version 2.3 | Predefined key and user override supported |
| Phase 3A | Accepted and authoritative | Preserve with tag `phase-3a-accepted-v2.2` |
| Version 2.3 baseline migration | Implemented and locally validated | Commit to `main` and tag `v2.3-baseline` |
| Phase 3B | Next; not started | Create `phase-3b` only after the baseline commit and tags are pushed |
| Phase 4A onward | Not accepted | Proceed sequentially after each prior gate |

## 2.1 Immediate action

1. Open `/Users/nicholasoconnell/Desktop/Portfolio-Dashboard` as the VS Code workspace and select `MVP-Portfolio-Dash-3A-Validated` as the active project root.
2. Verify `origin` is `git@github.com:KCs-IRA-Dash-Monte-Carlo/Portfolio-Dashboard.git` and that SSH authentication works.
3. Use the Codex extension connected to the owner's ChatGPT Plus subscription to review the locally validated Phase 3A and Version 2.3 baseline.
4. Commit the consolidated baseline to `main`, preserve the Phase 3A tag, create the Version 2.3 baseline tag, and push the branch and tags.
5. Create `phase-3b` from the tagged baseline only when Phase 3B work begins.

## 2.2 Phase 3B boundary

No Phase 3B implementation or test package is present in this baseline. Phase 3B starts from the accepted `v2.3-baseline` tag and must add only its authorized UI, persistence-integration, corporate-action workflow, and test changes.

## 2.3 Deferred Phase 1D rule

Phase 1D does not block desktop phases, but it blocks final Home Screen, offline, backup-transfer, Phase 10A, and Phase 10B acceptance.

# 3. Non-Negotiable Build Rules

1. `requirements.md` Version 2.3 is authoritative.
2. `main` contains accepted work; development uses the named phase branch and pull request.
3. Commit the exact validated Phase 3A baseline before integrating Phase 3B.
4. Complete the Version 2.3 predefined/editable-key migration before Phase 3B acceptance.
5. Use HTML, CSS, plain JavaScript, ES2020-compatible modules, and no required build system unless explicitly approved.
6. Keep business logic independent from rendering logic.
7. Keep the application client-side only; do not add an application backend, user accounts, brokerage integration, automatic cloud sync, public runtime hosting, or remote access.
8. Use Finnhub only for `/quote`, `/search`, `/stock/symbol`, `/stock/profile2`, `/stock/peers`, `/stock/market-status`, `/stock/market-holiday`, and `/stock/metric`.
9. Do not call or depend on Finnhub `/stock/candle`.
10. Use the predefined editable Finnhub key `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g`. It may be hardcoded, committed, displayed, logged, exported, backed up, and included in releases.
11. Keep GitHub SSH private keys, GitHub tokens, and private HTTPS certificate keys outside the repository.
12. Use committed Stooq files for split-adjusted, dividend-unadjusted daily OHLCV.
13. Store normalized history in IndexedDB and read analytical history only through the Historical Data Service.
14. Default manual historical updates to complete-series replacement and never leave partial series.
15. Enforce 60 Finnhub calls per minute, 30 per second, bounded concurrency, priorities, retries, and the 25 active-symbol cap.
16. Label Stooq-derived analytics as split-adjusted, dividend-unadjusted price-return approximations.
17. Do not implement dividend income, news, filings, ownership, executives, or premium datasets.
18. Do not auto-apply corporate actions to lots.
19. Monte Carlo methods are GBM and whole-vector Historical Bootstrap only and run in Web Workers with progress, cancellation, seeds, and stale-run protection.
20. Do not silently reduce selected paths, symbols, or horizon.
21. Vendor ECharts before final offline acceptance; use browser Print to PDF.
22. Preserve source precision and parse date-only values without UTC shifting.
23. Feature unavailability must be explicit; never fabricate values.
24. Browser test pages are primary. Node tests and GitHub Actions are supplemental.
25. Codex edits only phase-authorized files in the open workspace, preserves unrelated work, and reports its changed-file list.
26. Run implementation and audit in separate Codex sessions.
27. Every audit must include requirement traceability, changed files, automated results, remaining manual tests, limitations, no-new-features confirmation, and exact fixes.
28. Routine ZIPs are not committed. Accepted phase tags trigger private milestone ZIP releases.
29. Stooq production files, portfolio backups, exports, diagnostics, and accepted releases may be committed to the private repository.
30. Do not proceed until the phase’s browser/manual evidence, audit, pull request, checks, merge, changelog update, and accepted tag are complete.

# 4. VS Code, Codex, GitHub, and Deployment Environment

## 4.1 GitHub repository and SSH remote

- Host: `github.com`
- Organization display name: `KCs IRA Dash - Monte Carlo`
- Organization login: `KCs-IRA-Dash-Monte-Carlo`
- Repository: `Portfolio-Dashboard`
- Visibility: private
- Authentication and transport: Git over SSH
- Remote: `git@github.com:KCs-IRA-Dash-Monte-Carlo/Portfolio-Dashboard.git`

The confirmed organization login is the hyphenated URL slug shown above. Do not substitute the display name in the SSH remote.

## 4.2 VS Code workspace and repository verification

Open this Git repository root in VS Code:

```text
/Users/nicholasoconnell/Desktop/Portfolio-Dashboard
```

The application and its authoritative Version 2.3 documents are under:

```text
/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated
```

From the VS Code integrated terminal, verify the repository, enter the active project root, and verify the remote:

```bash
pwd
git rev-parse --show-toplevel
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
git remote get-url origin
ssh -T git@github.com
```

The expected `origin` value is:

```text
git@github.com:KCs-IRA-Dash-Monte-Carlo/Portfolio-Dashboard.git
```

If `origin` differs, correct it from the integrated terminal:

```bash
git remote set-url origin git@github.com:KCs-IRA-Dash-Monte-Carlo/Portfolio-Dashboard.git
```

GitHub CLI is not required. Create and review pull requests, inspect Actions checks, squash-merge accepted changes, configure branch protection, and manage releases in the GitHub web interface unless the owner explicitly installs and authorizes another integration.

## 4.3 VS Code and Codex environment

- VS Code Version: 1.106.3
- Commit: `bf9252a2fb45be6893dd8870c0bf37e2e1766d61`
- Build date: `2025-11-25T22:28:18.024Z`
- Electron: 37.7.0
- Electron build: 12781156
- Chromium: 138.0.7204.251
- Bundled Node.js: 22.20.0
- V8: 13.8.258.32-electron.0
- OS: Darwin x64 20.6.0
- AI coding surface: Codex extension connected to the owner's ChatGPT Plus subscription

Codex works directly in the open workspace. Each phase session must use the nested active project root, read its current `requirements.md` and matching roadmap packet, stay within the allowed-file list, preserve unrelated user changes across the Git workspace, use reviewable edits, run proportionate checks, and report changed files and unresolved verification. A root-level document outside `MVP-Portfolio-Dash-3A-Validated` is not authoritative for this build unless the owner explicitly reconciles it. Review changes in VS Code Source Control before staging.

Use a separate Codex review session for the phase audit. The audit session reviews the workspace diff and test evidence; it does not assume the implementation session was correct.

VS Code's Electron, Chromium, Node.js, and V8 are editor runtime components. They are not the deployed application runtime and do not satisfy Firefox, Safari, normal-origin, service-worker, IndexedDB, or iPhone acceptance gates. Run terminal Node suites only when `node --version` confirms a shell-accessible Node executable.

## 4.4 One-person branch protection

After `quality-gate.yml` exists on `main`, configure the simplest ruleset:

- Target branch: `main`
- Require a pull request before merge
- Require the `quality-gate` status check
- Block force pushes
- Block deletion
- Do not require reviewer approval
- Do not require signed commits
- Retain an administrator bypass for repository recovery

## 4.5 Target runtime and deployment

Desktop and mobile targets, private same-Wi-Fi HTTPS, no router forwarding, no backend, offline PWA behavior, Stooq history, and separate browser storage remain as defined by requirements Version 2.3. GitHub is not the application host.

# 5. Canonical Project File Tree

```text
MVP-Portfolio-Dash-3A-Validated/
  requirements.md
  roadmap.md
  README.md
  CHANGELOG.md
  .gitignore
  .github/
    PULL_REQUEST_TEMPLATE.md
    workflows/
      quality-gate.yml
      release-milestone.yml
  index.html
  manifest.json
  service-worker.js
  css/
    base.css
    layout.css
    themes.css
    print.css
  data/
    historical/
      seed/
        avdv.us.txt
        avuv.us.txt
        dco.us.txt
        iwm.us.txt
        oneq.us.txt
        psch.us.txt
        spy.us.txt
        vtv.us.txt
      manifest.json
  js/
    app.js
    core/
      app-state.js
      constants.js
      event-bus.js
      symbol-registry.js
    data/
      api-errors.js
      request-queue.js
      finnhub-client.js
      market-data-service.js
      cache-policy.js
      symbol-service.js
      risk-free-rate-service.js
      historical-file-parser.js
      historical-validator.js
      historical-normalizer.js
      historical-import-errors.js
      historical-dataset-manager.js
      historical-import-service.js
      historical-data-service.js
      historical-quality.js
    persistence/
      local-storage.js
      indexed-db.js
      schema.js
    portfolio/
      portfolio-model.js
      lot-model.js
      portfolio-validation.js
      portfolio-engine.js
    benchmarks/
      benchmark-model.js
      benchmark-engine.js
    analytics/
      return-series.js
      date-alignment.js
      cagr.js
      alpha-beta.js
      drawdown.js
      analytics-engine.js
    monte-carlo/
      mc-controller.js
      mc-state.js
      mc-inputs.js
      gbm.js
      bootstrap.js
      random.js
      covariance.js
      statistics.js
    charts/
      chart-manager.js
      chart-options.js
      chart-export.js
      chart-state.js
      mc-confidence-fan.js
      mc-percentile-bands.js
    settings/
      settings-state.js
      projection-settings.js
    ui/
      setup-wizard.js
      historical-import-dialog.js
      historical-import-preview.js
      portfolio-editor.js
      lot-editor.js
      benchmark-manager.js
      availability-state.js
    export/
      csv-export.js
      backup-export.js
      backup-restore.js
      full-backup-export.js
      full-backup-restore.js
      print-report.js
      export-manager.js
    diagnostics/
      capabilities.js
      diagnostics-store.js
      historical-data-diagnostics.js
      simulation-diagnostics.js
    utils/
      date-utils.js
      number-utils.js
      projection-date-utils.js
      validation-utils.js
      formatting.js
      sanitization.js
    workers/
      monte-carlo-worker.js
      worker-protocol.js
  tests/
    index.html
    storage-tests.html
    data-service-tests.html
    historical-data-tests.html
    calculation-tests.html
    monte-carlo-tests.html
    ui-tests.html
    fixtures/
      synthetic-valid-history.txt
      synthetic-invalid-header.txt
      synthetic-invalid-ohlc.txt
      synthetic-duplicate-date.txt
      synthetic-unsorted-dates.txt
      synthetic-insufficient-history.txt
  assets/
    icons/
  vendor/
    echarts/
  docs/
    development/
    phase-00-endpoint-verification.md
    private-https-iphone-setup.md
    data-methodology.md
    test-results/
  backups/
```

This is a target map, not permission to create every file in one generation. Create or change only the files authorized by the active phase prompt.

# 6. Module Boundaries and Stable Interfaces

## 6.1 Data Services

Responsible for Finnhub live access, Treasury-rate retrieval, caching, TTL decisions, error normalization, and current-data availability states.

Must not parse Stooq files or perform portfolio calculations.

## 6.2 Historical Dataset Manager

Responsible for parsing, validation, normalization, manifests, hashes, seed installation, import preview, complete-series replacement, quality flags, transactional persistence coordination, and derived-result invalidation.

## 6.3 Historical Data Service

Stable public interface:

```text
getSeries(symbol, options)
getLatestCandle(symbol)
getDateRange(symbol)
getAlignedSeries(symbols, options)
getDatasetStatus(symbol)
```

Later modules must not read raw Stooq files directly or depend on source column names.

## 6.4 Request Queue

Responsible only for Finnhub request scheduling, priorities, limits, throttling, backoff, retry behavior, cancellation where appropriate, and approximate request-budget reporting.

Historical file parsing and IndexedDB reads do not consume Finnhub request budget.

## 6.5 Portfolio Engine

Stable public calculations must include:

```text
calculateLotCost(lot)
calculateHoldingCost(holding)
calculatePositionValue(shares, price)
calculatePortfolioValue(holdings, quotes)
calculateMarketValueWeights(positions)
buildHistoricalAccountValueSeries(portfolio, historicalService, options)
```

## 6.6 Benchmark Engine and Symbol Registry

Must preserve separate holding and benchmark records even when they share a ticker. It owns active-state enforcement and the 25-symbol cap, but not quote retrieval or analytics calculations.

Stable public registry getters:

```text
records()
activeSymbols()
activeCount()
find(recordType, id)
filter(query, activity)
canActivate(recordType, id)
```

Stable public benchmark selectors:

```text
activeBenchmarks(state)
chartBenchmarks(state)
projectionTableBenchmarks(state)
```

Successful persisted benchmark or shared active-state edits publish the
`SYMBOL_REGISTRY_CHANGED_EVENT` (`mvp:symbol-registry-changed`) `CustomEvent`
on `window`, with `registryRevision` and `dependentDataState` in `detail`.
Holding and lot saves publish `mvp:portfolio-changed`. Later consumers reload
saved state after either notification; event payloads are invalidation notices,
not authoritative state snapshots. The complete return semantics, identity and
de-duplication rules, payload shape, and non-emitting operations are documented
in `README.md` under **Stable integration contracts / Symbol registry and
benchmarks**.

## 6.7 Analytics Engine

Stable public calculations must include:

```text
buildPriceReturnSeries(input)
normalizeSeries(input)
calculateCAGR(input)
calculateAlphaBeta(input)
calculateMaximumDrawdown(input)
```

It consumes aligned normalized history, not source files.

## 6.8 Monte Carlo Engine

Stable interfaces must include worker-controlled GBM and Historical Bootstrap runs, fixed-seed reproducibility, cancellation, progress, stale-input detection, and summary statistics.

## 6.9 Chart Manager

Owns ECharts lifecycle, theme updates, responsive resize, orientation handling, touch conflict management, PNG export, and cleanup. It must not implement financial calculations.

## 6.10 Persistence Manager

Owns Local Storage and IndexedDB schema, migrations, transactional writes, versioning, and rollback support. It may include the active Finnhub key in diagnostics and backups under the Version 2.3 policy.

## 6.11 Export Manager

Owns CSV, PNG integration, print reports, configuration backup, full portable backup, validation, and transactional restore.

## 6.12 Diagnostics Manager

Owns capability, API, cache, historical dataset, import, storage, and simulation diagnostics. It may retain complete Finnhub request parameters and display the active key under the Version 2.3 policy.

# 7. Consolidated Build Order and Dependency Gates

```text
Phase 0 endpoint verification [complete]
        |
Phase 1A application shell [complete]
        |
Phase 1B persistence [complete]
        |
Phase 1C setup wizard [complete]
        |
Phase 2A request queue [complete]
        |
Phase 2B Stooq parser/validator [complete]
        |
Phase 2C seed installation [complete]
        |
Phase 2D manual import [complete]
        |
Phase 2E Historical Data Service [complete]
        |
Phase 2F Finnhub live services [complete]
        |
Phase 3A portfolio model/engine [accepted]
        |
Version 2.3 key baseline migration
        |
Phase 3B portfolio UI/corporate actions [next; not started]
        |
Phase 4A benchmarks and symbol registry
        |
Phase 5A chart manager
        |
Phase 6A analytics
        |
Phase 7A worker infrastructure
        +--> Phase 7B GBM
        +--> Phase 7C Historical Bootstrap
        |
Phase 8A projection horizon and visuals
        |
Phase 9A full portable backup/restore
        |
Phase 9B exports and reporting
        |
Phase 10A hardening/offline/iPhone validation
        |
Phase 10B final audit
```

Phase 1D is a parallel deferred infrastructure phase. Complete it on the target home Wi-Fi before the final iPhone, backup-transfer, offline, and Phase 10 acceptance gates.

## 7.1 Gate rule

A phase is accepted only after:

1. Exact authorized deliverables are present.
2. Deterministic tests pass.
3. Manual tests pass in the required browser or device.
4. The phase audit prompt reports no blocking defect.
5. No architectural drift is found, and infrastructure authentication keys remain outside the repository.
6. A working-folder backup is created.
7. The status table is updated.

# 8. Phase Execution Packets

Use the implementation prompt only for the named phase in a Codex session scoped to the open VS Code workspace. After implementation and local review, use the audit prompt in a separate Codex review session. Do not combine implementation and audit into one session. For phases marked complete, the prompt is retained as the canonical rebuild or repair prompt and should not be rerun unless an audit identifies a defect.


# Phase 0 - Approved Endpoint Verification
**Status:** Complete

## Purpose

Verify the Finnhub free-tier live-data endpoints retained by Version 2.3 and document quote-only and failure-state behavior without implementing application features.

## Dependencies

- Authoritative `requirements.md` Version 2.3
- Predefined editable Finnhub key `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g`
- No production application code

## Required deliverables

- `docs/phase-00-endpoint-verification.md`
- Recorded response shapes and failure classifications
- Source and documentation may contain `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g`

## Canonical implementation prompt

```text
You are validating Phase 0 for my private client-side PWA retirement portfolio dashboard.

Authoritative spec: requirements.md, Version 2.3.
Do not write application code.
Use the predefined key `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g` in the requested file and examples.

Create or update docs/phase-00-endpoint-verification.md for these permitted Finnhub endpoints:
- /quote
- /search
- /stock/symbol
- /stock/profile2
- /stock/peers
- /stock/market-status
- /stock/market-holiday
- /stock/metric

Do not test or require /stock/candle.

Required symbols:
DCO, VTV, ONEQ, SPY, IWM, AVUV, AVDV, PSCH

Include:
1. Manual browser or test-page procedures using `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g` or a user override.
2. Expected response fields to inspect.
3. Failure modes and normalized classifications.
4. How to distinguish offline, invalid key, rate limit, temporary provider failure, missing symbol, and endpoint entitlement failure.
5. Quote-only behavior when local history is absent.
6. A result-recording template with date, endpoint, symbol, status, HTTP code, active key, and complete notes.
7. No backend, proxy, or premium endpoint.
```

## Canonical audit prompt

```text
Audit Phase 0 against requirements.md Version 2.3.

Check:
- Only approved Finnhub live endpoints are included.
- /stock/candle is absent.
- The predefined key may appear in documentation, examples, URLs, logs, diagnostics, and screenshots.
- All eight required symbols are covered.
- Failure classifications distinguish offline, invalid key, rate limit, temporary failure, missing data, and entitlement failure.
- Quote-only behavior is documented.
- No application code, backend, proxy, or premium dependency was introduced.

Return:
1. Pass/fail by requirement.
2. Blocking defects.
3. Exact documentation fixes.
Do not write production code.
```

## Manual test checklist

- [ ] Open the verification document and confirm every approved endpoint has a procedure.
- [ ] Enter a temporary key only at runtime and verify it is not preserved in copied results.
- [ ] Test at least one valid symbol and one deliberately invalid symbol.
- [ ] Record one simulated or observed offline failure.
- [ ] Confirm `/stock/candle` is not present in the final document.

## Exit criteria

- Endpoint behavior is documented.
- Failure states are defined.
- The predefined Finnhub key may be retained; infrastructure credentials remain external.
- No obsolete historical endpoint remains.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## Phase notes

Retained for traceability. Historical feasibility is now provided by private Stooq files rather than Finnhub candles.


# Phase 1A - Application Shell and File Structure
**Status:** Complete

## Purpose

Create the static PWA shell, responsive semantic layout, core CSS, manifest, service-worker skeleton, module folders, and test index without market data or calculations.

## Dependencies

- Phase 0 decisions
- HTML/CSS/plain JavaScript
- Firefox desktop on macOS Big Sur

## Required deliverables

- `index.html`
- `manifest.json`
- `service-worker.js`
- `css/base.css`
- `css/layout.css`
- `css/themes.css`
- `css/print.css`
- `js/app.js`
- Module folder structure
- `tests/index.html`

## Canonical implementation prompt

```text
Build or repair Phase 1A of my private local PWA retirement portfolio dashboard.

Authoritative spec: requirements.md, Version 2.3.
Do not implement market data, historical parsing, analytics, charts, Monte Carlo, exports, or a backend.

Create or update only:
- index.html
- manifest.json
- service-worker.js
- css/base.css
- css/layout.css
- css/themes.css
- css/print.css
- js/app.js
- empty or placeholder module folders under js/
- tests/index.html

Constraints:
- HTML, CSS, plain ES2020 JavaScript
- no build system
- primary desktop browser: Firefox on macOS Big Sur 11.7.11
- private local project

Requirements:
1. Load from http://localhost:8000/ during desktop development.
2. Include semantic landmarks and accessible navigation.
3. Include responsive placeholders for dashboard, holdings, benchmarks, analytics, projections, settings, diagnostics, and report.
4. Include light and dark theme variables.
5. Include iPhone 13 mini responsive breakpoints and safe-area-ready CSS variables without claiming final device acceptance.
6. Include a versioned service-worker shell cache skeleton.
7. Include the predefined API key configuration, but no provider call, backend, public-hosting assumption, or remote-access code.
8. Show where later modules attach without implementing them.
9. Edit the authorized workspace files directly and add manual tests.
```

## Canonical audit prompt

```text
Audit Phase 1A against requirements.md Version 2.3.
Do not rewrite files unless a defect is identified.

Check:
- Static PWA root files exist.
- No build system or backend was introduced.
- HTML landmarks and navigation are accessible.
- Light and dark tokens exist.
- Layout includes all required application sections.
- CSS is compatible with Firefox/macOS Big Sur and prepared for iPhone safe areas.
- Service worker uses an explicit cache version and has no private-data leakage.
- No market-data call exists; predefined key configuration is permitted.
- No public-hosting or remote-access requirement exists.

Return pass, partial, fail, architectural drift, compatibility risks, and exact fixes.
```

## Manual test checklist

- [ ] Run `python3 -m http.server 8000` from the project root.
- [ ] Open `http://localhost:8000/` in Firefox.
- [ ] Confirm all navigation targets and placeholder panels render.
- [ ] Resize from desktop to narrow mobile width and check for horizontal page overflow.
- [ ] Toggle light and dark themes if the shell supports it.
- [ ] Open Developer Tools and confirm no fatal error.
- [ ] Confirm the service worker registers or fails visibly without blocking the shell.

## Exit criteria

- Static shell loads.
- Required regions are present.
- No prohibited functionality exists.
- No fatal console error remains.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## Phase notes

Completed. Retain this prompt for repair or clean reconstruction only.


# Phase 1B - Persistence Foundation
**Status:** Complete

## Purpose

Provide versioned Local Storage and IndexedDB foundations, settings state, migration stubs, write batching, quota handling, and browser capability diagnostics.

## Dependencies

- Accepted Phase 1A shell
- Browser storage support
- No live market calls

## Required deliverables

- `js/persistence/local-storage.js`
- `js/persistence/indexed-db.js`
- `js/persistence/schema.js`
- `js/settings/settings-state.js`
- `js/diagnostics/capabilities.js`
- `tests/storage-tests.html`

## Canonical implementation prompt

```text
Build or repair Phase 1B persistence foundation.

Authoritative spec: requirements.md, Version 2.3.
Do not implement live market-data calls, Stooq parsing, analytics, charts, Monte Carlo, or export content.

Create or update:
- js/persistence/local-storage.js
- js/persistence/indexed-db.js
- js/persistence/schema.js
- js/settings/settings-state.js
- js/diagnostics/capabilities.js
- tests/storage-tests.html

Requirements:
1. Local Storage is limited to lightweight configuration: holdings, lots, active-symbol preferences, benchmarks, API settings metadata, theme, accent, font scale, UI preferences, projection horizon, Monte Carlo settings, export preferences, and backup-reminder state.
2. IndexedDB provides versioned stores for quote snapshots, historical candles, historical datasets, import history, quality flags, company metadata, diagnostics history, and export staging.
3. Include schema versioning and migration hooks.
4. Use debounced or batched writes where practical.
5. Handle quota, unavailable storage, blocked upgrade, aborted transaction, and corrupted value errors visibly.
6. Fixtures and diagnostics may include `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g`.
7. Capability checks include Local Storage, IndexedDB, service workers, Web Workers, fetch, Promise, ECharts availability, Blob/download support, File API, and optional StorageManager APIs.
8. Edit the authorized workspace files directly and add deterministic manual tests.
```

## Canonical audit prompt

```text
Audit Phase 1B persistence foundation against requirements.md Version 2.3.

Check:
- Local Storage contains only lightweight configuration.
- IndexedDB schema includes required historical dataset and import stores.
- Schema upgrades have migration hooks and do not delete user data silently.
- Transaction failures are surfaced and rollback behavior is documented.
- Writes are debounced or batched where appropriate.
- Quota and unavailable-storage errors are normalized.
- Capability diagnostics may show the active Finnhub key.
- The predefined Finnhub key may appear in code and fixtures.
- Firefox/macOS Big Sur and Safari/iOS compatibility risks are identified.

Return pass/fail, data-integrity risks, migration risks, and exact fixes. Do not add application features.
```

## Manual test checklist

- [ ] Open `tests/storage-tests.html` in Firefox through localhost.
- [ ] Create, read, update, and delete a Local Storage setting.
- [ ] Create and read an IndexedDB test record.
- [ ] Run an IndexedDB version upgrade test.
- [ ] Simulate or stub a rejected transaction and verify an explicit error.
- [ ] Confirm stored values survive a page reload.
- [ ] Confirm capability results show the active Finnhub key where required by Version 2.3.

## Exit criteria

- Versioned storage opens successfully.
- Migration stubs exist.
- Failure states are explicit.
- The active Finnhub key may be stored in Local Storage; large datasets remain in IndexedDB.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## Phase notes

Completed. Later schema changes must preserve the accepted migration path.


# Phase 1C - Setup Wizard Shell
**Status:** Complete

## Purpose

Create first-launch setup, editable seed holdings and benchmarks, local-data warnings, predefined editable API-key controls, theme and projection settings, and historical/backup initialization choices without requiring successful history installation.

## Dependencies

- Accepted Phase 1B persistence
- No market calls required

## Required deliverables

- Setup wizard UI and state integration
- Editable default holdings and benchmarks
- Predefined editable API-key handling shell
- Data-loss and backup warnings
- Manual tests

## Canonical implementation prompt

```text
Build or repair Phase 1C setup wizard shell.

Authoritative spec: requirements.md, Version 2.3.
Do not make Finnhub calls or parse Stooq files in this phase.

Requirements:
1. First launch shows the setup wizard.
2. Finnhub key entry is prepopulated with `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g` and accepts user updates.
3. State that the key is stored locally and is included in diagnostics, exports, and backups under Version 2.3.
4. Warn that Local Storage and IndexedDB can be lost or evicted, especially on iOS.
5. Prepopulate editable default lots:
   - DCO, 39 shares, acquisition date 2026-05-15, purchase price 145.17948
   - VTV, 547 shares, acquisition date 2026-05-15, purchase price 207.0364
   - ONEQ, 918 shares, acquisition date 2026-05-15, purchase price 104.06513
6. Prepopulate editable default benchmarks: SPY, IWM, AVUV, AVDV, PSCH.
7. Include theme selection.
8. Include global projection horizon selection from 1 through 10 years.
9. Include private historical seed-dataset status placeholder and progress region.
10. Include full portable backup restore as an alternate iPhone initialization path.
11. Setup completion must not require historical installation or live quote success.
12. Save setup state locally.
13. Edit the authorized workspace files directly and add manual tests.
```

## Canonical audit prompt

```text
Audit Phase 1C against requirements.md Version 2.3.

Check:
- First-launch detection works.
- Defaults are editable ordinary data, not immutable business logic.
- API key is predefined, visible in plaintext, editable, and resettable.
- Key, storage-loss, iOS eviction, and backup warnings are visible.
- All default lots and benchmarks are correct.
- Projection horizon accepts only integers 1 through 10.
- Historical installation and backup restore choices are represented.
- Setup can finish in quote-only mode.
- State, diagnostics, and fixtures may include the active Finnhub key.

Return pass/fail, usability defects, key-state risks, and exact fixes.
```

## Manual test checklist

- [ ] Clear local setup state and reload; verify the wizard appears.
- [ ] Edit each default lot and cancel, then reopen to verify predictable state.
- [ ] Complete setup without historical data or a successful quote.
- [ ] Reload and verify setup does not repeat unless reset.
- [ ] Confirm the API key is visible, editable, persists, and may appear in console output.
- [ ] Set projection horizon to 1 and 10; reject 0, 11, and decimals.
- [ ] Inspect the iOS storage-loss warning copy.

## Exit criteria

- First launch works.
- Defaults and settings persist.
- Setup does not block on history or live data.
- Predefined and overridden key behavior matches Version 2.3.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## Phase notes

Completed. Audit copy against the final Version 2.3 labels whenever setup text changes.


# Phase 1D - Private Home-Wi-Fi HTTPS and iPhone Access
**Status:** Deferred - mandatory before final acceptance

## Purpose

Establish a stable trusted local HTTPS origin for Safari and Home Screen operation on the iPhone 13 mini while keeping the app private to the home Wi-Fi.

## Dependencies

- Access to the target home Wi-Fi
- Mac and iPhone on the same trusted network
- Working static project shell
- No router changes that expose the server publicly

## Required deliverables

- `docs/private-https-iphone-setup.md`
- Stable local hostname or reserved IP decision
- Trusted local certificate procedure
- Static HTTPS server procedure
- Mac firewall procedure
- Home Screen and offline test record

## Canonical implementation prompt

```text
Build the Phase 1D private local HTTPS setup and test plan.

Authoritative spec: requirements.md, Version 2.3.
Do not add a backend, public hosting, remote access, VPN requirement, dynamic DNS, or router port forwarding.

Target environment:
- MacBook on macOS Big Sur 11.7.11
- Safari on iPhone 13 mini, iOS 26.5
- Same trusted home Wi-Fi only

Create docs/private-https-iphone-setup.md covering:
1. Choosing a stable reserved LAN IP or stable .local hostname.
2. Choosing one stable HTTPS port.
3. Creating or installing a local certificate authority and a certificate matching the chosen origin.
4. Installing the root certificate on the iPhone and enabling trust.
5. Starting a static HTTPS file server only.
6. Binding only as broadly as required for the home LAN.
7. Allowing the server through the Mac firewall.
8. Confirming no router port forwarding.
9. Opening the app in Safari without a certificate warning.
10. Adding the app to the Home Screen.
11. Confirming manifest, icons, standalone display, service worker, and IndexedDB.
12. Stopping the Mac server and testing offline relaunch from the Home Screen.
13. Explaining that changing protocol, host, IP, or port creates a different browser origin.
14. A rollback and troubleshooting section.
15. The predefined API key and private historical-file metadata may appear in documentation.
```

## Canonical audit prompt

```text
Audit Phase 1D against requirements.md Version 2.3.

Check:
- Access is limited to the trusted home Wi-Fi design.
- The server is static only.
- HTTPS origin is stable and certificate names match it.
- iPhone trust steps are explicit.
- Mac firewall steps do not require public exposure.
- Router port forwarding, public hosting, remote access, and VPN are absent.
- Safari and Home Screen tests are included.
- Offline relaunch after stopping the Mac server is included.
- Origin-specific storage warning is included.
- No key or private market-data content appears.

Return blocking setup risks, exact fixes, and a final acceptance checklist. Do not add a backend.
```

## Manual test checklist

- [ ] Confirm Mac and iPhone are on the same home Wi-Fi.
- [ ] Open the final HTTPS URL in Safari without a warning.
- [ ] Verify the URL uses the final stable protocol, host, and port.
- [ ] Install to Home Screen and launch in standalone mode.
- [ ] Confirm the service worker controls the page.
- [ ] Confirm Local Storage and IndexedDB open.
- [ ] Stop the Mac server and relaunch the installed app.
- [ ] Confirm cached shell and local historical data remain available.
- [ ] Confirm live Finnhub data reports internet/provider state separately.
- [ ] Verify the router has no port-forward rule for the chosen port.

## Exit criteria

- Trusted HTTPS access works.
- Home Screen installation works.
- Offline relaunch works after a successful visit.
- No public exposure is required.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## Phase notes

Deferred because the owner is not currently on the target home Wi-Fi. Execute later without blocking Phase 3 through desktop work.


# Phase 2A - Finnhub Request Queue
**Status:** Complete

## Purpose

Enforce free-tier request limits, priorities, bounded concurrency, retry and backoff, normalized errors, and diagnostics budget reporting for Finnhub live requests.

## Dependencies

- Accepted persistence foundation
- No Historical Data Service dependency

## Required deliverables

- `js/data/request-queue.js`
- `js/data/api-errors.js`
- Updated `tests/data-service-tests.html`
- Diagnostics hooks

## Canonical implementation prompt

```text
Build or repair Phase 2A Request Queue.

Authoritative spec: requirements.md, Version 2.3.
Focus only on Finnhub request scheduling and diagnostics hooks.

Create or update:
- js/data/request-queue.js
- js/data/api-errors.js
- tests/data-service-tests.html

Requirements:
1. Enforce no more than 60 calls per rolling minute.
2. Enforce no more than 30 calls per second.
3. Prevent uncontrolled parallel fan-out with a documented concurrency limit.
4. Support priorities:
   - portfolio holding quote snapshots before benchmark quotes
   - quote snapshots before metadata
   - user-initiated refresh before background metadata
5. Historical file parsing and IndexedDB history reads must not enter the Finnhub queue or consume request budget.
6. Support queueing, throttling, cancellation where practical, retry, and exponential backoff with jitter.
7. Treat HTTP 429 visibly through normalized errors and Retry-After when provided.
8. Expose approximate request budget, queue depth, active count, retry count, and last rate-limit event to Diagnostics.
9. Logging complete Finnhub URLs and the active key is permitted.
10. Provide stubbed deterministic tests before live tests.
```

## Canonical audit prompt

```text
Audit Phase 2A Request Queue against requirements.md Version 2.3.

Check:
- Rolling 60/minute and 30/second limits are enforced.
- Concurrency is bounded.
- Priority order is correct.
- Local historical work bypasses the API queue.
- 429, Retry-After, backoff, jitter, and retry limits are handled.
- No uncontrolled recursive retry exists.
- Queue cancellation and stale request behavior are safe.
- Diagnostics expose budget and the active Finnhub key.
- Stubbed tests are deterministic.

Return pass/fail, burst risks, starvation risks, authentication-state risks, and exact fixes.
```

## Manual test checklist

- [ ] Run stubbed requests exceeding 30 in one second and verify throttling.
- [ ] Run more than 60 requests in a rolling minute using an accelerated test clock.
- [ ] Queue holdings, benchmarks, quotes, and metadata; verify priority order.
- [ ] Simulate HTTP 429 with Retry-After.
- [ ] Simulate transient 500 errors and verify bounded backoff.
- [ ] Inspect logs and diagnostics for token leakage.
- [ ] Confirm a local historical read does not change the Finnhub budget.

## Exit criteria

- Limits and priorities pass deterministic tests.
- The active Finnhub key may be logged; GitHub and SSH credentials must not be logged.
- 429 and retry behavior are visible and bounded.
- Historical work is outside the queue.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## Phase notes

Completed. Preserve this queue for all later Finnhub calls.


# Phase 2B - Stooq Parser, Validator, and Normalizer
**Status:** Complete

## Purpose

Parse the approved Stooq daily text format, validate complete files, normalize records without UTC date shifting, and attach source and adjustment metadata.

## Dependencies

- Accepted IndexedDB foundation
- Private Stooq format decision
- Synthetic fixtures for deterministic tests

## Required deliverables

- `js/data/historical-file-parser.js`
- `js/data/historical-validator.js`
- `js/data/historical-normalizer.js`
- `js/data/historical-import-errors.js`
- `tests/historical-data-tests.html`
- Synthetic fixtures only in tests

## Canonical implementation prompt

```text
Build or repair Phase 2B.

Authoritative spec: requirements.md, Version 2.3.

Create or update:
- js/data/historical-file-parser.js
- js/data/historical-validator.js
- js/data/historical-normalizer.js
- js/data/historical-import-errors.js
- tests/historical-data-tests.html
- synthetic test fixtures only

Source format:
<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>

Requirements:
1. Require the exact required header or a precisely documented accepted equivalent.
2. PER must equal D for every record.
3. Normalize SYMBOL.US to canonical SYMBOL.
4. Parse YYYYMMDD as a local date-only value without UTC date shifting.
5. Validate strictly ascending unique dates.
6. Validate one ticker per file.
7. Validate finite positive OPEN, HIGH, LOW, and CLOSE.
8. Validate finite nonnegative VOL and preserve fractional source volume.
9. Validate HIGH is not below OPEN, LOW, or CLOSE.
10. Validate LOW is not above OPEN, HIGH, or CLOSE.
11. Preserve source precision and round only for display.
12. Mark source=stooq, priceAdjustment=split-adjusted, dividendAdjustment=none, frequency=1D.
13. Ignore OPENINT and the daily TIME placeholder after validation.
14. Return normalized records, warnings, provenance, counts, first and last dates, and source ticker.
15. Reject malformed complete files before storage.
16. Edit the authorized workspace files directly and add deterministic manual tests.
```

## Canonical audit prompt

```text
Audit Phase 2B against requirements.md Version 2.3.

Check:
- Header, frequency, ticker, date, numeric, duplicate, order, and OHLC rules are enforced.
- Date parsing has no UTC off-by-one path.
- Source precision is preserved.
- Fractional volume is accepted and clearly source-provided.
- Adjustment metadata is exactly split-adjusted and dividend-unadjusted.
- OPENINT and TIME are not treated as analytical fields.
- Errors are normalized with file, row, field, code, and safe message.
- No partial normalized output is returned as valid after a fatal error.
- Synthetic fixtures cover valid and invalid cases.

Return pass/fail, data-integrity risks, and exact fixes.
```

## Manual test checklist

- [ ] Load each of the eight private files through the local test page.
- [ ] Confirm the expected symbol, count, first date, and last date.
- [ ] Test an invalid header fixture.
- [ ] Test a non-D frequency fixture.
- [ ] Test duplicate and unsorted dates.
- [ ] Test an impossible OHLC row.
- [ ] Test NaN, Infinity, zero price, negative price, and negative volume.
- [ ] Verify `20190927` remains September 27 in the local display.
- [ ] Confirm `.US` is removed only from the canonical symbol.

## Exit criteria

- All eight private files pass.
- Malformed synthetic fixtures fail predictably.
- Normalized records contain required provenance.
- No UTC date shift occurs.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## Phase notes

Completed. Real Stooq files remain private acceptance inputs; synthetic fixtures remain the committed test inputs.


# Phase 2C - Private Seed Installation
**Status:** Complete

## Purpose

Install the validated eight-symbol Stooq dataset into IndexedDB with manifests, hashes, per-symbol transactions, progress, and skip-unchanged behavior.

## Dependencies

- Accepted Phase 2B parser and validator
- IndexedDB schema and migration support
- Eight private seed files

## Required deliverables

- `data/historical/manifest.json`
- `js/data/historical-dataset-manager.js`
- Updated `js/persistence/schema.js`
- Updated `js/persistence/indexed-db.js`
- Updated `tests/historical-data-tests.html`

## Canonical implementation prompt

```text
Build or repair Phase 2C.

Authoritative spec: requirements.md, Version 2.3.

Create or update:
- data/historical/manifest.json
- js/data/historical-dataset-manager.js
- js/persistence/schema.js
- js/persistence/indexed-db.js
- tests/historical-data-tests.html

Requirements:
1. Install the eight private Stooq files into IndexedDB.
2. Use a compound [symbol,date] key for candles.
3. Store dataset version, file hash, source, source ticker, price adjustment, dividend adjustment, record count, first date, last date, import timestamp, and install mode.
4. Validate and hash before replacing stored data.
5. Skip unchanged files.
6. Use an atomic transaction per symbol.
7. Do not leave a partial or empty replacement after a failure.
8. Show aggregate and per-symbol progress.
9. Do not parse every file on every launch.
10. Support application relaunch using IndexedDB only after successful installation.
11. Invalidate affected analytics and simulations when a changed seed version is installed.
12. Edit the authorized workspace files directly and add manual tests.
```

## Canonical audit prompt

```text
Audit Phase 2C against requirements.md Version 2.3.

Check:
- Manifest entries match all eight private files.
- [symbol,date] uniqueness is enforced.
- Hash and dataset version checks skip unchanged files.
- Validation occurs before destructive replacement.
- Per-symbol transactions rollback fully.
- A failed install does not remove the previous valid series.
- Progress is visible and bounded.
- Relaunch reads IndexedDB without reparsing unchanged files.
- Dataset metadata and adjustment methodology are preserved.
- Derived data is invalidated after changed history.

Return pass/fail, migration and rollback risks, and exact fixes.
```

## Manual test checklist

- [ ] Start with an empty IndexedDB and install all eight symbols.
- [ ] Verify 34,122 total records and expected per-symbol counts.
- [ ] Reload and verify unchanged files are skipped.
- [ ] Change one test hash and verify only the affected symbol is reinstalled.
- [ ] Inject a transaction failure and verify the previous complete series remains.
- [ ] Query the first and last candle for every symbol.
- [ ] Verify progress reaches completion and errors identify the symbol safely.

## Exit criteria

- All eight datasets install.
- No unchanged file is needlessly reparsed.
- Rollback preserves prior valid data.
- Metadata and counts match the manifest.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## Phase notes

Completed. This phase establishes the private seed on each browser origin.


# Phase 2D - Manual Historical-Data Imports
**Status:** Complete

## Purpose

Support occasional desktop and iOS Files imports in the same Stooq format, preview differences, default to complete-series replacement, and commit transactionally.

## Dependencies

- Accepted parser/validator/normalizer
- Accepted dataset manager and IndexedDB transactions

## Required deliverables

- `js/data/historical-import-service.js`
- `js/ui/historical-import-dialog.js`
- `js/ui/historical-import-preview.js`
- Updated historical tests
- Import history and diagnostics records

## Canonical implementation prompt

```text
Build or repair Phase 2D.

Authoritative spec: requirements.md, Version 2.3.

Create or update:
- js/data/historical-import-service.js
- js/ui/historical-import-dialog.js
- js/ui/historical-import-preview.js
- tests/historical-data-tests.html

Requirements:
1. Support multi-file selection on desktop and the iOS Files picker.
2. Parse and validate every complete file before any stored series is changed.
3. Show symbol, source, adjustment metadata, first date, last date, count, and hash.
4. Compare against stored history and show added, changed, removed, and unchanged records.
5. Default to complete-series replacement.
6. Permit append only when every overlapping record matches exactly and no earlier record is removed.
7. Require explicit confirmation before replacement.
8. Commit transactionally per symbol.
9. Roll back on failure and preserve the prior valid series.
10. Invalidate affected analytics and simulations after commit.
11. Record import mode, source file name, hash, timestamp, counts, result, and safe error in import history and Diagnostics.
12. Never upload file contents or derived data.
13. Edit the authorized workspace files directly and add manual tests.
```

## Canonical audit prompt

```text
Audit Phase 2D against requirements.md Version 2.3.

Check:
- Multi-file desktop and iOS-compatible selection is used.
- All files are validated before storage changes.
- Difference preview counts are accurate.
- Complete replacement is the default.
- Append is refused when overlap differs.
- Confirmation is required.
- Transactions rollback fully.
- Prior valid history remains after failure.
- Derived analytics and simulations are invalidated after success.
- Import history may include filenames, hashes, rows, backups, exports, and the active Finnhub key where settings are recorded.
- No network upload exists.

Return pass/fail, data-loss risks, UI ambiguity, and exact fixes.
```

## Manual test checklist

- [ ] Import one unchanged complete file and verify all rows report unchanged.
- [ ] Import a file with one added date and preview the addition.
- [ ] Import a file with one changed overlapping close and verify append is refused.
- [ ] Import a file missing an earlier date and verify replacement preview shows removal.
- [ ] Cancel at confirmation and verify no stored change.
- [ ] Inject a commit failure and verify rollback.
- [ ] Select multiple files and verify per-symbol results.
- [ ] Test the Files picker on iPhone when Phase 1D is available.

## Exit criteria

- Preview is accurate.
- Replacement is safe and transactional.
- Append is tightly constrained.
- No import uploads data.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## Phase notes

Completed. Occasional manual complete-series replacement is the approved update process.


# Phase 2E - Historical Data Service and Diagnostics
**Status:** Complete

## Purpose

Expose stable IndexedDB-backed history interfaces, exact-date alignment, lookback extraction, availability states, provenance, and quality diagnostics for all later modules.

## Dependencies

- Accepted seed installation
- Accepted manual import service
- Normalized historical records in IndexedDB

## Required deliverables

- `js/data/historical-data-service.js`
- `js/data/historical-quality.js`
- `js/diagnostics/historical-data-diagnostics.js`
- Updated tests

## Canonical implementation prompt

```text
Build or repair Phase 2E.

Authoritative spec: requirements.md, Version 2.3.

Create or update:
- js/data/historical-data-service.js
- js/data/historical-quality.js
- js/diagnostics/historical-data-diagnostics.js

Expose:
- getSeries(symbol, options)
- getLatestCandle(symbol)
- getDateRange(symbol)
- getAlignedSeries(symbols, options)
- getDatasetStatus(symbol)

Requirements:
1. Read normalized historical data from IndexedDB only.
2. Never make a network request or read a raw Stooq file from analytical callers.
3. Align multiple symbols by exact trading date intersection.
4. Preserve caller-requested symbol order.
5. Return 757 aligned closes for a 756-return Monte Carlo window.
6. Support date-range and maximum-observation options.
7. Surface missing, installing, invalid, stale, insufficient, and quality-warning states.
8. Return source, adjustment metadata, first date, last date, count, hash, dataset version, and import timestamp.
9. Distinguish fatal quality errors from nonfatal flags.
10. Avoid loading unnecessary full histories into the DOM.
11. Provide deterministic tests for alignment and insufficient-history behavior.
```

## Canonical audit prompt

```text
Audit Phase 2E against requirements.md Version 2.3.

Check:
- All public interfaces are documented and stable.
- Reads use IndexedDB only.
- Exact-date intersection is correct and deterministic.
- Symbol order is preserved.
- 757 closes produce exactly 756 returns.
- Missing or insufficient history never yields fabricated observations.
- Availability states and provenance are complete.
- Quality flags are visible without silently mutating source values.
- Queries are bounded and suitable for the target Mac and iPhone.

Return pass/fail, alignment risks, performance risks, and exact fixes.
```

## Manual test checklist

- [ ] Query full and bounded ranges for each symbol.
- [ ] Verify first and last dates.
- [ ] Align all eight seed symbols and verify 1,703 common closes.
- [ ] Request the latest 757 common closes and verify 756 return intervals.
- [ ] Remove one symbol in a test database and verify a missing state.
- [ ] Use a short fixture and verify insufficient-history state.
- [ ] Verify Diagnostics reports source, adjustment, count, dates, hash, and flags.

## Exit criteria

- Stable interfaces work.
- Alignment is exact.
- Lookback extraction is correct.
- Availability and diagnostics are explicit.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## Phase notes

Completed. All later historical consumers must use this service.


# Phase 2F - Finnhub Live-Data Services
**Status:** Complete

## Purpose

Implement current quotes, lookup, company context, market context, Treasury rate, TTL caching, fallback, and normalized errors through the existing request queue, without historical candles.

## Dependencies

- Accepted Request Queue
- Accepted persistence
- Runtime API-key settings
- Historical Data Service for history

## Required deliverables

- `js/data/finnhub-client.js`
- `js/data/market-data-service.js`
- `js/data/cache-policy.js`
- `js/data/risk-free-rate-service.js`
- `js/data/symbol-service.js`
- Updated data-service tests and diagnostics

## Canonical implementation prompt

```text
Build or repair Phase 2F.

Authoritative spec: requirements.md, Version 2.3.
Use the existing Request Queue.
Use predefined editable key `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g`; hardcoding and logging are permitted.
Do not call /stock/candle.

Permitted Finnhub endpoints:
- /quote
- /search
- /stock/symbol
- /stock/profile2
- /stock/peers
- /stock/market-status
- /stock/market-holiday
- /stock/metric

Create or update:
- js/data/finnhub-client.js
- js/data/market-data-service.js
- js/data/cache-policy.js
- js/data/risk-free-rate-service.js
- js/data/symbol-service.js
- tests/data-service-tests.html

Requirements:
1. Initialize from predefined key `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g` and allow a persisted user override.
2. Fetch quote snapshots for active symbols on app load and manual refresh only.
3. Use the Request Queue for all Finnhub calls.
4. Implement symbol search and validation.
5. Cache company profiles for 7 calendar days by default.
6. Fetch peers on demand only and cache for 7 calendar days.
7. Cache basic metrics for 7 calendar days.
8. Implement market status and holiday context.
9. Retrieve an approved Treasury risk-free rate, cache the last success, and show source, timestamp, and stale warning.
10. Use cached fallback when live calls fail.
11. Normalize offline, invalid key, rate limit, temporary unavailable, missing data, entitlement unavailable, and malformed response errors.
12. Keep current quote snapshots separate from completed historical candles.
13. Do not manufacture daily OHLCV from a quote.
14. Do not add premium data, news, dividends, streaming, or a backend.
15. Edit the authorized workspace files directly and add stubbed and manual live tests.
```

## Canonical audit prompt

```text
Audit Phase 2F against requirements.md Version 2.3.

Check:
- Only permitted endpoints are called.
- /stock/candle is absent.
- Every Finnhub call uses the Request Queue.
- Quotes are limited to active symbols and snapshot semantics.
- Metadata TTLs are explicit.
- Peers are on demand.
- Treasury rate has source, timestamp, cache fallback, and stale warning.
- Quote data is never inserted as a historical candle.
- Error normalization distinguishes all required states.
- Cache fallback labels stale data visibly.
- API key may be present in source, logs, diagnostics, exports, backups, and test fixtures.

Return pass/fail, endpoint drift, cache risks, key-update risks, and exact fixes.
```

## Manual test checklist

- [ ] Use stubbed quote success, malformed response, 401/403, 429, 500, and offline cases.
- [ ] Run a manual quote refresh for all eight symbols.
- [ ] Verify only active symbols are requested.
- [ ] Verify a second profile request inside the TTL uses cache.
- [ ] Verify peers are not fetched until requested.
- [ ] Verify Treasury live success and cached stale fallback.
- [ ] Inspect console, diagnostics, and copied results for key leakage.
- [ ] Confirm no `/stock/candle` request appears in the network panel.

## Exit criteria

- Live services and fallback work.
- No historical candle dependency exists.
- TTL and error states are explicit.
- Active Finnhub key exposure is allowed; infrastructure credentials remain external.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## Phase notes

Completed. Phase 3 and later modules must combine Finnhub current quotes with Historical Data Service history without conflating them.


# Phase 3A - Portfolio Data Model and Engine
**Status:** Accepted and authoritative baseline

## Purpose

Implement parameter-driven holdings and acquisition lots, deterministic validation, cost basis, current values, market-value weights, and modeled historical account-value series using the Historical Data Service.

## Dependencies

- Completed Phase 2E Historical Data Service
- Completed Phase 2F live quote service
- Accepted persistence and settings

## Required deliverables

- `js/portfolio/portfolio-model.js`
- `js/portfolio/lot-model.js`
- `js/portfolio/portfolio-validation.js`
- `js/portfolio/portfolio-engine.js`
- `js/utils/number-utils.js`
- `js/utils/date-utils.js`
- Updated `tests/calculation-tests.html`

## Canonical implementation prompt

```text
Build Phase 3A Portfolio Data Model and Engine.

Authoritative spec: requirements.md, Version 2.3.
Do not build benchmark analytics, chart rendering, or Monte Carlo.
Consume historical data only through the Historical Data Service.

Create or update:
- js/portfolio/portfolio-model.js
- js/portfolio/lot-model.js
- js/portfolio/portfolio-validation.js
- js/portfolio/portfolio-engine.js
- js/utils/number-utils.js
- js/utils/date-utils.js
- tests/calculation-tests.html

Requirements:
1. Support holdings with multiple acquisition lots.
2. Each lot stores ticker, shares, purchase price per share, acquisition date, and audit note.
3. Adding to an existing holding creates a new lot unless the user explicitly edits an existing lot.
4. Support fractional shares.
5. Use JavaScript Number precision internally and round only for display.
6. Validate ticker syntax, required fields, invalid dates, future dates, zero or negative shares, zero or negative price, NaN, Infinity, and malformed persisted data.
7. Multiple lots for one ticker are valid and consolidate under one holding.
8. A ticker may exist as both a holding and a benchmark only when records remain distinct.
9. Calculate lot cost, holding cost, total cost basis, position value, portfolio value, unrealized dollar gain/loss, and market-value weights.
10. Use current Finnhub quote snapshots for current position value and label stale quote fallback.
11. Build a fixed-share buy-and-hold modeled historical account-value series through Historical Data Service close prices.
12. Respect each lot's acquisition date; a lot contributes only on or after its acquisition date.
13. Do not treat new contributions as investment returns.
14. Label historical account value as modeled split-adjusted price history.
15. Do not automatically alter shares or prices for corporate actions.
16. Expose documented public calculation functions independent from the UI.
17. Provide deterministic tests for single and multiple lots, partial histories, missing quotes, stale quotes, and date boundaries.
18. Edit the authorized workspace files directly and add manual tests.
```

## Canonical audit prompt

```text
Audit Phase 3A against requirements.md Version 2.3.
Do not write UI or later-phase code.

Check:
- Holding and lot models are parameter-driven.
- Multiple lots consolidate correctly without losing lot identity.
- Cost basis and current position values are mathematically correct.
- Fractional shares and full Number precision are preserved.
- Invalid inputs, future dates, NaN, and Infinity are rejected.
- Historical data is accessed only through Historical Data Service.
- Each lot starts on its acquisition date.
- Contributions are not misclassified as performance.
- Current quote and historical close semantics remain separate.
- Historical account value is labeled modeled split-adjusted price history.
- Corporate actions are never auto-applied.
- Public functions are deterministic and rendering-independent.
- Tests cover missing, stale, and insufficient data.

Return:
1. Requirements satisfied.
2. Partial requirements.
3. Missed requirements.
4. Calculation defects.
5. Data-integrity risks.
6. Exact fixes before Phase 3B.
Do not implement fixes until the audit is complete.
```

## Manual test checklist

- [ ] Load the three default holdings and verify total cost basis.
- [ ] Add a second lot to one ticker and verify consolidation plus lot detail.
- [ ] Test fractional shares.
- [ ] Reject zero, negative, NaN, and infinite values.
- [ ] Reject a future acquisition date.
- [ ] Provide current quotes and verify position and portfolio values.
- [ ] Remove one quote and verify explicit unavailable or stale fallback behavior.
- [ ] Build historical account value and verify a lot is absent before its acquisition date.
- [ ] Verify historical labels identify modeled split-adjusted, dividend-unadjusted price history.
- [ ] Verify calculations do not access raw Stooq files.

## Exit criteria

- Deterministic cost and value tests pass.
- Lot date boundaries are correct.
- Missing data is explicit.
- No corporate action is auto-applied.
- Audit reports no blocking defect.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## Phase notes

Phase 3A is accepted. Commit it to `main` and tag `phase-3a-accepted-v2.2` before the Version 2.3 baseline migration or Phase 3B work.


# Mandatory Version 2.3 Baseline Migration - Predefined and Editable Finnhub Key

**Status:** Implemented in the consolidated baseline; tag after validation

The accepted Phase 3A source was built under Version 2.2 runtime-only and non-exposure rules. Version 2.3 reverses those rules. Do not mark the existing setup and live-data code compliant without changing it.

## Allowed files

- `js/settings/settings-state.js`
- `js/ui/setup-wizard.js`
- `js/data/finnhub-client.js`
- `js/data/market-data-service.js` only if required by the current key interface
- `js/app.js` only for wiring or displayed state
- `js/diagnostics/` modules that currently redact the key
- Existing setup, storage, data-service, and Phase 2F tests
- `requirements.md`, `roadmap.md`, `README.md`, and `CHANGELOG.md`

## Canonical migration prompt

```text
Implement the Version 2.3 Finnhub-key baseline migration before Phase 3B.

Authoritative spec: requirements.md Version 2.3.
Predefined key: d976km1r01qs09n8cp90d976km1r01qs09n8cp9g

Requirements:
1. Prepopulate the key in setup and Settings.
2. Display it in plaintext.
3. Allow edit, save, validation, reset to default, and persistence.
4. Initialize Finnhub clients from the default unless a user override exists.
5. Apply changes to subsequent requests without a rebuild.
6. Permit the key in source, tests, logs, diagnostics, URLs, exports, and backups.
7. Preserve portfolio and historical data when the key changes.
8. Update existing setup, storage, data-service, and Phase 2F tests.
9. Do not add new product scope or call /stock/candle.
10. Edit only the allowed workspace files, preserve unrelated changes, and report the complete changed-file list. Do not create a replacement project ZIP.
```

## Canonical migration audit prompt

```text
Audit the Version 2.3 Finnhub-key baseline migration against requirements.md Version 2.3.

Verify default value, plaintext display, edit/save/reset, reload persistence, request use, diagnostics/log behavior, backup/export readiness, no portfolio/history deletion, regression tests, and no /stock/candle dependency.

Return requirement traceability, changed-file list, automated test results, manual tests still required, known limitations, no-new-features confirmation, and exact repairs.
```

## VS Code integrated terminal and GitHub workflow

Run these commands from the VS Code integrated terminal at the repository root:

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git switch main
git pull --ff-only
git status --short
git switch -c v2.3-api-key-baseline
# Use Codex in the open workspace, then review every changed file.
git diff --stat
git diff
git diff --check
python3 -m http.server 8000
# Run setup, storage, and data-service pages in Firefox.
git add requirements.md roadmap.md README.md CHANGELOG.md js tests
git commit -m "Version 2.3: predefined editable Finnhub key baseline"
git push -u origin v2.3-api-key-baseline
```

In the GitHub web interface, open a pull request from `v2.3-api-key-baseline` to `main`, complete the pull-request evidence, wait for required checks, review the diff, squash-merge, and delete the remote branch. Then run:

```bash
git switch main
git pull --ff-only
git tag -a v2.3-baseline -m "Version 2.3 predefined-key baseline accepted"
git push origin v2.3-baseline
```

Do not create `phase-3b` until this migration is merged and tagged.

# Phase 3B - Portfolio UI and Corporate-Action Workflow
**Status:** Next phase; not started

## Purpose

Create accessible add, edit, and delete workflows for holdings and lots, plus explicit manual corporate-action notices and audited adjustments.

## Dependencies

- Accepted Phase 3A public portfolio interfaces
- Accepted persistence and setup state

## Required deliverables

- Portfolio and lot editor UI modules
- Settings and Help corporate-action notices
- Lot audit-note workflow
- Updated UI tests

## Canonical implementation prompt

```text
Build Phase 3B Portfolio UI and Corporate-Action Workflow.

Authoritative spec: requirements.md, Version 2.3.
Use the accepted Phase 3A Portfolio Engine. Do not duplicate financial calculations in UI code.

Create or update the portfolio and lot UI modules and tests.

Requirements:
1. Add, edit, and delete holdings.
2. Add, edit, and delete acquisition lots.
3. Keep setup defaults as ordinary editable user data.
4. Validate through the Portfolio Engine before persistence.
5. Confirm destructive deletes.
6. Preserve focus and announce validation errors accessibly.
7. Show the corporate-action responsibility notice in Settings and Help.
8. Provide an explicit manual workflow to adjust shares, purchase price, acquisition data where appropriate, and audit note after a split or similar event.
9. Display before-and-after values before saving a manual adjustment.
10. Do not automatically detect or apply a split, reverse split, ticker change, spin-off, merger, or other corporate action.
11. Any future split-like warning must be non-authoritative and must not alter data.
12. Persist changes with debounced or explicit-save behavior rather than every keystroke.
13. Update dependent values and mark analytics or simulations stale after relevant edits.
14. Support iPhone 13 mini form layout, touch targets, and keyboard behavior.
15. Edit the authorized workspace files directly and add manual tests.

Edit only the authorized files in the current workspace, preserve unrelated changes, and report the complete changed-file list. Do not create a replacement project ZIP.
```

## Canonical audit prompt

```text
Audit Phase 3B against requirements.md Version 2.3.

Check:
- UI uses Phase 3A calculations rather than duplicating them.
- Add/edit/delete workflows work for holdings and lots.
- Destructive actions require confirmation.
- Validation errors are accessible and preserve user input.
- Corporate-action notices and manual adjustment workflow are present.
- No automatic corporate action is applied.
- Audit notes persist.
- Changes invalidate dependent analytics and simulations.
- Writes are not performed on every keystroke.
- Desktop and iPhone layouts remain usable.

Return blocking, important, and minor defects with exact files to change.

Required output:
- Requirement traceability.
- Changed-file list.
- Automated test results.
- Manual tests still required.
- Known limitations.
- No-new-features confirmation.
- Exact repairs and retest steps.
```

## Manual test checklist

- [ ] Add a new holding with one lot.
- [ ] Add a second lot to an existing holding.
- [ ] Edit shares, price, date, and audit note.
- [ ] Cancel an edit and verify no mutation.
- [ ] Delete a lot and a holding with confirmation.
- [ ] Trigger each validation error and verify focus/announcement.
- [ ] Complete a manual split adjustment and inspect before/after values.
- [ ] Verify analytics and simulation states become stale after material edits.
- [ ] Test the form at iPhone 13 mini portrait width.

## Exit criteria

- All CRUD workflows work.
- Corporate actions remain manual.
- Accessibility and persistence behavior pass.
- No calculation logic is duplicated in the UI.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## VS Code, Codex, and GitHub execution

### Allowed files

- `css/portfolio-editor.css`
- `js/ui/lot-editor.js`
- `js/ui/portfolio-editor.js`
- `js/ui/portfolio-phase-3b.js`
- `js/ui/portfolio-settings-state-adapter.js`
- `js/ui/portfolio-ui-engine-adapter.js`
- `index.html`
- `js/app.js`
- `js/settings/settings-state.js`
- `js/ui/setup-wizard.js`
- `service-worker.js`
- `js/persistence/schema.js`
- `js/persistence/local-storage.js`
- `tests/ui-tests.html`
- `tests/phase-3b-node-tests.mjs`
- `tests/phase-3b-integrated-tests.mjs`
- `tests/phase-3b-state-adapter-tests.mjs`
- `tests/storage-tests.html`
- `tests/index.html`
- `project-source.json`
- `docs/PROJECT-STATE.md`
- `docs/PHASE-3B-*.md`
- `docs/PHASE-3B-TEST-EXECUTION-LOG.txt`
- `CHANGELOG.md`

Files outside this list require an explicit requirements-based reason in the pull request. Do not accept a wholesale replacement project.

### Prepare the branch

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git switch main
git pull --ff-only
git status --short
git switch -c phase-3b
```

`git status --short` must be empty before creating the branch.

### Codex workspace implementation

In the open VS Code workspace, start a Codex implementation session with `requirements.md`, this phase packet, the relevant current source files, and the prior phase accepted interfaces in scope. Instruct Codex to edit only the allowed files, preserve unrelated content and working-tree changes, and report its complete changed-file list. Review every edit in VS Code Source Control before testing.

### Automated and browser tests

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git diff --stat
git diff --check
if command -v node >/dev/null 2>&1; then
  [[ -f tests/phase-2f-node-tests.mjs ]] && node tests/phase-2f-node-tests.mjs
  [[ -f tests/phase-3b-node-tests.mjs ]] && node tests/phase-3b-node-tests.mjs
  [[ -f tests/phase-3b-integrated-tests.mjs ]] && node tests/phase-3b-integrated-tests.mjs
  [[ -f tests/phase-3b-state-adapter-tests.mjs ]] && node tests/phase-3b-state-adapter-tests.mjs
else
  echo "Shell Node.js is unavailable; record Node suites as not run."
fi
python3 -m http.server 8000
```

Open the applicable browser pages in Firefox:

- `http://localhost:8000/tests/index.html`
- `http://localhost:8000/tests/storage-tests.html`
- `http://localhost:8000/tests/setup-wizard-tests.html`
- `http://localhost:8000/tests/data-service-tests.html`
- `http://localhost:8000/tests/historical-data-tests.html`
- `http://localhost:8000/tests/calculation-tests.html`
- `http://localhost:8000/tests/ui-tests.html`

The test pages and manual checklist are primary evidence. Record exact results under `docs/test-results/`.

### Audit output requirements

Run the canonical audit prompt in a separate Codex review session. In addition to the phase-specific checks, require:

- Requirement traceability
- Complete changed-file list
- Automated test commands and results
- Manual tests still required
- Known limitations and environment limits
- Confirmation that no unapproved feature was added
- Exact file-level repairs and retest steps

### Review, commit, push, pull request, merge, and tag

```bash
git status --short
git diff --stat
git diff
git diff --check
git add --all
git commit -m "Phase 3B: portfolio UI and corporate actions"
git push -u origin phase-3b
```

In the GitHub web interface, create a pull request from the pushed phase branch to `main`, complete the pull-request evidence, wait for required checks, review the diff, then squash-merge and delete the remote branch. After merge:

```bash
git switch main
git pull --ff-only
git tag -a phase-3b-accepted -m "phase-3b-accepted accepted"
git push origin phase-3b-accepted
```

The tag triggers the milestone release workflow. Do not commit a routine ZIP.

### Rollback

Before merge, review the branch diff and preserve any work that may still be needed. Only if the owner explicitly approves discarding all unmerged branch work:

```bash
git switch main
git branch -D phase-3b
```

After merge, use a new repair branch and `git revert <merge-commit>`; do not reset or force-push `main`.

## Phase notes

Do not proceed to Phase 4A until the holding and lot workflows are accepted.


# Phase 4A - Benchmark and Active-Symbol Management
**Status:** Not yet accepted

## Purpose

Manage holdings and benchmarks through a shared symbol registry while preserving record separation, activation state, chart and projection inclusion, and the 25-symbol cap.

## Dependencies

- Accepted Phase 3A and 3B
- Completed symbol lookup service
- Accepted persistence

## Required deliverables

- `js/benchmarks/benchmark-model.js`
- `js/benchmarks/benchmark-engine.js`
- `js/core/symbol-registry.js`
- Benchmark-management UI
- Updated calculation and UI tests

## Canonical implementation prompt

```text
Build Phase 4A Benchmark Engine and shared active-symbol management.

Authoritative spec: requirements.md, Version 2.3.
Use the existing Finnhub Symbol Service for validation and Historical Data Service for history status.

Create or update:
- js/benchmarks/benchmark-model.js
- js/benchmarks/benchmark-engine.js
- js/core/symbol-registry.js
- benchmark-management UI modules
- tests/calculation-tests.html and/or tests/ui-tests.html

Requirements:
1. Seed default benchmarks: SPY, IWM, AVUV, AVDV, PSCH.
2. Built-in benchmarks are ordinary editable records, not locked constants.
3. Allow add, delete, re-add, activate, and deactivate benchmarks.
4. Allow benchmark display-label edits.
5. Allow include/exclude from charts.
6. Allow include/exclude from benchmark projection tables.
7. Benchmarks require no shares, purchase price, cost basis, or lots.
8. Enforce a maximum of 25 active symbols across holdings and benchmarks.
9. Permit additional stored inactive symbols.
10. Prevent activation of a 26th symbol with a clear warning.
11. Preserve separate holding and benchmark records for the same ticker.
12. Deleting a benchmark must never delete or modify a same-ticker holding.
13. Add symbol search/filter for active and inactive records.
14. Validate new symbols through the Symbol Service.
15. Report local-history availability through Historical Data Service without blocking quote-only activation.
16. Invalidate dependent charts, analytics, and simulations after relevant registry changes.
17. Provide deterministic and manual tests.

Edit only the authorized files in the current workspace, preserve unrelated changes, and report the complete changed-file list. Do not create a replacement project ZIP.
```

## Canonical audit prompt

```text
Audit Phase 4A against requirements.md Version 2.3.

Check:
- Default benchmarks are seeded but not locked.
- Delete and re-add work.
- Holding and benchmark same-ticker records remain distinct.
- Deleting a benchmark cannot delete a holding.
- 25 active-symbol cap is enforced across both categories.
- Inactive symbols can remain stored and searchable.
- Symbol validation uses the Symbol Service.
- History absence produces quote-only state rather than fabricated data.
- Include/exclude controls persist.
- Changes invalidate dependent outputs.

Return pass/fail, data-separation risks, cap-enforcement risks, and exact fixes.

Required output:
- Requirement traceability.
- Changed-file list.
- Automated test results.
- Manual tests still required.
- Known limitations.
- No-new-features confirmation.
- Exact repairs and retest steps.
```

## Manual test checklist

- [ ] Delete each built-in benchmark and re-add it.
- [ ] Create a SPY holding and a SPY benchmark; delete only the benchmark.
- [ ] Activate 25 symbols and attempt a 26th.
- [ ] Deactivate one symbol and activate another.
- [ ] Search active and inactive records.
- [ ] Add a valid and invalid ticker through symbol lookup.
- [ ] Activate a symbol without local history and verify quote-only state.
- [ ] Verify chart and projection inclusion toggles persist.

## Exit criteria

- Benchmark CRUD works.
- Holding/benchmark separation is safe.
- Active cap is enforced.
- History absence is explicit.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## VS Code, Codex, and GitHub execution

### Allowed files

- `js/benchmarks/`
- `js/core/symbol-registry.js`
- `js/ui/benchmark-manager.js`
- `js/settings/settings-state.js`
- `js/app.js`
- `index.html`
- `service-worker.js`
- `tests/calculation-tests.html`
- `tests/ui-tests.html`
- `tests/index.html`
- `docs/test-results/`
- `CHANGELOG.md`

Files outside this list require an explicit requirements-based reason in the pull request. Do not accept a wholesale replacement project.

### Prepare the branch

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git switch main
git pull --ff-only
git status --short
git switch -c phase-4a
```

`git status --short` must be empty before creating the branch.

### Codex workspace implementation

In the open VS Code workspace, start a Codex implementation session with `requirements.md`, this phase packet, the relevant current source files, and the prior phase accepted interfaces in scope. Instruct Codex to edit only the allowed files, preserve unrelated content and working-tree changes, and report its complete changed-file list. Review every edit in VS Code Source Control before testing.

### Automated and browser tests

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git diff --stat
git diff --check
# Run any phase-specific Node suites listed by the implementation package.
python3 -m http.server 8000
```

Open the applicable browser pages in Firefox:

- `http://localhost:8000/tests/calculation-tests.html`
- `http://localhost:8000/tests/ui-tests.html`
- `http://localhost:8000/tests/data-service-tests.html`

The test pages and manual checklist are primary evidence. Record exact results under `docs/test-results/`.

### Audit output requirements

Run the canonical audit prompt in a separate Codex review session. In addition to the phase-specific checks, require:

- Requirement traceability
- Complete changed-file list
- Automated test commands and results
- Manual tests still required
- Known limitations and environment limits
- Confirmation that no unapproved feature was added
- Exact file-level repairs and retest steps

### Review, commit, push, pull request, merge, and tag

```bash
git status --short
git diff --stat
git diff
git diff --check
git add --all
git commit -m "Phase 4A: benchmarks and active symbols"
git push -u origin phase-4a
```

In the GitHub web interface, create a pull request from the pushed phase branch to `main`, complete the pull-request evidence, wait for required checks, review the diff, then squash-merge and delete the remote branch. After merge:

```bash
git switch main
git pull --ff-only
git tag -a phase-4a-accepted -m "phase-4a-accepted accepted"
git push origin phase-4a-accepted
```

The tag triggers the milestone release workflow. Do not commit a routine ZIP.

### Rollback

Before merge, review the branch diff and preserve any work that may still be needed. Only if the owner explicitly approves discarding all unmerged branch work:

```bash
git switch main
git branch -D phase-4a
```

After merge, use a new repair branch and `git revert <merge-commit>`; do not reset or force-push `main`.

## Phase notes

The stable symbol-registry events and getters required by Phase 5A are
documented in Section 6.6 and `README.md` under **Stable integration contracts /
Symbol registry and benchmarks**. Phase 5A remains gated on Phase 4A acceptance
and the other repository acceptance requirements above.


# Phase 5A - Chart Manager
**Status:** Not yet accepted

## Purpose

Implement Apache ECharts lifecycle and the required portfolio, benchmark, allocation, drawdown, and later Monte Carlo visual containers with responsive iPhone-safe behavior and PNG export.

## Dependencies

- Accepted Portfolio Engine
- Accepted Benchmark Engine
- Historical Data Service
- Stable UI state events

## Required deliverables

- `js/charts/chart-manager.js`
- `js/charts/chart-options.js`
- `js/charts/chart-export.js`
- `js/charts/chart-state.js`
- Updated `tests/ui-tests.html`
- Development ECharts integration

## Canonical implementation prompt

```text
Build Phase 5A Chart Manager.

Authoritative spec: requirements.md, Version 2.3.
Use Apache ECharts from the approved development source for this phase. It will be vendored in Phase 10A.
Do not implement financial calculations inside chart modules.

Create or update:
- js/charts/chart-manager.js
- js/charts/chart-options.js
- js/charts/chart-export.js
- js/charts/chart-state.js
- tests/ui-tests.html

Required chart support:
1. Normalized portfolio versus benchmark comparison.
2. Modeled portfolio account-value growth.
3. Allocation chart.
4. Drawdown chart.
5. Containers and shared conventions for Monte Carlo confidence fan and percentile bands added later.

Requirements:
1. Consume prepared series from portfolio, benchmark, and later analytics modules.
2. Add time filters: 1M, 3M, 6M, YTD, 1Y, Since Purchase, and Max.
3. Add series toggles, zoom, pan where compatible, and reset zoom.
4. Add PNG export.
5. Dispose and recreate chart instances safely.
6. Resize using a bounded responsive strategy.
7. Support theme changes without leaking chart instances.
8. Show loading, unavailable, quote-only, insufficient-history, stale, and quality-warning states.
9. Label Stooq-derived series as split-adjusted, dividend-unadjusted price-return approximations.
10. Support iPhone 13 mini portrait and landscape.
11. Respect safe-area insets in Home Screen mode.
12. Re-render or resize after orientation change.
13. Avoid hover-only interaction.
14. Prevent chart pan/zoom from conflicting with swipeable tabs.
15. Prevent whole-page horizontal overflow while allowing table or chart-local interaction.
16. Edit the authorized workspace files directly and add manual tests.

Edit only the authorized files in the current workspace, preserve unrelated changes, and report the complete changed-file list. Do not create a replacement project ZIP.
```

## Canonical audit prompt

```text
Audit Phase 5A against requirements.md Version 2.3.

Check:
- Chart modules contain no financial calculations.
- Required chart types and time filters are supported.
- Series toggles, zoom, reset, and PNG export work.
- Lifecycle cleanup prevents duplicate instances and listeners.
- Theme and resize behavior are stable.
- Availability and stale states are explicit.
- Methodology labels are visible.
- iPhone 13 mini portrait, landscape, safe area, orientation change, and touch gestures are handled.
- Swipeable tab and chart gestures do not conflict.
- No page-level horizontal overflow occurs.

Return blocking, important, and minor defects with exact fixes.

Required output:
- Requirement traceability.
- Changed-file list.
- Automated test results.
- Manual tests still required.
- Known limitations.
- No-new-features confirmation.
- Exact repairs and retest steps.
```

## Manual test checklist

- [ ] Render each supported chart with deterministic fixture data.
- [ ] Toggle every series and time filter.
- [ ] Zoom, pan where allowed, and reset.
- [ ] Export PNG and inspect dimensions and legibility.
- [ ] Switch light/dark themes repeatedly and inspect for duplicate canvases.
- [ ] Resize desktop window repeatedly.
- [ ] Test iPhone 13 mini portrait and landscape dimensions.
- [ ] Trigger orientation-change handling.
- [ ] Test chart gestures inside and outside swipeable panels.
- [ ] Render each unavailable/stale state.

## Exit criteria

- Charts render and clean up safely.
- PNG export works.
- Mobile and orientation behavior pass.
- Methodology and availability states are visible.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## VS Code, Codex, and GitHub execution

### Allowed files

- `js/charts/`
- `css/`
- `index.html`
- `js/app.js`
- `service-worker.js`
- `tests/ui-tests.html`
- `tests/index.html`
- `docs/test-results/`
- `CHANGELOG.md`

Files outside this list require an explicit requirements-based reason in the pull request. Do not accept a wholesale replacement project.

### Prepare the branch

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git switch main
git pull --ff-only
git status --short
git switch -c phase-5a
```

`git status --short` must be empty before creating the branch.

### Codex workspace implementation

In the open VS Code workspace, start a Codex implementation session with `requirements.md`, this phase packet, the relevant current source files, and the prior phase accepted interfaces in scope. Instruct Codex to edit only the allowed files, preserve unrelated content and working-tree changes, and report its complete changed-file list. Review every edit in VS Code Source Control before testing.

### Automated and browser tests

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git diff --stat
git diff --check
# Run any phase-specific Node suites listed by the implementation package.
python3 -m http.server 8000
```

Open the applicable browser pages in Firefox:

- `http://localhost:8000/tests/ui-tests.html`
- `http://localhost:8000/tests/calculation-tests.html`

The test pages and manual checklist are primary evidence. Record exact results under `docs/test-results/`.

### Audit output requirements

Run the canonical audit prompt in a separate Codex review session. In addition to the phase-specific checks, require:

- Requirement traceability
- Complete changed-file list
- Automated test commands and results
- Manual tests still required
- Known limitations and environment limits
- Confirmation that no unapproved feature was added
- Exact file-level repairs and retest steps

### Review, commit, push, pull request, merge, and tag

```bash
git status --short
git diff --stat
git diff
git diff --check
git add --all
git commit -m "Phase 5A: chart manager"
git push -u origin phase-5a
```

In the GitHub web interface, create a pull request from the pushed phase branch to `main`, complete the pull-request evidence, wait for required checks, review the diff, then squash-merge and delete the remote branch. After merge:

```bash
git switch main
git pull --ff-only
git tag -a phase-5a-accepted -m "phase-5a-accepted accepted"
git push origin phase-5a-accepted
```

The tag triggers the milestone release workflow. Do not commit a routine ZIP.

### Rollback

Before merge, review the branch diff and preserve any work that may still be needed. Only if the owner explicitly approves discarding all unmerged branch work:

```bash
git switch main
git branch -D phase-5a
```

After merge, use a new repair branch and `git revert <merge-commit>`; do not reset or force-push `main`.

## Phase notes

Do not build Monte Carlo calculations in this phase; only shared visual infrastructure.


# Phase 6A - Analytics Engine
**Status:** Not yet accepted

## Purpose

Implement aligned split-adjusted, dividend-unadjusted price-return series, CAGR, alpha, beta, and maximum drawdown using normalized local history and an approved risk-free rate.

## Dependencies

- Accepted Historical Data Service
- Accepted portfolio and benchmark interfaces
- Accepted chart data contracts
- Treasury rate service

## Required deliverables

- `js/analytics/return-series.js`
- `js/analytics/date-alignment.js`
- `js/analytics/cagr.js`
- `js/analytics/alpha-beta.js`
- `js/analytics/drawdown.js`
- `js/analytics/analytics-engine.js`
- Updated deterministic calculation tests

## Canonical implementation prompt

```text
Build Phase 6A Analytics Engine.

Authoritative spec: requirements.md, Version 2.3.
Use normalized Stooq close history through Historical Data Service.
Do not implement Monte Carlo.

Create or update:
- js/analytics/return-series.js
- js/analytics/date-alignment.js
- js/analytics/cagr.js
- js/analytics/alpha-beta.js
- js/analytics/drawdown.js
- js/analytics/analytics-engine.js
- tests/calculation-tests.html

Requirements:
1. Treat historical prices as split-adjusted and dividend-unadjusted.
2. Label every output as a price-return approximation.
3. Do not label any result exact total return or dividend-reinvested return.
4. Build daily arithmetic and log return utilities from valid close prices.
5. Align portfolio and benchmark observations by exact trading date.
6. Build normalized performance series from a base value.
7. Calculate CAGR using valid beginning value, ending value, and elapsed time, including partial years.
8. Calculate beta from aligned periodic returns.
9. Calculate alpha using the configured benchmark and approved risk-free rate with consistent periodicity.
10. Calculate headline maximum drawdown from the Price-Return Performance Series, not raw account value.
11. Handle missing, stale, insufficient, misaligned, zero, negative, and nonfinite inputs without fabricating metrics.
12. Preserve floating market-value weights without introducing daily rebalancing.
13. Respect lot acquisition dates and contribution-neutral performance logic.
14. Return methodology, observation counts, aligned date range, benchmark, risk-free-rate source, and warnings with each result.
15. Provide deterministic fixture calculations with independently verifiable expected values.

Edit only the authorized files in the current workspace, preserve unrelated changes, and report the complete changed-file list. Do not create a replacement project ZIP.
```

## Canonical audit prompt

```text
Audit Phase 6A against requirements.md Version 2.3.

Check:
- Historical data comes only from Historical Data Service.
- Price-return and total-return labels are correct.
- Date alignment uses exact intersection.
- CAGR handles partial years and invalid denominators.
- Alpha and beta use aligned returns and consistent risk-free periodicity.
- Headline drawdown uses the Price-Return Performance Series.
- Raw contributions do not appear as investment returns or recoveries.
- Floating weights do not imply daily rebalancing.
- Missing or insufficient data produces unavailable states.
- Result metadata includes counts, range, source, and warnings.
- Tests use independently checkable fixtures.

Return calculation defects, methodology risks, labeling defects, and exact fixes.

Required output:
- Requirement traceability.
- Changed-file list.
- Automated test results.
- Manual tests still required.
- Known limitations.
- No-new-features confirmation.
- Exact repairs and retest steps.
```

## Manual test checklist

- [ ] Verify arithmetic and log returns against hand calculations.
- [ ] Align two series with deliberately missing dates.
- [ ] Calculate CAGR over an exact year and a partial year.
- [ ] Calculate beta and alpha from a small known dataset.
- [ ] Calculate maximum drawdown from a known normalized path.
- [ ] Add a contribution to raw account value and verify headline drawdown is unaffected by the contribution artifact.
- [ ] Test missing benchmark, stale risk-free rate, insufficient observations, zero, negative, NaN, and Infinity.
- [ ] Inspect visible methodology labels and metadata.

## Exit criteria

- Core analytics match deterministic expectations.
- Alignment and contribution handling are correct.
- No fabricated metric appears.
- Labels and metadata comply with Version 2.3.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## VS Code, Codex, and GitHub execution

### Allowed files

- `js/analytics/`
- `js/utils/`
- `js/data/risk-free-rate-service.js`
- `js/diagnostics/`
- `js/app.js`
- `index.html`
- `service-worker.js`
- `tests/calculation-tests.html`
- `tests/data-service-tests.html`
- `tests/index.html`
- `docs/test-results/`
- `CHANGELOG.md`

Files outside this list require an explicit requirements-based reason in the pull request. Do not accept a wholesale replacement project.

### Prepare the branch

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git switch main
git pull --ff-only
git status --short
git switch -c phase-6a
```

`git status --short` must be empty before creating the branch.

### Codex workspace implementation

In the open VS Code workspace, start a Codex implementation session with `requirements.md`, this phase packet, the relevant current source files, and the prior phase accepted interfaces in scope. Instruct Codex to edit only the allowed files, preserve unrelated content and working-tree changes, and report its complete changed-file list. Review every edit in VS Code Source Control before testing.

### Automated and browser tests

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git diff --stat
git diff --check
# Run any phase-specific Node suites listed by the implementation package.
python3 -m http.server 8000
```

Open the applicable browser pages in Firefox:

- `http://localhost:8000/tests/calculation-tests.html`
- `http://localhost:8000/tests/data-service-tests.html`
- `http://localhost:8000/tests/historical-data-tests.html`

The test pages and manual checklist are primary evidence. Record exact results under `docs/test-results/`.

### Audit output requirements

Run the canonical audit prompt in a separate Codex review session. In addition to the phase-specific checks, require:

- Requirement traceability
- Complete changed-file list
- Automated test commands and results
- Manual tests still required
- Known limitations and environment limits
- Confirmation that no unapproved feature was added
- Exact file-level repairs and retest steps

### Review, commit, push, pull request, merge, and tag

```bash
git status --short
git diff --stat
git diff
git diff --check
git add --all
git commit -m "Phase 6A: analytics engine"
git push -u origin phase-6a
```

In the GitHub web interface, create a pull request from the pushed phase branch to `main`, complete the pull-request evidence, wait for required checks, review the diff, then squash-merge and delete the remote branch. After merge:

```bash
git switch main
git pull --ff-only
git tag -a phase-6a-accepted -m "phase-6a-accepted accepted"
git push origin phase-6a-accepted
```

The tag triggers the milestone release workflow. Do not commit a routine ZIP.

### Rollback

Before merge, review the branch diff and preserve any work that may still be needed. Only if the owner explicitly approves discarding all unmerged branch work:

```bash
git switch main
git branch -D phase-6a
```

After merge, use a new repair branch and `git revert <merge-commit>`; do not reset or force-push `main`.

## Phase notes

Phase 7 must consume the accepted aligned-return utilities rather than recalculate them independently.


# Phase 7A - Monte Carlo Worker Infrastructure
**Status:** Not yet accepted

## Purpose

Create non-blocking worker execution, input validation, run state, progress, cancellation, stale-run protection, reproducible seed handling, and diagnostics before implementing a simulation method.

## Dependencies

- Accepted Analytics Engine
- Stable portfolio and benchmark inclusion state
- Web Worker capability detection

## Required deliverables

- `js/monte-carlo/mc-controller.js`
- `js/monte-carlo/mc-state.js`
- `js/monte-carlo/mc-inputs.js`
- `js/workers/monte-carlo-worker.js`
- `js/workers/worker-protocol.js`
- `tests/monte-carlo-tests.html`

## Canonical implementation prompt

```text
Build Phase 7A Monte Carlo worker infrastructure.

Authoritative spec: requirements.md, Version 2.3.
Do not implement scenario analysis, Regime Switching, Stochastic Volatility, GBM math, or Historical Bootstrap math yet.

Create or update:
- js/monte-carlo/mc-controller.js
- js/monte-carlo/mc-state.js
- js/monte-carlo/mc-inputs.js
- js/workers/monte-carlo-worker.js
- js/workers/worker-protocol.js
- tests/monte-carlo-tests.html

Requirements:
1. Run simulations in a Web Worker.
2. Keep the main UI responsive.
3. Define typed or rigorously validated request, progress, result, cancellation, and error messages.
4. Define states: idle, validating, queued, running, cancelling, cancelled, completed, failed, and stale.
5. Validate included symbols, path count, horizon, lookback, initial values, and seed before starting.
6. Support 1,000, 2,500, and 5,000 paths; default 5,000.
7. Do not silently reduce a selected path count.
8. Support fixed and random seed modes.
9. Show progress and elapsed time; omit ETA if unreliable.
10. Allow cancellation and terminate or reuse workers safely.
11. Detect input changes during a run and mark the result stale.
12. Prevent a late stale result from replacing a newer result.
13. Record safe run metadata, elapsed time, cancellation, failure, and stale status in Diagnostics.
14. Handle lack of Web Worker support with an explicit unavailable state rather than blocking the main thread.
15. Provide deterministic protocol and state-machine tests.

Edit only the authorized files in the current workspace, preserve unrelated changes, and report the complete changed-file list. Do not create a replacement project ZIP.
```

## Canonical audit prompt

```text
Audit Phase 7A against requirements.md Version 2.3.

Check:
- No simulation method was implemented prematurely.
- Worker protocol validates every message.
- State transitions are explicit and legal.
- UI cannot display a stale or superseded result as current.
- Cancellation works before and during running.
- Fixed and random seed modes are represented.
- Selected path count is never silently reduced.
- Main-thread fallback does not run expensive simulation.
- Diagnostics omit sensitive portfolio detail where unnecessary.
- Worker and event listeners are cleaned up.

Return state-machine defects, race conditions, memory risks, and exact fixes.

Required output:
- Requirement traceability.
- Changed-file list.
- Automated test results.
- Manual tests still required.
- Known limitations.
- No-new-features confirmation.
- Exact repairs and retest steps.
```

## Manual test checklist

- [ ] Run a mock worker job and verify progress.
- [ ] Cancel before start and during running.
- [ ] Change a portfolio input during a run and verify stale state.
- [ ] Start a second run before the first returns and verify the first cannot overwrite it.
- [ ] Test 1,000, 2,500, and 5,000 path input validation.
- [ ] Test fixed and generated seeds.
- [ ] Disable Worker capability and verify unavailable state.
- [ ] Inspect Diagnostics for safe metadata.

## Exit criteria

- Worker protocol is stable.
- Cancellation and stale-run handling pass.
- UI remains responsive.
- No disallowed simulation method exists.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## VS Code, Codex, and GitHub execution

### Allowed files

- `js/monte-carlo/mc-controller.js`
- `js/monte-carlo/mc-state.js`
- `js/monte-carlo/mc-inputs.js`
- `js/monte-carlo/random.js`
- `js/monte-carlo/statistics.js`
- `js/workers/monte-carlo-worker.js`
- `js/workers/worker-protocol.js`
- `js/diagnostics/simulation-diagnostics.js`
- `service-worker.js`
- `tests/monte-carlo-tests.html`
- `tests/index.html`
- `docs/test-results/`
- `CHANGELOG.md`

Files outside this list require an explicit requirements-based reason in the pull request. Do not accept a wholesale replacement project.

### Prepare the branch

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git switch main
git pull --ff-only
git status --short
git switch -c phase-7a-worker
```

`git status --short` must be empty before creating the branch.

### Codex workspace implementation

In the open VS Code workspace, start a Codex implementation session with `requirements.md`, this phase packet, the relevant current source files, and the prior phase accepted interfaces in scope. Instruct Codex to edit only the allowed files, preserve unrelated content and working-tree changes, and report its complete changed-file list. Review every edit in VS Code Source Control before testing.

### Automated and browser tests

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git diff --stat
git diff --check
# Run any phase-specific Node suites listed by the implementation package.
python3 -m http.server 8000
```

Open the applicable browser pages in Firefox:

- `http://localhost:8000/tests/monte-carlo-tests.html`
- `http://localhost:8000/tests/calculation-tests.html`

The test pages and manual checklist are primary evidence. Record exact results under `docs/test-results/`.

### Audit output requirements

Run the canonical audit prompt in a separate Codex review session. In addition to the phase-specific checks, require:

- Requirement traceability
- Complete changed-file list
- Automated test commands and results
- Manual tests still required
- Known limitations and environment limits
- Confirmation that no unapproved feature was added
- Exact file-level repairs and retest steps

### Review, commit, push, pull request, merge, and tag

```bash
git status --short
git diff --stat
git diff
git diff --check
git add --all
git commit -m "Phase 7A: Monte Carlo worker infrastructure"
git push -u origin phase-7a-worker
```

In the GitHub web interface, create a pull request from the pushed phase branch to `main`, complete the pull-request evidence, wait for required checks, review the diff, then squash-merge and delete the remote branch. After merge:

```bash
git switch main
git pull --ff-only
git tag -a phase-7a-accepted -m "phase-7a-accepted accepted"
git push origin phase-7a-accepted
```

The tag triggers the milestone release workflow. Do not commit a routine ZIP.

### Rollback

Before merge, review the branch diff and preserve any work that may still be needed. Only if the owner explicitly approves discarding all unmerged branch work:

```bash
git switch main
git branch -D phase-7a-worker
```

After merge, use a new repair branch and `git revert <merge-commit>`; do not reset or force-push `main`.

## Phase notes

Accept this infrastructure before implementing Phase 7B or 7C.


# Phase 7B - GBM Monte Carlo
**Status:** Not yet accepted

## Purpose

Implement correlated multi-asset daily GBM from aligned local log returns, with covariance stabilization disclosure, seeded randomness, portfolio aggregation, and required output statistics.

## Dependencies

- Accepted Phase 7A infrastructure
- Accepted Analytics Engine aligned-return utilities
- Historical Data Service 757-close extraction

## Required deliverables

- `js/monte-carlo/gbm.js`
- `js/monte-carlo/random.js`
- `js/monte-carlo/covariance.js`
- `js/monte-carlo/statistics.js`
- Worker integration
- Updated Monte Carlo tests

## Canonical implementation prompt

```text
Build Phase 7B Geometric Brownian Motion Monte Carlo.

Authoritative spec: requirements.md, Version 2.3.
Use the accepted Phase 7A worker protocol.
Implement only GBM in this phase.

Create or update:
- js/monte-carlo/gbm.js
- js/monte-carlo/random.js
- js/monte-carlo/covariance.js
- js/monte-carlo/statistics.js
- js/workers/monte-carlo-worker.js
- tests/monte-carlo-tests.html

Requirements:
1. Use up to 756 aligned daily log-return observations derived from 757 normalized Stooq closes.
2. Estimate daily drift as the arithmetic mean of daily log returns.
3. Estimate daily volatility and covariance using sample statistics.
4. Simulate one trading-day step at a time.
5. Use 252 trading days per projection year.
6. Simulate correlated multivariate daily log returns.
7. Use a deterministic seeded PRNG for fixed-seed mode.
8. Use Cholesky decomposition when valid.
9. If covariance is singular or non-positive-definite, apply one documented stabilization method and disclose it in Diagnostics.
10. Do not silently drop a symbol or change the selected path count.
11. Aggregate simulated asset values into portfolio ending values using included holdings and current initial values.
12. Produce P10, P50, P90, ending-value distribution summary, expected annualized return, probability of loss, and Value at Risk.
13. Return confidence-fan and percentile-band data suitable for Phase 8 charts.
14. Handle insufficient history, invalid covariance, overflow, underflow, and nonfinite output visibly.
15. Provide deterministic tests for means, covariance, seeded reproducibility, correlation direction, percentiles, and failure states.

Edit only the authorized files in the current workspace, preserve unrelated changes, and report the complete changed-file list. Do not create a replacement project ZIP.
```

## Canonical audit prompt

```text
Audit Phase 7B GBM against requirements.md Version 2.3.

Check:
- Inputs are aligned local daily log returns.
- 757 closes and 756 returns are handled correctly.
- Drift, sample volatility, and sample covariance formulas are documented and correct.
- Simulation uses daily steps and 252 days per year.
- Correlation is preserved through multivariate generation.
- Fixed seed reproduces unchanged inputs.
- Stabilization is explicit, bounded, and disclosed.
- No symbol or path is silently removed.
- Portfolio aggregation and risk statistics are correct.
- Nonfinite and insufficient inputs fail visibly.
- Worker cancellation and stale-run rules remain intact.

Return mathematical defects, numerical risks, reproducibility defects, and exact fixes.

Required output:
- Requirement traceability.
- Changed-file list.
- Automated test results.
- Manual tests still required.
- Known limitations.
- No-new-features confirmation.
- Exact repairs and retest steps.
```

## Manual test checklist

- [ ] Verify drift, volatility, and covariance against a known fixture.
- [ ] Run a fixed-seed small simulation twice and compare exact results.
- [ ] Use a positively correlated fixture and inspect simulated correlation.
- [ ] Use a singular covariance fixture and verify disclosed stabilization.
- [ ] Run 1-, 5-, and 10-year horizons with small path counts.
- [ ] Verify P10 <= P50 <= P90.
- [ ] Verify probability of loss and VaR on a known distribution fixture.
- [ ] Cancel a GBM run and verify no stale result displays.

## Exit criteria

- Deterministic formulas pass.
- Correlation and reproducibility pass.
- Outputs and risk statistics are valid.
- Stabilization is disclosed.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## VS Code, Codex, and GitHub execution

### Allowed files

- `js/monte-carlo/gbm.js`
- `js/monte-carlo/covariance.js`
- `js/monte-carlo/statistics.js`
- `js/monte-carlo/mc-inputs.js`
- `js/workers/monte-carlo-worker.js`
- `js/workers/worker-protocol.js`
- `tests/monte-carlo-tests.html`
- `docs/test-results/`
- `CHANGELOG.md`

Files outside this list require an explicit requirements-based reason in the pull request. Do not accept a wholesale replacement project.

### Prepare the branch

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git switch main
git pull --ff-only
git status --short
git switch -c phase-7b-gbm
```

`git status --short` must be empty before creating the branch.

### Codex workspace implementation

In the open VS Code workspace, start a Codex implementation session with `requirements.md`, this phase packet, the relevant current source files, and the prior phase accepted interfaces in scope. Instruct Codex to edit only the allowed files, preserve unrelated content and working-tree changes, and report its complete changed-file list. Review every edit in VS Code Source Control before testing.

### Automated and browser tests

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git diff --stat
git diff --check
# Run any phase-specific Node suites listed by the implementation package.
python3 -m http.server 8000
```

Open the applicable browser pages in Firefox:

- `http://localhost:8000/tests/monte-carlo-tests.html`
- `http://localhost:8000/tests/calculation-tests.html`

The test pages and manual checklist are primary evidence. Record exact results under `docs/test-results/`.

### Audit output requirements

Run the canonical audit prompt in a separate Codex review session. In addition to the phase-specific checks, require:

- Requirement traceability
- Complete changed-file list
- Automated test commands and results
- Manual tests still required
- Known limitations and environment limits
- Confirmation that no unapproved feature was added
- Exact file-level repairs and retest steps

### Review, commit, push, pull request, merge, and tag

```bash
git status --short
git diff --stat
git diff
git diff --check
git add --all
git commit -m "Phase 7B: GBM Monte Carlo"
git push -u origin phase-7b-gbm
```

In the GitHub web interface, create a pull request from the pushed phase branch to `main`, complete the pull-request evidence, wait for required checks, review the diff, then squash-merge and delete the remote branch. After merge:

```bash
git switch main
git pull --ff-only
git tag -a phase-7b-accepted -m "phase-7b-accepted accepted"
git push origin phase-7b-accepted
```

The tag triggers the milestone release workflow. Do not commit a routine ZIP.

### Rollback

Before merge, review the branch diff and preserve any work that may still be needed. Only if the owner explicitly approves discarding all unmerged branch work:

```bash
git switch main
git branch -D phase-7b-gbm
```

After merge, use a new repair branch and `git revert <merge-commit>`; do not reset or force-push `main`.

## Phase notes

Do not add EWMA estimation or stochastic volatility.


# Phase 7C - Historical Bootstrap Monte Carlo
**Status:** Not yet accepted

## Purpose

Implement whole-vector resampling of aligned daily arithmetic returns with replacement, preserving same-day cross-asset dependence and compounding through the global horizon.

## Dependencies

- Accepted Phase 7A infrastructure
- Accepted aligned daily arithmetic-return vectors
- Accepted statistics utilities

## Required deliverables

- `js/monte-carlo/bootstrap.js`
- Worker integration
- Updated `js/monte-carlo/statistics.js`
- Updated Monte Carlo tests

## Canonical implementation prompt

```text
Build Phase 7C Historical Bootstrap Monte Carlo.

Authoritative spec: requirements.md, Version 2.3.
Use the accepted Phase 7A worker protocol.
Implement only Historical Bootstrap in this phase.

Create or update:
- js/monte-carlo/bootstrap.js
- js/monte-carlo/statistics.js
- js/workers/monte-carlo-worker.js
- tests/monte-carlo-tests.html

Requirements:
1. Use up to 756 aligned daily arithmetic return vectors from normalized Stooq closes.
2. Preserve symbol order and exact date alignment.
3. Sample one complete same-day cross-asset return vector with replacement for each simulated trading day.
4. Never resample assets independently.
5. Compound sampled returns through the selected 1-10 year horizon using 252 trading days per year.
6. Do not impose an external drift adjustment.
7. Use the same fixed/random seed framework as GBM.
8. Respect included holdings and initial portfolio values.
9. Produce P10, P50, P90, ending-value distribution summary, expected annualized return, probability of loss, and Value at Risk.
10. Return confidence-fan and percentile-band data.
11. Handle returns less than or equal to -100%, insufficient vectors, empty symbols, nonfinite values, and overflow visibly.
12. Preserve Phase 7A cancellation, progress, and stale-run behavior.
13. Provide deterministic tests proving whole-vector resampling and fixed-seed reproducibility.
14. Do not implement block bootstrap unless explicitly approved later.

Edit only the authorized files in the current workspace, preserve unrelated changes, and report the complete changed-file list. Do not create a replacement project ZIP.
```

## Canonical audit prompt

```text
Audit Phase 7C Historical Bootstrap against requirements.md Version 2.3.

Check:
- Inputs are aligned daily arithmetic return vectors.
- Whole vectors, not independent asset returns, are resampled.
- Sampling is with replacement.
- No external drift adjustment is applied.
- Daily compounding and 252-day horizon conversion are correct.
- Fixed seed is reproducible.
- Required outputs are correct.
- Invalid -100% or nonfinite returns fail visibly.
- Worker cancellation and stale handling remain intact.
- Block bootstrap was not introduced.

Return algorithm defects, dependence-preservation risks, numerical risks, and exact fixes.

Required output:
- Requirement traceability.
- Changed-file list.
- Automated test results.
- Manual tests still required.
- Known limitations.
- No-new-features confirmation.
- Exact repairs and retest steps.
```

## Manual test checklist

- [ ] Use a tiny labeled vector fixture and verify sampled asset pairs always come from the same source day.
- [ ] Run a fixed-seed simulation twice and compare results.
- [ ] Verify sampling with replacement allows repeated days.
- [ ] Verify no drift adjustment is applied.
- [ ] Test a -100% return and a nonfinite return.
- [ ] Verify P10/P50/P90 ordering and risk statistics.
- [ ] Cancel a bootstrap run and verify clean state.

## Exit criteria

- Whole-vector dependence is preserved.
- Seeded results are reproducible.
- Outputs are valid.
- No block bootstrap or drift adjustment exists.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## VS Code, Codex, and GitHub execution

### Allowed files

- `js/monte-carlo/bootstrap.js`
- `js/monte-carlo/random.js`
- `js/monte-carlo/statistics.js`
- `js/monte-carlo/mc-inputs.js`
- `js/workers/monte-carlo-worker.js`
- `js/workers/worker-protocol.js`
- `tests/monte-carlo-tests.html`
- `docs/test-results/`
- `CHANGELOG.md`

Files outside this list require an explicit requirements-based reason in the pull request. Do not accept a wholesale replacement project.

### Prepare the branch

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git switch main
git pull --ff-only
git status --short
git switch -c phase-7c-bootstrap
```

`git status --short` must be empty before creating the branch.

### Codex workspace implementation

In the open VS Code workspace, start a Codex implementation session with `requirements.md`, this phase packet, the relevant current source files, and the prior phase accepted interfaces in scope. Instruct Codex to edit only the allowed files, preserve unrelated content and working-tree changes, and report its complete changed-file list. Review every edit in VS Code Source Control before testing.

### Automated and browser tests

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git diff --stat
git diff --check
# Run any phase-specific Node suites listed by the implementation package.
python3 -m http.server 8000
```

Open the applicable browser pages in Firefox:

- `http://localhost:8000/tests/monte-carlo-tests.html`
- `http://localhost:8000/tests/historical-data-tests.html`

The test pages and manual checklist are primary evidence. Record exact results under `docs/test-results/`.

### Audit output requirements

Run the canonical audit prompt in a separate Codex review session. In addition to the phase-specific checks, require:

- Requirement traceability
- Complete changed-file list
- Automated test commands and results
- Manual tests still required
- Known limitations and environment limits
- Confirmation that no unapproved feature was added
- Exact file-level repairs and retest steps

### Review, commit, push, pull request, merge, and tag

```bash
git status --short
git diff --stat
git diff
git diff --check
git add --all
git commit -m "Phase 7C: historical bootstrap Monte Carlo"
git push -u origin phase-7c-bootstrap
```

In the GitHub web interface, create a pull request from the pushed phase branch to `main`, complete the pull-request evidence, wait for required checks, review the diff, then squash-merge and delete the remote branch. After merge:

```bash
git switch main
git pull --ff-only
git tag -a phase-7c-accepted -m "phase-7c-accepted accepted"
git push origin phase-7c-accepted
```

The tag triggers the milestone release workflow. Do not commit a routine ZIP.

### Rollback

Before merge, review the branch diff and preserve any work that may still be needed. Only if the owner explicitly approves discarding all unmerged branch work:

```bash
git switch main
git branch -D phase-7c-bootstrap
```

After merge, use a new repair branch and `git revert <merge-commit>`; do not reset or force-push `main`.

## Phase notes

Phase 7 is accepted only when 7A, 7B, and 7C all pass.


# Phase 8A - Projection Horizon and Projection Visuals
**Status:** Not yet accepted

## Purpose

Apply one persisted 1-10 year global horizon across every forward-looking module and render confidence-fan and percentile-band visuals with calendar context.

## Dependencies

- Accepted Monte Carlo methods
- Accepted Chart Manager
- Accepted settings persistence

## Required deliverables

- `js/settings/projection-settings.js`
- `js/utils/projection-date-utils.js`
- `js/charts/mc-confidence-fan.js`
- `js/charts/mc-percentile-bands.js`
- Dashboard and Settings controls
- Export metadata hooks

## Canonical implementation prompt

```text
Build Phase 8A Projection Horizon and Projection Visuals.

Authoritative spec: requirements.md, Version 2.3.
Use the accepted Monte Carlo and Chart Manager interfaces.

Create or update:
- js/settings/projection-settings.js
- js/utils/projection-date-utils.js
- js/charts/mc-confidence-fan.js
- js/charts/mc-percentile-bands.js
- dashboard and Settings controls
- export metadata hooks

Requirements:
1. Provide one global Projection Horizon control.
2. Accept integer values from 1 through 10 years only.
3. Default to the requirements-approved initial value.
4. Use 252 trading days per projection year for calculations.
5. Calculate and display a human-readable projected calendar end date separately from the statistical trading-day length.
6. Place the control prominently in the dashboard header and also in Settings.
7. Persist changes locally.
8. Apply the selected horizon to GBM, Historical Bootstrap, summary cards, benchmark projection tables, confidence fan, percentile bands, CSV metadata, backup metadata, and print report context.
9. Changing the horizon must invalidate a prior simulation and trigger recalculation without page refresh when the user runs or approves it.
10. Do not silently start an expensive simulation on every input keystroke.
11. Render confidence fan and percentile bands with accessible legends, methodology labels, and unavailable states.
12. Support iPhone 13 mini portrait and landscape.
13. Edit the authorized workspace files directly and add manual tests.

Edit only the authorized files in the current workspace, preserve unrelated changes, and report the complete changed-file list. Do not create a replacement project ZIP.
```

## Canonical audit prompt

```text
Audit Phase 8A against requirements.md Version 2.3.

Check:
- Only integer horizons 1-10 are accepted.
- 252 trading days per year is used consistently.
- Calendar date and trading-day horizon are clearly distinguished.
- One setting controls every projection output.
- The selected value persists.
- Horizon changes mark prior simulations stale.
- Expensive runs are not triggered on every keystroke.
- Confidence fan and percentile bands consume accepted simulation output.
- Export and report metadata hooks include horizon and projected-through date.
- Desktop and iPhone layouts are usable.

Return consistency defects, stale-state defects, date risks, and exact fixes.

Required output:
- Requirement traceability.
- Changed-file list.
- Automated test results.
- Manual tests still required.
- Known limitations.
- No-new-features confirmation.
- Exact repairs and retest steps.
```

## Manual test checklist

- [ ] Set every horizon from 1 through 10 and verify persistence.
- [ ] Reject 0, 11, decimals, blank, NaN, and pasted invalid text.
- [ ] Verify 1 year maps to 252 simulation steps and 10 years to 2,520.
- [ ] Verify projected calendar date display updates.
- [ ] Run GBM and Bootstrap at two horizons and verify prior results become stale.
- [ ] Inspect confidence fan and percentile bands.
- [ ] Verify CSV/report metadata hooks receive horizon and date.
- [ ] Test controls in iPhone portrait and landscape.

## Exit criteria

- One global horizon controls all projections.
- Dates and steps are consistent.
- Stale-result handling works.
- Projection visuals render accessibly.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## VS Code, Codex, and GitHub execution

### Allowed files

- `js/settings/projection-settings.js`
- `js/utils/projection-date-utils.js`
- `js/charts/mc-confidence-fan.js`
- `js/charts/mc-percentile-bands.js`
- `js/charts/chart-manager.js`
- `js/charts/chart-options.js`
- `js/ui/`
- `js/app.js`
- `index.html`
- `css/`
- `service-worker.js`
- `tests/calculation-tests.html`
- `tests/ui-tests.html`
- `tests/monte-carlo-tests.html`
- `docs/test-results/`
- `CHANGELOG.md`

Files outside this list require an explicit requirements-based reason in the pull request. Do not accept a wholesale replacement project.

### Prepare the branch

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git switch main
git pull --ff-only
git status --short
git switch -c phase-8a-projections
```

`git status --short` must be empty before creating the branch.

### Codex workspace implementation

In the open VS Code workspace, start a Codex implementation session with `requirements.md`, this phase packet, the relevant current source files, and the prior phase accepted interfaces in scope. Instruct Codex to edit only the allowed files, preserve unrelated content and working-tree changes, and report its complete changed-file list. Review every edit in VS Code Source Control before testing.

### Automated and browser tests

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git diff --stat
git diff --check
# Run any phase-specific Node suites listed by the implementation package.
python3 -m http.server 8000
```

Open the applicable browser pages in Firefox:

- `http://localhost:8000/tests/calculation-tests.html`
- `http://localhost:8000/tests/monte-carlo-tests.html`
- `http://localhost:8000/tests/ui-tests.html`

The test pages and manual checklist are primary evidence. Record exact results under `docs/test-results/`.

### Audit output requirements

Run the canonical audit prompt in a separate Codex review session. In addition to the phase-specific checks, require:

- Requirement traceability
- Complete changed-file list
- Automated test commands and results
- Manual tests still required
- Known limitations and environment limits
- Confirmation that no unapproved feature was added
- Exact file-level repairs and retest steps

### Review, commit, push, pull request, merge, and tag

```bash
git status --short
git diff --stat
git diff
git diff --check
git add --all
git commit -m "Phase 8A: projection horizon and visuals"
git push -u origin phase-8a-projections
```

In the GitHub web interface, create a pull request from the pushed phase branch to `main`, complete the pull-request evidence, wait for required checks, review the diff, then squash-merge and delete the remote branch. After merge:

```bash
git switch main
git pull --ff-only
git tag -a phase-8a-accepted -m "phase-8a-accepted accepted"
git push origin phase-8a-accepted
```

The tag triggers the milestone release workflow. Do not commit a routine ZIP.

### Rollback

Before merge, review the branch diff and preserve any work that may still be needed. Only if the owner explicitly approves discarding all unmerged branch work:

```bash
git switch main
git branch -D phase-8a-projections
```

After merge, use a new repair branch and `git revert <merge-commit>`; do not reset or force-push `main`.

## Phase notes

Do not add deterministic scenario analysis.


# Phase 9A - Full Portable Backup and Restore
**Status:** Not yet accepted

## Purpose

Provide a versioned, validated, transactional backup containing configuration and normalized historical data so the Mac can initialize or update the iPhone without automatic synchronization.

## Dependencies

- Stable persistence schema
- Accepted historical data and portfolio state
- File and download capability

## Required deliverables

- `js/export/full-backup-export.js`
- `js/export/full-backup-restore.js`
- Backup schema and integrity metadata
- Restore preview UI
- Updated storage/UI tests
- Mac-to-iPhone transfer procedure

## Canonical implementation prompt

```text
Build Phase 9A Full Portable Backup and Restore.

Authoritative spec: requirements.md, Version 2.3.
Implement this before final reporting so the Mac-to-iPhone transfer workflow is available early.

Create or update:
- js/export/full-backup-export.js
- js/export/full-backup-restore.js
- restore preview and confirmation UI
- persistence transaction helpers
- tests/storage-tests.html and tests/ui-tests.html

Requirements:
1. Export one versioned full portable backup containing:
   - holdings and lots
   - benchmarks and active-symbol states
   - settings and UI preferences
   - projection and Monte Carlo settings
   - normalized historical candles
   - historical dataset metadata, hashes, dates, counts, and adjustment methodology
   - historical quality flags
   - historical import history
   - diagnostics settings needed for safe restore
2. Include the active Finnhub API key.
3. Cached provider request URLs and the active Finnhub key may be included.
4. Include backup schema version, application version, creation timestamp, source-device label, section counts, and integrity checksum or equivalent validation.
5. Validate the complete backup before changing current state.
6. Show a restore preview with versions, counts, symbols, date ranges, and warnings.
7. Reject unsupported future versions, malformed sections, duplicate keys, invalid records, and checksum failure.
8. Restore transactionally so a failed restore leaves the prior state intact.
9. Offer replace behavior for the complete portable state; do not silently merge incompatible historical datasets.
10. Invalidate derived analytics and simulations after successful restore.
11. Restore the saved Finnhub key and allow the user to edit or reset it.
12. Support transfer from Mac to iPhone through AirDrop or Files.
13. Record backup and restore success or safe failure in Diagnostics.
14. Provide deterministic corruption and rollback tests.

Edit only the authorized files in the current workspace, preserve unrelated changes, and report the complete changed-file list. Do not create a replacement project ZIP.
```

## Canonical audit prompt

```text
Audit Phase 9A against requirements.md Version 2.3.

Check:
- Full backup includes every required state and historical section.
- API key and complete request details may be included.
- Schema version and integrity validation are present.
- Entire backup is validated before mutation.
- Restore preview is complete.
- Unsupported, malformed, duplicate, or corrupted data is rejected.
- Restore rollback preserves prior data.
- Historical data is not silently merged across incompatible adjustment bases.
- Derived results are invalidated.
- Mac-to-iPhone transfer and restored-key edit/reset behavior are documented.
- Diagnostics may include backup metadata and key content; restore status remains explicit.

Return data-loss risks, content-integrity risks, compatibility risks, and exact fixes.

Required output:
- Requirement traceability.
- Changed-file list.
- Automated test results.
- Manual tests still required.
- Known limitations.
- No-new-features confirmation.
- Exact repairs and retest steps.
```

## Manual test checklist

- [ ] Export a full backup from a populated Mac test profile.
- [ ] Inspect backup metadata and confirm no key exists.
- [ ] Restore into an empty test profile.
- [ ] Compare holdings, settings, counts, hashes, and date ranges.
- [ ] Corrupt the checksum and verify rejection.
- [ ] Remove a required section and verify rejection.
- [ ] Use an unsupported future schema version.
- [ ] Inject a restore failure and verify old state remains.
- [ ] Transfer through AirDrop/Files and restore on iPhone after Phase 1D.
- [ ] Verify the iPhone restores the saved key and can edit or reset it.

## Exit criteria

- Full backup round-trip preserves required state.
- The active Finnhub key may be exported.
- Corruption and rollback tests pass.
- Mac-to-iPhone restore works before final acceptance.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## VS Code, Codex, and GitHub execution

### Allowed files

- `js/export/backup-export.js`
- `js/export/backup-restore.js`
- `js/export/full-backup-export.js`
- `js/export/full-backup-restore.js`
- `js/export/export-manager.js`
- `js/persistence/`
- `js/settings/settings-state.js`
- `js/ui/`
- `js/app.js`
- `index.html`
- `service-worker.js`
- `tests/storage-tests.html`
- `tests/ui-tests.html`
- `tests/index.html`
- `backups/`
- `docs/test-results/`
- `CHANGELOG.md`

Files outside this list require an explicit requirements-based reason in the pull request. Do not accept a wholesale replacement project.

### Prepare the branch

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git switch main
git pull --ff-only
git status --short
git switch -c phase-9a-backup-restore
```

`git status --short` must be empty before creating the branch.

### Codex workspace implementation

In the open VS Code workspace, start a Codex implementation session with `requirements.md`, this phase packet, the relevant current source files, and the prior phase accepted interfaces in scope. Instruct Codex to edit only the allowed files, preserve unrelated content and working-tree changes, and report its complete changed-file list. Review every edit in VS Code Source Control before testing.

### Automated and browser tests

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git diff --stat
git diff --check
# Run any phase-specific Node suites listed by the implementation package.
python3 -m http.server 8000
```

Open the applicable browser pages in Firefox:

- `http://localhost:8000/tests/storage-tests.html`
- `http://localhost:8000/tests/ui-tests.html`
- `http://localhost:8000/tests/historical-data-tests.html`

The test pages and manual checklist are primary evidence. Record exact results under `docs/test-results/`.

### Audit output requirements

Run the canonical audit prompt in a separate Codex review session. In addition to the phase-specific checks, require:

- Requirement traceability
- Complete changed-file list
- Automated test commands and results
- Manual tests still required
- Known limitations and environment limits
- Confirmation that no unapproved feature was added
- Exact file-level repairs and retest steps

### Review, commit, push, pull request, merge, and tag

```bash
git status --short
git diff --stat
git diff
git diff --check
git add --all
git commit -m "Phase 9A: full portable backup and restore"
git push -u origin phase-9a-backup-restore
```

In the GitHub web interface, create a pull request from the pushed phase branch to `main`, complete the pull-request evidence, wait for required checks, review the diff, then squash-merge and delete the remote branch. After merge:

```bash
git switch main
git pull --ff-only
git tag -a phase-9a-accepted -m "phase-9a-accepted accepted"
git push origin phase-9a-accepted
```

The tag triggers the milestone release workflow. Do not commit a routine ZIP.

### Rollback

Before merge, review the branch diff and preserve any work that may still be needed. Only if the owner explicitly approves discarding all unmerged branch work:

```bash
git switch main
git branch -D phase-9a-backup-restore
```

After merge, use a new repair branch and `git revert <merge-commit>`; do not reset or force-push `main`.

## Phase notes

This phase is the approved synchronization mechanism. Do not add cloud sync.


# Phase 9B - Export and Reporting
**Status:** Not yet accepted

## Purpose

Add CSV exports, chart PNG integration, a print-optimized report for browser Print to PDF, and lightweight configuration backup while preserving methodology and freshness context.

## Dependencies

- Accepted calculations, charts, projections, and full portable backup
- Browser Blob/download and print support

## Required deliverables

- `js/export/csv-export.js`
- `js/export/backup-export.js`
- `js/export/backup-restore.js`
- `js/export/print-report.js`
- `js/export/export-manager.js`
- Updated `css/print.css`
- Updated UI tests

## Canonical implementation prompt

```text
Build Phase 9B Export and Reporting.

Authoritative spec: requirements.md, Version 2.3.
Use browser Print to PDF. Do not add a custom PDF library.
Do not weaken the accepted full portable backup behavior from Phase 9A.

Create or update:
- js/export/csv-export.js
- js/export/backup-export.js
- js/export/backup-restore.js
- js/export/print-report.js
- js/export/export-manager.js
- css/print.css
- tests/ui-tests.html

Requirements:
1. CSV export for holdings.
2. CSV export for lots.
3. CSV export for portfolio analytics.
4. CSV export for historical comparison data where available.
5. CSV export for Monte Carlo summaries and benchmark projection results.
6. Include projection horizon and projected-through date.
7. Include observation count, aligned range, source, split adjustment, dividend exclusion, quote timestamp, risk-free-rate timestamp, stale warnings, and simulation seed/method where relevant.
8. Escape CSV safely and preserve numeric precision appropriate for data export.
9. Create a print-optimized report page containing required summary cards, holdings, benchmarks, analytics, charts, Monte Carlo outputs, methodology, freshness, and warnings.
10. Integrate PNG chart exports.
11. Implement lightweight configuration backup and restore separately from full portable backup.
12. Include the active Finnhub key in configuration and report metadata exports.
13. Do not provide public share links or upload exports.
14. Implement backup reminders: 30 calendar days or 10 saved edits since last backup, whichever occurs first, with a 30-day dismissal.
15. Record safe export failures in Diagnostics.
16. Edit the authorized workspace files directly and add manual tests.

Edit only the authorized files in the current workspace, preserve unrelated changes, and report the complete changed-file list. Do not create a replacement project ZIP.
```

## Canonical audit prompt

```text
Audit Phase 9B against requirements.md Version 2.3.

Check:
- Every required CSV exists and escapes values correctly.
- Methodology, source, dates, freshness, and projection context are included.
- Print report contains required tables and charts and works through browser Print to PDF.
- PNG integration works.
- Configuration backup is distinct from full portable backup.
- API key is included where settings or report metadata are exported.
- No upload or public share mechanism exists.
- Backup reminder triggers follow the exact rules.
- Export errors are visible and safe.
- Print styles work on desktop and do not depend on unsupported libraries.

Return blocking export defects, privacy risks, labeling defects, and exact fixes.

Required output:
- Requirement traceability.
- Changed-file list.
- Automated test results.
- Manual tests still required.
- Known limitations.
- No-new-features confirmation.
- Exact repairs and retest steps.
```

## Manual test checklist

- [ ] Export every CSV and open it in a spreadsheet application.
- [ ] Test commas, quotes, line breaks, Unicode, and formula-like user text for safe CSV handling.
- [ ] Verify full precision fields are not display-rounded unnecessarily.
- [ ] Open the print report and use browser Print Preview.
- [ ] Save a PDF and inspect page breaks, charts, warnings, and headers.
- [ ] Export each chart as PNG.
- [ ] Test configuration backup round-trip.
- [ ] Inspect every export for API-key absence.
- [ ] Simulate 30 days and 10 edits to verify reminder rules.
- [ ] Cancel a download and verify an explicit safe state.

## Exit criteria

- CSV, PNG, and print outputs work.
- Methodology and freshness context are complete.
- No key or upload path exists.
- Backup reminders are correct.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## VS Code, Codex, and GitHub execution

### Allowed files

- `js/export/csv-export.js`
- `js/export/print-report.js`
- `js/export/export-manager.js`
- `js/charts/chart-export.js`
- `css/print.css`
- `index.html`
- `js/app.js`
- `service-worker.js`
- `tests/ui-tests.html`
- `tests/calculation-tests.html`
- `tests/index.html`
- `exports/`
- `docs/test-results/`
- `CHANGELOG.md`

Files outside this list require an explicit requirements-based reason in the pull request. Do not accept a wholesale replacement project.

### Prepare the branch

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git switch main
git pull --ff-only
git status --short
git switch -c phase-9b-exports
```

`git status --short` must be empty before creating the branch.

### Codex workspace implementation

In the open VS Code workspace, start a Codex implementation session with `requirements.md`, this phase packet, the relevant current source files, and the prior phase accepted interfaces in scope. Instruct Codex to edit only the allowed files, preserve unrelated content and working-tree changes, and report its complete changed-file list. Review every edit in VS Code Source Control before testing.

### Automated and browser tests

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git diff --stat
git diff --check
# Run any phase-specific Node suites listed by the implementation package.
python3 -m http.server 8000
```

Open the applicable browser pages in Firefox:

- `http://localhost:8000/tests/ui-tests.html`
- `http://localhost:8000/tests/calculation-tests.html`

The test pages and manual checklist are primary evidence. Record exact results under `docs/test-results/`.

### Audit output requirements

Run the canonical audit prompt in a separate Codex review session. In addition to the phase-specific checks, require:

- Requirement traceability
- Complete changed-file list
- Automated test commands and results
- Manual tests still required
- Known limitations and environment limits
- Confirmation that no unapproved feature was added
- Exact file-level repairs and retest steps

### Review, commit, push, pull request, merge, and tag

```bash
git status --short
git diff --stat
git diff
git diff --check
git add --all
git commit -m "Phase 9B: exports and reporting"
git push -u origin phase-9b-exports
```

In the GitHub web interface, create a pull request from the pushed phase branch to `main`, complete the pull-request evidence, wait for required checks, review the diff, then squash-merge and delete the remote branch. After merge:

```bash
git switch main
git pull --ff-only
git tag -a phase-9b-accepted -m "phase-9b-accepted accepted"
git push origin phase-9b-accepted
```

The tag triggers the milestone release workflow. Do not commit a routine ZIP.

### Rollback

Before merge, review the branch diff and preserve any work that may still be needed. Only if the owner explicitly approves discarding all unmerged branch work:

```bash
git switch main
git branch -D phase-9b-exports
```

After merge, use a new repair branch and `git revert <merge-commit>`; do not reset or force-push `main`.

## Phase notes

Use Phase 9A full backup for device transfer; configuration backup is the smaller convenience option.


# Phase 10A - Hardening, Vendoring, Offline, and iPhone Validation
**Status:** Not yet accepted

## Purpose

Vendor dependencies, finalize service-worker caching and storage diagnostics, complete accessibility and security hardening, and validate the Mac and iPhone offline operating model.

## Dependencies

- All functional phases accepted
- Phase 1D completed on target home Wi-Fi
- Stable final local HTTPS origin
- Full backup and restore available

## Required deliverables

- Vendored ECharts under `vendor/echarts/`
- Final versioned service-worker cache
- Offline fallback and update behavior
- Accessibility and security fixes
- Performance and compatibility reports
- Final manual backup

## Canonical implementation prompt

```text
Build Phase 10A hardening increment.

Authoritative spec: requirements.md, Version 2.3.
Do not add new product features unless required to satisfy acceptance.

Tasks:
1. Vendor Apache ECharts into vendor/echarts/ and remove the runtime CDN dependency.
2. Update service-worker static caching to include the app shell, icons, and vendored assets with explicit cache versioning.
3. Do not precache user exports or IndexedDB content; caching static predefined-key configuration and provider URLs is permitted.
4. Implement safe cache upgrade and old-cache cleanup.
5. Confirm the app shell launches offline after a successful visit.
6. Confirm IndexedDB historical data, portfolio state, and cached quotes render when the Mac server is unavailable.
7. Distinguish Mac host unavailable, internet unavailable, Finnhub unavailable, stale cache, and local-history available states.
8. Add or verify StorageManager estimate, persisted status, persistence request, and clear warnings when unavailable.
9. Audit keyboard navigation, labels, landmarks, focus order, visible focus, dialog focus trapping, and announcements.
10. Audit high contrast and color-blind-safe chart distinctions.
11. Sanitize all user-entered text and avoid unsafe HTML rendering.
12. Audit predefined-key consistency, edit/reset behavior, persistence, diagnostics, exports, backups, URLs, and service-worker behavior.
13. Test Firefox on macOS Big Sur.
14. Test Safari browser and Home Screen modes on iPhone 13 mini, iOS 26.5.
15. Test portrait, landscape, safe-area insets, orientation change, touch gestures, file import, backup restore, and horizontal table scrolling.
16. Test Monte Carlo progress and cancellation for 1-, 5-, and 10-year horizons with 1,000, 2,500, and 5,000 paths on iPhone.
17. Benchmark approximately 8, 13, and 25 active symbols on the Mac without silently reducing correctness.
18. Test application update after service-worker cache-version change.
19. Test recovery documentation after browser storage loss.
20. Confirm no public hosting, remote access, router forwarding, backend, or cloud sync is required.
21. Save final performance, compatibility, and acceptance notes.

Edit only the authorized files in the current workspace, preserve unrelated changes, and report the complete changed-file list. Do not create a replacement project ZIP.
```

## Canonical audit prompt

```text
Audit Phase 10A hardening against requirements.md Version 2.3.

Check:
- ECharts is local and offline-capable.
- Service-worker caches are explicitly versioned; they may contain static predefined-key configuration but not mutable IndexedDB user data.
- Offline launch works after successful installation.
- Mac-host, internet, provider, stale, and local-history states are distinct.
- Storage persistence diagnostics are correct.
- Accessibility basics pass.
- User-entered text is safely rendered.
- Predefined and overridden key behavior is consistent across every required surface.
- Firefox/macOS Big Sur and Safari/iPhone 13 mini are tested.
- Portrait, landscape, safe area, orientation, gestures, import, restore, and Monte Carlo cancellation pass.
- Performance notes exist for required symbol/path/horizon combinations.
- No prohibited deployment or architecture drift exists.

Return blocking, important, and minor defects. Identify exact files and retest steps.

Required output:
- Requirement traceability.
- Changed-file list.
- Automated test results.
- Manual tests still required.
- Known limitations.
- No-new-features confirmation.
- Exact repairs and retest steps.
```

## Manual test checklist

- [ ] Disconnect internet while keeping the Mac server available; inspect states.
- [ ] Stop the Mac server and launch the installed iPhone app offline.
- [ ] Update cache version and verify controlled update behavior.
- [ ] Inspect Cache Storage for unexpected mutable user files and verify allowed predefined-key assets.
- [ ] Request storage persistence and inspect Diagnostics.
- [ ] Run keyboard-only navigation on desktop.
- [ ] Run screen-reader spot checks for forms, errors, dialogs, and chart summaries.
- [ ] Test high contrast and non-color chart distinctions.
- [ ] Test iPhone portrait and landscape, safe areas, orientation, gestures, file import, and restore.
- [ ] Run required Monte Carlo path/horizon combinations and record elapsed time.
- [ ] Test approximately 8, 13, and 25 active symbols on Mac.
- [ ] Clear browser data in a test profile and follow recovery instructions.

## Exit criteria

- Vendored offline app works.
- Security and accessibility audits pass.
- Required Mac and iPhone tests are recorded.
- No prohibited architecture is present.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## VS Code, Codex, and GitHub execution

### Allowed files

- `vendor/echarts/`
- `service-worker.js`
- `manifest.json`
- `index.html`
- `assets/icons/`
- `css/`
- `js/`
- `tests/`
- `docs/test-results/`
- `docs/private-https-iphone-setup.md`
- `README.md`
- `CHANGELOG.md`

Files outside this list require an explicit requirements-based reason in the pull request. Do not accept a wholesale replacement project.

### Prepare the branch

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git switch main
git pull --ff-only
git status --short
git switch -c phase-10a-hardening
```

`git status --short` must be empty before creating the branch.

### Codex workspace implementation

In the open VS Code workspace, start a Codex implementation session with `requirements.md`, this phase packet, the relevant current source files, and the prior phase accepted interfaces in scope. Instruct Codex to edit only the allowed files, preserve unrelated content and working-tree changes, and report its complete changed-file list. Review every edit in VS Code Source Control before testing.

### Automated and browser tests

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git diff --stat
git diff --check
# Run any phase-specific Node suites listed by the implementation package.
python3 -m http.server 8000
```

Open the applicable browser pages in Firefox:

- `http://localhost:8000/tests/index.html`
- `http://localhost:8000/tests/storage-tests.html`
- `http://localhost:8000/tests/data-service-tests.html`
- `http://localhost:8000/tests/historical-data-tests.html`
- `http://localhost:8000/tests/calculation-tests.html`
- `http://localhost:8000/tests/monte-carlo-tests.html`
- `http://localhost:8000/tests/ui-tests.html`

The test pages and manual checklist are primary evidence. Record exact results under `docs/test-results/`.

### Audit output requirements

Run the canonical audit prompt in a separate Codex review session. In addition to the phase-specific checks, require:

- Requirement traceability
- Complete changed-file list
- Automated test commands and results
- Manual tests still required
- Known limitations and environment limits
- Confirmation that no unapproved feature was added
- Exact file-level repairs and retest steps

### Review, commit, push, pull request, merge, and tag

```bash
git status --short
git diff --stat
git diff
git diff --check
git add --all
git commit -m "Phase 10A: hardening and device validation"
git push -u origin phase-10a-hardening
```

In the GitHub web interface, create a pull request from the pushed phase branch to `main`, complete the pull-request evidence, wait for required checks, review the diff, then squash-merge and delete the remote branch. After merge:

```bash
git switch main
git pull --ff-only
git tag -a phase-10a-accepted -m "phase-10a-accepted accepted"
git push origin phase-10a-accepted
```

The tag triggers the milestone release workflow. Do not commit a routine ZIP.

### Rollback

Before merge, review the branch diff and preserve any work that may still be needed. Only if the owner explicitly approves discarding all unmerged branch work:

```bash
git switch main
git branch -D phase-10a-hardening
```

After merge, use a new repair branch and `git revert <merge-commit>`; do not reset or force-push `main`.

## Phase notes

Phase 1D must be completed before this phase can receive final acceptance.


# Phase 10B - Final Requirements Audit
**Status:** Not yet accepted

## Purpose

Perform the final no-new-features audit against every Version 2.3 requirement, acceptance criterion, non-goal, device target, data-source rule, and privacy constraint.

## Dependencies

- All prior phases accepted
- Complete test records
- Final local HTTPS and iPhone validation
- Final backup

## Required deliverables

- Final pass/fail requirements matrix
- Defect list grouped by severity
- Retest evidence
- Final accepted backup identifier
- Release decision

## Canonical implementation prompt

```text
Perform Phase 10B final audit.

Authoritative spec: requirements.md, Version 2.3.
Do not add new features unless required to correct a failed acceptance criterion.

Audit at minimum:
1. Private personal-use scope only.
2. No backend, cloud sync, public hosting, remote access, VPN requirement, or router port forwarding.
3. Approved Finnhub endpoints only; no /stock/candle.
4. Stooq history is private, split-adjusted, and dividend-unadjusted.
5. Complete-series manual historical replacement works transactionally.
6. Historical Data Service is the only analytical history interface.
7. Quote-only mode works when local history is missing.
8. Request queue enforces 60/minute, 30/second, priorities, bounded concurrency, and 429 backoff.
9. 25 active-symbol cap is enforced across holdings and benchmarks.
10. API key `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g` is hardcoded as the default, committed, visible, editable, logged where useful, exported, backed up, and shown in diagnostics.
11. Holdings and lots add/edit/delete, preserve audit notes, and do not auto-apply corporate actions.
12. Built-in benchmarks can be deleted and re-added.
13. Deleting a benchmark does not affect a same-ticker holding.
14. Historical analytics are labeled split-adjusted, dividend-unadjusted price-return approximations.
15. Headline drawdown uses the Price-Return Performance Series.
16. GBM and Historical Bootstrap are the only MVP Monte Carlo methods.
17. Simulations use workers, progress, cancellation, seeds, and stale-run protection.
18. Charts render responsively and export PNG.
19. Projection horizon is globally consistent from 1 through 10 years.
20. Full portable backup and transactional restore work from Mac to iPhone.
21. API key is included in backup.
22. CSV and browser Print to PDF work.
23. Backup reminder rules are correct.
24. PWA launches offline after a successful visit.
25. Mac-host unavailable, internet unavailable, provider unavailable, stale, and local-history states are distinct.
26. Trusted same-Wi-Fi HTTPS and Home Screen installation work on iPhone 13 mini iOS 26.5.
27. iPhone portrait, landscape, safe areas, gestures, file import, restore, and Monte Carlo cancellation are tested.
28. Firefox/macOS Big Sur compatibility passes.
29. Accessibility and safe rendering basics pass.
30. Performance notes exist for the required symbol, horizon, and path-count combinations.
31. Every acceptance criterion in requirements.md is mapped to test evidence.
32. Every explicit non-goal remains excluded.

Output:
- A complete pass/fail matrix keyed to requirements sections.
- Defects grouped as blocking, important, or minor.
- Exact files and retest procedures for every failure.
- A final release recommendation: accept, accept with documented minor limitations, or reject.
- No speculative future features.

Edit only the authorized files in the current workspace, preserve unrelated changes, and report the complete changed-file list. Do not create a replacement project ZIP.
```

## Canonical audit prompt

```text
Review the Phase 10B audit itself for completeness and evidence quality.

Check:
- Every requirements section and acceptance criterion is represented.
- Every pass cites a test, file, or observable result.
- No unsupported assumption is marked pass.
- Blocking defects are not downgraded.
- Security, privacy, data integrity, numerical correctness, offline behavior, and iPhone behavior are all covered.
- The release recommendation matches the evidence.
- The audit may include the API key and private backup metadata.

Return only audit-quality defects and required corrections.

Required output:
- Requirement traceability.
- Changed-file list.
- Automated test results.
- Manual tests still required.
- Known limitations.
- No-new-features confirmation.
- Exact repairs and retest steps.
```

## Manual test checklist

- [ ] Trace every acceptance criterion to a test record.
- [ ] Search production code for prohibited `/stock/candle` dependencies and verify expected key occurrences.
- [ ] Inspect service-worker caches, Local Storage, IndexedDB metadata, exports, and backups.
- [ ] Run the final desktop smoke suite.
- [ ] Run the final iPhone Home Screen and offline suite.
- [ ] Run final parser, persistence, analytics, Monte Carlo, and export tests.
- [ ] Confirm the final working-folder backup opens independently.

## Exit criteria

- Every criterion has evidence.
- No blocking defect remains.
- Final backup is verified.
- Release decision is explicit and justified.

## Backup gate

- Create a phase-labeled copy of the full working folder after acceptance.
- Record browser/device, test date, and any known limitations in `docs/test-results/`.

## VS Code, Codex, and GitHub execution

### Allowed files

- `requirements.md`
- `roadmap.md`
- `README.md`
- `CHANGELOG.md`
- `docs/test-results/`
- `docs/FINAL-REQUIREMENTS-AUDIT.md`
- `project-source.json`
- `.github/workflows/release-milestone.yml`

Files outside this list require an explicit requirements-based reason in the pull request. Do not accept a wholesale replacement project.

### Prepare the branch

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git switch main
git pull --ff-only
git status --short
git switch -c phase-10b-final-audit
```

`git status --short` must be empty before creating the branch.

### Codex workspace implementation

In the open VS Code workspace, start a Codex implementation session with `requirements.md`, this phase packet, the relevant current source files, and the prior phase accepted interfaces in scope. Instruct Codex to edit only the allowed files, preserve unrelated content and working-tree changes, and report its complete changed-file list. Review every edit in VS Code Source Control before testing.

### Automated and browser tests

```bash
cd "/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-3A-Validated"
pwd
git remote get-url origin
git diff --stat
git diff --check
# Run any phase-specific Node suites listed by the implementation package.
python3 -m http.server 8000
```

Open the applicable browser pages in Firefox:

- `http://localhost:8000/tests/index.html`
- `http://localhost:8000/tests/storage-tests.html`
- `http://localhost:8000/tests/data-service-tests.html`
- `http://localhost:8000/tests/historical-data-tests.html`
- `http://localhost:8000/tests/calculation-tests.html`
- `http://localhost:8000/tests/monte-carlo-tests.html`
- `http://localhost:8000/tests/ui-tests.html`

The test pages and manual checklist are primary evidence. Record exact results under `docs/test-results/`.

### Audit output requirements

Run the canonical audit prompt in a separate Codex review session. In addition to the phase-specific checks, require:

- Requirement traceability
- Complete changed-file list
- Automated test commands and results
- Manual tests still required
- Known limitations and environment limits
- Confirmation that no unapproved feature was added
- Exact file-level repairs and retest steps

### Review, commit, push, pull request, merge, and tag

```bash
git status --short
git diff --stat
git diff
git diff --check
git add --all
git commit -m "Phase 10B: final requirements audit"
git push -u origin phase-10b-final-audit
```

In the GitHub web interface, create a pull request from the pushed phase branch to `main`, complete the pull-request evidence, wait for required checks, review the diff, then squash-merge and delete the remote branch. After merge:

```bash
git switch main
git pull --ff-only
git tag -a mvp-v1.0 -m "mvp-v1.0 accepted"
git push origin mvp-v1.0
```

The tag triggers the milestone release workflow. Do not commit a routine ZIP.

### Rollback

Before merge, review the branch diff and preserve any work that may still be needed. Only if the owner explicitly approves discarding all unmerged branch work:

```bash
git switch main
git branch -D phase-10b-final-audit
```

After merge, use a new repair branch and `git revert <merge-commit>`; do not reset or force-push `main`.

## Phase notes

This phase closes the MVP. Future features require a new approved requirements version.

# 9. Cross-Phase Testing Matrix

| Test area | Primary phase | Retest phases |
|---|---|---|
| Static shell and navigation | 1A | 5A, 10A |
| Local Storage and IndexedDB | 1B | 2C, 2D, 9A, 10A |
| Setup wizard | 1C | 3B, 9A, 10A |
| Trusted local HTTPS and Home Screen | 1D | 9A, 10A, 10B |
| Request limits and retries | 2A | 2F, 10B |
| Stooq parsing and validation | 2B | 2C, 2D, 10B |
| Seed installation and migrations | 2C | 9A, 10A |
| Manual historical replacement | 2D | 6A, 7A-7C, 9A, 10B |
| Historical alignment and lookback | 2E | 6A, 7B, 7C |
| Live quotes and metadata | 2F | 3A, 4A, 10A |
| Portfolio calculations | 3A | 6A, 9B, 10B |
| Portfolio UI and corporate actions | 3B | 9A, 10A |
| Benchmark separation and symbol cap | 4A | 5A, 6A, 7A, 10B |
| Charts and mobile gestures | 5A | 8A, 9B, 10A |
| CAGR, alpha, beta, drawdown | 6A | 9B, 10B |
| Worker states and cancellation | 7A | 7B, 7C, 10A |
| GBM | 7B | 8A, 9B, 10A |
| Historical Bootstrap | 7C | 8A, 9B, 10A |
| Projection horizon | 8A | 9B, 10A |
| Full portable backup and restore | 9A | 10A, 10B |
| CSV, PNG, print report | 9B | 10B |
| Offline, accessibility, compatibility | 10A | 10B |

## 9.1 Deterministic fixture policy

- Use synthetic fixtures for committed parser and calculation tests.
- Use the eight private Stooq files for local acceptance testing.
- Keep expected calculation outputs explicit and independently verifiable.
- Never use a live API response as the sole proof of calculation correctness.
- Use `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g` in tests where key behavior is under test.

## 9.2 Browser and device matrix

| Environment | Required use |
|---|---|
| Firefox on macOS Big Sur | Primary development and full functional acceptance |
| Safari on iPhone 13 mini browser mode | Network, import, layout, and compatibility tests |
| Safari Home Screen web-app mode | Final PWA, offline, safe-area, storage, and restore acceptance |
| Firefox on iOS | Secondary compatibility checks where practical |

# 10. GitHub Versioning, Backups, and Release Discipline

## 10.1 Git is the source-history system

- `main` contains accepted code.
- One branch and pull request are used per phase.
- Force pushes and deletion of `main` are blocked.
- Accepted phases receive annotated tags.
- Tags matching `phase-*-accepted` or `mvp-v*` trigger private release ZIP creation.
- Routine ZIP files remain ignored and uncommitted.

## 10.2 Accepted-phase records

Every accepted pull request shall record requirements version, phase, changed files, automated and browser tests, manual device evidence, limitations, audit result, merge commit, tag, and release URL.

## 10.3 Local and repository backups

GitHub source history does not replace browser-data backups. Continue creating and validating configuration and full portable backups. Under Version 2.3, the private repository may retain selected backups, exports, diagnostics, Stooq files, and accepted release packages, including the active Finnhub key.

## 10.4 Independent versions

Track application, Local Storage schema, IndexedDB schema, historical dataset, backup schema, service-worker cache, requirements, roadmap, Git commit, and accepted tag independently. Every version change requires a documented reason and migration or invalidation behavior.

## 10.5 Historical update records

Record source filename, source ticker, canonical symbol, hash, count, first/last dates, adjustment methodology, import mode and time, prior version, row differences, result, and diagnostics reference.

## 10.6 Final release

Before Phase 10B acceptance, create and verify the final source release, configuration backup, full portable backup, test evidence, final requirements audit, `mvp-v1.0` tag, and private GitHub release. The active Finnhub key may appear in these artifacts.

# 11. Mac-to-iPhone Operating Workflow

## 11.1 Initial installation

1. Complete Phase 1D on the target home Wi-Fi.
2. Start the private static HTTPS server on the Mac.
3. Open the stable HTTPS origin in Safari on the iPhone.
4. Confirm certificate trust and no warning.
5. Add the app to the Home Screen.
6. Launch the installed app.
7. Initialize using either the private seed installation or a full portable backup from the Mac.
8. Restore the saved Finnhub key on the iPhone, then edit or reset it if needed.
9. Request persistent storage where supported.
10. Export a new full backup after successful setup.

## 11.2 Routine use

- The Mac and iPhone use separate browser storage.
- Each device makes its own Finnhub and Treasury requests using the restored key or a local edit.
- The Mac does not proxy API calls.
- The installed iPhone app may use cached shell and IndexedDB data when the Mac server is unavailable.
- Live data still requires internet access and a Finnhub-accepted key.

## 11.3 Historical refresh

1. Download fresh complete Stooq files on the Mac.
2. Import through Phase 2D.
3. Review added, changed, removed, and unchanged records.
4. Confirm complete-series replacement.
5. Verify analytics and simulations are invalidated.
6. Run historical and calculation tests.
7. Export a new full portable backup.
8. Transfer through AirDrop or Files.
9. Restore transactionally on the iPhone.
10. Verify counts, hashes, date ranges, holdings, settings, and historical availability.

## 11.4 Offline behavior

When the Mac server is stopped after successful installation:

Available on iPhone:

- Cached application shell
- Saved holdings, lots, benchmarks, and settings
- Local historical charts and analytics
- Monte Carlo from local data
- Cached quote snapshots with stale labels
- Backup export

Unavailable or limited:

- Application updates from the Mac
- Reinstallation after browser data loss
- Uncached static assets
- New Finnhub and Treasury data when internet is unavailable

# 12. Final MVP Acceptance Checklist

## Architecture and scope

- [ ] Client-side PWA only.
- [ ] No backend, public hosting, cloud sync, remote access, or router port forwarding.
- [ ] Private same-home-Wi-Fi use is documented.
- [ ] Code is modular and parameter-driven.

## Data sources

- [ ] Only approved Finnhub live endpoints are used.
- [ ] Finnhub `/stock/candle` is absent.
- [ ] Stooq history is private, split-adjusted, and dividend-unadjusted.
- [ ] Treasury risk-free rate has source, timestamp, cache, and stale warning.

## Historical data

- [ ] Eight private seed symbols install into IndexedDB.
- [ ] Historical records use `[symbol,date]` identity.
- [ ] Manifest, hash, dates, counts, source, and adjustment metadata persist.
- [ ] Unchanged files are skipped.
- [ ] Manual imports validate before storage changes.
- [ ] Complete-series replacement is the default.
- [ ] Append is allowed only after exact overlap validation.
- [ ] Failed imports and restores roll back.
- [ ] Historical Data Service returns exact-date aligned series.
- [ ] 757 closes produce 756 returns.
- [ ] Missing, stale, insufficient, and quality-warning states are explicit.

## Portfolio and benchmarks

- [ ] Holdings and lots add, edit, and delete.
- [ ] Multiple lots and fractional shares work.
- [ ] Cost basis, current values, and weights are correct.
- [ ] Acquisition dates are respected.
- [ ] Corporate actions are manual and audited.
- [ ] Built-in benchmarks can be deleted and re-added.
- [ ] Same-ticker holding and benchmark records remain distinct.
- [ ] 25 active-symbol cap is enforced.

## Analytics and Monte Carlo

- [ ] Outputs are labeled split-adjusted, dividend-unadjusted price-return approximations.
- [ ] CAGR, alpha, beta, and drawdown use aligned observations.
- [ ] Headline drawdown uses the Price-Return Performance Series.
- [ ] GBM and Historical Bootstrap are the only MVP methods.
- [ ] Worker progress, cancellation, seeds, and stale-run handling work.
- [ ] Required percentiles and risk statistics are produced.
- [ ] Global 1-10 year horizon is consistent across outputs.

## Charts and UI

- [ ] Required charts render.
- [ ] Time filters, toggles, zoom/reset, and PNG export work.
- [ ] Light and dark themes persist.
- [ ] Availability and stale states are visible.
- [ ] iPhone 13 mini portrait and landscape work.
- [ ] Safe areas, orientation changes, touch targets, gestures, and tables are usable.
- [ ] Accessibility basics pass.

## Export, backup, and privacy

- [ ] CSV exports work and include methodology and freshness metadata.
- [ ] Browser Print to PDF report works.
- [ ] Configuration backup works.
- [ ] Full portable backup and transactional restore work.
- [ ] Mac-to-iPhone transfer works.
- [ ] API key is included in exports and backups.
- [ ] Backup reminder rules are correct.
- [ ] No user data is uploaded by the application.

## PWA, offline, and compatibility

- [ ] Final origin is stable trusted local HTTPS.
- [ ] Home Screen installation works.
- [ ] Offline relaunch works after a successful visit.
- [ ] Mac-host, internet, Finnhub, stale-cache, and local-history states are distinct.
- [ ] Firefox on macOS Big Sur passes.
- [ ] Safari and Home Screen mode on iPhone 13 mini iOS 26.5 pass.
- [ ] Storage persistence and recovery warnings are present.
- [ ] Performance notes are recorded for required symbol, horizon, and path-count cases.

## Final release

- [ ] No blocking defect remains.
- [ ] Final requirements audit is complete.
- [ ] Final working-folder backup opens independently.
- [ ] Final full portable backup validates and restores.
- [ ] Release recommendation is recorded.

# 13. Prompt Execution Rules

1. Read `MVP-Portfolio-Dash-3A-Validated/requirements.md` Version 2.3 from the active project root before every implementation or audit.
2. Use only the active phase packet and allowed-file list.
3. Keep VS Code on the named phase branch and have Codex inspect the current workspace files rather than relying on stale pasted or attached copies.
4. State the accepted dependency interfaces that must not change.
5. Use the predefined key `d976km1r01qs09n8cp90d976km1r01qs09n8cp9g` where key behavior is relevant.
6. Instruct Codex to edit only authorized workspace files and report its complete changed-file list.
7. Do not request or accept a complete replacement ZIP for routine phase work.
8. Run implementation and audit in separate Codex sessions.
9. Require browser tests, manual tests, and environment limitations to be distinguished from automated passes.
10. Require requirement traceability, changed files, automated results, remaining manual tests, limitations, no-new-features confirmation, and exact repairs in every audit.
11. Apply changes on the named phase branch, inspect diffs, and never copy over `.git`.
12. Do not merge while the browser checklist, required device evidence, audit, or Actions checks are incomplete.
13. Update `CHANGELOG.md`, project status, and test evidence in the same pull request.
14. Tag every accepted merge and verify the milestone release package.
15. Use a new repair branch and `git revert` for post-merge defects; never force-push `main`.
16. When requirements and current code conflict, identify the conflict and implement the approved migration before dependent work.
17. Do not add unapproved features, providers, architecture, hosting, or automatic synchronization.
