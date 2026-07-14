# Historical Data Validation Report

**Dataset version:** `2026-07-09`

**Manifest:** [`../data/historical/manifest.json`](../data/historical/manifest.json)

This report records validation evidence for the fixed private seed dataset. The
manifest and `requirements.md` are authoritative for runtime metadata and
interpretation.

## Overall conclusion

The eight local text files are sufficient for the current MVP's daily historical charts, aligned analytics, and eight-symbol correlated Monte Carlo design.

- Total observations: 34,122
- Source-file size: 2.24 MiB
- Common aligned dates across all eight symbols: 1,703
- Common aligned range: 2019-09-27 through 2026-07-09
- Required Monte Carlo window tested: 756 daily return vectors from 2023-07-03 through 2026-07-09
- Covariance matrix rank: 8 of 8
- Smallest covariance eigenvalue: 0.0000008204
- Covariance condition number: 1,110.8
- Cholesky decomposition succeeds: Yes

## Per-symbol validation

| Symbol   |   Rows | First date   | Last date   |   Duplicate dates |   Missing rows |   Weekend rows |   OHLC violations |   Zero volume rows |   Fractional volume rows |   File bytes | SHA-256                                                          |
|:---------|-------:|:-------------|:------------|------------------:|---------------:|---------------:|------------------:|-------------------:|-------------------------:|-------------:|:-----------------------------------------------------------------|
| AVDV     |   1703 | 2019-09-27   | 2026-07-09  |                 0 |              0 |              0 |                 0 |                  0 |                      687 |       114851 | 93f21eae50ff39529165f0e109f0fe673e1fd777fd80ca286b48d05dd63578a2 |
| AVUV     |   1703 | 2019-09-27   | 2026-07-09  |                 0 |              0 |              0 |                 0 |                  0 |                      750 |       116218 | 75f06050d56b238e4b51f807a6dc933b3e3d0dc552d69237896916b5277ec86e |
| DCO      |   5374 | 2005-02-25   | 2026-07-09  |                 0 |              0 |              0 |                 0 |                  0 |                        0 |       309792 | 9225f4ca004614022683bdc4e6d7e3dbfec57f91d60b3e2d387a2be579c19bcc |
| IWM      |   5374 | 2005-02-25   | 2026-07-09  |                 0 |              0 |              0 |                 0 |                  0 |                     4425 |       395461 | 16154c7ec92e6abaa65a03fc3a12ff8be911b17022652f2474a4eb7e6e738696 |
| ONEQ     |   5374 | 2005-02-25   | 2026-07-09  |                 0 |              0 |              0 |                 0 |                  0 |                     4419 |       395838 | ba50a2e9b1a7308c6ad12c02b9d0992265c81566a0cdaee5a76f34e894874ed5 |
| PSCH     |   3846 | 2011-03-23   | 2026-07-09  |                 0 |              0 |              0 |                 0 |                  0 |                        0 |       246743 | a52c4e8aa359627915553b312e7eb574ec0b63c6d9c82222b977978985d060b6 |
| SPY      |   5374 | 2005-02-25   | 2026-07-09  |                 0 |              0 |              0 |                 0 |                  0 |                        0 |       370200 | ff2e19186675951d6ac605fcab493d66879053a82955b7d964cd906e625fb0db |
| VTV      |   5374 | 2005-02-25   | 2026-07-09  |                 0 |              0 |              0 |                 0 |                  0 |                     4424 |       395061 | 75aa49228e0120f21ecab59681bf3f12ef6b177bff4d3101fd9f83ee02dac89a |

## Data-quality findings

- All files use daily frequency (`D`) and midnight placeholder time (`000000`).
- Ticker values are internally consistent.
- Dates are strictly ascending.
- No duplicate dates, blank values, weekend rows, nonpositive prices, negative volume, or OHLC bound violations were found.
- Each security has exactly the same trading dates as SPY over its available range.
- AVDV and AVUV begin on 2019-09-27; this limits the eight-symbol common history but still leaves more than twice the 756-observation target.
- Historical volume is fractional in several ETF files. This is evidence that the files are adjusted or transformed rather than raw exchange OHLCV.
- The source text files do not self-describe their adjustment method. The
  project manifest and Requirements v2.3 classify them as split-adjusted and
  dividend-unadjusted; analytics must retain that explicit label and must not
  claim total-return accuracy.
- Several extreme intraday highs or lows exist. Some coincide with known market-dislocation dates; others may be bad ticks. Close-based analytics are less affected, but candlestick rendering should preserve a quality flag rather than silently alter values.

## Recommended implementation policy

1. Bundle these eight files as seed history.
2. Parse and validate them through one local historical-data service.
3. Normalize ticker suffixes such as `SPY.US` to canonical symbols such as `SPY`.
4. Store normalized records in IndexedDB using a compound `[symbol, date]` key.
5. Use `CLOSE` for return calculations and Monte Carlo with the manifest's
   `priceAdjustment: split-adjusted` and `dividendAdjustment: none` metadata.
6. Do not use fractional historical volume for liquidity or turnover analytics.
7. Flag suspicious intraday wicks for Diagnostics and chart annotations; do not mutate source values silently.
8. Track dataset version, file hash, import date, first date, last date, and observation count per symbol.
9. Invalidate calculated analytics and simulations whenever a symbol's history changes.
10. Add manual import support for newly added symbols and later data updates.

## Quality flags

| Symbol   | Date       |    Open |     High |      Low |    Close | Reason            |
|:---------|:-----------|--------:|---------:|---------:|---------:|:------------------|
| AVDV     | 2019-11-07 | 49.5618 | 54.2787  | 49.4872  | 49.5294  | upper wick 9.5%   |
| AVDV     | 2020-03-16 | 31.0484 | 36.2326  | 30.9924  | 32.9685  | upper wick 9.9%   |
| DCO      | 2008-12-04 | 16.01   | 17.57    | 15.42    | 16.05    | upper wick 9.5%   |
| DCO      | 2008-12-09 | 17.19   | 19.16    | 16.87    | 17.39    | upper wick 10.2%  |
| DCO      | 2009-06-17 | 17.8    | 20.26    | 17.45    | 18.48    | upper wick 9.6%   |
| DCO      | 2012-05-08 | 10.14   | 11.82    |  9.61    |  9.69    | upper wick 16.6%  |
| DCO      | 2013-05-07 | 21.44   | 24.46    | 18.21    | 19.47    | upper wick 14.1%  |
| DCO      | 2020-03-20 | 20.01   | 21.94    | 19.03    | 19.13    | upper wick 9.6%   |
| IWM      | 2008-09-19 | 67.0583 | 73.1161  | 62.8343  | 63.7263  | upper wick 9.0%   |
| ONEQ     | 2008-10-10 |  5.603  |  6.25844 |  5.33955 |  5.68674 | upper wick 10.1%  |
| ONEQ     | 2010-05-06 |  8.2589 |  8.28766 |  4.85827 |  8.03279 | lower wick 65.3%  |
| ONEQ     | 2015-08-24 | 15.9383 | 17.1799  | 13.1067  | 16.5467  | lower wick 21.6%  |
| PSCH     | 2015-08-24 | 21.526  | 23.309   | 14.412   | 22.539   | lower wick 49.4%  |
| VTV      | 2008-10-09 | 33.9689 | 44.3257  | 29.7356  | 30.5164  | upper wick 30.5%  |
| VTV      | 2010-05-06 | 37.1955 | 37.6732  | 16.5502  | 36.0386  | lower wick 117.8% |
