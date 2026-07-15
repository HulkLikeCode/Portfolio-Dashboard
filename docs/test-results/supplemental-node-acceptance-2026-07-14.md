# Supplemental Node Test Record

## Snapshot

- Test date: 2026-07-14
- Project copy: `MVP-Portfolio-Dash-4A-Validated`
- Host: macOS Big Sur 11.7.11, x86_64
- Runtime: Node.js v22.23.1, `darwin x64`
- Shell executable: `/usr/local/bin/node`
- npm: 10.9.8

The official `node-v22.23.1-darwin-x64.tar.gz` archive was verified before
installation. Its SHA-256 matched the Node.js-published value:

```text
b8da981b8a0b1241b70249204916da76c63573ddf5814dbd2d1e41069105cb81
```

## Results

| Suite | Result | Notes |
|---|---:|---|
| `tests/phase-2f-node-tests.mjs` | 19/19 passed | Deterministic service, cache, queue, endpoint, Treasury, and credential-redaction checks. |
| `tests/phase-3b-node-tests.mjs` | Passed | CRUD, validation, identity, active-only and all-holdings cost basis, and engine summary checks. |
| `tests/phase-3b-state-adapter-tests.mjs` | Passed | Settings round trip, audit note, revision, and stale-state checks. |
| `tests/security-storage-tests.mjs` | Passed | Runtime-only API keys and legacy-storage scrubbing. |

The commands completed successfully in one fail-fast run:

```text
node tests/phase-2f-node-tests.mjs
node tests/phase-3b-node-tests.mjs
node tests/phase-3b-state-adapter-tests.mjs
node tests/security-storage-tests.mjs
```

No production Finnhub or Treasury request was made by these suites.

## Test repair discovered during execution

The first direct execution of `tests/phase-3b-node-tests.mjs` exposed a stale
expected value. The test deactivated the `AAA` holding and then expected the
default portfolio cost basis to include that inactive holding. The Phase 3A
engine intentionally selects active holdings by default.

The assertion was corrected to expect the active-only cost basis of `30`, and
an explicit `activeOnly: false` assertion was added for the all-holdings cost
basis of `53`. The complete supplemental set passed after this test-only
correction; no production calculation behavior changed.

## Known limitation

The roadmap names `tests/phase-3b-integrated-tests.mjs`, but that file is not
present in this project copy. It is recorded as absent, not as executed or
passing.

This record supplements rather than replaces the Phase 3B and Phase 4A browser
acceptance records dated 2026-07-13. Those historical records remain unchanged,
including their accurate statement that a shell-accessible Node executable was
unavailable during the original sessions.
