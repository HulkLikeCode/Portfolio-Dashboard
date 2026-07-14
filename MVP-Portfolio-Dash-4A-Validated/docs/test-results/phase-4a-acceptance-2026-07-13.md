# Phase 4A Acceptance Test Record

## Snapshot

- Phase: 4A - Benchmark and Active-Symbol Management
- Test date: 2026-07-13
- Release-review rerun: 2026-07-14
- Source branch: `phase-4a`, based on `main` at `7cddf61`
- Phase-labeled working-folder copy: `MVP-Portfolio-Dash-4A-Validated`

## Browser and device

- Browser: Mozilla Firefox 152.0.5
- Device environment: owner's MacBook, x86_64
- Operating system: macOS Big Sur 11.7.11 (build 20G1443)
- Automated-test origin: local HTTP on `127.0.0.1`, using isolated temporary Firefox profiles
- Physical mobile target: no separate iPhone 13 mini evidence was supplied for this Phase 4A record

## Manual acceptance

The owner reported the Phase 4A manual acceptance checklist in `tests/PHASE-4A-MANUAL-TESTS.md` passed on 2026-07-13.

| Checklist | Result | Notes |
|---|---:|---|
| Phase 4A benchmark and active-symbol manual tests | 10/10 passed | Owner-confirmed result covering benchmark CRUD and persistence, holding/benchmark separation, the shared 25-symbol cap, search/filtering, stale-state invalidation, quote-only history status, and unavailable-Finnhub behavior. |

## Automated browser results recorded in this session

| Harness | Result | Notes |
|---|---:|---|
| Phase 3A and 4A calculation tests | 31/31 passed | Structured result submitted by the browser harness. |
| Phase 3B and 4A UI tests | 25/25 passed | Structured result submitted by the browser harness; includes the shared active-symbol cap warning. |
| Setup wizard and API-key security tests | 18/18 passed | Fresh headless Firefox run; includes session-only overrides, legacy clear-text scrubbing, Local Storage exclusion, masked input, and diagnostic redaction. |
| Phase 2F live-data service tests | 11/11 passed | Fresh autorun result read from the completed browser DOM; Finnhub and Treasury responses were stubbed. |
| Phase 2B-2D historical-data tests | 38/38 passed | Fresh headless Firefox run; deterministic synthetic fixtures only. |

No production Finnhub or Treasury request was made by these automated harnesses.

## Known limitations

- The manual result is recorded from the owner's pass report; this Codex session did not repeat the live-provider and offline-interaction portions of the checklist.
- Headless Firefox does not replace interactive keyboard, focus-restoration, screen-reader, touch-target, orientation, or on-screen-keyboard testing.
- A physical iPhone 13 mini/iOS 26.5 run was not recorded for this phase.
- The deterministic re-add test restores a just-deleted stored benchmark without a new provider request. Fresh, previously unknown benchmark symbols are validated through the Symbol Service; no live provider validation was independently exercised in this session.
- Supplemental Node suites, including `security-storage-tests.mjs`, were not run because a `node` executable is not installed in this environment. The corresponding browser security checks passed as recorded above.
