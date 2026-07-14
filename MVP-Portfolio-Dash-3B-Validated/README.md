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
  accepted Version 2.3 automated baseline evidence through Phase 3A.

If supporting documentation conflicts with either authoritative document,
`requirements.md` takes precedence, followed by `roadmap.md`.

## Current implementation status

The repository contains the application shell, persistence and setup modules,
historical-data pipeline, live-data services, and Phase 3A portfolio engine.
Phase 3A is the accepted baseline described by the roadmap.

The Version 2.3 predefined/editable Finnhub-key migration is implemented in
this baseline: the key is centralized, plaintext and editable in setup,
resettable, persisted, used by Finnhub clients by default, and available to
diagnostics and future backup/export consumers. Phase 3B is the next roadmap
phase; its UI files and tests are not present in this baseline.

## Approved architecture

- Finnhub supplies current quotes, symbol lookup, company metadata, market
  context, and basic metrics through the request queue.
- Finnhub `/stock/candle` is prohibited. Historical prices come only from the
  committed private Stooq files and normalized IndexedDB records.
- The U.S. Treasury Fiscal Data API supplies the 13-week bill rate. A manually
  supplied rate is allowed when clearly labeled.
- The application remains client-side and privately hosted on the owner's Mac
  for same-home-Wi-Fi use. GitHub is source control and release
  history, not the application runtime host or application-data sync service.
- There is no application backend, public runtime hosting, router forwarding,
  brokerage connection, or automatic cloud synchronization.

## Version 2.3 key policy

Version 2.3 defines a project-provided Finnhub key that is visible, editable,
resettable, locally persisted, and included in applicable diagnostics, exports,
and backups. The exact default and the authorized handling rules are maintained
in Sections 6 and 7 of `requirements.md`; they should not be duplicated across
supporting documents.

This owner-approved policy permits that Finnhub key in the private repository.
It does not permit GitHub tokens, SSH private keys, local HTTPS private keys, or
other infrastructure credentials to be committed. Keep repository access
private as required by Version 2.3.

## Stable integration contracts

### Historical data

The private seed contains AVDV, AVUV, DCO, IWM, ONEQ, PSCH, SPY, and VTV.
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
