import { describe, expect, test } from 'bun:test'

import type { EChartsOption } from 'echarts'
import { SVGRenderer } from 'echarts/renderers'

import { echarts } from './echarts'

echarts.use([SVGRenderer])

const CASES: Array<[string, EChartsOption]> = [
  ['pie', { title: { text: '60%' }, tooltip: {}, series: [{ type: 'pie', data: [{ name: 'A', value: 60 }, { name: 'B', value: 40 }] }] }],
  ['treemap', { tooltip: {}, series: [{ type: 'treemap', data: [{ name: 'A', value: 60 }, { name: 'B', value: 40 }] }] }],
  ['bar', { grid: {}, tooltip: {}, xAxis: { type: 'category', data: ['A', 'B'] }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: [1, 2] }] }],
  ['line', { grid: {}, tooltip: {}, xAxis: { type: 'category', data: ['A', 'B'] }, yAxis: { type: 'value' }, series: [{ type: 'line', data: [1, 2], markLine: { data: [{ type: 'average' }] } }] }],
  ['sunburst', { tooltip: {}, series: [{ type: 'sunburst', data: [{ name: 'A', value: 60, children: [{ name: 'A1', value: 60 }] }] }] }],
]

describe('echarts registration', () => {
  test('renders every series used by the reports', () => {
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 600, height: 400 })
    for (const [name, option] of CASES) {
      chart.setOption(option, true)
      expect(chart.renderToSVGString(), name).toContain('<svg')
    }
    chart.dispose()
  })
})
