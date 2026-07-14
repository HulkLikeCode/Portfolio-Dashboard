import { CHART_TYPES, STOOQ_PRICE_RETURN_LABEL } from './chart-state.js';

export const DEFAULT_CHART_PALETTE = Object.freeze([
  '#2563eb',
  '#d97706',
  '#059669',
  '#7c3aed',
  '#dc2626',
  '#0891b2',
  '#9333ea',
  '#4d7c0f'
]);

const LINE_STYLES = Object.freeze(['solid', 'dashed', 'dotted']);
const SYMBOLS = Object.freeze(['circle', 'rect', 'triangle', 'diamond', 'roundRect', 'pin', 'arrow']);

export function createChartOption(type, prepared = {}, context = {}) {
  if (type === CHART_TYPES.ALLOCATION) {
    return createAllocationOption(prepared, context);
  }

  return createTimeSeriesOption(type, prepared, context);
}

export function createTimeSeriesOption(type, prepared = {}, context = {}) {
  const series = Array.isArray(prepared.series) ? prepared.series : [];
  const palette = normalizePalette(context.palette);
  const selected = context.visibleSeries || {};
  const unit = prepared.unit || defaultUnit(type);
  const disableHorizontalPan = context.disableHorizontalPan === true;

  return {
    animation: context.reduceMotion !== true,
    color: palette,
    aria: {
      enabled: true,
      decal: { show: true }
    },
    title: {
      show: false,
      text: prepared.title || ''
    },
    grid: {
      left: 16,
      right: 16,
      top: 28,
      bottom: 70,
      containLabel: true
    },
    legend: {
      type: 'scroll',
      top: 0,
      selected: Object.fromEntries(
        series.map((entry) => [entry.name, selected[seriesId(entry)] !== false])
      ),
      textStyle: { color: context.textColor }
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      valueFormatter: (value) => formatChartValue(value, unit)
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLabel: { hideOverlap: true, color: context.mutedTextColor },
      axisLine: { lineStyle: { color: context.axisColor } }
    },
    yAxis: {
      type: 'value',
      name: prepared.yAxisLabel || unitLabel(unit),
      scale: true,
      axisLabel: {
        color: context.mutedTextColor,
        formatter: (value) => formatAxisValue(value, unit)
      },
      splitLine: { lineStyle: { color: context.gridColor } }
    },
    dataZoom: [
      {
        type: 'inside',
        id: 'chart-inside-zoom',
        disabled: disableHorizontalPan,
        start: context.zoom?.start ?? 0,
        end: context.zoom?.end ?? 100,
        zoomOnMouseWheel: !disableHorizontalPan,
        moveOnMouseMove: !disableHorizontalPan,
        moveOnMouseWheel: !disableHorizontalPan,
        preventDefaultMouseMove: !disableHorizontalPan
      },
      {
        type: 'slider',
        id: 'chart-slider-zoom',
        show: true,
        height: 24,
        bottom: 16,
        start: context.zoom?.start ?? 0,
        end: context.zoom?.end ?? 100,
        brushSelect: false
      }
    ],
    series: series.map((entry, index) => ({
      id: seriesId(entry),
      name: String(entry.name || entry.id || `Series ${index + 1}`),
      type: 'line',
      data: Array.isArray(entry.data) ? entry.data : [],
      showSymbol: entry.showSymbol === true,
      symbol: entry.symbol || SYMBOLS[index % SYMBOLS.length],
      symbolSize: 7,
      sampling: 'lttb',
      connectNulls: false,
      smooth: false,
      lineStyle: {
        width: index === 0 ? 3 : 2,
        type: entry.lineStyle || LINE_STYLES[index % LINE_STYLES.length]
      },
      emphasis: { focus: 'series' }
    }))
  };
}

export function createAllocationOption(prepared = {}, context = {}) {
  const series = Array.isArray(prepared.series) ? prepared.series : [];
  const selected = context.visibleSeries || {};

  return {
    animation: context.reduceMotion !== true,
    color: normalizePalette(context.palette),
    aria: {
      enabled: true,
      decal: { show: true }
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: '{b}: {d}%'
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      selected: Object.fromEntries(
        series.map((entry) => [entry.name, selected[seriesId(entry)] !== false])
      ),
      textStyle: { color: context.textColor }
    },
    series: [{
      id: 'allocation',
      name: prepared.title || 'Allocation',
      type: 'pie',
      radius: ['38%', '68%'],
      center: ['50%', '44%'],
      minAngle: 2,
      avoidLabelOverlap: true,
      itemStyle: {
        borderColor: context.surfaceColor,
        borderWidth: 2
      },
      label: {
        show: true,
        formatter: '{b}\n{d}%'
      },
      emphasis: {
        scale: true,
        label: { show: true }
      },
      data: series.map((entry) => ({
        id: seriesId(entry),
        name: String(entry.name || entry.id || 'Unlabeled'),
        value: entry.value
      }))
    }]
  };
}

export function createChartContext(element, overrides = {}) {
  const styles = typeof getComputedStyle === 'function' && element
    ? getComputedStyle(element)
    : null;
  return {
    palette: overrides.palette || DEFAULT_CHART_PALETTE,
    textColor: overrides.textColor || readColor(styles, '--color-text', '#0f172a'),
    mutedTextColor: overrides.mutedTextColor || readColor(styles, '--color-text-muted', '#475569'),
    axisColor: overrides.axisColor || readColor(styles, '--color-border-strong', '#94a3b8'),
    gridColor: overrides.gridColor || readColor(styles, '--color-border', '#e2e8f0'),
    surfaceColor: overrides.surfaceColor || readColor(styles, '--color-surface', '#ffffff'),
    reduceMotion: overrides.reduceMotion === true,
    disableHorizontalPan: overrides.disableHorizontalPan === true,
    visibleSeries: overrides.visibleSeries || {},
    zoom: overrides.zoom || { start: 0, end: 100 }
  };
}

export function seriesId(series, index = 0) {
  return String(series?.id || series?.name || `series-${index}`);
}

export function chartMethodologyLabel(prepared = {}) {
  return prepared.source === 'stooq' || prepared.priceReturnApproximation === true
    ? STOOQ_PRICE_RETURN_LABEL
    : String(prepared.methodologyLabel || '');
}

function normalizePalette(palette) {
  return Array.isArray(palette) && palette.length ? palette : [...DEFAULT_CHART_PALETTE];
}

function defaultUnit(type) {
  if (type === CHART_TYPES.ACCOUNT_VALUE) return 'currency';
  return 'percent';
}

function unitLabel(unit) {
  if (unit === 'currency') return 'Account value';
  if (unit === 'percent') return 'Percent';
  return '';
}

function formatAxisValue(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (unit === 'currency') {
    return new Intl.NumberFormat('en-US', {
      notation: Math.abs(number) >= 1000000 ? 'compact' : 'standard',
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(number);
  }
  if (unit === 'percent') return `${number.toFixed(Math.abs(number) < 10 ? 1 : 0)}%`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(number);
}

function formatChartValue(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  if (unit === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(number);
  }
  if (unit === 'percent') return `${number.toFixed(2)}%`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(number);
}

function readColor(styles, property, fallback) {
  const value = styles?.getPropertyValue(property)?.trim();
  return value || fallback;
}
