# Phase 10A hardening notes — 2026-07-15

## Implementation evidence

- Apache ECharts 6.0.0 is vendored at `vendor/echarts/echarts.js`; `index.html` loads that local file and has no runtime CDN script.
- `service-worker.js` uses the explicit cache name `portfolio-dash-static-v0.2.3-phase-10a-1`. It precaches only the static application shell, icons, ECharts, source modules, and bundled Stooq seed resources. It does not cache responses fetched at runtime.
- Cache installation is atomic through `cache.addAll`. A waiting update is not activated automatically; the page reports that a reload is required. On activation, only older caches bearing the application prefix are removed.
- The offline navigation fallback is `index.html`. Local settings, historical IndexedDB data, and quote-cache data are intentionally outside Cache Storage. Their availability is browser-profile dependent and must be checked on the real Pages origin.
- No credential is embedded in the static asset manifest. The only Finnhub configuration module declares an empty runtime default, and the service worker never caches cross-origin or mutable responses.
- Diagnostics now surface StorageManager estimate and persistence state; the Settings panel exposes a persistence request and warns when unsupported or denied.
- Existing visible focus, semantic landmarks, live-status regions, native dialogs, and escaped user-text rendering were reviewed. The custom setup modal now traps Tab focus and restores focus on close. Chart colors retain labels and series identity instead of using color alone; forced-colors mode keeps focus and controls visible.

## Automated results

| Check | Result |
| --- | --- |
| `node --check` for changed JavaScript and service worker | Passed |
| Static cache asset existence check | Passed: 96 assets, 0 missing |
| `node tests/security-storage-tests.mjs` | Passed |
| `node tests/phase-2f-node-tests.mjs` | Passed: 19/19 |
| `node tests/phase-3b-node-tests.mjs` | Passed |
| `git diff --check` | Passed |
| Public Pages HTTPS HEAD request | Passed: HTTP 200 on `https://hulklikecode.github.io/Portfolio-Dashboard/` |

## Manual acceptance still required

Automated checks cannot validate Firefox/macOS Big Sur, the Pages service-worker scope, iPhone browser/Home Screen behavior, real IndexedDB retention, touch, or performance. Run and record the following on the stated targets before marking Phase 10A accepted:

1. In Firefox on macOS Big Sur, visit the Pages URL once, reload until the service worker controls it, disable network, then relaunch. Verify the shell, saved portfolio, IndexedDB history, and cached quotes render; verify the offline/stale labels and that live Finnhub refresh is unavailable.
2. With network otherwise working, block only the Pages host and relaunch the installed app. Verify the message differs from full internet loss and says that updates/uncached assets are unavailable. Trigger a Finnhub provider failure separately and verify its state differs from host failure.
3. Inspect DevTools Cache Storage: it should contain only the named static cache and its listed immutable assets, never exports, imported files, IndexedDB records, quote payloads, request URLs with credentials, or a key.
4. Request persistent storage. Record usage/quota and granted/denied result. Repeat after a quota-pressure scenario if practical; retain a backup when persistence is unavailable.
5. Bump the cache version in a test branch, deploy, observe the waiting-update message, reload to activate, and confirm the old prefixed cache is removed without deleting Local Storage or IndexedDB.
6. Keyboard-only and screen-reader spot checks: skip link, navigation order, panel tabs, all form labels/errors, dialog Tab/Shift+Tab loop, Escape/close, focus restoration, status announcements, and chart summaries/exports.
7. Enable Firefox high-contrast/forced-colors settings and verify focus, warnings, and chart series remain distinguishable by labels or line styles, not color alone.
8. On Mozilla Firefox and Home Screen modes on iPhone 13 mini (iOS 26.5), test portrait/landscape, safe-area insets, rotation, chart/touch gestures, horizontal table scroll, Files import, full-backup restore, and offline relaunch after a successful Pages visit.
9. On that iPhone, record progress, cancellation, results, and elapsed time for 1-, 5-, and 10-year horizons at 1,000, 2,500, and 5,000 paths. On the Mac, benchmark approximately 8, 13, and 25 active symbols without lowering paths or changing calculation inputs.
10. In a clean test profile, clear browser data and follow the recovery section of the README: online reinstall, credential-free restore, then separate runtime-key entry/edit/clear. Confirm no backup, output, diagnostic, URL, or cache contains the key.

## Limitations and scope

- This implementation adds no backend, cloud synchronization, router forwarding, or product feature. GitHub Pages was externally reachable at the time of the HTTP check, but real-browser Pages and device behavior must still be recorded manually.
- The current implementation can describe offline/local-cache capability, but cannot prove that a particular browser profile still contains historical or quote records until it is tested on that profile.
