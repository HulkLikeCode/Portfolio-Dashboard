import {
  applyDisplayPreferences,
  computeActiveSymbols,
  FINNHUB_API_KEY_SOURCES,
  loadSettingsState,
  markSetupComplete,
  normalizeTicker,
  saveSettingsState
} from '../settings/settings-state.js';
import { clearElement, createElement, createField, formatCurrency } from '../utils/dom-utils.js';
import { calculateLotCost } from '../portfolio/portfolio-engine.js';
import { settingsStateToPortfolio } from './portfolio-settings-state-adapter.js';

const STEPS = [
  'Privacy',
  'API Key',
  'Portfolio Lots',
  'Benchmarks',
  'Projection Horizon',
  'Review'
];

let activeWizard = null;

export function initSetupWizard(options = {}) {
  const state = loadSettingsState();
  applyDisplayPreferences(state);

  if (!state.setup.completed || options.force === true) {
    activeWizard = new SetupWizard(state, options);
    activeWizard.mount();
  }

  window.addEventListener('mvp:openSetupWizard', () => {
    if (activeWizard) activeWizard.unmount();
    activeWizard = new SetupWizard(loadSettingsState(), { force: true });
    activeWizard.mount();
  });
}

export function openSetupWizard() {
  window.dispatchEvent(new CustomEvent('mvp:openSetupWizard'));
}

class SetupWizard {
  constructor(initialState, options = {}) {
    this.state = cloneState(initialState);
    this.options = options;
    this.stepIndex = Number.isInteger(this.state.setup.lastStep) ? this.state.setup.lastStep : 0;
    this.stepIndex = Math.max(0, Math.min(STEPS.length - 1, this.stepIndex));
    this.root = null;
    this.panel = null;
    this.errorBox = null;
  }

  mount() {
    this.root = createElement('div', {
      className: 'setup-overlay',
      role: 'presentation'
    });

    this.panel = createElement('section', {
      className: 'setup-panel',
      role: 'dialog',
      attributes: {
        'aria-modal': 'true',
        'aria-labelledby': 'setup-title'
      }
    });

    this.root.append(this.panel);
    document.body.append(this.root);
    document.body.classList.add('setup-open');
    this.render();
  }

  unmount() {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    document.body.classList.remove('setup-open');
  }

  render() {
    clearElement(this.panel);

    const header = this.renderHeader();
    const body = createElement('div', { className: 'setup-body' });
    this.errorBox = createElement('div', {
      className: 'setup-error',
      role: 'alert',
      hidden: true
    });

    body.append(this.errorBox);
    body.append(this.renderCurrentStep());

    const footer = this.renderFooter();
    this.panel.append(header, body, footer);

    const firstInput = this.panel.querySelector('input, select, textarea, button');
    if (firstInput) firstInput.focus({ preventScroll: true });
  }

  renderHeader() {
    const eyebrow = createElement('p', {
      className: 'setup-eyebrow',
      text: `Phase 1 setup shell · Step ${this.stepIndex + 1} of ${STEPS.length}`
    });

    const title = createElement('h1', {
      id: 'setup-title',
      text: STEPS[this.stepIndex]
    });

    const list = createElement('ol', {
      className: 'setup-steps',
      attributes: { 'aria-label': 'Setup progress' }
    });

    STEPS.forEach((step, index) => {
      const item = createElement('li', { text: step });
      if (index === this.stepIndex) item.setAttribute('aria-current', 'step');
      if (index < this.stepIndex) item.dataset.complete = 'true';
      list.append(item);
    });

    return createElement('header', {
      className: 'setup-header',
      children: [eyebrow, title, list]
    });
  }

  renderCurrentStep() {
    switch (this.stepIndex) {
      case 0:
        return this.renderWarningsStep();
      case 1:
        return this.renderApiKeyStep();
      case 2:
        return this.renderPortfolioStep();
      case 3:
        return this.renderBenchmarksStep();
      case 4:
        return this.renderPreferencesStep();
      case 5:
        return this.renderReviewStep();
      default:
        return this.renderWarningsStep();
    }
  }

  renderWarningsStep() {
    return createElement('div', {
      className: 'setup-step',
      children: [
        createElement('p', {
          className: 'setup-lead',
          text: 'This app is client-side only. Configuration, portfolio lots, benchmarks, and preferences are stored in this browser profile. User-entered Finnhub API keys are kept only in memory for the current page session.'
        }),
        createElement('div', {
          className: 'setup-warning-grid',
          children: [
            warningCard(
              'API key storage',
              'The key you enter is held only in memory, is excluded from source, browser storage, diagnostics, request URLs, exports, and backups, and must be re-entered after a full page reload.'
            ),
            warningCard(
              'No historical-data requirement',
              'Setup completion does not require installed historical data and does not trigger any provider or historical-data request.'
            )
          ]
        })
      ]
    });
  }

  renderApiKeyStep() {
    const keyInput = createElement('input', {
      type: 'password',
      value: this.state.api.apiKey || '',
      placeholder: 'Enter key for this session (optional)',
      attributes: {
        autocomplete: 'off',
        spellcheck: 'false'
      }
    });

    keyInput.addEventListener('input', () => {
      this.state.api.apiKey = keyInput.value.trim();
      this.state.api.hasKey = Boolean(this.state.api.apiKey);
      this.state.api.keySource = FINNHUB_API_KEY_SOURCES.SESSION;
      this.state.api.lastUpdatedAt = this.state.api.apiKey ? new Date().toISOString() : null;
    });

    const resetButton = createElement('button', {
      className: 'button button--secondary',
      text: 'Clear session key',
      attributes: { type: 'button' }
    });
    resetButton.addEventListener('click', () => {
      keyInput.value = '';
      this.state.api.apiKey = '';
      this.state.api.hasKey = false;
      this.state.api.keySource = FINNHUB_API_KEY_SOURCES.SESSION;
      this.state.api.lastUpdatedAt = new Date().toISOString();
    });

    return createElement('div', {
      className: 'setup-step',
      children: [
        createElement('p', {
          className: 'setup-lead',
          text: 'Enter a Finnhub key for this page session, or continue without one for local-history and quote-unavailable workflows.'
        }),
        createField({
          label: 'Finnhub API key',
          input: keyInput,
          hint: 'The active key applies to subsequent Finnhub requests for this page session without rebuilding the app.'
        }),
        resetButton,
        createElement('p', {
          className: 'setup-muted',
          text: 'The active key is masked, held only for this page session, and excluded from diagnostics, exports, backups, and browser storage.'
        })
      ]
    });
  }

  renderPortfolioStep() {
    const wrapper = createElement('div', { className: 'setup-step' });
    wrapper.append(createElement('p', {
      className: 'setup-lead',
      text: 'Review editable default lots. Each row is ordinary user data and can be changed or deleted.'
    }));

    const table = createElement('table', { className: 'setup-table' });
    const thead = createElement('thead');
    thead.append(row(['Ticker', 'Shares', 'Acquired', 'Purchase price', 'Cost', 'Actions'], 'th'));
    const tbody = createElement('tbody');

    this.state.lots.forEach((lot) => {
      const tickerInput = createElement('input', { value: lot.ticker, ariaLabel: 'Ticker' });
      tickerInput.addEventListener('input', () => {
        const normalized = normalizeTicker(tickerInput.value);
        lot.ticker = normalized;
        tickerInput.value = normalized;
        this.syncHoldingsFromLots();
      });

      const sharesInput = createElement('input', {
        type: 'number',
        value: String(lot.shares),
        ariaLabel: 'Shares',
        attributes: { min: '0', step: '0.000001' }
      });
      sharesInput.addEventListener('input', () => {
        lot.shares = Number(sharesInput.value);
        updateCost();
      });

      const dateInput = createElement('input', {
        type: 'date',
        value: lot.acquisitionDate,
        ariaLabel: 'Acquisition date'
      });
      dateInput.addEventListener('input', () => {
        lot.acquisitionDate = dateInput.value;
      });

      const priceInput = createElement('input', {
        type: 'number',
        value: String(lot.purchasePrice),
        ariaLabel: 'Purchase price per share',
        attributes: { min: '0', step: '0.00001' }
      });
      priceInput.addEventListener('input', () => {
        lot.purchasePrice = Number(priceInput.value);
        updateCost();
      });

      const deleteButton = createElement('button', {
        className: 'button button--ghost',
        type: 'button',
        text: 'Delete'
      });
      deleteButton.addEventListener('click', () => {
        if (!window.confirm(`Delete this ${lot.ticker} acquisition lot? This cannot be undone.`)) return;
        this.state.lots = this.state.lots.filter((candidate) => candidate.id !== lot.id);
        this.syncHoldingsFromLots();
        this.render();
      });

      const costCell = createElement('td');
      const updateCost = () => {
        let cost = NaN;
        try {
          cost = calculateLotCost(lot);
        } catch (_error) {
          // The accepted portfolio validation boundary reports the actionable error on save.
        }
        costCell.textContent = formatCurrency(cost);
      };
      updateCost();
      tbody.append(createElement('tr', {
        children: [
          createElement('td', { children: [tickerInput] }),
          createElement('td', { children: [sharesInput] }),
          createElement('td', { children: [dateInput] }),
          createElement('td', { children: [priceInput] }),
          costCell,
          createElement('td', { children: [deleteButton] })
        ]
      }));
    });

    table.append(thead, tbody);

    const addButton = createElement('button', {
      className: 'button button--secondary',
      type: 'button',
      text: 'Add lot'
    });
    addButton.addEventListener('click', () => {
      this.addLot();
      this.render();
      const rows = this.panel.querySelectorAll('.setup-table tbody tr');
      rows[rows.length - 1]?.querySelector('input')?.focus({ preventScroll: true });
    });

    wrapper.append(table, createElement('div', { className: 'setup-actions-inline', children: [addButton] }));
    return wrapper;
  }

  renderBenchmarksStep() {
    const wrapper = createElement('div', { className: 'setup-step' });
    wrapper.append(createElement('p', {
      className: 'setup-lead',
      text: 'Review editable default benchmarks. Benchmarks do not require shares, cost basis, or lots.'
    }));

    const table = createElement('table', { className: 'setup-table' });
    const thead = createElement('thead');
    thead.append(row(['Ticker', 'Display label', 'Active', 'Charts', 'Projection tables', 'Actions'], 'th'));
    const tbody = createElement('tbody');

    this.state.benchmarks.forEach((benchmark) => {
      const tickerInput = createElement('input', { value: benchmark.ticker, ariaLabel: 'Benchmark ticker' });
      tickerInput.addEventListener('input', () => {
        benchmark.ticker = normalizeTicker(tickerInput.value);
        tickerInput.value = benchmark.ticker;
      });

      const labelInput = createElement('input', { value: benchmark.label, ariaLabel: 'Benchmark display label' });
      labelInput.addEventListener('input', () => {
        benchmark.label = labelInput.value;
      });

      const activeInput = createElement('input', { type: 'checkbox' });
      activeInput.checked = benchmark.active !== false;
      activeInput.addEventListener('change', () => {
        benchmark.active = activeInput.checked;
      });

      const chartInput = createElement('input', { type: 'checkbox' });
      chartInput.checked = benchmark.includeInCharts !== false;
      chartInput.addEventListener('change', () => {
        benchmark.includeInCharts = chartInput.checked;
      });

      const projectionInput = createElement('input', { type: 'checkbox' });
      projectionInput.checked = benchmark.includeInProjectionTables !== false;
      projectionInput.addEventListener('change', () => {
        benchmark.includeInProjectionTables = projectionInput.checked;
      });

      const deleteButton = createElement('button', {
        className: 'button button--ghost',
        type: 'button',
        text: 'Delete'
      });
      deleteButton.addEventListener('click', () => {
        this.state.benchmarks = this.state.benchmarks.filter((candidate) => candidate.id !== benchmark.id);
        this.render();
      });

      tbody.append(createElement('tr', {
        children: [
          createElement('td', { children: [tickerInput] }),
          createElement('td', { children: [labelInput] }),
          createElement('td', { children: [activeInput] }),
          createElement('td', { children: [chartInput] }),
          createElement('td', { children: [projectionInput] }),
          createElement('td', { children: [deleteButton] })
        ]
      }));
    });

    table.append(thead, tbody);

    const addButton = createElement('button', {
      className: 'button button--secondary',
      type: 'button',
      text: 'Add benchmark'
    });
    addButton.addEventListener('click', () => {
      this.addBenchmark();
      this.render();
      const rows = this.panel.querySelectorAll('.setup-table tbody tr');
      rows[rows.length - 1]?.querySelector('input[aria-label="Benchmark ticker"]')?.focus({ preventScroll: true });
    });

    wrapper.append(table, createElement('div', { className: 'setup-actions-inline', children: [addButton] }));
    return wrapper;
  }

  renderPreferencesStep() {
    const horizonSelect = createElement('select');
    for (let year = 1; year <= 10; year += 1) {
      const option = createElement('option', {
        value: String(year),
        text: `${year} ${year === 1 ? 'year' : 'years'}`
      });
      option.selected = Number(this.state.projectionHorizonYears) === year;
      horizonSelect.append(option);
    }
    horizonSelect.addEventListener('change', () => {
      this.state.projectionHorizonYears = Number.parseInt(horizonSelect.value, 10);
    });

    return createElement('div', {
      className: 'setup-step setup-form-grid',
      children: [
        createElement('p', {
          className: 'setup-lead setup-grid-span',
          text: 'Choose the single global projection horizon. This horizon will later apply to all forward-looking modules.'
        }),
        createField({ label: 'Projection horizon', input: horizonSelect, hint: 'Allowed range: 1 to 10 years.' })
      ]
    });
  }

  renderReviewStep() {
    const holdingsCount = this.state.holdings.length;
    const lotsCount = this.state.lots.length;
    const benchmarksCount = this.state.benchmarks.length;
    const activeSymbols = computeActiveSymbols(this.state.holdings, this.state.benchmarks);

    const list = createElement('dl', {
      className: 'setup-review-list',
      children: [
        term('API key status', this.state.api.apiKey ? 'Available for this session' : 'Not entered'),
        term('Holdings', String(holdingsCount)),
        term('Lots', String(lotsCount)),
        term('Benchmarks', String(benchmarksCount)),
        term('Active symbols', activeSymbols.join(', ') || 'None'),
        term('Theme', this.state.theme),
        term('Projection horizon', `${this.state.projectionHorizonYears} years`)
      ].flat()
    });

    return createElement('div', {
      className: 'setup-step',
      children: [
        createElement('p', {
          className: 'setup-lead',
          text: 'Finish setup to save this configuration. Completion will not attempt historical candle retrieval or any Finnhub request.'
        }),
        list,
        warningCard(
          'Phase boundary',
          'Live-data and portfolio modules are implemented, but dashboard integration, analytics, charting, Monte Carlo, and exports remain inactive until their later phases.'
        )
      ]
    });
  }

  renderFooter() {
    const backButton = createElement('button', {
      className: 'button button--ghost',
      type: 'button',
      text: 'Back'
    });
    backButton.disabled = this.stepIndex === 0;
    backButton.addEventListener('click', () => this.back());

    const nextButton = createElement('button', {
      className: 'button button--primary',
      type: 'button',
      text: this.stepIndex === STEPS.length - 1 ? 'Finish setup' : 'Continue'
    });
    nextButton.addEventListener('click', () => this.nextOrFinish());

    const skipButton = createElement('button', {
      className: 'button button--secondary',
      type: 'button',
      text: 'Save and close later'
    });
    skipButton.addEventListener('click', () => {
      this.state.setup.lastStep = this.stepIndex;
      saveSettingsState(this.prepareStateForSave(), { incrementEditCount: false });
      this.unmount();
      refreshShellSummary();
    });

    return createElement('footer', {
      className: 'setup-footer',
      children: [
        createElement('div', { children: [skipButton] }),
        createElement('div', { className: 'setup-footer__nav', children: [backButton, nextButton] })
      ]
    });
  }

  back() {
    this.stepIndex = Math.max(0, this.stepIndex - 1);
    this.state.setup.lastStep = this.stepIndex;
    saveSettingsState(this.prepareStateForSave(), { incrementEditCount: false });
    this.render();
  }

  nextOrFinish() {
    const validation = this.validateCurrentStep();
    if (!validation.valid) {
      this.showError(validation.message);
      return;
    }

    if (this.stepIndex < STEPS.length - 1) {
      this.stepIndex += 1;
      this.state.setup.lastStep = this.stepIndex;
      saveSettingsState(this.prepareStateForSave(), { incrementEditCount: false });
      this.render();
      return;
    }

    const saved = markSetupComplete(this.prepareStateForSave());
    applyDisplayPreferences(saved);
    this.unmount();
    refreshShellSummary();
  }

  validateCurrentStep() {
    if (this.stepIndex === 2) {
      if (this.state.lots.length === 0) {
        return { valid: false, message: 'Add at least one lot or go back and close setup without completing it.' };
      }

      try {
        this.syncHoldingsFromLots();
        settingsStateToPortfolio(this.state);
      } catch (error) {
        const first = Array.isArray(error.errors) ? error.errors[0] : null;
        return { valid: false, message: first?.message || error.message || 'Portfolio validation failed.' };
      }
    }

    if (this.stepIndex === 3) {
      const tickers = this.state.benchmarks.map((benchmark) => normalizeTicker(benchmark.ticker));
      if (tickers.some((ticker) => !ticker)) {
        return { valid: false, message: 'Every benchmark needs a ticker.' };
      }
    }

    return { valid: true, message: '' };
  }

  showError(message) {
    this.errorBox.hidden = false;
    this.errorBox.textContent = message;
    this.errorBox.focus();
  }

  prepareStateForSave() {
    this.syncHoldingsFromLots();
    const next = cloneState(this.state);
    next.api.hasKey = Boolean(next.api.apiKey);
    next.api.keySource = FINNHUB_API_KEY_SOURCES.SESSION;
    next.activeSymbols = computeActiveSymbols(next.holdings, next.benchmarks);
    return next;
  }

  syncHoldingsFromLots() {
    const previousByTicker = new Map(this.state.holdings.map((holding) => [holding.ticker, holding]));
    const lotsByTicker = new Map();

    this.state.lots.forEach((lot) => {
      const ticker = normalizeTicker(lot.ticker);
      lot.ticker = ticker;
      if (!ticker) return;
      if (!lotsByTicker.has(ticker)) lotsByTicker.set(ticker, []);
      lotsByTicker.get(ticker).push(lot);
    });

    this.state.holdings = Array.from(lotsByTicker.entries()).map(([ticker, lots]) => {
      const existing = previousByTicker.get(ticker);
      const holdingId = existing?.id || `holding-${ticker.toLowerCase()}-${makeId()}`;
      lots.forEach((lot) => {
        lot.holdingId = holdingId;
      });

      return {
        id: holdingId,
        ticker,
        label: existing?.label || ticker,
        active: existing?.active !== false,
        type: 'holding',
        lotIds: lots.map((lot) => lot.id)
      };
    });
  }

  addLot() {
    const ticker = '';
    const holdingId = `holding-pending-${makeId()}`;
    this.state.lots.push({
      id: `lot-pending-${makeId()}`,
      holdingId,
      ticker,
      shares: 1,
      acquisitionDate: todayDateOnly(),
      purchasePrice: 1,
      auditNote: ''
    });
    this.syncHoldingsFromLots();
  }

  addBenchmark() {
    this.state.benchmarks.push({
      id: `benchmark-pending-${makeId()}`,
      ticker: '',
      label: '',
      active: true,
      builtIn: false,
      includeInCharts: true,
      includeInProjectionTables: true,
      type: 'benchmark'
    });
  }
}

function warningCard(title, message) {
  return createElement('article', {
    className: 'setup-warning-card',
    children: [
      createElement('h2', { text: title }),
      createElement('p', { text: message })
    ]
  });
}

function row(cells, cellTag) {
  return createElement('tr', {
    children: cells.map((cell) => createElement(cellTag, { text: cell }))
  });
}

function term(label, value) {
  return [
    createElement('dt', { text: label }),
    createElement('dd', { text: value })
  ];
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function makeId() {
  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0].toString(36);
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function todayDateOnly() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function refreshShellSummary() {
  const state = loadSettingsState();
  applyDisplayPreferences(state);

  const setupStatus = document.querySelector('[data-setup-status]');
  if (setupStatus) {
    setupStatus.textContent = state.setup.completed ? 'Setup complete' : 'Setup incomplete';
  }

  const activeSymbols = document.querySelector('[data-active-symbols]');
  if (activeSymbols) {
    activeSymbols.textContent = state.activeSymbols.length ? state.activeSymbols.join(', ') : 'None';
  }

  const projectionHorizon = document.querySelector('[data-projection-horizon]');
  if (projectionHorizon) {
    projectionHorizon.textContent = `${state.projectionHorizonYears} years`;
  }

  const themeLabel = document.querySelector('[data-theme-label]');
  if (themeLabel) {
    themeLabel.textContent = state.theme;
  }
}
