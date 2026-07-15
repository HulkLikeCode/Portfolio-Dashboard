# Version 2.3 Baseline Validation

**Validated:** 2026-07-13

**Scope:** Historical evidence through Phase 3A; credential and hosting policy is superseded by the 2026-07-14 requirements revision

**Result:** Pass for the local automated baseline; later-phase and physical-iPhone acceptance remain outside this gate

## Environment

- VS Code 1.106.3 (`bf9252a2fb45be6893dd8870c0bf37e2e1766d61`)
- Codex extension connected to ChatGPT Plus
- Darwin x64 20.6.0 (macOS Big Sur)
- Firefox 152.0.5, headless local-server run
- Python 3.12.10 local HTTP server
- JavaScriptCore module shell for focused non-DOM checks
- Git remote: `git@github.com:KCs-IRA-Dash-Monte-Carlo/Portfolio-Dashboard.git`

## Automated evidence

The browser harnesses were served from `http://127.0.0.1:8000/` and exercised in Firefox:

| Harness | Result |
|---|---:|
| Static shell and browser capabilities | Pass |
| Local Storage and IndexedDB | 6/6 pass |
| Setup wizard and Version 2.3 key behavior | 11/11 pass |
| Phase 2F live-data services | 11/11 pass |
| Historical parser/import/service | 38/38 pass |
| Phase 3A portfolio calculations | 24/24 pass |

Focused JavaScriptCore checks also passed for:

- legacy key migration and storage scrubbing;
- backup and diagnostics credential exclusion;
- Local Storage JSON sanitization;
- runtime Finnhub client key provider; and
- exact default portfolio cost basis of `214442.69986`.

Additional repository checks passed:

- both JSON manifests parse;
- all eight historical seed files match manifest SHA-256, byte length, and record count;
- aggregate historical record count is 34,122;
- production JavaScript contains no Finnhub `/stock/candle` dependency;
- no owner credential was required for the deterministic suite; and
- `git diff --check` reports no whitespace errors.

## Gate boundary

This validates the implementation baseline through Phase 3A. It does not claim acceptance for Phase 3B or later features, physical iPhone/Home Screen behavior, remote HTTPS access, live-provider availability, or Node-only execution. Those checks remain assigned to their roadmap phases.
