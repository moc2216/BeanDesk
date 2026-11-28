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
  'assetClass:crypto': '#7787f3',
  'assetClass:commodity': '#cc68b9',
  'assetClass:property': '#da720d',
  'assetClass:other': '#8b939f',
  'assetGroup:investment': '#00a8cf',
  'expense:housing': '#00b08d',
  'expense:socialSecurity': '#4693f1',
  'expense:food': '#00a8cf',
  'expense:transport': '#a975e0',
  'expense:shopping': '#7787f3',
  'expense:health': '#cc68b9',
  'expense:education': '#da720d',
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

/** Liabilities do not have asset classes; map common account families. */
export function liabilityColor(account: string): string {
  const name = account.toLowerCase()
  if (/credit|card|信用卡/.test(name)) return '#8b939f'
  if (/mortgage|房贷|按揭/.test(name)) return '#a975e0'
  if (/loan|借款|贷款|消费贷/.test(name)) return '#cc68b9'
  return '#8b939f'
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
  positive: '#15803d',
  negative: '#d92d20',
  neutral: '#0968ef',
  warning: '#b45309',
}

export function axisTextColor(isDark: boolean): string {
  return isDark ? '#98989d' : '#6e6e73'
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
    axisLabel: { color: axisTextColor(isDark), fontSize: 11, hideOverlap: true },
  }
}

export function valueAxis(format: (value: number) => string, isDark = false) {
  return {
    type: 'value' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: axisTextColor(isDark), fontSize: 11, formatter: (value: number) => format(value) },
    splitLine: { show: false },
  }
}

export const chartGrid = { left: 52, right: 14, top: 28, bottom: 24 }
