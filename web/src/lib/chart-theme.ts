import type { EChartsOption } from 'echarts'

// Categorical palette: no pure red/green so money semantics stay uncontested.
export const CHART_COLORS = [
  '#4f6ef7',
  '#12a594',
  '#b45309',
  '#8e4ec6',
  '#0284c7',
  '#d6409f',
  '#a67c52',
  '#8b8d98',
]

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
    axisLabel: { color: AXIS_TEXT, fontSize: 10, hideOverlap: true },
  }
}

export function valueAxis(format: (value: number) => string) {
  return {
    type: 'value' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: AXIS_TEXT, fontSize: 10, formatter: (value: number) => format(value) },
    splitLine: { lineStyle: { color: SPLIT } },
  }
}

export const chartGrid = { left: 52, right: 14, top: 28, bottom: 24 }
