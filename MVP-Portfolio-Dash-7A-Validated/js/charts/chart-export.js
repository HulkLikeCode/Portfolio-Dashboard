const SAFE_FILE_PART = /[^a-z0-9._-]+/gi;

export function createChartPngDataUrl(chart, options = {}) {
  if (!chart || typeof chart.getDataURL !== 'function') {
    throw new TypeError('A live ECharts instance is required for PNG export.');
  }

  return chart.getDataURL({
    type: 'png',
    pixelRatio: clamp(Number(options.pixelRatio) || 2, 1, 3),
    backgroundColor: options.backgroundColor || '#ffffff',
    excludeComponents: ['toolbox']
  });
}

export async function exportChartPng(chart, options = {}) {
  const dataUrl = createChartPngDataUrl(chart, options);
  const blob = dataUrlToBlob(dataUrl);
  const filename = createPngFilename(options.filename || options.title || 'portfolio-chart');
  const save = typeof options.save === 'function' ? options.save : downloadBlob;
  await save(blob, filename, options.document || globalThis.document);
  return { blob, filename };
}

export function createPngFilename(value) {
  const base = String(value || 'portfolio-chart')
    .trim()
    .replace(SAFE_FILE_PART, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'portfolio-chart';
  return `${base.toLowerCase().replace(/\.png$/i, '')}.png`;
}

export function dataUrlToBlob(dataUrl) {
  const match = /^data:(image\/png);base64,([a-z0-9+/=]+)$/i.exec(String(dataUrl || ''));
  if (!match) throw new TypeError('ECharts did not return a valid PNG data URL.');

  const binary = typeof atob === 'function'
    ? atob(match[2])
    : decodeBase64Fallback(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: match[1] });
}

export function downloadBlob(blob, filename, ownerDocument = globalThis.document) {
  if (!ownerDocument?.createElement || typeof URL?.createObjectURL !== 'function') {
    throw new Error('PNG download is unavailable in this browser.');
  }

  const url = URL.createObjectURL(blob);
  const anchor = ownerDocument.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  ownerDocument.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function decodeBase64Fallback(value) {
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'base64').toString('binary');
  throw new Error('Base64 decoding is unavailable.');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
