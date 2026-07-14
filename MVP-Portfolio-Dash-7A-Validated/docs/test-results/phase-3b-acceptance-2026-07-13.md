# Phase 3B Acceptance Test Record

## Snapshot

- Phase: 3B - Portfolio UI and Corporate-Action Workflow
- Test date: 2026-07-13
- Source branch and commit: `main` at `854bc16` (`3B`)
- Phase-labeled working-folder copy: `MVP-Portfolio-Dash-3B-Validated`

## Browser and device

- Browser: Mozilla Firefox 152.0.5, headless mode with isolated temporary profiles
- Device environment: Mac, x86_64
- Operating system: macOS Big Sur 11.7.11 (build 20G1443)
- Origin: local HTTP server at `http://127.0.0.1:8765/`
- Physical mobile target: iPhone 13 mini on iOS 26.5 was not available during this verification session

## Results recorded in this session

| Harness | Result | Notes |
|---|---:|---|
| Phase 3B portfolio UI and corporate-action workflow | 16/16 passed | Verified CRUD actions, explicit-save behavior, engine validation, manual adjustment notice and preview, required audit note, delete confirmations, and stale-state invalidation. |
| Phase 3A portfolio calculations | 24/24 passed | Deterministic browser harness. |
| Phase 2B-2D historical data | 38/38 passed | Deterministic browser harness using synthetic fixtures. |
| Phase 2F live data services | 11/11 passed | Stubbed Finnhub and Treasury responses; no production API call was made. |
| Setup wizard and Version 2.3 API-key defaults | 11/11 passed | Local browser checks; no Finnhub API call was made. |

The browser pages are the primary automated evidence. The Phase 3B UI harness was also visually inspected after completion and showed no failed checks.

## Known limitations and remaining manual evidence

- Headless Firefox does not replace interactive keyboard, focus-restoration, screen-reader, touch-target, orientation, or on-screen-keyboard testing.
- The physical iPhone 13 mini portrait/landscape and VoiceOver checklist in `docs/PHASE-3B-MANUAL-TESTS.md` was not run in this session.
- The full interactive CRUD persistence/reload checklist in `docs/PHASE-3B-MANUAL-TESTS.md` was not repeated in this session.
- The storage harness began successfully, but the headless screenshot was captured before its asynchronous suite completed; no complete storage result is claimed here.
- Supplemental Node tests were not run because a `node` executable is not installed in this environment.
- Live Finnhub availability, credentials, rate limits, and real provider responses were outside this deterministic verification.

These limitations should remain visible until the corresponding manual/device evidence is recorded. No unverified item above is represented as passing.
