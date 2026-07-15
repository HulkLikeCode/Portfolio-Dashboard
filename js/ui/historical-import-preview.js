import { HISTORICAL_IMPORT_MODES } from "../data/historical-import-service.js";

const STYLE_ID = "historical-import-preview-styles";

export function renderHistoricalImportPreview(container, preview, options = {}) {
  if (!container || typeof container.replaceChildren !== "function") {
    throw new TypeError("A DOM container is required for the historical import preview.");
  }

  installStyles(container.ownerDocument);
  container.replaceChildren(createHistoricalImportPreviewElement(preview, options));
}

export function createHistoricalImportPreviewElement(preview, options = {}) {
  const documentObject = options.document || document;
  const root = documentObject.createElement("section");
  root.className = "historical-import-preview";
  root.dataset.previewId = preview && preview.id ? preview.id : "";

  if (!preview || !Array.isArray(preview.entries)) {
    root.append(createParagraph(documentObject, "No validated import preview is available."));
    return root;
  }

  const heading = documentObject.createElement("h3");
  heading.textContent = "Historical import preview";
  root.append(heading);

  const summary = documentObject.createElement("p");
  summary.className = "historical-import-preview__summary";
  summary.setAttribute("role", "status");
  summary.textContent = `${preview.validFileCount} valid file(s), ${preview.invalidFileCount} invalid file(s). Full-series replacement is selected by default.`;
  root.append(summary);

  const scroll = documentObject.createElement("div");
  scroll.className = "historical-import-preview__table-scroll";
  scroll.tabIndex = 0;
  scroll.setAttribute("aria-label", "Historical import comparison table");

  const table = documentObject.createElement("table");
  table.className = "historical-import-preview__table";
  const thead = documentObject.createElement("thead");
  const headerRow = documentObject.createElement("tr");
  [
    "File",
    "Symbol",
    "Installed dates",
    "Incoming dates",
    "Added",
    "Changed",
    "Removed",
    "Unchanged",
    "Import mode"
  ].forEach((label) => {
    const th = documentObject.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headerRow.append(th);
  });
  thead.append(headerRow);
  table.append(thead);

  const tbody = documentObject.createElement("tbody");
  const modeBySymbol = normalizeModeMap(options.modeBySymbol);
  const onModeChange = typeof options.onModeChange === "function"
    ? options.onModeChange
    : () => {};

  for (const entry of preview.entries) {
    const row = documentObject.createElement("tr");
    row.dataset.fileName = entry.fileName || "";
    row.dataset.valid = entry.valid ? "true" : "false";
    if (entry.symbol) {
      row.dataset.symbol = entry.symbol;
    }

    appendCell(documentObject, row, entry.fileName || "Unnamed file");

    if (!entry.valid) {
      const errorCell = documentObject.createElement("td");
      errorCell.colSpan = 8;
      errorCell.className = "historical-import-preview__error";
      errorCell.textContent = formatSafeError(entry.error);
      row.append(errorCell);
      tbody.append(row);
      continue;
    }

    appendCell(documentObject, row, entry.symbol);
    appendCell(documentObject, row, formatDateRange(entry.existingDateRange));
    appendCell(documentObject, row, formatDateRange(entry.incomingDateRange));
    appendCountCell(documentObject, row, entry.comparison.counts.added, "added");
    appendCountCell(documentObject, row, entry.comparison.counts.changed, "changed");
    appendCountCell(documentObject, row, entry.comparison.counts.removed, "removed");
    appendCountCell(documentObject, row, entry.comparison.counts.unchanged, "unchanged");

    const modeCell = documentObject.createElement("td");
    modeCell.append(createModeControls(
      documentObject,
      entry,
      modeBySymbol.get(entry.symbol) || entry.mode || HISTORICAL_IMPORT_MODES.REPLACE,
      onModeChange
    ));
    row.append(modeCell);
    tbody.append(row);

    const detailsRow = documentObject.createElement("tr");
    detailsRow.className = "historical-import-preview__details-row";
    const detailsCell = documentObject.createElement("td");
    detailsCell.colSpan = 9;
    detailsCell.append(createDetails(documentObject, entry));
    detailsRow.append(detailsCell);
    tbody.append(detailsRow);
  }

  table.append(tbody);
  scroll.append(table);
  root.append(scroll);

  const note = createParagraph(
    documentObject,
    "Append is available only when at least one overlapping date matches exactly and every new record is later than the installed series."
  );
  note.className = "historical-import-preview__note";
  root.append(note);

  return root;
}

export function formatHistoricalImportRecord(record) {
  if (!record) {
    return "No record";
  }
  return `${record.date}: O ${formatNumber(record.open)}, H ${formatNumber(record.high)}, L ${formatNumber(record.low)}, C ${formatNumber(record.close)}, V ${formatNumber(record.volume)}`;
}

function createModeControls(documentObject, entry, selectedMode, onModeChange) {
  const fieldset = documentObject.createElement("fieldset");
  fieldset.className = "historical-import-preview__mode";
  const legend = documentObject.createElement("legend");
  legend.className = "historical-import-preview__visually-hidden";
  legend.textContent = `Import mode for ${entry.symbol}`;
  fieldset.append(legend);

  const replaceId = `${entry.id}-replace`;
  const appendId = `${entry.id}-append`;
  fieldset.append(createRadioOption(
    documentObject,
    replaceId,
    `historical-import-mode-${entry.id}`,
    HISTORICAL_IMPORT_MODES.REPLACE,
    "Full-series replacement (default)",
    selectedMode !== HISTORICAL_IMPORT_MODES.APPEND,
    false,
    () => onModeChange(entry.symbol, HISTORICAL_IMPORT_MODES.REPLACE)
  ));

  fieldset.append(createRadioOption(
    documentObject,
    appendId,
    `historical-import-mode-${entry.id}`,
    HISTORICAL_IMPORT_MODES.APPEND,
    "Append verified tail",
    selectedMode === HISTORICAL_IMPORT_MODES.APPEND,
    !entry.append.allowed,
    () => onModeChange(entry.symbol, HISTORICAL_IMPORT_MODES.APPEND)
  ));

  const appendStatus = documentObject.createElement("small");
  appendStatus.className = entry.append.allowed
    ? "historical-import-preview__append-ok"
    : "historical-import-preview__append-blocked";
  appendStatus.textContent = entry.append.reason;
  fieldset.append(appendStatus);
  return fieldset;
}

function createRadioOption(documentObject, id, name, value, labelText, checked, disabled, onChange) {
  const label = documentObject.createElement("label");
  label.className = "historical-import-preview__radio-label";
  label.htmlFor = id;
  const input = documentObject.createElement("input");
  input.type = "radio";
  input.id = id;
  input.name = name;
  input.value = value;
  input.checked = checked;
  input.disabled = disabled;
  input.addEventListener("change", () => {
    if (input.checked) {
      onChange();
    }
  });
  label.append(input, documentObject.createTextNode(labelText));
  return label;
}

function createDetails(documentObject, entry) {
  const details = documentObject.createElement("details");
  const summary = documentObject.createElement("summary");
  summary.textContent = `Review ${entry.symbol} samples, warnings, and provenance`;
  details.append(summary);

  const sampleGrid = documentObject.createElement("div");
  sampleGrid.className = "historical-import-preview__sample-grid";
  for (const category of ["added", "changed", "removed", "unchanged"]) {
    sampleGrid.append(createSampleSection(
      documentObject,
      category,
      entry.comparison.samples[category]
    ));
  }
  details.append(sampleGrid);

  const metadata = documentObject.createElement("dl");
  metadata.className = "historical-import-preview__metadata";
  appendDefinition(documentObject, metadata, "Source", entry.provenance.source || "Stooq");
  appendDefinition(documentObject, metadata, "Price adjustment", entry.provenance.priceAdjustment || "split-adjusted");
  appendDefinition(documentObject, metadata, "Dividend adjustment", entry.provenance.dividendAdjustment || "none");
  appendDefinition(documentObject, metadata, "Source hash", `${entry.sourceHash.algorithm}: ${entry.sourceHash.value}`);
  appendDefinition(documentObject, metadata, "Warnings", String(entry.warnings.length));
  details.append(metadata);

  if (entry.warnings.length > 0) {
    const warningList = documentObject.createElement("ul");
    warningList.className = "historical-import-preview__warnings";
    for (const warning of entry.warnings) {
      const item = documentObject.createElement("li");
      item.textContent = `${warning.code || "WARNING"}: ${warning.message || "Historical data warning"}`;
      warningList.append(item);
    }
    details.append(warningList);
  }

  return details;
}

function createSampleSection(documentObject, category, samples) {
  const section = documentObject.createElement("section");
  const heading = documentObject.createElement("h4");
  heading.textContent = capitalize(category);
  section.append(heading);

  if (!Array.isArray(samples) || samples.length === 0) {
    section.append(createParagraph(documentObject, "No sample records."));
    return section;
  }

  const list = documentObject.createElement("ul");
  for (const sample of samples) {
    const item = documentObject.createElement("li");
    if (category === "changed") {
      item.textContent = `${sample.date}: installed [${formatHistoricalImportRecord(sample.existing)}]; incoming [${formatHistoricalImportRecord(sample.incoming)}]`;
    } else {
      item.textContent = formatHistoricalImportRecord(sample.incoming || sample.existing);
    }
    list.append(item);
  }
  section.append(list);
  return section;
}

function appendCell(documentObject, row, value) {
  const cell = documentObject.createElement("td");
  cell.textContent = value === null || value === undefined ? "" : String(value);
  row.append(cell);
}

function appendCountCell(documentObject, row, value, category) {
  const cell = documentObject.createElement("td");
  cell.dataset.category = category;
  cell.textContent = String(value);
  row.append(cell);
}

function appendDefinition(documentObject, list, term, description) {
  const dt = documentObject.createElement("dt");
  dt.textContent = term;
  const dd = documentObject.createElement("dd");
  dd.textContent = description;
  list.append(dt, dd);
}

function createParagraph(documentObject, text) {
  const paragraph = documentObject.createElement("p");
  paragraph.textContent = text;
  return paragraph;
}

function formatDateRange(range) {
  if (!range || !range.firstDate || !range.lastDate) {
    return "None installed";
  }
  return range.firstDate === range.lastDate
    ? range.firstDate
    : `${range.firstDate} to ${range.lastDate}`;
}

function formatSafeError(error) {
  if (!error) {
    return "The file is invalid.";
  }
  const code = error.code ? `${error.code}: ` : "";
  const line = Number.isInteger(error.lineNumber) ? ` Line ${error.lineNumber}.` : "";
  return `${code}${error.message || "The file is invalid."}${line}`;
}

function formatNumber(value) {
  return Number.isFinite(value) ? String(value) : "n/a";
}

function normalizeModeMap(value) {
  if (value instanceof Map) {
    return value;
  }
  return new Map(value && typeof value === "object" ? Object.entries(value) : []);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function installStyles(documentObject) {
  if (!documentObject || documentObject.getElementById(STYLE_ID)) {
    return;
  }
  const style = documentObject.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .historical-import-preview__table-scroll { overflow-x: auto; max-width: 100%; }
    .historical-import-preview__table { width: 100%; border-collapse: collapse; min-width: 64rem; }
    .historical-import-preview__table th,
    .historical-import-preview__table td { padding: .55rem; border-bottom: 1px solid currentColor; text-align: left; vertical-align: top; }
    .historical-import-preview__details-row td { padding-top: 0; }
    .historical-import-preview__mode { border: 0; padding: 0; min-width: 15rem; }
    .historical-import-preview__radio-label { display: block; margin-bottom: .35rem; }
    .historical-import-preview__radio-label input { margin-right: .4rem; }
    .historical-import-preview__append-ok,
    .historical-import-preview__append-blocked { display: block; max-width: 28rem; }
    .historical-import-preview__append-blocked,
    .historical-import-preview__error { font-weight: 700; }
    .historical-import-preview__sample-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1rem; }
    .historical-import-preview__sample-grid ul { padding-left: 1.2rem; }
    .historical-import-preview__metadata { display: grid; grid-template-columns: max-content 1fr; gap: .25rem .75rem; }
    .historical-import-preview__metadata dd { margin: 0; overflow-wrap: anywhere; }
    .historical-import-preview__visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .historical-import-preview__note { font-size: .92rem; }
  `;
  documentObject.head.append(style);
}
