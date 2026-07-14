import assert from 'node:assert/strict';
import {
  addHoldingCandidate,
  addLotCandidate,
  deleteHoldingCandidate,
  deleteLotCandidate,
  editHoldingCandidate,
  editLotCandidate,
  summarizePortfolio
} from '../js/ui/portfolio-ui-engine-adapter.js';

const options = {
  referenceDate: '2026-07-13',
  idFactory: (() => {
    let id = 0;
    return (prefix) => `${prefix}-test-${++id}`;
  })()
};

const initial = {
  id: 'portfolio-test',
  name: 'Test',
  holdings: [{
    id: 'holding-aaa', ticker: 'AAA', active: true,
    lots: [{ id: 'lot-aaa-1', ticker: 'AAA', shares: 2, purchasePricePerShare: 10, acquisitionDate: '2026-01-02', auditNote: '' }]
  }],
  benchmarks: []
};

let portfolio = addHoldingCandidate(initial, {
  ticker: 'BBB', shares: '1.5', purchasePricePerShare: '20', acquisitionDate: '2026-02-03'
}, options);
assert.equal(portfolio.holdings.length, 2, 'adds a holding with an initial lot');

portfolio = addLotCandidate(portfolio, 'holding-aaa', {
  shares: '0.25', purchasePricePerShare: '12', acquisitionDate: '2026-03-04', auditNote: 'Added shares'
}, options);
assert.equal(portfolio.holdings[0].lots.length, 2, 'adds a distinct lot');

const newLotId = portfolio.holdings[0].lots[1].id;
portfolio = editLotCandidate(portfolio, 'holding-aaa', newLotId, {
  shares: '0.5', purchasePricePerShare: '6', acquisitionDate: '2026-03-04', auditNote: '2-for-1 split reviewed manually'
}, options);
assert.equal(portfolio.holdings[0].lots[1].auditNote, '2-for-1 split reviewed manually');
assert.equal(portfolio.holdings[0].lots[1].id, newLotId, 'lot edit preserves identity');

portfolio = editHoldingCandidate(portfolio, 'holding-aaa', { ticker: 'AAC', active: false }, options);
assert.equal(portfolio.holdings[0].ticker, 'AAC');
assert(portfolio.holdings[0].lots.every((lot) => lot.ticker === 'AAC'), 'ticker edit updates dependent lots');

const summary = summarizePortfolio(portfolio, options);
assert.equal(summary.holdingCount, 2);
assert.equal(summary.lotCount, 3);
assert.equal(summary.costBasis, 30, 'default cost basis includes active holdings only');

const allHoldingsSummary = summarizePortfolio(portfolio, { ...options, activeOnly: false });
assert.equal(allHoldingsSummary.costBasis, 53, 'all-holdings cost basis comes from Phase 3A engine calculations');

portfolio = deleteLotCandidate(portfolio, 'holding-aaa', newLotId, options);
assert.equal(portfolio.holdings[0].lots.length, 1);
assert.throws(() => deleteLotCandidate(portfolio, 'holding-aaa', 'lot-aaa-1', options), /only lot/);

const bbbId = portfolio.holdings[1].id;
portfolio = deleteHoldingCandidate(portfolio, bbbId, options);
assert.equal(portfolio.holdings.length, 1);

assert.throws(() => addHoldingCandidate(portfolio, {
  ticker: 'BAD!', shares: 1, purchasePricePerShare: 1, acquisitionDate: '2026-01-01'
}, options));
assert.throws(() => editLotCandidate(portfolio, 'holding-aaa', 'lot-aaa-1', { shares: 0 }, options));

console.log('PASS phase-3b-node-tests: CRUD, validation, identity, and engine summaries');
