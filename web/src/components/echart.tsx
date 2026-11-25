import * as echarts from 'echarts'
import { useEffect, useRef } from 'react'

export function useChart(option: echarts.EChartsOption) {
  const host = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  useEffect(() => {
    if (!host.current) return
    chart.current = echarts.init(host.current, undefined, { renderer: 'canvas' })
    const observer = new ResizeObserver(() => chart.current?.resize())
    observer.observe(host.current)
    return () => {
      observer.disconnect()
      chart.current?.dispose()
      chart.current = null
    }
  }, [])
  useEffect(() => {
    chart.current?.setOption(option, true)
  }, [option])
  return host
}

export function Chart({ option, height = 260 }: { option: echarts.EChartsOption; height?: number }) {
  const host = useChart(option)
  return <div ref={host} className="w-full" style={{ height }} />
}
