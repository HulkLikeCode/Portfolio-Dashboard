# Phase 6A Local Validation Record

## Scope

- Phase: 6A - Analytics Engine
- Validation date: 2026-07-14
- Source branch: `phase-6a`
- Squash merge on `main`: `a557803`
- Accepted tag: `phase-6a-accepted`
- Accepted baseline: Phase 5A squash merge `b30cc30`, tag `phase-5a-accepted`
- Tracked source working folder: `MVP-Portfolio-Dash-4A-Validated`
- Local repaired snapshot used for reconciliation: `MVP-Portfolio-Dash-5A-Validated`
- Acceptance state: accepted after GitHub pull-request review, squash merge,
  and accepted tag.

## Implementation boundary

Changed implementation and test files:

- `js/analytics/return-series.js`
- `js/analytics/date-alignment.js`
- `js/analytics/cagr.js`
- `js/analytics/alpha-beta.js`
- `js/analytics/drawdown.js`
- `js/analytics/analytics-engine.js`
- `tests/calculation-tests.html`

The engine reads historical observations only from the injected Historical Data
Service. It labels results as split-adjusted, dividend-unadjusted price-return
approximations and does not claim exact total return or dividend reinvestment.
It uses fixed-share, acquisition-date segmented, contribution-neutral portfolio
performance with floating market-value weights and no daily rebalancing.

## Automated results

| Check | Result | Evidence |
|---|---:|---|
| Calculation browser suite | 51/51 passed | Isolated headless Firefox on local HTTP `127.0.0.1:8124` |
| Data-service browser suite | 11/11 passed | Isolated headless Firefox on local HTTP `127.0.0.1:8124` |
| Historical-data browser suite | 38/38 passed | Isolated headless Firefox on local HTTP `127.0.0.1:8124` |
| Phase 2F Node suite | 19/19 passed | Request, endpoint, cache, Treasury, and credential-redaction regressions |
| Phase 3B Node suite | Passed | CRUD, validation, identity, and engine-summary regressions |
| Phase 3B state-adapter suite | Passed | Settings, audit note, revision, and stale-state regressions |
| Security-storage suite | Passed | Runtime-only key and legacy-storage scrubbing |
| Analytics syntax and imports | Passed | All six analytics modules parsed and imported |
| Scope checks | Passed | No direct analytics historical fetch or forbidden candle route; no trailing whitespace |

The calculation fixtures independently cover valid arithmetic and log returns,
normalized performance, exact-date and exact-return-interval alignment,
anniversary-based partial-year CAGR, alpha/beta periodicity, approved
risk-free-rate provenance, drawdown provenance, contributions, acquisition
segments, configured benchmarks, and invalid or insufficient inputs.

## Manual and target-device evidence still required

- Perform an interactive desktop Firefox review of the calculation fixtures and
  result metadata before final acceptance.
- Inspect visible methodology and availability presentation when the analytics
  result contracts are connected to production UI; Phase 6A did not add that UI
  integration.
- Physical iPhone, Home Screen, GitHub Pages, service-worker, offline, and
  normal-origin validation remain deferred to the Phase 1D/10A final-device
  gates, consistent with the accepted Phase 5A limitation.

## Known limitations and no-new-features confirmation

- Results are price-return approximations; dividends are not included or
  reinvested.
- Alpha requires a configured active benchmark and approved risk-free-rate
  source. Mismatched return intervals are unavailable rather than bridged.
- No Monte Carlo, portfolio UI integration, production data request, backend,
  credential storage, or replacement project ZIP was introduced.
