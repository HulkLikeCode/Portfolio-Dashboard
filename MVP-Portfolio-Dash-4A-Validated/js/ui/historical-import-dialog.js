import { HISTORICAL_IMPORT_MODES } from "../data/historical-import-service.js";
import { renderHistoricalImportPreview } from "./historical-import-preview.js";

const STYLE_ID = "historical-import-dialog-styles";

export class HistoricalImportDialog {
  constructor(options = {}) {
    if (!options.service || typeof options.service.prepareFiles !== "function"
        || typeof options.service.commit !== "function") {
      throw new TypeError("A historical import service is required.");
    }

    this.service = options.service;
    this.document = options.document || document;
    this.mount = options.mount || this.document.body;
    this.onCommitted = typeof options.onCommitted === "function"
      ? options.onCommitted
      : () => {};
    this.onError = typeof options.onError === "function"
      ? options.onError
      : () => {};
    this.preview = null;
    this.modeBySymbol = new Map();
    this.busy = false;
    this.restoreFocusTo = null;

    installStyles(this.document);
    this.elements = this.#build();
    this.mount.append(this.elements.root);
  }

  open() {
    this.restoreFocusTo = this.document.activeElement;
    this.#resetConfirmation();
    if (typeof this.elements.root.showModal === "function") {
      if (!this.elements.root.open) {
        this.elements.root.showModal();
      }
    } else {
      this.elements.root.hidden = false;
      this.elements.root.setAttribute("aria-hidden", "false");
    }
    this.elements.chooseButton.focus();
  }

  close() {
    if (this.busy) {
      return;
    }
    if (typeof this.elements.root.close === "function" && this.elements.root.open) {
      this.elements.root.close();
    } else {
      this.elements.root.hidden = true;
      this.elements.root.setAttribute("aria-hidden", "true");
    }
    if (this.restoreFocusTo && typeof this.restoreFocusTo.focus === "function") {
      this.restoreFocusTo.focus();
    }
  }

  destroy() {
    this.elements.root.remove();
  }

  async prepareSelectedFiles(files = this.elements.fileInput.files) {
    if (this.busy) {
      return null;
    }

    this.#setBusy(true);
    this.preview = null;
    this.modeBySymbol.clear();
    this.elements.preview.replaceChildren();
    this.#resetConfirmation();
    this.#setStatus("Reading and validating selected files…");

    try {
      const preview = await this.service.prepareFiles(files, {
        onProgress: (progress) => this.#showProgress(progress)
      });
      this.preview = preview;
      for (const entry of preview.entries) {
        if (entry.valid) {
          this.modeBySymbol.set(entry.symbol, HISTORICAL_IMPORT_MODES.REPLACE);
        }
      }
      this.#renderPreview();
      this.elements.commitButton.disabled = !preview.canCommit;
      this.#setStatus(
        preview.canCommit
          ? "Validation complete. Review the comparison before importing."
          : "No valid files are available to import."
      );
      return preview;
    } catch (error) {
      this.#handleError(error);
      return null;
    } finally {
      this.#setBusy(false);
    }
  }

  async commitPreparedImport() {
    if (this.busy || !this.preview) {
      return null;
    }

    const replacements = this.#replacementEntriesRequiringConfirmation();
    if (replacements.length > 0 && !this.elements.confirmCheckbox.checked) {
      this.#showReplacementConfirmation(replacements);
      this.#setStatus("Confirm the listed full-series replacements before importing.");
      this.elements.confirmCheckbox.focus();
      return null;
    }

    this.#setBusy(true);
    this.#setStatus("Committing historical data by symbol…");

    try {
      const result = await this.service.commit(this.preview, {
        modeBySymbol: this.modeBySymbol,
        replacementConfirmed: replacements.length === 0
          || this.elements.confirmCheckbox.checked,
        onProgress: (progress) => this.#showProgress(progress)
      });
      this.#renderCommitResult(result);
      this.onCommitted(result);
      return result;
    } catch (error) {
      this.#handleError(error);
      return null;
    } finally {
      this.#setBusy(false);
    }
  }

  #build() {
    const supportsDialog = typeof this.document.createElement("dialog").showModal === "function";
    const root = this.document.createElement(supportsDialog ? "dialog" : "section");
    root.className = "historical-import-dialog";
    root.setAttribute("aria-labelledby", "historical-import-dialog-title");
    if (!supportsDialog) {
      root.hidden = true;
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-hidden", "true");
    }

    const header = this.document.createElement("header");
    header.className = "historical-import-dialog__header";
    const title = this.document.createElement("h2");
    title.id = "historical-import-dialog-title";
    title.textContent = "Import Stooq historical files";
    const closeButton = this.document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "historical-import-dialog__close";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => this.close());
    header.append(title, closeButton);

    const instructions = this.document.createElement("p");
    instructions.textContent = "Select one or more complete Stooq daily text files. Desktop browsers and Safari on iPhone can choose multiple files from the system file picker or iOS Files.";

    const fileInput = this.document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.accept = ".txt,.csv,text/plain,text/csv";
    fileInput.className = "historical-import-dialog__file-input";
    fileInput.setAttribute("aria-label", "Select Stooq historical files");
    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files.length > 0) {
        this.prepareSelectedFiles(fileInput.files);
      }
    });

    const chooseButton = this.document.createElement("button");
    chooseButton.type = "button";
    chooseButton.textContent = "Choose historical files";
    chooseButton.addEventListener("click", () => fileInput.click());

    const selectionRow = this.document.createElement("div");
    selectionRow.className = "historical-import-dialog__selection";
    selectionRow.append(chooseButton, fileInput);

    const status = this.document.createElement("p");
    status.className = "historical-import-dialog__status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = "No files selected.";

    const progress = this.document.createElement("progress");
    progress.className = "historical-import-dialog__progress";
    progress.max = 1;
    progress.value = 0;
    progress.hidden = true;

    const preview = this.document.createElement("div");
    preview.className = "historical-import-dialog__preview";

    const confirmation = this.document.createElement("section");
    confirmation.className = "historical-import-dialog__confirmation";
    confirmation.hidden = true;
    const confirmationHeading = this.document.createElement("h3");
    confirmationHeading.textContent = "Confirm full-series replacement";
    const confirmationText = this.document.createElement("p");
    confirmationText.textContent = "Replacement deletes the currently installed series for each listed symbol and writes the validated incoming series in the same transaction.";
    const confirmationList = this.document.createElement("ul");
    const confirmLabel = this.document.createElement("label");
    confirmLabel.className = "historical-import-dialog__confirm-label";
    const confirmCheckbox = this.document.createElement("input");
    confirmCheckbox.type = "checkbox";
    confirmCheckbox.addEventListener("change", () => {
      this.elements.commitButton.textContent = confirmCheckbox.checked
        ? "Confirm and import"
        : "Import selected modes";
    });
    confirmLabel.append(
      confirmCheckbox,
      this.document.createTextNode("I reviewed the comparison and approve these replacements.")
    );
    confirmation.append(
      confirmationHeading,
      confirmationText,
      confirmationList,
      confirmLabel
    );

    const result = this.document.createElement("div");
    result.className = "historical-import-dialog__result";
    result.setAttribute("aria-live", "polite");

    const footer = this.document.createElement("footer");
    footer.className = "historical-import-dialog__footer";
    const cancelButton = this.document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => this.close());
    const commitButton = this.document.createElement("button");
    commitButton.type = "button";
    commitButton.textContent = "Import selected modes";
    commitButton.disabled = true;
    commitButton.addEventListener("click", () => this.commitPreparedImport());
    footer.append(cancelButton, commitButton);

    root.append(
      header,
      instructions,
      selectionRow,
      status,
      progress,
      preview,
      confirmation,
      result,
      footer
    );

    root.addEventListener("cancel", (event) => {
      if (this.busy) {
        event.preventDefault();
      }
    });
    if (!supportsDialog) {
      root.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          this.close();
        }
      });
    }

    return {
      root,
      fileInput,
      chooseButton,
      closeButton,
      status,
      progress,
      preview,
      confirmation,
      confirmationList,
      confirmCheckbox,
      result,
      cancelButton,
      commitButton
    };
  }

  #renderPreview() {
    renderHistoricalImportPreview(this.elements.preview, this.preview, {
      modeBySymbol: this.modeBySymbol,
      onModeChange: (symbol, mode) => {
        this.modeBySymbol.set(symbol, mode);
        this.#resetConfirmation();
        this.#renderPreview();
      }
    });
  }

  #replacementEntriesRequiringConfirmation() {
    if (!this.preview) {
      return [];
    }
    return this.preview.entries.filter((entry) => {
      if (!entry.valid || entry.existingRecordCount === 0) {
        return false;
      }
      const mode = this.modeBySymbol.get(entry.symbol) || HISTORICAL_IMPORT_MODES.REPLACE;
      const counts = entry.comparison.counts;
      return mode === HISTORICAL_IMPORT_MODES.REPLACE
        && (counts.added > 0 || counts.changed > 0 || counts.removed > 0);
    });
  }

  #showReplacementConfirmation(entries) {
    this.elements.confirmationList.replaceChildren();
    for (const entry of entries) {
      const item = this.document.createElement("li");
      const counts = entry.comparison.counts;
      item.textContent = `${entry.symbol}: ${counts.added} added, ${counts.changed} changed, ${counts.removed} removed, ${counts.unchanged} unchanged.`;
      this.elements.confirmationList.append(item);
    }
    this.elements.confirmation.hidden = false;
  }

  #resetConfirmation() {
    this.elements.confirmation.hidden = true;
    this.elements.confirmationList.replaceChildren();
    this.elements.confirmCheckbox.checked = false;
    this.elements.commitButton.textContent = "Import selected modes";
  }

  #renderCommitResult(result) {
    this.elements.result.replaceChildren();
    const heading = this.document.createElement("h3");
    heading.textContent = "Import result";
    const summary = this.document.createElement("p");
    summary.textContent = `${result.committedCount} committed, ${result.unchangedCount} unchanged, ${result.failedCount} failed.`;
    const list = this.document.createElement("ul");
    for (const item of result.results) {
      const row = this.document.createElement("li");
      row.textContent = item.status === "failed"
        ? `${item.symbol}: failed. ${item.error.message}`
        : `${item.symbol}: ${item.status}; ${item.writtenRecordCount} record(s) written using ${item.mode} mode.`;
      list.append(row);
    }
    this.elements.result.append(heading, summary, list);
    this.#setStatus(result.failedCount === 0
      ? "Historical import completed. Affected analytics and simulations were marked stale."
      : "Historical import completed with one or more symbol failures. Failed symbols were rolled back.");
  }

  #showProgress(progress) {
    this.elements.progress.hidden = false;
    if (progress.phase === "prepare") {
      const current = Number.isInteger(progress.fileIndex) ? progress.fileIndex + 1 : 1;
      const total = Number.isInteger(progress.fileCount) ? progress.fileCount : 1;
      this.elements.progress.max = total;
      this.elements.progress.value = Math.min(current, total);
      this.#setStatus(`${capitalize(progress.status)} ${progress.fileName}${progress.symbol ? ` (${progress.symbol})` : ""}.`);
      return;
    }

    if (progress.phase === "commit") {
      const current = Number.isInteger(progress.symbolIndex) ? progress.symbolIndex + 1 : 1;
      const total = Number.isInteger(progress.symbolCount) ? progress.symbolCount : 1;
      this.elements.progress.max = total;
      this.elements.progress.value = Math.min(current, total);
      this.#setStatus(`${capitalize(progress.status)} ${progress.symbol} using ${progress.mode} mode.`);
    }
  }

  #setBusy(busy) {
    this.busy = busy;
    this.elements.chooseButton.disabled = busy;
    this.elements.fileInput.disabled = busy;
    this.elements.closeButton.disabled = busy;
    this.elements.cancelButton.disabled = busy;
    this.elements.commitButton.disabled = busy || !(this.preview && this.preview.canCommit);
    if (!busy) {
      this.elements.progress.hidden = true;
    }
  }

  #setStatus(message) {
    this.elements.status.textContent = message;
  }

  #handleError(error) {
    const message = error && error.message ? error.message : String(error);
    this.#setStatus(message);
    this.onError(error);
  }
}

export function createHistoricalImportDialog(options = {}) {
  return new HistoricalImportDialog(options);
}

function installStyles(documentObject) {
  if (!documentObject || documentObject.getElementById(STYLE_ID)) {
    return;
  }
  const style = documentObject.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .historical-import-dialog { box-sizing: border-box; width: min(96vw, 78rem); max-height: 92vh; overflow: auto; padding: 1rem; }
    section.historical-import-dialog[role="dialog"] { position: fixed; inset: 4vh 2vw auto; z-index: 1000; border: 1px solid currentColor; background: Canvas; color: CanvasText; box-shadow: 0 .5rem 2rem rgba(0,0,0,.3); }
    .historical-import-dialog::backdrop { background: rgba(0,0,0,.55); }
    .historical-import-dialog__header,
    .historical-import-dialog__footer,
    .historical-import-dialog__selection { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
    .historical-import-dialog__header { justify-content: space-between; }
    .historical-import-dialog__footer { justify-content: flex-end; position: sticky; bottom: 0; padding-top: 1rem; background: Canvas; }
    .historical-import-dialog button { min-height: 2.75rem; padding: .55rem .9rem; font: inherit; }
    .historical-import-dialog__file-input { max-width: 100%; font: inherit; }
    .historical-import-dialog__status { padding: .65rem; border: 1px solid currentColor; border-radius: .35rem; }
    .historical-import-dialog__progress { width: 100%; }
    .historical-import-dialog__confirmation { margin: 1rem 0; padding: 1rem; border: 2px solid currentColor; border-radius: .35rem; }
    .historical-import-dialog__confirm-label { display: flex; gap: .55rem; align-items: flex-start; font-weight: 700; }
    .historical-import-dialog__confirm-label input { margin-top: .25rem; }
    @media (max-width: 40rem) {
      .historical-import-dialog { width: 100vw; max-width: 100vw; max-height: 100vh; margin: 0; border-radius: 0; padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left)); }
      .historical-import-dialog__footer { padding-bottom: env(safe-area-inset-bottom); }
    }
  `;
  documentObject.head.append(style);
}

function capitalize(value) {
  const text = value ? String(value) : "Working";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
