import assert from 'node:assert/strict';
import { createDefaultSettingsState } from '../js/settings/settings-state.js';
import {
  applyPortfolioPatch,
  settingsStateToPortfolio
} from '../js/ui/portfolio-settings-state-adapter.js';
import { editLotCandidate } from '../js/ui/portfolio-ui-engine-adapter.js';

const state = createDefaultSettingsState();
const options = { referenceDate: '2026-07-13' };
const portfolio = settingsStateToPortfolio(state, options);
assert.deepEqual(portfolio.holdings.map((holding) => holding.ticker), ['DCO', 'VTV', 'ONEQ']);

const adjusted = editLotCandidate(portfolio, 'holding-dco', 'lot-dco-20260515-001', {
  shares: 78,
  purchasePricePerShare: 72.58974,
  acquisitionDate: '2026-05-15',
  auditNote: 'Manual 2-for-1 split adjustment; brokerage record reviewed.'
}, options);
const saved = applyPortfolioPatch(state, adjusted, { ...options, editedAt: '2026-07-13T12:00:00.000Z' });

assert.equal(saved.lots.find((lot) => lot.id === 'lot-dco-20260515-001').shares, 78);
assert.match(saved.lots.find((lot) => lot.id === 'lot-dco-20260515-001').auditNote, /Manual 2-for-1/);
assert.equal(saved.portfolioRevision, 1);
assert.equal(saved.dependentDataState.analytics, 'stale');
assert.equal(saved.dependentDataState.simulations, 'stale');
assert.equal(saved.dependentDataState.staleReason, 'portfolio-edited');

const roundTrip = settingsStateToPortfolio(saved, options);
assert.equal(roundTrip.holdings[0].lots[0].shares, 78);
assert.equal(roundTrip.holdings[0].lots[0].purchasePricePerShare, 72.58974);

console.log('PASS phase-3b-state-adapter-tests: round trip, audit note, revision, and stale states');
