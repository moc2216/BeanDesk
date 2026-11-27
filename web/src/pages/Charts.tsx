import { useQuery } from '@tanstack/react-query'
import * as echarts from 'echarts'
import { Settings2, TriangleAlertIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Chart } from '@/components/echart'
import { PortfolioView } from '@/components/portfolio-view'
import { ReportWhen } from '@/components/report-bar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n'
import {
  ASSET_CLASSES,
  classOf,
  guessAssetClass,
  loadClassMap,
  saveClassMap,
  type AssetClass,
} from '@/lib/asset-classes'
import { useTheme } from '@/components/theme-provider'
import type { MessageKey } from '@/i18n/locales/en'
import { fetchBalanceSheet, fetchIncomeStatement, type AccountNode } from '@/lib/api'
import {
  CHART_COLORS,
  categoryAxis,
  colorForCategory,
  expenseKey,
  textOnFill,
  tooltipStyle,
  valueAxis,
} from '@/lib/chart-theme'
import { useAccountDisplay } from '@/lib/account-display'
import { fetchChartData } from '@/lib/chart-series'
import { formatPeriodLabel } from '@/lib/period-label'
import { useTimeFilter } from '@/lib/time-context'
import { cn } from '@/lib/utils'

const PALETTE = CHART_COLORS
const INCOME = '#12a594'
const EXPENSE = '#e0656b'

function visible(nodes: AccountNode[]): AccountNode[] {
  return nodes.filter((node) => Math.abs(node.total) > 0.005)
}

function shareItems<T extends { name: string; value: number }>(items: T[], otherLabel: string) {
  items = items.filter((item) => item.value > 0.005).sort((a, b) => b.value - a.value)
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const kept = items.filter((item) => total > 0 && item.value / total >= 0.01).slice(0, 8) as T[]
  const rest = items.filter((item) => !kept.includes(item)).reduce((sum, item) => sum + item.value, 0)
  if (rest > 0) kept.push({ name: otherLabel, value: rest } as T)
  const hhi = total > 0 ? items.reduce((sum, item) => sum + (item.value / total) ** 2, 0) : 0
  return {
    items: kept,
    total,
    top: items[0] ? items[0].value / total : 0,
    effective: hhi > 0 ? 1 / hhi : 0,
  }
}

/** Deepest accounts with their own postings; duplicate names get a parent prefix. */
function leafItems(nodes: AccountNode[], format: (name: string) => string) {
  const rows: Array<{ name: string; value: number; parent: string }> = []
  const walk = (node: AccountNode, parentLabel: string) => {
    const childTotal = node.children.reduce((sum, child) => sum + child.total, 0)
    const own = node.total - childTotal
    const label = format(node.name)
    if (Math.abs(own) > 0.005) rows.push({ name: label, value: Math.abs(own), parent: parentLabel })
    for (const child of node.children) walk(child, label)
  }
  for (const node of nodes) walk(node, '')
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1)
  return rows.map((row) => ({
    name: (counts.get(row.name) ?? 0) > 1 && row.parent ? row.parent + ' · ' + row.name : row.name,
    value: row.value,
  }))
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
    <section className={cn('density-card rounded-lg border border-border bg-card p-4', className)}>
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

function Pie({ items, top, label, currency }: { items: Array<{ name: string; value: number; color?: string }>; top: number; label: string; currency: string }) {
  const { formatCurrency } = useI18n()
  const { isDark } = useTheme()
  const labelColor = isDark ? '#c4c4cc' : '#52525b'
  const strongColor = isDark ? '#f4f4f5' : '#18181b'
  const pieTotal = items.reduce((sum, item) => sum + item.value, 0)
  const option = useMemo<echarts.EChartsOption>(
    () => ({
      color: PALETTE,
      tooltip: {
        ...tooltipStyle,
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
          label: { fontSize: 10, color: labelColor, formatter: '{b} {d}%' },
          labelLayout: { hideOverlap: true },
          data: items.map((item) => {
            const show = pieTotal > 0 && item.value / pieTotal >= 0.04
            return {
              ...item,
              ...(item.color ? { itemStyle: { color: item.color } } : {}),
              label: { show },
              labelLine: { show },
            }
          }),
        },
      ],
      title: {
        text: (top * 100).toFixed(1) + '%',
        subtext: label,
        left: 'center',
        top: '40%',
        textStyle: { fontSize: 24, fontWeight: 600, color: strongColor },
        subtextStyle: { fontSize: 11, color: labelColor },
      },
    }),
    [items, top, label, currency, formatCurrency, labelColor, strongColor],
  )
  return <Chart option={option} height={260} />
}

function Treemap({ nodes, currency }: { nodes: AccountNode[]; currency: string }) {
  const { formatCurrency } = useI18n()
  const { format: formatAccount } = useAccountDisplay()
  const { isDark } = useTheme()
  const data = visible(nodes).map((node) => {
    const color = colorForCategory(expenseKey(node.name))
    return {
      name: formatAccount(node.name),
      value: Math.abs(node.total),
      itemStyle: { color },
      label: { color: textOnFill(color) },
      children: visible(node.children).map((child) => ({
        name: formatAccount(child.name),
        value: Math.abs(child.total),
        itemStyle: { color },
        label: { color: textOnFill(color) },
      })),
    }
  })
  const option = useMemo<echarts.EChartsOption>(
    () => ({
      color: PALETTE,
      tooltip: {
        ...tooltipStyle,
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
          upperLabel: {
            show: true,
            height: 20,
            fontSize: 11,
            color: isDark ? '#f4f4f5' : '#3f3f46',
            fontWeight: 500,
          },
          label: {
            fontSize: 10,
            color: '#ffffff',
            overflow: 'truncate',
            textShadowColor: 'rgba(0,0,0,0.45)',
            textShadowBlur: 3,
          },
          itemStyle: { color: 'transparent', borderColor: 'transparent', borderWidth: 2, gapWidth: 2 },
          levels: [
            { itemStyle: { borderColor: 'transparent', borderWidth: 2, gapWidth: 2 } },
            { itemStyle: { borderColor: 'transparent', borderWidth: 1, gapWidth: 1 } },
          ],
          data,
        },
      ],
    }),
    [data, currency, formatCurrency, isDark],
  )
  return <Chart option={option} height={280} />
}

export function Charts() {
  const { t, locale, formatCurrency, formatDate } = useI18n()
  const { format: formatAccount } = useAccountDisplay()
  const { timeFilter, isAllTime } = useTimeFilter()
  const time = isAllTime ? undefined : timeFilter
  const balance = useQuery({ queryKey: ['charts-balance', time], queryFn: ({ signal }) => fetchBalanceSheet(time, signal) })
  const income = useQuery({ queryKey: ['charts-income', time], queryFn: ({ signal }) => fetchIncomeStatement(time, signal) })
  const [dim, setDim] = useState<'assetClass' | 'group' | 'account'>('assetClass')
  const [classMap, setClassMap] = useState<Record<string, AssetClass>>(loadClassMap)
  const [mapOpen, setMapOpen] = useState(false)
  const [mapDraft, setMapDraft] = useState<Record<string, AssetClass>>({})

  const loading = balance.isPending || income.isPending
  const failed = balance.isError || income.isError

  const assets = balance.data?.sections.find((section) => section.section === 'assets')?.children ?? []
  const expenses = income.data?.sections.find((section) => section.section === 'expenses')
  const incomeSection = income.data?.sections.find((section) => section.section === 'income')

  const allocation = useMemo(() => {
    const visibleAssets = assets.filter((node) => Math.abs(node.total) > 0.005)
    let items: Array<{ name: string; value: number }>
    if (dim === 'assetClass') {
      const totals = new Map<AssetClass, number>()
      for (const node of visibleAssets) {
        const key = classOf(node, classMap)
        totals.set(key, (totals.get(key) ?? 0) + Math.abs(node.total))
      }
      items = ASSET_CLASSES.map((key) => ({
        key: 'assetClass:' + key,
        name: t(('charts.assetClasses.' + key) as MessageKey),
        value: totals.get(key) ?? 0,
        color: colorForCategory('assetClass:' + key),
      }))
    } else if (dim === 'group') {
      items = visibleAssets.map((node) => ({ name: formatAccount(node.name), value: Math.abs(node.total) }))
    } else {
      items = leafItems(assets, formatAccount)
    }
    return shareItems(items, t('charts.otherLabel'))
  }, [assets, dim, classMap, formatAccount, t])

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

  const { isDark } = useTheme()
  const axisX = (data: string[]) => categoryAxis(data, isDark)
  const axisY = (formatter: (value: number) => string) => valueAxis(formatter, isDark)

  const flowsOption = useMemo<echarts.EChartsOption>(
    () => ({
      grid: { left: 88, right: 24, top: 12, bottom: 24 },
      xAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatCurrency(value, currency) } },
      yAxis: { type: 'category', data: [t('charts.expense'), t('charts.income'), t('charts.left')] },
      tooltip: { ...tooltipStyle, trigger: 'axis', valueFormatter: (value) => formatCurrency(Number(value), currency) },
      series: [
        {
          type: 'bar',
          barMaxWidth: 24,
          data: [
            { value: expenseTotal, itemStyle: { color: EXPENSE } },
            { value: incomeTotal, itemStyle: { color: INCOME } },
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
      tooltip: { ...tooltipStyle, trigger: 'axis', valueFormatter: (value) => money(Number(value)) },
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
      tooltip: { ...tooltipStyle, trigger: 'axis', valueFormatter: (value) => money(Number(value)) },
      xAxis: axisX(cashflow.map((point) => point.label)),
      yAxis: axisY((value) => compact.format(value)),
      series: [
        {
          type: 'bar',
          name: t('charts.income'),
          data: cashflow.map((point) => point.income),
          itemStyle: { color: INCOME },
          barMaxWidth: 14,
        },
        {
          type: 'bar',
          name: t('charts.expense'),
          data: cashflow.map((point) => point.expense),
          itemStyle: { color: EXPENSE },
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
      tooltip: { ...tooltipStyle, trigger: 'axis', valueFormatter: (value) => money(Number(value)) },
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
          itemStyle: {
            color:
              last && merged > 0
                ? colorForCategory('rollup:other')
                : colorForCategory(expenseKey(name)),
          },
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
      tooltip: { ...tooltipStyle, trigger: 'axis', valueFormatter: (value) => money(Number(value)) },
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
          itemStyle: { color: PALETTE[3] },
          barMaxWidth: 14,
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payees, currency, compact],
  )

  const classGroups = assets.filter((node) => Math.abs(node.total) > 0.005)

  function openMap() {
    const draft: Record<string, AssetClass> = {}
    for (const node of classGroups) draft[node.account] = classOf(node, classMap)
    setMapDraft(draft)
    setMapOpen(true)
  }

  function saveMap() {
    // Keep only real overrides: guessing again later still works after renames.
    const next: Record<string, AssetClass> = {}
    for (const node of classGroups) {
      const value = mapDraft[node.account] ?? classOf(node, classMap)
      if (value !== guessAssetClass(node.account, node.name)) next[node.account] = value
    }
    setClassMap(next)
    saveClassMap(next)
    setMapOpen(false)
  }

  function resetMap() {
    const draft: Record<string, AssetClass> = {}
    for (const node of classGroups) draft[node.account] = guessAssetClass(node.account, node.name)
    setMapDraft(draft)
  }

  const seriesPending = series.isPending
  const seriesFailed = series.isError
  const savingsUndefined = !loading && !failed && incomeTotal <= 0
  const unconverted = [
    ...(balance.data?.unconverted_currencies ?? []),
    ...(income.data?.unconverted_currencies ?? []),
  ].filter((value, index, all) => all.indexOf(value) === index)
  const kpiReady = !loading && !failed
  const kpiItems = [
    {
      label: t('charts.netWorth'),
      value: kpiReady && balance.data ? formatCurrency(net, currency) : null,
    },
    {
      label: t('charts.assets'),
      value: kpiReady && balance.data ? formatCurrency(balance.data.totals.assets, currency) : null,
    },
    {
      label: t('charts.liabilities'),
      value:
        kpiReady && balance.data
          ? formatCurrency(Math.abs(balance.data.totals.liabilities), currency)
          : null,
    },
    {
      label: t('charts.savingsRate'),
      value: kpiReady && !savingsUndefined ? (savingRate * 100).toFixed(1) + '%' : null,
      note: savingsUndefined ? t('charts.savingsUndefined') : undefined,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{t('charts.title')}</h1>
          <div className="mt-1 text-xs text-muted-foreground">
            {t('charts.filterPeriod')} ·{' '}
            {isAllTime ? t('time.allTime') : formatPeriodLabel(timeFilter, t)}
          </div>
        </div>
        <ReportWhen currency={currency}>
          {balance.data?.as_of ? formatDate(balance.data.as_of) : null}
        </ReportWhen>
      </div>

      {unconverted.length > 0 ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>{t('balanceSheet.unconvertedTitle')}</AlertTitle>
          <AlertDescription>
            {t('balanceSheet.unconvertedBody', {
              currency,
              currencies: unconverted.join(', '),
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiItems.map((item) => (
          <div key={item.label} className="density-card rounded-lg border border-border bg-card p-4">
            <div className="text-[11px] text-muted-foreground">{item.label}</div>
            <div className="mt-1.5 text-[26px] leading-8 font-semibold tracking-tight tabular-nums">
              {item.value ?? '—'}
            </div>
            {failed ? (
              <div className="mt-1 text-[11px] text-muted-foreground">{t('charts.kpiUnavailable')}</div>
            ) : item.note ? (
              <div className="mt-1 text-[11px] text-muted-foreground">{item.note}</div>
            ) : null}
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
              <div className="flex items-center gap-1.5">
                {(['assetClass', 'group', 'account'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDim(key)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs',
                      dim === key ? 'border-primary text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {t(
                      key === 'assetClass'
                        ? 'charts.byAssetClass'
                        : key === 'group'
                          ? 'charts.byGroup'
                          : 'charts.byAccount',
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={openMap}
                  aria-label={t('charts.mapEdit')}
                  className="rounded-full border p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Settings2 className="size-3.5" />
                </button>
              </div>
            }
          >
            {allocation.total > 0 ? (
              <>
                <Pie
                  items={allocation.items}
                  top={allocation.top}
                  label={t('charts.topShare')}
                  currency={currency}
                />
                <p className="text-xs text-muted-foreground">
                  {t(
                    dim === 'assetClass'
                      ? 'charts.effectiveAssetClass'
                      : dim === 'group'
                        ? 'charts.effectiveGroups'
                        : 'charts.effectiveAccounts',
                  )}{' '}
                  {allocation.effective.toFixed(1)}
                </p>
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">{t('charts.details')}</summary>
                  <ul className="mt-2 grid gap-1">
                    {allocation.items.map((item) => (
                      <li key={item.name} className="flex items-center justify-between gap-3">
                        <span>{item.name}</span>
                        <span className="tabular-nums">
                          {formatCurrency(item.value, currency)}
                          {allocation.total > 0 ? ' · ' + ((item.value / allocation.total) * 100).toFixed(1) + '%' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : (
              <p className="py-12 text-center text-xs text-muted-foreground">
                {t('charts.noAllocation')}
              </p>
            )}
          </ChartFrame>

          <ChartFrame title={t('charts.spending')} hint={t('charts.spendingHint')}>
                                {visible(expenses?.children ?? []).length > 0 ? (
              <>
                <Treemap nodes={expenses?.children ?? []} currency={currency} />
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">{t('charts.details')}</summary>
                  <ul className="mt-2 grid gap-1">
                    {visible(expenses?.children ?? []).map((node) => (
                      <li key={node.name} className="flex items-center justify-between gap-3">
                        <span>{formatAccount(node.name)}</span>
                        <span className="tabular-nums">
                          {formatCurrency(Math.abs(node.total), currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : (
              <p className="py-12 text-center text-xs text-muted-foreground">
                {t('charts.noExpenses')}
              </p>
            )}
          </ChartFrame>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('charts.mapTitle')}</DialogTitle>
            <DialogDescription>{t('charts.mapHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
            {classGroups.map((node) => (
              <div key={node.account} className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-sm">{formatAccount(node.name)}</span>
                <Select
                  value={mapDraft[node.account] ?? classOf(node, classMap)}
                  onValueChange={(value) =>
                    setMapDraft((current) => ({ ...current, [node.account]: value as AssetClass }))
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CLASSES.map((key) => (
                      <SelectItem key={key} value={key}>
                        {t(('charts.assetClasses.' + key) as MessageKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" className="mr-auto" onClick={resetMap}>
              {t('charts.mapAuto')}
            </Button>
            <Button variant="ghost" onClick={() => setMapOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveMap}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

          <section className="mt-2 flex flex-col gap-4 rounded-2xl bg-muted/30 p-5 lg:col-span-2">
            <PortfolioView />
          </section>

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
