# Phase 5A Acceptance and Snapshot Record

## Snapshot

- Phase: 5A - Chart Manager
- Test date: 2026-07-14
- Acceptance date: 2026-07-14
- Source branch: `phase-5a`
- Squash merge on `main`: `b30cc30`
- Accepted tag: `phase-5a-accepted`
- Source working folder: `MVP-Portfolio-Dash-4A-Validated`
- Phase-labeled working-folder copy: `MVP-Portfolio-Dash-5A-Validated`
- Snapshot basis: created in response to the owner's post-acceptance backup instruction and retained locally outside Git tracking

## Browser and device

- Browser: Mozilla Firefox 152.0.6, headless isolated profiles
- Device: MacBook8,1 (Intel Core M, 8 GB memory)
- Operating system: macOS Big Sur 11.7.11 (build 20G1443), x86_64
- Test origin: local HTTP on `127.0.0.1:8021`
- Physical mobile target: no iPhone 13 mini or Home Screen evidence was produced in this verification session

## Results

| Check | Result | Notes |
|---|---:|---|
| Phase 3B, 4A, and 5A browser UI harness | 48/48 passed | Fresh Firefox run. Covers deterministic prepared chart fixtures, required chart types and future containers, all seven time filters, series controls, zoom reset, PNG blob creation, lifecycle cleanup, bounded resize calls, theme recreation, methodology labels, gesture isolation, and explicit availability states. |
| Phase 3A and 4A calculation harness | 31/31 passed | Fresh Firefox regression run for the portfolio and benchmark dependencies consumed by charts. |
| Phase 2F Node suite | 19/19 passed | Deterministic request, endpoint, cache, fallback, and credential-redaction checks. |
| Phase 3B Node suite | Passed | CRUD, validation, identity, and engine-summary regressions. |
| Phase 3B state-adapter Node suite | Passed | Settings round trip, audit note, revision, and stale-state regressions. |
| Security-storage Node suite | Passed | Runtime-only key and legacy-storage scrubbing regressions. |
| `git diff --check` | Passed | No whitespace errors were reported. |

No production Finnhub or Treasury request was made by these tests. The browser
UI harness uses deterministic prepared data and a fake ECharts lifecycle
adapter, so it does not claim live-provider or production-CDN validation.

## Accepted limitations and remaining final-device checks

- Phase 5A was accepted for the Phase 6A dependency gate. Physical iPhone 13 mini and Home Screen validation remains deferred to the Phase 1D/10A final device gates. Portrait and landscape layout, safe-area insets, orientation changes, touch gestures, swipeable-tab interaction, and on-screen-keyboard behavior were not exercised on the target device in this session.
- Headless Firefox does not replace interactive desktop checks for repeated window resizing, keyboard/focus behavior, screen readers, or visual inspection under light and dark themes.
- PNG export was verified as a safe filename and an `image/png` blob through the deterministic adapter. Exported image dimensions and legibility were not visually inspected with a real ECharts instance.
- The test harness checked bounded resize calls and safe chart recreation, but it did not render the development CDN build of Apache ECharts 6.0.0 or validate offline behavior. ECharts remains scheduled for vendoring in Phase 10A.
- Live Finnhub symbol validation, live Treasury data, GitHub Pages, offline relaunch, and service-worker update behavior were outside this Phase 5A verification.
