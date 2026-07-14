import { BenchmarkEngine } from "../benchmarks/benchmark-engine.js";
import { DEFAULT_BENCHMARK_TICKERS } from "../benchmarks/benchmark-model.js";
import { MAX_ACTIVE_SYMBOLS, SymbolRegistry } from "../core/symbol-registry.js";
import { loadSettingsState, saveSettingsState } from "../settings/settings-state.js";
import { createBenchmarkManagementServices } from "./benchmark-management-services.js";

export class BenchmarkManager {
  constructor(root, options = {}) {
    this.root = root;
    this.loadState = options.loadState || loadSettingsState;
    this.saveState = options.saveState || saveSettingsState;
    this.confirm = options.confirm || ((message) => window.confirm(message));
    const services = options.services || createBenchmarkManagementServices(options.serviceOptions);
    this.engine = options.engine || new BenchmarkEngine({
      symbolService: services.symbolService,
      historicalDataService: services.historicalDataService,
      maxActiveSymbols: options.maxActiveSymbols
    });
    this.historyService = services.historicalDataService;
    this.state = null;
    this.query = "";
    this.activity = "all";
    this.historyByTicker = new Map();
    this.knownBenchmarksByTicker = new Map(DEFAULT_BENCHMARK_TICKERS.map((ticker) => [ticker, {
      id: `benchmark-${ticker.toLowerCase()}`,
      ticker,
      label: ticker,
      active: true,
      includeInCharts: true,
      includeInProjectionTables: true,
      builtIn: true,
      type: "benchmark"
    }]));
  }

  mount() {
    this.reload();
    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener("change", (event) => this.handleChange(event));
    this.root.addEventListener("input", (event) => this.handleInput(event));
    this.refreshHistoryStatuses();
    return this;
  }

  reload() {
    this.state = this.loadState();
    this.state.benchmarks.forEach((benchmark) => {
      this.knownBenchmarksByTicker.set(benchmark.ticker, { ...benchmark });
    });
    this.render();
  }

  registry() {
    return new SymbolRegistry(this.state, { maxActiveSymbols: this.engine.maxActiveSymbols });
  }

  render() {
    const registry = this.registry();
    const records = registry.filter(this.query, this.activity);
    this.root.innerHTML = `
      <div class="benchmark-toolbar">
        <div><strong data-active-count>${registry.activeCount()}</strong> of <strong>${registry.maxActiveSymbols || MAX_ACTIVE_SYMBOLS}</strong> active symbols</div>
        <button class="button" type="button" data-benchmark-action="add">Add benchmark</button>
      </div>
      <div class="benchmark-status" role="status" aria-live="polite" data-benchmark-status></div>
      <div class="symbol-filter">
        <label class="portfolio-field"><span>Search stored symbols</span><input type="search" value="${escapeHtml(this.query)}" placeholder="Ticker, label, or record type" data-symbol-search></label>
        <label class="portfolio-field"><span>Activity</span><select data-symbol-activity>
          <option value="all" ${this.activity === "all" ? "selected" : ""}>All</option>
          <option value="active" ${this.activity === "active" ? "selected" : ""}>Active</option>
          <option value="inactive" ${this.activity === "inactive" ? "selected" : ""}>Inactive</option>
        </select></label>
      </div>
      <div class="symbol-table-scroll"><table class="symbol-table">
        <thead><tr><th>Symbol</th><th>Record</th><th>Local history</th><th>Active</th><th>Charts</th><th>Projection table</th><th>Actions</th></tr></thead>
        <tbody data-symbol-records></tbody>
      </table></div>`;

    const body = this.root.querySelector("[data-symbol-records]");
    records.forEach((record) => body.append(this.renderRecord(record)));
    if (!records.length) {
      body.innerHTML = '<tr><td colspan="7">No active or inactive records match this filter.</td></tr>';
    }
  }

  renderRecord(record) {
    const row = document.createElement("tr");
    row.dataset.recordType = record.recordType;
    row.dataset.recordId = record.id;
    row.dataset.ticker = record.ticker;
    const history = this.historyByTicker.get(record.ticker);
    row.innerHTML = `
      <td data-label="Symbol"><strong>${escapeHtml(record.ticker)}</strong><span class="symbol-label">${escapeHtml(record.label)}</span></td>
      <td data-label="Record"><span class="record-badge">${record.recordType}</span></td>
      <td data-label="Local history"><span data-history-status>${historyLabel(history)}</span></td>
      <td data-label="Active"><label class="switch-label"><input type="checkbox" data-record-toggle="active" ${record.active ? "checked" : ""}><span>${record.active ? "Active" : "Inactive"}</span></label></td>
      <td data-label="Charts">${record.recordType === "benchmark" ? `<label class="switch-label"><input type="checkbox" data-record-toggle="includeInCharts" ${record.includeInCharts ? "checked" : ""}><span>${record.includeInCharts ? "Included" : "Excluded"}</span></label>` : "Holding"}</td>
      <td data-label="Projection table">${record.recordType === "benchmark" ? `<label class="switch-label"><input type="checkbox" data-record-toggle="includeInProjectionTables" ${record.includeInProjectionTables ? "checked" : ""}><span>${record.includeInProjectionTables ? "Included" : "Excluded"}</span></label>` : "Holding"}</td>
      <td data-label="Actions">${record.recordType === "benchmark" ? `<div class="symbol-actions"><button class="button button--secondary" type="button" data-benchmark-action="edit">Edit label</button><button class="button button--danger" type="button" data-benchmark-action="delete">Delete</button></div>` : "Manage here or in Holdings"}</td>`;
    return row;
  }

  handleInput(event) {
    if (!event.target.matches("[data-symbol-search]")) return;
    this.query = event.target.value;
    const selectionStart = event.target.selectionStart;
    this.render();
    const input = this.root.querySelector("[data-symbol-search]");
    input.focus({ preventScroll: true });
    input.setSelectionRange(selectionStart, selectionStart);
  }

  handleChange(event) {
    if (event.target.matches("[data-symbol-activity]")) {
      this.activity = event.target.value;
      this.render();
      return;
    }
    const toggle = event.target.closest("[data-record-toggle]");
    if (!toggle) return;
    const row = toggle.closest("[data-record-id]");
    const field = toggle.dataset.recordToggle;
    try {
      const result = field === "active"
        ? this.engine.setActive(this.state, row.dataset.recordType, row.dataset.recordId, toggle.checked)
        : this.engine.edit(this.state, row.dataset.recordId, { [field]: toggle.checked });
      this.commit(result.state, `${row.dataset.ticker} ${field === "active" ? (toggle.checked ? "activated" : "deactivated") : "preferences saved"}.`);
    } catch (error) {
      toggle.checked = !toggle.checked;
      this.announce(error.message, true);
    }
  }

  handleClick(event) {
    const button = event.target.closest("[data-benchmark-action]");
    if (!button) return;
    const row = button.closest("[data-record-id]");
    if (button.dataset.benchmarkAction === "add") this.openEditor(button);
    if (button.dataset.benchmarkAction === "edit") this.openEditor(button, row.dataset.recordId);
    if (button.dataset.benchmarkAction === "delete") this.deleteBenchmark(row.dataset.recordId);
  }

  openEditor(trigger, benchmarkId = null) {
    const existing = this.state.benchmarks.find((record) => record.id === benchmarkId);
    const dialog = document.createElement("dialog");
    dialog.className = "portfolio-dialog";
    dialog.innerHTML = `<form method="dialog" class="portfolio-form" novalidate>
      <div class="portfolio-dialog__header"><div><p class="eyebrow">Benchmark</p><h2>${existing ? "Edit display label" : "Add benchmark"}</h2></div><button class="button button--ghost" type="button" data-dialog-cancel>Close</button></div>
      <div class="portfolio-form__errors" role="alert" aria-live="assertive" data-form-errors hidden></div>
      <div class="portfolio-form__grid">
        <label class="portfolio-field"><span>Ticker</span><input name="ticker" value="${escapeHtml(existing?.ticker || "")}" ${existing ? "readonly" : "required"} autocomplete="off" autocapitalize="characters"></label>
        <label class="portfolio-field"><span>Display label</span><input name="label" maxlength="80" value="${escapeHtml(existing?.label || "")}" placeholder="Optional; defaults to Finnhub description"></label>
        ${existing ? "" : '<label class="portfolio-check"><input name="active" type="checkbox" checked><span>Activate after validation</span></label>'}
      </div>
      <p class="form-help">New tickers are validated through Finnhub. Missing local history is reported as quote-only and does not prevent activation.</p>
      <div class="portfolio-dialog__actions"><button class="button button--secondary" type="button" data-dialog-cancel>Cancel</button><button class="button" type="submit">${existing ? "Save label" : "Validate and add"}</button></div>
    </form>`;
    document.body.append(dialog);
    dialog.querySelectorAll("[data-dialog-cancel]").forEach((button) => button.addEventListener("click", () => dialog.close()));
    dialog.addEventListener("close", () => { dialog.remove(); trigger.isConnected && trigger.focus({ preventScroll: true }); }, { once: true });
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      const tickerControl = form.elements.namedItem("ticker");
      const labelControl = form.elements.namedItem("label");
      const activeControl = form.elements.namedItem("active");
      const ticker = String(tickerControl?.value || "").trim().toUpperCase();
      const label = String(labelControl?.value || "").trim();
      try {
        let result;
        if (existing) {
          result = this.engine.edit(this.state, existing.id, { label });
        } else {
          const deleted = this.knownBenchmarksByTicker.get(ticker);
          const input = { ticker, label, active: Boolean(activeControl?.checked) };
          result = deleted
            ? this.engine.restore(this.state, deleted, input)
            : await this.engine.add(this.state, input);
          this.knownBenchmarksByTicker.set(result.benchmark.ticker, { ...result.benchmark });
        }
        if (!existing) {
          this.historyByTicker.set(result.benchmark.ticker, result.validation.historicalStatus);
        }
        this.commit(result.state, existing
          ? `${existing.ticker} label saved.`
          : `${result.benchmark.ticker} added${result.validation.quoteOnly ? " in quote-only mode; no local history is available" : " with local-history status checked"}.`);
        dialog.close();
      } catch (error) {
        const box = form.querySelector("[data-form-errors]");
        box.hidden = false;
        box.textContent = error.message;
        box.focus?.();
        submit.disabled = false;
      }
    });
    dialog.showModal();
    dialog.querySelector(existing ? '[name="label"]' : '[name="ticker"]').focus({ preventScroll: true });
  }

  deleteBenchmark(id) {
    const record = this.state.benchmarks.find((benchmark) => benchmark.id === id);
    if (!record || !this.confirm(`Delete benchmark ${record.ticker}? A same-ticker holding, if present, will remain unchanged.`)) return;
    this.knownBenchmarksByTicker.set(record.ticker, { ...record });
    const result = this.engine.delete(this.state, id);
    this.commit(result.state, `${record.ticker} benchmark deleted. It can be added again later.`);
  }

  commit(nextState, message) {
    this.state = this.saveState(nextState, { incrementEditCount: true });
    this.render();
    this.announce(message);
    window.dispatchEvent(new CustomEvent("mvp:symbol-registry-changed", {
      detail: { registryRevision: this.state.registryRevision, dependentDataState: this.state.dependentDataState }
    }));
  }

  announce(message, error = false) {
    const status = this.root.querySelector("[data-benchmark-status]");
    if (!status) return;
    status.textContent = message;
    status.dataset.error = String(error);
  }

  async refreshHistoryStatuses() {
    const tickers = [...new Set(this.registry().records().map((record) => record.ticker))];
    await Promise.all(tickers.map(async (ticker) => {
      try { this.historyByTicker.set(ticker, await this.historyService.getDatasetStatus(ticker)); }
      catch (_error) { this.historyByTicker.set(ticker, null); }
    }));
    if (this.root.isConnected) this.render();
  }
}

export function initBenchmarkManagement(options = {}) {
  const root = document.querySelector("[data-benchmark-manager]");
  return root ? new BenchmarkManager(root, options).mount() : null;
}

function historyLabel(status) {
  if (status === undefined) return "Checking…";
  if (status === null) return "Status unavailable";
  if (status.available || !["missing", "error"].includes(status.state)) return `Available (${status.state || "local"})`;
  return "Quote-only · no local history";
}

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
