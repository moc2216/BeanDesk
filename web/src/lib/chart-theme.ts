import type { EChartsOption } from 'echarts'

// Categorical palette: no pure red/green so money semantics stay uncontested.
export const CHART_COLORS = [
  '#4693f1',
  '#00a8cf',
  '#00b08d',
  '#a975e0',
  '#cc68b9',
  '#da720d',
  '#7787f3',
  '#8b939f',
]

// Stable category colours: the key travels with the category, not its rank.
export const CATEGORY_COLORS: Record<string, string> = {
  'assetClass:cash': '#4693f1',
  'assetClass:fixedIncome': '#00a8cf',
  'assetClass:equity': '#00b08d',
  'assetClass:crypto': '#a975e0',
  'assetClass:commodity': '#da720d',
  'assetClass:property': '#cc68b9',
  'assetClass:other': '#8b939f',
  'assetGroup:investment': '#7787f3',
  'expense:housing': '#00b08d',
  'expense:socialSecurity': '#4693f1',
  'expense:food': '#00a8cf',
  'expense:transport': '#7787f3',
  'expense:shopping': '#cc68b9',
  'expense:health': '#da720d',
  'expense:education': '#a975e0',
  'expense:other': '#8b939f',
  'rollup:other': '#8b939f',
}

function channel(value: number): number {
  const v = value / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '')
  const r = channel(parseInt(value.slice(0, 2), 16))
  const g = channel(parseInt(value.slice(2, 4), 16))
  const b = channel(parseInt(value.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Black or white, whichever reads better on the fill. */
export function textOnFill(hex: string): string {
  const luminance = relativeLuminance(hex)
  const onBlack = (luminance + 0.05) / 0.05
  const onWhite = 1.05 / (luminance + 0.05)
  return onBlack >= onWhite ? '#0b0c10' : '#ffffff'
}

export function colorForCategory(key: string | undefined): string {
  return (key && CATEGORY_COLORS[key]) || '#64748b'
}

const EXPENSE_ALIASES: Array<[RegExp, string]> = [
  [/housing|rent|居住|房租/i, 'housing'],
  [/social|社保|保险/i, 'socialSecurity'],
  [/food|dining|餐饮|吃饭/i, 'food'],
  [/transport|travel|交通|出行/i, 'transport'],
  [/shopping|购物/i, 'shopping'],
  [/health|medical|健康|医疗/i, 'health'],
  [/education|study|学习|教育/i, 'education'],
  [/other|其他|杂项/i, 'other'],
]

export function expenseKey(name: string): string {
  for (const [pattern, key] of EXPENSE_ALIASES) {
    if (pattern.test(name)) return 'expense:' + key
  }
  return 'expense:other'
}

export const MONEY = {
  positive: '#24a148',
  negative: '#da1e28',
  neutral: '#0f62fe',
  warning: '#d97706',
}

export function axisTextColor(isDark: boolean): string {
  return isDark ? '#8a8f98' : '#6e6e76'
}
function splitLineColor(isDark: boolean): string {
  return isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)'
}

export const tooltipStyle: EChartsOption['tooltip'] = {
  backgroundColor: 'rgba(23, 23, 28, 0.94)',
  borderWidth: 0,
  padding: [8, 10],
  textStyle: { color: '#f4f4f5', fontSize: 11 },
  extraCssText: 'border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);',
}

export function categoryAxis(data: string[], isDark = false) {
  return {
    type: 'category' as const,
    data,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: axisTextColor(isDark), fontSize: 12, hideOverlap: true },
  }
}

export function valueAxis(format: (value: number) => string, isDark = false) {
  return {
    type: 'value' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: axisTextColor(isDark), fontSize: 12, formatter: (value: number) => format(value) },
    splitLine: { lineStyle: { color: splitLineColor(isDark) } },
  }
}

export const chartGrid = { left: 52, right: 14, top: 28, bottom: 24 }
