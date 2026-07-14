# Portfolio Dashboard Documentation

This directory contains supporting technical documentation for the Version 2.3
project. The project root contains the two authoritative documents:

- [`requirements.md`](requirements.md) defines product behavior and constraints.
- [`roadmap.md`](roadmap.md) defines build order, repository workflow,
  acceptance gates, and remaining work.

Supporting documents are:

- [`CHANGELOG.md`](CHANGELOG.md) records specification and workflow changes.
- [`docs/historical_data_validation_report.md`](docs/historical_data_validation_report.md)
  records seed-dataset validation evidence and known quality flags.
- [`docs/baseline_validation.md`](docs/baseline_validation.md) records the
  accepted Version 2.3 automated baseline evidence through Phase 3A; its earlier
  credential assumptions are superseded by the current requirements.

If supporting documentation conflicts with either authoritative document,
`requirements.md` takes precedence, followed by `roadmap.md`.

## Current implementation status

The repository contains the application shell, persistence and setup modules,
historical-data pipeline, live-data services, portfolio engine, benchmark
manager, and the accepted Phase 5A Chart Manager. Phase 5A is recorded by
squash merge `b30cc30` and tag `phase-5a-accepted`; Phase 6A Analytics Engine
is the next active gate. A user-entered Finnhub key is kept only in page-session
memory and removed from legacy Local Storage state.

## Approved architecture

- Finnhub supplies current quotes, symbol lookup, company metadata, market
  context, and basic metrics through the request queue.
- Finnhub `/stock/candle` is prohibited. Historical prices come only from the
  committed Stooq files and normalized IndexedDB records.
- The U.S. Treasury Fiscal Data API supplies the 13-week bill rate. A manually
  supplied rate is allowed when clearly labeled.
- The application remains client-side and is publicly hosted for the owner's
  personal use through GitHub Pages. Remote shared-URL access, optional cloud
  synchronization, and router port forwarding are in scope; Pages requires no
  router forwarding.
- There is no application backend, brokerage connection, or user-account system.

## Version 2.3 key policy

Version 2.3 ships no Finnhub credential. An owner-entered value is held only in
memory for the current page session, sent in the approved authentication header,
and excluded from Local Storage, IndexedDB, source, documentation, tests, logs,
diagnostics, request URLs, exports, backups, workflows, and releases. GitHub
tokens, SSH private keys, and private certificate keys are also excluded.

## Stable integration contracts

### Historical data

The bundled seed contains AVDV, AVUV, DCO, IWM, ONEQ, PSCH, SPY, and VTV.
`data/historical/manifest.json` is the machine-readable authority for seed file
names, hashes, counts, dates, and adjustment metadata. Do not change a seed file
without regenerating the manifest.

Normalized candles use the compound `[symbol, date]` IndexedDB key. Seed
installation and manual replacement are transactional per symbol: a failed
write must leave the previous complete series intact. Manual import defaults to
full-series replacement; append is allowed only when overlapping records match
exactly.

Consumers obtain history through `HistoricalDataService`, principally
`getAlignedSeries(symbols, options)`. Portfolio and analytics modules must not
read raw Stooq files or IndexedDB directly.

### Live data

`FinnhubClient` requires the existing request queue; there is no direct-fetch
fallback. Holding quotes receive higher priority than benchmark quotes, and the
25-active-symbol limit applies across both groups.

Live-data cache failures are normalized and must not invalidate a successful
provider response. Provider failures may return clearly labeled stale cache
data. Company profiles, peers, and basic metrics have a seven-calendar-day
default TTL; peers are fetched only on demand.

### Portfolio engine

Phase 3A models holdings with multiple acquisition lots, fractional shares,
cost basis, current value, unrealized gain/loss, weights, and fixed-share
historical performance. A missing quote produces a partial valuation; a stale
cached quote remains usable but must be labeled stale. Historical output is a
split-adjusted, dividend-unadjusted price-return approximation, and corporate
actions are not auto-applied to user lots.

The engine depends on `HistoricalDataService.getAlignedSeries()` and accepts
raw numeric quotes, Finnhub quote snapshots, or normalized live-data results.
It does not own persistence, UI rendering, benchmarks, charts, analytics, or
Monte Carlo behavior.

### Symbol registry and benchmarks

`SymbolRegistry` is an immutable view over the saved `holdings` and
`benchmarks` collections. The following read methods are the stable Phase 4A
contract for Phase 5A and later consumers:

- `records()` returns new, top-level-frozen record snapshots, with holdings
  followed by benchmarks. Consumers must identify a record by both
  `recordType` (`holding` or `benchmark`) and `id`; ticker alone is not a record
  identity because a holding and benchmark may share it.
- `activeSymbols()` returns canonical, de-duplicated, sorted ticker strings for
  active records. A same-ticker holding and benchmark consume one provider
  symbol slot. `activeCount()` is the length of this unique set.
- `find(recordType, id)` returns the matching record snapshot or `null`.
- `filter(query, activity)` returns record snapshots matching a
  case-insensitive ticker, label, or record-type query and an `all`, `active`,
  or `inactive` activity filter.
- `canActivate(recordType, id)` returns `{ allowed, reason, activeCount }`
  without changing state. Its stable reasons are `not-found`,
  `already-counted`, `capacity-available`, and `active-symbol-limit`.

Registry mutation methods return a new `SymbolRegistry`; they do not mutate the
input state and do not publish browser events. After a successful mutation,
the owner calls `toState(previousState, options)` once and persists that state.
`toState()` increments `registryRevision`, recomputes `activeSymbols`, and marks
charts, analytics, and simulations stale with reason
`symbol-registry-changed`.

`BenchmarkEngine.activeBenchmarks(state)`, `chartBenchmarks(state)`, and
`projectionTableBenchmarks(state)` are the stable benchmark selectors. They
return normalized benchmark records and apply active, chart-inclusion, and
projection-table-inclusion flags respectively. They perform no data fetches.

After `BenchmarkManager` successfully persists a registry edit, it dispatches
the exported `SYMBOL_REGISTRY_CHANGED_EVENT` (`mvp:symbol-registry-changed`) as
a `CustomEvent` on `window`. The notification payload is:

```js
{
  registryRevision: Number,
  dependentDataState: {
    charts: "stale",
    analytics: "stale",
    simulations: "stale",
    staleReason: "symbol-registry-changed",
    registryRevision: Number,
    invalidatedAt: String
  }
}
```

The event is a post-save invalidation notification, not a state snapshot.
Consumers reload saved settings and use the getters above. Canceled or failed
edits, search/filter changes, and history-status reads do not publish it.
Holding and lot saves separately publish `mvp:portfolio-changed`; chart
consumers that depend on both portfolio composition and benchmark selection
must subscribe to both events.

### Chart Manager

`ChartManager` owns ECharts instance lifecycle, state presentation, time-filter
selection, explicit series toggles, zoom reset, PNG export, bounded responsive
resize, orientation updates, theme recreation, and touch-gesture isolation. It
accepts only upstream-prepared series and performs no portfolio or analytics
calculations. Stooq-derived inputs display the required split-adjusted,
dividend-unadjusted price-return approximation label.

The application mounts comparison, account-value, allocation, drawdown,
confidence-fan, and percentile-band containers. Later modules publish prepared
data with `mvp:chart-data-ready` and a `{ type, prepared }` detail payload.

## Development workflow

Version 2.3 uses VS Code with the Codex extension connected to ChatGPT Plus,
VS Code Source Control and its integrated terminal, and Git over the configured
SSH remote. Pull requests, checks, squash merges, rulesets, and releases are
managed in GitHub's web interface; GitHub CLI is not required.

`main` contains accepted work. From Phase 3B onward, use the branch, pull
request, checks, commit, and accepted-phase tag specified by the applicable
roadmap execution packet. Browser acceptance remains primary; automated Node
and GitHub Actions checks are supplemental.

The roadmap describes planned pull-request templates, quality-gate workflows,
and release workflows. Those artifacts are not present in this repository
snapshot and should not be documented as installed until their roadmap phase
adds them.

## Local verification

Serve the project root over HTTP or HTTPS; do not open test pages directly from
the filesystem:

```text
python3 -m http.server 8000
```

Run the browser suites applicable to the changed area:

- `tests/storage-tests.html`
- `tests/setup-wizard-tests.html`
- `tests/historical-data-tests.html`
- `tests/data-service-tests.html`
- `tests/calculation-tests.html`
- `tests/index.html` for the test index

The currently available supplemental Node suite is:

```text
node tests/phase-2f-node-tests.mjs
```

Generated delivery manifests, copied source snapshots, prompts, package
checksums, and one-time test transcripts are not maintained as documentation.
Git history preserves accepted changes, while the live source and tests remain
the implementation-verification authority.
