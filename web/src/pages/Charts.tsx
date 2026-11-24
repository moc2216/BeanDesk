import { useQuery } from '@tanstack/react-query'
import * as echarts from 'echarts'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ReportWhen } from '@/components/report-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n'
import { fetchBalanceSheet, fetchIncomeStatement, type AccountNode } from '@/lib/api'
import { cn } from '@/lib/utils'

const PALETTE = ['#4f8cff', '#35c88a', '#ffb020', '#ff6b6b', '#a78bfa', '#22d3ee', '#f472b6', '#94a3b8']

function leaf(name: string): string {
  const parts = name.split(':')
  return parts.length > 1 ? parts[parts.length - 1] : name
}

function visible(nodes: AccountNode[]): AccountNode[] {
  return nodes.filter((node) => Math.abs(node.total) > 0.005)
}

function share(nodes: AccountNode[], group: (node: AccountNode) => string) {
  const merged = new Map<string, number>()
  for (const node of visible(nodes)) {
    const key = group(node)
    merged.set(key, (merged.get(key) ?? 0) + Math.abs(node.total))
  }
  const items = [...merged.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const kept = items.filter((item) => total > 0 && item.value / total >= 0.01).slice(0, 8)
  const rest = items.filter((item) => !kept.includes(item)).reduce((sum, item) => sum + item.value, 0)
  if (rest > 0) kept.push({ name: '其他', value: rest })
  const hhi = total > 0 ? items.reduce((sum, item) => sum + (item.value / total) ** 2, 0) : 0
  return {
    items: kept,
    total,
    top: items[0] ? items[0].value / total : 0,
    effective: hhi > 0 ? 1 / hhi : 0,
  }
}

function useChart(option: echarts.EChartsOption) {
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

function ChartFrame({
  title,
  hint,
  children,
  actions,
  className,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border bg-card p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Pie({ items, top, label, currency }: { items: Array<{ name: string; value: number }>; top: number; label: string; currency: string }) {
  const { formatCurrency } = useI18n()
  const option = useMemo<echarts.EChartsOption>(
    () => ({
      color: PALETTE,
      tooltip: {
        formatter: (params) => {
          const item = params as { name: string; value: number; percent: number }
          return item.name + ' ' + formatCurrency(item.value, currency) + ' (' + item.percent.toFixed(1) + '%)'
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['58%', '82%'],
          itemStyle: { borderWidth: 3, borderColor: 'transparent' },
          label: { fontSize: 11, formatter: '{b} {d}%' },
          labelLayout: { hideOverlap: true },
          data: items,
        },
      ],
      title: {
        text: (top * 100).toFixed(1) + '%',
        subtext: label,
        left: 'center',
        top: '40%',
        textStyle: { fontSize: 24, fontWeight: 600 },
        subtextStyle: { fontSize: 11 },
      },
    }),
    [items, top, label, currency, formatCurrency],
  )
  const host = useChart(option)
  return <div ref={host} className="h-[260px] w-full" />
}

function Bars({ option }: { option: echarts.EChartsOption }) {
  const host = useChart(option)
  return <div ref={host} className="h-[220px] w-full" />
}

function Treemap({ nodes, currency }: { nodes: AccountNode[]; currency: string }) {
  const { formatCurrency } = useI18n()
  const data = visible(nodes).map((node) => ({
    name: leaf(node.name),
    value: Math.abs(node.total),
    children: visible(node.children).map((child) => ({ name: leaf(child.name), value: Math.abs(child.total) })),
  }))
  const option = useMemo<echarts.EChartsOption>(
    () => ({
      color: PALETTE,
      tooltip: {
        formatter: (params) => {
          const item = params as { name: string; value: number }
          return item.name + ' ' + formatCurrency(item.value, currency)
        },
      },
      series: [
        {
          type: 'treemap',
          roam: false,
          breadcrumb: { show: false },
          upperLabel: { show: true, height: 20, fontSize: 11 },
          label: { fontSize: 11 },
          itemStyle: { borderWidth: 1, gapWidth: 2 },
          data,
        },
      ],
    }),
    [data, currency, formatCurrency],
  )
  const host = useChart(option)
  return <div ref={host} className="h-[280px] w-full" />
}

export function Charts() {
  const { t, formatCurrency, formatDate } = useI18n()
  const balance = useQuery({ queryKey: ['charts-balance'], queryFn: ({ signal }) => fetchBalanceSheet(undefined, signal) })
  const income = useQuery({ queryKey: ['charts-income'], queryFn: ({ signal }) => fetchIncomeStatement(undefined, signal) })
  const [dim, setDim] = useState<'class' | 'account'>('class')

  const loading = balance.isPending || income.isPending
  const failed = balance.isError || income.isError

  const assets = balance.data?.sections.find((section) => section.section === 'assets')?.children ?? []
  const expenses = income.data?.sections.find((section) => section.section === 'expenses')
  const incomeSection = income.data?.sections.find((section) => section.section === 'income')

  const allocation = useMemo(
    () => share(assets, (node) => (dim === 'class' ? node.name.split(':')[1] ?? leaf(node.name) : leaf(node.name))),
    [assets, dim],
  )

  const incomeTotal = Math.abs(incomeSection?.total ?? 0)
  const expenseTotal = Math.abs(expenses?.total ?? 0)
  const left = incomeTotal - expenseTotal
  const savingRate = incomeTotal > 0 ? left / incomeTotal : 0

  const net = (balance.data?.totals.assets ?? 0) + (balance.data?.totals.liabilities ?? 0)
  const currency = balance.data?.operating_currency ?? income.data?.operating_currency ?? 'CNY'

  const flowsOption = useMemo<echarts.EChartsOption>(
    () => ({
      grid: { left: 88, right: 24, top: 12, bottom: 24 },
      xAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatCurrency(value, currency) } },
      yAxis: { type: 'category', data: [t('charts.expense'), t('charts.income'), t('charts.left')] },
      tooltip: { trigger: 'axis', valueFormatter: (value) => formatCurrency(Number(value), currency) },
      series: [
        {
          type: 'bar',
          barMaxWidth: 24,
          data: [
            { value: expenseTotal, itemStyle: { color: PALETTE[3] } },
            { value: incomeTotal, itemStyle: { color: PALETTE[1] } },
            { value: left, itemStyle: { color: PALETTE[0] } },
          ],
        },
      ],
    }),
    [expenseTotal, incomeTotal, left, currency, formatCurrency, t],
  )
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">{t('charts.title')}</h1>
        <ReportWhen currency={currency}>{balance.data?.as_of ? formatDate(balance.data.as_of) : null}</ReportWhen>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t('charts.netWorth'), value: formatCurrency(net, currency) },
          { label: t('charts.assets'), value: formatCurrency(balance.data?.totals.assets ?? 0, currency) },
          { label: t('charts.liabilities'), value: formatCurrency(Math.abs(balance.data?.totals.liabilities ?? 0), currency) },
          { label: t('charts.savingsRate'), value: (savingRate * 100).toFixed(1) + '%' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">{item.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{item.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : failed ? (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">{t('charts.unavailable')}</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartFrame
            title={t('charts.allocation')}
            hint={t('charts.allocationHint')}
            actions={
              <div className="flex gap-2">
                {(['class', 'account'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDim(key)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs',
                      dim === key ? 'border-primary text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {t(key === 'class' ? 'charts.byClass' : 'charts.byAccount')}
                  </button>
                ))}
              </div>
            }
          >
            <Pie items={allocation.items} top={allocation.top} label={t('charts.topShare')} currency={currency} />
            <p className="text-xs text-muted-foreground">
              {t('charts.effective')} {allocation.effective.toFixed(1)}
            </p>
          </ChartFrame>

          <ChartFrame title={t('charts.spending')} hint={t('charts.spendingHint')}>
            <Treemap nodes={expenses?.children ?? []} currency={currency} />
          </ChartFrame>

          <ChartFrame title={t('charts.flows')} hint={t('charts.flowsHint')} className="lg:col-span-2">
            <Bars option={flowsOption} />
          </ChartFrame>
        </div>
      )}
    </div>
  )
}
