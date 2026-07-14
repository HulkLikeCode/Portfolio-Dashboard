# Phase 4A manual acceptance tests

Serve `MVP-Portfolio-Dash-3A-Validated` over local HTTP and use a fresh browser profile. Preserve any existing portfolio by exporting or copying its Local Storage state before clearing site data.

1. Open Benchmarks. Confirm SPY, IWM, AVUV, AVDV, and PSCH are present, editable, active, and included in charts and projection tables.
2. Edit a default benchmark label, deactivate it, change both inclusion controls, reload, and confirm every change persists.
3. Delete one default benchmark, reload, then add its ticker again. Confirm Finnhub validates it and the re-added record behaves like every other benchmark.
4. Add a benchmark with no local Stooq dataset. Confirm the UI reports quote-only/no local history and still permits activation. Confirm no shares, price, cost basis, or lot fields appear.
5. Store an inactive benchmark, select the Inactive filter, and search by ticker and label. Confirm the record remains manageable.
6. Create or retain a holding and a benchmark with the same ticker. Delete the benchmark and confirm the holding and all of its lots remain unchanged.
7. Prepare 25 distinct active tickers across holdings and benchmarks. Store a 26th ticker inactive, then try to activate it. Confirm activation is rejected with the 25-symbol warning and no data is lost.
8. Deactivate one of the 25 symbols and activate the stored ticker. Confirm the active count returns to 25.
9. Change benchmark label, active state, and inclusion controls. Confirm charts, analytics, and simulations are marked stale through the `mvp:symbol-registry-changed` event/state.
10. With Finnhub unavailable, confirm a new symbol is not silently accepted as validated and that existing stored records remain usable.

Record browser/version, device, pass/fail per step, and any console errors with the Phase 4A acceptance evidence.
