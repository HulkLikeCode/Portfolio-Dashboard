# Phase 3B Manual Test Checklist

Run from the project's normal HTTP/HTTPS origin. Firefox on macOS and a physical iPhone 13 mini remain the acceptance targets; an embedded browser is not acceptance evidence.

## Portfolio CRUD

- [ ] Add a holding with one fractional-share lot. Reload and verify ticker, shares, price, date, and note persist.
- [ ] Add a second lot to an existing holding. Verify it remains a separate lot.
- [ ] Edit a holding ticker and active state. Verify every nested lot follows the ticker and no benchmark is changed.
- [ ] Edit lot shares, purchase price, acquisition date, and audit note. Cancel once and confirm nothing changes; then save and reload.
- [ ] Delete a non-final lot. Cancel the confirmation once, then confirm it and reload.
- [ ] Try deleting a holding. Cancel once, then confirm that the holding and its lots are removed.
- [ ] Try deleting a holding's only lot and verify the UI blocks it with guidance to delete the holding.

## Validation and accessibility

- [ ] Try blank/invalid tickers, duplicate holdings, zero/negative/nonfinite shares and prices, missing/invalid/future dates. Verify the dialog stays open, input remains, the error is announced, and focus moves to the affected field.
- [ ] Navigate every editor using only the keyboard. Verify visible focus, logical order, Escape/Cancel behavior, and focus restoration.
- [ ] Verify every touch action is at least 44 CSS pixels high and no control is hidden behind the iPhone keyboard.
- [ ] With VoiceOver, verify editor titles, field labels, error alerts, comparison headers, save status, and destructive-action labels.

## Corporate actions and invalidation

- [ ] Confirm the responsibility notice is visible in Holdings, Settings, and Help.
- [ ] Open Manual adjustment for a lot. Verify the notice says corporate actions are not detected or applied automatically.
- [ ] Change shares, price, and date. Verify before values remain fixed and after values update before saving.
- [ ] Try saving without an audit note and verify it is blocked and announced.
- [ ] Save with a descriptive audit note, reload, and verify all adjusted data and the note persist.
- [ ] Verify Analytics and Projections show stale status after every saved holding/lot change.
- [ ] Verify typing and canceling an editor performs no persistence write and does not mark results stale.

## iPhone 13 mini layout

- [ ] At 375 × 812 CSS pixels in portrait, verify single-column fields, readable lot cards, usable comparison scrolling, and full-width action controls.
- [ ] Rotate to landscape and back while an editor is open; verify values and focus are retained.
- [ ] Open the numeric keyboard for shares/price and date keyboard/picker for acquisition date; verify Save and Cancel remain reachable by scrolling.
