import {
  CHART_DATA_STATES,
  CHART_TIME_FILTERS,
  CHART_TYPES,
  STOOQ_PRICE_RETURN_LABEL,
  chartStateMessage,
  createChartState,
  isRenderableChartState,
  resolvePreparedChartData,
  updateChartState
} from './chart-state.js';
import {
  chartMethodologyLabel,
  createChartContext,
  createChartOption,
  seriesId
} from './chart-options.js';
import { exportChartPng } from './chart-export.js';

export const CHART_THEME_CHANGED_EVENT = 'mvp:chart-theme-changed';
export const CHART_INTERACTION_START_EVENT = 'mvp:chart-interaction-start';
export const CHART_INTERACTION_END_EVENT = 'mvp:chart-interaction-end';

const FUTURE_CHART_TYPES = new Set([
  CHART_TYPES.MONTE_CARLO_CONFIDENCE_FAN,
  CHART_TYPES.MONTE_CARLO_PERCENTILE_BANDS
]);
const MAX_RENDER_WIDTH = 1800;
const MIN_RENDER_WIDTH = 240;
const MIN_RENDER_HEIGHT = 240;
const MAX_RENDER_HEIGHT = 640;

export class ChartManager {
  constructor(root, options = {}) {
    if (!root?.ownerDocument) throw new TypeError('ChartManager requires a chart root element.');
    if (!Object.values(CHART_TYPES).includes(options.type)) {
      throw new TypeError(`Unsupported chart type: ${options.type || 'missing'}`);
    }

    this.root = root;
    this.document = root.ownerDocument;
    this.window = this.document.defaultView || globalThis;
    this.type = options.type;
    this.title = options.title || defaultChartTitle(this.type);
    this.echarts = options.echarts || this.window.echarts;
    this.theme = options.theme || this.document.documentElement.dataset.theme || 'light';
    this.palette = options.palette;
    this.prepared = null;
    this.filteredPrepared = null;
    this.state = createChartState(options.state);
    this.chart = null;
    this.resizeObserver = null;
    this.resizeFrame = null;
    this.orientationTimers = [];
    this.mounted = false;
    this.ownedNodes = [];
    this.exportOptions = options.exportOptions || {};
    this.onTimeFilterChange = typeof options.onTimeFilterChange === 'function'
      ? options.onTimeFilterChange
      : null;
    this.boundThemeChange = (event) => this.setTheme(event.detail?.theme || event.detail || 'light');
    this.boundOrientationChange = () => this.handleOrientationChange();
    this.boundWindowResize = () => this.scheduleResize();
    this.boundInteractionStart = (event) => this.handleInteractionStart(event);
    this.boundInteractionEnd = (event) => this.handleInteractionEnd(event);
  }

  mount() {
    if (this.mounted) this.disposeChart();
    this.buildShell();
    this.mounted = true;
    this.bindResponsiveLifecycle();
    this.render();
    return this;
  }

  setPreparedData(prepared) {
    this.prepared = prepared && typeof prepared === 'object' ? prepared : null;
    this.filteredPrepared = resolvePreparedChartData(this.prepared, this.state.timeFilter);
    const status = this.filteredPrepared?.status || (
      hasPreparedSeries(this.filteredPrepared, this.type)
        ? CHART_DATA_STATES.READY
        : CHART_DATA_STATES.UNAVAILABLE
    );
    this.state = updateChartState(this.state, {
      status,
      message: this.filteredPrepared?.message || chartStateMessage(status),
      updatedAt: this.filteredPrepared?.updatedAt || null,
      visibleSeries: mergeSeriesVisibility(this.state.visibleSeries, this.filteredPrepared)
    });
    this.render();
    return this;
  }

  setStatus(status, message = '') {
    this.state = updateChartState(this.state, {
      status,
      message: message || chartStateMessage(status)
    });
    this.render();
    return this;
  }

  setTimeFilter(timeFilter) {
    if (!CHART_TIME_FILTERS.some((filter) => filter.id === timeFilter)) return this;
    this.state = updateChartState(this.state, { timeFilter });
    this.filteredPrepared = resolvePreparedChartData(this.prepared, timeFilter);
    if (this.filteredPrepared) {
      const status = this.filteredPrepared.status || (
        hasPreparedSeries(this.filteredPrepared, this.type)
          ? CHART_DATA_STATES.READY
          : CHART_DATA_STATES.INSUFFICIENT_HISTORY
      );
      this.state = updateChartState(this.state, {
        status,
        message: this.filteredPrepared.message || chartStateMessage(status),
        visibleSeries: mergeSeriesVisibility(this.state.visibleSeries, this.filteredPrepared)
      });
    }
    this.updateTimeFilterButtons();
    this.onTimeFilterChange?.(timeFilter, this);
    this.root.dispatchEvent(new CustomEvent('mvp:chart-time-filter-changed', {
      bubbles: true,
      detail: { type: this.type, timeFilter }
    }));
    this.render();
    return this;
  }

  setTheme(theme) {
    const normalized = theme === 'dark' ? 'dark' : 'light';
    if (normalized === this.theme && this.chart) return this;
    this.theme = normalized;
    this.disposeChart();
    this.render();
    return this;
  }

  resetZoom() {
    this.state = updateChartState(this.state, { zoom: { start: 0, end: 100 } });
    if (this.chart) {
      this.chart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    }
    return this;
  }

  async exportPng() {
    if (!this.chart || !isRenderableChartState(this.state)) {
      throw new Error('A rendered chart is required before PNG export.');
    }
    return exportChartPng(this.chart, {
      title: this.title,
      backgroundColor: readCssColor(this.root, '--color-surface', this.theme === 'dark' ? '#0f172a' : '#ffffff'),
      ...this.exportOptions
    });
  }

  recreate() {
    this.disposeChart();
    this.render();
    return this;
  }

  disposeChart() {
    if (this.chart) {
      this.chart.off?.('legendselectchanged');
      this.chart.dispose?.();
      this.chart = null;
    }
    if (this.chartSurface && this.echarts?.getInstanceByDom) {
      const orphan = this.echarts.getInstanceByDom(this.chartSurface);
      orphan?.dispose?.();
    }
  }

  destroy() {
    this.disposeChart();
    this.resizeObserver?.disconnect?.();
    this.resizeObserver = null;
    if (this.resizeFrame !== null) this.window.cancelAnimationFrame?.(this.resizeFrame);
    this.resizeFrame = null;
    this.orientationTimers.forEach((timer) => this.window.clearTimeout(timer));
    this.orientationTimers = [];
    this.window.removeEventListener(CHART_THEME_CHANGED_EVENT, this.boundThemeChange);
    this.window.removeEventListener('orientationchange', this.boundOrientationChange);
    this.window.removeEventListener('resize', this.boundWindowResize);
    this.chartSurface?.removeEventListener('pointerdown', this.boundInteractionStart);
    this.chartSurface?.removeEventListener('pointerup', this.boundInteractionEnd);
    this.chartSurface?.removeEventListener('pointercancel', this.boundInteractionEnd);
    this.ownedNodes.forEach((node) => node.remove());
    this.ownedNodes = [];
    this.mounted = false;
  }

  buildShell() {
    this.ownedNodes.forEach((node) => node.remove());
    this.ownedNodes = [];
    this.root.classList.add('chart-shell');
    this.root.dataset.chartType = this.type;

    const heading = element(this.document, 'div', 'chart-shell__heading');
    const title = element(this.document, 'h3', '', this.title);
    const stateLabel = element(this.document, 'span', 'status-pill chart-shell__state', 'Unavailable');
    stateLabel.dataset.chartStateLabel = '';
    heading.append(title, stateLabel);

    const filters = element(this.document, 'div', 'chart-time-filters');
    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', `${this.title} time range`);
    for (const filter of CHART_TIME_FILTERS) {
      const button = element(this.document, 'button', 'button button--secondary chart-time-filter', filter.label);
      button.type = 'button';
      button.dataset.chartTimeFilter = filter.id;
      button.addEventListener('click', () => this.setTimeFilter(filter.id));
      filters.append(button);
    }

    const actions = element(this.document, 'div', 'chart-actions');
    const reset = element(this.document, 'button', 'button button--secondary', 'Reset zoom');
    reset.type = 'button';
    reset.dataset.chartResetZoom = '';
    reset.addEventListener('click', () => this.resetZoom());
    const exportButton = element(this.document, 'button', 'button button--secondary', 'Export PNG');
    exportButton.type = 'button';
    exportButton.dataset.chartExportPng = '';
    exportButton.addEventListener('click', async () => {
      try {
        await this.exportPng();
        this.setActionMessage('PNG export created.');
      } catch (error) {
        this.setActionMessage(error.message, true);
      }
    });
    actions.append(reset, exportButton);

    const seriesControls = element(this.document, 'div', 'chart-series-toggles');
    seriesControls.dataset.chartSeriesToggles = '';
    seriesControls.setAttribute('aria-label', `${this.title} visible series`);

    const viewport = element(this.document, 'div', 'chart-viewport');
    const surface = element(this.document, 'div', 'chart-surface');
    surface.dataset.chartSurface = '';
    surface.setAttribute('role', 'img');
    surface.setAttribute('aria-label', this.title);
    surface.tabIndex = 0;
    const overlay = element(this.document, 'div', 'chart-state-overlay');
    overlay.dataset.chartStateOverlay = '';
    overlay.setAttribute('role', 'status');
    viewport.append(surface, overlay);

    const methodology = element(this.document, 'p', 'chart-methodology');
    methodology.dataset.chartMethodology = '';
    const summary = element(this.document, 'p', 'chart-summary');
    summary.dataset.chartSummary = '';
    const actionMessage = element(this.document, 'p', 'chart-action-message');
    actionMessage.dataset.chartActionMessage = '';
    actionMessage.setAttribute('role', 'status');
    actionMessage.setAttribute('aria-live', 'polite');

    this.root.append(heading, filters, actions, seriesControls, viewport, methodology, summary, actionMessage);
    this.ownedNodes.push(heading, filters, actions, seriesControls, viewport, methodology, summary, actionMessage);
    this.chartSurface = surface;
    this.stateOverlay = overlay;
    this.stateLabel = stateLabel;
    this.seriesControls = seriesControls;
    this.resetButton = reset;
    this.exportButton = exportButton;
    this.methodologyNode = methodology;
    this.summaryNode = summary;
    this.actionMessageNode = actionMessage;

    surface.addEventListener('pointerdown', this.boundInteractionStart);
    surface.addEventListener('pointerup', this.boundInteractionEnd);
    surface.addEventListener('pointercancel', this.boundInteractionEnd);
    this.updateTimeFilterButtons();
  }

  render() {
    if (!this.mounted) return;
    this.filteredPrepared = resolvePreparedChartData(this.prepared, this.state.timeFilter) || this.filteredPrepared;
    const futurePlaceholder = FUTURE_CHART_TYPES.has(this.type) && !this.prepared;
    const status = futurePlaceholder ? CHART_DATA_STATES.UNAVAILABLE : this.state.status;
    const message = futurePlaceholder
      ? 'Container ready for prepared Monte Carlo percentile data from Phase 8.'
      : this.state.message;

    this.renderState(status, message);
    this.renderSeriesControls();
    this.renderTextAlternatives();

    if (!isRenderableChartState(status)) {
      if (status === CHART_DATA_STATES.LOADING && this.ensureChart()) {
        this.chart.showLoading?.('default', { text: message });
      } else {
        this.chart?.hideLoading?.();
        this.chart?.clear?.();
      }
      return;
    }

    if (!this.ensureChart()) {
      this.renderState(CHART_DATA_STATES.UNAVAILABLE, 'Apache ECharts failed to load. Check the network and reload.');
      return;
    }

    this.chart.hideLoading?.();
    const context = createChartContext(this.root, {
      palette: this.palette,
      disableHorizontalPan: Boolean(this.root.closest('[data-swipeable-tabs]')),
      visibleSeries: this.state.visibleSeries,
      zoom: this.state.zoom,
      reduceMotion: this.window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    });
    this.chart.setOption(createChartOption(this.type, this.filteredPrepared || {}, context), true);
    this.bindChartEvents();
    this.scheduleResize();
  }

  ensureChart() {
    if (this.chart) return this.chart;
    if (!this.echarts) this.echarts = this.window.echarts;
    if (!this.echarts?.init || !this.chartSurface) return null;
    const orphan = this.echarts.getInstanceByDom?.(this.chartSurface);
    orphan?.dispose?.();
    const devicePixelRatio = Math.min(2, Math.max(1, Number(this.window.devicePixelRatio) || 1));
    this.chart = this.echarts.init(this.chartSurface, this.theme, {
      renderer: 'canvas',
      devicePixelRatio
    });
    return this.chart;
  }

  bindChartEvents() {
    if (!this.chart?.on) return;
    this.chart.off?.('legendselectchanged');
    this.chart.on('legendselectchanged', (event) => {
      const series = preparedSeries(this.filteredPrepared, this.type);
      const nextVisibility = { ...this.state.visibleSeries };
      series.forEach((entry, index) => {
        nextVisibility[seriesId(entry, index)] = event.selected?.[entry.name] !== false;
      });
      this.state = updateChartState(this.state, { visibleSeries: nextVisibility });
      this.syncSeriesToggles();
    });
  }

  renderState(status, message) {
    const label = statusLabel(status);
    this.stateLabel.textContent = label;
    this.stateLabel.dataset.state = status;
    this.stateOverlay.textContent = message || label;
    const showOverlay = !isRenderableChartState(status) || status === CHART_DATA_STATES.STALE || status === CHART_DATA_STATES.QUALITY_WARNING;
    this.stateOverlay.hidden = !showOverlay;
    this.stateOverlay.classList.toggle('chart-state-overlay--warning', isRenderableChartState(status));
    this.exportButton.disabled = !isRenderableChartState(status);
    this.resetButton.disabled = !isRenderableChartState(status) || this.type === CHART_TYPES.ALLOCATION;
  }

  renderSeriesControls() {
    const series = preparedSeries(this.filteredPrepared, this.type);
    this.seriesControls.replaceChildren();
    this.seriesControls.hidden = series.length < 2;
    if (series.length < 2) return;

    series.forEach((entry, index) => {
      const id = seriesId(entry, index);
      const label = element(this.document, 'label', 'chart-series-toggle');
      const input = element(this.document, 'input');
      input.type = 'checkbox';
      input.checked = this.state.visibleSeries[id] !== false;
      input.dataset.chartSeriesId = id;
      input.addEventListener('change', () => {
        this.state = updateChartState(this.state, {
          visibleSeries: { ...this.state.visibleSeries, [id]: input.checked }
        });
        this.chart?.dispatchAction?.({
          type: input.checked ? 'legendSelect' : 'legendUnSelect',
          name: entry.name
        });
      });
      label.append(input, this.document.createTextNode(String(entry.name || id)));
      this.seriesControls.append(label);
    });
  }

  syncSeriesToggles() {
    this.seriesControls.querySelectorAll('[data-chart-series-id]').forEach((input) => {
      input.checked = this.state.visibleSeries[input.dataset.chartSeriesId] !== false;
    });
  }

  renderTextAlternatives() {
    const prepared = this.filteredPrepared || {};
    const methodology = chartMethodologyLabel(prepared);
    this.methodologyNode.textContent = methodology;
    this.methodologyNode.hidden = !methodology;
    this.summaryNode.textContent = String(prepared.summary || createBasicSummary(prepared, this.type));
    this.summaryNode.hidden = !this.summaryNode.textContent;
    const ariaDescription = [this.title, this.summaryNode.textContent, methodology].filter(Boolean).join('. ');
    this.chartSurface.setAttribute('aria-label', ariaDescription || this.title);
  }

  updateTimeFilterButtons() {
    this.root.querySelectorAll('[data-chart-time-filter]').forEach((button) => {
      const active = button.dataset.chartTimeFilter === this.state.timeFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  bindResponsiveLifecycle() {
    this.resizeObserver?.disconnect?.();
    this.window.removeEventListener('resize', this.boundWindowResize);
    this.window.removeEventListener('orientationchange', this.boundOrientationChange);
    this.window.removeEventListener(CHART_THEME_CHANGED_EVENT, this.boundThemeChange);
    if (typeof this.window.ResizeObserver === 'function') {
      this.resizeObserver = new this.window.ResizeObserver(() => this.scheduleResize());
      this.resizeObserver.observe(this.root);
    } else {
      this.window.addEventListener('resize', this.boundWindowResize, { passive: true });
    }
    this.window.addEventListener('orientationchange', this.boundOrientationChange, { passive: true });
    this.window.addEventListener(CHART_THEME_CHANGED_EVENT, this.boundThemeChange);
  }

  scheduleResize() {
    if (!this.chart || this.resizeFrame !== null) return;
    const requestFrame = this.window.requestAnimationFrame || ((callback) => this.window.setTimeout(callback, 16));
    this.resizeFrame = requestFrame(() => {
      this.resizeFrame = null;
      if (!this.chart || !this.chartSurface?.isConnected) return;
      const width = clamp(this.chartSurface.clientWidth, MIN_RENDER_WIDTH, MAX_RENDER_WIDTH);
      const height = clamp(this.chartSurface.clientHeight, MIN_RENDER_HEIGHT, MAX_RENDER_HEIGHT);
      if (Number.isFinite(width) && Number.isFinite(height)) {
        this.chart.resize?.({ width, height, animation: { duration: 0 } });
      }
    });
  }

  handleOrientationChange() {
    this.orientationTimers.forEach((timer) => this.window.clearTimeout(timer));
    this.orientationTimers = [80, 280].map((delay) => this.window.setTimeout(() => this.scheduleResize(), delay));
  }

  handleInteractionStart(event) {
    if (!this.root.closest('[data-swipeable-tabs]')) event.stopPropagation();
    this.root.dataset.chartInteracting = 'true';
    this.root.dispatchEvent(new CustomEvent(CHART_INTERACTION_START_EVENT, {
      bubbles: true,
      detail: { type: this.type }
    }));
  }

  handleInteractionEnd(event) {
    if (!this.root.closest('[data-swipeable-tabs]')) event.stopPropagation();
    delete this.root.dataset.chartInteracting;
    this.root.dispatchEvent(new CustomEvent(CHART_INTERACTION_END_EVENT, {
      bubbles: true,
      detail: { type: this.type }
    }));
  }

  setActionMessage(message, isError = false) {
    this.actionMessageNode.textContent = message;
    this.actionMessageNode.dataset.status = isError ? 'error' : 'ok';
  }
}

export function mountChartManagers(root = document, options = {}) {
  const managers = new Map();
  root.querySelectorAll('[data-chart-type]').forEach((element) => {
    const type = element.dataset.chartType;
    if (!Object.values(CHART_TYPES).includes(type)) return;
    const manager = new ChartManager(element, {
      ...options,
      type,
      title: element.dataset.chartTitle || defaultChartTitle(type),
      state: {
        status: element.dataset.chartInitialState || CHART_DATA_STATES.UNAVAILABLE,
        message: element.dataset.chartStateMessage || ''
      }
    }).mount();
    managers.set(type, manager);
  });
  return managers;
}

function preparedSeries(prepared, type) {
  if (!prepared) return [];
  if (type === CHART_TYPES.ALLOCATION) return Array.isArray(prepared.series) ? prepared.series : [];
  return Array.isArray(prepared.series) ? prepared.series : [];
}

function hasPreparedSeries(prepared, type) {
  return preparedSeries(prepared, type).length > 0;
}

function mergeSeriesVisibility(current, prepared) {
  const next = { ...current };
  preparedSeries(prepared).forEach((entry, index) => {
    const id = seriesId(entry, index);
    if (!(id in next)) next[id] = entry.visible !== false;
  });
  return next;
}

function createBasicSummary(prepared, type) {
  const series = preparedSeries(prepared, type);
  if (!series.length) return '';
  if (type === CHART_TYPES.ALLOCATION) {
    return `Allocation chart with ${series.length} prepared categories. Values are supplied by the portfolio module.`;
  }
  return `${series.length} prepared series shown for the selected time range. Values are supplied by upstream data and analytics modules.`;
}

function statusLabel(status) {
  return ({
    [CHART_DATA_STATES.READY]: 'Ready',
    [CHART_DATA_STATES.LOADING]: 'Loading',
    [CHART_DATA_STATES.UNAVAILABLE]: 'Unavailable',
    [CHART_DATA_STATES.QUOTE_ONLY]: 'Quote only',
    [CHART_DATA_STATES.INSUFFICIENT_HISTORY]: 'Insufficient history',
    [CHART_DATA_STATES.STALE]: 'Stale',
    [CHART_DATA_STATES.QUALITY_WARNING]: 'Quality warning'
  })[status] || 'Unavailable';
}

function defaultChartTitle(type) {
  return ({
    [CHART_TYPES.COMPARISON]: 'Portfolio vs. benchmarks',
    [CHART_TYPES.ACCOUNT_VALUE]: 'Portfolio account-value growth',
    [CHART_TYPES.ALLOCATION]: 'Portfolio allocation',
    [CHART_TYPES.DRAWDOWN]: 'Portfolio drawdown',
    [CHART_TYPES.MONTE_CARLO_CONFIDENCE_FAN]: 'Monte Carlo confidence fan',
    [CHART_TYPES.MONTE_CARLO_PERCENTILE_BANDS]: 'Monte Carlo percentile bands'
  })[type] || 'Portfolio chart';
}

function element(ownerDocument, tagName, className = '', text = '') {
  const node = ownerDocument.createElement(tagName);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function readCssColor(node, property, fallback) {
  const styles = node.ownerDocument.defaultView?.getComputedStyle?.(node);
  return styles?.getPropertyValue(property)?.trim() || fallback;
}

function clamp(value, min, max) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
}

export { CHART_DATA_STATES, CHART_TIME_FILTERS, CHART_TYPES, STOOQ_PRICE_RETURN_LABEL };
