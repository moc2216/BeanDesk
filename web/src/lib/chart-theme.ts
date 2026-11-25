import type { EChartsOption } from 'echarts'

// Categorical palette: no pure red/green so money semantics stay uncontested.
export const CHART_COLORS = [
  '#4f6ef7',
  '#0f766e',
  '#087ba8',
  '#a44982',
  '#5b64ac',
  '#b45309',
  '#8653ae',
  '#64748b',
]

// Stable category colours: the key travels with the category, not its rank.
export const CATEGORY_COLORS: Record<string, string> = {
  'assetClass:cash': '#4f6ef7',
  'assetClass:fixedIncome': '#5b64ac',
  'assetClass:equity': '#0f766e',
  'assetClass:crypto': '#8653ae',
  'assetClass:commodity': '#a44982',
  'assetClass:property': '#4d67b9',
  'assetClass:other': '#64748b',
  'assetGroup:investment': '#087ba8',
  'expense:housing': '#0f766e',
  'expense:socialSecurity': '#4f6ef7',
  'expense:food': '#087ba8',
  'expense:transport': '#a44982',
  'expense:shopping': '#5b64ac',
  'expense:health': '#b45309',
  'expense:education': '#8653ae',
  'expense:other': '#64748b',
  'rollup:other': '#64748b',
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
  positive: '#16a34a',
  negative: '#dc2626',
  neutral: '#4f6ef7',
  warning: '#d97706',
}

const AXIS_TEXT = '#8b8d98'
const SPLIT = 'rgba(140, 143, 160, 0.18)'

export const tooltipStyle: EChartsOption['tooltip'] = {
  backgroundColor: 'rgba(23, 23, 28, 0.94)',
  borderWidth: 0,
  padding: [8, 10],
  textStyle: { color: '#f4f4f5', fontSize: 11 },
  extraCssText: 'border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);',
}

export function categoryAxis(data: string[]) {
  return {
    type: 'category' as const,
    data,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: AXIS_TEXT, fontSize: 12, hideOverlap: true },
  }
}

export function valueAxis(format: (value: number) => string) {
  return {
    type: 'value' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: AXIS_TEXT, fontSize: 12, formatter: (value: number) => format(value) },
    splitLine: { lineStyle: { color: SPLIT } },
  }
}

export const chartGrid = { left: 52, right: 14, top: 28, bottom: 24 }
