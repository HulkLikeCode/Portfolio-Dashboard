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
import {
  PROJECTION_HORIZON_CHANGED_EVENT,
  applyProjectionHorizonToMonteCarloInputs,
  createProjectionRunSnapshot,
  createProjectionExportMetadata,
  getProjectionContext,
  initProjectionHorizonControls,
  validateAcceptedProjectionResult
} from './settings/projection-settings.js';
import { createConfidenceFanPreparedData } from './charts/mc-confidence-fan.js';
import { createPercentileBandsPreparedData } from './charts/mc-percentile-bands.js';
import { initFullBackupManager } from './ui/full-backup-manager.js';
import { ExportManager } from './export/export-manager.js';
import { runCapabilityChecks } from './diagnostics/capabilities.js';

const APP_VERSION = '0.2.3-v2.3-phase-5a';
const chartManagers = new Map();
const activeProjectionRuns = new Map();
let acceptedProjectionResult = null;
let exportManager = null;

document.addEventListener('DOMContentLoaded', () => {
  bootstrapApp();
});

function bootstrapApp() {
  ensureSetupWizardStyles();
  const state = loadSettingsState();
  applyDisplayPreferences(state);
  renderPhaseOneShellState(state);
  initProjectionHorizonControls(document);
  wireShellActions();
  initPortfolioPhase3B();
  initBenchmarkManagement();
  initCharts();
  initConfigurationBackupControls();
  renderDependentDataState(state);
  initRuntimeDiagnostics();
  registerServiceWorker();
  initSetupWizard();
  initFullBackupManager();
}

function renderDependentDataState(state) {
  const dependent = state.dependentDataState || {};
  document.querySelectorAll('[data-dependent-status]').forEach((node) => {
    const key = node.dataset.dependentStatus;
    if (dependent[key] === 'stale') {
      node.textContent = staleStatusMessage(dependent.staleReason);
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
  window.addEventListener('mvp:portable-restore', (event) => {
    renderPhaseOneShellState(event.detail.state);
    renderDependentDataState(event.detail.state);
    invalidateProjectionOutputs('Stale after portable restore. Run a new simulation to refresh this visual.');
  });
  window.addEventListener('mvp:chart-data-ready', (event) => {
    const manager = chartManagers.get(event.detail?.type);
    if (manager) manager.setPreparedData(event.detail.prepared);
  });
  window.addEventListener('mvp:monte-carlo-result', (event) => {
    const result = event.detail?.result;
    const context = event.detail?.projectionContext || getProjectionContext(loadSettingsState());
    const accepted = validateAcceptedProjectionResult(result, context);
    if (!accepted.accepted) {
      invalidateProjectionOutputs(accepted.error);
      return;
    }
    acceptedProjectionResult = accepted.value;
    chartManagers.get('monte-carlo-confidence-fan')?.setPreparedData(createConfidenceFanPreparedData(accepted.value, accepted.value.projectionContext));
    chartManagers.get('monte-carlo-percentile-bands')?.setPreparedData(createPercentileBandsPreparedData(accepted.value, accepted.value.projectionContext));
    publishProjectionMetadata(accepted.value.projectionContext, 'accepted-simulation');
  });
  window.addEventListener('mvp:monte-carlo-run-approved', (event) => {
    const detail = event.detail || {};
    const outcome = startApprovedProjection(detail);
    detail.respond?.(outcome);
  });
  window.addEventListener(PROJECTION_HORIZON_CHANGED_EVENT, (event) => {
    const context = event.detail;
    renderPhaseOneShellState(loadSettingsState());
    activeProjectionRuns.forEach((run) => {
      run.controller.markInputsChanged(
        applyProjectionHorizonToMonteCarloInputs(run.rawInputs, context.horizonYears),
        run.alignedHistory
      );
    });
    activeProjectionRuns.clear();
    invalidateProjectionOutputs('Projection horizon changed. Run or approve a new simulation to refresh this visual.');
    renderDependentDataState({ dependentDataState: { simulations: 'stale', staleReason: 'projection-horizon-changed' } });
    publishProjectionMetadata(context, 'projection-horizon-changed');
  });
}

/**
 * Existing Monte Carlo UI may dispatch mvp:monte-carlo-run-approved with its
 * controller, raw inputs, and aligned history. This bridge is deliberately
 * presentation-free: it snapshots the global setting, starts only on explicit
 * approval, and emits only controller-completed output.
 */
export function startApprovedProjection({ controller, rawInputs, alignedHistory, startDate = new Date() } = {}) {
  if (!controller || typeof controller.start !== 'function' || typeof controller.subscribe !== 'function') {
    return { accepted: false, errors: [{ code: 'MONTE_CARLO_CONTROLLER_REQUIRED', message: 'An approved Monte Carlo controller is required.' }] };
  }
  const snapshot = createProjectionRunSnapshot(loadSettingsState(), startDate);
  let inputs;
  try {
    inputs = applyProjectionHorizonToMonteCarloInputs(rawInputs, snapshot.context.horizonYears);
  } catch (error) {
    return { accepted: false, errors: [{ code: 'PROJECTION_HORIZON_INVALID', message: error.message }] };
  }
  const outcome = controller.start(inputs, alignedHistory);
  if (!outcome.accepted) return outcome;

  const unsubscribe = controller.subscribe((state) => {
    if (state.status === 'completed') {
      unsubscribe();
      activeProjectionRuns.delete(outcome.runId);
      window.dispatchEvent(new CustomEvent('mvp:monte-carlo-result', {
        detail: { result: state.result, projectionContext: snapshot.context, acceptedByController: true }
      }));
    } else if (['stale', 'cancelled', 'failed'].includes(state.status)) {
      unsubscribe();
      activeProjectionRuns.delete(outcome.runId);
    }
  });
  activeProjectionRuns.set(outcome.runId, { controller, rawInputs, alignedHistory, snapshot, unsubscribe });
  return { ...outcome, projectionContext: snapshot.context, exportMetadata: snapshot.exportMetadata };
}

function invalidateProjectionOutputs(message) {
  acceptedProjectionResult = null;
  ['monte-carlo-confidence-fan', 'monte-carlo-percentile-bands'].forEach((type) => {
    const manager = chartManagers.get(type);
    manager?.setPreparedData(null);
    manager?.setStatus(CHART_DATA_STATES.STALE, message);
  });
}

function publishProjectionMetadata(context, reason) {
  const detail = Object.freeze({ ...createProjectionExportMetadata(context), reason });
  window.dispatchEvent(new CustomEvent('mvp:projection-export-context', { detail }));
  window.dispatchEvent(new CustomEvent('mvp:projection-backup-metadata-ready', { detail }));
}

function staleStatusMessage(reason) {
  return reason === 'projection-horizon-changed' ? 'Stale after projection horizon change' : 'Stale after portfolio edit';
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
  exportManager = new ExportManager();
  mountChartManagers(document, {
    echarts: window.echarts,
    theme: getEffectiveTheme(loadSettingsState()),
    exportManager
  }).forEach((manager, type) => { chartManagers.set(type, manager); exportManager.registerChart(manager); });

  const projectionContext = getProjectionContext(loadSettingsState());
  ['monte-carlo-confidence-fan', 'monte-carlo-percentile-bands'].forEach((type) => {
    const manager = chartManagers.get(type);
    if (manager) manager.projectionContext = projectionContext;
  });

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

function initConfigurationBackupControls() {
  const exportButton = document.querySelector('[data-configuration-backup-export]');
  const fileInput = document.querySelector('[data-configuration-backup-file]');
  const restoreButton = document.querySelector('[data-configuration-backup-restore]');
  const status = document.querySelector('[data-configuration-backup-status]');
  const reminder = document.querySelector('[data-configuration-backup-reminder]');
  const reminderMessage = document.querySelector('[data-configuration-backup-reminder-message]');
  const dismissReminder = document.querySelector('[data-configuration-backup-reminder-dismiss]');
  let pending = null;
  const show = (message, error = false) => { if (status) { status.textContent = message; status.dataset.status = error ? 'error' : 'ok'; } };
  const refreshReminder = () => {
    if (!reminder || !exportManager) return;
    const due = exportManager.reminder(loadSettingsState());
    reminder.hidden = !due.due;
    if (due.due && reminderMessage) reminderMessage.textContent = 'Backup reminder: export a configuration or full portable backup now.';
  };
  exportButton?.addEventListener('click', async () => { try { await exportManager.exportConfiguration(); show('Configuration backup exported. Historical data was not included.'); refreshReminder(); } catch (error) { show(error.message, true); } });
  fileInput?.addEventListener('change', async () => {
    try { pending = await fileInput.files?.[0]?.text(); if (!pending) return; const preview = exportManager.validateConfiguration(pending); restoreButton.disabled = false; show(`Validated configuration backup from ${preview.createdAt}. Historical data will remain unchanged.`); } catch (error) { pending = null; restoreButton.disabled = true; show(error.message, true); }
  });
  restoreButton?.addEventListener('click', async () => { try { if (!pending) throw new Error('Choose a configuration backup first.'); await exportManager.restoreConfiguration(pending); restoreButton.disabled = true; show('Configuration restored. Existing historical data was preserved.'); } catch (error) { show(error.message, true); } });
  dismissReminder?.addEventListener('click', () => { exportManager.dismissReminder(); refreshReminder(); });
  refreshReminder();
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
  const status = document.getElementById('sw-status');
  if (!('serviceWorker' in navigator)) {
    if (status) status.textContent = 'Unavailable — offline shell cannot be installed.';
    return;
  }

  navigator.serviceWorker.register('./service-worker.js').then((registration) => {
    if (status) status.textContent = navigator.serviceWorker.controller
      ? 'Active — static shell is available offline after this visit.'
      : 'Installed — reload once to place this page under service-worker control.';
    const announceUpdate = () => {
      if (!registration.waiting) return;
      if (status) status.textContent = 'Update downloaded — reload to activate the new offline shell.';
      document.dispatchEvent(new CustomEvent('mvp:service-worker-update-ready'));
    };
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', announceUpdate);
    });
    announceUpdate();
  }).catch(() => {
    if (status) status.textContent = 'Registration failed — offline shell unavailable.';
  });
}

function initRuntimeDiagnostics() {
  const availability = document.getElementById('runtime-availability-status');
  const persisted = document.getElementById('storage-persisted-status');
  const estimate = document.getElementById('storage-estimate-status');
  const warning = document.querySelector('[data-storage-warning]');
  const persistButton = document.querySelector('[data-storage-persist]');

  const setAvailability = () => {
    const controlled = Boolean(navigator.serviceWorker?.controller);
    const state = navigator.onLine
      ? (controlled ? 'Internet available; Pages host and Finnhub are checked separately. Cached local history remains available.' : 'Internet available; offline shell is not controlling this page yet.')
      : (controlled ? 'Internet unavailable — offline shell active; local history and cached quotes may be available and stale.' : 'Internet unavailable — this page has no controlled offline shell.');
    if (availability) availability.textContent = state;
    if (navigator.onLine) checkPagesReachability();
  };

  const checkPagesReachability = async () => {
    try {
      const probe = new URL('./manifest.json', window.location.href);
      probe.searchParams.set('__pages_healthcheck', Date.now().toString());
      const response = await fetch(probe, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (availability) availability.textContent = 'Internet and GitHub Pages host available. Finnhub availability is reported separately; local history remains local.';
    } catch (_) {
      const controlled = Boolean(navigator.serviceWorker?.controller);
      if (availability) availability.textContent = controlled
        ? 'GitHub Pages host unavailable — offline shell and local history may still be available; app updates and uncached assets are unavailable.'
        : 'GitHub Pages host unavailable — no controlled offline shell is available on this page.';
    }
  };

  const refreshStorage = async () => {
    if (!navigator.storage) {
      if (persisted) persisted.textContent = 'Unavailable — this browser does not expose StorageManager.';
      if (estimate) estimate.textContent = 'Unavailable.';
      if (warning) warning.textContent = 'Persistent storage cannot be requested here. Keep a credential-free full portable backup.';
      if (persistButton) persistButton.disabled = true;
      return;
    }
    try {
      const [isPersisted, storageEstimate] = await Promise.all([
        navigator.storage.persisted?.(),
        navigator.storage.estimate?.()
      ]);
      if (persisted) persisted.textContent = isPersisted
        ? 'Granted — browser marks local data as persistent.'
        : 'Not granted — browser may evict local data when storage is constrained.';
      if (estimate) estimate.textContent = Number.isFinite(storageEstimate?.quota)
        ? `${formatBytes(storageEstimate?.usage)} used of ${formatBytes(storageEstimate.quota)} estimated quota.`
        : 'Unavailable — browser did not provide an estimate.';
      if (warning) warning.textContent = isPersisted
        ? 'Persistent storage is granted. Continue making credential-free backups before device changes.'
        : 'Persistent storage is not granted. Request it below and keep a credential-free full portable backup.';
      if (persistButton) persistButton.disabled = typeof navigator.storage.persist !== 'function' || Boolean(isPersisted);
    } catch (_) {
      if (persisted) persisted.textContent = 'Unavailable — persistence status could not be read.';
      if (estimate) estimate.textContent = 'Unavailable — storage estimate could not be read.';
      if (warning) warning.textContent = 'Storage status is unavailable. Keep a credential-free full portable backup.';
    }
  };

  persistButton?.addEventListener('click', async () => {
    if (typeof navigator.storage?.persist !== 'function') return;
    persistButton.disabled = true;
    try { await navigator.storage.persist(); } finally { await refreshStorage(); }
  });
  window.addEventListener('online', setAvailability);
  window.addEventListener('offline', setAvailability);
  window.addEventListener('mvp:live-data-status', (event) => {
    const detail = event.detail || {};
    if (!availability) return;
    const state = detail.state || detail.availability;
    if (state === 'stale') availability.textContent = 'Finnhub unavailable — cached quote data is available but stale. Local history remains available separately.';
    else if (state === 'offline') availability.textContent = 'Finnhub unavailable because internet access is unavailable; local history and cached quotes may still render.';
    else if (state) availability.textContent = `Finnhub ${String(state).replaceAll('-', ' ')}. GitHub Pages and local-history status are separate.`;
  });
  navigator.serviceWorker?.addEventListener('controllerchange', setAvailability);
  setAvailability();
  refreshStorage();
  populateCapabilityDiagnostics();
}

async function populateCapabilityDiagnostics() {
  const report = await runCapabilityChecks();
  const ids = {
    localStorage: 'capability-local-storage', indexedDB: 'capability-indexed-db',
    webWorkers: 'capability-web-workers', fetch: 'capability-fetch', echarts: 'capability-echarts'
  };
  Object.entries(ids).forEach(([key, id]) => {
    const node = document.getElementById(id);
    if (node && report.checks[key]) node.textContent = report.checks[key].message;
  });
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
}
