# Retirement Portfolio Dashboard
## Personal-Use GitHub-Hosted Multi-Source MVP Requirements Specification

**Version:** 2.3

**Status:** Approved GitHub hosting, Firefox mobile, credential-exclusion, and Phase 5A revision

**Primary Constraint:** Finnhub free-tier live data plus bundled Stooq history
**Target Build Type:** Personal-use client-side PWA publicly hosted with GitHub Pages; edited in VS Code with Codex and source controlled in a public GitHub repository

---

## Document Control and Version 2.3 Change History

| Item | Decision |
|---|---|
| Requirements version | 2.3 |
| Effective date | 2026-07-12 |
| Working-environment revision | 2026-07-14 |
| Supersedes | Version 2.2 in full |
| Source repository | Public GitHub repository on `github.com` |
| Organization display name | `KCs IRA Dash - Monte Carlo` |
| Organization login | `KCs-IRA-Dash-Monte-Carlo` |
| Repository name | `Portfolio-Dashboard` |
| SSH remote | `git@github.com:KCs-IRA-Dash-Monte-Carlo/Portfolio-Dashboard.git` |
| Code editor | Visual Studio Code 1.106.3 (`bf9252a2fb45be6893dd8870c0bf37e2e1766d61`) |
| AI coding workflow | Codex extension connected to the owner's ChatGPT Plus subscription |
| Integrated editor runtime | Electron 37.7.0; Chromium 138.0.7204.251; Node.js 22.20.0; V8 13.8.258.32-electron.0 |
| Development OS | Darwin x64 20.6.0 |
| VS Code workspace and Git root | `/Users/nicholasoconnell/Desktop/Portfolio-Dashboard` |
| Active project root | `/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/MVP-Portfolio-Dash-4A-Validated` |
| GitHub authentication | Git over SSH using the configured `git@github.com` remote |
| Current accepted code baseline | Phase 4A |
| Current active work | Phase 5A Chart Manager |

Version 2.3 preserves the parameter-driven product and approved data sources while revising deployment, mobile-browser, export, and credential policy:

1. The public GitHub repository is the authoritative source-control and release-history system and GitHub Pages is the MVP runtime host.
2. No Finnhub key is bundled. A user-entered key must not appear in source, documentation, tests, logs, diagnostics, request URLs, exports, backups, or release artifacts.
3. The owner may enter or replace a runtime-only Finnhub key without rebuilding the application.
4. Public hosting, shared GitHub Pages URLs, remote internet access, optional cloud synchronization, and router port forwarding are within deployment scope, although GitHub Pages requires no router forwarding.
5. Accepted milestones are tagged and may publish repository releases without replacement project ZIPs during phase implementation.
6. Browser-based test pages remain the primary acceptance tests; Node and GitHub Actions checks supplement but do not replace them.

The application remains for the owner's personal use. Public availability of the hosted URL does not create multi-user accounts, brokerage access, or permission to expose a Finnhub credential.

## 1. Project Objective

Build a personal-use, GitHub-hosted, client-side retirement portfolio dashboard using:

- Finnhub free-tier U.S. stock and ETF endpoints for current quote snapshots and market context
- Bundled Stooq daily historical files for split-adjusted, dividend-unadjusted OHLCV history
- An approved public no-key source for the risk-free rate

The application shall provide:

- Portfolio holdings and multi-lot tracking
- Quote snapshots
- OHLCV-based historical charts
- Split-adjusted, dividend-unadjusted price-return approximation analytics
- Benchmark comparisons
- Lightweight projection tools
- GBM and Historical Bootstrap Monte Carlo projections
- Local persistence
- Offline-capable PWA shell
- Full portable backup and restore between the Mac and iPhone

The application must function without an application backend and without premium Finnhub datasets.

The application must be parameter-driven and reusable. It must not be hardcoded around the initial portfolio.

The application is for the owner’s personal use only. However, public hosting via GitHub Pages, public distribution through shared URLs, remote internet access, cloud synchronization, and router port forwarding are included in scope.

## 2. Approved Data Sources and Operating Constraints

The MVP shall use only the following approved sources:

- Finnhub free-tier stock endpoints for current quote snapshots, symbol lookup, company metadata, market status, market holidays, peers where retained, and basic metrics
- Private Stooq text files for daily U.S. stock and ETF historical OHLCV
- The U.S. Treasury Fiscal Data API, or another explicitly approved public no-key source, for the risk-free rate

### 2.1 Permitted Finnhub endpoints

Permitted Finnhub endpoints for MVP:

- `/quote`
- `/search`
- `/stock/symbol`
- `/stock/profile2`
- `/stock/peers`
- `/stock/market-status`
- `/stock/market-holiday`
- `/stock/metric`

Finnhub `/stock/candle` is not an MVP dependency and must not be required for historical analytics.

### 2.2 Approved historical-data source

Private Stooq files shall provide:

- Daily frequency only
- U.S. stock and ETF OHLCV
- Split-adjusted prices
- Dividend-unadjusted returns
- One complete historical series per imported symbol

The initial private dataset contains:

- DCO
- VTV
- ONEQ
- SPY
- IWM
- AVUV
- AVDV
- PSCH

The initial eight-symbol dataset has been validated as sufficient for the planned 756-observation daily Monte Carlo lookback.

Occasional updates shall use manual full-series replacement imports in the same Stooq text format.

### 2.3 Excluded Finnhub and market-data capabilities

The MVP must not require:

- Premium Finnhub data
- Finnhub historical candles
- Dividend history
- Standardized financial statements
- SEC filings
- Ownership data
- Company executives
- Full tick history
- Full tick data
- Deep international coverage
- Non-U.S. market data unless explicitly approved


### 2.4 Finnhub free-tier operating limits

The application must be designed around these limits:

- 60 API calls per minute
- 30 API calls per second
- MVP active-symbol cap of 25 total active symbols

Historical file parsing and IndexedDB reads do not consume Finnhub request budget.

## 3. Target Platforms and Compatibility

### 3.1 Primary desktop platform

Primary desktop target:

- Mozilla Firefox desktop
- macOS Big Sur 11.7.11
- MacBook Retina, 1.2 GHz Dual-Core Intel, 8 GB memory

### 3.2 Primary mobile platform

Primary mobile target:

- Mozilla Firefox on iPhone 13 mini
- iOS 26.5
- Device model: NLAD3LL/A
- Access through Mozilla Firefox to the GitHub-hosted URL over an internet connection

Safari on iOS may be tested as a secondary browser, but Mozilla Firefox and Home Screen web-app mode opened from the GitHub-hosted URL are the primary iPhone targets.

### 3.3 iOS constraints

Testing must cover:

- GitHub Pages HTTPS access
- Home Screen installation
- Local Storage and IndexedDB persistence
- Service-worker behavior
- Offline launch after successful installation
- File import from the iOS Files picker
- Full backup restore
- Portrait and landscape layouts
- Touch gestures
- GitHub Pages unavailable after the application has been cached

### 3.4 JavaScript compatibility

Use:

- HTML
- CSS
- Plain JavaScript
- ES2020-compatible syntax
- Apache ECharts

Avoid dependencies on newer browser features that would break the primary desktop target. Feature-detect optional APIs.

### 3.5 Responsive behavior

Support:

- Desktop layout
- Tablet layout
- iPhone 13 mini portrait layout
- iPhone 13 mini landscape layout
- Touch interaction
- Horizontally swipeable mobile panels only where gesture conflicts are controlled
- Safe-area insets in Home Screen web-app mode

## 4. Technology and Deployment Constraints

The MVP must be:

- Client-side only
- PWA-capable
- No application backend
- No brokerage connection
- No user account system
- No required build system unless later explicitly approved
- Hosted publicly on Github
- Accessible via www on any browser with internet

Required files:

- `index.html`
- `manifest.json`
- `service-worker.js`
- Required static assets
- Private historical-data files and manifest

A build tool may be reconsidered later if performance, ECharts bundle size, or modularity makes it necessary. For MVP, keep the toolchain minimal.

### 4.0 Development Editor, Codex, and Source Control

Development shall use:

- Visual Studio Code Version 1.106.3
- VS Code commit `bf9252a2fb45be6893dd8870c0bf37e2e1766d61`, dated `2025-11-25T22:28:18.024Z`
- Electron 37.7.0, Electron build 12781156, Chromium 138.0.7204.251, bundled Node.js 22.20.0, and V8 13.8.258.32-electron.0
- Darwin x64 20.6.0 on the development Mac
- The Codex extension connected to the owner's ChatGPT Plus subscription
- The VS Code Source Control view and integrated terminal for local Git inspection and commands
- A public GitHub repository on `github.com`
- Organization display name: `KCs IRA Dash - Monte Carlo`
- Organization login: `KCs-IRA-Dash-Monte-Carlo`
- Repository name: `Portfolio-Dashboard`
- SSH remote: `git@github.com:KCs-IRA-Dash-Monte-Carlo/Portfolio-Dashboard.git`
- VS Code workspace and Git root: `/Users/nicholasoconnell/Desktop/Portfolio-Dashboard`
- Active project root: `/Users/nicholasoconnell/Desktop/Portfolio-Dashboard/`

Open the Git repository root as the VS Code workspace and treat the nested active project root as the application working directory. Codex must read this project's `requirements.md` and `roadmap.md`; they are authoritative for this build. Codex must edit only phase-authorized files, preserve unrelated working-tree changes, and report the files it changed. Review every Codex edit in the Source Control diff before testing or committing.

Git operations shall use the configured `origin` SSH URL. Verify it with `git remote get-url origin`; set it with `git remote set-url origin git@github.com:KCs-IRA-Dash-Monte-Carlo/Portfolio-Dashboard.git` when necessary. GitHub pull requests, checks, merges, rulesets, and releases may be managed in the GitHub web interface. GitHub CLI is not required.

The VS Code-bundled Electron, Chromium, Node.js, and V8 versions describe the editor and extension-host environment only. They do not replace the project's Firefox, Mozilla Firefox, browser-origin, service-worker, IndexedDB, or physical-device acceptance tests. A bundled VS Code Node.js version also does not guarantee that a `node` executable is available in the integrated terminal; terminal-based Node suites run only when `node --version` succeeds.

`main` shall contain accepted work. Development from Phase 3B onward shall use one phase branch, one pull request, automated checks where available, and an accepted-phase tag. A one-person repository shall not require an outside reviewer or signed commits. Force pushes and deletion of `main` shall be blocked.

The repository may not contain a Finnhub key. It may contain the eight approved Stooq production files, credential-free portfolio backups, diagnostics, and accepted release artifacts. SSH private keys, GitHub tokens, and private certificate keys remain excluded.

### 4.1 Hosting the MVP on GitHub

The MVP shall be hosted as a public static site with GitHub Pages from the approved public repository. The published HTTPS URL is the stable application origin and may be shared, while use of the application remains personal to the owner.

Required hosting behavior:

- Publish only client-side static assets; do not add an application backend or server-side Finnhub proxy.
- Open the hosted URL in Mozilla Firefox on desktop and iPhone.
- Keep all Finnhub credentials out of repository content, GitHub Pages assets, logs, URLs, exports, backups, workflows, and release artifacts.
- Preserve the relative asset paths, manifest, and service-worker scope required by a GitHub Pages project site.
- Treat a change of Pages URL, custom domain, or path as an origin migration for browser-held application state.
- Permit public distribution through shared URLs and remote internet access.
- Permit optional cloud synchronization and router port forwarding within the owner's deployment scope; neither is required for the GitHub Pages runtime.
- Keep VPN access and custom domains optional.



## 5. Initial Portfolio Defaults

The setup wizard should prepopulate the following default lots:

| Ticker | Shares | Acquisition Date | Purchase Price per Share |
|---|---:|---|---:|
| DCO | 39 | 2026-05-15 | 145.17948 |
| VTV | 547 | 2026-05-15 | 207.0364 |
| ONEQ | 918 | 2026-05-15 | 104.06513 |

These are editable defaults only.

They must not be immutable business logic.

---

## 6. Setup Wizard

On first launch, present a setup wizard.

The wizard must support:

- An empty Finnhub API key field for optional runtime-only entry
- Masked display and direct editing of the current session key
- Clear-session-key control
- Immediate validation through an approved Finnhub endpoint when requested
- Initial portfolio review
- Add/edit/delete holdings
- Add/edit/delete acquisition lots
- Initial benchmark review
- Theme selection
- Initial projection horizon selection
- Backup/export reminder
- Private historical seed-dataset status
- Historical installation progress
- Full-backup restore option for initializing the iPhone

Setup must allow the owner to proceed without entering a credential. A key entered during setup or later in Settings applies to subsequent Finnhub requests without rebuilding the application and must be re-entered after a page reload.

Setup must not require successful historical-data installation or successful Finnhub validation before completion. If live authentication fails, the app shall retain the entered key, classify the error, and permit cached or local-history operation. If historical installation fails, the app shall allow quote-only or cached operation while disabling or marking unavailable modules that require history.

On a new iPhone installation, the user may initialize the app by:

1. Opening the published GitHub Pages URL in Mozilla Firefox.

A restored full backup must never restore or contain a Finnhub key. After successful iPhone setup, the app may request persistent storage where supported and recommend a credential-free full backup.

## 7. Runtime Finnhub API Key Configuration

Required behavior:

- Ship an empty default and no credential value.
- Accept an optional owner-entered value during setup and after setup.
- Permit the owner to clear the current session value.
- Apply a changed value to future Finnhub requests without rebuilding the app.
- Keep the current value only in page-session memory and exclude it from Local Storage, IndexedDB, configuration backups, full portable backups, diagnostics, and repository-controlled fixtures.
- Send the value in the approved authentication header so it never appears in request URLs.
- Treat authentication rejection, quota exhaustion, and malformed responses as ordinary normalized provider errors.

Owner-approved exposure policy:

- A Finnhub key may not be hardcoded or committed.
- A Finnhub key may not appear in source, documentation, examples, tests, logs, diagnostics, URLs, screenshots, exports, backups, releases, or audit records.
- Redaction remains defense in depth, not permission to persist or emit the credential.
- GitHub secret scanning and push protection shall remain enabled where available.

This policy applies only to the Finnhub free-account key. SSH private keys, GitHub authentication tokens, and private HTTPS certificate keys are not project content and must remain outside the repository.

## 8. Portfolio Data Model

### 8.1 Holdings

Support:

- Add holding
- Edit holding
- Delete holding
- Multiple holdings subject to the active-symbol cap

### 8.2 Acquisition lots

Each holding may contain multiple acquisition lots.

Each lot must store:

- Ticker
- Shares
- Purchase price per share
- Acquisition date

When the user adds to an existing holding, treat the entry as a new lot unless the user explicitly edits an existing lot.

### 8.3 Lot actions

Support:

- Add lot
- Edit lot
- Delete lot

### 8.4 Position entry

For each lot, require:

- Shares
- Purchase price
- Acquisition date

Automatically calculate total invested cost.

### 8.5 Share handling

Support fractional shares.

Use full JavaScript `Number` precision internally and round only for display.

### 8.6 Rebalancing assumption

Use:

- Buy-and-hold
- No periodic rebalancing
- Fixed share counts unless the user edits portfolio lots

### 8.7 Realized gains and taxes

Include:

- Realized gains based on explicit user-recorded lot disposals
- Disposal date, disposed shares, proceeds per share, cost-basis allocation, and realized gain/loss
- A clear distinction between realized gains and unrealized gain/loss

Exclude:

- Tax optimization
- Tax filing
- Wash-sale handling


### 8.8 Corporate actions and lot ledger

The MVP does not automatically detect or apply stock splits, reverse splits, ticker changes, spin-offs, mergers, or other corporate actions to stored lots.

Reason:

- Finnhub free-tier MVP data does not provide a complete corporate-action ledger.
- Auto-adjusting lots without a reliable corporate-action source would create a higher risk of incorrect account values than requiring user review.

Required MVP behavior:

- Show a clear Settings and Help notice that users are responsible for updating lots after corporate actions.
- Provide an explicit lot-edit workflow for adjusting shares and purchase price after a split or similar event.
- Preserve an audit note field on lots so users can record manual adjustments.
- If quote or historical price behavior suggests a possible split, the app may show a non-authoritative warning, but it must not automatically alter stored lots.

Future versions may add automatic corporate-action detection only if a reliable data source is approved.

---

## 9. Active-Symbol Limit

MVP active-symbol limit:

- Maximum 25 total active symbols across holdings and benchmarks
- Additional symbols may be stored but inactive
- Only active symbols are refreshed, charted, and used in projections
- The user must be able to activate/deactivate symbols
- Activating a symbol beyond the cap must show a clear warning and prevent activation unless a future advanced override is explicitly approved

The 25-symbol cap is intended to keep the app compatible with Finnhub free-tier rate limits.

The symbol-management view must support search or filtering across stored inactive and active symbols so users can manage larger saved watchlists without relying only on table sorting.

---

## 10. Benchmark Management

Built-in benchmarks are seeded defaults, not permanent locked records.

Default benchmark tickers:

- SPY
- IWM
- AVUV
- AVDV
- PSCH

The user must be able to:

- Add benchmark tickers
- Delete benchmark tickers
- Re-add deleted built-in benchmark tickers
- Activate benchmark tickers
- Deactivate benchmark tickers
- Rename benchmark display labels where appropriate
- Search and validate benchmark tickers using Finnhub symbol lookup
- Include or exclude benchmarks from charts
- Include or exclude benchmarks from benchmark projection tables

Benchmarks shall be stored in the same symbol-management system as portfolio holdings but classified separately as benchmark assets.

Benchmarks must not require:

- Shares
- Purchase price
- Cost basis
- Acquisition lots

Benchmarks count toward the 25 total active-symbol MVP limit.

Deleting a benchmark removes it from:

- Comparison charts
- Benchmark tables
- Projection tables
- Saved benchmark configuration

Deleting a benchmark must not delete any portfolio holding with the same ticker unless the user explicitly deletes that holding separately.

If a deleted built-in benchmark is re-added, it behaves like any other user-added benchmark.

---

## 11. Storage and Persistence

Use:

- Local Storage for small user configuration
- IndexedDB for market data, imported historical data, diagnostics, and larger structured datasets

Mac and iPhone storage are independent. No automatic synchronization is provided.

### 11.1 Local Storage

Store in Local Storage:

- Holdings
- Lots
- Active-symbol preferences
- Benchmarks
- API settings metadata
- Theme
- Accent color
- Font scaling
- UI preferences
- Projection horizon
- Monte Carlo settings
- Export preferences
- Historical import preferences
- Last backup and restore metadata

### 11.2 IndexedDB

Store in IndexedDB:

- Cached quote snapshots
- Normalized historical OHLCV candles
- Historical dataset manifests
- Historical import batches
- Historical quality flags
- Company metadata cache
- Diagnostics history
- Export staging data

Recommended historical candle key:

```text
[symbol, date]
```

Historical records must preserve:

- Source
- Source ticker
- Frequency
- Price-adjustment method
- Dividend-adjustment method
- Dataset version
- Import timestamp
- Source-file hash
- Quality flags

### 11.3 Write behavior

Persistence writes must be:

- Batched where practical
- Debounced where practical
- Versioned by schema
- Transactional for historical full-series replacement

Do not rewrite large state blobs on every small input event.

A failed historical replacement must not leave a partially replaced symbol series.

### 11.4 Storage persistence and diagnostics

Where supported, the application shall use:

- `navigator.storage.estimate()`
- `navigator.storage.persisted()`
- `navigator.storage.persist()`

Diagnostics must show:

- Persistence requested
- Persistence granted or denied
- Estimated storage usage
- Estimated quota
- IndexedDB availability
- Seed dataset version
- Last historical import
- Last full backup
- Last full restore

The app must not assume that persistent storage will be granted.

### 11.5 Backup and synchronization

Required data-portability behavior:

- Configuration backup export
- Full portable backup export including historical data
- Restore from backup import
- Periodic export reminder

Periodic export reminder rule:

- Remind the user if no backup has been exported in the last 30 calendar days, or
- Remind the user after 10 saved portfolio/benchmark/settings edits since the last backup, whichever comes first.
- Allow the user to dismiss the reminder for 30 calendar days.

## 12. Market Data Strategy

The app shall use separate live-data and historical-data paths.

### 12.1 Quote snapshots

Use Finnhub `/quote` for quote snapshots.

Retrieve quote snapshots:

- On application load when internet access is available
- When the user presses Manual Refresh
- For active symbols only

Quote snapshots must be labeled as snapshots, not continuous streaming values.

Finnhub quote snapshots must not be converted into complete daily OHLCV candles.

### 12.2 Historical data source

Use private Stooq text files for historical OHLCV.

The source format is:

```text
<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>
```

Required interpretation:

- `PER` must equal `D`
- `DATE` uses `YYYYMMDD`
- `TIME` is a daily placeholder and is not used for session timing
- `.US` suffixes are normalized to canonical symbols
- `OPENINT` is ignored for stocks and ETFs
- Prices are split-adjusted
- Dividends are not included
- Volume is retained as source-provided volume and must not be assumed to be raw exchange share volume

### 12.3 Private seed dataset

The private project may bundle the eight validated Stooq files for:

- DCO
- VTV
- ONEQ
- SPY
- IWM
- AVUV
- AVDV
- PSCH

On first use per browser origin:

1. Load the historical dataset manifest.
2. Compare dataset version and file hashes with IndexedDB.
3. Parse and validate changed or missing files.
4. Normalize the records.
5. Store them transactionally in IndexedDB.
6. Record installation status and provenance.
7. Skip unchanged files on later launches.

The application must not parse every source file on every startup.

### 12.4 Manual historical updates

Occasional updates shall use manual Stooq imports in the same format.

Default update method:

- Complete file validation
- Comparison with the stored series
- User preview of added, changed, removed, and unchanged records
- Full-series replacement for each confirmed symbol
- Transactional write
- Derived-data invalidation

Full-series replacement is the default because future stock splits may restate the entire historical series.

Incremental append may be supported only when all overlapping records exactly match the stored series.

### 12.5 Historical-data service

Charts, analytics, portfolio calculations, and Monte Carlo must access history through a provider-independent service.

At minimum, expose stable interfaces for:

- `getSeries(symbol, options)`
- `getLatestCandle(symbol)`
- `getDateRange(symbol)`
- `getAlignedSeries(symbols, options)`
- `getDatasetStatus(symbol)`

Business logic must not parse source files directly.

### 12.6 Symbol search

Use `/search` and/or `/stock/symbol` for ticker validation and symbol lookup.

A newly added symbol may operate in quote-only mode until compatible local history is imported.

### 12.7 Company metadata

Use `/stock/profile2` for company metadata such as:

- Name
- Ticker
- Exchange
- IPO date
- Market cap
- Shares outstanding
- Logo
- Website
- Currency
- Country
- Industry classification

Company profile data must be cached in IndexedDB with a default TTL of 7 calendar days per symbol, unless manually refreshed or invalidated by schema upgrade.

### 12.8 Company peers

`/stock/peers` may be used for basic company context only.

Peer analytics are not required for MVP.

Peer data must be fetched on demand only and cached with a default TTL of 7 calendar days per symbol.

### 12.9 Market status and holidays

Use:

- `/stock/market-status`
- `/stock/market-holiday`

Use these to show whether the market is open and to support trading-calendar behavior.

### 12.10 Basic metrics

Use `/stock/metric` for basic company context only.

Permitted examples:

- 52-week high
- 52-week low
- Beta
- Other available summary metrics

These values must not substitute for calculated portfolio analytics unless explicitly validated and documented.

Basic metrics must be cached with a default TTL of 7 calendar days per symbol.

## 13. Excluded Market Data Features

The MVP excludes:

- Dividend history
- Dividend reinvestment
- Estimated annual income
- Standardized income statements
- Balance sheets
- Cash flow statements
- SEC filings
- Ownership data
- Insider data
- Executive profiles
- Company news
- Market news
- Full tick history
- Non-U.S. market coverage unless specifically verified

If a dividend-related value appears through `/stock/metric`, it may be shown only as informational company context and must not be used for portfolio-income calculations.

---

## 14. Request Queue and Rate-Limit Management

Network Data Services must enforce request management compatible with Finnhub free-tier limits.

Required behavior:

- Maximum 60 Finnhub calls per minute
- Maximum 30 Finnhub calls per second
- No uncontrolled parallel API fan-out
- Prioritize portfolio holding quotes before benchmark quotes
- Prioritize quote snapshots before metadata
- Use cached local historical data instead of network history requests
- Use throttling
- Use request queueing
- Use retry handling
- Use backoff for rate-limit responses
- Handle HTTP 429 visibly
- Show API status in Diagnostics
- Show approximate Finnhub request budget in Diagnostics

Historical file parsing, IndexedDB access, and local imports are outside the Finnhub request budget and must not be presented as API calls.

## 15. Feature Availability States

Each major dashboard module must support applicable states:

- Available
- Loading
- Stale
- Quote-only
- Insufficient history
- Rate-limited
- Offline
- Temporarily unavailable
- Error
- Historical dataset installing
- Historical import required
- Historical file missing
- Historical file invalid
- Historical replacement pending confirmation
- Historical dataset current
- Historical dataset stale
- Historical quality warning
- Adjustment metadata missing
- GitHub Pages host unavailable
- Hosted HTTPS origin invalid
- Application update unavailable
- Offline shell active

The UI must clearly distinguish:

- Internet or Finnhub failure
- GitHub Pages host failure
- Historical-data absence
- Historical-data validation failure
- Local cached operation

A plan/entitlement-unavailable state may remain for Finnhub endpoints still used by the app, but it is no longer the normal historical-data fallback state.

## 16. Return Methodology

The application uses split-adjusted, dividend-unadjusted Stooq OHLCV history for historical performance calculations.

Returns are price-return approximations.

The app must not label these calculations as:

- Exact total return
- Dividend-reinvested total return
- Brokerage-reconciled performance
- Tax-adjusted performance

### 16.1 Account Value Series

The Account Value Series uses user-entered shares multiplied by current or historical prices.

Use this series for:

- Current account value
- Position value
- Portfolio allocation
- Dollar gain/loss
- Account-style reporting

Historical account value is a modeled split-adjusted price series. It assumes stored lot shares and purchase prices have been manually updated after corporate actions where necessary.

### 16.2 Price-Return Performance Series

The Price-Return Performance Series uses split-adjusted, dividend-unadjusted close history to calculate:

- Normalized returns
- CAGR
- Alpha
- Beta
- Drawdown
- Benchmark comparisons
- Projections

This series excludes dividends and may not reconcile with brokerage total-return reporting.

### 16.3 Labeling

Every chart or metric derived from Stooq history must clearly communicate that it is a split-adjusted, dividend-unadjusted price-return approximation.

## 17. Portfolio Performance

### 17.1 Weighting

Use market-value weights that float over time based on active holdings and available price data.

For holding `i` at time `t`:

```text
w_i,t = MV_i,t / sum(MV_j,t)
```

where `MV_i,t` is the holding's market value at time `t`.

### 17.2 Buy-and-hold treatment

The portfolio must represent fixed-share buy-and-hold behavior with no rebalancing.

Do not implement floating weights in a way that accidentally implies daily rebalancing.

### 17.3 Multiple acquisition dates

Each lot has its own acquisition date.

The portfolio inception date is the earliest active acquisition date unless a different portfolio inception date is explicitly configured later.

---

## 18. Core Dashboard Metrics

Include dashboard cards for:

- Current portfolio value
- Today's dollar gain/loss
- Today's percentage gain/loss
- Total dollar gain/loss
- Total percentage gain/loss
- CAGR, price-return approximation
- Alpha, price-return approximation
- Beta, price-return approximation
- Maximum Drawdown, price-return approximation
- Allocation
- Market status
- Last successful data refresh
- API status

Exclude from MVP:

- Dividend yield as portfolio income
- Estimated annual income
- True total return
- Tax-adjusted return

If a metric cannot be calculated reliably from free-tier data, show an unavailable state.

---

## 19. Risk-Free Rate

Use the U.S. Treasury Fiscal Data API, or another explicitly approved public no-key source, for the current 3-Month U.S. Treasury Bill yield.

Requirements:

- Do not rely on Finnhub premium data for this
- Cache the last successful value
- Display the retrieval timestamp
- Show stale warning if unavailable
- Do not silently substitute an arbitrary fixed rate

If the public source is unavailable, the user may optionally enter a manual risk-free rate for local calculations, clearly labeled as user-provided.

---

## 20. Benchmark Comparison

Normalize portfolio and benchmark series to a common percentage-return basis.

Built-in and user-added active benchmarks must support comparison where historical candle data is available.

If the selected start date is not a trading day:

- Use the first valid trading session on or after the selected date

If a benchmark lacks sufficient OHLCV history:

- Show insufficient-history state
- Do not fabricate data
- Do not include it in calculations requiring aligned history

Benchmarks count toward the 25 active-symbol cap.

---

## 21. Time Filters

Provide chart quick filters:

- 1 Month
- 3 Months
- 6 Months
- YTD
- 1 Year
- Since Purchase
- Max

Filters must update relevant charts without requiring a page refresh.

If the filtered window lacks sufficient data, show a clear insufficient-data state.

---

## 22. Charts

Use Apache ECharts.

Phase 5A shall load the pinned unminified development distribution from
`https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.js`. Phase 10A shall
vendor the accepted distribution and remove the runtime CDN dependency.

Required MVP charts:

- Normalized portfolio vs. benchmark comparison
- Portfolio account-value growth chart
- Allocation chart
- Drawdown chart
- Monte Carlo confidence fan
- Monte Carlo percentile bands

Chart functionality:

- Series toggles
- Zoom
- Pan where compatible
- Reset zoom
- PNG export
- Responsive resizing
- Touch interaction

### 22.1 Mobile gesture rule

Swipeable tabs and chart pan/zoom can conflict on touch devices.

On mobile:

- Horizontal chart pan must be disabled inside horizontally swipeable tab containers, or
- Swipe-to-change-tab must be disabled while the user is interacting with a chart

The implementation must avoid gesture conflicts that make charts or tabs unusable.

---

## 23. Drawdown

Include:

- Maximum Drawdown metric
- Drawdown-over-time chart

Use a documented peak-to-trough methodology based on the Price-Return Performance Series.

---

## 24. Analytics Engine

Required calculated metrics:

- CAGR
- Alpha
- Beta
- Maximum Drawdown

All calculated analytics must use aligned OHLCV-derived return observations.

### 24.1 CAGR

Calculate from valid beginning value, ending value, and elapsed time.

Handle:

- Partial years
- Missing data
- Invalid zero or negative denominator cases

### 24.2 Alpha and Beta

Use a visible and configurable active benchmark where appropriate.

Use aligned return observations.

Do not calculate from mismatched trading dates.

### 24.3 Maximum Drawdown

The MVP headline Maximum Drawdown metric must be calculated from the Price-Return Performance Series, not from raw account value.

Raw account value can jump when the user adds new lots. A naive peak-to-trough calculation on raw dollar value can understate drawdowns because new contributions may appear as recoveries.

MVP rule:

- Headline drawdown: use the Price-Return Performance Series.
- Raw account-value drawdown: excluded from MVP unless implemented as a clearly labeled supplemental view.
- Any future account-value drawdown view must either adjust for contributions or explicitly label itself as unadjusted and not comparable to performance drawdown.

---

## 25. Monte Carlo Engine

### 25.1 MVP methods

MVP Monte Carlo methods:

1. Geometric Brownian Motion
2. Historical Bootstrap

Removed from MVP:

- Regime Switching
- Stochastic Volatility

These removed methods must not appear in MVP requirements or acceptance criteria.

### 25.2 Data basis

Monte Carlo must use normalized daily returns derived from validated local Stooq close history stored in IndexedDB.

If insufficient historical data exists, the app must show an insufficient-history warning rather than fabricating values.

### 25.3 Lookback

Use up to 756 valid trailing daily return observations where available.

A 756-return window requires 757 aligned closing prices.

If fewer observations are available, the app may allow the user to proceed only if it clearly labels the shorter lookback.

### 25.4 Paths

Run:

- 5,000 paths by default

Provide explicit lower path-count choices such as 1,000 and 2,500 for slower mobile devices. The app must not silently reduce the selected path count.

### 25.5 Projection horizon

Monte Carlo must use the global projection horizon.

### 25.6 Include/exclude controls

For each active holding, provide a Monte Carlo include/exclude toggle.

Default:

- Included

Benchmarks can be included or excluded from benchmark projection tables.

### 25.7 Correlation

Use correlated simulations where there is sufficient aligned data.

If the active symbol set is too large for acceptable performance, the app must allow the user to reduce the projection universe.

Handle singular or non-positive-definite covariance matrices using a documented stabilization method.

### 25.8 GBM parameter estimation

GBM must use aligned daily log returns derived from normalized Stooq close prices.

Default MVP estimation method:

- Daily drift: arithmetic mean of daily log returns over the available lookback window
- Daily volatility: sample standard deviation of daily log returns
- Correlation/covariance: sample covariance matrix of aligned daily log returns
- Simulation step: one trading day
- Projection year: 252 trading days

For a correlated multi-asset GBM run, simulate multivariate daily log returns using the estimated mean vector and covariance matrix. If covariance stabilization is required, disclose it in Diagnostics.

EWMA drift and volatility are excluded from MVP unless explicitly approved later.

### 25.9 Historical Bootstrap resampling method

Historical Bootstrap must resample aligned daily return vectors derived from normalized Stooq close prices.

Default MVP resampling method:

- Use daily arithmetic return vectors aligned by trading date across included assets
- Resample one-day return vectors with replacement
- Preserve same-day cross-asset dependence by resampling whole return vectors
- Compound sampled returns through the selected projection horizon
- Do not impose an external drift adjustment in MVP

Block bootstrap is deferred unless explicitly approved later.

### 25.10 Outputs

Required Monte Carlo outputs:

- P10
- P50 / Median
- P90
- Ending value distribution
- Expected annualized return
- Probability of loss
- Value at Risk
- Confidence fan
- Percentile bands

Benchmark-beating probability may only be shown when the benchmark has sufficient aligned history.

### 25.11 Reproducibility

Provide:

- Fixed random seed option
- Randomly generated seed option

A fixed seed must reproduce results when inputs are unchanged.

### 25.12 Mobile execution

On the iPhone:

- Run simulations in a Web Worker
- Keep the UI responsive
- Show progress
- Allow cancellation
- Handle app suspension cleanly
- Record elapsed time and failures in Diagnostics
- Benchmark 1-, 5-, and 10-year horizons with 1,000, 2,500, and 5,000 paths

## 26. Global Projection Horizon

Include one global Projection Horizon control.

Allow:

- Minimum: 1 year
- Maximum: 10 years
- Increment: 1 year

Valid values:

- 1
- 2
- 3
- 4
- 5
- 6
- 7
- 8
- 9
- 10 years

Use:

- 252 trading days per projection year

The selected horizon must apply to every forward-looking analysis, including:

- Monte Carlo simulations
- Projection charts
- Confidence bands
- Percentile tables
- Summary cards
- Exported reports

The control must:

- Be prominent in the dashboard header
- Also be available in Settings
- Persist locally
- Trigger recalculation without page refresh

---

## 27. Projection Date Display

Display both:

- Selected projection horizon
- Calculated projected ending calendar date

Example:

- `5 Years`
- `Projected Through: May 15, 2031`

Display projection horizon and date context on:

- Forward-looking charts
- Monte Carlo visualizations
- Relevant summary cards
- PNG chart exports where the projected date is visible in the chart

The UI must distinguish between:

- Statistical trading-day horizon used in calculations
- Human-readable projected calendar end date

---

## 28. Scenario Analysis

Scenario analysis is deferred from MVP unless explicitly approved later.

The MVP may include only simple projection summaries generated by GBM and Historical Bootstrap.

Removed from MVP:

- 2008-style shock
- COVID-style shock
- Bull deterministic scenario
- Bear deterministic scenario
- Custom deterministic scenario

---

## 29. Web Workers and Asynchronous Processing

Run computationally expensive simulations asynchronously using Web Workers.

Requirements:

- Keep the UI responsive
- Do not block the main thread
- Show simulation progress
- Allow cancellation
- Permit continued dashboard interaction while simulation runs

Progress indicator should show where feasible:

- Simulation method
- Progress percentage
- Elapsed time
- Estimated time remaining

If ETA cannot be estimated reliably, omit it.

### 29.1 Simulation state machine

The app must define explicit behavior when simulation inputs change during a running simulation.

Required behavior:

- Mark running simulation as stale when inputs change
- Allow user to cancel and restart, or automatically cancel and restart after confirmation
- Prevent stale simulation results from being displayed as current
- Record stale/cancelled simulation status in Diagnostics

Inputs that can invalidate a running simulation include:

- Holding edits
- Lot edits
- Benchmark changes
- Active-symbol changes
- Projection horizon changes
- Include/exclude toggle changes
- Monte Carlo method changes
- Historical data refresh

---

## 30. User Interface

### 30.1 Themes

Support:

- Dark mode
- Light mode
- Toggle between modes

### 30.2 Customization

Support:

- Accent color customization
- Chart palette customization
- Font-size scaling

### 30.3 Mobile

On the iPhone 13 mini:

- Portrait mode must be fully functional
- Landscape mode should provide wider chart viewing
- Use compact summary cards
- Use one principal chart or table per mobile panel
- Avoid hover-only interactions
- Use touch-sized controls
- Respect safe-area insets in Home Screen mode
- Keep projection controls outside chart gesture regions
- Allow tables to scroll horizontally without moving the entire page
- Re-render charts after orientation changes
- Avoid rendering all historical rows into the DOM

### 30.4 Tables

Tables require:

- Sortable columns
- Mobile horizontal scrolling where necessary

Table search and filtering are deferred unless the holdings/benchmarks UX proves insufficient.

## 31. Accessibility

Include:

- Keyboard navigation
- ARIA labels
- Visible focus states
- High-contrast compatibility
- Color-blind-safe chart palettes
- Scalable fonts
- Semantic HTML where practical

Do not rely on color alone to communicate financial gain/loss or chart identity.

---

## 32. Settings

Include a Settings area containing:

- Empty-by-default, masked Finnhub API key entry for the current page session
- Edit, validate, and clear-session controls for the Finnhub key
- Theme selection
- Accent color
- Chart palette
- Font scaling
- Simulation defaults
- Projection horizon
- Benchmark management
- Active-symbol management
- Historical dataset status
- Manual Stooq import
- Historical series replacement
- Historical cache management
- Export settings
- Configuration backup export
- Full portable backup export
- Backup restore
- Clear Local Storage control
- Clear IndexedDB control
- Storage persistence request/status
- Application version
- Historical dataset version
- Last successful quote synchronization
- Last successful historical import
- Last full backup and restore

Saving a changed API key must invalidate or refresh only provider-authentication and live-data state that depends on that value. It must not delete portfolio data or historical Stooq data.

Destructive actions must require confirmation.

## 33. About and Diagnostics

Include Diagnostics showing:

- Application version
- Git commit, branch, and accepted-phase tag where available
- Current browser origin
- GitHub Pages reachability when detectable
- Whether a runtime Finnhub key is present, without revealing its value
- Source of the active key: current session entry or legacy migration
- Last quote refresh
- Last successful historical import
- API status
- Approximate Finnhub request budget
- Rate-limit warnings
- Browser compatibility information
- Local Storage availability
- IndexedDB availability
- Storage persistence status
- Storage usage and quota estimate
- Cache status
- Historical source: Stooq
- Price adjustment: split-adjusted
- Dividend adjustment: none
- Per-symbol first and last dates
- Per-symbol observation counts
- Common aligned observation count
- Dataset version
- Source-file hashes
- Import mode and timestamp
- Historical quality flags
- Failed requests, including request endpoint and parameters where available
- Import errors
- API errors
- Browser capability warnings
- Simulation warnings
- Stale data warnings
- Derived-data invalidation status

Diagnostics and console logging must never include a Finnhub key or an authentication header. Failed-request URLs and parameters must be credential-free. User-entered portfolio notes must still be rendered safely.

## 34. Export and Backup

### 34.1 PNG export

Charts must support PNG export through ECharts-compatible functionality.

### 34.2 Configuration backup

Configuration backup shall include:

- Holdings
- Lots
- Benchmarks
- Settings
- Active-symbol preferences
- Projection settings
- A boolean indicating whether runtime live-data setup is needed, never the key value

### 34.3 Full portable backup

Full portable backup shall include:

- All credential-free configuration backup fields
- Normalized historical candles
- Historical dataset metadata
- Historical quality flags
- Historical import history
- Cached metadata where practical
- Diagnostics history where practical

Full backup restore may initialize another browser profile, but the owner must enter the Finnhub key separately for that page session.

### 34.4 Backup integrity

Backup files must include:

- Backup schema version
- Application version
- Export timestamp
- Dataset version
- Record counts
- Integrity checksum where practical

Restore must validate the entire file before changing stored data. Failed restore must not leave partial state. Backups must remain credential-free before they are synchronized or retained in the public repository.

## 35. Progressive Web App and GitHub Pages Access

Build the application as an installable PWA where supported.

Include:

- Web app manifest
- Service worker
- Application icons
- Offline shell caching
- Static asset caching
- Stable GitHub Pages HTTPS origin for final iPhone use

Cache:

- HTML
- CSS
- JavaScript
- Fonts
- Static assets
- Vendored ECharts
- Bundled Stooq seed files or the resources required to reinstall them

When offline or when GitHub Pages is unavailable after installation, the iPhone application should:

- Continue to load from its service-worker cache
- Display saved portfolio configuration
- Display IndexedDB historical data
- Display cached quote data
- Run historical analytics and Monte Carlo
- Clearly indicate that application updates are unavailable
- Clearly indicate when live internet quotes are unavailable

The GitHub Pages host is required for:

- Initial installation
- Application updates
- Reinstallation after local storage loss
- Access to uncached static assets

Use explicit cache versioning so updates can invalidate stale static caches.

Remote internet access is supported through the public GitHub Pages URL. Router port forwarding is in scope for optional owner-managed infrastructure but is not needed for the GitHub Pages deployment.

## 36. Input Validation and Data Integrity

Validate before calculation or storage.

Handle at minimum:

- Invalid ticker symbols
- Duplicate ticker entries
- Multiple lots for the same ticker
- Invalid acquisition dates
- Future acquisition dates
- Zero shares
- Negative shares
- Invalid prices
- Zero or negative purchase prices
- Missing benchmark data
- Missing quote data
- Invalid API responses
- Insufficient historical data
- Misaligned trading dates
- Singular covariance matrices
- Non-positive-definite covariance matrices
- NaN propagation
- Infinity propagation
- Unsupported browser capabilities
- Storage quota issues
- IndexedDB failures
- Invalid Stooq headers
- Wrong historical frequency
- Mixed tickers in a single-symbol file
- Invalid historical dates
- Duplicate historical dates
- Unsorted historical rows
- Nonpositive OHLC values
- OHLC bound violations
- Negative or nonfinite volume
- Conflicting replacement data
- Partial import or restore failures
- Dataset version mismatch
- File-hash mismatch

Duplicate tickers are valid when they represent multiple lots under a single holding.

A ticker may exist both as a holding and a benchmark only if the data model keeps those records separate and the UI makes the distinction clear.

Historical import and restore operations must validate completely before committing changes.

## 37. Numerical Precision and Formatting

Use full JavaScript `Number` precision internally.

Round only for display.

Default presentation:

- Prices: 2 decimals, or security precision where appropriate
- Shares: up to 6 decimals
- Percentages: 2 decimals
- CAGR: 2 decimals
- Alpha: 3 decimals
- Beta: 3 decimals

Do not repeatedly round intermediate values.

---

## 38. Dates and Time Zones

Use exchange trading-calendar logic where required.

For U.S. market data:

- Treat market session dates in Eastern Time
- Display user-facing timestamps in the user's local time zone

Prevent off-by-one-day errors caused by parsing date-only strings as UTC timestamps.

---

## 39. Performance Targets

Target:

- Initial dashboard render under 2 seconds after required local data is available, where practical
- Seed-history installation and full restore must show progress and remain responsive
- Monte Carlo completion within approximately 5 seconds for the eight-symbol seed case on the primary Mac where practical

The 5-second target does not apply to the iPhone or to the full 25-symbol cap.

For 13 to 25 active symbols, the MVP does not guarantee a fixed completion time. It must remain non-blocking, show progress, allow cancellation, and allow the user to reduce active projection symbols or paths.

Phase 7 and Phase 10 testing must benchmark:

- Approximately 8, 13, and 25 active symbols on the Mac
- 1-, 5-, and 10-year horizons on the iPhone
- 1,000, 2,500, and 5,000 paths on the iPhone

These are targets, not permission to silently reduce statistical correctness or path count.

## 40. Application Architecture

Use modular ES2020 architecture.

Separate logical components for:

- Data Services
- Historical Dataset Manager
- Request Queue
- Portfolio Engine
- Analytics Engine
- Monte Carlo Engine
- Chart Manager
- Persistence Manager
- UI Manager
- Export Manager
- Settings Manager
- Diagnostics Manager
- Utility Functions

Business logic must remain independent from rendering logic.

### 40.1 Data Services

Responsible for:

- Finnhub API access
- Quote retrieval
- Symbol lookup
- Company metadata retrieval
- Market status retrieval
- Basic metrics retrieval
- Risk-free-rate retrieval
- Request validation
- Cache fallback
- Error normalization

### 40.2 Historical Dataset Manager

Responsible for:

- Stooq file parsing
- Historical validation
- Symbol normalization
- Provenance metadata
- Dataset manifests and hashes
- Private seed installation
- Manual import preview
- Full-series replacement
- Historical quality flags
- IndexedDB persistence coordination
- Derived-data invalidation
- Aligned historical-series retrieval

### 40.3 Request Queue

Responsible for:

- Finnhub rate-limit enforcement
- Request prioritization
- Throttling
- Backoff
- Retry logic
- API budget status

### 40.4 Portfolio Engine

Responsible for:

- Holdings
- Lots
- Cost basis
- Position values
- Portfolio values
- Buy-and-hold calculations
- Market-value weights

### 40.5 Analytics Engine

Responsible for:

- Price-return calculations
- CAGR
- Alpha
- Beta
- Drawdown
- Normalization
- Date alignment

### 40.6 Monte Carlo Engine

Responsible for:

- GBM
- Historical Bootstrap
- Correlated random generation
- Covariance calculation
- Cholesky or fallback stabilization
- Percentiles
- Risk statistics
- GBM parameter estimation
- Historical Bootstrap vector resampling

### 40.7 Chart Manager

Responsible for:

- ECharts initialization
- Series updates
- Theme updates
- Responsive resizing
- PNG export
- Chart lifecycle cleanup
- Touch-gesture conflict management
- Orientation-change handling

### 40.8 Persistence Manager

Responsible for:

- Local Storage schema
- IndexedDB schema
- Versioning
- Migration
- Settings persistence
- Portfolio persistence
- Quote cache persistence
- Historical candle persistence
- Transactional import and restore

### 40.9 UI Manager

Responsible for:

- Setup wizard
- Tabs
- Forms
- Modals
- Historical import workflow
- Backup and restore workflow
- Mobile behavior
- User feedback
- Feature availability states

### 40.10 Export Manager

Responsible for:

- PNG export integration
- Configuration backup
- Full portable backup
- Backup restore

### 40.11 Diagnostics Manager

Responsible for:

- Error records
- API status
- Cache status
- Storage status
- Historical dataset status
- Import diagnostics
- Capability checks
- Simulation warnings
- Stale data warnings

## 41. Public Calculation Interfaces

Every major calculation must expose a documented public function or stable interface.

At minimum:

- Account value
- Position value
- Portfolio value
- Price return
- CAGR
- Alpha
- Beta
- Maximum Drawdown
- Normalization
- GBM Monte Carlo
- Historical Bootstrap Monte Carlo
- Export routines

---

## 42. Parameter-Driven Design

The application must be configurable through state and UI, not source-code changes.

Configurable items include:

- Holdings
- Lots
- Benchmarks
- Active-symbol states
- Simulation parameters
- Projection horizon
- Analytics settings
- Display preferences

---

## 43. Security and Privacy

Because the application is client-side and publicly hosted for the owner's personal use:

- Do not send portfolio data to an application backend.
- Do not upload selected historical files to an application service.
- Do not transmit normalized candles or calculated return series except through an explicitly configured owner-approved cloud synchronization feature.
- The approved public GitHub repository may contain source code, Stooq files, credential-free backups, diagnostics, and accepted release artifacts.
- A Finnhub key must remain runtime-only, masked in the UI, sent only in an authentication header, and excluded from every persisted or emitted artifact.
- Document that Local Storage is not encrypted secure storage.
- Sanitize user-entered text before rendering.
- Avoid unsafe `innerHTML` use with untrusted values.
- Use GitHub Pages HTTPS for the final iPhone origin.
- Support remote access through the public hosted URL while clearly stating that application use is personal.
- Keep GitHub SSH private keys, GitHub tokens, Finnhub keys, and private certificate keys outside the repository.

Finnhub and Treasury requests shall be made directly from the user’s browser. GitHub Pages is the static application runtime and must not act as an API proxy. Optional cloud synchronization may be added only with explicit owner configuration and credential exclusion.

## 44. Error Handling

Provide clear user-facing errors for:

- Invalid or rejected API key
- API rate limit
- Network unavailable
- Quote unavailable
- Historical file missing
- Historical import invalid
- Historical replacement conflict
- Insufficient history
- Simulation failure
- Export failure
- Restore failure
- Storage quota failure
- IndexedDB failure
- Service worker failure
- GitHub Pages host unavailable
- Hosted HTTPS origin invalid
- Application update unavailable
- GitHub workflow or release-package failure where surfaced in development documentation

Errors must:

- State what failed.
- State whether cached data is being used.
- State whether the failure affects live data, local history, or application updates.
- Preserve the active API key only in current page-session memory so the user can edit or clear it.
- Be recorded in Diagnostics where appropriate, including detailed request metadata when available.
- Never fabricate a successful state or substitute data silently.

## 45. Browser Capability Checks

At startup, detect required capabilities including:

- Local Storage
- IndexedDB
- Service Workers
- Web Workers
- Fetch
- Promise
- ECharts availability
- Blob/download support
- File input support
- Required graphics capabilities
- Storage estimate support
- Persistent-storage support
- Online/offline state
- Home Screen display mode where detectable

Show graceful warnings for missing capabilities.

## 46. Application Versioning

Display an application version.

Use versioning for:

- Application releases
- Local Storage schema migrations
- IndexedDB schema migrations
- Service-worker cache invalidation

Do not assume old stored data always matches the current schema.

---

## 47. Testing Requirements

Browser test pages served from the project’s normal HTTP or HTTPS origin are the primary acceptance mechanism. Node tests and GitHub Actions are supplemental regression checks and do not replace Firefox, service-worker, IndexedDB, or physical iPhone testing.

### 47.1 Functional tests

Test:

- First launch
- Setup wizard with an empty runtime-only Finnhub key field
- API key entry, masked display, update, validation, clear, reload removal, diagnostic exclusion, URL exclusion, export exclusion, and backup exclusion
- Add/edit/delete holdings and lots
- Multiple lots per ticker
- Add/delete/re-add built-in benchmarks
- Add/delete user benchmarks
- Activate/deactivate symbols and enforce the 25-symbol cap
- Symbol-management search/filter
- Manual quote refresh and metadata TTL behavior
- Private seed-history installation and manual Stooq replacement
- Import conflict preview, rollback, and historical quality warnings
- Corporate-action manual adjustment notice/workflow
- Offline startup and GitHub Pages-unavailable startup after installation
- Cached fallback and explicit availability states
- Theme and projection-horizon persistence
- Monte Carlo include/exclude, progress, cancellation, and stale-run behavior
- PNG chart export
- Configuration backup, full portable backup, and full iPhone restore
- GitHub milestone ZIP generation for accepted tags

### 47.2 Data-source tests

Use an owner-supplied session key only for explicitly authorized live endpoint checks. Automated fixtures must use non-secret placeholders and must not emit credentials.

Verify the permitted Finnhub endpoints:

- `/quote`
- `/search`
- `/stock/symbol`
- `/stock/profile2`
- `/stock/peers`
- `/stock/market-status`
- `/stock/market-holiday`
- `/stock/metric`

Do not call or require `/stock/candle`.

Required live-data test symbols: DCO, VTV, ONEQ, SPY, IWM, AVUV, AVDV, and PSCH.

### 47.3 Historical-data tests

Use the committed production Stooq files for local acceptance testing and deterministic synthetic fixtures for parser unit tests. Verify exact header parsing, daily frequency, ticker normalization, date conversion, numeric and OHLC validation, duplicate and order handling, full-series replacement, rollback, manifests, hashes, versions, counts, ranges, eight-symbol alignment, 756-return extraction, quality flags, and derived-data invalidation.

### 47.4 Calculation tests

Use deterministic fixtures to test cost basis, account value, portfolio weights, price-return normalization, CAGR, alpha, beta, drawdown, percentiles, VaR, covariance/correlation, fixed-seed reproducibility, GBM estimation, and whole-vector Historical Bootstrap resampling.

### 47.5 Compatibility tests

Test Firefox on macOS Big Sur 11.7.11, Mozilla Firefox on iPhone 13 mini iOS 26.5, Mozilla Firefox Home Screen mode, and Firefox iOS where practical.

### 47.6 GitHub Pages and offline tests

Test the stable GitHub Pages HTTPS URL, public shared-URL access, Mozilla Firefox on iPhone, Home Screen installation, offline relaunch, Pages-unavailable relaunch, service-worker scope under the project path, cache-version updates, and persistence status. Optional cloud synchronization and router-forwarded owner infrastructure require separate tests when configured.

### 47.7 Responsive and mobile tests

Test iPhone 13 mini portrait and landscape, tablet, desktop, touch interactions, chart gestures, table scrolling, orientation changes, safe-area insets, software-keyboard resizing, and Monte Carlo progress/cancellation.

### 47.8 Repository and continuous-integration tests

GitHub Actions shall use an available repository or organization runner, defaulting to `ubuntu-latest` when GitHub-hosted runners are enabled. Required checks:

- Required-file presence
- JSON parsing
- JavaScript and MJS syntax
- Known deterministic Node tests when their files exist
- No production dependency on `/stock/candle`
- Milestone release ZIP creation from accepted tags

The repository workflow must not claim that GitHub-hosted Linux checks validate Firefox/macOS, Mozilla Firefox/iPhone, IndexedDB on the real Pages origin, service workers, Home Screen behavior, or touch behavior.

## 48. Acceptance Criteria

The MVP is accepted only when:

1. Finnhub free-tier endpoints provide live quotes and market context without requiring premium datasets.
2. No Finnhub key appears in project configuration, source, documentation, tests, logs, diagnostics, URLs, exports, backups, or releases.
3. An owner-entered key remains available only for the current page session, is masked in the UI, and can be edited or cleared.
4. Historical analytics use the committed private Stooq daily files rather than Finnhub historical candles.
5. Historical prices are identified as split-adjusted and dividend-unadjusted, and returns are not presented as exact total return.
6. The request queue enforces the approved Finnhub limits and the 25-symbol active limit is enforced across holdings and benchmarks.
7. The eight seed symbols install and are queryable from IndexedDB; 756 aligned return vectors can be extracted.
8. Manual historical imports support validated transactional full-series replacement without partial failure state.
9. Quote-only or cached operation remains available when local history or live authentication is unavailable.
10. Holdings and acquisition lots support add/edit/delete, and corporate actions remain manual.
11. Built-in benchmarks can be added, deleted, re-added, activated, and deactivated without affecting same-ticker holdings.
12. GBM and whole-vector Historical Bootstrap are the only MVP Monte Carlo methods.
13. Simulations run in workers, report progress, support cancellation, and reject stale results.
14. Required charts render on desktop and iPhone layouts and support PNG export.
15. PNG chart export, configuration backup, full portable backup, and transactional restore work; CSV and Print-to-PDF are absent from application deliverables.
16. A credential-free full backup can initialize or update the iPhone, after which the key is entered separately for the session.
17. Historical, API, offline, host, import, storage, stale, and quality states are distinct.
18. The PWA loads offline after a successful visit and the installed iPhone app can launch from cached assets when GitHub Pages is unavailable.
19. Firefox/macOS Big Sur and Mozilla Firefox/iPhone 13 mini compatibility tests pass.
20. Dark/light themes, accessibility basics, safe rendering, precision, and date behavior pass.
21. The project remains parameter-driven, modular, client-side, and free of an application backend; optional cloud synchronization remains explicitly configured.
22. Public GitHub Pages hosting, shared-URL distribution, and remote runtime access work; cloud synchronization and router port forwarding are permitted in scope without being required for Pages.
23. GitHub `main` represents accepted work, phase branches use pull requests, required checks pass, and accepted phases are tagged.
24. The eight Stooq files, credential-free backups, and accepted milestone artifacts may be retained in the public repository.
25. Browser test evidence remains authoritative where CI cannot reproduce the target environment.
26. The final iPhone origin uses the stable GitHub Pages HTTPS URL.

## 49. Explicit Non-Goals

Do not add to MVP:

- Application backend
- Brokerage account connectivity
- Automated trading
- Order execution
- Tax filing
- Tax optimization
- User accounts
- Continuous quote polling
- Automatic high-frequency polling
- WebSocket streaming
- Automatic corporate-action adjustment
- Raw unadjusted account-value drawdown as a headline metric
- Cryptocurrency support
- Options analytics
- Margin analytics
- True total-return analytics
- Dividend reinvestment
- Dividend-income projection
- Company news
- Market news
- Regime Switching Monte Carlo
- Stochastic Volatility Monte Carlo
- Standardized financial statements
- SEC filings
- Ownership data
- Company executives
- CSV export
- Print-to-PDF reporting or a custom client-side PDF library

## 50. Future Version Candidates

Potential future features, only if explicitly approved later:

- Dividend-aware total return using a suitable data source
- Income projection
- Company news dashboard
- Market news dashboard
- Sector and peer analytics
- Regime Switching Monte Carlo
- Stochastic Volatility Monte Carlo
- Larger-symbol portfolio mode
- Paid data-provider support
- Brokerage import
- Advanced table filtering/search
- Custom PDF report builder
- Optional WebSocket trade updates, with separate quota/lifecycle management
- Automatic corporate-action detection and lot adjustment using a reliable corporate-action data source
- Block bootstrap Monte Carlo
- EWMA drift/volatility overlays
- Build-system optimization and tree-shaking

---

## 51. Build Sequence

The accepted Version 2.2 work through Phase 3A is preserved. Version 2.3 development proceeds in this order:

1. Open `/Users/nicholasoconnell/Desktop/Portfolio-Dashboard` as the VS Code workspace, use `MVP-Portfolio-Dash-3A-Validated` as the active project root, and verify that `origin` is `git@github.com:KCs-IRA-Dash-Monte-Carlo/Portfolio-Dashboard.git`.
2. Connect the Codex extension to the owner's ChatGPT Plus subscription and confirm the validated Phase 3A project is the workspace baseline.
3. Commit and tag the exact Phase 3A baseline as `phase-3a-accepted-v2.2`.
4. Maintain the runtime-only credential exclusion required by Sections 6, 7, 32, 33, 34, 43, 44, and 47.
5. Create and complete `phase-3b`.
6. Continue sequentially through Phase 4A, 5A, 6A, 7A, 7B, 7C, 8A, 9A, 9B, 10A, and 10B.
7. Complete GitHub Pages deployment and final Firefox/iPhone, offline, restore, and Phase 10 acceptance.

Phase descriptions remain:

- Phase 0: approved endpoint verification
- Phase 1A–1C: application foundation, persistence, and setup
- Phase 1D: GitHub Pages HTTPS deployment
- Phase 2A–2F: request queue, Stooq pipeline, Historical Data Service, and Finnhub live services
- Phase 3A: accepted portfolio model and engine
- Phase 3B: portfolio UI and corporate-action workflow
- Phase 4A: benchmark and shared symbol management
- Phase 5A: charting
- Phase 6A: analytics
- Phase 7A–7C: worker infrastructure, GBM, and Historical Bootstrap
- Phase 8A: projection horizon and visuals
- Phase 9A: full portable backup and restore
- Phase 9B: PNG integration and credential-free backup support
- Phase 10A: hardening and target-device validation
- Phase 10B: final audit and release decision

## 52. Development Process Requirement

Do not implement the full application in one unreviewed generation.

For each phase from Phase 3B onward:

1. Read `MVP-Portfolio-Dash-3A-Validated/requirements.md` Version 2.3 and the matching phase packet in `MVP-Portfolio-Dash-3A-Validated/roadmap.md` from the active project root.
2. In the VS Code integrated terminal, verify the workspace root and SSH remote, switch to `main`, pull with `--ff-only`, confirm a clean status, and create the named phase branch.
3. Start a Codex implementation session in the workspace with the authoritative requirements, matching roadmap phase packet, current source, and explicit allowed-file list in scope.
4. Require Codex to edit only authorized files directly in the workspace, preserve unrelated changes, avoid replacement ZIPs or wholesale project rewrites, and report its changed-file list.
5. Inspect the Codex changes in VS Code Source Control and with `git status`, `git diff --stat`, `git diff`, and `git diff --check` before testing.
6. If a terminal `node` executable is available, run applicable deterministic Node checks. Then start `python3 -m http.server 8000` and run the browser test pages in Firefox.
7. Perform all manual target-device tests required by the phase. VS Code's embedded Chromium is not acceptance evidence.
8. Run the phase audit in a separate Codex review session. The audit must provide requirement traceability, changed files, automated results, manual tests still required, known limitations, no-new-features confirmation, and exact repairs.
9. Apply required repairs through Codex in the same phase branch, then re-review the diff and rerun affected tests.
10. Commit coherent changes through VS Code Source Control or Git, push over SSH, open a pull request on GitHub, wait for required checks, and review the GitHub diff.
11. For this one-person repository, no outside reviewer or signed commit is required. Merge only after the evidence is complete.
12. Tag the accepted merge with the phase tag and allow the release workflow to attach an accepted milestone ZIP.
13. Update `CHANGELOG.md`, test evidence, and project status before beginning the next phase.
14. Roll back with Git rather than overwriting the accepted `main` branch. Codex must not run destructive Git commands without explicit owner approval.

The repository's `main` branch and accepted tags are the source authority for implementation state. `requirements.md` remains the authority for product behavior. The requirements may be changed only by an explicit owner-approved version revision.

## 53. Required Transparency in the App

The application must clearly communicate these limitations:

- Finnhub free-tier data is rate-limited.
- Stooq historical prices are split-adjusted and dividend-unadjusted.
- OHLCV-based returns are price-return approximations, not exact total return.
- Dividend history and dividend-income calculations are excluded from MVP.
- Historical data may be missing, stale, or insufficient for some symbols.
- New symbols require compatible local history imports for historical analytics.
- Browser profiles maintain separate local state unless optional cloud synchronization is explicitly configured.
- The GitHub Pages host is required for initial installation and application updates, but not for cached offline operation after installation.
- Live quotes require internet access even when the application shell is cached.
- Monte Carlo results are probabilistic model outputs, not guaranteed forecasts.
- Historical drift, volatility, and correlations may not persist.
- The dashboard is intended for the owner's personal use even though its GitHub Pages URL is public and shareable.

## 54. Final MVP Product Definition

The completed MVP is a personal-use, customizable, parameter-driven retirement portfolio dashboard and installable PWA that:

- Is hosted publicly through GitHub Pages and can be reached remotely from a shared URL.
- Is accessible on Firefox desktop and Mozilla Firefox on an iPhone 13 mini.
- Is source controlled in the public `KCs-IRA-Dash-Monte-Carlo/Portfolio-Dashboard` GitHub repository.
- Accepts an optional runtime-only Finnhub key for live quote snapshots and market context without placing it in source, storage, URLs, diagnostics, exports, or backups.
- Uses committed Stooq files for split-adjusted, dividend-unadjusted daily history.
- Supports manual full-series Stooq replacement imports.
- Tracks editable multi-lot U.S. stock and ETF holdings.
- Includes realized gains based on explicit user-recorded lot disposals.
- Provides price-return approximation analytics and configurable benchmark comparisons.
- Provides GBM and Historical Bootstrap Monte Carlo projections in Web Workers.
- Supports global 1–10 year projection horizons.
- Provides responsive charts, PNG export, configuration backup, and full portable backup/restore; CSV and Print-to-PDF are not application deliverables.
- Keeps all backups credential-free and requires session key entry after restore.
- Stores application data locally and permits optional explicitly configured cloud synchronization.
- Uses public GitHub source control, GitHub Pages runtime hosting, and milestone releases.
- Supports offline relaunch after installation and local caching.
- Clearly reports missing, stale, insufficient, quote-only, provider, host, network, import, and storage states.
- Requires no application backend or brokerage connection; public hosting, remote access, cloud synchronization, and router port forwarding are within scope.
