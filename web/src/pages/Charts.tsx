import { useQuery } from '@tanstack/react-query'
import * as echarts from 'echarts'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ReportWhen } from '@/components/report-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n'
import { fetchBalanceSheet, fetchIncomeStatement, type AccountNode } from '@/lib/api'
import { useAccountDisplay } from '@/lib/account-display'
import { fetchChartData } from '@/lib/chart-series'
import { useTimeFilter } from '@/lib/time-context'
import { cn } from '@/lib/utils'

const PALETTE = ['#4f8cff', '#35c88a', '#ffb020', '#ff6b6b', '#a78bfa', '#22d3ee', '#f472b6', '#94a3b8']

function leaf(name: string): string {
  const parts = name.split(':')
  return parts.length > 1 ? parts[parts.length - 1] : name
}

function visible(nodes: AccountNode[]): AccountNode[] {
  return nodes.filter((node) => Math.abs(node.total) > 0.005)
}

function share(nodes: AccountNode[], group: (node: AccountNode) => string, otherLabel: string) {
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
  if (rest > 0) kept.push({ name: otherLabel, value: rest })
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

function Chart({ option, height = 260 }: { option: echarts.EChartsOption; height?: number }) {
  const host = useChart(option)
  return <div ref={host} className="w-full" style={{ height }} />
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

function Treemap({ nodes, currency }: { nodes: AccountNode[]; currency: string }) {
  const { formatCurrency } = useI18n()
  const { format: formatAccount } = useAccountDisplay()
  const data = visible(nodes).map((node) => ({
    name: formatAccount(node.name),
    value: Math.abs(node.total),
    children: visible(node.children).map((child) => ({
      name: formatAccount(child.name),
      value: Math.abs(child.total),
    })),
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
  const { t, locale, formatCurrency, formatDate } = useI18n()
  const { format: formatAccount } = useAccountDisplay()
  const { timeFilter, isAllTime } = useTimeFilter()
  const time = isAllTime ? undefined : timeFilter
  const balance = useQuery({ queryKey: ['charts-balance', time], queryFn: ({ signal }) => fetchBalanceSheet(time, signal) })
  const income = useQuery({ queryKey: ['charts-income', time], queryFn: ({ signal }) => fetchIncomeStatement(time, signal) })
  const [dim, setDim] = useState<'class' | 'account'>('class')

  const loading = balance.isPending || income.isPending
  const failed = balance.isError || income.isError

  const assets = balance.data?.sections.find((section) => section.section === 'assets')?.children ?? []
  const expenses = income.data?.sections.find((section) => section.section === 'expenses')
  const incomeSection = income.data?.sections.find((section) => section.section === 'income')

  const allocation = useMemo(
    () =>
      share(
        assets,
        (node) =>
          formatAccount(dim === 'class' ? node.name.split(':')[1] ?? leaf(node.name) : leaf(node.name)),
        t('charts.otherLabel'),
      ),
    [assets, dim, formatAccount, t],
  )

  const incomeTotal = Math.abs(incomeSection?.total ?? 0)
  const expenseTotal = Math.abs(expenses?.total ?? 0)
  const left = incomeTotal - expenseTotal
  const savingRate = incomeTotal > 0 ? left / incomeTotal : 0

  const net = (balance.data?.totals.assets ?? 0) + (balance.data?.totals.liabilities ?? 0)
  const currency = balance.data?.operating_currency ?? income.data?.operating_currency ?? 'CNY'

  const series = useQuery({
    queryKey: ['charts-series', currency, locale, time],
    enabled: !loading && !failed && Boolean(currency),
    queryFn: ({ signal }) => fetchChartData(currency, t('charts.otherLabel'), time, signal),
  })

  const compact = useMemo(
    () => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }),
    [locale],
  )
  const money = (value: number) => formatCurrency(Number(value), currency)

  const axisX = (data: string[]) => ({
    type: 'category' as const,
    data,
    axisTick: { show: false },
    axisLabel: { fontSize: 10, hideOverlap: true },
  })
  const axisY = (formatter: (value: number) => string) => ({
    type: 'value' as const,
    axisLabel: { fontSize: 10, formatter: (value: number | string) => formatter(Number(value)) },
  })

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

  const netWorth = series.data?.netWorth ?? []
  const cashflow = series.data?.cashflow ?? []
  const savings = series.data?.savings ?? []
  const composition = series.data?.composition
  const payees = series.data?.payees ?? []

  const netWorthOption = useMemo<echarts.EChartsOption>(
    () => ({
      grid: { left: 68, right: 20, top: 16, bottom: 24 },
      tooltip: { trigger: 'axis', valueFormatter: (value) => money(Number(value)) },
      xAxis: axisX(netWorth.map((point) => point.label)),
      yAxis: axisY((value) => compact.format(value)),
      series: [
        {
          type: 'line',
          name: t('charts.netWorth'),
          data: netWorth.map((point) => point.value),
          showSymbol: false,
          lineStyle: { width: 2, color: PALETTE[0] },
          areaStyle: { opacity: 0.12, color: PALETTE[0] },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            data: [{ yAxis: 0, lineStyle: { type: 'dashed', opacity: 0.5 } }],
          },
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [netWorth, currency, formatCurrency, t, compact],
  )

  const cashflowOption = useMemo<echarts.EChartsOption>(
    () => ({
      grid: { left: 68, right: 20, top: 36, bottom: 24 },
      legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
      tooltip: { trigger: 'axis', valueFormatter: (value) => money(Number(value)) },
      xAxis: axisX(cashflow.map((point) => point.label)),
      yAxis: axisY((value) => compact.format(value)),
      series: [
        {
          type: 'bar',
          name: t('charts.income'),
          data: cashflow.map((point) => point.income),
          itemStyle: { color: PALETTE[1] },
          barMaxWidth: 14,
        },
        {
          type: 'bar',
          name: t('charts.expense'),
          data: cashflow.map((point) => point.expense),
          itemStyle: { color: PALETTE[3] },
          barMaxWidth: 14,
        },
        {
          type: 'line',
          name: t('charts.left'),
          data: cashflow.map((point) => point.left),
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { width: 2, color: PALETTE[0] },
          itemStyle: { color: PALETTE[0] },
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cashflow, currency, t, compact],
  )

  const savingsOption = useMemo<echarts.EChartsOption>(
    () => ({
      grid: { left: 48, right: 20, top: 16, bottom: 24 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value) => (value == null ? '—' : Number(value).toFixed(1) + '%'),
      },
      xAxis: axisX(savings.map((point) => point.label)),
      yAxis: axisY((value) => value.toFixed(0) + '%'),
      series: [
        {
          type: 'line',
          data: savings.map((point) => (point.value == null ? null : point.value * 100)),
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 2, color: PALETTE[2] },
          areaStyle: { opacity: 0.1, color: PALETTE[2] },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { fontSize: 10, formatter: (params) => Number(params.value).toFixed(0) + '%' },
            data: [{ type: 'average', lineStyle: { type: 'dashed', opacity: 0.6 } }],
          },
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savings, compact],
  )

  const compositionOption = useMemo<echarts.EChartsOption>(
    () => ({
      color: PALETTE,
      grid: { left: 68, right: 20, top: 52, bottom: 24 },
      legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10 }, type: 'scroll' },
      tooltip: { trigger: 'axis', valueFormatter: (value) => money(Number(value)) },
      xAxis: axisX(composition?.points.map((point) => point.label) ?? []),
      yAxis: axisY((value) => compact.format(value)),
      series: (composition?.categories ?? []).map((name, index) => {
        const last = index === (composition?.categories.length ?? 0) - 1
        const merged = composition?.merged ?? 0
        return {
          type: 'bar' as const,
          name: last && merged > 0 ? t('charts.otherBuckets', { count: merged }) : formatAccount(name),
          stack: 'spend',
          data: (composition?.points ?? []).map((point) => point.values[index] ?? 0),
          itemStyle: { color: PALETTE[index % PALETTE.length] },
          barMaxWidth: 18,
        }
      }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [composition, currency, compact, formatAccount, t],
  )

  const payeeOption = useMemo<echarts.EChartsOption>(
    () => ({
      grid: { left: 100, right: 36, top: 8, bottom: 24 },
      tooltip: { trigger: 'axis', valueFormatter: (value) => money(Number(value)) },
      xAxis: axisY((value) => compact.format(value)),
      yAxis: {
        type: 'category',
        data: payees.map((payee) => payee.name).reverse(),
        axisTick: { show: false },
        axisLabel: {
          fontSize: 10,
          formatter: (name: string) => (name.length > 12 ? name.slice(0, 12) + '…' : name),
        },
      },
      series: [
        {
          type: 'bar',
          data: payees.map((payee) => payee.value).reverse(),
          itemStyle: { color: PALETTE[4] },
          barMaxWidth: 14,
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payees, currency, compact],
  )

  const seriesPending = series.isPending
  const seriesFailed = series.isError

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
            title={t('charts.netWorthTrend')}
            hint={t('charts.netWorthTrendHint')}
            className="lg:col-span-2"
          >
            {seriesPending ? (
              <Skeleton className="h-[260px] w-full" />
            ) : netWorth.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('charts.noSeries')}</p>
            ) : (
              <Chart option={netWorthOption} />
            )}
          </ChartFrame>

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

          <ChartFrame title={t('charts.monthlyFlows')} hint={t('charts.monthlyFlowsHint')}>
            {seriesPending ? (
              <Skeleton className="h-[260px] w-full" />
            ) : cashflow.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('charts.noSeries')}</p>
            ) : (
              <Chart option={cashflowOption} />
            )}
          </ChartFrame>

          <ChartFrame title={t('charts.savingsTrend')} hint={t('charts.savingsTrendHint')}>
            {seriesPending ? (
              <Skeleton className="h-[260px] w-full" />
            ) : savings.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('charts.noSeries')}</p>
            ) : (
              <Chart option={savingsOption} />
            )}
          </ChartFrame>

          <ChartFrame
            title={t('charts.composition')}
            hint={t('charts.compositionHint')}
            className="lg:col-span-2"
          >
            {seriesPending ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (composition?.points.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">{t('charts.noSeries')}</p>
            ) : (
              <Chart option={compositionOption} height={280} />
            )}
          </ChartFrame>

          <ChartFrame title={t('charts.topPayees')} hint={t('charts.topPayeesHint')}>
            {seriesPending ? (
              <Skeleton className="h-[280px] w-full" />
            ) : payees.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('charts.noSeries')}</p>
            ) : (
              <Chart option={payeeOption} height={280} />
            )}
          </ChartFrame>

          <ChartFrame title={t('charts.flows')} hint={t('charts.flowsHint')}>
            <Chart option={flowsOption} height={280} />
          </ChartFrame>

          {seriesFailed ? (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground lg:col-span-2">
              {t('charts.seriesUnavailable')}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
