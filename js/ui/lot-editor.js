const FIELD_LABELS = {
  shares: 'Shares',
  purchasePricePerShare: 'Purchase price per share',
  acquisitionDate: 'Acquisition date',
  auditNote: 'Audit note'
};

export function openLotEditor(options) {
  const mode = options.mode || 'add';
  const existing = options.lot || {};
  const isManualAdjustment = mode === 'manual-adjustment';
  const dialog = document.createElement('dialog');
  dialog.className = 'portfolio-dialog';
  dialog.setAttribute('aria-labelledby', 'lot-editor-title');
  dialog.innerHTML = `
    <form method="dialog" class="portfolio-form" novalidate>
      <div class="portfolio-dialog__header">
        <div>
          <p class="eyebrow">${isManualAdjustment ? 'Corporate action' : 'Acquisition lot'}</p>
          <h2 id="lot-editor-title">${escapeHtml(lotEditorTitle(mode, options.ticker))}</h2>
        </div>
        <button class="button button--ghost" type="button" data-dialog-cancel aria-label="Close editor">Close</button>
      </div>
      ${isManualAdjustment ? manualNotice() : ''}
      <div class="portfolio-form__errors" data-form-errors role="alert" aria-live="assertive" tabindex="-1" hidden></div>
      <div class="portfolio-form__grid">
        ${numberField('shares', 'Shares', existing.shares, 'any')}
        ${numberField('purchasePricePerShare', 'Purchase price per share', existing.purchasePricePerShare, 'any')}
        ${dateField(existing.acquisitionDate)}
        ${textAreaField(existing.auditNote || '', isManualAdjustment)}
      </div>
      ${isManualAdjustment ? comparisonMarkup(existing) : ''}
      <div class="portfolio-dialog__actions">
        <button class="button button--secondary" type="button" data-dialog-cancel>Cancel</button>
        <button class="button" type="submit">${isManualAdjustment ? 'Save manual adjustment' : mode === 'add' ? 'Add lot' : 'Save lot'}</button>
      </div>
    </form>`;

  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const cancelButtons = dialog.querySelectorAll('[data-dialog-cancel]');
  const restoreFocus = () => {
    dialog.remove();
    if (options.trigger?.isConnected) {
      options.trigger.focus({ preventScroll: true });
    } else if (typeof options.restoreFocus === 'function') {
      options.restoreFocus();
    }
  };

  cancelButtons.forEach((button) => button.addEventListener('click', () => dialog.close('cancel')));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dialog.close('cancel');
  });
  dialog.addEventListener('close', restoreFocus, { once: true });

  if (isManualAdjustment) {
    form.addEventListener('input', () => updateComparison(form, existing));
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = readLotForm(form);
    if (isManualAdjustment && !values.auditNote) {
      showFormErrors(form, [{ message: 'Add an audit note describing the manual corporate-action adjustment.', field: 'auditNote' }]);
      return;
    }
    try {
      const result = options.onSubmit(values);
      if (result && typeof result.then === 'function') {
        result.then(() => dialog.close('saved')).catch((error) => {
          showFormErrors(form, normalizeUiErrors(error));
        });
      } else {
        dialog.close('saved');
      }
    } catch (error) {
      showFormErrors(form, normalizeUiErrors(error));
    }
  });

  dialog.showModal();
  dialog.querySelector('[name="shares"]').focus({ preventScroll: true });
  return dialog;
}

export function showFormErrors(form, errors) {
  const box = form.querySelector('[data-form-errors]');
  form.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
  });
  const items = errors.length ? errors : [{ message: 'The change could not be saved.' }];
  box.replaceChildren();
  const heading = document.createElement('p');
  heading.textContent = 'Fix the following before saving:';
  const list = document.createElement('ul');
  items.forEach((error) => {
    const item = document.createElement('li');
    item.textContent = error.message;
    list.append(item);
  });
  box.append(heading, list);
  box.hidden = false;

  const fieldName = items.map((error) => error.field || fieldFromPath(error.path)).find((name) => form.elements[name]);
  const field = fieldName ? form.elements[fieldName] : null;
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', box.id || ensureErrorId(box));
    field.focus({ preventScroll: true });
  } else {
    box.focus({ preventScroll: true });
  }
}

export function normalizeUiErrors(error) {
  if (Array.isArray(error?.errors)) return error.errors;
  return [{
    message: error?.message || 'The change could not be saved.',
    field: fieldFromCode(error?.code)
  }];
}

function readLotForm(form) {
  const data = new FormData(form);
  return {
    shares: data.get('shares'),
    purchasePricePerShare: data.get('purchasePricePerShare'),
    acquisitionDate: data.get('acquisitionDate'),
    auditNote: String(data.get('auditNote') || '').trim()
  };
}

function updateComparison(form, existing) {
  const values = readLotForm(form);
  Object.keys(FIELD_LABELS).forEach((field) => {
    const output = form.querySelector(`[data-after="${field}"]`);
    if (output) output.textContent = displayValue(field, values[field]);
  });
}

function comparisonMarkup(existing) {
  return `<section class="portfolio-comparison" aria-labelledby="adjustment-preview-title">
    <h3 id="adjustment-preview-title">Before and after preview</h3>
    <div class="portfolio-comparison__scroll">
      <table>
        <thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
        <tbody>${Object.entries(FIELD_LABELS).map(([field, label]) => `
          <tr><th scope="row">${label}</th><td>${escapeHtml(displayValue(field, existing[field]))}</td><td data-after="${field}">${escapeHtml(displayValue(field, existing[field]))}</td></tr>`).join('')}</tbody>
      </table>
    </div>
  </section>`;
}

function manualNotice() {
  return `<div class="portfolio-notice portfolio-notice--warning">
    <strong>Manual review required.</strong> The app does not detect or apply splits, reverse splits, ticker changes, spin-offs, mergers, or other corporate actions. Verify account records, enter the corrected lot values, and document why they changed.
  </div>`;
}

function lotEditorTitle(mode, ticker) {
  if (mode === 'manual-adjustment') return `Manually adjust ${ticker} lot`;
  return mode === 'add' ? `Add ${ticker} lot` : `Edit ${ticker} lot`;
}

function numberField(name, label, value, step) {
  return `<label class="portfolio-field"><span>${label}</span><input name="${name}" type="number" inputmode="decimal" min="0" step="${step}" value="${escapeHtml(value ?? '')}" required></label>`;
}

function dateField(value) {
  return `<label class="portfolio-field"><span>Acquisition date</span><input name="acquisitionDate" type="date" value="${escapeHtml(value || '')}" required></label>`;
}

function textAreaField(value, required) {
  return `<label class="portfolio-field portfolio-field--wide"><span>Audit note${required ? ' (required)' : ' (optional)'}</span><textarea name="auditNote" rows="3" ${required ? 'required' : ''}>${escapeHtml(value)}</textarea><small>Record corrections or manual corporate-action details here.</small></label>`;
}

function displayValue(field, value) {
  if (value === undefined || value === null || value === '') return 'Not entered';
  if (field === 'purchasePricePerShare') return `$${value}`;
  return String(value);
}

function fieldFromPath(path = '') {
  if (path.endsWith('.shares')) return 'shares';
  if (path.endsWith('.purchasePricePerShare')) return 'purchasePricePerShare';
  if (path.endsWith('.acquisitionDate')) return 'acquisitionDate';
  if (path.endsWith('.auditNote')) return 'auditNote';
  if (path.endsWith('.ticker')) return 'ticker';
  return '';
}

function fieldFromCode(code = '') {
  if (code.includes('SHARES')) return 'shares';
  if (code.includes('PURCHASE_PRICE')) return 'purchasePricePerShare';
  if (code.includes('ACQUISITION_DATE')) return 'acquisitionDate';
  if (code.includes('AUDIT_NOTE')) return 'auditNote';
  if (code.includes('TICKER') || code === 'HOLDING_ALREADY_EXISTS') return 'ticker';
  return '';
}

function ensureErrorId(box) {
  box.id = `portfolio-errors-${Date.now().toString(36)}`;
  return box.id;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
