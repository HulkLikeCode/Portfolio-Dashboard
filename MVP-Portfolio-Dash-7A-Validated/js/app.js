import {
  applyDisplayPreferences,
  getEffectiveTheme,
  loadSettingsState,
  saveSettingsState
} from './settings/settings-state.js';
import { SYMBOL_REGISTRY_CHANGED_EVENT } from './core/symbol-registry.js';
import { initSetupWizard, openSetupWizard } from './ui/setup-wizard.js';
import { initPortfolioPhase3B } from './ui/portfolio-phase-3b.js?v=0.2.3-phase-3b-2';
import { initBenchmarkManagement } from './ui/benchmark-manager.js?v=0.2.3-phase-4a-3';
import {
  CHART_DATA_STATES,
  CHART_THEME_CHANGED_EVENT,
  mountChartManagers
} from './charts/chart-manager.js';

const APP_VERSION = '0.2.3-v2.3-phase-5a';
const chartManagers = new Map();

document.addEventListener('DOMContentLoaded', () => {
  bootstrapApp();
});

function bootstrapApp() {
  ensureSetupWizardStyles();
  const state = loadSettingsState();
  applyDisplayPreferences(state);
  renderPhaseOneShellState(state);
  wireShellActions();
  initPortfolioPhase3B();
  initBenchmarkManagement();
  initCharts();
  renderDependentDataState(state);
  registerServiceWorker();
  initSetupWizard();
}

function renderDependentDataState(state) {
  const dependent = state.dependentDataState || {};
  document.querySelectorAll('[data-dependent-status]').forEach((node) => {
    const key = node.dataset.dependentStatus;
    if (dependent[key] === 'stale') {
      node.textContent = 'Stale after portfolio edit';
      node.classList.add('status-pill--warning');
    }
  });
}

function ensureSetupWizardStyles() {
  if (document.querySelector('link[href$="css/setup-wizard.css"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './css/setup-wizard.css';
  document.head.append(link);
}

function renderPhaseOneShellState(state) {
  const setupStatus = document.querySelector('[data-setup-status]');
  if (setupStatus) setupStatus.textContent = state.setup.completed ? 'Setup complete' : 'Setup incomplete';

  const activeSymbols = document.querySelector('[data-active-symbols]');
  if (activeSymbols) activeSymbols.textContent = state.activeSymbols.length ? state.activeSymbols.join(', ') : 'None';

  const projectionHorizon = document.querySelector('[data-projection-horizon]');
  if (projectionHorizon) projectionHorizon.textContent = `${state.projectionHorizonYears} years`;

  const themeLabel = document.querySelector('[data-theme-label]');
  if (themeLabel) themeLabel.textContent = state.theme;

  const versionNodes = document.querySelectorAll('[data-app-version]');
  versionNodes.forEach((node) => {
    node.textContent = APP_VERSION;
  });
}

function wireShellActions() {
  wireThemeChoices();
  wirePanelNavigation();

  document.querySelectorAll('[data-action="open-setup-wizard"]').forEach((button) => {
    button.addEventListener('click', () => openSetupWizard());
  });

  window.addEventListener('mvp:portfolio-changed', (event) => {
    renderDependentDataState({ dependentDataState: event.detail?.dependentDataState });
  });
  window.addEventListener(SYMBOL_REGISTRY_CHANGED_EVENT, (event) => {
    renderDependentDataState({ dependentDataState: event.detail?.dependentDataState });
  });
  window.addEventListener('mvp:chart-data-ready', (event) => {
    const manager = chartManagers.get(event.detail?.type);
    if (manager) manager.setPreparedData(event.detail.prepared);
  });
}

function wireThemeChoices() {
  const buttons = Array.from(document.querySelectorAll('[data-theme-choice]'));
  if (!buttons.length) return;

  const setActiveChoice = (theme) => {
    buttons.forEach((button) => {
      const isActive = button.dataset.themeChoice === theme;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  };

  const currentState = loadSettingsState();
  setActiveChoice(currentState.theme);

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const theme = button.dataset.themeChoice;
      if (!['system', 'light', 'dark'].includes(theme)) return;

      const nextState = loadSettingsState();
      nextState.theme = theme;
      applyDisplayPreferences(nextState);
      setActiveChoice(theme);
      window.dispatchEvent(new CustomEvent(CHART_THEME_CHANGED_EVENT, {
        detail: { theme: getEffectiveTheme(theme) }
      }));

      try {
        saveSettingsState(nextState, { incrementEditCount: false });
      } catch (error) {
        // The selected theme still applies for this page when storage is blocked.
      }
    });
  });

  const systemTheme = window.matchMedia?.('(prefers-color-scheme: dark)');
  systemTheme?.addEventListener?.('change', () => {
    const nextState = loadSettingsState();
    if (nextState.theme !== 'system') return;
    applyDisplayPreferences(nextState);
    setActiveChoice('system');
    window.dispatchEvent(new CustomEvent(CHART_THEME_CHANGED_EVENT, {
      detail: { theme: getEffectiveTheme(nextState) }
    }));
  });
}

function initCharts() {
  chartManagers.forEach((manager) => manager.destroy());
  chartManagers.clear();
  mountChartManagers(document, {
    echarts: window.echarts,
    theme: getEffectiveTheme(loadSettingsState())
  }).forEach((manager, type) => chartManagers.set(type, manager));

  window.addEventListener('mvp:portfolio-changed', () => {
    chartManagers.forEach((manager) => {
      if (manager.chart) {
        manager.setStatus(CHART_DATA_STATES.STALE, 'Portfolio inputs changed. Supply refreshed prepared series to update this chart.');
      }
    });
  });
  window.addEventListener(SYMBOL_REGISTRY_CHANGED_EVENT, () => {
    const comparison = chartManagers.get('comparison');
    if (comparison?.chart) {
      comparison.setStatus(CHART_DATA_STATES.STALE, 'Benchmark inputs changed. Supply refreshed prepared series to update this chart.');
    }
  });
}

function wirePanelNavigation() {
  const buttons = Array.from(document.querySelectorAll('[data-panel-target]'));
  const panels = Array.from(document.querySelectorAll('[data-panel]'));
  if (!buttons.length || !panels.length) return;

  const showPanel = (target) => {
    const targetPanel = document.getElementById(`panel-${target}`);
    if (!targetPanel) return;

    panels.forEach((panel) => {
      panel.hidden = panel !== targetPanel;
    });

    buttons.forEach((button) => {
      const isActive = button.dataset.panelTarget === target;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', String(isActive));
    });
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => showPanel(button.dataset.panelTarget));
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./service-worker.js').catch(() => {
    const status = document.querySelector('[data-service-worker-status]');
    if (status) status.textContent = 'Service worker registration failed';
  });
}
