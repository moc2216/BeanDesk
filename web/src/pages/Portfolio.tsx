import { useQuery } from '@tanstack/react-query'
import * as echarts from 'echarts'
import { ChevronDown, Settings2, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Chart } from '@/components/echart'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n'
import { fetchBalanceSheet } from '@/lib/api'
import { useAccountDisplay } from '@/lib/account-display'
import { guessInvestmentAccounts, portfolioRows } from '@/lib/portfolio-rows'
import { loadAccounts, loadTargets, saveAccounts, saveTargets } from '@/lib/portfolio-store'
import { formatShare } from '@/lib/portfolio'
import { useTimeFilter } from '@/lib/time-context'
import { cn } from '@/lib/utils'

const COLORS = ['#4f8cff', '#f06a9b', '#ffc53d', '#35c8d8', '#f4765a', '#7c6cf0', '#35c88a', '#b08968']

export function Portfolio() {
  const { t, formatCurrency } = useI18n()
  const { format: formatAccount } = useAccountDisplay()
  const { timeFilter, isAllTime } = useTimeFilter()
  const time = isAllTime ? undefined : timeFilter
  const balance = useQuery({
    queryKey: ['portfolio-balance', time],
    queryFn: ({ signal }) => fetchBalanceSheet(time, signal),
  })

  const assets = balance.data?.sections.find((section) => section.section === 'assets')?.children ?? []
  const currency = balance.data?.operating_currency ?? 'CNY'

  const [stored, setStored] = useState<string[] | null>(loadAccounts)
  const [targets, setTargets] = useState<Record<string, number>>(loadTargets)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [targetOpen, setTargetOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pickerDraft, setPickerDraft] = useState<string[]>([])
  const [targetDraft, setTargetDraft] = useState<Record<string, string>>(() => {
    const saved = loadTargets()
    return Object.fromEntries(Object.entries(saved).map(([key, value]) => [key, String(value)]))
  })

  const selected = stored ?? guessInvestmentAccounts(assets)
  const nodes = useMemo(
    () => assets.filter((node) => selected.includes(node.account)),
    [assets, selected],
  )
  const rows = useMemo(
    () => portfolioRows(nodes, formatAccount, targets),
    [nodes, formatAccount, targets],
  )
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  const targetTotal = rows.reduce((sum, row) => sum + (row.target ?? 0), 0)
  const hasTargets = rows.some((row) => row.target != null)
  const gaps = rows
    .filter((row) => row.target != null && row.gap != null && Math.abs(row.gap) > total * 0.005)
    .sort((a, b) => Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0))
  const toAdjust = gaps.reduce((sum, row) => sum + Math.max(0, row.gap ?? 0), 0)

  const option = useMemo<echarts.EChartsOption>(() => {
    const data = rows.map((row, index) => ({
      name: row.name,
      value: row.value,
      itemStyle: { color: COLORS[index % COLORS.length] },
      label: { show: total > 0 && row.value / total >= 0.06, rotate: 0 },
      children: row.children.map((child, childIndex) => ({
        name: child.name,
        value: child.value,
        itemStyle: {
          color: COLORS[index % COLORS.length],
          opacity: Math.max(0.4, 0.9 - childIndex * 0.12),
        },
      })),
    }))
    return {
      tooltip: {
        formatter: (params) => {
          const item = params as { name: string; value: number }
          return item.name + '<br/>' + formatCurrency(item.value, currency) + ' · ' + formatShare(item.value, total)
        },
      },
      series: [
        {
          type: 'sunburst',
          data,
          radius: ['38%', '96%'],
          center: ['50%', '50%'],
          nodeClick: false,
          emphasis: { focus: 'ancestor' },
          itemStyle: { borderColor: 'transparent', borderWidth: 2, borderRadius: 3 },
          label: { fontSize: 10, color: '#fff', rotate: 0 },
          levels: [
            {},
            { r0: '38%', r: '64%', label: { fontSize: 10 } },
            { r0: '64%', r: '96%', label: { show: false } },
          ],
        },
      ],
    }
  }, [rows, total, currency, formatCurrency])

  const candidates = assets.filter((node) => node.children.length > 0)

  function openPicker() {
    setPickerDraft(selected)
    setPickerOpen(true)
  }

  function savePicker() {
    setStored(pickerDraft)
    saveAccounts(pickerDraft)
    setPickerOpen(false)
  }

  function openTargets() {
    const draft: Record<string, string> = {}
    for (const row of rows) draft[row.account] = row.target == null ? '' : String(row.target)
    setTargetDraft(draft)
    setTargetOpen(true)
  }

  function saveTargetsDialog() {
    const next: Record<string, number> = {}
    for (const [account, raw] of Object.entries(targetDraft)) {
      const value = Number(raw)
      if (raw.trim() !== '' && Number.isFinite(value) && value >= 0) next[account] = value
    }
    setTargets(next)
    saveTargets(next)
    setTargetOpen(false)
  }

  function toggle(account: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(account)) next.delete(account)
      else next.add(account)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{t('portfolio.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('portfolio.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openPicker}>
            <Settings2 data-icon="inline-start" />
            {t('portfolio.accounts')}
          </Button>
          <Button variant="outline" size="sm" onClick={openTargets} disabled={rows.length === 0}>
            {t('portfolio.targets')}
          </Button>
        </div>
      </div>

      {balance.isPending ? (
        <Skeleton className="h-[420px] w-full" />
      ) : selected.length === 0 || rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Wallet className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">{t('portfolio.empty')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('portfolio.emptyHint')}</p>
          <Button className="mt-4" size="sm" onClick={openPicker}>
            {t('portfolio.accounts')}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: t('portfolio.invested'), value: formatCurrency(total, currency) },
              {
                label: t('portfolio.targetCoverage'),
                value: hasTargets ? targetTotal.toFixed(0) + '%' : '—',
              },
              {
                label: t('portfolio.toAdjust'),
                value: hasTargets ? formatCurrency(toAdjust, currency) : '—',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="relative">
              <Chart option={option} height={340} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] text-muted-foreground">{t('portfolio.total')}</span>
                <span className="max-w-[70%] truncate text-sm font-semibold tabular-nums">
                  {formatCurrency(total, currency)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {t('portfolio.positions', { count: rows.reduce((sum, row) => sum + Math.max(1, row.children.length), 0) })}
                </span>
              </div>
            </div>

            <div className="flex min-w-0 flex-col">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 pb-1 text-[11px] text-muted-foreground">
                <span>{t('portfolio.class')}</span>
                <span className="text-right">{t('portfolio.actual')}</span>
                <span className="w-24 text-right">{t('portfolio.target')}</span>
              </div>
              {rows.map((row, index) => {
                const open = expanded.has(row.account)
                const gapPct = row.target == null ? null : row.target - row.share * 100
                return (
                  <div key={row.account}>
                    <button
                      type="button"
                      onClick={() => toggle(row.account)}
                      className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-[3px]"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="truncate text-sm">{row.name}</span>
                        {row.children.length > 0 ? (
                          <ChevronDown
                            className={cn(
                              'size-3.5 shrink-0 text-muted-foreground transition-transform',
                              open && 'rotate-180',
                            )}
                          />
                        ) : (
                          <span className="size-3.5 shrink-0" />
                        )}
                      </span>
                      <span className="text-right text-sm tabular-nums">{formatShare(row.value, total)}</span>
                      <span className="w-24 text-right text-sm tabular-nums text-muted-foreground">
                        {row.target == null ? '—' : row.target.toFixed(0) + '%'}
                        {gapPct != null && Math.abs(gapPct) >= 1 ? (
                          <span
                            className={cn(
                              'ml-1 text-[11px]',
                              gapPct > 0 ? 'text-positive' : 'text-destructive',
                            )}
                          >
                            {gapPct > 0 ? '+' : ''}
                            {gapPct.toFixed(1)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {open
                      ? row.children.map((child) => (
                          <div
                            key={child.account}
                            className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1 pl-8 pr-2 text-xs text-muted-foreground"
                          >
                            <span className="truncate">{child.name}</span>
                            <span className="text-right tabular-nums">{formatShare(child.value, total)}</span>
                            <span className="w-24" />
                          </div>
                        ))
                      : null}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t('portfolio.rebalance')}</h2>
              {hasTargets ? null : (
                <span className="text-xs text-muted-foreground">{t('portfolio.noTargets')}</span>
              )}
            </div>
            {!hasTargets ? (
              <p className="mt-3 text-xs text-muted-foreground">{t('portfolio.targetsHint')}</p>
            ) : gaps.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">{t('portfolio.onTarget')}</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {gaps.map((row) => {
                  const gap = row.gap ?? 0
                  const over = gap < 0
                  return (
                    <div key={row.account} className="flex items-center gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      <span
                        className={cn(
                          'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                          over ? 'bg-destructive/10 text-destructive' : 'bg-positive/10 text-positive',
                        )}
                      >
                        {over ? t('portfolio.trim') : t('portfolio.add')}
                      </span>
                      <span className="w-36 shrink-0 text-right tabular-nums">
                        {formatCurrency(Math.abs(gap), currency)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('portfolio.accountsTitle')}</DialogTitle>
            <DialogDescription>{t('portfolio.accountsHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
            {candidates.map((node) => {
              const checked = pickerDraft.includes(node.account)
              return (
                <label
                  key={node.account}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      setPickerDraft((current) =>
                        value === true
                          ? [...current, node.account]
                          : current.filter((item) => item !== node.account),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{formatAccount(node.name)}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(Math.abs(node.total), currency)}
                  </span>
                </label>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={savePicker}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={targetOpen} onOpenChange={setTargetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('portfolio.targetsTitle')}</DialogTitle>
            <DialogDescription>{t('portfolio.targetsHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {rows.map((row) => (
              <div key={row.account} className="flex items-center gap-3">
                <Label htmlFor={'target-' + row.account} className="min-w-0 flex-1 truncate font-normal">
                  {row.name}
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    id={'target-' + row.account}
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    className="w-20 text-right"
                    value={targetDraft[row.account] ?? ''}
                    onChange={(event) =>
                      setTargetDraft((current) => ({ ...current, [row.account]: event.target.value }))
                    }
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('portfolio.targetsTotal', {
              value: Object.values(targetDraft).reduce((sum, raw) => {
                const value = Number(raw)
                return sum + (raw.trim() !== '' && Number.isFinite(value) ? value : 0)
              }, 0).toFixed(0),
            })}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTargetOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveTargetsDialog}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

