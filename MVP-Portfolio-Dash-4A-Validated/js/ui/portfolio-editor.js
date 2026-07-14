import { loadSettingsState, saveSettingsState } from '../settings/settings-state.js';
import { openLotEditor, normalizeUiErrors, showFormErrors } from './lot-editor.js';
import {
  addHoldingCandidate,
  addLotCandidate,
  deleteHoldingCandidate,
  deleteLotCandidate,
  editHoldingCandidate,
  editLotCandidate,
  summarizePortfolio
} from './portfolio-ui-engine-adapter.js';
import { applyPortfolioPatch, settingsStateToPortfolio } from './portfolio-settings-state-adapter.js';
import { assertActiveSymbolLimit } from '../core/symbol-registry.js';

export class PortfolioEditor {
  constructor(root, options = {}) {
    this.root = root;
    this.loadState = options.loadState || loadSettingsState;
    this.saveState = options.saveState || saveSettingsState;
    this.confirm = options.confirm || ((message) => window.confirm(message));
    this.state = null;
    this.portfolio = null;
  }

  mount() {
    this.reload();
    this.root.addEventListener('click', (event) => this.handleClick(event));
    return this;
  }

  reload() {
    this.state = this.loadState();
    this.portfolio = settingsStateToPortfolio(this.state);
    this.render();
  }

  render() {
    const summary = summarizePortfolio(this.portfolio);
    this.root.replaceChildren();
    this.root.insertAdjacentHTML('beforeend', `
      <div class="portfolio-toolbar">
        <div aria-live="polite">
          <strong>${summary.holdingCount}</strong> holdings · <strong>${summary.lotCount}</strong> lots · <strong>${formatCurrency(summary.costBasis)}</strong> total cost basis
        </div>
        <button class="button" type="button" data-portfolio-action="add-holding">Add holding</button>
      </div>
      <div class="portfolio-save-status" role="status" aria-live="polite" data-portfolio-status></div>
      <div class="holding-list" data-holding-list></div>`);

    const list = this.root.querySelector('[data-holding-list]');
    if (!this.portfolio.holdings.length) {
      list.innerHTML = '<div class="portfolio-empty"><h3>No holdings</h3><p>Add a holding and its first acquisition lot to begin.</p></div>';
      return;
    }

    this.portfolio.holdings.forEach((holding, holdingIndex) => {
      const holdingSummary = summary.holdings[holdingIndex];
      const holdingSummaryText = `${holding.active ? 'Active holding' : 'Inactive holding'} · ${formatNumber(holdingSummary.shares)} shares · ${formatCurrency(holdingSummary.costBasis)} cost basis`;
      const article = document.createElement('article');
      article.className = 'holding-card';
      article.dataset.holdingId = holding.id;
      article.innerHTML = `
        <header class="holding-card__header">
          <div class="holding-card__summary"><h3>${escapeHtml(holding.ticker)}</h3><p title="${escapeHtml(holdingSummaryText)}">${escapeHtml(holdingSummaryText)}</p></div>
          <div class="holding-card__actions">
            <button class="button button--secondary" type="button" data-portfolio-action="add-lot">Add lot</button>
            <button class="button button--secondary" type="button" data-portfolio-action="edit-holding">Edit holding</button>
            <button class="button button--danger" type="button" data-portfolio-action="delete-holding">Delete holding</button>
          </div>
        </header>
        <div class="lot-table-scroll"><table class="lot-table">
          <thead><tr><th scope="col">Acquired</th><th scope="col">Shares</th><th scope="col">Price/share</th><th scope="col">Invested cost</th><th scope="col">Audit note</th><th scope="col">Actions</th></tr></thead>
          <tbody></tbody>
        </table></div>`;
      const tbody = article.querySelector('tbody');
      holding.lots.forEach((lot, lotIndex) => {
        const row = document.createElement('tr');
        row.dataset.lotId = lot.id;
        row.innerHTML = `
          <td data-label="Acquired">${escapeHtml(formatShortDate(lot.acquisitionDate))}</td>
          <td data-label="Shares">${formatNumber(lot.shares)}</td>
          <td data-label="Price/share">${formatCurrency(lot.purchasePricePerShare)}</td>
          <td data-label="Invested cost">${formatCurrency(holdingSummary.lots[lotIndex].cost)}</td>
          <td data-label="Audit note" class="lot-note"></td>
          <td data-label="Actions"><div class="lot-actions">
            <button class="button button--secondary" type="button" data-portfolio-action="edit-lot">Edit</button>
            <button class="button button--secondary" type="button" data-portfolio-action="manual-adjustment">Manual adjustment</button>
            <button class="button button--danger" type="button" data-portfolio-action="delete-lot">Delete</button>
          </div></td>`;
        const noteCell = row.querySelector('.lot-note');
        noteCell.textContent = lot.auditNote || '—';
        if (lot.auditNote) noteCell.title = lot.auditNote;
        tbody.append(row);
      });
      list.append(article);
    });
  }

  handleClick(event) {
    const button = event.target.closest('[data-portfolio-action]');
    if (!button || !this.root.contains(button)) return;
    const holdingId = button.closest('[data-holding-id]')?.dataset.holdingId;
    const lotId = button.closest('[data-lot-id]')?.dataset.lotId;
    const action = button.dataset.portfolioAction;

    if (action === 'add-holding') this.openHoldingEditor(button);
    if (action === 'edit-holding') this.openHoldingEditor(button, holdingId);
    if (action === 'delete-holding') this.deleteHolding(button, holdingId);
    if (action === 'add-lot') this.openLot(button, holdingId, null, 'add');
    if (action === 'edit-lot') this.openLot(button, holdingId, lotId, 'edit');
    if (action === 'manual-adjustment') this.openLot(button, holdingId, lotId, 'manual-adjustment');
    if (action === 'delete-lot') this.deleteLot(button, holdingId, lotId);
  }

  openHoldingEditor(trigger, holdingId = null) {
    const existing = this.portfolio.holdings.find((holding) => holding.id === holdingId);
    const dialog = document.createElement('dialog');
    dialog.className = 'portfolio-dialog';
    dialog.setAttribute('aria-labelledby', 'holding-editor-title');
    dialog.innerHTML = `
      <form method="dialog" class="portfolio-form" novalidate>
        <div class="portfolio-dialog__header"><div><p class="eyebrow">Holding</p><h2 id="holding-editor-title">${existing ? 'Edit holding' : 'Add holding'}</h2></div><button class="button button--ghost" type="button" data-dialog-cancel>Close</button></div>
        <div class="portfolio-form__errors" data-form-errors role="alert" aria-live="assertive" tabindex="-1" hidden></div>
        <div class="portfolio-form__grid">
          <label class="portfolio-field"><span>Ticker</span><input name="ticker" type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="15" value="${escapeHtml(existing?.ticker || '')}" required></label>
          <label class="portfolio-check"><input name="active" type="checkbox" ${existing?.active !== false ? 'checked' : ''}><span>Active holding</span></label>
          ${existing ? '' : `
            <label class="portfolio-field"><span>Shares</span><input name="shares" type="number" inputmode="decimal" min="0" step="any" required></label>
            <label class="portfolio-field"><span>Purchase price per share</span><input name="purchasePricePerShare" type="number" inputmode="decimal" min="0" step="any" required></label>
            <label class="portfolio-field"><span>Acquisition date</span><input name="acquisitionDate" type="date" required></label>
            <label class="portfolio-field portfolio-field--wide"><span>Audit note (optional)</span><textarea name="auditNote" rows="3"></textarea></label>`}
        </div>
        <div class="portfolio-dialog__actions"><button class="button button--secondary" type="button" data-dialog-cancel>Cancel</button><button class="button" type="submit">${existing ? 'Save holding' : 'Add holding'}</button></div>
      </form>`;
    document.body.append(dialog);
    dialog.querySelectorAll('[data-dialog-cancel]').forEach((button) => button.addEventListener('click', () => dialog.close('cancel')));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); dialog.close('cancel'); });
    dialog.addEventListener('close', () => {
      dialog.remove();
      const fallback = this.root.querySelector(existing
        ? `[data-holding-id="${CSS.escape(existing.id)}"] [data-portfolio-action="edit-holding"]`
        : '[data-portfolio-action="add-holding"]');
      (trigger.isConnected ? trigger : fallback)?.focus({ preventScroll: true });
    }, { once: true });
    dialog.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      try {
        const input = { ticker: data.get('ticker'), active: data.get('active') === 'on' };
        const candidate = existing
          ? editHoldingCandidate(this.portfolio, existing.id, input)
          : addHoldingCandidate(this.portfolio, {
            ...input,
            shares: data.get('shares'),
            purchasePricePerShare: data.get('purchasePricePerShare'),
            acquisitionDate: data.get('acquisitionDate'),
            auditNote: data.get('auditNote')
          });
        this.commit(candidate, existing ? `${input.ticker.toUpperCase()} holding saved.` : `${input.ticker.toUpperCase()} holding added.`);
        dialog.close('saved');
      } catch (error) {
        showFormErrors(form, normalizeUiErrors(error));
      }
    });
    dialog.showModal();
    dialog.querySelector('[name="ticker"]').focus({ preventScroll: true });
  }

  openLot(trigger, holdingId, lotId, mode) {
    const holding = this.portfolio.holdings.find((entry) => entry.id === holdingId);
    const lot = holding?.lots.find((entry) => entry.id === lotId);
    openLotEditor({
      mode,
      ticker: holding.ticker,
      lot,
      trigger,
      restoreFocus: () => {
        const target = this.root.querySelector(`[data-holding-id="${CSS.escape(holdingId)}"] [data-portfolio-action="add-lot"]`)
          || this.root.querySelector('[data-portfolio-action="add-holding"]');
        target?.focus({ preventScroll: true });
      },
      onSubmit: (changes) => {
        const candidate = mode === 'add'
          ? addLotCandidate(this.portfolio, holdingId, changes)
          : editLotCandidate(this.portfolio, holdingId, lotId, changes);
        this.commit(candidate, mode === 'manual-adjustment' ? 'Manual adjustment saved and dependent results marked stale.' : mode === 'add' ? 'Lot added.' : 'Lot saved.');
      }
    });
  }

  deleteHolding(trigger, holdingId) {
    const holding = this.portfolio.holdings.find((entry) => entry.id === holdingId);
    if (!holding || !this.confirm(`Delete ${holding.ticker} and all ${holding.lots.length} acquisition lot(s)? This cannot be undone.`)) return;
    this.commit(deleteHoldingCandidate(this.portfolio, holdingId), `${holding.ticker} holding deleted.`);
    this.focusAfterDelete(trigger);
  }

  deleteLot(trigger, holdingId, lotId) {
    const holding = this.portfolio.holdings.find((entry) => entry.id === holdingId);
    const lot = holding?.lots.find((entry) => entry.id === lotId);
    if (!lot || !this.confirm(`Delete this ${holding.ticker} acquisition lot from ${lot.acquisitionDate}? This cannot be undone.`)) return;
    try {
      this.commit(deleteLotCandidate(this.portfolio, holdingId, lotId), 'Lot deleted.');
      this.focusAfterDelete(trigger);
    } catch (error) {
      this.announce(error.message, true);
      trigger.focus({ preventScroll: true });
    }
  }

  commit(candidate, message) {
    const nextState = applyPortfolioPatch(this.state, candidate);
    assertActiveSymbolLimit(nextState);
    this.state = this.saveState(nextState, { incrementEditCount: true });
    this.portfolio = settingsStateToPortfolio(this.state);
    this.render();
    this.announce(message);
    window.dispatchEvent(new CustomEvent('mvp:portfolio-changed', {
      detail: { revision: this.state.portfolioRevision, dependentDataState: this.state.dependentDataState }
    }));
  }

  announce(message, error = false) {
    const status = this.root.querySelector('[data-portfolio-status]');
    if (!status) return;
    status.textContent = message;
    status.dataset.error = error ? 'true' : 'false';
  }

  focusAfterDelete(previousTrigger) {
    const fallback = this.root.querySelector('[data-portfolio-action="add-holding"]');
    const selector = previousTrigger.closest('[data-holding-id]')?.dataset.holdingId;
    const related = selector && this.root.querySelector(`[data-holding-id="${CSS.escape(selector)}"] button`);
    (related || fallback)?.focus({ preventScroll: true });
  }
}

function formatShortDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return String(value || '');
  return `${Number(match[2])}/${Number(match[3])}/${match[1].slice(-2)}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
